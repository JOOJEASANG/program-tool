from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS = {
    "index.html": [
        ("PDF문서 편집기", "PDF 편집"),
        ("PDF 문서 도구", "PDF 검사"),
        ("무선제본 표지 제작기", "표지 제작"),
        ("무선제본 표지 편집기 테스트", "표지 제작 테스트"),
    ],
    "admin.html": [
        ("PDF문서 편집기", "PDF 편집"),
        ("PDF 문서 도구", "PDF 검사"),
        ("무선제본 표지 제작기", "표지 제작"),
    ],
    "tools/pdf-editor.html": [
        ("PDF 문서 편집기", "PDF 편집"),
        ("PDF문서 편집기", "PDF 편집"),
    ],
    "tools/pdf-Checker.html": [
        ("PDF 문서 도구", "PDF 검사"),
    ],
    "tools/preflight.html": [
        ("PDF 문서 도구", "PDF 검사"),
    ],
    "tools/perfect-binding-cover.html": [
        ("무선제본 표지 제작기", "표지 제작"),
    ],
}

SCRIPT_TAGS = '<script src="../js/common-context-menu.js"></script><script src="../js/editor-enhancements.js"></script>'


def replace_all(path: Path, replacements):
    text = path.read_text(encoding="utf-8")
    original = text
    for old, new in replacements:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")


def inject_scripts(path: Path):
    text = path.read_text(encoding="utf-8")
    if "common-context-menu.js" in text:
        return
    text = text.replace("</body>", SCRIPT_TAGS + "</body>")
    path.write_text(text, encoding="utf-8")


def patch_pdf_editor(path: Path):
    text = path.read_text(encoding="utf-8")
    original = text

    # Divider background should behave as no fill by default.
    text = re.sub(
        r'(<input[^>]+id="[^"]*(?:divider|insert)[^"]*(?:bg|background|color)[^"]*"[^>]+value=")#[0-9a-fA-F]{6}("[^>]*>)',
        r'\1#ffffff\2',
        text,
        flags=re.I,
    )

    # New files should follow the global N-up setting unless explicitly overridden.
    text = text.replace(
        "fileNupMap[fileIndex] = nup;",
        "delete fileNupMap[fileIndex];",
    )
    text = text.replace(
        "fileNupMap[file_index] = nup;",
        "delete fileNupMap[file_index];",
    )

    # When the global layout changes, clear stale implicit overrides and rebuild.
    marker = "function getLayout(n) {"
    if "function refreshGlobalNupInheritance" not in text and marker in text:
        helper = "function refreshGlobalNupInheritance(){Object.keys(fileNupMap).forEach(k=>{if(fileNupMap[k]===null||fileNupMap[k]===undefined)delete fileNupMap[k]});try{renderPreview?.()}catch(_){}}\n"
        text = text.replace(marker, helper + marker)

    # Add alignment and decoration controls near divider style selector when available.
    if "dividerTitleAlign" not in text:
        insertion = '<div class="grid2"><div class="field"><label>제목 정렬</label><select id="dividerTitleAlign"><option value="left">왼쪽</option><option value="center" selected>가운데</option><option value="right">오른쪽</option></select></div><div class="field"><label>세로 정렬</label><select id="dividerVAlign"><option value="top">위</option><option value="center" selected>가운데</option><option value="bottom">아래</option></select></div></div><div class="grid3"><label class="checkline"><input id="dividerBold" type="checkbox" checked>굵게</label><label class="checkline"><input id="dividerUnderline" type="checkbox">밑줄</label><label class="checkline"><input id="dividerRule" type="checkbox">구분선</label></div>'
        candidates = ["<div class=\"field\"><label>간지 스타일</label>", "<div class=\"field\"><label>스타일</label>"]
        for candidate in candidates:
            if candidate in text:
                text = text.replace(candidate, insertion + candidate, 1)
                break

    if text != original:
        path.write_text(text, encoding="utf-8")


def patch_cover(path: Path):
    text = path.read_text(encoding="utf-8")
    original = text
    text = text.replace(
        "이미지 선택 중에는 마우스 휠로도 확대·축소할 수 있습니다.",
        "이미지와 글자를 선택한 뒤 마우스 휠로 크기를 조절할 수 있습니다. 오른쪽 클릭 메뉴에서 정렬·확대·축소·초기화를 사용할 수 있습니다.",
    )
    if text != original:
        path.write_text(text, encoding="utf-8")


def main():
    for rel, replacements in REPLACEMENTS.items():
        path = ROOT / rel
        if path.exists():
            replace_all(path, replacements)

    for rel in ["tools/pdf-editor.html", "tools/pdf-Checker.html", "tools/perfect-binding-cover.html"]:
        path = ROOT / rel
        if path.exists():
            inject_scripts(path)

    pdf_editor = ROOT / "tools/pdf-editor.html"
    if pdf_editor.exists():
        patch_pdf_editor(pdf_editor)

    cover = ROOT / "tools/perfect-binding-cover.html"
    if cover.exists():
        patch_cover(cover)


if __name__ == "__main__":
    main()
