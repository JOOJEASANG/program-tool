// Keep cover template administration in the administrator service console.
(function () {
  'use strict';
  if (window.__coverTemplateAdminSeparationV1) return;
  window.__coverTemplateAdminSeparationV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [1200, 1800, 2400, 3100];
  let installed = false;

  function install() {
    const area = document.getElementById('adminTemplateArea');
    const info = document.getElementById('coverTemplateInfo');
    const card = document.getElementById('templateCard');
    if (!area || !card) return false;

    area.hidden = true;
    area.style.display = 'none';
    area.setAttribute('aria-hidden', 'true');
    area.querySelectorAll('input,select,button').forEach((control) => {
      control.disabled = true;
      control.dataset.adminConsoleOnly = '1';
    });

    if (!document.getElementById('coverTemplateAdminConsoleNote')) {
      const note = document.createElement('div');
      note.id = 'coverTemplateAdminConsoleNote';
      note.className = 'card-note';
      note.style.marginTop = '7px';
      note.textContent = '제공 이미지 등록·수정·삭제는 관리자 페이지의 “서비스 관리 → 책표지 제작”에서 관리합니다.';
      const refresh = document.getElementById('refreshCoverTemplates');
      (refresh?.parentElement || info || card).insertAdjacentElement('afterend', note);
    }

    installed = true;
    document.documentElement.dataset.coverTemplateAdminSeparated = '1';
    return true;
  }

  window.CoverTemplateAdminSeparation = {
    install,
    get installed() { return installed; },
    stage: 'admin-service-console-only-template-management',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();