#!/usr/bin/env python3
"""Run guarded concurrent PDF processing tests through Storage staging.

This tool is intentionally inert unless --confirm RUN_PRODUCTION_LOAD is given.
It expects:
- FIREBASE_ID_TOKEN: an approved user's Firebase ID token for API authorization
- Google ADC/WIF credentials with write/delete access to the configured bucket

Run with backend/venv/bin/python so google-cloud-storage is available.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import statistics
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

MIB = 1024 * 1024
MAX_FILE_BYTES = 200 * MIB
MAX_TOTAL_BYTES = 300 * MIB
MAX_JOBS = 10
CONFIRMATION = "RUN_PRODUCTION_LOAD"


def decode_uid(id_token: str) -> str:
    """Extract uid only to construct the user's Storage path.

    The API still performs the authoritative Firebase token verification.
    """
    parts = id_token.split(".")
    if len(parts) < 2:
        raise ValueError("FIREBASE_ID_TOKEN is not a JWT")
    raw = parts[1] + "=" * (-len(parts[1]) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(raw.encode("ascii")))
    except Exception as exc:
        raise ValueError("FIREBASE_ID_TOKEN payload cannot be decoded") from exc
    uid = str(payload.get("user_id") or payload.get("sub") or "").strip()
    if not uid or "/" in uid or ".." in uid:
        raise ValueError("FIREBASE_ID_TOKEN does not contain a usable uid")
    return uid


def validate_inputs(files: list[Path], jobs: int) -> list[dict[str, Any]]:
    if not files:
        raise ValueError("at least one PDF is required")
    if jobs < 1 or jobs > MAX_JOBS:
        raise ValueError(f"jobs must be between 1 and {MAX_JOBS}")

    details: list[dict[str, Any]] = []
    total = 0
    for path in files:
        if not path.exists() or not path.is_file():
            raise ValueError(f"file not found: {path}")
        if path.suffix.lower() != ".pdf":
            raise ValueError(f"not a PDF filename: {path.name}")
        size = path.stat().st_size
        if size <= 0:
            raise ValueError(f"empty PDF: {path.name}")
        if size > MAX_FILE_BYTES:
            raise ValueError(f"{path.name} exceeds 200MB")
        total += size
        details.append({"name": path.name, "bytes": size})
    if total > MAX_TOTAL_BYTES:
        raise ValueError("per-job PDF total exceeds 300MB")
    return details


def build_settings(file_count: int, endpoint: str) -> dict[str, Any]:
    pages = [{"file_index": index, "page_index": 0} for index in range(file_count)]
    if endpoint == "advanced":
        return {"pages": pages}
    return {"pages": pages, "nup_default": 1}


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, round((len(ordered) - 1) * fraction)))
    return ordered[index]


def _safe_json_body(raw: bytes) -> dict[str, Any]:
    try:
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _api_call(
    *,
    job: int,
    base_url: str,
    endpoint: str,
    token: str,
    storage_paths: list[str],
    file_count: int,
    timeout: int,
    start_event: threading.Event,
) -> dict[str, Any]:
    start_event.wait()
    route = (
        "/api/pdf/advanced/process-storage"
        if endpoint == "advanced"
        else "/api/pdf/process-storage"
    )
    body = json.dumps(
        {
            "storage_paths": storage_paths,
            "settings": build_settings(file_count, endpoint),
        }
    ).encode("utf-8")
    request = Request(
        base_url.rstrip("/") + route,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-Request-ID": f"loadtest-{uuid.uuid4().hex[:16]}",
        },
    )
    started = time.perf_counter()
    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
            payload = _safe_json_body(raw)
            elapsed = time.perf_counter() - started
            return {
                "job": job,
                "ok": 200 <= response.status < 300,
                "http_status": response.status,
                "seconds": round(elapsed, 3),
                "request_id": response.headers.get("X-Request-ID", ""),
                "error_code": "",
                "detail": "",
                "result_storage_path": str(payload.get("storage_path") or ""),
            }
    except HTTPError as exc:
        raw = exc.read()
        payload = _safe_json_body(raw)
        elapsed = time.perf_counter() - started
        return {
            "job": job,
            "ok": False,
            "http_status": exc.code,
            "seconds": round(elapsed, 3),
            "request_id": exc.headers.get("X-Request-ID", "") if exc.headers else "",
            "error_code": str(payload.get("code") or ""),
            "detail": str(payload.get("detail") or f"HTTP {exc.code}")[:500],
            "result_storage_path": "",
        }
    except (URLError, TimeoutError, OSError) as exc:
        elapsed = time.perf_counter() - started
        return {
            "job": job,
            "ok": False,
            "http_status": 0,
            "seconds": round(elapsed, 3),
            "request_id": "",
            "error_code": "NETWORK_ERROR",
            "detail": str(exc)[:500],
            "result_storage_path": "",
        }


def _cleanup_blob(bucket, path: str) -> None:
    if not path:
        return
    try:
        bucket.blob(path).delete(timeout=60)
    except Exception:
        pass


def execute(args: argparse.Namespace, files: list[Path], input_info: list[dict[str, Any]]) -> dict[str, Any]:
    token = os.environ.get("FIREBASE_ID_TOKEN", "").strip()
    if not token:
        raise RuntimeError("FIREBASE_ID_TOKEN environment variable is required")
    uid = decode_uid(token)

    try:
        from google.cloud import storage
    except ImportError as exc:
        raise RuntimeError(
            "google-cloud-storage is required; run with backend/venv/bin/python"
        ) from exc

    client = storage.Client(project=args.project)
    bucket = client.bucket(args.bucket)
    run_id = time.strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:8]

    staged: list[list[str]] = [[] for _ in range(args.jobs)]
    stage_started = time.perf_counter()
    try:
        for job in range(args.jobs):
            for index, path in enumerate(files):
                object_path = f"pdf_temp/{uid}/loadtest-{run_id}/job-{job + 1}/{index}.pdf"
                blob = bucket.blob(object_path)
                blob.metadata = {
                    "source": "operations-load-test",
                    "run_id": run_id,
                    "job": str(job + 1),
                }
                blob.upload_from_filename(
                    str(path),
                    content_type="application/pdf",
                    timeout=args.upload_timeout,
                )
                staged[job].append(object_path)
        stage_seconds = round(time.perf_counter() - stage_started, 3)

        start_event = threading.Event()
        results: list[dict[str, Any]] = []
        with ThreadPoolExecutor(max_workers=args.jobs) as executor:
            futures = [
                executor.submit(
                    _api_call,
                    job=job + 1,
                    base_url=args.base_url,
                    endpoint=args.endpoint,
                    token=token,
                    storage_paths=staged[job],
                    file_count=len(files),
                    timeout=args.timeout,
                    start_event=start_event,
                )
                for job in range(args.jobs)
            ]
            concurrent_started = time.perf_counter()
            start_event.set()
            for future in as_completed(futures):
                results.append(future.result())
        wall_seconds = round(time.perf_counter() - concurrent_started, 3)
        results.sort(key=lambda item: item["job"])

        durations = [float(item["seconds"]) for item in results]
        successes = sum(bool(item["ok"]) for item in results)
        status_counts: dict[str, int] = {}
        for item in results:
            key = str(item["http_status"])
            status_counts[key] = status_counts.get(key, 0) + 1

        report = {
            "run_id": run_id,
            "base_url": args.base_url,
            "endpoint": args.endpoint,
            "bucket": args.bucket,
            "jobs": args.jobs,
            "files": input_info,
            "bytes_per_job": sum(int(item["bytes"]) for item in input_info),
            "total_staged_bytes": sum(int(item["bytes"]) for item in input_info) * args.jobs,
            "stage_seconds": stage_seconds,
            "concurrent_wall_seconds": wall_seconds,
            "summary": {
                "successes": successes,
                "failures": len(results) - successes,
                "min_seconds": round(min(durations), 3) if durations else None,
                "median_seconds": round(statistics.median(durations), 3) if durations else None,
                "p95_seconds": round(percentile(durations, 0.95), 3) if durations else None,
                "max_seconds": round(max(durations), 3) if durations else None,
                "http_status_counts": status_counts,
            },
            "results": [
                {
                    "job": item["job"],
                    "ok": item["ok"],
                    "http_status": item["http_status"],
                    "seconds": item["seconds"],
                    "request_id": item["request_id"],
                    "error_code": item["error_code"],
                    "detail": item["detail"],
                }
                for item in results
            ],
            "secrets_redacted": True,
        }

        for item in results:
            output_path = str(item.get("result_storage_path") or "")
            if output_path.startswith(f"pdf_results/{uid}/"):
                _cleanup_blob(bucket, output_path)

        return report
    finally:
        for job_paths in staged:
            for object_path in job_paths:
                _cleanup_blob(bucket, object_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Guarded Storage-backed PDF load test")
    parser.add_argument("files", nargs="+", help="Local PDF file(s) used by every concurrent job")
    parser.add_argument("--base-url", default="https://program-tool.web.app")
    parser.add_argument("--project", default="program-tool")
    parser.add_argument("--bucket", default="program-tool.firebasestorage.app")
    parser.add_argument("--endpoint", choices=("basic", "advanced"), default="basic")
    parser.add_argument("--jobs", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=660)
    parser.add_argument("--upload-timeout", type=int, default=600)
    parser.add_argument("--report", default="pdf-load-test-report.json")
    parser.add_argument(
        "--confirm",
        default="",
        help=f"Required for side effects; exact value: {CONFIRMATION}",
    )
    args = parser.parse_args()

    files = [Path(value).resolve() for value in args.files]
    input_info = validate_inputs(files, args.jobs)
    bytes_per_job = sum(int(item["bytes"]) for item in input_info)
    total_staged = bytes_per_job * args.jobs

    print(
        f"plan endpoint={args.endpoint} jobs={args.jobs} "
        f"bytes_per_job={bytes_per_job} total_staged_bytes={total_staged}"
    )
    for item in input_info:
        print(f"  {item['name']}: {item['bytes']} bytes")

    if args.confirm != CONFIRMATION:
        print(
            "DRY RUN ONLY: no Storage upload or API request was made. "
            f"Re-run with --confirm {CONFIRMATION} only during an approved load-test window."
        )
        return 0

    report = execute(args, files, input_info)
    report_path = Path(args.report).resolve()
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    summary = report["summary"]
    print(
        f"completed successes={summary['successes']} failures={summary['failures']} "
        f"median={summary['median_seconds']}s p95={summary['p95_seconds']}s "
        f"report={report_path}"
    )
    return 0 if summary["failures"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
