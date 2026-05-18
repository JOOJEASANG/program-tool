// Service worker registration disabled.
// Also contains small page helpers that do not intercept page navigation.
(function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => Promise.all(regs.map((reg) => reg.unregister())))
      .catch(() => {});
  }

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }

  if (!location.pathname.endsWith('/tools/pdf-editor.html')) return;

  const FILE_NUP_KEY = 'programToolPdfFileNupOverridesV1';
  const PAGE_NUP_KEY = 'programToolPdfPageNupOverridesV1';
  const SELECTED_PAGE_KEY = 'programToolPdfSelectedPageOrdinalV1';
  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  let apiWrapped = false;
  let fetchWrapped = false;
  let autoPreviewTimer = null;
  let lastPageSignature = '';
  let selectedPageOrdinal = Number(localStorage.getItem(SELECTED_PAGE_KEY) || -1);

  function loadJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value || {}));
  }

  function loadFileMap() { return loadJson(FILE_NUP_KEY); }
  function saveFileMap(map) { saveJson(FILE_NUP_KEY, map); }
  function loadPageMap() { return loadJson(PAGE_NUP_KEY); }
  function savePageMap(map) { saveJson(PAGE_NUP_KEY, map); }

  function setSelectedPageOrdinal(value) {
    selectedPageOrdinal = Number.isInteger(value) && value >= 0 ? value : -1;
    if (selectedPageOrdinal >= 0) localStorage.setItem(SELECTED_PAGE_KEY, String(selectedPageOrdinal));
    else localStorage.removeItem(SELECTED_PAGE_KEY);
    renderSelectedPageUi();
    markSelectedThumb();
  }

  function isBreakMode() {
    const activeBreak = document.querySelector('.mode-btn.break-active,[data-mode="break"].active,[data-upload-mode="break"].active');
    if (activeBreak) return true;

    const buttons = [...document.querySelectorAll('.mode-btn,button,[role="button"]')];
    return buttons.some((el) => {
      const text = (el.textContent || '').replace(/\s+/g, '');
      const active = el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true';
      return active && (text.includes('비연속') || text.toLowerCase().includes('break'));
    });
  }

  function getGlobalNup() {
    const active = document.querySelector('.nup-btn.active,[data-nup].active');
    const text = active ? (active.textContent || active.dataset.nup || '') : '';
    const fromText = Number((text.match(/\d+/) || [])[0]);
    if (NUP_VALUES.includes(fromText)) return fromText;

    const select = document.querySelector('select#nupDefault,select[name*="nup"],select[id*="nup"]');
    const fromSelect = Number(select && select.value);
    if (NUP_VALUES.includes(fromSelect)) return fromSelect;

    return 0;
  }

  function getFileCountFromDom() {
    let maxIndex = -1;
    document.querySelectorAll('[data-file-index],[data-file-idx],[data-file]').forEach((el) => {
      const raw = el.dataset.fileIndex || el.dataset.fileIdx || el.dataset.file;
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 0) maxIndex = Math.max(maxIndex, n);
    });
    if (maxIndex >= 0) return maxIndex + 1;

    const labels = new Set();
    document.querySelectorAll('.thumb-file-sep-label,.file-divider,.file-divider.break').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (t) labels.add(t);
    });
    if (labels.size > 0) return labels.size;

    const fileInput = document.getElementById('fileInput');
    if (fileInput && fileInput.files && fileInput.files.length) return fileInput.files.length;

    return 0;
  }

  function isNormalPage(page) {
    return !page.page_type || page.page_type === 'normal';
  }

  function normalizeFileIndex(page) {
    const fileIndex = Number(page.file_index ?? page.fileIndex);
    return Number.isInteger(fileIndex) && fileIndex >= 0 ? fileIndex : null;
  }

  function effectiveNupForFile(fileIndex, map) {
    const perFile = Number(map[fileIndex]);
    if (NUP_VALUES.includes(perFile)) return perFile;
    return 0;
  }

  function patchSettings(settings) {
    if (!settings || !Array.isArray(settings.pages)) return settings;
    const fileMap = loadFileMap();
    const pageMap = loadPageMap();
    const breakMode = isBreakMode();
    const seenFiles = new Set();
    let normalOrdinal = -1;

    for (const page of settings.pages) {
      if (!page || !isNormalPage(page)) continue;
      normalOrdinal += 1;
      const fileIndex = normalizeFileIndex(page);
      if (fileIndex === null) continue;

      const pageNup = Number(pageMap[normalOrdinal]);
      const fileNup = effectiveNupForFile(fileIndex, fileMap);
      const nup = NUP_VALUES.includes(pageNup) ? pageNup : fileNup;

      if (NUP_VALUES.includes(nup)) {
        page.nup_override = nup;
        page.nup_disabled = false;
      } else if (!breakMode) {
        page.group_break = false;
      }

      if (NUP_VALUES.includes(pageNup)) {
        // A selected page override always starts a new output slide/group.
        // If the previous group has empty slots, PyMuPDF output naturally leaves them blank.
        page.group_break = true;
      } else if (breakMode && !seenFiles.has(fileIndex)) {
        page.group_break = true;
        seenFiles.add(fileIndex);
      } else if (!breakMode && !NUP_VALUES.includes(fileNup)) {
        page.group_break = false;
      }
    }
    return settings;
  }

  function patchKnownPageArrays() {
    const fileMap = loadFileMap();
    const pageMap = loadPageMap();
    const breakMode = isBreakMode();

    function patchArray(arr) {
      if (!Array.isArray(arr)) return false;
      let changed = false;
      const seenFiles = new Set();
      let normalOrdinal = -1;
      for (const page of arr) {
        if (!page || typeof page !== 'object' || !isNormalPage(page)) continue;
        normalOrdinal += 1;
        const fileIndex = normalizeFileIndex(page);
        if (fileIndex === null) continue;
        const pageNup = Number(pageMap[normalOrdinal]);
        const fileNup = effectiveNupForFile(fileIndex, fileMap);
        const nup = NUP_VALUES.includes(pageNup) ? pageNup : fileNup;

        if (NUP_VALUES.includes(nup)) {
          page.nup_override = nup;
          page.nupOverride = nup;
          page.nup_disabled = false;
          page.nupDisabled = false;
          changed = true;
        }

        if (NUP_VALUES.includes(pageNup)) {
          page.group_break = true;
          page.groupBreak = true;
          changed = true;
        } else if (breakMode && !seenFiles.has(fileIndex)) {
          page.group_break = true;
          page.groupBreak = true;
          seenFiles.add(fileIndex);
          changed = true;
        } else if (!breakMode) {
          page.group_break = false;
          page.groupBreak = false;
          changed = true;
        }
      }
      return changed;
    }

    ['pages', 'allPages', 'pageItems', 'pdfPages', 'slides', 'orderedPages'].forEach((name) => {
      try { patchArray(window[name]); } catch (_) {}
    });
    ['state', 'appState', 'pdfState'].forEach((name) => {
      try {
        const obj = window[name];
        if (!obj || typeof obj !== 'object') return;
        Object.keys(obj).forEach((key) => patchArray(obj[key]));
      } catch (_) {}
    });
  }

  function clickPreviewButton() {
    const candidates = [...document.querySelectorAll('button,.btn,.btn-sm')];
    const btn = candidates.find((el) => {
      const text = (el.textContent || '').replace(/\s+/g, '');
      return !el.disabled && (
        text.includes('미리보기생성') ||
        text.includes('미리보기갱신') ||
        text.includes('미리보기') && text.includes('생성')
      );
    });
    if (btn) { btn.click(); return true; }
    return false;
  }

  function callPreviewFunctions() {
    let called = false;
    ['renderPreview', 'generatePreview', 'updatePreview', 'refreshPreview', 'renderOutputPreview', 'renderThumbnails', 'renderThumbs', 'saveState'].forEach((name) => {
      try {
        if (typeof window[name] === 'function') { window[name](); called = true; }
      } catch (_) {}
    });
    return called;
  }

  function schedulePreview(reason) {
    clearTimeout(autoPreviewTimer);
    autoPreviewTimer = setTimeout(() => {
      patchKnownPageArrays();
      const called = callPreviewFunctions();
      if (!called) clickPreviewButton();
      renderFileNupRows();
      renderSelectedPageUi();
      markSelectedThumb();
    }, reason === 'file-change' ? 900 : 250);
  }

  function wrapApiProcessPdf() {
    if (apiWrapped || typeof window.apiProcessPdf !== 'function') return;
    const original = window.apiProcessPdf;
    window.apiProcessPdf = function patchedApiProcessPdf(files, settings) {
      return original.call(this, files, patchSettings(settings));
    };
    apiWrapped = true;
  }

  function wrapFetch() {
    if (fetchWrapped) return;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function patchedFetch(input, init) {
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes('/api/pdf/process') && init && init.body instanceof FormData) {
          const raw = init.body.get('settings');
          if (raw) {
            const settings = patchSettings(JSON.parse(raw));
            init.body.set('settings', JSON.stringify(settings));
          }
        }
      } catch (e) {
        console.warn('N-UP 설정 적용 실패', e);
      }
      return originalFetch(input, init);
    };
    fetchWrapped = true;
  }

  function renderFileNupRows() {
    const list = document.getElementById('fileNupOverrideList');
    if (!list) return;
    const count = getFileCountFromDom();
    const map = loadFileMap();
    const breakMode = isBreakMode();

    const modeText = document.getElementById('fileNupModeText');
    if (modeText) {
      modeText.textContent = breakMode
        ? '비연속 모드: 파일마다 선택한 N-UP으로 새 묶음이 시작됩니다.'
        : '연속 모드: 다음 파일 페이지가 앞 파일 뒤로 이어집니다. 파일별 값을 비우면 전체 기본값으로 이어집니다.';
    }

    if (!count) {
      list.innerHTML = '<div style="font-size:11px;color:#64748b;line-height:1.45;">PDF 파일을 업로드하면 파일별 N-UP 선택칸이 표시됩니다.</div>';
      return;
    }

    const rows = [];
    for (let i = 0; i < count; i += 1) {
      const current = Number(map[i] || 0);
      rows.push(`
        <div style="display:grid;grid-template-columns:72px 1fr;gap:6px;align-items:center;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:800;color:#374151;">파일 ${i + 1}</div>
          <select class="file-nup-select" data-file-index="${i}" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">
            <option value="">전체 기본값 사용${breakMode ? '' : ' / 연속 배치'}</option>
            ${NUP_VALUES.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}장 배치</option>`).join('')}
          </select>
        </div>
      `);
    }
    list.innerHTML = rows.join('');

    list.querySelectorAll('.file-nup-select').forEach((sel) => {
      sel.onchange = () => {
        const next = loadFileMap();
        const idx = String(sel.dataset.fileIndex);
        const value = Number(sel.value);
        if (NUP_VALUES.includes(value)) next[idx] = value;
        else delete next[idx];
        saveFileMap(next);
        schedulePreview('nup-change');
      };
    });
  }

  function getPageThumbs() {
    const raw = [...document.querySelectorAll('.thumb-item,.page-preview')];
    return raw.filter((el) => !(el.textContent || '').includes('간지') && !el.querySelector('.divider-thumb'));
  }

  function markSelectedThumb() {
    getPageThumbs().forEach((el, idx) => {
      if (idx === selectedPageOrdinal) {
        el.style.outline = '3px solid #7c3aed';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '8px';
      } else if (el.style.outline && el.style.outline.includes('7c3aed')) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    });
  }

  function renderSelectedPageUi() {
    const panel = document.getElementById('selectedPageNupPanel');
    if (!panel) return;
    const pageMap = loadPageMap();
    const current = Number(pageMap[selectedPageOrdinal] || 0);
    const label = document.getElementById('selectedPageLabel');
    const select = document.getElementById('selectedPageNupSelect');
    if (label) {
      label.textContent = selectedPageOrdinal >= 0
        ? `선택 페이지: ${selectedPageOrdinal + 1}번째 페이지`
        : '썸네일 또는 오른쪽 미리보기 페이지를 클릭하세요.';
    }
    if (select) {
      select.disabled = selectedPageOrdinal < 0;
      select.value = NUP_VALUES.includes(current) ? String(current) : '';
    }
  }

  function installUi() {
    if (document.getElementById('fileNupOverridePanel')) {
      renderFileNupRows();
      renderSelectedPageUi();
      return;
    }

    const nupGrid = document.querySelector('.nup-grid');
    if (!nupGrid) return;

    const panel = document.createElement('div');
    panel.id = 'fileNupOverridePanel';
    panel.className = 'field';
    panel.style.cssText = 'margin-top:10px;padding:10px;border:1.5px dashed #c4b5fd;border-radius:10px;background:#faf5ff;';
    panel.innerHTML = `
      <label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:6px;display:block;">파일별 N-UP 배치</label>
      <div id="fileNupModeText" style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:8px;"></div>
      <div id="fileNupOverrideList"></div>
      <div id="selectedPageNupPanel" style="margin-top:10px;padding-top:8px;border-top:1px dashed #c4b5fd;">
        <label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:5px;display:block;">선택 페이지 배치 변경</label>
        <div id="selectedPageLabel" style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:6px;">썸네일 또는 오른쪽 미리보기 페이지를 클릭하세요.</div>
        <select id="selectedPageNupSelect" disabled style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">
          <option value="">파일/전체 기본값 사용</option>
          ${NUP_VALUES.map((v) => `<option value="${v}">${v}장 배치로 새 묶음 시작</option>`).join('')}
        </select>
        <div style="font-size:10px;color:#6b7280;line-height:1.45;margin-top:6px;">선택 페이지부터 새 배치 묶음이 시작됩니다. 앞 묶음에 남는 칸은 자동으로 빈 칸 처리됩니다.</div>
      </div>
      <button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:8px;">지금 미리보기 갱신</button>
    `;
    nupGrid.insertAdjacentElement('afterend', panel);
    document.getElementById('fileNupRefreshBtn').onclick = () => schedulePreview('manual');
    document.getElementById('selectedPageNupSelect').onchange = (event) => {
      if (selectedPageOrdinal < 0) return;
      const next = loadPageMap();
      const value = Number(event.target.value);
      if (NUP_VALUES.includes(value)) next[selectedPageOrdinal] = value;
      else delete next[selectedPageOrdinal];
      savePageMap(next);
      schedulePreview('page-nup-change');
    };
    renderFileNupRows();
    renderSelectedPageUi();
  }

  function installAutoPreviewListeners() {
    if (window.__pdfAutoPreviewListenersInstalled) return;
    window.__pdfAutoPreviewListenersInstalled = true;

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.id === 'fileInput' || target.matches('input[type="file"]')) {
        setTimeout(() => { renderFileNupRows(); schedulePreview('file-change'); }, 500);
      }
      if (target.classList && target.classList.contains('file-nup-select')) return;
      if (target.id === 'selectedPageNupSelect') return;
      if (target.matches && (target.matches('select') || target.matches('input[type="number"]') || target.matches('input[type="checkbox"]'))) {
        schedulePreview('option-change');
      }
    }, true);

    document.addEventListener('click', (event) => {
      const pageEl = event.target && event.target.closest ? event.target.closest('.thumb-item,.page-preview') : null;
      if (pageEl && !pageEl.querySelector('.divider-thumb')) {
        const thumbs = getPageThumbs();
        const idx = thumbs.indexOf(pageEl);
        if (idx >= 0) setSelectedPageOrdinal(idx);
      }

      const btn = event.target && event.target.closest ? event.target.closest('button,.mode-btn,.nup-btn,.orient-btn') : null;
      if (!btn) return;
      const text = (btn.textContent || '').replace(/\s+/g, '');
      if (btn.classList.contains('nup-btn') || btn.classList.contains('mode-btn') || text.includes('연속') || text.includes('비연속') || text.includes('장')) {
        setTimeout(() => { renderFileNupRows(); schedulePreview('button-change'); }, 120);
      }
    }, true);
  }

  function watchPageChanges() {
    const count = getFileCountFromDom();
    const fileMap = JSON.stringify(loadFileMap());
    const pageMap = JSON.stringify(loadPageMap());
    const mode = isBreakMode() ? 'break' : 'continuous';
    const globalNup = getGlobalNup();
    const thumbCount = getPageThumbs().length;
    const sig = `${count}|${thumbCount}|${mode}|${globalNup}|${fileMap}|${pageMap}|${selectedPageOrdinal}`;
    if (sig !== lastPageSignature) {
      lastPageSignature = sig;
      renderFileNupRows();
      renderSelectedPageUi();
      markSelectedThumb();
      if (count > 0 || thumbCount > 0) schedulePreview('page-change');
    }
  }

  function boot() {
    wrapFetch();
    wrapApiProcessPdf();
    installUi();
    installAutoPreviewListeners();
    watchPageChanges();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1200);
})();
