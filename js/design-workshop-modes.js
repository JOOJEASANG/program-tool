/* Cover-only print design workspace and physical book-spine calculator. */
'use strict';
(() => {
  if(window.DesignWorkshopModes)return;
  const $=id=>document.getElementById(id);
  const COVER_MODES=new Set(['front','back','frontBack','spread']);
  const normalizeMode=(_studio,mode)=>COVER_MODES.has(mode)?mode:'spread';
  let ctx=null;
  let attached=false;

  function recalc(){
    const pages=Number($('spinePages')?.value);
    const thickness=Number($('spineSheetThickness')?.value);
    const allowance=Number($('spineAllowance')?.value);
    const output=$('spineCalcResult');
    if(!Number.isSafeInteger(pages)||pages<2||pages>20000||pages%2!==0||
       !Number.isFinite(thickness)||thickness<0.01||thickness>0.5||
       !Number.isFinite(allowance)||allowance<0||allowance>20){
      if(output)output.textContent='짝수 페이지(2~20000), 종이 두께(0.01~0.5mm), 제본 보정(0~20mm)을 확인하세요.';
      return false;
    }
    const width = Math.round(((pages/2)*thickness+allowance)*10)/10;
    if(width>100){
      if(output)output.textContent='계산값이 100mm를 초과합니다. 종이 두께와 페이지 수를 확인하세요.';
      return false;
    }
    if($('spine'))$('spine').value=width.toFixed(1);
    if(output)output.textContent=pages+'p ÷ 2 × '+thickness.toFixed(3)+'mm + '+allowance.toFixed(1)+'mm = '+width.toFixed(1)+'mm';
    return true;
  }

  const manual=()=>document.querySelector('input[name="spineCalcMode"]:checked')?.value==='manual';

  function refresh(){
    if(!ctx)return;
    if($('spineCalculator'))$('spineCalculator').hidden=false;
    if($('spineField'))$('spineField').hidden=false;
    if($('spineCalcFields'))$('spineCalcFields').hidden=manual();
    if($('spine'))$('spine').readOnly=!manual();
    if(!manual())recalc();
    ctx.updateGeometry?.();
    ctx.scheduleRender?.();
  }

  function change(){
    if(!ctx)return;
    refresh();
    ctx.saveLocal?.();
  }

  function setup(options){
    if(attached)return;
    ctx=options;attached=true;
    document.documentElement.dataset.designStudio='cover';
    ctx.state.coverMode=normalizeMode('cover',ctx.state.coverMode);
    if($('coverScopeCard'))$('coverScopeCard').hidden=false;
    document.querySelectorAll('input[name="spineCalcMode"]').forEach(input=>input.addEventListener('change',change));
    ['spinePages','spineSheetThickness','spineAllowance'].forEach(id=>$(id)?.addEventListener('input',()=>{
      if(manual())return;
      if(recalc())change();
    }));
    refresh();
  }

  window.DesignWorkshopModes={setup,refresh,recalc,normalizeMode};
})();
