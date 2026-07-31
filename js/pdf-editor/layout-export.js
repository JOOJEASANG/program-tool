// PDF editor layout export and independent paper-margin module.
// Keeps the stable eight-module runtime while aligning preview, sessions, and export.
(function () {
  'use strict';
  if (window.__pdfEditorLayoutExportV6) return;
  window.__pdfEditorLayoutExportV6 = true;

  const MARGIN_IDS = ['marginLeft', 'marginRight', 'marginTop', 'marginBottom'];
  let previewCorePatched = false;
  let sessionBridgePatched = false;

  function $(id) { return document.getElementById(id); }

  function num(id, fallback) {
    const value = Number($(id) && $(id).value);
    return Number.isFinite(value) ? Math.max(0, Math.min(80, value)) : fallback;
  }

  function marginValues() {
    const horizontal = num('marginH', 10);
    const vertical = num('marginV', 10);
    return {
      left: num('marginLeft', horizontal),
      right: num('marginRight', horizontal),
      top: num('marginTop', vertical),
      bottom: num('marginBottom', vertical),
    };
  }

  function facingEnabled() {
    try { return !!facingPages; }
    catch (_) { return !!$('facingPages')?.checked; }
  }

  function effectiveMargins(outputPageIndex) {
    const margins = marginValues();
    if (facingEnabled() && Number(outputPageIndex) % 2 === 1) {
      [margins.left, margins.right] = [margins.right, margins.left];
    }
    return margins;
  }

  function syncLegacyMargins() {
    const margins = marginValues();
    if ($('marginH')) $('marginH').value = String((margins.left + margins.right) / 2);
    if ($('marginV')) $('marginV').value = String((margins.top + margins.bottom) / 2);
  }

  function requestPreview() {
    syncLegacyMargins();
    try {
      if (window.PdfLivePreview && typeof window.PdfLivePreview.request === 'function') {
        window.PdfLivePreview.request(180, false);
      } else if (typeof schedulePreview === 'function') {
        schedulePreview(180);
      } else if (typeof triggerPreview === 'function') {
        setTimeout(() => triggerPreview(), 50);
      }
    } catch (_) {}
  }

  function installMarginStyles() {
    if ($('pdfIndependentMarginStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'pdfIndependentMarginStylesV2';
    style.textContent = `
      .pdf-legacy-paired-margin{display:none!important}
      .pdf-margin-panel-v2{margin:2px 0 9px;padding:10px;border:1px solid #dbe5ef;border-radius:11px;background:linear-gradient(180deg,#fbfdff,#f7fafc)}
      .pdf-margin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;color:#334155;font-size:10px;font-weight:900}
      .pdf-margin-panel-head small{color:#94a3b8;font-size:9px;font-weight:700}
      .pdf-margin-grid-v2{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
      .pdf-margin-grid-v2 .field{min-width:0;margin:0!important}
      .pdf-margin-grid-v2 label{font-size:10px;text-align:center;color:#475569}
      .pdf-margin-grid-v2 input{padding:7px 5px!important;text-align:center;font-weight:800}
      .pdf-margin-facing-note{margin-top:8px;padding-top:7px;border-top:1px solid #e5eaf0;color:#64748b;font-size:9px;font-weight:700;line-height:1.5}
      .pdf-paper-spacing-grid-v2>.field:not(.pdf-legacy-paired-margin){grid-column:1/-1}
      @media(max-width:900px){.pdf-margin-grid-v2{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function updateFacingNote() {
    const note = $('pdfMarginFacingNoteV2');
    if (!note) return;
    note.textContent = facingEnabled()
      ? '양면 마주보기 사용 중: 짝수 출력면은 좌·우 여백을 자동으로 서로 바꿉니다.'
      : '양면 마주보기를 켜면 짝수 출력면의 좌·우 여백이 자동으로 서로 바뀝니다.';
  }

  function installMarginUi() {
    const horizontal = $('marginH');
    const vertical = $('marginV');
    if (!horizontal || !vertical) return false;

    let panel = $('individualPaperMarginsV2');
    if (!panel) {
      const legacyGrid = horizontal.closest('.grid2');
      if (!legacyGrid || !legacyGrid.parentElement) return false;
      legacyGrid.classList.add('pdf-paper-spacing-grid-v2');
      horizontal.closest('.field')?.classList.add('pdf-legacy-paired-margin');
      vertical.closest('.field')?.classList.add('pdf-legacy-paired-margin');

      panel = document.createElement('div');
      panel.id = 'individualPaperMarginsV2';
      panel.className = 'pdf-margin-panel-v2';
      panel.innerHTML = `
        <div class="pdf-margin-panel-head"><span>용지 개별 여백 (mm)</span><small>좌·우·상·하 각각 입력</small></div>
        <div class="pdf-margin-grid-v2">
          <div class="field"><label for="marginLeft">왼쪽</label><input id="marginLeft" type="number" value="${num('marginH', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginRight">오른쪽</label><input id="marginRight" type="number" value="${num('marginH', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginTop">위쪽</label><input id="marginTop" type="number" value="${num('marginV', 10)}" min="0" max="80" step="0.5"></div>
          <div class="field"><label for="marginBottom">아래쪽</label><input id="marginBottom" type="number" value="${num('marginV', 10)}" min="0" max="80" step="0.5"></div>
        </div>
        <div class="pdf-margin-facing-note" id="pdfMarginFacingNoteV2"></div>`;
      legacyGrid.parentElement.insertBefore(panel, legacyGrid);
    }

    MARGIN_IDS.forEach((id) => {
      const input = $(id);
      if (!input || input.dataset.independentMarginBoundV2) return;
      input.dataset.independentMarginBoundV2 = 'true';
      input.addEventListener('input', requestPreview);
      input.addEventListener('change', requestPreview);
    });

    const facing = $('facingPages');
    if (facing && !facing.dataset.independentMarginBoundV2) {
      facing.dataset.independentMarginBoundV2 = 'true';
      facing.addEventListener('change', () => {
        updateFacingNote();
        requestPreview();
      });
    }

    syncLegacyMargins();
    updateFacingNote();
    return true;
  }

  function patchSettings(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    const margins = marginValues();
    settings.margin_left_mm = margins.left;
    settings.margin_right_mm = margins.right;
    settings.margin_top_mm = margins.top;
    settings.margin_bottom_mm = margins.bottom;
    // Keep paired values for backward compatibility with older Functions revisions.
    settings.margin_h_mm = (margins.left + margins.right) / 2;
    settings.margin_v_mm = (margins.top + margins.bottom) / 2;
    settings.gap_mm = num('gap', 5);
    settings.facing_pages = facingEnabled();
    settings.page_numbers = settings.page_numbers || {};
    settings.page_numbers.auto_reserve_space = !($('pnAutoReserve') && !$('pnAutoReserve').checked);
    return settings;
  }

  function patchPreviewCore() {
    if (previewCorePatched) return true;
    try {
      if (
        typeof getSettings !== 'function' ||
        typeof buildOutputPage !== 'function' ||
        typeof buildAllPages !== 'function' ||
        typeof applyDocEdits !== 'function' ||
        typeof groupByNup !== 'function' ||
        typeof getLayout !== 'function' ||
        typeof getPageSrc !== 'function' ||
        typeof drawPageInCell !== 'function'
      ) return false;

      const originalGetSettings = getSettings;

      const patchedGetSettings = function independentMarginSettings() {
        const settings = originalGetSettings.apply(this, arguments) || {};
        const margins = marginValues();
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

      const patchedBuildOutputPage = function independentMarginOutputPage(
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
        const output = document.createElement('canvas');
        output.width = Math.round(pw * mm2px);
        output.height = Math.round(ph * mm2px);
        output.dataset.marginLeftMm = String(margins.left);
        output.dataset.marginRightMm = String(margins.right);
        output.dataset.marginTopMm = String(margins.top);
        output.dataset.marginBottomMm = String(margins.bottom);
        const context = output.getContext('2d');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, output.width, output.height);

        for (let slot = 0; slot < perPage; slot += 1) {
          const sourceIndex = pageIdx * perPage + slot;
          if (sourceIndex >= groupPages.length) break;
          let column;
          let row;
          const rowMajor = typeof orderLR === 'undefined' ? true : !!orderLR;
          if (rowMajor) {
            column = slot % cols;
            row = Math.floor(slot / cols);
          } else {
            column = Math.floor(slot / rows);
            row = slot % rows;
          }
          const cellX = (margins.left + column * (cellW + gp)) * mm2px;
          const cellY = (margins.top + row * (cellH + gp)) * mm2px;
          const source = getPageSrc(groupPages[sourceIndex], mm2px, useHi);
          drawPageInCell(context, source, cellX, cellY, cellW * mm2px, cellH * mm2px);
        }
        return output;
      };

      const patchedBuildAllPages = async function independentMarginAllPages(mm2px, useHi, overridePages) {
        const active = overridePages || parsedPages.filter((page) => !page.excluded);
        const output = [];
        for (const group of groupByNup(active)) {
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
          try { applyDocEdits(canvas, index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-margin] document overlay failed', index, error); }
        });
        return output;
      };

      getSettings = patchedGetSettings;
      buildOutputPage = patchedBuildOutputPage;
      buildAllPages = patchedBuildAllPages;
      window.getSettings = patchedGetSettings;
      window.buildOutputPage = patchedBuildOutputPage;
      window.buildAllPages = patchedBuildAllPages;
      previewCorePatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-margin] preview patch failed', error);
      return false;
    }
  }

  function applyStateMargins(state) {
    if (!state || typeof state !== 'object') return;
    const horizontal = Number(state.marginH ?? state.margin_h_mm ?? 10);
    const vertical = Number(state.marginV ?? state.margin_v_mm ?? 10);
    const values = {
      marginLeft: state.marginLeft ?? state.margin_left_mm ?? horizontal,
      marginRight: state.marginRight ?? state.margin_right_mm ?? horizontal,
      marginTop: state.marginTop ?? state.margin_top_mm ?? vertical,
      marginBottom: state.marginBottom ?? state.margin_bottom_mm ?? vertical,
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = $(id);
      if (input && Number.isFinite(Number(value))) input.value = String(value);
    });
    syncLegacyMargins();
    updateFacingNote();
  }

  function patchSessionBridge() {
    if (sessionBridgePatched) return true;
    try {
      if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
      if (collectEditorState.__individualMarginsV2 && loadEditorSession.__individualMarginsV2) {
        sessionBridgePatched = true;
        return true;
      }

      const originalCollect = collectEditorState;
      const originalLoad = loadEditorSession;

      const collectWithMargins = function collectWithMargins() {
        const state = originalCollect.apply(this, arguments);
        const margins = marginValues();
        state.marginLeft = margins.left;
        state.marginRight = margins.right;
        state.marginTop = margins.top;
        state.marginBottom = margins.bottom;
        state.margin_left_mm = margins.left;
        state.margin_right_mm = margins.right;
        state.margin_top_mm = margins.top;
        state.margin_bottom_mm = margins.bottom;
        return state;
      };
      collectWithMargins.__individualMarginsV2 = true;

      const loadWithMargins = async function loadWithMargins(data, documentId) {
        let previousPages = null;
        try { previousPages = parsedPages; } catch (_) {}
        const result = await originalLoad.apply(this, arguments);
        let loaded = false;
        try { loaded = Array.isArray(parsedPages) && parsedPages !== previousPages; } catch (_) {}
        if (loaded) {
          try {
            const state = typeof data?.state === 'string' ? JSON.parse(data.state) : (data?.state || {});
            applyStateMargins(state);
            requestPreview();
          } catch (error) {
            console.warn('[pdf-margin] saved margins could not be restored', error);
          }
        }
        return result;
      };
      loadWithMargins.__individualMarginsV2 = true;

      collectEditorState = collectWithMargins;
      loadEditorSession = loadWithMargins;
      window.collectEditorState = collectWithMargins;
      window.loadEditorSession = loadWithMargins;
      sessionBridgePatched = true;
      return true;
    } catch (error) {
      console.warn('[pdf-margin] session bridge failed', error);
      return false;
    }
  }

  function endpointPath(input) {
    try {
      const raw = typeof input === 'string' ? input : input?.url;
      if (!raw) return '';
      const url = new URL(raw, location.href);
      if (url.origin !== location.origin) return '';
      return url.pathname.replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  function wrapApiProcessPdf() {
    if (window.__pdfLayoutApiWrappedV6 || typeof window.apiProcessPdf !== 'function') return false;
    const original = window.apiProcessPdf;
    const wrapped = function layoutPatchedApiProcessPdf(files, settings, options) {
      return original.call(this, files, patchSettings(settings), options);
    };
    wrapped.__pdfLayoutApiWrappedV6 = true;
    window.apiProcessPdf = wrapped;
    try { apiProcessPdf = wrapped; } catch (_) {}
    window.__pdfLayoutApiWrappedV6 = true;
    return true;
  }

  function wrapFetch() {
    if (window.__pdfLayoutFetchWrappedV6) return true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = function layoutPatchedFetch(input, init) {
      try {
        const path = endpointPath(input);
        if (path === '/api/pdf/process' && init && init.body instanceof FormData) {
          const raw = init.body.get('settings');
          if (raw) init.body.set('settings', JSON.stringify(patchSettings(JSON.parse(raw))));
        } else if (path === '/api/pdf/process-storage' && init && typeof init.body === 'string') {
          const body = JSON.parse(init.body);
          if (body && body.settings) {
            body.settings = patchSettings(body.settings);
            init.body = JSON.stringify(body);
          }
        }
      } catch (error) {
        console.warn('[pdf-layout] settings patch failed', error);
      }
      return originalFetch(input, init);
    };
    window.__pdfLayoutFetchWrappedV6 = true;
    return true;
  }

  function boot(attempt) {
    installMarginStyles();
    const uiReady = installMarginUi();
    const previewReady = patchPreviewCore();
    const sessionReady = patchSessionBridge();
    const apiReady = wrapApiProcessPdf();
    wrapFetch();
    if ((!uiReady || !previewReady || !sessionReady || !apiReady) && attempt < 12) {
      setTimeout(() => boot(attempt + 1), 180 + attempt * 70);
    }
  }

  window.PdfEditorLayoutExport = {
    patchSettings,
    marginValues,
    effectiveMargins,
    applyStateMargins,
    endpointPath,
    refresh: requestPreview,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
