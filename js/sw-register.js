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

  function patchSettings(settings) {
    if (!settings || !Array.isArray(settings.pages)) return settings;
    const map = loadMap();
    const seen = new Set();

    for (const page of settings.pages) {
      if (!page || !isNormalPage(page)) continue;
      const fileIndex = Number(page.file_index ?? page.fileIndex);
      if (!Number.isInteger(fileIndex) || fileIndex < 0) continue;
      const nup = Number(map[fileIndex]);
      if (!NUP_VALUES.includes(nup)) continue;

      page.nup_override = nup;
      page.nup_disabled = false;

      if (!seen.has(fileIndex)) {
        page.group_break = true;
        seen.add(fileIndex);
      }
    }
    return settings;
  }

  function patchKnownPageArrays() {
    const map = loadMap();
    const keys = Object.keys(map);
    if (!keys.length) return;

    function patchArray(arr) {
      if (!Array.isArray(arr)) return false;
      let changed = false;
      const seen = new Set();
      for (const page of arr) {
        if (!page || typeof page !== 'object' || !isNormalPage(page)) continue;
        const fileIndex = Number(page.file_index ?? page.fileIndex);
        const nup = Number(map[fileIndex]);
        if (!Number.isInteger(fileIndex) || !NUP_VALUES.includes(nup)) continue;
        page.nup_override = nup;
        page.nupOverride = nup;
        page.nup_disabled = false;
        page.nupDisabled = false;
        if (!seen.has(fileIndex)) {
          page.group_break = true;
          page.groupBreak = true;
          seen.add(fileIndex);
        }
        changed = true;
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

  function refreshPreview() {
    patchKnownPageArrays();
    ['renderPreview', 'updatePreview', 'refreshPreview', 'renderThumbnails', 'renderThumbs', 'saveState'].forEach((name) => {
      try {
        if (typeof window[name] === 'function') window[name]();
      } catch (_) {}
    });
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
            <option value="">전체 기본값 사용</option>
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
        refreshPreview();
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
      <div style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:8px;">비연속 추가로 파일을 나눈 경우, 파일마다 2장/6장 등 서로 다른 N-UP을 적용합니다.</div>
      <div id="fileNupOverrideList"></div>
      <button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:6px;">파일별 N-UP 미리보기 갱신</button>
    `;
    nupGrid.insertAdjacentElement('afterend', panel);
    document.getElementById('fileNupRefreshBtn').onclick = refreshPreview;
    renderFileNupRows();
  }

  function boot() {
    wrapFetch();
    wrapApiProcessPdf();
    installUi();
  }

  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1200);
})();
