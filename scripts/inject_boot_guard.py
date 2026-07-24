from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.json"
MARKER = "data-program-studio-boot-guard"
EXCLUDED_PARTS = {".git", "node_modules", "venv", ".venv", "__pycache__"}


def current_version() -> str:
    data = json.loads(VERSION_FILE.read_text(encoding="utf-8"))
    return str(data.get("version") or "unknown")


def should_inject(path: Path, text: str) -> bool:
    if MARKER in text:
        return False
    if any(part in EXCLUDED_PARTS for part in path.parts):
        return False
    return "sw-register.js" in text or "firebase-config.js" in text


def inject_guard(text: str, version: str) -> str:
    tag = (
        f'<script {MARKER} src="/js/app-boot-guard.js?'
        f'v={version}"></script>'
    )
    match = re.search(r"<head\b[^>]*>", text, flags=re.IGNORECASE)
    if not match:
        return text
    return text[: match.end()] + tag + text[match.end() :]


def inject_all() -> list[Path]:
    version = current_version()
    changed: list[Path] = []
    for path in sorted(ROOT.rglob("*.html")):
        text = path.read_text(encoding="utf-8")
        if not should_inject(path, text):
            continue
        updated = inject_guard(text, version)
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
