// Screen-only fold guide overlay for invitation / notice products.
(function(){
  'use strict';
  if(window.__designEditorInvitationFoldOverlayV1)return;
  window.__designEditorInvitationFoldOverlayV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const STYLE_ID='designInvitationFoldOverlayStyles';
  const OVERLAY_ID='designInvitationFoldOverlay';
  let observer=null;
  let resizeObserver=null;
  let frame=0;
  let retry=0;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=p=>p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  const numericList=value=>Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const mm=value=>{const n=round1(value);return Number.isInteger(n)?String(n):n.toFixed(1);};

  function isInvitation(p=project()){
    const app=String(params.get('app')||'').toLowerCase();
    return Boolean(p&&(p.printProductMode==='invitation'||p.designMode==='invitation'||app==='invitation'||app==='notice'));
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      .design-invitation-fold-overlay{position:absolute;inset:0;z-index:46;pointer-events:none;overflow:visible}
      .design-invitation-fold-overlay[hidden]{display:none!important}
      .design-invitation-fold-line{position:absolute;box-sizing:border-box;z-index:1}
      .design-invitation-fold-line.x{width:0;border-left:2px dashed #f59e0b}
      .design-invitation-fold-line.y{height:0;border-top:2px dashed #f59e0b}
      .design-invitation-fold-label{position:absolute;z-index:2;transform:translate(-50%,-50%);padding:3px 6px;border:1px dashed #f59e0b;border-radius:999px;background:rgba(255,255,255,.98);color:#9a5808;font-size:7px;font-weight:950;line-height:1;white-space:nowrap;box-shadow:0 1px 4px rgba(15,23,42,.10)}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(artboard){
    let overlay=byId(OVERLAY_ID);
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id=OVERLAY_ID;
      overlay.className='design-invitation-fold-overlay';
      overlay.setAttribute('aria-hidden','true');
      artboard.appendChild(overlay);
    }
    return overlay;
  }

  function signature(p,surface,axis,folds){
    return [p.width,p.height,p.bleed,p.showGuides,p.showFolds,p.activeSurface,surface?.id,axis,...folds].join('|');
  }

  function refresh(){
    frame=0;
    installStyles();
    const p=project(),artboard=byId('artboard');
    if(!p||!artboard){scheduleRetry();return false;}
    const overlay=ensureOverlay(artboard);
    const surface=activeSurface(p);
    const axis=surface?.foldAxis==='y'||numericList(surface?.foldsY).length?'y':'x';
    const folds=(axis==='y'?numericList(surface?.foldsY):numericList(surface?.folds)).filter(value=>value>0&&value<(axis==='y'?Number(p.height)||0:Number(p.width)||0)).sort((a,b)=>a-b);
    const enabled=isInvitation(p)&&p.showGuides!==false&&p.showFolds!==false&&surface&&folds.length>0;
    overlay.hidden=!enabled;
    if(!enabled){overlay.replaceChildren();delete overlay.dataset.signature;return false;}

    const nextSignature=signature(p,surface,axis,folds);
    if(overlay.dataset.signature===nextSignature)return true;

    const bleed=Math.max(0,Number(p.bleed)||0);
    const width=Math.max(.001,Number(p.width)||0);
    const height=Math.max(.001,Number(p.height)||0);
    const totalW=width+bleed*2,totalH=height+bleed*2;
    const sx=artboard.clientWidth/Math.max(.001,totalW),sy=artboard.clientHeight/Math.max(.001,totalH);
    const nodes=[];

    folds.forEach((fold,index)=>{
      const line=document.createElement('div');
      line.className=`design-invitation-fold-line ${axis}`;
      const label=document.createElement('span');
      label.className='design-invitation-fold-label';
      label.textContent=`접는선 ${index+1} · ${mm(fold)}mm`;
      if(axis==='x'){
        const x=(bleed+fold)*sx;
        line.style.left=`${x}px`;line.style.top=`${bleed*sy}px`;line.style.height=`${height*sy}px`;
        label.style.left=`${x}px`;label.style.top=`${Math.max(14,bleed*sy+14)}px`;
      }else{
        const y=(bleed+fold)*sy;
        line.style.left=`${bleed*sx}px`;line.style.top=`${y}px`;line.style.width=`${width*sx}px`;
        label.style.left=`${(bleed+width/2)*sx}px`;label.style.top=`${y}px`;
      }
      nodes.push(line,label);
    });

    overlay.replaceChildren(...nodes);
    overlay.dataset.signature=nextSignature;
    return true;
  }

  function schedule(){
    if(frame)return;
    frame=requestAnimationFrame(refresh);
  }

  function scheduleRetry(){
    clearTimeout(retry);
    retry=setTimeout(schedule,120);
  }

  function connect(){
    const artboard=byId('artboard');
    if(!artboard){scheduleRetry();return;}
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(schedule);
      observer.observe(artboard,{childList:true,subtree:false});
    }
    if(!resizeObserver&&typeof ResizeObserver==='function'){
      resizeObserver=new ResizeObserver(schedule);
      resizeObserver.observe(artboard);
    }
  }

  ['resize','programstudio:design-document-type','programstudio:document-type-change','programstudio:design-mode-change','programstudio:design-product-change','designeditor:viewport-change'].forEach(name=>window.addEventListener(name,()=>{connect();schedule();},{passive:true}));
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#designInvitationCreaseTools,[data-product="invitation"]'))[0,40,140].forEach(delay=>setTimeout(schedule,delay));
  },true);
  document.addEventListener('change',event=>{
    if(event.target.closest?.('#designInvitationCreaseTools'))[0,40,140].forEach(delay=>setTimeout(schedule,delay));
  },true);

  function boot(){installStyles();connect();schedule();[120,350,800,1600].forEach(delay=>setTimeout(()=>{connect();schedule();},delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  window.DesignEditorInvitationFoldOverlay={refresh:schedule,sync:schedule,stage:'invitation-fold-overlay-v1'};
})();
