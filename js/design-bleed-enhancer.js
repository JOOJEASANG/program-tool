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
    originalDpi:null, edgeSide:'top'
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
      fit_mode:$('fitMode').value,
      ai_quality:$('aiQuality').value,
      ai_side:$('aiSide').value,
      ai_direction:$('aiDirection').value.trim()
    };
  }
  function isValid() {
    const s=settings();
    return state.file && Number.isFinite(s.trim_width_mm) &&
      Number.isFinite(s.trim_height_mm) &&
      s.trim_width_mm>=10 && s.trim_width_mm<=1500 &&
      s.trim_height_mm>=10 && s.trim_height_mm<=1500 &&
      s.bleed_mm>=1 && s.bleed_mm<=10 &&
      (s.edge_mode!=='ai' || (state.pages<=2 && s.ai_direction.length<=200 && $('aiConsent').checked));
  }
  function ready() {
    $('processBtn').disabled=!isValid()||state.loading||state.preparing;
    $('saveBtn').disabled=!state.resultBlob||state.loading||state.preparing||!$('confirmCheck').checked;
    $('confirmCheck').disabled=!state.resultBlob||state.preparing;
  }
  function syncAiOptions() {
    const active=$('edgeMode').value==='ai';
    $('aiBleedOptions').hidden=!active;
    $('processBtn').textContent=active?'AI로 자연스러운 도련 생성':'도련 생성하고 결과 비교하기';
    if(active&&state.file&&state.pages>2){
      status('AI 도련은 최대 2페이지까지 지원합니다. 기본 확장 방식을 선택하거나 PDF를 분할해 주세요.','error');
    } else if(active && !($('aiConsent')?.checked)) {
      status('AI 전송·비용 안내에 동의하면 AI 도련 생성 버튼이 활성화됩니다.');
    }
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
      $('fitWarning').textContent=s.edge_mode==='ai'
        ? 'AI는 실제 원본 배경을 참고해 재단 바깥만 새로 그립니다. 원본 내부는 보호됩니다. 다만 AI 결과는 꼭 확대 검수해야 하며 API 사용량이 발생합니다.'
        : '현재 방식은 원본 가장자리 반사·늘리기입니다. 자연스러운 배경 추론이 필요하면 AI 자연 확장을 선택해 주세요.';
    }
  }
  function invalidateResult() {
    state.actionId+=1;
    state.resultBlob=null;
    state.resultSettings=null;
    $('confirmCheck').checked=false;
    $('reviewText').textContent='도련 생성이 끝나면 실제 치수와 주의사항을 안내합니다.';
    $('afterEmpty').hidden=false;
    $('edgeJumpBtn').disabled=true;
    clearEdgeInspector();
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
    $('aiQuality').value='low';$('aiSide').value='all';$('aiDirection').value='';
    $('aiConsent').checked=false;
    $('edgeMode').value='mirror';syncAiOptions();
    $('pageSelect').innerHTML='<option value="1">1</option>';
    $('pageSelect').disabled=true;
    $('beforeEmpty').hidden=false;$('afterEmpty').hidden=false;
    $('beforeCanvas').width=$('beforeCanvas').height=1;
    $('afterCanvas').width=$('afterCanvas').height=1;
    $('confirmCheck').checked=false;
    $('reviewText').textContent='도련 생성이 끝나면 실제 치수와 주의사항을 안내합니다.';
    $('previewZoom').value='1';
    $('guideToggle').checked=true;
    $('edgeJumpBtn').disabled=true;
    state.edgeSide='top';
    $('edgePosition').value='50';
    document.querySelectorAll('button[data-edge]').forEach(button=>{
      const isTop=button.dataset.edge==='top';
      button.classList.toggle('active',isTop);
      button.setAttribute('aria-pressed',String(isTop));
    });
    clearEdgeInspector();
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
      syncAiOptions();
      status('원본을 불러왔습니다. 완성 크기와 도련을 확인하고 보완해 주세요.','success');
    } catch(error){
      status(error?.message||'원본을 읽지 못했습니다.','error');
      $('beforeEmpty').hidden=false;
    } finally {
      state.loading=false;sizeSummary();ready();
    }
  }
  // Let the user inspect the *actual* PDF at 150–300% without shrinking it
  // back to the width of the canvas card. The viewport scrolls at larger zoom.
  function previewRenderWidth() {
    const grid=$('previewGrid');
    const single=grid?.dataset.previewMode!=='compare';
    const available=grid?.clientWidth||880;
    return Math.max(260,Math.min(single?1500:760,single?available-58:(available-48)/2));
  }
  function previewScale(baseWidth,baseHeight) {
    const zoom=Number($('previewZoom')?.value)||1;
    const fitted=Math.min(previewRenderWidth()/baseWidth,1000/baseHeight);
    // Limit enormous PDFs and pathological zoom levels to a safe canvas size.
    const safe=Math.min(fitted*zoom,Math.sqrt(7000000/(baseWidth*baseHeight)),3000/Math.max(baseWidth,baseHeight));
    return Math.max(0.001,safe);
  }
  function drawImage(image,canvas) {
    const scale=previewScale(image.width,image.height);
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
  }
  async function drawPdf(doc,pageNumber,canvas) {
    const page=await doc.getPage(pageNumber);
    const natural=page.getViewport({scale:1});
    const viewport=page.getViewport({scale:previewScale(natural.width,natural.height)});
    canvas.width=Math.max(1,Math.round(viewport.width));
    canvas.height=Math.max(1,Math.round(viewport.height));
    const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport,background:'#fff'}).promise;
  }
  function guideLines(canvas) {
    if(!state.resultSettings||!canvas.width||!$('guideToggle').checked)return;
    const s=state.resultSettings;
    const totalW=s.trim_width_mm+2*s.bleed_mm;
    const totalH=s.trim_height_mm+2*s.bleed_mm;
    const x=s.bleed_mm/totalW*canvas.width,y=s.bleed_mm/totalH*canvas.height;
    const w=s.trim_width_mm/totalW*canvas.width,h=s.trim_height_mm/totalH*canvas.height;
    const ctx=canvas.getContext('2d');
    ctx.save();
    // Hairline-only guides. They are not part of the exported PDF.
    ctx.lineWidth=0.7;ctx.strokeStyle='#cc6471';ctx.setLineDash([3,5]);
    ctx.strokeRect(.5,.5,canvas.width-1,canvas.height-1);
    ctx.lineWidth=0.85;ctx.strokeStyle='#2563eb';ctx.setLineDash([4,5]);
    ctx.strokeRect(x,y,w,h);
    const safe=readNumber('safetyMm'), sx=safe/totalW*canvas.width,sy=safe/totalH*canvas.height;
    ctx.lineWidth=0.7;ctx.strokeStyle='#0f9488';ctx.setLineDash([3,5]);
    if(w>2*sx&&h>2*sy)ctx.strokeRect(x+sx,y+sy,w-2*sx,h-2*sy);
    const type=$('productType').value;
    const divisions=type==='leaflet2'?2:type==='leaflet3'?3:0;
    if(divisions){
      ctx.setLineDash([3,6]);ctx.strokeStyle='#ad6a13';ctx.lineWidth=0.7;
      for(let i=1;i<divisions;i++){
        const xx=x+w*i/divisions;
        ctx.beginPath();ctx.moveTo(xx,y);ctx.lineTo(xx,y+h);ctx.stroke();
      }
    }
    ctx.restore();
  }
  function clearEdgeInspector() {
    const canvas=$('edgeInspectCanvas');
    if(canvas)canvas.width=canvas.height=1;
    if($('edgeInspectEmpty'))$('edgeInspectEmpty').hidden=false;
    if($('edgeInspectStatus'))$('edgeInspectStatus').textContent='결과 PDF가 준비되면 확대 검사를 표시합니다.';
    if($('edgeBleedSize'))$('edgeBleedSize').textContent='사방 '+(readNumber('bleedMm')||3)+'mm';
  }
  // Calculate a real physical crop (3mm of newly extended bleed + 12mm
  // inside trim). Unlike CSS scaling an existing small preview, this renders
  // directly from the completed PDF at a much higher sampling density.
  function edgeSampleRect(settings,side,position) {
    const b=settings.bleed_mm;
    const width=settings.trim_width_mm+2*b;
    const height=settings.trim_height_mm+2*b;
    const horizontal=side==='top'||side==='bottom';
    const inner=Math.min(12,(horizontal?settings.trim_height_mm:settings.trim_width_mm)*.25);
    const crossSize=horizontal?width:height;
    const length=Math.min(58,Math.max(8,crossSize-2*b));
    const ratio=Math.max(0,Math.min(100,Number(position)||0))/100;
    const shift=(crossSize-length)*ratio;
    if(horizontal){
      return {x:shift,y:side==='top'?0:height-b-inner,
        w:length,h:b+inner,seam:side==='top'?b:inner,vertical:false};
    }
    return {x:side==='left'?0:width-b-inner,y:shift,
      w:b+inner,h:length,seam:side==='left'?b:inner,vertical:true};
  }
  async function drawEdgeInspector(doc,pageNumber,side,token) {
    if(!doc||!state.resultSettings||token!==state.actionId)return;
    const s=state.resultSettings;
    const crop=edgeSampleRect(s,side,$('edgePosition').value);
    const pdfPage=await doc.getPage(pageNumber);
    if(token!==state.actionId||state.resultPdf!==doc)return;
    const viewport=pdfPage.getViewport({scale:4});
    const pxPerMm=viewport.width/(s.trim_width_mm+2*s.bleed_mm);
    const left=crop.x*pxPerMm, top=crop.y*pxPerMm;
    const scratch=document.createElement('canvas');
    scratch.width=Math.max(1,Math.round(crop.w*pxPerMm));
    scratch.height=Math.max(1,Math.round(crop.h*pxPerMm));
    const ctx=scratch.getContext('2d',{alpha:false});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,scratch.width,scratch.height);
    await pdfPage.render({canvasContext:ctx,viewport,
      transform:[1,0,0,1,-left,-top],background:'#fff'}).promise;
    if(token!==state.actionId||state.resultPdf!==doc||state.edgeSide!==side)return;
    // One fine seam marker, never a translucent overlay that hides real fill.
    ctx.save();
    ctx.lineWidth=0.8;ctx.strokeStyle='#2563eb';ctx.setLineDash([4,5]);
    const at=crop.seam*pxPerMm;
    ctx.beginPath();
    if(crop.vertical){ctx.moveTo(at,0);ctx.lineTo(at,scratch.height);}
    else{ctx.moveTo(0,at);ctx.lineTo(scratch.width,at);}
    ctx.stroke();ctx.restore();
    const output=$('edgeInspectCanvas');
    if(crop.vertical){
      // Rotate left/right crops for a wide inspection strip.
      output.width=scratch.height;output.height=scratch.width;
      const out=output.getContext('2d',{alpha:false});
      out.translate(output.width,0);out.rotate(Math.PI/2);
      out.drawImage(scratch,0,0);
    }else{
      output.width=scratch.width;output.height=scratch.height;
      output.getContext('2d',{alpha:false}).drawImage(scratch,0,0);
    }
    $('edgeInspectEmpty').hidden=true;
    $('edgeBleedSize').textContent='추가된 바깥 영역 '+s.bleed_mm+'mm';
    const names={top:'상단',bottom:'하단',left:'왼쪽',right:'오른쪽'};
    const location=$('edgePosition').selectedOptions[0]?.textContent||'가운데';
    $('edgeInspectStatus').textContent=names[side]+' '+location+' 도련 확대: '+s.bleed_mm+
      'mm 바깥 확장 + 안쪽 '+Math.round((crop.vertical?crop.w:crop.h)-s.bleed_mm)+'mm까지 실제 PDF 표시'+
      (crop.vertical?' (보기 편하게 90° 회전)':'')+
      '. 파란 점선이 재단 경계입니다.';
  }
  function queueEdgeInspector() {
    const token=state.actionId,doc=state.resultPdf,side=state.edgeSide;
    const pageNumber=Math.max(1,Number($('pageSelect').value)||1);
    if(!doc){clearEdgeInspector();return Promise.resolve();}
    state.renderQueue=state.renderQueue.catch(()=>{}).then(()=>
      drawEdgeInspector(doc,pageNumber,side,token)
    );
    return state.renderQueue.catch(error=>{
      if(token===state.actionId) $('edgeInspectStatus').textContent='확대 검사를 그리지 못했습니다: '+error.message;
    });
  }
  function setEdgeSide(side) {
    if(!['top','bottom','left','right'].includes(side))return;
    state.edgeSide=side;
    document.querySelectorAll('button[data-edge]').forEach(button=>{
      const active=button.dataset.edge===side;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    void queueEdgeInspector();
  }
  function drawPreviews() {
    const pageNumber=Math.max(1,Math.min(state.pages||1,Number($('pageSelect').value||1)));
    const source=state.sourcePdf, result=state.resultPdf, image=state.sourceImage;
    const token=state.actionId,side=state.edgeSide;
    const run=async()=>{
      if(token!==state.actionId)return;
      if(source) await drawPdf(source,pageNumber,$('beforeCanvas'));
      else if(image) drawImage(image,$('beforeCanvas'));
      if(token!==state.actionId)return;
      if(result){
        await drawPdf(result,pageNumber,$('afterCanvas'));
        if(token!==state.actionId)return;
        guideLines($('afterCanvas'));
        $('afterEmpty').hidden=true;
        await drawEdgeInspector(result,pageNumber,side,token);
      }
    };
    state.renderQueue=state.renderQueue.catch(()=>{}).then(run);
    return state.renderQueue.catch(error=>{
      if(token===state.actionId)status('미리보기를 표시하지 못했습니다: '+error.message,'error');
    });
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
    if($('edgeMode').value==='ai'){
      const yes=window.confirm('AI 자연 확장을 실행하면 이미지 API 사용량과 비용이 발생합니다. 원본 안쪽은 그대로 유지하고 바깥 도련만 생성합니다. 진행할까요?');
      if(!yes)return;
    }
    invalidateResult();
    const ticket=state.actionId,file=state.file, params=settings();
    state.preparing=true;ready();
    try{
      status(params.edge_mode==='ai'
        ? 'AI가 원본 배경을 참고하여 바깥 도련만 자연스럽게 생성 중입니다. 페이지마다 API 호출이 발생합니다.'
        : '원본 디자인을 보존하면서 외곽 도련을 생성하고 있습니다.');
      const blob=await requestBleed(file,params);
      if(ticket!==state.actionId||state.file!==file)return;
      const lib=ensurePdfJs();
      const doc=await lib.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise;
      if(ticket!==state.actionId){await destroy(doc);return;}
      state.resultPdf=doc;state.resultBlob=blob;state.resultSettings=params;
      $('edgeJumpBtn').disabled=false;
      await drawPreviews();
      const totalW=params.trim_width_mm+params.bleed_mm*2;
      const totalH=params.trim_height_mm+params.bleed_mm*2;
      let note='완성 '+mm(params.trim_width_mm)+'×'+mm(params.trim_height_mm)+
        'mm / 출력 '+mm(totalW)+'×'+mm(totalH)+'mm. 원본 PDF의 텍스트·벡터는 완성 영역에 유지되고 새 도련 부분만 이미지로 만들어집니다.';
      if(!isPdf(file))note+=' 이미지 원본의 실제 인쇄 해상도는 파일 픽셀 수와 완성 크기에 따라 결정됩니다.';
      if(params.fit_mode==='cover')note+=' 원본·완성 비율이 다른 경우 일부가 잘렸을 수 있습니다.';
      if(params.edge_mode==='mirror')note+=' 거울 반사 특성상 경계 무늬가 반복될 수 있습니다.';
      if(params.edge_mode==='ai')note+=' AI가 선택한 도련 부분을 생성했고, 나머지 방향은 기본 방식으로 확장했습니다. 글자·로고는 재단선 안에 원본대로 보존됩니다.';
      if(['leaflet2','leaflet3'].includes($('productType').value))note+=' 리플렛 접지선은 미리보기만 제공하며 패널 규격·접지 순서는 조정하지 않습니다.';
      note+=params.edge_mode==='ai'
        ? ' AI 결과가 원본 배경과 자연스럽게 연결되는지 네 방향과 모서리를 확대해 확인하세요. 재생성에는 추가 사용량이 발생합니다.'
        : ' 기본 반사·연장은 AI 재구성이 아니므로 경계 패턴을 확대해 확인하세요.';
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
    const name=fileLabel(state.file)+(s.edge_mode==='ai'?'_AI도련':'_도련')+String(s.bleed_mm).replace('.','_')+'mm.pdf';
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
  function toggleWidePreview() {
    const expanded=$('studio').classList.toggle('preview-expanded');
    const button=$('expandPreviewBtn');
    button.setAttribute('aria-pressed',String(expanded));
    button.textContent=expanded?'설정 패널 표시':'미리보기 넓게';
    if(state.file)void drawPreviews();
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
    $('expandPreviewBtn').addEventListener('click',toggleWidePreview);
    $('edgeJumpBtn').addEventListener('click',()=>{
      $('bleedInspector').scrollIntoView({behavior:'smooth',block:'start'});
    });
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
    $('previewZoom').addEventListener('change',drawPreviews);
    $('guideToggle').addEventListener('change',drawPreviews);
    document.querySelectorAll('button[data-edge]').forEach(button=>{
      button.addEventListener('click',()=>setEdgeSide(button.dataset.edge));
    });
    $('edgePosition').addEventListener('change',()=>{void queueEdgeInspector();});
    $('sizePreset').addEventListener('change',updatePreset);
    $('aiConsent').addEventListener('change',ready);
    ['trimWidth','trimHeight','bleedMm','edgeMode','fitMode','productType',
      'aiQuality','aiSide','aiDirection'].forEach(id=>{
      $(id).addEventListener('change',()=>{
        if(id==='trimWidth'||id==='trimHeight')$('sizePreset').value='custom';
        if(id==='edgeMode')syncAiOptions();
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
    window.DesignBleedEnhancer={state,settings,process:processFile,setPreviewMode,setEdgeSide,toggleWidePreview,version:'2026-11-23-bleed-inspector'};
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