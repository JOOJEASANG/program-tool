// PDF editor divider helper module.
(function () {
  if (window.__pdfEditorDividerHelperV1) return;
  window.__pdfEditorDividerHelperV1 = true;

  function $(id) { return document.getElementById(id); }
  function values() {
    return {
      titleY: Number($('dividerTitleY') && $('dividerTitleY').value) || 45,
      subtitleY: Number($('dividerSubtitleY') && $('dividerSubtitleY').value) || 55,
      noteY: Number($('dividerNoteY') && $('dividerNoteY').value) || 88,
    };
  }
  function patchContent(content) {
    const patched = Object.assign({}, content || {}, values());
    patched.noBg = true;
    patched.bg = '#ffffff';
    patched.fg = '#111827';
    if (!Number.isFinite(Number(patched.titleY))) patched.titleY = 45;
    if (!Number.isFinite(Number(patched.subtitleY))) patched.subtitleY = 55;
    if (!Number.isFinite(Number(patched.noteY))) patched.noteY = 88;
    return patched;
  }
  window.PdfDividerHelper = { patchContent };

  function installDefaultsUi() {
    const modal = $('dividerModal');
    if (!modal || modal.dataset.dividerHelperPatched) return;
    modal.dataset.dividerHelperPatched = '1';
    const style = document.createElement('style');
    style.textContent = `#dividerBg, label[for="dividerBg"]{display:none!important}#dividerNoBg,label:has(#dividerNoBg){display:none!important}`;
    document.head.appendChild(style);

    const addSlider = (id, anchorId, label, value) => {
      if ($(id)) return;
      const input = document.createElement('input');
      input.type = 'range'; input.min = '5'; input.max = '95'; input.step = '1'; input.id = id; input.value = String(value); input.style.width = '100%';
      const wrap = document.createElement('div'); wrap.className = 'field helper-divider-pos';
      wrap.innerHTML = `<label style="font-size:11px;font-weight:800;color:#374151;">${label}</label>`;
      wrap.appendChild(input);
      const anchor = $(anchorId);
      anchor && anchor.closest('.field') && anchor.closest('.field').insertAdjacentElement('afterend', wrap);
      input.addEventListener('input', () => { if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview(); });
    };
    const setDefaults = () => {
      if ($('dividerNoBg')) $('dividerNoBg').checked = true;
      if ($('dividerBg')) $('dividerBg').value = '#ffffff';
      if ($('dividerFg')) $('dividerFg').value = '#111827';
      addSlider('dividerTitleY', 'dividerTitle', '제목 위치', 45);
      addSlider('dividerSubtitleY', 'dividerSubtitle', '부제목 위치', 55);
      addSlider('dividerNoteY', 'dividerNote', '하단 위치', 88);
    };
    setDefaults();
    modal.addEventListener('click', () => setTimeout(setDefaults, 0), true);
  }

  function wrapContentAndCanvas() {
    if (!window.__dividerContentWrapped && typeof window.getDividerContent === 'function') {
      const originalGet = window.getDividerContent;
      window.getDividerContent = function dividerHelperGetContent() { return patchContent(originalGet.call(this)); };
      window.__dividerContentWrapped = true;
    }
    if (!window.__dividerCanvasWrapped && typeof window.renderDividerCanvas === 'function') {
      const original = window.renderDividerCanvas;
      window.renderDividerCanvas = function dividerHelperCanvas(content, w, h) {
        const patched = patchContent(content);
        const canvas = original.call(this, patched, w, h);
        try {
          const ctx = canvas.getContext('2d');
          const titleY = Number(patched.titleY) || 45, subtitleY = Number(patched.subtitleY) || 55, noteY = Number(patched.noteY) || 88;
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = '#111827'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          if (patched.title) { const fs = Math.min(canvas.width * 0.1, canvas.height * 0.1, 90); ctx.font = `bold ${fs}px "Pretendard", "Malgun Gothic", serif`; ctx.fillText(patched.title, canvas.width / 2, canvas.height * titleY / 100); }
          if (patched.subtitle) { const fs2 = Math.min(canvas.width * 0.055, canvas.height * 0.055, 50); ctx.globalAlpha = 0.82; ctx.font = `${fs2}px "Pretendard", "Malgun Gothic", sans-serif`; ctx.fillText(patched.subtitle, canvas.width / 2, canvas.height * subtitleY / 100); ctx.globalAlpha = 1; }
          if (patched.note) { const fs3 = Math.min(canvas.width * 0.035, canvas.height * 0.035, 30); ctx.globalAlpha = 0.62; ctx.font = `${fs3}px "Pretendard", "Malgun Gothic", sans-serif`; ctx.fillText(patched.note, canvas.width / 2, canvas.height * noteY / 100); ctx.globalAlpha = 1; }
        } catch (_) {}
        return canvas;
      };
      window.__dividerCanvasWrapped = true;
    }
  }

  function boot() { installDefaultsUi(); wrapContentAndCanvas(); }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
