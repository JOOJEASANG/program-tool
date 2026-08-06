// Protect completed cover layouts from accidental movement while keeping text and color editing available.
(function () {
  'use strict';
  if (window.__coverLayoutLockV1) return;
  window.__coverLayoutLockV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const STORAGE_KEY = 'programTool.coverEditor.layoutLock.v1';
  const INSTALL_DELAYS = [0, 220, 560, 1000, 1700, 2600];
  const CONTROL_SELECTORS = [
    '#posX', '#posY', '#itemScale',
    '#resetTargetBtn', '#centerTargetBtn', '#resetAllLayoutBtn',
    '.preset-btn[data-preset]',
    '#spinePartX', '#spinePartY', '#spinePartScale',
    '#spinePartCenter', '#spinePartReset',
  ];

  let locked = false;
  let installed = false;
  let applying = false;
  let reapplyFrame = 0;

  const byId = (id) => document.getElementById(id);

  function readStoredLock() {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (_) { return false; }
  }

  function writeStoredLock(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); }
    catch (_) {}
  }

  function status(message, type = 'info') {
    try {
      if (typeof window.setStatus === 'function') {
        window.setStatus(message, type);
        return;
      }
    } catch (_) {}
    const element = byId('status');
    if (!element) return;
    element.textContent = message;
    element.className = `status ${type}`;
  }

  function installStyles() {
    if (byId('coverLayoutLockStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverLayoutLockStyles';
    style.textContent = `
      .cover-layout-lock-toggle{display:inline-flex;align-items:center;gap:4px;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
      .cover-layout-lock-toggle:hover{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-layout-lock-toggle[aria-pressed="true"]{border-color:#f59e0b;background:#fffbeb;color:#92400e}
      .cover-layout-lock-badge{position:absolute;z-index:8;right:8px;top:8px;display:none;align-items:center;gap:5px;border:1px solid rgba(245,158,11,.65);border-radius:999px;padding:4px 7px;background:rgba(255,251,235,.94);color:#92400e;font-size:8px;font-weight:900;line-height:1;pointer-events:none;box-shadow:0 5px 14px rgba(15,23,42,.12)}
      html[data-cover-layout-locked="1"] .cover-layout-lock-badge{display:inline-flex}
      html[data-cover-layout-locked="1"] #previewCanvas{cursor:not-allowed!important;filter:saturate(.96)}
      html[data-cover-layout-locked="1"] #posX,
      html[data-cover-layout-locked="1"] #posY,
      html[data-cover-layout-locked="1"] #itemScale,
      html[data-cover-layout-locked="1"] #spinePartX,
      html[data-cover-layout-locked="1"] #spinePartY,
      html[data-cover-layout-locked="1"] #spinePartScale{opacity:.55}
      @media(max-width:620px){.cover-layout-lock-toggle{width:31px;height:29px;padding:0;justify-content:center}.cover-layout-lock-label{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureToggle() {
    let button = byId('coverLayoutLockToggle');
    if (button) return button;
    const actions = document.querySelector('.preview-actions');
    if (!actions) return null;
    button = document.createElement('button');
    button.id = 'coverLayoutLockToggle';
    button.type = 'button';
    button.className = 'cover-layout-lock-toggle';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', '표지 요소 배치 잠금');
    button.title = '이미지와 글자의 위치·크기 변경을 잠급니다.';
    button.innerHTML = '<span aria-hidden="true">🔓</span><span class="cover-layout-lock-label">배치 잠금</span>';
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener('click', () => setLocked(!locked, true));
    return button;
  }

  function ensureBadge() {
    let badge = byId('coverLayoutLockBadge');
    if (badge) return badge;
    const wrap = document.querySelector('.canvas-wrap');
    if (!wrap) return null;
    badge = document.createElement('span');
    badge.id = 'coverLayoutLockBadge';
    badge.className = 'cover-layout-lock-badge';
    badge.innerHTML = '<span aria-hidden="true">🔒</span><span>배치 잠금됨</span>';
    wrap.appendChild(badge);
    return badge;
  }

  function editableControls() {
    return [...document.querySelectorAll(CONTROL_SELECTORS.join(','))];
  }

  function rememberAndDisable(element) {
    if (!element) return;
    if (!element.hasAttribute('data-cover-layout-lock-was-disabled')) {
      element.setAttribute('data-cover-layout-lock-was-disabled', element.disabled ? '1' : '0');
    }
    element.disabled = true;
    element.setAttribute('aria-disabled', 'true');
  }

  function restoreControl(element) {
    if (!element) return;
    const previous = element.getAttribute('data-cover-layout-lock-was-disabled');
    if (previous !== null) {
      element.disabled = previous === '1';
      element.removeAttribute('data-cover-layout-lock-was-disabled');
    }
    if (!element.disabled) element.removeAttribute('aria-disabled');
  }

  function updateToggle() {
    const button = ensureToggle();
    if (!button) return;
    button.setAttribute('aria-pressed', String(locked));
    button.setAttribute('aria-label', locked ? '표지 요소 배치 잠금 해제' : '표지 요소 배치 잠금');
    button.title = locked
      ? '배치 잠금을 해제해 위치와 크기를 다시 조절합니다.'
      : '이미지와 글자의 위치·크기 변경을 잠급니다.';
    button.innerHTML = locked
      ? '<span aria-hidden="true">🔒</span><span class="cover-layout-lock-label">잠금됨</span>'
      : '<span aria-hidden="true">🔓</span><span class="cover-layout-lock-label">배치 잠금</span>';
  }

  function applyLockState() {
    if (applying) return;
    applying = true;
    try {
      installStyles();
      ensureToggle();
      ensureBadge();
      document.documentElement.dataset.coverLayoutLocked = locked ? '1' : '0';
      const canvas = byId('previewCanvas');
      if (canvas) {
        canvas.style.pointerEvents = locked ? 'none' : '';
        canvas.setAttribute('aria-disabled', String(locked));
        if (!locked) canvas.removeAttribute('aria-disabled');
      }
      for (const element of editableControls()) {
        if (locked) rememberAndDisable(element);
        else restoreControl(element);
      }
      updateToggle();
    } finally {
      applying = false;
    }
  }

  function scheduleReapply() {
    cancelAnimationFrame(reapplyFrame);
    reapplyFrame = requestAnimationFrame(applyLockState);
  }

  function setLocked(next, announce = false) {
    locked = Boolean(next);
    writeStoredLock(locked);
    try {
      if (locked && typeof state !== 'undefined' && state.drag) state.drag = null;
    } catch (_) {}
    applyLockState();
    document.dispatchEvent(new CustomEvent('cover-layout-lock-change', { detail: { locked } }));
    if (announce) {
      status(
        locked
          ? '배치를 잠갔습니다. 글자 내용과 색상은 계속 수정할 수 있습니다.'
          : '배치 잠금을 해제했습니다. 위치와 크기를 다시 조절할 수 있습니다.',
        locked ? 'ok' : 'info',
      );
    }
    return locked;
  }

  function blockArrowMovement(event) {
    if (!locked || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const tag = String(event.target?.tagName || '').toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    status('배치가 잠겨 있습니다. 잠금을 해제한 뒤 이동하세요.', 'info');
  }

  function handlePotentialControlChange(event) {
    if (!locked) return;
    if (event.target?.id === 'editTarget' || event.target?.closest?.('#coverLayerPanel')) {
      setTimeout(scheduleReapply, 0);
    }
  }

  function install() {
    installStyles();
    ensureToggle();
    ensureBadge();
    if (!installed) {
      installed = true;
      locked = readStoredLock();
      document.addEventListener('keydown', blockArrowMovement, true);
      document.addEventListener('change', handlePotentialControlChange, true);
      document.addEventListener('click', handlePotentialControlChange, true);
      document.addEventListener('cover-spine-selected', scheduleReapply);
    }
    applyLockState();
  }

  window.CoverLayoutLock = {
    setLocked,
    applyLockState,
    get locked() { return locked; },
    get controls() { return editableControls(); },
    stage: 'accidental-layout-change-protection',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
