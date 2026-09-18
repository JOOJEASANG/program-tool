(() => {
  'use strict';
  if (window.__programSidebarActionsV1) return;
  window.__programSidebarActionsV1 = true;

  const path = String(location.pathname || '/').replace(/\/+$/, '') || '/';
  const HOME_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></svg>';
  const LOGOUT_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M14 8l4 4-4 4"/><path d="M18 12H8"/></svg>';

  const route = (() => {
    if (path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html')) return 'utility';
    if (path === '/smart-print-layout' || path.endsWith('/smart-print-layout/index.html')) return 'smart-print-layout';
    if (path === '/print-checker' || path.endsWith('/print-checker/index.html')) return 'print-checker';
    if (path === '/ai-design-maker' || path.endsWith('/ai-design-maker/index.html')) return 'ai-design-maker';
    if (path === '/pdf-editor-advanced' || path.endsWith('/pdf-editor-advanced/index.html')) return 'pdf-advanced';
    if (path === '/pdf-editor' || path.endsWith('/pdf-editor/index.html') || path.endsWith('/tools/pdf-editor.html')) return 'pdf-editor';
    return '';
  })();

  if (!route || route === 'utility') return;

  function installStyles() {
    if (document.getElementById('programSidebarActionsStylesV1')) return;
    const style = document.createElement('style');
    style.id = 'programSidebarActionsStylesV1';
    style.textContent = `
      html[data-program-sidebar-actions] .ps-program-sidebar-top{
        position:sticky!important;z-index:90!important;background:#fff!important;
        border-bottom:1px solid #edf1f5!important;box-shadow:0 4px 12px rgba(15,23,42,.04)!important;
      }
      html[data-program-sidebar-actions] .ps-program-actions-grid{
        display:grid!important;grid-template-columns:34px minmax(0,1fr) minmax(0,1fr) 34px!important;
        gap:6px!important;align-items:center!important;width:100%!important;margin:0!important;
      }
      html[data-program-sidebar-actions] .ps-program-sidebar-action{
        display:flex!important;justify-content:center!important;align-items:center!important;min-width:0!important;
        min-height:31px!important;height:31px!important;border:1px solid #dce5ed!important;border-radius:8px!important;
        background:#fff!important;color:#334155!important;text-decoration:none!important;font-size:10px!important;
        font-weight:800!important;line-height:1!important;cursor:pointer!important;padding:0 7px!important;
        white-space:nowrap!important;box-shadow:none!important;opacity:1;
      }
      html[data-program-sidebar-actions] .ps-program-sidebar-action:hover{background:#f8fafc!important;border-color:#cbd5e1!important;color:#1e293b!important}
      html[data-program-sidebar-actions] .ps-program-sidebar-action:disabled{opacity:.45!important;cursor:not-allowed!important}
      html[data-program-sidebar-actions] .ps-program-nav-icon{
        width:34px!important;min-width:34px!important;max-width:34px!important;padding:0!important;font-size:0!important;line-height:0!important;
      }
      html[data-program-sidebar-actions] .ps-program-nav-icon svg{width:15px!important;height:15px!important;display:block!important}
      html[data-program-sidebar-actions] .ps-program-user-name{
        position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;
        overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important;
      }
      html[data-program-sidebar-actions="smart-print-layout"] .ps-program-sidebar-top{top:-14px!important;margin:-14px -16px 8px!important;padding:12px 16px!important}
      html[data-program-sidebar-actions="pdf-advanced"] .ps-program-sidebar-top{top:-14px!important;margin:-14px -14px 8px!important;padding:12px 14px!important}
      html[data-program-sidebar-actions="pdf-advanced"] .ps-program-sidebar-top>.ps-program-actions-grid{grid-template-columns:34px minmax(0,1fr) minmax(0,1fr) 34px!important}
      html[data-program-sidebar-actions="print-checker"] .ps-program-sidebar-top{top:0!important;margin:0 0 8px!important;padding:12px 14px!important}
      html[data-program-sidebar-actions="print-checker"] .sb-nav-title,
      html[data-program-sidebar-actions="print-checker"] .sb-nav-user{display:none!important}
      html[data-program-sidebar-actions="ai-design-maker"] .ps-program-sidebar-top{
        top:-18px!important;margin:-18px -18px 12px!important;padding:12px 18px!important;
      }
      html[data-program-sidebar-actions="pdf-editor"]{--nav-h:0px!important}
      html[data-program-sidebar-actions="pdf-editor"] body{padding-top:0!important}
      html[data-program-sidebar-actions="pdf-editor"] .top-nav{display:none!important}
      html[data-program-sidebar-actions="pdf-editor"] .app{height:100vh!important;min-height:0!important}
      html[data-program-sidebar-actions="pdf-editor"] .app>aside{position:relative!important}
      html[data-program-sidebar-actions="pdf-editor"] .ps-program-sidebar-top{top:-15px!important;margin:-15px -16px 8px!important;padding:12px 16px!important}
      @media(max-width:900px){
        html[data-program-sidebar-actions="smart-print-layout"] .ps-program-sidebar-top,
        html[data-program-sidebar-actions="pdf-advanced"] .ps-program-sidebar-top,
        html[data-program-sidebar-actions="pdf-editor"] .ps-program-sidebar-top{top:0!important}
      }
    `;
    document.head.appendChild(style);
  }

  function actionClass(node, icon = false) {
    if (!node) return null;
    node.classList.add('ps-program-sidebar-action');
    if (icon) node.classList.add('ps-program-nav-icon');
    else node.classList.add('ps-program-session-btn');
    return node;
  }

  function setHome(node) {
    if (!node) return null;
    actionClass(node, true);
    node.innerHTML = HOME_SVG;
    node.setAttribute('title', '홈');
    node.setAttribute('aria-label', '홈');
    if (node.tagName === 'A') node.setAttribute('href', '/index.html');
    return node;
  }

  function setLogout(node) {
    if (!node) return null;
    actionClass(node, true);
    node.innerHTML = LOGOUT_SVG;
    node.setAttribute('title', '로그아웃');
    node.setAttribute('aria-label', '로그아웃');
    return node;
  }

  function setSession(node, text) {
    if (!node) return null;
    actionClass(node, false);
    node.textContent = text;
    node.removeAttribute('title');
    node.setAttribute('aria-label', text);
    return node;
  }

  function makeButton(id, text) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    setSession(button, text);
    return button;
  }

  function makeGrid() {
    const grid = document.createElement('div');
    grid.className = 'ps-program-actions-grid';
    return grid;
  }

  function makeBar() {
    const bar = document.createElement('div');
    bar.className = 'ps-program-sidebar-top';
    return bar;
  }

  function markUserName(node) {
    if (!node) return;
    node.classList.add('ps-program-user-name');
  }

  function mountSmartLayout() {
    const bar = document.querySelector('.sidebar .sidebar-top');
    const grid = bar?.querySelector('.top-actions');
    if (!bar || !grid) return false;
    bar.classList.add('ps-program-sidebar-top');
    grid.classList.add('ps-program-actions-grid');
    setHome(document.getElementById('smartHomeBtn'));
    setSession(document.getElementById('smartSessionSaveBtn'), '편집저장');
    setSession(document.getElementById('smartSessionLoadBtn'), '불러오기');
    setLogout(document.getElementById('logoutBtn'));
    markUserName(document.getElementById('userName'));
    return true;
  }

  function mountAdvanced() {
    const bar = document.querySelector('.advanced-sidebar .sidebar-top');
    const grid = bar?.querySelector('.top-actions');
    if (!bar || !grid) return false;
    bar.classList.add('ps-program-sidebar-top');
    grid.classList.add('ps-program-actions-grid');
    setHome(document.getElementById('advancedHomeBtn'));
    setSession(document.getElementById('advancedSessionSaveBtn'), '편집저장');
    setSession(document.getElementById('advancedSessionLoadBtn'), '불러오기');
    setLogout(document.getElementById('logoutBtn'));
    return true;
  }

  function mountPdfEditor() {
    const aside = document.querySelector('.app > aside');
    const topNav = document.querySelector('.top-nav');
    const home = document.querySelector('.top-nav .nav-back');
    const save = document.getElementById('navSessionBtn');
    const load = document.getElementById('navSessionLoadBtn');
    const logout = document.getElementById('navLogout');
    const userName = document.getElementById('navUserName');
    if (!aside || !home || !save || !load || !logout) return false;

    let bar = aside.querySelector(':scope > .ps-program-sidebar-top');
    if (!bar) {
      bar = makeBar();
      const grid = makeGrid();
      bar.appendChild(grid);
      aside.insertBefore(bar, aside.firstChild);
    }
    const grid = bar.querySelector('.ps-program-actions-grid');
    setHome(home);
    setSession(save, '편집저장');
    setSession(load, '불러오기');
    setLogout(logout);
    markUserName(userName);
    grid.replaceChildren(home, save, load, logout);
    if (userName) bar.appendChild(userName);
    if (topNav) topNav.hidden = true;
    return true;
  }

  function mountPrintChecker() {
    const sidebar = document.querySelector('.print-checker-page .sidebar');
    let bar = sidebar?.querySelector(':scope > .sb-nav');
    const home = document.querySelector('.sb-nav-back');
    const logout = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');
    if (!sidebar || !bar || !home || !logout) return false;

    bar.classList.add('ps-program-sidebar-top');
    let grid = bar.querySelector('.ps-program-actions-grid');
    if (!grid) grid = makeGrid();
    const save = document.getElementById('printCheckerSessionSaveBtn') || makeButton('printCheckerSessionSaveBtn', '편집저장');
    const load = document.getElementById('printCheckerSessionLoadBtn') || makeButton('printCheckerSessionLoadBtn', '불러오기');
    setHome(home);
    setSession(save, '편집저장');
    setSession(load, '불러오기');
    setLogout(logout);
    markUserName(userName);
    grid.replaceChildren(home, save, load, logout);
    bar.replaceChildren(grid);
    if (userName) bar.appendChild(userName);
    document.querySelector('.sb-nav-title')?.remove();
    document.querySelector('.sb-nav-user')?.remove();
    return true;
  }

  function mountAiDesignMaker() {
    const sidebar = document.querySelector('.control-panel');
    const home = document.querySelector('.maker-header .home-link');
    const logout = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');
    if (!sidebar || !home || !logout) return false;

    let bar = sidebar.querySelector(':scope > .ps-program-sidebar-top');
    if (!bar) {
      bar = makeBar();
      sidebar.insertBefore(bar, sidebar.firstChild);
    }
    let grid = bar.querySelector('.ps-program-actions-grid');
    if (!grid) {
      grid = makeGrid();
      bar.appendChild(grid);
    }
    const save = document.getElementById('aiDesignSessionSaveBtn') || makeButton('aiDesignSessionSaveBtn', '편집저장');
    const load = document.getElementById('aiDesignSessionLoadBtn') || makeButton('aiDesignSessionLoadBtn', '불러오기');
    setHome(home);
    setSession(save, '편집저장');
    setSession(load, '불러오기');
    setLogout(logout);
    markUserName(userName);
    grid.replaceChildren(home, save, load, logout);
    if (userName) bar.appendChild(userName);
    return true;
  }

  function loadScript(id, src) {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }

  function mount() {
    installStyles();
    document.documentElement.dataset.programSidebarActions = route;
    let mounted = false;
    if (route === 'smart-print-layout') mounted = mountSmartLayout();
    else if (route === 'pdf-advanced') mounted = mountAdvanced();
    else if (route === 'pdf-editor') mounted = mountPdfEditor();
    else if (route === 'print-checker') mounted = mountPrintChecker();
    else if (route === 'ai-design-maker') mounted = mountAiDesignMaker();

    if (!mounted) {
      console.warn('[program-sidebar-actions] expected action host was not found', route);
      return;
    }
    document.documentElement.dataset.programSidebarActionsReady = '1';
    if (route === 'print-checker') {
      loadScript('printCheckerSessionPersistenceScriptV1', '/js/print-checker/session-persistence.js?v=20260916-1');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();

  window.ProgramSidebarActions = Object.freeze({ route, stage: 'unified-sidebar-actions-v1' });
})();