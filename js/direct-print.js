/* direct-print.js — 결과 PDF를 브라우저 인쇄창으로 연결 */
(function () {
  'use strict';

  if (window.__programStudioDirectPrintV1) return;
  window.__programStudioDirectPrintV1 = true;

  const ROUTES = [
    { match: /^\/smart-print-layout(?:\/|$)/, source: '#downloadBtn', label: '프린터 출력', mode: 'pdf' },
    { match: /^\/pdf-editor(?:\/|$)/, source: '#downloadBtn', label: '프린터 출력', mode: 'pdf' },
    { match: /^\/pdf-editor-advanced(?:\/|$)/, source: '#downloadBtn', label: '프린터 출력', mode: 'pdf' },
    { match: /^\/ai-design-maker(?:\/|$)/, source: '#exportBtn', label: '프린터 출력', mode: 'ai-pdf' },
  ];

  const CAPTURE_TIMEOUT_MS = 120000;
  const REVOKE_DELAY_MS = 120000;

  function routeConfig() {
    const path = String(location.pathname || '/').replace(/\/{2,}/g, '/');
    return ROUTES.find(item => item.match.test(path)) || null;
  }

  function addStyle() {
    if (document.getElementById('programStudioDirectPrintStyle')) return;
    const style = document.createElement('style');
    style.id = 'programStudioDirectPrintStyle';
    style.textContent = `
      .program-direct-print-btn{margin-top:6px!important;background:#fff!important;color:#0f766e!important;border:1.5px solid #0f766e!important;box-shadow:none!important}
      .program-direct-print-btn:hover:not(:disabled){background:#ecfdf5!important;color:#065f46!important;opacity:1!important}
      .program-direct-print-btn:disabled{opacity:.45!important;cursor:not-allowed!important}
      #exportBtn + .program-direct-print-btn{width:100%;min-height:34px;border-radius:8px;font:800 11px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .output-section .program-direct-print-btn{width:100%;min-height:42px;border-radius:10px;font-weight:900;cursor:pointer}
    `;
    document.head.appendChild(style);
  }

  function showPreparingWindow() {
    let popup = null;
    try { popup = window.open('', '_blank'); } catch (_) {}
    if (!popup) return null;
    try {
      popup.opener = null;
      popup.document.title = 'Program Studio · 프린터 출력';
      popup.document.body.style.cssText = 'margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;font-family:Pretendard,Arial,sans-serif;color:#334155';
      popup.document.body.innerHTML = '<div style="text-align:center;padding:30px"><strong style="display:block;font-size:18px;margin-bottom:8px">인쇄용 PDF 준비 중</strong><span style="font-size:13px;color:#64748b">PDF가 준비되면 인쇄 화면으로 이동합니다.</span></div>';
    } catch (_) {}
    return popup;
  }

  async function normalizePdfUrl(href) {
    if (!href) throw new Error('인쇄할 PDF 주소를 찾지 못했습니다.');
    if (href.startsWith('blob:')) return { url: href, owned: false };
    const response = await fetch(href, { credentials: 'include' });
    if (!response.ok) throw new Error(`인쇄용 PDF를 다시 읽지 못했습니다. (${response.status})`);
    const blob = await response.blob();
    if (!/pdf/i.test(blob.type || '') && !/\.pdf(?:$|[?#])/i.test(href)) throw new Error('완성 파일이 PDF 형식이 아닙니다.');
    return { url: URL.createObjectURL(blob), owned: true };
  }

  async function openPrintView(popup, href) {
    let normalized;
    try {
      normalized = await normalizePdfUrl(href);
    } catch (error) {
      if (popup) {
        try {
          popup.location.href = href;
          popup.focus();
          return;
        } catch (_) {}
      }
      window.open(href, '_blank');
      throw error;
    }

    const target = popup || window.open('', '_blank');
    if (!target) {
      if (normalized.owned) setTimeout(() => URL.revokeObjectURL(normalized.url), REVOKE_DELAY_MS);
      throw new Error('브라우저가 인쇄창을 차단했습니다. 팝업 허용 후 다시 시도해 주세요.');
    }

    try {
      target.location.href = normalized.url;
      target.focus();
      setTimeout(() => {
        try { target.focus(); target.print(); } catch (_) {}
      }, 1200);
    } finally {
      if (normalized.owned) setTimeout(() => URL.revokeObjectURL(normalized.url), REVOKE_DELAY_MS);
    }
  }

  function looksLikePdfAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return false;
    const href = String(anchor.href || '');
    const download = String(anchor.download || '');
    return href.startsWith('blob:') || /\.pdf(?:$|[?#])/i.test(href) || /\.pdf$/i.test(download) || /pdf/i.test(download);
  }

  function captureNextPdf(sourceButton, popup) {
    return new Promise((resolve, reject) => {
      const nativeAnchorClick = HTMLAnchorElement.prototype.click;
      const nativeRevoke = URL.revokeObjectURL.bind(URL);
      let capturedUrl = '';
      let finished = false;

      const restore = () => {
        HTMLAnchorElement.prototype.click = nativeAnchorClick;
        URL.revokeObjectURL = nativeRevoke;
      };

      const finish = (error, href) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        restore();
        if (error) reject(error); else resolve(href);
      };

      HTMLAnchorElement.prototype.click = function () {
        if (!capturedUrl && looksLikePdfAnchor(this)) {
          capturedUrl = String(this.href || '');
          queueMicrotask(() => finish(null, capturedUrl));
          return undefined;
        }
        return nativeAnchorClick.apply(this, arguments);
      };

      URL.revokeObjectURL = function (url) {
        if (capturedUrl && String(url) === capturedUrl) {
          setTimeout(() => nativeRevoke(url), REVOKE_DELAY_MS);
          return undefined;
        }
        return nativeRevoke(url);
      };

      const timer = setTimeout(() => finish(new Error('인쇄용 PDF 생성 시간이 초과되었습니다.')), CAPTURE_TIMEOUT_MS);

      try {
        sourceButton.click();
      } catch (error) {
        finish(error);
      }
    }).then(href => openPrintView(popup, href));
  }

  function syncDisabled(source, printButton) {
    printButton.disabled = Boolean(source.disabled);
    printButton.setAttribute('aria-disabled', printButton.disabled ? 'true' : 'false');
  }

  function prepareAiPdf(config) {
    if (config.mode !== 'ai-pdf') return () => {};
    const select = document.getElementById('exportFormat');
    if (!select) return () => {};
    const previous = select.value;
    select.value = 'pdf-raster';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return () => {
      select.value = previous;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
  }

  function attach(config) {
    const source = document.querySelector(config.source);
    if (!source || source.dataset.directPrintSource === '1') return Boolean(source);
    source.dataset.directPrintSource = '1';
    addStyle();

    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${source.className || ''} program-direct-print-btn`.trim();
    button.textContent = config.label;
    button.title = '완성 PDF를 만든 뒤 브라우저 인쇄창을 엽니다.';
    source.insertAdjacentElement('afterend', button);
    syncDisabled(source, button);

    const observer = new MutationObserver(() => syncDisabled(source, button));
    observer.observe(source, { attributes: true, attributeFilter: ['disabled'] });

    button.addEventListener('click', async () => {
      if (button.disabled || source.disabled) return;
      const originalText = button.textContent;
      const popup = showPreparingWindow();
      button.disabled = true;
      button.textContent = '인쇄 PDF 준비 중…';
      const restoreAi = prepareAiPdf(config);
      try {
        await captureNextPdf(source, popup);
        button.textContent = '인쇄창 열림';
      } catch (error) {
        console.error('[direct-print]', error);
        try {
          if (popup && !popup.closed) {
            popup.document.body.innerHTML = `<div style="padding:30px;font-family:Pretendard,Arial,sans-serif;color:#991b1b"><strong>인쇄 준비 실패</strong><p style="color:#64748b">${String(error?.message || error || '인쇄용 PDF를 준비하지 못했습니다.')}</p></div>`;
          }
        } catch (_) {}
        button.textContent = '인쇄 실패';
      } finally {
        restoreAi();
        setTimeout(() => {
          button.textContent = originalText;
          syncDisabled(source, button);
        }, 1800);
      }
    });
    return true;
  }

  function init() {
    const config = routeConfig();
    if (!config) return;
    if (attach(config)) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (attach(config) || tries > 80) clearInterval(timer);
    }, 125);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
