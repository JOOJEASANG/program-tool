from __future__ import annotations

import json
import logging

import fitz
from flask import Blueprint, Response, jsonify, request

from models.smart_layout_schemas import SmartLayoutRequest
from services.smart_print_layout import build_layout_plan, inspect_sources, render_layout_pdf
from services.smart_print_layout_auto import build_auto_fill_layout_plan
from utils.auth import require_auth
from utils.storage import get_bucket, get_request_id
from utils.storage_delivery import upload_pdf_result


pdf_smart_layout_bp = Blueprint('pdf_smart_layout', __name__)
logger = logging.getLogger(__name__)
MAX_DIRECT_FILE_BYTES = 20 * 1024 * 1024
MAX_DIRECT_TOTAL_BYTES = 20 * 1024 * 1024
MAX_DIRECT_RESPONSE_BYTES = 18 * 1024 * 1024
MAX_FILES = 30


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


@pdf_smart_layout_bp.route('/smart-layout', methods=['POST'])
@require_auth
def smart_layout(uid: str):
    try:
        settings = SmartLayoutRequest.model_validate(json.loads(request.form.get('settings', '{}')))
    except Exception:
        return _error('스마트 배치 설정이 올바르지 않습니다.', 422, 'SMART_LAYOUT_INVALID_SETTINGS')

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

    docs: list[fitz.Document] = []
    try:
        for index, data in enumerate(file_bytes):
            try:
                doc = fitz.open(stream=data, filetype='pdf')
            except Exception as exc:
                raise ValueError(f'유효한 PDF가 아닙니다: {filenames[index]}') from exc
            docs.append(doc)

        source_items, duplex = inspect_sources(docs, settings.jobs, filenames, settings.side_mode)
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
        output = render_layout_pdf(docs, plan, gap_mm=settings.gap_mm, crop_marks=settings.crop_marks)
    except ValueError as exc:
        return _error(str(exc), 400, 'SMART_LAYOUT_VALIDATION_FAILED')
    except Exception:
        logger.exception('Smart print layout failed request_id=%s', get_request_id())
        return _error('스마트 인쇄배치 처리 중 오류가 발생했습니다.', 500, 'SMART_LAYOUT_INTERNAL_ERROR')
    finally:
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
