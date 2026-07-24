// Independent paper margins, facing-page layout, and stable preview toolbar.
(function () {
  'use strict';
  if (window.__pdfEditorIndividualMarginsV1) return;
  window.__pdfEditorIndividualMarginsV1 = true;

  const byId = (id) => document.getElementById(id);
  const marginIds = ['marginLeft', 'marginRight', 'marginTop', 'marginBottom'];
  let corePatched = false;
  let sessionPatched = false;
  let toolbarObserver = null;
  let reorganizingToolbar = false;

  function numberValue(id, fallback) {
    const element = byId(id);
    const value = Number(element && element.value);
    return Number.isFinite(value) ? Math.max(0, Math.min(80, value)) : fallback;
  }

  function isFacingPages() {
    try { return !!facingPages; } catch (_) { return !!(byId('facingPages') && byId('facingPages').checked); }
  }

  function baseMargins() {
    return {
      left: numberValue('marginLeft', numberValue('marginH', 10)),
      right: numberValue('marginRight', numberValue('marginH', 10)),
      top: numberValue('marginTop', numberValue('marginV', 10)),
      bottom: numberValue('marginBottom', numberValue('marginV', 10)),
    };
  }

  function effectiveMargins(outputPageIndex) {
    const margins = baseMargins();
    if (isFacingPages() && outputPageIndex % 2 === 1) {
      [margins.left, margins.right] = [margins.right, margins.left];
    }
    return margins;
  }

  function syncLegacyMargins() {
    const margins = baseMargins();
    const oldHorizontal = byId('marginH');
    const oldVertical = byId('marginV');
    if (oldHorizontal) oldHorizontal.value = String((margins.left + margins.right) / 2);
    if (oldVertical) oldVertical.value = String((margins.top + margins.bottom) / 2);
  }

  function requestPreview() {
    syncLegacyMargins();
    if (window.PdfEditorUxRepair && typeof window.PdfEditorUxRepair.refreshPreview === 'function') {
      window.PdfEditorUxRepair.refreshPreview();
      return;
    }
    try {
      if (typeof schedulePreview === 'function') schedulePreview(350);
      else if (typeof triggerPreview === 'function') setTimeout(() => triggerPreview(), 50);
    } catch (_) {}
  }

  function installStyles() {
    if (byId('pdfIndividualMarginStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfIndividualMarginStyles';
    style.textContent = `
      .legacy-paired-margin-field{display:none!important}
      .paper-margin-panel{margin:2px 0 9px;padding:10px;border:1px solid #dbe5ef;border-radius:11px;background:linear-gradient(180deg,#fbfdff,#f7fafc)}
      .paper-margin-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:10px;font-weight:900;color:#334155}
      .paper-margin-title small{font-size:9px;font-weight:700;color:#94a3b8}
      .paper-margin-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .paper-margin-grid .field{margin:0!important;min-width:0}
      .paper-margin-grid label{font-size:10px;text-align:center;color:#475569}
      .paper-margin-grid input{padding:7px 5px!important;text-align:center;font-weight:800}
      .paper-facing-option{margin:9px 0 0!important;padding-top:8px;border-top:1px solid #e5eaf0;align-items:flex-start!important;line-height:1.45}
      .paper-facing-copy{display:flex;flex-direction:column;gap:2px}
      .paper-facing-copy strong{font-size:11px;color:#334155}
      .paper-facing-copy small{font-size:9px;font-weight:650;color:#7c899a}
      .paper-spacing-legacy-grid>.field:last-child{grid-column:1/-1}
      .preview-info.pdf-preview-toolbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center!important;gap:7px 12px!important;padding:8px 10px!important;min-height:48px}
      .preview-copy-group{display:flex;align-items:center;gap:7px;min-width:0;flex-wrap:wrap}
      .preview-copy-group #previewInfo{flex:1 1 220px;min-width:140px;white-space:normal!important;line-height:1.4;overflow:visible!important;text-overflow:clip!important}
      .preview-copy-group #previewPages{white-space:nowrap;flex:0 0 auto}
      .preview-copy-group #livePreviewHint{white-space:nowrap!important;flex:0 0 auto;padding:3px 7px;border-radius:999px;background:#f1f5f9;border:1px solid #e2e8f0}
      .preview-copy-group #pdfPageCountHint{flex:1 0 100%;margin:0!important;padding:0!important;border:0!important;background:transparent!important;font-size:10px!important;line-height:1.4!important;color:#64748b!important;white-space:normal}
      .preview-info.pdf-preview-toolbar .preview-zoom{margin:0!important;max-width:100%;display:flex!important;flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:4px}
      @media(max-width:1180px){
        .preview-info.pdf-preview-toolbar{grid-template-columns:1fr}
        .preview-info.pdf-preview-toolbar .preview-zoom{justify-content:flex-start;width:100%}
      }
      @media(max-width:900px){.paper-margin-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function installMarginUi() {
    const oldHorizontal = byId('marginH');
    const oldVertical = byId('marginV');
    if (!oldHorizontal || !oldVertical) return false;

    let panel = byId('individualPaperMargins');
    if (!panel) {
      const legacyGrid = oldHorizontal.closest('.grid2');
      if (!legacyGrid) return false;
      legacyGrid.classList.add('paper-spacing-legacy-grid');
      oldHorizontal.closest('.field')?.classList.add('legacy-paired-margin-field');
      oldVertical.closest('.field')?.classList.add('legacy-paired-margin-field');

      panel = document.createElement('div');
      panel.id = 'individualPaperMargins';
      panel.className = 'paper-margin-panel';
      panel.innerHTML = `
        <div class="paper-margin-title"><span>개별 용지 여백 (mm)</span><small>좌·우·상·하 각각 입력</small></div>
        <div class="paper-margin-grid">
          <div class="field"><label for="marginLeft">좌</label><input id="marginLeft" type="number" value="${numberValue('marginH', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginRight">우</label><input id="marginRight" type="number" value="${numberValue('marginH', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginTop">상</label><input id="marginTop" type="number" value="${numberValue('marginV', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginBottom">하</label><input id="marginBottom" type="number" value="${numberValue('marginV', 10)}" min="0" max="80" step="0.5"></div>
        </div>`;
      legacyGrid.parentElement.insertBefore(panel, legacyGrid);

      const facingCheckbox = byId('facingPages');
      const facingLabel = facingCheckbox && facingCheckbox.closest('label');
      if (facingLabel) {
        facingLabel.classList.add('paper-facing-option');
        facingLabel.innerHTML = '';
        facingLabel.appendChild(facingCheckbox);
        const copy = document.createElement('span');
        copy.className = 'paper-facing-copy';
        copy.innerHTML = '<strong>양면 마주보기</strong><small>짝수 페이지는 좌·우 여백과 페이지 번호 위치를 반대로 적용합니다.</small>';
        facingLabel.appendChild(copy);
        panel.appendChild(facingLabel);
      }
    }

    marginIds.forEach((id) => {
      const input = byId(id);
      if (!input || input.dataset.individualMarginBound) return;
      input.dataset.individualMarginBound = '1';
      input.addEventListener('input', requestPreview);
      input.addEventListener('change', requestPreview);
    });
    const facing = byId('facingPages');
    if (facing && !facing.dataset.marginFacingBound) {
      facing.dataset.marginFacingBound = '1';
      facing.addEventListener('change', requestPreview);
    }
    syncLegacyMargins();
    return true;
  }

  function normalizePreviewToolbar() {
    const bar = document.querySelector('.preview-info');
    if (!bar || reorganizingToolbar) return false;
    reorganizingToolbar = true;
    try {
      bar.classList.add('pdf-preview-toolbar');
      let group = bar.querySelector('.preview-copy-group');
      if (!group) {
        group = document.createElement('div');
        group.className = 'preview-copy-group';
        bar.insertBefore(group, bar.firstChild);
      }
      ['previewInfo', 'previewPages', 'livePreviewHint', 'pdfPageCountHint'].forEach((id) => {
        const element = byId(id);
        if (element && element.parentElement !== group) group.appendChild(element);
      });
      const zoom = bar.querySelector('.preview-zoom');
      if (zoom && zoom.parentElement !== bar) bar.appendChild(zoom);
      return true;
    } finally {
      reorganizingToolbar = false;
    }
  }

  function observePreviewToolbar() {
    const bar = document.querySelector('.preview-info');
    if (!bar || toolbarObserver) return;
    toolbarObserver = new MutationObserver(() => normalizePreviewToolbar());
    toolbarObserver.observe(bar, { childList: true, subtree: true });
  }

  function patchCoreFunctions() {
    if (corePatched) return true;
    try {
      if (
        typeof getSettings !== 'function' ||
        typeof buildOutputPage !== 'function' ||
        typeof buildAllPages !== 'function' ||
        typeof applyDocEdits !== 'function'
      ) return false;

      const originalGetSettings = getSettings;
      const originalApplyDocEdits = applyDocEdits;

      const patchedGetSettings = function individualMarginSettings() {
        const settings = originalGetSettings();
        const margins = baseMargins();
        return {
          ...settings,
          ml: margins.left,
          mr: margins.right,
          mt: margins.top,
          mb: margins.bottom,
          mh: (margins.left + margins.right) / 2,
          mv: (margins.top + margins.bottom) / 2,
        };
      };

      const patchedBuildOutputPage = function individualMarginOutputPage(
        groupPages,
        pageIdx,
        cols,
        rows,
        mm2px,
        useHi,
        outputPageIndex,
      ) {
        const { pw, ph, gp } = patchedGetSettings();
        let margins = effectiveMargins(Number.isInteger(outputPageIndex) ? outputPageIndex : pageIdx);
        let usableWidth = pw - margins.left - margins.right - gp * (cols - 1);
        let usableHeight = ph - margins.top - margins.bottom - gp * (rows - 1);
        if (usableWidth <= 1 || usableHeight <= 1) {
          margins = { left: 10, right: 10, top: 10, bottom: 10 };
          usableWidth = pw - 20 - gp * (cols - 1);
          usableHeight = ph - 20 - gp * (rows - 1);
        }
        const cellW = usableWidth / cols;
        const cellH = usableHeight / rows;
        const perPage = cols * rows;
        const out = document.createElement('canvas');
        out.width = Math.round(pw * mm2px);
        out.height = Math.round(ph * mm2px);
        const ctx = out.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, out.width, out.height);

        for (let slot = 0; slot < perPage; slot += 1) {
          const sourceIndex = pageIdx * perPage + slot;
          if (sourceIndex >= groupPages.length) break;
          let col;
          let row;
          if (orderLR) {
            col = slot % cols;
            row = Math.floor(slot / cols);
          } else {
            col = Math.floor(slot / rows);
            row = slot % rows;
          }
          const cellX = (margins.left + col * (cellW + gp)) * mm2px;
          const cellY = (margins.top + row * (cellH + gp)) * mm2px;
          const src = getPageSrc(groupPages[sourceIndex], mm2px, useHi);
          drawPageInCell(ctx, src, cellX, cellY, cellW * mm2px, cellH * mm2px);
        }
        return out;
      };

      const drawMarginAwarePageNumber = function (canvas, outputIdx, totalPages, mm2px) {
        if (!pnEnabled) return;
        const isOddPage = outputIdx % 2 === 0;
        const shouldApply = pnApplyTo === 'all' ||
          (pnApplyTo === 'odd' && isOddPage) ||
          (pnApplyTo === 'even' && !isOddPage);
        if (!shouldApply || (pnExcludeFirst && outputIdx === 0)) return;

        const visibleNum = outputIdx + pnStart - (pnExcludeFirst ? 1 : 0);
        const totalForNumber = pnExcludeFirst ? totalPages - 1 : totalPages;
        let text;
        if (pnFormat === 'number') text = String(visibleNum);
        else if (pnFormat === 'dash') text = `- ${visibleNum} -`;
        else text = `${visibleNum} / ${totalForNumber + pnStart - 1}`;

        let [vertical, horizontal] = pnPosition.split('-');
        if (isFacingPages() && !isOddPage) {
          if (horizontal === 'left') horizontal = 'right';
          else if (horizontal === 'right') horizontal = 'left';
        }

        const margins = effectiveMargins(outputIdx);
        const dedicatedMargin = numberValue('pnMarginMm', 5);
        const left = Math.max(margins.left, dedicatedMargin) * mm2px;
        const right = Math.max(margins.right, dedicatedMargin) * mm2px;
        const top = Math.max(margins.top, dedicatedMargin) * mm2px;
        const bottom = Math.max(margins.bottom, dedicatedMargin) * mm2px;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const x = horizontal === 'center' ? width / 2 : (horizontal === 'right' ? width - right : left);
        const y = vertical === 'top' ? top : height - bottom;
        const fontSize = pnFontSize * 0.353 * mm2px;

        ctx.save();
        ctx.fillStyle = pnColor;
        ctx.font = `${fontSize}px "Pretendard","Malgun Gothic",Arial,sans-serif`;
        ctx.textAlign = horizontal === 'center' ? 'center' : (horizontal === 'right' ? 'right' : 'left');
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
      };

      const patchedApplyDocEdits = function individualMarginDocEdits(canvas, outputIdx, totalPages, mm2px) {
        const pageNumbersWereEnabled = pnEnabled;
        try {
          pnEnabled = false;
          originalApplyDocEdits(canvas, outputIdx, totalPages, mm2px);
        } finally {
          pnEnabled = pageNumbersWereEnabled;
        }
        if (pageNumbersWereEnabled) drawMarginAwarePageNumber(canvas, outputIdx, totalPages, mm2px);
      };

      const patchedBuildAllPages = async function individualMarginAllPages(mm2px, useHi, overridePages) {
        const active = overridePages || parsedPages.filter((page) => !page.excluded);
        const groups = groupByNup(active);
        const output = [];
        for (const group of groups) {
          const { cols, rows } = getLayout(group.n);
          const perPage = cols * rows;
          for (let pageIndex = 0; pageIndex < Math.ceil(group.pages.length / perPage); pageIndex += 1) {
            output.push(patchedBuildOutputPage(
              group.pages,
              pageIndex,
              cols,
              rows,
              mm2px,
              useHi,
              output.length,
            ));
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        output.forEach((canvas, index) => {
          try { patchedApplyDocEdits(canvas, index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-margin] document overlay failed', index, error); }
        });
        return output;
      };

      getSettings = patchedGetSettings;
      buildOutputPage = patchedBuildOutputPage;
      applyDocEdits = patchedApplyDocEdits;
      buildAllPages = patchedBuildAllPages;
      window.getSettings = patchedGetSettings;
      window.buildOutputPage = patchedBuildOutputPage;
      window.applyDocEdits = patchedApplyDocEdits;
      window.buildAllPages = patchedBuildAllPages;
      corePatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-margin] core patch failed', error);
      return false;
    }
  }

  function applyStateMargins(state) {
    if (!state || typeof state !== 'object') return;
    const horizontal = Number(state.marginH ?? 10);
    const vertical = Number(state.marginV ?? 10);
    const values = {
      marginLeft: state.marginLeft ?? state.margin_left_mm ?? horizontal,
      marginRight: state.marginRight ?? state.margin_right_mm ?? horizontal,
      marginTop: state.marginTop ?? state.margin_top_mm ?? vertical,
      marginBottom: state.marginBottom ?? state.margin_bottom_mm ?? vertical,
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = byId(id);
      if (input && Number.isFinite(Number(value))) input.value = String(value);
    });
    if (byId('facingPages')) byId('facingPages').checked = !!state.facingPages;
    syncLegacyMargins();
  }

  function patchSessionState() {
    if (sessionPatched) return true;
    try {
      if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
      const originalCollect = collectEditorState;
      const originalLoad = loadEditorSession;
      collectEditorState = function collectStateWithIndividualMargins() {
        const state = originalCollect();
        const margins = baseMargins();
        state.marginLeft = margins.left;
        state.marginRight = margins.right;
        state.marginTop = margins.top;
        state.marginBottom = margins.bottom;
        state.facingPages = isFacingPages();
        return state;
      };
      loadEditorSession = async function loadStateWithIndividualMargins(data, documentId) {
        const previousPages = parsedPages;
        const result = await originalLoad(data, documentId);
        if (parsedPages !== previousPages) {
          try { applyStateMargins(JSON.parse(data.state || '{}')); } catch (_) {}
          requestPreview();
        }
        return result;
      };
      window.collectEditorState = collectEditorState;
      window.loadEditorSession = loadEditorSession;
      sessionPatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-margin] session patch failed', error);
      return false;
    }
  }

  function boot(attempt) {
    installStyles();
    installMarginUi();
    normalizePreviewToolbar();
    observePreviewToolbar();
    const coreReady = patchCoreFunctions();
    const sessionReady = patchSessionState();
    if ((!coreReady || !sessionReady || !byId('livePreviewHint') || !byId('pdfPageCountHint')) && attempt < 12) {
      setTimeout(() => boot(attempt + 1), 180 + attempt * 70);
    }
  }

  window.PdfEditorIndividualMargins = {
    baseMargins,
    effectiveMargins,
    refresh: requestPreview,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
