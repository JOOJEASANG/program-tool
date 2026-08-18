// Keep legacy administrator-provided cover template controls out of the user-facing cover maker.
(function () {
  'use strict';
  if (window.__coverTemplateAdminSeparationV1) return;
  window.__coverTemplateAdminSeparationV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [700, 1200, 1800, 2500, 3300];
  let installed = false;

  function hideElement(element) {
    if (!element) return;
    element.hidden = true;
    element.style.display = 'none';
    element.setAttribute('aria-hidden', 'true');
    element.querySelectorAll?.('input,select,button').forEach((control) => {
      control.disabled = true;
      control.dataset.legacyProvidedImageDisabled = '1';
    });
  }

  function install() {
    const area = document.getElementById('adminTemplateArea');
    const select = document.getElementById('coverTemplateSelect');
    const provided = document.getElementById('coverProvidedImageLibraryPanel');
    const service = document.getElementById('coverServiceImagePanel');

    hideElement(area);
    hideElement(select?.closest('.field'));
    hideElement(provided);
    hideElement(service);

    const apply = document.getElementById('applyCoverTemplate');
    const refresh = document.getElementById('refreshCoverTemplates');
    if (apply?.parentElement) hideElement(apply.parentElement);
    if (refresh?.parentElement) hideElement(refresh.parentElement);
    hideElement(document.getElementById('coverTemplateInfo'));
    document.getElementById('coverTemplateAdminConsoleNote')?.remove();

    installed = Boolean(area || select || provided || service);
    document.documentElement.dataset.coverLegacyProvidedImagesDisabled = '1';
    return installed;
  }

  window.CoverTemplateAdminSeparation = {
    install,
    get installed() { return installed; },
    stage: 'legacy-provided-cover-images-disabled',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();