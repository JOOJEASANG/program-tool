// Final safety boundary for the current book-cover editor runtime.
(function () {
  'use strict';
  if (window.__coverRuntimeSafetyV1) return;
  window.__coverRuntimeSafetyV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const LEGACY_TEXT_IDS = [
    'frontTitle', 'frontSubtitle', 'publisher', 'publishYear', 'backText',
    'spineTitle', 'spineTop', 'spineCenter', 'spineBottom',
  ];
  const OUTPUT_IDS = ['pdfBtn', 'guidePdfBtn', 'pngBtn'];
  const INSTALL_DELAYS = [0, 180, 420, 800, 1250, 1900, 2800];

  function snapshotLegacyText() {
    const values = {};
    for (const id of LEGACY_TEXT_IDS) {
      const element = document.getElementById(id);
      if (element) values[id] = element.value;
    }
    return values;
  }

  function restoreLegacyText(values) {
    for (const [id, value] of Object.entries(values || {})) {
      const element = document.getElementById(id);
      if (element && element.value !== value) element.value = value;
    }
  }

  function wrapRenderCover() {
    const current = window.renderCover;
    if (typeof current !== 'function') return false;
    if (current.__coverRuntimeSafetyV1) return true;

    function guardedCoverRender() {
      const legacyValues = snapshotLegacyText();
      try {
        return current.apply(this, arguments);
      } finally {
        restoreLegacyText(legacyValues);
      }
    }
    guardedCoverRender.__coverRuntimeSafetyV1 = true;
    guardedCoverRender.original = current;
    window.renderCover = guardedCoverRender;
    return true;
  }

  function visibleFrontTitle() {
    try {
      const title = window.CoverProjectStateBridge?.primaryText?.('front');
      if (String(title || '').trim()) return String(title).trim();
    } catch (_) {}
    return String(document.getElementById('frontTitle')?.value || '').trim();
  }

  function safeFileStem() {
    return (visibleFrontTitle() || '책표지_작업')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60) || '책표지_작업';
  }

  function installSafeName() {
    window.safeName = safeFileStem;
  }

  function hasBlockingPreflightError() {
    const list = document.getElementById('coverPreflightList');
    if (list) {
      const error = [...list.querySelectorAll('strong')].some((node) =>
        String(node.textContent || '').trim().startsWith('✕')
      );
      if (error) return true;
    }
    const summary = document.getElementById('coverPreflightSummary');
    return String(summary?.textContent || '').trim().startsWith('출력 전 수정 필요');
  }

  function blockUnsafeOutput(event) {
    if (!hasBlockingPreflightError()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    try {
      if (typeof window.setStatus === 'function') {
        window.setStatus('인쇄 전 점검 오류를 먼저 수정해 주세요.', 'err');
      }
    } catch (_) {}
    document.getElementById('coverPreflightCard')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  function installOutputGuards() {
    for (const id of OUTPUT_IDS) {
      const button = document.getElementById(id);
      if (!button || button.dataset.coverSafetyGuardV1 === '1') continue;
      button.dataset.coverSafetyGuardV1 = '1';
      button.addEventListener('click', blockUnsafeOutput, { capture: true });
    }
  }

  function install() {
    wrapRenderCover();
    installSafeName();
    installOutputGuards();
  }

  window.CoverRuntimeSafety = {
    wrapRenderCover,
    safeFileStem,
    visibleFrontTitle,
    hasBlockingPreflightError,
    installOutputGuards,
    stage: 'runtime-audit-preflight-render-filename',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
