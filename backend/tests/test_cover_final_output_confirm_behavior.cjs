const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-final-output-confirm.js'),
  'utf8',
);

const values = new Map([
  ['frontTitle', { value: '학교 운영 계획서' }],
  ['trimW', { value: '210' }],
  ['trimH', { value: '297' }],
  ['bleed', { value: '3' }],
  ['pageCount', { value: '160' }],
  ['paperCaliper', { value: '0.1' }],
  ['bindingAdjust', { value: '0.5' }],
  ['manualSpine', { checked: false }],
  ['spineManual', { value: '8.5' }],
  ['imageFit', { value: 'cover' }],
]);
const document = {
  getElementById(id) { return values.get(id) || null; },
  createElement() { return {}; },
  body: {},
  documentElement: { style: {} },
};
const window = {
  safeName() { return '학교 운영 계획서'; },
};
const context = vm.createContext({
  window,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  Number,
  Math,
  String,
  Array,
});
vm.runInContext(source, context, { filename: 'cover-final-output-confirm.js' });

const api = window.CoverFinalOutputConfirm;
assert.equal(api.stage, 'primary-pdf-final-confirmation');
assert.equal(api.outputFileName(), '학교 운영 계획서_300DPI_RGB.pdf');

const clean = api.summarizePreflight([
  { level: 'ok' },
  { level: 'ok' },
]);
assert.deepEqual(
  JSON.parse(JSON.stringify(clean)),
  { errors: 0, warnings: 0, normal: 2, blocked: false, label: '점검 완료 · 정상 2개' },
);

const warning = api.summarizePreflight([
  { level: 'ok' },
  { level: 'warn' },
  { level: 'warn' },
]);
assert.equal(warning.blocked, false);
assert.equal(warning.label, '출력 가능 · 주의 2개');

const blocked = api.summarizePreflight([
  { level: 'error' },
  { level: 'warn' },
]);
assert.equal(blocked.blocked, true);
assert.equal(blocked.label, '오류 1개 · 주의 1개');

assert.deepEqual(
  JSON.parse(JSON.stringify(api.qualityItem(null, '앞표지'))),
  { label: '앞표지', level: 'empty', value: '이미지 없음', detail: '배경색만 출력' },
);
assert.deepEqual(
  JSON.parse(JSON.stringify(api.qualityItem({ available: true, dpi: 287.6, grade: { level: 'good', label: '양호' } }, '뒤표지'))),
  { label: '뒤표지', level: 'good', value: '288DPI', detail: '양호' },
);

const spec = api.currentSpec();
assert.equal(spec.trimW, 210);
assert.equal(spec.trimH, 297);
assert.equal(spec.bleed, 3);
assert.equal(spec.spine, 8.5);
assert.equal(spec.totalW, 434.5);
assert.equal(spec.totalH, 303);
console.log('cover-final-output-confirm behavior passed');
