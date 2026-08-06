const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/import-transaction-safety.js'),
  'utf8',
);

function element(id) {
  const node = {
    id,
    disabled: false,
    value: '',
    className: '',
    dataset: {},
    style: {},
    children: [],
    width: 0,
    height: 0,
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
    get childNodes() { return this.children; },
    getContext() {
      return {
        canvas: node,
        fillRect() {},
        strokeRect() {},
        fillText() {},
      };
    },
  };
  return node;
}

const existingPreviewCanvas = element('existing-preview-canvas');
existingPreviewCanvas.width = 400;
existingPreviewCanvas.height = 600;
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
elements.get('previewScroll').children = [existingPreviewCanvas];

const modeNew = element('modeNew'); modeNew.dataset.mode = 'new'; modeNew.className = 'mode-btn';
const modeCont = element('modeCont'); modeCont.dataset.mode = 'cont'; modeCont.className = 'mode-btn active';
const modeBreak = element('modeBreak'); modeBreak.dataset.mode = 'break'; modeBreak.className = 'mode-btn';
const modeButtons = [modeNew, modeCont, modeBreak];

const document = {
  readyState: 'complete',
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
let throwOnRenderThumbs = false;
let renderedPageCount = 0;
let placeholderCount = 0;
let lightweightCount = 0;
let syncAggregateCalls = 0;
let workerlessAttempts = 0;
let workerAttempts = 0;

const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  localStorage: { removeItem() {} },
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
context.PdfUploadOptimization = {
  makePagePlaceholder(pageNumber, total, rotation) {
    placeholderCount += 1;
    const canvas = element(`placeholder-${pageNumber}`);
    canvas.dataset.lightweightPage = '1';
    canvas.dataset.total = String(total);
    canvas.dataset.rotation = String(rotation);
    return canvas;
  },
  makeLightweightPdfPage(pageNumber, total) {
    lightweightCount += 1;
    return {
      __lightweightPdfPage: true,
      pageNumber,
      total,
      getViewport() { return { width: 96, height: 136 }; },
      render() { return { promise: Promise.resolve() }; },
      cleanup() {},
    };
  },
  syncAggregateMode() {
    syncAggregateCalls += 1;
    const pages = vm.runInContext('parsedPages.length', context);
    return { pages, extreme: pages >= 300, optimized: pages > 120 };
  },
};

vm.createContext(context);
vm.runInContext(`
  var parsedPages = [{ id: 10, sourceFile: '기존.pdf', file_index: 0, page_index: 0 }];
  var uploadedFiles = [{ name: '기존.pdf', size: 1000 }];
  var previewCanvases = [globalThis.document.getElementById('existing-preview-canvas') || { id: 'existing-preview' }];
  var fileNupMap = { 0: 2 };
  var _nextId = 20;
  var landscape = false;
  var _uploadMode = 'cont';
  function makeId() { return _nextId++; }
  function detectPaperSizeMm() { return { name: 'a4' }; }
  function renderThumbs() {
    globalThis.renderThumbCalls += 1;
    if (globalThis.throwOnRenderThumbs) throw new Error('thumbnail UI failed');
  }
  async function triggerPreview() { globalThis.previewCalls += 1; }
  function hideStatus() {}
  window.handleFile = async function legacyHandleFile() { throw new Error('legacy path should not run'); };
`, context);
context.renderThumbCalls = renderThumbCalls;
context.previewCalls = previewCalls;
context.throwOnRenderThumbs = throwOnRenderThumbs;

function page(pageNumber, renderFails = false) {
  return {
    pageNumber,
    getViewport({ scale = 1 } = {}) { return { width: 595 * scale, height: 842 * scale }; },
    render() {
      renderedPageCount += 1;
      return { promise: renderFails ? Promise.reject(new Error('preview render failed')) : Promise.resolve() };
    },
    cleanup() {},
  };
}

function documentFor(data) {
  const total = data === 'extreme' ? 300 : data === 'huge' ? 90 : 2;
  return {
    numPages: total,
    destroyed: false,
    async getPage(number) {
      if (data === 'bad-with-edit' && number === 2) {
        vm.runInContext("parsedPages.push({id: makeId(), sourceFile: '사용자추가', file_index: 0, page_index: 99})", context);
        throw new Error('손상된 페이지 스트림');
      }
      return page(number, data === 'render-fallback' && number === 2);
    },
    async destroy() { this.destroyed = true; },
  };
}

context.pdfjsLib = {
  getDocument(options) {
    if (options.disableWorker) workerlessAttempts += 1;
    else workerAttempts += 1;
    return { promise: Promise.resolve(documentFor(options.data)) };
  },
};

vm.runInContext(source, context, { filename: 'import-transaction-safety.js' });
const api = context.window.PdfImportTransactionSafety;
assert.equal(api.stage, 'bounded-stage-atomic-commit-node-preserving-rollback');
assert.equal(api.installed, true);
assert.equal(context.window.handleFile.__pdfImportTransactionSafetyV1, true);

function file(name, data, size = 1000) {
  return { name, type: 'application/pdf', size, async arrayBuffer() { return data; } };
}

(async () => {
  const planSmall = api.chooseImportPlan(10, 1000, 'cont');
  assert.equal(planSmall.thumbScale, 0.75);
  const planHeavy = api.chooseImportPlan(30, 1000, 'new');
  assert.equal(planHeavy.heavy, true);
  assert.equal(planHeavy.thumbScale, 0.42);
  const planHuge = api.chooseImportPlan(90, 1000, 'new');
  assert.equal(planHuge.huge, true);
  assert.equal(planHuge.thumbScale, 0.28);
  const planExtreme = api.chooseImportPlan(300, 1000, 'new');
  assert.equal(planExtreme.extreme, true);

  const idBeforeStage = vm.runInContext('_nextId', context);
  const staged = await api.stagePdfFile(file('검사.pdf', 'good'), 'cont');
  assert.equal(vm.runInContext('_nextId', context), idBeforeStage, 'staging must not allocate global page IDs');
  assert.equal(staged.pages.every((entry) => entry.id === null), true);
  const commit = api.commitStagedFile(staged);
  assert.equal(commit.committedPages.length, 2);
  assert.equal(vm.runInContext('_nextId', context), idBeforeStage + 2);
  assert.equal(vm.runInContext('uploadedFiles.length', context), 2);
  assert.equal(vm.runInContext('parsedPages.length', context), 3);
  assert.deepEqual(
    JSON.parse(vm.runInContext('JSON.stringify(parsedPages.slice(1).map(p => [p.file_index, p.page_index, p.groupBreak]))', context)),
    [[1, 0, false], [1, 1, false]],
  );

  const beforeBadNextId = vm.runInContext('_nextId', context);
  const bad = await context.window.handleFile(file('손상.pdf', 'bad-with-edit'));
  assert.equal(bad, false);
  assert.equal(vm.runInContext('parsedPages.some(p => p.sourceFile === "사용자추가")', context), true);
  assert.equal(vm.runInContext('_nextId', context), beforeBadNextId + 1, 'failed import must not rewind an ID used by a concurrent editor action');
  const userId = vm.runInContext('parsedPages.find(p => p.sourceFile === "사용자추가").id', context);
  const nextAllocated = vm.runInContext('makeId()', context);
  assert.equal(nextAllocated, userId + 1);

  const extremeStartId = vm.runInContext('_nextId', context);
  const renderCountBeforeExtreme = renderedPageCount;
  const extremeStage = await api.stagePdfFile(file('300페이지.pdf', 'extreme'), 'cont');
  assert.equal(extremeStage.plan.extreme, true);
  assert.equal(extremeStage.pages.length, 300);
  assert.equal(extremeStage.pages.every((entry) => entry.lightweight && entry.pdfPage.__lightweightPdfPage), true);
  assert.equal(renderedPageCount, renderCountBeforeExtreme, 'extreme imports must not render full page canvases');
  assert.ok(placeholderCount >= 300);
  assert.ok(lightweightCount >= 300);
  assert.equal(vm.runInContext('_nextId', context), extremeStartId);

  const beforeCommitFailurePages = vm.runInContext('JSON.stringify(parsedPages.map(p => p.id))', context);
  const beforeCommitFailureFiles = vm.runInContext('JSON.stringify(uploadedFiles.map(f => f.name))', context);
  const preservedPreviewNode = elements.get('previewScroll').childNodes[0];
  context.throwOnRenderThumbs = true;
  const failedCommit = await context.window.handleFile(file('UI실패.pdf', 'good'));
  context.throwOnRenderThumbs = false;
  assert.equal(failedCommit, false);
  assert.equal(vm.runInContext('JSON.stringify(parsedPages.map(p => p.id))', context), beforeCommitFailurePages);
  assert.equal(vm.runInContext('JSON.stringify(uploadedFiles.map(f => f.name))', context), beforeCommitFailureFiles);
  assert.equal(elements.get('previewScroll').childNodes[0], preservedPreviewNode, 'rollback must restore the original canvas node, not serialized markup');
  assert.equal(preservedPreviewNode.width, 400);

  vm.runInContext("_uploadMode = 'new'", context);
  const beforeNewFailure = vm.runInContext('JSON.stringify({pages: parsedPages.map(p => p.id), files: uploadedFiles.map(f => f.name), preview: previewCanvases.length, nup: fileNupMap})', context);
  const badNew = await context.window.handleFile(file('새작업-손상.pdf', 'bad-with-edit'));
  assert.equal(badNew, false);
  const afterNewFailure = vm.runInContext('JSON.stringify({pages: parsedPages.filter(p => p.sourceFile !== "사용자추가").map(p => p.id), files: uploadedFiles.map(f => f.name), preview: previewCanvases.length, nup: fileNupMap})', context);
  const normalizedBefore = JSON.stringify({
    pages: JSON.parse(beforeNewFailure).pages,
    files: JSON.parse(beforeNewFailure).files,
    preview: JSON.parse(beforeNewFailure).preview,
    nup: JSON.parse(beforeNewFailure).nup,
  });
  assert.equal(afterNewFailure, normalizedBefore, 'failed new import must not clear the current job');

  const newSuccess = await context.window.handleFile(file('새작업.pdf', 'good'));
  assert.equal(newSuccess, true);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(uploadedFiles.map(f => f.name))', context)), ['새작업.pdf']);
  assert.equal(vm.runInContext('parsedPages.length', context), 2);
  assert.equal(vm.runInContext('parsedPages.every(p => p.file_index === 0)', context), true);
  assert.equal(vm.runInContext('_uploadMode', context), 'cont');
  assert.equal(elements.get('uploadZone').dataset.importBusy, '0');
  assert.equal(elements.get('fileInput').disabled, false);
  assert.ok(workerlessAttempts >= 1);
  assert.equal(workerAttempts, 0);
  assert.ok(syncAggregateCalls >= 1);

  console.log('pdf-import-transaction-safety behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
