// Final page-number space calculation: reserve from the actual number anchor plus full text height.
(function () {
  'use strict';
  if (window.__pdfEditorPageNumberReserveLayoutV2) return;
  window.__pdfEditorPageNumberReserveLayoutV2 = true;

  const byId = (id) => document.getElementById(id);
  let patched = false;
  let attempts = 0;

  function numberValue(id, fallback) {
    const value = Number(byId(id) && byId(id).value);
    return Number.isFinite(value) ? value : fallback;
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

  function enabled() {
    const checkbox = byId('pnAutoReserve');
    return !checkbox || checkbox.checked;
  }

  function pageNumberApplies(outputIndex) {
    try {
      if (!pnEnabled) return false;
      if (pnExcludeFirst && outputIndex === 0) return false;
      const odd = outputIndex % 2 === 0;
      return pnApplyTo === 'all' || (pnApplyTo === 'odd' && odd) || (pnApplyTo === 'even' && !odd);
    } catch (_) {
      return !!(byId('pnEnabled') && byId('pnEnabled').checked);
    }
  }

  function position() {
    try { return String(pnPosition || 'bottom-center'); } catch (_) {
      const active = document.querySelector('.pn-pos-btn.active');
      return active ? active.dataset.pos : 'bottom-center';
    }
  }

  function requiredSpace(edgeMargin) {
    const dedicated = Math.max(0, numberValue('pnMarginMm', 5));
    const anchor = Math.max(edgeMargin, dedicated);
    const fontMm = Math.max(6, numberValue('pnFontSize', 10)) * 25.4 / 72;
    return Math.min(80, anchor + fontMm * 1.8 + 2);
  }

  function layoutMargins(outputIndex) {
    const margins = baseMargins(outputIndex);
    if (!enabled() || !pageNumberApplies(outputIndex)) return margins;
    if (position().startsWith('top-')) margins.top = requiredSpace(margins.top);
    else margins.bottom = requiredSpace(margins.bottom);
    return margins;
  }

  function updateHint() {
    const hint = byId('pnAutoReserveHint');
    if (!hint) return;
    if (!enabled()) {
      hint.textContent = '자동 확보가 꺼져 있어 페이지 번호가 본문과 겹칠 수 있습니다.';
      return;
    }
    const margins = layoutMargins(0);
    const top = position().startsWith('top-');
    const value = top ? margins.top : margins.bottom;
    hint.textContent = `${top ? '상단' : '하단'} 본문 여백을 ${value.toFixed(1)}mm 이상 확보해 번호와 내용을 분리합니다.`;
  }

  function patchCore() {
    if (patched) return true;
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

      const buildPage = function buildPageWithFinalNumberReserve(groupPages, pageIndex, cols, rows, mm2px, useHi, outputIndex) {
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

      const buildPages = async function buildPagesWithFinalNumberReserve(mm2px, useHi, overridePages) {
        const active = overridePages || parsedPages.filter((page) => !page.excluded);
        const groups = groupByNup(active);
        const output = [];
        for (const group of groups) {
          const { cols, rows } = getLayout(group.n);
          const perPage = cols * rows;
          for (let pageIndex = 0; pageIndex < Math.ceil(group.pages.length / perPage); pageIndex += 1) {
            output.push(buildPage(group.pages, pageIndex, cols, rows, mm2px, useHi, output.length));
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        output.forEach((canvas, index) => {
          try { applyDocEdits(canvas, index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-page-number-reserve-v2] overlay failed', index, error); }
        });
        return output;
      };

      buildPage.__pageNumberReserveLayoutV2 = true;
      buildPages.__pageNumberReserveLayoutV2 = true;
      buildOutputPage = buildPage;
      buildAllPages = buildPages;
      window.buildOutputPage = buildPage;
      window.buildAllPages = buildPages;
      patched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-page-number-reserve-v2] patch failed', error);
      return false;
    }
  }

  function installHintRefresh() {
    if (window.__pdfPageNumberReserveHintV2) return;
    window.__pdfPageNumberReserveHintV2 = true;
    document.addEventListener('input', (event) => {
      if (event.target && event.target.matches('#pnMarginMm,#pnFontSize,#marginTop,#marginBottom')) updateHint();
    }, true);
    document.addEventListener('change', (event) => {
      if (event.target && event.target.matches('#pnEnabled,#pnAutoReserve,#pnApplyTo,#pnExcludeFirst')) updateHint();
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target.closest('.pn-pos-btn')) setTimeout(updateHint, 0);
    }, true);
  }

  function boot() {
    const ready = patchCore();
    installHintRefresh();
    updateHint();
    if (!ready && attempts < 12) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 70);
    }
    if (window.PdfEditorPageNumberReserve) {
      window.PdfEditorPageNumberReserve.baseMargins = baseMargins;
      window.PdfEditorPageNumberReserve.layoutMargins = layoutMargins;
      window.PdfEditorPageNumberReserve.requiredNumberSpaceMm = requiredSpace;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
