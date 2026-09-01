// September 2026 design-editor UI revision.
(function(){
  'use strict';
  if(window.__designEditorUiRevision20260901)return;
  window.__designEditorUiRevision20260901=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const root=document.documentElement;
  const STYLE_ID='designUiRevision20260901Styles';
  const SIDEBAR_CHROME_ID='designLeftSidebarChrome';
  const CREASE_CARD_ID='designInvitationCreaseTools';
  const SIDEBAR_STORAGE='programTool.designEditor.leftSidebar.v1';
  const COVER_ONLY_IDS=['designCoverSettingsTools','designCoverSpineTools','designCoverPreviewZoneTools'];
  let observer=null;
  let frame=0;
  let syncing=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round1=value=>Math.round((Number(value)||0)*10)/10;

  function currentProduct(){
    const fromDataset=String(root.dataset.printProductMenu||'').trim();
    if(['cover','poster','flyer','invitation','leaflet'].includes(fromDataset))return fromDataset;
    const p=project();
    if(p?.printProductMode==='invitation')return'invitation';
    if(p?.printProductMode==='leaflet')return'leaflet';
    const mode=String(p?.designMode||params.get('mode')||'').trim();
    if(mode==='invitation')return'invitation';
    if(mode==='leaflet2'||mode==='leaflet3')return'leaflet';
    if(mode==='cover')return'cover';
    if(mode==='poster')return'poster';
    if(mode==='flyer')return'flyer';
    const app=String(params.get('app')||'').trim().toLowerCase();
    if(app==='notice'||app==='invitation')return'invitation';
    if(['cover','poster','flyer','leaflet'].includes(app))return app;
    const preset=String(p?.presetId||params.get('preset')||'');
    if(preset==='cover-a4')return'cover';
    if(preset.startsWith('invitation-'))return'invitation';
    if(preset.startsWith('leaflet-'))return'leaflet';
    if(preset.startsWith('poster-'))return'poster';
    if(preset.startsWith('flyer-'))return'flyer';
    return'custom';
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-ui-revision="20260901"]{--design-ui-control-h:34px;--design-ui-font:11.5px;--design-ui-label:11px;--design-left-open:268px;--design-left-closed:52px;--design-right-fixed:292px}
      html[data-design-ui-revision="20260901"] #editorShell{position:relative!important;grid-template-columns:var(--design-left-open) minmax(0,1fr) var(--design-right-fixed)!important}
      html[data-design-ui-revision="20260901"][data-design-sidebar-open="false"] #editorShell{grid-template-columns:var(--design-left-closed) minmax(0,1fr) var(--design-right-fixed)!important}
      html[data-design-ui-revision="20260901"] .sidebar{position:relative!important;display:flex!important;flex-direction:column!important;width:auto!important;min-width:0!important;overflow:hidden!important;padding:0!important;border-right:1px solid #dde5ee!important;background:#fff!important}
      html[data-design-ui-revision="20260901"] .sidebar>#designLeftSidebarChrome{display:flex!important;flex:0 0 44px;align-items:center;padding:6px;border-bottom:1px solid #e4ebf3;background:#f8fafc}
      #designLeftSidebarChrome button{width:100%;height:32px;min-height:32px;border:1px solid #d6e0ea;border-radius:8px;background:#fff;color:#17365f;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 8px}
      #designLeftSidebarChrome .design-left-sidebar-arrow{font-size:15px;line-height:1;font-weight:950}
      html[data-design-sidebar-open="false"] #designLeftSidebarChrome .design-left-sidebar-label{display:none}
      html[data-design-sidebar-open="false"] .sidebar>:not(#designLeftSidebarChrome){display:none!important}
      html[data-design-sidebar-open="true"] .sidebar>.design-flat-panel{flex:1 1 auto;height:auto!important;min-height:0!important;overflow-y:auto!important}

      html[data-design-ui-revision="20260901"] #propertiesPanel,
      html[data-design-ui-revision="20260901"][data-design-context-pane-open="true"] #propertiesPanel,
      html[data-design-ui-revision="20260901"][data-design-context-pane-open="false"] #propertiesPanel{
        display:flex!important;position:relative!important;inset:auto!important;right:auto!important;top:auto!important;bottom:auto!important;grid-column:3!important;grid-row:1!important;
        width:var(--design-right-fixed)!important;min-width:var(--design-right-fixed)!important;max-width:var(--design-right-fixed)!important;height:100%!important;
        margin:0!important;padding:0!important;overflow:hidden!important;transform:none!important;opacity:1!important;pointer-events:auto!important;
        border:0!important;border-left:1px solid #dde5ee!important;border-radius:0!important;background:#fff!important;box-shadow:none!important;transition:none!important;z-index:20!important
      }
      html[data-design-ui-revision="20260901"] #designContextPaneChrome .design-context-close{display:none!important}
      html[data-design-ui-revision="20260901"] #designContextPaneChrome .design-context-head{display:flex!important;padding:10px 12px 8px!important}
      html[data-design-ui-revision="20260901"] #designContextPaneChrome .design-context-tabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;padding:8px 10px!important;border-bottom:1px solid #e7edf4!important}
      html[data-design-ui-revision="20260901"] #designContextPaneChrome .design-context-tab{height:34px!important;min-height:34px!important;font-size:11px!important;border:1px solid #dde6ef!important;background:#fff!important}
      html[data-design-ui-revision="20260901"] #designContextPaneChrome .design-context-tab-label{display:inline!important}
      html[data-design-ui-revision="20260901"][data-design-context-tab="properties"] #propertiesPanel>#inspector{display:block!important}
      html[data-design-ui-revision="20260901"][data-design-context-tab="layers"] #propertiesPanel>#designLayerTools{display:block!important}
      html[data-design-ui-revision="20260901"] #canvasArea{min-width:0!important;padding-right:0!important}

      html[data-design-ui-revision="20260901"] .editor-toolbar #designCanvasViewportToolbar{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;z-index:auto!important;margin:0 4px 0 auto!important;flex:0 0 auto!important}
      html[data-design-ui-revision="20260901"] .editor-toolbar #designCanvasViewportToolbar button,
      html[data-design-ui-revision="20260901"] .editor-toolbar #designCanvasViewportToolbar input{height:32px!important;min-height:32px!important;font-size:11.5px!important}
      html[data-design-ui-revision="20260901"] [data-design-command="panel"]{display:none!important}

      html[data-design-ui-revision="20260901"] .sidebar input:not([type="range"]):not([type="color"]),
      html[data-design-ui-revision="20260901"] .sidebar select,
      html[data-design-ui-revision="20260901"] #propertiesPanel input:not([type="range"]):not([type="color"]),
      html[data-design-ui-revision="20260901"] #propertiesPanel select,
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-product-field input,
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-product-field select{
        height:var(--design-ui-control-h)!important;min-height:var(--design-ui-control-h)!important;font-size:var(--design-ui-font)!important;line-height:1.2!important;padding:0 9px!important;box-sizing:border-box!important
      }
      html[data-design-ui-revision="20260901"] .sidebar button:not(.color-preset):not(.swatch):not([data-color]),
      html[data-design-ui-revision="20260901"] #propertiesPanel button:not(.color-preset):not(.swatch):not([data-color]),
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-mode-btn,
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-product-apply,
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-product-center,
      html[data-design-ui-revision="20260901"] .editor-toolbar button{
        min-height:var(--design-ui-control-h)!important;font-size:var(--design-ui-font)!important;line-height:1.2!important;box-sizing:border-box
      }
      html[data-design-ui-revision="20260901"] .sidebar label,
      html[data-design-ui-revision="20260901"] .sidebar .side-label,
      html[data-design-ui-revision="20260901"] .sidebar .design-tool-title,
      html[data-design-ui-revision="20260901"] #propertiesPanel label,
      html[data-design-ui-revision="20260901"] #propertiesPanel .side-label,
      html[data-design-ui-revision="20260901"] #propertiesPanel .inspector-title,
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-product-field label{font-size:var(--design-ui-label)!important;line-height:1.35!important}
      html[data-design-ui-revision="20260901"] #designEmbeddedModeCard .design-mode-btn{padding:0 6px!important}
      html[data-design-ui-revision="20260901"] #coverSettingsApply{color:#fff!important;-webkit-text-fill-color:#fff!important}
      html[data-design-ui-revision="20260901"]:not([data-design-current-product="cover"]) #designCoverSettingsTools,
      html[data-design-ui-revision="20260901"]:not([data-design-current-product="cover"]) #designCoverSpineTools,
      html[data-design-ui-revision="20260901"]:not([data-design-current-product="cover"]) #designCoverPreviewZoneTools{display:none!important}
      html[data-design-ui-revision="20260901"]:not([data-design-current-product="invitation"]) #designInvitationCreaseTools{display:none!important}

      #designInvitationCreaseTools .design-crease-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
      #designInvitationCreaseTools .design-crease-field{display:flex;flex-direction:column;gap:4px;min-width:0}
      #designInvitationCreaseTools .design-crease-field label{font-size:11px!important;font-weight:900;color:#667085}
      #designInvitationCreaseTools select,#designInvitationCreaseTools input{width:100%;height:34px!important;min-height:34px!important;border:1px solid #cfd9e3;border-radius:8px;background:#fff;color:#344054;font-family:inherit;font-size:11.5px!important;padding:0 9px;box-sizing:border-box}
      #designInvitationCreaseTools .design-crease-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}
      #designInvitationCreaseTools .design-crease-btn{height:34px;min-height:34px;border:1px solid #cfd9e3;border-radius:8px;background:#fff;color:#344054;font-family:inherit;font-size:11.5px;font-weight:900;cursor:pointer}
      #designInvitationCreaseTools .design-crease-btn.primary{border-color:#1769e0;background:#1769e0;color:#fff}
      #designInvitationCreaseTools .design-crease-note{margin:7px 0 0;font-size:10.5px;line-height:1.45;color:#667085}

      @media(max-width:1180px){html[data-design-ui-revision="20260901"]{--design-left-open:248px;--design-right-fixed:280px}}
      @media(max-width:900px){
        html[data-design-ui-revision="20260901"]{--design-left-open:240px;--design-right-fixed:260px}
        html[data-design-ui-revision="20260901"] #editorShell{grid-template-columns:var(--design-left-closed) minmax(0,1fr) var(--design-right-fixed)!important}
        html[data-design-ui-revision="20260901"][data-design-sidebar-open="true"] #editorShell{grid-template-columns:var(--design-left-open) minmax(0,1fr) var(--design-right-fixed)!important}
      }
    `;
    document.head.appendChild(style);
  }

  function readSidebarOpen(){
    try{return localStorage.getItem(SIDEBAR_STORAGE)!=='closed';}catch(_){return true;}
  }

  function setSidebarOpen(open,{persist=true}={}){
    root.dataset.designSidebarOpen=open?'true':'false';
    const button=byId(SIDEBAR_CHROME_ID)?.querySelector('button');
    if(button){
      button.setAttribute('aria-expanded',String(open));
      button.setAttribute('title',open?'왼쪽 메뉴 접기':'왼쪽 메뉴 펼치기');
      const arrow=button.querySelector('.design-left-sidebar-arrow');
      if(arrow)arrow.textContent=open?'‹':'›';
    }
    if(persist){try{localStorage.setItem(SIDEBAR_STORAGE,open?'open':'closed');}catch(_){}}
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }

  function ensureSidebarChrome(){
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return false;
    let chrome=byId(SIDEBAR_CHROME_ID);
    if(!chrome){
      chrome=document.createElement('div');chrome.id=SIDEBAR_CHROME_ID;
      chrome.innerHTML='<button type="button" aria-label="왼쪽 제작 메뉴 펼치기/접기"><span class="design-left-sidebar-arrow">‹</span><span class="design-left-sidebar-label">제작 메뉴</span></button>';
      chrome.querySelector('button')?.addEventListener('click',()=>setSidebarOpen(root.dataset.designSidebarOpen!=='true'));
      sidebar.prepend(chrome);
    }else if(chrome.parentElement!==sidebar)sidebar.prepend(chrome);
    if(!root.dataset.designSidebarOpen)setSidebarOpen(readSidebarOpen(),{persist:false});
    return true;
  }

  function lockRightPanel(){
    const panel=byId('propertiesPanel');if(!panel)return false;
    if(root.dataset.designContextPaneOpen!=='true')root.dataset.designContextPaneOpen='true';
    if(!['properties','layers'].includes(root.dataset.designContextTab))root.dataset.designContextTab='properties';
    panel.hidden=false;panel.setAttribute('aria-hidden','false');panel.setAttribute('aria-expanded','true');
    byId('designContextPaneChrome')?.querySelector('[data-context-close]')?.setAttribute('tabindex','-1');
    return true;
  }

  function moveZoomToolbar(){
    const toolbar=byId('designCanvasViewportToolbar'),host=document.querySelector('.editor-toolbar');
    if(!toolbar||!host)return false;
    const commandbar=byId('designTopCommandbar');
    if(toolbar.parentElement!==host){
      if(commandbar?.parentElement===host)host.insertBefore(toolbar,commandbar);else host.appendChild(toolbar);
    }else if(commandbar?.parentElement===host&&toolbar.nextElementSibling!==commandbar)host.insertBefore(toolbar,commandbar);
    return true;
  }

  function removeHeaderPanelCommand(){
    document.querySelectorAll('[data-design-command="panel"]').forEach(node=>node.remove());
  }

  function syncProductDataset(){
    const product=currentProduct();
    root.dataset.designCurrentProduct=product;
    COVER_ONLY_IDS.forEach(id=>{const node=byId(id);if(node){node.hidden=product!=='cover';node.setAttribute('aria-hidden',product==='cover'?'false':'true');}});
    return product;
  }

  function invitationState(){
    const menuState=window.DesignEditorPrintProductMenu?.state?.invitation;
    if(menuState)return menuState;
    if(!window.__designInvitationCreaseState)window.__designInvitationCreaseState={axis:'x',position:0,flip:'none'};
    return window.__designInvitationCreaseState;
  }

  function restoreInvitationGeometry({persist=false}={}){
    if(currentProduct()!=='invitation')return false;
    const p=project();if(!p)return false;
    const state=invitationState();
    const axis=state.axis==='y'?'y':'x';
    const length=Math.max(30,axis==='y'?(Number(p.height)||210):(Number(p.width)||297));
    const position=round1(clamp(Number(state.position)||length/2,15,Math.max(15,length-15)));
    state.axis=axis;state.position=position;state.flip=state.flip||'none';
    p.designMode='invitation';p.printProductMode='invitation';p.printProductPages=4;p.printProductFold='custom';
    p.printProductAxis=axis;p.printProductFoldPosition=position;p.printFoldFlipPanel=state.flip;
    p.leaflet2Layout=axis==='y'?'top-bottom':'left-right';p.foldType=axis==='y'?'invitation-top-bottom':'invitation-left-right';
    (p.surfaces||[]).forEach(surface=>{
      const outside=surface.id==='outside';
      surface.foldAxis=axis;
      surface.panels=axis==='y'?(outside?['상단 외부','하단 외부']:['내용 상단','내용 하단']):(outside?['왼쪽 외부','오른쪽 외부']:['내용 왼쪽','내용 오른쪽']);
      if(axis==='y'){surface.folds=[];surface.foldsY=[position];}
      else{surface.folds=[position];delete surface.foldsY;}
    });
    p.name=`초대장·안내장 · ${round1(p.width)}×${round1(p.height)}mm · 접지 ${position}mm`;
    const title=byId('documentTitle'),meta=byId('documentMeta');
    if(title)title.textContent=p.name;
    if(meta)meta.textContent=`${round1(p.width)} × ${round1(p.height)}mm · 재단 ${round1(p.bleed)}mm`;
    if(persist){
      try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
      window.DesignEditorDraftScope?.saveCurrent?.('invitation-crease-revision');
    }
    window.DesignEditorPrintFoldProduction?.applyFlipRotations?.({persist:false});
    window.DesignEditorPreviewGuides?.refresh?.();
    return true;
  }

  function fillCreaseCard(card){
    const state=invitationState(),p=project();
    const axis=state.axis==='y'?'y':'x';
    const length=Math.max(30,axis==='y'?(Number(p?.height)||210):(Number(p?.width)||297));
    const position=round1(clamp(Number(state.position)||length/2,15,Math.max(15,length-15)));
    const axisInput=card.querySelector('#designInvitationCreaseAxis');
    const positionInput=card.querySelector('#designInvitationCreasePosition');
    const flipInput=card.querySelector('#designInvitationCreaseFlip');
    if(axisInput&&document.activeElement!==axisInput)axisInput.value=axis;
    if(positionInput&&document.activeElement!==positionInput)positionInput.value=String(position);
    if(flipInput&&document.activeElement!==flipInput)flipInput.value=state.flip||'none';
  }

  function ensureInvitationCreaseCard(){
    const panel=document.querySelector('.design-flat-panel')||document.querySelector('.sidebar');if(!panel)return false;
    let card=byId(CREASE_CARD_ID);
    if(!card){
      card=document.createElement('section');card.id=CREASE_CARD_ID;card.className='side-card';
      card.innerHTML=`<div class="side-label">초대장·안내장 접는선</div><div class="design-crease-grid"><div class="design-crease-field"><label for="designInvitationCreaseAxis">접는 방향</label><select id="designInvitationCreaseAxis"><option value="x">좌우 접기</option><option value="y">상하 접기</option></select></div><div class="design-crease-field"><label for="designInvitationCreasePosition">접는 위치 mm</label><input id="designInvitationCreasePosition" type="number" min="15" max="985" step="0.1"></div></div><div class="design-crease-field" style="margin-top:7px"><label for="designInvitationCreaseFlip">상하 접기 내용 방향</label><select id="designInvitationCreaseFlip"><option value="none">일반 방향</option><option value="top">상단 내용 180°</option><option value="bottom">하단 내용 180°</option></select></div><div class="design-crease-actions"><button type="button" class="design-crease-btn" data-crease-center>정중앙 50:50</button><button type="button" class="design-crease-btn primary" data-crease-apply>접는선 적용</button></div><p class="design-crease-note">초대장과 안내장 모두 지정한 위치에 접는선을 표시합니다.</p>`;
      card.addEventListener('change',event=>{
        if(event.target.id==='designInvitationCreaseAxis'){
          const state=invitationState();state.axis=event.target.value==='y'?'y':'x';
          const p=project(),length=state.axis==='y'?(Number(p?.height)||210):(Number(p?.width)||297);
          state.position=round1(length/2);fillCreaseCard(card);
        }
      });
      card.addEventListener('click',event=>{
        const state=invitationState(),p=project();
        if(event.target.closest('[data-crease-center]')){
          const axis=card.querySelector('#designInvitationCreaseAxis')?.value==='y'?'y':'x';
          const length=axis==='y'?(Number(p?.height)||210):(Number(p?.width)||297);
          const input=card.querySelector('#designInvitationCreasePosition');if(input)input.value=String(round1(length/2));
          return;
        }
        if(event.target.closest('[data-crease-apply]')){
          state.axis=card.querySelector('#designInvitationCreaseAxis')?.value==='y'?'y':'x';
          state.position=Number(card.querySelector('#designInvitationCreasePosition')?.value)||0;
          state.flip=card.querySelector('#designInvitationCreaseFlip')?.value||'none';
          restoreInvitationGeometry({persist:true});fillCreaseCard(card);
        }
      });
      const modeCard=byId('designEmbeddedModeCard');
      if(modeCard?.parentElement===panel)modeCard.insertAdjacentElement('afterend',card);else panel.prepend(card);
    }
    fillCreaseCard(card);
    return true;
  }

  function sync(){
    if(syncing)return false;syncing=true;
    try{
      root.dataset.designUiRevision='20260901';
      root.classList.remove('ps-sidebar-collapsed');
      installStyles();ensureSidebarChrome();lockRightPanel();moveZoomToolbar();removeHeaderPanelCommand();
      const product=syncProductDataset();
      if(product==='invitation'){ensureInvitationCreaseCard();restoreInvitationGeometry({persist:false});}
      return true;
    }finally{syncing=false;}
  }

  function schedule(){
    if(frame)return;frame=requestAnimationFrame(()=>{frame=0;sync();});
  }

  function observe(){
    if(observer||typeof MutationObserver!=='function')return;
    observer=new MutationObserver(schedule);
    observer.observe(root,{attributes:true,attributeFilter:['data-design-context-pane-open','data-design-context-tab','data-design-document-type','data-print-product-menu','data-active-design-mode']});
    const panel=document.querySelector('.design-flat-panel');if(panel)observer.observe(panel,{childList:true,subtree:true});
    const toolbar=document.querySelector('.editor-toolbar');if(toolbar)observer.observe(toolbar,{childList:true,subtree:false});
    const properties=byId('propertiesPanel');if(properties)observer.observe(properties,{childList:true,subtree:false});
    ['resize','programstudio:design-document-type','programstudio:document-type-change','programstudio:design-mode-change','programstudio:design-product-change','programstudio:runtime-script-result'].forEach(name=>window.addEventListener(name,schedule,{passive:true}));
  }

  function boot(){sync();observe();[120,350,800,1600,3000].forEach(delay=>setTimeout(schedule,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorUiRevision={sync,schedule,setSidebarOpen,restoreInvitationGeometry,stage:'design-editor-ui-revision-20260901'};
})();
