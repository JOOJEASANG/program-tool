const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-text-canvas-controls.js'),
  'utf8',
);

const elements = {
  safeMargin: { value: '10' },
  spineDirection: { value: 'bottomToTop' },
};
const document = {
  getElementById(id) { return elements[id] || null; },
  querySelector() { return null; },
  createElement() { return {}; },
  addEventListener() {},
  head: { appendChild() {} },
  documentElement: { dataset: {} },
};
const context = {
  console,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  requestAnimationFrame() { return 0; },
  MutationObserver: function MutationObserver() {},
  ResizeObserver: function ResizeObserver() {},
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  Math,
  JSON,
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'cover-text-canvas-controls.js' });

const api = context.CoverTextCanvasControls;
assert.equal(api.stage, 'direct-text-move-resize-align-magnetic-snap');

const snap = api.snapAxis(
  90,
  [{ name: 'center', value: 90 }],
  [{ value: 100, label: '중앙' }, { value: 140, label: '오른쪽' }],
  12,
);
assert.equal(snap.anchor, 100);
assert.equal(snap.target.label, '중앙');
assert.equal(
  api.snapAxis(90, [{ name: 'center', value: 90 }], [{ value: 120 }], 5).anchor,
  90,
);

const front = { id: 'front-1', side: 'front', zone: 'center', text: '앞표지 제목', size: 24, x: 50, y: 50, scale: 100 };
const spineVertical = { id: 'spine-v', side: 'spine', zone: 'center', text: '세로', size: 11, x: 50, y: 45, scale: 100, direction: 'vertical', color: '#fff' };
const spineRotated = { id: 'spine-r', side: 'spine', zone: 'bottom', text: '회전', size: 10, x: 72, y: 78, scale: 100, direction: 'topToBottom', color: '#fff' };
const data = {
  front: { top: [], center: [front], bottom: [] },
  spine: { top: [], center: [spineVertical], bottom: [spineRotated] },
  back: { top: [], center: [], bottom: [] },
};
const items = [front, spineVertical, spineRotated];
context.CoverTextZones = {
  data,
  allItems() { return items; },
  findItem(id) { return items.find((entry) => entry.id === id) || null; },
  save() {},
  select() {},
};
context.state = {
  active: front.id,
  layout: {
    [front.id]: { x: 50, y: 50, scale: 100 },
    [spineVertical.id]: { x: 50, y: 45, scale: 100 },
    [spineRotated.id]: { x: 72, y: 78, scale: 100 },
  },
  hitBoxes: {
    [front.id]: { x: 3120, y: 1490, w: 200, h: 50 },
  },
};
context.getSpec = () => ({ totalW: 430, totalH: 303, bleed: 3, trimW: 210, trimH: 297, spine: 4 });

const canvas = {
  id: 'previewCanvas',
  width: 4300,
  height: 3030,
  getBoundingClientRect() { return { left: 0, top: 0, width: 860, height: 606 }; },
};
const geo = api.geometry(canvas);
assert.equal(Math.round(geo.panels.front.w), 2100);
assert.equal(Math.round(geo.panels.spine.w), 40);

const aligned = api.alignmentLayout(front, 'x', 'center', geo);
assert.ok(Math.abs(aligned.x - 50) < 0.001);
api.alignmentLayout(front, 'y', 'start', geo);
assert.ok(aligned.y < 20, 'top alignment should move the text near the safe margin');

const originalCenter = data.spine.center;
const originalBottom = data.spine.bottom;
const hiddenResult = api.withoutSpineEntries(() => {
  assert.equal(data.spine.center.length, 0);
  assert.equal(data.spine.bottom.length, 0);
  return 'hidden';
});
assert.equal(hiddenResult, 'hidden');
assert.equal(data.spine.center, originalCenter);
assert.equal(data.spine.bottom, originalBottom);

const calls = { rotations: [], texts: [] };
const drawingContext = {
  save() {},
  restore() {},
  translate() {},
  rotate(value) { calls.rotations.push(value); },
  fillText(text, x, y, maxWidth) { calls.texts.push({ text, x, y, maxWidth }); },
  measureText(text) { return { width: String(text).length * 18 }; },
  fillStyle: '',
  textAlign: '',
  textBaseline: '',
  font: '',
};
canvas.getContext = () => drawingContext;
const count = api.drawSpineEntries(canvas, 72);
assert.equal(count, 2);
assert.ok(calls.texts.some((call) => call.text === '세'));
assert.ok(calls.texts.some((call) => call.text === '로'));
assert.ok(calls.texts.some((call) => call.text === '회전'));
assert.ok(calls.rotations.some((value) => Math.abs(value - Math.PI / 2) < 1e-9));
assert.ok(context.state.hitBoxes[spineVertical.id]);
assert.ok(context.state.hitBoxes[spineRotated.id]);

const spinePanel = geo.panels.spine;
const rotatedBox = context.state.hitBoxes[spineRotated.id];
const rotatedCenterX = rotatedBox.x + rotatedBox.w / 2;
const expectedX = spinePanel.x + spinePanel.w * 0.72;
assert.ok(Math.abs(rotatedCenterX - expectedX) < 0.001, 'spine horizontal movement must affect rendering');

console.log('cover-text-canvas-controls behavior passed');
