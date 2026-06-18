// PDF editor live preview module.
// Clicks the real preview button after upload/render/layout changes, so it uses the editor's internal state.
(function () {
  if (window.__pdfEditorLivePreviewV2) return;
  window.__pdfEditorLivePreviewV2 = true;

  let timer = null;
  let lastThumbCount = 0;
  let lastSig = '';
  let isAutoClicking = false;

  function $(id) { return document.getElementById(id); }

  function getThumbCount() {
    return document.querySelectorAll('.thumb-item').length;
  }

  function isFastMode() {
    return !!window.__pdfEditorFastMode;
  }

  function getSignature() {
    const activeNup = document.querySelector('.nup-btn.active');
    const activeMode = document.querySelector('.mode-btn.active,.mode-btn.break-active');
    const previewBtn = $('previewBtn');
    return [
      getThumbCount(),
      activeNup ? (activeNup.dataset.nup || activeNup.textContent || '') : '',
      activeMode ? (activeMode.dataset.mode || activeMode.textContent || '') : '',
      $('paperSize') ? $('paperSize').value : '',
      $('marginH') ? $('marginH').value : '',
      $('marginV') ? $('marginV').value : '',
      $('gap') ? $('gap').value : '',
      previewBtn ? String(previewBtn.disabled) : 'no-btn',
      isFastMode() ? 'fast' : 'normal'
    ].join('|');
  }

  function clickPreview() {
    if (isFastMode()) return false;
    const btn = $('previewBtn') || [...document.querySelectorAll('button,.btn')].find((el) => {
      const t = (el.textContent || '').replace(/\s+/g, '');
      return t.includes('미리보기') && (t.includes('생성') || t.includes('갱신'));
    });
    if (!btn || btn.disabled || isAutoClicking) return false;
    isAutoClicking = true;
    try { btn.click(); }
    finally { setTimeout(() => { isAutoClicking = false; }, 500); }
    return true;
  }

  function schedule(reason, delay) {
    if (isFastMode()) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (isFastMode()) return;
      const sig = getSignature();
      lastSig = sig;
      clickPreview();
    }, delay == null ? 350 : delay);
  }

  function installEvents() {
    if (window.__pdfLivePreviewEventsInstalledV2) return;
    window.__pdfLivePreviewEventsInstalledV2 = true;

    document.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest ? event.target.closest('button,.nup-btn,.mode-btn,.orient-btn') : null;
      if (!btn) return;
      const t = (btn.textContent || '').replace(/\s+/g, '');
      if (
        btn.id === 'previewBtn' ||
        btn.id === 'downloadBtn' ||
        btn.closest('#fileHistoryModal') ||
        btn.closest('#dividerModal')
      ) return;
      if (
        btn.classList.contains('nup-btn') ||
        btn.classList.contains('mode-btn') ||
        btn.classList.contains('orient-btn') ||
        t.includes('장') || t.includes('연속') || t.includes('비연속') || t.includes('세로') || t.includes('가로')
      ) {
        schedule('button', isFastMode() ? 1500 : 450);
      }
    }, true);

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('input[type="file"]')) {
        // Upload/render may take several seconds, so also rely on MutationObserver below.
        schedule('file-change', isFastMode() ? 3000 : 1800);
      } else if (target.matches('select,input[type="number"],input[type="checkbox"]')) {
        schedule('option-change', isFastMode() ? 1500 : 450);
      }
    }, true);

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!target) return;
      if (target.matches('#marginH,#marginV,#gap,#customW,#customH')) schedule('layout-input', isFastMode() ? 2000 : 550);
    }, true);
  }

  function installObserver() {
    if (window.__pdfLivePreviewObserverInstalledV2) return;
    window.__pdfLivePreviewObserverInstalledV2 = true;
    const observer = new MutationObserver(() => {
      const count = getThumbCount();
      const sig = getSignature();
      if (count > 0 && (count !== lastThumbCount || sig !== lastSig)) {
        lastThumbCount = count;
        lastSig = sig;
        // Wait a little so pdf.js page rendering and renderThumbs() can finish.
        schedule('thumb-change', isFastMode() ? 2500 : 900);
      }
    });
    const start = () => {
      const area = $('thumbArea') || document.body;
      observer.observe(area, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });
      lastThumbCount = getThumbCount();
      lastSig = getSignature();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  function installStatusHint() {
    if (document.getElementById('livePreviewHint')) return;
    const previewInfo = $('previewInfo');
    if (!previewInfo || !previewInfo.parentElement) return;
    const hint = document.createElement('span');
    hint.id = 'livePreviewHint';
    hint.style.cssText = 'font-size:10px;color:#64748b;font-weight:800;white-space:nowrap;';
    hint.textContent = isFastMode() ? '빠른 편집 모드 ON' : '실시간 미리보기 ON';
    previewInfo.parentElement.appendChild(hint);
  }

  function boot() {
    installEvents();
    installObserver();
    installStatusHint();
    const hint = $('livePreviewHint');
    if (hint) {
      hint.textContent = isFastMode() ? '빠른 편집 모드 ON' : '실시간 미리보기 ON';
      hint.style.color = isFastMode() ? '#b45309' : '#64748b';
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1500);
})();
