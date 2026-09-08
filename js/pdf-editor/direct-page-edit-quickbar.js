// Keeps the advanced fixed toolbar aligned with image-style direct page editing.
(function(){
  'use strict';
  if(window.__pdfDirectPageEditQuickbarV1)return;
  const root=document.documentElement;
  const advanced=root.dataset.pdfEditorProfile==='advanced'||new URLSearchParams(String(location.search||'')).get('profile')==='advanced';
  if(!advanced)return;
  window.__pdfDirectPageEditQuickbarV1=true;

  const byId=id=>document.getElementById(id);
  let directRedoAvailable=false;

  function precisionHistory(){return window.PdfPrecisionEditTools?.history||{};}
  function directUndoCount(){return Math.max(0,Number(root.dataset.pdfDirectUndoCount||0)||0);}
  function eraseActive(){return root.dataset.pdfDirectEraseActive==='true';}

  function sync(){
    const erase=byId('pdfAdvancedCropV1');
    if(erase){
      erase.textContent=eraseActive()?'지우기 종료':'🧽 지우기';
      erase.title='지저분한 부분을 사각형으로 드래그해 지우기';
      erase.dataset.active=String(eraseActive());
    }
    const history=precisionHistory();
    const undo=byId('pdfAdvancedUndoV1');
    const redo=byId('pdfAdvancedRedoV1');
    if(undo)undo.disabled=directUndoCount()===0&&!Number(history.undoCount||0);
    if(redo)redo.disabled=!directRedoAvailable&&!Number(history.redoCount||0);
    root.dataset.pdfDirectQuickbar='1';
  }

  document.addEventListener('click',event=>{
    const erase=event.target?.closest?.('#pdfAdvancedCropV1');
    if(erase){
      event.preventDefault();event.stopImmediatePropagation();event.stopPropagation();
      byId('pdfDragCropAutoFitV1')?.click();
      setTimeout(sync,0);
      return;
    }
    if(event.target?.closest?.('#pdfAdvancedUndoV1')){
      const before=directUndoCount();
      setTimeout(()=>{if(before>directUndoCount())directRedoAvailable=true;sync();},0);
      return;
    }
    if(event.target?.closest?.('#pdfAdvancedRedoV1')){
      setTimeout(()=>{directRedoAvailable=false;sync();},0);
      return;
    }
    if(event.target?.closest?.('#pdfDragCropAutoFitV1'))setTimeout(sync,0);
  },true);

  document.addEventListener('pdf-drag-erase-applied',()=>{directRedoAvailable=false;setTimeout(sync,0);});
  document.addEventListener('pdf-import-committed',()=>{directRedoAvailable=false;setTimeout(sync,0);});
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(document.body,{childList:true,subtree:true});
  sync();
  setInterval(sync,1200);

  window.PdfDirectPageEditQuickbar={sync,stage:'direct-edit-quickbar-v1'};
})();
