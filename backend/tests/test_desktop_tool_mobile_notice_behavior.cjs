const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/desktop-tool-mobile-notice.js'),
  'utf8',
);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

const storage = memoryStorage();
const document = {
  readyState: 'loading',
  activeElement: null,
  documentElement: { style: { overflow: '' } },
  head: { appendChild() {} },
  body: { appendChild() {} },
  getElementById() { return null; },
  createElement() { return { setAttribute() {}, querySelector() { return null; }, addEventListener() {} }; },
  addEventListener() {},
  dispatchEvent() {},
};
const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  navigator: { userAgent: 'Desktop Browser', userAgentData: { mobile: false } },
  localStorage: storage,
  matchMedia(query) { return { matches: query === '(pointer: coarse)' || query === '(max-width: 900px)' }; },
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
  Date,
  Map,
  Set,
  String,
  Boolean,
  RegExp,
  Object,
  Array,
  Math,
  JSON,
  setTimeout() { return 0; },
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'desktop-tool-mobile-notice.js' });

const api = context.DesktopToolMobileNotice;
assert.equal(api.stage, 'nonblocking-mobile-pc-recommendation');
assert.equal(api.pathMatches('/pdf-editor'), true);
assert.equal(api.pathMatches('/pdf-editor/index.html'), true);
assert.equal(api.pathMatches('/tools/pdf-editor.html'), true);
assert.equal(api.pathMatches('/perfect-binding-cover'), true);
assert.equal(api.pathMatches('/perfect-binding-cover/index.html'), true);
assert.equal(api.pathMatches('/tools/perfect-binding-cover.html'), true);
assert.equal(api.pathMatches('/index.html'), false);
assert.equal(api.toolLabel('/perfect-binding-cover/index.html'), '책표지 제작기');
assert.equal(api.toolLabel('/pdf-editor/index.html'), 'PDF 편집기');

assert.equal(api.isMobileEnvironment({ navigator: { userAgentData: { mobile: true } } }), true);
assert.equal(api.isMobileEnvironment({ navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 16; Mobile)' } }), true);
assert.equal(api.isMobileEnvironment({
  navigator: { userAgent: 'iPad desktop mode' },
  matchMedia(query) { return { matches: query === '(pointer: coarse)' || query === '(max-width: 900px)' }; },
}), true);
assert.equal(api.isMobileEnvironment({
  navigator: { userAgent: 'Desktop Browser', userAgentData: { mobile: false } },
  matchMedia() { return { matches: false }; },
}), false);

const day = new Date(2026, 7, 7, 10, 30, 0);
assert.equal(api.todayKey(day), '2026-08-07');
assert.equal(api.wasDismissedToday(storage, day), false);
assert.equal(api.dismissForToday(storage, day), true);
assert.equal(api.wasDismissedToday(storage, day), true);
assert.equal(api.wasDismissedToday(storage, new Date(2026, 7, 8, 0, 1, 0)), false);

console.log('desktop-tool-mobile-notice behavior passed');
