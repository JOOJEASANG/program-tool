"""Private, short-lived Firebase Storage delivery for generated PDFs."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote


RESULT_TTL_HOURS = 6
MAX_RESULT_BYTES = 500 * 1024 * 1024


def _safe_filename(filename: str | None) -> str:
    value = Path(str(filename or "output.pdf")).name
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", value.rsplit(".", 1)[0])
    stem = stem.strip("._-")[:80] or "output"
    return f"{stem}.pdf"


def _result_size(*, data: bytes | None, source_path: str | Path | None) -> int:
    if data is not None:
        return len(data)
    if source_path is None:
        return 0
    return Path(source_path).stat().st_size


def upload_pdf_result(
    bucket,
    uid: str,
    *,
    filename: str,
    data: bytes | None = None,
    source_path: str | Path | None = None,
    metadata: dict[str, str] | None = None,
) -> dict:
    """Upload one generated PDF and return a tokenized download contract."""
    if (data is None) == (source_path is None):
        raise ValueError("data 또는 source_path 중 하나만 제공해야 합니다.")
    size_bytes = _result_size(data=data, source_path=source_path)
    if size_bytes <= 0:
        raise ValueError("완성 PDF 파일이 비어 있습니다.")
    if size_bytes > MAX_RESULT_BYTES:
        raise ValueError("완성 PDF는 최대 500MB까지 다운로드할 수 있습니다.")

    safe_uid = re.sub(r"[^A-Za-z0-9_-]+", "_", str(uid))[:128]
    if not safe_uid:
        raise ValueError("사용자 식별자가 없습니다.")

    result_id = uuid.uuid4().hex
    token = str(uuid.uuid4())
    safe_name = _safe_filename(filename)
    storage_path = f"pdf_results/{safe_uid}/{result_id}/{safe_name}"
    expires_at = datetime.now(timezone.utc) + timedelta(hours=RESULT_TTL_HOURS)

    blob = bucket.blob(storage_path)
    blob.metadata = {
        "firebaseStorageDownloadTokens": token,
        "temporary": "true",
        "expiresAt": expires_at.isoformat(),
        **(metadata or {}),
    }
    blob.content_disposition = f'attachment; filename="{safe_name}"'
    if data is not None:
        blob.upload_from_string(data, content_type="application/pdf")
    else:
        blob.upload_from_filename(str(source_path), content_type="application/pdf")

    encoded_path = quote(storage_path, safe="")
    download_url = (
        "https://firebasestorage.googleapis.com/v0/b/"
        f"{bucket.name}/o/{encoded_path}?alt=media&token={quote(token)}"
    )
    return {
        "delivery": "storage",
        "filename": safe_name,
        "storage_path": storage_path,
        "download_url": download_url,
        "expires_at": expires_at.isoformat(),
        "size_bytes": size_bytes,
    }
