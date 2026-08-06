// Keep only administrator-provided image templates in the cover editor surface.
(function () {
  'use strict';
  if (window.__coverTemplateSurfaceCleanupV1) return;
  window.__coverTemplateSurfaceCleanupV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 180, 420, 760, 1200, 1900, 2800];

  function directChildContaining(card, element) {
    let node = element;
    while (node && node.parentElement && node.parentElement !== card) node = node.parentElement;
    return node?.parentElement === card ? node : null;
  }

  function makeHeader() {
    const head = document.createElement('div');
    head.className = 'card-head';
    head.innerHTML = '<span class="step">★</span><div><div class="card-title">제공 이미지 템플릿</div><div class="card-note">관리자가 등록한 앞표지·뒤표지 이미지만 적용합니다.</div></div>';
    return head;
  }

  function normalizeAdminBlock(block) {
    if (!block) return;
    block.style.marginTop = '0';
    block.style.paddingTop = '0';
    block.style.borderTop = '0';
    const label = block.querySelector('label');
    if (label) label.textContent = '관리자 제공 이미지 템플릿';
    const info = block.querySelector('#coverTemplateInfo');
    if (info && !String(info.textContent || '').trim()) {
      info.textContent = '공개된 앞표지·뒤표지 이미지를 현재 작업에 적용합니다.';
    }
  }

  function removePersonalTemplateSurface() {
    const card = document.getElementById('templateCard');
    const select = document.getElementById('coverTemplateSelect');
    if (!card || !select) return false;

    const adminBlock = directChildContaining(card, select);
    if (!adminBlock) return false;
    normalizeAdminBlock(adminBlock);

    if (card.dataset.adminImageOnly !== '1') {
      card.replaceChildren(makeHeader(), adminBlock);
      card.dataset.adminImageOnly = '1';
      card.setAttribute('aria-label', '관리자 제공 이미지 템플릿');
    }

    for (const id of [
      'coverBuiltinPreset', 'applyBuiltinPreset', 'previewBuiltinInfo', 'builtinPresetInfo',
      'userCoverTemplate', 'userCoverTemplateName', 'saveUserCoverTemplate',
      'applyUserCoverTemplate', 'deleteUserCoverTemplate',
    ]) {
      document.getElementById(id)?.remove();
    }
    return true;
  }

  function install() {
    removePersonalTemplateSurface();
  }

  window.CoverTemplateSurfaceCleanup = {
    directChildContaining,
    removePersonalTemplateSurface,
    stage: 'admin-image-template-only',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
