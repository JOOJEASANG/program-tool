"""Standalone PDF utilities: extract, merge images, compress, password, blank-removal."""
import io
import re
import fitz  # PyMuPDF
from flask import Blueprint, request, jsonify, Response
from utils.auth import require_auth

pdf_tools_bp = Blueprint("pdf_tools", __name__)

MAX_FILE = 100 * 1024 * 1024  # 100 MB
MAX_OCR_PAGES = 30


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
        data,
        status=200,
        mimetype="application/pdf",
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
            try:
                p = int(chunk)
            except ValueError:
                continue
            if 1 <= p <= total:
                pages.add(p - 1)
    return sorted(pages)


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
        out.close()
        src.close()
        return _pdf_response(buf.getvalue(), "extracted.pdf")
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400
    except Exception as e:
        return jsonify({"detail": f"추출 실패: {e}"}), 500


@pdf_tools_bp.route("/from-images", methods=["POST"])
@require_auth
def from_images(uid):
    try:
        files = request.files.getlist("files")
        if not files:
            return jsonify({"detail": "이미지가 없습니다."}), 400
        page_size = (request.form.get("size") or "fit").lower()

        out = fitz.open()
        for f in files:
            data = f.read()
            if len(data) > MAX_FILE:
                return jsonify({"detail": f"{f.filename}이(가) 100MB를 초과합니다."}), 413
            try:
                img_doc = fitz.open(stream=data, filetype=(f.filename.split(".")[-1].lower() if "." in f.filename else "jpg"))
            except Exception:
                pix = fitz.Pixmap(data)
                rect = fitz.Rect(0, 0, pix.width, pix.height)
                page = out.new_page(width=rect.width, height=rect.height)
                page.insert_image(rect, pixmap=pix)
                continue

            for img_page in img_doc:
                src_rect = img_page.rect
                if page_size == "a4":
                    page = out.new_page(width=595, height=842)
                    target = page.rect
                else:
                    page = out.new_page(width=src_rect.width, height=src_rect.height)
                    target = page.rect
                pix = img_page.get_pixmap(dpi=200)
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
        out.close()
        return _pdf_response(buf.getvalue(), "from_images.pdf")
    except Exception as e:
        return jsonify({"detail": f"변환 실패: {e}"}), 500


@pdf_tools_bp.route("/compress", methods=["POST"])
@require_auth
def compress(uid):
    try:
        data = _read_pdf()
        quality = request.form.get("quality") or "medium"
        dpi_map = {"low": 100, "medium": 150, "high": 200}
        jpg_q_map = {"low": 50, "medium": 70, "high": 85}
        dpi = dpi_map.get(quality, 150)
        jpg_q = jpg_q_map.get(quality, 70)

        src = fitz.open(stream=data, filetype="pdf")
        out = fitz.open()
        for page in src:
            pix = page.get_pixmap(dpi=dpi, alpha=False)
            jpg_bytes = pix.tobytes("jpeg", jpg_quality=jpg_q)
            new_page = out.new_page(width=page.rect.width, height=page.rect.height)
            new_page.insert_image(page.rect, stream=jpg_bytes)

        buf = io.BytesIO()
        out.save(buf, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        out.close()
        src.close()
        return _pdf_response(buf.getvalue(), "compressed.pdf")
    except Exception as e:
        return jsonify({"detail": f"압축 실패: {e}"}), 500


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
        perm = (
            fitz.PDF_PERM_PRINT | fitz.PDF_PERM_COPY
            | fitz.PDF_PERM_ANNOTATE | fitz.PDF_PERM_FORM
            | fitz.PDF_PERM_ACCESSIBILITY | fitz.PDF_PERM_ASSEMBLE
            | fitz.PDF_PERM_PRINT_HQ
        )
        src.save(buf, encryption=fitz.PDF_ENCRYPT_AES_256,
                 owner_pw=password, user_pw=password, permissions=perm)
        src.close()
        return _pdf_response(buf.getvalue(), "encrypted.pdf")
    except Exception as e:
        return jsonify({"detail": f"암호 설정 실패: {e}"}), 500


@pdf_tools_bp.route("/decrypt", methods=["POST"])
@require_auth
def decrypt(uid):
    try:
        data = _read_pdf()
        password = (request.form.get("password") or "").strip()
        src = fitz.open(stream=data, filetype="pdf")
        if src.is_encrypted and not src.authenticate(password):
            src.close()
            return jsonify({"detail": "비밀번호가 올바르지 않습니다."}), 403
        buf = io.BytesIO()
        src.save(buf, encryption=fitz.PDF_ENCRYPT_NONE)
        src.close()
        return _pdf_response(buf.getvalue(), "decrypted.pdf")
    except Exception as e:
        return jsonify({"detail": f"암호 해제 실패: {e}"}), 500


def _is_blank(page: fitz.Page, threshold: float = 0.005) -> bool:
    """A page is blank if it has no text and its rendered pixmap is mostly white."""
    if page.get_text("text").strip():
        return False
    pix = page.get_pixmap(dpi=72, alpha=False)
    samples = pix.samples
    n = pix.width * pix.height
    if n == 0:
        return True
    non_white = 0
    step = max(1, n // 5000)
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
            src.close()
            return jsonify({"detail": "모든 페이지가 빈 페이지로 감지되었습니다."}), 400
        out = fitz.open()
        for i in keep:
            out.insert_pdf(src, from_page=i, to_page=i)
        buf = io.BytesIO()
        out.save(buf)
        removed = len(src) - len(keep)
        out.close()
        src.close()
        resp = _pdf_response(buf.getvalue(), "no_blanks.pdf")
        resp.headers["X-Removed-Count"] = str(removed)
        resp.headers["Access-Control-Expose-Headers"] = "X-Removed-Count, Content-Disposition"
        return resp
    except Exception as e:
        return jsonify({"detail": f"빈 페이지 제거 실패: {e}"}), 500


@pdf_tools_bp.route("/ocr", methods=["POST"])
@require_auth
def ocr(uid):
    try:
        pdf_data = _read_pdf()
    except ValueError as e:
        return jsonify({"detail": str(e)}), 400

    try:
        import pytesseract
        from PIL import Image
        try:
            pytesseract.get_tesseract_version()
        except Exception:
            return jsonify({"detail": "OCR 실행 파일(Tesseract)이 서버에 설치되어 있지 않습니다. 관리자에게 문의하세요."}), 501

        src = fitz.open(stream=pdf_data, filetype="pdf")
        if len(src) > MAX_OCR_PAGES:
            src.close()
            return jsonify({"detail": f"OCR은 최대 {MAX_OCR_PAGES}페이지까지 처리할 수 있습니다."}), 413

        out = fitz.open()
        try:
            for page_num in range(len(src)):
                page = src[page_num]
                pix = page.get_pixmap(matrix=fitz.Matrix(300 / 72, 300 / 72), alpha=False)
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                try:
                    pdf_bytes = pytesseract.image_to_pdf_or_hocr(img, extension="pdf", lang="kor+eng")
                except pytesseract.TesseractError as e:
                    out.close()
                    src.close()
                    return jsonify({"detail": f"OCR 언어 데이터(kor+eng) 또는 실행 환경 오류: {e}"}), 501
                ocr_page = fitz.open(stream=pdf_bytes, filetype="pdf")
                out.insert_pdf(ocr_page)
                ocr_page.close()
        finally:
            src.close()

        buf = io.BytesIO()
        out.save(buf)
        out.close()
        return _pdf_response(buf.getvalue(), "ocr_output.pdf")
    except Exception as e:
        return jsonify({"detail": f"OCR 실패: {e}"}), 500
