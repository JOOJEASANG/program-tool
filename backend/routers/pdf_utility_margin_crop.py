"""Combined background cleanup + margin content removal for PDF Utility."""
from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

import fitz
from flask import Blueprint, request

from utils.auth import require_auth
from routers.pdf_utility import (
    _clean_background_document,
    _delete_storage_paths,
    _deliver_pdf_path,
    _download_storage_pdf_to_path,
    _error,
    _internal_error,
    _safe_name,
    _validate_storage_path,
)

pdf_utility_margin_crop_bp = Blueprint("pdf_utility_margin_crop", __name__)
MAX_MARGIN_MM = 100.0
MM_TO_PT = 72.0 / 25.4


def _margin(value, label: str) -> float:
    try:
        number = float(value or 0)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label} 여백은 숫자로 입력하세요.") from exc
    if number < 0 or number > MAX_MARGIN_MM:
        raise ValueError(f"{label} 여백은 0~{MAX_MARGIN_MM:g}mm 범위입니다.")
    return number


def _remove_margin_content(document: fitz.Document, margins_mm: dict[str, float]) -> None:
    """White out the requested edge areas while keeping the original page size."""
    left = margins_mm["left"] * MM_TO_PT
    right = margins_mm["right"] * MM_TO_PT
    top = margins_mm["top"] * MM_TO_PT
    bottom = margins_mm["bottom"] * MM_TO_PT

    for page in document:
        rect = page.rect
        if left + right >= rect.width or top + bottom >= rect.height:
            raise ValueError(
                "입력한 여백이 페이지 크기보다 큽니다. 네 방향 여백의 합을 페이지 크기보다 작게 입력하세요."
            )
        redactions = []
        if top > 0:
            redactions.append(fitz.Rect(rect.x0, rect.y0, rect.x1, rect.y0 + top))
        if bottom > 0:
            redactions.append(fitz.Rect(rect.x0, rect.y1 - bottom, rect.x1, rect.y1))
        if left > 0:
            redactions.append(fitz.Rect(rect.x0, rect.y0 + top, rect.x0 + left, rect.y1 - bottom))
        if right > 0:
            redactions.append(fitz.Rect(rect.x1 - right, rect.y0 + top, rect.x1, rect.y1 - bottom))
        for area in redactions:
            page.add_redact_annot(area, fill=(1, 1, 1))
        if redactions:
            page.apply_redactions()


@pdf_utility_margin_crop_bp.route("/background-cleanup-crop-storage", methods=["POST"])
@require_auth
def background_cleanup_crop_storage(uid):
    payload = request.get_json(silent=True) or {}
    raw_path = payload.get("storage_path")
    strength = str(payload.get("strength") or "medium").strip().lower()
    path = ""
    temp_dir = Path(tempfile.mkdtemp(prefix="pdf-utility-background-margin-"))
    try:
        path = _validate_storage_path(uid, raw_path)
        margins_mm = {
            "top": _margin(payload.get("margin_top_mm"), "위"),
            "bottom": _margin(payload.get("margin_bottom_mm"), "아래"),
            "left": _margin(payload.get("margin_left_mm"), "왼쪽"),
            "right": _margin(payload.get("margin_right_mm"), "오른쪽"),
        }
        source_path = temp_dir / "source.pdf"
        _download_storage_pdf_to_path(uid, path, source_path)
        source = None
        output = None
        try:
            source = fitz.open(str(source_path))
            if source.is_encrypted:
                raise ValueError("암호화된 PDF는 처리할 수 없습니다.")
            if source.page_count == 0:
                raise ValueError("PDF에 페이지가 없습니다.")
            output = fitz.open()
            page_count = _clean_background_document(source, output, strength)
            _remove_margin_content(output, margins_mm)
            output_path = temp_dir / "cleaned-margin.pdf"
            output.save(str(output_path), garbage=4, deflate=True, deflate_images=True)
        finally:
            if output is not None:
                output.close()
            if source is not None:
                source.close()

        source_name = _safe_name(payload.get("filename"), "document.pdf")
        base = source_name[:-4] if source_name.lower().endswith(".pdf") else source_name
        response = _deliver_pdf_path(
            uid,
            output_path,
            f"{base}_배경및여백제거.pdf",
            "pdf-utility-background-margin-removal",
        )
        response.headers["X-PDF-Page-Count"] = str(page_count)
        response.headers["X-Background-Strength"] = strength
        response.headers["X-Margin-Top-MM"] = str(margins_mm["top"])
        response.headers["X-Margin-Bottom-MM"] = str(margins_mm["bottom"])
        response.headers["X-Margin-Left-MM"] = str(margins_mm["left"])
        response.headers["X-Margin-Right-MM"] = str(margins_mm["right"])
        response.headers["Access-Control-Expose-Headers"] = (
            "X-PDF-Page-Count, X-Background-Strength, X-Margin-Top-MM, "
            "X-Margin-Bottom-MM, X-Margin-Left-MM, X-Margin-Right-MM, "
            "X-Request-ID, Content-Disposition"
        )
        return response
    except PermissionError as exc:
        return _error(str(exc), 403, "PDF_UTILITY_STORAGE_FORBIDDEN")
    except ValueError as exc:
        return _error(str(exc), 400, "PDF_UTILITY_VALIDATION_FAILED")
    except Exception:
        return _internal_error("PDF utility background cleanup with margin content removal")
    finally:
        if path:
            _delete_storage_paths([path])
        shutil.rmtree(temp_dir, ignore_errors=True)
