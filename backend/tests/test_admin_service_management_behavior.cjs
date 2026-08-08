const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.resolve(__dirname, '../../js/admin-service-management.js'), 'utf8');
const userSource = fs.readFileSync(path.resolve(__dirname, '../../js/cover-provided-image-library.js'), 'utf8');

function documentStub() {
  return {
    documentElement: { dataset: {} },
    head: { appendChild() {} },
    body: {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, dataset: {}, addEventListener() {}, appendChild() {}, setAttribute() {} }; },
    addEventListener() {},
    dispatchEvent() {},
  };
}

const adminContext = {
  console,
  location: { pathname: '/admin.html' },
  document: documentStub(),
  window: null,
  auth: { currentUser: null, onAuthStateChanged() {} },
  db: {},
  firebase: {},
  ProgramAccess: {},
  Set,
  String,
  Number,
  Boolean,
  Object,
  Array,
  URL,
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
  setTimeout() { return 0; },
  confirm() { return true; },
};
adminContext.window = adminContext;
vm.createContext(adminContext);
vm.runInContext(adminSource, adminContext, { filename: 'admin-service-management.js' });
const adminApi = adminContext.AdminServiceManagement;
assert.equal(adminApi.stage, 'service-console-cover-library');
assert.equal(adminApi.kind, 'library-image');
assert.deepEqual(adminApi.validateImageFile(null), { ok: true, message: '' });
assert.equal(adminApi.validateImageFile({ type: 'image/png', size: 1024 }).ok, true);
assert.equal(adminApi.validateImageFile({ type: 'image/jpeg', size: 15 * 1024 * 1024 }).ok, true);
assert.equal(adminApi.validateImageFile({ type: 'image/gif', size: 1024 }).ok, false);
assert.equal(adminApi.validateImageFile({ type: 'image/png', size: 15 * 1024 * 1024 + 1 }).ok, false);

const userContext = {
  console,
  location: { pathname: '/perfect-binding-cover/index.html' },
  document: documentStub(),
  window: null,
  db: {},
  Image: function Image() {},
  Option: function Option(text, value) { this.text = text; this.value = value; },
  Set,
  String,
  Object,
  Array,
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
  setTimeout() { return 0; },
};
userContext.window = userContext;
vm.createContext(userContext);
vm.runInContext(userSource, userContext, { filename: 'cover-provided-image-library.js' });
assert.equal(userContext.CoverProvidedImageLibrary.stage, 'user-selectable-admin-image-library');
assert.equal(userContext.CoverProvidedImageLibrary.kind, 'library-image');
assert.deepEqual(userContext.CoverProvidedImageLibrary.images, []);

console.log('admin service management behavior passed');
