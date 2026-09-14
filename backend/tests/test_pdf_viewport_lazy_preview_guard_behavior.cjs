const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/viewport-lazy-preview-guard.js'),
  'utf8',
);

function node(className = '') {
  return {
    className,
    dataset: {},
    hidden: false,
    disabled: false,
    tabIndex: 0,
    textContent: '',
    children: [],
    attrs: {},
    style: { removeProperty() {} },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(child) { this.children.push(child); return child; },
    querySelector(selector) {
      if (selector === '.lazy-preview-face-label') return this.primary || null;
      if (selector === '.pdf-lazy-global-label') return this.global || null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button') return this.buttons || [];
      if (selector === '.pdf-output-source-label') return this.legacyLabels || [];
      return [];
    },
  };
}

const insertButton = node('prev-ins-btn');
insertButton.disabled = true;
insertButton.tabIndex = -1;
insertButton.attrs['aria-disabled'] = 'true';
const zone = node('prev-ins-zone');
zone.hidden = true;
zone.attrs['aria-hidden'] = 'true';
zone.buttons = [insertButton];
const primary = node('lazy-preview-face-label');
const legacy = node('pdf-output-source-label');
const page = node('page-preview');
page.dataset.outputIndex = '47';
page.primary = primary;
page.legacyLabels = [legacy];
const previewScroll = node('preview-scroll');
previewScroll.dataset.lazyPreview = 'true';
previewScroll.querySelectorAll = (selector) => {
  if (selector === '.prev-ins-zone,.prev-ins-zone-v') return [zone];
  if (selector === '.page-preview[data-output-index]') return [page];
  return [];
};
const booklet = { checked: false };
const elements = new Map([
  ['previewScroll', previewScroll],
  ['bookletCheck', booklet],
]);
const listeners = {};
const timers = [];
const document = {
  documentElement: { dataset: {} },
  head: { appendChild() {} },
  getElementById(id) { return elements.get(id) || null; },
  createElement() { return node(); },
  addEventListener(type, listener) { listeners[type] = listener; },
};

class MutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}

const pages = [
  { id: 1, pageType: 'pdf', pdfPage: {}, rotation: 0 },
  { id: 2, pageType: 'pdf', pdfPage: {}, rotation: 0 },
  { id: 3, pageType: 'blank', rotation: 0 },
];
let lazyRenderCount = 0;
let lazyRenderIndex = null;
const context = {
  console,
  document,
  MutationObserver,
  location: { pathname: '/pdf-editor/index.html' },
  requestAnimationFrame(callback) { callback(); return 0; },
  setTimeout(callback) { timers.push(callback); return timers.length; },
  Number,
  String,
  Math,
  Promise,
  parsedPages: pages,
};
context.window = context;
context.__pdfEditorLazyPreviewActive = true;
context.PdfEditorPageSelection = { selectedIds: new Set([1, 2, 3]) };
context.PdfViewportLazyPreview = {
  getCurrentOutputIndex() { return 12; },
  requestRender(index) { lazyRenderIndex = index; lazyRenderCount += 1; return Promise.resolve(true); },
};
vm.createContext(context);
vm.runInContext(source, context, { filename: 'viewport-lazy-preview-guard.js' });
const api = context.PdfViewportLazyPreviewGuard;
assert.equal(api.stage, 'canvas-insert-and-right-preview-sync-v3');
assert.equal(api.lazyActive(), true);
assert.equal(api.globalFaceLabel(47), '출력면 48');
assert.equal(api.refresh(), true);
assert.equal(zone.hidden, false);
assert.equal(zone.attrs['aria-hidden'], undefined);
assert.equal(insertButton.disabled, false);
assert.equal(insertButton.tabIndex, 0);
assert.equal(insertButton.attrs['aria-disabled'], 'false');
assert.equal(document.documentElement.dataset.pdfLazyPreviewCanvasInsert, 'enabled');
assert.equal(legacy.hidden, true);
assert.equal(primary.textContent, '출력면 48');
assert.equal(primary.dataset.globalOutputIndex, '47');

booklet.checked = true;
assert.equal(api.globalFaceLabel(46), '24번 용지 앞면 · 출력면 47');
assert.equal(api.globalFaceLabel(47), '24번 용지 뒷면 · 출력면 48');
api.correctGlobalLabels(previewScroll);
assert.equal(primary.textContent, '24번 용지 뒷면 · 출력면 48');

const rotationSnapshot = Array.from(
  api.selectedRotationSnapshot(),
  (entry) => ({ id: entry.id, rotation: entry.rotation }),
);
assert.deepEqual(rotationSnapshot, [{ id: 1, rotation: 0 }, { id: 2, rotation: 0 }]);
const rotateItem = { textContent: '↻ 선택 시계방향 90° 회전' };
listeners.click({
  target: { closest(selector) { return selector === '#thumbCtxMenu .ctx-item' ? rotateItem : null; } },
});
pages[0].rotation = 90;
pages[1].rotation = 90;
while (timers.length) timers.shift()();
assert.equal(lazyRenderCount, 1);
assert.equal(lazyRenderIndex, 12);
console.log('pdf-viewport-lazy-preview-guard behavior passed');
