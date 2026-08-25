// General design preview guides: use neutral dashed guides, restore panel labels, and show applied mm size.
(function(){
  'use strict';
  if(window.__designEditorPreviewGuideEnhancementV2)return;
  window.__designEditorPreviewGuideEnhancementV2=true;

  const params=new URLSearchParams(location.search);
  if(params.get('mode')==='cover')return;

  const STYLE_ID='designPreviewGuideEnhancementStyles';
  const SIZE_ID='designPreviewSizeBadge';
  const LEGEND_ID='designPreviewGuideLegend';
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

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* All production guides use dashed neutral lines so they remain visible
         without looking like printable artwork. */
      #artboard[data-design-preview-guides="2"]{
        outline:1.5px dashed #64748b!important;
        outline-offset:-1px!important;
      }
      #artboard[data-design-preview-guides="2"] .trim-guide{
        display:block!important;
        border:1.5px dashed #475569!important;
        background:transparent!important;
        opacity:1!important;
      }
      #artboard[data-design-preview-guides="2"] .safe-guide{
        display:block!important;
        border:1.2px dashed #94a3b8!important;
        background:transparent!important;
        opacity:1!important;
      }
      #artboard[data-design-preview-guides="2"] .fold-guide{
        display:block!important;
        border:0!important;
        border-left:1.5px dashed #334155!important;
        opacity:1!important;
        z-index:31!important;
      }
      #artboard[data-design-preview-guides="2"] .panel-guide-label{
        display:block!important;
        visibility:visible!important;
        opacity:1!important;
        z-index:35!important;
        border:1px dashed #64748b!important;
        background:rgba(255,255,255,.98)!important;
        color:#334155!important;
        box-shadow:0 1px 4px rgba(15,23,42,.10)!important;
        font-weight:950!important;
      }
      .design-preview-size-badge{
        position:absolute;left:50%;top:-30px;z-index:42;transform:translateX(-50%);
        padding:4px 9px;border:1px dashed #64748b;border-radius:999px;background:rgba(255,255,255,.99);
        box-shadow:0 2px 8px rgba(15,23,42,.10);color:#334155;font-size:8px;font-weight:950;
        line-height:1.15;white-space:nowrap;pointer-events:none;
      }
      .design-preview-guide-legend{
        position:absolute;left:50%;bottom:-30px;z-index:42;transform:translateX(-50%);
        display:flex;align-items:center;justify-content:center;gap:5px;max-width:none;
        white-space:nowrap;pointer-events:none;
      }
      .design-preview-guide-chip{
        display:inline-flex;align-items:center;gap:4px;padding:3px 6px;border:1px dashed #cbd5e1;
        border-radius:999px;background:rgba(255,255,255,.98);box-shadow:0 1px 4px rgba(15,23,42,.07);
        color:#475569;font-size:6.8px;font-weight:900;line-height:1.15;
      }
      .design-preview-guide-line{width:10px;height:0;border-top:1.5px dashed #64748b;flex:0 0 10px}
      .design-preview-guide-chip[data-guide="trim"] .design-preview-guide-line{border-top-color:#475569}
      .design-preview-guide-chip[data-guide="safe"] .design-preview-guide-line{border-top-color:#94a3b8}
      .design-preview-guide-chip[data-guide="fold"] .design-preview-guide-line{border-top-color:#334155}
      @media(max-width:760px){
        .design-preview-size-badge{top:-27px;font-size:7px;padding:3px 7px}
        .design-preview-guide-legend{bottom:-27px;gap:3px}
        .design-preview-guide-chip{font-size:6px;padding:2px 4px;gap:3px}
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

  function guideSignature(p,surface){
    return [
      round1(p.width),round1(p.height),round1(p.bleed),round1(p.safe),
      p.showGuides!==false?'guides':'no-guides',p.showFolds!==false?'folds':'no-folds',
      ...(surface?.folds||[]).map(round1),...(surface?.panels||[])
    ].join('|');
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

    artboard.dataset.designPreviewGuides='2';

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
      const folds=Array.isArray(surface?.folds)?surface.folds.filter(value=>Number.isFinite(Number(value))):[];
      if(p.showGuides!==false&&p.showFolds!==false&&folds.length){
        nodes.push(chip('fold',`접지선 ${folds.map(value=>mm(value)).join(' / ')}mm`));
      }
      legend.replaceChildren(...nodes);
      legend.dataset.signature=signature;
    }

    // Existing editor panel badges are the authoritative leaflet section labels.
    // Force them visible after every redraw so 2단/3단 labels never disappear.
    artboard.querySelectorAll('.panel-guide-label').forEach(label=>{
      label.style.removeProperty('display');
      label.removeAttribute('hidden');
      label.setAttribute('aria-hidden','true');
    });

    document.documentElement.dataset.designPreviewGuides='2';
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
      resizeObserver=new ResizeObserver(()=>schedule());
      resizeObserver.observe(artboard);
    }
    schedule();
  }

  document.addEventListener('input',event=>{
    if(['bleedInput','safeInput','designModeWidth','designModeHeight'].includes(event.target?.id))schedule();
  },true);
  document.addEventListener('change',event=>{
    if(['guideToggle','foldToggle','designModePaper','designModeOrientation','designModeFold'].includes(event.target?.id))setTimeout(schedule,0);
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.design-mode-apply,.surface-tab'))setTimeout(schedule,0);
  },true);
  window.addEventListener('resize',schedule,{passive:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
  else connect();

  window.DesignEditorPreviewGuides={refresh:schedule,stage:'general-preview-guides-v2-dashed'};
})();
