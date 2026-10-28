/* Print design's four product-specific workspaces and book spine calculator. */
'use strict';
(() => {
  if (window.DesignWorkshopModes) return;
  const $ = id => document.getElementById(id);
  const tabs = {
    cover:{name:'책표지',mode:'spread',size:null,description:'앞표지·책등·뒷표지·날개'},
    flyer:{name:'전단지',mode:'front',size:[210,297],description:'A4/A5 전단지 단면 또는 양면'},
    invitation:{name:'초대장',mode:'frontBack',size:[148,210],description:'접이식 초대장 앞·뒤 디자인'},
    leaflet:{name:'리플렛',mode:'spread',size:[99,210],description:'3단 접지 6면 · 펼침 한 면(3패널)'}
  };
  function normalizeMode(studio, mode) {
    const product = tabs[studio] ? studio : 'cover';
    if (product === 'leaflet') return 'spread';
    if (product === 'flyer' || product === 'invitation') {
      return ['front', 'back', 'frontBack'].includes(mode) ? mode : tabs[product].mode;
    }
    return ['front', 'back', 'frontBack', 'spread'].includes(mode) ? mode : 'spread';
  }
  let ctx = null;
  let attached = false;
  function recalc() {
    const pages = Number($('spinePages')?.value);
    const thickness = Number($('spineSheetThickness')?.value);
    const allowance = Number($('spineAllowance')?.value);
    const output = $('spineCalcResult');
    if (!Number.isSafeInteger(pages) || pages<2 || pages>20000 || pages%2!==0 ||
        !Number.isFinite(thickness) || thickness<0.01 || thickness>0.5 ||
        !Number.isFinite(allowance) || allowance<0 || allowance>20) {
      if(output)output.textContent='짝수 페이지(2~20000), 종이 두께(0.01~0.5mm), 제본 보정(0~20mm)을 확인하세요.';
      return false;
    }
    const width = Math.round(((pages/2)*thickness+allowance)*10)/10;
    if(width>100) {
      if(output)output.textContent='계산값이 100mm를 초과합니다. 종이 두께와 페이지 수를 확인하세요.';
      return false;
    }
    if($('spine'))$('spine').value=width.toFixed(1);
    if(output)output.textContent=pages+'p ÷ 2 × '+thickness.toFixed(3)+'mm + '+allowance.toFixed(1)+'mm = '+width.toFixed(1)+'mm';
    return true;
  }
  const manual = () => document.querySelector('input[name="spineCalcMode"]:checked')?.value === 'manual';
  function refresh() {
    if(!ctx)return;
    const cover=ctx.studio==='cover';
    if($('spineCalculator'))$('spineCalculator').hidden=!cover;
    if($('spineField'))$('spineField').hidden=!cover;
    if($('spineCalcFields'))$('spineCalcFields').hidden=manual();
    if($('spine'))$('spine').readOnly=cover&&!manual();
    if(cover&&!manual())recalc();
    ctx.updateGeometry?.();
    ctx.scheduleRender?.();
  }
  function change() {
    if(!ctx)return;
    refresh();
    ctx.saveLocal?.();
  }
  function setup(options) {
    if(attached)return;
    ctx=options;attached=true;
    const studio=tabs[ctx.studio] ? ctx.studio : 'cover';
    const config=tabs[studio];
    document.documentElement.dataset.designStudio=studio;
    // A trifold always edits all three panels, so the book-cover scope picker
    // is redundant. Outside/inside navigation is the only surface selector.
    if($('coverScopeCard'))$('coverScopeCard').hidden=studio==='leaflet';
    // Use a product-valid scope before the first canvas render, including restored sessions.
    ctx.state.coverMode=normalizeMode(studio,ctx.hasSavedWorkspace?ctx.state.coverMode:config.mode);
    document.querySelectorAll('[data-studio]').forEach(button=>{
      const chosen=button.dataset.studio===studio;
      button.classList.toggle('active',chosen);
      if(chosen)button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      button.addEventListener('click',()=>{
        if(button.dataset.studio!==studio)window.location.assign('/ai-design-maker/?studio='+button.dataset.studio);
      });
    });
    if(studio!=='cover'){
      // The pre-existing print/editor engines remain shared, but product presets,
      // tools and saved settings differ by workspace.
      if(!ctx.hasSavedWorkspace)ctx.state.sizeMode='custom';
      if(!ctx.hasSavedWorkspace&&config.size&&$('trimW')&&$('trimH')) {
        $('trimW').value=config.size[0];$('trimH').value=config.size[1];
      }
      if($('wingEnabled'))$('wingEnabled').checked=false;
      if($('wingToggleRow'))$('wingToggleRow').hidden=true;
      if($('spineFields'))$('spineFields').hidden=true;
      if($('spineSync'))$('spineSync').checked=false;
      const heading=$('coverScopeTitle');if(heading)heading.textContent=config.name+' 작업 범위';
      const prompt=$('additionalPrompt');
      if(prompt&&!prompt.value)prompt.value={
        flyer:'홍보용 전단지에 맞는 전문적인 배경을 만들고 제목과 행사 정보를 넣을 공간을 남겨 주세요.',
        invitation:'초대장에 맞는 세련된 카드 디자인으로 시선을 끄는 제목 공간을 확보해 주세요.',
        leaflet:'3단 리플렛을 위한 가로 연결형 배경입니다. 각 패널마다 개별 문구를 넣을 공간을 확보하고 접지 경계에서 중요한 오브젝트를 피하세요.'
      }[studio];
      const intro=$('coverModeDescription');if(intro)intro.textContent=config.description;
      const modes=document.querySelectorAll('input[name="coverMode"]');
      const labels={flyer:['앞면 디자인','뒷면 디자인','양면 디자인','전체 펼침'],invitation:['초대장 겉면','초대장 안쪽','초대장 양면','전체 펼침'],leaflet:['1번 패널','3번 패널','양면','3단 펼침']};
      modes.forEach((node,index)=>{
        node.disabled=studio==='leaflet'&&node.value!=='spread'||(studio!=='leaflet'&&node.value==='spread');
        const label=node.closest('label');
        if(label&&studio==='leaflet')label.hidden=node.value!=='spread';
        const strong=label?.querySelector('strong');if(strong)strong.textContent=labels[studio][index];
      });
      // Leaflet uses three equal panels; inside and outside have separate session state.
      if(studio==='leaflet'){
        if($('spineFields'))$('spineFields').hidden=true;
        const side=new URLSearchParams(location.search).get('side')==='inside'?'inside':'outside';
        const picker=$('leafletSidePicker');
        if(picker)picker.hidden=false;
        document.querySelectorAll('[data-leaflet-side]').forEach(link=>{
          const active=link.dataset.leafletSide===side;
          link.classList.toggle('active',active);
          if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
        });
        const target=$('designLayerTarget');
        if(target){
          const names={back:'왼쪽 패널',spine:'가운데 패널',front:'오른쪽 패널',whole:'전체 펼침'};
          Array.from(target.options).forEach(option=>{if(names[option.value])option.textContent=names[option.value];});
        }
        if($('coverModeDescription'))$('coverModeDescription').textContent='3단 리플렛 '+(side==='inside'?'안쪽면':'겉면')+' · 가로 3패널(각 99mm 기본) · 두 면을 각각 출력하세요.';
        const hint=$('geometryHint');
        if(hint)hint.title='3단 접지: 왼쪽/가운데/오른쪽 세 패널입니다. 제조사 접지 공차는 인쇄 전 반드시 확인하세요.';
      }
    }
    if($('coverModeHeading'))$('coverModeHeading').textContent=config.name+' 제작';
    if($('spineCalculator'))$('spineCalculator').hidden=studio!=='cover';
    if($('spineField'))$('spineField').hidden=studio!=='cover';
    document.querySelectorAll('input[name="spineCalcMode"]').forEach(input=>input.addEventListener('change',change));
    ['spinePages','spineSheetThickness','spineAllowance'].forEach(id=>$(id)?.addEventListener('input',()=>{
      if(manual())return;
      // Invalid values do not replace the previous physical thickness.
      if(recalc())change();
    }));
    refresh();
  }
  window.DesignWorkshopModes={setup,refresh,recalc,normalizeMode};
})();