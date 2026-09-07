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
    """Return the request-wide trace ID, or a fresh UUID outside Flask requests.

    ``backend.main`` owns the primary API request ID in ``g.api_request_id``.
    PDF/storage helpers historically used ``g._shared_request_id`` instead,
    which could create two different IDs for one request when the client did
    not supply ``X-Request-ID``. Reuse either cache and synchronize both so
    logs, JSON error bodies and response headers always refer to one request.
    """
    if not has_request_context():
        return uuid.uuid4().hex[:16]

    for attr in ("api_request_id", "_shared_request_id"):
        cached = getattr(g, attr, None)
        if isinstance(cached, str) and _REQUEST_ID_PATTERN.fullmatch(cached):
            g.api_request_id = cached
            g._shared_request_id = cached
            return cached

    supplied = (request.headers.get("X-Request-ID") or "").strip()
    request_id = supplied if _REQUEST_ID_PATTERN.fullmatch(supplied) else uuid.uuid4().hex[:16]
    g.api_request_id = request_id
    g._shared_request_id = request_id
    return request_id
