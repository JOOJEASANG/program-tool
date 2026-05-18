// PDF editor runtime helper.
// Keeps service workers disabled and adds safe client-side improvements without intercepting pages.
(function () {
  if (window.__pdfEditorHelperV3) return;
  window.__pdfEditorHelperV3 = true;

  const FILE_NUP_KEY = 'programToolPdfFileNupOverridesV1';
  const PAGE_NUP_KEY = 'programToolPdfPageNupOverridesV1';
  const SELECTED_PAGE_KEY = 'programToolPdfSelectedPageOrdinalV1';
  const NUP_VALUES = [1, 2, 4, 6, 8, 9];
  let apiWrapped = false;
  let fetchWrapped = false;
  let renderWrapped = false;
  let previewTimer = null;
  let selectedPageOrdinal = Number(localStorage.getItem(SELECTED_PAGE_KEY) || -1);

  function $(id) { return document.getElementById(id); }
  function loadJson(key) { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (_) { return {}; } }
  function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value || {})); }
  function loadFileMap() { return loadJson(FILE_NUP_KEY); }
  function saveFileMap(map) { saveJson(FILE_NUP_KEY, map); }
  function loadPageMap() { return loadJson(PAGE_NUP_KEY); }
  function savePageMap(map) { saveJson(PAGE_NUP_KEY, map); }

  function isNormalPage(page) { return !page.page_type && !page.pageType || page.page_type === 'normal' || page.pageType === 'pdf'; }
  function fileIndexOf(page) {
    const n = Number(page && (page.file_index ?? page.fileIndex));
    return Number.isInteger(n) && n >= 0 ? n : null;
  }
  function isBreakMode() {
    const activeBreak = document.querySelector('.mode-btn.break-active,[data-mode="break"].active');
    if (activeBreak) return true;
    return [...document.querySelectorAll('.mode-btn,button')].some((el) => {
      const t = (el.textContent || '').replace(/\s+/g, '');
      return (el.classList.contains('active') || el.getAttribute('aria-pressed') === 'true') && t.includes('비연속');
    });
  }
  function getFileCountFromDom() {
    let max = -1;
    document.querySelectorAll('[data-file-index],[data-file-idx],[data-file]').forEach((el) => {
      const n = Number(el.dataset.fileIndex || el.dataset.fileIdx || el.dataset.file);
      if (Number.isInteger(n)) max = Math.max(max, n);
    });
    if (max >= 0) return max + 1;
    const labels = new Set();
    document.querySelectorAll('.thumb-file-sep-label,.file-divider,.file-divider.break').forEach((el) => {
      const t = (el.textContent || '').trim();
      if (t) labels.add(t);
    });
    if (labels.size) return labels.size;
    return document.querySelectorAll('.thumb-file-sep').length || 0;
  }

  function nupForPage(fileIndex, ordinal) {
    const pageMap = loadPageMap();
    const fileMap = loadFileMap();
    const pageNup = Number(pageMap[ordinal]);
    if (NUP_VALUES.includes(pageNup)) return { nup: pageNup, explicitPage: true };
    const fileNup = Number(fileMap[fileIndex]);
    if (NUP_VALUES.includes(fileNup)) return { nup: fileNup, explicitPage: false };
    return { nup: null, explicitPage: false };
  }

  function patchSettings(settings) {
    if (!settings || !Array.isArray(settings.pages)) return settings;
    const breakMode = isBreakMode();
    const seenFiles = new Set();
    let ordinal = -1;
    for (const page of settings.pages) {
      if (!page || !isNormalPage(page)) continue;
      ordinal += 1;
      const fi = fileIndexOf(page);
      if (fi === null) continue;
      const info = nupForPage(fi, ordinal);
      if (info.nup) {
        page.nup_override = info.nup;
        page.nup_disabled = false;
      }
      if (info.explicitPage) {
        page.group_break = true;
      } else if (breakMode && !seenFiles.has(fi)) {
        page.group_break = true;
        seenFiles.add(fi);
      } else if (!breakMode) {
        page.group_break = false;
      }
    }
    return settings;
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
          if (raw) init.body.set('settings', JSON.stringify(patchSettings(JSON.parse(raw))));
        }
      } catch (e) {
        console.warn('[pdf-helper] settings patch failed', e);
      }
      return originalFetch(input, init);
    };
    fetchWrapped = true;
  }

  function getParsedPages() {
    try {
      if (Array.isArray(window.parsedPages)) return window.parsedPages;
    } catch (_) {}
    return null;
  }

  function applyPageOverridesToRuntime() {
    const pages = getParsedPages();
    if (!pages) return;
    const breakMode = isBreakMode();
    const seenFiles = new Set();
    let ordinal = -1;
    for (const page of pages) {
      if (!page || !isNormalPage(page)) continue;
      ordinal += 1;
      const fi = fileIndexOf(page);
      if (fi === null) continue;
      const info = nupForPage(fi, ordinal);
      if (info.nup) {
        page.nupOverride = info.nup;
        page.nup_override = info.nup;
        page.nupDisabled = false;
        page.nup_disabled = false;
      }
      if (info.explicitPage) {
        page.groupBreak = true;
        page.group_break = true;
      } else if (breakMode && !seenFiles.has(fi)) {
        page.groupBreak = true;
        page.group_break = true;
        seenFiles.add(fi);
      } else if (!breakMode) {
        page.groupBreak = false;
        page.group_break = false;
      }
    }
  }

  function callRealPreview() {
    applyPageOverridesToRuntime();
    const names = ['triggerPreview', 'renderPreview', 'generatePreview', 'updatePreview', 'refreshPreview'];
    for (const name of names) {
      try {
        if (typeof window[name] === 'function') {
          window[name]();
          return true;
        }
      } catch (_) {}
    }
    const btn = [...document.querySelectorAll('button,.btn')].find((el) => {
      const t = (el.textContent || '').replace(/\s+/g, '');
      return !el.disabled && t.includes('미리보기') && (t.includes('생성') || t.includes('갱신'));
    });
    if (btn) { btn.click(); return true; }
    return false;
  }

  function schedulePreview(delay = 300) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      renderPanels();
      callRealPreview();
    }, delay);
  }

  function setSelectedPage(ordinal) {
    selectedPageOrdinal = Number.isInteger(ordinal) && ordinal >= 0 ? ordinal : -1;
    if (selectedPageOrdinal >= 0) localStorage.setItem(SELECTED_PAGE_KEY, String(selectedPageOrdinal));
    else localStorage.removeItem(SELECTED_PAGE_KEY);
    markSelectedThumb();
    renderSelectedPanel();
  }

  function getThumbs() {
    return [...document.querySelectorAll('.thumb-item')].filter((el) => !el.querySelector('.divider-thumb'));
  }
  function markSelectedThumb() {
    getThumbs().forEach((el, idx) => {
      if (idx === selectedPageOrdinal) {
        el.style.outline = '3px solid #7c3aed';
        el.style.outlineOffset = '2px';
        el.style.borderRadius = '8px';
      } else if ((el.style.outline || '').includes('7c3aed')) {
        el.style.outline = '';
        el.style.outlineOffset = '';
      }
    });
  }

  function installNupUi() {
    if ($('fileNupOverridePanel')) return;
    const nupGrid = document.querySelector('.nup-grid');
    if (!nupGrid) return;
    const panel = document.createElement('div');
    panel.id = 'fileNupOverridePanel';
    panel.className = 'field';
    panel.style.cssText = 'margin-top:10px;padding:10px;border:1.5px dashed #c4b5fd;border-radius:10px;background:#faf5ff;';
    panel.innerHTML = `
      <label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:6px;display:block;">파일/페이지별 N-UP 배치</label>
      <div id="fileNupModeText" style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:8px;"></div>
      <div id="fileNupOverrideList"></div>
      <div id="selectedPageNupPanel" style="margin-top:10px;padding-top:8px;border-top:1px dashed #c4b5fd;">
        <label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:5px;display:block;">선택 페이지 배치 변경</label>
        <div id="selectedPageLabel" style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:6px;">썸네일 페이지를 클릭하세요.</div>
        <select id="selectedPageNupSelect" disabled style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">
          <option value="">파일/전체 기본값 사용</option>
          ${NUP_VALUES.map((v) => `<option value="${v}">${v}장 배치로 새 묶음 시작</option>`).join('')}
        </select>
        <div style="font-size:10px;color:#6b7280;line-height:1.45;margin-top:6px;">선택 페이지부터 새 묶음이 시작됩니다. 앞 묶음의 남는 칸은 빈 칸으로 출력됩니다.</div>
      </div>
      <button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:8px;">지금 미리보기 갱신</button>
    `;
    nupGrid.insertAdjacentElement('afterend', panel);
    $('fileNupRefreshBtn').onclick = () => schedulePreview(50);
    $('selectedPageNupSelect').onchange = (event) => {
      if (selectedPageOrdinal < 0) return;
      const map = loadPageMap();
      const value = Number(event.target.value);
      if (NUP_VALUES.includes(value)) map[selectedPageOrdinal] = value;
      else delete map[selectedPageOrdinal];
      savePageMap(map);
      schedulePreview(80);
    };
  }

  function renderPanels() {
    installNupUi();
    const fileList = $('fileNupOverrideList');
    if (!fileList) return;
    const count = getFileCountFromDom();
    const fileMap = loadFileMap();
    const breakMode = isBreakMode();
    const mode = $('fileNupModeText');
    if (mode) mode.textContent = breakMode ? '비연속 모드: 파일별로 새 묶음이 시작됩니다.' : '연속 모드: 파일이 이어지고, 선택 페이지에서만 새 묶음이 시작됩니다.';
    if (!count) {
      fileList.innerHTML = '<div style="font-size:11px;color:#64748b;line-height:1.45;">PDF 파일을 업로드하면 파일별 N-UP 선택칸이 표시됩니다.</div>';
    } else {
      fileList.innerHTML = Array.from({ length: count }, (_, i) => {
        const current = Number(fileMap[i] || 0);
        return `<div style="display:grid;grid-template-columns:72px 1fr;gap:6px;align-items:center;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:800;color:#374151;">파일 ${i + 1}</div>
          <select class="file-nup-select" data-file-index="${i}" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">
            <option value="">전체 기본값 사용${breakMode ? '' : ' / 연속 배치'}</option>
            ${NUP_VALUES.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${v}장 배치</option>`).join('')}
          </select>
        </div>`;
      }).join('');
      fileList.querySelectorAll('.file-nup-select').forEach((sel) => {
        sel.onchange = () => {
          const map = loadFileMap();
          const idx = String(sel.dataset.fileIndex);
          const value = Number(sel.value);
          if (NUP_VALUES.includes(value)) map[idx] = value;
          else delete map[idx];
          saveFileMap(map);
          schedulePreview(80);
        };
      });
    }
    renderSelectedPanel();
    markSelectedThumb();
  }

  function renderSelectedPanel() {
    const label = $('selectedPageLabel');
    const sel = $('selectedPageNupSelect');
    if (!label || !sel) return;
    const pageMap = loadPageMap();
    const current = Number(pageMap[selectedPageOrdinal] || 0);
    label.textContent = selectedPageOrdinal >= 0 ? `선택 페이지: ${selectedPageOrdinal + 1}번째 페이지` : '썸네일 페이지를 클릭하세요.';
    sel.disabled = selectedPageOrdinal < 0;
    sel.value = NUP_VALUES.includes(current) ? String(current) : '';
  }

  function installDividerDefaults() {
    const modal = $('dividerModal');
    if (!modal || modal.dataset.helperPatched) return;
    modal.dataset.helperPatched = '1';
    const style = document.createElement('style');
    style.textContent = `
      #dividerBg, label[for="dividerBg"] { display:none !important; }
      #dividerNoBg, label:has(#dividerNoBg) { display:none !important; }
      .helper-mini-btn { border:1px solid #e5e7eb;background:#fff;border-radius:5px;font-size:10px;font-weight:800;padding:2px 5px;cursor:pointer; }
    `;
    document.head.appendChild(style);

    const setDefaults = () => {
      if ($('dividerNoBg')) $('dividerNoBg').checked = true;
      if ($('dividerBg')) $('dividerBg').value = '#ffffff';
      if ($('dividerFg')) $('dividerFg').value = '#111827';
      ['dividerTitleY','dividerSubtitleY','dividerNoteY'].forEach((id, idx) => {
        if (!$(id)) {
          const input = document.createElement('input');
          input.type = 'range'; input.min = '5'; input.max = '95'; input.step = '1'; input.id = id;
          input.value = idx === 0 ? '45' : idx === 1 ? '55' : '88';
          input.style.width = '100%';
          const wrap = document.createElement('div');
          wrap.className = 'field helper-divider-pos';
          wrap.innerHTML = `<label style="font-size:11px;font-weight:800;color:#374151;">${idx === 0 ? '제목' : idx === 1 ? '부제목' : '하단'} 위치</label>`;
          wrap.appendChild(input);
          const anchor = idx === 0 ? $('dividerTitle') : idx === 1 ? $('dividerSubtitle') : $('dividerNote');
          anchor && anchor.closest('.field') && anchor.closest('.field').insertAdjacentElement('afterend', wrap);
          input.addEventListener('input', () => {
            if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview();
          });
        }
      });
    };
    setDefaults();
    modal.addEventListener('click', () => setTimeout(setDefaults, 0), true);
  }

  function wrapDividerCanvas() {
    if (window.__dividerCanvasWrapped || typeof window.renderDividerCanvas !== 'function') return;
    const original = window.renderDividerCanvas;
    window.renderDividerCanvas = function helperRenderDividerCanvas(content, w, h) {
      const patched = Object.assign({}, content || {});
      patched.noBg = true;
      patched.bg = '#ffffff';
      patched.fg = '#111827';
      const canvas = original.call(this, patched, w, h);
      try {
        const titleY = Number($('dividerTitleY') && $('dividerTitleY').value) || Number(patched.titleY) || 45;
        const subtitleY = Number($('dividerSubtitleY') && $('dividerSubtitleY').value) || Number(patched.subtitleY) || 55;
        const noteY = Number($('dividerNoteY') && $('dividerNoteY').value) || Number(patched.noteY) || 88;
        if (patched.titleY || patched.subtitleY || patched.noteY || $('dividerTitleY')) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (patched.title) {
            const fs = Math.min(canvas.width * 0.1, canvas.height * 0.1, 90);
            ctx.font = `bold ${fs}px "Pretendard", "Malgun Gothic", serif`;
            ctx.fillText(patched.title, canvas.width / 2, canvas.height * titleY / 100);
          }
          if (patched.subtitle) {
            const fs2 = Math.min(canvas.width * 0.055, canvas.height * 0.055, 50);
            ctx.globalAlpha = 0.82;
            ctx.font = `${fs2}px "Pretendard", "Malgun Gothic", sans-serif`;
            ctx.fillText(patched.subtitle, canvas.width / 2, canvas.height * subtitleY / 100);
            ctx.globalAlpha = 1;
          }
          if (patched.note) {
            const fs3 = Math.min(canvas.width * 0.035, canvas.height * 0.035, 30);
            ctx.globalAlpha = 0.62;
            ctx.font = `${fs3}px "Pretendard", "Malgun Gothic", sans-serif`;
            ctx.fillText(patched.note, canvas.width / 2, canvas.height * noteY / 100);
            ctx.globalAlpha = 1;
          }
        }
      } catch (_) {}
      return canvas;
    };
    window.__dividerCanvasWrapped = true;
  }

  function installPageClickAndAutoPreview() {
    if (window.__pdfHelperEventsInstalled) return;
    window.__pdfHelperEventsInstalled = true;
    document.addEventListener('click', (event) => {
      const thumb = event.target && event.target.closest ? event.target.closest('.thumb-item') : null;
      if (thumb && !thumb.querySelector('.divider-thumb')) {
        const idx = getThumbs().indexOf(thumb);
        if (idx >= 0) setSelectedPage(idx);
      }
      const pagePreview = event.target && event.target.closest ? event.target.closest('.page-preview') : null;
      if (pagePreview) {
        const previews = [...document.querySelectorAll('.page-preview')];
        const idx = previews.indexOf(pagePreview);
        if (idx >= 0) setSelectedPage(idx);
      }
      const btn = event.target && event.target.closest ? event.target.closest('button,.nup-btn,.mode-btn,.orient-btn') : null;
      if (btn) {
        const t = (btn.textContent || '').replace(/\s+/g, '');
        if (btn.classList.contains('nup-btn') || btn.classList.contains('mode-btn') || t.includes('장') || t.includes('연속') || t.includes('비연속')) {
          schedulePreview(120);
        }
      }
    }, true);
    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="file"]')) schedulePreview(900);
      else if (!target.classList || !target.classList.contains('file-nup-select')) schedulePreview(250);
    }, true);
  }

  function wrapRenderThumbsForEditButtons() {
    if (renderWrapped || typeof window.renderThumbs !== 'function') return;
    const original = window.renderThumbs;
    window.renderThumbs = function helperRenderThumbs() {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        document.querySelectorAll('.thumb-item').forEach((item) => {
          const isDivider = !!item.querySelector('.divider-thumb');
          const isBlank = (item.textContent || '').includes('빈 페이지');
          if (!isDivider && !isBlank) return;
          if (item.querySelector('.helper-edit-page')) return;
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'helper-mini-btn helper-edit-page'; btn.textContent = isDivider ? '수정' : '빈페이지';
          btn.style.cssText = 'margin-top:3px;width:58px;';
          btn.onclick = (e) => {
            e.stopPropagation();
            if (isDivider) item.dispatchEvent(new CustomEvent('dblclick', { bubbles: true }));
          };
          item.appendChild(btn);
        });
        renderPanels();
      }, 0);
      return result;
    };
    renderWrapped = true;
  }

  function boot() {
    wrapFetch(); wrapApiProcessPdf(); wrapDividerCanvas(); wrapRenderThumbsForEditButtons(); installNupUi(); renderPanels(); installDividerDefaults(); installPageClickAndAutoPreview();
  }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
