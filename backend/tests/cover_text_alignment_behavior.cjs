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
// Exercise the actual snap helper with a long Korean title. Its invisible
// layout box is wider than the purple visible selection rectangle.
const snapStart=source.indexOf('  function snapTextDrag(bounds,zone,rawDx,rawDy,threshold){');
const snapEnd=source.indexOf('  function bindTextCanvasEditing()',snapStart);
assert.ok(snapStart>0&&snapEnd>snapStart,'snapTextDrag helper must exist');
const snapSandbox={};
vm.runInNewContext(source.slice(snapStart,snapEnd),snapSandbox);
const snap=(bounds,zone,dx,dy)=>vm.runInNewContext(
  'snapTextDrag('+JSON.stringify(bounds)+','+JSON.stringify(zone)+','+dx+','+dy+',9)',
  snapSandbox
);
const frontZone={x:783,y:52,w:632,h:922};
const frontText={x:840,y:480,w:356,h:62}; // selection center 1018, page center 1099
const snappedFront=snap(frontText,frontZone,76,0);
assert.equal(snappedFront.dx,81);
assert.equal(frontText.x+frontText.w/2+snappedFront.dx,1099,
  'visible selection center, not an invisible box center, must match cover center');
assert.equal(snappedFront.guide.centerX,1099);
assert.equal(snappedFront.guide.snapX,true);
assert.equal(snappedFront.dy,0);
assert.equal(snappedFront.guide.snapY,false);
// A right edge passing near the cover center must NOT trigger center snapping.
const wrongEdgeNearCenter=snap(frontText,frontZone,-96,0);
assert.equal(wrongEdgeNearCenter.guide,null,
  'center guide must never be triggered by a text edge');
const backZone={x:50,y:52,w:633,h:922};
const backText={x:210,y:460,w:280,h:70};
const snappedBack=snap(backText,backZone,-20,0);
assert.equal(snappedBack.dx,backZone.x+backZone.w/2-(backText.x+backText.w/2));
assert.equal(snappedBack.guide.centerX,366.5);
// Left/right alignment guides refer to the actual cover margins, not the center.
const leftAligned=snap(frontText,frontZone,-51,0);
assert.equal(leftAligned.guide.snapX,true);
assert.equal(leftAligned.guide.centerX,frontZone.x);
const yOnly=snap(frontText,frontZone,0,22);
assert.equal(yOnly.guide?.snapX||false,false);
assert.equal(yOnly.guide?.snapY||false,false);
const noZone=snap(frontText,null,13,-4);
assert.equal(noZone.dx,13);
assert.equal(noZone.dy,-4);
assert.equal(noZone.guide,null);
assert.ok(!source.includes('layout.align=xSnap.align'),
  'drag snapping must not change existing glyph alignment');
console.log('cover visible-text snap behavior passed');

console.log('front/back independent alignment behavior passed');
