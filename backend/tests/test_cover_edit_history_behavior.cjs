const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-edit-history.js'),
  'utf8',
);

function element(value = '', type = 'text') {
  return {
    value: String(value),
    type,
    checked: false,
    textContent: '',
    className: '',
    disabled: false,
    dataset: {},
    style: {},
    classList: { toggle() {}, add() {}, remove() {} },
    dispatchEvent() {},
    setAttribute() {},
    addEventListener() {},
  };
}

const elements = {
  frontTitle: element('초기 제목'),
  trimW: element('210', 'number'),
  paperPreset: element('0.10'),
  frontName: element(),
  backName: element(),
  frontUploadBox: element(),
  backUploadBox: element(),
  status: element(),
};
elements.paperPreset.tagName = 'SELECT';
elements.paperPreset.options = [{ value: '0.10' }, { value: '0.10' }];
elements.paperPreset.selectedIndex = 1;
elements.frontName.textContent = '앞표지 이미지';
elements.backName.textContent = '뒤표지 이미지';

const document = {
  getElementById(id) { return elements[id] || null; },
  querySelector() { return null; },
  createElement() { return element(); },
  addEventListener() {},
  dispatchEvent() {},
  head: { appendChild() {} },
};

let extendedState = {
  textZones: { front: { top: [], center: [], bottom: [] } },
  imageEffects: { brightness: 0 },
};
let recoverySaves = 0;
const context = {
  console,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 1; },
  clearTimeout() {},
  Date,
  JSON,
  Math,
  Number,
  String,
  Object,
  Array,
  Map,
  Set,
  WeakMap,
  Event: class Event {
    constructor(type, options) { this.type = type; this.bubbles = options?.bubbles; }
  },
  CustomEvent: class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  },
  state: {
    frontImage: null,
    backImage: null,
    layout: { frontImage: { x: 0, y: 0, scale: 100 } },
    active: 'frontImage',
    showGuides: true,
  },
  CoverProjectStateBridge: {
    snapshot() { return JSON.parse(JSON.stringify(extendedState)); },
    restore(value) { extendedState = JSON.parse(JSON.stringify(value)); },
  },
  CoverRecoveryCheckpoints: { queueSave() { recoverySaves += 1; } },
  CoverTextZones: { save() {} },
  syncControls() {},
  updateCalculation() {},
  requestRender() {},
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'cover-edit-history.js' });

const api = context.CoverEditHistory;
assert.equal(api.stage, 'bounded-transaction-safe-undo-redo');
assert.equal(api.maxHistory, 40);

api.reset('초기 상태');
assert.equal(api.pastCount, 0);
assert.equal(api.canUndo, false);
assert.equal(api.commit('중복 상태'), false, 'identical snapshots must not create history');
context.state.active = 'temporary-selection';
assert.equal(api.commit('선택만 변경'), false, 'selection-only changes must not pollute history');
context.state.active = 'frontImage';

elements.paperPreset.selectedIndex = 0;
assert.equal(api.commit('용지 선택 변경'), true, 'duplicate select values must still track the selected option');
assert.equal(api.undo(), true);
assert.equal(elements.paperPreset.selectedIndex, 1);

elements.frontTitle.value = '수정 제목';
assert.equal(api.commit('제목 변경'), true);
assert.equal(api.pastCount, 1);
assert.equal(api.current.label, '제목 변경');

const image = { src: 'data:image/png;base64,abc' };
context.state.frontImage = image;
elements.frontName.textContent = 'cover.png';
assert.equal(api.commit('이미지 변경'), true);
const imageSnapshot = api.captureSnapshot();
assert.equal(imageSnapshot.images.front, image, 'history must retain the image object, not copy its bytes');
assert.equal(api.imageToken(image), api.imageToken(image), 'image identity must remain stable');

const beforeWidth = elements.trimW.value;
elements.trimW.value = '182';
assert.equal(api.commit('규격 변경'), true);
assert.equal(api.undo(), true);
assert.equal(elements.trimW.value, beforeWidth);
assert.equal(api.canRedo, true);
assert.equal(context.state.frontImage, image);
assert.equal(api.redo(), true);
assert.equal(elements.trimW.value, '182');
assert.ok(recoverySaves >= 2, 'undo and redo should request a recovery save');

assert.equal(api.undo(), true);
elements.frontTitle.value = '새 갈래';
assert.equal(api.commit('새 편집'), true);
assert.equal(api.canRedo, false, 'a new edit after undo must clear redo history');

api.reset('경계 검사');
for (let index = 0; index < 47; index += 1) {
  elements.frontTitle.value = `제목 ${index}`;
  api.commit(`편집 ${index}`);
}
assert.equal(api.pastCount, 40, 'history must remain bounded');

const fallback = api.captureSnapshot();
const invalidTarget = api.captureSnapshot();
invalidTarget.fields.frontTitle = '복원 실패 상태';
assert.equal(api.applySnapshotTransaction(invalidTarget, fallback), false);
assert.equal(elements.frontTitle.value, fallback.fields.frontTitle, 'failed restores must roll back');
assert.equal(api.applying, false);

const stableA = api.stableStringify({ b: 2, a: { y: 1, x: 0 } });
const stableB = api.stableStringify({ a: { x: 0, y: 1 }, b: 2 });
assert.equal(stableA, stableB);

console.log('cover-edit-history behavior passed');
