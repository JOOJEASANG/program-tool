(function(){
  'use strict';
  if(window.__designEditorEmbeddedRuntimeV1)return;
  window.__designEditorEmbeddedRuntimeV1=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  const originalPath=location.pathname.replace(/\/+$/,'')||'/';
  const isGeneral=originalPath==='/design-editor/general'||originalPath==='/design-editor/general.html'||originalPath.endsWith('/design-editor/general.html');
  const isCover=originalPath==='/perfect-binding-cover'||originalPath==='/perfect-binding-cover/index.html'||originalPath.endsWith('/perfect-binding-cover/index.html');
  if(!embedded||(!isGeneral&&!isCover))return;

  // Existing phase2/output modules were deliberately scoped to the original
  // /design-editor/index.html path. Keep those proven guards intact by giving
  // the embedded general editor the same in-document history path without a reload.
  if(isGeneral){
    try{history.replaceState(history.state,'','/design-editor/index.html'+location.search+location.hash);}catch(_){}
  }

  const MODES={
    cover:{label:'표지디자인',short:'표지'},poster:{label:'포스터',short:'포스터'},flyer:{label:'전단지',short:'전단'},
    leaflet2:{label:'2단 리플렛',short:'2단'},leaflet3:{label:'3단 리플렛',short:'3단'},custom:{label:'사용자 지정',short:'직접'}
  };

  function modeFromRequest(){
    const requested=params.get('mode');
    if(MODES[requested])return requested;
    if(isCover)return 'cover';
    const preset=String(params.get('preset')||'');
    if(preset.startsWith('poster-'))return 'poster';
    if(preset.startsWith('flyer-'))return 'flyer';
    if(preset==='leaflet-2')return 'leaflet2';
    if(preset.startsWith('leaflet-3-'))return 'leaflet3';
    return 'custom';
  }

  function installEmbedStyles(){
    if(document.getElementById('designEmbeddedRuntimeStyles'))return;
    const style=document.createElement('style');
    style.id='designEmbeddedRuntimeStyles';
    style.textContent=(isCover
      ? 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.workspace{height:100vh!important}.preview-panel{padding-top:7px!important}'
      : 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.start-screen,.editor-shell{height:100vh!important}')+`
      .design-mode-card{flex:0 0 auto;border:1px solid #dbe5ee;border-radius:12px;background:linear-gradient(180deg,#fafdff,#f6f9fc);padding:10px!important;margin:0!important;box-shadow:none!important}.design-mode-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.design-mode-home{width:26px;height:26px;border:1px solid #d7e0e9;border-radius:7px;background:#fff;color:#475569;text-decoration:none;display:grid;place-items:center;font-size:11px;font-weight:950}.design-mode-title{font-size:11px;font-weight:950;color:#12396d}.design-mode-sub{font-size:7px;color:#7c8797;margin-top:2px}.design-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.design-mode-btn{border:1px solid #d7e0e9;border-radius:7px;background:#fff;color:#667085;padding:6px 2px;font-size:7.5px;font-weight:900;cursor:pointer;white-space:nowrap}.design-mode-btn.on{background:#12396d;border-color:#12396d;color:#fff}.design-mode-options{margin-top:8px;padding-top:8px;border-top:1px solid #e3e9ef}.design-mode-note{font-size:7px;line-height:1.45;color:#7c8797;margin-bottom:6px}.design-mode-field{margin-bottom:5px}.design-mode-field label{display:block;font-size:7px;font-weight:900;color:#667085;margin-bottom:3px}.design-mode-field select,.design-mode-field input{width:100%;border:1px solid #cfd9e3;border-radius:7px;background:#fff;padding:6px 7px;font-size:8px;color:#344054}.design-mode-two{display:grid;grid-template-columns:1fr 1fr;gap:5px}.design-mode-apply{width:100%;border:0;border-radius:7px;background:#1d8198;color:#fff;padding:7px;font-size:8px;font-weight:950;cursor:pointer;margin-top:3px}`;
    document.head.appendChild(style);
    document.documentElement.dataset.designEmbedded='1';
  }

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function parentMode(detail){
    const payload={type:'program-studio-design-mode',...detail};
    if(window.parent!==window){window.parent.postMessage(payload,location.origin);return;}
    location.href='/design-editor/';
  }

  function optionMarkup(mode){
    const preset=String(params.get('preset')||'');
    const orientation=params.get('orientation')==='landscape'?'landscape':'portrait';
    if(mode==='cover')return '<div class="design-mode-note">표지 규격·책등·앞뒤표지 설정은 아래 기존 옵션을 그대로 사용합니다.</div>';
    if(mode==='poster')return `<div class="design-mode-field"><label>규격</label><select id="designModeSize"><option value="poster-a4"${preset!=='poster-a3'?' selected':''}>A4 · 210×297</option><option value="poster-a3"${preset==='poster-a3'?' selected':''}>A3 · 297×420</option></select></div><div class="design-mode-field"><label>방향</label><select id="designModeOrientation"><option value="portrait"${orientation==='portrait'?' selected':''}>세로</option><option value="landscape"${orientation==='landscape'?' selected':''}>가로</option></select></div><button class="design-mode-apply" type="button">규격 적용</button>`;
    if(mode==='flyer')return `<div class="design-mode-field"><label>규격</label><select id="designModeSize"><option value="flyer-a4"${preset!=='flyer-a5'?' selected':''}>A4 · 210×297</option><option value="flyer-a5"${preset==='flyer-a5'?' selected':''}>A5 · 148×210</option></select></div><div class="design-mode-field"><label>방향</label><select id="designModeOrientation"><option value="portrait"${orientation==='portrait'?' selected':''}>세로</option><option value="landscape"${orientation==='landscape'?' selected':''}>가로</option></select></div><button class="design-mode-apply" type="button">규격 적용</button>`;
    if(mode==='leaflet2')return '<div class="design-mode-note">A4 가로 2단 반접지 · 바깥면과 안쪽면을 각각 편집합니다.</div>';
    if(mode==='leaflet3')return `<div class="design-mode-field"><label>접지 방식</label><select id="designModeFold"><option value="leaflet-3-roll"${preset!=='leaflet-3-z'?' selected':''}>말아접기</option><option value="leaflet-3-z"${preset==='leaflet-3-z'?' selected':''}>Z접지</option></select></div><button class="design-mode-apply" type="button">접지 방식 적용</button>`;
    return `<div class="design-mode-two"><div class="design-mode-field"><label>가로 mm</label><input id="designModeWidth" type="number" min="80" max="1000" value="${clamp(Number(params.get('w'))||210,80,1000)}"></div><div class="design-mode-field"><label>세로 mm</label><input id="designModeHeight" type="number" min="80" max="1000" value="${clamp(Number(params.get('h'))||297,80,1000)}"></div></div><button class="design-mode-apply" type="button">크기 적용</button>`;
  }

  function defaultDetail(mode){
    if(mode==='cover')return{mode:'cover'};
    if(mode==='poster')return{mode:'poster',preset:'poster-a4',orientation:'portrait'};
    if(mode==='flyer')return{mode:'flyer',preset:'flyer-a4',orientation:'portrait'};
    if(mode==='leaflet2')return{mode:'leaflet2',preset:'leaflet-2'};
    if(mode==='leaflet3')return{mode:'leaflet3',preset:'leaflet-3-roll'};
    return{mode:'custom',preset:'custom',w:210,h:297};
  }

  function applyCurrentMode(mode,card){
    if(mode==='poster'||mode==='flyer')return parentMode({mode,preset:card.querySelector('#designModeSize')?.value,orientation:card.querySelector('#designModeOrientation')?.value||'portrait'});
    if(mode==='leaflet3')return parentMode({mode,preset:card.querySelector('#designModeFold')?.value||'leaflet-3-roll'});
    if(mode==='custom')return parentMode({mode,preset:'custom',w:clamp(Number(card.querySelector('#designModeWidth')?.value)||210,80,1000),h:clamp(Number(card.querySelector('#designModeHeight')?.value)||297,80,1000)});
  }

  function installModeCard(){
    if(document.getElementById('designEmbeddedModeCard'))return true;
    const sidebar=isCover?document.querySelector('.settings'):document.querySelector('.sidebar');
    if(!sidebar)return false;
    const current=modeFromRequest(),card=document.createElement('section');
    card.id='designEmbeddedModeCard';card.className='design-mode-card';
    card.innerHTML=`<div class="design-mode-head"><a class="design-mode-home" href="../index.html" target="_top" title="홈">←</a><div><div class="design-mode-title">디자인 편집기</div><div class="design-mode-sub">작업 종류를 바꾸면 필요한 옵션만 전환됩니다.</div></div></div><div class="design-mode-grid">${Object.entries(MODES).map(([key,item])=>`<button type="button" class="design-mode-btn${key===current?' on':''}" data-design-mode="${key}">${item.short}</button>`).join('')}</div><div class="design-mode-options">${optionMarkup(current)}</div>`;
    sidebar.insertBefore(card,sidebar.firstChild);
    card.querySelectorAll('[data-design-mode]').forEach(button=>button.addEventListener('click',()=>{
      const next=button.dataset.designMode;if(next===current)return;parentMode(defaultDetail(next));
    }));
    card.querySelector('.design-mode-apply')?.addEventListener('click',()=>applyCurrentMode(current,card));
    return true;
  }

  function applyRequestedGeometry(){
    const app=window.DesignEditorApp;
    const project=app?.project;
    if(!project)return;
    const orientation=params.get('orientation');
    if(orientation==='landscape'&&project.width<project.height){
      const width=project.height;project.height=project.width;project.width=width;
    }else if(orientation==='portrait'&&project.width>project.height){
      const width=project.height;project.height=project.width;project.width=width;
    }

    const requestedW=Number(params.get('w'));
    const requestedH=Number(params.get('h'));
    if(Number.isFinite(requestedW))project.width=clamp(requestedW,80,1000);
    if(Number.isFinite(requestedH))project.height=clamp(requestedH,80,1000);

    const id=String(project.presetId||params.get('preset')||'');
    if(id==='leaflet-2'){
      project.surfaces?.forEach(surface=>{surface.folds=[project.width/2];});
    }else if(id==='leaflet-3-z'){
      project.surfaces?.forEach(surface=>{surface.folds=[project.width/3,project.width*2/3];});
    }else if(id==='leaflet-3-roll'){
      const third=project.width/3;
      project.surfaces?.forEach(surface=>{
        surface.folds=surface.id==='inside'?[third+1,third*2+1]:[Math.max(1,third-1),Math.max(2,third*2-1)];
      });
    }

    const meta=document.getElementById('documentMeta');
    if(meta)meta.textContent=`${Math.round(project.width*10)/10} × ${Math.round(project.height*10)/10}mm · 재단 ${project.bleed}mm`;
    window.dispatchEvent(new Event('resize'));
    queueMicrotask(()=>document.getElementById('artboard')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  }

  function startRequestedGeneralMode(){
    if(!isGeneral)return true;
    const app=window.DesignEditorApp;
    if(!app||typeof app.startProject!=='function')return false;
    if(app.project)return true;
    const preset=params.get('preset');
    if(!preset)return true;
    if(preset==='custom'){
      app.startProject('custom',{width:clamp(Number(params.get('w'))||210,80,1000),height:clamp(Number(params.get('h'))||297,80,1000)});
    }else{
      app.startProject(preset);
    }
    applyRequestedGeometry();
    return true;
  }

  function boot(){
    installEmbedStyles();installModeCard();
    if(startRequestedGeneralMode())return;
    [120,260,520,900,1500,2400].forEach(delay=>setTimeout(()=>{installEmbedStyles();installModeCard();startRequestedGeneralMode();},delay));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  window.DesignEditorEmbeddedRuntime={
    applyRequestedGeometry,
    installModeCard,
    stage:'unified-design-mode-engine-bridge'
  };
})();
