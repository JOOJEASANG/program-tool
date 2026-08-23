(function(root){
  'use strict';
  if(root.ImageEditorWorkflow)return;

  const RATIOS=Object.freeze({
    square:{label:'1:1',ratio:1},
    portrait45:{label:'4:5',ratio:4/5},
    photo32:{label:'3:2',ratio:3/2},
    wide169:{label:'16:9',ratio:16/9}
  });

  function api(){return root.ImageEditorApp||null;}
  function centeredCropForRatio(width,height,ratio){
    width=Math.max(1,Math.round(Number(width)||1));height=Math.max(1,Math.round(Number(height)||1));ratio=Number(ratio)||1;
    let w=width,h=Math.round(width/ratio);
    if(h>height){h=height;w=Math.round(height*ratio);}
    w=Math.max(1,Math.min(width,w));h=Math.max(1,Math.min(height,h));
    return{x:Math.round((width-w)/2),y:Math.round((height-h)/2),w,h};
  }
  function applyCropRatio(key){
    const editor=api(),item=RATIOS[key];if(!editor||!item)return null;
    const state=editor.getState?.();if(!state?.loaded)return null;
    const crop=centeredCropForRatio(state.width,state.height,item.ratio);
    editor.setCrop(crop);
    document.querySelectorAll('[data-crop-ratio]').forEach(button=>button.classList.toggle('on',button.dataset.cropRatio===key));
    const note=document.getElementById('cropPresetStatus');if(note)note.textContent=`${item.label} 비율을 가운데 기준으로 선택했습니다. 자르기 적용을 누르면 반영됩니다.`;
    return crop;
  }
  async function pasteImageBlob(blob,name='clipboard-image.png'){
    if(!blob||!String(blob.type||'').startsWith('image/'))return false;
    const editor=api();if(!editor?.loadBlob)return false;
    await editor.loadBlob(blob,name);
    const note=document.getElementById('clipboardStatus');if(note)note.textContent='클립보드 이미지를 불러왔습니다.';
    return true;
  }
  function editableTarget(target){
    if(!target||typeof target.closest!=='function')return false;
    return Boolean(target.closest('input,textarea,select,[contenteditable="true"]'));
  }
  async function handlePaste(event){
    if(editableTarget(event.target))return false;
    const items=[...(event.clipboardData?.items||[])];
    const item=items.find(entry=>String(entry.type||'').startsWith('image/'));
    const blob=item?.getAsFile?.();if(!blob)return false;
    event.preventDefault?.();
    const extension=blob.type==='image/jpeg'?'jpg':blob.type==='image/webp'?'webp':'png';
    return pasteImageBlob(blob,`clipboard-image.${extension}`);
  }
  function bind(){
    document.querySelectorAll('[data-crop-ratio]').forEach(button=>button.addEventListener('click',()=>applyCropRatio(button.dataset.cropRatio)));
    document.addEventListener('paste',handlePaste);
    document.documentElement.dataset.imageEditorWorkflowReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();

  root.ImageEditorWorkflow={RATIOS,centeredCropForRatio,applyCropRatio,pasteImageBlob,handlePaste,stage:'image-editor-workflow-stage3'};
})(window);
