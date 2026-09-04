#!/usr/bin/env python3
"""Build an explicit allowlisted Firebase Hosting directory."""
from __future__ import annotations

import shutil
from pathlib import Path

from inject_boot_guard import DEPLOY_HTML

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".firebase-hosting"
PDF_SUITE_HTML = "pdf-suite/index.html"
PDF_SUITE_AUTH_MARKER = "data-pdf-suite-auth-guard"
PDF_SUITE_HOME_MARKER = "data-pdf-suite-home-launcher"

ROOT_FILES = set(DEPLOY_HTML) | {
    PDF_SUITE_HTML,
    "dashboard.html",
    "favicon.svg",
    "sw.js",
    "version.json",
}
OPTIONAL_ROOT_FILES = {"robots.txt", "sitemap.xml"}
HOSTED_DIRS = (
    "apps",
    "css",
    "js",
    "print-checker",
    "pdf-editor",
    "pdf-preflight",
    "perfect-binding-cover",
    "tools",
    "legal",
    "assets",
    "images",
    "fonts",
)
STATIC_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".mjs",
    ".json",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".wasm",
    ".pdf",
}
FORBIDDEN_OUTPUT_NAMES = {
    "firebase.json",
    "firestore.rules",
    "storage.rules",
    "package.json",
    "package-lock.json",
    "README.md",
    "CLAUDE.md",
    "PROGRAM_STRUCTURE.md",
}

PDF_SUITE_AUTH_SNIPPET = (
    f'<script {PDF_SUITE_AUTH_MARKER}>document.documentElement.style.visibility="hidden";</script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>'
    '<script src="/js/firebase-config.js"></script>'
    '<script data-pdf-suite-auth-runner>'
    'window.ProgramAccessReady=window.ProgramAccess.guardTool({'
    'programId:"preflight",loginUrl:"/login.html",waitingUrl:"/approval-waiting.html",timeoutMs:8000'
    '});'
    '</script>'
)
PDF_SUITE_HOME_SNIPPET = (
    f'<script {PDF_SUITE_HOME_MARKER} defer src="/js/pdf-suite-home-launcher.js"></script>'
)


def _copy_file(source: Path, relative: Path) -> None:
    if source.is_symlink():
        raise RuntimeError(f"Hosting source symlink is not allowed: {relative.as_posix()}")
    destination = OUTPUT / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def _copy_directory(relative_dir: str) -> int:
    source_dir = ROOT / relative_dir
    if not source_dir.is_dir():
        return 0
    copied = 0
    for source in sorted(source_dir.rglob("*")):
        if not source.is_file() or source.is_symlink():
            continue
        relative = source.relative_to(ROOT)
        if any(part.startswith(".") for part in relative.parts):
            continue
        if source.suffix.lower() not in STATIC_SUFFIXES:
            continue
        _copy_file(source, relative)
        copied += 1
    return copied


def _inject_before(path: Path, marker: str, needle: str, snippet: str) -> None:
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    index = text.lower().rfind(needle.lower())
    if index < 0:
        raise RuntimeError(f"Could not inject {marker} into {path.relative_to(OUTPUT).as_posix()}")
    path.write_text(text[:index] + snippet + text[index:], encoding="utf-8")


def _patch_pdf_suite_entry_points() -> None:
    home = OUTPUT / "index.html"
    suite = OUTPUT / PDF_SUITE_HTML
    _inject_before(home, PDF_SUITE_HOME_MARKER, "</body>", PDF_SUITE_HOME_SNIPPET)
    _inject_before(suite, PDF_SUITE_AUTH_MARKER, "</head>", PDF_SUITE_AUTH_SNIPPET)


def build() -> int:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    missing = sorted(name for name in ROOT_FILES if not (ROOT / name).is_file())
    if missing:
        raise RuntimeError("Required Hosting files are missing: " + ", ".join(missing))

    copied = 0
    for name in sorted(ROOT_FILES | OPTIONAL_ROOT_FILES):
        source = ROOT / name
        if not source.is_file():
            continue
        _copy_file(source, Path(name))
        copied += 1

    for relative_dir in HOSTED_DIRS:
        copied += _copy_directory(relative_dir)

    _patch_pdf_suite_entry_points()

    missing_deploy = sorted(
        relative for relative in DEPLOY_HTML if not (OUTPUT / relative).is_file()
    )
    if missing_deploy:
        raise RuntimeError(
            "Hosting stage is missing deploy HTML: " + ", ".join(missing_deploy)
        )

    if not (OUTPUT / PDF_SUITE_HTML).is_file():
        raise RuntimeError("Hosting stage is missing PDF suite hub")

    leaked = sorted(
        path.relative_to(OUTPUT).as_posix()
        for path in OUTPUT.rglob("*")
        if path.is_file() and path.name in FORBIDDEN_OUTPUT_NAMES
    )
    if leaked:
        raise RuntimeError("Forbidden files leaked into Hosting stage: " + ", ".join(leaked))

    if copied < len(ROOT_FILES):
        raise RuntimeError("Hosting stage copied fewer files than the required root contract")

    print(f"Hosting stage ready: {copied} allowlisted file(s) -> {OUTPUT.name}/")
    return copied


def main() -> None:
    build()


if __name__ == "__main__":
    main()
