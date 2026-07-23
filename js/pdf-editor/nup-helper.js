// PDF editor per-file N-UP controls and preview labels.
// Page-level settings always take priority over file/global defaults.
(function () {
  'use strict';
  if (window.__pdfEditorNupHelperV6) return;
  window.__pdfEditorNupHelperV6 = true;

  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  const helperMap = window.__pdfEditorFileNupMapV6 = window.__pdfEditorFileNupMapV6 || {};
  let knownFileCount = 0;
  let lastPageCount = null;
  let pageCountTimer = null;

  function $(id) { return document.getElementById(id); }
  function ready() {
    try { return Array.isArray(parsedPages) && Array.isArray(uploadedFiles); }
    catch (_) { return false; }
  }
  function validNup(value) {
    const parsed = Number(value);
    return NUP_VALUES.includes(parsed) ? parsed : null;
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
  function mainFileMap() {
    try { return fileNupMap; }
    catch (_) { return null; }
  }
  function getFileNup(fileIndex) {
    const mainMap = mainFileMap();
    const mainValue = mainMap ? validNup(mainMap[fileIndex]) : null;
    return mainValue || validNup(helperMap[fileIndex]);
  }
  function setFileNup(fileIndex, value) {
    if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
    const parsed = validNup(value);
    const mainMap = mainFileMap();
    if (parsed === null) {
      delete helperMap[fileIndex];
      if (mainMap) delete mainMap[fileIndex];
    } else {
      helperMap[fileIndex] = parsed;
      if (mainMap) mainMap[fileIndex] = parsed;
    }
  }
  function detectFiles() {
    if (!ready()) return;
    const count = fileCount();
    if (count === 0 && parsedPages.length === 0) {
      Object.keys(helperMap).forEach((key) => delete helperMap[key]);
      knownFileCount = 0;
      lastPageCount = 0;
      return;
    }
    if (count < knownFileCount) {
      Object.keys(helperMap).forEach((key) => { if (Number(key) >= count) delete helperMap[key]; });
      const mainMap = mainFileMap();
      if (mainMap) Object.keys(mainMap).forEach((key) => { if (Number(key) >= count) delete mainMap[key]; });
    }
    knownFileCount = count;
  }
  function effectivePageNup(page) {
    if (page.nupDisabled || page.nup_disabled) return 1;
    const pageOverride = validNup(page.nupOverride ?? page.nup_override);
    if (pageOverride) return pageOverride;
    const fi = fileIndexOf(page);
    const fileOverride = fi === null ? null : getFileNup(fi);
    return fileOverride || currentNup();
  }
  function patchGroupByNup() {
    if (typeof groupByNup !== 'function' || groupByNup.__priorityNupPatchedV6) return;
    const patched = function priorityNupGroupByNup(pages) {
      if (!pages || !pages.length) return [];
      const groups = [];
      for (const page of pages) {
        const pageNup = effectivePageNup(page);
        const last = groups[groups.length - 1];
        const hasBreak = !!(page.groupBreak || page.group_break);
        const isolated = !!(page.nupDisabled || page.nup_disabled);
        if (last && !isolated && !last.isolated && last.n === pageNup && !hasBreak) {
          last.pages.push(page);
        } else {
          groups.push({ n: pageNup, pages: [page], isolated });
        }
      }
      return groups;
    };
    patched.__priorityNupPatchedV6 = true;
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
    guide.innerHTML = 'N-UP 우선순위: <b>페이지별 설정 → 파일별 설정 → 전체 기본 설정</b> 순서로 적용됩니다.';
  }
  function makeFileRow(fileIndex, pageCount) {
    const current = getFileNup(fileIndex);
    const file = uploadedFiles[fileIndex];
    const row = document.createElement('div');
    row.className = 'file-nup-row-v5';
    row.style.cssText = 'flex:0 0 100%;display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0 8px;padding:8px 10px;border:1px dashed #c4b5fd;border-radius:9px;background:#faf5ff;';
    row.innerHTML = `
      <div style="min-width:0;flex:1;">
        <div style="font-size:11px;font-weight:900;color:#5b21b6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">파일 ${fileIndex + 1} · ${esc(safeName(file, fileIndex))}</div>
        <div style="font-size:10px;color:#6b7280;margin-top:2px;">${pageCount}페이지 · 페이지별 설정은 유지됩니다</div>
      </div>
      <label style="display:flex;align-items:center;gap:5px;margin:0;font-size:10px;font-weight:900;color:#374151;white-space:nowrap;">
        배치 장수
        <select class="file-nup-select-v5" data-file-index="${fileIndex}" style="width:82px;border:1px solid #d8b4fe;border-radius:8px;padding:5px 7px;font-size:12px;font-weight:900;font-family:inherit;background:#fff;color:#5b21b6;">
          <option value="" ${current === null ? 'selected' : ''}>기본</option>
          ${NUP_VALUES.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}장</option>`).join('')}
        </select>
      </label>`;
    const select = row.querySelector('select');
    select.onchange = () => {
      setFileNup(fileIndex, select.value === '' ? null : Number(select.value));
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
      ref.insertAdjacentElement('afterend', makeFileRow(fi, info[fi].count));
    });
  }
  function refreshAfterFileNupChange(forcePreview) {
    renderFileRowsUnderPageList();
    try {
      if (forcePreview && Array.isArray(previewCanvases) && previewCanvases.length > 0) {
        if (typeof schedulePreview === 'function') schedulePreview(80);
        else if (typeof triggerPreview === 'function') triggerPreview();
      }
    } catch (e) {
      console.warn('[pdf-nup] preview refresh failed', e);
    }
  }
  function patchRenderThumbs() {
    if (typeof renderThumbs !== 'function' || renderThumbs.__nupRowsPatchedV6) return;
    const original = renderThumbs;
    const wrapped = function renderThumbsWithNupRows() {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        renderQuickGuide();
        renderFileRowsUnderPageList();
      }, 0);
      return result;
    };
    wrapped.__nupRowsPatchedV6 = true;
    renderThumbs = wrapped;
  }
  function renderPreviewPageLabels() {
    [...document.querySelectorAll('#previewScroll .page-preview')].forEach((wrap, idx) => {
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
    if (typeof displayPreview !== 'function' || displayPreview.__pageLabelsPatchedV6) return;
    const original = displayPreview;
    const wrapped = function displayPreviewWithPageLabels() {
      const result = original.apply(this, arguments);
      setTimeout(renderPreviewPageLabels, 0);
      return result;
    };
    wrapped.__pageLabelsPatchedV6 = true;
    displayPreview = wrapped;
  }
  function schedulePreviewIfExists(delay = 120) {
    clearTimeout(pageCountTimer);
    pageCountTimer = setTimeout(() => {
      try {
        renderFileRowsUnderPageList();
        if (Array.isArray(previewCanvases) && previewCanvases.length > 0 && typeof triggerPreview === 'function') triggerPreview();
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
      if (btn.__nupBtnHookV6) return;
      btn.__nupBtnHookV6 = true;
      btn.addEventListener('click', () => setTimeout(renderFileRowsUnderPageList, 0), true);
    });
  }
  function installResetHook() {
    const reset = $('resetBtn');
    if (!reset || reset.__nupResetHookV6) return;
    reset.__nupResetHookV6 = true;
    reset.addEventListener('click', () => {
      Object.keys(helperMap).forEach((key) => delete helperMap[key]);
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
