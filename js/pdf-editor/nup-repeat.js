// PDF editor N-UP same-page repeat mode.
// Reuses the existing N-UP layout engine so every paper size/orientation stays supported.
(function () {
  'use strict';
  if (window.__pdfEditorNupRepeatV2) return;
  window.__pdfEditorNupRepeatV2 = true;
  window.__pdfEditorNupRepeatV1 = true;

  const COUNT_STORAGE_KEY = 'programToolPdfNupRepeatCountV2';
  const VALID_REPEAT_COUNTS = new Set([2, 4]);
  const MAX_API_PAGES = 2000;
  let originalGroupByNup = null;
  let originalApiProcessPdf = null;
  let originalCollectEditorState = null;
  let originalLoadEditorSession = null;
  let bootAttempts = 0;
  let repeatCount = 2;

  const byId = id => document.getElementById(id);

  function isEnabled() {
    return Boolean(byId('nupRepeatSamePage')?.checked);
  }

  function normalizeRepeatCount(value) {
    const count = Number(value);
    // Migrate an old saved three-up preference to the supported four-up layout.
    return VALID_REPEAT_COUNTS.has(count) ? count : count === 3 ? 4 : 2;
  }

  function selectedRepeatCount() {
    return repeatCount;
  }

  function repeatLayoutN(count = selectedRepeatCount()) {
    return normalizeRepeatCount(count) <= 2 ? 2 : 4;
  }

  function saveRepeatCount(value) {
    const count = normalizeRepeatCount(value);
    try { localStorage.setItem(COUNT_STORAGE_KEY, String(count)); } catch (_) {}
    return count;
  }

  function readRepeatCount() {
    try { return normalizeRepeatCount(localStorage.getItem(COUNT_STORAGE_KEY)); }
    catch (_) { return 2; }
  }

  function refreshHint() {
    const hint = byId('nupRepeatHint');
    if (!hint) return;
    const count = selectedRepeatCount();
    const layout = repeatLayoutN(count);
    hint.textContent = `${count}개 반복 · ${layout === 2 ? '2분할' : '2×2'} · 페이지번호와 머리말·꼬리말도 각 칸에 반복됩니다.`;
  }

  function refreshPreviewSummary() {
    if (!isEnabled()) return;
    const info = byId('previewInfo');
    if (!info || !info.textContent) return;
    const parts = String(info.textContent).split(' · ');
    const activePart = parts.find(part => part.trim().startsWith('활성 ')) || parts[0] || '';
    const paperPart = [...parts].reverse().find(part => /mm\s+(세로|가로)/.test(part)) || parts[parts.length - 1] || '';
    const text = `${activePart} · 반복배치 ${selectedRepeatCount()}개 · ${paperPart}`;
    if (info.textContent !== text) info.textContent = text;
  }

  function setRepeatCount(value, { schedule = true, persist = true } = {}) {
    const count = normalizeRepeatCount(value);
    repeatCount = count;
    document.querySelectorAll('[data-repeat-count]').forEach(button => {
      const active = Number(button.dataset.repeatCount) === count;
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.classList.toggle('active', active);
    });
    if (persist) saveRepeatCount(count);
    refreshHint();
    if (schedule && isEnabled() && typeof schedulePreview === 'function') schedulePreview(80);
    return count;
  }

  function setEnabled(value, { schedule = true } = {}) {
    const input = byId('nupRepeatSamePage');
    if (!input) return;
    input.checked = Boolean(value);
    document.querySelectorAll('[data-repeat-count]').forEach(button => {
      button.disabled = !input.checked;
    });
    if (input.checked) {
      const booklet = byId('bookletCheck');
      if (booklet?.checked) booklet.checked = false;
      if (typeof updateBookletPadInfo === 'function') updateBookletPadInfo();
    }
    refreshHint();
    if (schedule && typeof schedulePreview === 'function') schedulePreview(80);
  }

  function installButtonStyles() {
    if (byId('pdfRepeatCountButtonStyle')) return;
    const style = document.createElement('style');
    style.id = 'pdfRepeatCountButtonStyle';
    style.textContent = '.nup-repeat-count-btn.active,.nup-repeat-count-btn[aria-pressed="true"]{background:#dbeafe!important;border-color:#2563eb!important;color:#1d4ed8!important;box-shadow:inset 0 0 0 1px #2563eb}.nup-repeat-count-btn:disabled{opacity:.5;cursor:not-allowed!important}';
    document.head.appendChild(style);
  }

  function installUi() {
    installButtonStyles();
    if (byId('nupRepeatSamePage')) return true;
    const grid = byId('nupGrid');
    if (!grid) return false;

    const row = document.createElement('div');
    row.id = 'nupRepeatRow';
    row.className = 'checkline';
    row.style.cssText = 'margin:8px 0 2px;padding:8px 9px;border:1px solid #dbeafe;border-radius:8px;background:#f8fbff;align-items:flex-start;gap:7px;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'nupRepeatSamePage';
    input.style.marginTop = '2px';

    const copy = document.createElement('div');
    copy.style.cssText = 'display:grid;gap:5px;min-width:0;flex:1;';

    const title = document.createElement('label');
    title.htmlFor = 'nupRepeatSamePage';
    title.textContent = '반복배치';
    title.style.cssText = 'font-size:11px;color:#1f2937;font-weight:850;cursor:pointer;';

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', '반복배치 개수');
    [2, 4].forEach(count => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.repeatCount = String(count);
      button.textContent = `${count}개`;
      button.className = 'nup-repeat-count-btn';
      button.style.cssText = 'border:1px solid #bfdbfe;border-radius:6px;padding:5px 13px;font-size:10px;font-weight:850;color:#1d4ed8;background:#fff;cursor:pointer;';
      button.addEventListener('click', () => {
        setRepeatCount(count, { schedule: true, persist: true });
        if (isEnabled()) setTimeout(refreshPreviewSummary, 0);
      });
      controls.appendChild(button);
    });

    const hint = document.createElement('small');
    hint.id = 'nupRepeatHint';
    hint.style.cssText = 'font-size:9px;line-height:1.45;color:#64748b;font-weight:650;';

    copy.append(title, controls, hint);
    row.append(input, copy);
    grid.insertAdjacentElement('afterend', row);

    // Always start with repeat placement OFF on a fresh visit, regardless
    // of any legacy localStorage toggle; saved editor sessions restore explicitly.
    setRepeatCount(readRepeatCount(), { schedule: false, persist: false });
    setEnabled(false, { schedule: false });

    input.addEventListener('change', () => {
      setEnabled(input.checked, { schedule: true, persist: true });
    });

    document.querySelectorAll('.nup-btn').forEach(button => {
      button.addEventListener('click', () => {
        setTimeout(() => {
          refreshHint();
          if (isEnabled()) refreshPreviewSummary();
        }, 0);
      });
    });

    const booklet = byId('bookletCheck');
    booklet?.addEventListener('change', () => {
      if (booklet.checked && isEnabled()) setEnabled(false, { schedule: false, persist: true });
    });

    return true;
  }

  function repeatGroups(groups) {
    if (!isEnabled() || byId('bookletCheck')?.checked) return groups;
    const count = selectedRepeatCount();
    const layoutN = repeatLayoutN(count);
    const repeated = [];
    for (const group of groups || []) {
      // The canonical editor's groupByNup() already returns one repeated
      // group per source page. Never repeat that group a second time:
      // 2-up would otherwise emit two sheets of the same content, and 4-up
      // would emit four sheets before advancing to the next edited page.
      if (group?.repeated) {
        repeated.push(group);
        continue;
      }
      for (const page of group?.pages || []) {
        repeated.push({
          ...group,
          n: layoutN,
          repeated: true,
          pages: Array.from({ length: count }, () => page),
        });
      }
    }
    return repeated;
  }

  function installGroupBridge() {
    if (originalGroupByNup) return true;
    if (typeof window.groupByNup !== 'function') return false;
    originalGroupByNup = window.groupByNup;
    const wrapped = function (...args) {
      return repeatGroups(originalGroupByNup.apply(this, args));
    };
    window.groupByNup = wrapped;
    try { groupByNup = wrapped; } catch (_) {}
    return true;
  }

  function expandSettingsPages(settings) {
    const next = settings && typeof settings === 'object' ? { ...settings } : {};
    // Normal download expands at the export boundary. The compatibility API
    // bridge must not expand the same sheets again.
    if (next.repeat_cell_overlays || !isEnabled() || next.booklet) return next;

    const copies = selectedRepeatCount();
    const layoutN = repeatLayoutN(copies);
    const expanded = [];
    for (const page of Array.isArray(next.pages) ? next.pages : []) {
      if (page?.excluded) {
        expanded.push({ ...page });
        continue;
      }
      for (let index = 0; index < copies; index += 1) {
        expanded.push({
          ...page,
          nup_override: layoutN,
          nup_disabled: false,
          group_break: index === 0,
        });
      }
    }

    if (expanded.length > MAX_API_PAGES) {
      throw new Error(`반복배치 결과가 서버 처리 한도(${MAX_API_PAGES}페이지)를 초과합니다. 반복 개수 또는 원본 페이지 수를 줄여 주세요.`);
    }

    next.pages = expanded;
    next.repeat_cell_overlays = true;
    next.nup_default = layoutN;
    next.booklet = false;
    return next;
  }

  function installApiBridge() {
    if (originalApiProcessPdf) return true;
    if (typeof window.apiProcessPdf !== 'function') return false;
    originalApiProcessPdf = window.apiProcessPdf;
    const wrapped = function (files, settings, options) {
      return originalApiProcessPdf.call(this, files, expandSettingsPages(settings), options);
    };
    window.apiProcessPdf = wrapped;
    try { apiProcessPdf = wrapped; } catch (_) {}
    return true;
  }

  function installSessionBridge() {
    if (!originalCollectEditorState && typeof window.collectEditorState === 'function') {
      originalCollectEditorState = window.collectEditorState;
      const collectWrapped = function (...args) {
        const state = originalCollectEditorState.apply(this, args) || {};
        state.repeatSamePage = isEnabled();
        state.repeatSamePageCount = selectedRepeatCount();
        return state;
      };
      window.collectEditorState = collectWrapped;
      try { collectEditorState = collectWrapped; } catch (_) {}
    }

    if (!originalLoadEditorSession && typeof window.loadEditorSession === 'function') {
      originalLoadEditorSession = window.loadEditorSession;
      const loadWrapped = async function (data, ...rest) {
        let repeat = false;
        let repeatCount = readRepeatCount();
        try {
          const saved = JSON.parse(data?.state || '{}');
          repeat = Boolean(saved?.repeatSamePage);
          repeatCount = normalizeRepeatCount(saved?.repeatSamePageCount || repeatCount);
        } catch (_) {}
        const result = await originalLoadEditorSession.call(this, data, ...rest);
        if (result === false) return false;
        setRepeatCount(repeatCount, { schedule: false, persist: true });
        setEnabled(repeat, { schedule: false, persist: true });
        if (typeof schedulePreview === 'function') schedulePreview(80);
        return result;
      };
      window.loadEditorSession = loadWrapped;
      try { loadEditorSession = loadWrapped; } catch (_) {}
    }

    return Boolean(originalCollectEditorState && originalLoadEditorSession);
  }

  function installSummaryObserver() {
    if (window.__pdfEditorNupRepeatSummaryObserverV1) return;
    const info = byId('previewInfo');
    if (!info) return;
    window.__pdfEditorNupRepeatSummaryObserverV1 = new MutationObserver(() => {
      if (isEnabled()) queueMicrotask(refreshPreviewSummary);
    });
    window.__pdfEditorNupRepeatSummaryObserverV1.observe(info, { childList: true, characterData: true, subtree: true });
  }

  function boot() {
    const uiReady = installUi();
    const groupReady = installGroupBridge();
    const apiReady = installApiBridge();
    installSessionBridge();
    installSummaryObserver();

    if (uiReady && groupReady && apiReady) {
      document.documentElement.dataset.pdfNupSamePageRepeat = 'ready-v1';
      document.documentElement.dataset.pdfNupSamePageRepeatMode = 'two-four-buttons-v3';
      refreshHint();
      if (isEnabled()) {
        if (typeof schedulePreview === 'function') schedulePreview(80);
        setTimeout(refreshPreviewSummary, 120);
      }
      return;
    }

    bootAttempts += 1;
    if (bootAttempts < 40) setTimeout(boot, 100 + bootAttempts * 25);
  }

  window.PdfEditorNupRepeat = {
    enabled: isEnabled,
    setEnabled,
    count: selectedRepeatCount,
    setCount: setRepeatCount,
    layoutForCount: repeatLayoutN,
    expandSettingsPages,
    repeatGroups,
    stage: 'pdf-editor-nup-repeat-v3-two-four-buttons',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
