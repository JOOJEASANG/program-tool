#!/usr/bin/env python3
"""Build an explicit allowlisted Firebase Hosting directory."""
from __future__ import annotations

import shutil
from pathlib import Path

from inject_boot_guard import DEPLOY_HTML

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / ".firebase-hosting"
PDF_SUITE_HTML = "pdf-suite/index.html"
PDF_SUITE_FIRST_PAINT_MARKER = "data-pdf-suite-first-paint-guard"
PDF_SUITE_DAILY_FREE_MARKER = "data-pdf-suite-daily-free"
PDF_SUITE_HOME_MARKER = "data-pdf-suite-home-launcher"
PDF_SUITE_ADVANCED_MARKER = "data-pdf-suite-advanced-tools"
PDF_SUITE_OCR_MARKER = "data-pdf-suite-ocr-tools"
PDF_SUITE_UNIFIED_NAV_MARKER = "data-pdf-suite-unified-navigation-prep"
PDF_SUITE_UNIFIED_MARKER = "data-pdf-suite-unified-workspace"
PDF_SUITE_UNIFIED_QUOTA_MARKER = "data-pdf-suite-unified-quota"
PDF_SUITE_SINGLE_PAGE_MARKER = "data-pdf-suite-single-page-workspace"
PDF_SUITE_DIRECT_BRIDGE_MARKER = "data-pdf-suite-direct-tool-bridge"
PDF_SUITE_DIRECT_HOOK_MARKER = "data-pdf-suite-direct-tool-hook"
PDF_SUITE_PROTECTED_GUARD_MARKER = "data-pdf-suite-protected-tool-guard"
PDF_SUITE_WORKSPACE_STABILITY_MARKER = "data-pdf-suite-workspace-stability"
PDF_SUITE_CURATED_CORE_MARKER = "data-pdf-suite-curated-core"
PDF_ADVANCED_EMPTY_STATE_MARKER = "data-pdf-advanced-empty-state-center"
PDF_SPECIALIST_LABEL_MARKER = "data-pdf-specialist-label"
ADMIN_PDF_USAGE_MARKER = "data-admin-pdf-usage-settings"

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
    "smart-print-layout",
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

PDF_SUITE_FIRST_PAINT_SNIPPET = (
    f'<script {PDF_SUITE_FIRST_PAINT_MARKER}>'
    "(()=>{const root=document.documentElement;root.classList.add('pdf-suite-booting');"
    "let done=false;const reveal=()=>{if(done)return;done=true;root.classList.remove('pdf-suite-booting');"
    "root.dataset.pdfUtilityFirstPaint='ready';observer?.disconnect?.();};"
    "const observer=new MutationObserver(()=>{if(root.dataset.pdfUtilityLayout==='split')reveal();});"
    "observer.observe(root,{attributes:true,attributeFilter:['data-pdf-utility-layout']});"
    "if(root.dataset.pdfUtilityLayout==='split')reveal();setTimeout(reveal,8000);})();"
    "</script>"
    "<style>"
    "html.pdf-suite-booting body{overflow:hidden!important;pointer-events:none!important}"
    "html.pdf-suite-booting body>*{visibility:hidden!important}"
    "html.pdf-suite-booting body::before{content:'';position:fixed;inset:0;z-index:2147483646;"
    "background:#eef3f7;visibility:visible!important}"
    "html.pdf-suite-booting body::after{content:'';position:fixed;left:50%;top:50%;z-index:2147483647;"
    "width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid #dbe5ee;"
    "border-top-color:#1769e0;animation:pdfSuiteBootSpin .72s linear infinite;visibility:visible!important}"
    "@keyframes pdfSuiteBootSpin{to{transform:rotate(360deg)}}"
    "@media(prefers-reduced-motion:reduce){html.pdf-suite-booting body::after{animation-duration:1.4s}}"
    "</style>"
)
PDF_SUITE_DAILY_FREE_SNIPPET = (
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>'
    '<script src="/js/firebase-config.js"></script>'
    f'<script {PDF_SUITE_DAILY_FREE_MARKER} src="/js/pdf-daily-free.js?v=20260907-2"></script>'
)
PDF_SUITE_HOME_SNIPPET = (
    f'<script {PDF_SUITE_HOME_MARKER} defer src="/js/pdf-suite-home-launcher.js?v=20260910-3"></script>'
)
PDF_SUITE_ADVANCED_SNIPPET = (
    f'<script {PDF_SUITE_ADVANCED_MARKER} defer '
    'src="/js/pdf-suite/advanced-tools.js?v=20260905-1"></script>'
)
PDF_SUITE_OCR_SNIPPET = (
    f'<script {PDF_SUITE_OCR_MARKER} defer '
    'src="/js/pdf-suite/ocr-tools.js?v=20260905-1"></script>'
)
PDF_SUITE_UNIFIED_NAV_SNIPPET = (
    f'<script {PDF_SUITE_UNIFIED_NAV_MARKER} defer '
    'src="/js/pdf-suite/unified-navigation-prep.js?v=20260906-2"></script>'
)
PDF_SUITE_UNIFIED_SNIPPET = (
    f'<script {PDF_SUITE_UNIFIED_MARKER} defer '
    'src="/js/pdf-suite/unified-workspace.js?v=20260906-1"></script>'
)
PDF_SUITE_UNIFIED_QUOTA_SNIPPET = (
    f'<script {PDF_SUITE_UNIFIED_QUOTA_MARKER} defer '
    'src="/js/pdf-suite/unified-quota.js?v=20260906-1"></script>'
)
PDF_SUITE_SINGLE_PAGE_SNIPPET = (
    f'<script {PDF_SUITE_SINGLE_PAGE_MARKER} defer '
    'src="/js/pdf-suite/single-page-shell.js?v=20260911-4"></script>'
)
PDF_SUITE_DIRECT_BRIDGE_SNIPPET = (
    f'<script {PDF_SUITE_DIRECT_BRIDGE_MARKER} defer '
    'src="/js/pdf-suite/direct-tool-bridge.js?v=20260906-1"></script>'
)
PDF_SUITE_DIRECT_HOOK_SNIPPET = (
    f'<script {PDF_SUITE_DIRECT_HOOK_MARKER} defer '
    'src="/js/pdf-suite/direct-tool-hook.js?v=20260906-1"></script>'
)
PDF_SUITE_PROTECTED_GUARD_SNIPPET = (
    f'<script {PDF_SUITE_PROTECTED_GUARD_MARKER} defer '
    'src="/js/pdf-suite/protected-tool-guard.js?v=20260906-1"></script>'
)
PDF_SUITE_WORKSPACE_STABILITY_SNIPPET = (
    f'<script {PDF_SUITE_WORKSPACE_STABILITY_MARKER} defer '
    'src="/js/pdf-suite/workspace-stability.js?v=20260911-2"></script>'
)
PDF_SUITE_CURATED_CORE_SNIPPET = (
    f'<script {PDF_SUITE_CURATED_CORE_MARKER} defer '
    'src="/js/pdf-suite/curated-core.js?v=20260907-1"></script>'
)
PDF_ADVANCED_EMPTY_STATE_SNIPPET = (
    f'<style {PDF_ADVANCED_EMPTY_STATE_MARKER}>'
    'body[data-pdf-advanced-standalone="1"] #previewScroll{position:relative;align-items:center!important;justify-content:center!important}'
    'body[data-pdf-advanced-standalone="1"] #previewScroll>#emptyState{position:absolute!important;inset:0!important;margin:0!important;'
    'min-width:100%!important;min-height:100%!important;display:grid!important;place-content:center!important;place-items:center!important;'
    'align-content:center!important;justify-content:center!important;text-align:center!important;padding:24px;pointer-events:none}'
    'body[data-pdf-advanced-standalone="1"] #previewScroll>#emptyState strong,'
    'body[data-pdf-advanced-standalone="1"] #previewScroll>#emptyState span{display:block!important;width:100%!important;text-align:center!important}'
    'body[data-pdf-advanced-standalone="1"] #previewScroll>#emptyState[hidden]{display:none!important}'
    '</style>'
)
PDF_SPECIALIST_LABEL_SNIPPET = (
    f'<script {PDF_SPECIALIST_LABEL_MARKER} defer '
    'src="/js/pdf-suite/specialist-label.js?v=20260906-5"></script>'
)
ADMIN_PDF_USAGE_SNIPPET = (
    f'<script {ADMIN_PDF_USAGE_MARKER} defer '
    'src="/js/admin-pdf-usage-settings.js?v=20260907-1"></script>'
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
    preflight = OUTPUT / "pdf-preflight/index.html"
    editor = OUTPUT / "pdf-editor/index.html"
    advanced_editor = OUTPUT / "pdf-editor-advanced/index.html"
    admin = OUTPUT / "admin.html"
    _inject_before(home, PDF_SUITE_HOME_MARKER, "</body>", PDF_SUITE_HOME_SNIPPET)
    _inject_before(suite, PDF_SUITE_FIRST_PAINT_MARKER, "</head>", PDF_SUITE_FIRST_PAINT_SNIPPET)
    _inject_before(suite, PDF_SUITE_DAILY_FREE_MARKER, "</head>", PDF_SUITE_DAILY_FREE_SNIPPET)
    _inject_before(suite, PDF_SUITE_ADVANCED_MARKER, "</body>", PDF_SUITE_ADVANCED_SNIPPET)
    _inject_before(suite, PDF_SUITE_OCR_MARKER, "</body>", PDF_SUITE_OCR_SNIPPET)
    _inject_before(suite, PDF_SUITE_UNIFIED_NAV_MARKER, "</body>", PDF_SUITE_UNIFIED_NAV_SNIPPET)
    _inject_before(suite, PDF_SUITE_UNIFIED_MARKER, "</body>", PDF_SUITE_UNIFIED_SNIPPET)
    _inject_before(suite, PDF_SUITE_UNIFIED_QUOTA_MARKER, "</body>", PDF_SUITE_UNIFIED_QUOTA_SNIPPET)
    _inject_before(suite, PDF_SUITE_SINGLE_PAGE_MARKER, "</body>", PDF_SUITE_SINGLE_PAGE_SNIPPET)
    _inject_before(suite, PDF_SUITE_DIRECT_BRIDGE_MARKER, "</body>", PDF_SUITE_DIRECT_BRIDGE_SNIPPET)
    _inject_before(suite, PDF_SUITE_DIRECT_HOOK_MARKER, "</body>", PDF_SUITE_DIRECT_HOOK_SNIPPET)
    _inject_before(suite, PDF_SUITE_PROTECTED_GUARD_MARKER, "</body>", PDF_SUITE_PROTECTED_GUARD_SNIPPET)
    _inject_before(suite, PDF_SUITE_WORKSPACE_STABILITY_MARKER, "</body>", PDF_SUITE_WORKSPACE_STABILITY_SNIPPET)
    _inject_before(suite, PDF_SUITE_CURATED_CORE_MARKER, "</body>", PDF_SUITE_CURATED_CORE_SNIPPET)
    _inject_before(advanced_editor, PDF_ADVANCED_EMPTY_STATE_MARKER, "</head>", PDF_ADVANCED_EMPTY_STATE_SNIPPET)
    _inject_before(preflight, PDF_SPECIALIST_LABEL_MARKER, "</body>", PDF_SPECIALIST_LABEL_SNIPPET)
    _inject_before(editor, PDF_SPECIALIST_LABEL_MARKER, "</body>", PDF_SPECIALIST_LABEL_SNIPPET)
    _inject_before(admin, ADMIN_PDF_USAGE_MARKER, "</body>", ADMIN_PDF_USAGE_SNIPPET)


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
    if not (OUTPUT / "smart-print-layout/index.html").is_file():
        raise RuntimeError("Hosting stage is missing smart print layout")

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
