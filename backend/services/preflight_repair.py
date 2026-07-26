"""Rebuild damaged PDFs while preserving each source page size."""
from __future__ import annotations

import io
import json
import traceback

import fitz
from flask import Response


def _json_error(detail: str, status: int, *, error: str | None = None) -> Response:
    payload = {"detail": detail}
    if error:
        payload["error"] = error
    return Response(
        json.dumps(payload, ensure_ascii=False),
        status=status,
        mimetype="application/json",
    )


def _safe_pdf_name(filename: str | None, suffix: str) -> str:
    base = (filename or "document.pdf").rsplit(".", 1)[0]
    base = base.strip() or "document"
    return f"{base}_{suffix}.pdf"


def _remove_failed_output_pages(document: fitz.Document, page_count_before: int) -> None:
    while len(document) > page_count_before:
        document.delete_page(page_count_before)


def fix_pdf_response(filename: str, data: bytes) -> Response:
    """Return a normalized PDF without forcing all pages to the first page size."""
    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        return _json_error(
            "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 'PDF로 다시 저장/인쇄' 후 재시도하세요.",
            400,
            error=f"{type(exc).__name__}: {exc}",
        )

    output = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []

    try:
        if len(source) == 0:
            return _json_error("페이지가 없습니다", 400)
        if source.is_encrypted:
            return _json_error(
                "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 복구/정상화를 진행하세요.",
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
                    raise ValueError("페이지 크기가 비정상입니다")

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

                rebuilt_page = output.new_page(width=page_width, height=page_height)
                pixmap = page.get_pixmap(dpi=180, alpha=False, annots=True)
                try:
                    rebuilt_page.insert_image(
                        rebuilt_page.rect,
                        pixmap=pixmap,
                        keep_proportion=True,
                    )
                finally:
                    pixmap = None
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
        return Response(
            buffer.getvalue(),
            status=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={_safe_pdf_name(filename, 'repaired')}",
                "X-Fix-Note": note,
                "Access-Control-Expose-Headers": "X-Fix-Note, Content-Disposition",
            },
        )
    except Exception as exc:
        traceback.print_exc()
        return _json_error(
            f"PDF 보정 실패: {type(exc).__name__}: {exc}",
            500,
        )
    finally:
        try:
            source.close()
        except Exception:
            pass
        output.close()
