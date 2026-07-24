// Reserve top/bottom content space for page numbers without moving their edge anchor.
(function () {
  'use strict';
  if (window.__pdfEditorPageNumberReserveV1) return;
  window.__pdfEditorPageNumberReserveV1 = true;

  const byId = (id) => document.getElementById(id);
  let corePatched = false;
  let sessionPatched = false;
  let attempts = 0;

  function numberValue(id, fallback) {
    const value = Number(byId(id) && byId(id).value);
    return Number.isFinite(value) ? value : fallback;
  }

  function pageNumbersEnabled() {
    try { return !!pnEnabled; } catch (_) { return !!(byId('pnEnabled') && byId('pnEnabled').checked); }
  }

  function pageNumberPosition() {
    try { return String(pnPosition || 'bottom-center'); } catch (_) {
      const active = document.querySelector('.pn-pos-btn.active');
      return active ? active.dataset.pos : 'bottom-center';
    }
  }

  function pageNumberApplies(outputIndex) {
    if (!pageNumbersEnabled()) return false;
    try {
      if (pnExcludeFirst && outputIndex === 0) return false;
      const odd = outputIndex % 2 === 0;
      return pnApplyTo === 'all' || (pnApplyTo === 'odd' && odd) || (pnApplyTo === 'even' && !odd);
    } catch (_) {
      return true;
    }
  }

  function autoReserveEnabled() {
    const checkbox = byId('pnAutoReserve');
    return !checkbox || checkbox.checked;
  }

  function baseMargins(outputIndex) {
    if (window.PdfEditorIndividualMargins && typeof window.PdfEditorIndividualMargins.effectiveMargins === 'function') {
      return { ...window.PdfEditorIndividualMargins.effectiveMargins(outputIndex) };
    }
    const horizontal = numberValue('marginH', 10);
    const vertical = numberValue('marginV', 10);
    return {
      left: numberValue('marginLeft', horizontal),
      right: numberValue('marginRight', horizontal),
      top: numberValue('marginTop', vertical),
      bottom: numberValue('marginBottom', vertical),
    };
  }

  function requiredNumberSpaceMm() {
    const edge = Math.max(0, numberValue('pnMarginMm', 5));
    const fontMm = Math.max(6, numberValue('pnFontSize', 10)) * 25.4 / 72;
    return Math.min(80, edge + fontMm * 0.8 + 2);
  }

  function layoutMargins(outputIndex) {
    const margins = baseMargins(outputIndex);
    if (!autoReserveEnabled() || !pageNumberApplies(outputIndex)) return margins;
    const required = requiredNumberSpaceMm();
    if (pageNumberPosition().startsWith('top-')) margins.top = Math.max(margins.top, required);
    else margins.bottom = Math.max(margins.bottom, required);
    return margins;
  }

  function updateHint() {
    const hint = byId('pnAutoReserveHint');
    if (!hint) return;
    if (!pageNumbersEnabled()) {
      hint.textContent = '페이지 번호를 켜면 번호와 본문이 겹치지 않도록 필요한 공간을 자동 계산합니다.';
      return;
    }
    const margins = layoutMargins(0);
    const position = pageNumberPosition().startsWith('top-') ? '상단' : '하단';
    const value = position === '상단' ? margins.top : margins.bottom;
    hint.textContent = autoReserveEnabled()
      ? `${position} 본문 여백을 최소 ${value.toFixed(1)}mm로 확보합니다. 입력한 용지 여백보다 작아지지는 않습니다.`
      : '자동 확보가 꺼져 있어 페이지 번호가 본문과 겹칠 수 있습니다.';
  }

  function requestPreview() {
    updateHint();
    if (window.PdfEditorIndividualMargins && typeof window.PdfEditorIndividualMargins.refresh === 'function') {
      window.PdfEditorIndividualMargins.refresh();
      return;
    }
    try { if (typeof schedulePreview === 'function') schedulePreview(350); } catch (_) {}
  }

  function installUi() {
    const settings = byId('pnSettings');
    if (!settings) return false;
    let row = byId('pnAutoReserveRow');
    if (!row) {
      row = document.createElement('label');
      row.id = 'pnAutoReserveRow';
      row.className = 'checkline';
      row.style.cssText = 'align-items:flex-start;margin:7px 0 2px;padding:8px 9px;border:1px solid #dbeafe;border-radius:9px;background:#eff6ff;line-height:1.45;';
      row.innerHTML = '<input type="checkbox" id="pnAutoReserve" checked><span><strong style="display:block;font-size:11px;color:#1e3a8a;">페이지 번호 공간 자동 확보</strong><small id="pnAutoReserveHint" style="display:block;margin-top:2px;font-size:9px;font-weight:650;color:#64748b;"></small></span>';
      const marginInput = byId('pnMarginMm');
      const target = marginInput && marginInput.closest('.grid2');
      if (target) target.insertAdjacentElement('afterend', row);
      else settings.appendChild(row);
    }
    const checkbox = byId('pnAutoReserve');
    if (checkbox && !checkbox.dataset.reserveBound) {
      checkbox.dataset.reserveBound = '1';
      checkbox.addEventListener('change', requestPreview);
    }
    ['pnEnabled', 'pnMarginMm', 'pnFontSize', 'pnApplyTo', 'pnExcludeFirst'].forEach((id) => {
      const element = byId(id);
      if (!element || element.dataset.reserveInputBound) return;
      element.dataset.reserveInputBound = '1';
      element.addEventListener('input', requestPreview);
      element.addEventListener('change', requestPreview);
    });
    if (!window.__pnReservePositionBound) {
      window.__pnReservePositionBound = true;
      document.addEventListener('click', (event) => {
        if (event.target.closest('.pn-pos-btn')) setTimeout(requestPreview, 0);
      }, true);
    }
    updateHint();
    return true;
  }

  function patchCore() {
    if (corePatched) return true;
    try {
      if (
        typeof buildAllPages !== 'function' ||
        typeof groupByNup !== 'function' ||
        typeof getLayout !== 'function' ||
        typeof getSettings !== 'function' ||
        typeof getPageSrc !== 'function' ||
        typeof drawPageInCell !== 'function' ||
        typeof applyDocEdits !== 'function'
      ) return false;

      const buildReservedPage = function buildPageWithNumberSpace(groupPages, pageIndex, cols, rows, mm2px, useHi, outputIndex) {
        const { pw, ph, gp } = getSettings();
        let margins = layoutMargins(outputIndex);
        let usableWidth = pw - margins.left - margins.right - gp * (cols - 1);
        let usableHeight = ph - margins.top - margins.bottom - gp * (rows - 1);
        if (usableWidth <= 1 || usableHeight <= 1) {
          margins = { left: 10, right: 10, top: 10, bottom: 10 };
          usableWidth = pw - 20 - gp * (cols - 1);
          usableHeight = ph - 20 - gp * (rows - 1);
        }
        const cellWidth = usableWidth / cols;
        const cellHeight = usableHeight / rows;
        const perPage = cols * rows;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(pw * mm2px);
        canvas.height = Math.round(ph * mm2px);
        const context = canvas.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        for (let slot = 0; slot < perPage; slot += 1) {
          const sourceIndex = pageIndex * perPage + slot;
          if (sourceIndex >= groupPages.length) break;
          let column;
          let row;
          if (orderLR) {
            column = slot % cols;
            row = Math.floor(slot / cols);
          } else {
            column = Math.floor(slot / rows);
            row = slot % rows;
          }
          const x = (margins.left + column * (cellWidth + gp)) * mm2px;
          const y = (margins.top + row * (cellHeight + gp)) * mm2px;
          const source = getPageSrc(groupPages[sourceIndex], mm2px, useHi);
          drawPageInCell(context, source, x, y, cellWidth * mm2px, cellHeight * mm2px);
        }
        return canvas;
      };

      const buildReservedPages = async function buildAllPagesWithNumberSpace(mm2px, useHi, overridePages) {
        const active = overridePages || parsedPages.filter((page) => !page.excluded);
        const groups = groupByNup(active);
        const output = [];
        for (const group of groups) {
          const { cols, rows } = getLayout(group.n);
          const perPage = cols * rows;
          for (let pageIndex = 0; pageIndex < Math.ceil(group.pages.length / perPage); pageIndex += 1) {
            output.push(buildReservedPage(group.pages, pageIndex, cols, rows, mm2px, useHi, output.length));
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        output.forEach((canvas, index) => {
          try { applyDocEdits(canvas, index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-page-number-reserve] overlay failed', index, error); }
        });
        return output;
      };

      buildReservedPage.__pageNumberReservePatchedV1 = true;
      buildReservedPages.__pageNumberReservePatchedV1 = true;
      buildOutputPage = buildReservedPage;
      buildAllPages = buildReservedPages;
      window.buildOutputPage = buildReservedPage;
      window.buildAllPages = buildReservedPages;
      corePatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-page-number-reserve] core patch failed', error);
      return false;
    }
  }

  function patchSessionState() {
    if (sessionPatched) return true;
    try {
      if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
      const originalCollect = collectEditorState;
      const originalLoad = loadEditorSession;
      collectEditorState = function collectStateWithNumberReserve() {
        const state = originalCollect();
        state.pnAutoReserve = autoReserveEnabled();
        return state;
      };
      loadEditorSession = async function loadStateWithNumberReserve(data, documentId) {
        const result = await originalLoad(data, documentId);
        try {
          const state = JSON.parse(data.state || '{}');
          const checkbox = byId('pnAutoReserve');
          if (checkbox) checkbox.checked = state.pnAutoReserve !== false;
        } catch (_) {}
        updateHint();
        return result;
      };
      window.collectEditorState = collectEditorState;
      window.loadEditorSession = loadEditorSession;
      sessionPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-page-number-reserve] session patch failed', error);
      return false;
    }
  }

  function boot() {
    const uiReady = installUi();
    const coreReady = patchCore();
    const stateReady = patchSessionState();
    if ((!uiReady || !coreReady || !stateReady) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 70);
    }
  }

  window.PdfEditorPageNumberReserve = {
    baseMargins,
    layoutMargins,
    requiredNumberSpaceMm,
    enabled: autoReserveEnabled,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
