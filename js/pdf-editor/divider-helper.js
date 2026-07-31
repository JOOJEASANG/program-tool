// PDF editor divider helper module.
(function () {
  if (window.__pdfEditorDividerHelperV3) return;
  window.__pdfEditorDividerHelperV3 = true;

  function $(id) { return document.getElementById(id); }
  const snapPoints = [
    { value: 10, key: 'left', label: '왼쪽' },
    { value: 50, key: 'center', label: '가운데' },
    { value: 90, key: 'right', label: '오른쪽' },
  ];
  let activePart = 'title';
  let drag = null;
  let threshold = 5;
  let latched = null;

  function n(id, fallback) {
    const value = Number($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function values() {
    return {
      titleY: n('dividerTitleY', 45),
      subtitleY: n('dividerSubtitleY', 55),
      noteY: n('dividerNoteY', 88),
      titleX: n('dividerTitleX', 50),
      subtitleX: n('dividerSubtitleX', 50),
      noteX: n('dividerNoteX', 50),
    };
  }

  function patchContent(content) {
    const patched = Object.assign({}, content || {}, values());
    patched.noBg = patched.noBg !== false;
    patched.bg = patched.bg || '#ffffff';
    patched.fg = patched.fg || '#111827';
    patched.style = patched.style || 'simple';
    if (!Array.isArray(patched.extraTexts)) patched.extraTexts = [];
    ['titleY', 'subtitleY', 'noteY', 'titleX', 'subtitleX', 'noteX'].forEach((key) => {
      const fallback = key.endsWith('X') ? 50 : (key === 'titleY' ? 45 : key === 'subtitleY' ? 55 : 88);
      if (!Number.isFinite(Number(patched[key]))) patched[key] = fallback;
    });
    return patched;
  }
  window.PdfDividerHelper = { patchContent };

  function addRange(id, anchorId, label, value, min = 5, max = 95) {
    if ($(id)) return $(id);
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.id = id;
    input.value = String(value);
    input.style.width = '100%';
    const wrap = document.createElement('div');
    wrap.className = 'field helper-divider-pos';
    wrap.innerHTML = `<label style="font-size:11px;font-weight:800;color:#374151;">${label}</label>`;
    wrap.appendChild(input);
    const anchor = $(anchorId);
    anchor?.closest('.field')?.insertAdjacentElement('afterend', wrap);
    input.addEventListener('input', () => {
      if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview();
    });
    return input;
  }

  function installDefaultsUi() {
    const modal = $('dividerModal');
    if (!modal || modal.dataset.dividerHelperPatched === 'true') return;
    modal.dataset.dividerHelperPatched = 'true';
    const style = document.createElement('style');
    style.id = 'pdfDividerMagnetStyles';
    style.textContent = `.divider-magnet-help{font-size:10px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px;margin:8px 0}.divider-prev-wrap{position:relative}.divider-guide-x{position:absolute;top:0;bottom:0;width:2px;background:#ec4899;pointer-events:none;display:none;z-index:8}.divider-guide-label{position:absolute;top:7px;background:#ec4899;color:#fff;border-radius:999px;padding:3px 6px;font-size:9px;font-weight:900;pointer-events:none;display:none;z-index:9;white-space:nowrap}`;
    document.head.appendChild(style);
    if ($('dividerNoBg') && !$('dividerNoBg').hasAttribute('checked')) $('dividerNoBg').checked = true;
    if ($('dividerBg') && !$('dividerBg').value) $('dividerBg').value = '#ffffff';
    if ($('dividerFg') && !$('dividerFg').value) $('dividerFg').value = '#111827';
    addRange('dividerTitleY', 'dividerTitle', '제목 세로 위치', 45);
    addRange('dividerSubtitleY', 'dividerSubtitle', '부제목 세로 위치', 55);
    addRange('dividerNoteY', 'dividerNote', '하단 메모 세로 위치', 88);
    ['dividerTitleX', 'dividerSubtitleX', 'dividerNoteX'].forEach((id) => {
      if ($(id)) return;
      const input = document.createElement('input');
      input.type = 'hidden';
      input.id = id;
      input.value = '50';
      modal.appendChild(input);
    });
    const help = document.createElement('div');
    help.className = 'divider-magnet-help';
    help.textContent = '미리보기의 제목·부제목·메모를 마우스로 좌우 이동하면 왼쪽·가운데·오른쪽에 자석처럼 맞춰집니다.';
    $('dividerPrevCanvas')?.parentElement?.insertAdjacentElement('afterend', help);
    const wrap = $('dividerPrevCanvas')?.parentElement;
    if (wrap && !$('dividerGuideX')) {
      const line = document.createElement('div');
      line.className = 'divider-guide-x';
      line.id = 'dividerGuideX';
      const label = document.createElement('div');
      label.className = 'divider-guide-label';
      label.id = 'dividerGuideLabel';
      wrap.append(line, label);
    }
  }

  function renderPatched(content, width, height) {
    const source = patchContent(content);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = source.noBg ? '#ffffff' : source.bg;
    ctx.fillRect(0, 0, width, height);
    if (!source.noBg && source.style === 'band') {
      ctx.save();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = source.fg;
      ctx.fillRect(0, height * 0.34, width, height * 0.32);
      ctx.restore();
    } else if (source.style === 'lines') {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = source.fg;
      ctx.lineWidth = Math.max(1, width * 0.002);
      ctx.beginPath();
      ctx.moveTo(width * 0.14, height * 0.38);
      ctx.lineTo(width * 0.86, height * 0.38);
      ctx.moveTo(width * 0.14, height * 0.64);
      ctx.lineTo(width * 0.86, height * 0.64);
      ctx.stroke();
      ctx.restore();
    }
    const scale = Math.min(width / 595, height / 842);
    const draw = (text, xPct, yPct, size, weight, alpha = 1) => {
      if (!text) return;
      const x = width * xPct / 100;
      const y = height * yPct / 100;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = source.fg;
      ctx.textAlign = xPct <= 20 ? 'left' : xPct >= 80 ? 'right' : 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${weight} ${Math.max(8, size * scale)}px "Pretendard", "Malgun Gothic", sans-serif`;
      ctx.fillText(text, x, y, width * 0.84);
      ctx.restore();
    };
    const offset = Number(source.textVOffset) || 0;
    draw(source.title, source.titleX, source.titleY + offset, 42, '700');
    draw(source.subtitle, source.subtitleX, source.subtitleY + offset, 24, '400', 0.82);
    draw(source.note, source.noteX, source.noteY + offset, 15, '400', 0.68);
    return canvas;
  }

  function setPositions(content) {
    const source = patchContent(content || {});
    ['titleX', 'subtitleX', 'noteX', 'titleY', 'subtitleY', 'noteY'].forEach((key) => {
      const element = $(`divider${key[0].toUpperCase()}${key.slice(1)}`);
      if (element) element.value = source[key];
    });
  }

  function wrapFunctions() {
    if (!window.__dividerContentWrappedV3 && typeof window.getDividerContent === 'function') {
      const originalGet = window.getDividerContent;
      window.getDividerContent = function () { return patchContent(originalGet.call(this)); };
      window.__dividerContentWrappedV3 = true;
    }
    if (!window.__dividerCanvasWrappedV3 && typeof window.renderDividerCanvas === 'function') {
      window.renderDividerCanvas = function (content, width, height) { return renderPatched(content, width, height); };
      window.__dividerCanvasWrappedV3 = true;
    }
    if (!window.__dividerOpenWrappedV3 && typeof window.editDivider === 'function' && typeof window.openDividerInsert === 'function') {
      const oldEdit = window.editDivider;
      const oldOpen = window.openDividerInsert;
      window.editDivider = function (page) {
        setPositions(page?.dividerContent);
        return oldEdit.apply(this, arguments);
      };
      window.openDividerInsert = function () {
        setPositions({ titleX: 50, subtitleX: 50, noteX: 50, titleY: 45, subtitleY: 55, noteY: 88 });
        return oldOpen.apply(this, arguments);
      };
      window.__dividerOpenWrappedV3 = true;
    }
  }

  function partAt(y, height) {
    const points = [['title', n('dividerTitleY', 45)], ['subtitle', n('dividerSubtitleY', 55)], ['note', n('dividerNoteY', 88)]];
    points.sort((a, b) => Math.abs(y / height * 100 - a[1]) - Math.abs(y / height * 100 - b[1]));
    return points[0][0];
  }

  function nearest(value) {
    let best = null;
    for (const point of snapPoints) {
      const distance = Math.abs(value - point.value);
      if (distance <= threshold && (!best || distance < best.distance)) best = Object.assign({ distance }, point);
    }
    return best;
  }

  function showGuide(point) {
    const line = $('dividerGuideX');
    const label = $('dividerGuideLabel');
    if (!line || !label) return;
    line.style.display = 'block';
    line.style.left = `${point.value}%`;
    label.style.display = 'block';
    label.style.left = `calc(${point.value}% + 6px)`;
    label.textContent = `${point.label} 정렬`;
  }

  function clearGuide() {
    if ($('dividerGuideX')) $('dividerGuideX').style.display = 'none';
    if ($('dividerGuideLabel')) $('dividerGuideLabel').style.display = 'none';
  }

  function setPartX(part, raw) {
    let point = null;
    if (latched) {
      const current = snapPoints.find((item) => item.key === latched);
      if (current && Math.abs(raw - current.value) <= threshold + 4) point = current;
      else latched = null;
    }
    if (!point) point = nearest(raw);
    const value = point ? point.value : Math.max(5, Math.min(95, raw));
    const element = $(`divider${part[0].toUpperCase()}${part.slice(1)}X`);
    if (element) element.value = value;
    if (point) {
      latched = point.key;
      showGuide(point);
    } else {
      clearGuide();
    }
    if (typeof window.updateDividerPreview === 'function') window.updateDividerPreview();
  }

  function bindDrag() {
    const canvas = $('dividerPrevCanvas');
    if (!canvas || canvas.dataset.magneticDivider === 'true') return;
    canvas.dataset.magneticDivider = 'true';
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'none';
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width * canvas.width,
        y: (event.clientY - rect.top) / rect.height * canvas.height,
      };
    };
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const position = point(event);
      activePart = partAt(position.y, canvas.height);
      drag = { id: event.pointerId };
      latched = null;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      setPartX(activePart, position.x / canvas.width * 100);
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      const position = point(event);
      setPartX(activePart, position.x / canvas.width * 100);
      event.preventDefault();
    });
    const end = (event) => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      latched = null;
      canvas.style.cursor = 'grab';
      setTimeout(clearGuide, 450);
      try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }

  function loadDividerStudio() {
    if (window.__pdfDividerStudioV2 || document.querySelector('script[data-divider-studio="v2"]')) return;
    const script = document.createElement('script');
    script.src = '/js/pdf-editor/divider-studio.js?v=20260731-2';
    script.async = false;
    script.dataset.dividerStudio = 'v2';
    script.addEventListener('error', () => console.error('[divider] advanced studio failed to load'), { once: true });
    document.head.appendChild(script);
  }

  function boot(attempt = 0) {
    installDefaultsUi();
    wrapFunctions();
    bindDrag();
    const ready = Boolean($('dividerModal') && $('dividerPrevCanvas'));
    if (ready) loadDividerStudio();
    else if (attempt < 10) setTimeout(() => boot(attempt + 1), 160 + attempt * 60);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
