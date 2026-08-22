(function(){
  'use strict';
  if(window.__designEditorFinalPrintCheckV1)return;
  window.__designEditorFinalPrintCheckV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const CARD_ID='designFinalPrintCheckTools';
  const STYLE_ID='designFinalPrintCheckStyles';
  const MODAL_ID='designFinalPrintCheckModal';
  const MIN_TEXT_PT=8;
  const RECOMMENDED_BLEED_MM=3;
  const MIN_SAFE_MM=3;
  const FOLD_BUFFER_MM=2.5;
  const dimensionCache=new Map();
  let installed=false;
  let checking=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;

  function approxTextHeight(item){
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length);
    const sizeMm=Math.max(1,Number(item?.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item?.lineHeight)||1.26));
  }

  function rectFor(item){
    if(item?.type==='text')return{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(0,Number(item.w)||0),h:approxTextHeight(item)};
    return{x:Number(item?.x)||0,y:Number(item?.y)||0,w:Math.max(0,Number(item?.w)||0),h:Math.max(0,Number(item?.h)||0)};
  }

  function crossesFold(rect,fold){return rect.x<fold+FOLD_BUFFER_MM&&rect.x+rect.w>fold-FOLD_BUFFER_MM;}

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
    return Math.round(Math.min(dimensions.width/(widthMm/25.4),dimensions.height/(heightMm/25.4)));
  }

  function issue(level,surface,item,kind,label,detail=''){
    return{level,surfaceId:surface?.id||'',surfaceLabel:surface?.label||'작업면',itemId:item?.id||'',itemType:item?.type||'',kind,label,detail};
  }

  async function inspectSurface(p,surface){
    const issues=[];
    const width=Math.max(0,Number(p.width)||0),height=Math.max(0,Number(p.height)||0);
    const safe=clamp(Number(p.safe)||0,0,Math.min(width,height)/2);
    const folds=(surface?.folds||[]).map(Number).filter(Number.isFinite);

    for(const item of (surface?.elements||[]).filter(entry=>entry?.visible!==false&&entry?.type==='text')){
      const rect=rectFor(item);
      const outside=rect.x<safe-.2||rect.y<safe-.2||rect.x+rect.w>width-safe+.2||rect.y+rect.h>height-safe+.2;
      if(outside)issues.push(issue('warning',surface,item,'safe','글씨가 안전여백 밖에 있습니다.','재단 오차를 고려해 중요한 글씨는 안전여백 안쪽에 두는 것이 좋습니다.'));
      if((Number(item.size)||0)<MIN_TEXT_PT)issues.push(issue('warning',surface,item,'small-text',`${MIN_TEXT_PT}pt보다 작은 글씨가 있습니다.`,'작은 글씨는 인쇄 시 가독성이 떨어질 수 있습니다.'));
      if(folds.some(fold=>crossesFold(rect,fold)))issues.push(issue('warning',surface,item,'fold','글씨가 접지선 가까이에 있습니다.','접는 위치에서 글씨가 꺾일 수 있습니다.'));
    }

    for(const item of (surface?.extras||[]).filter(entry=>entry?.visible!==false&&entry?.type==='image')){
      if(!item.src){
        issues.push(issue('fatal',surface,item,'missing-image','이미지 원본을 찾을 수 없습니다.','이미지를 다시 연결한 뒤 출력해야 합니다.'));
        continue;
      }
      const dimensions=await loadDimensions(item.src);
      if(!dimensions){
        issues.push(issue('fatal',surface,item,'unreadable-image','이미지를 읽을 수 없습니다.','브라우저 저장소의 이미지가 누락됐거나 손상됐을 수 있습니다.'));
        continue;
      }
      const dpi=effectiveDpi(item,dimensions);
      if(Number.isFinite(dpi)&&dpi<200)issues.push(issue('warning',surface,item,'low-dpi',`저해상도 이미지 ${dpi} DPI`,'200DPI 미만입니다. 더 큰 원본으로 교체하거나 배치 크기를 줄이는 것을 권장합니다.'));
      else if(Number.isFinite(dpi)&&dpi<250)issues.push(issue('warning',surface,item,'caution-dpi',`이미지 해상도 ${dpi} DPI`,'250DPI 미만입니다. 큰 인쇄물에서는 선명도를 확인하세요.'));
      const rect=rectFor(item);
      if(folds.some(fold=>crossesFold(rect,fold)))issues.push(issue('warning',surface,item,'image-fold','이미지가 접지선 가까이에 있습니다.','중요한 얼굴이나 로고가 접지선에 걸리지 않는지 확인하세요.'));
    }
    return issues;
  }

  async function inspectProject(){
    const p=project();
    if(!p)return{issues:[{level:'fatal',surfaceLabel:'문서',kind:'no-project',label:'열린 작업이 없습니다.',detail:''}],fatalCount:1,warningCount:0,surfaceCount:0,checkedAt:Date.now()};
    const issues=[];
    if((Number(p.bleed)||0)<RECOMMENDED_BLEED_MM)issues.push({level:'warning',surfaceLabel:'문서',kind:'bleed',label:`도련이 ${Number(p.bleed)||0}mm입니다.`,detail:`일반 인쇄물은 ${RECOMMENDED_BLEED_MM}mm 도련을 권장합니다.`});
    if((Number(p.safe)||0)<MIN_SAFE_MM)issues.push({level:'warning',surfaceLabel:'문서',kind:'safe-setting',label:`안전여백이 ${Number(p.safe)||0}mm입니다.`,detail:`중요한 내용은 최소 ${MIN_SAFE_MM}mm 이상 안쪽 배치를 권장합니다.`});
    for(const surface of p.surfaces||[])issues.push(...await inspectSurface(p,surface));
    const fatalCount=issues.filter(item=>item.level==='fatal').length;
    const warningCount=issues.filter(item=>item.level==='warning').length;
    return{issues,fatalCount,warningCount,surfaceCount:(p.surfaces||[]).length,checkedAt:Date.now()};
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .final-check-row{display:flex;align-items:center;justify-content:space-between;gap:8px}.final-check-copy{min-width:0}.final-check-title{font-size:9px;font-weight:950;color:#334155}.final-check-note{margin-top:3px;font-size:7px;line-height:1.45;color:#667085}.final-check-badge{flex:0 0 auto;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:950;background:#f2f4f7;color:#667085}.final-check-badge.ok{background:#ecfdf3;color:#067647}.final-check-badge.warn{background:#fff7ed;color:#b54708}.final-check-badge.fatal{background:#fef3f2;color:#b42318}.final-check-button{width:100%;margin-top:7px;border:1px solid #b8d7df;border-radius:8px;background:#f0fdff;color:#0f6070;padding:7px;font-size:8px;font-weight:950;cursor:pointer}.final-check-button:disabled{opacity:.55;cursor:not-allowed}
      .final-print-modal{position:fixed;z-index:10050;inset:0;background:#0f172a70;display:grid;place-items:center;padding:18px}.final-print-panel{width:min(620px,94vw);max-height:min(720px,88vh);overflow:auto;border-radius:16px;background:#fff;box-shadow:0 24px 70px #0f172a45;padding:18px}.final-print-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.final-print-head h2{margin:0;color:#12396d;font-size:18px}.final-print-head p{margin:5px 0 0;color:#667085;font-size:10px;line-height:1.5}.final-print-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0}.final-print-stat{border:1px solid #e3e8ef;border-radius:10px;background:#f8fafc;padding:9px;text-align:center}.final-print-stat strong{display:block;font-size:16px;color:#12396d}.final-print-stat span{font-size:8px;color:#667085}.final-print-list{display:grid;gap:6px}.final-print-item{border:1px solid #e5e7eb;border-radius:9px;padding:9px;background:#fff}.final-print-item.fatal{border-color:#fecaca;background:#fff7f7}.final-print-item.warning{border-color:#fed7aa;background:#fffaf5}.final-print-item b{display:block;font-size:9px;color:#344054}.final-print-item small{display:block;margin-top:3px;font-size:8px;line-height:1.45;color:#667085}.final-print-empty{border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;color:#166534;padding:14px;text-align:center;font-size:10px;font-weight:900}.final-print-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}.final-print-actions button{border-radius:9px;padding:9px 12px;font-size:9px;font-weight:950;cursor:pointer}.final-print-cancel{border:1px solid #d7dee8;background:#fff;color:#475467}.final-print-continue{border:0;background:#12396d;color:#fff}.final-print-continue:disabled{background:#cbd5e1;cursor:not-allowed}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),output=byId('designOutputTools'),safety=byId('designPrintSafetyTools'),inspector=byId('inspector');
    if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML='<div class="side-label">출력 전 최종 검사</div><div class="final-check-row"><div class="final-check-copy"><div id="designFinalCheckTitle" class="final-check-title">검사 준비됨</div><div id="designFinalCheckNote" class="final-check-note">모든 면의 도련·안전여백·접지·이미지를 한 번에 확인합니다.</div></div><span id="designFinalCheckBadge" class="final-check-badge">대기</span></div><button id="designFinalCheckBtn" class="final-check-button" type="button">전체 인쇄 검사 실행</button>';
    const anchor=output||safety||inspector;
    if(anchor)sidebar.insertBefore(card,anchor);else sidebar.appendChild(card);
    byId('designFinalCheckBtn')?.addEventListener('click',runManualCheck);
    return true;
  }

  function updateCard(summary){
    const title=byId('designFinalCheckTitle'),note=byId('designFinalCheckNote'),badge=byId('designFinalCheckBadge');
    if(!title||!note||!badge)return;
    badge.className='final-check-badge';
    if(summary.fatalCount){title.textContent='출력 불가 항목이 있습니다.';note.textContent='누락 이미지를 먼저 해결해야 합니다.';badge.textContent=`오류 ${summary.fatalCount}`;badge.classList.add('fatal');}
    else if(summary.warningCount){title.textContent='인쇄 전 확인이 필요합니다.';note.textContent='경고를 검토한 뒤 필요하면 그대로 출력할 수 있습니다.';badge.textContent=`경고 ${summary.warningCount}`;badge.classList.add('warn');}
    else{title.textContent='인쇄 준비가 완료됐습니다.';note.textContent=`${summary.surfaceCount}개 면을 검사했고 문제를 찾지 못했습니다.`;badge.textContent='인쇄 적합';badge.classList.add('ok');}
  }

  function closeExistingModal(){byId(MODAL_ID)?.remove();}

  function showSummary(summary,options={}){
    closeExistingModal();
    const allowContinue=Boolean(options.allowContinue)&&summary.fatalCount===0;
    const formatLabel=options.format==='pdf'?'PDF':options.format==='png'?'PNG':'인쇄 파일';
    const overlay=document.createElement('div');overlay.id=MODAL_ID;overlay.className='final-print-modal';
    const shown=summary.issues.slice(0,12);
    overlay.innerHTML=`<section class="final-print-panel" role="dialog" aria-modal="true" aria-labelledby="finalPrintTitle"><div class="final-print-head"><div><h2 id="finalPrintTitle">출력 전 최종 인쇄 검사</h2><p>${formatLabel} 생성 전에 모든 작업면을 검사했습니다. 오류는 반드시 수정해야 하며 경고는 인쇄 의도에 따라 확인 후 진행할 수 있습니다.</p></div></div><div class="final-print-summary"><div class="final-print-stat"><strong>${summary.surfaceCount}</strong><span>검사한 면</span></div><div class="final-print-stat"><strong>${summary.warningCount}</strong><span>확인 경고</span></div><div class="final-print-stat"><strong>${summary.fatalCount}</strong><span>출력 오류</span></div></div>${shown.length?`<div class="final-print-list">${shown.map(item=>`<div class="final-print-item ${item.level}"><b>${item.surfaceLabel} · ${item.label}</b>${item.detail?`<small>${item.detail}</small>`:''}</div>`).join('')}${summary.issues.length>shown.length?`<div class="final-print-item warning"><b>외 ${summary.issues.length-shown.length}건</b><small>사이드바의 인쇄 품질·인쇄 안전 도구에서 세부 요소를 확인할 수 있습니다.</small></div>`:''}</div>`:'<div class="final-print-empty">현재 설정에서 인쇄 문제를 찾지 못했습니다.</div>'}<div class="final-print-actions"><button type="button" class="final-print-cancel">${allowContinue?'수정하러 가기':'확인'}</button>${allowContinue?'<button type="button" class="final-print-continue">경고 확인 후 출력 계속</button>':''}</div></section>`;
    document.body.appendChild(overlay);
    return new Promise(resolve=>{
      const finish=value=>{overlay.remove();resolve(value);};
      overlay.querySelector('.final-print-cancel')?.addEventListener('click',()=>finish(false));
      overlay.querySelector('.final-print-continue')?.addEventListener('click',()=>finish(true));
      overlay.addEventListener('click',event=>{if(event.target===overlay)finish(false);});
      document.addEventListener('keydown',function escape(event){if(event.key==='Escape'){document.removeEventListener('keydown',escape);finish(false);}},{once:true});
    });
  }

  async function runInspection(){
    if(checking)return null;
    checking=true;const button=byId('designFinalCheckBtn');if(button){button.disabled=true;button.textContent='검사 중…';}
    try{
      const summary=await inspectProject();
      window.DesignEditorFinalPrintCheck.lastSummary=summary;updateCard(summary);return summary;
    }finally{checking=false;if(button){button.disabled=false;button.textContent='전체 인쇄 검사 실행';}}
  }

  async function runManualCheck(){
    const summary=await runInspection();if(!summary)return;
    await showSummary(summary,{allowContinue:false});
  }

  async function confirmBeforeOutput(options={}){
    const summary=await runInspection();if(!summary)return false;
    if(summary.fatalCount){await showSummary(summary,{allowContinue:false,format:options.format});return false;}
    if(!summary.warningCount){
      const status=byId('editorStatus');if(status){status.className='editor-status ok';status.textContent='최종 인쇄 검사 통과 · 출력 파일을 생성합니다.';}
      return true;
    }
    return showSummary(summary,{allowContinue:true,format:options.format});
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();
    window.DesignEditorFinalPrintCheck={inspectProject,runInspection,confirmBeforeOutput,showSummary,stage:'all-surfaces-final-print-gate',lastSummary:null};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
