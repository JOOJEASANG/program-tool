(function(){
  'use strict';
  if(window.__designEditorPrintSafetyV1)return;
  window.__designEditorPrintSafetyV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const CARD_ID='designPrintSafetyTools';
  const STYLE_ID='designPrintSafetyStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const MIN_TEXT_PT=8;
  const FOLD_BUFFER_MM=2.5;
  let installed=false;
  let refreshTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function approxTextHeight(item){
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length);
    const sizeMm=Math.max(1,Number(item?.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item?.lineHeight)||1.26));
  }

  function rectFor(item){
    if(item?.type==='text')return{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(0,Number(item.w)||0),h:approxTextHeight(item)};
    return{x:Number(item?.x)||0,y:Number(item?.y)||0,w:Math.max(0,Number(item?.w)||0),h:Math.max(0,Number(item?.h)||0)};
  }

  function crossesFoldX(rect,fold){
    return rect.x<fold+FOLD_BUFFER_MM&&rect.x+rect.w>fold-FOLD_BUFFER_MM;
  }

  function crossesFoldY(rect,fold){
    return rect.y<fold+FOLD_BUFFER_MM&&rect.y+rect.h>fold-FOLD_BUFFER_MM;
  }

  function inspectSurface(){
    const p=project(),current=surface();
    if(!p||!current)return{issues:[],count:0,fixableCount:0};
    const safe=clamp(Number(p.safe)||0,0,Math.min(Number(p.width)||0,Number(p.height)||0)/2);
    const width=Math.max(0,Number(p.width)||0),height=Math.max(0,Number(p.height)||0);
    const folds=(current.folds||[]).map(Number).filter(Number.isFinite);
    const foldsY=(current.foldsY||[]).map(Number).filter(Number.isFinite);
    const issues=[];

    (current.elements||[]).filter(item=>item?.visible!==false&&item?.type==='text').forEach(item=>{
      const rect=rectFor(item);
      const outside=rect.x<safe-.2||rect.y<safe-.2||rect.x+rect.w>width-safe+.2||rect.y+rect.h>height-safe+.2;
      if(outside)issues.push({id:item.id,type:'text',kind:'safe',label:'글씨가 안전여백 밖에 있습니다.',fixable:true});
      if((Number(item.size)||0)<MIN_TEXT_PT)issues.push({id:item.id,type:'text',kind:'small-text',label:`글씨가 ${MIN_TEXT_PT}pt보다 작습니다.`,fixable:true});
      if(folds.some(fold=>crossesFoldX(rect,fold)))issues.push({id:item.id,type:'text',kind:'fold',label:'글씨가 좌우 접지선 가까이에 있습니다.',fixable:false});
      if(foldsY.some(fold=>crossesFoldY(rect,fold)))issues.push({id:item.id,type:'text',kind:'fold-y',label:'글씨가 상하 접지선 가까이에 있습니다.',fixable:false});
    });

    (current.extras||[]).filter(item=>item?.visible!==false&&item?.type==='image').forEach(item=>{
      const rect=rectFor(item);
      const outside=rect.x<safe-.2||rect.y<safe-.2||rect.x+rect.w>width-safe+.2||rect.y+rect.h>height-safe+.2;
      if(outside)issues.push({id:item.id,type:'image',kind:'image-safe',label:'이미지가 안전여백 밖에 있습니다.',fixable:false});
      if(folds.some(fold=>crossesFoldX(rect,fold)))issues.push({id:item.id,type:'image',kind:'fold',label:'이미지가 좌우 접지선 가까이에 있습니다.',fixable:false});
      if(foldsY.some(fold=>crossesFoldY(rect,fold)))issues.push({id:item.id,type:'image',kind:'fold-y',label:'이미지가 상하 접지선 가까이에 있습니다.',fixable:false});
    });

    return{issues,count:issues.length,fixableCount:issues.filter(issue=>issue.fixable).length};
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .print-safety-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.print-safety-title{font-size:9px;font-weight:950;color:#334155}.print-safety-badge{border-radius:999px;padding:4px 7px;font-size:7px;font-weight:950;background:#ecfdf3;color:#067647}.print-safety-badge.warn{background:#fff7ed;color:#b54708}.print-safety-note{margin-top:5px;font-size:7px;line-height:1.5;color:#667085}.print-safety-list{display:grid;gap:5px;margin-top:7px}.print-safety-item{display:flex;align-items:flex-start;gap:6px;width:100%;border:0;border-radius:7px;background:#fff7ed;color:#9a3412;padding:6px 7px;text-align:left;font-size:7px;font-weight:800;line-height:1.4;cursor:pointer}.print-safety-item:hover{background:#ffedd5}.print-safety-dot{flex:0 0 auto;width:5px;height:5px;margin-top:3px;border-radius:50%;background:currentColor}.print-safety-more{font-size:7px;color:#98a2b3}.print-safety-fix{width:100%;margin-top:7px;border:1px solid #b8d7df;border-radius:8px;background:#f0fdff;color:#0f6070;padding:7px;font-size:8px;font-weight:950;cursor:pointer}.print-safety-fix:hover{background:#e6fbff}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),quality=byId('designPrintQualityTools'),output=byId('designOutputTools'),inspector=byId('inspector');
    if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML='<div class="side-label">인쇄 안전</div><div id="designPrintSafetyBody"></div>';
    const anchor=quality||output||inspector;
    if(anchor)sidebar.insertBefore(card,anchor);else sidebar.appendChild(card);
    return true;
  }

  function focusIssue(issue){
    if(!issue?.id)return;
    const selector=issue.type==='text'?`.design-object[data-id="${issue.id}"]`:`.phase2-extra-object[data-extra-id="${issue.id}"]`;
    const node=document.querySelector(selector);
    if(node){node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));node.scrollIntoView?.({block:'nearest',inline:'nearest'});}
  }

  function render(summary){
    const body=byId('designPrintSafetyBody');if(!body)return;
    if(!summary.count){
      body.innerHTML='<div class="print-safety-head"><div class="print-safety-title">현재 면 안전</div><span class="print-safety-badge">문제 없음</span></div><div class="print-safety-note">글자 크기 · 안전여백 · 좌우/상하 접지선 위치를 자동으로 확인했습니다.</div>';
      return;
    }
    const unique=[];const seen=new Set();
    summary.issues.forEach(issue=>{const key=`${issue.id}:${issue.kind}`;if(!seen.has(key)){seen.add(key);unique.push(issue);}});
    const shown=unique.slice(0,3);
    body.innerHTML=`<div class="print-safety-head"><div class="print-safety-title">인쇄 전 확인 필요</div><span class="print-safety-badge warn">${summary.count}건</span></div><div class="print-safety-note">문제를 누르면 해당 요소를 선택합니다. 배경용 이미지는 안전여백 경고를 무시해도 됩니다.</div><div class="print-safety-list">${shown.map((issue,index)=>`<button class="print-safety-item" type="button" data-print-safety-index="${index}"><span class="print-safety-dot"></span><span>${issue.label}</span></button>`).join('')}${unique.length>shown.length?`<div class="print-safety-more">외 ${unique.length-shown.length}건 더 있습니다.</div>`:''}</div>${summary.fixableCount?`<button id="designPrintSafetyFix" class="print-safety-fix" type="button">안전여백·작은 글씨 자동 정리 (${summary.fixableCount})</button>`:''}`;
    body.querySelectorAll('[data-print-safety-index]').forEach(button=>button.addEventListener('click',()=>focusIssue(shown[Number(button.dataset.printSafetyIndex)||0])));
    byId('designPrintSafetyFix')?.addEventListener('click',autoFix);
  }

  function persistAndRefresh(message){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return;}
    window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{window.DesignEditorPhase2?.sync?.();queueRefresh(40);const status=byId('editorStatus');if(status){status.className='editor-status ok';status.textContent=message;}},70);
  }

  function autoFix(){
    const p=project(),current=surface();if(!p||!current)return;
    const safe=clamp(Number(p.safe)||0,0,Math.min(Number(p.width)||0,Number(p.height)||0)/2);
    const maxW=Math.max(4,(Number(p.width)||0)-safe*2),maxH=Math.max(4,(Number(p.height)||0)-safe*2);
    let changed=0;
    (current.elements||[]).filter(item=>item?.visible!==false&&item?.type==='text').forEach(item=>{
      let itemChanged=false;
      if((Number(item.size)||0)<MIN_TEXT_PT){item.size=MIN_TEXT_PT;itemChanged=true;}
      item.w=Math.min(Math.max(4,Number(item.w)||4),maxW);
      const h=Math.min(approxTextHeight(item),maxH);
      const nextX=clamp(Number(item.x)||0,safe,Math.max(safe,(Number(p.width)||0)-safe-item.w));
      const nextY=clamp(Number(item.y)||0,safe,Math.max(safe,(Number(p.height)||0)-safe-h));
      if(Math.abs(nextX-(Number(item.x)||0))>.05){item.x=nextX;itemChanged=true;}
      if(Math.abs(nextY-(Number(item.y)||0))>.05){item.y=nextY;itemChanged=true;}
      if(itemChanged)changed+=1;
    });
    if(!changed){const status=byId('editorStatus');if(status){status.className='editor-status info';status.textContent='자동으로 정리할 글씨 문제가 없습니다.';}return;}
    persistAndRefresh(`${changed}개 글씨를 안전한 위치와 최소 ${MIN_TEXT_PT}pt 기준으로 정리했습니다.`);
  }

  function refresh(){
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    installCard();
    const summary=inspectSurface();render(summary);
    window.DesignEditorPrintSafety.lastSummary=summary;
  }

  function queueRefresh(delay=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>requestAnimationFrame(refresh),delay);}

  function bindEvents(){
    ['click','change','pointerup'].forEach(name=>document.addEventListener(name,()=>queueRefresh(),false));
    document.addEventListener('input',()=>queueRefresh(120),false);
    window.addEventListener('resize',()=>queueRefresh(160),{passive:true});
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();bindEvents();
    window.DesignEditorPrintSafety={inspectSurface,refresh,autoFix,stage:'automatic-print-safety-xy-folds-and-lightweight-autofix',lastSummary:null};
    [120,320,700,1300,2200].forEach(delay=>setTimeout(()=>queueRefresh(),delay));
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();