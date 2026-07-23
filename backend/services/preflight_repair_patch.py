"""Preserve each source page size while rebuilding a damaged PDF."""
from __future__ import annotations

import io
import traceback

import fitz
from flask import Response, jsonify

from routers import preflight as preflight_router


def _remove_failed_output_page(document: fitz.Document, page_count_before: int) -> None:
    while len(document) > page_count_before:
        document.delete_page(page_count_before)


def _fix_pdf_response_preserve_sizes(filename: str, data: bytes):
    try:
        src = preflight_router._open_pdf(data)
    except Exception as exc:
        return jsonify({
            "detail": "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 'PDF로 다시 저장/인쇄' 후 재시도하세요.",
            "error": f"{type(exc).__name__}: {exc}",
        }), 400

    out = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []

    try:
        if len(src) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if src.is_encrypted:
            return jsonify({"detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 복구/정상화를 진행하세요."}), 400

        for page_index in range(len(src)):
            page_count_before = len(out)
            try:
                page = src[page_index]
                source_rect = page.rect
                page_width = float(source_rect.width)
                page_height = float(source_rect.height)
                if page_width <= 0 or page_height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")

                new_page = out.new_page(width=page_width, height=page_height)
                try:
                    new_page.show_pdf_page(new_page.rect, src, page_index, keep_proportion=True)
                    copied_pages += 1
                    continue
                except Exception:
                    _remove_failed_output_page(out, page_count_before)

                new_page = out.new_page(width=page_width, height=page_height)
                pixmap = page.get_pixmap(dpi=180, alpha=False, annots=True)
                try:
                    new_page.insert_image(new_page.rect, pixmap=pixmap, keep_proportion=True)
                finally:
                    pixmap = None
                rasterized_pages += 1
            except Exception:
                _remove_failed_output_page(out, page_count_before)
                skipped_pages.append(page_index + 1)

        if len(out) == 0:
            return jsonify({"detail": "복구 가능한 페이지가 없습니다."}), 400

        buffer = io.BytesIO()
        out.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        fixed_name = preflight_router._safe_pdf_name(filename, "repaired")
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
                "Content-Disposition": f"attachment; filename={fixed_name}",
                "X-Fix-Note": note,
                "Access-Control-Expose-Headers": "X-Fix-Note, Content-Disposition",
            },
        )
    except Exception as exc:
        traceback.print_exc()
        return jsonify({"detail": f"PDF 보정 실패: {type(exc).__name__}: {exc}"}), 500
    finally:
        try:
            src.close()
        except Exception:
            pass
        out.close()


if not getattr(preflight_router, "_preserve_page_sizes_patch_v1", False):
    preflight_router._fix_pdf_response = _fix_pdf_response_preserve_sizes
    preflight_router._preserve_page_sizes_patch_v1 = True
