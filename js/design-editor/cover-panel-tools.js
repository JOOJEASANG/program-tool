(function(){
  'use strict';
  if(window.__designEditorCoverPanelToolsV1)return;
  window.__designEditorCoverPanelToolsV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const CARD_ID='designCoverPanelTools';
  const STYLE_ID='designCoverPanelToolsStyles';
  const PANELS=['back','front'];
  const PANEL_LABEL={back:'뒤표지',front:'앞표지'};
  const ZONES=['top','center','bottom'];
  const ZONE_LABEL={top:'상단',center:'중앙',bottom:'하단'};
  let installed=false;
  let syncFrame=0;

  const byId=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>project()?.surfaces?.find(item=>item.id===project()?.activeSurface)||project()?.surfaces?.[0]||null;
  const isCover=()=>project()?.designMode==='cover'&&project()?.cover;

  function geometry(){
    const p=project();if(!p?.cover)return null;
    const trimW=Number(p.cover.trimWidth)||210,trimH=Number(p.cover.trimHeight)||297,spine=Number(p.cover.spine)||0,safe=Math.max(3,Number(p.safe)||10);
    return{trimW,trimH,spine,safe,back:{x:0,w:trimW},spinePanel:{x:trimW,w:spine},front:{x:trimW+spine,w:trimW}};
  }
  function selected(){
    const s=surface();if(!s)return null;
    const textId=document.querySelector('.design-text.selected')?.dataset?.id;
    if(textId){const item=s.elements?.find(entry=>entry.id===textId);if(item)return{kind:'text',item};}
    const extraId=document.querySelector('.phase2-extra-object.selected')?.dataset?.extraId;
    if(extraId){const item=s.extras?.find(entry=>entry.id===extraId);if(item)return{kind:'extra',item};}
    return null;
  }
  function allObjects(){
    const s=surface();if(!s)return[];
    return[...(s.elements||[]).map(item=>({kind:'text',item})),...(s.extras||[]).map(item=>({kind:'extra',item}))].filter(entry=>entry.item?.coverRole!=='spine-title');
  }
  function persist(source='cover-panel-tools'){
    const p=project();if(!p)return;
    try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }
  function rerender(){window.dispatchEvent(new Event('resize'));requestAnimationFrame(queueSync);}

  function placement(panel,zone,item){
    const g=geometry();if(!g||!PANELS.includes(panel)||!ZONES.includes(zone))return null;
    const box=g[panel],innerX=box.x+g.safe,innerW=Math.max(8,box.w-g.safe*2),innerH=Math.max(8,g.trimH-g.safe*2);
    const currentW=Math.max(8,Math.min(innerW,Number(item?.w)||innerW*.72));
    const isTitle=item?.role==='title';
    const w=isTitle?Math.min(innerW,Math.max(currentW,innerW*.72)):currentW;
    const x=box.x+(box.w-w)/2;
    const estimatedH=Math.max(7,Number(item?.h)||((Number(item?.size)||14)*25.4/72*(Number(item?.lineHeight)||1.25)*2));
    let centerY=g.safe+innerH*.5;
    if(zone==='top')centerY=g.safe+Math.max(estimatedH/2,innerH*.13);
    if(zone==='bottom')centerY=g.trimH-g.safe-Math.max(estimatedH/2,innerH*.13);
    return{x,y:clamp(centerY-estimatedH/2,g.safe,Math.max(g.safe,g.trimH-g.safe-estimatedH)),w,panel,zone};
  }
  function assign(item,panel,zone){
    const next=placement(panel,zone,item);if(!next)return false;
    item.x=next.x;item.y=next.y;item.w=next.w;item.coverPanel=panel;item.coverZone=zone;
    persist('cover-panel-place');rerender();return true;
  }
  function assignSelected(panel,zone){const current=selected();if(!current)return false;return assign(current.item,panel,zone);}

  function addCommon(buttonId,panel,zone,label){
    const s=surface();if(!s)return null;
    const beforeText=(s.elements||[]).length,beforeExtra=(s.extras||[]).length;
    byId(buttonId)?.click();
    let item=null;
    if((s.elements||[]).length>beforeText)item=s.elements[s.elements.length-1];
    else if((s.extras||[]).length>beforeExtra)item=s.extras[s.extras.length-1];
    if(!item)return null;
    if(label&&item.type==='text')item.text=label;
    assign(item,panel,zone);return item;
  }
  function addPreset(kind){
    if(kind==='frontTitle')return addCommon('addTitleBtn','front','top','앞표지 제목');
    if(kind==='frontSubtitle')return addCommon('addSubtitleBtn','front','center','앞표지 부제');
    if(kind==='backBody')return addCommon('addBodyBtn','back','center','뒤표지 설명을 입력하세요.');
    if(kind==='backInfo')return addCommon('addInfoBtn','back','bottom','기관명 · 연락처 · 홈페이지');
    return null;
  }

  function objectBox(entry){
    const item=entry.item,x=Number(item.x)||0,y=Number(item.y)||0,w=Math.max(.1,Number(item.w)||10);
    const h=Math.max(4,Number(item.h)||((Number(item.size)||12)*25.4/72*(Number(item.lineHeight)||1.25)*2));
    return{x,y,w,h,right:x+w,bottom:y+h};
  }
  function inferredPanel(box,g){
    const center=box.x+box.w/2;
    if(center<g.trimW)return'back';
    if(center>g.trimW+g.spine)return'front';
    return'spine';
  }
  function evaluateEntry(entry){
    const g=geometry(),box=objectBox(entry);if(!g)return null;
    const panel=entry.item.coverPanel||inferredPanel(box,g),issues=[];
    const folds=[g.trimW,g.trimW+g.spine];
    folds.forEach(boundary=>{if(box.x<boundary&&box.right>boundary)issues.push({level:'error',code:'fold-cross',message:'요소가 책등 경계선을 가로지릅니다.'});});
    if(panel==='back'||panel==='front'){
      const panelBox=g[panel],safeLeft=panelBox.x+g.safe,safeRight=panelBox.x+panelBox.w-g.safe,safeTop=g.safe,safeBottom=g.trimH-g.safe;
      if(box.x<safeLeft||box.right>safeRight||box.y<safeTop||box.bottom>safeBottom)issues.push({level:'warn',code:'safe-margin',message:`${PANEL_LABEL[panel]} 안전여백 밖으로 나간 요소가 있습니다.`});
    }else if(panel==='spine'&&entry.item.coverRole!=='spine-title'){
      issues.push({level:'warn',code:'spine-unassigned',message:'일반 요소가 책등 영역에 놓여 있습니다. 책등 글자 도구를 사용하세요.'});
    }
    return{entry,panel,box,issues};
  }
  function evaluateAll(){
    const items=allObjects().map(evaluateEntry).filter(Boolean),issues=items.flatMap(result=>result.issues.map(issue=>({...issue,id:result.entry.item.id,panel:result.panel})));
    const errors=issues.filter(issue=>issue.level==='error').length,warnings=issues.filter(issue=>issue.level==='warn').length;
    return{items,issues,errors,warnings,ok:errors===0&&warnings===0};
  }
  function fitAssigned(){
    let changed=0;
    allObjects().forEach(entry=>{const panel=entry.item.coverPanel,zone=entry.item.coverZone;if(PANELS.includes(panel)&&ZONES.includes(zone)&&assign(entry.item,panel,zone))changed++;});
    if(changed){persist('cover-panel-fit-all');rerender();}return changed;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .cover-panel-tools{border-color:#d8e5dc!important;background:#fcfffd!important}.cover-panel-preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.cover-panel-preset-grid button,.cover-panel-place-grid button{border:1px solid #d6e2da;border-radius:7px;background:#fff;color:#3f5d4b;padding:7px 4px;font-size:7.5px;font-weight:900;cursor:pointer}.cover-panel-place-title{margin:8px 0 5px;color:#64748b;font-size:7px;font-weight:950}.cover-panel-place-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.cover-panel-status{margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:7px;font-size:7px;line-height:1.5;color:#64748b}.cover-panel-status[data-level="ok"]{background:#f0fdf4;color:#166534;border-color:#bbf7d0}.cover-panel-status[data-level="warn"]{background:#fffbeb;color:#92400e;border-color:#fde68a}.cover-panel-status[data-level="error"]{background:#fff1f2;color:#b91c1c;border-color:#fecdd3}.cover-panel-fit{width:100%;margin-top:6px;border:1px solid #b8d9c5;border-radius:7px;background:#f0fdf4;color:#166534;padding:6px;font-size:7.5px;font-weight:900;cursor:pointer}
    `;document.head.appendChild(style);
  }
  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),spine=byId('designCoverSpineTools'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card cover-panel-tools';
    card.innerHTML=`<div class="side-label">표지 빠른 배치</div><div class="cover-panel-preset-grid"><button type="button" data-cover-preset="frontTitle">앞표지 제목</button><button type="button" data-cover-preset="frontSubtitle">앞표지 부제</button><button type="button" data-cover-preset="backBody">뒤표지 설명</button><button type="button" data-cover-preset="backInfo">뒤표지 기관정보</button></div><div class="cover-panel-place-title">선택 요소를 안전영역으로 이동</div><div class="cover-panel-place-grid"><button type="button" data-cover-place="back:top">뒤 위</button><button type="button" data-cover-place="back:center">뒤 중앙</button><button type="button" data-cover-place="back:bottom">뒤 아래</button><button type="button" data-cover-place="front:top">앞 위</button><button type="button" data-cover-place="front:center">앞 중앙</button><button type="button" data-cover-place="front:bottom">앞 아래</button></div><div id="designCoverPanelSafety" class="cover-panel-status" data-level="ok">표지 영역을 확인하는 중입니다.</div><button id="designCoverPanelFit" class="cover-panel-fit" type="button">지정 영역 다시 맞춤</button>`;
    if(spine?.nextSibling)sidebar.insertBefore(card,spine.nextSibling);else sidebar.insertBefore(card,inspector);
    card.querySelectorAll('[data-cover-preset]').forEach(button=>button.addEventListener('click',()=>addPreset(button.dataset.coverPreset)));
    card.querySelectorAll('[data-cover-place]').forEach(button=>button.addEventListener('click',()=>{const [panel,zone]=button.dataset.coverPlace.split(':');assignSelected(panel,zone);}));
    byId('designCoverPanelFit')?.addEventListener('click',fitAssigned);
    return true;
  }
  function syncPanel(){
    if(!isCover())return;
    installCard();const report=evaluateAll(),node=byId('designCoverPanelSafety');if(!node)return;
    const level=report.errors?'error':report.warnings?'warn':'ok';node.dataset.level=level;
    node.textContent=report.errors?`접힘선 침범 ${report.errors}건 · 출력 전 위치를 조정하세요.`:report.warnings?`안전여백 주의 ${report.warnings}건 · 필요하면 지정 영역 다시 맞춤을 사용하세요.`:'앞·뒤표지 요소가 현재 안전영역 안에 있습니다.';
  }
  function queueSync(){if(syncFrame)return;syncFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{syncFrame=0;syncPanel();}));}
  function onGeometryChange(){fitAssigned();queueSync();}
  function install(){
    if(installed)return true;if(!isCover()||!window.DesignEditorCoverSpineTools||!document.querySelector('.sidebar'))return false;
    installed=true;installStyles();installCard();
    ['click','input','change','pointerup'].forEach(name=>document.addEventListener(name,queueSync,false));
    window.addEventListener('programstudio:cover-geometry-change',onGeometryChange);window.addEventListener('resize',queueSync,{passive:true});
    syncPanel();
    window.DesignEditorCoverPanelTools={addPreset,assignSelected,assign,placement,evaluateEntry,evaluateAll,fitAssigned,panels:[...PANELS],zones:[...ZONES],stage:'cover-panel-aware-common-element-placement'};
    return true;
  }
  function boot(){if(install())return;[180,420,800,1400,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
