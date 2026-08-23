(function(root){
  'use strict';
  if(root.__designEditorCoverSettingsV1)return;
  root.__designEditorCoverSettingsV1=true;

  const params=new URLSearchParams(location.search);
  const path=location.pathname.replace(/\/+$/,'')||'/';
  const embedded=params.get('embed')==='1';
  const coverRequested=params.get('mode')==='cover'||params.get('preset')==='cover-a4';
  const validPath=path==='/design-editor/general'||path==='/design-editor/general.html'||path==='/design-editor/index.html'||path.endsWith('/design-editor/general.html')||path.endsWith('/design-editor/index.html');
  if(!embedded||!coverRequested||!validPath)return;

  const CARD_ID='designCoverSettingsTools';
  const STYLE_ID='designCoverSettingsStyles';
  const PAPER_SIZES=Object.freeze({
    a4:{label:'A4 · 210×297',width:210,height:297},
    'b5-jis':{label:'B5 JIS · 182×257',width:182,height:257},
    'b5-iso':{label:'B5 ISO · 176×250',width:176,height:250},
    a5:{label:'A5 · 148×210',width:148,height:210},
    custom:{label:'직접 입력',width:null,height:null}
  });
  let installed=false;
  let updateTimer=0;

  const $=id=>document.getElementById(id);
  const number=(id,fallback)=>{const value=Number($(id)?.value);return Number.isFinite(value)?value:fallback;};

  function project(){return root.DesignEditorApp?.project||null;}
  function isCoverProject(){return project()?.designMode==='cover'&&project()?.presetId==='cover-a4';}

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${CARD_ID}{order:-9}.cover-settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.cover-settings-field{min-width:0}.cover-settings-field.full{grid-column:1/-1}.cover-settings-field label{display:block;margin:0 0 3px;color:#64748b;font-size:7px;font-weight:900}.cover-settings-field input,.cover-settings-field select{width:100%;min-width:0;border:1px solid #cfd8e3;border-radius:7px;background:#fff;padding:6px 7px;color:#344054;font-size:8px}.cover-settings-check{display:flex;align-items:center;gap:5px;margin:7px 0;color:#475569;font-size:7.5px;font-weight:850}.cover-settings-check input{accent-color:#12396d}.cover-settings-readout{margin-top:8px;border:1px solid #dbe7ee;border-radius:8px;background:#f7fbfd;padding:8px;color:#475569;font-size:7.5px;line-height:1.55}.cover-settings-readout strong{display:block;color:#12396d;font-size:9px}.cover-settings-apply{width:100%;margin-top:7px;border:0;border-radius:8px;background:#12396d;color:#fff;padding:8px;font-size:8px;font-weight:950;cursor:pointer}.cover-settings-note{margin-top:6px;color:#8793a1;font-size:6.8px;line-height:1.45}.cover-settings-manual.disabled{opacity:.45;pointer-events:none}
    `;
    document.head.appendChild(style);
  }

  function detectPaper(width,height){
    for(const [id,size] of Object.entries(PAPER_SIZES)){
      if(id==='custom')continue;
      if(Math.abs(width-size.width)<.05&&Math.abs(height-size.height)<.05)return id;
    }
    return'custom';
  }

  function settingsFromInputs(){
    const current=project()?.cover||root.DesignEditorCoverModel?.DEFAULTS||{};
    return{
      trimWidth:number('coverTrimWidth',current.trimWidth||210),
      trimHeight:number('coverTrimHeight',current.trimHeight||297),
      bleed:number('coverBleed',current.bleed||3),
      safe:number('coverSafe',current.safe||10),
      pageCount:number('coverPageCount',current.pageCount||160),
      paperCaliper:number('coverPaperCaliper',current.paperCaliper||0.1),
      bindingAdjust:number('coverBindingAdjust',current.bindingAdjust||0.5),
      manualSpine:Boolean($('coverManualSpine')?.checked),
      spineManual:number('coverSpineManual',current.spineManual||8.5),
      spineDirection:current.spineDirection||'bottomToTop'
    };
  }

  function updateReadout(config=null){
    const model=root.DesignEditorCoverModel;if(!model)return;
    const spec=model.makeSpec(config||settingsFromInputs());
    const output=$('coverSettingsReadout');
    if(output){
      output.innerHTML=`<strong>책등 ${spec.spine.toFixed(1)}mm · 펼침 ${spec.spreadWidth.toFixed(1)}×${spec.trimHeight.toFixed(1)}mm</strong>출력 전체 ${spec.totalWidth.toFixed(1)}×${spec.totalHeight.toFixed(1)}mm · 뒤표지 ${spec.trimWidth.toFixed(1)}mm / 앞표지 ${spec.trimWidth.toFixed(1)}mm`;
    }
    const manual=$('coverSpineManualWrap');
    manual?.classList.toggle('disabled',!$('coverManualSpine')?.checked);
    return spec;
  }

  function syncMeta(projectValue){
    const title=$('documentTitle');
    const meta=$('documentMeta');
    if(title)title.textContent='무선제본 전체 표지';
    if(meta)meta.textContent=`${projectValue.width} × ${projectValue.height}mm · 책등 ${Number(projectValue.cover?.spine||0).toFixed(1)}mm · 재단 ${projectValue.bleed}mm`;
    const readonly=$('inspector')?.querySelector('.readonly-value');
    if(readonly)readonly.textContent=`${projectValue.width} × ${projectValue.height}mm`;
  }

  function refreshCommonEditor(){
    const current=project();if(!current)return;
    syncMeta(current);
    root.dispatchEvent(new Event('resize'));
    root.DesignEditorSimpleInterface?.sync?.();
  }

  function applySettings(source='cover-settings'){
    const current=project();
    const model=root.DesignEditorCoverModel;
    if(!current||!model||!isCoverProject())return null;
    const elements=current.surfaces?.[0]?.elements||[];
    const extras=current.surfaces?.[0]?.extras||[];
    const elementIds=elements.map(item=>item.id).join('|');
    const extraIds=extras.map(item=>item.id).join('|');
    const spec=model.applyToProject(current,settingsFromInputs())?.cover;
    if(!spec)return null;
    const afterElements=current.surfaces?.[0]?.elements||[];
    const afterExtras=current.surfaces?.[0]?.extras||[];
    if(afterElements.map(item=>item.id).join('|')!==elementIds||afterExtras.map(item=>item.id).join('|')!==extraIds){
      throw new Error('표지 규격 변경 중 편집 요소 보존 계약이 깨졌습니다.');
    }
    updateReadout(spec);
    refreshCommonEditor();
    root.DesignEditorDraftScope?.saveCurrent?.(source);
    const status=$('editorStatus');
    if(status){status.className='editor-status ok';status.textContent=`표지 규격 적용 · 책등 ${spec.spine.toFixed(1)}mm · 펼침 ${spec.spreadWidth.toFixed(1)}×${spec.trimHeight.toFixed(1)}mm`;}
    try{root.dispatchEvent(new CustomEvent('programstudio:cover-geometry-change',{detail:{...spec}}));}catch(_){}
    return spec;
  }

  function queueReadout(){
    clearTimeout(updateTimer);
    updateTimer=setTimeout(()=>updateReadout(),80);
  }

  function syncFields(){
    const current=project()?.cover;if(!current)return false;
    $('coverPaperPreset').value=detectPaper(current.trimWidth,current.trimHeight);
    $('coverTrimWidth').value=String(current.trimWidth);
    $('coverTrimHeight').value=String(current.trimHeight);
    $('coverBleed').value=String(current.bleed);
    $('coverSafe').value=String(current.safe);
    $('coverPageCount').value=String(current.pageCount);
    $('coverPaperCaliper').value=String(current.paperCaliper);
    $('coverBindingAdjust').value=String(current.bindingAdjust);
    $('coverManualSpine').checked=Boolean(current.manualSpine);
    $('coverSpineManual').value=String(current.spineManual);
    updateReadout(current);
    return true;
  }

  function bind(){
    $('coverPaperPreset')?.addEventListener('change',event=>{
      const size=PAPER_SIZES[event.target.value];
      if(size?.width){$('coverTrimWidth').value=String(size.width);$('coverTrimHeight').value=String(size.height);}
      queueReadout();
    });
    ['coverTrimWidth','coverTrimHeight','coverBleed','coverSafe','coverPageCount','coverPaperCaliper','coverBindingAdjust','coverSpineManual'].forEach(id=>$(id)?.addEventListener('input',queueReadout));
    $('coverManualSpine')?.addEventListener('change',queueReadout);
    $('coverSettingsApply')?.addEventListener('click',()=>applySettings());
  }

  function install(){
    if(installed)return true;
    if(!isCoverProject()||!root.DesignEditorCoverModel)return false;
    const sidebar=document.querySelector('.sidebar');if(!sidebar)return false;
    installStyles();
    const card=document.createElement('section');
    card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`
      <div class="side-label">표지 규격 · 책등</div>
      <div class="cover-settings-grid">
        <div class="cover-settings-field full"><label for="coverPaperPreset">완성 규격</label><select id="coverPaperPreset">${Object.entries(PAPER_SIZES).map(([id,size])=>`<option value="${id}">${size.label}</option>`).join('')}</select></div>
        <div class="cover-settings-field"><label for="coverTrimWidth">가로 mm</label><input id="coverTrimWidth" type="number" min="80" max="300" step="0.1"></div>
        <div class="cover-settings-field"><label for="coverTrimHeight">세로 mm</label><input id="coverTrimHeight" type="number" min="100" max="450" step="0.1"></div>
        <div class="cover-settings-field"><label for="coverBleed">도련 mm</label><input id="coverBleed" type="number" min="0" max="10" step="0.5"></div>
        <div class="cover-settings-field"><label for="coverSafe">안전여백 mm</label><input id="coverSafe" type="number" min="3" max="30" step="1"></div>
        <div class="cover-settings-field"><label for="coverPageCount">본문 페이지 수</label><input id="coverPageCount" type="number" min="2" max="3000" step="2"></div>
        <div class="cover-settings-field"><label for="coverPaperCaliper">종이 두께 mm</label><input id="coverPaperCaliper" type="number" min="0.01" max="1" step="0.01" list="coverCalipers"><datalist id="coverCalipers"><option value="0.08"><option value="0.09"><option value="0.10"><option value="0.12"><option value="0.15"></datalist></div>
        <div class="cover-settings-field full"><label for="coverBindingAdjust">제본 보정 mm</label><input id="coverBindingAdjust" type="number" min="0" max="20" step="0.1"></div>
      </div>
      <label class="cover-settings-check"><input id="coverManualSpine" type="checkbox"> 책등 폭 직접 입력</label>
      <div id="coverSpineManualWrap" class="cover-settings-field cover-settings-manual"><label for="coverSpineManual">직접 책등 mm</label><input id="coverSpineManual" type="number" min="0" max="100" step="0.1"></div>
      <div id="coverSettingsReadout" class="cover-settings-readout"></div>
      <button id="coverSettingsApply" class="cover-settings-apply" type="button">표지 규격 적용</button>
      <div class="cover-settings-note">규격과 책등을 바꿔도 현재 글자·이미지·도형은 삭제하지 않습니다. 기존 표지 프로그램은 호환 완료 전까지 유지됩니다.</div>`;
    const modeCard=$('designEmbeddedModeCard');
    if(modeCard?.parentElement===sidebar)modeCard.insertAdjacentElement('afterend',card);else sidebar.prepend(card);
    installed=true;bind();syncFields();
    root.DesignEditorCoverSettings={applySettings,syncFields,updateReadout,stage:'cover-geometry-settings-on-common-editor'};
    return true;
  }

  function boot(){
    if(install())return;
    [80,180,360,700,1200,2200,3600].forEach(delay=>setTimeout(install,delay));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
