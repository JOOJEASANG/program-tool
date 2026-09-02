// Cover preview visual cleanup: keep dashed guides and color-code print areas consistently.
(function(){
  'use strict';
  if(window.__designEditorCoverPreviewCleanupV5)return;
  window.__designEditorCoverPreviewCleanupV5=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const STYLE_ID='designCoverPreviewCleanupStyles';
  const SIZE_ID='designCoverPreviewSizeBadge';
  const BLEED_ID='designCoverPreviewBleedBand';
  const ZONES_ID='designCoverPreviewZones';
  let observer=null;
  let resizeObserver=null;
  let frame=0;
  let retryTimer=0;
  let previewRefreshTimer=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const mm=value=>{
    const n=round1(value);
    return Number.isInteger(n)?String(n):n.toFixed(1);
  };

  function installStyles(){
    let style=byId(STYLE_ID);
    if(style)style.remove();
    style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      /* Same print-guide color language as the other design modes.
         blue=work area, red=trim, green=safe, orange=cover panel/fold.
         Bleed is shown by the spacing between the blue work-area edge and red trim line without a color fill. */
      #artboard{outline:1.5px dashed #2563eb!important;outline-offset:-1px!important}
      #artboard .trim-guide{display:block!important;border:1.5px dashed #dc2626!important;background:transparent!important;opacity:1!important}
      #artboard .safe-guide{display:none!important}
      #artboard .fold-guide{display:none!important}
      .panel-guide-label{display:none!important}

      .cover-preview-bleed-band{
        position:absolute;inset:0;z-index:2;pointer-events:none;
        background:transparent!important;box-shadow:none!important;
      }
      .cover-preview-bleed-band[hidden]{display:none!important}

      #designCoverPreviewZones{overflow:visible!important}
      .cover-preview-zone{overflow:visible!important;box-sizing:border-box!important;background:transparent!important;border:0!important}
      .cover-preview-zone[data-zone="back"]{border-right:1.5px dashed #f59e0b!important}
      .cover-preview-zone[data-zone="spine"]{border-right:1.5px dashed #f59e0b!important;z-index:3!important}
      .cover-preview-zone[data-zone="front"]{border:0!important}

      .cover-preview-zone-label{
        top:-28px!important;left:50%!important;z-index:6!important;
        max-width:none!important;min-width:max-content!important;
        padding:3px 8px!important;border:1px dashed #f59e0b!important;border-radius:999px!important;
        background:rgba(255,255,255,.99)!important;box-shadow:0 2px 7px rgba(15,23,42,.10)!important;
        color:#b45309!important;font-size:7.5px!important;font-weight:950!important;
        line-height:1.2!important;white-space:nowrap!important
      }
      .cover-preview-zone-safe,
      .cover-preview-zone-safe[data-zone="back"],
      .cover-preview-zone-safe[data-zone="spine"],
      .cover-preview-zone-safe[data-zone="front"]{
        z-index:1!important;background:transparent!important;border:1.2px dashed #16a34a!important
      }
      .cover-preview-size-badge{
        position:absolute;left:50%;bottom:-30px;z-index:38;transform:translateX(-50%);
        padding:4px 9px;border:1px dashed #dc2626;border-radius:999px;background:rgba(255,255,255,.99);
        box-shadow:0 2px 8px rgba(15,23,42,.10);color:#991b1b;font-size:7.5px;font-weight:950;
        line-height:1.2;white-space:nowrap;pointer-events:none
      }
      @media(max-width:760px){.cover-preview-size-badge{bottom:-27px;font-size:6.5px;padding:3px 7px}}
    `;
    document.head.appendChild(style);
  }

  function sizeText(p){
    const cover=p?.cover||{};
    const trimW=Number(cover.trimWidth)||210;
    const trimH=Number(cover.trimHeight)||Number(p?.height)||297;
    const spine=Number(cover.spine)||0;
    const spread=Number(cover.spreadWidth)||Number(p?.width)||(trimW*2+spine);
    const bleed=Math.max(0,Number(p?.bleed??cover.bleed)||0);
    const safe=Math.max(0,Number(p?.safe??cover.safe)||0);
    return `표지 펼침 ${mm(spread)} × ${mm(trimH)} mm · 앞/뒤 ${mm(trimW)} × ${mm(trimH)} mm · 책등 ${mm(spine)} mm · 재단여백 ${mm(bleed)} mm · 안전여백 ${mm(safe)} mm`;
  }

  function ensureBleedBand(artboard){
    let band=byId(BLEED_ID);
    if(!band){
      band=document.createElement('div');
      band.id=BLEED_ID;
      band.className='cover-preview-bleed-band';
      band.setAttribute('aria-hidden','true');
      artboard.appendChild(band);
    }
    return band;
  }

  function decorate(){
    frame=0;
    const p=project(),artboard=byId('artboard');
    if(!p||!artboard||p.designMode!=='cover')return false;
    const cover=p.cover||{};
    const bleed=Math.max(0,Number(p.bleed??cover.bleed)||0);
    const spread=Number(cover.spreadWidth)||Number(p.width)||0;
    const totalW=spread+bleed*2;
    const band=ensureBleedBand(artboard);
    const bleedPx=totalW>0?(artboard.clientWidth/totalW)*bleed:0;
    band.style.setProperty('--cover-preview-bleed-px',`${Math.max(0,bleedPx)}px`);
    band.dataset.fill='none';
    band.hidden=bleed<=0;

    let badge=byId(SIZE_ID);
    if(!badge){
      badge=document.createElement('div');
      badge.id=SIZE_ID;
      badge.className='cover-preview-size-badge';
      badge.setAttribute('aria-hidden','true');
      artboard.appendChild(badge);
    }
    const text=sizeText(p);
    if(badge.textContent!==text)badge.textContent=text;
    document.documentElement.dataset.coverPreviewCleanup='5';
    return true;
  }

  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(decorate);
  }

  function renderPreviewZones(){
    const api=window.DesignEditorCoverPreviewZones;
    if(typeof api?.render!=='function')return false;
    try{return Boolean(api.render());}catch(error){console.warn('Cover preview zone refresh failed',error);return false;}
  }

  function refreshPreviewZones(){
    renderPreviewZones();
    schedule();
    clearTimeout(previewRefreshTimer);
    previewRefreshTimer=setTimeout(()=>{
      previewRefreshTimer=0;
      renderPreviewZones();
      schedule();
    },120);
  }

  function connect(){
    clearTimeout(retryTimer);
    const artboard=byId('artboard');
    if(!artboard||!project()){
      retryTimer=setTimeout(connect,120);
      return;
    }
    installStyles();
    if(!observer){
      observer=new MutationObserver(()=>{
        schedule();
        if(!byId(ZONES_ID))renderPreviewZones();
      });
      observer.observe(artboard,{childList:true,subtree:false});
    }
    if(!resizeObserver&&window.ResizeObserver){
      resizeObserver=new ResizeObserver(()=>schedule());
      resizeObserver.observe(artboard);
    }
    schedule();
  }

  document.addEventListener('input',event=>{
    if(['coverTrimWidth','coverTrimHeight','coverBleed','coverSafe','coverPageCount','coverPaperCaliper','coverBindingAdjust','coverSpineManual'].includes(event.target?.id))setTimeout(schedule,0);
  },true);
  document.addEventListener('change',event=>{
    if(event.target?.closest?.('#designCoverSettings,#designCoverSpineTools,#designCoverPreviewZoneTools'))setTimeout(schedule,0);
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('#designCoverSettings button,#designCoverSpineTools button,.design-mode-apply'))setTimeout(schedule,0);
  },true);
  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('programstudio:cover-geometry-change',refreshPreviewZones);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});
  else connect();
})();
