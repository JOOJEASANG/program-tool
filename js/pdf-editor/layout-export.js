// PDF editor layout export, independent margins, and page-number space module.
// Keeps the stable eight-module runtime while aligning preview, sessions, and export.
(function () {
  'use strict';
  if (window.__pdfEditorLayoutExportV8) return;
  window.__pdfEditorLayoutExportV8 = true;

  const MARGIN_IDS = ['marginLeft', 'marginRight', 'marginTop', 'marginBottom'];
  const CELL_EDGES = ['left', 'right', 'top', 'bottom'];
  let cellMarginObserver = null;
  let cellMarginSyncQueued = false;
  const PT_TO_MM = 25.4 / 72;
  const FALLBACK_MARGIN_MM = 10 * PT_TO_MM;
  const FALLBACK_GAP_MM = 6 * PT_TO_MM;
  const PAGE_NUMBER_MIN_FONT_PT = 5;
  const PAGE_NUMBER_MAX_FONT_PT = 72;
  const PAGE_NUMBER_HEIGHT_FACTOR = 1.8;
  const PAGE_NUMBER_PADDING_MM = 2;
  let previewCorePatched = false;
  let sessionBridgePatched = false;

  function $(id) { return document.getElementById(id); }

  function boundedNumber(id, fallback, min, max) {
    const value = Number($(id) && $(id).value);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  }

  function num(id, fallback) {
    return boundedNumber(id, fallback, 0, 80);
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

  function pageNumbersEnabled() {
    try { return !!pnEnabled; }
    catch (_) { return !!$('pnEnabled')?.checked; }
  }

  function pageNumberPosition() {
    try { return String(pnPosition || 'bottom-center'); }
    catch (_) {
      return document.querySelector('.pn-pos-btn.active')?.dataset?.pos || 'bottom-center';
    }
  }

  function pageNumberAutoReserveEnabled() {
    const checkbox = $('pnAutoReserve');
    return !checkbox || checkbox.checked;
  }

  function pageNumberApplies(outputPageIndex) {
    if (!pageNumbersEnabled()) return false;
    const index = Number.isInteger(Number(outputPageIndex)) ? Number(outputPageIndex) : 0;
    let excludeFirst = false;
    let applyTo = 'all';
    try {
      excludeFirst = !!pnExcludeFirst;
      applyTo = String(pnApplyTo || 'all');
    } catch (_) {
      excludeFirst = !!$('pnExcludeFirst')?.checked;
      applyTo = String($('pnApplyTo')?.value || 'all');
    }
    const first = Math.max(1, Math.trunc(Number($('pnStartPage')?.value) || 1), excludeFirst ? 2 : 1);
    const endRaw = $('pnEndPage')?.value?.trim();
    const last = endRaw ? Math.trunc(Number(endRaw)) : Infinity;
    if (index + 1 < first || index + 1 > last) return false;
    const isOddPage = index % 2 === 0;
    return applyTo === 'all'
      || (applyTo === 'odd' && isOddPage)
      || (applyTo === 'even' && !isOddPage);
  }

  function requiredPageNumberSpaceMm(edgeMargin) {
    const paperEdge = Math.max(0, Number(edgeMargin) || 0);
    const dedicated = boundedNumber('pnMarginMm', 5, 0, 80);
    const anchor = Math.max(paperEdge, dedicated);
    const fontSize = boundedNumber(
      'pnFontSize',
      10,
      PAGE_NUMBER_MIN_FONT_PT,
      PAGE_NUMBER_MAX_FONT_PT,
    );
    return Math.min(
      80,
      anchor + fontSize * PT_TO_MM * PAGE_NUMBER_HEIGHT_FACTOR + PAGE_NUMBER_PADDING_MM,
    );
  }

  function layoutMargins(outputPageIndex) {
    const index = Number.isInteger(Number(outputPageIndex)) ? Number(outputPageIndex) : 0;
    const margins = effectiveMargins(index);
    if (!pageNumberAutoReserveEnabled() || !pageNumberApplies(index)) return margins;
    if (pageNumberPosition().startsWith('top-')) {
      margins.top = requiredPageNumberSpaceMm(margins.top);
    } else {
      margins.bottom = requiredPageNumberSpaceMm(margins.bottom);
    }
    return margins;
  }


  // Source-content margins are insets INSIDE an N-up cell, not sheet margins.
  function sourcePages() {
    try { return Array.isArray(parsedPages) ? parsedPages : []; }
    catch (_) { return []; }
  }
  function pageCellMargins(page) {
    const raw = page?.cellMargins || {};
    const values = {};
    for (const edge of CELL_EDGES) {
      const amount = Number(raw[edge]);
      values[edge] = Number.isFinite(amount) ? Math.max(0, Math.min(80, amount)) : 0;
    }
    return values;
  }
  function hasPageCellMargins(page) {
    const values = pageCellMargins(page);
    return CELL_EDGES.some((edge) => values[edge] !== 0);
  }
  function selectedSourcePages() {
    const ids = window.PdfEditorPageSelection?.snapshotSelectedIds?.() || [];
    const selected = new Set(ids.map(String));
    return sourcePages().filter((p) => p?.pageType === 'pdf' && selected.has(String(p.id)));
  }
  function fileSourcePages(index) {
    return sourcePages().filter((p) => p?.pageType === 'pdf' && Number(p.file_index) === Number(index));
  }
  function cellMarginTargets() {
    const scope = $('pdfCellMarginScope')?.value || 'selected';
    if (scope === 'selected') return selectedSourcePages();
    const match = /^file:(\d+)$/.exec(scope);
    return match ? fileSourcePages(Number(match[1])) : [];
  }
  function syncPageCellMarginUi() {
    const select = $('pdfCellMarginScope');
    if (!select) return;
    const selectedValue = select.value || 'selected';
    const names = new Map();
    sourcePages().forEach((p) => {
      const index = Number(p?.file_index);
      if (p?.pageType !== 'pdf' || !Number.isInteger(index) || index < 0 || names.has(index)) return;
      let name = String(p.sourceFile || '').trim();
      try { name = String(uploadedFiles?.[index]?.name || name); } catch (_) {}
      names.set(index, name || '파일');
    });
    const key = JSON.stringify([...names]);
    if (select.dataset.fileOptions !== key) {
      select.replaceChildren(new Option('선택한 페이지', 'selected'));
      for (const [index, name] of names) {
        select.add(new Option('파일 ' + (index + 1) + ' · ' + name, 'file:' + index));
      }
      select.dataset.fileOptions = key;
      select.value = [...select.options].some((o) => o.value === selectedValue) ? selectedValue : 'selected';
    }
    const targets = cellMarginTargets();
    const info = $('pdfCellMarginSummary');
    if (info) info.textContent = targets.length
      ? targets.length + '페이지 대상 · 각 배치 칸 내부에 별도 적용'
      : '왼쪽 페이지 목록을 선택하거나, 위에서 업로드 파일을 선택하세요.';
    for (const edge of CELL_EDGES) {
      const input = $('pdfCellMargin' + edge[0].toUpperCase() + edge.slice(1));
      if (!input) continue;
      input.disabled = !targets.length;
      if (!targets.length) { input.value = '0'; input.placeholder = ''; continue; }
      const first = pageCellMargins(targets[0])[edge];
      const mixed = targets.some((page) => pageCellMargins(page)[edge] !== first);
      input.value = mixed ? '' : String(first);
      input.placeholder = mixed ? '혼합' : '';
    }
    for (const id of ['pdfCellMarginApply', 'pdfCellMarginReset']) {
      if ($(id)) $(id).disabled = !targets.length;
    }
  }
  function applyPageCellMargins(reset = false) {
    const targets = cellMarginTargets();
    if (!targets.length) return;
    const changes = {};
    if (!reset) for (const edge of CELL_EDGES) {
      const input = $('pdfCellMargin' + edge[0].toUpperCase() + edge.slice(1));
      if (!input || input.value.trim() === '') continue; // preserve different existing values
      const amount = Number(input.value);
      if (!Number.isFinite(amount) || amount < 0 || amount > 80) {
        input.setCustomValidity('0~80mm 사이로 입력하세요.');
        input.reportValidity();
        return;
      }
      input.setCustomValidity('');
      changes[edge] = amount;
    }
    targets.forEach((page) => {
      if (reset) { delete page.cellMargins; return; }
      const values = { ...pageCellMargins(page), ...changes };
      if (CELL_EDGES.some((edge) => values[edge] !== 0)) page.cellMargins = values;
      else delete page.cellMargins;
    });
    syncPageCellMarginUi();
    requestPreview();
  }
  function queueCellMarginSync() {
    if (cellMarginSyncQueued) return;
    cellMarginSyncQueued = true;
    queueMicrotask(() => { cellMarginSyncQueued = false; syncPageCellMarginUi(); });
  }
  function installPageCellMarginUi() {
    const paper = $('individualPaperMarginsV2');
    if (!paper) return false;
    if (!$('pdfPageCellMarginsV1')) {
      const section = document.createElement('div');
      section.id = 'pdfPageCellMarginsV1';
      section.className = 'pdf-margin-panel-v2 pdf-cell-margin-panel';
      section.innerHTML = [
        '<div class="pdf-margin-panel-head"><span>페이지/파일별 내용 여백 (mm)</span><small>전체 용지 여백과 별도</small></div>',
        '<label for="pdfCellMarginScope">적용 범위</label>',
        '<select id="pdfCellMarginScope"><option value="selected">선택한 페이지</option></select>',
        '<div class="pdf-margin-grid-v2 pdf-cell-margin-inputs">',
        '<div class="field"><label for="pdfCellMarginLeft">왼쪽</label><input id="pdfCellMarginLeft" type="number" value="0" min="0" max="80" step="0.5"></div>',
        '<div class="field"><label for="pdfCellMarginRight">오른쪽</label><input id="pdfCellMarginRight" type="number" value="0" min="0" max="80" step="0.5"></div>',
        '<div class="field"><label for="pdfCellMarginTop">위쪽</label><input id="pdfCellMarginTop" type="number" value="0" min="0" max="80" step="0.5"></div>',
        '<div class="field"><label for="pdfCellMarginBottom">아래쪽</label><input id="pdfCellMarginBottom" type="number" value="0" min="0" max="80" step="0.5"></div>',
        '</div><div class="pdf-cell-margin-actions">',
        '<button id="pdfCellMarginApply" type="button">대상에 적용</button>',
        '<button id="pdfCellMarginReset" type="button">대상 여백 초기화</button>',
        '</div><div id="pdfCellMarginSummary" class="pdf-margin-facing-note" role="status"></div>',
        '<small class="pdf-cell-margin-tip">값이 서로 다르면 혼합으로 표시되며 빈 입력란은 변경하지 않습니다. 반복배치에도 각 재단 칸마다 적용됩니다.</small>',
      ].join('');
      paper.insertAdjacentElement('afterend', section);
      $('pdfCellMarginScope').addEventListener('change', syncPageCellMarginUi);
      $('pdfCellMarginApply').addEventListener('click', () => applyPageCellMargins());
      $('pdfCellMarginReset').addEventListener('click', () => applyPageCellMargins(true));
      document.addEventListener('click', (event) => {
        if (event.target.closest('#thumbArea, #pageSelectionToolbar')) queueCellMarginSync();
      }, true);
    }
    if (!cellMarginObserver && $('thumbArea')) {
      cellMarginObserver = new MutationObserver(queueCellMarginSync);
      cellMarginObserver.observe($('thumbArea'), { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    syncPageCellMarginUi();
    return true;
  }
  function restorePageCellMargins(state) {
    const saved = Array.isArray(state?.pageCellMargins) ? state.pageCellMargins : [];
    sourcePages().forEach((page, i) => {
      if (!saved[i] || typeof saved[i] !== 'object') { delete page.cellMargins; return; }
      const values = pageCellMargins({ cellMargins: saved[i] });
      if (CELL_EDGES.some((edge) => values[edge] !== 0)) page.cellMargins = values;
      else delete page.cellMargins;
    });
    syncPageCellMarginUi();
  }

  function syncLegacyMargins() {
    const margins = marginValues();
    if ($('marginH')) $('marginH').value = String((margins.left + margins.right) / 2);
    if ($('marginV')) $('marginV').value = String((margins.top + margins.bottom) / 2);
  }

  function updatePageNumberReserveHint() {
    const hint = $('pnAutoReserveHint');
    if (!hint) return;
    if (!pageNumbersEnabled()) {
      hint.textContent = '페이지 번호를 켜면 번호와 본문 사이의 필요한 공간을 자동 계산합니다.';
      return;
    }
    if (!pageNumberAutoReserveEnabled()) {
      hint.textContent = '자동 확보가 꺼져 있어 페이지 번호가 본문과 겹칠 수 있습니다.';
      return;
    }
    const sampleIndex = [0, 1, 2, 3].find((index) => pageNumberApplies(index)) ?? 0;
    const margins = layoutMargins(sampleIndex);
    const top = pageNumberPosition().startsWith('top-');
    const value = top ? margins.top : margins.bottom;
    hint.textContent = `${top ? '상단' : '하단'} 본문 여백을 최소 ${value.toFixed(1)}mm로 확보합니다.`;
  }

  function requestPreview() {
    syncLegacyMargins();
    updatePageNumberReserveHint();
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
      .pdf-cell-margin-panel{background:#fff;border-color:#cbd5e1}
      .pdf-cell-margin-panel select{width:100%;margin-bottom:8px;padding:7px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:11px}
      .pdf-cell-margin-inputs{margin-bottom:7px}
      .pdf-cell-margin-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .pdf-cell-margin-actions button{padding:7px 5px;border:1px solid #cbd5e1;border-radius:7px;font-size:10px;font-weight:800;color:#334155;background:#f8fafc;cursor:pointer}
      .pdf-cell-margin-actions button:first-child{background:#1d4ed8;border-color:#1d4ed8;color:#fff}
      .pdf-cell-margin-actions button:disabled{opacity:.45;cursor:not-allowed}
      .pdf-cell-margin-tip{display:block;margin-top:6px;color:#64748b;font-size:9px;line-height:1.5}
      .pdf-paper-spacing-grid-v2>.field:not(.pdf-legacy-paired-margin){grid-column:1/-1}
      .pdf-page-number-reserve-row{display:flex;align-items:flex-start;gap:7px;margin:7px 0 2px;padding:8px 9px;border:1px solid #dbeafe;border-radius:9px;background:#eff6ff;line-height:1.45}
      .pdf-page-number-reserve-row input{flex:0 0 auto;margin-top:2px}
      .pdf-page-number-reserve-row strong{display:block;font-size:11px;color:#1e3a8a}
      .pdf-page-number-reserve-row small{display:block;margin-top:2px;font-size:9px;font-weight:650;color:#64748b}
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

  function installPageNumberReserveUi() {
    const settings = $('pnSettings');
    if (!settings) return false;
    let row = $('pnAutoReserveRow');
    if (!row) {
      row = document.createElement('label');
      row.id = 'pnAutoReserveRow';
      row.className = 'checkline pdf-page-number-reserve-row';
      row.innerHTML = '<input type="checkbox" id="pnAutoReserve" checked><span><strong>페이지 번호 공간 자동 확보</strong><small id="pnAutoReserveHint"></small></span>';
      const target = $('pnMarginMm')?.closest('.grid2');
      if (target) target.insertAdjacentElement('afterend', row);
      else settings.appendChild(row);
    }

    const checkbox = $('pnAutoReserve');
    if (checkbox && !checkbox.dataset.layoutReserveBoundV8) {
      checkbox.dataset.layoutReserveBoundV8 = 'true';
      checkbox.addEventListener('change', requestPreview);
    }
    ['pnEnabled', 'pnMarginMm', 'pnFontSize', 'pnApplyTo', 'pnExcludeFirst', 'pnStartPage', 'pnEndPage'].forEach((id) => {
      const input = $(id);
      if (!input || input.dataset.layoutReserveInputBoundV8) return;
      input.dataset.layoutReserveInputBoundV8 = 'true';
      input.addEventListener('input', requestPreview);
      input.addEventListener('change', requestPreview);
    });
    if (!window.__pdfPageNumberPositionBoundV8) {
      window.__pdfPageNumberPositionBoundV8 = true;
      document.addEventListener('click', (event) => {
        if (event.target.closest('.pn-pos-btn')) setTimeout(requestPreview, 0);
      }, true);
    }
    updatePageNumberReserveHint();
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
    settings.page_numbers.auto_reserve_space = pageNumberAutoReserveEnabled();
    if (Array.isArray(settings.pages)) {
      const pages = sourcePages();
      settings.pages = settings.pages.map((entry, index) => {
        const inset = pageCellMargins(pages[index]);
        return { ...entry,
          content_margin_left_mm: inset.left,
          content_margin_right_mm: inset.right,
          content_margin_top_mm: inset.top,
          content_margin_bottom_mm: inset.bottom,
        };
      });
    }
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
        repeated = false,
        totalOutputPages = 1,
      ) {
        const { pw, ph, gp } = patchedGetSettings();
        const resolvedOutputIndex = Number.isInteger(outputPageIndex) ? outputPageIndex : pageIdx;
        const numberSpaceRequested = pageNumberAutoReserveEnabled()
          && pageNumberApplies(resolvedOutputIndex);
        let margins = layoutMargins(resolvedOutputIndex);
        // In repeat mode each cut-out tile is an independent print. Margins
        // apply inside EACH half/quarter rather than only at paper edges.
        let layoutGap = gp;
        if (repeated) layoutGap = 0;
        const cutWidth = pw / cols;
        const cutHeight = ph / rows;
        let usableWidth = repeated
          ? cutWidth - margins.left - margins.right
          : pw - margins.left - margins.right - layoutGap * (cols - 1);
        let usableHeight = repeated
          ? cutHeight - margins.top - margins.bottom
          : ph - margins.top - margins.bottom - layoutGap * (rows - 1);
        if (repeated && (usableWidth <= 1 || usableHeight <= 1)) {
          throw new Error('반복배치의 개별 재단 영역보다 여백이 큽니다. 상하좌우 여백을 줄여 주세요.');
        }
        if (usableWidth <= 1 || usableHeight <= 1) {
          margins = {
            left: FALLBACK_MARGIN_MM,
            right: FALLBACK_MARGIN_MM,
            top: FALLBACK_MARGIN_MM,
            bottom: FALLBACK_MARGIN_MM,
          };
          layoutGap = FALLBACK_GAP_MM;
          usableWidth = pw - margins.left - margins.right - layoutGap * (cols - 1);
          usableHeight = ph - margins.top - margins.bottom - layoutGap * (rows - 1);
        }

        const cellW = repeated ? usableWidth : usableWidth / cols;
        const cellH = repeated ? usableHeight : usableHeight / rows;
        const perPage = cols * rows;
        const output = document.createElement('canvas');
        output.width = Math.round(pw * mm2px);
        output.height = Math.round(ph * mm2px);
        output.dataset.marginLeftMm = String(margins.left);
        output.dataset.marginRightMm = String(margins.right);
        output.dataset.marginTopMm = String(margins.top);
        output.dataset.marginBottomMm = String(margins.bottom);
        output.dataset.gapMm = String(layoutGap);
        output.dataset.pageNumberAutoReserve = numberSpaceRequested ? 'true' : 'false';
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
          const cutX = column * cutWidth;
          const cutY = row * cutHeight;
          const cellX = (margins.left + (repeated ? cutX : column * (cellW + layoutGap))) * mm2px;
          const cellY = (margins.top + (repeated ? cutY : row * (cellH + layoutGap))) * mm2px;
          const sourcePage = groupPages[sourceIndex];
          const source = getPageSrc(sourcePage, mm2px, useHi);
          const inset = pageCellMargins(sourcePage);
          const innerW = cellW - inset.left - inset.right;
          const innerH = cellH - inset.top - inset.bottom;
          if (innerW <= 25.4 / 72 || innerH <= 25.4 / 72) {
            throw new Error('페이지 개별 내용 여백이 배치 칸보다 큽니다. 해당 페이지의 여백을 줄여 주세요.');
          }
          drawPageInCell(context, source,
            cellX + inset.left * mm2px, cellY + inset.top * mm2px,
            innerW * mm2px, innerH * mm2px);
          if (repeated) {
            const overlay = document.createElement('canvas');
            overlay.width = Math.max(1, Math.round(cutWidth * mm2px));
            overlay.height = Math.max(1, Math.round(cutHeight * mm2px));
            applyDocEdits(overlay, resolvedOutputIndex, totalOutputPages, mm2px);
            // Overlay positions (page numbers, headers, footers) are relative
            // to the full cut-out print, not the inset content rectangle.
            context.drawImage(overlay, cutX * mm2px, cutY * mm2px,
              cutWidth * mm2px, cutHeight * mm2px);
          }
        }
        return output;
      };

      const patchedBuildAllPages = async function independentMarginAllPages(mm2px, useHi, overridePages) {
        const active = overridePages || parsedPages.filter((page) => !page.excluded);
        const output = [];
        const groups = groupByNup(active);
        const totalOutputPages = groups.reduce((total, group) => {
          const layout = getLayout(group.n);
          return total + Math.ceil(group.pages.length / (layout.cols * layout.rows));
        }, 0);
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
              !!group.repeated,
              totalOutputPages,
            ));
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        const repeatMode = !!window.PdfEditorNupRepeat?.enabled?.();
        output.forEach((canvas, index) => {
          if (repeatMode) return; // Repeated cell overlays are applied per placement.
          try { applyDocEdits(canvas, index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-margin] document overlay failed', index, error); }
        });
        return output;
      };

      // Used by the large-document preview to match the optional argument order.
      patchedBuildOutputPage.__pdfIndependentMarginOutputV3 = true;
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
    const savedFacing = state.facingPages ?? state.facing_pages;
    if (typeof savedFacing === 'boolean') {
      const facingInput = $('facingPages');
      if (facingInput) facingInput.checked = savedFacing;
      try { facingPages = savedFacing; } catch (_) {}
    }
    const reserveInput = $('pnAutoReserve');
    if (reserveInput) {
      const savedReserve = state.pnAutoReserve ?? state.page_numbers?.auto_reserve_space;
      reserveInput.checked = savedReserve !== false;
    }
    syncLegacyMargins();
    updateFacingNote();
    updatePageNumberReserveHint();
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
        state.pnAutoReserve = pageNumberAutoReserveEnabled();
        state.pageCellMargins = sourcePages().map((page) =>
          hasPageCellMargins(page) ? pageCellMargins(page) : null);
        return state;
      };
      collectWithMargins.__individualMarginsV2 = true;

      const loadWithMargins = async function loadWithMargins(data, documentId) {
        let previousPages = null;
        try { previousPages = parsedPages; } catch (_) {}
        const result = await originalLoad.apply(this, arguments);
        if (result === false) return false;
        let loaded = false;
        try { loaded = Array.isArray(parsedPages) && parsedPages !== previousPages; } catch (_) {}
        if (loaded) {
          try {
            const state = typeof data?.state === 'string' ? JSON.parse(data.state) : (data?.state || {});
            applyStateMargins(state);
            restorePageCellMargins(state);
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
    if (window.__pdfLayoutApiWrappedV8 || typeof window.apiProcessPdf !== 'function') return false;
    const original = window.apiProcessPdf;
    const wrapped = function layoutPatchedApiProcessPdf(files, settings, options) {
      return original.call(this, files, patchSettings(settings), options);
    };
    wrapped.__pdfLayoutApiWrappedV8 = true;
    window.apiProcessPdf = wrapped;
    try { apiProcessPdf = wrapped; } catch (_) {}
    window.__pdfLayoutApiWrappedV8 = true;
    return true;
  }

  function wrapFetch() {
    if (window.__pdfLayoutFetchWrappedV8) return true;
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
    window.__pdfLayoutFetchWrappedV8 = true;
    return true;
  }

  function boot(attempt) {
    installMarginStyles();
    const marginUiReady = installMarginUi();
    const cellMarginUiReady = installPageCellMarginUi();
    const pageNumberUiReady = installPageNumberReserveUi();
    const previewReady = patchPreviewCore();
    const sessionReady = patchSessionBridge();
    const apiReady = wrapApiProcessPdf();
    wrapFetch();
    if ((!marginUiReady || !cellMarginUiReady || !pageNumberUiReady || !previewReady || !sessionReady || !apiReady) && attempt < 12) {
      setTimeout(() => boot(attempt + 1), 180 + attempt * 70);
    }
  }

  window.PdfEditorLayoutExport = {
    patchSettings,
    marginValues,
    pageCellMargins,
    selectedSourcePages,
    fileSourcePages,
    applyPageCellMargins,
    syncPageCellMarginUi,
    effectiveMargins,
    layoutMargins,
    pageNumberApplies,
    requiredPageNumberSpaceMm,
    pageNumberAutoReserveEnabled,
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
