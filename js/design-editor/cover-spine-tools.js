(function(){
  'use strict';
  if(window.__designEditorCoverSpineToolsV1)return;
  window.__designEditorCoverSpineToolsV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const CARD_ID='designCoverSpineTools';
  const STYLE_ID='designCoverSpineToolsStyles';
  const DIRECTIONS=['bottomToTop','vertical','topToBottom'];
  const DIRECTION_ROTATION={bottomToTop:-90,vertical:0,topToBottom:90};
  const ZONES={top:18,center:50,bottom:82};
  const MM_PER_PT=25.4/72;
  let installed=false;
  let syncFrame=0;
  let outputGuardInstalled=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>project()?.surfaces?.find(item=>item.id===project()?.activeSurface)||project()?.surfaces?.[0]||null;
  const isCover=()=>project()?.designMode==='cover'&&project()?.cover;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }
  function normalizeDirection(value){return DIRECTIONS.includes(value)?value:'bottomToTop';}
  function spineEntries(){return (surface()?.elements||[]).filter(item=>item?.type==='text'&&item.coverRole==='spine-title');}
  function selectedSpineEntry(){
    const id=document.querySelector('.design-text.selected')?.dataset?.id;
    return id?spineEntries().find(item=>item.id===id)||null:null;
  }
  function weightedCharacters(text){
    let units=0;
    for(const ch of String(text||'').replace(/\s+/g,' ').trim()){
      if(/\s/.test(ch))units+=.42;else if(/[\u0000-\u00ff]/.test(ch))units+=.62;else units+=1;
    }
    return units;
  }
  function centerX(){const p=project();return Number(p?.cover?.trimWidth||210)+Number(p?.cover?.spine||0)/2;}
  function zonePercent(entry){return Number(entry?.spineYPercent??ZONES[entry?.spineZone]??50);}
  function fontHeightMm(entry){return Math.max(5,Number(entry?.size)||10)*MM_PER_PT*1.3;}
  function estimateLengthMm(entry){
    const size=Math.max(5,Number(entry?.size)||10);
    const perUnit=size*MM_PER_PT*(normalizeDirection(entry?.spineDirection)==='vertical'?1.08:.86);
    return Math.max(1,weightedCharacters(entry?.text)*perUnit);
  }
  function verticalColumnWidth(entry,spine){
    const oneCharacter=Math.max(2.4,Math.max(5,Number(entry?.size)||10)*MM_PER_PT*.9);
    return Math.max(.8,Math.min(Math.max(.8,spine*.72),oneCharacter));
  }

  function placeEntry(entry){
    const p=project();if(!p?.cover||!entry)return entry;
    const spine=Math.max(0,Number(p.cover.spine)||0),trimH=Math.max(1,Number(p.cover.trimHeight)||Number(p.height)||297),direction=normalizeDirection(entry.spineDirection);
    entry.spineDirection=direction;
    entry.rotation=DIRECTION_ROTATION[direction];
    entry.icon='none';entry.align='center';entry.coverRole='spine-title';entry.spineZone=entry.spineZone||'center';entry.spineYPercent=clamp(zonePercent(entry),3,97);
    if(direction==='vertical'){
      entry.w=verticalColumnWidth(entry,spine);
      entry.lineHeight=1.05;
      entry.x=centerX()-entry.w/2;
      const length=estimateLengthMm(entry);
      entry.y=clamp(trimH*entry.spineYPercent/100-length/2,0,Math.max(0,trimH-length));
    }else{
      entry.w=Math.max(36,Math.min(trimH*.42,126));
      entry.lineHeight=1.18;
      entry.x=centerX()-entry.w/2;
      const height=fontHeightMm(entry);
      entry.y=clamp(trimH*entry.spineYPercent/100-height/2,0,Math.max(0,trimH-height));
    }
    return entry;
  }
  function placeAll(){const entries=spineEntries();entries.forEach(placeEntry);return entries;}

  function persist(source='cover-spine-tools'){
    const p=project();if(!p)return;
    try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }
  function rerender(){
    window.dispatchEvent(new Event('resize'));
    requestAnimationFrame(()=>{window.DesignEditorRotation?.sync?.();syncDom();syncPanel();});
  }

  function addSpineTitle(zone='center'){
    if(!isCover())return null;
    const before=(surface()?.elements||[]).length;
    byId('addTitleBtn')?.click();
    const entries=surface()?.elements||[];
    const entry=entries.length>before?entries[entries.length-1]:null;
    if(!entry)return null;
    entry.text=zone==='top'?'상단 책등 글자':zone==='bottom'?'하단 책등 글자':'책등 제목';
    entry.role='title';entry.coverRole='spine-title';entry.spineZone=zone;entry.spineYPercent=ZONES[zone]??50;entry.spineDirection=normalizeDirection(project()?.cover?.spineDirection||'bottomToTop');entry.size=Math.min(11,Math.max(7,Number(entry.size)||11));entry.weight=700;entry.color='#172033';
    placeEntry(entry);persist('cover-spine-add');rerender();return entry;
  }
  function setDirection(direction){
    const entry=selectedSpineEntry();
    if(!entry){setStatus('방향을 바꿀 책등 글자를 먼저 선택하세요.','info');return false;}
    entry.spineDirection=normalizeDirection(direction);project().cover.spineDirection=entry.spineDirection;placeEntry(entry);persist('cover-spine-direction');rerender();return true;
  }
  function captureDraggedPosition(){
    const entry=selectedSpineEntry(),p=project();if(!entry||!p?.cover)return false;
    const trimH=Math.max(1,Number(p.cover.trimHeight)||297);
    const logicalHeight=normalizeDirection(entry.spineDirection)==='vertical'?estimateLengthMm(entry):fontHeightMm(entry);
    const center=clamp((Number(entry.y)||0)+logicalHeight/2,0,trimH);
    entry.spineYPercent=clamp(center/trimH*100,3,97);
    placeEntry(entry);persist('cover-spine-position');rerender();return true;
  }

  function evaluateEntry(entry){
    const p=project(),spine=Math.max(0,Number(p?.cover?.spine)||0),trimH=Math.max(1,Number(p?.cover?.trimHeight)||297),text=String(entry?.text||'').trim(),size=Math.max(5,Number(entry?.size)||10),fontHeight=size*MM_PER_PT,ratio=spine>0?fontHeight/spine:Infinity,natural=estimateLengthMm(entry),maxLength=trimH*.28,compression=natural>0?Math.min(1,maxLength/natural):1;
    let level='ok',label='적합',message=`${size.toFixed(1)}pt · 책등 폭의 ${Math.round(ratio*100)}%`;
    if(!text){level='empty';label='빈 글자';message='내용이 없는 책등 글자입니다.';}
    else if(spine<2.2){level='error';label='출력 안 됨';message=`${spine.toFixed(1)}mm 책등은 글자 없이 출력하는 것이 안전합니다.`;}
    else if(ratio>.9){level='error';label='폭 초과';message=`${size.toFixed(1)}pt 글자가 ${spine.toFixed(1)}mm 책등 폭을 넘을 수 있습니다.`;}
    else if(compression<.65){level='error';label='문구 너무 김';message='책등 문구가 심하게 압축될 수 있습니다.';}
    else if(ratio>.72){level='warn';label='여백 부족';message=`글자 높이가 책등 폭의 ${Math.round(ratio*100)}%입니다.`;}
    else if(compression<.85){level='warn';label='문구 김';message='책등 문구가 약간 압축될 수 있습니다.';}
    else if(size<6){level='warn';label='작은 글자';message='인쇄 후 읽기 어려울 수 있습니다.';}
    const safePt=spine>0?Math.floor((spine*.72/MM_PER_PT)*2)/2:null;
    return{entry,spine,trimH,size,ratio,natural,maxLength,printedLength:Math.min(natural,maxLength),compression,level,label,message,recommendedSize:safePt&&safePt<size?Math.max(5,safePt):null};
  }
  function overlapWarnings(items){
    const active=items.filter(item=>item.entry?.text&&item.level!=='empty');const overlaps=[];
    for(let i=0;i<active.length;i++){
      const left=active[i],leftCenter=left.trimH*zonePercent(left.entry)/100,leftStart=leftCenter-left.printedLength/2,leftEnd=leftCenter+left.printedLength/2;
      for(let j=i+1;j<active.length;j++){
        const right=active[j],rightCenter=right.trimH*zonePercent(right.entry)/100,rightStart=rightCenter-right.printedLength/2,rightEnd=rightCenter+right.printedLength/2;
        const overlap=Math.min(leftEnd,rightEnd)-Math.max(leftStart,rightStart);if(overlap>2)overlaps.push({left:left.entry.id,right:right.entry.id,overlap});
      }
    }
    return overlaps;
  }
  function evaluateAll(){
    const items=spineEntries().map(evaluateEntry),overlaps=overlapWarnings(items),errors=items.filter(x=>x.level==='error').length,warnings=items.filter(x=>x.level==='warn').length+overlaps.length;
    let level='ok',label='적합',message=`책등 글자 ${items.length}개가 현재 책등 폭에 맞습니다.`;
    if(!items.length){level='empty';label='문구 없음';message='책등 글자를 추가하면 방향과 인쇄 안전을 함께 검사합니다.';}
    else if(errors){level='error';label=`오류 ${errors}개`;message=items.find(x=>x.level==='error')?.message||'책등 글자를 확인하세요.';}
    else if(warnings){level='warn';label=`주의 ${warnings}개`;message=overlaps.length?`책등 글자 ${overlaps.length}쌍이 서로 겹칠 수 있습니다.`:(items.find(x=>x.level==='warn')?.message||'책등 글자를 확인하세요.');}
    return{items,overlaps,errors,warnings,level,label,message};
  }
  function applyRecommendedSize(){
    let changed=0;
    evaluateAll().items.forEach(result=>{if(result.recommendedSize){result.entry.size=result.recommendedSize;placeEntry(result.entry);changed++;}});
    if(changed){persist('cover-spine-fit');rerender();}return changed;
  }

  function syncDom(){
    if(!isCover())return;
    const current=surface();if(!current)return;
    document.querySelectorAll('.design-text[data-id]').forEach(node=>{
      const entry=current.elements?.find(item=>item.id===node.dataset.id);if(entry?.coverRole!=='spine-title')return;
      node.classList.add('cover-spine-title-object');node.dataset.spineDirection=normalizeDirection(entry.spineDirection);node.dataset.spineZone=entry.spineZone||'center';
      const text=node.querySelector('.editable-text');if(!text)return;
      if(entry.spineDirection==='vertical'){
        text.style.writingMode='vertical-rl';text.style.textOrientation='upright';text.style.whiteSpace='nowrap';
      }else{
        text.style.writingMode='horizontal-tb';text.style.textOrientation='mixed';text.style.whiteSpace='normal';
      }
    });
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .cover-spine-tools{border-color:#c6d9e5!important;background:#fbfdff!important}.cover-spine-add-grid,.cover-spine-direction-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.cover-spine-add-grid button,.cover-spine-direction-grid button{border:1px solid #d5e0e8;border-radius:7px;background:#fff;color:#475569;padding:7px 3px;font-size:7.5px;font-weight:900;cursor:pointer}.cover-spine-direction-grid button.on{border-color:#1d9bb2;background:#ecfeff;color:#0e7490}.cover-spine-section-title{margin:8px 0 5px;font-size:7px;font-weight:950;color:#64748b}.cover-spine-safety{margin-top:8px;padding:7px;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0}.cover-spine-safety-head{display:flex;gap:6px;align-items:center}.cover-spine-safety-head strong{font-size:8px;color:#475569}.cover-spine-safety-badge{margin-left:auto;border-radius:999px;padding:3px 6px;font-size:7px;font-weight:950}.cover-spine-safety[data-level="ok"] .cover-spine-safety-badge{background:#dcfce7;color:#166534}.cover-spine-safety[data-level="warn"] .cover-spine-safety-badge{background:#fef3c7;color:#92400e}.cover-spine-safety[data-level="error"] .cover-spine-safety-badge{background:#fee2e2;color:#b91c1c}.cover-spine-safety[data-level="empty"] .cover-spine-safety-badge{background:#e2e8f0;color:#64748b}.cover-spine-safety-detail{margin-top:4px;color:#64748b;font-size:7px;line-height:1.45}.cover-spine-fit{width:100%;margin-top:6px;border:1px solid #8ed1dc;border-radius:7px;background:#ecfeff;color:#0e7490;padding:6px;font-size:7.5px;font-weight:900;cursor:pointer}.cover-spine-title-object{z-index:28!important}
    `;document.head.appendChild(style);
  }
  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),settings=byId('designCoverSettings'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card cover-spine-tools';
    card.innerHTML=`<div class="side-label">책등 글자</div><div class="cover-spine-add-grid"><button type="button" data-spine-add="top">위쪽 추가</button><button type="button" data-spine-add="center">가운데 추가</button><button type="button" data-spine-add="bottom">아래쪽 추가</button></div><div class="cover-spine-section-title">선택한 책등 글자 방향</div><div class="cover-spine-direction-grid"><button type="button" data-spine-direction="bottomToTop">아래→위</button><button type="button" data-spine-direction="vertical">세로쓰기</button><button type="button" data-spine-direction="topToBottom">위→아래</button></div><div id="designCoverSpineSafety" class="cover-spine-safety" data-level="empty"><div class="cover-spine-safety-head"><strong>인쇄 안전</strong><span class="cover-spine-safety-badge">문구 없음</span></div><div class="cover-spine-safety-detail">책등 글자를 추가하면 자동 검사합니다.</div><button id="designCoverSpineFit" class="cover-spine-fit" type="button">권장 크기로 맞춤</button></div>`;
    if(settings?.nextSibling)sidebar.insertBefore(card,settings.nextSibling);else sidebar.insertBefore(card,inspector);
    card.querySelectorAll('[data-spine-add]').forEach(button=>button.addEventListener('click',()=>addSpineTitle(button.dataset.spineAdd)));
    card.querySelectorAll('[data-spine-direction]').forEach(button=>button.addEventListener('click',()=>setDirection(button.dataset.spineDirection)));
    byId('designCoverSpineFit')?.addEventListener('click',()=>applyRecommendedSize());
    return true;
  }
  function syncPanel(){
    if(!isCover())return;
    installCard();const selected=selectedSpineEntry(),direction=normalizeDirection(selected?.spineDirection||project()?.cover?.spineDirection);
    byId(CARD_ID)?.querySelectorAll('[data-spine-direction]').forEach(button=>button.classList.toggle('on',Boolean(selected)&&button.dataset.spineDirection===direction));
    const evaluation=evaluateAll(),panel=byId('designCoverSpineSafety');if(panel){panel.dataset.level=evaluation.level;const badge=panel.querySelector('.cover-spine-safety-badge'),detail=panel.querySelector('.cover-spine-safety-detail');if(badge)badge.textContent=evaluation.label;if(detail)detail.textContent=evaluation.message;const fit=byId('designCoverSpineFit');if(fit)fit.disabled=!evaluation.items.some(item=>item.recommendedSize);}
  }
  function queueSync(){if(syncFrame)return;syncFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{syncFrame=0;syncDom();syncPanel();installOutputGuard();}));}
  function onGeometryChange(){if(!isCover())return;placeAll();persist('cover-spine-geometry');rerender();}
  function installOutputGuard(){
    if(outputGuardInstalled)return true;
    const gate=window.DesignEditorFinalPrintCheck;
    if(!gate||typeof gate.confirmBeforeOutput!=='function')return false;
    if(gate.confirmBeforeOutput.__coverSpineSafetyGuard){outputGuardInstalled=true;return true;}
    const original=gate.confirmBeforeOutput.bind(gate);
    const wrapped=async options=>{
      const evaluation=evaluateAll();syncPanel();
      window.DesignEditorCoverSpineTools.lastEvaluation=evaluation;
      if(evaluation.errors){setStatus(`책등 글자 인쇄 오류: ${evaluation.message}`,'err');return false;}
      return original(options);
    };
    wrapped.__coverSpineSafetyGuard=true;wrapped.__delegate=original;gate.confirmBeforeOutput=wrapped;outputGuardInstalled=true;return true;
  }
  function bindEvents(){
    ['click','dblclick','input','change'].forEach(name=>document.addEventListener(name,queueSync,false));
    document.addEventListener('pointerup',()=>{if(selectedSpineEntry())captureDraggedPosition();else queueSync();},false);
    window.addEventListener('programstudio:cover-geometry-change',onGeometryChange);
    window.addEventListener('resize',queueSync,{passive:true});
  }
  function install(){
    if(installed)return true;if(!isCover()||!document.querySelector('.sidebar')||!window.DesignEditorRotation)return false;
    installed=true;installStyles();installCard();placeAll();bindEvents();syncDom();syncPanel();installOutputGuard();
    window.DesignEditorCoverSpineTools={addSpineTitle,setDirection,placeEntry,placeAll,captureDraggedPosition,evaluateEntry,evaluateAll,overlapWarnings,applyRecommendedSize,normalizeDirection,installOutputGuard,directions:[...DIRECTIONS],lastEvaluation:null,stage:'unified-cover-spine-writing-and-print-safety'};
    return true;
  }
  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(()=>{install();installOutputGuard();},delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
