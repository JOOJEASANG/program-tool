// Print-product oriented menu: cover / poster / flyer / invitation / leaflet.
(function(){
  'use strict';
  if(window.__designEditorPrintProductMenuV1)return;
  window.__designEditorPrintProductMenuV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const STYLE_ID='designPrintProductMenuStyles';
  const PRODUCT_KEY='printProductMode';
  const PAGE_KEY='printProductPages';
  const FOLD_KEY='printProductFold';
  const AXIS_KEY='printProductAxis';
  const POSITION_KEY='printProductFoldPosition';
  const FLIP_KEY='printFoldFlipPanel';
  const PAPERS={
    a6:{label:'A6',width:105,height:148},a5:{label:'A5',width:148,height:210},a4:{label:'A4',width:210,height:297},
    a3:{label:'A3',width:297,height:420},b5:{label:'B5',width:182,height:257},b4:{label:'B4',width:257,height:364},b3:{label:'B3',width:364,height:515}
  };
  const PRODUCTS=[
    ['cover','표지'],['poster','포스터'],['flyer','전단'],['invitation','초대장·안내장'],['leaflet','리플렛']
  ];
  let timer=0;
  let observer=null;
  let applying=false;
  const state={
    invitation:{paper:'a4',orientation:'landscape',width:297,height:210,axis:'x',position:148.5,flip:'none'},
    leaflet:{paper:'a4',orientation:'landscape',width:297,height:210,pages:6,fold:'roll'}
  };

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const inferredOrientation=(w,h)=>Number(w)>Number(h)?'landscape':'portrait';
  const dims=(paper,orientation)=>{
    const p=PAPERS[paper]||PAPERS.a4;
    return orientation==='landscape'?{width:p.height,height:p.width}:{width:p.width,height:p.height};
  };
  function inferPaper(w,h){
    const width=round1(w),height=round1(h);
    for(const [key,p] of Object.entries(PAPERS)){
      if((width===p.width&&height===p.height)||(width===p.height&&height===p.width))return key;
    }
    return'custom';
  }
  function paperOptions(selected){
    return `${Object.entries(PAPERS).map(([key,p])=>`<option value="${key}"${selected===key?' selected':''}>${p.label} · ${p.width}×${p.height}</option>`).join('')}<option value="custom"${selected==='custom'?' selected':''}>직접 입력</option>`;
  }
  function setSurfaceGeometry(surface,axis,folds,panels){
    surface.foldAxis=axis;
    surface.panels=[...panels];
    if(axis==='y'){
      surface.folds=[];
      surface.foldsY=folds.map(round1);
    }else{
      surface.folds=folds.map(round1);
      delete surface.foldsY;
    }
  }
  function cumulative(widths){
    let sum=0;return widths.slice(0,-1).map(width=>round1(sum+=width));
  }
  function equalWidths(length,count){return Array.from({length:count},()=>length/count);}
  function rollWidths(length,count){
    const base=length/count,mid=(count-1)/2,step=1;
    const widths=Array.from({length:count},(_,index)=>base+(index-mid)*step);
    const total=widths.reduce((sum,value)=>sum+value,0);
    widths[widths.length-1]+=length-total;
    return widths;
  }
  function gateWidths(length){
    const q=length/4;
    return[q-1,q+1,q+1,q-1];
  }
  function genericPanelNames(surface,count,fold){
    const outside=surface.id==='outside';
    if(count===2)return outside?['뒷표지','앞표지']:['내용 1','내용 2'];
    if(count===3&&fold==='roll')return outside?['접히는 면','뒷면','앞표지']:['내용 1','내용 2','접히는 면'];
    if(count===3)return outside?['뒷면','가운데 면','앞표지']:['내용 1','내용 2','내용 3'];
    if(count===4&&fold==='gate')return outside?['왼쪽 접힘','뒷면','앞표지','오른쪽 접힘']:['내용 1','내용 2','내용 3','내용 4'];
    return Array.from({length:count},(_,index)=>outside?`바깥면 ${index+1}`:`안쪽면 ${index+1}`);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-mode-grid{grid-template-columns:repeat(5,minmax(0,1fr))!important}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-mode-btn{font-size:9px!important;padding:7px 2px!important;min-height:31px!important}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-note{font-size:9px;line-height:1.5;color:#64748b;margin:0 0 8px}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-two{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-field{margin-bottom:7px}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-field label{display:block;font-size:9px;font-weight:900;color:#667085;margin-bottom:4px}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-field select,
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-field input{width:100%;border:1px solid #cfd9e3;border-radius:8px;background:#fff;padding:7px 8px;font-size:10px;color:#344054}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-hint{font-size:8.5px;line-height:1.5;color:#8a94a4;margin:4px 0 8px}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-apply{width:100%;border:0;border-radius:8px;background:#1d8198;color:#fff;padding:8px;font-size:10px;font-weight:950;cursor:pointer}
      #designEmbeddedModeCard[data-print-product-menu="1"] .design-product-center{border:1px dashed #f59e0b;border-radius:8px;background:#fffbeb;color:#a16207;padding:7px;font-size:9px;font-weight:900;cursor:pointer;width:100%}
      #designPrintFoldDirectionField{display:none!important}
    `;document.head.appendChild(style);
  }

  function productOf(p=project()){
    if(p?.[PRODUCT_KEY]==='invitation'||p?.[PRODUCT_KEY]==='leaflet')return p[PRODUCT_KEY];
    if(p?.designMode==='invitation')return'invitation';
    if(p?.designMode==='leaflet2'||p?.designMode==='leaflet3')return'leaflet';
    if(p?.designMode==='poster')return'poster';
    if(p?.designMode==='flyer')return'flyer';
    if(params.get('mode')==='cover'||p?.designMode==='cover')return'cover';
    return'poster';
  }
  function foldOptions(pages,selected){
    const count=Number(pages)||6;
    let options;
    if(count===4)options=[['half','반접지']];
    else if(count===6)options=[['roll','말아접기 · 안쪽면 자동 보정'],['z','Z접지 · 균등 3단']];
    else if(count===8)options=[['accordion','병풍접지 · 균등 4단'],['roll','말아접기 · 단계 보정'],['gate','대문접지 · 좌우 접힘 보정']];
    else options=[['accordion','병풍접지 · 균등 단'],['roll','말아접기 · 단계 보정']];
    if(!options.some(([key])=>key===selected))selected=options[0][0];
    return options.map(([key,label])=>`<option value="${key}"${key===selected?' selected':''}>${label}</option>`).join('');
  }
  function commonSizeMarkup(data){
    const paper=data.paper||inferPaper(data.width,data.height),orientation=data.orientation||inferredOrientation(data.width,data.height);
    return `<div class="design-product-two"><div class="design-product-field"><label>용지 규격</label><select id="designModePaper">${paperOptions(paper)}</select></div><div class="design-product-field"><label>용지 방향</label><select id="designModeOrientation"><option value="portrait"${orientation==='portrait'?' selected':''}>세로</option><option value="landscape"${orientation==='landscape'?' selected':''}>가로</option></select></div></div><div class="design-product-two"><div class="design-product-field"><label>가로 mm</label><input id="designModeWidth" type="number" min="80" max="1000" step="0.1" value="${round1(data.width)}"></div><div class="design-product-field"><label>세로 mm</label><input id="designModeHeight" type="number" min="80" max="1000" step="0.1" value="${round1(data.height)}"></div></div>`;
  }
  function invitationMarkup(){
    const data=state.invitation;
    return `<p class="design-product-note">초대장·안내장은 리플렛과 별도의 작업 유형입니다. 접지 방향과 실제 mm 위치를 지정하면 미리보기 접지선과 각 단 여백이 같이 바뀝니다.</p>${commonSizeMarkup(data)}<div class="design-product-two"><div class="design-product-field"><label>접지 방향</label><select id="designProductAxis"><option value="x"${data.axis==='x'?' selected':''}>좌우 접기</option><option value="y"${data.axis==='y'?' selected':''}>상하 접기</option></select></div><div class="design-product-field"><label>접지 위치 mm</label><input id="designProductFoldPosition" type="number" min="15" max="985" step="0.1" value="${round1(data.position)}"></div></div><button id="designProductCenterFold" class="design-product-center" type="button">접지 위치 정중앙 50:50</button><div class="design-product-field" style="margin-top:7px"><label>상하 접기 내용 방향</label><select id="designProductFlip"><option value="none"${data.flip==='none'?' selected':''}>일반 방향</option><option value="top"${data.flip==='top'?' selected':''}>상단 내용 180°</option><option value="bottom"${data.flip==='bottom'?' selected':''}>하단 내용 180°</option></select></div><div class="design-product-hint">상하로 접는 카드·초대장은 접었을 때 한쪽이 거꾸로 보일 수 있어 180° 보정을 선택할 수 있습니다.</div><button class="design-product-apply" type="button">현재 옵션 적용</button>`;
  }
  function leafletMarkup(){
    const data=state.leaflet;
    return `<p class="design-product-note">페이지 수를 고르면 단 수가 자동 계산됩니다. 4P=2단, 6P=3단, 8P=4단, 10P=5단, 12P=6단이며 접지선과 단별 안전여백도 함께 계산됩니다.</p><div class="design-product-two"><div class="design-product-field"><label>페이지 수</label><select id="designProductPages">${[4,6,8,10,12].map(value=>`<option value="${value}"${Number(data.pages)===value?' selected':''}>${value}P · ${value/2}단</option>`).join('')}</select></div><div class="design-product-field"><label>접지 방식</label><select id="designProductFold">${foldOptions(data.pages,data.fold)}</select></div></div>${commonSizeMarkup(data)}<div class="design-product-hint">말아접기는 안으로 들어가는 면을 단계적으로 좁혀 기본 보정합니다. 실제 두꺼운 용지나 특수 접지는 인쇄소의 접지값을 우선 확인하는 것이 안전합니다.</div><button class="design-product-apply" type="button">현재 옵션 적용</button>`;
  }

  function syncCommonFields(card){
    const paper=card.querySelector('#designModePaper'),orientation=card.querySelector('#designModeOrientation'),width=card.querySelector('#designModeWidth'),height=card.querySelector('#designModeHeight');
    if(!paper||!orientation||!width||!height)return;
    if(paper.value==='custom')return;
    const next=dims(paper.value,orientation.value);
    width.value=String(next.width);height.value=String(next.height);
  }
  function readCommon(card,target){
    const paper=card.querySelector('#designModePaper')?.value||'custom';
    const orientation=card.querySelector('#designModeOrientation')?.value==='portrait'?'portrait':'landscape';
    let width=clamp(Number(card.querySelector('#designModeWidth')?.value)||target.width||210,80,1000);
    let height=clamp(Number(card.querySelector('#designModeHeight')?.value)||target.height||297,80,1000);
    if(paper!=='custom')({width,height}=dims(paper,orientation));
    else{
      if(orientation==='landscape'&&width<height)[width,height]=[height,width];
      if(orientation==='portrait'&&width>height)[width,height]=[height,width];
    }
    return{paper,orientation,width:round1(width),height:round1(height)};
  }
  function persist(source='print-product-menu'){
    const p=project();if(!p)return;
    try{localStorage.setItem('programTool.designEditor.draft.v1',JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const save=byId('saveState');if(save)save.textContent='자동 저장됨';
  }

  function syncDocumentIdentity(p){
    if(!p)return;
    const title=byId('documentTitle');
    const meta=byId('documentMeta');
    if(title&&p.name)title.textContent=p.name;
    if(meta)meta.textContent=`${round1(p.width)} × ${round1(p.height)}mm · 재단 ${round1(p.bleed)}mm`;
  }

  function applyInvitationGeometry(p=project(),options={}){
    if(!p)return false;
    const data=state.invitation;
    const axis=data.axis==='y'?'y':'x';
    const length=axis==='y'?Number(p.height)||0:Number(p.width)||0;
    const position=round1(clamp(Number(data.position)||length/2,15,Math.max(15,length-15)));
    data.position=position;
    p.designMode='invitation';
    p[PRODUCT_KEY]='invitation';p[PAGE_KEY]=4;p[FOLD_KEY]='custom';p[AXIS_KEY]=axis;p[POSITION_KEY]=position;p[FLIP_KEY]=data.flip||'none';
    p.leaflet2Layout=axis==='y'?'top-bottom':'left-right';
    p.foldType=axis==='y'?'invitation-top-bottom':'invitation-left-right';
    (p.surfaces||[]).forEach(surface=>{
      const outside=surface.id==='outside';
      const panels=axis==='y'?(outside?['상단 외부','하단 외부']:['내용 상단','내용 하단']):(outside?['왼쪽 외부','오른쪽 외부']:['내용 왼쪽','내용 오른쪽']);
      setSurfaceGeometry(surface,axis,[position],panels);
    });
    p.name=`초대장·안내장 · ${round1(p.width)}×${round1(p.height)}mm · 접지 ${position}mm`;
    syncDocumentIdentity(p);
    document.documentElement.dataset.printProductMenu='invitation';
    if(options.persist!==false)persist('invitation-fold');
    window.DesignEditorPrintFoldProduction?.applyFlipRotations?.({persist:options.persist!==false});
    window.DesignEditorPreviewGuides?.refresh?.();window.dispatchEvent(new Event('resize'));
    return true;
  }
  function applyLeafletGeometry(p=project(),options={}){
    if(!p)return false;
    const data=state.leaflet,pages=[4,6,8,10,12].includes(Number(data.pages))?Number(data.pages):6,count=pages/2;
    const axis=data.orientation==='portrait'?'y':'x';
    const length=axis==='y'?Number(p.height)||0:Number(p.width)||0;
    let fold=data.fold||'roll';
    if(count===2)fold='half';
    if(count===3&&!['roll','z'].includes(fold))fold='roll';
    if(count===4&&!['accordion','roll','gate'].includes(fold))fold='accordion';
    if(count>=5&&!['accordion','roll'].includes(fold))fold='accordion';
    data.fold=fold;
    let outsideWidths;
    if(fold==='roll')outsideWidths=rollWidths(length,count);
    else if(fold==='gate'&&count===4)outsideWidths=gateWidths(length);
    else outsideWidths=equalWidths(length,count);
    const insideWidths=fold==='roll'?[...outsideWidths].reverse():[...outsideWidths];
    p[PRODUCT_KEY]='leaflet';p[PAGE_KEY]=pages;p[FOLD_KEY]=fold;p[AXIS_KEY]=axis;delete p[POSITION_KEY];
    p.foldType=`leaflet-${pages}-${fold}`;
    (p.surfaces||[]).forEach(surface=>{
      const widths=surface.id==='inside'?insideWidths:outsideWidths;
      setSurfaceGeometry(surface,axis,cumulative(widths),genericPanelNames(surface,count,fold));
    });
    p.name=`리플렛 ${pages}P · ${count}단 · ${round1(p.width)}×${round1(p.height)}mm`;
    syncDocumentIdentity(p);
    if(options.persist!==false)persist('leaflet-pages-fold');
    window.DesignEditorPreviewGuides?.refresh?.();window.dispatchEvent(new Event('resize'));
    return true;
  }
  function applyGeometry(p=project(),options={}){
    if(!p)return false;
    if(p[PRODUCT_KEY]==='invitation'||p.designMode==='invitation')return applyInvitationGeometry(p,options);
    if(p[PRODUCT_KEY]==='leaflet')return applyLeafletGeometry(p,options);
    return false;
  }

  function switchBase(mode,config,after){
    const runtime=window.DesignEditorEmbeddedRuntime;
    if(!runtime?.switchGeneralMode)return false;
    runtime.switchGeneralMode({mode,...config},'print-product-menu');
    [80,180,360].forEach(delay=>setTimeout(()=>{after?.(project());render();window.DesignEditorPrintFoldRuntimeEnsure?.refresh?.();},delay));
    return true;
  }
  function applyInvitation(card){
    Object.assign(state.invitation,readCommon(card,state.invitation));
    state.invitation.axis=card.querySelector('#designProductAxis')?.value==='y'?'y':'x';
    state.invitation.position=Number(card.querySelector('#designProductFoldPosition')?.value)||((state.invitation.axis==='y'?state.invitation.height:state.invitation.width)/2);
    state.invitation.flip=card.querySelector('#designProductFlip')?.value||'none';
    return switchBase('invitation',state.invitation,p=>{if(!p)return;applyInvitationGeometry(p,{persist:true});});
  }
  function applyLeaflet(card){
    Object.assign(state.leaflet,readCommon(card,state.leaflet));
    state.leaflet.pages=Number(card.querySelector('#designProductPages')?.value)||6;
    state.leaflet.fold=card.querySelector('#designProductFold')?.value||'roll';
    const baseMode=state.leaflet.pages===4?'leaflet2':'leaflet3';
    const baseFold=state.leaflet.pages===6&&state.leaflet.fold==='z'?'leaflet-3-z':'leaflet-3-roll';
    return switchBase(baseMode,{...state.leaflet,fold:baseFold},p=>{if(!p)return;applyLeafletGeometry(p,{persist:true});});
  }

  function renderOptions(card,product){
    const options=card.querySelector('.design-mode-options');if(!options)return;
    if(product==='invitation')options.innerHTML=invitationMarkup();
    else if(product==='leaflet')options.innerHTML=leafletMarkup();
    else return;
    const paper=options.querySelector('#designModePaper'),orientation=options.querySelector('#designModeOrientation');
    paper?.addEventListener('change',()=>syncCommonFields(card));
    orientation?.addEventListener('change',()=>syncCommonFields(card));
    [options.querySelector('#designModeWidth'),options.querySelector('#designModeHeight')].forEach(input=>input?.addEventListener('input',()=>{if(paper)paper.value='custom';}));
    options.querySelector('#designProductPages')?.addEventListener('change',event=>{
      const pages=Number(event.target.value)||6;state.leaflet.pages=pages;
      const fold=options.querySelector('#designProductFold');if(fold)fold.innerHTML=foldOptions(pages,state.leaflet.fold);
    });
    options.querySelector('#designProductAxis')?.addEventListener('change',event=>{
      const axis=event.target.value==='y'?'y':'x';state.invitation.axis=axis;
      const length=axis==='y'?(Number(options.querySelector('#designModeHeight')?.value)||state.invitation.height):(Number(options.querySelector('#designModeWidth')?.value)||state.invitation.width);
      const position=options.querySelector('#designProductFoldPosition');if(position)position.value=String(round1(length/2));
    });
    options.querySelector('#designProductCenterFold')?.addEventListener('click',()=>{
      const axis=options.querySelector('#designProductAxis')?.value==='y'?'y':'x';
      const length=axis==='y'?(Number(options.querySelector('#designModeHeight')?.value)||state.invitation.height):(Number(options.querySelector('#designModeWidth')?.value)||state.invitation.width);
      const position=options.querySelector('#designProductFoldPosition');if(position)position.value=String(round1(length/2));
    });
    options.querySelector('.design-product-apply')?.addEventListener('click',()=>product==='invitation'?applyInvitation(card):applyLeaflet(card));
  }

  function activateProduct(product){
    if(product==='cover'){
      if(window.parent!==window)window.parent.postMessage({type:'program-studio-design-mode',mode:'cover'},location.origin);
      return;
    }
    if(product==='poster'||product==='flyer'){
      const runtime=window.DesignEditorEmbeddedRuntime;if(!runtime?.switchGeneralMode)return;
      runtime.switchGeneralMode({mode:product},'print-product-menu');queue(100);return;
    }
    if(product==='invitation'){
      const p=project();
      if(p){state.invitation.paper=p.paper||inferPaper(p.width,p.height);state.invitation.orientation=p.orientation||inferredOrientation(p.width,p.height);state.invitation.width=p.width||297;state.invitation.height=p.height||210;}
      switchBase('invitation',state.invitation,next=>{if(next)applyInvitationGeometry(next,{persist:true});});return;
    }
    if(product==='leaflet'){
      const p=project();
      if(p){state.leaflet.paper=p.paper||inferPaper(p.width,p.height);state.leaflet.orientation=p.orientation||inferredOrientation(p.width,p.height);state.leaflet.width=p.width||297;state.leaflet.height=p.height||210;}
      switchBase('leaflet3',{...state.leaflet,fold:'leaflet-3-roll'},next=>{if(next)applyLeafletGeometry(next,{persist:true});});
    }
  }

  function render(){
    clearTimeout(timer);
    const card=byId('designEmbeddedModeCard');if(!card||!window.DesignEditorEmbeddedRuntime)return false;
    installStyles();card.dataset.printProductMenu='1';
    const product=productOf();
    const grid=card.querySelector('.design-mode-grid');
    if(grid&&grid.dataset.printProductGrid!=='1'){
      grid.dataset.printProductGrid='1';
      grid.innerHTML=PRODUCTS.map(([key,label])=>`<button type="button" class="design-mode-btn" data-print-product="${key}">${label}</button>`).join('');
      grid.querySelectorAll('[data-print-product]').forEach(button=>button.addEventListener('click',()=>activateProduct(button.dataset.printProduct)));
    }
    grid?.querySelectorAll('[data-print-product]').forEach(button=>button.classList.toggle('on',button.dataset.printProduct===product));
    const options=card.querySelector('.design-mode-options');
    if((product==='invitation'||product==='leaflet')&&options?.dataset.printProductOptions!==product){
      options.dataset.printProductOptions=product;renderOptions(card,product);
    }else if(product!=='invitation'&&product!=='leaflet'&&options?.dataset.printProductOptions){
      delete options.dataset.printProductOptions;
    }
    document.documentElement.dataset.printProductMenu=product;
    return true;
  }
  function queue(delay=40){clearTimeout(timer);timer=setTimeout(render,delay);}
  function connect(){
    if(!render()){queue(120);return;}
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(records=>{
        if(applying)return;
        if(records.some(record=>[...record.addedNodes].some(node=>node?.id==='designEmbeddedModeCard'||node?.classList?.contains?.('design-mode-options'))))queue(60);
      });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }
  }

  document.addEventListener('click',event=>{if(event.target?.closest?.('.surface-tab'))queue(30);},true);
  window.addEventListener('resize',()=>queue(80),{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
  [180,420,900,1600,2800].forEach(delay=>setTimeout(connect,delay));

  window.DesignEditorPrintProductMenu={render,applyGeometry,applyInvitationGeometry,applyLeafletGeometry,state,stage:'print-product-menu-invitation-and-4p-to-12p-leaflet'};
})();
