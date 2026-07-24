from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDF_HTML = ROOT / "pdf-editor" / "index.html"
LOADER = ROOT / "js" / "pdf-editor" / "loader.js"
UX_REPAIR = ROOT / "js" / "pdf-editor" / "ux-repair.js"
STORAGE_RULES = ROOT / "storage.rules"
FIRESTORE_RULES = ROOT / "firestore.rules"
COVER_HTML = ROOT / "perfect-binding-cover" / "index.html"


def replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


pdf = PDF_HTML.read_text(encoding="utf-8")
pdf = replace_once(
    pdf,
    r"\n\s*<button class=\"nav-history-btn\" id=\"navHistoryBtn\" style=\"display:none;\">.*?</button>",
    "",
    "history navigation button",
    re.S,
)
pdf = replace_once(
    pdf,
    r"\n<!-- File History Modal -->\n<div id=\"fileHistoryModal\".*?(?=\n<!-- 편집 저장 / 불러오기 모달 -->)",
    "\n",
    "history modal",
    re.S,
)
pdf = pdf.replace("\n  document.getElementById('navHistoryBtn').style.display = 'flex';", "")
pdf = replace_once(
    pdf,
    r"// ── Firebase Storage helpers ─+\n.*?(?=// ── Editor session save / load)",
    "",
    "history storage helpers",
    re.S,
)
pdf = replace_once(
    pdf,
    r"\nasync function openFileHistory\(\) \{.*?(?=\n// ── State)",
    "\n",
    "history listing handlers",
    re.S,
)
old_save = """    showStatus('PDF 저장 완료! ☁️ 내 파일함에 업로드 중...', 'success');
    saveToStorage(blob, filename)
      .then(() => {
        const el = $('statusBar');
        el.style.display = 'flex';
        el.className = 'status-bar success';
        el.innerHTML = `<span>✅ 내 파일함에 저장 완료!</span><button onclick="openFileHistory()" style="margin-left:auto;border:1px solid #166534;border-radius:6px;padding:4px 12px;font-size:11px;font-weight:800;background:#dcfce7;color:#166534;cursor:pointer;font-family:inherit;">📂 내 파일함 보기</button>`;
        setTimeout(hideStatus, 6000);
      })
      .catch(err => { console.error('Storage upload failed', err); showStatus('PDF 저장 완료! (파일함 업로드 실패)', 'success'); setTimeout(hideStatus, 3000); });"""
new_save = """    showStatus('PDF 저장 완료!', 'success');
    setTimeout(hideStatus, 3000);"""
if old_save not in pdf:
    raise RuntimeError("download history upload block was not found")
pdf = pdf.replace(old_save, new_save, 1)
for token in ("navHistoryBtn", "fileHistoryModal", "pdf_history", "openFileHistory", "saveToStorage", "내 파일함"):
    if token in pdf:
        raise RuntimeError(f"PDF editor still contains removed history token: {token}")
PDF_HTML.write_text(pdf, encoding="utf-8")

loader = LOADER.read_text(encoding="utf-8")
loader = re.sub(r"\n\s*'/js/pdf-editor/storage-cleanup\.js\?v=[^']+',", "", loader)
loader = re.sub(r"\n\s*'/js/pdf-editor/history-policy\.js\?v=[^']+',", "", loader)
if "storage-cleanup.js" in loader or "history-policy.js" in loader:
    raise RuntimeError("history modules are still loaded")
LOADER.write_text(loader, encoding="utf-8")
for relative in ("js/pdf-editor/storage-cleanup.js", "js/pdf-editor/history-policy.js"):
    path = ROOT / relative
    if path.exists():
        path.unlink()

storage = STORAGE_RULES.read_text(encoding="utf-8")
storage = replace_once(
    storage,
    r"\n\s*match /pdf_history/\{userId\}/\{allPaths=\*\*\} \{.*?\n\s*\}",
    "",
    "Storage pdf_history rule",
    re.S,
)
STORAGE_RULES.write_text(storage, encoding="utf-8")

firestore = FIRESTORE_RULES.read_text(encoding="utf-8")
firestore = replace_once(
    firestore,
    r"\n\s*match /users/\{uid\}/pdf_history/\{docId\} \{[^\n]+\}",
    "",
    "Firestore pdf_history rule",
)
FIRESTORE_RULES.write_text(firestore, encoding="utf-8")

ux = UX_REPAIR.read_text(encoding="utf-8")
ux = ux.replace("hint.textContent = '대용량 최적화 · 미리보기 수동';", "hint.textContent = '대용량 문서 · 수동 미리보기';")
ux = ux.replace(
    "hint.title = '페이지 수나 파일 크기가 매우 클 때 자동 미리보기를 줄여 브라우저 멈춤을 방지합니다. 미리보기 새로고침 버튼으로 확인할 수 있습니다.';",
    "hint.title = '대용량 PDF도 미리볼 수 있습니다. 브라우저 멈춤을 막기 위해 자동 갱신만 중지되며, 미리보기 새로고침 버튼으로 실제 내용을 확인합니다.';",
)
ux = ux.replace(
    "hint.title = '페이지가 매우 많은 PDF는 브라우저 멈춤을 막기 위해 페이지 목록만 먼저 표시합니다.';",
    "hint.title = '페이지가 매우 많은 PDF는 브라우저 보호를 위해 목록과 배치 중심으로 표시합니다. 저장 결과는 원본 PDF를 기준으로 처리됩니다.';",
)
needle = "    [byId('statusBar'), byId('previewInfo'), byId('previewScroll')].forEach(replaceModeTerms);"
replacement = """    const previewButton = byId('previewBtn');
    if (previewButton) {
      previewButton.textContent = extreme ? '레이아웃 미리보기' : (optimized ? '대용량 미리보기 생성' : '미리보기 새로고침');
    }
    [byId('statusBar'), byId('previewInfo'), byId('previewScroll')].forEach(replaceModeTerms);"""
if needle not in ux:
    raise RuntimeError("UX preview label insertion point missing")
ux = ux.replace(needle, replacement, 1)
UX_REPAIR.write_text(ux, encoding="utf-8")

# Rename only the product name, while keeping technical mentions of perfect binding intact.
replacements = {
    "무선제본 표지제작기": "책표지제작",
    "무선제본 표지 제작기": "책표지제작",
    "무선제본용 표지 제작기": "책표지제작",
    "무선제본 표지 제작": "책표지제작",
}
text_suffixes = {".html", ".js", ".json", ".md", ".py", ".yml", ".yaml"}
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in text_suffixes or ".git" in path.parts:
        continue
    text = path.read_text(encoding="utf-8")
    changed = text
    for old, new in replacements.items():
        changed = changed.replace(old, new)
    if path == COVER_HTML:
        changed = changed.replace("<title>표지 제작 · Program Tool</title>", "<title>책표지제작 · Program Tool</title>")
        changed = changed.replace('<div class="nav-title">표지 제작</div>', '<div class="nav-title">책표지제작</div>')
    if changed != text:
        path.write_text(changed, encoding="utf-8")

cover = COVER_HTML.read_text(encoding="utf-8")
if "책표지제작" not in cover:
    raise RuntimeError("cover product name was not updated")

# Bump deployment/cache version everywhere it is intentionally synchronized.
for relative in ("version.json", "js/sw-register.js", "sw.js", "js/firebase-config.js"):
    path = ROOT / relative
    text = path.read_text(encoding="utf-8")
    if "2026.07.24.004" not in text:
        raise RuntimeError(f"old version missing in {relative}")
    path.write_text(text.replace("2026.07.24.004", "2026.07.24.005"), encoding="utf-8")
version_file = ROOT / "version.json"
version_text = version_file.read_text(encoding="utf-8")
version_text = re.sub(r'"label":\s*"[^"]+"', '"label": "파일함 제거·책표지제작 작업 메뉴 통일"', version_text, count=1)
version_text = re.sub(r'"updatedAt":\s*"[^"]+"', '"updatedAt": "2026-07-24T16:10:00+09:00"', version_text, count=1)
version_file.write_text(version_text, encoding="utf-8")

# Remove the one-shot migration files from the resulting product commit.
for relative in (
    ".github/scripts/apply_file_library_cover_update.py",
    ".github/workflows/apply-file-library-cover-update.yml",
):
    path = ROOT / relative
    if path.exists():
        path.unlink()

print("Requested PDF history removal and cover UI normalization applied.")
