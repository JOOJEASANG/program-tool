#!/usr/bin/env python3
"""Apply the PDF editor memory and preview-concurrency hardening patch once."""
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EDITOR = ROOT / "pdf-editor" / "index.html"


def sub_once(source: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, source, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


def replace_all_checked(source: str, old: str, new: str, label: str, minimum: int = 1) -> str:
    count = source.count(old)
    if count < minimum:
        raise RuntimeError(f"{label}: expected at least {minimum} matches, found {count}")
    return source.replace(old, new)


def patch_editor() -> None:
    source = EDITOR.read_text(encoding="utf-8")

    source = sub_once(
        source,
        r"let parsedPages = \[\];.*?let _dividerVAlign = 'center';",
        """let parsedPages = [];
let uploadedFiles = []; // original File objects, indexed by file_index
let loadedPdfDocs = []; // PDF.js documents retained only while the current job is open
let fileNupMap = {};    // file_index → nup override (undefined = use global nup)
let nup = 2;
let orderLR = true;
let landscape = false;
let showBorder = true;
let previewCanvases = [];
let _dragSrcId = null;
let _nupPopup = null;
let _nextId = 1;
let _uploadMode = 'new'; // 'new' | 'cont' | 'break'
let _editingDividerPage = null; // null = insert new, else = editing existing
let _dividerStyle = 'simple';
let _dividerVAlign = 'center';

const THUMB_MAX_EDGE = 360;
const PREVIEW_DPI = 56;
const MAX_PREVIEW_OUTPUT_PAGES = 60;
const MAX_IMPORT_PAGES = 500;
const MAX_IMPORT_BYTES = 300 * 1024 * 1024;
let _previewRequestId = 0;
let _previewPending = false;
let _previewRunnerPromise = null;

function yieldToBrowser() {
  return new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 50 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

function releaseCanvas(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return;
  try { canvas.width = 1; canvas.height = 1; } catch (_) {}
}

function releaseCanvasList(canvases) {
  for (const canvas of canvases || []) releaseCanvas(canvas);
}

function releasePageMemory(pages) {
  for (const page of pages || []) {
    releaseCanvas(page?.thumbCanvas);
    releaseCanvas(page?.hiCanvas);
    try { page?.pdfPage?.cleanup?.(); } catch (_) {}
  }
}

function destroyPdfDocuments(documents) {
  for (const documentRef of documents || []) {
    try {
      const result = documentRef?.destroy?.();
      result?.catch?.(() => {});
    } catch (_) {}
  }
}

function clearLoadedDocumentMemory() {
  _previewRequestId++;
  _previewPending = false;
  if (_autoPreviewTimer) {
    clearTimeout(_autoPreviewTimer);
    _autoPreviewTimer = null;
  }
  const scroll = $('previewScroll');
  if (scroll) scroll.replaceChildren();
  releaseCanvasList(previewCanvases);
  releasePageMemory(parsedPages);
  destroyPdfDocuments(loadedPdfDocs);
  parsedPages = [];
  uploadedFiles = [];
  loadedPdfDocs = [];
  previewCanvases = [];
  fileNupMap = {};
  _nextId = 1;
}

function makePreviewAbortError() {
  try { return new DOMException('이전 미리보기 작업이 취소되었습니다.', 'AbortError'); }
  catch (_) { const error = new Error('이전 미리보기 작업이 취소되었습니다.'); error.name = 'AbortError'; return error; }
}

function assertPreviewRequest(requestId) {
  if (requestId !== _previewRequestId) throw makePreviewAbortError();
}""",
        "replace state and memory helpers",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"if \(isNew\) \{\s*parsedPages = \[\];\s*uploadedFiles = \[\];\s*previewCanvases = \[\];\s*fileNupMap = \{\};",
        """if (isNew) {
    clearLoadedDocumentMemory();""",
        "replace new-document reset",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"const fileIdx = uploadedFiles\.length;\s*uploadedFiles\.push\(file\);",
        """if (file.size > MAX_IMPORT_BYTES) {
    showStatus('PDF 파일은 300MB 이하만 불러올 수 있습니다.', 'error');
    return;
  }

  const fileIdx = uploadedFiles.length;
  uploadedFiles.push(file);""",
        "add file-size guard",
        flags=re.S,
    )

    source = replace_all_checked(
        source,
        "const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;",
        "const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;\n      loadedPdfDocs.push(pdfDoc);",
        "track PDF.js documents",
        minimum=2,
    )

    source = sub_once(
        source,
        r"const total = pdfDoc\.numPages;",
        """const total = pdfDoc.numPages;
    if (total > MAX_IMPORT_PAGES) {
      throw new Error(`페이지가 너무 많습니다. 한 번에 최대 ${MAX_IMPORT_PAGES}페이지까지 불러올 수 있습니다.`);
    }
    if (total > 200) {
      showStatus(`대용량 PDF ${total}페이지를 불러오는 중입니다. 미리보기는 최대 ${MAX_PREVIEW_OUTPUT_PAGES}출력 페이지만 표시됩니다.`);
    }""",
        "add page-count guard",
    )

    source = sub_once(
        source,
        r"async function renderPdfPage\(pdfPage, scale, rotation\) \{.*?\n\}",
        """async function renderPdfPage(pdfPage, scale, rotation, maxEdge = THUMB_MAX_EDGE) {
  const requested = pdfPage.getViewport({ scale, rotation });
  const largestEdge = Math.max(requested.width, requested.height);
  const limitedScale = maxEdge && largestEdge > maxEdge
    ? scale * (maxEdge / largestEdge)
    : scale;
  const viewport = pdfPage.getViewport({ scale: limitedScale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const renderTask = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
  try {
    await renderTask.promise;
    return canvas;
  } catch (error) {
    releaseCanvas(canvas);
    throw error;
  }
}""",
        "limit thumbnail rendering",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"// ── Build all output pages.*?// ── Preview ─+",
        """// ── Build all output pages ────────────────────────────────────────────
async function buildAllPages(mm2px, useHi, overridePages = null, requestId = null) {
  const active = overridePages || parsedPages.filter(p => !p.excluded);
  const groups = groupByNup(active);
  const totalOutputPages = groups.reduce((sum, grp) => {
    const { cols, rows } = getLayout(grp.n);
    return sum + Math.ceil(grp.pages.length / (cols * rows));
  }, 0);
  const out = [];
  try {
    outputLoop:
    for (const grp of groups) {
      const { cols, rows } = getLayout(grp.n);
      const perPage = cols * rows;
      for (let p = 0; p < Math.ceil(grp.pages.length / perPage); p++) {
        if (requestId !== null) assertPreviewRequest(requestId);
        out.push(buildOutputPage(grp.pages, p, cols, rows, mm2px, useHi));
        if (out.length >= MAX_PREVIEW_OUTPUT_PAGES) break outputLoop;
        await yieldToBrowser();
      }
    }
    for (let idx = 0; idx < out.length; idx++) {
      if (requestId !== null) assertPreviewRequest(requestId);
      try { applyDocEdits(out[idx], idx, totalOutputPages, mm2px); }
      catch (error) { console.warn('[preview] applyDocEdits failed on page', idx, error); }
      if (idx % 8 === 7) await yieldToBrowser();
    }
    out.totalOutputPages = totalOutputPages;
    out.truncated = totalOutputPages > out.length;
    return out;
  } catch (error) {
    releaseCanvasList(out);
    throw error;
  }
}

// ── Preview ────────────────────────────────────────────────────────────""",
        "replace output-page builder",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"async function triggerPreview\(\) \{.*?\n\}\n\n\$\('previewBtn'\)\.addEventListener\('click', triggerPreview\);",
        """async function renderPreviewRequest(requestId) {
  let stage = 'init';
  try {
    stage = 'filter';
    const active = parsedPages.filter(p => !p.excluded);
    if (!active.length) {
      $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">🚫</div><p>활성 페이지가 없습니다.<br>제외된 페이지를 다시 포함해 주세요.</p></div>';
      showStatus('활성 페이지가 없습니다.', 'error');
      return;
    }

    assertPreviewRequest(requestId);
    stage = 'release-old-preview';
    const previousCanvases = previewCanvases;
    previewCanvases = [];
    $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>미리보기 생성 중...</p></div>';
    releaseCanvasList(previousCanvases);
    await yieldToBrowser();

    stage = 'booklet-reorder';
    const useBooklet = (document.getElementById('bookletCheck')?.checked) && (nup in BOOKLET_STRIPS);
    const previewPages = useBooklet ? bookletReorderPreview(active, nup) : null;
    stage = 'build-pages';
    const nextCanvases = await buildAllPages(PREVIEW_DPI / 25.4, false, previewPages, requestId);
    assertPreviewRequest(requestId);
    previewCanvases = nextCanvases;
    if (!previewCanvases.length) {
      showPreviewError('build-pages', new Error('출력 페이지가 0개 생성됨 (활성 ' + active.length + '페이지)'));
      return;
    }

    stage = 'display';
    displayPreview(previewCanvases, true);
    stage = 'labels';
    const groups = groupByNup(active);
    const summary = groups.length > 1
      ? groups.map(g => `${g.n}장×${g.pages.length}`).join(', ')
      : `${nup}장/페이지`;
    const { pw, ph } = getSettings();
    $('previewInfo').textContent = `활성 ${active.length}페이지 · ${summary} · ${pw}×${ph}mm ${landscape ? '가로' : '세로'}`;
    const totalOutputPages = previewCanvases.totalOutputPages || previewCanvases.length;
    $('previewPages').textContent = previewCanvases.truncated
      ? `미리보기 ${previewCanvases.length}/${totalOutputPages}페이지`
      : `총 ${totalOutputPages}페이지`;
    showStatus(
      previewCanvases.truncated
        ? `대용량 보호를 위해 처음 ${previewCanvases.length}페이지만 미리보기로 표시합니다. 저장 PDF에는 전체 페이지가 포함됩니다.`
        : `미리보기 완료 (${previewCanvases.length}페이지)`,
      'success'
    );
    updateBookletPadInfo();
    $('downloadBtn').disabled = false;
    setTimeout(hideStatus, previewCanvases.truncated ? 4500 : 2000);
  } catch (error) {
    if (error?.name !== 'AbortError') showPreviewError(stage, error);
  }
}

function triggerPreview() {
  if (!parsedPages.length) return Promise.resolve();
  _previewRequestId++;
  _previewPending = true;
  if (_previewRunnerPromise) return _previewRunnerPromise;

  _previewRunnerPromise = (async () => {
    showStatus('미리보기 생성 중...');
    $('previewBtn').disabled = true;
    $('downloadBtn').disabled = true;
    try {
      while (_previewPending && parsedPages.length) {
        _previewPending = false;
        const requestId = _previewRequestId;
        await renderPreviewRequest(requestId);
        if (requestId !== _previewRequestId) _previewPending = true;
      }
    } finally {
      $('previewBtn').disabled = false;
      if (previewCanvases.length) $('downloadBtn').disabled = false;
      _previewRunnerPromise = null;
    }
  })();
  return _previewRunnerPromise;
}

$('previewBtn').addEventListener('click', triggerPreview);""",
        "serialize preview generation",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"const c = document\.createElement\('canvas'\);\s*c\.width = canvas\.width; c\.height = canvas\.height;\s*c\.getContext\('2d'\)\.drawImage\(canvas, 0, 0\);\s*wrap\.appendChild\(c\);",
        """canvas.dataset.previewCanvas = 'true';
      wrap.appendChild(canvas);""",
        "remove preview canvas clone",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"const c = document\.createElement\('canvas'\);\s*c\.width = page\.thumbCanvas\.width; c\.height = page\.thumbCanvas\.height;\s*c\.getContext\('2d'\)\.drawImage\(page\.thumbCanvas, 0, 0\);\s*wrap\.appendChild\(c\);",
        """page.thumbCanvas.dataset.thumbnailCanvas = 'true';
      wrap.appendChild(page.thumbCanvas);""",
        "remove thumbnail canvas clone",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"// ── Auto-preview watchdog.*?// ── Preview per-row & zoom controls",
        """// Auto-preview is driven only by explicit uploads and debounced settings changes.
// A repeating watchdog previously caused overlapping full-document renders.

// ── Preview per-row & zoom controls""",
        "remove repeating preview watchdog",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"\$\('resetBtn'\)\.addEventListener\('click', \(\) => \{\s*parsedPages = \[\]; previewCanvases = \[\]; _nextId = 1;",
        """$('resetBtn').addEventListener('click', () => {
  clearLoadedDocumentMemory();""",
        "release memory on reset",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"const prevParsedPages = parsedPages;\s*const prevUploadedFiles = uploadedFiles;\s*const prevFileNupMap = fileNupMap;",
        """const prevParsedPages = parsedPages;
  const prevUploadedFiles = uploadedFiles;
  const prevPreviewCanvases = previewCanvases;
  const prevFileNupMap = fileNupMap;
  const prevLoadedPdfDocs = loadedPdfDocs;""",
        "snapshot session memory",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"parsedPages = \[\];\s*uploadedFiles = \[\];\s*previewCanvases = \[\];\s*fileNupMap = \{\};\s*_nextId = 1;",
        """parsedPages = [];
    uploadedFiles = [];
    previewCanvases = [];
    fileNupMap = {};
    loadedPdfDocs = [];
    _nextId = 1;""",
        "prepare session replacement",
        flags=re.S,
    )

    source = sub_once(
        source,
        r"// Restore settings",
        """releaseCanvasList(prevPreviewCanvases);
    releasePageMemory(prevParsedPages);
    destroyPdfDocuments(prevLoadedPdfDocs);

    // Restore settings""",
        "release previous session after successful load",
    )

    source = sub_once(
        source,
        r"\} catch\(e\) \{\s*// Rollback to the previous session state so the editor isn't left empty\s*parsedPages = prevParsedPages;\s*uploadedFiles = prevUploadedFiles;\s*fileNupMap = prevFileNupMap;",
        """} catch(e) {
    // Rollback to the previous session state so the editor isn't left empty
    releaseCanvasList(previewCanvases);
    releasePageMemory(parsedPages);
    destroyPdfDocuments(loadedPdfDocs);
    parsedPages = prevParsedPages;
    uploadedFiles = prevUploadedFiles;
    previewCanvases = prevPreviewCanvases;
    fileNupMap = prevFileNupMap;
    loadedPdfDocs = prevLoadedPdfDocs;""",
        "restore session memory on failure",
        flags=re.S,
    )

    source = source.replace(
        "URL.revokeObjectURL(url);",
        "setTimeout(() => URL.revokeObjectURL(url), 30000);",
        1,
    )

    EDITOR.write_text(source, encoding="utf-8")


def patch_versions() -> None:
    version_path = ROOT / "version.json"
    version = json.loads(version_path.read_text(encoding="utf-8"))
    version.update(
        version="2026.07.29.006",
        label="PDF 편집기 대용량 안정화",
        updatedAt="2026-07-29T08:20:00+09:00",
    )
    version_path.write_text(json.dumps(version, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    for relative in ("js/firebase-config.js", "sw.js"):
        path = ROOT / relative
        text = path.read_text(encoding="utf-8")
        if "2026.07.29.005" not in text:
            raise RuntimeError(f"version marker missing in {relative}")
        path.write_text(text.replace("2026.07.29.005", "2026.07.29.006"), encoding="utf-8")


def main() -> None:
    patch_editor()
    patch_versions()
    print("PDF editor performance patch applied")


if __name__ == "__main__":
    main()
