from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.json"
MARKER = "data-program-studio-boot-guard"
ACCESS_MARKER = "data-program-studio-approval-bootstrap"
IMAGE_LAYOUT_MARKER = "data-image-editor-pdf-layout"
EXCLUDED_PARTS = {".git", "node_modules", "venv", ".venv", "__pycache__"}
PROTECTED_HTML = {
    "design-editor/index.html",
    "design-editor/general.html",
    "document-editor/index.html",
    "image-editor/index.html",
    "pdf-editor/index.html",
    "pdf-preflight/index.html",
    "perfect-binding-cover/index.html",
    "tools/pdf-editor.html",
    "tools/preflight.html",
    "tools/pdf-Checker.html",
    "tools/perfect-binding-cover.html",
}
FIREBASE_APPROVAL_BOOTSTRAP = (
    f'<script {ACCESS_MARKER} src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>'
    '<script src="/js/firebase-config.js"></script>'
)


def current_version() -> str:
    data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    return str(data.get("version") or "unknown")


def relative_path(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def requires_approval(path: Path) -> bool:
    return relative_path(path) in PROTECTED_HTML


def is_image_editor(path: Path) -> bool:
    return relative_path(path) == "image-editor/index.html"


def should_inject(path: Path, text: str) -> bool:
    if any(part in EXCLUDED_PARTS for part in path.parts):
        return False
    approval_required = requires_approval(path)
    needs_boot = MARKER not in text and (
        approval_required or "sw-register.js" in text or "firebase-config.js" in text
    )
    needs_image_layout = is_image_editor(path) and IMAGE_LAYOUT_MARKER not in text
    return needs_boot or needs_image_layout


def inject_guard(
    text: str,
    version: str,
    *,
    approval_required: bool = False,
    image_editor: bool = False,
) -> str:
    tags = ""
    if MARKER not in text:
        tags += (
            f'<script {MARKER} src="/js/app-boot-guard.js?'
            f'v={version}"></script>'
        )
    if image_editor and IMAGE_LAYOUT_MARKER not in text:
        tags += (
            f'<link {IMAGE_LAYOUT_MARKER} rel="stylesheet" '
            f'href="/css/image-editor-pdf-layout.css?v={version}">'
        )
    if approval_required and "firebase-config.js" not in text:
        tags += FIREBASE_APPROVAL_BOOTSTRAP
    if not tags:
        return text
    match = re.search(r"<head\b[^>]*>", text, flags=re.IGNORECASE)
    if not match:
        return text
    return text[: match.end()] + tags + text[match.end() :]


def inject_all() -> list[Path]:
    version = current_version()
    changed: list[Path] = []
    for path in sorted(ROOT.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        if not should_inject(path, text):
            continue
        updated = inject_guard(
            text,
            version,
            approval_required=requires_approval(path),
            image_editor=is_image_editor(path),
        )
        if updated == text:
            continue
        path.write_text(updated, encoding="utf-8")
        changed.append(path.relative_to(ROOT))
    return changed


def main() -> None:
    changed = inject_all()
    print(f"Boot guard injected into {len(changed)} HTML file(s).")
    for path in changed:
        print(f"- {path.as_posix()}")


if __name__ == "__main__":
    main()
