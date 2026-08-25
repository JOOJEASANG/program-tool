// Safe automatic fixes for PDF preflight / print utility.
// Only page-box normalization and blank-page padding are automated.
(function(){
  'use strict';
  if(window.__pdfPrintAutoFixV1)return;
  window.__pdfPrintAutoFixV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(
    path==='/pdf-preflight'||
    path.endsWith('/pdf-preflight/index.html')||
    path.endsWith('/tools/pdf-Checker.html')||
    path.endsWith('/tools/preflight.html')
  ))return;

  const DIRECT_LIMIT=20*1024*1024;
  const fileKey=file=>`${file?.name||''}|${Number(file?.size||0)}|${Number(file?.lastModified||0)}`;
  const $=id=>document.getElementById(id);

  function installStyles(){
    if($('pdfPrintAutoFixStyles'))return;
    const style=document.createElement('style');
    style.id='pdfPrintAutoFixStyles';
    style.textContent=`
      .ppaf-panel{display:none;margin-top:12px;border:1px solid #bfdbfe;border-radius:16px;background:linear-gradient(180deg,#f8fbff,#fff);padding:16px}
      .ppaf-panel.show{display:block}.ppaf-head{display:flex;align-items:flex-start;gap:10px}.ppaf-icon{width:38px;height:38px;border-radius:11px;background:#dbeafe;display:grid;place-items:center;font-size:19px;flex:0 0 auto}.ppaf-title{font-size:14px;font-weight:950;color:#1e3a8a}.ppaf-sub{font-size:9px;color:#64748b;line-height:1.55;margin-top:3px}
      .ppaf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.ppaf-card{border:1px solid #dbe5ee;border-radius:11px;background:#fff;padding:10px}.ppaf-card-title{font-size:10px;font-weight:950;color:#334155;margin-bottom:7px}.ppaf-choice{display:flex;align-items:flex-start;gap:7px;padding:6px 0;font-size:10px;color:#475569;line-height:1.45}.ppaf-choice input{margin-top:2px;accent-color:#1d4ed8}.ppaf-choice strong{display:block;font-size:10px;color:#1e293b}.ppaf-choice small{display:block;font-size:9px;color:#64748b;margin-top:2px}.ppaf-tag{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;font-size:8px;font-weight:900;background:#dbeafe;color:#1d4ed8}.ppaf-tag.need{background:#fef3c7;color:#92400e}
      .ppaf-unsafe{margin-top:10px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;padding:9px 10px;font-size:9px;color:#64748b;line-height:1.55}.ppaf-unsafe strong{color:#475569}.ppaf-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:11px}.ppaf-status{font-size:9px;color:#64748b;font-weight:750;line-height:1.4}.ppaf-btn{border:0;border-radius:9px;padding:9px 12px;background:#1d4ed8;color:#fff;font-size:10px;font-weight:950;cursor:pointer;white-space:nowrap}.ppaf-btn:disabled{opacity:.45;cursor:not-allowed}
      @media(max-width:820px){.ppaf-grid{grid-template-columns:1fr}.ppaf-actions{align-items:stretch;flex-direction:column}.ppaf-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function makePanel(){
    let panel=$('pdfPrintAutoFix');
    if(panel)return panel;
    const readiness=$('pdfPrintReadiness');
    const results=$('results');
    const anchor=readiness||results;
    if(!anchor)return null;
    panel=document.createElement('section');
    panel.id='pdfPrintAutoFix';
    panel.className='ppaf-panel';
    panel.innerHTML=`
      <div class="ppaf-head"><div class="ppaf-icon">🛠️</div><div><div class="ppaf-title">안전 자동 수정</div><div class="ppaf-sub" id="ppafFile"></div></div></div>
      <div class="ppaf-grid">
        <div class="ppaf-card"><div class="ppaf-card-title">페이지 규격</div><label class="ppaf-choice"><input type="checkbox" id="ppafNormalize"><span><strong>페이지 규격 자동 통일 <span class="ppaf-tag" id="ppafNormalizeTag">선택</span></strong><small>가장 많이 사용된 페이지 규격을 기준으로 모든 페이지를 비율 유지해 가운데 배치합니다. 글자·벡터는 이미지로 변환하지 않습니다.</small></span></label></div>
        <div class="ppaf-card"><div class="ppaf-card-title">페이지 수 보충</div>
          <label class="ppaf-choice"><input type="radio" name="ppafPad" value="none" checked><span><strong>보충 안 함</strong><small>현재 페이지 수를 유지합니다.</small></span></label>
          <label class="ppaf-choice"><input type="radio" name="ppafPad" value="even"><span><strong>양면 인쇄용 짝수 맞춤 <span class="ppaf-tag" id="ppafEvenTag"></span></strong><small>홀수 페이지라면 마지막에 빈 페이지 1쪽을 추가합니다.</small></span></label>
          <label class="ppaf-choice"><input type="radio" name="ppafPad" value="booklet"><span><strong>소책자용 4의 배수 맞춤 <span class="ppaf-tag" id="ppafBookletTag"></span></strong><small>중철 소책자에 필요한 만큼 마지막에 빈 페이지를 추가합니다.</small></span></label>
        </div>
      </div>
      <div class="ppaf-unsafe"><strong>자동으로 수정하지 않는 항목:</strong> 저해상도 이미지, 폰트 임베딩, RGB/CMYK, 도련, 안전여백, 투명도는 자동 변환 시 품질이나 디자인이 달라질 수 있어 검사 경고만 유지합니다.</div>
      <div class="ppaf-actions"><div class="ppaf-status" id="ppafStatus">수정 항목을 선택하세요.</div><button type="button" class="ppaf-btn" id="ppafRun">선택 항목 자동 수정</button></div>`;
    if(readiness)readiness.insertAdjacentElement('afterend',panel);
    else results.insertAdjacentElement('beforebegin',panel);
    $('ppafRun')?.addEventListener('click',runAutoFix);
    panel.addEventListener('change',syncRunState);
    return panel;
  }

  function activeContext(){
    const utility=window.PdfUtility;
    const files=Array.isArray(utility?.state?.files)?utility.state.files:[];
    if(!files.length)return {utility,file:null,report:null,index:0};
    const index=Math.max(0,Math.min(files.length-1,Number(utility.state.activeIndex||0)));
    const file=files[index];
    const report=utility.state.reports?.get(fileKey(file))||null;
    return {utility,file,report,index};
  }

  function issue(report,id){
    return (Array.isArray(report?.checks)?report.checks:[]).find(item=>item.id===id&&item.severity!=='pass')||null;
  }

  function selectedPad(){
    return document.querySelector('input[name="ppafPad"]:checked')?.value||'none';
  }

  function syncRunState(){
    const normalize=!!$('ppafNormalize')?.checked;
    const pad=selectedPad();
    const button=$('ppafRun');
    if(button)button.disabled=!normalize&&pad==='none';
    const status=$('ppafStatus');
    if(status&&!button?.disabled)status.textContent='선택한 안전 항목만 수정하고 완료 후 자동으로 다시 검사합니다.';
    else if(status)status.textContent='수정 항목을 선택하세요.';
  }

  function render(){
    const panel=makePanel();
    if(!panel)return;
    const {file,report}=activeContext();
    if(!file||!report){panel.classList.remove('show');return;}
    panel.classList.add('show');
    const count=Number(report.page_count||0);
    const pageSizeIssue=issue(report,'page_size');
    const normalize=$('ppafNormalize');
    if(normalize&&normalize.dataset.reportKey!==fileKey(file)){
      normalize.checked=!!pageSizeIssue;
      normalize.dataset.reportKey=fileKey(file);
    }
    const normalizeTag=$('ppafNormalizeTag');
    if(normalizeTag){
      normalizeTag.textContent=pageSizeIssue?'자동 수정 권장':'필요 시 선택';
      normalizeTag.classList.toggle('need',!!pageSizeIssue);
    }
    const evenAdd=count>0?count%2:0;
    const bookletAdd=count>0?(4-(count%4))%4:0;
    const evenTag=$('ppafEvenTag');
    const bookletTag=$('ppafBookletTag');
    if(evenTag){evenTag.textContent=evenAdd?`빈쪽 +${evenAdd}`:'이미 짝수';evenTag.classList.toggle('need',!!evenAdd);}
    if(bookletTag){bookletTag.textContent=bookletAdd?`빈쪽 +${bookletAdd}`:'이미 4의 배수';bookletTag.classList.toggle('need',!!bookletAdd);}
    const fileEl=$('ppafFile');
    if(fileEl)fileEl.textContent=`${file.name} · ${count}페이지 · 검사 결과에서 안전하게 자동 처리할 수 있는 항목만 표시합니다.`;
    syncRunState();
  }

  async function token(){
    const user=window.auth?.currentUser||((typeof auth!=='undefined'&&auth)?auth.currentUser:null);
    if(!user)throw new Error('로그인이 필요합니다.');
    return user.getIdToken(true);
  }

  async function storage(){
    if(typeof window._ensureStorage==='function')return window._ensureStorage();
    if(typeof _ensureStorage==='function')return _ensureStorage();
    if(window.storage)return window.storage;
    if(window.firebase?.storage)return window.firebase.storage();
    throw new Error('대용량 PDF 임시 저장소를 사용할 수 없습니다.');
  }

  async function readDelivery(response){
    const type=response.headers.get('content-type')||'';
    if(!type.includes('application/json'))return response.blob();
    const delivery=await response.json();
    if(delivery?.delivery!=='storage'||!delivery.download_url)throw new Error(delivery?.detail||'완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result=await fetch(delivery.download_url,{cache:'no-store'});
    if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob=await result.blob();
    if(delivery.storage_path){
      try{const st=await storage();await st.ref(delivery.storage_path).delete();}catch(error){console.warn('[auto-fix] result cleanup failed',error);}
    }
    return blob;
  }

  async function requestAutoFix(file,params){
    const authToken=await token();
    if(Number(file.size||0)<=DIRECT_LIMIT){
      const form=new FormData();
      form.append('file',file);
      form.append('params',JSON.stringify(params));
      const response=await fetch('/api/preflight/auto-fix',{method:'POST',headers:{Authorization:`Bearer ${authToken}`},body:form});
      if(!response.ok){const err=await response.json().catch(()=>null);throw new Error(err?.detail||`자동 수정 실패 (${response.status})`);}
      return readDelivery(response);
    }

    const user=window.auth?.currentUser||((typeof auth!=='undefined'&&auth)?auth.currentUser:null);
    const st=await storage();
    const session=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    const safe=(file.name||'document.pdf').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,80)||'document.pdf';
    const path=`preflight_temp/${user.uid}/${session}/${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;
    try{
      $('ppafStatus').textContent='대용량 PDF 임시 업로드 중...';
      await st.ref(path).put(file,{contentType:'application/pdf'});
      const response=await fetch('/api/preflight/auto-fix-storage',{
        method:'POST',
        headers:{Authorization:`Bearer ${authToken}`,'Content-Type':'application/json'},
        body:JSON.stringify({storage_path:path,filename:file.name,params})
      });
      if(!response.ok){const err=await response.json().catch(()=>null);throw new Error(err?.detail||`자동 수정 실패 (${response.status})`);}
      return readDelivery(response);
    }catch(error){
      try{await st.ref(path).delete();}catch(_){}
      throw error;
    }
  }

  function fixedName(file){
    return `${String(file?.name||'document.pdf').replace(/\.pdf$/i,'')}_print_fixed.pdf`;
  }

  function download(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  async function runAutoFix(){
    const {utility,file,report,index}=activeContext();
    if(!utility||!file||!report)return;
    const normalize=!!$('ppafNormalize')?.checked;
    const padMode=selectedPad();
    if(!normalize&&padMode==='none')return;
    const button=$('ppafRun');
    try{
      button.disabled=true;
      $('ppafStatus').textContent='안전 자동 수정 중...';
      const blob=await requestAutoFix(file,{normalize_page_size:normalize,pad_mode:padMode});
      const name=fixedName(file);
      download(blob,name);
      const replacement=new File([blob],name,{type:'application/pdf',lastModified:Date.now()});
      utility.state.reports?.delete(fileKey(file));
      utility.state.errors?.delete(fileKey(file));
      utility.state.files[index]=replacement;
      utility.state.activeIndex=index;
      if(typeof utility.selectActive==='function')utility.selectActive(index);
      $('ppafStatus').textContent='수정 완료 · 결과 PDF 저장 및 재검사 중...';
      await utility.runBatchCheck();
      $('ppafStatus').textContent='자동 수정 후 재검사가 완료되었습니다.';
      render();
    }catch(error){
      console.error('[auto-fix] failed',error);
      $('ppafStatus').textContent=error?.message||'자동 수정에 실패했습니다.';
      if(typeof window.showError==='function')window.showError(error?.message||'자동 수정에 실패했습니다.');
    }finally{
      syncRunState();
    }
  }

  function observe(){
    const utility=window.PdfUtility;
    if(!utility)return false;
    installStyles();makePanel();render();
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;render();});
    });
    [
      $('pdfUtilityFileItems'),$('pdfUtilityBatchResults'),$('pdfPrintReadiness'),$('results')
    ].filter(Boolean).forEach(node=>observer.observe(node,{childList:true,subtree:true,characterData:true}));
    document.addEventListener('click',event=>{
      if(event.target.closest('.pdfu-file-row,.pdfu-detail-btn,#checkBtn'))setTimeout(render,0);
    });
    window.PdfPrintAutoFix={render,run:runAutoFix,stage:'safe-print-auto-fix-v1'};
    document.documentElement.dataset.pdfPrintAutoFix='1';
    return true;
  }

  let attempts=0;
  function install(){attempts+=1;if(observe())return;if(attempts<80)setTimeout(install,100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
