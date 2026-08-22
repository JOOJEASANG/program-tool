(function(){
  'use strict';
  if(window.__designEditorComponentBlocksV1)return;
  window.__designEditorComponentBlocksV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor'&&path!=='/design-editor/index.html'&&!path.endsWith('/design-editor/index.html'))return;

  const CARD_ID='designComponentBlocksTools';
  const STYLE_ID='designComponentBlocksStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const TAG='component-block-v1';
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }
  function ensureArrays(current){
    if(!Array.isArray(current.elements))current.elements=[];
    if(!Array.isArray(current.extras))current.extras=[];
  }

  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function roleStyle(role){
    const fallback={title:{size:34,weight:900,align:'left',color:'#12396d'},subtitle:{size:16,weight:800,align:'left',color:'#334155'},body:{size:11,weight:500,align:'left',color:'#334155'},info:{size:10,weight:700,align:'left',color:'#475569'},institution:{size:9,weight:700,align:'left',color:'#64748b'}};
    return window.DesignEditorPresets?.ROLE_PRESETS?.[role]||fallback[role]||fallback.body;
  }

  function text(group,role,value,x,y,w,overrides={}){
    const style=roleStyle(role);
    return {
      id:uid('component_text'),type:'text',role,text:value,fontFamily:'Pretendard',size:overrides.size??style.size,weight:overrides.weight??style.weight,
      align:overrides.align??style.align,color:overrides.color??style.color,icon:overrides.icon||'none',x,y,w,
      letterSpacing:overrides.letterSpacing??0,lineHeight:overrides.lineHeight??1.26,locked:false,visible:true,
      titleStyle:overrides.titleStyle||'none',titleAccent:overrides.titleAccent||'#1d9bb2',componentBlock:TAG,componentGroup:group
    };
  }

  function panelRegion(p,current){
    const safe=clamp(Number(p.safe)||8,4,24),folds=(current.folds||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    const bounds=[0,...folds,Number(p.width)||210],labels=current.panels||[];
    let index=labels.findIndex(label=>/앞표지/.test(String(label)));
    if(index<0)index=0;
    const start=bounds[index]??0,end=bounds[index+1]??(Number(p.width)||210);
    const panelW=Math.max(20,end-start),pad=clamp(Math.min(safe,panelW*.1),4,10);
    return{x:start+pad,w:Math.max(20,panelW-pad*2),top:clamp(safe,4,Math.max(4,(Number(p.height)||297)/4)),bottom:Math.max(20,(Number(p.height)||297)-safe)};
  }

  function persistAndRefresh(message){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('구성요소를 저장하지 못했습니다.','err');}
    window.DesignEditorDraftScope?.saveCurrent?.('component-block');
    window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{
      window.DesignEditorPhase2?.sync?.();
      window.DesignEditorQuickDesign?.sync?.();
      window.DesignEditorSimpleInterface?.sync?.();
      setStatus(message,'ok');
    },80);
  }

  function insertTitleBlock(){
    const p=project(),current=surface();if(!p||!current)return;
    ensureArrays(current);const region=panelRegion(p,current),group=uid('title_block');
    current.elements.push(
      text(group,'title','행사 제목을 입력하세요',region.x,region.top+8,region.w,{size:Math.min(36,Math.max(22,region.w*.17)),titleStyle:'bar'}),
      text(group,'subtitle','핵심 내용을 한 줄로 정리하세요',region.x,region.top+29,region.w,{size:Math.min(16,Math.max(10,region.w*.075)),color:'#475569'})
    );
    persistAndRefresh('제목 블록을 넣었습니다. 글자만 바꿔서 사용하세요.');
  }

  function insertEventInfo(){
    const p=project(),current=surface();if(!p||!current)return;
    ensureArrays(current);const region=panelRegion(p,current),group=uid('event_info'),baseY=Math.min(region.bottom-38,Math.max(region.top+52,(Number(p.height)||297)*.58));
    current.elements.push(
      text(group,'info','2026. 00. 00.  00:00',region.x,baseY,region.w,{icon:'calendar'}),
      text(group,'info','장소를 입력하세요',region.x,baseY+12,region.w,{icon:'pin'}),
      text(group,'info','참여 대상을 입력하세요',region.x,baseY+24,region.w,{icon:'people'})
    );
    persistAndRefresh('일정·장소·대상 블록을 넣었습니다.');
  }

  function insertContactBlock(){
    const p=project(),current=surface();if(!p||!current)return;
    ensureArrays(current);const region=panelRegion(p,current),group=uid('contact_block'),baseY=Math.min(region.bottom-24,Math.max(region.top+64,(Number(p.height)||297)*.72));
    current.elements.push(
      text(group,'subtitle','문의',region.x,baseY,region.w,{size:12,titleStyle:'line'}),
      text(group,'info','041-000-0000 · 담당부서',region.x,baseY+13,region.w,{icon:'phone',size:9.5})
    );
    persistAndRefresh('문의·연락처 블록을 넣었습니다.');
  }

  function insertFooterBlock(){
    const p=project(),current=surface();if(!p||!current)return;
    ensureArrays(current);const region=panelRegion(p,current),group=uid('footer_block'),y=Math.max(region.top+15,region.bottom-13);
    current.elements.push(text(group,'institution','주최 · 주관 기관명을 입력하세요',region.x,y,region.w,{size:8.5,color:'#64748b'}));
    persistAndRefresh('하단 기관정보를 넣었습니다.');
  }

  function removeLatestBlock(){
    const current=surface();if(!current)return;
    ensureArrays(current);
    const groups=current.elements.filter(item=>item.componentBlock===TAG&&item.componentGroup).map(item=>item.componentGroup);
    const group=groups.at(-1);if(!group)return setStatus('현재 면에 제거할 빠른 구성요소가 없습니다.','info');
    current.elements=current.elements.filter(item=>item.componentGroup!==group);
    current.extras=current.extras.filter(item=>item.componentGroup!==group);
    persistAndRefresh('가장 최근에 넣은 구성요소를 제거했습니다.');
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .component-block-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.component-block-grid button{border:1px solid #d7e0e9;border-radius:9px;background:#fff;color:#334155;padding:9px 5px;font-size:8px;font-weight:900;cursor:pointer}.component-block-grid button:hover{border-color:#79b9c8;background:#f0fdff}.component-block-grid .component-remove{grid-column:1/-1;background:#f8fafc;color:#64748b;padding:7px}.component-block-note{margin:7px 0 0;color:#7c8797;font-size:7px;line-height:1.45}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';card.style.order='-6';
    card.innerHTML=`<div class="side-label">빠른 구성</div><div class="component-block-grid"><button id="componentTitleBlock" type="button">제목 세트</button><button id="componentEventInfo" type="button">일정·장소·대상</button><button id="componentContact" type="button">문의·연락처</button><button id="componentFooter" type="button">하단 기관정보</button><button id="componentRemoveLatest" class="component-remove" type="button">최근 구성요소 제거</button></div><p class="component-block-note">자주 쓰는 항목을 한 번에 넣습니다. 삽입 뒤에는 일반 글씨처럼 바로 수정할 수 있습니다.</p>`;
    sidebar.insertBefore(card,inspector);
    byId('componentTitleBlock').addEventListener('click',insertTitleBlock);
    byId('componentEventInfo').addEventListener('click',insertEventInfo);
    byId('componentContact').addEventListener('click',insertContactBlock);
    byId('componentFooter').addEventListener('click',insertFooterBlock);
    byId('componentRemoveLatest').addEventListener('click',removeLatestBlock);
    return true;
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('inspector')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();
    window.DesignEditorComponentBlocks={insertTitleBlock,insertEventInfo,insertContactBlock,insertFooterBlock,removeLatestBlock,stage:'one-click-print-component-blocks'};
    return true;
  }
  function boot(){if(install())return;[180,420,850,1500,2600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
