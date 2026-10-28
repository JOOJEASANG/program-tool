// Evaluate the actual cover alignment functions, without browser dependencies.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/ai-design-maker.js','utf8');
const start=source.indexOf('  function alignTextBoxInSurface(textId,mode){');
const end=source.indexOf('  function bindTextCanvasEditing()',start);
assert.ok(start>0&&end>start,'cover alignment helpers must be present');
const functions=source.slice(start,end);
const state={
  selectedTextId:'title',
  textLayouts:{
    title:{dx:0,dy:0,align:'left',boxAlign:''},
    backText:{dx:0,dy:0,align:'left',boxAlign:''},
    'custom:front':{dx:0,dy:0,align:'left',boxAlign:''}
  },
  snapGuide:null,
};
const spec={workW:470,coverMode:'spread'};
const zones={front:{x:233,y:10,w:190,h:275},back:{x:13,y:10,w:190,h:275}};
const defaultBoxes={title:{x:260,w:160,surface:'front'},
  backText:{x:35,w:145,surface:'back'},
  'custom:front':{x:280,w:90,surface:'front'}};
let saves=0,renders=0,ui=0;
const sandbox={
  state,
  currentSpec:()=>spec,
  textSurfaceForId:id=>id==='backText'?'back':'front',
  textLayout:()=>Object.entries(defaultBoxes).map(([id,item])=>({
    id,...item,x:item.x+state.textLayouts[id].dx
  })),
  coverSurfaceRect:surface=>zones[surface],
  textLayoutState:id=>state.textLayouts[id],
  modeHasFront:mode=>mode!=='back',
  modeHasBack:mode=>mode!=='front',
  clamp:(x,lo,hi)=>Math.min(hi,Math.max(lo,x)),
  saveLocal:()=>saves++,
  syncTextEditUi:()=>ui++,
  scheduleRender:()=>renders++,
};
vm.runInNewContext(functions,sandbox);
vm.runInNewContext("alignCoverSideText('front','center')",sandbox);
const frontCenter=zones.front.x+(zones.front.w-defaultBoxes.title.w)/2;
assert.equal(defaultBoxes.title.x+state.textLayouts.title.dx,frontCenter);
assert.equal(state.textLayouts.title.align,'center');
assert.equal(state.textLayouts.title.boxAlign,'center');
assert.equal(state.textLayouts.backText.dx,0,'front alignment must not move back text');
vm.runInNewContext("alignCoverSideText('back','right')",sandbox);
assert.equal(defaultBoxes.backText.x+state.textLayouts.backText.dx,
  zones.back.x+zones.back.w-defaultBoxes.backText.w);
assert.equal(state.textLayouts.backText.align,'right');
assert.equal(defaultBoxes.title.x+state.textLayouts.title.dx,frontCenter,
  'back alignment must not move front title');
state.selectedTextId='custom:front';
vm.runInNewContext("alignSelectedTextBox('left')",sandbox);
assert.equal(defaultBoxes['custom:front'].x+state.textLayouts['custom:front'].dx,
  zones.front.x);
assert.equal(state.textLayouts['custom:front'].align,'left');
spec.coverMode='front';
vm.runInNewContext("alignCoverSideText('back','center')",sandbox);
assert.equal(state.textLayouts.backText.align,'right','hidden back surface must remain unchanged');
assert.equal(saves,3);assert.equal(ui,3);assert.equal(renders,3);
console.log('front/back independent alignment behavior passed');
