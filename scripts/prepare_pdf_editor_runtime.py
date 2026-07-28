#!/usr/bin/env python3
"""Rewrite the deployed PDF editor to use same-origin runtime assets."""
from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EDITOR_HTML = ROOT / "pdf-editor" / "index.html"
VENDOR_FILES = (
    ROOT / "vendor" / "pdf.min.js",
    ROOT / "vendor" / "pdf.worker.min.js",
    ROOT / "vendor" / "jspdf.umd.min.js",
)

REPLACEMENTS = {
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js": "/vendor/pdf.min.js",
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js": "/vendor/pdf.worker.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js": "/vendor/jspdf.umd.min.js",
}


def prepare() -> bool:
    missing = [str(path.relative_to(ROOT)) for path in VENDOR_FILES if not path.is_file() or path.stat().st_size == 0]
    if missing:
        raise SystemExit("PDF 런타임 파일이 없습니다: " + ", ".join(missing))

    text = EDITOR_HTML.read_text(encoding="utf-8")
    original = text

    for remote, local in REPLACEMENTS.items():
        if remote in text:
            text = text.replace(remote, local)
        elif local not in text:
            raise SystemExit(f"PDF 편집기 런타임 경로를 찾지 못했습니다: {remote}")

    for remote in REPLACEMENTS:
        if remote in text:
            raise SystemExit(f"외부 PDF 런타임 경로가 남아 있습니다: {remote}")

    if text != original:
        EDITOR_HTML.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = prepare()
    state = "rewritten" if changed else "already local"
    print(f"PDF editor runtime prepared: {state}")


if __name__ == "__main__":
    main()
