// Print Checker: practical defaults, size presets, cover wing controls, and daily-free run guard.
(function(){
  'use strict';
  if(window.__printCheckerDefaultsLiveV2)return;
  window.__printCheckerDefaultsLiveV2=true;

  const $=id=>document.getElementById(id);
  const DEFAULT_WING_MM=90;
  const SIZE_PRESETS=Object.freeze({
    a3:{label:'A3 · 297 × 420 mm',w:297,h:420},
    a3l:{label:'A3 가로 · 420 × 297 mm',w:420,h:297},
    a4:{label:'A4 · 210 × 297 mm',w:210,h:297},
    a4l:{label:'A4 가로 · 297 × 210 mm',w:297,h:210},
    a5:{label:'A5 · 148 × 210 mm',w:148,h:210},
    a5l:{label:'A5 가로 · 210 × 148 mm',w:210,h:148},
    b5:{label:'B5 · 182 × 257 mm',w:182,h:257},
    b5l:{label:'B5 가로 · 257 × 182 mm',w:257,h:182},
    dl:{label:'DL · 100 × 210 mm',w:100,h:210},
    business:{label:'명함 · 90 × 50 mm',w:90,h:50},
    custom:{label:'직접 입력',w:null,h:null}
  });

  const PRODUCT_DEFAULTS=Object.freeze({
    flyer:{size:'a4',trimW:210,trimH:297,bleed:3,safeZone:10},
    invitation:{size:'a5',trimW:148,trimH:210,bleed:3,safeZone:10},
    leaflet:{size:'a4l',trimW:297,trimH:210,foldType:'3roll',gutterMargin:3,bleed:3,safeZone:10},
    cover:{size:'a5',trimW:148,trimH:210,paperType:'mojo80',pageCount:100,spine:5,hasWing:false,wingW:DEFAULT_WING_MM,bleed:3,safeZone:10},
    booklet:{size:'a5',trimW:148,trimH:210,bookletPages:8,paperType:'mojo80',bleed:3,safeZone:10}
  });

  let guardBusy=false;
  let booted=false;
  let lastWingMm=DEFAULT_WING_MM;

  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  function checker(){
    try{
      if(typeof PrintChecker!=='undefined')return PrintChecker;
    }catch(_){}
    return window.PrintChecker||null;
  }

  function installStyles(){
    if($('printCheckerDefaultsLiveStyles'))return;
    const style=document.createElement('style');
    style.id='printCheckerDefaultsLiveStyles';
    style.textContent=`
      .pc-size-preset{grid-column:1/-1;border:1px solid #bfdbfe;background:linear-gradient(180deg,#f8fbff,#eff6ff);border-radius:12px;padding:11px 12px;margin-bottom:2px}
      .pc-size-preset .spec-label{margin-bottom:7px}.pc-size-note{display:block;margin-top:6px;font-size:10px;line-height:1.45;color:#64748b;font-weight:700}
      .pc-live-summary{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;margin:0 auto 10px;padding:7px 11px;width:fit-content;max-width:100%;border:1px solid #cbd5e1;border-radius:999px;background:rgba(255,255,255,.92);font-size:10px;font-weight:900;color:#475569;box-shadow:0 5px 15px rgba(15,23,42,.07)}
      .pc-live-summary strong{color:#0f4c81}.pc-default-chip{display:inline-flex;border-radius:999px;background:#dbeafe;color:#1d4ed8;padding:2px 6px;font-size:9px}
      #wingWGroup[data-wing-enabled="1"]{display:block}
      #wingWGroup .pc-wing-label{display:block;margin:0 0 6px;font-size:11px;font-weight:900;color:#334155}
      #wingW:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:620px){.pc-live-summary{border-radius:12px}}
    `;
    document.head.appendChild(style);
  }

  function currentProduct(){return checker()?.getState?.()?.product||null;}
  function renderedSpecReady(){return Boolean($('trimW')&&$('trimH')&&$('bleed')&&$('safeZone'));}

  function optionHtml(selected){
    return Object.entries(SIZE_PRESETS).map(([key,item])=>`<option value="${key}" ${key===selected?'selected':''}>${item.label}</option>`).join('');
  }

  function ensureSizePreset(defaultKey){
    const form=$('specForm');
    if(!form||!renderedSpecReady())return null;
    let select=$('printSizePreset');
    if(select)return select;
    const wrap=document.createElement('div');
    wrap.className='spec-field pc-size-preset';
    wrap.dataset.printSizePreset='1';
    wrap.innerHTML=`<label class="spec-label" for="printSizePreset">완성 사이즈<small class="spec-hint">표준 규격 선택 또는 직접 입력</small></label><select class="spec-input spec-select" id="printSizePreset">${optionHtml(defaultKey)}</select><small class="pc-size-note">규격을 선택하면 폭·높이가 자동 입력되고 오른쪽 미리보기가 즉시 바뀝니다. 폭·높이를 직접 수정하면 자동으로 ‘직접 입력’으로 전환됩니다.</small>`;
    form.prepend(wrap);
    select=$('printSizePreset');
    select?.addEventListener('change',()=>{
      const preset=SIZE_PRESETS[select.value];
      if(!preset||preset.w===null)return;
      $('trimW').value=String(preset.w);
      $('trimH').value=String(preset.h);
      notifyCore();
      updateSummary();
    });
    return select;
  }

  function assign(id,value){
    const node=$(id);
    if(!node||value===undefined||value===null)return;
    if(node.type==='checkbox')node.checked=Boolean(value);
    else node.value=String(value);
  }

  function notifyCore(){
    const form=$('specForm');
    if(!form)return;
    form.dispatchEvent(new Event('input',{bubbles:true}));
    form.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function refreshPreviewDimensions(){
    try{window.PrintCheckerLiveDimensions?.sync?.();}catch(_){}
    try{window.PrintCheckerCoverLiveDimensions?.sync?.();}catch(_){}
  }

  function syncWingControls({focus=false,notify=false}={}){
    const toggle=$('hasWing');
    const group=$('wingWGroup');
    const input=$('wingW');
    if(!toggle||!group||!input)return false;

    const enabled=Boolean(toggle.checked);
    const numeric=Number(input.value);
    if(Number.isFinite(numeric)&&numeric>0)lastWingMm=numeric;
    if(enabled&&input.value==='')input.value=String(lastWingMm||DEFAULT_WING_MM);

    group.hidden=!enabled;
    group.dataset.wingEnabled=enabled?'1':'0';
    group.setAttribute('aria-hidden',enabled?'false':'true');
    input.disabled=!enabled;
    input.setAttribute('aria-disabled',enabled?'false':'true');
    input.setAttribute('aria-label','날개 폭');
    input.placeholder=String(DEFAULT_WING_MM);

    let label=group.querySelector('.pc-wing-label');
    if(!label){
      label=document.createElement('label');
      label.className='pc-wing-label';
      label.htmlFor='wingW';
      label.textContent='날개 폭';
      group.prepend(label);
    }

    document.documentElement.dataset.printCheckerCoverWing=enabled?'enabled':'disabled';
    if(notify)notifyCore();
    refreshPreviewDimensions();
    if(enabled&&focus)requestAnimationFrame(()=>input.focus());
    return true;
  }

  function bindWingControls(){
    const toggle=$('hasWing');
    const input=$('wingW');
    if(!toggle||!input)return false;
    if(toggle.dataset.wingControlsBound!=='1'){
      toggle.dataset.wingControlsBound='1';
      toggle.addEventListener('change',()=>syncWingControls({focus:toggle.checked,notify:true}));
    }
    if(input.dataset.wingControlsBound!=='1'){
      input.dataset.wingControlsBound='1';
      input.addEventListener('input',()=>{
        const value=Number(input.value);
        if(Number.isFinite(value)&&value>0)lastWingMm=value;
        refreshPreviewDimensions();
      });
      input.addEventListener('change',()=>{
        const value=Number(input.value);
        if(Number.isFinite(value)&&value>0)lastWingMm=value;
        notifyCore();
        refreshPreviewDimensions();
      });
    }
    return syncWingControls();
  }

  function matchingPreset(){
    const width=Number($('trimW')?.value||0);
    const height=Number($('trimH')?.value||0);
    const match=Object.entries(SIZE_PRESETS).find(([,item])=>item.w!==null&&Math.abs(item.w-width)<0.01&&Math.abs(item.h-height)<0.01);
    return match?.[0]||'custom';
  }

  function bindManualSize(){
    ['trimW','trimH'].forEach(id=>{
      const node=$(id);
      if(!node||node.dataset.sizePresetBound==='1')return;
      node.dataset.sizePresetBound='1';
      node.addEventListener('input',()=>{
        const preset=$('printSizePreset');
        if(preset)preset.value=matchingPreset();
        updateSummary();
      });
    });
  }

  function ensureSummary(){
    let summary=$('printCheckerLiveSummary');
    if(summary)return summary;
    const canvas=$('previewCanvas');
    const parent=canvas?.parentElement;
    if(!parent)return null;
    summary=document.createElement('div');
    summary.id='printCheckerLiveSummary';
    summary.className='pc-live-summary';
    parent.insertBefore(summary,canvas);
    return summary;
  }

  function updateSummary(){
    if(!renderedSpecReady())return;
    const summary=ensureSummary();
    if(!summary)return;
    const product=currentProduct();
    const width=Number($('trimW')?.value||0);
    const height=Number($('trimH')?.value||0);
    const bleed=Number($('bleed')?.value||0);
    const safe=Number($('safeZone')?.value||0);
    const presetKey=$('printSizePreset')?.value||matchingPreset();
    const presetLabel=SIZE_PRESETS[presetKey]?.label?.split(' · ')[0]||'직접 입력';
    summary.innerHTML=`<span class="pc-default-chip">실시간</span><strong>${presetLabel}</strong><span>${width} × ${height} mm</span><span>도련 ${bleed} mm</span><span>안전 ${safe} mm</span>${product?`<span>${product}</span>`:''}`;
  }

  function seedProduct(product,{force=true}={}){
    const defaults=PRODUCT_DEFAULTS[product];
    const form=$('specForm');
    if(!defaults||!form||!renderedSpecReady())return false;
    const preset=ensureSizePreset(defaults.size);
    if(!preset)return false;
    if(force)preset.value=defaults.size;
    Object.entries(defaults).forEach(([key,value])=>{
      if(key==='size')return;
      const node=$(key);
      if(!node)return;
      if(force||node.value===''||node.value===undefined)assign(key,value);
    });
    const spine=$('spine');
    if(spine)delete spine.dataset.manual;
    bindManualSize();
    bindWingControls();
    notifyCore();
    preset.value=matchingPreset();
    updateSummary();
    refreshPreviewDimensions();
    document.documentElement.dataset.printCheckerDefaultsLive='ready';
    document.documentElement.dataset.printCheckerDefaultProduct=product;
    return true;
  }

  async function waitForCore(timeoutMs=1600){
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      if(checker()?.selectProduct&&document.querySelector('#productGrid .product-card'))return true;
      await sleep(20);
    }
    return false;
  }

  async function ensureRenderedProduct(product,timeoutMs=900){
    const core=checker();
    if(!core?.selectProduct)return false;
    if(currentProduct()!==product||!renderedSpecReady())core.selectProduct(product,{syncUrl:false});
    const deadline=Date.now()+timeoutMs;
    while(Date.now()<deadline){
      if(currentProduct()===product&&renderedSpecReady())return true;
      await sleep(15);
    }
    return currentProduct()===product&&renderedSpecReady();
  }

  async function seedProductAsync(product,{force=true}={}){
    if(!(await ensureRenderedProduct(product)))return false;
    return seedProduct(product,{force});
  }

  async function seedCurrent(force=true){
    const product=currentProduct();
    return product?seedProductAsync(product,{force}):false;
  }

  async function guardedRun(){
    if(guardBusy)return;
    guardBusy=true;
    const button=$('runBtn');
    if(button)button.disabled=true;
    try{
      const quota=window.ProgramPdfDailyFree;
      if(quota){
        const gate=await quota.canStart('print-checker');
        if(!gate.ok){alert(gate.message);return;}
      }
      const ok=checker()?.runCheck?.()===true;
      if(ok&&quota){
        try{await quota.commitSuccess('print-checker');}
        catch(error){console.warn('[print-checker] quota commit failed',error);}
      }
    }finally{
      guardBusy=false;
      if(button)button.disabled=false;
    }
  }

  function bindRunGuard(){
    document.addEventListener('click',event=>{
      const run=event.target.closest?.('#runBtn');
      if(!run)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      guardedRun();
    },true);
  }

  function bindProductAndReset(){
    document.addEventListener('click',event=>{
      if(event.target.closest?.('.product-card'))setTimeout(()=>seedCurrent(true),0);
      if(event.target.closest?.('#resetBtn'))setTimeout(()=>seedProductAsync('flyer',{force:true}),0);
    });
    $('specForm')?.addEventListener('input',updateSummary);
    $('specForm')?.addEventListener('change',updateSummary);
  }

  async function boot(){
    if(booted)return;
    booted=true;
    installStyles();
    bindRunGuard();
    bindProductAndReset();
    if(!(await waitForCore())){
      booted=false;
      console.warn('[print-checker] core did not become ready for default spec seeding');
      return;
    }
    const product=currentProduct()||'flyer';
    if(!(await seedProductAsync(product,{force:true}))){
      booted=false;
      console.warn('[print-checker] default spec fields did not render');
    }
  }

  window.PrintCheckerDefaultsLive=Object.freeze({
    sizePresets:SIZE_PRESETS,
    productDefaults:PRODUCT_DEFAULTS,
    checker,
    renderedSpecReady,
    waitForCore,
    ensureRenderedProduct,
    seedProduct,
    seedProductAsync,
    matchingPreset,
    updateSummary,
    syncWingControls,
    guardedRun,
    stage:'print-checker-defaults-live-v2-safe10-cover-wing'
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{boot();},{once:true});
  else setTimeout(()=>{boot();},0);
})();
