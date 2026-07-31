// Crop marks only: no bleed expansion or artwork stretching.
(function () {
  'use strict';
  if (window.__pdfCropMarksV1) return;
  window.__pdfCropMarksV1 = true;

  const $ = (id) => document.getElementById(id);
  let buildPatched = false;
  let sessionPatched = false;
  let attempts = 0;

  function numberValue(id, fallback, min, max) {
    const value = Number($(id)?.value);
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  }

  function enabled() { return !!$('cropMarksEnabled')?.checked; }

  function settings() {
    return {
      enabled: enabled(),
      bleed_mm: 0,
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

  function installUi() {
    const paperBody = $('sb-paper');
    if (!paperBody) return false;
    if (!$('cropMarksPanel')) {
      const panel = document.createElement('div');
      panel.id = 'cropMarksPanel';
      panel.style.cssText = 'margin:9px 0;padding:10px;border:1px solid #dbe5ef;border-radius:11px;background:#f8fafc';
      panel.innerHTML = `
        <label class="checkline" style="display:flex;align-items:flex-start;gap:7px;margin:0">
          <input type="checkbox" id="cropMarksEnabled">
          <span><strong style="display:block;font-size:11px;color:#334155">재단선 추가</strong><small style="font-size:9px;color:#64748b">완성 규격 바깥에 인쇄용 재단선만 추가합니다.</small></span>
        </label>
        <div id="cropMarksSettings" style="display:none;margin-top:9px;padding-top:9px;border-top:1px solid #e5e7eb">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <div class="field" style="margin:0"><label for="cropMarkLengthMm">재단선 길이(mm)</label><input id="cropMarkLengthMm" type="number" value="5" min="2" max="15" step="0.5"></div>
            <div class="field" style="margin:0"><label for="cropMarkOffsetMm">완성선과 간격(mm)</label><input id="cropMarkOffsetMm" type="number" value="2" min="0" max="10" step="0.5"></div>
          </div>
          <div style="margin-top:8px;padding:7px 8px;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;color:#1e40af;font-size:9px;font-weight:700;line-height:1.5">이번 단계는 재단선만 추가합니다. 도련 작업영역과 원본 그림 확장은 적용하지 않습니다.</div>
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
    ['cropMarkLengthMm', 'cropMarkOffsetMm'].forEach((id) => {
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
    const length = config.mark_length_mm * mm2px;
    const offset = config.mark_offset_mm * mm2px;
    const padding = config.edge_padding_mm * mm2px;
    const outer = length + offset + padding;
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
    const left = x0 - offset, right = x1 + offset, top = y0 - offset, bottom = y1 + offset;
    [[left-length,y0,left,y0],[right,y0,right+length,y0],[left-length,y1,left,y1],[right,y1,right+length,y1],
     [x0,top-length,x0,top],[x1,top-length,x1,top],[x0,bottom,x0,bottom+length],[x1,bottom,x1,bottom+length]]
      .forEach(([ax,ay,bx,by]) => { ctx.moveTo(ax,ay); ctx.lineTo(bx,by); });
    ctx.stroke();
    ctx.restore();
    output.dataset.cropMarksPreview = '1';
    return output;
  }

  function patchBuild() {
    if (buildPatched) return true;
    if (typeof buildAllPages !== 'function') return false;
    const original = buildAllPages;
    if (original.__cropMarksV1) { buildPatched = true; return true; }
    const wrapped = async function cropMarkedPages(mm2px) {
      const pages = await original.apply(this, arguments);
      return enabled() ? pages.map((canvas) => addMarks(canvas, mm2px)) : pages;
    };
    wrapped.__cropMarksV1 = true;
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
        if (Number.isFinite(Number(config.mark_length_mm))) $('cropMarkLengthMm').value = String(config.mark_length_mm);
        if (Number.isFinite(Number(config.mark_offset_mm))) $('cropMarkOffsetMm').value = String(config.mark_offset_mm);
        $('cropMarksSettings').style.display = config.enabled ? 'block' : 'none';
      } catch (_) {}
      requestPreview();
      return result;
    };
    window.collectEditorState = collectEditorState;
    window.loadEditorSession = loadEditorSession;
    sessionPatched = true;
    return true;
  }

  function boot() {
    const ui = installUi();
    const build = patchBuild();
    const session = patchSession();
    if ((!ui || !build || !session) && attempts < 12) {
      attempts += 1;
      setTimeout(boot, 180 + attempts * 60);
    }
  }

  window.PdfPrintMarks = { settings, enabled, addMarksToCanvas: addMarks, refresh: requestPreview };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
