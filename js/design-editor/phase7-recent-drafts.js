(function(){
  'use strict';
  if(window.__designEditorRecentDraftsV1)return;
  window.__designEditorRecentDraftsV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!isGeneral)return;

  const STYLE_ID='designEditorRecentDraftStyles';
  const ROOT_CLASS='design-recent-drafts';
  let refreshTimer=0;

  function installStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .${ROOT_CLASS}{margin-top:7px;border-top:1px solid #e3e9ef;padding-top:7px}
      .${ROOT_CLASS}>summary{cursor:pointer;list-style:none;font-size:7.5px;font-weight:900;color:#526174;display:flex;align-items:center;justify-content:space-between;gap:6px}
      .${ROOT_CLASS}>summary::-webkit-details-marker{display:none}
      .${ROOT_CLASS}>summary::after{content:'▾';font-size:7px;color:#8a94a4}
      .${ROOT_CLASS}[open]>summary::after{content:'▴'}
      .design-recent-list{display:flex;flex-direction:column;gap:4px;margin-top:6px}
      .design-recent-item{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px;border:1px solid #dce5ed;border-radius:7px;background:#fff;padding:6px;text-align:left;cursor:pointer;color:#344054}
      .design-recent-item:hover{border-color:#8dbbc5;background:#f4fbfc}
      .design-recent-name{display:block;font-size:7.5px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .design-recent-meta{display:block;margin-top:2px;font-size:6.5px;color:#8590a0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .design-recent-open{font-size:7px;font-weight:950;color:#0f7180}
    `;
    document.head.appendChild(style);
  }

  function modeForPreset(presetId){
    const id=String(presetId||'');
    if(id.startsWith('poster-'))return 'poster';
    if(id.startsWith('flyer-'))return 'flyer';
    if(id==='leaflet-2')return 'leaflet2';
    if(id.startsWith('leaflet-3-'))return 'leaflet3';
    if(id==='custom')return 'custom';
    return '';
  }

  function detailForDraft(item){
    const mode=modeForPreset(item?.presetId);if(!mode)return null;
    const preset=String(item.presetId||'');
    if(mode==='poster'||mode==='flyer')return{mode,preset,orientation:Number(item.width)>Number(item.height)?'landscape':'portrait'};
    if(mode==='leaflet2')return{mode,preset:'leaflet-2'};
    if(mode==='leaflet3')return{mode,preset};
    return{mode:'custom',preset:'custom',w:Number(item.width)||210,h:Number(item.height)||297};
  }

  function formatSavedAt(value){
    const date=new Date(Number(value)||0);if(!Number.isFinite(date.getTime())||date.getTime()<=0)return '자동 저장';
    try{return date.toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch(_){return '자동 저장';}
  }

  function openDraft(item){
    const detail=detailForDraft(item);if(!detail)return;
    window.DesignEditorDraftScope?.saveCurrent?.('recent-switch');
    const payload={type:'program-studio-design-mode',...detail};
    if(window.parent!==window){window.parent.postMessage(payload,location.origin);return;}
    const query=new URLSearchParams({embed:'1',mode:detail.mode,preset:detail.preset});
    if(detail.orientation)query.set('orientation',detail.orientation);
    if(detail.mode==='custom'){query.set('w',String(detail.w));query.set('h',String(detail.h));}
    location.href='/design-editor/general.html?'+query.toString();
  }

  function recentDrafts(){
    const list=window.DesignEditorDraftScope?.listDrafts?.();
    if(!Array.isArray(list))return[];
    return [...list]
      .filter(item=>detailForDraft(item))
      .sort((a,b)=>(Number(b.savedAt)||0)-(Number(a.savedAt)||0))
      .slice(0,5);
  }

  function render(){
    const card=document.getElementById('designEmbeddedModeCard');if(!card)return false;
    card.querySelector(`.${ROOT_CLASS}`)?.remove();
    const items=recentDrafts();if(!items.length)return true;
    const details=document.createElement('details');details.className=ROOT_CLASS;
    const summary=document.createElement('summary');summary.textContent=`최근 작업 ${items.length}`;details.appendChild(summary);
    const list=document.createElement('div');list.className='design-recent-list';
    items.forEach(item=>{
      const button=document.createElement('button');button.type='button';button.className='design-recent-item';
      const name=document.createElement('span');
      const title=document.createElement('span');title.className='design-recent-name';title.textContent=String(item.name||item.presetId||'저장 작업');
      const meta=document.createElement('span');meta.className='design-recent-meta';meta.textContent=`${Number(item.width)||0} × ${Number(item.height)||0}mm · ${formatSavedAt(item.savedAt)}`;
      name.append(title,meta);
      const open=document.createElement('span');open.className='design-recent-open';open.textContent='열기';
      button.append(name,open);button.addEventListener('click',()=>openDraft(item));list.appendChild(button);
    });
    details.appendChild(list);
    const hint=card.querySelector('.design-mode-save-hint');
    if(hint)card.insertBefore(details,hint);else card.appendChild(details);
    return true;
  }

  function queueRender(){clearTimeout(refreshTimer);refreshTimer=setTimeout(render,320);}

  function boot(){
    installStyles();
    ['input','change','pointerup','keyup','click'].forEach(name=>document.addEventListener(name,queueRender,false));
    window.addEventListener('pageshow',queueRender);
    [120,320,700,1200,2000,3200].forEach(delay=>setTimeout(render,delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorRecentDrafts={
    render,
    openDraft,
    stage:'recent-preset-draft-shortcuts'
  };
})();
