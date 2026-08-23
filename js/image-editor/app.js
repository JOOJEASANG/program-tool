(function(root){
  'use strict';
  if(root.ImageEditorApp)return;

  const MAX_PIXELS=60_000_000;
  const PREVIEW_MAX_W=1280;
  const PREVIEW_MAX_H=900;
  const state={
    base:null,
    originalBlob:null,
    originalName:'image',
    crop:null,
    adjustments:{brightness:100,contrast:100,saturation:100},
    history:[],
    loaded:false
  };
  let drag=null;
  let ratioSync=false;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const round=value=>Math.round(Number(value)||0);

  function makeCanvas(width,height){
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,round(width));canvas.height=Math.max(1,round(height));
    return canvas;
  }
  function copyCanvas(source){
    const canvas=makeCanvas(source.width,source.height);
    canvas.getContext('2d').drawImage(source,0,0);
    return canvas;
  }
  function imagePixels(width,height){return Math.max(0,Number(width)||0)*Math.max(0,Number(height)||0);}
  function ensureSafeSize(width,height){
    if(width<1||height<1||width>20000||height>20000||imagePixels(width,height)>MAX_PIXELS){
      throw new Error('이미지 크기가 너무 큽니다. 가로·세로와 전체 픽셀 수를 줄여주세요.');
    }
  }
  function filterString(){
    const a=state.adjustments;
    return `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%)`;
  }
  function currentRect(){
    if(!state.base)return null;
    const raw=state.crop||{x:0,y:0,w:state.base.width,h:state.base.height};
    const x=clamp(round(raw.x),0,state.base.width-1);
    const y=clamp(round(raw.y),0,state.base.height-1);
    const w=clamp(round(raw.w),1,state.base.width-x);
    const h=clamp(round(raw.h),1,state.base.height-y);
    return{x,y,w,h};
  }
  function setStatus(message,type='ok'){
    const node=$('statusText');if(!node)return;
    node.textContent=message;node.dataset.type=type;
  }
  function setEnabled(enabled){
    document.querySelectorAll('[data-requires-image]').forEach(node=>node.setAttribute('aria-disabled',enabled?'false':'true'));
    ['undoBtn','resetBtn','exportBtn'].forEach(id=>{const node=$(id);if(node)node.disabled=!enabled||(id==='undoBtn'&&!state.history.length)});
  }
  function updateMeta(){
    const base=state.base;
    const dims=$('dimensionText');
    if(dims)dims.textContent=base?`${base.width.toLocaleString()} × ${base.height.toLocaleString()} px`:'—';
    const meta=$('fileMeta');
    if(meta&&base)meta.textContent=`${state.originalName} · ${base.width.toLocaleString()} × ${base.height.toLocaleString()} px`;
    if(base){
      if($('resizeW'))$('resizeW').value=String(base.width);
      if($('resizeH'))$('resizeH').value=String(base.height);
    }
    setEnabled(Boolean(base));
  }
  function updateAdjustOutputs(){
    [['brightness','brightnessOut'],['contrast','contrastOut'],['saturation','saturationOut']].forEach(([inputId,outId])=>{
      const input=$(inputId),out=$(outId);if(input&&out)out.value=`${input.value}%`;
    });
  }
  function updateBackgroundOutputs(){
    const tolerance=$('backgroundTolerance'),toleranceOut=$('backgroundToleranceOut'),feather=$('backgroundFeather'),featherOut=$('backgroundFeatherOut');
    if(tolerance&&toleranceOut)toleranceOut.value=String(tolerance.value);
    if(feather&&featherOut)featherOut.value=String(feather.value);
  }
  function updateExportControls(){
    const format=$('exportFormat'),quality=$('exportQuality'),note=$('exportNote');if(!format)return;
    const mime=format.value||'image/png';if(quality)quality.disabled=mime==='image/png';
    if(!note)return;
    if(mime==='image/jpeg'){
      note.textContent='JPEG는 투명도를 지원하지 않아 투명 영역을 흰색으로 저장합니다.';note.dataset.tone='warn';
    }else if(mime==='image/webp'){
      note.textContent='WebP는 투명 배경을 유지하면서 파일 크기를 줄일 수 있습니다.';note.dataset.tone='success';
    }else{
      note.textContent='PNG는 투명 배경을 그대로 저장합니다.';note.dataset.tone='success';
    }
  }
  function syncCropFields(){
    const rect=currentRect();if(!rect)return;
    $('cropX').value=String(rect.x);$('cropY').value=String(rect.y);$('cropW').value=String(rect.w);$('cropH').value=String(rect.h);
  }
  function readCropFields(){
    if(!state.base)return null;
    return setCrop({x:Number($('cropX').value),y:Number($('cropY').value),w:Number($('cropW').value),h:Number($('cropH').value)},false);
  }
  function previewSize(){
    if(!state.base)return{width:1,height:1,scale:1};
    const scale=Math.min(1,PREVIEW_MAX_W/state.base.width,PREVIEW_MAX_H/state.base.height);
    return{width:Math.max(1,round(state.base.width*scale)),height:Math.max(1,round(state.base.height*scale)),scale};
  }
  function renderPreview(){
    if(!state.base)return false;
    const preview=$('previewCanvas');if(!preview)return false;
    const size=previewSize();preview.width=size.width;preview.height=size.height;
    const ctx=preview.getContext('2d');ctx.clearRect(0,0,preview.width,preview.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.filter=filterString();ctx.drawImage(state.base,0,0,preview.width,preview.height);ctx.filter='none';
    renderCropOverlay();return true;
  }
  function renderCropOverlay(){
    const overlay=$('cropOverlay'),preview=$('previewCanvas'),rect=currentRect();
    if(!overlay||!preview||!rect||!state.base)return;
    const sx=preview.clientWidth/state.base.width,sy=preview.clientHeight/state.base.height;
    const full=rect.x===0&&rect.y===0&&rect.w===state.base.width&&rect.h===state.base.height;
    overlay.hidden=full;
    overlay.style.left=`${rect.x*sx}px`;overlay.style.top=`${rect.y*sy}px`;overlay.style.width=`${rect.w*sx}px`;overlay.style.height=`${rect.h*sy}px`;
  }
  function resetCrop(){
    if(!state.base)return;
    state.crop={x:0,y:0,w:state.base.width,h:state.base.height};syncCropFields();renderCropOverlay();
  }
  function setCrop(rect,render=true){
    if(!state.base)return null;
    const x=clamp(round(rect?.x),0,state.base.width-1),y=clamp(round(rect?.y),0,state.base.height-1);
    const w=clamp(round(rect?.w)||1,1,state.base.width-x),h=clamp(round(rect?.h)||1,1,state.base.height-y);
    state.crop={x,y,w,h};syncCropFields();if(render)renderCropOverlay();return{...state.crop};
  }
  function historyLimit(){return imagePixels(state.base?.width,state.base?.height)>12_000_000?2:8;}
  function pushHistory(label){
    if(!state.base)return;
    state.history.push({canvas:copyCanvas(state.base),crop:{...currentRect()},adjustments:{...state.adjustments},label});
    while(state.history.length>historyLimit())state.history.shift();
    setEnabled(true);
  }
  function undo(){
    const previous=state.history.pop();if(!previous)return false;
    state.base=previous.canvas;state.crop={...previous.crop};state.adjustments={...previous.adjustments};
    syncAdjustInputs();syncCropFields();updateMeta();renderPreview();setStatus(`${previous.label||'이전 작업'} 전 상태로 되돌렸습니다.`);return true;
  }
  function syncAdjustInputs(){
    Object.entries(state.adjustments).forEach(([key,value])=>{const node=$(key);if(node)node.value=String(value)});updateAdjustOutputs();
  }
  function componentHex(value){return clamp(round(value),0,255).toString(16).padStart(2,'0');}
  function colorHex(color){return `#${componentHex(color.r)}${componentHex(color.g)}${componentHex(color.b)}`;}
  function parseColor(value){
    if(value&&typeof value==='object'&&Number.isFinite(Number(value.r))&&Number.isFinite(Number(value.g))&&Number.isFinite(Number(value.b))){
      return{r:clamp(round(value.r),0,255),g:clamp(round(value.g),0,255),b:clamp(round(value.b),0,255)};
    }
    const match=String(value||'').trim().match(/^#?([0-9a-f]{6})$/i);if(!match)return null;
    return{r:parseInt(match[1].slice(0,2),16),g:parseInt(match[1].slice(2,4),16),b:parseInt(match[1].slice(4,6),16)};
  }
  function sampleBackgroundFromCorners(options={}){
    if(!state.base)return null;
    const canvas=state.base,w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d',{willReadFrequently:true});
    const suggested=Math.max(2,round(Math.min(w,h)*.04));
    const patch=clamp(round(options.patchSize)||suggested,2,Math.max(2,Math.min(24,w,h)));
    const points=[[0,0],[Math.max(0,w-patch),0],[0,Math.max(0,h-patch)],[Math.max(0,w-patch),Math.max(0,h-patch)]];
    let r=0,g=0,b=0,count=0;
    for(const [x,y] of points){
      const image=ctx.getImageData(x,y,Math.min(patch,w-x),Math.min(patch,h-y)).data;
      for(let i=0;i<image.length;i+=4){if(image[i+3]<32)continue;r+=image[i];g+=image[i+1];b+=image[i+2];count++;}
    }
    const color=count?{r:round(r/count),g:round(g/count),b:round(b/count)}:{r:255,g:255,b:255};
    return{...color,hex:colorHex(color),samples:count,patchSize:patch};
  }
  function syncBackgroundColorFromCorners(){
    const sample=sampleBackgroundFromCorners(),input=$('backgroundColor'),note=$('backgroundStatus');if(!sample)return null;
    if(input)input.value=sample.hex;
    if(note){note.textContent=`모서리 기준 배경색 ${sample.hex.toUpperCase()}를 선택했습니다. 단색 배경에서 가장 정확합니다.`;note.dataset.tone='success';}
    return sample;
  }
  function removeBackground(options={}){
    if(!state.base)return null;
    const target=parseColor(options.color||$('backgroundColor')?.value)||sampleBackgroundFromCorners()||{r:255,g:255,b:255,hex:'#ffffff'};
    const tolerance=clamp(Number(options.tolerance??$('backgroundTolerance')?.value??30),0,120);
    const feather=clamp(Number(options.feather??$('backgroundFeather')?.value??18),0,80);
    pushHistory('배경 제거');
    const ctx=state.base.getContext('2d',{willReadFrequently:true}),image=ctx.getImageData(0,0,state.base.width,state.base.height),data=image.data;
    let removedPixels=0,softenedPixels=0;
    for(let i=0;i<data.length;i+=4){
      const alpha=data[i+3];if(alpha===0)continue;
      const dr=data[i]-target.r,dg=data[i+1]-target.g,db=data[i+2]-target.b;
      const distance=Math.sqrt((dr*dr+dg*dg+db*db)/3);
      if(distance<=tolerance){data[i+3]=0;removedPixels++;continue;}
      if(feather>0&&distance<tolerance+feather){
        const factor=(distance-tolerance)/feather,newAlpha=clamp(round(alpha*factor),0,alpha);
        if(newAlpha<alpha){data[i+3]=newAlpha;softenedPixels++;}
      }
    }
    ctx.putImageData(image,0,0);renderPreview();setEnabled(true);updateExportControls();
    const hex=colorHex(target),note=$('backgroundStatus');
    if(note){note.textContent=`${hex.toUpperCase()} 계열 배경 ${removedPixels.toLocaleString()}px 제거${softenedPixels?` · 경계 ${softenedPixels.toLocaleString()}px 부드럽게 처리`:''}.`;note.dataset.tone=removedPixels?'success':'warn';}
    setStatus(removedPixels?`배경 ${removedPixels.toLocaleString()}픽셀을 투명하게 처리했습니다.`:'선택한 색과 허용 범위에 해당하는 배경 픽셀이 없습니다.',removedPixels?'ok':'error');
    return{color:hex,tolerance,feather,removedPixels,softenedPixels};
  }
  async function decodeBlob(blob){
    if(!blob||!String(blob.type||'').startsWith('image/'))throw new Error('지원되는 이미지 파일을 선택해주세요.');
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(blob,{imageOrientation:'from-image'});}catch(_){}
    }
    return await new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('이미지를 읽을 수 없습니다.'))};img.src=url;
    });
  }
  async function loadBlob(blob,name='image',options={}){
    try{
      setStatus('이미지를 불러오는 중입니다…');
      const bitmap=await decodeBlob(blob),width=bitmap.naturalWidth||bitmap.width,height=bitmap.naturalHeight||bitmap.height;
      ensureSafeSize(width,height);
      const canvas=makeCanvas(width,height),ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,width,height);if(typeof bitmap.close==='function')bitmap.close();
      state.base=canvas;state.loaded=true;state.history=[];state.adjustments={brightness:100,contrast:100,saturation:100};
      if(!options.preserveOriginal){state.originalBlob=blob;state.originalName=String(name||'image').replace(/[\\/:*?"<>|]+/g,'_')||'image';}
      resetCrop();syncAdjustInputs();
      $('emptyState').hidden=true;$('canvasViewport').hidden=false;updateMeta();renderPreview();syncBackgroundColorFromCorners();updateExportControls();
      setStatus('이미지를 불러왔습니다. 미리보기에서 드래그하면 자를 영역을 지정할 수 있습니다.');
      return{width,height,name:state.originalName};
    }catch(error){setStatus(error.message||String(error),'error');throw error;}
  }
  async function loadFile(file){return loadBlob(file,file?.name||'image');}
  function transform(kind){
    if(!state.base)return false;
    pushHistory(kind==='rotate-left'?'왼쪽 회전':kind==='rotate-right'?'오른쪽 회전':kind==='flip-h'?'좌우 반전':'상하 반전');
    const src=state.base,w=src.width,h=src.height;
    let out,ctx;
    if(kind==='rotate-left'||kind==='rotate-right'){
      out=makeCanvas(h,w);ctx=out.getContext('2d');
      if(kind==='rotate-right'){ctx.translate(h,0);ctx.rotate(Math.PI/2)}else{ctx.translate(0,w);ctx.rotate(-Math.PI/2)}
      ctx.drawImage(src,0,0);
    }else{
      out=makeCanvas(w,h);ctx=out.getContext('2d');
      if(kind==='flip-h'){ctx.translate(w,0);ctx.scale(-1,1)}else{ctx.translate(0,h);ctx.scale(1,-1)}
      ctx.drawImage(src,0,0);
    }
    state.base=out;resetCrop();updateMeta();renderPreview();setStatus('이미지 방향을 변경했습니다.');return true;
  }
  const rotateLeft=()=>transform('rotate-left');
  const rotateRight=()=>transform('rotate-right');
  const flipHorizontal=()=>transform('flip-h');
  const flipVertical=()=>transform('flip-v');
  function applyCrop(){
    if(!state.base)return false;
    const rect=readCropFields()||currentRect();
    if(rect.x===0&&rect.y===0&&rect.w===state.base.width&&rect.h===state.base.height){setStatus('현재 전체 이미지가 선택되어 있습니다.');return false;}
    pushHistory('자르기');
    const out=makeCanvas(rect.w,rect.h);out.getContext('2d').drawImage(state.base,rect.x,rect.y,rect.w,rect.h,0,0,rect.w,rect.h);state.base=out;resetCrop();updateMeta();renderPreview();setStatus(`이미지를 ${rect.w} × ${rect.h}px로 잘랐습니다.`);return true;
  }
  function resize(width,height){
    if(!state.base)return false;
    width=round(width);height=round(height);ensureSafeSize(width,height);
    if(width===state.base.width&&height===state.base.height)return false;
    pushHistory('크기 조절');
    const out=makeCanvas(width,height),ctx=out.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(state.base,0,0,width,height);state.base=out;resetCrop();updateMeta();renderPreview();setStatus(`이미지 크기를 ${width} × ${height}px로 변경했습니다.`);return true;
  }
  function setAdjustments(next={}){
    ['brightness','contrast','saturation'].forEach(key=>{
      if(next[key]!=null)state.adjustments[key]=clamp(round(next[key]),key==='saturation'?0:20,key==='saturation'?200:180);
    });
    syncAdjustInputs();renderPreview();return{...state.adjustments};
  }
  function resetAdjustments(){setAdjustments({brightness:100,contrast:100,saturation:100});setStatus('보정값을 기본으로 되돌렸습니다.');}
  function renderOutput(mime='image/png'){
    if(!state.base)return null;
    const out=makeCanvas(state.base.width,state.base.height),ctx=out.getContext('2d');
    if(mime==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height)}
    ctx.filter=filterString();ctx.drawImage(state.base,0,0);ctx.filter='none';return out;
  }
  function canvasToBlob(canvas,mime,quality){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('이미지 저장 데이터를 만들지 못했습니다.')),mime,quality));
  }
  async function exportBlob(mime=$('exportFormat')?.value||'image/png',quality=(Number($('exportQuality')?.value)||92)/100){
    if(!state.base)throw new Error('먼저 이미지를 불러와주세요.');
    return canvasToBlob(renderOutput(mime),mime,clamp(Number(quality)||.92,.1,1));
  }
  function exportExtension(mime){return mime==='image/jpeg'?'jpg':mime==='image/webp'?'webp':'png';}
  async function downloadExport(){
    try{
      const mime=$('exportFormat')?.value||'image/png',quality=(Number($('exportQuality')?.value)||92)/100,blob=await exportBlob(mime,quality);
      const url=URL.createObjectURL(blob),a=document.createElement('a'),stem=state.originalName.replace(/\.[^.]+$/,'')||'image';
      a.href=url;a.download=`${stem}-edited.${exportExtension(mime)}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);setStatus(`${a.download} 저장을 시작했습니다.`);return blob;
    }catch(error){setStatus(error.message||String(error),'error');throw error;}
  }
  async function resetOriginal(){
    if(!state.originalBlob)return false;
    await loadBlob(state.originalBlob,state.originalName,{preserveOriginal:true});setStatus('처음 불러온 원본으로 복원했습니다.');return true;
  }
  function centerSquare(){
    if(!state.base)return;
    const size=Math.min(state.base.width,state.base.height);setCrop({x:(state.base.width-size)/2,y:(state.base.height-size)/2,w:size,h:size});setStatus('가운데 정사각형 영역을 선택했습니다.');
  }
  function pointerPosition(event){
    const preview=$('previewCanvas'),box=preview.getBoundingClientRect();
    return{x:clamp((event.clientX-box.left)*state.base.width/box.width,0,state.base.width),y:clamp((event.clientY-box.top)*state.base.height/box.height,0,state.base.height)};
  }
  function bindCropDrag(){
    const preview=$('previewCanvas');if(!preview)return;
    preview.addEventListener('pointerdown',event=>{if(!state.base)return;preview.setPointerCapture?.(event.pointerId);const p=pointerPosition(event);drag={x:p.x,y:p.y};setCrop({x:p.x,y:p.y,w:1,h:1});event.preventDefault()});
    preview.addEventListener('pointermove',event=>{if(!drag||!state.base)return;const p=pointerPosition(event),x=Math.min(drag.x,p.x),y=Math.min(drag.y,p.y),w=Math.max(1,Math.abs(p.x-drag.x)),h=Math.max(1,Math.abs(p.y-drag.y));setCrop({x,y,w,h});});
    const stop=()=>{if(drag){drag=null;setStatus('자를 영역을 선택했습니다. 자르기 적용을 누르면 반영됩니다.')}};
    preview.addEventListener('pointerup',stop);preview.addEventListener('pointercancel',stop);
  }
  function bindFileInput(){
    const input=$('fileInput'),open=()=>input?.click();$('openBtn')?.addEventListener('click',open);$('dropZone')?.addEventListener('click',event=>{if(event.target?.closest?.('canvas'))return;if(!state.loaded)open()});$('dropZone')?.addEventListener('keydown',event=>{if(!state.loaded&&(event.key==='Enter'||event.key===' ')){event.preventDefault();open()}});
    input?.addEventListener('change',()=>{const file=input.files?.[0];if(file)loadFile(file);input.value=''});
    const zone=$('dropZone');['dragenter','dragover'].forEach(name=>zone?.addEventListener(name,event=>{event.preventDefault();zone.classList.add('dragging')}));['dragleave','drop'].forEach(name=>zone?.addEventListener(name,event=>{event.preventDefault();zone.classList.remove('dragging')}));zone?.addEventListener('drop',event=>{const file=[...(event.dataTransfer?.files||[])].find(item=>item.type.startsWith('image/'));if(file)loadFile(file)});
  }
  function bindControls(){
    $('undoBtn')?.addEventListener('click',undo);$('resetBtn')?.addEventListener('click',resetOriginal);$('exportBtn')?.addEventListener('click',downloadExport);$('exportSideBtn')?.addEventListener('click',downloadExport);
    $('rotateLeftBtn')?.addEventListener('click',rotateLeft);$('rotateRightBtn')?.addEventListener('click',rotateRight);$('flipHBtn')?.addEventListener('click',flipHorizontal);$('flipVBtn')?.addEventListener('click',flipVertical);
    ['cropX','cropY','cropW','cropH'].forEach(id=>$(id)?.addEventListener('input',()=>readCropFields()));$('squareCropBtn')?.addEventListener('click',centerSquare);$('fullCropBtn')?.addEventListener('click',()=>{resetCrop();setStatus('전체 이미지 영역을 선택했습니다.')});$('applyCropBtn')?.addEventListener('click',applyCrop);
    $('resizeW')?.addEventListener('input',()=>{if(ratioSync||!state.base||!$('lockRatio').checked)return;ratioSync=true;$('resizeH').value=String(Math.max(1,round(Number($('resizeW').value)*state.base.height/state.base.width)));ratioSync=false});
    $('resizeH')?.addEventListener('input',()=>{if(ratioSync||!state.base||!$('lockRatio').checked)return;ratioSync=true;$('resizeW').value=String(Math.max(1,round(Number($('resizeH').value)*state.base.width/state.base.height)));ratioSync=false});
    $('applyResizeBtn')?.addEventListener('click',()=>{try{resize(Number($('resizeW').value),Number($('resizeH').value))}catch(error){setStatus(error.message||String(error),'error')}});
    ['brightness','contrast','saturation'].forEach(id=>$(id)?.addEventListener('input',()=>{state.adjustments[id]=Number($(id).value);updateAdjustOutputs();renderPreview()}));$('resetAdjustBtn')?.addEventListener('click',resetAdjustments);
    $('sampleBackgroundBtn')?.addEventListener('click',()=>syncBackgroundColorFromCorners());
    ['backgroundTolerance','backgroundFeather'].forEach(id=>$(id)?.addEventListener('input',updateBackgroundOutputs));
    $('removeBackgroundBtn')?.addEventListener('click',()=>removeBackground());
    $('exportFormat')?.addEventListener('change',updateExportControls);
    root.addEventListener('resize',()=>requestAnimationFrame(renderCropOverlay),{passive:true});
    document.addEventListener('keydown',event=>{
      const mod=event.ctrlKey||event.metaKey;if(!mod)return;
      const key=event.key.toLowerCase();if(key==='z'){event.preventDefault();undo()}else if(key==='o'){event.preventDefault();$('fileInput')?.click()}else if(key==='s'){event.preventDefault();if(state.base)downloadExport()}
    });
  }
  function boot(){
    setEnabled(false);document.querySelectorAll('[data-requires-image]').forEach(node=>node.setAttribute('aria-disabled','true'));bindFileInput();bindControls();bindCropDrag();updateAdjustOutputs();updateBackgroundOutputs();updateExportControls();document.documentElement.dataset.imageEditorReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.ImageEditorApp={
    loadBlob,loadFile,rotateLeft,rotateRight,flipHorizontal,flipVertical,setCrop,applyCrop,resize,setAdjustments,resetAdjustments,sampleBackgroundFromCorners,removeBackground,renderOutput,exportBlob,resetOriginal,undo,
    getState:()=>({loaded:state.loaded,width:state.base?.width||0,height:state.base?.height||0,crop:currentRect(),adjustments:{...state.adjustments},historyLength:state.history.length,name:state.originalName}),
    limits:{maxPixels:MAX_PIXELS},
    stage:'image-editor-core-stage2-background'
  };
})(window);
