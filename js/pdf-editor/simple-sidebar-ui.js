// PDF editor: progressive print settings on the left and page management on the right.
(function(){
  'use strict';
  if(window.__pdfEditorSimpleSidebarUiV1)return;
  window.__pdfEditorSimpleSidebarUiV1=true;
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/pdf-editor'&&path!=='/pdf-editor/index.html'&&!path.endsWith('/pdf-editor/index.html'))return;

  window.__programStudioEditorToolRailV1=true;
  window.__pdfEditorWorkflowV2=true;
  let frame=0,observer=null;
  // Only the document-print workflow is visible on first load. Preserve each
  // user's expanded sections throughout dynamic thumbnail and settings updates.
  const defaultSections=new Set(['upload','paper','nup','output']);
  const openSections=new Set(defaultSections);
  const sectionKey=section=>{
    const head=section?.querySelector(':scope>.sec-head');
    return head?.dataset?.sec || (section?.querySelector('#downloadBtn')?'output':null);
  };

  function installStyles(){
    if(document.getElementById('pdfSimpleSidebarUiStyles'))return;
    const style=document.createElement('style');
    style.id='pdfSimpleSidebarUiStyles';
    style.textContent=`
      body[data-program-kind="pdf-editor"] .app{grid-template-columns:360px minmax(0,1fr)!important;background:#eef2f5!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type{width:auto!important;min-width:0!important;padding:12px!important;background:#f8fafc!important;border-right:1px solid #dbe4ec!important;overflow-y:auto!important;scrollbar-gutter:stable}
      body[data-program-kind="pdf-editor"] .app>main{grid-column:2!important;padding:12px!important;background:#e9eef2!important}
      body[data-program-kind="pdf-editor"] .program-local-actions{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:nowrap!important;overflow:hidden!important;width:100%!important;margin:0 0 10px!important;white-space:nowrap!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>a,body[data-program-kind="pdf-editor"] .program-local-actions>button{min-width:0!important;min-height:30px!important;padding:5px 7px!important;font-size:9px!important;line-height:1!important;flex:0 1 auto!important;white-space:nowrap!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>.nav-back{flex:0 0 auto!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionBtn,body[data-program-kind="pdf-editor"] .program-local-actions>#navSessionLoadBtn{flex:1 1 auto!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>.program-account-name{display:none!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout{flex:0 0 32px!important;width:32px!important;height:30px!important;padding:0!important;font-size:0!important;gap:0!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout svg{width:15px!important;height:15px!important;margin:0!important}
      body[data-program-kind="pdf-editor"] .sec{display:block!important;position:relative!important;bottom:auto!important;margin:0 0 8px!important;padding:0!important;border:1px solid #dde5ed!important;border-radius:11px!important;background:#fff!important;overflow:hidden!important;box-shadow:0 1px 2px rgba(15,23,42,.025)!important}
      body[data-program-kind="pdf-editor"] .sec-head{cursor:default!important;padding:10px 11px!important;background:#f9fbfd!important;border-bottom:1px solid #eef2f6!important}
      body[data-program-kind="pdf-editor"] .sec-head .sec-title{font-size:10.5px!important;color:#35475b!important;letter-spacing:0!important;text-transform:none!important}
      body[data-program-kind="pdf-editor"] .sec-head .sec-arrow{display:none!important}
      body[data-program-kind="pdf-editor"] .sec-body,body[data-program-kind="pdf-editor"] .sec-body.hidden{display:block!important;padding:10px 11px 11px!important}
      body[data-program-kind="pdf-editor"] #thumbSection[style*="display:none"]{display:none!important}
      body[data-program-kind="pdf-editor"] #thumbSection>.sec-head{cursor:pointer!important}
      body[data-program-kind="pdf-editor"] #thumbSection>.sec-head .sec-arrow{display:inline-block!important;margin-left:auto!important;transition:transform .2s ease!important}
      body[data-program-kind="pdf-editor"] #thumbSection>.sec-head.collapsed .sec-arrow{transform:rotate(-90deg)!important}
      body[data-program-kind="pdf-editor"] #thumbSection>#sb-pages.hidden{display:none!important}
      body[data-program-kind="pdf-editor"] .ps-tool-sidebar-shell{display:block!important;height:auto!important;min-height:0!important;background:transparent!important}
      body[data-program-kind="pdf-editor"] .ps-tool-sidebar-shell>.ps-tool-panel{display:block!important;min-height:0!important;overflow:visible!important;padding:0!important;background:transparent!important}
      body[data-program-kind="pdf-editor"] .ps-sidebar-toggle,body[data-program-kind="pdf-editor"] .ps-tool-rail,body[data-program-kind="pdf-editor"] .ps-tool-panel-head,body[data-program-kind="pdf-editor"] .ps-tool-rail-title,body[data-program-kind="pdf-editor"] [data-ps-tool-title],body[data-program-kind="pdf-editor"] #pdfWorkflowHead,body[data-program-kind="pdf-editor"] #pdfResultBar,body[data-program-kind="pdf-editor"] #pdfOutputRail,body[data-program-kind="pdf-editor"] #pdfEditorWorkflowV2,body[data-program-kind="pdf-editor"] #pdfEditorWorkflowErrorV2,body[data-program-kind="pdf-editor"] #pdfOutputSummaryV2{display:none!important}
      /* 2026-10-21: One consistent control rhythm across the PDF layout sidebar. */
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type{background:#f5f7fa!important;padding:12px!important}
      body[data-program-kind="pdf-editor"] .app>main{background:#e9edf3!important}
      body[data-program-kind="pdf-editor"] .sec{margin-bottom:10px!important;border-color:#dde5ed!important;border-radius:12px!important;box-shadow:0 2px 7px rgba(15,23,42,.035)!important}
      body[data-program-kind="pdf-editor"] .sec-head{padding:11px 12px!important;background:#f8fafc!important}
      body[data-program-kind="pdf-editor"] .sec-head .sec-title{font-size:11px!important;font-weight:850!important;color:#26384d!important}
      body[data-program-kind="pdf-editor"] .sec-body{padding:11px 12px 12px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .field label{font-size:10.5px!important;color:#475569!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type button{font-family:inherit!important;transition:background-color .12s ease,border-color .12s ease,box-shadow .12s ease!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(.mode-btn,.orient-btn,.pn-pos-btn,.style-btn,.pdf-file-nav-toggle,.pdf-file-select-btn,.pdf-file-delete-btn,.pdf-file-boundary,.pdf-file-order-handle,.page-selection-btn,.hf-add-section-btn,#pageSelectionModeBtnV3,#pdfEditedPageJumpButton,#pdfOriginalPageJumpButton,#pdfCollapseAllFiles,#pdfExpandAllFiles){box-sizing:border-box!important;height:32px!important;min-height:32px!important;max-height:32px!important;padding:0 9px!important;border-radius:8px!important;line-height:1.1!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:10px!important;white-space:nowrap!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(#previewBtn,#downloadBtn,#resetBtn){box-sizing:border-box!important;min-height:32px!important;height:32px!important;max-height:32px!important;padding:0 10px!important;border-radius:8px!important;font-size:10px!important;font-weight:800!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(.nup-btn,.page-productivity-top button){box-sizing:border-box!important;min-height:32px!important;border-radius:8px!important}
      /* Match the 32px file-upload mode controls across every sidebar action row. */
      body[data-program-kind="pdf-editor"] #pageProductivityPanelV3 .page-productivity-top{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;gap:6px!important}
      body[data-program-kind="pdf-editor"] #pageProductivityPanelV3 .page-productivity-top>button,
      body[data-program-kind="pdf-editor"] #pageSelectionToolbar :is(.page-selection-heading,.page-selection-quick,.page-selection-actions)>button{box-sizing:border-box!important;height:32px!important;min-height:32px!important;max-height:32px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;padding:0 12px!important;line-height:1.15!important;border-radius:8px!important;font-size:10.5px!important}
      body[data-program-kind="pdf-editor"] #pageProductivityPanelV3 #pageSelectionModeBtnV3{min-width:76px!important}
      body[data-program-kind="pdf-editor"] #pageProductivityPanelV3 .page-productivity-top>button:not(#pageSelectionModeBtnV3){min-width:50px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]),select){box-sizing:border-box!important;min-height:34px!important;border-radius:8px!important;border-color:#d6e0e9!important;background-color:#fff!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(button,input,select):focus-visible{outline:2px solid #2563eb!important;outline-offset:2px!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-file-sep[data-file-nav-header="true"]{gap:5px!important;padding:9px 8px!important;border-radius:9px!important;border-color:#dde5ed!important;background:#f9fbfd!important}
      body[data-program-kind="pdf-editor"] #thumbArea .thumb-file-sep-label{max-width:145px!important;font-size:10.5px!important}
      body[data-program-kind="pdf-editor"] #thumbArea .pdf-file-nav-meta{font-size:9px!important;color:#64748b!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #uploadZone{border-radius:10px!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>a,body[data-program-kind="pdf-editor"] .program-local-actions>button{box-sizing:border-box!important;height:32px!important;min-height:32px!important;max-height:32px!important;border-radius:8px!important;padding:0 9px!important;font-size:10px!important}
      body[data-program-kind="pdf-editor"] .program-local-actions>#navLogout{height:32px!important;min-height:32px!important;max-height:32px!important}
      body[data-program-kind="pdf-editor"] .preview-info{padding:4px 8px!important;gap:5px!important;border-radius:8px!important}
      body[data-program-kind="pdf-editor"] .preview-shell{border:1px solid #dbe4ed!important;border-radius:12px!important;background:#f1f4f8!important}
      body[data-program-kind="pdf-editor"] #previewScroll{background:#e8edf3!important;border-radius:9px!important}
      body[data-program-kind="pdf-editor"] #previewScroll .preview-row{width:100%;min-width:max-content;justify-content:center;flex-wrap:nowrap;box-sizing:border-box}
      body[data-program-kind="pdf-editor"] #previewScroll .page-preview{border-radius:5px!important;box-shadow:0 3px 14px rgba(15,23,42,.14)!important}
      /* Primary print workflow: upload -> paper -> N-up -> optional text -> save. */
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-closed>.sec-body,
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-closed>.sec-body.hidden{display:none!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-toggle>.sec-head{cursor:pointer!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-toggle>.sec-head .sec-arrow{display:inline-block!important;margin-left:auto!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-closed>.sec-head .sec-arrow{transform:rotate(-90deg)!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec.pdf-ui-toggle>.sec-head:focus-visible{outline:2px solid #2563eb;outline-offset:-2px}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure{margin:8px 0;border:1px solid #dbe5ee;border-radius:9px;background:#f8fafc;overflow:hidden}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure>summary{padding:10px 11px;cursor:pointer;list-style:none;font-size:11px;font-weight:800;color:#334155}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure>summary::-webkit-details-marker{display:none}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure>summary::after{content:'⌄';float:right;color:#64748b}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure[open]>summary::after{content:'⌃'}
      body[data-program-kind="pdf-editor"] #pdfActualSizeDisclosure>#actualSizePanel{margin:0 7px 8px!important}
      /* Compact fixed output dock: one primary save + three aligned actions.
         Keep native button IDs, listeners, preflight modal and save state intact. */
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn){
        position:sticky!important;bottom:-12px!important;z-index:30!important;border-color:#cad8e7!important;
        border-radius:10px 10px 0 0!important;background:#fff!important;
        box-shadow:0 -3px 14px rgba(15,23,42,.09)!important;margin-bottom:0!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn)>.sec-head{display:none!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn)>.sec-body{
        display:grid!important;grid-template-columns:minmax(0,1.04fr) minmax(0,1.20fr) minmax(0,.87fr)!important;
        gap:5px!important;padding:7px 8px!important;align-items:stretch!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn)>.sec-body>div[style*="height:6px"]{display:none!important}
      /* The check module inserts its button in a wrapper. Flatten only this
         presentation wrapper so every action shares the same two-row grid. */
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn) .pefc-wrap{
        display:contents!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn) :is(.pefc-hint,.pefc-direct-note){
        display:none!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn) :is(#downloadBtn,#previewBtn,#pdfEditorFinalCheckBtn,#resetBtn){
        box-sizing:border-box!important;margin:0!important;width:100%!important;min-width:0!important;
        padding:0 5px!important;border-radius:7px!important;line-height:1.2!important;
        font-family:inherit!important;font-weight:850!important;white-space:nowrap!important;
        box-shadow:none!important;transform:none!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #downloadBtn{
        grid-column:1/-1!important;grid-row:1!important;height:37px!important;min-height:37px!important;max-height:37px!important;
        background:#147c72!important;border:1px solid #147c72!important;color:#fff!important;font-size:12px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #previewBtn{
        grid-column:1!important;grid-row:2!important;height:32px!important;background:#3168c8!important;
        border:1px solid #3168c8!important;color:#fff!important;font-size:10px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #pdfEditorFinalCheckBtn{
        grid-column:2!important;grid-row:2!important;height:32px!important;min-height:32px!important;
        background:#0e8379!important;border:1px solid #0e8379!important;color:#fff!important;font-size:9.7px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #resetBtn{
        grid-column:3!important;grid-row:2!important;height:32px!important;background:#edf2f7!important;
        border:1px solid #d8e1eb!important;color:#34506c!important;font-size:9.8px!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn) :is(#downloadBtn,#previewBtn,#pdfEditorFinalCheckBtn):disabled{
        opacity:1!important;background:#91a6be!important;border-color:#91a6be!important;color:#fff!important;
        cursor:not-allowed!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type .sec:has(#downloadBtn) :is(#downloadBtn,#previewBtn,#pdfEditorFinalCheckBtn):not(:disabled):hover{
        filter:brightness(1.07)!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type #resetBtn:hover{background:#e2e9f2!important}
      body[data-program-kind="pdf-editor"] .app>aside:first-of-type :is(.sec-body,summary):focus-visible{outline:2px solid #2563eb;outline-offset:1px}
      @media(max-width:760px){body[data-program-kind="pdf-editor"] .app>aside:first-of-type{padding:10px!important}body[data-program-kind="pdf-editor"] #previewScroll .preview-row{min-width:max-content}}
      @media(max-width:980px){body[data-program-kind="pdf-editor"]{overflow:auto!important}body[data-program-kind="pdf-editor"] .app{grid-template-columns:1fr!important;height:auto!important;min-height:100vh!important}body[data-program-kind="pdf-editor"] .app>aside:first-of-type,body[data-program-kind="pdf-editor"] .app>main{grid-column:1!important;width:100%!important;height:auto!important;position:relative!important;overflow:visible!important}}
    `;
    document.head.appendChild(style);
  }

  function neutralizeToolRail(){
    const sidebar=document.querySelector('.app>aside:first-of-type');
    const shell=sidebar?.querySelector(':scope>.ps-tool-sidebar-shell');
    if(!sidebar||!shell)return;
    try{window.ProgramStudioEditorToolRail?.showAll?.();}catch(error){console.warn('[pdf-sidebar] legacy tool rail showAll failed',error);}
    const panel=shell.querySelector('.ps-tool-panel');
    if(panel){
      [...panel.children].forEach(node=>{
        if(!(node instanceof HTMLElement)||node.classList.contains('ps-tool-panel-head'))return;
        node.hidden=false;
        node.removeAttribute('data-ps-tool-step');
      });
    }
    shell.dataset.pdfSidebarLegacyContainment='1';
    sidebar.classList.remove('ps-sidebar-collapsed');
    document.getElementById('programStudioEditorToolRailV1Styles')?.remove();
  }

  function restoreOutputRail(){
    const app=document.querySelector('.app'),sidebar=app?.querySelector('aside:first-of-type'),rail=document.getElementById('pdfOutputRail');
    if(!app||!sidebar||!rail)return;
    [...rail.children].filter(node=>node.classList?.contains('sec')).forEach(node=>sidebar.appendChild(node));
    rail.remove();
    const main=app.querySelector('main');if(main)main.style.gridColumn='';
  }

  function removePrintOutputToolLabel(){
    const sidebar=document.querySelector('.app>aside:first-of-type');
    if(!sidebar)return;
    const normalize=value=>String(value||'').replace(/[\s,，·ㆍ/|:：]+/g,'');
    const target='인쇄출력도구';
    const ownText=node=>[...node.childNodes].filter(child=>child.nodeType===Node.TEXT_NODE).map(child=>child.textContent||'').join(' ');
    const candidates=new Set([
      ...sidebar.querySelectorAll('.ps-tool-panel-head,.ps-tool-rail-title,[data-ps-tool-title]'),
      ...sidebar.querySelectorAll('h1,h2,h3,h4,strong,b,span,div,p')
    ]);
    candidates.forEach(node=>{
      if(!node?.isConnected)return;
      const own=normalize(ownText(node));
      const full=normalize(node.textContent);
      if(own===target||(full===target&&node.children.length<=2))node.remove();
    });
    document.documentElement.dataset.pdfSidebarPrintOutputLabel='removed';
  }

  function removeLegacyUi(){
    document.querySelectorAll('.ps-sidebar-toggle,#pdfWorkflowHead,#pdfResultBar,#pdfEditorWorkflowV2,#pdfEditorWorkflowErrorV2,#pdfOutputSummaryV2').forEach(node=>node.remove());
    const sidebar=document.querySelector('.app>aside:first-of-type');
    sidebar?.classList.remove('ps-sidebar-collapsed');
    sidebar?.removeAttribute('aria-hidden');
    document.documentElement.classList.remove('ps-sidebar-collapsed');
    document.body?.classList.remove('ps-sidebar-collapsed');
    document.body?.removeAttribute('data-pdf-workflow');
    document.body?.removeAttribute('data-pdf-workspace');
    document.documentElement.removeAttribute('data-pdf-workflow-ui');
    document.documentElement.removeAttribute('data-pdf-workspace-layout');
    document.documentElement.dataset.pdfAdvanced='1';
    try{
      localStorage.removeItem('program-studio:pdf-editor:sidebar-collapsed');
      localStorage.removeItem('program-studio:sidebar:pdf-editor');
      localStorage.setItem('program-studio:pdf-editor:advanced','1');
    }catch(_){}
  }

  function organizeWorkspace(){
    const left=document.querySelector('.app>aside:first-of-type');
    if(!left)return;
    const upload=left.querySelector('#sb-upload')?.closest('.sec');
    const paper=left.querySelector('#sb-paper')?.closest('.sec');
    const nup=left.querySelector('#sb-nup')?.closest('.sec');
    if(upload&&paper&&nup&&paper.parentElement===nup.parentElement
        &&paper.compareDocumentPosition(nup)&Node.DOCUMENT_POSITION_PRECEDING){
      nup.parentNode.insertBefore(paper,nup);
    }
    const names={upload:'1 · PDF 불러오기',paper:'2 · 용지·여백',nup:'3 · 페이지 배치',edit:'추가 · 문서 표시'};
    for(const section of left.querySelectorAll('.sec')){
      const key=sectionKey(section);
      if(!key)continue;
      // Output controls stay visible at the bottom; every other section can
      // collapse without losing any inputs, event listeners, or unsaved values.
      const isOpen=key==='output'||openSections.has(key);
      section.classList.remove('pdf-step-section','pdf-advanced-section','pdf-output-dock-v2','ps-tool-source','ps-tool-context-hidden');
      section.removeAttribute('data-pdf-step');
      section.removeAttribute('data-ps-tool-step');
      section.classList.toggle('pdf-ui-closed',!isOpen);
      section.classList.toggle('pdf-ui-toggle',key!=='output');
      section.hidden=false;
      const head=section.querySelector(':scope>.sec-head');
      const body=section.querySelector(':scope>.sec-body');
      if(head){
        head.classList.toggle('collapsed',!isOpen);
        head.setAttribute('aria-expanded',String(isOpen));
        if(key!=='output'){
          head.setAttribute('role','button');
          head.setAttribute('tabindex','0');
          if(body?.id)head.setAttribute('aria-controls',body.id);
        }
        const title=head.querySelector('.sec-title');
        if(title&&names[key]&&title.textContent!==names[key])title.textContent=names[key];
      }
      if(body)body.classList.toggle('hidden',!isOpen);
    }
    const actual=document.getElementById('pdfActualSizeDisclosure');
    if(actual&&document.getElementById('actualSizeCheck')?.checked)actual.open=true;
    const edit=left.querySelector('[data-sec="edit"] .sec-badge');
    if(edit){
      const on=['wmEnabled','hfEnabled','pnEnabled'].filter(id=>document.getElementById(id)?.checked).length;
      const caption=on?on+'개 표시 사용 중':'워터마크·머리말·쪽번호';
      if(edit.textContent!==caption)edit.textContent=caption;
    }
    const hint=document.querySelector('.thumb-hint');
    if(hint&&hint.textContent.includes('클릭=제외'))hint.textContent='클릭으로 선택 · Ctrl/Shift로 여러 페이지 선택 · 드래그로 순서 변경';
  }

  function organizeRightSidebar(){
    const right=document.getElementById('pageSidebar');
    if(!right)return;
    // The page grid retains its independent collapse control and exposes the
    // actual state to assistive technology, unlike the former duplicate heading.
    const section=document.getElementById('thumbSection');
    const heading=section?.querySelector(':scope>.sec-head');
    const pages=section?.querySelector(':scope>.sec-body');
    if(heading&&pages){
      const expanded=!pages.classList.contains('hidden');
      if(heading.getAttribute('aria-expanded')!==String(expanded))heading.setAttribute('aria-expanded',String(expanded));
      if(heading.getAttribute('role')!=='button')heading.setAttribute('role','button');
      if(heading.tabIndex!==0)heading.tabIndex=0;
      if(pages.id)heading.setAttribute('aria-controls',pages.id);
    }
    // Per-file overrides belong with file/page management. Move the *existing*
    // controls, preserving their handlers, instead of creating a second editor.
    const margin=document.getElementById('pdfPageCellMarginsV1');
    if(margin){
      let details=document.getElementById('pdfFileMarginsDetails');
      if(!details){
        details=document.createElement('details');
        details.id='pdfFileMarginsDetails';
        details.className='pdf-file-margins-disclosure';
        const summary=document.createElement('summary');
        summary.textContent='파일별 여백 · 고급';
        details.appendChild(summary);
        const thumb=document.getElementById('thumbSection');
        if(thumb?.parentElement===right)right.insertBefore(details,thumb);
        else right.appendChild(details);
      }
      if(margin.parentElement!==details)details.appendChild(margin);
    }
    const navigation=document.getElementById('pdfFileNavigation');
    if(navigation&&navigation.parentElement?.id!=='pdfPageJumpDetails'){
      let details=document.getElementById('pdfPageJumpDetails');
      if(!details){
        details=document.createElement('details');
        details.id='pdfPageJumpDetails';
        details.className='pdf-page-jump-disclosure';
        const summary=document.createElement('summary');
        summary.textContent='페이지 찾기 · 파일 접기';
        details.appendChild(summary);
        navigation.parentElement.insertBefore(details,navigation);
      }
      if(navigation.parentElement!==details)details.appendChild(navigation);
    }
  }

  function compactLogout(){
    const logout=document.getElementById('navLogout');if(!logout)return;
    logout.title='로그아웃';logout.setAttribute('aria-label','로그아웃');
    logout.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5M15 12H3M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></svg>';
  }

  function sync(){
    observer?.disconnect?.();
    try{installStyles();neutralizeToolRail();restoreOutputRail();removeLegacyUi();removePrintOutputToolLabel();organizeWorkspace();organizeRightSidebar();compactLogout();document.body.dataset.pdfSidebarMode='stepwise-print-workflow-v2';document.documentElement.dataset.pdfSimpleSidebarUi='1';}
    finally{observer?.observe(document.querySelector('.app')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']});}
  }

  function blockToggle(event){
    const head=event.target?.closest?.('.app>aside:first-of-type .sec-head[data-sec]');
    if(!head||event.target?.closest?.('button,input,select,textarea,a,[contenteditable="true"]'))return;
    const key=sectionKey(head.closest('.sec'));
    if(!key||key==='output')return;
    if(event.type==='keydown'&&!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if(openSections.has(key))openSections.delete(key);
    else openSections.add(key);
    // Section feedback must be synchronous, including in background tabs where
    // requestAnimationFrame is paused. A queued repaint may refresh later.
    sync();
  }
  function queue(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});}
  function boot(){if(typeof MutationObserver==='function')observer=new MutationObserver(queue);document.addEventListener('click',blockToggle,true);document.addEventListener('keydown',blockToggle,true);
    document.addEventListener('keydown',event=>{
      const header=event.target?.closest?.('#pageSidebar #thumbSection>.sec-head');
      if(header&&!event.target?.closest?.('button,input,select,textarea,a,[contenteditable="true"]')&&['Enter',' '].includes(event.key)){
        event.preventDefault();
        header.click();
      }
    },true);
    document.addEventListener('click',event=>{
      if(event.target?.closest?.('#pageSidebar #thumbSection>.sec-head'))queueMicrotask(organizeRightSidebar);
    });
    sync();[80,220,600,1200,2200].forEach(delay=>setTimeout(queue,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  const api={sync,removePrintOutputToolLabel,stage:'two-sidebar-print-workflow-v2',revision:'stepwise-sidebar-and-file-margin-grouping-v1'};
  window.PdfEditorSimpleSidebarUi=api;window.PdfEditorWorkflowUi=api;window.PdfEditorWorkspaceLayout=api;
})();