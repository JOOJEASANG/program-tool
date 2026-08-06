// Final render entrypoint contract after all cover renderer wrappers have settled.
(function () {
  'use strict';
  if (window.__coverRenderPipelineContractV1) return;
  window.__coverRenderPipelineContractV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [3200, 3800, 4600];
  const RETIRED_SCRIPT_PARTS = [
    'cover-editor-multiselect.js',
    'cover-editor-layer-style.js',
  ];

  let delegate = null;
  let owner = null;
  let installed = false;
  let driftDetected = false;

  function retireCompatibilityScripts() {
    for (const script of document.querySelectorAll('script[src]')) {
      const src = String(script.getAttribute('src') || script.src || '');
      if (!RETIRED_SCRIPT_PARTS.some((part) => src.includes(part))) continue;
      script.dataset.coverCompatibilityRetired = '1';
      script.remove();
    }
  }

  function makeOwner() {
    if (owner) return owner;
    owner = function coverRenderPipelineOwner(...args) {
      if (typeof delegate !== 'function') {
        throw new Error('책표지 렌더러가 준비되지 않았습니다.');
      }
      return Reflect.apply(delegate, this, args);
    };
    owner.__coverRenderPipelineOwner = true;
    return owner;
  }

  function install() {
    retireCompatibilityScripts();
    if (installed) return true;
    const current = window.renderCover;
    if (typeof current !== 'function') return false;
    delegate = current;
    window.renderCover = makeOwner();
    installed = true;
    return true;
  }

  function detectDrift() {
    driftDetected = Boolean(installed && owner && window.renderCover !== owner);
    if (driftDetected) {
      console.warn('Cover render pipeline ownership changed after final installation.');
    }
    return driftDetected;
  }

  function render(...args) {
    const target = installed ? owner : window.renderCover;
    if (typeof target !== 'function') throw new Error('책표지 렌더러가 준비되지 않았습니다.');
    return Reflect.apply(target, this, args);
  }

  window.CoverRenderPipeline = {
    install,
    render,
    detectDrift,
    retireCompatibilityScripts,
    get installed() { return installed; },
    get driftDetected() { return driftDetected; },
    get delegate() { return delegate; },
    get owner() { return owner; },
    stage: 'final-render-entrypoint-contract',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
  setTimeout(detectDrift, 5600);
})();
