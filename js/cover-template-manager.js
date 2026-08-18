// Cover template UI retired. Keep this tiny guard for stale cached pages that still load the old script path.
(function () {
  'use strict';
  if (window.__coverTemplateUiRetiredV1) return;
  window.__coverTemplateUiRetiredV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const LEGACY_IDS = [
    'templateCard',
    'coverBuiltinPreset',
    'userCoverTemplate',
    'userCoverTemplateName',
    'saveUserCoverTemplate',
    'applyUserCoverTemplate',
    'deleteUserCoverTemplate',
    'coverTemplateSelect',
    'adminTemplateArea',
  ];

  function removeTemplateUi() {
    for (const id of LEGACY_IDS) document.getElementById(id)?.remove();
    document.querySelectorAll('.settings .card').forEach((card) => {
      const title = card.querySelector('.card-title')?.textContent?.trim() || '';
      if (title === '표지 템플릿' || title === '제공 이미지 템플릿') card.remove();
    });
    document.documentElement.dataset.coverTemplateUi = 'retired';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', removeTemplateUi, { once: true });
  else removeTemplateUi();
  for (const delay of [150, 500, 1100, 2200, 4000]) setTimeout(removeTemplateUi, delay);

  window.CoverTemplateManager = {
    removeTemplateUi,
    stage: 'template-ui-retired',
  };
})();
