const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/preview-canvas-action-sync.js'),
  'utf8',
);

const timers = [];
const listeners = {};
const previewScroll = { dataset: { lazyPreview: 'true' } };
const document = {
  documentElement: { dataset: {} },
  getElementById(id) { return id === 'previewScroll' ? previewScroll : null; },
  addEventListener(type, listener) { listeners[type] = listener; },
};

const pages = [
  { id: 1, pageType: 'pdf', pdfPage: {}, rotation: 0 },
  { id: 2, pageType: 'pdf', pdfPage: {}, rotation: 0 },
  { id: 3, pageType: 'blank', rotation: 0 },
];
let renderIndex = null;
let renderCount = 0;
const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  parsedPages: pages,
  setTimeout(callback) { timers.push(callback); return timers.length; },
  Promise,
};
context.window = context;
context.__pdfEditorLazyPreviewActive = true;
context.PdfEditorPageSelection = { selectedIds: new Set([1, 2, 3]) };
context.PdfViewportLazyPreview = {
  getCurrentOutputIndex() { return 12; },
  requestRender(index) { renderIndex = index; renderCount += 1; return Promise.resolve(true); },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: 'preview-canvas-action-sync.js' });
const api = context.PdfPreviewCanvasActionSync;
assert.equal(api.stage, 'right-preview-batch-action-sync-v1');
assert.equal(api.lazyActive(), true);
assert.deepEqual(
  Array.from(api.selectedRotationSnapshot(), (entry) => ({ id: entry.id, rotation: entry.rotation })),
  [{ id: 1, rotation: 0 }, { id: 2, rotation: 0 }],
);

const menuItem = { textContent: '↻ 선택 시계방향 90° 회전' };
listeners.click({ target: { closest(selector) { return selector === '#thumbCtxMenu .ctx-item' ? menuItem : null; } } });
pages[0].rotation = 90;
pages[1].rotation = 90;
while (timers.length) timers.shift()();
assert.equal(renderCount, 1);
assert.equal(renderIndex, 12);
console.log('pdf-preview-canvas-action-sync behavior passed');
