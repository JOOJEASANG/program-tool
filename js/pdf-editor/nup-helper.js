// PDF editor per-file N-UP controls and preview labels.
(function () {
  if (window.__pdfEditorNupHelperV5) return;
  window.__pdfEditorNupHelperV5 = true;

  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  const map = window.__pdfEditorFileNupMapV5 = window.__pdfEditorFileNupMapV5 || {};
  let knownFileCount = 0;
  let lastPageCount = null;
  let pageCountTimer = null;

  function $(id) { return document.getElementById(id); }
  function ready() {
    try { return Array.isArray(parsedPages) && Array.isArray(uploadedFiles); }
    catch (_) { return false; }
  }
  function validNup(value) {
    value = Number(value);
    return NUP_VALUES.includes(value) ? value : null;
  }
  function currentNup() {
    try { return validNup(nup) || 2; }
    catch (_) { return 2; }
  }
  function fileCount() {
    try { return uploadedFiles.length || 0; }
    catch (_) { return 0; }
  }
  function fileIndexOf(page) {
    const fi = Number(page && (page.file_index ?? page.fileIndex));
    return Number.isInteger(fi) && fi >= 0 ? fi : null;
  }
  function isPdfPage(page) {
    return !!page && ((!page.pageType && !page.page_type) || page.pageType === 'pdf' || page.page_type === 'normal');
  }
  function safeName(file, index) {
    const name = file && file.name ? String(file.name) : `파일 ${index + 1}`;
    return name.length > 24 ? name.slice(0, 23) + '…' : name;
  }
  function esc(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function detectFiles() {
    if (!ready()) return;
    const count = fileCount();
    if (count === 0 && parsedPages.length === 0) {
      Object.keys(map).forEach((key) => delete map[key]);
      knownFileCount = 0;
      lastPageCount = 0;
      return;
    }
    if (count > knownFileCount) {
      const uploadNup = currentNup();
      for (let i = knownFileCount; i < count; i++) {
        if (!validNup(map[i])) map[i] = uploadNup;
      }
      knownFileCount = count;
    } else if (count < knownFileCount) {
      Object.keys(map).forEach((key) => { if (Number(key) >= count) delete map[key]; });
      knownFileCount = count;
    }
    for (let i = 0; i < count; i++) {
      if (!validNup(map[i])) map[i] = currentNup();
    }
  }

  function setFileNup(fileIndex, value) {
    const n = validNup(value) || currentNup();
    if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
    map[fileIndex] = n;
  }

  function applyFileNupsToPages() {
    if (!ready()) return;
    detectFiles();
    parsedPages.forEach((page) => {
      if (!isPdfPage(page)) return;
      const fi = fileIndexOf(page);
      if (fi === null) return;
      const mapped = validNup(map[fi]) || currentNup();
      page.nupOverride = mapped;
      page.nup_override = mapped;
      page.nupDisabled = false;
      page.nup_disabled = false;
    });
  }

  function patchGroupByNup() {
    if (typeof groupByNup !== 'function' || groupByNup.__perFileNupPatchedV5) return;
    const patched = function perFileNupGroupByNup(pages) {
      applyFileNupsToPages();
      if (!pages || !pages.length) return [];
      const groups = [];
      for (const page of pages) {
        if (page.nupDisabled) {
          groups.push({ n: 1, pages: [page] });
          continue;
        }
        const fi = fileIndexOf(page);
        const mapped = fi === null ? null : validNup(map[fi]);
        const pageNup = validNup(page.nupOverride || page.nup_override || mapped || currentNup()) || 2;
        const last = groups[groups.length - 1];
        const hasBreak = !!(page.groupBreak || page.group_break);
        if (last && !last.pages[0].nupDisabled && last.n === pageNup && !hasBreak) {
          last.pages.push(page);
        } else {
          groups.push({ n: pageNup, pages: [page] });
        }
      }
      return groups;
    };
    patched.__perFileNupPatchedV5 = true;
    groupByNup = patched;
  }

  function renderQuickGuide() {
    const oldPanel = $('fileNupOverridePanel');
    if (oldPanel) oldPanel.remove();
    const nupGrid = document.querySelector('.nup-grid');
    if (!nupGrid) return;
    let guide = $('nupQuickGuide');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'nupQuickGuide';
      guide.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:10px;font-weight:800;line-height:1.55;';
      nupGrid.insertAdjacentElement('afterend', guide);
    }
    guide.innerHTML = 'N-UP 안내: 업로드 전에 기본 배치를 선택하세요. 여러 PDF를 추가하면 <b>페이지 목록 아래 파일별 배치</b>에서 각 파일의 장수를 따로 바꿀 수 있습니다.';
  }

  function makeFileRow(fileIndex, pageCount) {
    const current = validNup(map[fileIndex]) || currentNup();
    const file = uploadedFiles[fileIndex];
    const row = document.createElement('div');
    row.className = 'file-nup-row-v5';
    row.style.cssText = 'flex:0 0 100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0 8px;padding:8px 10px;border:1px dashed #c4b5fd;border-radius:9px;background:#faf5ff;';
    row.innerHTML = `
      <div style="min-width:0;flex:1;">
        <div style="font-size:11px;font-weight:900;color:#5b21b6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">파일 ${fileIndex + 1} · ${esc(safeName(file, fileIndex))}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">${pageCount}페이지 · 이 파일만 적용</div>
      </div>
      <label style="display:flex;align-items:center;gap:5px;margin:0;font-size:10px;font-weight:900;color:#374151;white-space:nowrap;">
        배치 장수
        <select class="file-nup-select-v5" data-file-index="${fileIndex}" style="width:76px;border:1px solid #d8b4fe;border-radius:8px;padding:5px 7px;font-size:12px;font-weight:900;font-family:inherit;background:#fff;color:#5b21b6;">
          ${NUP_VALUES.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}장</option>`).join('')}
        </select>
      </label>`;
    const select = row.querySelector('select');
    select.onchange = () => {
      setFileNup(fileIndex, Number(select.value));
      applyFileNupsToPages();
      refreshAfterFileNupChange(true);
    };
    return row;
  }

  function renderFileRowsUnderPageList() {
    if (!ready()) return;
    const area = $('thumbArea');
    if (!area) return;
    area.querySelectorAll('.file-nup-row-v5').forEach((el) => el.remove());
    detectFiles();
    const thumbs = [...area.querySelectorAll('.thumb-item')];
    if (!thumbs.length || !fileCount()) return;

    const info = {};
    parsedPages.forEach((page, idx) => {
      if (!isPdfPage(page)) return;
      const fi = fileIndexOf(page);
      if (fi === null) return;
      if (!info[fi]) info[fi] = { lastIdx: idx, count: 0 };
      info[fi].lastIdx = idx;
      info[fi].count += 1;
    });

    Object.keys(info).map(Number).sort((a, b) => a - b).forEach((fi) => {
      const ref = thumbs[info[fi].lastIdx];
      if (!ref) return;
      const row = makeFileRow(fi, info[fi].count);
      ref.insertAdjacentElement('afterend', row);
    });
  }

  function patchRenderThumbs() {
    if (typeof renderThumbs !== 'function' || renderThumbs.__nupRowsPatchedV5) return;
    const original = renderThumbs;
    const wrapped = function renderThumbsWithNupRows() {
      applyFileNupsToPages();
      const result = original.apply(this, arguments);
      setTimeout(() => {
        renderQuickGuide();
        renderFileRowsUnderPageList();
      }, 0);
      return result;
    };
    wrapped.__nupRowsPatchedV5 = true;
    renderThumbs = wrapped;
  }

  function renderPreviewPageLabels() {
    const wraps = [...document.querySelectorAll('#previewScroll .page-preview')];
    wraps.forEach((wrap, idx) => {
      let label = wrap.querySelector('.page-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'page-label';
        label.style.cssText = 'font-size:11px;color:#475569;font-weight:900;text-align:center;padding:5px 2px 7px;background:#fff;border-top:1px solid #e5e7eb;';
        wrap.appendChild(label);
      }
      label.textContent = `${idx + 1}p`;
    });
  }

  function patchDisplayPreview() {
    if (typeof displayPreview !== 'function' || displayPreview.__pageLabelsPatchedV5) return;
    const original = displayPreview;
    const wrapped = function displayPreviewWithPageLabels() {
      const result = original.apply(this, arguments);
      setTimeout(renderPreviewPageLabels, 0);
      return result;
    };
    wrapped.__pageLabelsPatchedV5 = true;
    displayPreview = wrapped;
  }

  function schedulePreviewIfExists(delay = 120) {
    clearTimeout(pageCountTimer);
    pageCountTimer = setTimeout(() => {
      try {
        applyFileNupsToPages();
        renderFileRowsUnderPageList();
        if (Array.isArray(previewCanvases) && previewCanvases.length > 0 && typeof triggerPreview === 'function') {
          triggerPreview();
        }
      } catch (e) {
        console.warn('[pdf-nup] preview refresh failed', e);
      }
    }, delay);
  }

  function watchPageCountForBlankAndDivider() {
    if (!ready()) return;
    const count = parsedPages.length;
    if (lastPageCount === null) {
      lastPageCount = count;
      return;
    }
    if (count !== lastPageCount) {
      const hadPreview = typeof previewCanvases !== 'undefined' && Array.isArray(previewCanvases) && previewCanvases.length > 0;
      lastPageCount = count;
      renderFileRowsUnderPageList();
      if (hadPreview) schedulePreviewIfExists(180);
    }
  }

  function installNupButtonHooks() {
    document.querySelectorAll('.nup-btn').forEach((btn) => {
      if (btn.__nupBtnHookV5) return;
      btn.__nupBtnHookV5 = true;
      btn.addEventListener('click', () => {
        setTimeout(() => {
          detectFiles();
          const latest = fileCount() - 1;
          if (latest >= 0) setFileNup(latest, currentNup());
          applyFileNupsToPages();
          renderFileRowsUnderPageList();
        }, 0);
      }, true);
    });
  }

  function installResetHook() {
    const reset = $('resetBtn');
    if (!reset || reset.__nupResetHookV5) return;
    reset.__nupResetHookV5 = true;
    reset.addEventListener('click', () => {
      Object.keys(map).forEach((key) => delete map[key]);
      knownFileCount = 0;
      lastPageCount = 0;
      setTimeout(() => {
        renderFileRowsUnderPageList();
        renderQuickGuide();
      }, 80);
    }, true);
  }

  function boot() {
    try {
      if (!ready()) return;
      patchGroupByNup();
      patchRenderThumbs();
      patchDisplayPreview();
      installNupButtonHooks();
      installResetHook();
      detectFiles();
      applyFileNupsToPages();
      renderQuickGuide();
      renderFileRowsUnderPageList();
      renderPreviewPageLabels();
      watchPageCountForBlankAndDivider();
    } catch (e) {
      console.warn('[pdf-nup] boot failed', e);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 400);
  setInterval(boot, 900);
})();
