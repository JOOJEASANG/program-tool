(function(root){
  'use strict';
  if(root.ImageEditorPro)return;

  const ZOOM_LEVELS=[50,67,75,100,125,150,200,250];
  const ADJUST_PRESETS=Object.freeze({
    clean:{label:'선명하게',brightness:103,contrast:110,saturation:108},
    vivid:{label:'생생하게',brightness:102,contrast:114,saturation:120},
    soft:{label:'부드럽게',brightness:105,contrast:94,saturation:92},
    mono:{label:'흑백',brightness:102,contrast:110,saturation:0}
  });
  const RESIZE_PRESETS=Object.freeze({
    half:{label:'50%',scale:.5},
    threeQuarter:{label:'75%',scale:.75},
    long1080:{label:'긴 변 1080px',longEdge:1080},
    long2048:{label:'긴 변 2048px',longEdge:2048}
  });
  const PREF_KEY='program-studio-image-editor-export-v1';
  const ESTIMATE_MAX_PIXELS=12_000_000;
  let zoomMode='fit';
  let zoomPercent=100;
  let checkerMode=0;
  let compareSnapshot=null;
  let estimateTimer=0;
  let estimateToken=0;

  const $=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const api=()=>root.ImageEditorApp||null;

  function setStatus(message,type='ok'){
    const node=$('statusText');
    if(!node)return;
    node.textContent=message;
    node.dataset.type=type;
  }

  function gcd(a,b){
    a=Math.abs(Math.round(a));b=Math.abs(Math.round(b));
    while(b){const t=b;b=a%b;a=t;}
    return a||1;
  }

  function ratioLabel(width,height){
    if(!width||!height)return'—';
    const divisor=gcd(width,height),rw=Math.round(width/divisor),rh=Math.round(height/divisor);
    if(rw>40||rh>40)return(width/height).toFixed(2)+':1';
    return `${rw}:${rh}`;
  }

  function updateMetrics(){
    const state=api()?.getState?.();
    const info=$('imageInfoBadge'),cropInfo=$('cropInfoBadge'),history=$('historyInfoBadge');
    if(!state?.loaded){
      if(info)info.textContent='이미지 정보 —';
      if(cropInfo)cropInfo.textContent='선택 영역 —';
      if(history)history.textContent='작업 0';
      return;
    }
    const mp=(state.width*state.height/1_000_000).toFixed(state.width*state.height>=10_000_000?1:2);
    if(info)info.textContent=`${state.width.toLocaleString()} × ${state.height.toLocaleString()} · ${mp}MP · ${ratioLabel(state.width,state.height)}`;
    const crop=state.crop;
    if(cropInfo&&crop)cropInfo.textContent=`선택 ${crop.w.toLocaleString()} × ${crop.h.toLocaleString()}px`;
    if(history)history.textContent=`작업 ${state.historyLength||0}`;
  }

  function notifyOverlayResize(){
    requestAnimationFrame(()=>root.dispatchEvent(new Event('resize')));
  }

  function setFitZoom(){
    const canvas=$('previewCanvas');
    if(!canvas)return false;
    zoomMode='fit';
    canvas.style.removeProperty('width');
    canvas.style.removeProperty('height');
    canvas.style.removeProperty('max-width');
    canvas.style.removeProperty('max-height');
    const value=$('zoomValue');if(value)value.textContent='맞춤';
    document.querySelectorAll('[data-zoom-mode]').forEach(node=>node.classList.toggle('on',node.dataset.zoomMode==='fit'));
    notifyOverlayResize();
    return true;
  }

  function setZoom(percent){
    const canvas=$('previewCanvas');
    if(!canvas)return false;
    percent=clamp(Math.round(Number(percent)||100),50,250);
    zoomMode='fixed';zoomPercent=percent;
    canvas.style.maxWidth='none';canvas.style.maxHeight='none';
    canvas.style.width=`${Math.max(1,Math.round(canvas.width*percent/100))}px`;
    canvas.style.height=`${Math.max(1,Math.round(canvas.height*percent/100))}px`;
    const value=$('zoomValue');if(value)value.textContent=`${percent}%`;
    document.querySelectorAll('[data-zoom-mode]').forEach(node=>node.classList.toggle('on',false));
    notifyOverlayResize();
    return true;
  }

  function renderedZoomPercent(){
    const canvas=$('previewCanvas');
    if(!canvas||!canvas.width)return 100;
    return clamp(Math.round(canvas.getBoundingClientRect().width/canvas.width*100),50,250);
  }

  function nudgeZoom(direction){
    const current=zoomMode==='fit'?renderedZoomPercent():zoomPercent;
    let index=ZOOM_LEVELS.findIndex(level=>level>=current);
    if(index<0)index=ZOOM_LEVELS.length-1;
    if(direction>0&&ZOOM_LEVELS[index]<=current)index++;
    if(direction<0&&ZOOM_LEVELS[index]>=current)index--;
    index=clamp(index,0,ZOOM_LEVELS.length-1);
    return setZoom(ZOOM_LEVELS[index]);
  }

  function cycleCanvasBackground(){
    const viewport=$('canvasViewport');if(!viewport)return 0;
    checkerMode=(checkerMode+1)%3;
    viewport.dataset.canvasBackground=['checker','light','dark'][checkerMode];
    const button=$('checkerToggleBtn');
    if(button)button.textContent=['투명 격자','밝은 배경','어두운 배경'][checkerMode];
    return checkerMode;
  }

  function resizePreset(key){
    const editor=api(),preset=RESIZE_PRESETS[key],state=editor?.getState?.();
    if(!preset||!state?.loaded)return null;
    let width=state.width,height=state.height;
    if(preset.scale){width=Math.max(1,Math.round(width*preset.scale));height=Math.max(1,Math.round(height*preset.scale));}
    else if(preset.longEdge){
      const scale=preset.longEdge/Math.max(width,height);
      width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
    }
    const w=$('resizeW'),h=$('resizeH');if(w)w.value=String(width);if(h)h.value=String(height);
    const note=$('resizePresetStatus');if(note)note.textContent=`${preset.label} 기준 ${width.toLocaleString()} × ${height.toLocaleString()}px로 입력했습니다. ‘크기 적용’을 누르면 반영됩니다.`;
    return{width,height};
  }

  function applyAdjustmentPreset(key){
    const editor=api(),preset=ADJUST_PRESETS[key];
    if(!editor||!preset)return null;
    const state=editor.getState?.();if(!state?.loaded)return null;
    const next={brightness:preset.brightness,contrast:preset.contrast,saturation:preset.saturation};
    editor.setAdjustments(next);
    document.querySelectorAll('[data-adjust-preset]').forEach(button=>button.classList.toggle('on',button.dataset.adjustPreset===key));
    const note=$('adjustPresetStatus');if(note)note.textContent=`${preset.label} 프리셋을 적용했습니다. 슬라이더로 세밀하게 조정할 수 있습니다.`;
    scheduleEstimate();updateMetrics();
    return next;
  }

  function beginCompare(){
    const editor=api(),state=editor?.getState?.();
    if(!state?.loaded||compareSnapshot)return false;
    compareSnapshot={...state.adjustments};
    editor.setAdjustments({brightness:100,contrast:100,saturation:100});
    const button=$('compareAdjustBtn');if(button){button.classList.add('active');button.textContent='보정 전 보는 중';}
    return true;
  }

  function endCompare(){
    const editor=api();
    if(!editor||!compareSnapshot)return false;
    const snapshot=compareSnapshot;compareSnapshot=null;
    editor.setAdjustments(snapshot);
    const button=$('compareAdjustBtn');if(button){button.classList.remove('active');button.textContent='누르고 보정 전 비교';}
    return true;
  }

  function opaqueBounds(canvas,threshold=8){
    if(!canvas?.width||!canvas?.height)return null;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),width=canvas.width,height=canvas.height;
    const data=ctx.getImageData(0,0,width,height).data;
    let minX=width,minY=height,maxX=-1,maxY=-1;
    for(let y=0;y<height;y++){
      const row=y*width*4;
      for(let x=0;x<width;x++){
        if(data[row+x*4+3]<=threshold)continue;
        if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      }
    }
    return maxX<minX||maxY<minY?null:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  }

  function trimTransparentMargins(){
    const editor=api(),state=editor?.getState?.();if(!state?.loaded)return false;
    let source,scaleX=1,scaleY=1;
    if(state.width*state.height<=ESTIMATE_MAX_PIXELS){source=editor.renderOutput('image/png');}
    else{
      source=$('previewCanvas');
      if(source?.width&&source?.height){scaleX=state.width/source.width;scaleY=state.height/source.height;}
    }
    const bounds=opaqueBounds(source,8);
    if(!bounds){setStatus('투명 여백을 정리할 수 없습니다. 이미지 전체가 투명합니다.','error');return false;}
    const mapped={
      x:Math.max(0,Math.floor(bounds.x*scaleX)),
      y:Math.max(0,Math.floor(bounds.y*scaleY)),
      w:Math.min(state.width,Math.ceil(bounds.w*scaleX)),
      h:Math.min(state.height,Math.ceil(bounds.h*scaleY))
    };
    mapped.w=Math.min(mapped.w,state.width-mapped.x);mapped.h=Math.min(mapped.h,state.height-mapped.y);
    if(mapped.x===0&&mapped.y===0&&mapped.w===state.width&&mapped.h===state.height){setStatus('잘라낼 투명 여백이 없습니다.');return false;}
    editor.setCrop(mapped);const changed=editor.applyCrop();
    if(changed)setStatus(`투명 여백을 자동 정리해 ${mapped.w.toLocaleString()} × ${mapped.h.toLocaleString()}px로 만들었습니다.`);
    setFitZoom();updateMetrics();scheduleEstimate();
    return Boolean(changed);
  }

  function formatBytes(bytes){
    bytes=Math.max(0,Number(bytes)||0);
    if(bytes<1024)return `${bytes} B`;
    if(bytes<1024*1024)return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;
    return `${(bytes/1024/1024).toFixed(bytes<10*1024*1024?2:1)} MB`;
  }

  function exportFormatLabel(mime){return mime==='image/jpeg'?'JPEG':mime==='image/webp'?'WebP':'PNG';}

  async function updateExportEstimate(){
    const editor=api(),state=editor?.getState?.(),node=$('exportEstimate');if(!node)return null;
    if(!state?.loaded){node.textContent='이미지를 불러오면 저장 예상 용량을 표시합니다.';node.dataset.tone='idle';return null;}
    const pixels=state.width*state.height,mime=$('exportFormat')?.value||'image/png',quality=clamp((Number($('exportQuality')?.value)||92)/100,.1,1);
    if(pixels>ESTIMATE_MAX_PIXELS){
      node.textContent=`${exportFormatLabel(mime)} · ${(pixels/1_000_000).toFixed(1)}MP · 대용량 이미지는 저장할 때 최종 용량을 계산합니다.`;node.dataset.tone='large';return null;
    }
    const token=++estimateToken;node.textContent='저장 예상 용량 계산 중…';node.dataset.tone='working';
    try{
      const blob=await editor.exportBlob(mime,quality);if(token!==estimateToken)return null;
      node.textContent=`예상 ${formatBytes(blob.size)} · ${exportFormatLabel(mime)} · ${state.width.toLocaleString()} × ${state.height.toLocaleString()}px`;node.dataset.tone='ready';return blob.size;
    }catch(error){if(token===estimateToken){node.textContent='예상 용량을 계산하지 못했습니다. 저장 기능은 그대로 사용할 수 있습니다.';node.dataset.tone='warn';}return null;}
  }

  function scheduleEstimate(delay=650){clearTimeout(estimateTimer);estimateTimer=setTimeout(updateExportEstimate,delay);}

  function restoreExportPrefs(){
    try{
      const prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'null');if(!prefs)return;
      const format=$('exportFormat'),quality=$('exportQuality');
      if(format&&['image/png','image/jpeg','image/webp'].includes(prefs.format))format.value=prefs.format;
      if(quality&&Number.isFinite(Number(prefs.quality)))quality.value=String(clamp(Math.round(Number(prefs.quality)),10,100));
      format?.dispatchEvent(new Event('change',{bubbles:true}));
    }catch(_){ }
  }

  function saveExportPrefs(){
    try{localStorage.setItem(PREF_KEY,JSON.stringify({format:$('exportFormat')?.value||'image/png',quality:Number($('exportQuality')?.value)||92}));}catch(_){ }
  }

  function bindZoom(){
    $('zoomFitBtn')?.addEventListener('click',setFitZoom);
    $('zoomOutBtn')?.addEventListener('click',()=>nudgeZoom(-1));
    $('zoomInBtn')?.addEventListener('click',()=>nudgeZoom(1));
    $('checkerToggleBtn')?.addEventListener('click',cycleCanvasBackground);
    root.addEventListener('keydown',event=>{
      if(!(event.altKey&&!event.ctrlKey&&!event.metaKey))return;
      if(event.key==='0'){event.preventDefault();setFitZoom();}
      else if(event.key==='-'||event.key==='_'){event.preventDefault();nudgeZoom(-1);}
      else if(event.key==='='||event.key==='+'){event.preventDefault();nudgeZoom(1);}
    });
  }

  function bindPresets(){
    document.querySelectorAll('[data-resize-preset]').forEach(button=>button.addEventListener('click',()=>resizePreset(button.dataset.resizePreset)));
    document.querySelectorAll('[data-adjust-preset]').forEach(button=>button.addEventListener('click',()=>applyAdjustmentPreset(button.dataset.adjustPreset)));
    $('trimTransparentBtn')?.addEventListener('click',trimTransparentMargins);
  }

  function bindCompare(){
    const button=$('compareAdjustBtn');if(!button)return;
    button.addEventListener('pointerdown',event=>{event.preventDefault();beginCompare()});
    ['pointerup','pointercancel','pointerleave'].forEach(name=>button.addEventListener(name,endCompare));
    root.addEventListener('pointerup',endCompare);
    button.addEventListener('keydown',event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();beginCompare()}});
    button.addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();endCompare()}});
    button.addEventListener('blur',endCompare);
  }

  function bindEstimates(){
    ['exportFormat','exportQuality'].forEach(id=>$(id)?.addEventListener('change',()=>{saveExportPrefs();scheduleEstimate(150)}));
    $('exportQuality')?.addEventListener('input',()=>scheduleEstimate(700));
    ['brightness','contrast','saturation'].forEach(id=>$(id)?.addEventListener('input',()=>{document.querySelectorAll('[data-adjust-preset]').forEach(button=>button.classList.remove('on'));scheduleEstimate()}));
    document.querySelectorAll('[data-requires-image] button').forEach(button=>button.addEventListener('click',()=>{setTimeout(()=>{updateMetrics();scheduleEstimate();},80)}));
    const dims=$('dimensionText');if(dims)new MutationObserver(()=>{updateMetrics();if(zoomMode==='fit')setFitZoom();scheduleEstimate(300)}).observe(dims,{childList:true,characterData:true,subtree:true});
    ['cropX','cropY','cropW','cropH'].forEach(id=>$(id)?.addEventListener('input',updateMetrics));
  }

  function boot(){
    restoreExportPrefs();bindZoom();bindPresets();bindCompare();bindEstimates();updateMetrics();setFitZoom();scheduleEstimate(250);
    document.documentElement.dataset.imageEditorProReady='1';
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.ImageEditorPro={
    setFitZoom,setZoom,nudgeZoom,resizePreset,applyAdjustmentPreset,beginCompare,endCompare,opaqueBounds,trimTransparentMargins,updateExportEstimate,updateMetrics,
    presets:{adjustments:ADJUST_PRESETS,resize:RESIZE_PRESETS},
    stage:'image-editor-pro-stage1'
  };
})(window);
