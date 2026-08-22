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

  // Existing phase modules are intentionally scoped to the historical editor path.
  // Keep one general editor document alive and only change its document configuration.
  if(isGeneral){
    try{history.replaceState(history.state,'','/design-editor/index.html'+location.search+location.hash);}catch(_){}
  }

  const MODES={
    cover:{label:'표지디자인',short:'표지'},poster:{label:'포스터',short:'포스터'},flyer:{label:'전단지',short:'전단'},
    leaflet2:{label:'2단 리플렛',short:'2단'},leaflet3:{label:'3단 리플렛',short:'3단'},custom:{label:'사용자 지정',short:'직접'}
  };
  const PAPERS={
    a6:{label:'A6',width:105,height:148},
    a5:{label:'A5',width:148,height:210},
    a4:{label:'A4',width:210,height:297},
    a3:{label:'A3',width:297,height:420},
    b5:{label:'B5',width:182,height:257},
    b4:{label:'B4',width:257,height:364},
    b3:{label:'B3',width:364,height:515}
  };
  const modeConfigs={};
  let activeConfig=null;
  let switching=false;

  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  const roundMm=value=>Math.round((Number(value)||0)*10)/10;
  const dimensions=(paper,orientation='portrait')=>{
    const item=PAPERS[paper]||PAPERS.a4;
    return orientation==='landscape'?{width:item.height,height:item.width}:{width:item.width,height:item.height};
  };
  function inferPaper(width,height){
    const w=roundMm(width),h=roundMm(height);
    for(const [key,paper] of Object.entries(PAPERS)){
      if((w===paper.width&&h===paper.height)||(w===paper.height&&h===paper.width))return key;
    }
    return 'custom';
  }
  const inferredOrientation=(width,height,fallback='portrait')=>{
    const w=Number(width)||0,h=Number(height)||0;
    if(w===h)return fallback;
    return w>h?'landscape':'portrait';
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

  function defaultConfig(mode){
    if(mode==='cover')return{mode:'cover'};
    if(mode==='poster')return{mode:'poster',paper:'a4',orientation:'portrait',width:210,height:297,preset:'poster-a4'};
    if(mode==='flyer')return{mode:'flyer',paper:'a4',orientation:'portrait',width:210,height:297,preset:'flyer-a4'};
    if(mode==='leaflet2')return{mode:'leaflet2',paper:'a4',orientation:'landscape',width:297,height:210,preset:'leaflet-2'};
    if(mode==='leaflet3')return{mode:'leaflet3',paper:'a4',orientation:'landscape',width:297,height:210,preset:'leaflet-3-roll',fold:'leaflet-3-roll'};
    return{mode:'custom',paper:'custom',orientation:'portrait',width:210,height:297,preset:'custom'};
  }

  function configFromRequest(){
    const mode=modeFromRequest(),base=defaultConfig(mode);
    if(mode==='cover')return base;
    const preset=String(params.get('preset')||base.preset||'');
    let paper=String(params.get('paper')||'');
    let orientation=params.get('orientation')==='landscape'?'landscape':base.orientation;
    let width=Number(params.get('w')),height=Number(params.get('h'));
    if(!Number.isFinite(width)||!Number.isFinite(height)){
      if(preset==='poster-a3'){paper='a3';width=297;height=420;orientation='portrait';}
      else if(preset==='flyer-a5'){paper='a5';width=148;height=210;orientation='portrait';}
      else{width=base.width;height=base.height;}
      if(orientation==='landscape'&&width<height)[width,height]=[height,width];
      if(orientation==='portrait'&&width>height&&mode!=='leaflet2'&&mode!=='leaflet3')[width,height]=[height,width];
    }
    width=clamp(width,80,1000);height=clamp(height,80,1000);
    orientation=inferredOrientation(width,height,orientation);
    if(!paper)paper=inferPaper(width,height);
    const fold=mode==='leaflet3'?(params.get('fold')==='leaflet-3-z'||preset==='leaflet-3-z'?'leaflet-3-z':'leaflet-3-roll'):'';
    return{...base,mode,preset,width:roundMm(width),height:roundMm(height),orientation,paper,fold};
  }

  activeConfig=configFromRequest();
  if(activeConfig.mode!=='cover')modeConfigs[activeConfig.mode]={...activeConfig};

  function installEmbedStyles(){
    if(document.getElementById('designEmbeddedRuntimeStyles'))return;
    const style=document.createElement('style');
    style.id='designEmbeddedRuntimeStyles';
    style.textContent=(isCover
      ? 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.workspace{height:100vh!important}.preview-panel{padding-top:7px!important}'
      : 'html,body{height:100%!important}body{padding-top:0!important}.top-nav{display:none!important}.start-screen,.editor-shell{height:100vh!important}')+`
      .design-mode-card{flex:0 0 auto;border:1px solid #dbe5ee;border-radius:12px;background:linear-gradient(180deg,#fafdff,#f6f9fc);padding:10px!important;margin:0!important;box-shadow:none!important}.design-mode-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.design-mode-home{width:26px;height:26px;border:1px solid #d7e0e9;border-radius:7px;background:#fff;color:#475569;text-decoration:none;display:grid;place-items:center;font-size:11px;font-weight:950}.design-mode-title{font-size:11px;font-weight:950;color:#12396d}.design-mode-sub{font-size:7px;color:#7c8797;margin-top:2px}.design-mode-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}.design-mode-btn{border:1px solid #d7e0e9;border-radius:7px;background:#fff;color:#667085;padding:6px 2px;font-size:7.5px;font-weight:900;cursor:pointer;white-space:nowrap}.design-mode-btn.on{background:#12396d;border-color:#12396d;color:#fff}.design-mode-options{margin-top:8px;padding-top:8px;border-top:1px solid #e3e9ef}.design-mode-note{font-size:7px;line-height:1.45;color:#7c8797;margin:0 0 6px}.design-mode-field{margin-bottom:5px}.design-mode-field label{display:block;font-size:7px;font-weight:900;color:#667085;margin-bottom:3px}.design-mode-field select,.design-mode-field input{width:100%;border:1px solid #cfd9e3;border-radius:7px;background:#fff;padding:6px 7px;font-size:8px;color:#344054}.design-mode-two{display:grid;grid-template-columns:1fr 1fr;gap:5px}.design-mode-apply{width:100%;border:0;border-radius:7px;background:#1d8198;color:#fff;padding:7px;font-size:8px;font-weight:950;cursor:pointer;margin-top:3px}.design-mode-size-note{margin-top:4px;font-size:6.5px;line-height:1.4;color:#8a94a4}`;
    document.head.appendChild(style);
    document.documentElement.dataset.designEmbedded='1';
  }

  function parentMode(detail){
    const payload={type:'program-studio-design-mode',...detail};
    if(window.parent!==window){window.parent.postMessage(payload,location.origin);return;}
    location.href='/design-editor/';
  }

  function paperOptions(selected){
    return `${Object.entries(PAPERS).map(([key,item])=>`<option value="${key}"${selected===key?' selected':''}>${item.label} · ${item.width}×${item.height}</option>`).join('')}<option value="custom"${selected==='custom'?' selected':''}>직접 입력</option>`;
  }

  function sizeOptionsMarkup(config,includeFold=false){
    const width=roundMm(config.width),height=roundMm(config.height),paper=config.paper||inferPaper(width,height),orientation=config.orientation||inferredOrientation(width,height);
    return `<div class="design-mode-two"><div class="design-mode-field"><label>기본 규격</label><select id="designModePaper">${paperOptions(paper)}</select></div><div class="design-mode-field"><label>방향</label><select id="designModeOrientation"><option value="portrait"${orientation==='portrait'?' selected':''}>세로</option><option value="landscape"${orientation==='landscape'?' selected':''}>가로</option></select></div></div><div class="design-mode-two"><div class="design-mode-field"><label>가로 mm</label><input id="designModeWidth" type="number" min="80" max="1000" step="0.1" value="${width}"></div><div class="design-mode-field"><label>세로 mm</label><input id="designModeHeight" type="number" min="80" max="1000" step="0.1" value="${height}"></div></div>${includeFold?`<div class="design-mode-field"><label>접지 방식</label><select id="designModeFold"><option value="leaflet-3-roll"${config.fold!=='leaflet-3-z'?' selected':''}>말아접기 · 접히는 면 자동 보정</option><option value="leaflet-3-z"${config.fold==='leaflet-3-z'?' selected':''}>Z접지 · 3등분</option></select></div>`:''}<button class="design-mode-apply" type="button">현재 옵션 적용</button><div class="design-mode-size-note">규격을 바꿔도 다른 페이지를 불러오지 않고 현재 디자인 편집기 안에서 작업영역만 전환합니다.</div>`;
  }

  function optionMarkup(mode){
    const config=activeConfig?.mode===mode?activeConfig:(modeConfigs[mode]||defaultConfig(mode));
    if(mode==='cover')return '<div class="design-mode-note">표지 규격·책등·앞뒤표지 설정은 아래 기존 옵션을 그대로 사용합니다.</div>';
    if(mode==='leaflet2')return `<p class="design-mode-note">2단 접지선은 선택한 가로 크기의 정확한 1/2 위치에 자동 생성됩니다.</p>${sizeOptionsMarkup(config,false)}`;
    if(mode==='leaflet3')return `<p class="design-mode-note">용지 크기와 접지 방식을 선택하면 각 면 폭과 접지선이 자동 계산됩니다.</p>${sizeOptionsMarkup(config,true)}`;
    if(mode==='poster'||mode==='flyer')return sizeOptionsMarkup(config,false);
    return sizeOptionsMarkup(config,false);
  }

  function canonicalPreset(config){
    if(config.mode==='poster')return config.paper==='a3'&&config.width===297&&config.height===420?'poster-a3':'poster-a4';
    if(config.mode==='flyer')return config.paper==='a5'&&config.width===148&&config.height===210?'flyer-a5':'flyer-a4';
    if(config.mode==='leaflet2')return'leaflet-2';
    if(config.mode==='leaflet3')return config.fold==='leaflet-3-z'?'leaflet-3-z':'leaflet-3-roll';
    return'custom';
  }

  function panelWidths(config){
    const width=Number(config.width)||297;
    if(config.mode==='leaflet2')return[width/2,width/2];
    const third=width/3;
    if(config.mode!=='leaflet3'||config.fold==='leaflet-3-z')return[third,third,third];
    const inset=clamp(width/297,0.8,2);
    return[third-inset,third,third+inset];
  }

  function setLeafletGeometry(project,config){
    if(config.mode==='leaflet2'){
      const half=project.width/2;
      project.surfaces?.forEach(surface=>{
        surface.folds=[half];
        surface.panels=surface.id==='outside'?['뒷표지','앞표지']:['내용 왼쪽','내용 오른쪽'];
      });
      return;
    }
    if(config.mode!=='leaflet3')return;
    const third=project.width/3;
    if(config.fold==='leaflet-3-z'){
      project.surfaces?.forEach(surface=>{
        surface.folds=[third,third*2];
        surface.panels=surface.id==='outside'?['뒷면','가운데 면','앞표지']:['내용 1','내용 2','내용 3'];
      });
      return;
    }
    const inset=clamp(project.width/297,0.8,2);
    const small=roundMm(third-inset),middle=roundMm(third),large=roundMm(third+inset);
    project.surfaces?.forEach(surface=>{
      if(surface.id==='inside'){
        surface.folds=[third+inset,third*2+inset];
        surface.panels=[`내용 ${large}mm`,`내용 ${middle}mm`,`접히는 면 ${small}mm`];
      }else{
        surface.folds=[third-inset,third*2-inset];
        surface.panels=[`접히는 면 ${small}mm`,`뒷면 ${middle}mm`,`앞표지 ${large}mm`];
      }
    });
  }

  function modeName(config){
    const label=MODES[config.mode]?.label||'디자인';
    if(config.mode==='leaflet3')return`${label} · ${config.fold==='leaflet-3-z'?'Z접지':'말아접기'} · ${roundMm(config.width)}×${roundMm(config.height)}mm`;
    return`${label} · ${roundMm(config.width)}×${roundMm(config.height)}mm`;
  }

  function applyConfigToProject(config){
    const project=window.DesignEditorApp?.project;
    if(!project||config.mode==='cover')return false;
    project.width=clamp(Number(config.width)||210,80,1000);
    project.height=clamp(Number(config.height)||297,80,1000);
    project.designMode=config.mode;
    project.paper=config.paper||inferPaper(project.width,project.height);
    project.orientation=config.orientation||inferredOrientation(project.width,project.height);
    project.foldType=config.fold||'';
    project.name=modeName(config);
    setLeafletGeometry(project,config);
    const meta=document.getElementById('documentMeta');
    const title=document.getElementById('documentTitle');
    if(meta)meta.textContent=`${roundMm(project.width)} × ${roundMm(project.height)}mm · 재단 ${project.bleed}mm`;
    if(title)title.textContent=project.name;
    window.dispatchEvent(new Event('resize'));
    queueMicrotask(()=>{
      window.DesignEditorPhase2?.sync?.();
      document.getElementById('artboard')?.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
    });
    return true;
  }

  function applyRequestedGeometry(){
    const config=activeConfig||configFromRequest();
    return applyConfigToProject(config);
  }

  function updateHistory(config){
    if(!isGeneral||config.mode==='cover')return;
    const query=new URLSearchParams({embed:'1',mode:config.mode,preset:canonicalPreset(config),paper:config.paper||'custom',orientation:config.orientation||'portrait',w:String(roundMm(config.width)),h:String(roundMm(config.height))});
    if(config.mode==='leaflet3')query.set('fold',config.fold||'leaflet-3-roll');
    try{history.replaceState(history.state,'',`/design-editor/index.html?${query.toString()}`);}catch(_){}
  }

  function setStatus(message,type='ok'){
    const node=document.getElementById('editorStatus');
    if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function normalizeConfig(detail){
    const mode=MODES[detail?.mode]?detail.mode:(activeConfig?.mode||'poster');
    const base={...(modeConfigs[mode]||defaultConfig(mode)),...detail,mode};
    if(mode==='cover')return base;
    base.width=roundMm(clamp(Number(base.width)||210,80,1000));
    base.height=roundMm(clamp(Number(base.height)||297,80,1000));
    base.orientation=inferredOrientation(base.width,base.height,base.orientation||'portrait');
    base.paper=base.paper||inferPaper(base.width,base.height);
    if(mode==='leaflet3')base.fold=base.fold==='leaflet-3-z'?'leaflet-3-z':'leaflet-3-roll';
    base.preset=canonicalPreset(base);
    return base;
  }

  function refreshModeCard(){
    const card=document.getElementById('designEmbeddedModeCard');
    if(!card)return;
    card.querySelectorAll('[data-design-mode]').forEach(button=>button.classList.toggle('on',button.dataset.designMode===activeConfig.mode));
    const options=card.querySelector('.design-mode-options');
    if(options){options.innerHTML=optionMarkup(activeConfig.mode);bindOptionEvents(card);}
  }

  function switchGeneralMode(detail,source='option-change'){
    const config=normalizeConfig(detail);
    if(config.mode==='cover')return parentMode({mode:'cover'});
    if(!isGeneral)return parentMode(config);
    if(switching)return false;
    const app=window.DesignEditorApp;
    if(!app||typeof app.startProject!=='function')return false;
    switching=true;
    try{
      window.DesignEditorModeSwitchSafety?.saveNow?.(`unified-${source}`);
      window.DesignEditorDraftScope?.saveCurrent?.(`unified-${source}`);
      activeConfig=config;modeConfigs[config.mode]={...config};
      const preset=canonicalPreset(config);
      if(config.mode==='custom')app.startProject('custom',{width:config.width,height:config.height});
      else app.startProject(preset);
      applyConfigToProject(config);
      updateHistory(config);
      refreshModeCard();
      const restored=window.DesignEditorDraftScope?.restoreCurrentScope?.();
      if(!restored)window.DesignEditorDraftScope?.saveCurrent?.('unified-new-scope');
      setTimeout(()=>{
        applyConfigToProject(activeConfig);
        window.DesignEditorPhase2?.sync?.();
        setStatus(`${MODES[config.mode].label} ${roundMm(config.width)}×${roundMm(config.height)}mm 작업으로 전환했습니다.`,'ok');
      },60);
      return true;
    }finally{switching=false;}
  }

  function syncPaperFields(card){
    const paper=card.querySelector('#designModePaper'),orientation=card.querySelector('#designModeOrientation'),width=card.querySelector('#designModeWidth'),height=card.querySelector('#designModeHeight');
    if(!paper||!orientation||!width||!height)return;
    if(paper.value==='custom')return;
    const next=dimensions(paper.value,orientation.value);
    width.value=String(next.width);height.value=String(next.height);
  }

  function bindOptionEvents(card){
    const paper=card.querySelector('#designModePaper'),orientation=card.querySelector('#designModeOrientation'),width=card.querySelector('#designModeWidth'),height=card.querySelector('#designModeHeight');
    paper?.addEventListener('change',()=>syncPaperFields(card));
    orientation?.addEventListener('change',()=>{
      if(paper?.value&&paper.value!=='custom')return syncPaperFields(card);
      if(!width||!height)return;
      let w=Number(width.value)||210,h=Number(height.value)||297;
      if(orientation.value==='landscape'&&w<h)[w,h]=[h,w];
      if(orientation.value==='portrait'&&w>h)[w,h]=[h,w];
      width.value=String(roundMm(w));height.value=String(roundMm(h));
    });
    [width,height].forEach(input=>input?.addEventListener('input',()=>{if(paper)paper.value='custom';}));
    card.querySelector('.design-mode-apply')?.addEventListener('click',()=>applyCurrentMode(activeConfig.mode,card));
  }

  function readOptions(mode,card){
    const width=clamp(Number(card.querySelector('#designModeWidth')?.value)||210,80,1000);
    const height=clamp(Number(card.querySelector('#designModeHeight')?.value)||297,80,1000);
    return normalizeConfig({
      ...(modeConfigs[mode]||defaultConfig(mode)),mode,
      paper:card.querySelector('#designModePaper')?.value||inferPaper(width,height),
      orientation:card.querySelector('#designModeOrientation')?.value||inferredOrientation(width,height),
      width,height,
      fold:card.querySelector('#designModeFold')?.value||activeConfig?.fold||'leaflet-3-roll'
    });
  }

  function applyCurrentMode(mode,card){
    if(mode==='cover')return;
    switchGeneralMode(readOptions(mode,card),'options-apply');
  }

  function installModeCard(){
    if(document.getElementById('designEmbeddedModeCard'))return true;
    const sidebar=isCover?document.querySelector('.settings'):document.querySelector('.sidebar');
    if(!sidebar)return false;
    const card=document.createElement('section');
    card.id='designEmbeddedModeCard';card.className='design-mode-card';
    card.innerHTML=`<div class="design-mode-head"><a class="design-mode-home" href="../index.html" target="_top" title="홈">←</a><div><div class="design-mode-title">디자인 편집기</div><div class="design-mode-sub">작업 종류와 규격을 바꾸면 같은 편집기에서 작업영역만 변경됩니다.</div></div></div><div class="design-mode-grid">${Object.entries(MODES).map(([key,item])=>`<button type="button" class="design-mode-btn${key===activeConfig.mode?' on':''}" data-design-mode="${key}">${item.short}</button>`).join('')}</div><div class="design-mode-options">${optionMarkup(activeConfig.mode)}</div>`;
    sidebar.insertBefore(card,sidebar.firstChild);
    card.querySelectorAll('[data-design-mode]').forEach(button=>button.addEventListener('click',()=>{
      const next=button.dataset.designMode;
      if(next===activeConfig.mode)return;
      if(next==='cover')return parentMode({mode:'cover'});
      const nextConfig=modeConfigs[next]||defaultConfig(next);
      if(isGeneral)return switchGeneralMode(nextConfig,'mode-button');
      parentMode(nextConfig);
    }));
    bindOptionEvents(card);
    return true;
  }

  function startRequestedGeneralMode(){
    if(!isGeneral)return true;
    const app=window.DesignEditorApp;
    if(!app||typeof app.startProject!=='function')return false;
    if(app.project){applyConfigToProject(activeConfig);return true;}
    const preset=canonicalPreset(activeConfig);
    if(activeConfig.mode==='custom')app.startProject('custom',{width:activeConfig.width,height:activeConfig.height});
    else app.startProject(preset);
    applyConfigToProject(activeConfig);
    updateHistory(activeConfig);
    setTimeout(()=>window.DesignEditorDraftScope?.restoreCurrentScope?.(),20);
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
    switchGeneralMode,
    panelWidths,
    get config(){return activeConfig?{...activeConfig}:null;},
    stage:'single-general-editor-dynamic-document-options'
  };
})();
