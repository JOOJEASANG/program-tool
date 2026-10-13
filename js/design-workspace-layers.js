/* Local PDF/image placement layers for the unified print design workspace.
 * Source bytes remain local. PDF export embeds the original PDF page (not a screenshot).
 */
'use strict';
(() => {
  if (window.DesignWorkspaceLayers) return;
  const MM_PER_PT = 25.4 / 72;
  const MAX_ITEMS = 16;
  const MAX_BYTES = 40 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
  const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const layers = [];
  let activeId = '';
  let nextId = 1;
  let editor = null;
  let pointer = null;
  let pdfJsPromise = null;
  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const validNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const selected = () => layers.find(item => item.id === activeId) || null;
  const hasLayers = () => layers.length > 0;
  const spec = () => editor?.getSpec?.();
  const refresh = () => { updateList(); updateInspector(); updateReview(); editor?.render?.(); };
  const notify = (title, message, tone = 'ok') => editor?.notify?.(title, message, tone);

  function zones(s) {
    if (!s) return {};
    const b = s.bleed, tw = s.trimW, th = s.trimH, wing = s.wing || 0;
    const areas = { whole: {x:0,y:0,w:s.workW,h:s.workH} };
    if (s.coverMode === 'front' || s.coverMode === 'back') {
      areas[s.coverMode] = {x:b,y:b,w:tw,h:th};
    } else if (s.coverMode === 'frontBack') {
      areas.back = {x:b,y:b,w:tw,h:th};
      areas.front = {x:b+tw,y:b,w:tw,h:th};
    } else {
      areas.back = {x:b+wing,y:b,w:tw,h:th};
      areas.spine = {x:b+wing+tw,y:b,w:s.spine,h:th};
      areas.front = {x:b+wing+tw+s.spine,y:b,w:tw,h:th};
    }
    return areas;
  }
  function currentTarget() {
    const desired = $('designLayerTarget')?.value || 'front';
    const rects = zones(spec());
    return rects[desired] ? desired : (rects.front ? 'front' : rects.back ? 'back' : 'whole');
  }
  function fitToTarget(layer, target) {
    const region = zones(spec())[target];
    if (!region) return false;
    const ratio = layer.sourceW / layer.sourceH;
    let w = region.w, h = w / ratio;
    if (h > region.h) { h = region.h; w = h * ratio; }
    layer.x = region.x + (region.w - w) / 2;
    layer.y = region.y + (region.h - h) / 2;
    layer.w = w; layer.h = h; layer.angle = 0; layer.target = target;
    return true;
  }
  function fileType(file) {
    if (file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name || '')) return 'pdf';
    if (/^image\/(png|jpeg|webp)$/.test(file?.type || '') || /\.(png|jpe?g|webp)$/i.test(file?.name || '')) return 'image';
    return '';
  }
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), image = new Image();
      image.onload = () => resolve({image,url,sourceW:image.naturalWidth * 25.4 / 300,sourceH:image.naturalHeight * 25.4 / 300});
      image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 파일을 읽지 못했습니다.')); };
      image.src = url;
    });
  }
  async function ensurePdfJs() {
    if (window.pdfjsLib?.getDocument) return window.pdfjsLib;
    if (!pdfJsPromise) pdfJsPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PDFJS_URL;
      script.onload = () => window.pdfjsLib?.getDocument ? resolve(window.pdfjsLib) : reject(new Error('PDF 미리보기 구성요소가 없습니다.'));
      script.onerror = () => reject(new Error('PDF.js를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'));
      document.head.appendChild(script);
    }).catch(error => { pdfJsPromise = null; throw error; });
    const api = await pdfJsPromise;
    if (api.GlobalWorkerOptions) api.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return api;
  }
  async function renderPdfPage(layer, number) {
    const page = await layer.pdfDocument.getPage(number);
    const raw = page.getViewport({scale:1});
    const factor = Math.min(1.8, 2100 / Math.max(raw.width, raw.height));
    const viewport = page.getViewport({scale:factor});
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    layer.image = canvas;
    layer.sourceW = raw.width * MM_PER_PT;
    layer.sourceH = raw.height * MM_PER_PT;
    layer.pageNumber = number;
  }
  async function addFile(file) {
    if (!file) return;
    if (layers.length >= MAX_ITEMS) throw new Error('한 작업에 최대 16개 파일을 배치할 수 있습니다.');
    if (file.size > MAX_BYTES) throw new Error('파일 한 개는 40MB 이하만 지원합니다.');
    if (layers.reduce((sum,item)=>sum+item.bytes.length,0)+file.size > MAX_TOTAL_BYTES) throw new Error('현재 작업의 업로드 용량은 총 200MB까지 지원합니다.');
    const type = fileType(file);
    if (!type) throw new Error('PDF·PNG·JPG·WEBP 파일만 지원합니다.');
    const layer = {
      id:'asset-'+nextId++, name:file.name, type, image:null, bytes:new Uint8Array(await file.arrayBuffer()),
      sourceW:1,sourceH:1, x:0,y:0,w:1,h:1,angle:0,target:'front',pageNumber:1,pageCount:1,url:'',pdfDocument:null
    };
    try {
      if (type === 'pdf') {
        const pdfjs = await ensurePdfJs();
        layer.pdfDocument = await pdfjs.getDocument({data:layer.bytes.slice()}).promise;
        layer.pageCount = layer.pdfDocument.numPages;
        await renderPdfPage(layer,1);
      } else {
        const result = await loadImage(file);
        Object.assign(layer,result);
        // Keep native bitmap dimensions separately for effective-resolution checks.
        layer.pixelW = result.image.naturalWidth;
        layer.pixelH = result.image.naturalHeight;
      }
      fitToTarget(layer,currentTarget());
      layers.push(layer);
      activeId = layer.id;
      refresh();
      notify('파일 배치 완료',file.name+' · 캔버스에서 드래그하거나 오른쪽에서 mm 단위로 조절하세요.');
    } catch(error) {
      if (layer.url) URL.revokeObjectURL(layer.url);
      layer.pdfDocument?.destroy?.();
      throw error;
    }
  }
  async function importFiles(files) {
    for (const file of [...files || []]) {
      try { await addFile(file); }
      catch (error) { notify('파일 불러오기 실패',error?.message || '파일 형식을 확인해 주세요.','error'); }
    }
    if ($('designLayerUpload')) $('designLayerUpload').value = '';
  }
  function removeSelected() {
    const item = selected(); if (!item) return;
    layers.splice(layers.indexOf(item),1);
    if (item.url) URL.revokeObjectURL(item.url);
    item.pdfDocument?.destroy?.();
    activeId = layers.at(-1)?.id || '';
    refresh();
  }
  function updateList() {
    const list = $('designLayerList'); if (!list) return;
    list.replaceChildren();
    for (const layer of [...layers].reverse()) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'design-layer-entry'+(layer.id===activeId?' active':'');
      button.textContent = (layer.type === 'pdf' ? 'PDF · ' : '이미지 · ')+layer.name+(layer.pageCount>1?' ('+layer.pageNumber+'/'+layer.pageCount+'p)':'');
      button.title = layer.name;
      button.addEventListener('click', () => { activeId=layer.id;refresh(); });
      list.appendChild(button);
    }
    if (!layers.length) {
      const hint = document.createElement('p');
      hint.className = 'design-layer-empty';
      hint.textContent = '업로드 파일이 없습니다. PDF 또는 이미지를 추가하세요.';
      list.appendChild(hint);
    }
  }
  function updateInspector() {
    const item = selected(), panel = $('designLayerInspector'); if (panel) panel.hidden = !item;
    if (!item) return;
    if ($('designLayerName')) $('designLayerName').textContent = item.name;
    for(const [id,key] of [['designLayerX','x'],['designLayerY','y'],['designLayerW','w'],['designLayerH','h'],['designLayerAngle','angle']]) {
      const input=$(id); if(input && document.activeElement!==input)input.value=Number(item[key]).toFixed(key==='angle'?0:1);
    }
    const pageRow=$('designPdfPageRow');if(pageRow)pageRow.hidden=item.type!=='pdf'||item.pageCount<2;
    const page=$('designPdfPage');if(page){page.max=item.pageCount;page.value=item.pageNumber;}
  }
  function effectiveDpi(item) {
    if (item.type !== 'image') return null;
    return Math.min(item.pixelW * 25.4 / item.w,item.pixelH * 25.4 / item.h);
  }
  function updateReview() {
    const panel=$('designReviewResults'),s=spec(); if(!panel||!s)return;
    const warnings=[],infos=[];
    infos.push('완성 '+s.trimW.toFixed(1)+'×'+s.trimH.toFixed(1)+'mm · 전체 '+s.workW.toFixed(1)+'×'+s.workH.toFixed(1)+'mm');
    if(s.coverMode==='spread')infos.push('책등 '+s.spine.toFixed(1)+'mm');
    if(s.bleed<3)warnings.push('도련 '+s.bleed+'mm: 인쇄소의 권장 도련을 확인하세요.');
    if(s.coverMode==='spread'&&s.spine<4)warnings.push('책등 폭이 좁아 문구가 잘릴 수 있습니다.');
    for (const item of layers) {
      const dpi=effectiveDpi(item);
      if(dpi!==null){infos.push(item.name+' · 유효 '+Math.round(dpi)+'dpi');if(dpi<300)warnings.push(item.name+' · 300dpi 미만(약 '+Math.round(dpi)+'dpi)');}
      else infos.push(item.name+' · PDF 원본 페이지 배치');
      if(item.x<0||item.y<0||item.x+item.w>s.workW+.01||item.y+item.h>s.workH+.01)warnings.push(item.name+' · 캔버스 범위 이탈');
    }
    panel.replaceChildren();
    for(const message of infos.concat(warnings.length?warnings:['현재 배치 기준 경고 없음'])) {
      const node=document.createElement('div');node.className='design-review-line'+(warnings.includes(message)?' warning':'');
      node.textContent=(warnings.includes(message)?'주의 · ':'')+message;panel.appendChild(node);
    }
    const indicator=$('designReviewCount');if(indicator)indicator.textContent=warnings.length?'주의 '+warnings.length+'건':'기본 검사 완료';
  }
  function draw(ctx,s,scale,showHandles = false) {
    if(!s)return;
    for(const item of layers) {
      if(!item.image)continue;
      const x=item.x*scale,y=item.y*scale,w=item.w*scale,h=item.h*scale;
      if (!showHandles) {
        ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(item.angle*Math.PI/180);
        ctx.drawImage(item.image,-w/2,-h/2,w,h);ctx.restore();
      }
      if(showHandles&&item.id===activeId) {
        ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(item.angle*Math.PI/180);
        ctx.strokeStyle='#2563eb';ctx.lineWidth=2;ctx.setLineDash([6,3]);
        ctx.strokeRect(-w/2,-h/2,w,h);ctx.setLineDash([]);ctx.fillStyle='#2563eb';
        ctx.fillRect(w/2-6,h/2-6,12,12);ctx.restore();
      }
    }
  }
  // The preview PDF canvas is deliberately small. Never upscale that preview
  // for 300dpi image/PDF exports: rerender each PDF page at the requested size.
  async function drawForExport(ctx,s,scale) {
    for (const item of layers) {
      let source=item.image,temporary=null;
      if(item.type==='pdf'){
        const pdfPage=await item.pdfDocument.getPage(item.pageNumber);
        const base=pdfPage.getViewport({scale:1});
        const ratio=Math.max(item.w*scale/base.width,item.h*scale/base.height);
        const viewport=pdfPage.getViewport({scale:ratio});
        if(viewport.width*viewport.height>36_000_000) {
          throw new Error('이 PDF 레이어의 300dpi 출력 이미지가 안전 용량을 초과합니다. 벡터 PDF로 저장해 주세요.');
        }
        temporary=document.createElement('canvas');
        temporary.width=Math.max(1,Math.ceil(viewport.width));
        temporary.height=Math.max(1,Math.ceil(viewport.height));
        await pdfPage.render({canvasContext:temporary.getContext('2d'),viewport}).promise;
        source=temporary;
      }
      const x=item.x*scale,y=item.y*scale,w=item.w*scale,h=item.h*scale;
      ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(item.angle*Math.PI/180);
      ctx.drawImage(source,-w/2,-h/2,w,h);ctx.restore();
      if(temporary){temporary.width=1;temporary.height=1;}
    }
  }
  function canvasPoint(e,canvas,s) {
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    return {x:(e.clientX-rect.left)*s.workW/rect.width,y:(e.clientY-rect.top)*s.workH/rect.height};
  }
  function localLayerPoint(item,p) {
    const x=p.x-(item.x+item.w/2),y=p.y-(item.y+item.h/2);
    const a=-item.angle*Math.PI/180;
    return {x:x*Math.cos(a)-y*Math.sin(a)+item.w/2,y:x*Math.sin(a)+y*Math.cos(a)+item.h/2};
  }
  function bindCanvas() {
    const canvas=$('previewCanvas');if(!canvas)return;
    canvas.addEventListener('pointerdown', e => {
      const s=spec(),p=canvasPoint(e,canvas,s);if(!p)return;
      const hit=[...layers].reverse().map(item=>({item,point:localLayerPoint(item,p)}))
        .find(({item,point})=>point.x>=0&&point.x<=item.w&&point.y>=0&&point.y<=item.h);
      if(!hit) {
        if(activeId){activeId='';refresh();}
        return;
      }
      e.preventDefault();e.stopImmediatePropagation();
      activeId=hit.item.id;
      const resize=hit.point.x>hit.item.w-Math.max(4,12*(s.workW/canvas.clientWidth))&&hit.point.y>hit.item.h-Math.max(4,12*(s.workH/canvas.clientHeight));
      pointer={id:e.pointerId,start:p,initial:{x:hit.item.x,y:hit.item.y,w:hit.item.w,h:hit.item.h},mode:resize?'resize':'move',layerId:hit.item.id};
      canvas.setPointerCapture?.(e.pointerId);
      refresh();
    },true);
    canvas.addEventListener('pointermove',e=>{
      if(!pointer||pointer.id!==e.pointerId)return;
      const s=spec(),p=canvasPoint(e,canvas,s),item=layers.find(x=>x.id===pointer.layerId);if(!p||!item)return;
      e.preventDefault();e.stopImmediatePropagation();
      const dx=p.x-pointer.start.x,dy=p.y-pointer.start.y;
      if(pointer.mode==='move'){
        item.x=clamp(pointer.initial.x+dx,-item.w,s.workW);
        item.y=clamp(pointer.initial.y+dy,-item.h,s.workH);
      }else{
        const lock=$('designLayerLockRatio')?.checked!==false,aspect=pointer.initial.w/pointer.initial.h;
        const a=-item.angle*Math.PI/180;
        const localDx=dx*Math.cos(a)-dy*Math.sin(a);
        const localDy=dx*Math.sin(a)+dy*Math.cos(a);
        item.w=clamp(pointer.initial.w+localDx,1,Math.max(1,s.workW*3));
        item.h=lock?item.w/aspect:clamp(pointer.initial.h+localDy,1,Math.max(1,s.workH*3));
      }
      updateInspector();updateReview();editor?.render?.();
    },true);
    const finish=e=>{if(!pointer||pointer.id!==e.pointerId)return;pointer=null;refresh();};
    canvas.addEventListener('pointerup',finish,true);
    canvas.addEventListener('pointercancel',finish,true);
    const stage=$('canvasStage')||canvas;
    stage.addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files')){e.preventDefault();stage.classList.add('design-import-dragover');}});
    stage.addEventListener('dragleave',()=>stage.classList.remove('design-import-dragover'));
    stage.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length){e.preventDefault();stage.classList.remove('design-import-dragover');importFiles(e.dataTransfer.files);}});
    window.addEventListener('keydown',e=>{
      const item=selected();if(!item)return;
      if(e.target?.matches?.('input,textarea,select')||e.target?.isContentEditable)return;
      if(e.key==='Delete'||e.key==='Backspace'){
        e.preventDefault();e.stopImmediatePropagation();removeSelected();return;
      }
      const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
      const delta=arrows[e.key];if(!delta||e.ctrlKey||e.metaKey||e.altKey)return;
      const step=e.shiftKey?1:.2;
      item.x+=delta[0]*step;item.y+=delta[1]*step;
      e.preventDefault();e.stopImmediatePropagation();refresh();
    },true);
  }
  async function drawPdfLayer(doc,page,lib,item,scale,height) {
    const ptsW=item.w*scale,ptsH=item.h*scale,cx=(item.x+item.w/2)*scale,cy=height-(item.y+item.h/2)*scale;
    const theta=-item.angle*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta);
    const x=cx-ptsW/2*cos+ptsH/2*sin,y=cy-ptsW/2*sin-ptsH/2*cos;
    if(item.type==='pdf') {
      const pdfPages=await doc.embedPdf(item.bytes,[item.pageNumber-1]);
      page.drawPage(pdfPages[0],{x,y,width:ptsW,height:ptsH,rotate:lib.degrees(-item.angle)});
    } else {
      let embedded;
      if(/\.jpe?g$/i.test(item.name))embedded=await doc.embedJpg(item.bytes);
      else if(/\.png$/i.test(item.name))embedded=await doc.embedPng(item.bytes);
      else {
        const canvas=document.createElement('canvas');canvas.width=item.pixelW;canvas.height=item.pixelH;
        canvas.getContext('2d').drawImage(item.image,0,0,canvas.width,canvas.height);
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('WEBP 변환 실패')),'image/png'));
        embedded=await doc.embedPng(await blob.arrayBuffer());
      }
      page.drawImage(embedded,{x,y,width:ptsW,height:ptsH,rotate:lib.degrees(-item.angle)});
    }
  }
  async function drawVector(doc,page,lib,s,scale,height) {
    for(const item of layers)await drawPdfLayer(doc,page,lib,item,scale,height);
  }
  function bindInputs() {
    $('designLayerUpload')?.addEventListener('change',e=>importFiles(e.target.files));
    $('designLayerRemove')?.addEventListener('click',removeSelected);
    $('designLayerFit')?.addEventListener('click',()=>{const layer=selected();if(layer&&fitToTarget(layer,currentTarget()))refresh();});
    $('designLayerCenter')?.addEventListener('click',()=>{const layer=selected(),region=zones(spec())[currentTarget()];if(!layer||!region)return;layer.x=region.x+(region.w-layer.w)/2;layer.y=region.y+(region.h-layer.h)/2;refresh();});
    $('designLayerForward')?.addEventListener('click',()=>{const layer=selected(),i=layers.indexOf(layer);if(i<0||i===layers.length-1)return;layers.splice(i,1);layers.splice(i+1,0,layer);refresh();});
    $('designLayerBackward')?.addEventListener('click',()=>{const layer=selected(),i=layers.indexOf(layer);if(i<=0)return;layers.splice(i,1);layers.splice(i-1,0,layer);refresh();});
    for(const [id,key] of [['designLayerX','x'],['designLayerY','y'],['designLayerW','w'],['designLayerH','h'],['designLayerAngle','angle']]) {
      $(id)?.addEventListener('change',e=>{
        const item=selected();if(!item)return;
        const v=Number(e.target.value);if(!Number.isFinite(v))return;
        if(key==='w'||key==='h'){
          if(v<=0)return;
          const ratio=item.w/item.h;
          item[key]=v;
          if($('designLayerLockRatio')?.checked) item[key==='w'?'h':'w']=key==='w'?v/ratio:v*ratio;
        }else item[key]=v;
        refresh();
      });
    }
    $('designPdfPage')?.addEventListener('change',async e=>{
      const item=selected();if(!item||item.type!=='pdf')return;
      const num=clamp(Math.round(Number(e.target.value)||1),1,item.pageCount);
      if(num===item.pageNumber)return;
      try{await renderPdfPage(item,num);refresh();}catch(error){notify('PDF 페이지 오류',error?.message||'다른 페이지를 읽을 수 없습니다.','error');}
    });
  }
  function configure(options) {
    if(editor)return;
    editor=options;
    bindCanvas();bindInputs();refresh();
  }
  window.DesignWorkspaceLayers={configure,importFiles,removeSelected,draw,drawForExport,drawVector,hasLayers,updateReview,zones,get layers(){return layers.slice();},get active(){return selected();}};
})();