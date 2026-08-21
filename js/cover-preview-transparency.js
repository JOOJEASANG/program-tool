// Preview-only transparent work area for the perfect-binding cover maker.
(function(){
  'use strict';
  if(window.__coverPreviewTransparencyV2)return;
  window.__coverPreviewTransparencyV2=true;
  if(!location.pathname.includes('perfect-binding-cover'))return;

  const KEYS={front:'#ff00ff',back:'#00ffff',spine:'#00ff00'};
  let wrappedDelegate=null;
  let resizeObserver=null;
  const byId=id=>document.getElementById(id);

  function installStyles(){
    if(byId('coverPreviewTransparencyStyles'))return;
    const style=document.createElement('style');style.id='coverPreviewTransparencyStyles';
    style.textContent=`
      .canvas-shell{background:#fff!important}
      .canvas-wrap{background:repeating-conic-gradient(#e8eef3 0% 25%,#fff 0% 50%) 50%/18px 18px!important}
      #previewCanvas{opacity:0!important;position:relative;z-index:2}
      #coverTransparentPreviewCanvas{position:absolute;inset:0;z-index:3;display:block;pointer-events:none;max-width:none}
      .cover-text-canvas-layer{z-index:4!important}
    `;
    document.head.appendChild(style);
  }

  function ensureDisplayCanvas(source){
    const wrap=source?.parentElement;if(!wrap)return null;
    let display=byId('coverTransparentPreviewCanvas');
    if(!display){
      display=document.createElement('canvas');display.id='coverTransparentPreviewCanvas';display.setAttribute('aria-hidden','true');wrap.appendChild(display);
    }
    return display;
  }

  function syncSize(source=byId('previewCanvas')){
    const display=byId('coverTransparentPreviewCanvas');if(!source||!display)return;
    const rect=source.getBoundingClientRect();
    display.style.width=source.style.width||`${rect.width}px`;
    display.style.height=source.style.height||`${rect.height}px`;
  }

  function bindResize(source){
    if(!source||typeof ResizeObserver!=='function'||resizeObserver)return;
    resizeObserver=new ResizeObserver(()=>syncSize(source));resizeObserver.observe(source);
  }

  function keySet(){return new Set(Object.values(KEYS).map(v=>v.toLowerCase()));}
  function makeFacade(display){
    const nativeGetContext=HTMLCanvasElement.prototype.getContext.bind(display);
    let ctx=null;
    return new Proxy(display,{
      get(target,prop){
        if(prop==='id')return'previewCanvas';
        if(prop==='getContext')return(type)=>{
          if(type!=='2d')return nativeGetContext(type);
          if(ctx)return ctx;
          ctx=nativeGetContext('2d',{alpha:true});
          if(!ctx)return null;
          const nativeFillRect=ctx.fillRect.bind(ctx),nativeClearRect=ctx.clearRect.bind(ctx),keys=keySet();
          ctx.fillRect=function(x,y,w,h){
            const fill=String(ctx.fillStyle||'').toLowerCase();
            if(keys.has(fill)){nativeClearRect(x,y,w,h);return;}
            nativeFillRect(x,y,w,h);
          };
          return ctx;
        };
        const value=Reflect.get(target,prop,target);
        return typeof value==='function'?value.bind(target):value;
      },
      set(target,prop,value){return Reflect.set(target,prop,value,target);}
    });
  }

  function withKeyColors(run){
    const controls={front:byId('frontColor'),back:byId('backColor'),spine:byId('spineColor')};
    const saved={};
    for(const [name,el] of Object.entries(controls)){if(!el)continue;saved[name]=el.value;el.value=KEYS[name];}
    try{return run();}finally{for(const [name,value] of Object.entries(saved))if(controls[name])controls[name].value=value;}
  }

  function wrapRenderer(){
    const current=typeof window.renderCover==='function'?window.renderCover:(typeof renderCover==='function'?renderCover:null);
    if(!current)return false;
    if(current.__coverPreviewTransparencyV2)return true;
    if(wrappedDelegate===current)return true;
    const wrapped=function coverTransparentPreviewRenderer(canvas,dpi=110,withGuides,interactive){
      if(!canvas||canvas.id!=='previewCanvas')return current.apply(this,arguments);
      const display=ensureDisplayCanvas(canvas);if(!display)return current.apply(this,arguments);
      const facade=makeFacade(display);
      const result=withKeyColors(()=>current.call(this,facade,dpi,withGuides,interactive===undefined?true:interactive));
      if(canvas.width!==display.width)canvas.width=display.width;
      if(canvas.height!==display.height)canvas.height=display.height;
      syncSize(canvas);bindResize(canvas);
      return result;
    };
    wrapped.__coverPreviewTransparencyV2=true;wrapped.__coverPreviewTransparencyDelegate=current;
    window.renderCover=wrapped;
    try{renderCover=wrapped;}catch(_){}
    wrappedDelegate=current;
    return true;
  }

  function install(){
    if(!wrapRenderer())return false;
    installStyles();
    const source=byId('previewCanvas');if(source){ensureDisplayCanvas(source);syncSize(source);bindResize(source);}
    try{window.requestRender?.();}catch(_){}
    return true;
  }

  window.CoverPreviewTransparency={install,stage:'transparent-preview-work-area'};
  [450,900,1500,2400,3600,5000].forEach(delay=>setTimeout(install,delay));
  window.addEventListener('resize',()=>requestAnimationFrame(()=>syncSize()),{passive:true});
})();
