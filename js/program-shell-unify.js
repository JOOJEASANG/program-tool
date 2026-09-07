(function(){
  'use strict';
  if(window.__programShellUnifyV2)return;
  window.__programShellUnifyV2=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isPdfEditor=path==='/pdf-editor'||path==='/pdf-editor/index.html'||path.endsWith('/pdf-editor/index.html');
  const isPdfUtility=path==='/pdf-preflight'||path==='/pdf-preflight/index.html'||path.endsWith('/pdf-preflight/index.html');
  if(!isPdfEditor&&!isPdfUtility)return;

  const STYLE_ID='programShellUnifyStyles';
  const PDF_UI_RUNTIME_VERSION='20260831-1';
  if(isPdfEditor){
    // The PDF editor intentionally uses one always-visible sidebar.
    window.__programStudioEditorToolRailV1=true;
    window.__pdfEditorWorkflowV2=true;
  }

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      body[data-program-shell="compact"]{padding-top:0!important}
      body[data-program-shell="compact"]>.top-nav{display:none!important}
      .program-local-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .program-local-actions a,.program-local-actions button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:30px;border:1px solid #d7e0e9!important;border-radius:8px!important;background:#fff!important;color:#475569!important;padding:6px 9px!important;font-family:inherit!important;font-size:10px!important;font-weight:850!important;line-height:1.2!important;text-decoration:none!important;box-shadow:none!important;cursor:pointer}
      .program-local-actions a:hover,.program-local-actions button:hover{border-color:#9fb2c6!important;background:#f8fafc!important;color:#12396d!important;opacity:1!important}
      .program-local-actions .program-account-name{max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#7c8797;font-size:10px;font-weight:750;margin-left:auto}
      .program-local-actions .program-logout{margin-left:0!important}

      /* PDF 배치: 우측 미리보기 도구는 잘리지 않도록 고정 폭을 충분히 확보한다. */
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .app{height:100vh!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] aside{padding-top:12px!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .program-local-actions{margin:0 0 10px;flex-wrap:nowrap}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .program-local-actions .nav-user-name{display:none!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .preview-info{min-width:0!important;overflow:visible!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] #previewInfo{flex:1 1 auto!important;min-width:0!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .preview-zoom{min-width:max-content!important;max-width:none!important;flex:0 0 auto!important;overflow:visible!important;padding-right:2px!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] #perRowSelect{box-sizing:border-box!important;width:112px!important;min-width:112px!important;max-width:112px!important;flex:0 0 112px!important;height:30px!important;padding:4px 30px 4px 9px!important;line-height:20px!important;overflow:visible!important;text-overflow:clip!important;white-space:nowrap!important}
      body[data-program-shell="compact"][data-program-kind="pdf-editor"] .preview-zoom>*{flex-shrink:0!important}

      /* PDF 유틸리티: 장식용 대형 헤더를 제거하고 바로 작업 영역이 보이게 한다. */
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .container{max-width:1240px!important;padding:12px 18px 54px!important}
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .hero{display:none!important}
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .program-local-actions{margin:0 0 10px;flex-wrap:nowrap}
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .program-local-actions .nav-user-name{margin-left:auto}
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .workspace{gap:14px!important}
      body[data-program-shell="compact"][data-program-kind="pdf-utility"] .panel{border-radius:16px!important;padding:18px!important;box-shadow:0 5px 18px rgba(15,23,42,.055)!important}

      @media(max-width:900px){body[data-program-shell="compact"][data-program-kind="pdf-editor"] .app{height:auto!important;min-height:100vh!important}body[data-program-shell="compact"][data-program-kind="pdf-editor"] main{min-height:100vh!important}body[data-program-shell="compact"][data-program-kind="pdf-editor"] .preview-info{flex-wrap:wrap!important}body[data-program-shell="compact"][data-program-kind="pdf-editor"] .preview-zoom{width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:visible!important;padding-bottom:2px!important}.program-local-actions a,.program-local-actions button{font-size:10px!important;padding:6px 8px!important}}
      @media(max-width:520px){body[data-program-shell="compact"][data-program-kind="pdf-utility"] .container{padding:10px 10px 42px!important}.program-local-actions .program-account-name{display:none!important}body[data-program-shell="compact"][data-program-kind="pdf-utility"] .program-local-actions{flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function loadPdfUiRuntime(){
    if(!isPdfEditor)return false;
    if(window.PdfEditorUiRuntime?.sync){window.PdfEditorUiRuntime.sync();return true;}
    if(document.getElementById('pdfEditorUiRuntimeScriptV1'))return true;
    const script=document.createElement('script');
    script.id='pdfEditorUiRuntimeScriptV1';
    script.src=`/js/pdf-editor/ui-runtime.js?v=${PDF_UI_RUNTIME_VERSION}`;
    script.async=false;
    document.head.appendChild(script);
    return true;
  }

  function loadPdfWorkflow(){if(!isPdfEditor)return false;if(window.PdfEditorWorkflowUi?.sync){window.PdfEditorWorkflowUi.sync();return true;}return loadPdfUiRuntime();}
  function loadPdfWorkspace(){if(!isPdfEditor)return false;if(window.PdfEditorWorkspaceLayout?.sync){window.PdfEditorWorkspaceLayout.sync();return true;}return loadPdfUiRuntime();}

  function makeActions(kind){
    const oldNav=document.querySelector('body > .top-nav');
    if(!oldNav)return null;
    const bar=document.createElement('div');
    bar.className='program-local-actions';
    bar.setAttribute('aria-label','프로그램 이동 및 계정');
    const back=oldNav.querySelector('.nav-back');
    if(back){back.textContent='← 홈';bar.appendChild(back);}
    if(kind==='pdf-editor'){
      const save=document.getElementById('navSessionBtn'),load=document.getElementById('navSessionLoadBtn'),user=document.getElementById('navUserName'),logout=document.getElementById('navLogout');
      if(save)bar.appendChild(save);if(load)bar.appendChild(load);if(user){user.classList.add('program-account-name');bar.appendChild(user);}if(logout){logout.classList.add('program-logout');bar.appendChild(logout);}
      const aside=document.querySelector('.app > aside');if(aside)aside.insertBefore(bar,aside.firstChild);
    }else{
      const user=document.getElementById('userName'),logout=oldNav.querySelector('.nav-logout');
      if(user){user.classList.add('program-account-name');bar.appendChild(user);}if(logout){logout.classList.add('program-logout');bar.appendChild(logout);}
      const container=document.querySelector('main.container');if(container)container.insertBefore(bar,container.firstChild);
    }
    oldNav.remove();return bar;
  }

  function loadPdfEnhancements(){return isPdfEditor?loadPdfUiRuntime():false;}
  function apply(){
    if(document.body?.dataset.programShell==='compact'){loadPdfEnhancements();return true;}
    const kind=isPdfEditor?'pdf-editor':'pdf-utility',oldNav=document.querySelector('body > .top-nav');
    if(!document.body||!oldNav)return false;
    installStyles();document.body.dataset.programShell='compact';document.body.dataset.programKind=kind;makeActions(kind);loadPdfEnhancements();document.documentElement.dataset.programShellUnified='2';return true;
  }
  function boot(){if(apply())return;[40,120,300,700].forEach(delay=>setTimeout(()=>{apply();loadPdfEnhancements();},delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.ProgramShellUnify={apply,loadPdfUiRuntime,loadPdfWorkflow,loadPdfWorkspace,stage:'pdf-tools-headerless-unified-shell',workflowStage:'pdf-all-controls-visible-v1',workspaceStage:'pdf-single-sidebar-v2',uiRuntimeStage:'pdf-editor-always-visible-sidebar-runtime-v2'};
})();