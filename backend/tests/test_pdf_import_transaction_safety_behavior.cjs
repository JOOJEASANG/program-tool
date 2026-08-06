const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/import-transaction-safety.js'),
  'utf8',
);

function element(id) {
  return {
    id,
    disabled: false,
    value: '',
    className: '',
    dataset: {},
    style: {},
    innerHTML: '',
    children: [],
    classList: {
      values: new Set(),
      add(...names) { names.forEach((name) => this.values.add(name)); },
      remove(...names) { names.forEach((name) => this.values.delete(name)); },
      toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); },
    },
    setAttribute(name, value) { this[name] = value; },
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, listener) { this[`on${type}`] = listener; },
  };
}

const elements = new Map([
  ['statusBar', element('statusBar')],
  ['uploadZone', element('uploadZone')],
  ['fileInput', element('fileInput')],
  ['previewBtn', element('previewBtn')],
  ['downloadBtn', element('downloadBtn')],
  ['previewScroll', element('previewScroll')],
  ['paperSize', element('paperSize')],
  ['customSizeRow', element('customSizeRow')],
  ['customW', element('customW')],
  ['customH', element('customH')],
  ['orientLand', element('orientLand')],
  ['orientPort', element('orientPort')],
  ['autoDetectSize', { ...element('autoDetectSize'), checked: true }],
]);
const modeNew = element('modeNew'); modeNew.dataset.mode = 'new'; modeNew.className = 'mode-btn';
const modeCont = element('modeCont'); modeCont.dataset.mode = 'cont'; modeCont.className = 'mode-btn active';
const modeBreak = element('modeBreak'); modeBreak.dataset.mode = 'break'; modeBreak.className = 'mode-btn';
const modeButtons = [modeNew, modeCont, modeBreak];

const document = {
  getElementById(id) { return elements.get(id) || null; },
  querySelectorAll(selector) { return selector === '.mode-btn' ? modeButtons : []; },
  querySelector(selector) {
    if (selector === '.mode-btn[data-mode="cont"]') return modeCont;
    return null;
  },
  createElement(tag) { return element(tag); },
  dispatchEvent() {},
};

let renderThumbCalls = 0;
let previewCalls = 0;
const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
  setTimeout(callback) { callback(); return 0; },
  clearTimeout() {},
  Promise,
  Error,
  Number,
  String,
  Array,
  Object,
  Math,
};
context.window = context;
vm.createContext(context);
vm.runInContext(`
  var parsedPages = [{ id: 10, sourceFile: '기존.pdf', file_index: 0, page_index: 0 }];
  var uploadedFiles = [{ name: '기존.pdf' }];
  var previewCanvases = [{ id: 'existing-preview' }];
  var fileNupMap = { 0: 2 };
  var _nextId = 20;
  var landscape = false;
  var _uploadMode = 'cont';
  function makeId() { return _nextId++; }
  function detectPaperSizeMm() { return { name: 'a4' }; }
  function renderThumbs() { globalThis.renderThumbCalls += 1; }
  async function renderPdfPage(page) { return { width: 100, height: 140, pageNumber: page.pageNumber }; }
  async function triggerPreview() { globalThis.previewCalls += 1; }
  function hideStatus() {}
  window.handleFile = async function legacyHandleFile() { throw new Error('legacy path should not run'); };
`, context);
context.renderThumbCalls = renderThumbCalls;
context.previewCalls = previewCalls;

function page(pageNumber) {
  return {
    pageNumber,
    getViewport() { return { width: 595, height: 842 }; },
  };
}

context.pdfjsLib = {
  getDocument({ data }) {
    if (data === 'bad') {
      return { promise: Promise.resolve({
        numPages: 3,
        async getPage(number) {
          if (number === 2) throw new Error('손상된 페이지 스트림');
          return page(number);
        },
        async destroy() {},
      }) };
    }
    return { promise: Promise.resolve({
      numPages: 2,
      async getPage(number) { return page(number); },
      async destroy() {},
    }) };
  },
};

vm.runInContext(source, context, { filename: 'import-transaction-safety.js' });
const api = context.window.PdfImportTransactionSafety;
assert.equal(api.stage, 'stage-all-pages-atomic-commit-rollback');
assert.equal(api.installed, true);
assert.equal(context.window.handleFile.__pdfImportTransactionSafetyV1, true);

function file(name, data) {
  return { name, type: 'application/pdf', async arrayBuffer() { return data; } };
}

(async () => {
  const good = await context.window.handleFile(file('추가.pdf', 'good'));
  assert.equal(good, true);
  assert.equal(vm.runInContext('uploadedFiles.length', context), 2);
  assert.equal(vm.runInContext('parsedPages.length', context), 3);
  assert.deepEqual(
    JSON.parse(vm.runInContext('JSON.stringify(parsedPages.slice(1).map(p => [p.file_index, p.page_index, p.groupBreak]))', context)),
    [[1, 0, false], [1, 1, false]],
  );
  assert.equal(vm.runInContext('_nextId', context), 22);

  const beforeBad = vm.runInContext('JSON.stringify({pages: parsedPages.map(p => p.id), files: uploadedFiles.map(f => f.name), nextId: _nextId})', context);
  const bad = await context.window.handleFile(file('손상.pdf', 'bad'));
  assert.equal(bad, false);
  const afterBad = vm.runInContext('JSON.stringify({pages: parsedPages.map(p => p.id), files: uploadedFiles.map(f => f.name), nextId: _nextId})', context);
  assert.equal(afterBad, beforeBad, 'failed append must preserve all prior editor state and id sequence');

  vm.runInContext("_uploadMode = 'new'", context);
  const beforeNewFailure = vm.runInContext('JSON.stringify({pages: parsedPages.map(p => p.id), files: uploadedFiles.map(f => f.name), preview: previewCanvases.length, nup: fileNupMap})', context);
  const badNew = await context.window.handleFile(file('새작업-손상.pdf', 'bad'));
  assert.equal(badNew, false);
  const afterNewFailure = vm.runInContext('JSON.stringify({pages: parsedPages.map(p => p.id), files: uploadedFiles.map(f => f.name), preview: previewCanvases.length, nup: fileNupMap})', context);
  assert.equal(afterNewFailure, beforeNewFailure, 'failed new import must not clear the current job');

  const newSuccess = await context.window.handleFile(file('새작업.pdf', 'good'));
  assert.equal(newSuccess, true);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(uploadedFiles.map(f => f.name))', context)), ['새작업.pdf']);
  assert.equal(vm.runInContext('parsedPages.length', context), 2);
  assert.equal(vm.runInContext('parsedPages.every(p => p.file_index === 0)', context), true);
  assert.equal(vm.runInContext('_uploadMode', context), 'cont');
  assert.equal(elements.get('uploadZone').dataset.importBusy, '0');
  assert.equal(elements.get('fileInput').disabled, false);

  console.log('pdf-import-transaction-safety behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
