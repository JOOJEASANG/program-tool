// Print-production fold helpers for leaflet/invitation work.
(function(){
  'use strict';
  if(window.__designEditorPrintFoldProductionV1)return;
  window.__designEditorPrintFoldProductionV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const STYLE_ID='designPrintFoldProductionStyles';
  const OVERLAY_ID='designPrintFoldProductionOverlay';
  const FIELD_ID='designPrintFoldDirectionField';
  const SELECT_ID='designPrintFoldDirection';
  const ORIENTATION_KEY='printFoldOrientationV1';
  const FLIP_KEY='printFoldFlipPanel';
  const BASE_ROTATION_KEY='printFoldBaseRotation';
  const AUTO_ROTATED_KEY='printFoldAutoRotated';
  let observer=null;
  let resizeObserver=null;
  let timer=0;
  let frame=0;
  let mutating=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=p=>p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  const round1=value=>Math.round((Number(value)||0)*10)/10;
  const mm=value=>{const n=round1(value);return Number.isInteger(n)?String(n):n.toFixed(1);};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const normalizeAngle=value=>{const angle=Number(value)||0;return ((angle+180)%360+360)%360-180;};

  function isLeaflet2(p=project()){return Boolean(p&&(p.designMode==='leaflet2'||p.presetId==='leaflet-2'));}
  function isLeaflet3(p=project()){return Boolean(p&&(p.designMode==='leaflet3'||String(p.presetId||'').startsWith('leaflet-3-')));}
  function isLeaflet(p=project()){return isLeaflet2(p)||isLeaflet3(p);}
  function isProductManaged(p=project()){return Boolean(p&&(p.printProductMode==='invitation'||p.printProductMode==='leaflet'));}
  function productExpectedFoldCount(p){
    if(p?.printProductMode==='invitation')return 1;
    if(p?.printProductMode==='leaflet')return Math.max(1,(Number(p.printProductPages)||6)/2-1);
    return 0;
  }
  function orientationOf(p){
    const explicit=String(p?.orientation||'');
    if(explicit==='portrait'||explicit==='landscape')return explicit;
    return (Number(p?.width)||0)>(Number(p?.height)||0)?'landscape':'portrait';
  }
  function axisOf(surface){
    if(surface?.foldAxis==='y'||(surface?.foldsY||[]).length)return'y';
    return'x';
  }
  function numericList(value){return Array.isArray(value)?value.map(Number).filter(Number.isFinite):[];}

  function persist(source='print-fold-production'){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.(source);
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }

  function panelNames(surface,axis,count){
    const outside=surface?.id==='outside';
    if(count===2){
      if(axis==='y')return outside?['상단 외부','하단 외부']:['내용 상단','내용 하단'];
      return outside?['뒷표지','앞표지']:['내용 왼쪽','내용 오른쪽'];
    }
    if(axis==='y')return outside?['상단 면','가운데 면','하단 면']:['내용 상단','내용 가운데','내용 하단'];
    return outside?['뒷면','가운데 면','앞표지']:['내용 1','내용 2','내용 3'];
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

  function applyLeaflet2Geometry(p){
    const orientation=orientationOf(p);
    const orientationChanged=p[ORIENTATION_KEY]!==orientation;
    if(orientationChanged||!p.leaflet2Layout){
      p.leaflet2Layout=orientation==='portrait'?'top-bottom':'left-right';
    }
    p[ORIENTATION_KEY]=orientation;
    const axis=p.leaflet2Layout==='top-bottom'?'y':'x';
    const length=axis==='y'?(Number(p.height)||0):(Number(p.width)||0);
    const fold=round1(length/2);
    (p.surfaces||[]).forEach(surface=>setSurfaceGeometry(surface,axis,[fold],panelNames(surface,axis,2)));
    p.foldType=axis==='y'?'leaflet-2-top-bottom':'leaflet-2-left-right';
    return axis;
  }

  function applyLeaflet3Geometry(p){
    const orientation=orientationOf(p);
    p[ORIENTATION_KEY]=orientation;
    const axis=orientation==='portrait'?'y':'x';
    const length=axis==='y'?(Number(p.height)||0):(Number(p.width)||0);
    const third=length/3;
    const foldType=String(p.foldType||p.presetId||'');
    const isZ=foldType.includes('leaflet-3-z');
    if(isZ){
      (p.surfaces||[]).forEach(surface=>setSurfaceGeometry(surface,axis,[third,third*2],panelNames(surface,axis,3)));
      return axis;
    }
    const ratio=axis==='y'?length/297:length/297;
    const inset=clamp(ratio,0.8,2);
    const small=round1(third-inset),middle=round1(third),large=round1(third+inset);
    (p.surfaces||[]).forEach(surface=>{
      const inside=surface.id==='inside';
      const folds=inside?[third+inset,third*2+inset]:[third-inset,third*2-inset];
      let panels;
      if(axis==='y'){
        panels=inside?[`내용 상단 ${large}mm`,`내용 가운데 ${middle}mm`,`접히는 하단 ${small}mm`]:[`접히는 상단 ${small}mm`,`가운데 ${middle}mm`,`하단 ${large}mm`];
      }else{
        panels=inside?[`내용 ${large}mm`,`내용 ${middle}mm`,`접히는 면 ${small}mm`]:[`접히는 면 ${small}mm`,`뒷면 ${middle}mm`,`앞표지 ${large}mm`];
      }
      setSurfaceGeometry(surface,axis,folds,panels);
    });
    return axis;
  }

  function geometryNeedsSync(p){
    if(!isLeaflet(p))return false;
    const surface=activeSurface(p);if(!surface)return true;
    if(isProductManaged(p)){
      const expectedAxis=p.printProductAxis==='y'?'y':'x';
      const list=expectedAxis==='y'?numericList(surface.foldsY):numericList(surface.folds);
      return axisOf(surface)!==expectedAxis||list.length!==productExpectedFoldCount(p);
    }
    const expectedOrientation=orientationOf(p);
    if(p[ORIENTATION_KEY]!==expectedOrientation)return true;
    if(isLeaflet2(p)){
      const expectedAxis=p.leaflet2Layout==='top-bottom'?'y':'x';
      if(axisOf(surface)!==expectedAxis)return true;
      const list=expectedAxis==='y'?numericList(surface.foldsY):numericList(surface.folds);
      return list.length!==1;
    }
    const expectedAxis=expectedOrientation==='portrait'?'y':'x';
    const list=expectedAxis==='y'?numericList(surface.foldsY):numericList(surface.folds);
    return axisOf(surface)!==expectedAxis||list.length!==2;
  }

  function syncGeometry(options={}){
    if(mutating)return false;
    const p=project();if(!isLeaflet(p))return false;
    if(!geometryNeedsSync(p)&&!options.force)return false;
    mutating=true;
    try{
      if(isProductManaged(p)&&window.DesignEditorPrintProductMenu?.applyGeometry){
        window.DesignEditorPrintProductMenu.applyGeometry(p,{persist:false});
      }else if(isLeaflet2(p))applyLeaflet2Geometry(p);else applyLeaflet3Geometry(p);
      if(options.persist!==false)persist(options.source||'print-fold-geometry');
    }finally{mutating=false;}
    window.dispatchEvent(new Event('resize'));
    window.DesignEditorPreviewGuides?.refresh?.();
    queue(30);
    return true;
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-print-fold-overlay{position:absolute;inset:0;z-index:41;pointer-events:none;overflow:visible}
      .design-print-fold-line{position:absolute;box-sizing:border-box;z-index:2}
      .design-print-fold-line.x{width:0;border-left:2px dashed #f59e0b}
      .design-print-fold-line.y{height:0;border-top:2px dashed #f59e0b}
      .design-print-fold-label{position:absolute;z-index:3;transform:translate(-50%,-50%);padding:2px 5px;border:1px dashed #f59e0b;border-radius:999px;background:rgba(255,255,255,.98);color:#b45309;font-size:6.4px;font-weight:950;white-space:nowrap;box-shadow:0 1px 3px rgba(15,23,42,.08)}
      .design-print-fold-flip-note{position:absolute;z-index:3;left:50%;transform:translateX(-50%);padding:2px 6px;border:1px dashed #7c3aed;border-radius:999px;background:rgba(255,255,255,.97);color:#6d28d9;font-size:6.2px;font-weight:950;white-space:nowrap}
      .design-print-fold-field{margin:5px 0;padding:6px;border:1px dashed #d8b4fe;border-radius:8px;background:#faf5ff}
      .design-print-fold-field label{display:block;font-size:7px;font-weight:950;color:#6d28d9;margin-bottom:3px}
      .design-print-fold-field select{width:100%;border:1px solid #d8b4fe;border-radius:7px;background:#fff;padding:6px 7px;font-size:8px;color:#4c1d95}
      .design-print-fold-note{margin-top:4px;font-size:6.4px;line-height:1.4;color:#7e5aa6}
    `;document.head.appendChild(style);
  }

  function foldSignature(p,surface){
    return [p.designMode,p.printProductMode||'',p.printProductPages||'',p.printProductFold||'',p.width,p.height,p.bleed,p.showGuides,p.showFolds,surface?.id,surface?.foldAxis,...numericList(surface?.folds),...numericList(surface?.foldsY),p[FLIP_KEY]||'none'].join('|');
  }

  function ensureOverlay(artboard){
    let overlay=byId(OVERLAY_ID);
    if(!overlay){overlay=document.createElement('div');overlay.id=OVERLAY_ID;overlay.className='design-print-fold-overlay';overlay.setAttribute('aria-hidden','true');artboard.appendChild(overlay);}
    return overlay;
  }

  function renderFoldOverlay(){
    frame=0;
    const p=project(),artboard=byId('artboard');if(!p||!artboard)return false;
    const overlay=ensureOverlay(artboard);
    const surface=activeSurface(p);
    const enabled=isLeaflet(p)&&p.showGuides!==false&&p.showFolds!==false&&surface;
    overlay.hidden=!enabled;
    if(!enabled){overlay.replaceChildren();return false;}
    const signature=foldSignature(p,surface);
    if(overlay.dataset.signature===signature)return true;
    const bleed=Math.max(0,Number(p.bleed)||0),width=Number(p.width)||0,height=Number(p.height)||0;
    const totalW=width+bleed*2,totalH=height+bleed*2;
    const sx=artboard.clientWidth/Math.max(.001,totalW),sy=artboard.clientHeight/Math.max(.001,totalH);
    const axis=axisOf(surface),folds=(axis==='y'?numericList(surface.foldsY):numericList(surface.folds)).sort((a,b)=>a-b);
    const nodes=[];
    folds.forEach((fold,index)=>{
      const line=document.createElement('div');line.className=`design-print-fold-line ${axis}`;
      const label=document.createElement('span');label.className='design-print-fold-label';label.textContent=`접지 ${index+1} · ${mm(fold)}mm`;
      if(axis==='x'){
        const x=(bleed+fold)*sx;line.style.left=`${x}px`;line.style.top=`${bleed*sy}px`;line.style.height=`${height*sy}px`;
        label.style.left=`${x}px`;label.style.top=`${Math.max(12,bleed*sy+12)}px`;
      }else{
        const y=(bleed+fold)*sy;line.style.left=`${bleed*sx}px`;line.style.top=`${y}px`;line.style.width=`${width*sx}px`;
        label.style.left=`${(bleed+width/2)*sx}px`;label.style.top=`${y}px`;
      }
      nodes.push(line,label);
    });
    if(isLeaflet2(p)&&axis==='y'&&(p[FLIP_KEY]==='top'||p[FLIP_KEY]==='bottom')){
      const fold=folds[0]||height/2;const note=document.createElement('span');note.className='design-print-fold-flip-note';
      const top=p[FLIP_KEY]==='top';note.textContent=`${top?'상단':'하단'} 내용 180° 출력`;
      note.style.top=`${(bleed+(top?Math.max(5,fold*.12):fold+Math.max(5,(height-fold)*.12)))*sy}px`;
      nodes.push(note);
    }
    overlay.replaceChildren(...nodes);overlay.dataset.signature=signature;
    return true;
  }

  function approxHeight(item){
    if(item?.type!=='text')return Math.max(0,Number(item?.h)||0);
    const lines=Math.max(1,String(item.text||'').split(/\n/).length);
    const sizeMm=Math.max(1,Number(item.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item.lineHeight)||1.26));
  }
  function centerY(item){return (Number(item?.y)||0)+approxHeight(item)/2;}
  function allItems(p){
    const result=[];(p.surfaces||[]).forEach(surface=>{
      (surface.elements||[]).forEach(item=>result.push({surface,item}));
      (surface.extras||[]).forEach(item=>result.push({surface,item}));
    });return result;
  }
  function restoreAutoRotations(p){
    let changed=false;allItems(p).forEach(({item})=>{
      if(!item?.[AUTO_ROTATED_KEY])return;
      item.rotation=normalizeAngle(item[BASE_ROTATION_KEY]||0);
      delete item[AUTO_ROTATED_KEY];delete item[BASE_ROTATION_KEY];changed=true;
    });return changed;
  }
  function applyFlipRotations(options={}){
    const p=project();if(!p)return false;
    const mode=String(p[FLIP_KEY]||'none');
    const surface=activeSurface(p),axis=surface?axisOf(surface):'x';
    if(!isLeaflet2(p)||axis!=='y'||(mode!=='top'&&mode!=='bottom')){
      const restored=restoreAutoRotations(p);if(restored&&options.persist!==false)persist('print-fold-rotation-restore');return restored;
    }
    const fold=Number(surface?.foldsY?.[0])||((Number(p.height)||0)/2);
    let changed=false;
    allItems(p).forEach(({item})=>{
      if(!item)return;
      const inTarget=mode==='top'?centerY(item)<fold:centerY(item)>=fold;
      if(inTarget){
        if(!item[AUTO_ROTATED_KEY])item[BASE_ROTATION_KEY]=normalizeAngle(item.rotation||0);
        const next=normalizeAngle((Number(item[BASE_ROTATION_KEY])||0)+180);
        if(Number(item.rotation)!==next||!item[AUTO_ROTATED_KEY])changed=true;
        item.rotation=next;item[AUTO_ROTATED_KEY]=true;
      }else if(item[AUTO_ROTATED_KEY]){
        item.rotation=normalizeAngle(item[BASE_ROTATION_KEY]||0);delete item[AUTO_ROTATED_KEY];delete item[BASE_ROTATION_KEY];changed=true;
      }
    });
    if(changed&&options.persist!==false)persist('print-fold-rotation');
    if(changed){window.DesignEditorRotation?.sync?.();window.dispatchEvent(new Event('resize'));}
    return changed;
  }

  function ensureDirectionField(){
    const p=project();let field=byId(FIELD_ID);
    if(isProductManaged(p)){if(field)field.hidden=true;return false;}
    const surface=activeSurface(p),show=Boolean(isLeaflet2(p)&&surface&&axisOf(surface)==='y');
    if(!show){if(field)field.hidden=true;return false;}
    const options=byId('designEmbeddedModeCard')?.querySelector('.design-mode-options');if(!options)return false;
    if(!field){
      field=document.createElement('div');field.id=FIELD_ID;field.className='design-print-fold-field';
      field.innerHTML=`<label for="${SELECT_ID}">상하 접기 인쇄 방향</label><select id="${SELECT_ID}"><option value="none">일반 방향 · 회전 안 함</option><option value="top">상단 180° · 초대장/카드</option><option value="bottom">하단 180° · 반대 방향 접기</option></select><div class="design-print-fold-note">접었을 때 한쪽 내용이 거꾸로 보이는 카드·초대장은 180° 보정을 선택하세요. 화면뿐 아니라 PDF/PNG 출력 회전값에도 적용됩니다.</div>`;
      const apply=options.querySelector('.design-mode-apply');if(apply)options.insertBefore(field,apply);else options.appendChild(field);
      byId(SELECT_ID)?.addEventListener('change',event=>{
        p[FLIP_KEY]=String(event.target.value||'none');applyFlipRotations({persist:true});renderFoldOverlay();persist('print-fold-direction');
      });
    }
    field.hidden=false;
    const select=byId(SELECT_ID);if(select)select.value=String(p[FLIP_KEY]||'none');
    return true;
  }

  function sync(){
    clearTimeout(timer);
    const p=project(),artboard=byId('artboard');if(!p||!artboard)return false;
    if(isLeaflet(p))syncGeometry({persist:false});
    else if(restoreAutoRotations(p)){persist('print-fold-mode-restore');}
    installStyles();ensureDirectionField();applyFlipRotations({persist:false});renderFoldOverlay();
    document.documentElement.dataset.printFoldProduction='1';
    return true;
  }
  function queue(delay=20){clearTimeout(timer);timer=setTimeout(()=>{if(frame)return;frame=requestAnimationFrame(sync);},delay);}

  function connect(){
    const artboard=byId('artboard');if(!artboard||!project()){queue(120);return;}
    installStyles();
    if(!observer&&typeof MutationObserver==='function'){
      observer=new MutationObserver(()=>queue(20));observer.observe(artboard,{childList:true,subtree:false});
    }
    if(!resizeObserver&&window.ResizeObserver){resizeObserver=new ResizeObserver(()=>queue(20));resizeObserver.observe(artboard);}
    queue(0);
  }

  document.addEventListener('change',event=>{
    if(event.target?.id==='designModeOrientation')queue(20);
    if(event.target?.id==='designLeaflet2Layout')queue(80);
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.design-mode-apply')||event.target?.closest?.('.design-product-apply'))queue(120);
    if(event.target?.closest?.('.surface-tab'))queue(30);
  },true);
  document.addEventListener('input',event=>{
    if(['designModeWidth','designModeHeight','bleedInput','safeInput','designProductFoldPosition'].includes(event.target?.id))queue(40);
  },true);
  window.addEventListener('resize',()=>queue(20),{passive:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',connect,{once:true});else connect();
  [180,420,800,1400,2400].forEach(delay=>setTimeout(connect,delay));

  window.DesignEditorPrintFoldProduction={sync,syncGeometry,applyFlipRotations,stage:'print-product-fold-lines-orientation-and-invitation-rotation'};
})();
