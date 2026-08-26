(function(){
  'use strict';
  if(window.__designEditorShapeBorderControlsV1)return;
  window.__designEditorShapeBorderControlsV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor/general'&&path!=='/design-editor/general.html'&&!path.endsWith('/design-editor/general.html'))return;

  const STYLE_ID='designEditorShapeBorderControlStyles';
  const CONTROL_ID='designShapeBorderToggleRow';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const TRANSPARENT_STROKE='rgba(0,0,0,0)';
  let installed=false;
  let syncTimer=0;
  let saveTimer=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){const p=project();return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;}
  function selectedShape(){
    const node=document.querySelector('.phase2-extra-object.selected[data-extra-id]');if(!node)return null;
    const item=surface()?.extras?.find(entry=>entry.id===node.dataset.extraId&&entry.type==='shape');
    return item?{item,node}:null;
  }

  function persist(source='shape-border'){
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const p=project();if(!p)return;
      try{
        if(window.DesignEditorDraftScope?.saveCurrent){window.DesignEditorDraftScope.saveCurrent(source);return;}
        localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      }catch(_){}
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
    },60);
  }

  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function isTransparent(value){
    const text=String(value||'').replace(/\s+/g,'').toLowerCase();
    return text==='transparent'||text==='#00000000'||text==='rgba(0,0,0,0)'||text==='rgba(0,0,0,0.0)';
  }

  function borderEnabled(item){return item?.shape==='line'?true:!(item?.strokeDisabled===true||isTransparent(item?.stroke));}

  function currentStrokeColor(item){
    if(item?.strokeDisabled||isTransparent(item?.stroke))return String(item?.strokeColorBeforeNone||'#12396d');
    return String(item?.stroke||'#12396d');
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .shape-border-toggle-row{margin:6px 0 9px;padding:7px 8px;border:1px solid #dde6ed;border-radius:8px;background:#f8fbfd}.shape-border-toggle{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#475569;font-size:8px;font-weight:900}.shape-border-toggle input{accent-color:#12396d}.shape-border-state{font-size:6.5px;color:#84909d}.shape-border-state.off{color:#b54708;font-weight:850}.shape-border-disabled{opacity:.45;pointer-events:none}
    `;document.head.appendChild(style);
  }

  function normalizeLegacy(item){
    if(!item||item.shape==='line')return;
    if(item.strokeDisabled===true&&!isTransparent(item.stroke)){
      item.strokeColorBeforeNone=item.strokeColorBeforeNone||item.stroke||'#12396d';
      item.stroke=TRANSPARENT_STROKE;
    }
  }

  function refreshRenderedShape(item,node){
    if(!item||!node||item.shape==='line')return;
    const inner=node.querySelector('.phase2-shape-inner');if(!inner)return;
    if(borderEnabled(item)){
      const scale=Math.max(.001,(byId('artboard')?.getBoundingClientRect().width||1)/Math.max(1,(Number(project()?.width)||1)+(Number(project()?.bleed)||0)*2));
      inner.style.border=`${Math.max(1,(Number(item.strokeWidth)||1)*scale)}px solid ${currentStrokeColor(item)}`;
    }else inner.style.border='none';
    node.dataset.borderEnabled=borderEnabled(item)?'true':'false';
  }

  function patchInspector(record){
    const {item,node}=record;normalizeLegacy(item);refreshRenderedShape(item,node);
    if(item.shape==='line'){byId(CONTROL_ID)?.remove();return;}
    const inspector=byId('inspector');if(!inspector)return;
    let row=byId(CONTROL_ID);
    if(!row){
      row=document.createElement('div');row.id=CONTROL_ID;row.className='shape-border-toggle-row';
      row.innerHTML='<label class="shape-border-toggle"><span>테두리 선</span><span><input id="designShapeBorderToggle" type="checkbox"> 표시</span></label><div id="designShapeBorderState" class="shape-border-state"></div>';
      const widthField=inspector.querySelector('[data-extra-field="strokeWidth"]')?.closest('.field');
      if(widthField)widthField.insertAdjacentElement('afterend',row);else inspector.appendChild(row);
      byId('designShapeBorderToggle')?.addEventListener('change',event=>setBorderEnabled(event.target.checked));
    }
    const enabled=borderEnabled(item),toggle=byId('designShapeBorderToggle'),state=byId('designShapeBorderState');
    if(toggle)toggle.checked=enabled;
    if(state){state.textContent=enabled?'테두리 색상과 선 두께가 출력에도 적용됩니다.':'테두리 없음 · 화면과 300DPI PNG/PDF 출력에서 선을 그리지 않습니다.';state.classList.toggle('off',!enabled);}
    const color=inspector.querySelector('[data-extra-field="stroke"]');
    const width=inspector.querySelector('[data-extra-field="strokeWidth"]');
    [color,width].forEach(control=>control?.closest('.field')?.classList.toggle('shape-border-disabled',!enabled));
    if(color){try{color.value=currentStrokeColor(item);}catch(_){}}
    if(width)width.disabled=!enabled;
    if(color)color.disabled=!enabled;
    patchQuickbar(item);
  }

  function patchQuickbar(item){
    const input=document.querySelector('#designCanvasQuickbar [data-qb-color="stroke"]');if(!input)return;
    const enabled=borderEnabled(item);input.disabled=!enabled;input.title=enabled?'테두리 색상':'테두리 없음';
    try{input.value=currentStrokeColor(item);}catch(_){}
  }

  function setBorderEnabled(enabled){
    const record=selectedShape();if(!record||record.item.shape==='line')return false;
    const item=record.item;
    if(enabled){
      item.strokeDisabled=false;
      item.stroke=String(item.strokeColorBeforeNone||'#12396d');
    }else{
      if(!isTransparent(item.stroke))item.strokeColorBeforeNone=String(item.stroke||'#12396d');
      item.strokeDisabled=true;
      item.stroke=TRANSPARENT_STROKE;
    }
    persist(enabled?'shape-border-enable':'shape-border-disable');
    window.DesignEditorPhase2?.sync?.();
    window.DesignEditorQuickDesign?.sync?.();
    window.DesignEditorCanvasQuickbar?.sync?.();
    setTimeout(sync,30);
    setStatus(enabled?'도형 테두리를 표시합니다.':'도형 테두리를 없앴습니다. 출력 파일에도 테두리가 그려지지 않습니다.','ok');
    return true;
  }

  function rememberStrokeColor(event){
    const control=event.target?.closest?.('[data-extra-field="stroke"],#designCanvasQuickbar [data-qb-color="stroke"]');if(!control)return;
    const record=selectedShape();if(!record||record.item.shape==='line'||record.item.strokeDisabled)return;
    const value=String(control.value||'');if(!value||isTransparent(value))return;
    record.item.strokeColorBeforeNone=value;persist('shape-border-color');
  }

  function sync(){
    const record=selectedShape();
    if(!record){byId(CONTROL_ID)?.remove();return;}
    patchInspector(record);
  }
  function queueSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),30);}
  function bindEvents(){
    ['click','dblclick','change','keyup','pointerup'].forEach(name=>document.addEventListener(name,event=>{if(event.target?.closest?.(`#${CONTROL_ID}`))return;queueSync();},false));
    document.addEventListener('input',event=>{rememberStrokeColor(event);if(!event.target?.closest?.(`#${CONTROL_ID}`))queueSync();},false);
    const inspector=byId('inspector');if(inspector)new MutationObserver(queueSync).observe(inspector,{childList:true,subtree:true});
    const board=byId('artboard');if(board)new MutationObserver(queueSync).observe(board,{childList:true,subtree:true});
  }

  function install(){
    if(installed)return true;
    if(!byId('inspector')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();bindEvents();
    window.DesignEditorShapeBorderControls={setBorderEnabled,borderEnabled,currentStrokeColor,transparentStroke:TRANSPARENT_STROKE,stage:'shape-border-none-screen-and-print-safe'};
    [100,260,620,1100,1800,2800].forEach(delay=>setTimeout(queueSync,delay));return true;
  }
  function boot(){if(install())return;[140,320,700,1200,2000,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();