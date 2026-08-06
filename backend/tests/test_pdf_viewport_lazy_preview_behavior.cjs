const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/viewport-lazy-preview.js'),
  'utf8',
);

const registry = new Map();

function createElement(tag, id = '') {
  const node = {
    tagName: String(tag || '').toUpperCase(),
    _id: '',
    get id() { return this._id; },
    set id(value) { this._id = String(value || ''); if (this._id) registry.set(this._id, this); },
    type: '',
    value: '',
    min: '',
    max: '',
    step: '',
    textContent: '',
    className: '',
    disabled: false,
    dataset: {},
    style: {},
    children: [],
    parentElement: null,
    scrollTop: 0,
    scrollHeight: 1000,
    clientHeight: 500,
    width: 320,
    height: 450,
    attributes: {},
    listeners: {},
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
    append(...children) { children.forEach((child) => this.appendChild(child)); },
    insertBefore(child, before) {
      child.parentElement = this;
      const index = this.children.indexOf(before);
      if (index < 0) this.children.push(child);
      else this.children.splice(index, 0, child);
      return child;
    },
    replaceChildren(...children) {
      this.children = [];
      children.forEach((child) => this.appendChild(child));
    },
    contains(target) {
      if (target === this) return true;
      return this.children.some((child) => child === target || child.contains?.(target));
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest(selector) {
      if (selector === '#previewScroll' && this.id === 'previewScroll') return this;
      return null;
    },
    scrollIntoView() { this.scrolled = true; },
    getContext() {
      return {
        canvas: node,
        fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', font: '',
        fillRect() {}, strokeRect() {}, fillText() {}, drawImage() {},
      };
    },
  };
  node.id = id;
  return node;
}

const elements = registry;
const previewParent = createElement('div', 'previewParent');
const previewScroll = createElement('div', 'previewScroll');
previewParent.appendChild(previewScroll);
for (const id of ['previewInfo', 'previewPages', 'previewBtn', 'downloadBtn', 'bookletCheck']) {
  elements.set(id, createElement(id === 'bookletCheck' ? 'input' : 'div', id));
}
elements.set('previewScroll', previewScroll);
elements.get('bookletCheck').checked = false;

let previewNodes = [];
const documentListeners = {};
const document = {
  readyState: 'complete',
  documentElement: { dataset: {} },
  head: createElement('head', 'head'),
  getElementById(id) { return elements.get(id) || null; },
  createElement(tag) {
    const node = createElement(tag);
    if (tag === 'style') node.textContent = '';
    return node;
  },
  querySelector(selector) {
    if (selector === '#thumbArea .thumb-wrap[data-sidebar-current="true"]') return null;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '#previewScroll .page-preview') return previewNodes;
    if (selector === '#thumbArea .thumb-wrap') return [];
    return [];
  },
  addEventListener(type, listener) { documentListeners[type] = listener; },
  dispatchEvent() {},
};

let delegate = null;
const coordinator = {
  setDelegate(next) { delegate = next; },
  getOriginal() { return async () => 'original-preview'; },
  request() {},
};

let outputCalls = [];
let editCalls = [];
let statusCalls = [];
let hydratedRenders = 0;
let sourceDocumentOpens = 0;
let sourceDocumentDestroys = 0;
let currentPages = [];

const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  Event: function Event(type) { this.type = type; },
  setTimeout(callback) { callback(); return 0; },
  clearTimeout() {},
  requestAnimationFrame(callback) { callback(); return 0; },
  Promise,
  Error,
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  Math,
  Date,
  __pdfEditorFastMode: true,
  __pdfEditorExtremeMode: false,
  __pdfEditorPreviewCoordinatorV8: coordinator,
  showStatus(message, type) { statusCalls.push([message, type]); },
  hideStatus() {},
  groupByNup(pages) {
    const groups = [];
    let current = null;
    for (const page of pages) {
      const n = page.nup || 2;
      if (!current || current.n !== n) {
        current = { n, pages: [] };
        groups.push(current);
      }
      current.pages.push(page);
    }
    return groups;
  },
  getLayout(n) { return n === 2 ? { cols: 2, rows: 1 } : { cols: 1, rows: 1 }; },
  buildOutputPage(groupPages, pageIndex, cols, rows, ppm, useHi, outputIndex) {
    const perPage = cols * rows;
    const selected = groupPages.slice(pageIndex * perPage, pageIndex * perPage + perPage);
    outputCalls.push({ pageIndex, cols, rows, ppm, useHi, outputIndex, selected });
    const canvas = createElement('canvas');
    canvas.width = 500;
    canvas.height = 700;
    return canvas;
  },
  applyDocEdits(canvas, outputIndex, total, ppm) {
    editCalls.push({ canvas, outputIndex, total, ppm });
  },
  displayPreview(canvases) {
    previewNodes = canvases.map((canvas) => {
      const node = createElement('div');
      node.className = 'page-preview';
      node.canvas = canvas;
      return node;
    });
    previewScroll.replaceChildren(...previewNodes);
  },
  parsedPages: currentPages,
  uploadedFiles: [],
  previewCanvases: [],
  nup: 2,
  BOOKLET_STRIPS: {},
  triggerPreview() {},
};
context.window = context;

vm.createContext(context);
vm.runInContext(source, context, { filename: 'viewport-lazy-preview.js' });
const api = context.PdfViewportLazyPreview;
assert.equal(api.stage, 'selected-output-window-real-source-hydration');
assert.equal(api.coordinatorInstalled, true);
assert.equal(typeof delegate, 'function');

const samplePages = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  nup: index < 6 ? 2 : 1,
  sourceFile: index < 6 ? '본문.pdf' : '부록.pdf',
  pageType: 'pdf',
  file_index: 0,
  page_index: index,
  excluded: false,
  thumbCanvas: createElement('canvas'),
  pdfPage: {},
}));
context.parsedPages = samplePages;
currentPages = samplePages;
const descriptors = api.buildOutputDescriptors(samplePages);
assert.equal(descriptors.length, 7);
assert.deepEqual(
  JSON.parse(JSON.stringify(descriptors.map((entry) => [entry.outputIndex, entry.cols, entry.rows, entry.sourcePages.length]))),
  [[0, 2, 1, 2], [1, 2, 1, 2], [2, 2, 1, 2], [3, 1, 1, 1], [4, 1, 1, 1], [5, 1, 1, 1], [6, 1, 1, 1]],
);
assert.equal(api.descriptorIndexForPage(samplePages[7], descriptors), 4);
assert.deepEqual(JSON.parse(JSON.stringify(api.chooseWindow(100, 50, 3))), { start: 47, end: 54, center: 50, total: 100 });
assert.deepEqual(JSON.parse(JSON.stringify(api.chooseWindow(4, 0, 3))), { start: 0, end: 4, center: 0, total: 4 });
assert.deepEqual(JSON.parse(JSON.stringify(api.chooseWindow(10, 9, 2))), { start: 5, end: 10, center: 9, total: 10 });
assert.equal(api.isActive(Array.from({ length: 81 }, () => ({}))), true);
context.__pdfEditorFastMode = false;
assert.equal(api.isActive(Array.from({ length: 80 }, () => ({}))), false);
context.__pdfEditorFastMode = true;
assert.equal(api.isLightweightPage({ lightweight: true }), true);
assert.equal(api.isLightweightPage({ pdfPage: { __lightweightPdfPage: true } }), true);

(async () => {
  outputCalls = [];
  editCalls = [];
  context.parsedPages = samplePages.slice(0, 4);
  context.previewCanvases = [];
  const rendered = await api.renderLazyWindow(1);
  assert.equal(rendered, true);
  assert.equal(outputCalls.length, 2);
  assert.deepEqual(outputCalls.map((call) => call.outputIndex), [0, 1]);
  assert.deepEqual(editCalls.map((call) => [call.outputIndex, call.total]), [[0, 2], [1, 2]]);
  assert.equal(previewNodes.length, 2);
  assert.deepEqual(previewNodes.map((node) => Number(node.dataset.outputIndex)), [0, 1]);
  assert.equal(previewNodes[1].dataset.lazySelected, 'true');
  assert.equal(elements.get('previewPages').textContent, '전체 2개 중 1–2 출력면');
  assert.equal(elements.get('pdfLazyPreviewOutputNumber').value, '2');

  const lightweight = {
    id: 99,
    nup: 1,
    sourceFile: '초대용량.pdf',
    pageType: 'pdf',
    file_index: 0,
    page_index: 44,
    excluded: false,
    lightweight: true,
    thumbCanvas: Object.assign(createElement('canvas'), { dataset: { lightweightPage: '1' } }),
    pdfPage: { __lightweightPdfPage: true },
  };
  context.parsedPages = [lightweight];
  context.uploadedFiles = [{
    name: '초대용량.pdf',
    async arrayBuffer() { return 'source-buffer'; },
  }];
  context.__pdfEditorExtremeMode = true;
  context.PdfImportTransactionSafety = {
    async safePdfGetDocument(buffer, heavy) {
      sourceDocumentOpens += 1;
      assert.equal(buffer, 'source-buffer');
      assert.equal(heavy, true);
      return {
        async getPage(number) {
          assert.equal(number, 45);
          return { cleanup() {} };
        },
        async destroy() { sourceDocumentDestroys += 1; },
      };
    },
    async safeRenderPdfPage(pdfPage, scale, rotation, heavy) {
      hydratedRenders += 1;
      assert.equal(scale, 0.62);
      assert.equal(rotation, 0);
      assert.equal(heavy, true);
      const canvas = createElement('canvas');
      canvas.width = 360;
      canvas.height = 510;
      canvas.dataset.realSource = '1';
      return canvas;
    },
  };
  outputCalls = [];
  editCalls = [];
  const hydrated = await api.renderLazyWindow(0);
  assert.equal(hydrated, true);
  assert.equal(sourceDocumentOpens, 1);
  assert.equal(sourceDocumentDestroys, 1);
  assert.equal(hydratedRenders, 1);
  assert.equal(outputCalls.length, 1);
  assert.equal(outputCalls[0].selected[0].lightweight, false);
  assert.equal(outputCalls[0].selected[0].thumbCanvas.dataset.realSource, '1');
  assert.deepEqual(editCalls.map((call) => [call.outputIndex, call.total]), [[0, 1]]);
  assert.equal(previewNodes[0].dataset.outputIndex, '0');
  assert.equal(context.previewCanvases.length, 1);

  assert.equal(typeof documentListeners.click, 'function');
  assert.equal(typeof documentListeners.keydown, 'function');
  assert.equal(typeof documentListeners.wheel, 'function');
  assert.ok(statusCalls.some(([message]) => String(message).includes('작업 미리보기 완료')));
  console.log('pdf-viewport-lazy-preview behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
