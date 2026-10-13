/* Product-specific production presets and fold setup. Shared editor remains unchanged. */
'use strict';
(() => {
  if(window.DesignProfessionalControls)return;
  const $=id=>document.getElementById(id);
  const studio=()=>document.documentElement.dataset.designStudio||'cover';
  const side=()=>new URLSearchParams(location.search).get('side')==='inside'?'inside':'outside';
  const formats={
    flyer:{a4:[210,297],a5:[148,210],b5:[182,257],a3:[297,420],poster:[330,480]},
    invitation:{a5:[148,210],a6:[105,148],square:[150,150],dl:[100,210]}
  };
  let api=null;
  const n=(id,fallback)=>{const value=Number($(id)?.value);return Number.isFinite(value)&&value>0?value:fallback;};
  const set=(id,value)=>{if($(id))$(id).value=String(value);};
  const get=(id)=>$(id)?.value||'';
  function selectOrientation(w,h,orientation){
    if(orientation==='landscape'&&h>w)return [h,w];
    if(orientation==='portrait'&&w>h)return [h,w];
    return [w,h];
  }
  function changed(){
    if(!api)return;
    api.updateGeometry?.();
    api.scheduleRender?.();
    api.saveLocal?.();
    updateInfo();
  }
  function setSheet(w,h){
    if(!api)return;
    set('trimW',w);set('trimH',h);
    api.state.sizeMode='custom';
    api.syncSizeMode?.();
    changed();
  }
  function formatChange(kind){
    const format=get(kind+'Format');
    if(format==='custom'){api.state.sizeMode='custom';api.syncSizeMode?.();return changed();}
    const base=formats[kind][format];if(!base)return;
    const [w,h]=selectOrientation(...base,get(kind+'Orientation'));
    setSheet(w,h);
    if(kind==='invitation')set('invitationFoldPosition',w);
    changed();
  }
  function orientationChange(kind){
    const w=n('trimW',210),h=n('trimH',297),[a,b]=selectOrientation(w,h,get(kind+'Orientation'));
    if(kind==='invitation'){
      const oldFold=n('invitationFoldPosition',w);
      const frac=oldFold/(2*w);
      set('invitationFoldPosition',Math.round(frac*2*a*10)/10);
    }
    setSheet(a,b);
  }
  function leafletPreset(){
    const format=get('leafletFormat');
    if(format==='custom')return changed();
    const width=format==='a3'?420:297,height=format==='a3'?297:210;
    const kind=get('leafletFoldType');
    const regular=width/3;
    const base=(kind==='accordion'?regular:regular+0.5);
    const tuck=width-2*base;
    let panels=kind==='roll-right'?[base,base,tuck]:[tuck,base,base];
    panels=panels.map((p,i)=>i===2?Math.round((width-panels[0]-panels[1])*10)/10:Math.round(p*10)/10);
    set('leafletPanelLeft',panels[0]);set('leafletPanelCenter',panels[1]);set('leafletPanelRight',panels[2]);
    setSheet(panels[0],height);
  }
  function leafletPanelChange(){
    const left=n('leafletPanelLeft',99);
    set('trimW',left);api.state.sizeMode='custom';api.syncSizeMode?.();changed();
  }
  function invitations(){
    const folded=get('invitationFoldType')==='folded';
    const duplex=api.state.coverMode==='frontBack';
    if($('invitationFoldPositionField'))$('invitationFoldPositionField').hidden=!folded||!duplex;
    if($('invitationSidePicker'))$('invitationSidePicker').hidden=!folded||!duplex;
    document.querySelectorAll('[data-invitation-side]').forEach(node=>{
      const selected=node.dataset.invitationSide===side();
      node.classList.toggle('active',selected);
      if(selected)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');
    });
  }
  function updateInfo(){
    if(!api)return;
    const s=api.currentSpec?.();
    const active=studio(),banner=$('productCanvasBanner');
    if(banner)banner.hidden=active==='cover';
    if($('productCanvasTitle'))$('productCanvasTitle').textContent={
      flyer:'전단지 실제 인쇄 미리보기',invitation:'초대장 '+(side()==='inside'?'안쪽면':'겉면')+' · 접지 미리보기',leaflet:'리플렛 '+(side()==='inside'?'안쪽면':'겉면')+' · 3단 접지 미리보기'
    }[active]||'';
    if($('productCanvasSubtitle'))$('productCanvasSubtitle').textContent=s?window.DesignProductGeometry?.summary(s)||'':'';
    const description=$('productLiveMeasure');
    if(description){
      description.hidden=active==='cover';
      description.textContent=s?window.DesignProductGeometry?.summary(s)||'':'';
    }
    invitations();
    const sInput=$('designLayerTarget');
    if(sInput&&active==='invitation'){
      const labels=get('invitationFoldType')==='folded'&&api.state.coverMode==='frontBack'
        ?{back:'왼쪽 접지 면',front:'오른쪽 접지 면'}
        :{back:'초대장 뒷면',front:'초대장 앞면'};
      Array.from(sInput.options).forEach(o=>{if(labels[o.value])o.textContent=labels[o.value];});
    }
  }
  function requestHint(){
    if(!api)return '';
    const kind=studio();
    if(kind==='flyer')return '전단지 용도 '+get('flyerPurpose')+', 용지 '+get('flyerStock')+', '+get('flyerOrientation')+' 형. 종이 한 장의 실제 앞면/뒷면을 구분하고 중앙 접지선이나 책등을 그리지 마세요.';
    if(kind==='invitation')return '초대장 '+get('invitationOrientation')+'형, '+(get('invitationFoldType')==='folded'?'접이식 '+(side()==='inside'?'안쪽면':'겉면')+', 실제 접는 위치 왼쪽부터 '+get('invitationFoldPosition')+'mm':'접지 없는 카드')+'. 접는 위치를 중앙이라고 가정하지 마세요.';
    if(kind==='leaflet')return '리플렛 접지 방식 '+get('leafletFoldType')+', 실제 패널 너비 왼쪽 '+get('leafletPanelLeft')+'mm, 가운데 '+get('leafletPanelCenter')+'mm, 오른쪽 '+get('leafletPanelRight')+'mm, '+(side()==='inside'?'안쪽면':'겉면')+'. 접는선에 중요한 이미지나 문구를 배치하지 마세요.';
    return '';
  }
  function setup(options){
    if(api)return;
    api=options;
    const kind=studio();
    document.querySelectorAll('[data-product-options]').forEach(box=>{
      box.hidden=box.dataset.productOptions!==kind;
    });
    if(kind==='leaflet'){
      if(!options.hasSavedWorkspace)leafletPreset();
      else set('leafletPanelLeft',get('trimW'));
    }
    if(kind==='flyer'||kind==='invitation'){
      $(kind+'Format')?.addEventListener('change',()=>formatChange(kind));
      $(kind+'Orientation')?.addEventListener('change',()=>orientationChange(kind));
    }
    if(kind==='leaflet'){
      $('leafletFormat')?.addEventListener('change',leafletPreset);
      $('leafletFoldType')?.addEventListener('change',leafletPreset);
      for(const id of ['leafletPanelLeft','leafletPanelCenter','leafletPanelRight'])
        $(id)?.addEventListener('input',leafletPanelChange);
      $('trimW')?.addEventListener('input',()=>{set('leafletPanelLeft',get('trimW'));changed();});
    }
    if(kind==='invitation'){
      for(const id of ['invitationFoldType','invitationFoldPosition']){
        $(id)?.addEventListener('input',changed);
        $(id)?.addEventListener('change',changed);
      }
    }
    if(kind==='flyer')for(const id of ['flyerPurpose','flyerStock'])$(id)?.addEventListener('change',changed);
    if(kind==='invitation')document.querySelectorAll('input[name="coverMode"]').forEach(node=>node.addEventListener('change',()=>queueMicrotask(updateInfo)));
    updateInfo();
  }
  function refresh(){updateInfo();}
  window.DesignProfessionalControls={setup,refresh,requestHint,selectOrientation};
})();