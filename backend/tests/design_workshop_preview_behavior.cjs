const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/design-workshop-modes.js', 'utf8');
const modes = ['front', 'back', 'frontBack', 'spread'];

function boot(studio, savedMode, hasSavedWorkspace = true) {
  const controls = Object.fromEntries([
    'spineCalculator', 'spineField', 'spineCalcFields', 'spine',
    'spinePages', 'spineSheetThickness', 'spineAllowance', 'spineCalcResult',
    'wingEnabled', 'wingToggleRow', 'spineFields', 'spineSync', 'trimW', 'trimH',
    'coverScopeCard', 'coverScopeTitle', 'coverModeDescription', 'coverModeHeading', 'leafletSidePicker',
    'geometryHint', 'additionalPrompt', 'designLayerTarget'
  ].map(id => [id, { value: '', hidden: false, checked: false, textContent: '', addEventListener() {} }]));
  controls.spinePages.value = '200';
  controls.spineSheetThickness.value = '0.10';
  controls.spineAllowance.value = '0';
  controls.trimW.value = '210';
  controls.trimH.value = '297';
  controls.designLayerTarget.options = [];
  const radios = modes.map(value => {
    const strong = { textContent: '' }, label = { hidden: false, querySelector: () => strong };
    return { value, disabled: false, checked: value === 'spread', closest: () => label, label };
  });
  const tabs = ['cover','flyer','invitation','leaflet'].map(value => ({
    dataset: { studio:value }, classList: { toggle() {} }, setAttribute() {}, removeAttribute() {},
    addEventListener() {}
  }));
  const document = {
    documentElement: { dataset: {} },
    getElementById: id => controls[id] || null,
    querySelector: () => ({ value: 'auto' }),
    querySelectorAll: query => query === '[data-studio]' ? tabs
      : query === 'input[name="coverMode"]' ? radios : []
  };
  const window = {};
  const sandbox = { window, document, URLSearchParams, location: { search:'?side=outside' } };
  vm.runInNewContext(source, sandbox);
  const modeApi = window.DesignWorkshopModes;
  let updated = 0, rendered = 0;
  const state = {coverMode:savedMode,sizeMode:'a4'};
  modeApi.setup({
    studio, state, hasSavedWorkspace, updateGeometry:()=>updated++,
    scheduleRender:()=>rendered++,saveLocal(){}
  });
  assert.ok(updated > 0, 'first geometry update must run');
  assert.ok(rendered > 0, 'first preview render must be scheduled');
  assert.equal(document.documentElement.dataset.designStudio, studio);
  return {state, controls, radios, modeApi};
}

assert.equal(boot('cover','back').state.coverMode,'back');
assert.equal(boot('flyer','spread').state.coverMode,'front');
assert.equal(boot('flyer','back').state.coverMode,'back');
assert.equal(boot('invitation','spread').state.coverMode,'frontBack');
assert.equal(boot('invitation','frontBack').state.coverMode,'frontBack');
assert.equal(boot('leaflet','front').state.coverMode,'spread');
const flyer=boot('flyer','spread',false);
assert.equal(flyer.state.coverMode,'front');
assert.equal(flyer.controls.coverScopeCard.hidden,false);
assert.equal(flyer.controls.trimW.value,210);
assert.equal(flyer.controls.trimH.value,297);
const invitation=boot('invitation','spread',false);
assert.equal(invitation.state.coverMode,'frontBack');
assert.equal(invitation.controls.trimW.value,148);
assert.equal(invitation.controls.trimH.value,210);
assert.equal(invitation.radios.find(x=>x.value==='spread').disabled,true);
const leaflet=boot('leaflet','front',false);
assert.equal(leaflet.state.coverMode,'spread');
assert.equal(leaflet.controls.coverScopeCard.hidden,true);
assert.equal(leaflet.controls.leafletSidePicker.hidden,false);
assert.equal(leaflet.controls.trimW.value,99);
assert.equal(leaflet.controls.trimH.value,210);
assert.equal(leaflet.radios.find(x=>x.value==='spread').disabled,false);
assert.equal(leaflet.radios.find(x=>x.value==='front').disabled,true);
console.log('design workshop preview behavior passed');
