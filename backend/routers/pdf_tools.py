"""Standalone PDF utilities: extract, merge images, compress, password, blank-removal, OCR."""
import io
import re
from typing import Optional
import fitz  # PyMuPDF
from flask import Blueprint, request, jsonify, Response
from utils.auth import require_auth

pdf_tools_bp = Blueprint("pdf_tools", __name__)

MAX_FILE = 100 * 1024 * 1024  # 100 MB


def _read_pdf(files_key: str = "file") -> bytes:
    f = request.files.get(files_key)
    if not f:
        raise ValueError("파일이 없습니다.")
    if not (f.filename or "").lower().endswith(".pdf"):
        raise ValueError(f"PDF 파일이 아닙니다: {f.filename}")
    data = f.read()
    if len(data) > MAX_FILE:
        raise ValueError("파일이 100MB를 초과합니다.")
    return data


def _pdf_response(data: bytes, filename: str) -> Response:
    return Response(
        data, status=200, mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


def _parse_ranges(spec: str, total: int) -> list[int]:
    """Parse '1-3,5,7-9' → [0,1,2,4,6,7,8] (0-indexed)."""
    pages: set[int] = set()
    for chunk in re.split(r"[,\s]+", spec.strip()):
        if not chunk:
            continue
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", chunk)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            for p in range(min(a, b), max(a, b) + 1):
                if 1 <= p <= total:
                    pages.add(p - 1)
        else:
            p = int(chunk)
            if 1 <= p <= total:
                pages.add(p - 1)
    return sorted(pages)


# ── 1. EXTRACT (split) — extract specified pages to new PDF ────────────
@pdf_tools_bp.route("/extract", methods=["POST"])
@require_auth
def extract(uid):
    try:
        data = _read_pdf()
        ranges = (request.form.get("ranges") or "").strip()
        if not ranges:
            return jsonify({"detail": "페이지 범위를 입력하세요. 예: 1-3,5,7-9"}), 400

        src = fitz.open(stream=data, filetype="pdf")
        idxs = _parse_ranges(ranges, len(src))
        if not idxs:
            return jsonify({"detail": "유효한 페이지가 없습니다."}), 400

        out = fitz.open()
        for i in idxs:
            out.insert_pdf(src, from_page=i, to_page=i)
        buf = io.BytesIO()
        out.save(buf)
        return _pdf_response(buf.getvalue(), "extracted.pdf")
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": f"추출 실패: {e}"}), 500


# ── 2. FROM-IMAGES — convert images to a single PDF ────────────────────
@pdf_tools_bp.route("/from-images", methods=["POST"])
@require_auth
def from_images(uid):
    try:
        files = request.files.getlist("files")
        if not files:
            return jsonify({"detail": "이미지가 없습니다."}), 400
        page_size = (request.form.get("size") or "fit").lower()  # 'a4', 'fit'

        out = fitz.open()
        for f in files:
            data = f.read()
            if len(data) > MAX_FILE:
                return jsonify({"detail": f"{f.filename}이(가) 100MB를 초과합니다."}), 413
            try:
                img_doc = fitz.open(stream=data, filetype=(f.filename.split(".")[-1].lower() if "." in f.filename else "jpg"))
            except Exception:
                # Fall back: load via Pixmap
                pix = fitz.Pixmap(data)
                rect = fitz.Rect(0, 0, pix.width, pix.height)
                page = out.new_page(width=rect.width, height=rect.height)
                page.insert_image(rect, pixmap=pix)
                continue

            for img_page in img_doc:
                src_rect = img_page.rect
                if page_size == "a4":
                    page = out.new_page(width=595, height=842)  # A4 in points
                    target = page.rect
                else:
                    page = out.new_page(width=src_rect.width, height=src_rect.height)
                    target = page.rect
                pix = img_page.get_pixmap(dpi=200)
                # Fit-with-letterbox for A4
                if page_size == "a4":
                    sw, sh = pix.width, pix.height
                    scale = min(target.width / sw, target.height / sh)
                    fw, fh = sw * scale, sh * scale
                    fx = (target.width - fw) / 2
                    fy = (target.height - fh) / 2
                    page.insert_image(fitz.Rect(fx, fy, fx + fw, fy + fh), pixmap=pix)
                else:
                    page.insert_image(target, pixmap=pix)
            img_doc.close()

        buf = io.BytesIO()
        out.save(buf)
        return _pdf_response(buf.getvalue(), "from_images.pdf")
    except Exception as e:
        return jsonify({"detail": f"변환 실패: {e}"}), 500


# ── 3. COMPRESS — re-encode images at lower DPI/quality ────────────────
@pdf_tools_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    try:
        data = _read_pdf()
        quality = request.form.get("quality") or "medium"  # low/medium/high
        dpi_map = {"low": 100, "medium": 150, "high": 200}
        jpg_q_map = {"low": 50, "medium": 70, "high": 85}
        dpi = dpi_map.get(quality, 150)
        jpg_q = jpg_q_map.get(quality, 70)

        src = fitz.open(stream=data, filetype="pdf")
        out = fitz.open()
        for page in src:
            pix = page.get_pixmap(dpi=dpi)
            jpg_bytes = pix.tobytes("jpeg", jpg_quality=jpg_q)
            new_page = out.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(page.rect, stream=jpg_bytes)

        buf = io.BytesIO()
        out.save(buf, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        return _pdf_response(buf.getvalue(), "compressed.pdf")
    except Exception as e:
        return jsonify({"detail": f"압축 실패: {e}"}), 500


# ── 4. ENCRYPT — add password ──────────────────────────────────────────
@pdf_tools_bp.route("/encrypt", methods=["POST"])
@require_auth
def encrypt(uid):
    try:
        data = _read_pdf()
        password = (request.form.get("password") or "").strip()
        if not password:
            return jsonify({"detail": "비밀번호를 입력하세요."}), 400
        if len(password) > 32:
            return jsonify({"detail": "비밀번호는 32자 이내로 입력하세요."}), 400

        src = fitz.open(stream=data, filetype="pdf")
        buf = io.BytesIO()
        # AES-256 encryption, both owner & user passwords set to provided value
        perm = (
            fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY
            | fitz.PDF_PERM_ANNOTATE | fitz.PDF_PERM_FORM
            | fitz.PDF_PERM_ACCESSIBILITY | fitz.PDF_PERM_ASSEMBLE
            | fitz.PDF_PERM_PRINT_HQ
        )
        src.save(buf, encryption=fitz.PDF_ENCRYPT_AES_256,
                 owner_pw=password, user_pw=password, permissions=perm)
        return _pdf_response(buf.getvalue(), "encrypted.pdf")
    except Exception as e:
        return jsonify({"detail": f"암호 설정 실패: {e}"}), 500


# ── 5. DECRYPT — remove password ───────────────────────────────────────
@pdf_tools_bp.route("/decrypt", methods=["POST"])
@require_auth
def decrypt(uid):
    try:
        data = _read_pdf()
        password = (request.form.get("password") or "").strip()
        src = fitz.open(stream=data, filetype="pdf")
        if src.is_encrypted:
            if not src.authenticate(password):
                return jsonify({"detail": "비밀번호가 올바르지 않습니다."}), 403
        buf = io.BytesIO()
        src.save(buf, encryption=fitz.PDF_ENCRYPT_NONE)
        return _pdf_response(buf.getvalue(), "decrypted.pdf")
    except Exception as e:
        return jsonify({"detail": f"암호 해제 실패: {e}"}), 500


# ── 6. REMOVE-BLANK — auto-detect & remove blank pages ─────────────────
def _is_blank(page: fitz.Page, threshold: float = 0.005) -> bool:
    """A page is blank if it has no text AND its rendered pixmap is mostly white."""
    if page.get_text("text").strip():
        return False
    pix = page.get_pixmap(dpi=72)  # low dpi enough
    samples = pix.samples
    # Rough non-white pixel ratio
    n = pix.width * pix.height
    if n == 0:
        return True
    non_white = 0
    step = max(1, n // 5000)  # sample every Nth pixel for speed
    bytes_per_pixel = pix.n
    for i in range(0, n, step):
        off = i * bytes_per_pixel
        r, g, b = samples[off], samples[off + 1], samples[off + 2]
        if r < 240 or g < 240 or b < 240:
            non_white += 1
    sampled = max(1, n // step)
    return (non_white / sampled) < threshold


@pdf_tools_bp.route("/remove-blank", methods=["POST"])
@require_auth
def remove_blank(uid):
    try:
        data = _read_pdf()
        src = fitz.open(stream=data, filetype="pdf")
        keep = [i for i, page in enumerate(src) if not _is_blank(page)]
        if not keep:
            return jsonify({"detail": "모든 페이지가 빈 페이지로 감지되었습니다."}), 400
        out = fitz.open()
        for i in keep:
            out.insert_pdf(src, from_page=i, to_page=i)
        buf = io.BytesIO()
        out.save(buf)
        removed = len(src) - len(keep)
        resp = _pdf_response(buf.getvalue(), "no_blanks.pdf")
        resp.headers["X-Removed-Count"] = str(removed)
        resp.headers["Access-Control-Expose-Headers"] = "X-Removed-Count, Content-Disposition"
        return resp
    except Exception as e:
        return jsonify({"detail": f"빈 페이지 제거 실패: {e}"}), 500


# ── 7. OCR — Google Gemini-based text extraction → searchable PDF ──────
@pdf_tools_bp.route("/ocr", methods=["POST"])
@require_auth
def ocr(uid):
    """Use Gemini to extract text from each page; embed as invisible text layer."""
    try:
        from utils.api_key import get_google_api_key
        from google import genai
        from google.genai import types as gtypes

        api_key = get_google_api_key()
        if not api_key:
            return jsonify({"detail": "Google API 키가 없습니다. 관리자 페이지에서 등록해 주세요."}), 500

        data = _read_pdf()
        src = fitz.open(stream=data, filetype="pdf")
        if len(src) > 30:
            return jsonify({"detail": "OCR은 30페이지 이하 PDF만 지원합니다."}), 413

        client = genai.Client(api_key=api_key)
        out = fitz.open(stream=data, filetype="pdf")
        for i, page in enumerate(out):
            if page.get_text("text").strip():
                continue  # already has selectable text
            pix = page.get_pixmap(dpi=200)
            img_bytes = pix.tobytes("jpeg", jpg_quality=85)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[
                    "이 이미지에 있는 모든 텍스트를 정확히 추출해서 줄바꿈을 그대로 유지해 출력해 주세요. 텍스트만 출력하고 다른 설명은 하지 마세요.",
                    gtypes.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
                ],
            )
            extracted = (response.text or "").strip()
            if not extracted:
                continue
            # Insert as invisible text covering the page so it's searchable
            page.insert_textbox(
                page.rect, extracted,
                fontsize=8, fontname="helv",
                color=(0, 0, 0), render_mode=3,  # render_mode 3 = invisible
                align=0,
            )

        buf = io.BytesIO()
        out.save(buf)
        return _pdf_response(buf.getvalue(), "ocr.pdf")
    except Exception as e:
        return jsonify({"detail": f"OCR 실패: {e}"}), 500
