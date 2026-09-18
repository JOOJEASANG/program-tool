#!/usr/bin/env python3
"""Create a valid PDF fixture padded to a requested transfer size.

The trailing padding increases upload/download size without pretending to model
rendering complexity. Use real representative customer PDFs for CPU/memory
benchmarks after the transfer-size scenarios are stable.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import fitz

MIB = 1024 * 1024


def create_fixture(output: Path, size_mb: int, pages: int = 1) -> dict[str, int]:
    if size_mb < 1 or size_mb > 200:
        raise ValueError("size_mb must be between 1 and 200")
    if pages < 1 or pages > 2000:
        raise ValueError("pages must be between 1 and 2000")

    output.parent.mkdir(parents=True, exist_ok=True)
    document = fitz.open()
    try:
        for index in range(pages):
            page = document.new_page(width=595, height=842)
            page.insert_text(
                (54, 72),
                f"Program Studio load-test fixture page {index + 1}",
                fontsize=12,
            )
        document.save(str(output), garbage=4, deflate=True)
    finally:
        document.close()

    target = size_mb * MIB
    current = output.stat().st_size
    if current > target:
        raise ValueError(
            f"base PDF is already {current} bytes, larger than requested {target}"
        )

    remaining = target - current
    block = bytes(MIB)
    with output.open("ab") as stream:
        while remaining > 0:
            chunk = min(remaining, len(block))
            stream.write(block[:chunk])
            remaining -= chunk

    check = fitz.open(str(output))
    try:
        page_count = check.page_count
        if page_count != pages:
            raise RuntimeError(
                f"fixture validation failed: expected {pages} pages, got {page_count}"
            )
    finally:
        check.close()

    final_size = output.stat().st_size
    if final_size != target:
        raise RuntimeError(f"fixture size mismatch: expected {target}, got {final_size}")

    return {"bytes": final_size, "pages": pages}


def main() -> int:
    parser = argparse.ArgumentParser(description="Create padded PDF load-test fixture")
    parser.add_argument("--output", required=True)
    parser.add_argument("--size-mb", required=True, type=int)
    parser.add_argument("--pages", type=int, default=1)
    args = parser.parse_args()

    output = Path(args.output).resolve()
    result = create_fixture(output, args.size_mb, args.pages)
    print(
        f"created {output} bytes={result['bytes']} pages={result['pages']} "
        "(transfer-size fixture)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
