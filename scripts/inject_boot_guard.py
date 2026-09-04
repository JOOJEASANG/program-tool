from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.json"
MARKER = "data-program-studio-boot-guard"
ACCESS_MARKER = "data-program-studio-approval-bootstrap"
FAVICON_MARKER = "data-program-studio-favicon"
META_MARKER = "data-program-studio-meta"
UI_STYLE_MARKER = "data-program-studio-ui"
PDF_BOOKLET_MARKER = "data-pdf-classic-booklet"
EXCLUDED_PARTS = {".git", "node_modules", "venv", ".venv", "__pycache__"}
PROTECTED_HTML = {
    "print-checker/index.html",
    "pdf-editor/index.html",
    "pdf-preflight/index.html",
    "perfect-binding-cover/index.html",
    "tools/pdf-editor.html",
    "tools/perfect-binding-cover.html",
}
PUBLIC_HTML = {
    "index.html",
    "login.html",
    "admin.html",
    "approval-waiting.html",
    "guide.html",
    "terms.html",
    "privacy.html",
}
DEPLOY_HTML = PUBLIC_HTML | PROTECTED_HTML
PDF_BOOKLET_HTML = {
    "pdf-editor/index.html",
    "tools/pdf-editor.html",
}
PAGE_METADATA = {
    "index.html": ("Program Studio", "PDF·인쇄 실무를 위한 인쇄물 사전 검토·PDF 편집·PDF 유틸리티 플랫폼", "index,follow"),
    "login.html": ("로그인 | Program Studio", "Program Studio 로그인 및 회원가입", "noindex,nofollow"),
    "admin.html": ("관리자 | Program Studio", "Program Studio 회원 및 프로그램 운영 관리", "noindex,nofollow"),
    "approval-waiting.html": ("승인 대기 | Program Studio", "Program Studio 계정 승인 상태 확인", "noindex,nofollow"),
    "guide.html": ("이용안내 | Program Studio", "Program Studio 주요 프로그램과 이용 방법 안내", "index,follow"),
    "terms.html": ("이용약관 | Program Studio", "Program Studio 서비스 이용약관", "index,follow"),
    "privacy.html": ("개인정보처리방침 | Program Studio", "Program Studio 개인정보처리방침", "index,follow"),
    "print-checker/index.html": ("인쇄물 사전 검토 | Program Studio", "Program Studio 인쇄물 사전 검토 도구 — 책등·재단선·안전영역·접지선 확인", "noindex,nofollow"),
    "pdf-editor/index.html": ("PDF 편집기 | Program Studio", "Program Studio PDF 병합·페이지·배치·출력 편집기", "noindex,nofollow"),
    "pdf-preflight/index.html": ("PDF 검사 · 유틸리티 | Program Studio", "Program Studio PDF 인쇄 전 검사·보안·유틸리티 도구", "noindex,nofollow"),
    "perfect-binding-cover/index.html": ("표지 검토 | Program Studio", "Program Studio 무선제본 표지 검토 호환 진입점", "noindex,nofollow"),
    "tools/pdf-editor.html": ("PDF 편집기로 이동 | Program Studio", "Program Studio PDF 편집기 호환 주소", "noindex,nofollow"),
    "tools/perfect-binding-cover.html": ("표지 검토로 이동 | Program Studio", "Program Studio 표지 검토 호환 주소", "noindex,nofollow"),
}
FIREBASE_APPROVAL_BOOTSTRAP = (
    f'<script {ACCESS_MARKER} src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>'
    '<script src="/js/firebase-config.js"></script>'
)
FAVICON_TAG = f'<link {FAVICON_MARKER} rel="icon" href="/favicon.svg" type="image/svg+xml">'
INLINE_BOOT_GUARD_MARKER = "data-program-studio-boot-guard-inline"
_INLINE_BOOT_CSS = (
    "html.app-booting body{pointer-events:none!important}"
    "html.app-booting::before{content:'';position:fixed;inset:0;z-index:2147483646;"
    "background:rgba(248,250,252,.96);visibility:visible!important}"
    "html.app-booting::after{content:'';position:fixed;left:50%;top:50%;"
    "z-index:2147483647;width:34px;height:34px;margin:-17px 0 0 -17px;"
    "border-radius:50%;border:3px solid #dbe5ee;border-top-color:#1769e0;"
    "animation:programStudioBootSpin .72s linear infinite;visibility:visible!important}"
    "@keyframes programStudioBootSpin{to{transform:rotate(360deg)}}"
    "@media(prefers-reduced-motion:reduce){html.app-booting::after{animation-duration:1.4s}}"
)
INLINE_BOOT_GUARD_SNIPPET = (
    f"<script {INLINE_BOOT_GUARD_MARKER}>"
    "document.documentElement.classList.add('app-booting')"
    "</script>"
    f"<style>{_INLINE_BOOT_CSS}</style>"
)
TITLE_RE = re.compile(r"<title\b[^>]*>.*?</title\s*>", flags=re.IGNORECASE | re.DOTALL)
DESCRIPTION_RE = re.compile(
    r"<meta\b(?=[^>]*\bname\s*=\s*[\"\']description[\"\'])[^>]*>", flags=re.IGNORECASE
)
ROBOTS_RE = re.compile(
    r"<meta\b(?=[^>]*\bname\s*=\s*[\"\']robots[\"\'])[^>]*>", flags=re.IGNORECASE
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


def requires_favicon(path: Path) -> bool:
    return relative_path(path) in DEPLOY_HTML


def page_metadata(path: Path) -> tuple[str, str, str] | None:
    return PAGE_METADATA.get(relative_path(path))


def is_pdf_booklet_page(path: Path) -> bool:
    return relative_path(path) in PDF_BOOKLET_HTML


def normalize_metadata(text: str, metadata: tuple[str, str, str] | None) -> str:
    if not metadata:
        return text
    title, description, robots = metadata
    text = TITLE_RE.sub("", text)
    text = DESCRIPTION_RE.sub("", text)
    text = ROBOTS_RE.sub("", text)
    tags = (
        f'<title {META_MARKER}="title">{title}</title>'
        f'<meta {META_MARKER}="description" name="description" content="{description}">'
        f'<meta {META_MARKER}="robots" name="robots" content="{robots}">'
    )
    match = re.search(r"<head\b[^>]*>", text, flags=re.IGNORECASE)
    if not match:
        return text
    return text[: match.end()] + tags + text[match.end() :]


def should_inject(path: Path, text: str) -> bool:
    if any(part in EXCLUDED_PARTS for part in path.parts):
        return False
    approval_required = requires_approval(path)
    needs_boot = (MARKER not in text or (approval_required and INLINE_BOOT_GUARD_MARKER not in text)) and (
        approval_required or "sw-register.js" in text or "firebase-config.js" in text
    )
    needs_favicon = requires_favicon(path) and FAVICON_MARKER not in text
    needs_ui_style = requires_favicon(path) and UI_STYLE_MARKER not in text
    needs_metadata = page_metadata(path) is not None and META_MARKER not in text
    needs_pdf_booklet = is_pdf_booklet_page(path) and PDF_BOOKLET_MARKER not in text
    return needs_boot or needs_favicon or needs_ui_style or needs_metadata or needs_pdf_booklet


def inject_guard(
    text: str,
    version: str,
    *,
    approval_required: bool = False,
    favicon: bool = False,
    ui_style: bool = True,
    metadata: tuple[str, str, str] | None = None,
    pdf_booklet: bool = False,
) -> str:
    text = normalize_metadata(text, metadata)
    tags = ""
    if favicon and FAVICON_MARKER not in text:
        tags += FAVICON_TAG
    if ui_style and UI_STYLE_MARKER not in text:
        tags += (
            f'<link {UI_STYLE_MARKER} rel="stylesheet" '
            f'href="/css/program-studio-ui-v2.css?v={version}">'
        )
    if MARKER not in text:
        if approval_required and INLINE_BOOT_GUARD_MARKER not in text:
            tags += INLINE_BOOT_GUARD_SNIPPET
        tags += f'<script {MARKER} src="/js/app-boot-guard.js?v={version}"></script>'
    if pdf_booklet and PDF_BOOKLET_MARKER not in text:
        tags += (
            f'<script {PDF_BOOKLET_MARKER} defer '
            f'src="/js/pdf-editor/booklet-sheet-preview.js?v={version}"></script>'
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
            favicon=requires_favicon(path),
            ui_style=requires_favicon(path),
            metadata=page_metadata(path),
            pdf_booklet=is_pdf_booklet_page(path),
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
