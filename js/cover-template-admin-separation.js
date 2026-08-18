// Remove retired administrator-provided cover image controls from the user-facing cover maker.
(function () {
  'use strict';
  if (window.__coverTemplateAdminSeparationV2) return;
  window.__coverTemplateAdminSeparationV2 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [100, 350, 800, 1400, 2300];
  let installed = false;

  function removeLegacyProviderUi() {
    let removed = false;
    const select = document.getElementById('coverTemplateSelect');
    const providerBlock = select?.closest('div[style*="border-top"]');
    if (providerBlock) {
      providerBlock.remove();
      removed = true;
    }

    for (const id of [
      'adminTemplateArea',
      'coverProvidedImageLibraryPanel',
      'coverServiceImagePanel',
      'coverTemplateAdminConsoleNote',
    ]) {
      const element = document.getElementById(id);
      if (element) {
        element.remove();
        removed = true;
      }
    }

    for (const id of ['applyCoverTemplate', 'refreshCoverTemplates']) {
      const button = document.getElementById(id);
      if (button?.parentElement) {
        button.parentElement.remove();
        removed = true;
      } else if (button) {
        button.remove();
        removed = true;
      }
    }

    document.getElementById('coverTemplateInfo')?.remove();
    document.documentElement.dataset.coverLegacyProvidedImagesRemoved = '1';
    installed = installed || removed;
    return removed;
  }

  function install() {
    removeLegacyProviderUi();
    return true;
  }

  window.CoverTemplateAdminSeparation = {
    install,
    removeLegacyProviderUi,
    get installed() { return installed; },
    stage: 'legacy-provided-cover-images-removed',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);

  const observer = new MutationObserver(() => removeLegacyProviderUi());
  const startObserver = () => {
    if (!document.body) return;
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 5000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  else startObserver();
})();
