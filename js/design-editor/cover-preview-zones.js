(function(){
  'use strict';
  if(window.__designEditorCoverPreviewZonesV1)return;
  window.__designEditorCoverPreviewZonesV1=true;

  const params=new URLSearchParams(location.search);
  if(params.get('embed')!=='1'||params.get('mode')!=='cover')return;

  const OVERLAY_ID='designCoverPreviewZones';
  const CARD_ID='designCoverPreviewZoneTools';
  const STYLE_ID='designCoverPreviewZoneStyles';
  const PREF_KEY='programTool.designEditor.coverPreviewZones.v1';
  const DEFAULTS={visible:true,labels:true,safe:true,opacity:12};
  let prefs=readPrefs();
  let frame=0;
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const isCover=()=>project()?.designMode==='cover'&&project()?.cover;

  function readPrefs(){
    try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(PREF_KEY)||'{}')};}catch(_){return {...DEFAULTS};}
  }
  function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch(_){} }
  function setPrefs(next={}){
    prefs={...prefs,...next};
    prefs.visible=prefs.visible!==false;prefs.labels=prefs.labels!==false;prefs.safe=prefs.safe!==false;prefs.opacity=clamp(Number(prefs.opacity)||0,0,35);
    savePrefs();render();syncControls();return {...prefs};
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${OVERLAY_ID}{position:absolute;inset:0;z-index:22;pointer-events:none;overflow:hidden}
      #${OVERLAY_ID}[hidden]{display:none!important}
      .cover-preview-zone{position:absolute;box-sizing:border-box;border:1px solid rgba(15,118,110,.38);background:rgba(14,165,233,var(--zone-opacity,.12));overflow:hidden}
      .cover-preview-zone[data-zone="spine"]{background:rgba(16,185,129,var(--zone-opacity,.12));border-color:rgba(5,150,105,.55)}
      .cover-preview-zone[data-zone="front"]{background:rgba(99,102,241,var(--zone-opacity,.12));border-color:rgba(79,70,229,.42)}
      .cover-preview-zone-label{position:absolute;top:5px;left:50%;transform:translateX(-50%);max-width:90%;padding:2px 5px;border-radius:999px;background:rgba(255,255,255,.88);border:1px solid rgba(148,163,184,.55);font-size:7px;font-weight:950;line-height:1.2;color:#334155;white-space:nowrap}
      .cover-preview-zone-safe{position:absolute;box-sizing:border-box;border:1px dashed rgba(220,38,38,.72);background:transparent}
      .cover-preview-zone-safe[data-zone="spine"]{border-color:rgba(217,119,6,.9)}
      .cover-preview-zone-tools{border-color:#c7d2fe!important;background:#fbfcff!important}
      .cover-preview-zone-row{display:flex;align-items:center;gap:6px;margin:5px 0;font-size:7.5px;font-weight:850;color:#475569}
      .cover-preview-zone-row input[type="checkbox"]{margin:0}
      .cover-preview-zone-opacity{display:grid;grid-template-columns:auto 1fr 30px;align-items:center;gap:6px;margin-top:6px;font-size:7.5px;font-weight:850;color:#475569}
      .cover-preview-zone-opacity input{width:100%}.cover-preview-zone-opacity output{text-align:right;color:#0f766e;font-weight:950}
      .cover-preview-zone-note{font-size:7px;line-height:1.45;color:#64748b;margin-top:6px}
    `;document.head.appendChild(style);
  }

  function ensureOverlay(){
    const artboard=byId('artboard');if(!artboard)return null;
    let overlay=byId(OVERLAY_ID);
    if(!overlay){overlay=document.createElement('div');overlay.id=OVERLAY_ID;overlay.setAttribute('aria-hidden','true');artboard.appendChild(overlay);}
    return overlay;
  }
  function mmScale(artboard,p){
    const totalW=Number(p.width)+(Number(p.bleed)||0)*2;
    const totalH=Number(p.height)+(Number(p.bleed)||0)*2;
    return{x:artboard.clientWidth/Math.max(.001,totalW),y:artboard.clientHeight/Math.max(.001,totalH)};
  }
  function zoneBox(name,start,width,p,scale){
    const bleed=Number(p.bleed)||0,trimH=Number(p.cover.trimHeight)||Number(p.height)||297;
    return{name,left:(bleed+start)*scale.x,top:bleed*scale.y,width:width*scale.x,height:trimH*scale.y};
  }
  function safeBox(zone,p,scale){
    const safe=Math.max(0,Number(p.safe)||0),spine=Number(p.cover.spine)||0;
    if(zone.name==='spine'){
      const safeWidth=Math.max(.2,spine*.72),inset=Math.max(0,(spine-safeWidth)/2);
      return{left:zone.left+inset*scale.x,top:zone.top+safe*scale.y,width:safeWidth*scale.x,height:Math.max(1,zone.height-safe*2*scale.y)};
    }
    return{left:zone.left+safe*scale.x,top:zone.top+safe*scale.y,width:Math.max(1,zone.width-safe*2*scale.x),height:Math.max(1,zone.height-safe*2*scale.y)};
  }
  function appendZone(overlay,zone,p,scale,label){
    const node=document.createElement('div');node.className='cover-preview-zone';node.dataset.zone=zone.name;
    node.style.left=`${zone.left}px`;node.style.top=`${zone.top}px`;node.style.width=`${zone.width}px`;node.style.height=`${zone.height}px`;node.style.setProperty('--zone-opacity',String(prefs.opacity/100));
    if(prefs.labels){const badge=document.createElement('span');badge.className='cover-preview-zone-label';badge.textContent=label;node.appendChild(badge);}
    overlay.appendChild(node);
    if(prefs.safe){const box=safeBox(zone,p,scale),safe=document.createElement('div');safe.className='cover-preview-zone-safe';safe.dataset.zone=zone.name;safe.style.left=`${box.left}px`;safe.style.top=`${box.top}px`;safe.style.width=`${box.width}px`;safe.style.height=`${box.height}px`;overlay.appendChild(safe);}
  }
  function render(){
    if(!isCover())return false;
    const p=project(),artboard=byId('artboard'),overlay=ensureOverlay();if(!p||!artboard||!overlay)return false;
    overlay.hidden=!prefs.visible;overlay.replaceChildren();if(!prefs.visible)return true;
    const scale=mmScale(artboard,p),trimW=Number(p.cover.trimWidth)||210,spine=Number(p.cover.spine)||0;
    const zones=[zoneBox('back',0,trimW,p,scale),zoneBox('spine',trimW,spine,p,scale),zoneBox('front',trimW+spine,trimW,p,scale)];
    appendZone(overlay,zones[0],p,scale,'뒤표지');appendZone(overlay,zones[1],p,scale,`책등 ${spine.toFixed(1)}mm`);appendZone(overlay,zones[2],p,scale,'앞표지');
    overlay.dataset.zoneCount='3';overlay.dataset.spine=String(spine);overlay.dataset.opacity=String(prefs.opacity);return true;
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),anchor=byId('designCoverSpineTools')||byId('designCoverSettings'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card cover-preview-zone-tools';
    card.innerHTML=`<div class="side-label">표지 미리보기 가이드</div><label class="cover-preview-zone-row"><input id="coverPreviewZonesVisible" type="checkbox"> 뒤표지·책등·앞표지 영역 표시</label><label class="cover-preview-zone-row"><input id="coverPreviewZoneLabels" type="checkbox"> 영역 이름 표시</label><label class="cover-preview-zone-row"><input id="coverPreviewZoneSafe" type="checkbox"> 인쇄 안전영역 표시</label><label class="cover-preview-zone-opacity"><span>영역 음영</span><input id="coverPreviewZoneOpacity" type="range" min="0" max="35" step="1"><output id="coverPreviewZoneOpacityValue"></output></label><div class="cover-preview-zone-note">가이드는 편집 화면에만 보이며 PNG/PDF 출력에는 포함되지 않습니다.</div>`;
    if(anchor?.nextSibling)sidebar.insertBefore(card,anchor.nextSibling);else sidebar.insertBefore(card,inspector);
    byId('coverPreviewZonesVisible')?.addEventListener('change',event=>setPrefs({visible:event.target.checked}));
    byId('coverPreviewZoneLabels')?.addEventListener('change',event=>setPrefs({labels:event.target.checked}));
    byId('coverPreviewZoneSafe')?.addEventListener('change',event=>setPrefs({safe:event.target.checked}));
    byId('coverPreviewZoneOpacity')?.addEventListener('input',event=>setPrefs({opacity:Number(event.target.value)}));
    return true;
  }
  function syncControls(){
    const visible=byId('coverPreviewZonesVisible'),labels=byId('coverPreviewZoneLabels'),safe=byId('coverPreviewZoneSafe'),opacity=byId('coverPreviewZoneOpacity'),value=byId('coverPreviewZoneOpacityValue');
    if(visible)visible.checked=prefs.visible;if(labels)labels.checked=prefs.labels;if(safe)safe.checked=prefs.safe;if(opacity)opacity.value=String(prefs.opacity);if(value)value.value=`${prefs.opacity}%`;
  }
  function queueRender(){if(frame)return;frame=requestAnimationFrame(()=>requestAnimationFrame(()=>{frame=0;installCard();syncControls();render();}));}
  function install(){
    if(installed){queueRender();return true;}
    if(!isCover()||!document.querySelector('.sidebar')||!byId('artboard'))return false;
    installed=true;installStyles();installCard();syncControls();render();
    window.addEventListener('resize',queueRender,{passive:true});
    window.addEventListener('programstudio:cover-geometry-change',queueRender);
    document.addEventListener('click',queueRender,false);
    return true;
  }
  function boot(){if(install())return;[180,420,800,1300,2200,3200].forEach(delay=>setTimeout(install,delay));}

  window.DesignEditorCoverPreviewZones={render,setPrefs,get prefs(){return {...prefs};},stage:'preview-only-back-spine-front-zones'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
