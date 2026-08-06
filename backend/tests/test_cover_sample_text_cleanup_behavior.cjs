const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(root, 'js', 'cover-text-ui-refine.js'), 'utf8');

const sandbox = {
  console,
  location: { pathname: '/perfect-binding-cover/' },
  document: {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    getElementById() { return null; },
  },
  localStorage: {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
  },
  Event: class Event {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = Boolean(options.bubbles);
    }
  },
  MutationObserver: class MutationObserver {
    observe() {}
  },
  requestAnimationFrame(callback) { callback(); },
  setTimeout() { return 0; },
  clearTimeout() {},
};
sandbox.window = sandbox;

vm.runInNewContext(source, sandbox, { filename: 'cover-text-ui-refine.js' });
const api = sandbox.CoverSampleTextCleanup;
assert(api, 'cleanup API should be exposed');

const seeded = {
  version: 3,
  fields: {
    frontTitle: '2026학년도 방과후학교 운영 계획서',
    institutionName: '한국초등학교',
    issuerName: '교무부',
    publishYearLine: '2026',
    spineTop: '2026',
    spineCenter: '남아 있던 샘플 제목',
    spineBottom: '기기기관',
    publisher: '한국초등학교\n2026',
    publishYear: '2026',
    spineTitle: '2026학년도 방과후학교 운영 계획서',
    backBodyExtra: '사용자가 작성한 뒤표지 내용',
  },
  layout: { frontTitle: { x: 50, y: 40, scale: 100 } },
};
const cleaned = api.cleanAutosavePayload(seeded);
assert.strictEqual(cleaned.changed, true);
for (const id of [
  'frontTitle', 'institutionName', 'issuerName', 'publishYearLine',
  'spineTop', 'spineCenter', 'spineBottom', 'publisher',
  'publishYear', 'spineTitle',
]) {
  assert.strictEqual(cleaned.payload.fields[id], '', `${id} should be cleared`);
}
assert.strictEqual(cleaned.payload.fields.backBodyExtra, '사용자가 작성한 뒤표지 내용');
assert.deepStrictEqual(cleaned.payload.layout, seeded.layout);

const custom = {
  version: 3,
  fields: {
    frontTitle: '우리 학교 운영계획서',
    institutionName: '실제 기관명',
    publishYearLine: '2026',
    spineTop: '2026',
    spineCenter: '',
    spineBottom: '',
  },
};
const untouched = api.cleanAutosavePayload(custom);
assert.strictEqual(untouched.changed, false);
assert.strictEqual(untouched.payload, custom);

assert.strictEqual(api.hasDemoSignature({ institutionName: '한국초등학교', publishYearLine: '2026' }), true);
assert.strictEqual(api.hasDemoSignature({ spineTop: '2026', spineCenter: '샘플' }), true);
assert.strictEqual(api.hasDemoSignature({ institutionName: '한국초등학교', publishYearLine: '2027' }), false);

console.log('cover sample text cleanup behavior passed');
