// PDF editor N-UP same-page repeat mode.
// Reuses the existing N-UP layout engine so every paper size/orientation stays supported.
(function () {
  'use strict';
  if (window.__pdfEditorNupRepeatV2) return;
  window.__pdfEditorNupRepeatV2 = true;
  window.__pdfEditorNupRepeatV1 = true;

  const STORAGE_KEY = 'programToolPdfNupRepeatSamePageV1';
  const COUNT_STORAGE_KEY = 'programToolPdfNupRepeatCountV2';
  const VALID_REPEAT_COUNTS = new Set([2, 3, 4]);
  const MAX_API_PAGES = 2000;
  let originalGroupByNup = null;
  let originalApiProcessPdf = null;
  let originalCollectEditorState = null;
  let originalLoadEditorSession = null;
  let bootAttempts = 0;

  const byId = id => document.getElementById(id);

  function isEnabled() {
    return Boolean(byId('nupRepeatSamePage')?.checked);
  }

  function normalizeRepeatCount(value) {
    const count = Number(value);
    return VALID_REPEAT_COUNTS.has(count) ? count : 2;
  }

  function selectedRepeatCount() {
    return normalizeRepeatCount(byId('nupRepeatCount')?.value || readRepeatCount());
  }

  function repeatLayoutN(count = selectedRepeatCount()) {
    return normalizeRepeatCount(count) <= 2 ? 2 : 4;
  }

  function savePreference(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (_) {}
  }

  function readPreference() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
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
    hint.textContent = count === 3
      ? '3개 반복: 2×2 배치의 한 칸은 비워 둡니다.'
      : `${count}개 반복: ${layout === 2 ? '2분할' : '2×2'} 배치로 같은 페이지를 채웁니다.`;
  }

  function refreshPreviewSummary() {
    if (!isEnabled()) return;
    const info = byId('previewInfo');
    if (!info || !info.textContent) return;
    const parts = String(info.textContent).split(' · ');
    const activePart = parts.find(part => part.trim().startsWith('활성 ')) || parts[0] || '';
    const paperPart = [...parts].reverse().find(part => /mm\s+(세로|가로)/.test(part)) || parts[parts.length - 1] || '';
    const text = `${activePart} · 같은 페이지 반복 ${selectedRepeatCount()}개 · ${paperPart}`;
    if (info.textContent !== text) info.textContent = text;
  }

  function setRepeatCount(value, { schedule = true, persist = true } = {}) {
    const count = normalizeRepeatCount(value);
    const select = byId('nupRepeatCount');
    if (select) select.value = String(count);
    if (persist) saveRepeatCount(count);
    refreshHint();
    if (schedule && isEnabled() && typeof schedulePreview === 'function') schedulePreview(80);
    return count;
  }

  function setEnabled(value, { schedule = true, persist = true } = {}) {
    const input = byId('nupRepeatSamePage');
    if (!input) return;
    input.checked = Boolean(value);
    const countSelect = byId('nupRepeatCount');
    if (countSelect) countSelect.disabled = !input.checked;
    if (persist) savePreference(input.checked);
    if (input.checked) {
      const booklet = byId('bookletCheck');
      if (booklet?.checked) booklet.checked = false;
      if (typeof updateBookletPadInfo === 'function') updateBookletPadInfo();
    }
    refreshHint();
    if (schedule && typeof schedulePreview === 'function') schedulePreview(80);
  }

  function installUi() {
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
    title.textContent = '같은 페이지 반복 배치';
    title.style.cssText = 'font-size:11px;color:#1f2937;font-weight:850;cursor:pointer;';

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';
    const countLabel = document.createElement('label');
    countLabel.htmlFor = 'nupRepeatCount';
    countLabel.textContent = '반복 개수';
    countLabel.style.cssText = 'font-size:9px;color:#475569;font-weight:800;';
    const countSelect = document.createElement('select');
    countSelect.id = 'nupRepeatCount';
    countSelect.style.cssText = 'border:1px solid #bfdbfe;border-radius:6px;padding:3px 22px 3px 6px;font-size:10px;font-weight:850;color:#1d4ed8;background:#fff;';
    [2, 3, 4].forEach(count => {
      const option = document.createElement('option');
      option.value = String(count);
      option.textContent = `${count}개`;
      countSelect.appendChild(option);
    });
    controls.append(countLabel, countSelect);

    const hint = document.createElement('small');
    hint.id = 'nupRepeatHint';
    hint.style.cssText = 'font-size:9px;line-height:1.45;color:#64748b;font-weight:650;';

    copy.append(title, controls, hint);
    row.append(input, copy);
    grid.insertAdjacentElement('afterend', row);

    setRepeatCount(readRepeatCount(), { schedule: false, persist: false });
    setEnabled(readPreference(), { schedule: false, persist: false });

    input.addEventListener('change', () => {
      setEnabled(input.checked, { schedule: true, persist: true });
    });

    countSelect.addEventListener('change', () => {
      setRepeatCount(countSelect.value, { schedule: true, persist: true });
      if (isEnabled()) setTimeout(refreshPreviewSummary, 0);
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
      for (const page of group?.pages || []) {
        repeated.push({
          ...group,
          n: layoutN,
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
    if (!isEnabled() || next.booklet) return next;

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
      throw new Error(`같은 페이지 반복 배치 결과가 서버 처리 한도(${MAX_API_PAGES}페이지)를 초과합니다. 반복 개수 또는 원본 페이지 수를 줄여 주세요.`);
    }

    next.pages = expanded;
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
      document.documentElement.dataset.pdfNupSamePageRepeatMode = 'max4-v2';
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
    stage: 'pdf-editor-nup-repeat-v2-max4',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
