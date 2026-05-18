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

  const STORAGE_KEY = 'programToolPdfFileNupOverridesV1';
  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  let apiWrapped = false;
  let fetchWrapped = false;
  let autoPreviewTimer = null;
  let lastPageSignature = '';

  function loadMap() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveMap(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
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
    const map = loadMap();
    const breakMode = isBreakMode();
    const seen = new Set();

    for (const page of settings.pages) {
      if (!page || !isNormalPage(page)) continue;
      const fileIndex = normalizeFileIndex(page);
      if (fileIndex === null) continue;

      const nup = effectiveNupForFile(fileIndex, map);
      if (NUP_VALUES.includes(nup)) {
        page.nup_override = nup;
        page.nup_disabled = false;
      } else if (!breakMode) {
        // In continuous mode, do not force per-file grouping when no explicit per-file N-UP exists.
        if (page.group_break) page.group_break = false;
      }

      if (breakMode && !seen.has(fileIndex)) {
        // Non-continuous mode: every file starts a fresh N-UP group, so file 1 can be 2-up and file 2 can be 6-up.
        page.group_break = true;
        seen.add(fileIndex);
      } else if (!breakMode && seen.size > 0 && !NUP_VALUES.includes(nup)) {
        // Continuous mode: keep pages flowing from previous file unless N-UP itself changes explicitly.
        page.group_break = false;
      }
    }
    return settings;
  }

  function patchKnownPageArrays() {
    const map = loadMap();
    const breakMode = isBreakMode();

    function patchArray(arr) {
      if (!Array.isArray(arr)) return false;
      let changed = false;
      const seen = new Set();
      for (const page of arr) {
        if (!page || typeof page !== 'object' || !isNormalPage(page)) continue;
        const fileIndex = normalizeFileIndex(page);
        if (fileIndex === null) continue;
        const nup = effectiveNupForFile(fileIndex, map);

        if (NUP_VALUES.includes(nup)) {
          page.nup_override = nup;
          page.nupOverride = nup;
          page.nup_disabled = false;
          page.nupDisabled = false;
          changed = true;
        }

        if (breakMode && !seen.has(fileIndex)) {
          page.group_break = true;
          page.groupBreak = true;
          seen.add(fileIndex);
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
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function callPreviewFunctions() {
    let called = false;
    ['renderPreview', 'generatePreview', 'updatePreview', 'refreshPreview', 'renderOutputPreview', 'renderThumbnails', 'renderThumbs', 'saveState'].forEach((name) => {
      try {
        if (typeof window[name] === 'function') {
          window[name]();
          called = true;
        }
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
        console.warn('파일별 N-UP 설정 적용 실패', e);
      }
      return originalFetch(input, init);
    };
    fetchWrapped = true;
  }

  function renderFileNupRows() {
    const list = document.getElementById('fileNupOverrideList');
    if (!list) return;
    const count = getFileCountFromDom();
    const map = loadMap();
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
        const next = loadMap();
        const idx = String(sel.dataset.fileIndex);
        const value = Number(sel.value);
        if (NUP_VALUES.includes(value)) next[idx] = value;
        else delete next[idx];
        saveMap(next);
        schedulePreview('nup-change');
      };
    });
  }

  function installUi() {
    if (document.getElementById('fileNupOverridePanel')) {
      renderFileNupRows();
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
      <button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:6px;">지금 미리보기 갱신</button>
    `;
    nupGrid.insertAdjacentElement('afterend', panel);
    document.getElementById('fileNupRefreshBtn').onclick = () => schedulePreview('manual');
    renderFileNupRows();
  }

  function installAutoPreviewListeners() {
    if (window.__pdfAutoPreviewListenersInstalled) return;
    window.__pdfAutoPreviewListenersInstalled = true;

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.id === 'fileInput' || target.matches('input[type="file"]')) {
        setTimeout(() => {
          renderFileNupRows();
          schedulePreview('file-change');
        }, 500);
      }
      if (target.classList && target.classList.contains('file-nup-select')) return;
      if (target.matches && (target.matches('select') || target.matches('input[type="number"]') || target.matches('input[type="checkbox"]'))) {
        schedulePreview('option-change');
      }
    }, true);

    document.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button,.mode-btn,.nup-btn,.orient-btn') : null;
      if (!btn) return;
      const text = (btn.textContent || '').replace(/\s+/g, '');
      if (btn.classList.contains('nup-btn') || btn.classList.contains('mode-btn') || text.includes('연속') || text.includes('비연속') || text.includes('장')) {
        setTimeout(() => {
          renderFileNupRows();
          schedulePreview('button-change');
        }, 120);
      }
    }, true);
  }

  function watchPageChanges() {
    const count = getFileCountFromDom();
    const map = JSON.stringify(loadMap());
    const mode = isBreakMode() ? 'break' : 'continuous';
    const globalNup = getGlobalNup();
    const sig = `${count}|${mode}|${globalNup}|${map}`;
    if (sig !== lastPageSignature) {
      lastPageSignature = sig;
      renderFileNupRows();
      if (count > 0) schedulePreview('page-change');
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
