from __future__ import annotations

import json
import logging
import re
from firebase_admin import firestore as fa_firestore

import fitz
from flask import Blueprint, Response, jsonify, request

from models.smart_layout_schemas import SmartLayoutRequest
from services.smart_print_layout import build_layout_plan, inspect_sources, render_layout_pdf
from services.smart_print_layout_auto import build_auto_fill_layout_plan
from services.smart_print_numbering import apply_layout_numbering, expand_layout_for_numbering
from services.smart_print_trim import apply_trim_crop_marks, parse_trim_size
from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result


pdf_smart_layout_bp = Blueprint('pdf_smart_layout', __name__)
logger = logging.getLogger(__name__)
MAX_DIRECT_FILE_BYTES = 20 * 1024 * 1024
MAX_DIRECT_TOTAL_BYTES = 20 * 1024 * 1024
MAX_DIRECT_RESPONSE_BYTES = 18 * 1024 * 1024
MAX_FILES = 30
MM_TO_PT = 72.0 / 25.4


def _error(detail: str, status: int, code: str):
    response = jsonify({'detail': detail, 'code': code, 'request_id': get_request_id()})
    response.status_code = status
    return response


def _summary(plan) -> dict:
    return {
        'sheets': len(plan.sheets),
        'total_copies': plan.total_copies,
        'duplex': plan.duplex,
        'print_sides': len(plan.sheets) * (2 if plan.duplex else 1),
        'utilization': round(plan.utilization, 1),
    }


def _add_summary_headers(response, plan):
    summary = _summary(plan)
    response.headers['X-Smart-Layout-Sheets'] = str(summary['sheets'])
    response.headers['X-Smart-Layout-Copies'] = str(summary['total_copies'])
    response.headers['X-Smart-Layout-Duplex'] = '1' if summary['duplex'] else '0'
    response.headers['X-Smart-Layout-Utilization'] = str(summary['utilization'])
    response.headers['X-Request-ID'] = get_request_id()
    return response


def _page_size_mm(page: fitz.Page) -> tuple[float, float]:
    return page.rect.width / MM_TO_PT, page.rect.height / MM_TO_PT


def _prepare_separate_back_files(
    docs: list[fitz.Document],
    jobs,
    filenames: list[str],
) -> tuple[list[fitz.Document], list[fitz.Document]]:
    """Turn a front one-page PDF + a selected back one-page PDF into one logical 2-page source.

    The layout/render engine already has mature duplex mirroring for ordinary two-page PDFs.
    Building an in-memory two-page source here lets the separate-image workflow reuse the exact
    same placement and flip-edge behavior without changing uploaded source files.
    """
    render_docs = list(docs)
    combined_docs: list[fitz.Document] = []

    for job in jobs:
        back_index = job.back_file_index
        if back_index is None:
            continue
        if job.file_index >= len(docs) or back_index >= len(docs):
            raise ValueError('앞면·뒷면 파일 연결 정보가 올바르지 않습니다')

        front_doc = docs[job.file_index]
        back_doc = docs[back_index]
        if front_doc.page_count != 1:
            raise ValueError(f'{filenames[job.file_index]}은 이미 2페이지 양면 파일이므로 별도 뒷면을 연결할 수 없습니다')
        if back_doc.page_count != 1:
            raise ValueError(f'{filenames[back_index]}은 별도 뒷면으로 사용할 때 1페이지 파일이어야 합니다')

        front_w, front_h = _page_size_mm(front_doc[0])
        back_w, back_h = _page_size_mm(back_doc[0])
        if abs(front_w - back_w) > 0.8 or abs(front_h - back_h) > 0.8:
            raise ValueError(
                f'{filenames[back_index]}의 크기가 앞면과 다릅니다. '
                f'앞면 {front_w:.1f}×{front_h:.1f}mm / 뒷면 {back_w:.1f}×{back_h:.1f}mm'
            )

        combined = fitz.open()
        combined.insert_pdf(front_doc, from_page=0, to_page=0)
        combined.insert_pdf(back_doc, from_page=0, to_page=0)
        render_docs[job.file_index] = combined
        combined_docs.append(combined)

    return render_docs, combined_docs


@pdf_smart_layout_bp.route('/smart-layout', methods=['POST'])
@require_auth
def smart_layout(uid: str):
    try:
        raw_settings = json.loads(request.form.get('settings', '{}'))
        settings = SmartLayoutRequest.model_validate(raw_settings)
    except Exception:
        return _error('스마트 배치 설정이 올바르지 않습니다.', 422, 'SMART_LAYOUT_INVALID_SETTINGS')

    try:
        trim_width_mm, trim_height_mm = parse_trim_size(raw_settings, required=settings.crop_marks)
    except ValueError as exc:
        return _error(str(exc), 422, 'SMART_LAYOUT_INVALID_TRIM')

    uploads = request.files.getlist('files')
    if not uploads:
        return _error('PDF 파일을 추가해 주세요.', 400, 'SMART_LAYOUT_FILES_REQUIRED')
    if len(uploads) > MAX_FILES:
        return _error(f'파일은 최대 {MAX_FILES}개까지 처리할 수 있습니다.', 400, 'SMART_LAYOUT_TOO_MANY_FILES')

    file_bytes: list[bytes] = []
    filenames: list[str] = []
    total_bytes = 0
    for index, upload in enumerate(uploads):
        filename = upload.filename or f'파일 {index + 1}.pdf'
        if not filename.lower().endswith('.pdf'):
            return _error(f'PDF 파일만 사용할 수 있습니다: {filename}', 400, 'SMART_LAYOUT_INVALID_FILE_TYPE')
        data = upload.read(MAX_DIRECT_FILE_BYTES + 1)
        if len(data) > MAX_DIRECT_FILE_BYTES:
            return _error(f'파일은 개별 20MB 이하만 직접 처리할 수 있습니다: {filename}', 413, 'SMART_LAYOUT_FILE_TOO_LARGE')
        total_bytes += len(data)
        if total_bytes > MAX_DIRECT_TOTAL_BYTES:
            return _error('직접 업로드 전체 용량은 20MB 이하로 사용해 주세요.', 413, 'SMART_LAYOUT_TOTAL_TOO_LARGE')
        file_bytes.append(data)
        filenames.append(filename)

    return _render_smart_result(uid, raw_settings, settings, trim_width_mm, trim_height_mm, file_bytes, filenames)

def _render_smart_result(uid, raw_settings, settings, trim_width_mm, trim_height_mm, file_bytes, filenames):
    """Shared render/delivery contract for multipart and reused immutable sources."""
    docs: list[fitz.Document] = []
    combined_docs: list[fitz.Document] = []
    try:
        for index, data in enumerate(file_bytes):
            try:
                doc = fitz.open(stream=data, filetype='pdf')
            except Exception as exc:
                raise ValueError(f'유효한 PDF가 아닙니다: {filenames[index]}') from exc
            docs.append(doc)

        render_docs, combined_docs = _prepare_separate_back_files(docs, settings.jobs, filenames)
        source_items, duplex = inspect_sources(render_docs, settings.jobs, filenames, settings.side_mode)
        if settings.auto_fill:
            plan = build_auto_fill_layout_plan(
                source_items,
                settings.paper.width_mm,
                settings.paper.height_mm,
                settings.margin_mm,
                settings.gap_mm,
                settings.allow_rotate,
                duplex,
                settings.flip_edge,
            )
        else:
            plan = build_layout_plan(
                source_items,
                settings.paper.width_mm,
                settings.paper.height_mm,
                settings.margin_mm,
                settings.gap_mm,
                settings.allow_rotate,
                duplex,
                settings.flip_edge,
            )
        numbering = raw_settings.get('numbering')
        plan = expand_layout_for_numbering(plan, numbering)

        # The legacy renderer draws marks on the uploaded page edge. Render the
        # layout without those marks, then draw them at the required finished
        # trim size entered in STEP 3.
        output = render_layout_pdf(render_docs, plan, gap_mm=settings.gap_mm, crop_marks=False)
        output = apply_trim_crop_marks(
            output,
            plan,
            enabled=settings.crop_marks,
            gap_mm=settings.gap_mm,
            trim_width_mm=trim_width_mm,
            trim_height_mm=trim_height_mm,
        )
        output = apply_layout_numbering(output, plan, numbering)
    except ValueError as exc:
        return _error(str(exc), 400, 'SMART_LAYOUT_VALIDATION_FAILED')
    except Exception:
        logger.exception('Smart print layout failed request_id=%s', get_request_id())
        return _error('스마트 인쇄배치 처리 중 오류가 발생했습니다.', 500, 'SMART_LAYOUT_INTERNAL_ERROR')
    finally:
        for doc in combined_docs:
            try:
                doc.close()
            except Exception:
                pass
        for doc in docs:
            try:
                doc.close()
            except Exception:
                pass

    if len(output) > MAX_DIRECT_RESPONSE_BYTES:
        try:
            delivery = upload_pdf_result(
                get_bucket(),
                uid,
                filename='smart-print-layout.pdf',
                data=output,
                metadata={'source': 'smart-print-layout'},
            )
            payload = {**delivery, 'summary': _summary(plan)}
            response = jsonify(payload)
            response.headers['Cache-Control'] = 'no-store'
            return _add_summary_headers(response, plan)
        except Exception:
            logger.exception('Smart layout result upload failed request_id=%s', get_request_id())
            return _error('완성 PDF를 전달할 수 없습니다.', 500, 'SMART_LAYOUT_DELIVERY_FAILED')

    response = Response(
        output,
        status=200,
        mimetype='application/pdf',
        headers={'Content-Disposition': 'attachment; filename="smart-print-layout.pdf"'},
    )
    return _add_summary_headers(response, plan)

@pdf_smart_layout_bp.route('/smart-layout-storage', methods=['POST'])
@require_auth
def smart_layout_storage(uid: str):
    """Reuse previously stored inputs, including immutable originals in saved sessions."""
    try:
        body = request.get_json(force=True) or {}
        raw_settings = body.get('settings') or {}
        settings = SmartLayoutRequest.model_validate(raw_settings)
        trim_width_mm, trim_height_mm = parse_trim_size(raw_settings, required=settings.crop_marks)
        paths = body.get('storage_paths')
        source_session_doc = body.get('source_session_doc')
        retain_temp_sources = body.get('retain_temp_sources') is True
    except Exception:
        return _error('스마트 배치 설정이 올바르지 않습니다.', 422, 'SMART_LAYOUT_INVALID_SETTINGS')

    if not isinstance(paths, list) or not paths or len(paths) > MAX_FILES or len(set(map(str, paths))) != len(paths):
        return _error('PDF 파일 경로가 올바르지 않습니다.', 400, 'SMART_LAYOUT_INVALID_PATHS')
    temporary = [p for p in paths if isinstance(p, str) and p.startswith(f'pdf_temp/{uid}/')]
    saved = [p for p in paths if p not in temporary]
    if any(not re.fullmatch(rf'pdf_temp/{re.escape(uid)}/[A-Za-z0-9_-]{{8,40}}/[0-9]{{1,2}}\.pdf', p) for p in temporary):
        return _error('임시 PDF 경로가 올바르지 않습니다.', 403, 'SMART_LAYOUT_FORBIDDEN')
    if saved:
        if not isinstance(source_session_doc, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', source_session_doc):
            return _error('저장본의 사용 권한이 없습니다.', 403, 'SMART_LAYOUT_FORBIDDEN')
        try:
            doc = (fa_firestore.client().collection('users').document(uid)
                   .collection('pdf_smart_layout_sessions').document(source_session_doc).get())
            recorded = (doc.to_dict() or {}).get('storagePaths') if doc.exists else None
        except Exception:
            logger.exception('Smart layout session authorization failed')
            return _error('저장본을 확인할 수 없습니다.', 503, 'SMART_LAYOUT_LOOKUP_FAILED')
        if not isinstance(recorded, list) or any(
            not isinstance(p, str)
            or not re.fullmatch(rf'pdf_sessions/{re.escape(uid)}/[A-Za-z0-9_-]{{8,40}}/src_[0-9]{{1,2}}\.pdf', p)
            or p not in recorded for p in saved
        ):
            return _error('저장본에 없는 PDF입니다.', 403, 'SMART_LAYOUT_FORBIDDEN')

    try:
        bucket = get_bucket()
        file_bytes = []
        total = 0
        for path in paths:
            blob = bucket.blob(path)
            try:
                blob.reload()
            except Exception:
                return _error('저장된 원본 PDF를 찾을 수 없습니다. 다시 불러와 주세요.', 404, 'SMART_LAYOUT_FILE_NOT_FOUND')
            size = int(blob.size or 0)
            if size <= 0 or size > MAX_DIRECT_FILE_BYTES:
                return _error('PDF 한 파일은 20MB 이하만 처리할 수 있습니다.', 413, 'SMART_LAYOUT_FILE_TOO_LARGE')
            total += size
            if total > MAX_DIRECT_TOTAL_BYTES:
                return _error('PDF 전체 크기는 20MB 이하로 처리해 주세요.', 413, 'SMART_LAYOUT_TOTAL_TOO_LARGE')
            file_bytes.append(blob.download_as_bytes())
        filenames = [f'source_{index}.pdf' for index in range(len(paths))]
        return _render_smart_result(uid, raw_settings, settings, trim_width_mm, trim_height_mm, file_bytes, filenames)
    except Exception:
        logger.exception('Smart layout stored source failed')
        return _error('스마트 배치 원본을 처리할 수 없습니다.', 500, 'SMART_LAYOUT_STORAGE_ERROR')
    finally:
        # The saved originals belong to their document; cached temporary inputs
        # are reused only when the browser has explicitly opted into retention.
        if not retain_temp_sources:
            for path in temporary:
                try:
                    get_bucket().blob(path).delete()
                except Exception:
                    logger.warning('Smart layout temp cleanup failed', exc_info=True)
