// Effective print-DPI diagnostics for front and back cover images.
(function () {
  'use strict';
  if (window.__coverImagePrintQualityV1) return;
  window.__coverImagePrintQualityV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 240, 620, 1100, 1800, 2800];
  const RELEVANT_INPUT_IDS = new Set([
    'trimW', 'trimH', 'bleed', 'imageFit', 'posX', 'posY', 'itemScale',
    'editTarget', 'frontInput', 'backInput',
  ]);
  const RELEVANT_CLICK_IDS = new Set([
    'copyFrontBtn', 'clearImagesBtn', 'resetTargetBtn', 'centerTargetBtn',
    'resetAllLayoutBtn', 'applyCoverTemplate', 'refreshCoverTemplates',
  ]);

  let bound = false;
  let frame = 0;
  let observer = null;

  const byId = (id) => document.getElementById(id);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positive = (value, fallback = 1) => {
    const number = finite(value, fallback);
    return number > 0 ? number : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function gradeDpi(value) {
    const dpi = finite(value, 0);
    if (dpi >= 300) return { level: 'excellent', label: '최적', message: '300DPI 이상' };
    if (dpi >= 250) return { level: 'good', label: '양호', message: '일반 인쇄에 적합' };
    if (dpi >= 180) return { level: 'caution', label: '주의', message: '가까이 보면 흐릴 수 있음' };
    if (dpi >= 120) return { level: 'low', label: '낮음', message: '인쇄 시 흐림 가능성 큼' };
    return { level: 'danger', label: '위험', message: '더 큰 원본 이미지 권장' };
  }

  function calculateEffectiveDpi(source = {}) {
    const imageWidth = positive(source.imageWidth, 0);
    const imageHeight = positive(source.imageHeight, 0);
    const rectWidthMm = positive(source.rectWidthMm, 0);
    const rectHeightMm = positive(source.rectHeightMm, 0);
    if (!imageWidth || !imageHeight || !rectWidthMm || !rectHeightMm) {
      return {
        available: false,
        dpi: 0,
        renderedWidthMm: 0,
        renderedHeightMm: 0,
        cropPercent: 0,
        hasBlankArea: false,
        grade: gradeDpi(0),
      };
    }

    const fit = source.fit === 'contain' ? 'contain' : 'cover';
    const scalePercent = clamp(positive(source.scalePercent, 100), 1, 1000);
    const widthMmPerPixel = rectWidthMm / imageWidth;
    const heightMmPerPixel = rectHeightMm / imageHeight;
    const baseMmPerPixel = fit === 'contain'
      ? Math.min(widthMmPerPixel, heightMmPerPixel)
      : Math.max(widthMmPerPixel, heightMmPerPixel);
    const mmPerPixel = baseMmPerPixel * scalePercent / 100;
    const renderedWidthMm = imageWidth * mmPerPixel;
    const renderedHeightMm = imageHeight * mmPerPixel;
    const visibleWidthRatio = Math.min(1, rectWidthMm / renderedWidthMm);
    const visibleHeightRatio = Math.min(1, rectHeightMm / renderedHeightMm);
    const cropPercent = fit === 'cover'
      ? Math.max(0, (1 - visibleWidthRatio * visibleHeightRatio) * 100)
      : 0;
    const hasBlankArea = renderedWidthMm + 0.05 < rectWidthMm
      || renderedHeightMm + 0.05 < rectHeightMm;
    const dpi = 25.4 / mmPerPixel;

    return {
      available: Number.isFinite(dpi) && dpi > 0,
      dpi,
      renderedWidthMm,
      renderedHeightMm,
      cropPercent,
      hasBlankArea,
      fit,
      scalePercent,
      grade: gradeDpi(dpi),
    };
  }

  function currentSpec() {
    try {
      if (typeof getSpec === 'function') return getSpec();
    } catch (_) {}
    const trimW = positive(byId('trimW')?.value, 210);
    const trimH = positive(byId('trimH')?.value, 297);
    const bleed = Math.max(0, finite(byId('bleed')?.value, 3));
    return { trimW, trimH, bleed, totalH: trimH + bleed * 2 };
  }

  function imageFor(side) {
    try {
      if (typeof state === 'undefined') return null;
      return side === 'front' ? state.frontImage : state.backImage;
    } catch (_) {
      return null;
    }
  }

  function imageScale(side) {
    const key = side === 'front' ? 'frontImage' : 'backImage';
    try {
      if (typeof state !== 'undefined' && state.layout?.[key]) {
        return positive(state.layout[key].scale, 100);
      }
    } catch (_) {}
    return 100;
  }

  function measureSide(side) {
    const image = imageFor(side);
    const imageWidth = positive(image?.naturalWidth || image?.width, 0);
    const imageHeight = positive(image?.naturalHeight || image?.height, 0);
    if (!imageWidth || !imageHeight) {
      return {
        side,
        available: false,
        imageWidth: 0,
        imageHeight: 0,
        grade: { level: 'empty', label: '이미지 없음', message: '배경색만 출력됩니다.' },
      };
    }
    const spec = currentSpec();
    const result = calculateEffectiveDpi({
      imageWidth,
      imageHeight,
      rectWidthMm: positive(spec.trimW, 210) + Math.max(0, finite(spec.bleed, 3)),
      rectHeightMm: positive(spec.totalH, positive(spec.trimH, 297) + Math.max(0, finite(spec.bleed, 3)) * 2),
      fit: byId('imageFit')?.value || 'cover',
      scalePercent: imageScale(side),
    });
    return { ...result, side, imageWidth, imageHeight };
  }

  function installStyles() {
    if (byId('coverImagePrintQualityStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverImagePrintQualityStyles';
    style.textContent = `
      .cover-image-quality{margin-top:8px;padding:8px;border:1px solid #dbe5ee;border-radius:9px;background:#f8fafc}
      .cover-image-quality-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
      .cover-image-quality-title{font-size:9px;font-weight:900;color:#334155}
      .cover-image-quality-note{font-size:8px;color:#64748b}
      .cover-image-quality-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .cover-image-quality-row{min-width:0;border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:7px}
      .cover-image-quality-top{display:flex;align-items:center;gap:5px;min-width:0}
      .cover-image-quality-side{font-size:8px;font-weight:900;color:#475569;white-space:nowrap}
      .cover-image-quality-badge{margin-left:auto;border-radius:999px;padding:2px 6px;font-size:8px;font-weight:900;white-space:nowrap}
      .cover-image-quality-detail{margin-top:4px;font-size:8px;line-height:1.4;color:#64748b;word-break:keep-all}
      .cover-image-quality-row[data-level="excellent"] .cover-image-quality-badge{background:#dcfce7;color:#166534}
      .cover-image-quality-row[data-level="good"] .cover-image-quality-badge{background:#ecfdf5;color:#047857}
      .cover-image-quality-row[data-level="caution"] .cover-image-quality-badge{background:#fef3c7;color:#92400e}
      .cover-image-quality-row[data-level="low"] .cover-image-quality-badge,
      .cover-image-quality-row[data-level="danger"] .cover-image-quality-badge{background:#fee2e2;color:#b91c1c}
      .cover-image-quality-row[data-level="empty"] .cover-image-quality-badge{background:#e2e8f0;color:#64748b}
      @media(max-width:620px){.cover-image-quality-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function makeRow(side, label) {
    const row = document.createElement('div');
    row.className = 'cover-image-quality-row';
    row.id = `coverImageQuality${side === 'front' ? 'Front' : 'Back'}`;
    row.dataset.level = 'empty';
    row.innerHTML = `<div class="cover-image-quality-top"><span class="cover-image-quality-side">${label}</span><span class="cover-image-quality-badge">이미지 없음</span></div><div class="cover-image-quality-detail">배경색만 출력됩니다.</div>`;
    return row;
  }

  function ensurePanel() {
    let panel = byId('coverImagePrintQuality');
    if (panel) return panel;
    const imageFit = byId('imageFit');
    const anchor = imageFit?.closest?.('.field');
    const card = imageFit?.closest?.('.card');
    if (!anchor || !card) return null;
    panel = document.createElement('div');
    panel.id = 'coverImagePrintQuality';
    panel.className = 'cover-image-quality';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    const head = document.createElement('div');
    head.className = 'cover-image-quality-head';
    head.innerHTML = '<span class="cover-image-quality-title">인쇄 이미지 품질</span><span class="cover-image-quality-note">현재 확대율 기준</span>';
    const grid = document.createElement('div');
    grid.className = 'cover-image-quality-grid';
    grid.append(makeRow('back', '뒤표지'), makeRow('front', '앞표지'));
    panel.append(head, grid);
    anchor.insertAdjacentElement('afterend', panel);
    return panel;
  }

  function renderResult(result) {
    const suffix = result.side === 'front' ? 'Front' : 'Back';
    const row = byId(`coverImageQuality${suffix}`);
    if (!row) return;
    const badge = row.querySelector('.cover-image-quality-badge');
    const detail = row.querySelector('.cover-image-quality-detail');
    row.dataset.level = result.grade.level;
    if (!result.available) {
      badge.textContent = result.grade.label;
      detail.textContent = result.grade.message;
      row.removeAttribute('title');
      return;
    }

    const dpi = Math.max(1, Math.round(result.dpi));
    badge.textContent = `${result.grade.label} · ${dpi}DPI`;
    const notes = [
      `${Math.round(result.imageWidth).toLocaleString()}×${Math.round(result.imageHeight).toLocaleString()}px`,
      `${Math.round(result.scalePercent)}% 확대`,
    ];
    if (result.fit === 'cover' && result.cropPercent >= 3) {
      notes.push(`약 ${Math.round(result.cropPercent)}% 잘림`);
    } else if (result.fit === 'contain' && result.hasBlankArea) {
      notes.push('가장자리에 배경색 표시');
    } else {
      notes.push(result.grade.message);
    }
    detail.textContent = notes.join(' · ');
    row.title = `예상 인쇄 해상도 ${dpi}DPI · ${result.grade.message}`;
  }

  function update() {
    ensurePanel();
    const back = measureSide('back');
    const front = measureSide('front');
    renderResult(back);
    renderResult(front);
    const panel = byId('coverImagePrintQuality');
    if (panel) {
      const values = [back, front].filter((item) => item.available).map((item) => item.dpi);
      panel.dataset.lowestDpi = values.length ? String(Math.round(Math.min(...values))) : '';
      panel.dataset.hasLowQuality = String(values.some((dpi) => dpi < 180));
    }
    return { back, front };
  }

  function scheduleUpdate() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }

  function scheduleDelayedUpdates() {
    scheduleUpdate();
    setTimeout(scheduleUpdate, 120);
    setTimeout(scheduleUpdate, 520);
  }

  function handleInput(event) {
    if (RELEVANT_INPUT_IDS.has(event.target?.id)) scheduleDelayedUpdates();
  }

  function handleClick(event) {
    const target = event.target?.closest?.('button');
    if (target && RELEVANT_CLICK_IDS.has(target.id)) scheduleDelayedUpdates();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('input', handleInput, true);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('click', handleClick, true);
    const canvas = byId('previewCanvas');
    canvas?.addEventListener('pointerup', scheduleDelayedUpdates, true);
    canvas?.addEventListener('wheel', scheduleDelayedUpdates, { capture: true, passive: true });
    canvas?.addEventListener('dblclick', scheduleDelayedUpdates, true);

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(scheduleDelayedUpdates);
      for (const element of [byId('frontName'), byId('backName'), byId('frontUploadBox'), byId('backUploadBox')]) {
        if (element) observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      }
    }
  }

  function install() {
    installStyles();
    ensurePanel();
    bind();
    scheduleDelayedUpdates();
  }

  window.CoverImagePrintQuality = {
    gradeDpi,
    calculateEffectiveDpi,
    measureSide,
    update,
    stage: 'effective-print-dpi-diagnostics',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
