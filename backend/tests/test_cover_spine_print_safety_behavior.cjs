const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/cover-spine-print-safety.js'), 'utf8');
const window = {};
const elements = new Map();
const document = { getElementById(id) { return elements.get(id) || null; } };
const context = vm.createContext({
  window,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  Number, Math, String, Array, Map,
});
vm.runInContext(source, context, { filename: 'cover-spine-print-safety.js' });
const api = window.CoverSpinePrintSafety;
assert.equal(api.stage, 'multi-layer-spine-print-fit-safety');

elements.set('spineTitle', { value: '구형 책등 제목' });
window.CoverTextZones = { data: { spine: { top: [], center: [], bottom: [] } } };
assert.equal(api.currentSpineEntries().length, 0, 'multi-layer editor must not fall back to hidden legacy text');
delete window.CoverTextZones;
assert.equal(api.currentSpineEntries()[0].id, 'legacySpineTitle', 'legacy fallback remains available when the multi-layer editor is unavailable');
elements.delete('spineTitle');

assert.equal(api.weightedCharacters('가나다'), 3);
assert.ok(api.weightedCharacters('ABC') > 1.8 && api.weightedCharacters('ABC') < 1.9);

const good = api.evaluateSpineLayer({ id: 'good', zone: 'center', text: '학교', size: 10, scale: 100, y: 50, spineMm: 10, trimHeightMm: 297 });
assert.equal(good.level, 'ok');
assert.ok(good.crossFillRatio > 0.35 && good.crossFillRatio < 0.36);
assert.equal(good.compressionRatio, 1);

const hidden = api.evaluateSpineLayer({ id: 'hidden', text: '제목', size: 10, scale: 100, spineMm: 2, trimHeightMm: 297 });
assert.equal(hidden.hidden, true);
assert.equal(hidden.level, 'error');
assert.equal(hidden.label, '출력 안 됨');

const overflow = api.evaluateSpineLayer({ id: 'overflow', text: '제목', size: 12, scale: 100, spineMm: 4, trimHeightMm: 297 });
assert.equal(overflow.level, 'error');
assert.equal(overflow.label, '폭 초과');
assert.ok(overflow.recommendedBasePt < overflow.basePt);

const long = api.evaluateSpineLayer({ id: 'long', text: '가나다라마바사아자차카타파하가나다라마바사아자차카타파하', size: 10, scale: 100, spineMm: 10, trimHeightMm: 297 });
assert.equal(long.level, 'warn');
assert.equal(long.label, '가로 압축');
assert.ok(long.compressionRatio < 0.85);
assert.ok(long.recommendedBasePt < long.basePt);

const layers = api.evaluateSpineLayers({
  spineMm: 10,
  trimHeightMm: 297,
  entries: [
    { id: 'top', zone: 'top', text: '상단글자', size: 10, scale: 100, y: 50 },
    { id: 'center', zone: 'center', text: '중앙글자', size: 10, scale: 100, y: 52 },
  ],
});
assert.equal(layers.errors, 0);
assert.ok(layers.overlaps.length >= 1);
assert.equal(layers.level, 'warn');
assert.ok(layers.message.includes('겹칠'));

const blockedAggregate = api.evaluateSpineLayers({ spineMm: 2, trimHeightMm: 297, entries: [{ id: 'one', text: '책등', size: 10, scale: 100, y: 50 }] });
assert.equal(blockedAggregate.level, 'error');
const issue = JSON.parse(JSON.stringify(api.preflightIssue(blockedAggregate)));
assert.equal(issue.level, 'error');
assert.equal(issue.title, '책등 글자 인쇄 오류');

const empty = api.evaluateSpineLayers({ spineMm: 8, trimHeightMm: 297, entries: [] });
assert.equal(empty.level, 'empty');
assert.equal(api.preflightIssue(empty).level, 'warn');
console.log('cover-spine-print-safety behavior passed');
