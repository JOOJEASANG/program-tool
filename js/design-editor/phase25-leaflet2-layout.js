(function(){
  'use strict';
  if(window.__designEditorLeaflet2LayoutV1)return;
  window.__designEditorLeaflet2LayoutV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!isGeneral)return;

  const PREF_KEY='programTool.designEditor.leaflet2Layout.v1';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const STYLE_ID='designLeaflet2LayoutStyles';
  const FIELD_ID='designLeaflet2LayoutField';
  const SELECT_ID='designLeaflet2Layout';
  const SAFETY_ID='designLeaflet2LayoutSafety';
  const LAYOUTS=new Set(['left-right','top-bottom']);
  const FOLD_BUFFER_MM=2.5;
  let preferredLayout='left-right';
  let artboardObserver=null;
  let cardObserver=null;
  let refreshTimer=0;
  let rewriting=false;
  let finalGatePatched=false;
  let installed=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const cleanLayout=value=>LAYOUTS.has(String(value||''))?String(value):'';
  const roundMm=value=>Math.round((Number(value)||0)*10)/10;

  function isLeaflet2(p=project()){
    return Boolean(p&&!p.printProductMode&&(p.designMode==='leaflet2'||p.presetId==='leaflet-2'));
  }
  function activeSurface(p=project()){
    if(!p)return null;
    return p.surfaces?.find(surface=>surface.id===p.activeSurface)||p.surfaces?.[0]||null;
  }
  function projectLayout(p=project()){
    const direct=cleanLayout(p?.leaflet2Layout);if(direct)return direct;
    const surfaces=Array.isArray(p?.surfaces)?p.surfaces:[];
    if(surfaces.some(surface=>surface?.foldAxis==='y'||(surface?.foldsY||[]).length))return'top-bottom';
    if(surfaces.some(surface=>surface?.foldAxis==='x'))return'left-right';
    return'';
  }
  function readPreference(){
    const query=cleanLayout(new URLSearchParams(location.search).get('leaflet2Layout'));if(query)return query;
    try{return cleanLayout(localStorage.getItem(PREF_KEY))||'left-right';}catch(_){return'left-right';}
  }
  function savePreference(layout){
    preferredLayout=cleanLayout(layout)||'left-right';
    try{localStorage.setItem(PREF_KEY,preferredLayout);}catch(_){}
    return preferredLayout;
  }
  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }
  function updateHistory(layout){
    if(!isLeaflet2())return;
    try{
      const url=new URL(location.href);url.searchParams.set('leaflet2Layout',layout);history.replaceState(history.state,'',url.pathname+'?'+url.searchParams.toString()+url.hash);
    }catch(_){}
  }
  function persistProject(source='leaflet2-layout'){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
  }
  function panelLabels(surface,layout){
    if(layout==='top-bottom')return surface.id==='outside'?['상단 외부','하단 외부']:['내용 위','내용 아래'];
    return surface.id==='outside'?['뒷표지','앞표지']:['내용 왼쪽','내용 오른쪽'];
  }
  function applyGeometry(layout,options={}){
    const p=project();if(!isLeaflet2(p))return false;
    layout=cleanLayout(layout)||'left-right';
    p.leaflet2Layout=layout;
    p.foldType=layout==='top-bottom'?'leaflet-2-top-bottom':'leaflet-2-left-right';
    (p.surfaces||[]).forEach(surface=>{
      surface.panels=panelLabels(surface,layout);
      if(layout==='top-bottom'){
        surface.foldAxis='y';
        surface.folds=[];
        surface.foldsY=[roundMm((Number(p.height)||0)/2)];
      }else{
        surface.foldAxis='x';
        surface.folds=[roundMm((Number(p.width)||0)/2)];
        delete surface.foldsY;
      }
    });
    preferredLayout=layout;
    if(options.preference!==false)savePreference(layout);
    if(options.history!==false)updateHistory(layout);
    if(options.persist)persistProject(options.source||'leaflet2-layout');
    if(options.render!==false){window.dispatchEvent(new Event('resize'));window.DesignEditorPhase2?.sync?.();}
    syncLayoutField();queueRefresh(20);
    return true;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-leaflet2-layout-note{margin-top:4px;font-size:6.5px;line-height:1.4;color:#7c8797}
      .design-leaflet2-layout-safety{margin-top:5px;padding:5px 6px;border-radius:6px;background:#ecfdf3;color:#067647;font-size:6.5px;font-weight:850;line-height:1.4}
      .design-leaflet2-layout-safety.warn{background:#fff7ed;color:#b54708}
      .leaflet2-horizontal-fold-guide{border-left:0!important;border-top:1px dashed #e59b23!important}
      .leaflet2-horizontal-panel-label{transform:translate(-50%,-50%)!important}
    `;document.head.appendChild(style);
  }
  function layoutFieldMarkup(layout){
    return `<label for="${SELECT_ID}">2단 면 배치</label><select id="${SELECT_ID}"><option value="left-right"${layout==='left-right'?' selected':''}>좌우 2면 · 세로 접지선</option><option value="top-bottom"${layout==='top-bottom'?' selected':''}>상하 2면 · 가로 접지선</option></select><div class="design-leaflet2-layout-note">좌우는 가로폭의 1/2, 상하는 세로높이의 1/2에 접지선을 표시합니다.</div><div id="${SAFETY_ID}" class="design-leaflet2-layout-safety">접지선 안전 확인 준비됨</div>`;
  }
  function syncLayoutField(){
    const card=byId('designEmbeddedModeCard'),options=card?.querySelector('.design-mode-options');
    if(!card||!options)return false;
    if(!isLeaflet2()){
      byId(FIELD_ID)?.remove();
      return false;
    }
    const explicit=projectLayout();if(explicit)preferredLayout=explicit;
    let field=byId(FIELD_ID);
    if(!field){
      field=document.createElement('div');field.id=FIELD_ID;field.className='design-mode-field';field.innerHTML=layoutFieldMarkup(preferredLayout);
      const apply=options.querySelector('.design-mode-apply');if(apply)options.insertBefore(field,apply);else options.appendChild(field);
      byId(SELECT_ID)?.addEventListener('change',event=>{
        const layout=cleanLayout(event.target.value)||'left-right';
        applyGeometry(layout,{persist:true,source:'leaflet2-layout-select'});
        setStatus(layout==='top-bottom'?'2단 리플렛을 상하 2면 · 가로 접지선으로 변경했습니다.':'2단 리플렛을 좌우 2면 · 세로 접지선으로 변경했습니다.','ok');
      });
    }else{
      const select=byId(SELECT_ID);if(select&&select.value!==preferredLayout)select.value=preferredLayout;
    }
    refreshSafetyNote();return true;
  }

  function artboardScale(p){
    const artboard=byId('artboard');if(!artboard||!p)return 1;
    const total=Math.max(.1,(Number(p.width)||0)+(Number(p.bleed)||0)*2);
    const width=parseFloat(artboard.style.width)||artboard.getBoundingClientRect().width||total;
    return width/total;
  }
  function rewriteTopBottomGuides(){
    if(rewriting)return false;
    const p=project(),surface=activeSurface(p),artboard=byId('artboard');
    if(!isLeaflet2(p)||p.leaflet2Layout!=='top-bottom'||!surface||!artboard)return false;
    rewriting=true;
    try{
      artboardObserver?.disconnect();
      artboard.querySelectorAll('.fold-guide,.panel-guide-label').forEach(node=>node.remove());
      if(p.showFolds===false)return true;
      const ppm=artboardScale(p),bleed=Number(p.bleed)||0,fold=Number(surface.foldsY?.[0])||((Number(p.height)||0)/2);
      const line=document.createElement('div');line.className='fold-guide leaflet2-horizontal-fold-guide';
      line.style.left=`${bleed*ppm}px`;line.style.top=`${(bleed+fold)*ppm}px`;line.style.width=`${(Number(p.width)||0)*ppm}px`;line.style.height='0px';
      artboard.appendChild(line);
      const boundaries=[0,fold,Number(p.height)||0],labels=surface.panels||panelLabels(surface,'top-bottom');
      labels.slice(0,2).forEach((label,index)=>{
        const badge=document.createElement('span');badge.className='panel-guide-label leaflet2-horizontal-panel-label';badge.textContent=label;
        badge.style.left=`${(bleed+(Number(p.width)||0)/2)*ppm}px`;badge.style.top=`${(bleed+(boundaries[index]+boundaries[index+1])/2)*ppm}px`;artboard.appendChild(badge);
      });
      return true;
    }finally{
      rewriting=false;observeArtboard();
    }
  }
  function observeArtboard(){
    const artboard=byId('artboard');if(!artboard||typeof MutationObserver!=='function')return false;
    if(!artboardObserver)artboardObserver=new MutationObserver(()=>{if(isLeaflet2()&&project()?.leaflet2Layout==='top-bottom')requestAnimationFrame(rewriteTopBottomGuides);});
    artboardObserver.disconnect();artboardObserver.observe(artboard,{childList:true});return true;
  }

  function approxTextHeight(item){
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length),sizeMm=Math.max(1,Number(item?.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item?.lineHeight)||1.26));
  }
  function rectFor(item){
    if(item?.type==='text')return{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(0,Number(item.w)||0),h:approxTextHeight(item)};
    return{x:Number(item?.x)||0,y:Number(item?.y)||0,w:Math.max(0,Number(item?.w)||0),h:Math.max(0,Number(item?.h)||0)};
  }
  function crossesHorizontalFold(rect,fold){return rect.y<fold+FOLD_BUFFER_MM&&rect.y+rect.h>fold-FOLD_BUFFER_MM;}
  function horizontalFoldIssues(p=project()){
    if(!isLeaflet2(p)||p.leaflet2Layout!=='top-bottom')return[];
    const issues=[];
    (p.surfaces||[]).forEach(surface=>{
      const fold=Number(surface.foldsY?.[0])||((Number(p.height)||0)/2);
      (surface.elements||[]).filter(item=>item?.visible!==false&&item?.type==='text').forEach(item=>{
        if(crossesHorizontalFold(rectFor(item),fold))issues.push({level:'warning',surfaceId:surface.id,surfaceLabel:surface.label||'작업면',itemId:item.id||'',itemType:'text',kind:'horizontal-fold',label:'글씨가 가로 접지선 가까이에 있습니다.',detail:'상하 2단 접는 위치에서 글씨가 꺾일 수 있습니다.'});
      });
      (surface.extras||[]).filter(item=>item?.visible!==false&&item?.type==='image').forEach(item=>{
        if(crossesHorizontalFold(rectFor(item),fold))issues.push({level:'warning',surfaceId:surface.id,surfaceLabel:surface.label||'작업면',itemId:item.id||'',itemType:'image',kind:'horizontal-image-fold',label:'이미지가 가로 접지선 가까이에 있습니다.',detail:'중요한 얼굴이나 로고가 상하 접지선에 걸리지 않는지 확인하세요.'});
      });
    });
    return issues;
  }
  function refreshSafetyNote(){
    const node=byId(SAFETY_ID);if(!node)return;
    const issues=horizontalFoldIssues();node.classList.toggle('warn',issues.length>0);
    node.textContent=issues.length?`가로 접지선 주변 중요 요소 ${issues.length}개 · 출력 전 확인 필요`:'가로 접지선 주변 중요 요소 없음';
  }
  function mergedSummary(base){
    const extras=horizontalFoldIssues(),issues=[...(base?.issues||[])];
    const seen=new Set(issues.map(item=>`${item.surfaceId||''}:${item.itemId||''}:${item.kind||''}`));
    extras.forEach(item=>{const key=`${item.surfaceId}:${item.itemId}:${item.kind}`;if(!seen.has(key)){seen.add(key);issues.push(item);}});
    return{...(base||{}),issues,fatalCount:issues.filter(item=>item.level==='fatal').length,warningCount:issues.filter(item=>item.level==='warning').length,surfaceCount:Number(base?.surfaceCount)||project()?.surfaces?.length||0,checkedAt:Date.now()};
  }
  function updateFinalCheckCard(summary){
    const title=byId('designFinalCheckTitle'),note=byId('designFinalCheckNote'),badge=byId('designFinalCheckBadge');if(!title||!note||!badge)return;
    badge.className='final-check-badge';
    if(summary.fatalCount){title.textContent='출력 불가 항목이 있습니다.';note.textContent='누락 이미지를 먼저 해결해야 합니다.';badge.textContent=`오류 ${summary.fatalCount}`;badge.classList.add('fatal');}
    else if(summary.warningCount){title.textContent='인쇄 전 확인이 필요합니다.';note.textContent='안전여백·해상도·상하 접지선을 확인하세요.';badge.textContent=`경고 ${summary.warningCount}`;badge.classList.add('warn');}
    else{title.textContent='인쇄 준비가 완료됐습니다.';note.textContent=`${summary.surfaceCount}개 면을 검사했고 문제를 찾지 못했습니다.`;badge.textContent='인쇄 적합';badge.classList.add('ok');}
  }
  async function inspectMerged(){
    const gate=window.DesignEditorFinalPrintCheck;if(!gate?.inspectProject)return null;
    const summary=mergedSummary(await gate.inspectProject());gate.lastSummary=summary;updateFinalCheckCard(summary);return summary;
  }
  function patchFinalPrintGate(){
    const gate=window.DesignEditorFinalPrintCheck;if(!gate?.inspectProject||!gate?.showSummary)return false;
    if(finalGatePatched)return true;
    finalGatePatched=true;
    const wrapped=async(options={})=>{
      const summary=await inspectMerged();if(!summary)return false;
      if(summary.fatalCount){await gate.showSummary(summary,{allowContinue:false,format:options.format});return false;}
      if(!summary.warningCount){setStatus('최종 인쇄 검사 통과 · 출력 파일을 생성합니다.','ok');return true;}
      return Boolean(await gate.showSummary(summary,{allowContinue:true,format:options.format}));
    };
    wrapped.__leaflet2TopBottomGuard=true;gate.confirmBeforeOutput=wrapped;return true;
  }
  async function runManualMergedCheck(button){
    if(button.disabled)return;
    button.disabled=true;const original=button.textContent;button.textContent='검사 중…';
    try{const summary=await inspectMerged();if(summary)await window.DesignEditorFinalPrintCheck.showSummary(summary,{allowContinue:false});}
    finally{button.disabled=false;button.textContent=original||'전체 인쇄 검사 실행';}
  }

  function syncFromProject(){
    const p=project();
    if(!isLeaflet2(p)){syncLayoutField();return false;}
    const explicit=projectLayout(p);if(explicit)preferredLayout=explicit;
    applyGeometry(preferredLayout,{preference:false,persist:false,history:true,render:false});
    syncLayoutField();rewriteTopBottomGuides();refreshSafetyNote();return true;
  }
  function queueRefresh(delay=60){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>requestAnimationFrame(()=>{syncFromProject();patchFinalPrintGate();}),delay);}
  function observeModeCard(){
    const card=byId('designEmbeddedModeCard');if(!card||typeof MutationObserver!=='function')return false;
    if(!cardObserver)cardObserver=new MutationObserver(()=>queueRefresh(10));
    cardObserver.disconnect();cardObserver.observe(card,{childList:true,subtree:true});return true;
  }
  function bindEvents(){
    window.addEventListener('resize',()=>queueRefresh(0),{passive:true});
    document.addEventListener('click',event=>{
      const modeButton=event.target?.closest?.('[data-design-mode]');
      if(modeButton?.dataset.designMode==='leaflet2')setTimeout(()=>queueRefresh(0),40);
      if(event.target?.closest?.('.design-mode-apply')&&isLeaflet2()){
        const requested=cleanLayout(byId(SELECT_ID)?.value)||preferredLayout;
        setTimeout(()=>{
          if(isLeaflet2())applyGeometry(requested,{preference:false,persist:true,source:'leaflet2-layout-option-apply'});
        },80);
      }
      const finalButton=event.target?.closest?.('#designFinalCheckBtn');
      if(finalButton&&isLeaflet2()&&project()?.leaflet2Layout==='top-bottom'){
        event.preventDefault();event.stopImmediatePropagation();runManualMergedCheck(finalButton);
      }
    },true);
    ['input','change','pointerup'].forEach(name=>document.addEventListener(name,()=>{if(isLeaflet2())queueRefresh(name==='input'?120:60);},false));
  }
  function install(){
    if(installed)return true;
    if(!window.DesignEditorApp||!byId('artboard'))return false;
    installed=true;preferredLayout=readPreference();installStyles();observeArtboard();observeModeCard();bindEvents();syncFromProject();patchFinalPrintGate();
    [80,220,520,1000,1800,3000].forEach(delay=>setTimeout(()=>{observeArtboard();observeModeCard();queueRefresh(0);},delay));
    window.DesignEditorLeaflet2Layout={
      applyGeometry,getLayout:()=>projectLayout()||preferredLayout,horizontalFoldIssues,rewriteGuides:rewriteTopBottomGuides,sync:syncFromProject,
      constants:{preferenceKey:PREF_KEY,leftRight:'left-right',topBottom:'top-bottom'},
      stage:'leaflet2-left-right-and-top-bottom-layout'
    };
    document.documentElement.dataset.designLeaflet2LayoutReady='1';return true;
  }
  function boot(){if(install())return;[100,240,520,900,1500,2400,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();