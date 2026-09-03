// Focused professional workspace: document settings on the left, editing in the header.
(function(){
  'use strict';
  if(window.__designEditorFocusedWorkspace20260901)return;
  window.__designEditorFocusedWorkspace20260901=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const STYLE_ID='designFocusedWorkspace20260901Styles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const HIDDEN_IDS=[
    'designPhase2Tools','designPhase4SmartLayout','designSimpleResultTools','designRotationTools',
    'designCanvasQuickbar'
  ];
  let observer=null;
  let syncFrame=0;
  let bootstrapReleased=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=(value,digits=1)=>{
    const factor=10**digits;
    return Math.round((Number(value)||0)*factor)/factor;
  };

  function selectedRecord(){
    const current=surface();
    if(!current)return null;
    const extraNode=document.querySelector('#artboard .phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:item.type==='image'?'image':'shape',item,node:extraNode};
    }
    const textNode=document.querySelector('#artboard .design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode};
    }
    return null;
  }

  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function persist(reason='focused-workspace'){
    const p=project();if(!p)return false;
    try{
      localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      window.DesignEditorDraftScope?.saveCurrent?.(reason);
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
      return true;
    }catch(_){return false;}
  }

  function installStyles(){
    let style=byId(STYLE_ID);
    if(style)return style;
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-focused-workspace="1"]{--design-focused-left:268px}
      html[data-design-focused-workspace="1"] #editorShell,
      html[data-design-focused-workspace="1"][data-design-ui-revision="20260901"] #editorShell,
      html[data-design-focused-workspace="1"][data-design-essential-workspace] #editorShell{
        grid-template-columns:var(--design-focused-left) minmax(0,1fr)!important;
        grid-template-rows:minmax(0,1fr)!important
      }
      html[data-design-focused-workspace="1"][data-design-sidebar-open="false"] #editorShell{grid-template-columns:52px minmax(0,1fr)!important}
      html[data-design-focused-workspace="1"]:not([data-design-essential-workspace]) #propertiesPanel,
      html[data-design-focused-workspace="1"][data-design-ui-revision="20260901"]:not([data-design-essential-workspace]) #propertiesPanel,
      html[data-design-focused-workspace="1"][data-design-context-pane-open="true"]:not([data-design-essential-workspace]) #propertiesPanel,
      html[data-design-focused-workspace="1"][data-design-context-pane-open="false"]:not([data-design-essential-workspace]) #propertiesPanel{
        display:none!important;width:0!important;min-width:0!important;max-width:0!important;position:absolute!important;visibility:hidden!important;pointer-events:none!important
      }
      html[data-design-focused-workspace="1"] #canvasArea,
      html[data-design-focused-workspace="1"][data-design-essential-workspace] #canvasArea{padding-right:0!important}
      html[data-design-focused-workspace="1"] .editor-main{grid-column:2!important;min-width:0!important}
      html[data-design-focused-workspace="1"]:not([data-design-essential-workspace]) #inspector{display:none!important}
      html[data-design-focused-workspace="1"]:not([data-design-essential-workspace]) [data-focused-ui-hidden="1"]{display:none!important}
      html[data-design-focused-workspace="1"] #designCanvasQuickbar{display:none!important}
      html[data-design-focused-workspace="1"] #designSelectionContextbar,
      html[data-design-focused-workspace="1"] #designMultiSelectionContextbar{
        position:relative!important;top:auto!important;z-index:76!important;min-height:44px!important;flex:0 0 44px!important;padding:6px 10px!important;background:#f8fafc!important;border-bottom:1px solid #dce5ee!important;box-shadow:0 3px 10px rgba(15,39,72,.035)!important
      }
      html[data-design-focused-workspace="1"] #designSelectionContextbar .design-context-field select,
      html[data-design-focused-workspace="1"] #designSelectionContextbar .design-context-field input,
      html[data-design-focused-workspace="1"] #designSelectionContextbar .design-context-actions button,
      html[data-design-focused-workspace="1"] #designSelectionContextbar .design-context-segment button,
      html[data-design-focused-workspace="1"] #designSelectionContextbar .design-context-standalone,
      html[data-design-focused-workspace="1"] #designMultiSelectionContextbar button{height:32px!important;min-height:32px!important;font-size:9px!important}
      .design-focused-pro-field{position:relative;display:grid;grid-template-columns:auto auto auto;align-items:center;gap:4px;flex:0 0 auto}
      .design-focused-pro-field>span{font-size:7px;font-weight:900;color:#7a8797}
      .design-focused-pro-field input{width:58px;height:32px;border:1px solid #d5dfe9;border-radius:7px;background:#fff;color:#334155;padding:0 18px 0 7px;font:850 9px/1 Pretendard,"Malgun Gothic",sans-serif;outline:0}
      .design-focused-pro-field input:focus{border-color:#66a6df;box-shadow:0 0 0 2px rgba(23,105,224,.11)}
      .design-focused-pro-field em{margin-left:-23px;pointer-events:none;color:#94a3b8;font-size:6.5px;font-style:normal}
      .design-focused-pro-sep{width:1px;height:22px;flex:0 0 1px;background:#dce4ec;margin:0 2px}
      html[data-design-focused-workspace="1"] .phase2-extra-object{position:absolute;box-sizing:border-box;cursor:move;touch-action:none;user-select:none}
      html[data-design-focused-workspace="1"] .phase2-extra-object.selected{outline:1.5px solid #1769e0;box-shadow:0 0 0 2px rgba(255,255,255,.8),0 0 0 4px rgba(23,105,224,.12)}
      @media(max-width:1180px){html[data-design-focused-workspace="1"]{--design-focused-left:248px}}
      @media(max-width:900px){html[data-design-focused-workspace="1"]{--design-focused-left:230px}}
    `;
    document.head.appendChild(style);
    return style;
  }

  function nativeAddCard(){return byId('addTitleBtn')?.closest('.side-card')||null;}

  function hideRedundantUi(){
    document.querySelectorAll('[data-design-command="panel"]').forEach(node=>node.remove());
    // When essential-workspace is active it owns sidebar card visibility via
    // applyVisibility(). Do not compete with it — its CSS already overrides the
    // focused-workspace hiding rules through the :not([data-design-essential-workspace])
    // guards, and marking nodes here would fight its structural sync.
    if(document.documentElement.dataset.designEssentialWorkspace)return;
    const card=nativeAddCard();if(card)card.dataset.focusedUiHidden='1';
    HIDDEN_IDS.forEach(id=>{const node=byId(id);if(node)node.dataset.focusedUiHidden='1';});
    document.querySelectorAll('.sidebar .side-card').forEach(node=>{
      const title=String(node.querySelector('.side-label,.design-tool-title,.inspector-title,summary')?.textContent||'').replace(/\s+/g,' ').trim();
      if(/^(내용 추가|전문 기본 배치|이미지·도형 추가|회전)$/.test(title))node.dataset.focusedUiHidden='1';
    });
  }

  function preparePhase2Bootstrap(){
    if(window.DesignEditorPhase2||bootstrapReleased)return;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');
    if(!sidebar||!inspector)return;
    if(inspector.parentElement!==sidebar){
      inspector.dataset.focusedBootstrapInspector='1';
      sidebar.appendChild(inspector);
    }
  }

  function releasePhase2Bootstrap(){
    if(bootstrapReleased||!window.DesignEditorPhase2)return;
    const panel=byId('propertiesPanel'),inspector=byId('inspector');
    if(panel&&inspector&&inspector.parentElement!==panel)panel.appendChild(inspector);
    if(inspector)delete inspector.dataset.focusedBootstrapInspector;
    bootstrapReleased=true;
    window.DesignEditorPhase2?.sync?.();
    window.DesignEditorSelectionContextbar?.sync?.();
  }

  function ensurePhase2FallbackControls(){
    // Normal path: phase2 installs while the inspector is temporarily inside the left sidebar.
    // This fallback only supplies insertion hooks if another runtime prevented that install.
    if(byId('phase2AddImage')&&byId('phase2AddRect')&&byId('phase2AddEllipse')&&byId('phase2AddLine'))return true;
    if(!window.DesignEditorPhase2)return false;
    const host=document.querySelector('.sidebar');if(!host)return false;
    let card=byId('designFocusedInsertHooks');
    if(!card){
      card=document.createElement('section');card.id='designFocusedInsertHooks';card.dataset.focusedUiHidden='1';
      card.innerHTML='<button id="phase2AddImage" type="button"></button><button id="phase2AddRect" type="button"></button><button id="phase2AddEllipse" type="button"></button><button id="phase2AddLine" type="button"></button><input id="phase2ImageInput" type="file" accept="image/jpeg,image/png,image/webp" hidden>';
      host.appendChild(card);
    }
    byId('phase2AddRect').onclick=()=>window.DesignEditorPhase2?.addShape?.('rect');
    byId('phase2AddEllipse').onclick=()=>window.DesignEditorPhase2?.addShape?.('ellipse');
    byId('phase2AddLine').onclick=()=>window.DesignEditorPhase2?.addShape?.('line');
    return true;
  }

  function applyTextPrecision(record,field,value){
    if(record?.kind!=='text'||record.item.locked)return;
    if(field==='letterSpacing')record.item.letterSpacing=clamp(Number(value)||0,-3,10);
    if(field==='lineHeight')record.item.lineHeight=clamp(Number(value)||1.26,.8,3);
    if(record.node){
      record.node.style.letterSpacing=`${(Number(record.item.letterSpacing)||0)*ppm()}px`;
      record.node.style.lineHeight=String(Number(record.item.lineHeight)||1.26);
    }
    persist(`focused-${field}`);
    window.DesignEditorTextAutoFit?.sync?.();
  }

  function applyRotation(record,value){
    if(!record||record.item.locked)return;
    const angle=clamp(Number(value)||0,-180,180);
    if(window.DesignEditorRotation?.setRotation){
      window.DesignEditorRotation.setRotation(angle,'focused-contextbar');
      return;
    }
    record.item.rotation=angle;
    if(record.node){record.node.style.transformOrigin='50% 50%';record.node.style.transform=`rotate(${angle}deg)`;}
    persist('focused-rotation');
  }

  function precisionSignature(record){
    if(!record)return'';
    return `${record.kind}:${record.item.id}:${round(record.item.letterSpacing||0,1)}:${round(record.item.lineHeight||1.26,2)}:${round(record.item.rotation||0,1)}`;
  }

  function enhanceSelectionBar(){
    const bar=byId('designSelectionContextbar'),record=selectedRecord();
    if(!bar||bar.hidden||!record)return false;
    const signature=precisionSignature(record);
    let group=bar.querySelector('[data-focused-pro-controls]');
    if(group?.dataset.signature===signature)return true;
    group?.remove();
    group=document.createElement('div');
    group.dataset.focusedProControls='1';
    group.dataset.signature=signature;
    group.style.display='contents';
    const rotation=`<span class="design-focused-pro-sep" aria-hidden="true"></span><label class="design-focused-pro-field"><span>회전</span><input data-focused-field="rotation" type="number" min="-180" max="180" step="1" value="${round(record.item.rotation||0,1)}" aria-label="회전 각도"><em>°</em></label>`;
    const typography=record.kind==='text'?`<span class="design-focused-pro-sep" aria-hidden="true"></span><label class="design-focused-pro-field"><span>자간</span><input data-focused-field="letterSpacing" type="number" min="-3" max="10" step="0.1" value="${round(record.item.letterSpacing||0,1)}" aria-label="글자 간격"><em>mm</em></label><label class="design-focused-pro-field"><span>행간</span><input data-focused-field="lineHeight" type="number" min="0.8" max="3" step="0.05" value="${round(record.item.lineHeight||1.26,2)}" aria-label="줄 간격"><em>×</em></label>`:'';
    group.innerHTML=typography+rotation;
    const commonSep=bar.querySelector('.design-context-sep');
    if(commonSep)bar.insertBefore(group,commonSep);else bar.appendChild(group);
    group.querySelectorAll('[data-focused-field]').forEach(input=>{
      input.addEventListener('input',event=>{
        const current=selectedRecord();if(!current)return;
        const field=event.currentTarget.dataset.focusedField;
        if(field==='rotation')applyRotation(current,event.currentTarget.value);
        else applyTextPrecision(current,field,event.currentTarget.value);
        group.dataset.signature=precisionSignature(current);
      });
    });
    return true;
  }

  function simplifyHeaderLabels(){
    const add=byId('designTopCommandbar')?.querySelector('[data-design-command="insert"]');
    if(add){add.title='글씨·이미지·도형·선을 추가합니다';add.setAttribute('aria-label','요소 추가');}
    const bar=byId('designSelectionContextbar');
    bar?.setAttribute('aria-label','선택 요소 빠른 편집');
  }

  function sync(){
    document.documentElement.dataset.designFocusedWorkspace='1';
    installStyles();
    preparePhase2Bootstrap();
    releasePhase2Bootstrap();
    ensurePhase2FallbackControls();
    hideRedundantUi();
    simplifyHeaderLabels();
    enhanceSelectionBar();
    return true;
  }

  function queueSync(){
    if(syncFrame)return;
    syncFrame=requestAnimationFrame(()=>{syncFrame=0;sync();});
  }

  function boot(){
    document.documentElement.dataset.designFocusedWorkspace='1';
    installStyles();
    preparePhase2Bootstrap();
    hideRedundantUi();
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(queueSync);
      const sidebar=document.querySelector('.sidebar');
      const toolbar=document.querySelector('.editor-toolbar');
      const properties=byId('propertiesPanel');
      if(sidebar)observer.observe(sidebar,{childList:true,subtree:true});
      if(toolbar)observer.observe(toolbar,{childList:true,subtree:false});
      if(properties)observer.observe(properties,{childList:true,subtree:false});
      document.documentElement.dataset.designFocusedObserverScope='workspace-only';
    }
    ['click','dblclick','input','change','pointerup','programstudio:design-mode-change','programstudio:document-type-change'].forEach(name=>document.addEventListener(name,queueSync,false));
    window.addEventListener('resize',queueSync,{passive:true});
    [80,180,350,700,1200,2000,3200].forEach(delay=>setTimeout(queueSync,delay));
  }

  window.DesignEditorFocusedWorkspace={sync,stage:'focused-header-editing-workspace-v2-scoped-observer'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();