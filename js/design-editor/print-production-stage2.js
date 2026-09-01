(function(){
  'use strict';
  if(window.__designEditorPrintProductionStage2V1)return;
  window.__designEditorPrintProductionStage2V1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(!(
    path==='/design-editor/general'||path==='/design-editor/general.html'||
    path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html')
  ))return;

  const CARD_ID='designPrintProductionStage2Tools';
  const QR_DETAILS_ID='designQrCodeTools';
  const STYLE_ID='designPrintProductionStage2Styles';
  const MODAL_ID='designPressPreflightModal';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const FOLD_BUFFER_MM=2.5;
  const QR_MIN_MM=20;
  const PRESS_PAD_MM=8;
  const MARK_LENGTH_MM=5;
  const MARK_GAP_MM=1.5;
  const QR_LIB='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  const QR_UTF8_LIB='https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode_UTF8.js';
  let installed=false;
  let busy=false;
  let qrLoadPromise=null;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeName=value=>String(value||'design').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,80)||'design';
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');
    if(!node)return;
    node.className=`editor-status ${type}`;
    node.textContent=message;
  }

  function approxTextHeight(item){
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length);
    const sizeMm=Math.max(1,Number(item?.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item?.lineHeight)||1.26));
  }

  function rectFor(item){
    if(item?.type==='text')return{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(0,Number(item.w)||0),h:approxTextHeight(item)};
    return{x:Number(item?.x)||0,y:Number(item?.y)||0,w:Math.max(0,Number(item?.w)||0),h:Math.max(0,Number(item?.h)||0)};
  }

  function crossesYFold(rect,fold){
    return rect.y<fold+FOLD_BUFFER_MM&&rect.y+rect.h>fold-FOLD_BUFFER_MM;
  }

  function crossesXFold(rect,fold){
    return rect.x<fold+FOLD_BUFFER_MM&&rect.x+rect.w>fold-FOLD_BUFFER_MM;
  }

  function stageIssue(level,surface,item,kind,label,detail=''){
    return{level,surfaceId:surface?.id||'',surfaceLabel:surface?.label||'작업면',itemId:item?.id||'',itemType:item?.type||'',kind,label,detail};
  }

  function inspectStage2Project(p=project()){
    const issues=[];
    if(!p)return{issues,fatalCount:0,warningCount:0};
    const safe=clamp(Number(p.safe)||0,0,Math.min(Number(p.width)||0,Number(p.height)||0)/2);
    const width=Math.max(0,Number(p.width)||0),height=Math.max(0,Number(p.height)||0);

    for(const surface of p.surfaces||[]){
      const yFolds=(surface?.foldsY||[]).map(Number).filter(Number.isFinite);
      for(const item of (surface?.elements||[]).filter(entry=>entry?.visible!==false&&entry?.type==='text')){
        const rect=rectFor(item);
        if(yFolds.some(fold=>crossesYFold(rect,fold))){
          issues.push(stageIssue('warning',surface,item,'fold-y','글씨가 상하 접지선 가까이에 있습니다.','접는 위치에서 글씨가 꺾이지 않도록 위아래로 조금 이동하세요.'));
        }
      }
      for(const item of (surface?.extras||[]).filter(entry=>entry?.visible!==false&&entry?.type==='image')){
        const rect=rectFor(item);
        if(yFolds.some(fold=>crossesYFold(rect,fold))){
          issues.push(stageIssue('warning',surface,item,'image-fold-y','이미지가 상하 접지선 가까이에 있습니다.','중요한 얼굴·로고·QR 코드가 접지선에 걸리지 않는지 확인하세요.'));
        }
        if(!item.qrCodeV1)continue;
        const minSide=Math.min(rect.w,rect.h);
        if(minSide<QR_MIN_MM){
          issues.push(stageIssue('warning',surface,item,'qr-small',`QR 코드가 ${Math.round(minSide*10)/10}mm로 작습니다.`,`안정적인 인쇄 인식을 위해 ${QR_MIN_MM}mm 이상을 권장합니다.`));
        }
        const outside=rect.x<safe-.2||rect.y<safe-.2||rect.x+rect.w>width-safe+.2||rect.y+rect.h>height-safe+.2;
        if(outside){
          issues.push(stageIssue('warning',surface,item,'qr-safe','QR 코드가 안전여백 밖에 있습니다.','재단 오차와 인식 여백을 고려해 QR 코드를 안전영역 안쪽으로 이동하세요.'));
        }
        const xFolds=(surface?.folds||[]).map(Number).filter(Number.isFinite);
        if(xFolds.some(fold=>crossesXFold(rect,fold))){
          issues.push(stageIssue('warning',surface,item,'qr-fold-x','QR 코드가 좌우 접지선과 겹칩니다.','QR 코드는 접히지 않는 평평한 면에 두는 것이 안전합니다.'));
        }
        if(!String(item.qrText||'').trim()){
          issues.push(stageIssue('fatal',surface,item,'qr-data-missing','QR 코드 원문 정보가 없습니다.','QR 코드를 삭제하고 다시 생성하세요.'));
        }
      }
    }
    return{
      issues,
      fatalCount:issues.filter(item=>item.level==='fatal').length,
      warningCount:issues.filter(item=>item.level==='warning').length
    };
  }

  function mergeSummary(base,extra){
    const items=[];
    const seen=new Set();
    for(const item of [...(base?.issues||[]),...(extra?.issues||[])]){
      const key=[item.level,item.surfaceId||item.surfaceLabel,item.itemId,item.kind,item.label].join('|');
      if(seen.has(key))continue;
      seen.add(key);items.push(item);
    }
    return{
      ...(base||{}),
      issues:items,
      fatalCount:items.filter(item=>item.level==='fatal').length,
      warningCount:items.filter(item=>item.level==='warning').length,
      surfaceCount:Number(base?.surfaceCount)||Number(project()?.surfaces?.length)||0,
      checkedAt:Date.now()
    };
  }

  function updateFinalCheckCard(summary){
    const title=byId('designFinalCheckTitle'),note=byId('designFinalCheckNote'),badge=byId('designFinalCheckBadge');
    if(!title||!note||!badge)return;
    badge.className='final-check-badge';
    if(summary.fatalCount){title.textContent='출력 불가 항목이 있습니다.';note.textContent='오류 항목을 먼저 해결해야 합니다.';badge.textContent=`오류 ${summary.fatalCount}`;badge.classList.add('fatal');}
    else if(summary.warningCount){title.textContent='인쇄 전 확인이 필요합니다.';note.textContent='접지·QR·도련·이미지 경고를 확인하세요.';badge.textContent=`경고 ${summary.warningCount}`;badge.classList.add('warn');}
    else{title.textContent='인쇄 준비가 완료됐습니다.';note.textContent=`${summary.surfaceCount}개 면을 검사했고 문제를 찾지 못했습니다.`;badge.textContent='인쇄 적합';badge.classList.add('ok');}
  }

  function enhanceFinalPrintCheck(){
    const base=window.DesignEditorFinalPrintCheck;
    if(!base||base.__stage2Enhanced)return false;
    const baseInspect=base.inspectProject?.bind(base);
    const baseShow=base.showSummary?.bind(base);
    if(typeof baseInspect!=='function'||typeof baseShow!=='function')return false;

    async function inspectProject(){
      const original=await baseInspect();
      return mergeSummary(original,inspectStage2Project());
    }
    async function runInspection(){
      const button=byId('designFinalCheckBtn');
      if(button){button.disabled=true;button.textContent='검사 중…';}
      try{
        const summary=await inspectProject();
        window.DesignEditorFinalPrintCheck.lastSummary=summary;
        updateFinalCheckCard(summary);
        return summary;
      }finally{
        if(button){button.disabled=false;button.textContent='전체 인쇄 검사 실행';}
      }
    }
    async function confirmBeforeOutput(options={}){
      const summary=await runInspection();
      if(!summary)return false;
      if(summary.fatalCount){await baseShow(summary,{allowContinue:false,format:options.format});return false;}
      if(!summary.warningCount){setStatus('최종 인쇄 검사 통과 · 출력 파일을 생성합니다.','ok');return true;}
      return baseShow(summary,{allowContinue:true,format:options.format});
    }

    base.inspectProject=inspectProject;
    base.runInspection=runInspection;
    base.confirmBeforeOutput=confirmBeforeOutput;
    base.__stage2Enhanced=true;
    base.stage='all-surfaces-final-print-gate-stage2';

    const oldButton=byId('designFinalCheckBtn');
    if(oldButton&&!oldButton.dataset.stage2Bound){
      const replacement=oldButton.cloneNode(true);
      replacement.dataset.stage2Bound='true';
      oldButton.replaceWith(replacement);
      replacement.addEventListener('click',async()=>{
        const summary=await runInspection();
        if(summary)await baseShow(summary,{allowContinue:false});
      });
    }
    return true;
  }

  function loadScriptOnce(id,src){
    return new Promise((resolve,reject)=>{
      let script=byId(id);
      if(script?.dataset.loaded==='true'){resolve(script);return;}
      if(!script){script=document.createElement('script');script.id=id;script.src=src;script.async=true;document.head.appendChild(script);}
      const timer=setTimeout(()=>reject(new Error('외부 모듈 로드 시간이 초과되었습니다.')),8000);
      const done=(fn,value)=>{clearTimeout(timer);fn(value);};
      script.addEventListener('load',()=>{script.dataset.loaded='true';done(resolve,script);},{once:true});
      script.addEventListener('error',()=>done(reject,new Error('외부 모듈을 불러오지 못했습니다.')),{once:true});
    });
  }

  async function ensureQrLibrary(){
    if(typeof window.qrcode==='function')return window.qrcode;
    if(qrLoadPromise)return qrLoadPromise;
    qrLoadPromise=(async()=>{
      await loadScriptOnce('designQrGeneratorLibrary',QR_LIB);
      if(typeof window.qrcode!=='function')throw new Error('QR 코드 생성 모듈을 확인하지 못했습니다.');
      try{await loadScriptOnce('designQrGeneratorUtf8Library',QR_UTF8_LIB);}catch(error){console.warn('QR UTF-8 helper loading failed',error);}
      return window.qrcode;
    })().finally(()=>{qrLoadPromise=null;});
    return qrLoadPromise;
  }

  function activeSurface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }

  function persistProject(source='print-production-stage2'){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }

  async function addQrCode(options={}){
    const text=String(options.text??byId('designQrText')?.value??'').trim();
    if(!text)throw new Error('QR 코드에 넣을 주소 또는 내용을 입력하세요.');
    if(text.length>1200)throw new Error('QR 코드 내용은 1,200자 이하로 입력하세요.');
    const sizeMm=clamp(Number(options.sizeMm??byId('designQrSize')?.value)||30,15,80);
    const qrFactory=await ensureQrLibrary();
    const qr=qrFactory(0,'M');
    qr.addData(text,'Byte');
    qr.make();
    const src=qr.createDataURL(10,40);
    if(!String(src).startsWith('data:image/'))throw new Error('QR 코드 이미지를 만들지 못했습니다.');
    const p=project(),surface=activeSurface();
    if(!p||!surface)throw new Error('먼저 디자인 작업을 시작하세요.');
    if(!Array.isArray(surface.extras))surface.extras=[];
    const item={
      id:uid('design_qr'),type:'image',name:'QR 코드',src,aspect:1,
      x:Math.max(0,(Number(p.width)-sizeMm)/2),y:Math.max(0,(Number(p.height)-sizeMm)/2),
      w:sizeMm,h:sizeMm,fit:'contain',focusX:50,focusY:50,opacity:100,locked:false,visible:true,
      qrCodeV1:true,qrText:text,qrQuietZoneModules:4
    };
    surface.extras.push(item);
    persistProject('qr-code-add');
    window.DesignEditorPhase2?.sync?.();
    setTimeout(()=>document.querySelector(`[data-extra-id="${item.id}"]`)?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})),60);
    setStatus(`QR 코드를 ${sizeMm}mm 크기로 추가했습니다. 인쇄 전 검사가 크기와 위치를 확인합니다.`,'ok');
    return item;
  }

  function installQrTools(){
    const phase2=byId('designPhase2Tools');
    if(!phase2||byId(QR_DETAILS_ID))return Boolean(phase2);
    const details=document.createElement('details');
    details.id=QR_DETAILS_ID;
    details.className='design-qr-tools';
    details.innerHTML='<summary>QR 코드 추가</summary><div class="design-qr-body"><label>주소 · 내용<input id="designQrText" type="text" maxlength="1200" placeholder="https://example.com"></label><label>인쇄 크기 mm<input id="designQrSize" type="number" min="15" max="80" step="1" value="30"></label><button id="designQrAddBtn" type="button">QR 코드 만들기</button><div class="design-qr-note">내용은 외부 서버로 보내지 않고 브라우저에서 QR 이미지로 만듭니다. 20mm 이상을 권장합니다.</div></div>';
    phase2.appendChild(details);
    byId('designQrAddBtn')?.addEventListener('click',async()=>{
      const button=byId('designQrAddBtn');if(button)button.disabled=true;
      try{await addQrCode();}catch(error){setStatus(error.message||'QR 코드를 만들지 못했습니다.','err');}
      finally{if(button)button.disabled=false;}
    });
    return true;
  }

  function ensurePdfLoader(){
    if(window.CoverJsPdfLoader)return Promise.resolve(window.CoverJsPdfLoader);
    return new Promise((resolve,reject)=>{
      let script=byId('designStage2JsPdfLoader');
      if(script){script.addEventListener('load',()=>resolve(window.CoverJsPdfLoader),{once:true});script.addEventListener('error',()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.')),{once:true});return;}
      script=document.createElement('script');script.id='designStage2JsPdfLoader';script.src='/js/cover-jspdf-loader.js?v=20260806-1';
      script.onload=()=>window.CoverJsPdfLoader?resolve(window.CoverJsPdfLoader):reject(new Error('PDF 출력 모듈을 확인하지 못했습니다.'));
      script.onerror=()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  function drawCropMarks(pdf,p,offset,rendered){
    if(!pdf||!offset)return 0;
    const bleed=Math.max(0,Number(p.bleed)||0);
    const trimL=offset+bleed,trimT=offset+bleed;
    const trimR=trimL+Number(p.width||0),trimB=trimT+Number(p.height||0);
    const artL=offset,artT=offset,artR=offset+Number(rendered.totalW||0),artB=offset+Number(rendered.totalH||0);
    const left1=Math.max(.5,artL-MARK_GAP_MM-MARK_LENGTH_MM),left2=Math.max(.5,artL-MARK_GAP_MM);
    const right1=artR+MARK_GAP_MM,right2=right1+MARK_LENGTH_MM;
    const top1=Math.max(.5,artT-MARK_GAP_MM-MARK_LENGTH_MM),top2=Math.max(.5,artT-MARK_GAP_MM);
    const bottom1=artB+MARK_GAP_MM,bottom2=bottom1+MARK_LENGTH_MM;
    pdf.setDrawColor?.(0,0,0);pdf.setLineWidth?.(.15);
    const lines=[
      [left1,trimT,left2,trimT],[left1,trimB,left2,trimB],
      [right1,trimT,right2,trimT],[right1,trimB,right2,trimB],
      [trimL,top1,trimL,top2],[trimR,top1,trimR,top2],
      [trimL,bottom1,trimL,bottom2],[trimR,bottom1,trimR,bottom2]
    ];
    lines.forEach(args=>pdf.line?.(...args));
    return lines.length;
  }

  async function generatePressPdf(options={}){
    const output=window.DesignEditorOutput,p=project();
    if(!output||!p?.surfaces?.length)throw new Error('디자인 출력 모듈이 준비되지 않았습니다.');
    const includeMarks=options.includeMarks!==false;
    const profile=output.selectedPdfProfile?.()||{id:'standard',label:'표준 PDF',extension:'300dpi'};
    const spec=output.expectedOutputSpec(p);
    const loader=await ensurePdfLoader(),JsPdf=await loader.ensure();
    let pdf=null,renderedCount=0,markCount=0;
    const pages=[];
    for(let index=0;index<p.surfaces.length;index+=1){
      const surface=p.surfaces[index];
      const rendered=await output.renderSurface(p,surface);
      output.verifyRenderedSurface(rendered,spec);
      const offset=includeMarks?PRESS_PAD_MM:0;
      const pageW=rendered.totalW+offset*2,pageH=rendered.totalH+offset*2;
      const orientation=pageW>=pageH?'landscape':'portrait';
      if(!pdf)pdf=new JsPdf({orientation,unit:'mm',format:[pageW,pageH],compress:true});
      else pdf.addPage([pageW,pageH],orientation);
      const image=output.pdfImagePayload(rendered.canvas,profile);
      pdf.addImage(image.data,image.format,offset,offset,rendered.totalW,rendered.totalH,undefined,image.compression);
      if(includeMarks)markCount+=drawCropMarks(pdf,p,offset,rendered);
      pages.push({widthMm:pageW,heightMm:pageH,artworkWidthMm:rendered.totalW,artworkHeightMm:rendered.totalH,offsetMm:offset});
      renderedCount+=1;
    }
    const pageCount=output.verifyPdfDocument(pdf,spec,renderedCount);
    pdf.setProperties?.({title:String(p.name||'Design'),subject:'Program Studio press-ready PDF'});
    const blob=pdf.output('blob');
    if(!(blob instanceof Blob)||blob.size<1)throw new Error('인쇄소용 PDF 데이터를 만들지 못했습니다.');
    const suffix=includeMarks?'press_cropmarks':'press';
    return{blob,filename:`${safeName(p.name)}_${suffix}.pdf`,pageCount,markCount,profile,pages,includeMarks,spec};
  }

  function storageScript(){
    if(window.firebase?.storage)return Promise.resolve(window.firebase.storage());
    return loadScriptOnce('designStage2FirebaseStorage','https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js').then(()=>{
      if(!window.firebase?.storage)throw new Error('대용량 검사 저장소를 초기화하지 못했습니다.');
      return window.firebase.storage();
    });
  }

  async function readApiError(response,fallback){
    const type=response.headers?.get?.('content-type')||'';
    if(type.includes('application/json')){
      const body=await response.json().catch(()=>null);
      return body?.detail||body?.message||fallback;
    }
    return (await response.text().catch(()=>''))||fallback;
  }

  async function checkGeneratedPdf(blob,filename,options={}){
    const user=window.auth?.currentUser;
    if(!user)throw new Error('로그인 정보를 확인할 수 없습니다.');
    const token=await user.getIdToken(true);
    const onStatus=typeof options.onStatus==='function'?options.onStatus:()=>{};
    if(blob.size<=20*1024*1024){
      onStatus('실제 생성 PDF를 서버에서 검사 중입니다.');
      const form=new FormData();form.append('file',blob,filename||'design.pdf');
      const response=await fetch('/api/preflight/check',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
      if(!response.ok)throw new Error(await readApiError(response,`PDF 검사 오류 (${response.status})`));
      return response.json();
    }
    onStatus('대용량 PDF를 임시 업로드해 검사 중입니다.');
    const storage=await storageScript();
    const session=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    const path=`preflight_temp/${user.uid}/${session}/${safeName(filename||'design.pdf')}`;
    const ref=storage.ref(path);
    let uploaded=false;
    try{
      await ref.put(blob,{contentType:'application/pdf'});uploaded=true;
      const response=await fetch('/api/preflight/check-storage',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({storage_path:path,filename:filename||'design.pdf'})});
      if(!response.ok)throw new Error(await readApiError(response,`PDF 검사 오류 (${response.status})`));
      uploaded=false;
      return response.json();
    }finally{
      if(uploaded)try{await ref.delete();}catch(_){}
    }
  }

  function preflightStats(report){
    const checks=Array.isArray(report?.checks)?report.checks:[];
    return{
      fail:checks.filter(item=>item.severity==='fail').length,
      warning:checks.filter(item=>item.severity==='warning').length,
      pass:checks.filter(item=>item.severity==='pass').length,
      checks
    };
  }

  function downloadBlob(blob,name){
    const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1600);
  }

  function closePreflightModal(){byId(MODAL_ID)?.remove();}

  function showPreflightModal(report,result){
    closePreflightModal();
    const stats=preflightStats(report),canSave=stats.fail===0;
    const overlay=document.createElement('div');overlay.id=MODAL_ID;overlay.className='press-preflight-modal';
    const items=stats.checks.filter(item=>item.severity!=='pass').slice(0,10);
    overlay.innerHTML=`<section class="press-preflight-panel" role="dialog" aria-modal="true"><div class="press-preflight-head"><div><h2>실제 생성 PDF 인쇄 검사</h2><p>${esc(result.filename)} · ${Number(report?.page_count)||result.pageCount}페이지 · 검사점수 ${Number(report?.score)||0}</p></div></div><div class="press-preflight-stats"><div><b>${stats.fail}</b><span>수정 필요</span></div><div><b>${stats.warning}</b><span>확인 경고</span></div><div><b>${stats.pass}</b><span>통과</span></div></div>${items.length?`<div class="press-preflight-list">${items.map(item=>`<div class="press-preflight-item ${item.severity}"><strong>${esc(item.label||item.id)}</strong><span>${esc(item.detail||'검사 내용을 확인하세요.')}</span></div>`).join('')}</div>`:'<div class="press-preflight-ok">실제 생성된 PDF에서 우선 수정이 필요한 문제를 찾지 못했습니다.</div>'}<div class="press-preflight-rgb">현재 디자인 출력은 RGB 300DPI입니다. CMYK/ICC 변환은 인쇄소의 프로파일을 확인한 뒤 별도 변환하는 것이 안전합니다.</div><div class="press-preflight-actions"><button type="button" class="back">편집으로 돌아가기</button><button type="button" class="save"${canSave?'':' disabled'}>${stats.warning?'경고 확인 후 검사한 PDF 저장':'검사한 PDF 저장'}</button></div></section>`;
    document.body.appendChild(overlay);
    return new Promise(resolve=>{
      const finish=value=>{overlay.remove();resolve(value);};
      overlay.querySelector('.back')?.addEventListener('click',()=>finish(false));
      overlay.querySelector('.save')?.addEventListener('click',()=>{if(canSave)finish(true);});
      overlay.addEventListener('click',event=>{if(event.target===overlay)finish(false);});
    });
  }

  async function exportPressReady(){
    if(busy)return;
    const p=project();if(!p)return setStatus('먼저 디자인 작업을 시작하세요.','err');
    const gate=window.DesignEditorFinalPrintCheck?.confirmBeforeOutput;
    if(gate&&!(await gate({format:'press-pdf'})))return;
    busy=true;
    const button=byId('designPressPdfBtn');if(button)button.disabled=true;
    try{
      const includeMarks=byId('designPressCropMarks')?.checked!==false;
      setStatus('인쇄소용 300DPI PDF를 만드는 중입니다.','info');
      const result=await generatePressPdf({includeMarks});
      const report=await checkGeneratedPdf(result.blob,result.filename,{onStatus:message=>setStatus(message,'info')});
      const shouldSave=await showPreflightModal(report,result);
      if(!shouldSave){setStatus(preflightStats(report).fail?'실제 PDF 검사에서 수정 필요 항목이 있어 저장하지 않았습니다.':'검사 결과를 확인했습니다. 편집을 계속할 수 있습니다.','info');return;}
      downloadBlob(result.blob,result.filename);
      setStatus(`검사한 동일 PDF를 저장했습니다. ${result.pageCount}개 면${includeMarks?' · 재단선 포함':''}.`,'ok');
    }catch(error){
      window.DesignEditorRuntimeDiagnostics?.record?.('press-output-error',error.message||'인쇄소용 PDF 처리 실패');
      setStatus(error.message||'인쇄소용 PDF를 만들거나 검사하지 못했습니다.','err');
    }finally{busy=false;if(button)button.disabled=false;}
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .press-stage2-card{border-color:#c9d9e7!important;background:linear-gradient(180deg,#fff,#f8fbfd)!important}.press-stage2-row{display:flex;align-items:flex-start;gap:7px;font-size:7.5px;line-height:1.45;color:#475569}.press-stage2-row input{margin-top:1px;accent-color:#12396d}.press-stage2-button{width:100%;margin-top:8px;border:0;border-radius:9px;background:#12396d;color:#fff;padding:9px 8px;font-size:8.5px;font-weight:950;cursor:pointer}.press-stage2-button:disabled{opacity:.5;cursor:not-allowed}.press-stage2-note{margin-top:6px;font-size:6.7px;line-height:1.5;color:#7c8797}.press-stage2-badge{display:inline-block;margin-top:6px;border-radius:999px;background:#ecfdf3;color:#067647;padding:3px 6px;font-size:6.5px;font-weight:950}.design-qr-tools{margin-top:8px;border-top:1px solid #e6edf2;padding-top:7px}.design-qr-tools>summary{cursor:pointer;list-style:none;color:#475569;font-size:7.5px;font-weight:950}.design-qr-tools>summary::-webkit-details-marker{display:none}.design-qr-body{display:grid;grid-template-columns:1fr 78px;gap:6px;margin-top:7px}.design-qr-body label{font-size:6.8px;font-weight:900;color:#667085}.design-qr-body input{display:block;width:100%;margin-top:3px;border:1px solid #cfd8e3;border-radius:7px;padding:6px;background:#fff;font-size:8px;color:#344054}.design-qr-body button{grid-column:1/-1;border:1px solid #9fc9d5;border-radius:8px;background:#ecfeff;color:#0e7490;padding:7px;font-size:8px;font-weight:950;cursor:pointer}.design-qr-note{grid-column:1/-1;font-size:6.4px;line-height:1.45;color:#8a94a4}.press-preflight-modal{position:fixed;z-index:11000;inset:0;background:#0f172a80;display:grid;place-items:center;padding:18px}.press-preflight-panel{width:min(660px,94vw);max-height:88vh;overflow:auto;border-radius:16px;background:#fff;padding:18px;box-shadow:0 26px 80px #0f172a4f}.press-preflight-head h2{margin:0;color:#12396d;font-size:17px}.press-preflight-head p{margin:5px 0 0;color:#667085;font-size:9px;line-height:1.5}.press-preflight-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:13px 0}.press-preflight-stats div{border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc;padding:9px;text-align:center}.press-preflight-stats b{display:block;color:#12396d;font-size:16px}.press-preflight-stats span{font-size:7px;color:#667085}.press-preflight-list{display:grid;gap:6px}.press-preflight-item{border:1px solid #fed7aa;border-radius:8px;background:#fffaf5;padding:8px}.press-preflight-item.fail{border-color:#fecaca;background:#fff7f7}.press-preflight-item strong{display:block;font-size:8.5px;color:#344054}.press-preflight-item span{display:block;margin-top:3px;font-size:7.5px;line-height:1.45;color:#667085}.press-preflight-ok{border:1px solid #bbf7d0;border-radius:9px;background:#f0fdf4;padding:11px;color:#166534;font-size:9px;font-weight:900}.press-preflight-rgb{margin-top:9px;border-radius:8px;background:#eff6ff;padding:8px;color:#1e3a8a;font-size:7.5px;line-height:1.5}.press-preflight-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:13px}.press-preflight-actions button{border-radius:9px;padding:9px 12px;font-size:8.5px;font-weight:950;cursor:pointer}.press-preflight-actions .back{border:1px solid #d7dee8;background:#fff;color:#475467}.press-preflight-actions .save{border:0;background:#12396d;color:#fff}.press-preflight-actions .save:disabled{background:#cbd5e1;cursor:not-allowed}
    `;document.head.appendChild(style);
  }

  function installPressCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar');
    if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card press-stage2-card';
    card.innerHTML='<div class="side-label">인쇄소 제출용 PDF</div><label class="press-stage2-row"><input id="designPressCropMarks" type="checkbox" checked><span>재단선 포함 · 현재 도련을 유지하고 바깥 여백에 재단선을 표시합니다.</span></label><button id="designPressPdfBtn" class="press-stage2-button" type="button">인쇄소용 PDF · 검사 후 저장</button><div class="press-stage2-note">300DPI로 PDF를 만든 뒤 <b>실제 생성된 동일 PDF</b>를 다시 프리플라이트 검사합니다. 기존 일반 PDF 저장은 그대로 사용할 수 있습니다.</div><span class="press-stage2-badge">실제 PDF 재검사</span>';
    const output=byId('designOutputTools'),finalCheck=byId('designFinalPrintCheckTools'),anchor=output||finalCheck||byId('inspector');
    if(anchor)sidebar.insertBefore(card,anchor);else sidebar.appendChild(card);
    byId('designPressPdfBtn')?.addEventListener('click',exportPressReady);
    return true;
  }

  function install(){
    if(installed)return true;
    if(!window.DesignEditorApp||!window.DesignEditorOutput||!window.DesignEditorFinalPrintCheck||!window.DesignEditorPhase2)return false;
    installed=true;installStyles();enhanceFinalPrintCheck();installPressCard();installQrTools();
    [300,800,1600,3000].forEach(delay=>setTimeout(()=>{enhanceFinalPrintCheck();installPressCard();installQrTools();},delay));
    window.DesignEditorPrintProductionStage2={
      inspectStage2Project,mergeSummary,generatePressPdf,drawCropMarks,checkGeneratedPdf,preflightStats,addQrCode,ensureQrLibrary,exportPressReady,
      constants:{foldBufferMm:FOLD_BUFFER_MM,qrMinMm:QR_MIN_MM,pressPadMm:PRESS_PAD_MM},
      stage:'press-ready-pdf-preflight-vertical-fold-qr-stage2'
    };
    return true;
  }

  function boot(){
    if(install())return;
    [180,420,800,1300,2200,3600,5200,7000,10000,14000,20000].forEach(delay=>setTimeout(install,delay));
    window.addEventListener('programstudio:runtime-script-result',()=>setTimeout(install,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
