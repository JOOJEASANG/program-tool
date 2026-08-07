// Mobile access notice for desktop-optimized PDF and cover editing tools.
(function () {
  'use strict';
  if (window.__desktopToolMobileNoticeV1) return;
  window.__desktopToolMobileNoticeV1 = true;

  const NOTICE_VERSION = '20260807-1';
  const DISMISS_KEY = `program-studio.desktop-tool-mobile-notice.${NOTICE_VERSION}`;
  const NOTICE_ID = 'desktopToolMobileNotice';
  const STYLE_ID = 'desktopToolMobileNoticeStyles';
  const TARGET_PATHS = [
    '/tools/pdf-editor.html',
    '/pdf-editor',
    '/pdf-editor/index.html',
    '/tools/perfect-binding-cover.html',
    '/perfect-binding-cover',
    '/perfect-binding-cover/index.html',
  ];

  let previousOverflow = '';
  let previousFocus = null;

  function normalizedPath(pathname) {
    const path = String(pathname || '/').replace(/\/+$/, '');
    return path || '/';
  }

  function pathMatches(pathname) {
    const current = normalizedPath(pathname);
    return TARGET_PATHS.some((path) => current === normalizedPath(path) || current.endsWith(normalizedPath(path)));
  }

  function toolLabel(pathname) {
    const current = normalizedPath(pathname);
    return current.includes('perfect-binding-cover') ? '책표지 제작기' : 'PDF 편집기';
  }

  function safeMatch(environment, query) {
    try {
      return Boolean(environment?.matchMedia?.(query)?.matches);
    } catch (_) {
      return false;
    }
  }

  function isMobileEnvironment(environment = window) {
    const navigatorObject = environment?.navigator || {};
    if (navigatorObject.userAgentData?.mobile === true) return true;
    const userAgent = String(navigatorObject.userAgent || '');
    if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent)) return true;
    const coarsePointer = safeMatch(environment, '(pointer: coarse)');
    const narrowViewport = safeMatch(environment, '(max-width: 900px)');
    return coarsePointer && narrowViewport;
  }

  function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function storageGet(storage, key) {
    try { return storage?.getItem?.(key) || ''; }
    catch (_) { return ''; }
  }

  function storageSet(storage, key, value) {
    try {
      storage?.setItem?.(key, value);
      return true;
    } catch (_) {
      return false;
    }
  }

  function wasDismissedToday(storage = window.localStorage, date = new Date()) {
    return storageGet(storage, DISMISS_KEY) === todayKey(date);
  }

  function dismissForToday(storage = window.localStorage, date = new Date()) {
    return storageSet(storage, DISMISS_KEY, todayKey(date));
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .desktop-tool-mobile-notice{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.68);font-family:Pretendard,"Noto Sans KR","Malgun Gothic",sans-serif;line-height:1.5;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
      .desktop-tool-mobile-notice-panel{width:min(430px,100%);overflow:hidden;border:1px solid rgba(148,163,184,.45);border-radius:18px;background:#fff;box-shadow:0 28px 80px rgba(15,23,42,.38)}
      .desktop-tool-mobile-notice-head{padding:21px 21px 14px;background:linear-gradient(135deg,#eff6ff,#ecfeff)}
      .desktop-tool-mobile-notice-badge{display:inline-flex;align-items:center;justify-content:center;min-width:42px;height:26px;margin-bottom:11px;border-radius:999px;background:#12396d;color:#fff;font-size:11px;font-weight:950;letter-spacing:.04em}
      .desktop-tool-mobile-notice-title{margin:0;color:#0f172a;font-size:21px;font-weight:950;letter-spacing:-.025em}
      .desktop-tool-mobile-notice-summary{margin:8px 0 0;color:#475569;font-size:13px;font-weight:700;line-height:1.65}
      .desktop-tool-mobile-notice-body{padding:16px 21px 21px}
      .desktop-tool-mobile-notice-list{display:grid;gap:7px;margin:0;padding:0;list-style:none;color:#475569;font-size:12px;line-height:1.55}
      .desktop-tool-mobile-notice-list li{position:relative;padding-left:14px}
      .desktop-tool-mobile-notice-list li::before{content:'';position:absolute;left:0;top:.65em;width:5px;height:5px;border-radius:50%;background:#1d9bb2}
      .desktop-tool-mobile-notice-choice{display:flex;align-items:center;gap:8px;margin-top:16px;color:#64748b;font-size:11px;font-weight:750;cursor:pointer}
      .desktop-tool-mobile-notice-choice input{width:16px;height:16px;accent-color:#12396d}
      .desktop-tool-mobile-notice-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px;margin-top:16px}
      .desktop-tool-mobile-notice-actions a,.desktop-tool-mobile-notice-actions button{display:flex;align-items:center;justify-content:center;min-height:43px;border-radius:10px;padding:10px 12px;font-size:12px;font-weight:900;text-decoration:none;cursor:pointer}
      .desktop-tool-mobile-notice-actions a{border:1px solid #cbd5e1;background:#f8fafc;color:#475569}
      .desktop-tool-mobile-notice-actions button{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}
      .desktop-tool-mobile-notice-actions a:focus-visible,.desktop-tool-mobile-notice-actions button:focus-visible,.desktop-tool-mobile-notice-choice input:focus-visible{outline:3px solid rgba(29,155,178,.3);outline-offset:2px}
      @media(max-width:520px){.desktop-tool-mobile-notice{align-items:end;padding:8px}.desktop-tool-mobile-notice-panel{border-radius:18px 18px 8px 8px}.desktop-tool-mobile-notice-head{padding:19px 18px 13px}.desktop-tool-mobile-notice-body{padding:15px 18px 18px}.desktop-tool-mobile-notice-actions{grid-template-columns:1fr}.desktop-tool-mobile-notice-actions button{grid-row:1}}
      @media(prefers-reduced-motion:no-preference){.desktop-tool-mobile-notice-panel{animation:desktopToolMobileNoticeIn .18s ease-out}@keyframes desktopToolMobileNoticeIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}}
    `;
    document.head.appendChild(style);
  }

  function restorePageState() {
    document.documentElement.style.overflow = previousOverflow;
    try { previousFocus?.focus?.(); } catch (_) {}
    previousFocus = null;
  }

  function close(options = {}) {
    const notice = document.getElementById(NOTICE_ID);
    if (!notice) return false;
    const remember = options.remember === true || Boolean(notice.querySelector('#desktopToolMobileNoticeToday')?.checked);
    if (remember) dismissForToday();
    notice.remove();
    restorePageState();
    document.dispatchEvent(new CustomEvent('desktop-tool-mobile-notice-closed', { detail: { remember } }));
    return true;
  }

  function keepFocusInside(event, notice) {
    if (event.key !== 'Tab') return;
    const focusable = [...notice.querySelectorAll('a[href],button:not([disabled]),input:not([disabled])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function createNotice(pathname = location.pathname) {
    const notice = document.createElement('div');
    notice.id = NOTICE_ID;
    notice.className = 'desktop-tool-mobile-notice';
    notice.setAttribute('role', 'dialog');
    notice.setAttribute('aria-modal', 'true');
    notice.setAttribute('aria-labelledby', 'desktopToolMobileNoticeTitle');
    notice.setAttribute('aria-describedby', 'desktopToolMobileNoticeSummary');
    notice.innerHTML = `
      <section class="desktop-tool-mobile-notice-panel">
        <header class="desktop-tool-mobile-notice-head">
          <span class="desktop-tool-mobile-notice-badge" aria-hidden="true">PC</span>
          <h2 class="desktop-tool-mobile-notice-title" id="desktopToolMobileNoticeTitle">PC에서 이용해 주세요</h2>
          <p class="desktop-tool-mobile-notice-summary" id="desktopToolMobileNoticeSummary"><strong>${toolLabel(pathname)}</strong>는 정밀 편집과 고해상도 출력을 위해 PC 화면과 마우스 조작에 최적화되어 있습니다.</p>
        </header>
        <div class="desktop-tool-mobile-notice-body">
          <ul class="desktop-tool-mobile-notice-list">
            <li>모바일에서는 화면이 좁아 편집 도구를 사용하기 어렵습니다.</li>
            <li>터치 조작 중 요소가 의도하지 않게 이동하거나 크기가 바뀔 수 있습니다.</li>
            <li>안정적인 편집과 PDF 출력을 위해 PC 사용을 권장합니다.</li>
          </ul>
          <label class="desktop-tool-mobile-notice-choice"><input type="checkbox" id="desktopToolMobileNoticeToday">오늘 하루 다시 보지 않기</label>
          <div class="desktop-tool-mobile-notice-actions">
            <a href="/index.html">도구 목록으로</a>
            <button type="button" id="desktopToolMobileNoticeContinue">그래도 계속 보기</button>
          </div>
        </div>
      </section>`;
    notice.querySelector('#desktopToolMobileNoticeContinue')?.addEventListener('click', () => close());
    notice.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      keepFocusInside(event, notice);
    });
    return notice;
  }

  function open() {
    if (!pathMatches(location.pathname)) return false;
    if (!isMobileEnvironment()) return false;
    if (wasDismissedToday()) return false;
    if (!document.body || document.getElementById(NOTICE_ID)) return false;
    installStyles();
    previousFocus = document.activeElement;
    previousOverflow = document.documentElement.style.overflow || '';
    const notice = createNotice(location.pathname);
    document.body.appendChild(notice);
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => notice.querySelector('#desktopToolMobileNoticeContinue')?.focus(), 0);
    document.dispatchEvent(new CustomEvent('desktop-tool-mobile-notice-opened', { detail: { tool: toolLabel(location.pathname) } }));
    return true;
  }

  function install() {
    if (!pathMatches(location.pathname)) return false;
    return open();
  }

  window.DesktopToolMobileNotice = {
    normalizedPath,
    pathMatches,
    toolLabel,
    isMobileEnvironment,
    todayKey,
    wasDismissedToday,
    dismissForToday,
    createNotice,
    open,
    close,
    install,
    key: DISMISS_KEY,
    stage: 'nonblocking-mobile-pc-recommendation',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    setTimeout(install, 0);
  }
})();