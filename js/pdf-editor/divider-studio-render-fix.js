// Final rendering and visibility patch for the full-screen divider studio.
(function () {
  'use strict';
  if (window.__pdfDividerStudioRenderFixV1) return;
  window.__pdfDividerStudioRenderFixV1 = true;

  const $ = (id) => document.getElementById(id);
  function num(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function installStyles() {
    if ($('pdfDividerStudioRenderFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfDividerStudioRenderFixStyles';
    style.textContent = `
      #dividerModal label:has(#dividerNoBg){display:flex!important;align-items:center!important;gap:5px!important}
      #dividerModal #dividerBg{display:block!important}
      #dividerModal #dividerBg:disabled{opacity:.45;cursor:not-allowed}
      #dividerModal .divider-studio-controls .field{display:block}
    `;
    document.head.appendChild(style);
  }

  function drawText(ctx, text, xPct, yPct, size, color, align, weight, italic, opacity, rotation, width, height) {
    if (!text) return;
    ctx.save();
    ctx.translate(width * xPct / 100, height * yPct / 100);
    ctx.rotate(num(rotation, 0) * Math.PI / 180);
    ctx.globalAlpha = Math.max(.05, Math.min(1, num(opacity, 1)));
    ctx.fillStyle = color || '#000000';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    const scale = Math.min(width / 595, height / 842);
    const px = Math.max(6, num(size, 18) * scale);
    ctx.font = `${italic ? 'italic ' : ''}${num(weight, 400) >= 700 ? '700 ' : '400 '}${px}px "Pretendard", "Malgun Gothic", sans-serif`;
    ctx.fillText(String(text), 0, 0, width * .88);
    ctx.restore();
  }

  function render(content, width, height) {
    const p = content || {};
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const noBg = p.noBg !== false;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = noBg ? '#ffffff' : (p.bg || '#ffffff');
    ctx.fillRect(0, 0, width, height);

    const fg = p.fg || '#000000';
    const style = p.style || 'simple';
    if (!noBg && style === 'band') {
      ctx.save();
      ctx.globalAlpha = .16;
      ctx.fillStyle = fg;
      ctx.fillRect(0, height * .34, width, height * .32);
      ctx.restore();
    } else if (style === 'lines') {
      ctx.save();
      ctx.strokeStyle = fg;
      ctx.globalAlpha = .28;
      ctx.lineWidth = Math.max(1, width * .002);
      ctx.beginPath();
      ctx.moveTo(width * .14, height * .38);
      ctx.lineTo(width * .86, height * .38);
      ctx.moveTo(width * .14, height * .64);
      ctx.lineTo(width * .86, height * .64);
      ctx.stroke();
      ctx.restore();
    }

    const offset = num(p.textVOffset, 0);
    const titleY = num(p.titleY, 45) + offset;
    const subtitleY = num(p.subtitleY, 55) + offset;
    const noteY = num(p.noteY, 88) + offset;
    const baseScale = Math.min(width / 595, height / 842);

    drawText(ctx, p.title, num(p.titleX, 50), titleY, 42 / baseScale, fg, num(p.titleX,50) <= 20 ? 'left' : num(p.titleX,50) >= 80 ? 'right' : 'center', 700, false, 1, 0, width, height);
    drawText(ctx, p.subtitle, num(p.subtitleX, 50), subtitleY, 24 / baseScale, fg, num(p.subtitleX,50) <= 20 ? 'left' : num(p.subtitleX,50) >= 80 ? 'right' : 'center', 400, false, .82, 0, width, height);
    drawText(ctx, p.note, num(p.noteX, 50), noteY, 15 / baseScale, fg, num(p.noteX,50) <= 20 ? 'left' : num(p.noteX,50) >= 80 ? 'right' : 'center', 400, false, .68, 0, width, height);

    const extras = Array.isArray(p.extraTexts) ? p.extraTexts : [];
    extras.forEach((item) => {
      if (!item || item.hidden) return;
      drawText(ctx, item.text, num(item.x, 50), num(item.y, 70), num(item.size, 18), item.color || '#000000', item.align || 'center', item.weight, item.italic, item.opacity, item.rotation, width, height);
    });
    return canvas;
  }

  function installRenderer() {
    if (typeof window.renderDividerCanvas !== 'function' || window.renderDividerCanvas.__studioFinalRendererV1) return;
    const renderer = function (content, width, height) { return render(content, width, height); };
    renderer.__studioFinalRendererV1 = true;
    window.renderDividerCanvas = renderer;
  }

  function boot() {
    installStyles();
    installRenderer();
    const noBg = $('dividerNoBg');
    const bg = $('dividerBg');
    if (noBg && bg) bg.disabled = noBg.checked;
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 800);
  setInterval(boot, 1300);
})();