"""Short-retention Firebase Storage delivery for generated PDFs."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote


RESULT_TTL_HOURS = 1
SIGNED_URL_TTL_MINUTES = 15
MAX_RESULT_BYTES = 800 * 1024 * 1024


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


def _v4_signed_download_url(blob, safe_name: str) -> str | None:
    """Return a short-lived V4 URL when the runtime credential can sign it.

    Some Cloud Functions credentials do not expose a local signing key. In that
    environment ``generate_signed_url`` raises and delivery must fall back to the
    existing Firebase download-token contract until IAM signing is configured.
    """
    generator = getattr(blob, "generate_signed_url", None)
    if not callable(generator):
        return None
    try:
        value = generator(
            version="v4",
            expiration=timedelta(minutes=SIGNED_URL_TTL_MINUTES),
            method="GET",
            response_disposition=f'attachment; filename="{safe_name}"',
        )
    except Exception:
        return None
    value = str(value or "").strip()
    if not value.startswith("https://"):
        return None
    return value


def upload_pdf_result(
    bucket,
    uid: str,
    *,
    filename: str,
    data: bytes | None = None,
    source_path: str | Path | None = None,
    metadata: dict[str, str] | None = None,
) -> dict:
    """Upload one generated PDF and return a short-retention download contract.

    A cryptographically expiring V4 signed URL is preferred when the runtime
    service account can sign URLs. If signing is not configured, the established
    Firebase download-token URL remains as a compatibility fallback. Either way,
    the object is removed by the client after a successful download and by the
    scheduled cleanup after ``RESULT_TTL_HOURS``.
    """
    if (data is None) == (source_path is None):
        raise ValueError("data 또는 source_path 중 하나만 제공해야 합니다.")
    size_bytes = _result_size(data=data, source_path=source_path)
    if size_bytes <= 0:
        raise ValueError("완성 PDF 파일이 비어 있습니다.")
    if size_bytes > MAX_RESULT_BYTES:
        raise ValueError("완성 PDF는 최대 800MB까지 다운로드할 수 있습니다.")

    safe_uid = re.sub(r"[^A-Za-z0-9_-]+", "_", str(uid))[:128]
    if not safe_uid:
        raise ValueError("사용자 식별자가 없습니다.")

    result_id = uuid.uuid4().hex
    token = str(uuid.uuid4())
    safe_name = _safe_filename(filename)
    storage_path = f"pdf_results/{safe_uid}/{result_id}/{safe_name}"
    now = datetime.now(timezone.utc)
    cleanup_at = now + timedelta(hours=RESULT_TTL_HOURS)

    blob = bucket.blob(storage_path)
    blob.metadata = {
        "firebaseStorageDownloadTokens": token,
        "temporary": "true",
        "cleanupAfter": cleanup_at.isoformat(),
        **(metadata or {}),
    }
    blob.content_disposition = f'attachment; filename="{safe_name}"'
    if data is not None:
        blob.upload_from_string(data, content_type="application/pdf")
    else:
        blob.upload_from_filename(str(source_path), content_type="application/pdf")

    signed_url = _v4_signed_download_url(blob, safe_name)
    if signed_url:
        signed_expires_at = now + timedelta(minutes=SIGNED_URL_TTL_MINUTES)
        return {
            "delivery": "storage",
            "filename": safe_name,
            "storage_path": storage_path,
            "download_url": signed_url,
            "expires_at": signed_expires_at.isoformat(),
            "cleanup_at": cleanup_at.isoformat(),
            "expiration_mode": "signed-url-v4",
            "size_bytes": size_bytes,
        }

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
        "expires_at": cleanup_at.isoformat(),
        "cleanup_at": cleanup_at.isoformat(),
        "expiration_mode": "scheduled-delete",
        "size_bytes": size_bytes,
    }
