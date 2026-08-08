const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/admin-cover-template-manager.js'),
  'utf8',
);

const document = {
  getElementById() { return null; },
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() { return { addEventListener() {}, appendChild() {}, setAttribute() {}, style: {}, dataset: {} }; },
  head: { appendChild() {} },
  documentElement: { dataset: {} },
};
const context = {
  console,
  document,
  location: { pathname: '/admin.html' },
  auth: { currentUser: null, onAuthStateChanged() {} },
  db: {},
  firebase: { storage: null },
  ProgramAccess: {},
  setTimeout() { return 0; },
  clearTimeout() {},
  CustomEvent: function CustomEvent() {},
  URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
  Set,
  Map,
  Promise,
  Date,
  Number,
  String,
  Boolean,
  Math,
  JSON,
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'admin-cover-template-manager.js' });

const api = context.AdminCoverTemplateManager;
assert.equal(api.stage, 'dedicated-admin-cover-template-management');
assert.equal(api.validateImageFile(null).ok, true);
assert.equal(api.validateImageFile({ type: 'image/jpeg', size: 1024 }).ok, true);
assert.equal(api.validateImageFile({ type: 'image/png', size: 15 * 1024 * 1024 }).ok, true);
assert.equal(api.validateImageFile({ type: 'image/webp', size: 100 }).ok, true);
assert.equal(api.validateImageFile({ type: 'image/gif', size: 100 }).ok, false);
assert.equal(api.validateImageFile({ type: 'image/jpeg', size: 15 * 1024 * 1024 + 1 }).ok, false);
assert.equal(api.extensionFor({ type: 'image/jpeg' }), 'jpg');
assert.equal(api.extensionFor({ type: 'image/webp' }), 'webp');
assert.equal(api.extensionFor({ type: 'image/png' }), 'png');
assert.equal(api.isObjectNotFound({ code: 'storage/object-not-found' }), true);
assert.equal(api.isObjectNotFound({ code: 'storage/unauthorized' }), false);

console.log('admin-cover-template-manager behavior passed');
