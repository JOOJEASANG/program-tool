"""Preserve each source page size while rebuilding damaged PDFs."""
from __future__ import annotations

import io
import traceback

import fitz
from flask import Response, jsonify

from routers import preflight as preflight_router


def _fix_pdf_response_preserve_sizes(filename: str, data: bytes):
    try:
        source = preflight_router._open_pdf(data)
    except Exception as exc:
        return jsonify({
            "detail": "PDF 파일을 열 수 없어 자동 복구가 제한됩니다. 원본 프로그램에서 'PDF로 다시 저장/인쇄' 후 재시도하세요.",
            "error": f"{type(exc).__name__}: {exc}",
        }), 400

    output = fitz.open()
    copied_pages = 0
    rasterized_pages = 0
    skipped_pages: list[int] = []
    try:
        if len(source) == 0:
            return jsonify({"detail": "페이지가 없습니다"}), 400
        if source.is_encrypted:
            return jsonify({
                "detail": "암호화된 PDF는 먼저 암호 해제를 실행한 뒤 복구/정상화를 진행하세요."
            }), 400

        for index in range(len(source)):
            try:
                page = source[index]
                source_rect = page.rect
                if source_rect.width <= 0 or source_rect.height <= 0:
                    raise ValueError("페이지 크기가 비정상입니다")

                try:
                    output.insert_pdf(
                        source,
                        from_page=index,
                        to_page=index,
                        links=True,
                        annots=True,
                        widgets=True,
                        final=0,
                    )
                    copied_pages += 1
                except Exception:
                    pixmap = page.get_pixmap(dpi=180, alpha=False, annots=True)
                    rebuilt = output.new_page(
                        width=source_rect.width,
                        height=source_rect.height,
                    )
                    rebuilt.insert_image(rebuilt.rect, pixmap=pixmap)
                    rasterized_pages += 1
            except Exception:
                skipped_pages.append(index + 1)

        if len(output) == 0:
            return jsonify({"detail": "복구 가능한 페이지가 없습니다."}), 400

        buffer = io.BytesIO()
        output.save(
            buffer,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True,
        )
        fixed_name = preflight_router._safe_pdf_name(filename, "repaired")
        note = (
            "rebuilt-clean-preserve-size;"
            f"copied={copied_pages};"
            f"rasterized={rasterized_pages};"
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
        return jsonify({
            "detail": f"PDF 보정 실패: {type(exc).__name__}: {exc}"
        }), 500
    finally:
        try:
            source.close()
        except Exception:
            pass
        output.close()


if not getattr(preflight_router, "_preserve_size_repair_patch_v1", False):
    preflight_router._fix_pdf_response = _fix_pdf_response_preserve_sizes
    preflight_router._preserve_size_repair_patch_v1 = True
