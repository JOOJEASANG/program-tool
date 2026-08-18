// Remove the retired cover-template surface, including stale cached variants.
(function () {
  'use strict';
  if (window.__coverTemplateSurfaceCleanupV2) return;
  window.__coverTemplateSurfaceCleanupV2 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 180, 420, 760, 1200, 1900, 2800, 4500];
  const IDS = [
    'templateCard', 'coverTemplateSelect', 'adminTemplateArea',
    'coverBuiltinPreset', 'applyBuiltinPreset', 'userCoverTemplate',
    'userCoverTemplateName', 'saveUserCoverTemplate', 'applyUserCoverTemplate',
    'deleteUserCoverTemplate', 'saveCoverTemplate', 'deleteCoverTemplate',
  ];

  function removeTemplateSurface() {
    for (const id of IDS) document.getElementById(id)?.remove();
    document.querySelectorAll('.settings .card, .settings section').forEach((card) => {
      const title = card.querySelector('.card-title,.panel-title,h2,h3,strong')?.textContent?.trim() || '';
      if (title === '표지 템플릿' || title === '제공 이미지 템플릿' || title === '관리자 제공 이미지 템플릿') card.remove();
    });
    document.documentElement.dataset.coverTemplateSurface = 'removed';
    return true;
  }

  function ensurePreviewInspector() {
    if (window.CoverPreviewTextInspector || document.getElementById('coverPreviewTextInspectorScriptV1')) return;
    const script = document.createElement('script');
    script.id = 'coverPreviewTextInspectorScriptV1';
    script.src = '/js/cover-preview-text-inspector.js?v=20260818-1';
    script.async = false;
    document.head.appendChild(script);
  }

  function install() {
    removeTemplateSurface();
    ensurePreviewInspector();
  }

  window.CoverTemplateSurfaceCleanup = {
    removeTemplateSurface,
    install,
    stage: 'template-surface-fully-removed',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
