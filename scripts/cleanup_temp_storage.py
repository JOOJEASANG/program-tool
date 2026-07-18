"""List or delete stale Program Tool temporary PDF objects.

Dry-run is the default. Requires Firebase Admin credentials.
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone

import firebase_admin
from firebase_admin import storage

PREFIXES = ("pdf_temp/", "preflight_temp/")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", default=os.environ.get("FIREBASE_STORAGE_BUCKET", "program-tool.firebasestorage.app"))
    parser.add_argument("--older-hours", type=float, default=24.0)
    parser.add_argument("--execute", action="store_true", help="actually delete matching objects")
    args = parser.parse_args()

    if args.older_hours < 1:
        raise SystemExit("--older-hours must be at least 1")

    firebase_admin.initialize_app(options={"storageBucket": args.bucket})
    bucket = storage.bucket(args.bucket)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=args.older_hours)
    matched = 0
    deleted = 0
    total_bytes = 0

    for prefix in PREFIXES:
        for blob in bucket.list_blobs(prefix=prefix):
            created = blob.time_created
            if not created or created > cutoff:
                continue
            matched += 1
            total_bytes += int(blob.size or 0)
            print(f"{'DELETE' if args.execute else 'DRY-RUN'} {blob.name} {blob.size or 0} bytes {created.isoformat()}")
            if args.execute:
                blob.delete()
                deleted += 1

    print(f"matched={matched} deleted={deleted} bytes={total_bytes} cutoff={cutoff.isoformat()}")
    if not args.execute and matched:
        print("Run again with --execute after reviewing the list.")


if __name__ == "__main__":
    main()
