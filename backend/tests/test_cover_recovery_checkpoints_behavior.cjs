const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-recovery-checkpoints.js'),
  'utf8',
);

const window = {};
const document = {
  getElementById() { return null; },
};
const context = vm.createContext({
  window,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  clearTimeout() {},
  Promise,
  Math,
  Number,
  String,
  Array,
  Date,
  Intl,
  JSON,
});
vm.runInContext(source, context, { filename: 'cover-recovery-checkpoints.js' });

const api = window.CoverRecoveryCheckpoints;
assert.equal(api.stage, 'indexeddb-image-inclusive-recovery');

const png = 'data:image/png;base64,AAAA';
const jpg = 'data:image/jpeg;base64,BBBB';
const webp = 'data:image/webp;base64,CCCC';
const remote = 'https://example.com/cover.png';
assert.equal(api.recoverableImageSource({ src: png }), png);
assert.equal(api.recoverableImageSource({ src: jpg }), jpg);
assert.equal(api.recoverableImageSource({ src: webp }), webp);
assert.equal(api.recoverableImageSource({ src: remote }), remote);
assert.equal(api.recoverableImageSource({ src: 'blob:https://example.com/id' }), '');
assert.equal(api.recoverableImageSource({ src: 'javascript:alert(1)' }), '');
assert.equal(api.recoverableImageSource(null), '');

const firstFingerprint = api.sourceFingerprint(png);
assert.equal(firstFingerprint, api.sourceFingerprint(png));
assert.notEqual(firstFingerprint, api.sourceFingerprint(`${png}A`));
const identity = JSON.parse(JSON.stringify(api.assetIdentity(png)));
assert.equal(identity.id, `asset_${firstFingerprint}`);
assert.match(identity.fingerprint, /^26:/);
assert.deepEqual(identity, JSON.parse(JSON.stringify(api.assetIdentity(png))));

const records = [
  { id: 'working', savedAt: 999 },
  { id: 'checkpoint_1', savedAt: 100 },
  { id: 'checkpoint_2', savedAt: 600 },
  { id: 'checkpoint_3', savedAt: 500 },
  { id: 'checkpoint_4', savedAt: 400 },
  { id: 'checkpoint_5', savedAt: 300 },
  { id: 'checkpoint_6', savedAt: 200 },
];
const trimmed = JSON.parse(JSON.stringify(api.trimRollingRecords(records, 5)));
assert.deepEqual(trimmed.keep.map((item) => item.id), [
  'checkpoint_2', 'checkpoint_3', 'checkpoint_4', 'checkpoint_5', 'checkpoint_6',
]);
assert.deepEqual(trimmed.remove.map((item) => item.id), ['checkpoint_1']);
assert.ok(!trimmed.keep.some((item) => item.id === 'working'));

const snapshot = {
  title: '학교 운영 계획서',
  images: {
    front: { assetId: 'asset_front', name: 'front.png' },
    back: null,
  },
};
const working = JSON.parse(JSON.stringify(api.checkpointRecord(snapshot, 'working', 1000)));
assert.equal(working.id, 'working');
assert.equal(working.kind, 'working');
assert.equal(working.savedAt, 1000);
assert.equal(working.snapshot.savedAt, 1000);

const manual = JSON.parse(JSON.stringify(api.checkpointRecord(snapshot, 'manual', 2000)));
assert.match(manual.id, /^checkpoint_2000_/);
assert.equal(manual.kind, 'manual');

const automatic = JSON.parse(JSON.stringify(api.checkpointRecord(snapshot, 'automatic', 3000)));
assert.match(automatic.id, /^checkpoint_3000_/);
assert.equal(automatic.kind, 'automatic');

const workingSummary = JSON.parse(JSON.stringify(api.recordSummary(working)));
assert.equal(workingSummary.kind, '최신 자동 저장');
assert.equal(workingSummary.images, 1);
assert.equal(workingSummary.title, '학교 운영 계획서');
const manualSummary = JSON.parse(JSON.stringify(api.recordSummary(manual)));
assert.equal(manualSummary.kind, '직접 저장');
const automaticSummary = JSON.parse(JSON.stringify(api.recordSummary(automatic)));
assert.equal(automaticSummary.kind, '자동 복구 지점');
assert.ok(typeof automaticSummary.timeLabel === 'string' && automaticSummary.timeLabel.length > 0);

console.log('cover-recovery-checkpoints behavior passed');
