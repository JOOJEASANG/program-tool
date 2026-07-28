// Crop marks and reserved bleed workspace for PDF preview and export.
(function () {
  'use strict';
  if (window.__pdfPrintMarksBleedV1) return;
  window.__pdfPrintMarksBleedV1 = true;

  const byId = (id) => document.getElementById(id);
  let buildPatched = false;
  let sessionPatched = false;
  let summaryObserver = null;
  let attempts = 0;

  function editorReady() {
    try {
      return typeof buildAllPages === 'function' && typeof getSettings === 'function';
    } catch (_) {
      return false;
    }
  }

  function numberValue(id, fallback, minimum, maximum) {
    const value = Number(byId(id)?.value);
    const resolved = Number.isFinite(value) ? value : fallback;
    return Math.max(minimum, Math.min(maximum, resolved));
  }

  function enabled() {
    return !!byId('printMarksEnabled')?.checked;
  }

  function settings() {
    return {
      enabled: enabled(),
      bleed_mm: numberValue('printBleedMm', 3, 0, 15),
      mark_length_mm: numberValue('printMarkLengthMm', 5, 2, 15),
      mark_offset_mm: numberValue('printMarkOffsetMm', 2, 0, 10),
      edge_padding_mm: 2,
    };
  }

  function requestPreview() {
    if (window.PdfPreviewController) {
      window.PdfPreviewController.request(180, false);
      return;
    }
    try { if (typeof schedulePreview === 'function') schedulePreview(180); } catch (_) {}
  }

  function installStyles() {
    if (byId('pdfPrintMarksStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPrintMarksStyles';
    style.textContent = `
      .print-marks-panel{margin:9px 0;padding:10px;border:1px solid #dbe5ef;border-radius:11px;background:linear-gradient(180deg,#fbfdff,#f8fafc)}
      .print-marks-toggle{display:flex!important;align-items:flex-start!important;gap:7px!important;margin:0!important;line-height:1.45}
      .print-marks-copy{display:flex;flex-direction:column;gap:2px}
      .print-marks-copy strong{font-size:11px;color:#334155}
      .print-marks-copy small{font-size:9px;color:#7c899a;font-weight:650}
      .print-marks-settings{display:none;margin-top:9px;padding-top:9px;border-top:1px solid #e5e7eb}
      .print-marks-settings.open{display:block}
      .print-marks-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
      .print-marks-grid .field{margin:0!important;min-width:0}
      .print-marks-grid label{font-size:9px;text-align:center;color:#475569}
      .print-marks-grid input{padding:7px 5px!important;text-align:center;font-weight:800}
      .print-marks-warning{margin-top:8px;padding:8px 9px;border:1px solid #fde68a;border-radius:8px;background:#fffbeb;color:#92400e;font-size:9px;font-weight:750;line-height:1.55}
      #previewScroll .page-preview.print-marks-preview canvas{background:#fff}
      #previewScroll .print-marks-preview-note{font-size:8px;line-height:1.45;color:#92400e;font-weight:750;text-align:center;padding:4px 6px;background:#fffbeb;border-top:1px solid #fde68a}
      @media(max-width:420px){.print-marks-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    const paperBody = byId('sb-paper');
    if (!paperBody) return false;
    let panel = byId('printMarksPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'printMarksPanel';
      panel.className = 'print-marks-panel';
      panel.innerHTML = `
        <label class="checkline print-marks-toggle">
          <input type="checkbox" id="printMarksEnabled">
          <span class="print-marks-copy"><strong>재단선·도련 작업영역 추가</strong><small>완성 규격 바깥에 재단 여유와 인쇄용 재단선을 만듭니다.</small></span>
        </label>
        <div class="print-marks-settings" id="printMarksSettings">
          <div class="print-marks-grid">
            <div class="field"><label for="printBleedMm">도련 여유(mm)</label><input id="printBleedMm" type="number" value="3" min="0" max="15" step="0.5"></div>
            <div class="field"><label for="printMarkLengthMm">재단선 길이(mm)</label><input id="printMarkLengthMm" type="number" value="5" min="2" max="15" step="0.5"></div>
            <div class="field"><label for="printMarkOffsetMm">선 간격(mm)</label><input id="printMarkOffsetMm" type="number" value="2" min="0" max="10" step="0.5"></div>
          </div>
          <div class="print-marks-warning">원본 그림이나 배경은 자동으로 바깥까지 늘어나지 않습니다. 실제 도련 인쇄가 필요하면 원본 PDF 자체에 가장자리 그림이 포함되어 있어야 합니다.</div>
        </div>`;
      const margins = byId('individualPaperMargins');
      if (margins?.parentElement === paperBody) margins.insertAdjacentElement('afterend', panel);
      else paperBody.appendChild(panel);
    }

    const checkbox = byId('printMarksEnabled');
    const inputs = ['printBleedMm', 'printMarkLengthMm', 'printMarkOffsetMm'];
    if (checkbox && !checkbox.dataset.printMarksBound) {
      checkbox.dataset.printMarksBound = '1';
      checkbox.addEventListener('change', () => {
        syncUi();
        requestPreview();
      });
    }
    inputs.forEach((id) => {
      const input = byId(id);
      if (!input || input.dataset.printMarksBound) return;
      input.dataset.printMarksBound = '1';
      input.addEventListener('input', requestPreview);
      input.addEventListener('change', requestPreview);
    });
    syncUi();
    return true;
  }

  function syncUi() {
    byId('printMarksSettings')?.classList.toggle('open', enabled());
  }

  function geometry(mm2px) {
    const config = settings();
    return {
      bleed: config.bleed_mm * mm2px,
      length: config.mark_length_mm * mm2px,
      offset: config.mark_offset_mm * mm2px,
      padding: config.edge_padding_mm * mm2px,
      outer: (config.bleed_mm + config.mark_length_mm + config.mark_offset_mm + config.edge_padding_mm) * mm2px,
    };
  }

  function drawCropMarks(context, trim, geo) {
    const { x0, y0, x1, y1 } = trim;
    const leftEnd = x0 - geo.bleed - geo.offset;
    const rightStart = x1 + geo.bleed + geo.offset;
    const topEnd = y0 - geo.bleed - geo.offset;
    const bottomStart = y1 + geo.bleed + geo.offset;
    context.save();
    context.strokeStyle = '#111827';
    context.lineWidth = Math.max(0.7, geo.length * 0.035);
    context.beginPath();
    [[leftEnd - geo.length, y0, leftEnd, y0], [rightStart, y0, rightStart + geo.length, y0],
     [leftEnd - geo.length, y1, leftEnd, y1], [rightStart, y1, rightStart + geo.length, y1],
     [x0, topEnd - geo.length, x0, topEnd], [x1, topEnd - geo.length, x1, topEnd],
     [x0, bottomStart, x0, bottomStart + geo.length], [x1, bottomStart, x1, bottomStart + geo.length]]
      .forEach(([ax, ay, bx, by]) => { context.moveTo(ax, ay); context.lineTo(bx, by); });
    context.stroke();

    // Preview-only guides: cyan bleed boundary and red trim boundary.
    context.setLineDash([4, 3]);
    context.lineWidth = 1;
    context.strokeStyle = 'rgba(8,145,178,.72)';
    context.strokeRect(x0 - geo.bleed, y0 - geo.bleed, (x1 - x0) + geo.bleed * 2, (y1 - y0) + geo.bleed * 2);
    context.strokeStyle = 'rgba(220,38,38,.62)';
    context.strokeRect(x0, y0, x1 - x0, y1 - y0);
    context.restore();
  }

  function addMarksToCanvas(source, mm2px) {
    if (!enabled()) return source;
    const geo = geometry(mm2px);
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(source.width + geo.outer * 2));
    output.height = Math.max(1, Math.round(source.height + geo.outer * 2));
    const context = output.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, output.width, output.height);
    const x0 = geo.outer;
    const y0 = geo.outer;
    context.drawImage(source, x0, y0);
    drawCropMarks(context, { x0, y0, x1: x0 + source.width, y1: y0 + source.height }, geo);
    output.dataset.printMarksPreview = '1';
    return output;
  }

  function patchBuildAllPages() {
    if (buildPatched) return true;
    if (typeof buildAllPages !== 'function') return false;
    if (buildAllPages.__printMarksPatchedV1) {
      buildPatched = true;
      return true;
    }
    const original = buildAllPages;
    const wrapped = async function buildAllPagesWithPrintMarks(mm2px, useHi, overridePages) {
      const pages = await original.apply(this, arguments);
      if (!enabled()) return pages;
      return pages.map((canvas) => addMarksToCanvas(canvas, mm2px));
    };
    wrapped.__printMarksPatchedV1 = true;
    buildAllPages = wrapped;
    window.buildAllPages = wrapped;
    buildPatched = true;
    return true;
  }

  function patchSessionState() {
    if (sessionPatched) return true;
    if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
    const originalCollect = collectEditorState;
    const originalLoad = loadEditorSession;
    collectEditorState = function collectStateWithPrintMarks() {
      const state = originalCollect();
      state.printMarks = settings();
      return state;
    };
    loadEditorSession = async function loadStateWithPrintMarks(data, documentId) {
      const result = await originalLoad(data, documentId);
      try {
        const state = JSON.parse(data.state || '{}');
        const config = state.printMarks || {};
        byId('printMarksEnabled').checked = !!config.enabled;
        if (Number.isFinite(Number(config.bleed_mm))) byId('printBleedMm').value = String(config.bleed_mm);
        if (Number.isFinite(Number(config.mark_length_mm))) byId('printMarkLengthMm').value = String(config.mark_length_mm);
        if (Number.isFinite(Number(config.mark_offset_mm))) byId('printMarkOffsetMm').value = String(config.mark_offset_mm);
      } catch (_) {}
      syncUi();
      requestPreview();
      return result;
    };
    window.collectEditorState = collectEditorState;
    window.loadEditorSession = loadEditorSession;
    sessionPatched = true;
    return true;
  }

  function annotatePreviewWrappers() {
    document.querySelectorAll('#previewScroll .page-preview').forEach((wrap) => {
      wrap.classList.toggle('print-marks-preview', enabled());
      wrap.querySelector('.print-marks-preview-note')?.remove();
      if (enabled()) {
        const note = document.createElement('div');
        note.className = 'print-marks-preview-note';
        note.textContent = '빨강=완성선 · 청록=도련 경계 · 검정=재단선';
        wrap.appendChild(note);
      }
    });
  }

  function appendSummaryItem() {
    const overlay = byId('pdfSaveSummaryOverlay');
    const grid = byId('pdfSummaryGrid');
    const warning = byId('pdfSummaryWarning');
    if (!overlay?.classList.contains('open') || !grid) return;
    grid.querySelector('[data-print-marks-summary]')?.remove();
    const item = document.createElement('div');
    item.className = 'pdf-summary-item';
    item.dataset.printMarksSummary = '1';
    const strong = document.createElement('strong');
    strong.textContent = '재단선·도련';
    const span = document.createElement('span');
    const config = settings();
    span.textContent = config.enabled
      ? `사용 · 도련 ${config.bleed_mm}mm · 출력 용지 확대`
      : '사용 안 함';
    item.append(strong, span);
    grid.appendChild(item);
    if (config.enabled && warning && !warning.textContent.includes('원본 그림은 자동')) {
      warning.textContent += ' 재단 영역은 추가되지만 원본 그림은 자동으로 도련까지 늘어나지 않습니다.';
    }
  }

  function observeSummary() {
    const overlay = byId('pdfSaveSummaryOverlay');
    if (!overlay || summaryObserver) return;
    summaryObserver = new MutationObserver(appendSummaryItem);
    summaryObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function installPreviewObserver() {
    const scroll = byId('previewScroll');
    if (!scroll || scroll.dataset.printMarksObserved) return;
    scroll.dataset.printMarksObserved = '1';
    new MutationObserver(annotatePreviewWrappers).observe(scroll, { childList: true, subtree: true });
  }

  function boot() {
    installStyles();
    const uiReady = ensureUi();
    const ready = editorReady();
    const buildReady = ready && patchBuildAllPages();
    const sessionReady = ready && patchSessionState();
    observeSummary();
    installPreviewObserver();
    annotatePreviewWrappers();
    if ((!uiReady || !ready || !buildReady || !sessionReady || !byId('pdfSaveSummaryOverlay')) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 170 + attempts * 60);
    }
  }

  window.PdfPrintMarks = {
    settings,
    enabled,
    addMarksToCanvas,
    refresh: requestPreview,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
