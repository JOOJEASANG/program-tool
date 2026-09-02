"""Shared Firebase Storage helpers for PDF router modules."""
from __future__ import annotations

import os
import re
import uuid

import firebase_admin.storage as fa_storage
from flask import g, has_request_context, request

DEFAULT_STORAGE_BUCKET = os.environ.get(
    "FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"
)

_REQUEST_ID_PATTERN = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


def get_bucket():
    return fa_storage.bucket(DEFAULT_STORAGE_BUCKET)


def get_request_id() -> str:
    """Return a stable request ID for the current Flask request, or a fresh UUID."""
    if not has_request_context():
        return uuid.uuid4().hex[:16]
    cached = getattr(g, "_shared_request_id", None)
    if isinstance(cached, str) and cached:
        return cached
    supplied = (request.headers.get("X-Request-ID") or "").strip()
    request_id = supplied if _REQUEST_ID_PATTERN.fullmatch(supplied) else uuid.uuid4().hex[:16]
    g._shared_request_id = request_id
    return request_id
