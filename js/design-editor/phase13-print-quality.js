(function(){
  'use strict';
  if(window.__designEditorPrintQualityV1)return;
  window.__designEditorPrintQualityV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const CARD_ID='designPrintQualityTools';
  const STYLE_ID='designPrintQualityStyles';
  const dimensionCache=new Map();
  let installed=false;
  let refreshTimer=0;
  let refreshToken=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function selectedImageId(){
    const node=document.querySelector('.phase2-extra-object.selected');
    return node?.dataset?.extraId||'';
  }

  function classify(dpi){
    if(!Number.isFinite(dpi))return{level:'unknown',label:'확인 중',note:'이미지 해상도를 확인하고 있습니다.'};
    if(dpi>=300)return{level:'excellent',label:'인쇄 적합',note:'300DPI 이상으로 선명한 인쇄에 적합합니다.'};
    if(dpi>=250)return{level:'good',label:'양호',note:'일반적인 인쇄물에서 충분히 좋은 품질입니다.'};
    if(dpi>=200)return{level:'caution',label:'주의',note:'크게 출력하면 약간 흐려 보일 수 있습니다.'};
    return{level:'low',label:'저해상도',note:'이미지를 더 작게 배치하거나 더 큰 원본으로 교체하는 것이 좋습니다.'};
  }

  function loadDimensions(src){
    if(!src)return Promise.resolve(null);
    if(dimensionCache.has(src))return dimensionCache.get(src);
    const task=new Promise(resolve=>{
      const image=new Image();
      image.onload=()=>resolve({width:image.naturalWidth||image.width,height:image.naturalHeight||image.height});
      image.onerror=()=>resolve(null);
      image.src=src;
    });
    dimensionCache.set(src,task);
    return task;
  }

  function effectiveDpi(item,dimensions){
    if(!item||!dimensions)return NaN;
    const widthMm=Math.max(.1,Number(item.w)||0),heightMm=Math.max(.1,Number(item.h)||0);
    if(!widthMm||!heightMm)return NaN;
    const dpiX=dimensions.width/(widthMm/25.4);
    const dpiY=dimensions.height/(heightMm/25.4);
    return Math.round(Math.min(dpiX,dpiY));
  }

  async function inspectSurface(){
    const current=surface();
    const images=(current?.extras||[]).filter(item=>item?.type==='image'&&item.visible!==false&&item.src);
    const details=await Promise.all(images.map(async item=>{
      const dimensions=await loadDimensions(item.src);
      const dpi=effectiveDpi(item,dimensions);
      return{id:item.id,name:item.name||'이미지',dpi,dimensions,item,status:classify(dpi)};
    }));
    const known=details.filter(detail=>Number.isFinite(detail.dpi));
    const lowest=known.length?Math.min(...known.map(detail=>detail.dpi)):NaN;
    const lowCount=known.filter(detail=>detail.dpi<200).length;
    const cautionCount=known.filter(detail=>detail.dpi>=200&&detail.dpi<250).length;
    return{images:details,count:details.length,knownCount:known.length,lowest,lowCount,cautionCount};
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .print-quality-summary{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #dfe7ee;border-radius:9px;background:#f8fafc;padding:8px}.print-quality-main{min-width:0}.print-quality-title{font-size:9px;font-weight:950;color:#334155}.print-quality-note{margin-top:3px;font-size:7px;line-height:1.45;color:#7c8797}.print-quality-badge{flex:0 0 auto;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:950}.print-quality-badge.excellent{background:#ecfdf3;color:#067647}.print-quality-badge.good{background:#eff8ff;color:#175cd3}.print-quality-badge.caution{background:#fffaeb;color:#b54708}.print-quality-badge.low{background:#fef3f2;color:#b42318}.print-quality-badge.empty,.print-quality-badge.unknown{background:#f2f4f7;color:#667085}.print-quality-detail{margin-top:6px;border-top:1px solid #eef2f6;padding-top:6px;font-size:7px;line-height:1.5;color:#667085}.print-quality-detail strong{color:#344054}.print-quality-help{margin-top:6px;font-size:7px;line-height:1.45;color:#98a2b3}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),output=byId('designOutputTools'),rotation=byId('designRotationTools'),inspector=byId('inspector');
    if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">인쇄 품질</div><div id="designPrintQualitySummary" class="print-quality-summary"><div class="print-quality-main"><div class="print-quality-title">이미지 확인 중</div><div class="print-quality-note">배치 크기를 기준으로 인쇄 해상도를 계산합니다.</div></div><span class="print-quality-badge unknown">확인 중</span></div><div id="designPrintQualityDetail" class="print-quality-detail hidden"></div><div class="print-quality-help">300DPI 이상 권장 · 250DPI 이상 양호 · 200DPI 미만은 원본 교체를 권장합니다.</div>`;
    const anchor=output||rotation||inspector;
    if(anchor)sidebar.insertBefore(card,anchor);else sidebar.appendChild(card);
    return true;
  }

  function render(summary){
    const box=byId('designPrintQualitySummary'),detail=byId('designPrintQualityDetail');
    if(!box||!detail)return;
    const selectedId=selectedImageId();
    const selected=summary.images.find(item=>item.id===selectedId)||null;
    let badgeClass='empty',badgeText='이미지 없음',title='이미지 없이 작업 중',note='글씨와 도형은 해상도 저하 없이 출력됩니다.';
    if(summary.count){
      const status=classify(summary.lowest);
      badgeClass=status.level;badgeText=Number.isFinite(summary.lowest)?`${summary.lowest} DPI`:'확인 중';
      if(summary.lowCount){title=`저해상도 이미지 ${summary.lowCount}개`;note='200DPI 미만 이미지가 있습니다. 인쇄 전 교체 또는 크기 축소를 권장합니다.';}
      else if(summary.cautionCount){title=`이미지 ${summary.count}개 · 확인 필요`;note='일부 이미지가 200~249DPI입니다. 큰 인쇄물에서는 선명도를 확인하세요.';}
      else if(summary.knownCount===summary.count){title=`이미지 ${summary.count}개 · 인쇄 품질 양호`;note='현재 배치 크기 기준으로 이미지 해상도가 적절합니다.';}
      else{title=`이미지 ${summary.count}개 · 확인 중`;note='일부 이미지 해상도를 아직 읽고 있습니다.';}
    }
    box.innerHTML=`<div class="print-quality-main"><div class="print-quality-title">${title}</div><div class="print-quality-note">${note}</div></div><span class="print-quality-badge ${badgeClass}">${badgeText}</span>`;
    if(selected){
      const px=selected.dimensions?`${selected.dimensions.width}×${selected.dimensions.height}px`:'크기 확인 중';
      detail.classList.remove('hidden');
      detail.innerHTML=`<strong>선택 이미지</strong> · ${Number.isFinite(selected.dpi)?`${selected.dpi} DPI`:'확인 중'}<br>${px} → ${Math.round((Number(selected.item.w)||0)*10)/10}×${Math.round((Number(selected.item.h)||0)*10)/10}mm 배치<br>${selected.status.note}`;
    }else{
      detail.classList.add('hidden');detail.textContent='';
    }
  }

  async function refresh(){
    const token=++refreshToken;
    if(!project()||byId('editorShell')?.classList.contains('hidden'))return;
    installCard();
    const summary=await inspectSurface();
    if(token!==refreshToken)return;
    render(summary);
    window.DesignEditorPrintQuality.lastSummary=summary;
  }

  function queueRefresh(delay=70){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>requestAnimationFrame(refresh),delay);}

  function bindEvents(){
    ['click','change','pointerup'].forEach(name=>document.addEventListener(name,()=>queueRefresh(),false));
    document.addEventListener('input',event=>{
      const id=event.target?.id||'';
      if(id==='phase2ExtraW'||id==='phase2ExtraH'||id==='phase3Width'||id==='phase3Height')queueRefresh(120);
    },false);
    window.addEventListener('resize',()=>queueRefresh(120),{passive:true});
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();bindEvents();
    window.DesignEditorPrintQuality={inspectSurface,refresh,stage:'lightweight-print-image-quality-assistant',lastSummary:null};
    [120,320,700,1300,2200].forEach(delay=>setTimeout(()=>queueRefresh(),delay));
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
