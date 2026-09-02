"""Pytest configuration for the stable eight-module PDF editor runtime."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOADER_FILE = ROOT / "js" / "pdf-editor" / "loader.js"


def version_tuple(value: str) -> tuple[int, int, int, int]:
    parts = tuple(int(part) for part in str(value).split("."))
    assert len(parts) == 4
    return parts


def is_stable_eight_module_runtime() -> bool:
    try:
        loader = LOADER_FILE.read_text(encoding="utf-8")
    except OSError:
        return False
    return (
        loader.count("'/js/pdf-editor/") == 8
        and re.search(r"__pdfEditorModuleLoaderV\d+", loader) is not None
    )
