// PDF editor live preview module.
// Uses the editor's real preview action after upload and layout changes.
(function () {
  'use strict';
  if (window.__pdfEditorLivePreviewV3) return;
  window.__pdfEditorLivePreviewV3 = true;

  let timer = null;
  let lastThumbCount = 0;
  let lastSig = '';
  let isAutoClicking = false;

  function $(id) { return document.getElementById(id); }
  function getThumbCount() { return document.querySelectorAll('.thumb-item').length; }
  function isFastMode() { return !!window.__pdfEditorFastMode; }
  function value(id) { return $(id) ? $(id).value : ''; }

  function getSignature() {
    const activeNup = document.querySelector('.nup-btn.active');
    const activeMode = document.querySelector('.mode-btn.active,.mode-btn.break-active');
    const previewBtn = $('previewBtn');
    return [
      getThumbCount(),
      activeNup ? (activeNup.dataset.nup || activeNup.textContent || '') : '',
      activeMode ? (activeMode.dataset.mode || activeMode.textContent || '') : '',
      value('paperSize'),
      value('marginLeft') || value('marginH'),
      value('marginRight') || value('marginH'),
      value('marginTop') || value('marginV'),
      value('marginBottom') || value('marginV'),
      value('gap'),
      $('facingPages') ? String($('facingPages').checked) : 'false',
      previewBtn ? String(previewBtn.disabled) : 'no-btn',
      isFastMode() ? 'fast' : 'normal',
    ].join('|');
  }

  function clickPreview() {
    if (isFastMode()) return false;
    const btn = $('previewBtn') || [...document.querySelectorAll('button,.btn')].find((element) => {
      const text = (element.textContent || '').replace(/\s+/g, '');
      return text.includes('미리보기') && (text.includes('생성') || text.includes('갱신'));
    });
    if (!btn || btn.disabled || isAutoClicking) return false;
    isAutoClicking = true;
    try { btn.click(); }
    finally { setTimeout(() => { isAutoClicking = false; }, 500); }
    return true;
  }

  function schedule(delay) {
    if (isFastMode()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (isFastMode()) return;
      lastSig = getSignature();
      clickPreview();
    }, delay == null ? 350 : delay);
  }

  function installEvents() {
    if (window.__pdfLivePreviewEventsInstalledV3) return;
    window.__pdfLivePreviewEventsInstalledV3 = true;

    document.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button,.nup-btn,.mode-btn,.orient-btn') : null;
      if (!btn) return;
      const text = (btn.textContent || '').replace(/\s+/g, '');
      if (
        btn.id === 'previewBtn' ||
        btn.id === 'downloadBtn' ||
        btn.closest('#dividerModal')
      ) return;
      if (
        btn.classList.contains('nup-btn') ||
        btn.classList.contains('mode-btn') ||
        btn.classList.contains('orient-btn') ||
        text.includes('장') || text.includes('연속') || text.includes('비연속') ||
        text.includes('세로') || text.includes('가로')
      ) schedule(isFastMode() ? 1500 : 450);
    }, true);

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="file"]')) schedule(isFastMode() ? 3000 : 1800);
      else if (target.matches('select,input[type="number"],input[type="checkbox"]')) schedule(isFastMode() ? 1500 : 450);
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (target && target.matches('#marginH,#marginV,#marginLeft,#marginRight,#marginTop,#marginBottom,#gap,#customW,#customH')) {
        schedule(isFastMode() ? 2000 : 550);
      }
    }, true);
  }

  function installObserver() {
    if (window.__pdfLivePreviewObserverInstalledV3) return;
    window.__pdfLivePreviewObserverInstalledV3 = true;
    const area = $('thumbArea');
    if (!area) return;
    const observer = new MutationObserver(() => {
      const count = getThumbCount();
      const sig = getSignature();
      if (count > 0 && (count !== lastThumbCount || sig !== lastSig)) {
        lastThumbCount = count;
        lastSig = sig;
        schedule(isFastMode() ? 2500 : 900);
      }
    });
    observer.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
    lastThumbCount = getThumbCount();
    lastSig = getSignature();
  }

  function installStatusHint() {
    let hint = $('livePreviewHint');
    const previewInfo = $('previewInfo');
    if (!previewInfo || !previewInfo.parentElement) return false;
    if (!hint) {
      hint = document.createElement('span');
      hint.id = 'livePreviewHint';
      previewInfo.insertAdjacentElement('afterend', hint);
    }
    hint.style.cssText = 'font-size:10px;color:#64748b;font-weight:800;white-space:nowrap;';
    hint.textContent = isFastMode() ? '대용량 문서 · 수동 미리보기' : '실시간 미리보기 ON';
    return true;
  }

  function boot(attempt) {
    installEvents();
    installObserver();
    const ready = installStatusHint();
    if (!ready && attempt < 10) setTimeout(() => boot(attempt + 1), 180 + attempt * 70);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  else boot(0);
})();
