"""Rebuild damaged PDFs while preserving each source page size."""
from __future__ import annotations

import io
import json
import logging
import re

import fitz
from flask import Response

logger = logging.getLogger(__name__)


def _json_error(detail: str, status: int) -> Response:
    return Response(
        json.dumps({"detail": detail}, ensure_ascii=False),
        status=status,
        mimetype="application/json",
    )


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0]
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._-")[:80]
    return f"{base or 'document'}_{suffix}.pdf"


def _remove_failed_output_pages(
    document: fitz.Document, page_count_before: int
) -> None:
    while len(document) > page_count_before:
        document.delete_page(page_count_before)


def fix_pdf_response(filename: str, data: bytes) -> Response:
    """Return a normalized PDF without forcing all pages to the first page size."""
    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception:
        logger.warning("PDF repair could not open source", exc_info=True)
        return _json_error(
            "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 'PDF로 다시 저장/인쇄' 후 재시도하세요.",
            400,
        )

    output = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []

    try:
        if len(source) == 0:
            return _json_error("페이지가 없습니다.", 400)
        if source.is_encrypted:
            return _json_error(
                "암호화된 PDF는 먼저 암호를 해제한 뒤 복구/정상화를 진행하세요.",
                400,
            )

        for page_index in range(len(source)):
            page_count_before = len(output)
            try:
                page = source[page_index]
                source_rect = page.rect
                page_width = float(source_rect.width)
                page_height = float(source_rect.height)
                if page_width <= 0 or page_height <= 0:
                    raise ValueError("invalid page size")

                try:
                    output.insert_pdf(
                        source,
                        from_page=page_index,
                        to_page=page_index,
                        links=True,
                        annots=True,
                        widgets=True,
                        final=0,
                    )
                    copied_pages += 1
                    continue
                except Exception:
                    _remove_failed_output_pages(output, page_count_before)

                rebuilt_page = output.new_page(
                    width=page_width,
                    height=page_height,
                )
                pixmap = page.get_pixmap(
                    dpi=180,
                    alpha=False,
                    annots=True,
                )
                rebuilt_page.insert_image(
                    rebuilt_page.rect,
                    pixmap=pixmap,
                    keep_proportion=True,
                )
                rasterized_pages += 1
            except Exception:
                _remove_failed_output_pages(output, page_count_before)
                skipped_pages.append(page_index + 1)

        if len(output) == 0:
            return _json_error("복구 가능한 페이지가 없습니다.", 400)

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        note = (
            "rebuilt-clean;page-sizes=preserved;"
            f"copied={copied_pages};rasterized={rasterized_pages};"
            f"skipped={','.join(map(str, skipped_pages))}"
        )
        safe_name = _safe_pdf_name(filename, "repaired")
        return Response(
            buffer.getvalue(),
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}"',
                "X-Fix-Note": note,
                "Access-Control-Expose-Headers": (
                    "X-Fix-Note, Content-Disposition"
                ),
            },
        )
    except Exception:
        logger.exception("PDF repair failed")
        return _json_error(
            "PDF 보정 중 오류가 발생했습니다. 원본 프로그램에서 다시 저장한 뒤 재시도하세요.",
            500,
        )
    finally:
        source.close()
        output.close()
