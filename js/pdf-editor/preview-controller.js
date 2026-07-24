// Single-flight preview controller for all PDF editor modules.
(function () {
  'use strict';
  if (window.__pdfPreviewControllerV1) return;
  window.__pdfPreviewControllerV1 = true;

  let installed = false;
  let timer = null;
  let running = false;
  let rerunRequested = false;
  let rerunForced = false;
  let currentPromise = null;
  let lastSignature = '';
  let thumbObserver = null;
  let originalTrigger = null;

  const byId = (id) => document.getElementById(id);

  function editorReady() {
    try {
      return (
        typeof triggerPreview === 'function' &&
        typeof schedulePreview === 'function' &&
        Array.isArray(parsedPages)
      );
    } catch (_) {
      return false;
    }
  }

  function fastMode() {
    return !!window.__pdfEditorFastMode;
  }

  function stateSignature() {
    try {
      const activeNup = document.querySelector('.nup-btn.active')?.dataset.nup || '';
      const pages = parsedPages.map((page) => [
        page.id,
        page.excluded ? 1 : 0,
        page.rotation || 0,
        page.nupOverride ?? '',
        page.nupDisabled ? 1 : 0,
        page.groupBreak ? 1 : 0,
        page.pageType || 'pdf',
      ].join(':')).join('|');
      const values = [
        activeNup,
        byId('paperSize')?.value || '',
        byId('customW')?.value || '',
        byId('customH')?.value || '',
        byId('marginLeft')?.value || byId('marginH')?.value || '',
        byId('marginRight')?.value || byId('marginH')?.value || '',
        byId('marginTop')?.value || byId('marginV')?.value || '',
        byId('marginBottom')?.value || byId('marginV')?.value || '',
        byId('gap')?.value || '',
        byId('showBorder')?.checked ? '1' : '0',
        byId('bookletCheck')?.checked ? '1' : '0',
        byId('facingPages')?.checked ? '1' : '0',
        byId('pnEnabled')?.checked ? '1' : '0',
        byId('pnPosition')?.value || document.querySelector('.pn-pos-btn.active')?.dataset.pos || '',
        byId('pnMarginMm')?.value || '',
        byId('pnFontSize')?.value || '',
        pages,
      ];
      return values.join('~');
    } catch (_) {
      return String(Date.now());
    }
  }

  function previewVisible() {
    return !!document.querySelector('#previewScroll .page-preview');
  }

  async function execute(force) {
    if (!editorReady() || !parsedPages.length) return;
    if (fastMode() && !force) return;

    const signature = stateSignature();
    if (!force && signature === lastSignature && previewVisible()) return;

    if (running) {
      rerunRequested = true;
      rerunForced = rerunForced || !!force;
      return currentPromise;
    }

    running = true;
    currentPromise = (async () => {
      let nextForce = !!force;
      do {
        rerunRequested = false;
        rerunForced = false;
        if (nextForce) window.__pdfEditorManualPreviewRequest = true;
        await originalTrigger();
        lastSignature = stateSignature();
        nextForce = rerunForced;
      } while (rerunRequested && (!fastMode() || nextForce));
    })();

    try {
      await currentPromise;
    } catch (error) {
      console.warn('[pdf-preview-controller] preview failed', error);
    } finally {
      running = false;
      currentPromise = null;
    }
  }

  function request(delay, force) {
    clearTimeout(timer);
    const wait = Number.isFinite(Number(delay)) ? Math.max(0, Number(delay)) : 350;
    timer = setTimeout(() => execute(!!force), wait);
  }

  function installEvents() {
    if (window.__pdfPreviewControllerEventsV1) return;
    window.__pdfPreviewControllerEventsV1 = true;

    const previewButton = byId('previewBtn');
    if (previewButton) {
      previewButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        request(0, true);
      }, true);
    }

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || target.matches('input[type="file"]')) return;
      if (target.matches('select,input[type="number"],input[type="checkbox"],input[type="color"]')) request(320, false);
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="number"],input[type="text"],input[type="range"],input[type="color"]')) request(480, false);
    }, true);

    const area = byId('thumbArea');
    if (area && !thumbObserver) {
      thumbObserver = new MutationObserver(() => request(420, false));
      thumbObserver.observe(area, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-id'],
      });
    }
  }

  function install() {
    if (installed) return true;
    if (!editorReady()) return false;

    originalTrigger = triggerPreview;
    const controlledTrigger = function controlledTriggerPreview() {
      return execute(!!window.__pdfEditorManualPreviewRequest);
    };
    const controlledSchedule = function controlledSchedulePreview(delay) {
      request(delay, false);
    };
    controlledTrigger.__pdfPreviewControllerV1 = true;
    controlledSchedule.__pdfPreviewControllerV1 = true;

    triggerPreview = controlledTrigger;
    schedulePreview = controlledSchedule;
    window.triggerPreview = controlledTrigger;
    window.schedulePreview = controlledSchedule;
    installEvents();
    installed = true;
    return true;
  }

  function boot(attempt) {
    if (!install() && attempt < 12) setTimeout(() => boot(attempt + 1), 140 + attempt * 60);
  }

  window.PdfPreviewController = {
    request,
    refresh: () => request(0, true),
    isRunning: () => running,
    signature: stateSignature,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
