// Nonprinting PDF preview guide layer: solid paper edge + dashed sheet margins.
(function(){
  'use strict';
  if (window.__pdfEditorPreviewMarginGuidesV1) return;
  window.__pdfEditorPreviewMarginGuidesV1 = true;
  const $ = id => document.getElementById(id);
  const EDGES = ['left','right','top','bottom'];
  let visible = true;
  let queued = false;
  let observer = null;

  function bounded(value, fallback=0){
    const n=Number(value);
    return Number.isFinite(n) ? Math.max(0,n) : fallback;
  }
  function size(){
    try{
      const current=typeof getSettings==='function'?getSettings():null;
      if(current?.pw>0&&current?.ph>0)return{width:current.pw,height:current.ph};
    }catch(_){}
    return {width:210,height:297};
  }
  function sheetIndex(node, fallback){
    const index=Number(node.dataset.outputIndex);
    return node.dataset.outputIndex!==undefined && Number.isInteger(index) && index>=0 ? index:fallback;
  }
  function paperFor(node){
    const configured=size();
    const width=bounded(node.dataset.previewPaperWidthMm,configured.width)||configured.width;
    const height=bounded(node.dataset.previewPaperHeightMm,configured.height)||configured.height;
    return {width,height};
  }
  function marginFor(node,index){
    let effective=null;
    try{
      effective=window.PdfEditorLayoutExport?.layoutMargins?.(index);
    }catch(_){}
    if(effective && EDGES.every(edge=>Number.isFinite(Number(effective[edge]))))
      return Object.fromEntries(EDGES.map(edge=>[edge,bounded(effective[edge])]));
    return Object.fromEntries(EDGES.map(edge=>{
      const attr='previewMargin'+edge.charAt(0).toUpperCase()+edge.slice(1)+'Mm';
      const fallback=Number($(edge==='left'||edge==='right'?'marginH':'marginV')?.value)||0;
      return [edge,bounded(node.dataset[attr],fallback)];
    }));
  }
  function fmt(n){
    return (Math.round(n*10)/10).toLocaleString('ko-KR',{maximumFractionDigits:1});
  }
  function decorate(){
    const container=$('previewScroll');
    if(!container)return;
    const pages=container.querySelectorAll('.page-preview');
    pages.forEach((node,i)=>{
      const paper=paperFor(node);
      const margins=marginFor(node,sheetIndex(node,i));
      if(!paper.width||!paper.height)return;
      const maxX=Math.min(paper.width,Math.max(0,margins.left+margins.right));
      const maxY=Math.min(paper.height,Math.max(0,margins.top+margins.bottom));
      const safeX=maxX >= paper.width ? 0 : 1;
      const safeY=maxY >= paper.height ? 0 : 1;
      const scaleX=safeX ? 1 : paper.width/Math.max(1,maxX+1);
      const scaleY=safeY ? 1 : paper.height/Math.max(1,maxY+1);
      const values={
        left:margins.left*scaleX/paper.width*100,
        right:margins.right*scaleX/paper.width*100,
        top:margins.top*scaleY/paper.height*100,
        bottom:margins.bottom*scaleY/paper.height*100,
      };
      EDGES.forEach(edge=>node.style.setProperty('--pdf-guide-'+edge,values[edge]+'%'));
      node.dataset.paperMm=fmt(paper.width)+' × '+fmt(paper.height)+'mm';
      node.dataset.guideMargins=EDGES.map(edge=>fmt(margins[edge])).join(',');
      node.classList.toggle('pdf-paper-guides',visible);
      // The visual-only pseudo-elements never touch a PDF canvas or print
      // backend. An invalid margin combination does not produce a negative
      // size or obscure the output.
    });
  }
  function queue(){
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;decorate();});
  }
  function installCss(){
    if($('pdfPreviewMarginGuideCss'))return;
    const style=document.createElement('style');
    style.id='pdfPreviewMarginGuideCss';
    style.textContent=`
      #previewScroll .page-preview.pdf-paper-guides{
        position:relative!important;outline:2px solid #0f766e!important;outline-offset:0!important;
        box-shadow:0 4px 16px rgba(0,0,0,.12),inset 0 0 0 1px rgba(255,255,255,.95)!important;
      }
      #previewScroll .page-preview.pdf-paper-guides::after{
        content:'';position:absolute;box-sizing:border-box;
        left:var(--pdf-guide-left,0%);right:var(--pdf-guide-right,0%);
        top:var(--pdf-guide-top,0%);bottom:var(--pdf-guide-bottom,0%);
        z-index:8;border:1.5px dashed #d97706;
        box-shadow:0 0 0 1px rgba(255,255,255,.8);pointer-events:none;
      }
      #previewScroll .page-preview.pdf-paper-guides::before{
        content:attr(data-paper-mm);position:absolute;top:3px;left:3px;z-index:9;
        border-radius:3px;padding:1px 4px;background:rgba(6,95,70,.88);
        color:#fff;font:800 9px/1.35 Pretendard,'Noto Sans KR',sans-serif;
        pointer-events:none;white-space:nowrap;max-width:calc(100% - 6px);
        overflow:hidden;text-overflow:ellipsis;
      }
      #previewGuidesToggle[aria-pressed="false"]{background:#fff!important;border-color:#cbd5e1!important;color:#64748b!important}
      #previewGuidesToggle:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
      @media print{#previewScroll .page-preview.pdf-paper-guides{outline:none!important}
        #previewScroll .page-preview.pdf-paper-guides::before,
        #previewScroll .page-preview.pdf-paper-guides::after{display:none!important}}
    `;
    document.head.appendChild(style);
  }
  function install(){
    const preview=$('previewScroll');
    const button=$('previewGuidesToggle');
    if(!preview||!button)return;
    installCss();
    if(!button.dataset.guideBound){
      button.dataset.guideBound='true';
      button.addEventListener('click',()=>{
        visible=!visible;
        button.setAttribute('aria-pressed',String(visible));
        button.textContent=visible?'여백선 ON':'여백선 OFF';
        queue();
      });
    }
    if(!observer && typeof MutationObserver!=='undefined'){
      observer=new MutationObserver(queue);
      // Only preview sheets and their rows change during rendering.
      // CSS/dataset decorations do not trigger childList mutations.
      observer.observe(preview,{childList:true,subtree:true});
    }
    const marginIds=new Set(['marginH','marginV','marginLeft','marginRight','marginTop',
      'marginBottom','paperSize','customW','customH','facingPages','pnAutoReserve','pnEnabled',
      'pnPosition','pnFontSize','pnMarginMm','bookletCheck','gap']);
    if(!document.documentElement.dataset.pdfGuidesBound){
      document.documentElement.dataset.pdfGuidesBound='1';
      for(const type of ['input','change']){
        document.addEventListener(type,event=>{if(marginIds.has(event.target?.id))queue();},true);
      }
      document.addEventListener('pdf-page-selection-change',queue);
      document.addEventListener('pdf-import-committed',queue);
    }
    queue();
  }
  window.PdfPreviewMarginGuides={install,refresh:queue,get visible(){return visible;},
    paperFor,marginFor,stage:'sheet-solid-border-dashed-margin-nonprinting-v1'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [160,700,1800].forEach(delay=>setTimeout(install,delay));
})();
