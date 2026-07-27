// Single-flight preview controller for all PDF editor modules.
(function () {
  'use strict';
  if (window.__pdfPreviewControllerV3) return;
  window.__pdfPreviewControllerV3 = true;

  let installed = false;
  let timer = null;
  let running = false;
  let rerunRequested = false;
  let rerunForced = false;
  let currentPromise = null;
  let lastSignature = '';
  let activeSignature = '';
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

  function elementValue(id) {
    const element = byId(id);
    if (!element) return '';
    if (element.type === 'checkbox' || element.type === 'radio') return element.checked ? '1' : '0';
    return String(element.value ?? '');
  }

  function stableObject(value) {
    if (!value || typeof value !== 'object') return '';
    if (Array.isArray(value)) return JSON.stringify(value);
    const ordered = {};
    Object.keys(value).sort().forEach((key) => { ordered[key] = value[key]; });
    return JSON.stringify(ordered);
  }

  function globalEditorValues() {
    const values = [];
    try { values.push(`nup:${nup}`); } catch (_) {}
    try { values.push(`landscape:${landscape ? 1 : 0}`); } catch (_) {}
    try { values.push(`order:${orderLR ? 'lr' : 'tb'}`); } catch (_) {}
    try { values.push(`border:${showBorder ? 1 : 0}`); } catch (_) {}
    try { values.push(`fileNup:${stableObject(fileNupMap)}`); } catch (_) {}
    try { values.push(`hfSections:${JSON.stringify(hfSections || [])}`); } catch (_) {}
    return values.join('|');
  }

  function pageSignature() {
    try {
      return parsedPages.map((page) => [
        page.id,
        page.excluded ? 1 : 0,
        page.rotation || 0,
        page.nupOverride ?? '',
        page.nupDisabled ? 1 : 0,
        page.groupBreak ? 1 : 0,
        page.pageType || 'pdf',
        page.file_index ?? '',
        page.page_index ?? '',
        page.dividerContent ? JSON.stringify(page.dividerContent) : '',
      ].join(':')).join('|');
    } catch (_) {
      return '';
    }
  }

  function stateSignature() {
    try {
      const ids = [
        'paperSize', 'customW', 'customH',
        'marginLeft', 'marginRight', 'marginTop', 'marginBottom', 'marginH', 'marginV', 'gap',
        'showBorder', 'bookletCheck', 'facingPages',
        'wmEnabled', 'wmText', 'wmOpacity', 'wmAngle', 'wmColor',
        'hfEnabled', 'hfHL', 'hfHC', 'hfHR', 'hfFL', 'hfFC', 'hfFR',
        'hfFontSize', 'hfColor', 'hfMarginMm', 'hfApplyTo',
        'pnEnabled', 'pnFormat', 'pnStart', 'pnFontSize', 'pnColor', 'pnExcludeFirst',
        'pnApplyTo', 'pnMarginMm', 'pnAutoReserve',
        'printMarksEnabled', 'printBleedMm', 'printMarkLengthMm', 'printMarkOffsetMm',
      ];
      const values = ids.map((id) => `${id}:${elementValue(id)}`);
      values.push(`pnPosition:${document.querySelector('.pn-pos-btn.active')?.dataset.pos || ''}`);
      values.push(`nupButton:${document.querySelector('.nup-btn.active')?.dataset.nup || ''}`);
      values.push(`orientation:${document.querySelector('.orient-btn.active')?.id || ''}`);
      values.push(`orderButton:${document.querySelector('#orderLR.active,#orderTB.active')?.id || ''}`);
      values.push(globalEditorValues());
      values.push(pageSignature());
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
      // The legacy watchdog calls triggerPreview every 500 ms while a long preview
      // is still being built. Do not queue the same state again. Only a real state
      // change or an explicit manual request may schedule one follow-up pass.
      if (force) {
        rerunRequested = true;
        rerunForced = true;
      } else if (signature !== activeSignature) {
        rerunRequested = true;
      }
      return currentPromise;
    }

    running = true;
    activeSignature = signature;
    currentPromise = (async () => {
      let nextForce = !!force;
      let passCount = 0;
      do {
        rerunRequested = false;
        rerunForced = false;
        const startedSignature = stateSignature();
        activeSignature = startedSignature;
        await originalTrigger();
        const finishedSignature = stateSignature();
        lastSignature = finishedSignature;
        passCount += 1;
        if (finishedSignature !== startedSignature && passCount < 2) rerunRequested = true;
        nextForce = rerunForced;
      } while (rerunRequested && passCount < 2 && (!fastMode() || nextForce));
    })();

    try {
      await currentPromise;
    } catch (error) {
      console.warn('[pdf-preview-controller] preview failed', error);
    } finally {
      running = false;
      currentPromise = null;
      activeSignature = '';
      rerunRequested = false;
      rerunForced = false;
    }
  }

  function request(delay, force) {
    clearTimeout(timer);
    const wait = Number.isFinite(Number(delay)) ? Math.max(0, Number(delay)) : 350;
    timer = setTimeout(() => execute(!!force), wait);
  }

  function invalidate() {
    lastSignature = '';
  }

  function installEvents() {
    if (window.__pdfPreviewControllerEventsV3) return;
    window.__pdfPreviewControllerEventsV3 = true;

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
      if (target.matches('select,input[type="number"],input[type="checkbox"],input[type="color"],input[type="text"]')) request(320, false);
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="number"],input[type="text"],input[type="range"],input[type="color"]')) request(480, false);
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target?.closest('.nup-btn,.orient-btn,#orderLR,#orderTB,.pn-pos-btn,.wm-preset')) request(180, false);
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
      const force = !!window.__pdfEditorManualPreviewRequest;
      // Manual force is one-shot. Leaving this flag set made every watchdog call a
      // forced render after the first manual preview.
      window.__pdfEditorManualPreviewRequest = false;
      return execute(force);
    };
    const controlledSchedule = function controlledSchedulePreview(delay) {
      request(delay, false);
    };
    controlledTrigger.__pdfPreviewControllerV3 = true;
    controlledSchedule.__pdfPreviewControllerV3 = true;

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
    refresh: () => { invalidate(); request(0, true); },
    invalidate,
    isRunning: () => running,
    signature: stateSignature,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
