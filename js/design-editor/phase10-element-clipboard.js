(function(){
  'use strict';
  if(window.__designEditorElementClipboardV1)return;
  window.__designEditorElementClipboardV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const CARD_ID='designElementClipboardTools';
  const STYLE_ID='designElementClipboardStyles';
  let clipboard=null;
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const uid=()=>`design_clip_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,7)}`;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:'extra',item};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item};
    }
    return null;
  }

  function cloneData(value){
    try{return JSON.parse(JSON.stringify(value));}catch(_){return null;}
  }

  function copySelected(){
    const record=selectedRecord();
    if(!record)return setStatus('복사할 글씨·이미지·도형을 먼저 선택하세요.','info');
    const data=cloneData(record.item);if(!data)return setStatus('선택한 요소를 복사하지 못했습니다.','err');
    clipboard={kind:record.kind,data};updateButtons();
    const label=record.kind==='text'?'글씨':data.type==='image'?'이미지':'도형';
    setStatus(`${label}를 복사했습니다. 다른 면으로 이동한 뒤 붙여넣을 수 있습니다.`,'ok');
  }

  function persistAndRender(source){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('붙여넣은 요소를 저장하지 못했습니다.','err');}
    window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{window.DesignEditorPhase2?.sync?.();window.DesignEditorDraftScope?.saveCurrent?.(source);},70);
  }

  function pasteClipboard(){
    const p=project(),current=surface();
    if(!p||!current)return;
    if(!clipboard?.data)return setStatus('먼저 복사할 요소를 선택해 복사하세요.','info');
    const item=cloneData(clipboard.data);if(!item)return;
    item.id=uid();item.locked=false;delete item.smartLayout;
    const width=Math.max(.5,Number(item.w)||20),height=Math.max(.5,Number(item.h)||8);
    item.x=clamp((Number(item.x)||0)+4,0,Math.max(0,p.width-width));
    item.y=clamp((Number(item.y)||0)+4,0,Math.max(0,p.height-height));
    if(clipboard.kind==='text'){
      if(!Array.isArray(current.elements))current.elements=[];
      current.elements.push(item);
    }else{
      if(!Array.isArray(current.extras))current.extras=[];
      current.extras.push(item);
    }
    persistAndRender('clipboard-paste');
    setStatus('복사한 요소를 현재 면에 붙여넣었습니다.','ok');
  }

  function updateButtons(){
    const paste=byId('designClipboardPaste');if(paste)paste.disabled=!clipboard;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-clipboard-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.design-clipboard-grid button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:7px 4px;font-size:8px;font-weight:900;cursor:pointer}.design-clipboard-grid button:hover:not(:disabled){border-color:#79b9c8;background:#f0fdff}.design-clipboard-grid button:disabled{opacity:.42;cursor:not-allowed}.design-clipboard-note{margin-top:6px;color:#7c8797;font-size:7px;line-height:1.45}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),phase3=byId('designPhase3LayoutTools');if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">요소 복사</div><div class="design-clipboard-grid"><button id="designClipboardCopy" type="button">복사</button><button id="designClipboardPaste" type="button" disabled>붙여넣기</button></div><div class="design-clipboard-note">앞·뒷면이나 리플렛 다른 면으로 이동해도 복사한 요소를 붙여넣을 수 있습니다. Ctrl+C / Ctrl+V</div>`;
    if(phase3?.nextSibling)sidebar.insertBefore(card,phase3.nextSibling);else sidebar.appendChild(card);
    byId('designClipboardCopy').addEventListener('click',copySelected);
    byId('designClipboardPaste').addEventListener('click',pasteClipboard);
    return true;
  }

  function handleKeys(event){
    if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
    const tag=String(event.target?.tagName||'').toUpperCase();
    if(['INPUT','TEXTAREA','SELECT'].includes(tag)||event.target?.isContentEditable)return;
    const key=event.key.toLowerCase();
    if(key==='c'&&selectedRecord()){event.preventDefault();event.stopImmediatePropagation();copySelected();}
    if(key==='v'&&clipboard){event.preventDefault();event.stopImmediatePropagation();pasteClipboard();}
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();document.addEventListener('keydown',handleKeys,true);updateButtons();
    window.DesignEditorElementClipboard={copySelected,pasteClipboard,stage:'cross-surface-element-copy-paste'};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
