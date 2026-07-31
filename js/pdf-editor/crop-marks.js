// Crop marks, reserved bleed workspace, and bounded PDF editor refinements.
(function () {
  'use strict';
  if (window.__pdfCropMarksV3) return;
  window.__pdfCropMarksV3 = true;

  const $ = (id) => document.getElementById(id);
  const GUIDE_TEXT = 'PDF 업로드 · 페이지 편집 · 간지 삽입 · 머리말/꼬리말 · 워터마크 · N-up 인쇄';
  let buildPatched = false;
  let sessionPatched = false;
  let overlayPatched = false;
  let attempts = 0;

  function numberValue(id, fallback, min, max) {
    const value = Number($(id)?.value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  }

  function enabled() { return !!$('cropMarksEnabled')?.checked; }

  function settings() {
    return {
      enabled: enabled(),
      bleed_mm: numberValue('printBleedMm', 3, 0, 15),
      mark_length_mm: numberValue('cropMarkLengthMm', 5, 2, 15),
      mark_offset_mm: numberValue('cropMarkOffsetMm', 2, 0, 10),
      edge_padding_mm: 2,
    };
  }

  function requestPreview() {
    try {
      if (window.PdfLivePreview?.request) window.PdfLivePreview.request(180, false);
      else if (typeof schedulePreview === 'function') schedulePreview(180);
    } catch (_) {}
  }

  function installEditorStyles() {
    if ($('pdfEditorStickyUploadMarginStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'pdfEditorStickyUploadMarginStylesV2';
    style.textContent = `
      .pdf-upload-sticky-v2{
        position:sticky;top:-16px;z-index:90;
        margin:0 -16px 5px;padding:16px 16px 11px;
        background:rgba(255,255,255,.985);
        border-bottom:1px solid #e5e7eb;
        box-shadow:0 8px 18px rgba(15,23,42,.07);
      }
      .pdf-upload-sticky-v2>.sec-head{background:transparent}
      #pdfUploadCompactGuideV2{
        margin-top:7px;padding-top:6px;border-top:1px dashed #bfdbfe;
        color:#64748b;font-size:8.5px;font-weight:600;line-height:1.45;
        letter-spacing:-.12px;word-break:keep-all;
      }
      #individualPaperMarginsV2 input[type="number"]{
        font-size:13px!important;font-weight:400!important;color:#111827!important;
      }
      .pdf-margin-facing-row-v2{
        display:flex;align-items:flex-start;gap:7px;margin-top:8px;padding:8px 9px;
        border:1px solid #c7d2fe;border-radius:9px;background:#eef2ff;
        color:#3730a3;font-size:10px;font-weight:750;line-height:1.45;cursor:pointer;
      }
      .pdf-margin-facing-row-v2[hidden]{display:none!important}
      .pdf-margin-facing-row-v2 input{flex:0 0 auto;margin-top:2px}
      .pdf-margin-facing-row-v2 small{display:block;margin-top:2px;color:#64748b;font-size:8.5px;font-weight:650}
    `;
    document.head.appendChild(style);
  }

  function installUploadLayout() {
    const uploadBody = $('sb-upload');
    const uploadZone = $('uploadZone');
    const uploadSection = uploadBody?.closest('.sec');
    const aside = uploadSection?.closest('aside');
    if (!uploadBody || !uploadZone || !uploadSection || !aside) return false;

    uploadSection.classList.add('pdf-upload-sticky-v2');
    let guide = $('pdfUploadCompactGuideV2');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'pdfUploadCompactGuideV2';
      guide.textContent = GUIDE_TEXT;
      uploadZone.appendChild(guide);
    }

    const sidebarTitle = [...aside.children].find(
      (node) => node.tagName === 'H1' && node.textContent?.trim() === 'PDF 문서 편집기'
    );
    if (sidebarTitle) sidebarTitle.remove();

    const oldGuide = [...aside.children].find((node) => node.classList?.contains('sub'));
    if (oldGuide) oldGuide.style.display = 'none';
    return true;
  }

  function facingEnabled() {
    try { return !!facingPages; }
    catch (_) { return !!$('facingPages')?.checked; }
  }

  function horizontalMargins(outputIndex) {
    let left = numberValue('marginLeft', numberValue('marginH', 10, 0, 80), 0, 80);
    let right = numberValue('marginRight', numberValue('marginH', 10, 0, 80), 0, 80);
    if (facingEnabled() && Number(outputIndex) % 2 === 1) [left, right] = [right, left];
    return { left, right };
  }

  function syncMarginFacingControl() {
    const row = $('marginFacingPagesRowV2');
    const mirror = $('marginFacingPagesV2');
    if (!row || !mirror) return;
    const left = numberValue('marginLeft', 10, 0, 80);
    const right = numberValue('marginRight', 10, 0, 80);
    const different = Math.abs(left - right) > 0.001;
    row.hidden = !different;
    mirror.checked = !!$('facingPages')?.checked || facingEnabled();
    const note = $('marginFacingPagesNoteV2');
    if (note) note.textContent = different
      ? `홀수면 ${left} / ${right}mm · 짝수면 ${right} / ${left}mm로 교환합니다.`
      : '좌·우 여백이 다를 때 짝수 출력면에서 자동 교환합니다.';
  }

  function installMarginFacingControl() {
    const panel = $('individualPaperMarginsV2');
    const original = $('facingPages');
    if (!panel || !original) return false;

    if (!$('marginFacingPagesRowV2')) {
      const row = document.createElement('label');
      row.id = 'marginFacingPagesRowV2';
      row.className = 'pdf-margin-facing-row-v2';
      row.hidden = true;
      row.innerHTML = `
        <input type="checkbox" id="marginFacingPagesV2">
        <span><strong>좌·우 여백 마주보기</strong><small id="marginFacingPagesNoteV2"></small></span>`;
      panel.appendChild(row);
    }

    const mirror = $('marginFacingPagesV2');
    if (mirror && !mirror.dataset.boundV2) {
      mirror.dataset.boundV2 = '1';
      mirror.addEventListener('change', () => {
        original.checked = mirror.checked;
        try { facingPages = mirror.checked; } catch (_) {}
        original.dispatchEvent(new Event('change', { bubbles: true }));
        syncMarginFacingControl();
        requestPreview();
      });
    }

    if (!original.dataset.marginMirrorBoundV2) {
      original.dataset.marginMirrorBoundV2 = '1';
      original.addEventListener('change', syncMarginFacingControl);
    }

    ['marginLeft', 'marginRight'].forEach((id) => {
      const input = $(id);
      if (!input || input.dataset.marginFacingBoundV2) return;
      input.dataset.marginFacingBoundV2 = '1';
      input.addEventListener('input', syncMarginFacingControl);
      input.addEventListener('change', syncMarginFacingControl);
    });

    syncMarginFacingControl();
    return true;
  }

  function patchDocumentOverlays() {
    if (overlayPatched) return true;
    if (typeof applyDocEdits !== 'function') return false;
    const original = applyDocEdits;
    if (original.__paperMarginOverlayV2) {
      overlayPatched = true;
      return true;
    }

    const wrapped = function paperMarginAwareOverlays(canvas, outputIndex, totalPages, mm2px) {
      const context = canvas?.getContext?.('2d');
      if (!context) return original.apply(this, arguments);
      const originalFillText = context.fillText;
      const margins = horizontalMargins(outputIndex);
      const leftPx = margins.left * mm2px;
      const rightPx = margins.right * mm2px;
      const centerPx = (leftPx + canvas.width - rightPx) / 2;

      context.fillText = function marginAwareFillText(text, x, y, maxWidth) {
        let adjustedX = Number(x) || 0;
        const isDocumentOverlay = this.globalAlpha >= 0.999 && this.textBaseline === 'middle';
        if (isDocumentOverlay) {
          if (this.textAlign === 'left') adjustedX = Math.max(adjustedX, leftPx);
          else if (this.textAlign === 'right') adjustedX = Math.min(adjustedX, canvas.width - rightPx);
          else if (this.textAlign === 'center') adjustedX = centerPx;
        }
        return arguments.length >= 4
          ? originalFillText.call(this, text, adjustedX, y, maxWidth)
          : originalFillText.call(this, text, adjustedX, y);
      };

      try { return original.apply(this, arguments); }
      finally { context.fillText = originalFillText; }
    };
    wrapped.__paperMarginOverlayV2 = true;
    applyDocEdits = wrapped;
    window.applyDocEdits = wrapped;
    overlayPatched = true;
    return true;
  }

  function installCropMarkUi() {
    const paperBody = $('sb-paper');
    if (!paperBody) return false;
    if (!$('cropMarksPanel')) {
      const panel = document.createElement('div');
      panel.id = 'cropMarksPanel';
      panel.style.cssText = 'margin:9px 0;padding:10px;border:1px solid #dbe5ef;border-radius:11px;background:#f8fafc';
      panel.innerHTML = `
        <label class="checkline" style="display:flex;align-items:flex-start;gap:7px;margin:0">
          <input type="checkbox" id="cropMarksEnabled">
          <span><strong style="display:block;font-size:11px;color:#334155">재단선·도련 작업영역 추가</strong><small style="font-size:9px;color:#64748b">완성 규격 바깥에 지정한 도련 영역과 인쇄용 재단선을 추가합니다.</small></span>
        </label>
        <div id="cropMarksSettings" style="display:none;margin-top:9px;padding-top:9px;border-top:1px solid #e5e7eb">
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px">
            <div class="field" style="margin:0"><label for="printBleedMm">도련 영역(mm)</label><input id="printBleedMm" type="number" value="3" min="0" max="15" step="0.5"></div>
            <div class="field" style="margin:0"><label for="cropMarkLengthMm">재단선 길이(mm)</label><input id="cropMarkLengthMm" type="number" value="5" min="2" max="15" step="0.5"></div>
            <div class="field" style="margin:0"><label for="cropMarkOffsetMm">도련 밖 간격(mm)</label><input id="cropMarkOffsetMm" type="number" value="2" min="0" max="10" step="0.5"></div>
          </div>
          <div style="margin-top:8px;padding:7px 8px;border:1px solid #fcd34d;border-radius:8px;background:#fffbeb;color:#92400e;font-size:9px;font-weight:700;line-height:1.5">도련 작업영역만 확보하며 원본 그림이나 배경을 자동으로 늘리지 않습니다. 원본 PDF에 도련 이미지가 없으면 확보된 영역은 흰색으로 남습니다.</div>
        </div>`;
      paperBody.appendChild(panel);
    }
    const toggle = $('cropMarksEnabled');
    if (toggle && !toggle.dataset.bound) {
      toggle.dataset.bound = '1';
      toggle.addEventListener('change', () => {
        $('cropMarksSettings').style.display = toggle.checked ? 'block' : 'none';
        requestPreview();
      });
    }
    ['printBleedMm', 'cropMarkLengthMm', 'cropMarkOffsetMm'].forEach((id) => {
      const input = $(id);
      if (!input || input.dataset.bound) return;
      input.dataset.bound = '1';
      input.addEventListener('input', requestPreview);
      input.addEventListener('change', requestPreview);
    });
    return true;
  }

  function addMarks(source, mm2px) {
    if (!enabled()) return source;
    const config = settings();
    const bleed = config.bleed_mm * mm2px;
    const length = config.mark_length_mm * mm2px;
    const offset = config.mark_offset_mm * mm2px;
    const padding = config.edge_padding_mm * mm2px;
    const outer = bleed + length + offset + padding;
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(source.width + outer * 2));
    output.height = Math.max(1, Math.round(source.height + outer * 2));
    const ctx = output.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(source, outer, outer);
    const x0 = outer, y0 = outer, x1 = outer + source.width, y1 = outer + source.height;
    ctx.save();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = Math.max(0.7, length * 0.035);
    ctx.beginPath();
    const left = x0 - bleed - offset;
    const right = x1 + bleed + offset;
    const top = y0 - bleed - offset;
    const bottom = y1 + bleed + offset;
    [[left-length,y0,left,y0],[right,y0,right+length,y0],[left-length,y1,left,y1],[right,y1,right+length,y1],
     [x0,top-length,x0,top],[x1,top-length,x1,top],[x0,bottom,x0,bottom+length],[x1,bottom,x1,bottom+length]]
      .forEach(([ax,ay,bx,by]) => { ctx.moveTo(ax,ay); ctx.lineTo(bx,by); });
    ctx.stroke();
    ctx.restore();
    output.dataset.cropMarksPreview = '1';
    output.dataset.bleedMm = String(config.bleed_mm);
    return output;
  }

  function patchBuild() {
    if (buildPatched) return true;
    if (typeof buildAllPages !== 'function') return false;
    const original = buildAllPages;
    if (original.__cropMarksV2) { buildPatched = true; return true; }
    const wrapped = async function cropMarkedPages(mm2px) {
      const pages = await original.apply(this, arguments);
      return enabled() ? pages.map((canvas) => addMarks(canvas, mm2px)) : pages;
    };
    wrapped.__cropMarksV2 = true;
    buildAllPages = wrapped;
    window.buildAllPages = wrapped;
    buildPatched = true;
    return true;
  }

  function patchSession() {
    if (sessionPatched) return true;
    if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
    const collect = collectEditorState;
    const load = loadEditorSession;
    collectEditorState = function () {
      const state = collect.apply(this, arguments);
      state.cropMarks = settings();
      return state;
    };
    loadEditorSession = async function (data) {
      const result = await load.apply(this, arguments);
      try {
        const state = typeof data?.state === 'string' ? JSON.parse(data.state) : (data?.state || {});
        const config = state.cropMarks || {};
        $('cropMarksEnabled').checked = !!config.enabled;
        if (Number.isFinite(Number(config.bleed_mm))) $('printBleedMm').value = String(config.bleed_mm);
        if (Number.isFinite(Number(config.mark_length_mm))) $('cropMarkLengthMm').value = String(config.mark_length_mm);
        if (Number.isFinite(Number(config.mark_offset_mm))) $('cropMarkOffsetMm').value = String(config.mark_offset_mm);
        $('cropMarksSettings').style.display = config.enabled ? 'block' : 'none';
      } catch (_) {}
      syncMarginFacingControl();
      requestPreview();
      return result;
    };
    window.collectEditorState = collectEditorState;
    window.loadEditorSession = loadEditorSession;
    sessionPatched = true;
    return true;
  }

  function boot() {
    installEditorStyles();
    const upload = installUploadLayout();
    const margins = installMarginFacingControl();
    const overlay = patchDocumentOverlays();
    const ui = installCropMarkUi();
    const build = patchBuild();
    const session = patchSession();
    if ((!upload || !margins || !overlay || !ui || !build || !session) && attempts < 16) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 60);
    }
  }

  window.PdfPrintMarks = {
    settings,
    enabled,
    addMarksToCanvas: addMarks,
    refresh: requestPreview,
    horizontalMargins,
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();