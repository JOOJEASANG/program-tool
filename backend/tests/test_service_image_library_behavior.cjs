const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function documentStub() {
  return {
    documentElement: { dataset: {} },
    head: { appendChild() {} },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, dataset: {}, addEventListener() {}, appendChild() {}, setAttribute() {} }; },
    addEventListener() {},
    dispatchEvent() {},
  };
}

function runScript(file, pathname, extras = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../js', file), 'utf8');
  const context = {
    console,
    location: { pathname },
    document: documentStub(),
    window: null,
    auth: { currentUser: null, onAuthStateChanged() {} },
    db: {},
    firebase: {},
    ProgramAccess: {},
    Image: function Image() {},
    Option: function Option() {},
    URL,
    Set,
    Map,
    String,
    Number,
    Boolean,
    Object,
    Array,
    Math,
    Date,
    Promise,
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
    setTimeout() { return 0; },
    clearTimeout() {},
    confirm() { return true; },
    ...extras,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: file });
  return context;
}

const admin = runScript('admin-service-image-library.js', '/admin');
assert.equal(admin.AdminServiceImageLibrary.kind, 'service-image-v2');
assert.equal(admin.AdminServiceImageLibrary.stage, 'size-aware-service-image-library');
assert.equal(admin.AdminServiceImageLibrary.validateFile({ type: 'image/png', size: 1024 }).ok, true);
assert.equal(admin.AdminServiceImageLibrary.validateFile({ type: 'image/gif', size: 1024 }).ok, false);
assert.equal(admin.AdminServiceImageLibrary.validateFile({ type: 'image/png', size: 15 * 1024 * 1024 + 1 }).ok, false);
assert.equal(admin.AdminServiceImageLibrary.presets.a4.w, 210);
assert.equal(admin.AdminServiceImageLibrary.presets.a4.h, 297);
assert.equal(admin.AdminServiceImageLibrary.presets.spread.w, 420);

const cover = runScript('cover-service-image-library.js', '/perfect-binding-cover/index.html');
assert.equal(cover.CoverServiceImageLibrary.kind, 'service-image-v2');
assert.equal(cover.CoverServiceImageLibrary.stage, 'size-aware-cover-service-images');
assert.equal(Array.isArray(cover.CoverServiceImageLibrary.images), true);

const divider = runScript('pdf-divider-service-image-library.js', '/pdf-editor');
assert.equal(divider.PdfDividerServiceImageLibrary.kind, 'service-image-v2');
assert.equal(divider.PdfDividerServiceImageLibrary.stage, 'size-aware-pdf-divider-service-images');
assert.equal(Array.isArray(divider.PdfDividerServiceImageLibrary.images), true);

console.log('service image library behavior passed');
