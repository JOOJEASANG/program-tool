#!/usr/bin/env python3
"""Make authenticated saved-PDF restores readable from the production website.

Firebase Storage download URLs are cross-origin. Browser binary GETs need
bucket CORS configured; Firebase deploy does not deploy bucket CORS settings.
Existing unrelated CORS entries are preserved.
"""
from __future__ import annotations

from typing import Any

BUCKET = "program-tool.firebasestorage.app"
ALLOWED_ORIGINS = (
    "https://program-tool.web.app",
    "https://program-tool.firebaseapp.com",
)


def extend_cors(existing: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    result = list(existing)
    for origin in ALLOWED_ORIGINS:
        if any(
            ("*" in (row.get("origin") or []) or origin in (row.get("origin") or []))
            and "GET" in (row.get("method") or [])
            for row in result
        ):
            continue
        result.append({"origin": [origin], "method": ["GET"], "maxAgeSeconds": 3600})
    return result, result != existing


def main() -> None:
    from google.cloud import storage

    client = storage.Client(project="program-tool")
    bucket = client.bucket(BUCKET)
    bucket.reload()
    existing = bucket.cors or []
    updated, changed = extend_cors(existing)
    if changed:
        bucket.cors = updated
        bucket.patch()
        print("Storage CORS configured for production saved-PDF downloads.")
    else:
        print("Storage CORS already permits production saved-PDF downloads.")


if __name__ == "__main__":
    main()
