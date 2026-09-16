// Compatibility shim for the retired PDF unified-workspace quota hook.
(function(){
  'use strict';
  if(window.__programStudioPdfUnifiedQuotaRetiredV1)return;
  window.__programStudioPdfUnifiedQuotaRetiredV1=true;
  window.ProgramStudioPdfUnifiedQuota=Object.freeze({stage:'pdf-suite-unified-quota-retired'});
  document.documentElement.dataset.pdfUnifiedQuota='retired';
})();
