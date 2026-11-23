/* Design Bleed Enhancer – upload-first print finishing, no AI design generation. */
(() => {
  'use strict';
  if (window.__designBleedEnhancerV1) return;
  window.__designBleedEnhancerV1 = true;

  const $ = id => document.getElementById(id);
  const MM_PER_PT = 25.4 / 72;
  const ALLOWED = /\.(pdf|jpe?g|png|webp)$/i;
  const MAX_BYTES = 100 * 1024 * 1024;
  const DIRECT_BYTES = 20 * 1024 * 1024;
  const PAPER = {
    a3:[297,420], a4:[210,297], a5:[148,210], b5:[182,257], card:[105,148]
  };
  const MIME = {pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
  const state = {
    file:null, sourcePdf:null, sourceImage:null, originalSize:null,
    resultPdf:null, resultBlob:null, pages:0, loading:false, preparing:false,
    actionId:0, renderQueue:Promise.resolve(), resultSettings:null,
    originalDpi:null
  };

  function status(message, type='') {
    const el=$('statusText');
    el.textContent=message;
    el.className='status'+(type?' '+type:'');
  }
  const mm = value => Number(value).toFixed(1);
  const readNumber = id => Number($(id).value);
  const isPdf = file => /\.pdf$/i.test(file?.name||'');
  const fileExt = file => String(file?.name||'').split('.').pop().toLowerCase();
  const fileLabel = file => String(file?.name||'').replace(/\.(pdf|jpe?g|png|webp)$/i,'');
  function ensurePdfJs() {
    if (!window.pdfjsLib?.getDocument) throw new Error('PDF 미리보기 엔진을 불러오지 못했습니다. 새로고침해 주세요.');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    return window.pdfjsLib;
  }
  async function destroy(doc) {
    if (!doc) return;
    try {await doc.destroy();} catch (_) {}
  }
  function settings() {
    return {
      trim_width_mm:readNumber('trimWidth'),
      trim_height_mm:readNumber('trimHeight'),
      bleed_mm:readNumber('bleedMm'),
      edge_mode:$('edgeMode').value,
      fit_mode:$('fitMode').value
    };
  }
  function isValid() {
    const s=settings();
    return state.file && Number.isFinite(s.trim_width_mm) &&
      Number.isFinite(s.trim_height_mm) &&
      s.trim_width_mm>=10 && s.trim_width_mm<=1500 &&
      s.trim_height_mm>=10 && s.trim_height_mm<=1500 &&
      s.bleed_mm>=1 && s.bleed_mm<=10;
  }
  function ready() {
    $('processBtn').disabled=!isValid()||state.loading||state.preparing;
    $('saveBtn').disabled=!state.resultBlob||state.loading||state.preparing||!$('confirmCheck').checked;
    $('confirmCheck').disabled=!state.resultBlob||state.preparing;
  }
  function sizeSummary() {
    if (!isValid()) {
      $('outputSize').textContent='출력용 PDF 크기: 파일과 완성 크기를 확인해 주세요.';
      return;
    }
    const s=settings();
    const w=s.trim_width_mm+s.bleed_mm*2, h=s.trim_height_mm+s.bleed_mm*2;
    $('outputSize').textContent='완성 '+mm(s.trim_width_mm)+'×'+mm(s.trim_height_mm)+
      'mm → 출력용 '+mm(w)+'×'+mm(h)+'mm (사방 도련 '+mm(s.bleed_mm)+'mm)';
    const original=state.originalSize;
    const actualRatio=original?.[0]/original?.[1], targetRatio=s.trim_width_mm/s.trim_height_mm;
    if (original && Math.abs(actualRatio/targetRatio-1)>0.012) {
      $('fitWarning').textContent=$('fitMode').value==='contain'
        ? '주의: 원본과 완성 크기의 가로세로 비율이 달라 인쇄면 안쪽에 흰 여백이 생길 수 있습니다. 도련이 흰색으로 확장되는지 미리보기에서 확인하세요.'
        : '주의: 원본과 완성 크기의 비율이 달라 일부 내용이 잘릴 수 있습니다. 재단선 가까이 있는 글자와 로고를 꼭 확인하세요.';
    } else {
      $('fitWarning').textContent='도련은 AI 이미지 생성이 아닌 원본 가장자리 반사·늘리기 방식입니다. 사진·패턴·글자가 경계에 걸린 경우 재단 전 결과를 확인해 주세요.';
    }
  }
  function invalidateResult() {
    state.actionId+=1;
    state.resultBlob=null;
    state.resultSettings=null;
    $('confirmCheck').checked=false;
    $('reviewText').textContent='도련 생성이 끝나면 실제 치수와 주의사항을 안내합니다.';
    $('afterEmpty').hidden=false;
    const prior=state.resultPdf;state.resultPdf=null;
    void destroy(prior);
    const canvas=$('afterCanvas');canvas.width=canvas.height=1;
    sizeSummary();
    ready();
  }
  function reset() {
    state.actionId+=1;
    state.file=null;
    state.originalSize=null;
    state.originalDpi=null;
    const source=state.sourcePdf;
    const result=state.resultPdf;
    state.sourcePdf=state.resultPdf=null;
    if(state.sourceImage?.close)state.sourceImage.close();
    state.sourceImage=null;state.resultBlob=null;state.resultSettings=null;
    void destroy(source);void destroy(result);
    state.pages=0;state.loading=false;state.preparing=false;
    $('fileInput').value='';
    $('fileInfo').hidden=true;
    $('fileName').textContent='';
    $('fileMeta').textContent='';
    $('trimWidth').value='';$('trimHeight').value='';
    $('sizePreset').value='source';$('bleedMm').value='3';$('edgeMode').value='mirror';
    $('fitMode').value='contain';$('productType').value='cover';
    $('pageSelect').innerHTML='<option value="1">1</option>';
    $('pageSelect').disabled=true;
    $('beforeEmpty').hidden=false;$('afterEmpty').hidden=false;
    $('beforeCanvas').width=$('beforeCanvas').height=1;
    $('afterCanvas').width=$('afterCanvas').height=1;
    $('confirmCheck').checked=false;
    $('reviewText').textContent='도련 생성이 끝나면 실제 치수와 주의사항을 안내합니다.';
    sizeSummary();ready();status('파일을 업로드하면 시작할 수 있습니다.');
  }
  function populatePages(n) {
    const select=$('pageSelect');
    select.replaceChildren();
    for(let i=1;i<=n;i++){
      const opt=document.createElement('option');
      opt.value=String(i);opt.textContent=i+' / '+n+'페이지';select.appendChild(opt);
    }
    select.disabled=n<2;
  }
  async function receiveFile(file) {
    if(!file) return;
    if(!ALLOWED.test(file.name||'')) return status('PDF, JPG, PNG, WEBP 파일만 지원합니다.','error');
    if(!file.size||file.size>MAX_BYTES) return status('파일 크기는 100MB 이하로 올려주세요.','error');
    reset();state.file=file;state.loading=true;ready();const ticket=state.actionId;
    status('원본 크기와 페이지를 확인하는 중입니다.');
    try {
      if (isPdf(file)) {
        const lib=ensurePdfJs();
        const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        if(ticket!==state.actionId){await destroy(doc);return;}
        const p=await doc.getPage(1);
        const viewport=p.getViewport({scale:1});
        state.sourcePdf=doc;
        state.pages=doc.numPages;
        state.originalSize=[viewport.width*MM_PER_PT,viewport.height*MM_PER_PT];
        state.originalDpi=null;
      } else {
        const image=await createImageBitmap(file);
        if(ticket!==state.actionId){image.close();return;}
        state.sourceImage=image;
        state.pages=1;
        state.originalSize=[image.width*25.4/300,image.height*25.4/300];
        state.originalDpi=300;
      }
      $('trimWidth').value=state.originalSize[0].toFixed(1);
      $('trimHeight').value=state.originalSize[1].toFixed(1);
      $('sizePreset').value='source';
      $('fileInfo').hidden=false;
      $('fileName').textContent=file.name;
      $('fileMeta').textContent=(file.size/1048576).toFixed(1)+'MB · '+state.pages+
        '페이지 · '+(isPdf(file)?'실제 PDF 페이지 크기 자동 인식':'이미지는 300DPI 기준으로 크기 추정');
      $('beforeEmpty').hidden=true;
      populatePages(state.pages);
      await drawPreviews();
      status('원본을 불러왔습니다. 완성 크기와 도련을 확인하고 보완해 주세요.','success');
    } catch(error){
      status(error?.message||'원본을 읽지 못했습니다.','error');
      $('beforeEmpty').hidden=false;
    } finally {
      state.loading=false;sizeSummary();ready();
    }
  }
  // Single-page inspection can use more of the right-side workspace; comparison
  // stays capped to keep both originals comfortably visible side-by-side.
  function previewRenderWidth() {
    const grid=$('previewGrid');
    const single=grid?.dataset.previewMode!=='compare';
    const available=grid?.clientWidth||840;
    return Math.min(single?900:540,Math.max(420,single?available-76:(available-54)/2));
  }
  function drawImage(image,canvas) {
    const maxWidth=previewRenderWidth(), maxHeight=720;
    const scale=Math.min(maxWidth/image.width,maxHeight/image.height,1);
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
  }
  async function drawPdf(doc,pageNumber,canvas) {
    const page=await doc.getPage(pageNumber);
    const natural=page.getViewport({scale:1});
    const scale=Math.min(previewRenderWidth()/natural.width,720/natural.height);
    const viewport=page.getViewport({scale});
    canvas.width=Math.max(1,Math.round(viewport.width));
    canvas.height=Math.max(1,Math.round(viewport.height));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport,background:'#fff'}).promise;
  }
  function guideLines(canvas) {
    if(!state.resultSettings||!canvas.width)return;
    const s=state.resultSettings;
    const totalW=s.trim_width_mm+2*s.bleed_mm;
    const totalH=s.trim_height_mm+2*s.bleed_mm;
    const x=s.bleed_mm/totalW*canvas.width,y=s.bleed_mm/totalH*canvas.height;
    const w=s.trim_width_mm/totalW*canvas.width,h=s.trim_height_mm/totalH*canvas.height;
    const ctx=canvas.getContext('2d');
    ctx.save();
    ctx.lineWidth=1.5;ctx.strokeStyle='#de6767';ctx.setLineDash([6,4]);
    ctx.strokeRect(.75,.75,canvas.width-1.5,canvas.height-1.5);
    ctx.strokeStyle='#2563eb';ctx.setLineDash([7,4]);ctx.strokeRect(x,y,w,h);
    const safe=readNumber('safetyMm'), sx=safe/totalW*canvas.width,sy=safe/totalH*canvas.height;
    ctx.strokeStyle='#0f9488';ctx.setLineDash([4,4]);
    if(w>2*sx&&h>2*sy)ctx.strokeRect(x+sx,y+sy,w-2*sx,h-2*sy);
    const type=$('productType').value;
    const divisions=type==='leaflet2'?2:type==='leaflet3'?3:0;
    if(divisions){
      ctx.setLineDash([4,5]);ctx.strokeStyle='#ad6a13';ctx.lineWidth=1;
      for(let i=1;i<divisions;i++){
        const xx=x+w*i/divisions;
        ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function drawPreviews() {
    const pageNumber=Math.max(1,Math.min(state.pages||1,Number($('pageSelect').value||1)));
    const source=state.sourcePdf, result=state.resultPdf, image=state.sourceImage;
    const run=async()=>{
      if(source) await drawPdf(source,pageNumber,$('beforeCanvas'));
      else if(image) drawImage(image,$('beforeCanvas'));
      if(result){
        await drawPdf(result,pageNumber,$('afterCanvas'));
        guideLines($('afterCanvas'));
        $('afterEmpty').hidden=true;
      }
    };
    state.renderQueue=state.renderQueue.catch(()=>{}).then(run);
    return state.renderQueue.catch(error=>status('미리보기를 표시하지 못했습니다: '+error.message,'error'));
  }
  async function storage() {
    if(window.storage)return window.storage;
    if(window.firebase?.storage)return window.firebase.storage();
    throw new Error('대용량 임시 저장소를 사용할 수 없습니다.');
  }
  async function receiveResult(response) {
    let info=null;
    const ct=response.headers.get('content-type')||'';
    if(!response.ok) {
      info=await response.json().catch(()=>null);
      throw new Error(info?.detail||'도련 생성에 실패했습니다. ('+response.status+')');
    }
    if(!ct.includes('application/json')) return response.blob();
    info=await response.json();
    if(info?.delivery!=='storage'||!info.download_url) throw new Error('PDF 다운로드 정보가 올바르지 않습니다.');
    const download=await fetch(info.download_url,{cache:'no-store'});
    if(!download.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob=await download.blob();
    if(info.storage_path){
      try{(await storage()).ref(info.storage_path).delete().catch(()=>{});}catch(_){}
    }
    return blob;
  }
  async function requestBleed(file, params) {
    const user=window.auth?.currentUser;
    if(!user)throw new Error('로그인이 필요합니다.');
    const token=await user.getIdToken(true);
    if(file.size<=DIRECT_BYTES){
      const form=new FormData();
      form.append('file',file);form.append('params',JSON.stringify(params));
      return receiveResult(await fetch('/api/design-bleed/extend',{
        method:'POST',headers:{Authorization:'Bearer '+token},body:form
      }));
    }
    const st=await storage();
    const session=Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
    const extension=fileExt(file);
    const sourcePath='preflight_temp/'+user.uid+'/'+session+'/source.'+extension;
    try{
      status('대용량 원본을 임시 업로드하는 중입니다.');
      await st.ref(sourcePath).put(file,{contentType:MIME[extension]||'application/octet-stream'});
      return receiveResult(await fetch('/api/design-bleed/extend-storage',{
        method:'POST',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        body:JSON.stringify({storage_path:sourcePath,params})
      }));
    }finally{
      try{await st.ref(sourcePath).delete();}catch(_){}
    }
  }
  async function processFile() {
    if(!isValid()||state.preparing||state.loading)return;
    invalidateResult();
    const ticket=state.actionId,file=state.file, params=settings();
    state.preparing=true;ready();
    try{
      status('원본 디자인을 보존하면서 외곽 도련을 생성하고 있습니다.');
      const blob=await requestBleed(file,params);
      if(ticket!==state.actionId||state.file!==file)return;
      const lib=ensurePdfJs();
      const doc=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
      if(ticket!==state.actionId){await destroy(doc);return;}
      state.resultPdf=doc;state.resultBlob=blob;state.resultSettings=params;
      await drawPreviews();
      const totalW=params.trim_width_mm+params.bleed_mm*2;
      const totalH=params.trim_height_mm+params.bleed_mm*2;
      let note='완성 '+mm(params.trim_width_mm)+'×'+mm(params.trim_height_mm)+
        'mm / 출력 '+mm(totalW)+'×'+mm(totalH)+'mm. 원본 PDF의 텍스트·벡터는 완성 영역에 유지되고 새 도련 부분만 이미지로 만들어집니다.';
      if(!isPdf(file))note+=' 이미지 원본의 실제 인쇄 해상도는 파일 픽셀 수와 완성 크기에 따라 결정됩니다.';
      if(params.fit_mode==='cover')note+=' 원본·완성 비율이 다른 경우 일부가 잘렸을 수 있습니다.';
      if(params.edge_mode==='mirror')note+=' 거울 반사 특성상 경계 무늬가 반복될 수 있습니다.';
      if(['leaflet2','leaflet3'].includes($('productType').value))note+=' 리플렛 접지선은 미리보기만 제공하며 패널 규격·접지 순서는 조정하지 않습니다.';
      note+=' AI 재구성이 아니므로 얼굴·글자·불규칙한 배경의 가장자리는 반드시 확대해 확인하세요.';
      $('reviewText').textContent=note;
      status('도련 생성 완료. 모든 페이지를 비교한 뒤 확인란을 선택해 저장하세요.','success');
    }catch(error){
      if(ticket===state.actionId)status(error?.message||'도련 생성에 실패했습니다.','error');
    }finally {
      state.preparing=false;ready();
    }
  }
  function savePdf() {
    if(!state.resultBlob||!$('confirmCheck').checked||state.preparing)return;
    const s=state.resultSettings;
    const name=fileLabel(state.file)+'_도련'+String(s.bleed_mm).replace('.','_')+'mm.pdf';
    const url=URL.createObjectURL(state.resultBlob);
    const link=document.createElement('a');
    link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    status('출력용 PDF 다운로드를 시작했습니다. 최종 재단 전 실제 시험 출력을 권장합니다.','success');
  }
  function updatePreset() {
    const value=$('sizePreset').value;
    let size=PAPER[value];
    if(value==='source')size=state.originalSize;
    if(size){$('trimWidth').value=size[0].toFixed(1);$('trimHeight').value=size[1].toFixed(1);}
    invalidateResult();
  }
  function setPreviewMode(mode) {
    const grid=$('previewGrid');
    if(!grid||!['compare','original','result'].includes(mode))return;
    grid.dataset.previewMode=mode;
    document.querySelectorAll('button[data-preview-mode]').forEach(button=>{
      const active=button.dataset.previewMode===mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    if(state.file)void drawPreviews();
  }
  function setup() {
    $('resetBtn').addEventListener('click',reset);
    $('logoutBtn').addEventListener('click',async()=>{
      if(!window.auth?.currentUser)return;
      $('logoutBtn').disabled=true;
      try{await window.auth.signOut();reset();}
      catch(error){status('로그아웃하지 못했습니다. 다시 시도해 주세요.','error');}
      finally{$('logoutBtn').disabled=false;}
    });
    document.querySelectorAll('button[data-preview-mode]').forEach(button=>{
      button.addEventListener('click',()=>setPreviewMode(button.dataset.previewMode));
    });
    $('processBtn').addEventListener('click',processFile);
    $('saveBtn').addEventListener('click',savePdf);
    $('confirmCheck').addEventListener('change',ready);
    $('pageSelect').addEventListener('change',drawPreviews);
    $('sizePreset').addEventListener('change',updatePreset);
    ['trimWidth','trimHeight','bleedMm','edgeMode','fitMode','productType'].forEach(id=>{
      $(id).addEventListener('change',()=>{
        if(id==='trimWidth'||id==='trimHeight')$('sizePreset').value='custom';
        invalidateResult();
      });
    });
    ['trimWidth','trimHeight','bleedMm'].forEach(id=>$(id).addEventListener('input',()=>{
      invalidateResult();
    }));
    $('safetyMm').addEventListener('change',()=>{
      if(state.resultPdf)void drawPreviews();
    });
    $('fileInput').addEventListener('change',event=>receiveFile(event.target.files?.[0]));
    const zone=$('uploadZone');
    zone.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();$('fileInput').click();}
    });
    ['dragenter','dragover'].forEach(eventName=>zone.addEventListener(eventName,event=>{
      event.preventDefault();zone.classList.add('drag');
    }));
    ['dragleave','drop'].forEach(eventName=>zone.addEventListener(eventName,event=>{
      event.preventDefault();zone.classList.remove('drag');
      if(eventName==='drop')receiveFile([...event.dataTransfer.files].find(f=>ALLOWED.test(f.name||'')));
    }));
    $('helpBtn').addEventListener('click',()=>{
      $('helpGuide').open=true;
      $('helpGuide').scrollIntoView({behavior:'smooth',block:'center'});
    });
    reset();
    window.DesignBleedEnhancer={state,settings,process:processFile,setPreviewMode,version:'2026-11-23-workbench'};
  }
  setup();
  const auth=window.auth;
  if(!auth){
    $('authMessage').textContent='로그인 시스템을 사용할 수 없습니다. 새로고침해 주세요.';
    $('authLogin').hidden=false;return;
  }
  auth.onAuthStateChanged(user=>{
    if(!user){
      $('authMessage').textContent='이 프로그램을 사용하려면 로그인해 주세요.';
      $('authLogin').hidden=false;$('studio').hidden=true;$('authGate').hidden=false;
      return;
    }
    $('authGate').hidden=true;
    $('studio').hidden=false;
  });
})();