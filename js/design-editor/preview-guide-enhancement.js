// General design preview guides: color-code dashed production guides and show leaflet panel margins.
(function(){
  'use strict';
  if(window.__designEditorPreviewGuideEnhancementV3)return;
  window.__designEditorPreviewGuideEnhancementV3=true;

  const params=new URLSearchParams(location.search);
  if(params.get('mode')==='cover')return;

  const STYLE_ID='designPreviewGuideEnhancementStyles';
  const SIZE_ID='designPreviewSizeBadge';
  const LEGEND_ID='designPreviewGuideLegend';
  const BLEED_ID='designPreviewBleedBand';
  const PANEL_ID='designPreviewPanelOverlay';
  let artboardObserver=null;
  let resizeObserver=null;
  let retryTimer=0;
  let frame=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=p=>p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const mm=value=>{
    const n=round1(value);
    return Number.isInteger(n)?String(n):n.toFixed(1);
  };

  function isCover(){
    const p=project();
    return params.get('mode')==='cover'||p?.designMode==='cover';
  }

  function isLeaflet(p){
    return p?.designMode==='leaflet2'||p?.designMode==='leaflet3';
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Production guide colors. Every guide remains dashed and screen-only.
         blue=work area, red=trim, purple=bleed, green=outer safe,
         orange=fold, teal=per-panel safe margin. */
      #artboard[data-design-preview-guides="3"]{
        outline:1.5px dashed #2563eb!important;
        outline-offset:-1px!important;
      }
      #artboard[data-design-preview-guides="3"] .trim-guide{
        display:block!important;
        border:1.5px dashed #dc2626!important;
        background:transparent!important;
        opacity:1!important;
      }
      #artboard[data-design-preview-guides="3"] .safe-guide{
        display:block!important;
        border:1.2px dashed #16a34a!important;
        background:transparent!important;
        opacity:1!important;
      }
      #artboard[data-design-preview-guides="3"] .fold-guide{
        display:block!important;
        border:0!important;
        border-left:1.5px dashed #f59e0b!important;
        opacity:1!important;
        z-index:31!important;
      }
      #artboard[data-design-preview-guides="3"] .fold-guide.leaflet2-horizontal-fold-guide{
        border:0!important;
        border-left:0!important;
        border-top:1.5px dashed #f59e0b!important;
      }
      #artboard[data-leaflet-panel-guides="1"]>.panel-guide-label{display:none!important}

      .design-preview-bleed-band{
        position:absolute;inset:0;z-index:2;pointer-events:none;
        box-shadow:inset 0 0 0 var(--design-preview-bleed-px,0px) rgba(124,58,237,.10);
      }
      .design-preview-bleed-band[hidden]{display:none!important}

      .design-preview-panel-overlay{position:absolute;inset:0;z-index:32;pointer-events:none;overflow:visible}
      .design-preview-panel-overlay[hidden]{display:none!important}
      .design-preview-panel-safe{
        position:absolute;box-sizing:border-box;border:1.2px dashed #0891b2;background:rgba(8,145,178,.025);
      }
      .design-preview-panel-label{
        position:absolute;z-index:2;transform:translate(-50%,0);padding:3px 7px;border:1px dashed #0891b2;
        border-radius:999px;background:rgba(255,255,255,.97);box-shadow:0 1px 4px rgba(15,23,42,.09);
        color:#0e7490;font-size:7px;font-weight:950;line-height:1.15;white-space:nowrap;
      }
      .design-preview-panel-margin-label{
        position:absolute;left:4px;bottom:4px;padding:2px 5px;border:1px dashed rgba(8,145,178,.68);
        border-radius:999px;background:rgba(255,255,255,.94);color:#0e7490;font-size:6.2px;font-weight:900;
        line-height:1.1;white-space:nowrap;
      }

      .design-preview-size-badge{
        position:absolute;left:50%;top:-30px;z-index:42;transform:translateX(-50%);
        padding:4px 9px;border:1px dashed #dc2626;border-radius:999px;background:rgba(255,255,255,.99);
        box-shadow:0 2px 8px rgba(15,23,42,.10);color:#b91c1c;font-size:8px;font-weight:950;
        line-height:1.15;white-space:nowrap;pointer-events:none;
      }
      .design-preview-guide-legend{
        position:absolute;left:50%;bottom:-30px;z-index:42;transform:translateX(-50%);
        display:flex;align-items:center;justify-content:center;gap:5px;max-width:none;
        white-space:nowrap;pointer-events:none;
      }
      .design-preview-guide-chip{
        display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border:1px dashed #d8e0e8;
        border-radius:999px;background:rgba(255,255,255,.98);box-shadow:0 1px 4px rgba(15,23,42,.07);
        color:#475569;font-size:6.8px;font-weight:900;line-height:1.15;
      }
      .design-preview-guide-line{width:10px;height:0;border-top:1.5px dashed #2563eb;flex:0 0 10px}
      .design-preview-guide-chip[data-guide="trim"] .design-preview-guide-line{border-top-color:#dc2626}
      .design-preview-guide-chip[data-guide="bleed"] .design-preview-guide-line{border-top-color:#7c3aed}
      .design-preview-guide-chip[data-guide="safe"] .design-preview-guide-line{border-top-color:#16a34a}
      .design-preview-guide-chip[data-guide="fold"] .design-preview-guide-line{border-top-color:#f59e0b}
      .design-preview-guide-chip[data-guide="panel"] .design-preview-guide-line{border-top-color:#0891b2}
      @media(max-width:760px){
        .design-preview-size-badge{top:-27px;font-size:7px;padding:3px 7px}
        .design-preview-guide-legend{bottom:-27px;gap:3px}
        .design-preview-guide-chip{font-size:6px;padding:2px 4px;gap:3px}
        .design-preview-panel-label{font-size:6.2px;padding:2px 5px}
        .design-preview-panel-margin-label{font-size:5.7px}
      }
    `;
    document.head.appendChild(style);
  }

  function chip(key,label){
    const node=document.createElement('span');
    node.className='design-preview-guide-chip';
    node.dataset.guide=key;
    const line=document.createElement('span');line.className='design-preview-guide-line';
    const text=document.createElement('span');text.textContent=label;
    node.append(line,text);
    return node;
  }

  function numericList(value){
    return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];
  }

  function panelSignature(p,surface){
    return [
      p.designMode,round1(p.width),round1(p.height),round1(p.bleed),round1(p.safe),surface?.foldAxis||'',
      ...numericList(surface?.folds).map(round1),...numericList(surface?.foldsY).map(round1),...(surface?.panels||[])
    ].join('|');
  }

  function guideSignature(p,surface){
    return [
      panelSignature(p,surface),p.showGuides!==false?'guides':'no-guides',p.showFolds!==false?'folds':'no-folds'
    ].join('|');
  }

  function ensureBleedBand(artboard){
    let band=byId(BLEED_ID);
    if(!band){
      band=document.createElement('div');
      band.id=BLEED_ID;
      band.className='design-preview-bleed-band';
      band.setAttribute('aria-hidden','true');
      artboard.appendChild(band);
    }
    return band;
  }

  function ensurePanelOverlay(artboard){
    let overlay=byId(PANEL_ID);
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id=PANEL_ID;
      overlay.className='design-preview-panel-overlay';
      overlay.setAttribute('aria-hidden','true');
      artboard.appendChild(overlay);
    }
    return overlay;
  }

  function renderPanelGuides(p,surface,artboard,totalW,totalH){
    const overlay=ensurePanelOverlay(artboard);
    const enabled=isLeaflet(p)&&p.showGuides!==false&&p.showFolds!==false;
    overlay.hidden=!enabled;
    if(!enabled){
      delete artboard.dataset.leafletPanelGuides;
      return;
    }
    artboard.dataset.leafletPanelGuides='1';

    const signature=panelSignature(p,surface);
    if(overlay.dataset.signature===signature)return;
    const bleed=Math.max(0,Number(p.bleed)||0);
    const safe=Math.max(0,Number(p.safe)||0);
    const scaleX=artboard.clientWidth/Math.max(.001,totalW);
    const scaleY=artboard.clientHeight/Math.max(.001,totalH);
    const foldsX=numericList(surface?.folds).sort((a,b)=>a-b);
    const foldsY=numericList(surface?.foldsY).sort((a,b)=>a-b);
    const axis=(surface?.foldAxis==='y'||foldsY.length)?'y':'x';
    const length=axis==='y'?Number(p.height)||0:Number(p.width)||0;
    const folds=(axis==='y'?foldsY:foldsX).filter(value=>value>0&&value<length);
    const bounds=[0,...folds,length];
    const panels=Array.isArray(surface?.panels)?surface.panels:[];
    const nodes=[];

    for(let index=0;index<bounds.length-1;index+=1){
      const start=bounds[index],end=bounds[index+1],span=Math.max(0,end-start);
      const label=document.createElement('div');
      label.className='design-preview-panel-label';
      const panelName=String(panels[index]||'').trim();
      label.textContent=`${index+1}단${panelName?` · ${panelName}`:''} · ${mm(span)}mm`;

      const safeBox=document.createElement('div');
      safeBox.className='design-preview-panel-safe';
      safeBox.dataset.panel=String(index+1);
      const margin=document.createElement('span');
      margin.className='design-preview-panel-margin-label';
      margin.textContent=`${index+1}단 여백 ${mm(safe)}mm`;
      safeBox.appendChild(margin);

      if(axis==='x'){
        label.style.left=`${(bleed+(start+end)/2)*scaleX}px`;
        label.style.top=`${bleed*scaleY+5}px`;
        safeBox.style.left=`${(bleed+start+safe)*scaleX}px`;
        safeBox.style.top=`${(bleed+safe)*scaleY}px`;
        safeBox.style.width=`${Math.max(1,(span-safe*2)*scaleX)}px`;
        safeBox.style.height=`${Math.max(1,((Number(p.height)||0)-safe*2)*scaleY)}px`;
      }else{
        label.style.left=`${(bleed+(Number(p.width)||0)/2)*scaleX}px`;
        label.style.top=`${(bleed+start)*scaleY+5}px`;
        safeBox.style.left=`${(bleed+safe)*scaleX}px`;
        safeBox.style.top=`${(bleed+start+safe)*scaleY}px`;
        safeBox.style.width=`${Math.max(1,((Number(p.width)||0)-safe*2)*scaleX)}px`;
        safeBox.style.height=`${Math.max(1,(span-safe*2)*scaleY)}px`;
      }
      nodes.push(safeBox,label);
    }
    overlay.replaceChildren(...nodes);
    overlay.dataset.signature=signature;
  }

  function decorate(){
    frame=0;
    const p=project(),artboard=byId('artboard');
    if(!p||!artboard||isCover())return false;
    const surface=activeSurface(p);
    const signature=guideSignature(p,surface);
    const bleed=Math.max(0,Number(p.bleed)||0);
    const totalW=(Number(p.width)||0)+bleed*2;
    const totalH=(Number(p.height)||0)+bleed*2;

    artboard.dataset.designPreviewGuides='3';

    const bleedBand=ensureBleedBand(artboard);
    const bleedPx=totalW>0?(artboard.clientWidth/totalW)*bleed:0;
    bleedBand.style.setProperty('--design-preview-bleed-px',`${Math.max(0,bleedPx)}px`);
    bleedBand.hidden=p.showGuides===false||bleed<=0;

    renderPanelGuides(p,surface,artboard,totalW,totalH);

    let size=byId(SIZE_ID);
    if(!size){
      size=document.createElement('div');
      size.id=SIZE_ID;
      size.className='design-preview-size-badge';
      size.setAttribute('aria-hidden','true');
      artboard.appendChild(size);
    }
    const sizeText=`완성 규격 ${mm(p.width)} × ${mm(p.height)} mm`;
    if(size.textContent!==sizeText)size.textContent=sizeText;

    let legend=byId(LEGEND_ID);
    if(!legend){
      legend=document.createElement('div');
      legend.id=LEGEND_ID;
      legend.className='design-preview-guide-legend';
      legend.setAttribute('aria-hidden','true');
      artboard.appendChild(legend);
    }
    if(legend.dataset.signature!==signature){
      const nodes=[chip('work',`작업영역 ${mm(totalW)}×${mm(totalH)}mm`)];
      if(p.showGuides!==false){
        nodes.push(chip('trim',`재단영역 ${mm(p.width)}×${mm(p.height)}mm`));
        nodes.push(chip('bleed',`재단여백 ${mm(bleed)}mm`));
        nodes.push(chip('safe',`안전여백 ${mm(p.safe)}mm`));
      }
      const folds=numericList(surface?.folds);
      const foldsY=numericList(surface?.foldsY);
      if(p.showGuides!==false&&p.showFolds!==false&&folds.length){
        nodes.push(chip('fold',`접지선 ${folds.map(value=>mm(value)).join(' / ')}mm`));
      }
      if(p.showGuides!==false&&p.showFolds!==false&&foldsY.length){
        nodes.push(chip('fold',`가로 접지선 ${foldsY.map(value=>mm(value)).join(' / ')}mm`));
      }
      if(isLeaflet(p)&&p.showGuides!==false&&p.showFolds!==false){
        nodes.push(chip('panel',`단별 여백 ${mm(p.safe)}mm`));
      }
      legend.replaceChildren(...nodes);
      legend.dataset.signature=signature;
    }

    document.documentElement.dataset.designPreviewGuides='3';
    return true;
  }

  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(decorate);
  }

  function connect(){
    clearTimeout(retryTimer);
    const artboard=byId('artboard');
    if(!artboard||!project()){
      retryTimer=setTimeout(connect,120);
      return;
    }
    installStyles();
    if(!artboardObserver){
      artboardObserver=new MutationObserver(()=>schedule());
      artboardObserver.observe(artboard,{childList:true,subtree:false});
    }
    if(!resizeObserver&&window.ResizeObserver){
      resizeObserver=new ResizeObserver(()=>{
        const overlay=byId(PANEL_ID);
        if(overlay)delete overlay.dataset.signature;
        schedule();
      });
      resizeObserver.observe(artboard);
    }
    schedule();
  }

  document.addEventListener('input',event=>{
    if(['bleedInput','safeInput','designModeWidth','designModeHeight'].includes(event.target?.id)){
      const overlay=byId(PANEL_ID);if(overlay)delete overlay.dataset.signature;
      schedule();
    }
  },true);
  document.addEventListener('change',event=>{
    if(['guideToggle','foldToggle','designModePaper','designModeOrientation','designModeFold','designLeaflet2Layout'].includes(event.target?.id)){
      const overlay=byId(PANEL_ID);if(overlay)delete overlay.dataset.signature;
      setTimeout(schedule,0);
    }
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.design-mode-apply,.surface-tab')){
      const overlay=byId(PANEL_ID);if(overlay)delete overlay.dataset.signature;
      setTimeout(schedule,0);
    }
  },true);
  window.addEventListener('resize',schedule,{passive:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
  else connect();

  window.DesignEditorPreviewGuides={refresh:schedule,stage:'general-preview-guides-v3-colored-panels'};
})();
