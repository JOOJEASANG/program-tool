// User-owned local image upload support for the perfect-binding cover maker.
(function () {
  'use strict';
  if (window.__coverLocalImageUploadV1) return;
  window.__coverLocalImageUploadV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const STYLE_ID = 'coverLocalImageUploadStyles';
  const COPYRIGHT_ID = 'coverImageCopyrightNotice';
  const INSTALL_DELAYS = [700, 1200, 1900, 2800];
  let installed = false;
  let renderPatchCount = 0;
  const $ = (id) => document.getElementById(id);

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .cover-image-copyright{margin-top:8px;border:1px solid #fed7aa;border-radius:9px;background:#fff7ed;color:#9a3412;padding:8px 9px;font-size:8.5px;font-weight:850;line-height:1.5}
      .cover-image-copyright strong{font-weight:950}.cover-image-copyright span{display:block;margin-top:2px;color:#b45309;font-weight:750}
      .cover-spread-local{margin-top:8px;border:1px dashed #67c7d8;border-radius:9px;background:#ecfeff;padding:8px}
      .cover-spread-row{display:flex;gap:7px;align-items:center}.cover-spread-row label{flex:1;cursor:pointer;font-size:9px;font-weight:900;color:#0e7490}
      .cover-spread-note{font-size:8px;color:#64748b;line-height:1.45;margin-top:4px}.cover-spread-active{font-size:8px;font-weight:900;color:#166534;margin-top:5px}
    `;
    document.head.appendChild(el);
  }

  function makeCopyrightNotice() {
    if ($(COPYRIGHT_ID)) return true;
    const front = $('frontInput');
    if (!front) return false;
    const section = front.closest('section.card');
    if (!section) return false;
    const uploadGrid = section.querySelector('.upload-grid');
    if (!uploadGrid) return false;
    const notice = document.createElement('div');
    notice.id = COPYRIGHT_ID;
    notice.className = 'cover-image-copyright';
    notice.setAttribute('role', 'note');
    notice.innerHTML = '<strong>이미지 저작권에 대해 저희는 책임을 지지 않습니다.</strong><span>사용자가 직접 사용 권한을 확인한 이미지만 업로드해 주세요.</span>';
    uploadGrid.insertAdjacentElement('afterend', notice);
    return true;
  }

  function clearSpread() {
    if (typeof state !== 'undefined') {
      state.__localSpreadImage = null;
      state.__localSpreadName = '';
    }
    if ($('coverSpreadActive')) $('coverSpreadActive').textContent = '';
    try { requestRender(); } catch (_) {}
  }

  function makeLocalSpreadUpload() {
    if ($('coverSpreadLocal')) return true;
    const front = $('frontInput');
    if (!front) return false;
    const section = front.closest('section.card');
    if (!section) return false;
    const box = document.createElement('div');
    box.id = 'coverSpreadLocal';
    box.className = 'cover-spread-local';
    box.innerHTML = `
      <div class="cover-spread-row"><label for="coverSpreadInput">🖼️ 펼침 이미지 직접 업로드 · A3 이상/가로형 권장</label><button type="button" class="mini-btn" id="coverSpreadClear">펼침 삭제</button></div>
      <input id="coverSpreadInput" class="upload-input" type="file" accept="image/jpeg,image/png,image/webp">
      <div class="cover-spread-note">사용자가 직접 선택한 이미지 한 장을 뒤표지 → 책등 → 앞표지까지 이어서 채웁니다. 사용 권한이 있는 이미지만 업로드해 주세요.</div>
      <div id="coverSpreadActive" class="cover-spread-active"></div>`;
    const imageFitField = $('imageFit')?.closest('.field');
    section.insertBefore(box, imageFitField || null);

    $('coverSpreadInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0] || null;
      event.target.value = '';
      if (!file) return;
      try {
        const img = await loadImageFile(file);
        state.__localSpreadImage = img;
        state.__localSpreadName = file.name;
        $('coverSpreadActive').textContent = `펼침 적용: ${file.name}`;
        requestRender();
        try { window.CoverRecoveryCheckpoints?.queueSave?.({ force: true }); } catch (_) {}
      } catch (error) {
        if (typeof setStatus === 'function') setStatus(error?.message || '이미지를 불러오지 못했습니다.', 'err');
      }
    });
    $('coverSpreadClear').addEventListener('click', clearSpread);
    $('clearImagesBtn')?.addEventListener('click', clearSpread);
    return true;
  }

  function patchRenderCover() {
    if (typeof window.renderCover !== 'function' || typeof state === 'undefined') return false;
    if (window.renderCover.__localSpreadRendererV1) return true;
    const delegate = window.renderCover;
    const patched = function localSpreadRenderCover(canvas, dpi = 110, withGuides = state.showGuides, interactive = canvas.id === 'previewCanvas') {
      if (!state.__localSpreadImage) return Reflect.apply(delegate, this, arguments);
      const s = getSpec();
      const pxPerMm = dpi / 25.4;
      const w = Math.max(1, Math.round(s.totalW * pxPerMm));
      const h = Math.max(1, Math.round(s.totalH * pxPerMm));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      state.hitBoxes = {};
      state.selectionBox = null;
      const mm = (v) => v * pxPerMm;
      const bleed = mm(s.bleed), trimW = mm(s.trimW), trimH = mm(s.trimH), spine = mm(s.spine), totalH = mm(s.totalH);
      const backX = 0, spineX = bleed + trimW, frontX = spineX + spine;
      const backImageRect = { x: backX, y: 0, w: bleed + trimW, h: totalH };
      const frontImageRect = { x: frontX, y: 0, w: trimW + bleed, h: totalH };
      const backPanel = { x: bleed, y: bleed, w: trimW, h: trimH };
      const frontPanel = { x: frontX, y: bleed, w: trimW, h: trimH };
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      drawImage(ctx, state.__localSpreadImage, { x: 0, y: 0, w, h: totalH }, 'cover', '#fff', { x: 0, y: 0, scale: 100 });
      if (state.backImage) drawImage(ctx, state.backImage, backImageRect, $('imageFit').value, $('backColor').value, state.layout.backImage);
      if (state.frontImage) drawImage(ctx, state.frontImage, frontImageRect, $('imageFit').value, $('frontColor').value, state.layout.frontImage);
      state.hitBoxes.backImage = backImageRect;
      state.hitBoxes.frontImage = frontImageRect;
      const color = $('textColor').value;
      const titlePx = clamp(num('titleSize', 28), 10, 80) * dpi / 72;
      const maxTextW = trimW * .78;
      drawText(ctx, 'frontTitle', $('frontTitle').value, frontPanel, maxTextW, titlePx, color, 1.25, true);
      drawText(ctx, 'frontSubtitle', $('frontSubtitle').value, frontPanel, maxTextW, titlePx * .52, color, 1.2, false);
      drawText(ctx, 'publisher', [$('publisher').value.trim(), $('publishYear').value.trim()].filter(Boolean).join(' · '), frontPanel, maxTextW, titlePx * .42, color, 1.15, true);
      drawText(ctx, 'backText', $('backText').value, backPanel, trimW * .72, titlePx * .42, color, 1.35, false);
      drawSpine(ctx, s, pxPerMm, spineX, bleed, trimH);
      if (withGuides) {
        ctx.save();
        ctx.lineWidth = Math.max(1, dpi / 100);
        ctx.setLineDash([mm(2), mm(1.2)]);
        ctx.strokeStyle = 'rgba(220,38,38,.92)';
        ctx.strokeRect(bleed, bleed, trimW, trimH);
        ctx.strokeRect(frontX, bleed, trimW, trimH);
        ctx.strokeStyle = 'rgba(37,99,235,.92)';
        ctx.beginPath();
        ctx.moveTo(spineX, bleed); ctx.lineTo(spineX, bleed + trimH);
        ctx.moveTo(frontX, bleed); ctx.lineTo(frontX, bleed + trimH);
        ctx.stroke();
        const safe = mm(s.safe);
        ctx.strokeStyle = 'rgba(21,128,61,.85)';
        ctx.strokeRect(bleed + safe, bleed + safe, trimW - safe * 2, trimH - safe * 2);
        ctx.strokeRect(frontX + safe, bleed + safe, trimW - safe * 2, trimH - safe * 2);
        ctx.restore();
      }
      if (interactive) drawSelection(ctx, state.hitBoxes[state.active], dpi);
      return s;
    };
    patched.__localSpreadRendererV1 = true;
    patched.__localSpreadDelegate = delegate;
    window.renderCover = patched;
    renderPatchCount += 1;
    return true;
  }

  function install() {
    patchRenderCover();
    if (installed) return true;
    if (typeof state === 'undefined' || !$('frontInput')) return false;
    styles();
    if (!makeCopyrightNotice()) return false;
    if (!makeLocalSpreadUpload()) return false;
    installed = true;
    document.documentElement.dataset.coverLocalImageUpload = '1';
    document.documentElement.dataset.coverCopyrightNotice = '1';
    return true;
  }

  window.CoverLocalImageUpload = {
    install,
    clearSpread,
    makeCopyrightNotice,
    patchRenderCover,
    stage: 'user-local-cover-images-only',
    get renderPatchCount() { return renderPatchCount; },
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
  setTimeout(patchRenderCover, 3200);
})();
