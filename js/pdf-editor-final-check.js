// Integrated final print check for the PDF editor.
// Generates the exact output PDF once, checks that generated file, then lets
// the user download the same checked blob without uploading it again manually.
(function(){
  'use strict';
  if(window.__pdfEditorFinalCheckV1)return;
  window.__pdfEditorFinalCheckV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(
    path==='/pdf-editor'||
    path.endsWith('/pdf-editor/index.html')||
    path.endsWith('/tools/pdf-editor.html')
  ))return;

  const CRITICAL_IDS=new Set(['dpi','font_embed','page_size','bleed','safe_margin']);
  const PRIORITY=['font_embed','dpi','page_size','bleed','safe_margin','color_mode','transparency','file_weight'];
  let busy=false;
  let checkedBlob=null;
  let checkedName='';
  let lastReport=null;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  function installStyles(){
    if($('pdfEditorFinalCheckStyles'))return;
    const style=document.createElement('style');
    style.id='pdfEditorFinalCheckStyles';
    style.textContent=`
      .pefc-wrap{margin-top:6px;padding-top:8px;border-top:1px dashed #cbd5e1}.pefc-primary{width:100%;border:0;border-radius:10px;padding:11px 12px;background:linear-gradient(135deg,#0f766e,#0e9f8d);color:#fff;font:900 12px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer;box-shadow:0 7px 18px rgba(15,118,110,.18)}.pefc-primary:hover:not(:disabled){filter:brightness(.97);transform:translateY(-1px)}.pefc-primary:disabled{opacity:.45;cursor:not-allowed;transform:none}.pefc-hint{font-size:9px;color:#64748b;line-height:1.45;margin-top:5px;text-align:center}.pefc-direct-note{font-size:9px;color:#64748b;text-align:center;margin:5px 0 2px}
      .pefc-modal{display:none;position:fixed;inset:0;z-index:2200;background:rgba(15,23,42,.62);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}.pefc-modal.open{display:flex}.pefc-box{width:min(650px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 30px 90px rgba(0,0,0,.3);padding:22px}.pefc-head{display:flex;align-items:flex-start;gap:11px}.pefc-icon{width:42px;height:42px;border-radius:12px;background:#e6f6f3;display:grid;place-items:center;font-size:21px}.pefc-title{font-size:18px;font-weight:950;color:#12396d}.pefc-sub{font-size:10px;color:#64748b;line-height:1.5;margin-top:4px;word-break:break-all}.pefc-close{margin-left:auto;width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;color:#475569;cursor:pointer;font-size:18px}.pefc-summary{display:grid;grid-template-columns:110px minmax(0,1fr);gap:13px;align-items:center;margin-top:16px;padding:15px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}.pefc-score{height:86px;border-radius:13px;background:#fff;border:1px solid #e2e8f0;display:flex;flex-direction:column;align-items:center;justify-content:center}.pefc-score strong{font-size:27px;color:#12396d}.pefc-score span{font-size:9px;color:#64748b;font-weight:850}.pefc-verdict strong{display:block;font-size:14px}.pefc-verdict p{font-size:10px;color:#64748b;line-height:1.55;margin-top:5px}.pefc-verdict.ready strong{color:#15803d}.pefc-verdict.warn strong{color:#a16207}.pefc-verdict.fail strong{color:#dc2626}
      .pefc-stats{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.pefc-stat{font-size:9px;font-weight:900;border-radius:999px;padding:4px 7px;background:#eef2f7;color:#475569}.pefc-stat.fail{background:#fee2e2;color:#b91c1c}.pefc-stat.warn{background:#fef3c7;color:#92400e}.pefc-stat.pass{background:#dcfce7;color:#166534}.pefc-bind{margin-top:10px;padding:10px 11px;border-radius:11px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:10px;line-height:1.55;font-weight:800}.pefc-list{display:grid;gap:7px;margin-top:13px}.pefc-item{padding:10px 11px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.pefc-item-head{display:flex;align-items:center;gap:7px}.pefc-badge{font-size:8px;font-weight:950;border-radius:999px;padding:3px 6px}.pefc-badge.fail{background:#fee2e2;color:#b91c1c}.pefc-badge.warning{background:#fef3c7;color:#92400e}.pefc-item strong{font-size:10px;color:#334155}.pefc-item p{font-size:9px;color:#64748b;line-height:1.5;margin-top:5px}.pefc-empty{margin-top:13px;padding:11px;border-radius:11px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;font-size:10px;font-weight:850}.pefc-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}.pefc-btn{border-radius:10px;padding:10px 15px;font-size:11px;font-weight:900;cursor:pointer}.pefc-btn.back{border:1px solid #dbe3eb;background:#f8fafc;color:#475569}.pefc-btn.save{border:0;background:#12396d;color:#fff}.pefc-btn:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:650px){.pefc-summary{grid-template-columns:1fr}.pefc-score{height:72px}.pefc-actions{flex-direction:column-reverse}.pefc-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function makeControls(){
    if($('pdfEditorFinalCheckBtn'))return true;
    const download=$('downloadBtn');
    if(!download)return false;
    const body=download.closest('.sec-body')||download.parentElement;
    if(!body)return false;
    const wrap=document.createElement('div');
    wrap.className='pefc-wrap';
    wrap.innerHTML=`<button type="button" class="pefc-primary" id="pdfEditorFinalCheckBtn" disabled>✓ 인쇄 전 검사 후 저장</button><div class="pefc-hint">현재 편집 결과를 PDF로 만든 뒤 해상도·폰트·규격·도련 등을 바로 검사합니다.</div><div class="pefc-direct-note">검사가 필요 없으면 아래의 <b>바로 PDF 저장</b>을 사용하세요.</div>`;
    download.insertAdjacentElement('beforebegin',wrap);
    download.textContent='바로 PDF 저장';
    $('pdfEditorFinalCheckBtn')?.addEventListener('click',runFinalCheck);
    return true;
  }

  function makeModal(){
    if($('pdfEditorFinalCheckModal'))return;
    const modal=document.createElement('div');
    modal.id='pdfEditorFinalCheckModal';
    modal.className='pefc-modal';
    modal.innerHTML=`<div class="pefc-box" role="dialog" aria-modal="true" aria-labelledby="pefcTitle">
      <div class="pefc-head"><div class="pefc-icon">🖨️</div><div><div class="pefc-title" id="pefcTitle">인쇄 전 최종 검사</div><div class="pefc-sub" id="pefcFile"></div></div><button type="button" class="pefc-close" id="pefcClose" aria-label="닫기">×</button></div>
      <div id="pefcResult"></div>
      <div class="pefc-actions"><button type="button" class="pefc-btn back" id="pefcBack">편집으로 돌아가기</button><button type="button" class="pefc-btn save" id="pefcSave">검사한 PDF 저장</button></div>
    </div>`;
    document.body.appendChild(modal);
    const close=()=>modal.classList.remove('open');
    $('pefcClose').addEventListener('click',close);
    $('pefcBack').addEventListener('click',close);
    modal.addEventListener('click',event=>{if(event.target===modal)close();});
    $('pefcSave').addEventListener('click',()=>{
      if(!checkedBlob)return;
      downloadBlob(checkedBlob,checkedName||makeFilename());
      close();
      if(typeof showStatus==='function')showStatus('검사한 PDF 저장 완료!','success');
    });
  }

  function makeFilename(){
    const ts=new Date().toISOString().slice(0,16).replace('T','_').replace(':','-');
    return `print_ready_${ts}.pdf`;
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function buildSettings(){
    if(typeof collectEditorState!=='function'||typeof getSettings!=='function')throw new Error('편집 설정을 읽을 수 없습니다. 페이지를 다시 불러와 주세요.');
    const state=collectEditorState();
    const size=getSettings();
    const validNup=new Set([1,2,4,6,8,9]);
    const pnFormatMap={number:'1','number-total':'1/N',dash:'-1-','dash-total':'-1/N-'};
    const pages=(state.pages||[]).map(page=>{
      const fileIndex=page.file_index??0;
      const rawNup=page.nupOverride??(state.fileNupMap?.[fileIndex]??null);
      const nupOverride=rawNup!==null&&validNup.has(Number(rawNup))?Number(rawNup):null;
      const pageType=page.pageType==='pdf'?'normal':(page.pageType||'normal');
      return {
        file_index:fileIndex,
        page_index:page.page_index??0,
        rotation:page.rotation||0,
        nup_override:nupOverride,
        nup_disabled:!!page.nupDisabled,
        group_break:!!page.groupBreak,
        excluded:!!page.excluded,
        page_type:pageType,
        divider_content:(page.pageType==='divider'||page.pageType==='blank')?JSON.stringify(page.dividerContent||{}):null,
        divider_style:page.dividerContent?.style||'simple'
      };
    });
    return {
      pages,
      nup_default:Number(state.nup||1),
      paper:{width_mm:size.pw,height_mm:size.ph},
      margin_h_mm:size.mh,
      margin_v_mm:size.mv,
      gap_mm:size.gp,
      fit_to_paper:true,
      add_border:!!state.showBorder,
      watermark:{enabled:!!state.wmEnabled,text:state.wmText||'',opacity:Number(state.wmOpacity||.2),angle:Number(state.wmAngle||0),color:state.wmColor||'#cccccc'},
      header_footer:{
        enabled:!!state.hfEnabled,
        header_left:state.hfHL||'',header_center:state.hfHC||'',header_right:state.hfHR||'',
        footer_left:state.hfFL||'',footer_center:state.hfFC||'',footer_right:state.hfFR||'',
        font_size:Number(state.hfFontSize||9),color:state.hfColor||'#555555',apply_to:state.hfApplyTo||'all',margin_mm:Number(state.hfMarginMm||5),
        sections:(state.hfSections||[]).map(section=>({ranges:section.ranges||'',header_left:section.header_left||'',header_center:section.header_center||'',header_right:section.header_right||'',footer_left:section.footer_left||'',footer_center:section.footer_center||'',footer_right:section.footer_right||''}))
      },
      page_numbers:{enabled:!!state.pnEnabled,position:state.pnPosition||'bottom-center',format:pnFormatMap[state.pnFormat]||'1',start:Number(state.pnStart??1),font_size:Number(state.pnFontSize||10),color:state.pnColor||'#333333',exclude_first:!!state.pnExcludeFirst,apply_to:state.pnApplyTo||'all',margin_mm:Number(state.pnMarginMm||5)},
      facing_pages:!!state.facingPages,
      booklet:!!state.booklet
    };
  }

  function activeSourcePageCount(){
    try{return (collectEditorState().pages||[]).filter(page=>!page.excluded).length;}catch(_){return 0;}
  }

  function verdict(report){
    const checks=Array.isArray(report?.checks)?report.checks:[];
    const fails=checks.filter(item=>item.severity==='fail');
    const warns=checks.filter(item=>item.severity==='warning');
    const criticalWarns=warns.filter(item=>CRITICAL_IDS.has(item.id));
    if(fails.length)return {cls:'fail',title:'수정 후 출력 권장',detail:`자동 검사에서 불량 ${fails.length}건이 발견됐습니다. 아래 항목을 확인한 뒤 저장하는 것이 안전합니다.`};
    if(criticalWarns.length)return {cls:'warn',title:'출력 전 확인 필요',detail:`규격·해상도·재단 관련 경고 ${criticalWarns.length}건이 있습니다. 실제 출력 조건과 맞는지 확인하세요.`};
    if(warns.length)return {cls:'warn',title:'샘플 출력 권장',detail:`치명적 오류는 없지만 경고 ${warns.length}건이 있습니다. 중요한 작업은 샘플 출력 후 진행하세요.`};
    return {cls:'ready',title:'인쇄 준비 양호',detail:'현재 자동검사 범위에서 즉시 수정이 필요한 문제는 발견되지 않았습니다.'};
  }

  function bindingNote(){
    let state;
    try{state=collectEditorState();}catch(_){return '';}
    const count=activeSourcePageCount();
    if(!count)return '';
    if(state.booklet){
      const add=(4-(count%4))%4;
      return add?`중철 설정 · 원본 ${count}쪽 · 4의 배수를 맞추려면 빈 페이지 ${add}쪽이 필요합니다. 편집기 미리보기에서 자동 배치 위치를 확인하세요.`:`중철 설정 · 원본 ${count}쪽 · 4의 배수 구성입니다.`;
    }
    if(count%2)return `양면 인쇄 기준 원본 ${count}쪽이므로 마지막 장 뒷면은 비게 됩니다.`;
    return `양면 인쇄 기준 원본 ${count}쪽은 앞·뒤 짝수 구성입니다.`;
  }

  function renderReport(report){
    const root=$('pefcResult');
    if(!root)return;
    const checks=Array.isArray(report?.checks)?report.checks:[];
    const fail=checks.filter(item=>item.severity==='fail').length;
    const warn=checks.filter(item=>item.severity==='warning').length;
    const pass=checks.filter(item=>item.severity==='pass').length;
    const decision=verdict(report);
    const issues=checks.filter(item=>item.severity==='fail'||item.severity==='warning').sort((a,b)=>{
      if(a.severity!==b.severity)return a.severity==='fail'?-1:1;
      const ai=PRIORITY.indexOf(a.id),bi=PRIORITY.indexOf(b.id);
      return (ai<0?PRIORITY.length:ai)-(bi<0?PRIORITY.length:bi);
    });
    const note=bindingNote();
    root.innerHTML=`<div class="pefc-summary"><div class="pefc-score"><strong>${Number(report?.score||0)}</strong><span>인쇄 검사 점수</span></div><div class="pefc-verdict ${decision.cls}"><strong>${esc(decision.title)}</strong><p>${esc(decision.detail)}</p><div class="pefc-stats"><span class="pefc-stat fail">불량 ${fail}</span><span class="pefc-stat warn">경고 ${warn}</span><span class="pefc-stat pass">통과 ${pass}</span><span class="pefc-stat">${Number(report?.page_count||0)} 출력페이지</span></div></div></div>${note?`<div class="pefc-bind">${esc(note)}</div>`:''}`;
    if(!issues.length){
      root.insertAdjacentHTML('beforeend','<div class="pefc-empty">검사 항목에서 우선 수정이 필요한 문제가 없습니다. 최종 용지·프린터 설정만 확인하세요.</div>');
    }else{
      const list=document.createElement('div');
      list.className='pefc-list';
      for(const item of issues){
        const refs=Array.isArray(item.page_refs)&&item.page_refs.length?` · 페이지 ${item.page_refs.slice(0,15).join(', ')}${item.page_refs.length>15?'…':''}`:'';
        const row=document.createElement('div');
        row.className='pefc-item';
        row.innerHTML=`<div class="pefc-item-head"><span class="pefc-badge ${item.severity}">${item.severity==='fail'?'수정 필요':'확인'}</span><strong>${esc(item.label)}</strong></div><p>${esc(item.detail||'')}${esc(refs)}</p>`;
        list.appendChild(row);
      }
      root.appendChild(list);
    }
    const save=$('pefcSave');
    if(save)save.textContent=fail?'문제 있어도 PDF 저장':'검사 완료 PDF 저장';
  }

  function setBusy(value,message){
    busy=Boolean(value);
    const check=$('pdfEditorFinalCheckBtn');
    const direct=$('downloadBtn');
    if(check){
      check.disabled=busy||direct?.disabled===true;
      check.textContent=busy?(message||'인쇄 전 검사 중...'):'✓ 인쇄 전 검사 후 저장';
    }
  }

  function syncButton(){
    const button=$('pdfEditorFinalCheckBtn');
    const direct=$('downloadBtn');
    if(button&&!busy)button.disabled=!direct||direct.disabled;
  }

  async function runFinalCheck(){
    if(busy)return;
    let sources;
    try{sources=uploadedFiles;}catch(_){sources=null;}
    if(!Array.isArray(sources)||!sources.length){
      if(typeof showStatus==='function')showStatus('먼저 PDF 파일을 업로드하세요.','error');
      return;
    }
    const visible=activeSourcePageCount();
    if(!visible){
      if(typeof showStatus==='function')showStatus('출력할 활성 페이지가 없습니다.','error');
      return;
    }
    checkedBlob=null;lastReport=null;checkedName=makeFilename();
    setBusy(true,'최종 PDF 만드는 중...');
    try{
      if(typeof showStatus==='function')showStatus('최종 출력 PDF를 생성하는 중...');
      const settings=buildSettings();
      const blob=await apiProcessPdf(sources,settings,{onStatus:message=>{
        if(typeof showStatus==='function')showStatus(`최종 PDF 생성 · ${message}`);
      }});
      checkedBlob=blob;
      const file=new File([blob],checkedName,{type:'application/pdf',lastModified:Date.now()});
      setBusy(true,'생성된 PDF 검사 중...');
      if(typeof showStatus==='function')showStatus('생성된 PDF를 인쇄 기준으로 검사하는 중...');
      const report=await apiPreflightCheck(file,{onStatus:message=>{
        if(typeof showStatus==='function')showStatus(`인쇄 검사 · ${message}`);
      }});
      lastReport=report;
      makeModal();
      $('pefcFile').textContent=`${checkedName} · ${Number(blob.size||0)/1024/1024<1?`${Math.max(1,Math.round(Number(blob.size||0)/1024))}KB`:`${(Number(blob.size||0)/1024/1024).toFixed(1)}MB`}`;
      renderReport(report);
      $('pdfEditorFinalCheckModal').classList.add('open');
      if(typeof showStatus==='function')showStatus('인쇄 전 최종 검사 완료','success');
    }catch(error){
      checkedBlob=null;lastReport=null;
      console.error('PDF editor final print check failed',error);
      if(typeof showStatus==='function')showStatus('인쇄 전 검사 실패: '+(error?.message||'알 수 없는 오류'),'error');
    }finally{
      setBusy(false);
      syncButton();
    }
  }

  function install(){
    if(typeof apiProcessPdf!=='function'||typeof apiPreflightCheck!=='function'||!$('downloadBtn'))return false;
    installStyles();
    if(!makeControls())return false;
    makeModal();
    const direct=$('downloadBtn');
    if(direct){
      new MutationObserver(syncButton).observe(direct,{attributes:true,attributeFilter:['disabled']});
    }
    syncButton();
    window.PdfEditorFinalCheck={run:runFinalCheck,get report(){return lastReport;},stage:'pdf-editor-final-print-check-v1'};
    document.documentElement.dataset.pdfEditorFinalCheck='1';
    return true;
  }

  let attempts=0;
  function boot(){
    attempts+=1;
    if(install())return;
    if(attempts<100)setTimeout(boot,100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
