const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/design-workshop-modes.js','utf8');
const controls={
  spinePages:{value:'200'},spineSheetThickness:{value:'0.10'},
  spineAllowance:{value:'0'},spine:{value:'10'},
  spineCalcResult:{textContent:''}
};
const document={
  getElementById:id=>controls[id]||null,
  querySelector:()=>({value:'auto'}),
  querySelectorAll:()=>[]
};
const window={};
const sandbox={window,document,URLSearchParams,location:{search:''}};
vm.runInNewContext(source,sandbox);
const calc=window.DesignWorkshopModes.recalc;
assert.equal(calc(),true);assert.equal(controls.spine.value,'10.0');
controls.spinePages.value='250';assert.equal(calc(),true);assert.equal(controls.spine.value,'12.5');
controls.spineAllowance.value='0.5';assert.equal(calc(),true);assert.equal(controls.spine.value,'13.0');
controls.spinePages.value='251';assert.equal(calc(),false);assert.equal(controls.spine.value,'13.0');
controls.spinePages.value='200';controls.spineSheetThickness.value='0.15';controls.spineAllowance.value='0';
assert.equal(calc(),true);assert.equal(controls.spine.value,'15.0');
console.log('calculator behavior passed');
