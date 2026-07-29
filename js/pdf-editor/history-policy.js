// PDF editor history policy module.
// Documents the storage policy and guards against accidentally saving source uploads.
(function () {
  if (window.__pdfEditorHistoryPolicyV1) return;
  window.__pdfEditorHistoryPolicyV1 = true;

  window.PdfEditorHistoryPolicy = {
    saveSourceUploads: false,
    saveFinalOutputsOnly: true,
    description: '원본 업로드 파일은 브라우저 메모리에서만 사용하고, Firebase Storage에는 최종 편집 PDF만 저장합니다.'
  };

  function installNotice() {
    if (document.getElementById('pdfHistoryPolicyNotice')) return;
    const historyBtn = document.getElementById('navHistoryBtn');
    const aside = document.querySelector('aside');
    if (!aside) return;
    const notice = document.createElement('div');
    notice.id = 'pdfHistoryPolicyNotice';
    notice.className = 'field';
    notice.style.cssText = 'font-size:10px;line-height:1.45;color:#64748b;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:7px 8px;margin-bottom:8px;';
    notice.textContent = '저장 정책: 원본 업로드 파일은 작업 후 제거되고, 최종 편집 PDF만 저장됩니다.';
    if (historyBtn && historyBtn.parentElement) aside.insertBefore(notice, aside.firstChild);
    else aside.insertBefore(notice, aside.firstChild);
  }

  document.addEventListener('DOMContentLoaded', installNotice);
  setInterval(installNotice, 2000);
})();
