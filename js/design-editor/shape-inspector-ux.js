(function(){
  'use strict';
  if(window.__designEditorShapeInspectorUxV1)return;
  window.__designEditorShapeInspectorUxV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(![
    '/design-editor/general','/design-editor/general.html','/design-editor/index.html','/design-editor'
  ].some(item=>path===item||path.endsWith(item)))return;

  const STYLE_ID='designEditorShapeInspectorUxStyles';
  const BORDER_SEGMENT_ID='designShapeBorderSegmented';
  let observer=null;
  let syncTimer=0;

  const byId=id=>document.getElementById(id);

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #inspector.shape-ux-inspector{--shape-ux-accent:#1698ad;--shape-ux-accent-soft:#ecfbfd;--shape-ux-border:#cfdbe5;--shape-ux-text:#334155}
      #inspector.shape-ux-inspector .quick-style-panel{margin:9px 0 13px;padding:11px;border-color:#d9e5ec;border-radius:12px;background:#f7fbfd}
      #inspector.shape-ux-inspector .quick-style-title{margin-bottom:9px;font-size:8.5px;color:#34465a}
      #inspector.shape-ux-inspector .quick-radius-buttons{gap:6px;margin-bottom:10px}
      #inspector.shape-ux-inspector .quick-radius-buttons button{min-height:34px;padding:7px 4px;border-color:var(--shape-ux-border);border-radius:9px;background:#fff;color:#526174;font-size:8px;line-height:1.15;transition:border-color .12s,background .12s,color .12s,box-shadow .12s,transform .06s}
      #inspector.shape-ux-inspector .quick-radius-buttons button:hover{border-color:#82bfca;background:#f3fcfd;color:#155e75}
      #inspector.shape-ux-inspector .quick-radius-buttons button:active{transform:translateY(1px)}
      #inspector.shape-ux-inspector .quick-radius-buttons button.on{border-color:var(--shape-ux-accent);background:var(--shape-ux-accent-soft);color:#0e7490;box-shadow:inset 0 0 0 1px #1698ad22}
      #inspector.shape-ux-inspector button:focus-visible,#inspector.shape-ux-inspector input:focus-visible,#inspector.shape-ux-inspector select:focus-visible{outline:2px solid #1d9bb23d;outline-offset:2px}
      #inspector.shape-ux-inspector .quick-range-row{grid-template-columns:minmax(0,1fr) auto;gap:10px;min-height:28px}
      #inspector.shape-ux-inspector .quick-range-row input[type=range]{appearance:none;width:100%;height:24px;margin:0;background:transparent;cursor:pointer;touch-action:pan-y}
      #inspector.shape-ux-inspector .quick-range-row input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:#d8e3e9}
      #inspector.shape-ux-inspector .quick-range-row input[type=range]::-webkit-slider-thumb{appearance:none;width:18px;height:18px;margin-top:-6px;border:2px solid #fff;border-radius:50%;background:var(--shape-ux-accent);box-shadow:0 1px 4px #0f172a33}
      #inspector.shape-ux-inspector .quick-range-row input[type=range]::-moz-range-track{height:6px;border:0;border-radius:999px;background:#d8e3e9}
      #inspector.shape-ux-inspector .quick-range-row input[type=range]::-moz-range-thumb{width:16px;height:16px;border:2px solid #fff;border-radius:50%;background:var(--shape-ux-accent);box-shadow:0 1px 4px #0f172a33}
      #inspector.shape-ux-inspector .quick-range-value{min-width:49px;border:1px solid #dce5eb;border-radius:999px;background:#fff;padding:5px 7px;color:#475569;text-align:center;font-size:7.5px;font-variant-numeric:tabular-nums}
      #inspector.shape-ux-inspector .shape-ux-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:38px;margin:8px 0 0;padding:8px 10px;border:1px solid #dce5eb;border-radius:10px;background:#fff;color:#445367;font-size:8.5px;font-weight:850;cursor:pointer;user-select:none;transition:border-color .12s,background .12s,box-shadow .12s}
      #inspector.shape-ux-inspector .shape-ux-toggle-row:hover{border-color:#9bcbd3;background:#fbfeff}
      #inspector.shape-ux-inspector .shape-ux-toggle-row:has(input:checked){border-color:#83c3cd;background:#f2fcfd;color:#0f6677}
      #inspector.shape-ux-inspector .shape-ux-toggle-row input[type=checkbox]{appearance:none;flex:0 0 34px;width:34px!important;height:20px!important;margin:0!important;border:1px solid #bdcad4!important;border-radius:999px!important;padding:0!important;background:radial-gradient(circle at 9px 50%,#fff 0 6px,transparent 6.5px),#d7e0e7!important;box-shadow:inset 0 1px 2px #0f172a12;cursor:pointer;transition:background .14s,border-color .14s}
      #inspector.shape-ux-inspector .shape-ux-toggle-row input[type=checkbox]:checked{border-color:var(--shape-ux-accent)!important;background:radial-gradient(circle at 25px 50%,#fff 0 6px,transparent 6.5px),var(--shape-ux-accent)!important}
      #inspector.shape-ux-inspector .shape-border-toggle-row{margin:9px 0;padding:0;border:0;background:transparent}
      #inspector.shape-ux-inspector .shape-border-toggle-row .shape-border-toggle{font-size:8.5px}
      #inspector.shape-ux-inspector .shape-border-toggle-row .shape-border-toggle>span:last-child{display:flex;align-items:center;gap:7px;margin-left:auto}
      #inspector.shape-ux-inspector .shape-border-state{margin:5px 2px 0;font-size:7px;line-height:1.45}
      #inspector.shape-ux-inspector .field{margin-bottom:10px}
      #inspector.shape-ux-inspector .field label{margin-bottom:5px;color:#5d6b7e;font-size:8px}
      #inspector.shape-ux-inspector .field input:not([type=color]):not([type=range]):not([type=checkbox]),#inspector.shape-ux-inspector .field select{min-height:36px;padding:8px 9px;border-color:var(--shape-ux-border);border-radius:9px;font-size:10px;transition:border-color .12s,box-shadow .12s,background .12s}
      #inspector.shape-ux-inspector .field input:not([type=color]):not([type=range]):not([type=checkbox]):hover,#inspector.shape-ux-inspector .field select:hover{border-color:#9fc5ce}
      #inspector.shape-ux-inspector .field input[type=color]{height:40px;min-height:40px;padding:4px;border-color:var(--shape-ux-border);border-radius:9px;background:#fff;cursor:pointer}
      #inspector.shape-ux-inspector .field input[type=color]::-webkit-color-swatch-wrapper{padding:1px}
      #inspector.shape-ux-inspector .field input[type=color]::-webkit-color-swatch{border:0;border-radius:5px}
      #inspector.shape-ux-inspector .shape-ux-border-field{position:relative}
      #inspector.shape-ux-inspector .shape-ux-border-segment{display:grid;grid-template-columns:1fr 1fr;gap:5px}
      #inspector.shape-ux-inspector .shape-ux-border-segment button{min-height:36px;border:1px solid var(--shape-ux-border);border-radius:9px;background:#fff;color:#526174;font-size:8.5px;font-weight:900;cursor:pointer;transition:border-color .12s,background .12s,color .12s,transform .06s}
      #inspector.shape-ux-inspector .shape-ux-border-segment button:hover{border-color:#8fc4cd;background:#f7fdfe}
      #inspector.shape-ux-inspector .shape-ux-border-segment button:active{transform:translateY(1px)}
      #inspector.shape-ux-inspector .shape-ux-border-segment button.on{border-color:var(--shape-ux-accent);background:var(--shape-ux-accent-soft);color:#0e7490}
      #inspector.shape-ux-inspector .shape-ux-native-select{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}
      #inspector.shape-ux-inspector .phase2-inspector-actions{gap:7px;margin-top:11px}
      #inspector.shape-ux-inspector .phase2-inspector-actions button{min-height:34px;border-radius:9px;font-size:8.5px;transition:border-color .12s,background .12s,transform .06s}
      #inspector.shape-ux-inspector .phase2-inspector-actions button:hover{border-color:#8fc4cd;background:#f6fcfd}
      #inspector.shape-ux-inspector .phase2-inspector-actions button:active{transform:translateY(1px)}
      #inspector.shape-ux-inspector .phase2-inspector-actions .danger:hover{border-color:#efb8b3;background:#fff2f1}
    `;
    document.head.appendChild(style);
  }

  function enhanceRadius(root){
    root.querySelectorAll('[data-radius-preset]').forEach(button=>{
      button.classList.add('shape-ux-choice');
      const pressed=button.classList.contains('on')?'true':'false';
      if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
    });
    const range=byId('quickCornerRadius');
    if(range&&root.contains(range)){
      if(!range.getAttribute('aria-label'))range.setAttribute('aria-label','모서리 둥글기');
      const value=byId('quickCornerRadiusValue')?.textContent?.trim();
      if(value&&range.getAttribute('aria-valuetext')!==value)range.setAttribute('aria-valuetext',value);
    }
  }

  function enhanceToggle(input,labelText){
    if(!input)return;
    const label=input.closest('label');if(!label)return;
    label.classList.add('shape-ux-toggle-row');
    if(!input.getAttribute('aria-label'))input.setAttribute('aria-label',labelText);
  }

  function findBorderSelect(root){
    for(const field of root.querySelectorAll('.field')){
      const label=field.querySelector(':scope > label');
      if(!label||label.textContent.trim()!=='테두리')continue;
      const select=field.querySelector('select');
      if(select)return{field,select};
    }
    return null;
  }

  function syncBorderSegment(select,segment){
    if(!select||!segment)return;
    segment.querySelectorAll('button[data-shape-ux-border-value]').forEach(button=>{
      const on=button.dataset.shapeUxBorderValue===select.value;
      button.classList.toggle('on',on);
      button.setAttribute('aria-pressed',on?'true':'false');
    });
  }

  function enhanceBorderSelect(root){
    const record=findBorderSelect(root);if(!record)return;
    const {field,select}=record;
    field.classList.add('shape-ux-border-field');
    if(select.options.length!==2)return;
    select.classList.add('shape-ux-native-select');
    let segment=field.querySelector(`#${BORDER_SEGMENT_ID}`);
    if(!segment){
      segment=document.createElement('div');
      segment.id=BORDER_SEGMENT_ID;
      segment.className='shape-ux-border-segment';
      segment.setAttribute('role','group');
      segment.setAttribute('aria-label','테두리');
      [...select.options].forEach(option=>{
        const button=document.createElement('button');
        button.type='button';
        button.dataset.shapeUxBorderValue=option.value;
        button.textContent=option.textContent||option.value;
        button.addEventListener('click',()=>{
          if(select.value===option.value)return;
          select.value=option.value;
          select.dispatchEvent(new Event('change',{bubbles:true}));
          syncBorderSegment(select,segment);
        });
        segment.appendChild(button);
      });
      select.insertAdjacentElement('afterend',segment);
    }
    syncBorderSegment(select,segment);
  }

  function enhanceFields(root){
    root.querySelectorAll('input[type=number]').forEach(input=>{
      input.inputMode='decimal';
      input.setAttribute('autocomplete','off');
    });
    root.querySelectorAll('input[type=color]').forEach(input=>{
      if(!input.getAttribute('aria-label')){
        const label=input.closest('.field')?.querySelector('label')?.textContent?.trim();
        if(label)input.setAttribute('aria-label',label);
      }
    });
  }

  function enhance(){
    const root=byId('inspector');if(!root)return false;
    installStyles();
    root.classList.add('shape-ux-inspector');
    enhanceRadius(root);
    enhanceToggle(byId('quickShapeShadow'),'은은한 그림자');
    enhanceToggle(byId('phase2ExtraLock'),'이 요소 잠금');
    enhanceToggle(byId('designShapeBorderToggle'),'테두리 선 표시');
    enhanceBorderSelect(root);
    enhanceFields(root);
    return true;
  }

  function queueEnhance(){
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>requestAnimationFrame(enhance),16);
  }

  function bind(){
    const root=byId('inspector');if(!root)return false;
    if(observer)observer.disconnect();
    observer=new MutationObserver(queueEnhance);
    observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','value','checked']});
    root.addEventListener('input',queueEnhance,false);
    root.addEventListener('change',queueEnhance,false);
    root.addEventListener('click',queueEnhance,false);
    return true;
  }

  function install(){
    const root=byId('inspector');if(!root)return false;
    installStyles();bind();enhance();
    window.DesignEditorShapeInspectorUX={reconcile:enhance,stage:'shape-inspector-natural-controls'};
    [80,180,420,850,1500,2600].forEach(delay=>setTimeout(queueEnhance,delay));
    return true;
  }

  function boot(){if(install())return;[100,220,480,850,1400,2300].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
