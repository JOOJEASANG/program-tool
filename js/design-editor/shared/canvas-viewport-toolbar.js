(function(){
  'use strict';
  if(window.__designEditorCanvasViewportToolbarV1)return;
  window.__designEditorCanvasViewportToolbarV1=true;

  const STAGE='design-editor-canvas-viewport-toolbar-v1';
  const ROOT_ID='designCanvasViewportToolbar';
  const STYLE_ID='designCanvasViewportToolbarStyles';
  const VIEWPORT_STAGE_ID='designCanvasViewportStage';
  let mounted=false;
  let api=null;

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      html[data-design-canvas-viewport-toolbar="v1"] .editor-main{position:relative}
      html[data-design-canvas-viewport-toolbar="v1"] .artboard-viewport{display:block!important;padding:0!important;scroll-behavior:auto!important}
      .design-canvas-viewport-stage{box-sizing:border-box;min-width:100%;min-height:100%;width:max-content;height:max-content;padding:36px;display:grid;place-items:center}
      .design-canvas-viewport-stage>.artboard{margin:0!important}
      .design-canvas-viewport-toolbar{position:absolute;z-index:89;left:50%;bottom:44px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;min-height:38px;padding:5px 6px;border:1px solid #d8e2ec;border-radius:12px;background:rgba(255,255,255,.96);box-shadow:0 8px 26px rgba(15,39,72,.14);backdrop-filter:blur(9px);white-space:nowrap}
      .design-canvas-viewport-toolbar button{height:28px;min-width:30px;border:1px solid transparent;border-radius:8px;background:transparent;color:#44546a;font:850 9px/1 Pretendard,"Malgun Gothic",sans-serif;cursor:pointer;padding:0 8px}
      .design-canvas-viewport-toolbar button:hover{background:#eef5fb;color:#17466f}
      .design-canvas-viewport-toolbar button:focus-visible,.design-canvas-viewport-toolbar input:focus-visible{outline:2px solid #2f80ed;outline-offset:1px}
      .design-canvas-viewport-toolbar button.is-active{border-color:#b7d3ec;background:#eaf4ff;color:#1769e0}
      .design-canvas-viewport-toolbar .design-canvas-zoom-step{font-size:17px;font-weight:700;padding:0;width:30px}
      .design-canvas-viewport-toolbar .design-canvas-zoom-field{height:28px;display:flex;align-items:center;gap:1px;border:1px solid #dbe5ee;border-radius:8px;background:#fff;padding:0 5px;color:#526174;font-size:9px;font-weight:900}
      .design-canvas-viewport-toolbar .design-canvas-zoom-field input{width:36px;border:0;outline:0;background:transparent;text-align:right;padding:0;color:#213547;font:900 10px/1 Pretendard,"Malgun Gothic",sans-serif;-moz-appearance:textfield}
      .design-canvas-viewport-toolbar .design-canvas-zoom-field input::-webkit-inner-spin-button,.design-canvas-viewport-toolbar .design-canvas-zoom-field input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
      .design-canvas-viewport-toolbar .design-canvas-separator{width:1px;height:20px;background:#e1e8ef;margin:0 2px}
      .design-canvas-viewport-toolbar .design-canvas-fit{min-width:43px}
      .design-canvas-viewport-toolbar .design-canvas-center{min-width:46px}
      @media(max-width:700px){.design-canvas-viewport-stage{padding:24px}.design-canvas-viewport-toolbar{bottom:42px;max-width:calc(100vw - 22px);padding:4px}.design-canvas-viewport-toolbar button{padding:0 6px}.design-canvas-viewport-toolbar .design-canvas-center{min-width:36px}.design-canvas-viewport-toolbar .design-canvas-center .design-canvas-wide{display:none}}
    `;
    document.head.appendChild(style);
  }

  function currentApi(){
    const candidate=window.DesignEditorApp?.viewport;
    if(!candidate||typeof candidate.getState!=='function'||typeof candidate.setZoom!=='function')return null;
    return candidate;
  }

  function ensureViewportStage(viewport){
    const artboard=document.getElementById('artboard');
    if(!viewport||!artboard)return null;
    let stage=document.getElementById(VIEWPORT_STAGE_ID);
    if(!stage){
      stage=document.createElement('div');
      stage.id=VIEWPORT_STAGE_ID;
      stage.className='design-canvas-viewport-stage';
      stage.setAttribute('aria-label','캔버스 작업영역');
      viewport.insertBefore(stage,artboard);
    }
    if(artboard.parentElement!==stage)stage.appendChild(artboard);
    return stage;
  }

  function sync(state=null){
    const root=document.getElementById(ROOT_ID);
    if(!root)return false;
    api=currentApi()||api;
    if(!api)return false;
    const next=state||api.getState();
    const input=root.querySelector('[data-canvas-zoom-value]');
    const fit=root.querySelector('[data-canvas-view-action="fit"]');
    if(input&&document.activeElement!==input)input.value=String(Math.max(1,Math.round(Number(next.percent)||100)));
    if(input){input.min=String(next.min||10);input.max=String(next.max||400);}
    if(fit){
      const active=next.mode==='fit';
      fit.classList.toggle('is-active',active);
      fit.setAttribute('aria-pressed',String(active));
    }
    root.dataset.zoomMode=String(next.mode||'fit');
    root.dataset.zoomPercent=String(Math.max(1,Math.round(Number(next.percent)||100)));
    return true;
  }

  function run(action,value){
    api=currentApi()||api;
    if(!api)return;
    if(action==='zoom-out')api.zoomOut();
    else if(action==='zoom-in')api.zoomIn();
    else if(action==='fit')api.fit();
    else if(action==='actual')api.actual();
    else if(action==='center')api.center();
    else if(action==='set')api.setZoom(value);
    sync();
  }

  function mount(){
    if(mounted&&document.getElementById(ROOT_ID))return true;
    api=currentApi();
    const viewport=document.getElementById('artboardViewport');
    const host=document.querySelector('.editor-main');
    if(!api||!viewport||!host)return false;
    ensureStyles();
    if(!ensureViewportStage(viewport))return false;
    let root=document.getElementById(ROOT_ID);
    if(!root){
      root=document.createElement('div');
      root.id=ROOT_ID;
      root.className='design-canvas-viewport-toolbar';
      root.setAttribute('role','toolbar');
      root.setAttribute('aria-label','캔버스 보기 도구');
      root.innerHTML=`
        <button type="button" class="design-canvas-zoom-step" data-canvas-view-action="zoom-out" aria-label="캔버스 축소" title="축소">−</button>
        <label class="design-canvas-zoom-field" title="캔버스 확대 비율"><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)">확대 비율</span><input type="number" inputmode="numeric" step="1" data-canvas-zoom-value aria-label="캔버스 확대 비율"><span>%</span></label>
        <button type="button" class="design-canvas-zoom-step" data-canvas-view-action="zoom-in" aria-label="캔버스 확대" title="확대">+</button>
        <span class="design-canvas-separator" aria-hidden="true"></span>
        <button type="button" class="design-canvas-fit" data-canvas-view-action="fit" aria-pressed="false" title="현재 작업영역에 맞추기">맞춤</button>
        <button type="button" data-canvas-view-action="actual" title="CSS 실제 크기 100%">100%</button>
        <button type="button" class="design-canvas-center" data-canvas-view-action="center" title="현재 배율을 유지하고 캔버스를 가운데로 이동"><span class="design-canvas-wide">가운데</span><span aria-hidden="true">◎</span></button>`;
      host.appendChild(root);
      root.querySelectorAll('[data-canvas-view-action]').forEach(button=>button.addEventListener('click',()=>run(button.dataset.canvasViewAction)));
      const input=root.querySelector('[data-canvas-zoom-value]');
      const commit=()=>run('set',input.value);
      input.addEventListener('change',commit);
      input.addEventListener('keydown',event=>{
        if(event.key==='Enter'){event.preventDefault();commit();input.blur();}
        else if(event.key==='Escape'){event.preventDefault();sync();input.blur();}
      });
    }
    document.documentElement.dataset.designCanvasViewportToolbar='v1';
    mounted=true;
    sync();
    return true;
  }

  function retry(attempt=0){
    if(mount())return;
    if(attempt<80)setTimeout(()=>retry(attempt+1),50+Math.min(attempt,10)*10);
  }

  window.addEventListener('designeditor:viewport-change',event=>sync(event.detail));
  window.addEventListener('programstudio:document-type-change',()=>setTimeout(sync,0));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>retry(),{once:true});else retry();

  window.DesignEditorCanvasViewportToolbar={stage:STAGE,mount,sync};
})();