#!/usr/bin/env python3
"""Finalize the PDF editor performance patch and remove deployment-only source changes."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EDITOR = ROOT / "pdf-editor" / "index.html"


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return updated


def main() -> None:
    text = EDITOR.read_text(encoding="utf-8")

    text = text.replace(
        '<head><script data-program-studio-boot-guard src="/js/app-boot-guard.js?v=2026.07.29.006"></script>\n',
        '<head>\n',
        1,
    )

    text = sub_once(
        text,
        r"async function handleFile\(file\) \{.*?\n\}\n\n// ── PDF page renderer",
        r'''async function handleFile(file) {
  const isPdf = file && ((file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || ''));
  if (!isPdf) {
    showStatus('PDF 파일만 업로드할 수 있습니다.', 'error');
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showStatus('PDF 파일은 300MB 이하만 불러올 수 있습니다.', 'error');
    return;
  }

  const isNew = _uploadMode === 'new';
  const isBreak = _uploadMode === 'break';
  const previous = isNew ? {
    parsedPages,
    uploadedFiles,
    previewCanvases,
    fileNupMap,
    loadedPdfDocs,
    nextId: _nextId,
  } : null;

  if (isNew) {
    _previewRequestId++;
    _previewPending = false;
    if (_autoPreviewTimer) {
      clearTimeout(_autoPreviewTimer);
      _autoPreviewTimer = null;
    }
    parsedPages = [];
    uploadedFiles = [];
    previewCanvases = [];
    fileNupMap = {};
    loadedPdfDocs = [];
    _nextId = 1;
    $('previewBtn').disabled = true;
    $('downloadBtn').disabled = true;
    $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>페이지 렌더링 중...</p></div>';
  }

  const startPageCount = parsedPages.length;
  const startFileCount = uploadedFiles.length;
  const startDocCount = loadedPdfDocs.length;
  const fileIdx = uploadedFiles.length;
  let openedPdfDoc = null;

  showStatus(`"${file.name}" 로딩 중...`);
  const shortName = file.name.length > 28 ? file.name.slice(0, 26) + '…' : file.name;

  try {
    const buf = await file.arrayBuffer();
    openedPdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    const total = openedPdfDoc.numPages;
    if (parsedPages.length + total > MAX_IMPORT_PAGES) {
      throw new Error(`한 작업에서 최대 ${MAX_IMPORT_PAGES}페이지까지 불러올 수 있습니다. 현재 ${parsedPages.length}페이지입니다.`);
    }
    if (total > 200) {
      showStatus(`대용량 PDF ${total}페이지를 불러오는 중입니다. 미리보기는 최대 ${MAX_PREVIEW_OUTPUT_PAGES}출력 페이지만 표시됩니다.`);
    }

    loadedPdfDocs.push(openedPdfDoc);
    uploadedFiles.push(file);

    for (let i = 1; i <= total; i++) {
      showStatus(`"${shortName}" 렌더링 중... (${i} / ${total})`);
      const pdfPage = await openedPdfDoc.getPage(i);
      const thumbCanvas = await renderPdfPage(pdfPage, 0.9, 0);

      if (isNew && i === 1 && $('autoDetectSize')?.checked) {
        const vp = pdfPage.getViewport({ scale: 1 });
        const wMm = Math.round(vp.width * 25.4 / 72);
        const hMm = Math.round(vp.height * 25.4 / 72);
        const detected = detectPaperSizeMm(wMm, hMm);
        $('paperSize').value = detected.name;
        $('customSizeRow').style.display = detected.name === 'custom' ? 'grid' : 'none';
        if (detected.name === 'custom') {
          $('customW').value = Math.min(wMm, hMm);
          $('customH').value = Math.max(wMm, hMm);
        }
        const isLandscape = vp.width > vp.height;
        landscape = isLandscape;
        $('orientLand').classList.toggle('active', isLandscape);
        $('orientPort').classList.toggle('active', !isLandscape);
      }

      const groupBreak = !isNew && isBreak && i === 1;
      parsedPages.push({
        id: makeId(), pdfPage, thumbCanvas,
        excluded: false, nupOverride: null, nupDisabled: false,
        sourceFile: shortName, groupBreak, rotation: 0, pageType: 'pdf',
        file_index: fileIdx, page_index: i - 1,
      });
      await yieldToBrowser();
    }

    if (previous) {
      releaseCanvasList(previous.previewCanvases);
      releasePageMemory(previous.parsedPages);
      destroyPdfDocuments(previous.loadedPdfDocs);
    }

    renderThumbs();
    $('previewBtn').disabled = false;
    showStatus(`"${shortName}" ${total}페이지 로드 완료`, 'success');
    if (isNew) {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active','break-active'));
      document.querySelector('.mode-btn[data-mode="cont"]')?.classList.add('active');
      _uploadMode = 'cont';
    }
    try { await triggerPreview(); } catch (_) {}
  } catch (error) {
    console.error(error);
    const addedPages = parsedPages.splice(startPageCount);
    releasePageMemory(addedPages);
    uploadedFiles.splice(startFileCount);
    const addedDocuments = loadedPdfDocs.splice(startDocCount);
    destroyPdfDocuments(addedDocuments);
    if (openedPdfDoc && !addedDocuments.includes(openedPdfDoc)) destroyPdfDocuments([openedPdfDoc]);

    if (previous) {
      releaseCanvasList(previewCanvases);
      parsedPages = previous.parsedPages;
      uploadedFiles = previous.uploadedFiles;
      previewCanvases = previous.previewCanvases;
      fileNupMap = previous.fileNupMap;
      loadedPdfDocs = previous.loadedPdfDocs;
      _nextId = previous.nextId;
      renderThumbs();
      if (previewCanvases.length) displayPreview(previewCanvases, true);
      $('previewBtn').disabled = !parsedPages.length;
      $('downloadBtn').disabled = !previewCanvases.length;
    }
    showStatus('파일 로딩 실패: ' + error.message, 'error');
  }
}

// ── PDF page renderer''',
        "replace import with rollback-safe implementation",
        flags=re.S,
    )

    text = sub_once(
        text,
        r"const renderedMap = new Map\(\);\n    for \(let fi = 0; fi < files\.length; fi\+\+\) \{",
        "const renderedMap = new Map();\n    let sessionPageCount = 0;\n    for (let fi = 0; fi < files.length; fi++) {",
        "add session page counter",
    )
    text = sub_once(
        text,
        r"const pdfDoc = await pdfjsLib\.getDocument\(\{ data: buf \}\)\.promise;\n      loadedPdfDocs\.push\(pdfDoc\);",
        "const pdfDoc = await pdfjsLib.getDocument({ data: buf }).promise;\n      sessionPageCount += pdfDoc.numPages;\n      if (sessionPageCount > MAX_IMPORT_PAGES) {\n        try { await pdfDoc.destroy(); } catch (_) {}\n        throw new Error(`저장된 작업이 ${MAX_IMPORT_PAGES}페이지 제한을 초과합니다.`);\n      }\n      loadedPdfDocs.push(pdfDoc);",
        "limit restored sessions",
    )

    text = text.replace(
        "if (p.rotation) p.thumbCanvas = await renderPdfPage(p.pdfPage, 0.9, p.rotation);",
        "if (p.rotation) {\n          const previousThumb = p.thumbCanvas;\n          p.thumbCanvas = await renderPdfPage(p.pdfPage, 0.9, p.rotation);\n          releaseCanvas(previousThumb);\n        }",
        1,
    )

    text = text.replace(
        "_editingDividerPage.thumbCanvas = renderDividerCanvas(content, 200, 283);",
        "const previousThumb = _editingDividerPage.thumbCanvas;\n    _editingDividerPage.thumbCanvas = renderDividerCanvas(content, 200, 283);\n    releaseCanvas(previousThumb);",
        1,
    )

    text = text.replace(
        "page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);\n      page.hiCanvas = null;",
        "const previousThumb = page.thumbCanvas;\n      page.thumbCanvas = await renderPdfPage(page.pdfPage, 0.9, page.rotation);\n      releaseCanvas(previousThumb);\n      releaseCanvas(page.hiCanvas);\n      page.hiCanvas = null;",
        1,
    )
    text = text.replace(
        "p.thumbCanvas = await renderPdfPage(p.pdfPage, 0.9, p.rotation);\n      p.hiCanvas = null;",
        "const previousThumb = p.thumbCanvas;\n      p.thumbCanvas = await renderPdfPage(p.pdfPage, 0.9, p.rotation);\n      releaseCanvas(previousThumb);\n      releaseCanvas(p.hiCanvas);\n      p.hiCanvas = null;",
        1,
    )
    text = text.replace(
        "const [moved] = parsedPages.splice(si, 1);",
        "const [moved] = parsedPages.splice(si, 1);",
        1,
    )
    text = text.replace(
        "parsedPages.splice(idx, 1);\n      renderThumbs(); schedulePreview(300);",
        "const [removed] = parsedPages.splice(idx, 1);\n      releasePageMemory([removed]);\n      renderThumbs(); schedulePreview(300);",
        1,
    )

    text = text.replace(
        "// (mobile/background tabs can throttle setTimeout/setInterval). The\n    // watchdog below is only a backstop if this somehow doesn't run.\n",
        "// The serialized preview runner handles background-tab timer throttling.\n",
        1,
    )

    EDITOR.write_text(text, encoding="utf-8")
    print("PDF editor performance patch finalized")


if __name__ == "__main__":
    main()
