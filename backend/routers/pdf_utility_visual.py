"""Bounded server fallback for visual PDF page ordering and rotation."""
from __future__ import annotations

import io
import shutil
import tempfile
from pathlib import Path

import fitz
from flask import request

from utils.auth import require_auth


_installed = False


def _normalize_visual_plan(order, rotations, page_count: int, max_pages: int = 1000):
    if not isinstance(order, list) or not order:
        raise ValueError("페이지 순서 정보가 없습니다.")
    if page_count < 1:
        raise ValueError("페이지가 없는 PDF입니다.")
    if len(order) > max_pages:
        raise ValueError(f"한 번에 정리할 수 있는 페이지는 최대 {max_pages}페이지입니다.")

    pages: list[int] = []
    seen: set[int] = set()
    for raw in order:
        if isinstance(raw, bool):
            raise ValueError("페이지 번호가 올바르지 않습니다.")
        try:
            page_number = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValueError("페이지 번호가 올바르지 않습니다.") from exc
        if str(raw).strip() != str(page_number) and not isinstance(raw, int):
            raise ValueError("페이지 번호가 올바르지 않습니다.")
        if page_number < 1 or page_number > page_count:
            raise ValueError(f"페이지 번호가 전체 {page_count}페이지 범위를 벗어났습니다: {page_number}")
        if page_number in seen:
            raise ValueError("같은 원본 페이지를 두 번 배치할 수 없습니다.")
        seen.add(page_number)
        pages.append(page_number)

    if rotations is None:
        rotations = {}
    if not isinstance(rotations, dict):
        raise ValueError("페이지 회전 정보가 올바르지 않습니다.")

    normalized: dict[int, int] = {}
    for raw_page, raw_angle in rotations.items():
        try:
            page_number = int(raw_page)
            angle = int(raw_angle)
        except (TypeError, ValueError) as exc:
            raise ValueError("페이지 회전 정보가 올바르지 않습니다.") from exc
        if page_number not in seen:
            raise ValueError("회전할 페이지가 현재 페이지 순서에 없습니다.")
        if angle % 90 != 0:
            raise ValueError("페이지 회전은 90도 단위만 사용할 수 있습니다.")
        angle %= 360
        if angle:
            normalized[page_number] = angle
    return pages, normalized


def _organize_document(source: fitz.Document, output: fitz.Document, order, rotations, max_pages: int = 1000) -> int:
    pages, rotation_map = _normalize_visual_plan(order, rotations, source.page_count, max_pages)
    for page_number in pages:
        output.insert_pdf(source, from_page=page_number - 1, to_page=page_number - 1)
        delta = rotation_map.get(page_number, 0)
        if delta:
            target = output[output.page_count - 1]
            target.set_rotation((int(target.rotation or 0) + delta) % 360)
    if output.page_count < 1:
        raise ValueError("정리한 PDF에 페이지가 없습니다.")
    return len(pages)


def _organize_pdf_bytes(data: bytes, order, rotations, max_pages: int = 1000) -> tuple[bytes, int]:
    try:
        source = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    if source.is_encrypted:
        source.close()
        raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
    output = fitz.open()
    try:
        count = _organize_document(source, output, order, rotations, max_pages)
        buffer = io.BytesIO()
        output.save(buffer, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        return buffer.getvalue(), count
    finally:
        output.close()
        source.close()


def _organize_pdf_path(source_path: Path, output_path: Path, order, rotations, max_pages: int = 1000) -> int:
    try:
        source = fitz.open(str(source_path))
    except Exception as exc:
        raise ValueError("유효한 PDF 파일이 아닙니다.") from exc
    if source.is_encrypted:
        source.close()
        raise ValueError("암호화된 PDF는 먼저 암호를 해제하세요.")
    output = fitz.open()
    try:
        count = _organize_document(source, output, order, rotations, max_pages)
        output.save(str(output_path), garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
        return count
    finally:
        output.close()
        source.close()


def install(pdf_utility_module) -> None:
    """Attach the route to the canonical PDF utility blueprint before registration."""
    global _installed
    if _installed:
        return

    bp = pdf_utility_module.pdf_utility_bp

    @require_auth
    def organize_storage(uid):
        payload = request.get_json(silent=True) or {}
        raw_path = payload.get("storage_path")
        order = payload.get("page_order")
        rotations = payload.get("page_rotations") or {}
        filename = str(payload.get("filename") or "document.pdf")
        path = ""
        temp_dir = Path(tempfile.mkdtemp(prefix="pdf-utility-visual-organize-"))
        try:
            path = pdf_utility_module._validate_storage_path(uid, raw_path)
            source_path = temp_dir / "source.pdf"
            pdf_utility_module._download_storage_pdf_to_path(uid, path, source_path)
            output_path = temp_dir / "organized.pdf"
            page_count = _organize_pdf_path(
                source_path,
                output_path,
                order,
                rotations,
                int(pdf_utility_module.MAX_TOTAL_PAGES),
            )
            safe_stem = pdf_utility_module._safe_name(Path(filename).stem)
            response = pdf_utility_module._deliver_pdf_path(
                uid,
                output_path,
                f"{safe_stem}_visual_organized.pdf",
                "pdf-utility-visual-organize",
            )
            response.headers["X-PDF-Page-Count"] = str(page_count)
            response.headers["Access-Control-Expose-Headers"] = (
                "X-PDF-Page-Count, X-Request-ID, Content-Disposition"
            )
            return response
        except PermissionError as exc:
            return pdf_utility_module._error(str(exc), 403, "PDF_UTILITY_STORAGE_FORBIDDEN")
        except ValueError as exc:
            return pdf_utility_module._error(str(exc), 400, "PDF_UTILITY_VALIDATION_FAILED")
        except Exception:
            return pdf_utility_module._internal_error("PDF utility visual page organize")
        finally:
            if path:
                pdf_utility_module._delete_storage_paths([path])
            shutil.rmtree(temp_dir, ignore_errors=True)

    bp.add_url_rule(
        "/organize-storage",
        endpoint="visual_organize_storage",
        view_func=organize_storage,
        methods=["POST"],
    )
    _installed = True
