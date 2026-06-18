import io
import traceback
import fitz
from flask import Blueprint, request, jsonify, Response

from models.schemas import PreflightReport
from services.preflight_svc import run_all_checks, compute_score
from utils.auth import require_auth

preflight_bp = Blueprint("preflight", __name__)


def _read_pdf_from_request():
    file = request.files.get("file")
    if not file:
        return None, None, (jsonify({"detail": "파일이 없습니다"}), 400)
    if not (file.filename or "").lower().endswith(".pdf"):
        return None, None, (jsonify({"detail": "PDF 파일만 업로드 가능합니다"}), 400)
    data = file.read()
    if len(data) > 200 * 1024 * 1024:
        return None, None, (jsonify({"detail": "파일이 200 MB 제한을 초과합니다"}), 413)
    return file, data, None


def _open_pdf(data: bytes) -> fitz.Document:
    return fitz.open(stream=data, filetype="pdf")


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0]
    base = base.strip() or "document"
    return f"{base}_{suffix}.pdf"


@preflight_bp.route("/check", methods=["POST"])
@require_auth
def check(uid):
    file, data, err = _read_pdf_from_request()
    if err:
        return err

    try:
        doc = _open_pdf(data)
    except Exception:
        return jsonify({"detail": "PDF 파일을 열 수 없습니다. PDF 복구/정상화 도구를 먼저 실행해 보세요."}), 400

    try:
        try:
            checks = run_all_checks(doc)
            score = compute_score(checks)
        except Exception as e:
            traceback.print_exc()
            return jsonify({"detail": f"검수 처리 실패: {type(e).__name__}: {e}"}), 500

        ai_feedback = None

        try:
            report = PreflightReport(
                filename=file.filename or "document.pdf",
                page_count=len(doc),
                checks=checks,
                ai_feedback=ai_feedback,
                score=score,
            )
            return jsonify(report.model_dump())
        except Exception as e:
            traceback.print_exc()
            return jsonify({"detail": f"리포트 생성 실패: {type(e).__name__}: {e}"}), 500
    finally:
        doc.close()


@preflight_bp.route("/fix", methods=["POST"])
@require_auth
def fix(uid):
    """Create a safer normalized PDF after preflight.

    This is a rule-based free fixer. It rebuilds the PDF structure, normalizes page
    boxes to the first valid page size, deflates streams, removes broken garbage,
    and falls back to rasterizing individual pages when vector placement fails.
    It cannot restore missing image detail, unknown passwords, or fonts that were
    never embedded in the source file.
    """
    file, data, err = _read_pdf_from_request()
    if err:
        return err

    try:
        src = _open_pdf(data)
    except Exception as e:
        return jsonify({
            "detail": "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 'PDF로 다시 저장/인쇄' 후 재시도하세요.",
            "error": f"{type(e).__name__}: {e}",
        }), 400

    out = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []
    try:
        if len(src) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if src.is_encrypted:
            src.close()
            return jsonify({"detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 복구/정상화를 진행하세요."}), 400

        # Use the first valid page size as the target; fall back to A4 if damaged.
        try:
            first_rect = src[0].rect
            target_w = float(first_rect.width) if first_rect.width > 0 else 595.0
            target_h = float(first_rect.height) if first_rect.height > 0 else 842.0
        except Exception:
            target_w, target_h = 595.0, 842.0

        for i in range(len(src)):
            try:
                page = src[i]
                src_rect = page.rect
                if src_rect.width <= 0 or src_rect.height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")

                new_page = out.new_page(width=target_w, height=target_h)
                scale = min(target_w / src_rect.width, target_h / src_rect.height)
                fit_w = src_rect.width * scale
                fit_h = src_rect.height * scale
                x0 = (target_w - fit_w) / 2
                y0 = (target_h - fit_h) / 2
                target_rect = fitz.Rect(x0, y0, x0 + fit_w, y0 + fit_h)

                try:
                    new_page.show_pdf_page(target_rect, src, i, keep_proportion=True)
                    copied_pages += 1
                except Exception:
                    # Some PDFs contain malformed vector resources. Preserve a usable
                    # page by rasterizing only that failed page instead of aborting.
                    pix = page.get_pixmap(dpi=180, alpha=False, annots=True)
                    img_rect = fitz.Rect(0, 0, pix.width, pix.height)
                    scale = min(target_w / img_rect.width, target_h / img_rect.height)
                    fit_w = img_rect.width * scale
                    fit_h = img_rect.height * scale
                    x0 = (target_w - fit_w) / 2
                    y0 = (target_h - fit_h) / 2
                    new_page.insert_image(fitz.Rect(x0, y0, x0 + fit_w, y0 + fit_h), pixmap=pix)
                    rasterized_pages += 1
            except Exception:
                skipped_pages.append(i + 1)
                continue

        if len(out) == 0:
            return jsonify({"detail": "복구 가능한 페이지가 없습니다."}), 400

        buf = io.BytesIO()
        out.save(buf, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True, clean=True)
        fixed_name = _safe_pdf_name(file.filename, "repaired")
        note = f"rebuilt-clean;copied={copied_pages};rasterized={rasterized_pages};skipped={','.join(map(str, skipped_pages))}"
        return Response(
            buf.getvalue(),
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={fixed_name}",
                "X-Fix-Note": note,
                "Access-Control-Expose-Headers": "X-Fix-Note, Content-Disposition",
            },
        )
    except Exception as e:
        traceback.print_exc()
        return jsonify({"detail": f"PDF 보정 실패: {type(e).__name__}: {e}"}), 500
    finally:
        try:
            src.close()
        except Exception:
            pass
        out.close()
