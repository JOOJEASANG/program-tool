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
IMAGE_LAYOUT_MARKER = "data-image-editor-pdf-layout"
PDF_BOOKLET_MARKER = "data-pdf-classic-booklet"
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
    "index.html": ("Program Studio", "PDF·인쇄, 디자인, 문서, 이미지 작업을 위한 Program Studio 웹 도구 플랫폼", "index,follow"),
    "login.html": ("로그인 | Program Studio", "Program Studio 로그인 및 회원가입", "noindex,nofollow"),
    "admin.html": ("관리자 | Program Studio", "Program Studio 회원 및 프로그램 운영 관리", "noindex,nofollow"),
    "approval-waiting.html": ("승인 대기 | Program Studio", "Program Studio 계정 승인 상태 확인", "noindex,nofollow"),
    "guide.html": ("이용안내 | Program Studio", "Program Studio 주요 프로그램과 이용 방법 안내", "index,follow"),
    "terms.html": ("이용약관 | Program Studio", "Program Studio 서비스 이용약관", "index,follow"),
    "privacy.html": ("개인정보처리방침 | Program Studio", "Program Studio 개인정보처리방침", "index,follow"),
    "design-editor/index.html": ("디자인 편집기 | Program Studio", "Program Studio 통합 디자인 편집기", "noindex,nofollow"),
    "design-editor/general.html": ("디자인 작업실 | Program Studio", "Program Studio 디자인 제작 작업실", "noindex,nofollow"),
    "document-editor/index.html": ("문서 편집기 | Program Studio", "Program Studio 문서 작성 및 인쇄 편집기", "noindex,nofollow"),
    "image-editor/index.html": ("이미지 편집기 | Program Studio", "Program Studio 이미지 보정·크기·배경 편집기", "noindex,nofollow"),
    "pdf-editor/index.html": ("PDF 편집기 | Program Studio", "Program Studio PDF 병합·페이지·배치·출력 편집기", "noindex,nofollow"),
    "pdf-preflight/index.html": ("PDF 검사 · 유틸리티 | Program Studio", "Program Studio PDF 인쇄 전 검사·보안·유틸리티 도구", "noindex,nofollow"),
    "perfect-binding-cover/index.html": ("표지 편집기 | Program Studio", "Program Studio 무선제본 표지 편집기 호환 진입점", "noindex,nofollow"),
    "tools/pdf-editor.html": ("PDF 편집기로 이동 | Program Studio", "Program Studio PDF 편집기 호환 주소", "noindex,nofollow"),
    "tools/perfect-binding-cover.html": ("표지 편집기로 이동 | Program Studio", "Program Studio 표지 편집기 호환 주소", "noindex,nofollow"),
}
FIREBASE_APPROVAL_BOOTSTRAP = (
    f'<script {ACCESS_MARKER} src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js"></script>'
    '<script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"></script>'
    '<script src="/js/firebase-config.js"></script>'
)
FAVICON_TAG = f'<link {FAVICON_MARKER} rel="icon" href="/favicon.svg" type="image/svg+xml">'
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


def is_image_editor(path: Path) -> bool:
    return relative_path(path) == "image-editor/index.html"


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
    needs_boot = MARKER not in text and (
        approval_required or "sw-register.js" in text or "firebase-config.js" in text
    )
    needs_favicon = requires_favicon(path) and FAVICON_MARKER not in text
    needs_metadata = page_metadata(path) is not None
    needs_image_layout = is_image_editor(path) and IMAGE_LAYOUT_MARKER not in text
    needs_pdf_booklet = is_pdf_booklet_page(path) and PDF_BOOKLET_MARKER not in text
    return needs_boot or needs_favicon or needs_metadata or needs_image_layout or needs_pdf_booklet


def inject_guard(
    text: str,
    version: str,
    *,
    approval_required: bool = False,
    favicon: bool = False,
    metadata: tuple[str, str, str] | None = None,
    image_editor: bool = False,
    pdf_booklet: bool = False,
) -> str:
    text = normalize_metadata(text, metadata)
    tags = ""
    if favicon and FAVICON_MARKER not in text:
        tags += FAVICON_TAG
    if MARKER not in text:
        tags += f'<script {MARKER} src="/js/app-boot-guard.js?v={version}"></script>'
    if image_editor and IMAGE_LAYOUT_MARKER not in text:
        tags += (
            f'<link {IMAGE_LAYOUT_MARKER} rel="stylesheet" '
            f'href="/css/image-editor-pdf-layout.css?v={version}">'
        )
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
            metadata=page_metadata(path),
            image_editor=is_image_editor(path),
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
