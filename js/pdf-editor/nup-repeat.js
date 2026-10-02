// PDF editor N-UP same-page repeat mode.
// Reuses the existing N-UP layout engine so every paper size/orientation stays supported.
(function () {
  'use strict';
  if (window.__pdfEditorNupRepeatV1) return;
  window.__pdfEditorNupRepeatV1 = true;

  const STORAGE_KEY = 'programToolPdfNupRepeatSamePageV1';
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

  function selectedNup() {
    const value = Number(document.querySelector('.nup-btn.active')?.dataset?.nup || 1);
    return [1, 2, 4, 6, 8, 9].includes(value) ? value : 1;
  }

  function savePreference(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); } catch (_) {}
  }

  function readPreference() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch (_) { return false; }
  }

  function refreshHint() {
    const hint = byId('nupRepeatHint');
    if (!hint) return;
    const n = selectedNup();
    hint.textContent = n <= 1
      ? '1장 배치에서는 결과가 동일합니다.'
      : `${n}장 배치: 원본 1페이지를 한 출력면의 ${n}칸에 반복합니다.`;
  }

  function refreshPreviewSummary() {
    if (!isEnabled()) return;
    const info = byId('previewInfo');
    if (!info || !info.textContent) return;
    const parts = String(info.textContent).split(' · ');
    const activePart = parts.find(part => part.trim().startsWith('활성 ')) || parts[0] || '';
    const paperPart = [...parts].reverse().find(part => /mm\s+(세로|가로)/.test(part)) || parts[parts.length - 1] || '';
    const text = `${activePart} · 같은 페이지 반복 ${selectedNup()}장 · ${paperPart}`;
    if (info.textContent !== text) info.textContent = text;
  }

  function setEnabled(value, { schedule = true, persist = true } = {}) {
    const input = byId('nupRepeatSamePage');
    if (!input) return;
    input.checked = Boolean(value);
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

    const row = document.createElement('label');
    row.id = 'nupRepeatRow';
    row.className = 'checkline';
    row.style.cssText = 'margin:8px 0 2px;padding:8px 9px;border:1px solid #dbeafe;border-radius:8px;background:#f8fbff;align-items:flex-start;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'nupRepeatSamePage';
    input.style.marginTop = '2px';

    const copy = document.createElement('span');
    copy.style.cssText = 'display:grid;gap:2px;min-width:0;';
    const title = document.createElement('strong');
    title.textContent = '같은 페이지 반복 배치';
    title.style.cssText = 'font-size:11px;color:#1f2937;';
    const hint = document.createElement('small');
    hint.id = 'nupRepeatHint';
    hint.style.cssText = 'font-size:9px;line-height:1.45;color:#64748b;font-weight:650;';
    copy.append(title, hint);
    row.append(input, copy);

    grid.insertAdjacentElement('afterend', row);
    setEnabled(readPreference(), { schedule: false, persist: false });

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
    const repeated = [];
    for (const group of groups || []) {
      const n = Math.max(1, Number(group?.n || 1));
      for (const page of group?.pages || []) {
        repeated.push({
          ...group,
          n,
          pages: Array.from({ length: n }, () => page),
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

    const defaultNup = Math.max(1, Number(next.nup_default || 1));
    const expanded = [];
    for (const page of Array.isArray(next.pages) ? next.pages : []) {
      if (page?.excluded) {
        expanded.push({ ...page });
        continue;
      }
      const rawNup = page?.nup_disabled ? 1 : Number(page?.nup_override || defaultNup);
      const copies = [1, 2, 4, 6, 8, 9].includes(rawNup) ? rawNup : defaultNup;
      for (let index = 0; index < copies; index += 1) {
        expanded.push({
          ...page,
          group_break: index === 0 ? Boolean(page?.group_break) : false,
        });
      }
    }

    if (expanded.length > MAX_API_PAGES) {
      throw new Error(`같은 페이지 반복 배치 결과가 서버 처리 한도(${MAX_API_PAGES}페이지)를 초과합니다. N-UP 수 또는 원본 페이지 수를 줄여 주세요.`);
    }

    next.pages = expanded;
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
        return state;
      };
      window.collectEditorState = collectWrapped;
      try { collectEditorState = collectWrapped; } catch (_) {}
    }

    if (!originalLoadEditorSession && typeof window.loadEditorSession === 'function') {
      originalLoadEditorSession = window.loadEditorSession;
      const loadWrapped = async function (data, ...rest) {
        let repeat = false;
        try { repeat = Boolean(JSON.parse(data?.state || '{}')?.repeatSamePage); } catch (_) {}
        const result = await originalLoadEditorSession.call(this, data, ...rest);
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
    expandSettingsPages,
    repeatGroups,
    stage: 'pdf-editor-nup-repeat-v1',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
