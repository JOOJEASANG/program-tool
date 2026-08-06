const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-spine-orientation-controls.js'),
  'utf8',
);

const elements = {
  spineDirection: { value: 'topToBottom' },
  spineTop: { value: '구형 상단' },
  spineCenter: { value: '구형 중앙' },
  spineBottom: { value: '구형 하단' },
  spineTitle: { value: '구형 제목' },
};

const document = {
  getElementById(id) { return elements[id] || null; },
  querySelector() { return null; },
  createElement() { return { id: '', style: {}, dataset: {}, appendChild() {} }; },
  head: { appendChild() {} },
};

const context = {
  console,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  queueMicrotask(callback) { callback(); },
  MutationObserver: function MutationObserver() {},
  Number,
  String,
  Array,
  Object,
  Math,
  JSON,
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'cover-spine-orientation-controls.js' });

const api = context.CoverSpineOrientation;
assert.equal(api.stage, 'per-layer-spine-writing-direction');
assert.deepEqual(JSON.parse(JSON.stringify(api.directions)), ['bottomToTop', 'vertical', 'topToBottom']);
assert.equal(api.normalizeDirection('vertical'), 'vertical');
assert.equal(api.normalizeDirection('invalid', 'topToBottom'), 'topToBottom');

const top = { id: 'top', side: 'spine', zone: 'top', text: '상단', size: 10, color: '#fff' };
const center = { id: 'center', side: 'spine', zone: 'center', text: '세로', size: 11, color: '#fff' };
const bottom = { id: 'bottom', side: 'spine', zone: 'bottom', text: '하단', size: 10, color: '#fff' };
const data = { spine: { top: [top], center: [center], bottom: [bottom] } };
let saved = 0;
context.CoverTextZones = {
  data,
  save() { saved += 1; },
  findItem(id) { return [top, center, bottom].find((entry) => entry.id === id) || null; },
};
context.requestRender = () => {};

api.ensureEntry(top);
assert.equal(top.direction, 'topToBottom', 'legacy global direction should seed existing spine entries');
assert.equal(api.setDirection(center, 'vertical'), true);
assert.equal(center.direction, 'vertical');
assert.ok(saved >= 1);
assert.equal(api.applyToAll('bottomToTop'), 3);
assert.equal(top.direction, 'bottomToTop');
assert.equal(center.direction, 'bottomToTop');
assert.equal(bottom.direction, 'bottomToTop');

center.direction = 'vertical';
bottom.direction = 'topToBottom';
const originalZones = {
  top: data.spine.top,
  center: data.spine.center,
  bottom: data.spine.bottom,
};
const result = api.runWithoutNativeSpine(() => {
  assert.deepEqual(data.spine.top, []);
  assert.deepEqual(data.spine.center, []);
  assert.deepEqual(data.spine.bottom, []);
  assert.equal(elements.spineTop.value, '');
  assert.equal(elements.spineCenter.value, '');
  assert.equal(elements.spineBottom.value, '');
  assert.equal(elements.spineTitle.value, '');
  return 'rendered';
});
assert.equal(result, 'rendered');
assert.equal(data.spine.top, originalZones.top);
assert.equal(data.spine.center, originalZones.center);
assert.equal(data.spine.bottom, originalZones.bottom);
assert.equal(elements.spineTop.value, '구형 상단');
assert.equal(elements.spineCenter.value, '구형 중앙');
assert.equal(elements.spineBottom.value, '구형 하단');
assert.equal(elements.spineTitle.value, '구형 제목');

const calls = { rotations: [], texts: [], strokes: [] };
const drawingContext = {
  save() {},
  restore() {},
  translate() {},
  rotate(value) { calls.rotations.push(value); },
  fillText(text, x, y, maxWidth) { calls.texts.push({ text, x, y, maxWidth }); },
  measureText(text) { return { width: String(text).length * 12 }; },
  setLineDash() {},
  strokeRect(x, y, w, h) { calls.strokes.push({ x, y, w, h }); },
  fillStyle: '',
  textAlign: '',
  textBaseline: '',
  font: '',
  strokeStyle: '',
  lineWidth: 1,
};
const canvas = {
  id: 'previewCanvas',
  getContext() { return drawingContext; },
};
context.state = {
  active: 'center',
  layout: {
    top: { x: 50, y: 18, scale: 100 },
    center: { x: 50, y: 50, scale: 100 },
    bottom: { x: 50, y: 84, scale: 100 },
  },
  hitBoxes: {},
};
context.getSpec = () => ({ bleed: 3, trimW: 210, trimH: 297, spine: 10 });

const drawn = api.drawSpineEntries(canvas, 72, true);
assert.equal(drawn, 3);
assert.equal(calls.rotations.length, 2, 'only the two rotated directions should rotate the canvas');
assert.ok(calls.rotations.some((value) => Math.abs(value + Math.PI / 2) < 1e-9));
assert.ok(calls.rotations.some((value) => Math.abs(value - Math.PI / 2) < 1e-9));
assert.ok(calls.texts.some((call) => call.text === '세'));
assert.ok(calls.texts.some((call) => call.text === '로'));
assert.ok(calls.texts.some((call) => call.text === '상단'));
assert.ok(calls.texts.some((call) => call.text === '하단'));
assert.ok(context.state.hitBoxes.top);
assert.ok(context.state.hitBoxes.center);
assert.ok(context.state.hitBoxes.bottom);
assert.equal(calls.strokes.length, 1, 'selected spine entry should retain its selection outline');

console.log('cover-spine-orientation behavior passed');
