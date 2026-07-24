// Keep booklet preview/export rules deterministic and expose the option immediately.
(function () {
  'use strict';
  if (window.__pdfEditorBookletReliabilityV2) return;
  window.__pdfEditorBookletReliabilityV2 = true;

  const SUPPORTED_NUP = new Set([2, 4, 6, 8]);
  const BOOKLET_LAYOUTS = new Map([
    [2, { cols: 2, rows: 1 }],
    [4, { cols: 2, rows: 2 }],
    [6, { cols: 2, rows: 3 }],
    [8, { cols: 2, rows: 4 }],
  ]);
  const byId = (id) => document.getElementById(id);
  let groupPatched = false;
  let layoutPatched = false;
  let popupPatched = false;
  let renderPatched = false;
  let attempts = 0;
  let savedOrderLR = null;

  function editorReady() {
    try {
      return typeof groupByNup === 'function' && typeof getLayout === 'function' && typeof nup !== 'undefined';
    } catch (_) {
      return false;
    }
  }

  function currentNup() {
    try { return Number(nup); } catch (_) { return Number(document.querySelector('.nup-btn.active')?.dataset.nup || 1); }
  }

  function bookletEnabled() {
    const check = byId('bookletCheck');
    return !!(check && check.checked && SUPPORTED_NUP.has(currentNup()));
  }

  function ensureStyles() {
    if (byId('pdfBookletReliabilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfBookletReliabilityStyles';
    style.textContent = `
      html.pdf-booklet-active #previewScroll .prev-ins-zone,
      html.pdf-booklet-active #previewScroll .prev-ins-zone-v{display:none!important}
      html.pdf-booklet-active #orderLR,
      html.pdf-booklet-active #orderTB{opacity:.52!important;cursor:not-allowed!important}
    `;
    document.head.appendChild(style);
  }

  function ensureNotice() {
    const row = byId('bookletRow');
    if (!row) return null;
    let notice = byId('bookletReliabilityNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'bookletReliabilityNotice';
      notice.style.cssText = 'display:none;margin-top:6px;padding:7px 9px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:9px;font-weight:750;line-height:1.5;';
      notice.textContent = '소책자 사용 중에는 모든 출력면을 좌→우 2열 기준으로 고정합니다. 페이지별·파일별 N-up, 비연속 구분, 위→아래 배치와 재배치된 미리보기 사이 삽입 기능은 잠시 사용하지 않습니다.';
      row.appendChild(notice);
    }
    return notice;
  }

  function syncOrderControls(active) {
    const leftRight = byId('orderLR');
    const topBottom = byId('orderTB');
    if (active) {
      if (savedOrderLR === null) {
        try { savedOrderLR = !!orderLR; } catch (_) { savedOrderLR = true; }
      }
      try { orderLR = true; } catch (_) {}
      leftRight?.classList.add('active');
      topBottom?.classList.remove('active');
      [leftRight, topBottom].filter(Boolean).forEach((button) => {
        button.disabled = true;
        button.title = '소책자는 좌→우 2열 배치로 고정됩니다.';
      });
      return;
    }

    if (savedOrderLR !== null) {
      try { orderLR = savedOrderLR; } catch (_) {}
      leftRight?.classList.toggle('active', savedOrderLR);
      topBottom?.classList.toggle('active', !savedOrderLR);
      savedOrderLR = null;
    }
    [leftRight, topBottom].filter(Boolean).forEach((button) => {
      button.disabled = false;
      button.removeAttribute('title');
    });
  }

  function syncOverrideControls() {
    const active = bookletEnabled();
    document.documentElement.classList.toggle('pdf-booklet-active', active);
    syncOrderControls(active);
    document.querySelectorAll('#thumbArea .file-nup-select-v5, #thumbArea .thumb-file-sep select').forEach((select) => {
      if (active) {
        if (!select.dataset.bookletWasDisabled) select.dataset.bookletWasDisabled = select.disabled ? '1' : '0';
        select.disabled = true;
        select.title = '소책자 배치에서는 기본 N-up만 사용합니다.';
      } else {
        if (select.dataset.bookletWasDisabled === '0') select.disabled = false;
        delete select.dataset.bookletWasDisabled;
        select.removeAttribute('title');
      }
    });
    const notice = ensureNotice();
    if (notice) notice.style.display = active ? 'block' : 'none';
  }

  function syncBookletUi() {
    const row = byId('bookletRow');
    const check = byId('bookletCheck');
    if (!row || !check) return false;
    const supported = SUPPORTED_NUP.has(currentNup());
    row.style.display = supported ? '' : 'none';
    if (!supported && check.checked) check.checked = false;
    ensureNotice();
    syncOverrideControls();
    if (typeof updateBookletPadInfo === 'function') updateBookletPadInfo();
    return true;
  }

  function uniformBookletGroups(pages, size) {
    const groups = [];
    for (let index = 0; index < pages.length; index += size) {
      groups.push({ n: size, pages: pages.slice(index, index + size) });
    }
    return groups;
  }

  function patchGroupByNup() {
    if (groupPatched) return true;
    try {
      if (typeof groupByNup !== 'function') return false;
      if (groupByNup.__bookletReliabilityPatchedV2) {
        groupPatched = true;
        return true;
      }
      const original = groupByNup;
      const wrapped = function groupByNupWithBookletRules(pages) {
        const size = currentNup();
        if (bookletEnabled() && SUPPORTED_NUP.has(size)) return uniformBookletGroups(pages || [], size);
        return original.apply(this, arguments);
      };
      wrapped.__bookletReliabilityPatchedV2 = true;
      groupByNup = wrapped;
      window.groupByNup = wrapped;
      groupPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-booklet] group patch failed', error);
      return false;
    }
  }

  function patchGetLayout() {
    if (layoutPatched) return true;
    try {
      if (typeof getLayout !== 'function') return false;
      if (getLayout.__bookletReliabilityPatchedV2) {
        layoutPatched = true;
        return true;
      }
      const original = getLayout;
      const wrapped = function getLayoutWithBookletPairs(value) {
        const size = Number(value);
        const layout = BOOKLET_LAYOUTS.get(size);
        if (bookletEnabled() && layout) return { cols: 2, rows: size / 2, rotate: false };
        return original.apply(this, arguments);
      };
      wrapped.__bookletReliabilityPatchedV2 = true;
      getLayout = wrapped;
      window.getLayout = wrapped;
      layoutPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-booklet] layout patch failed', error);
      return false;
    }
  }

  function patchNupPopup() {
    if (popupPatched) return true;
    try {
      if (typeof showNupPopup !== 'function') return false;
      if (showNupPopup.__bookletReliabilityPatchedV2) {
        popupPatched = true;
        return true;
      }
      const original = showNupPopup;
      const wrapped = function showNupPopupUnlessBooklet() {
        if (bookletEnabled()) {
          if (typeof showStatus === 'function') showStatus('소책자 사용 중에는 페이지별 배치 대신 기본 N-up을 사용합니다.', 'info');
          return;
        }
        return original.apply(this, arguments);
      };
      wrapped.__bookletReliabilityPatchedV2 = true;
      showNupPopup = wrapped;
      window.showNupPopup = wrapped;
      popupPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-booklet] N-up popup patch failed', error);
      return false;
    }
  }

  function patchRenderThumbs() {
    if (renderPatched) return true;
    try {
      if (typeof renderThumbs !== 'function') return false;
      if (renderThumbs.__bookletReliabilityPatchedV2) {
        renderPatched = true;
        return true;
      }
      const original = renderThumbs;
      const wrapped = function renderThumbsWithBookletState() {
        const result = original.apply(this, arguments);
        setTimeout(syncBookletUi, 0);
        return result;
      };
      wrapped.__bookletReliabilityPatchedV2 = true;
      renderThumbs = wrapped;
      window.renderThumbs = wrapped;
      renderPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-booklet] thumbnail patch failed', error);
      return false;
    }
  }

  function installEvents() {
    if (window.__pdfBookletReliabilityEventsV2) return;
    window.__pdfBookletReliabilityEventsV2 = true;
    const check = byId('bookletCheck');
    if (check) {
      check.addEventListener('change', () => {
        syncBookletUi();
        try {
          if (typeof schedulePreview === 'function') schedulePreview(150);
          else if (typeof triggerPreview === 'function') triggerPreview();
        } catch (_) {}
      });
    }
    document.addEventListener('click', (event) => {
      if (event.target && event.target.closest && event.target.closest('.nup-btn')) setTimeout(syncBookletUi, 0);
    }, true);
    const area = byId('thumbArea');
    if (area && !area.dataset.bookletReliabilityObserved) {
      area.dataset.bookletReliabilityObserved = '1';
      new MutationObserver(syncOverrideControls).observe(area, { childList: true, subtree: true });
    }
  }

  function boot() {
    ensureStyles();
    if (!editorReady()) {
      if (attempts < 12) {
        attempts += 1;
        setTimeout(boot, 180 + attempts * 70);
      }
      return;
    }
    patchGroupByNup();
    patchGetLayout();
    patchNupPopup();
    patchRenderThumbs();
    installEvents();
    syncBookletUi();
  }

  window.PdfBookletReliability = {
    isEnabled: bookletEnabled,
    sync: syncBookletUi,
    uniformGroups: uniformBookletGroups,
    layoutFor: (value) => BOOKLET_LAYOUTS.get(Number(value)) || null,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
