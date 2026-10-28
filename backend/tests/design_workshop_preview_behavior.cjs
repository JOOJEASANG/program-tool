const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('js/design-workshop-modes.js','utf8');

function mount(mode){
  const values={};
  for(const id of [
    'spineCalculator','spineField','spineCalcFields','spine','spinePages',
    'spineSheetThickness','spineAllowance','spineCalcResult','coverScopeCard'
  ])values[id]={value:'',hidden:false,checked:false,addEventListener(){}};
  Object.assign(values.spinePages,{value:'200'});
  Object.assign(values.spineSheetThickness,{value:'0.10'});
  Object.assign(values.spineAllowance,{value:'0'});
  let redraw=0, geometries=0;
  const doc={
    documentElement:{dataset:{}},
    getElementById:id=>values[id]||null,
    querySelector:()=>({value:'auto'}),
    querySelectorAll:()=>[],
  };
  const host={window:{},document:doc};
  vm.runInNewContext(code,host);
  const api=host.window.DesignWorkshopModes;
  const state={coverMode:mode};
  api.setup({state,studio:'leaflet',scheduleRender:()=>redraw++,updateGeometry:()=>geometries++});
  assert.equal(doc.documentElement.dataset.designStudio,'cover');
  assert.equal(values.coverScopeCard.hidden,false);
  assert.equal(values.spineCalculator.hidden,false);
  assert.equal(values.spine.readOnly,true);
  assert.ok(redraw>0&&geometries>0);
  assert.equal(values.spine.value,'10.0');
  return {api,state,values};
}
for(const mode of ['front','back','frontBack','spread']){
  const {state}=mount(mode);
  assert.equal(state.coverMode,mode,'cover modes remain functional');
}
const invalid=mount('not-a-cover-mode');
assert.equal(invalid.state.coverMode,'spread');
assert.equal(invalid.api.normalizeMode('flyer','front'),'front');
assert.equal(invalid.api.normalizeMode('leaflet','nonsense'),'spread');
console.log('cover-only design studio behavior passed');
