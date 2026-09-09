import { advancedState } from './state.js';

const MARKER='\n__PS_OVERLAYS_V1__=';

function restoreOverlayMetadata(){
  for(const page of advancedState.pages){
    const source=String(page?.orientationSource||'');
    const index=source.indexOf(MARKER);
    if(index<0)continue;
    try{
      const saved=JSON.parse(source.slice(index+MARKER.length));
      if(Array.isArray(saved))page.overlays=saved.slice(0,20);
      page.orientationSource=source.slice(0,index);
      window.PdfAdvancedPageOverlays?.persistPageMetadata?.(page);
    }catch(error){
      console.warn('[pdf-advanced] saved overlay metadata restore failed',error);
    }
  }
  requestAnimationFrame(()=>window.PdfAdvancedPageOverlays?.render?.());
}

window.addEventListener('pdf-advanced-state-change',event=>{
  if(String(event?.detail?.reason||'')==='session-load')restoreOverlayMetadata();
});

document.documentElement.dataset.pdfAdvancedOverlaySessionRestore='1';
