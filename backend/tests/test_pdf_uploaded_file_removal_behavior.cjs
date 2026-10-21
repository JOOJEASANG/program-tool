const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const combined = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/file-context-scope.js'), 'utf8'
);
const source = combined.slice(combined.indexOf('// Uploaded PDF source removal:'));

function mockElement() {
  return {
    dataset: {}, disabled: false, textContent: '', children: [],
    appendChild(child) { this.children.push(child); return child; },
    replaceChildren(...children) { this.children = [...children]; },
    classList: { remove() {} },
  };
}

const ids = ['uploadZone', 'previewScroll', 'pdfLazyPreviewNav', 'previewInfo',
  'previewPages', 'previewBtn', 'downloadBtn', 'thumbCtxMenu'];
const elements = new Map(ids.map(id => [id, mockElement()]));
const events = [];
let confirmed = true;
let renders = 0;
let previews = 0;
let cleared = 0;
let modeSyncs = 0;
const context = {
  console,
  location: { pathname: '/pdf-editor/' },
  document: {
    getElementById(id) { return elements.get(id) || null; },
    createElement(tag) { const element = mockElement(); element.tagName = tag; return element; },
    dispatchEvent(event) { events.push(event); },
  },
  CustomEvent: class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  },
  confirm() { return confirmed; },
  uploadedFiles: [{ name: 'first.pdf' }, { name: 'middle.pdf' }, { name: 'last.pdf' }],
  parsedPages: [
    { id: 1, file_index: 0, page_index: 0, pageType: 'pdf' },
    { id: 2, file_index: 1, page_index: 0, pageType: 'pdf' },
    { id: 3, file_index: 1, page_index: 1, pageType: 'pdf', excluded: true },
    { id: 4, file_index: 2, page_index: 0, pageType: 'pdf', rotation: 90 },
    { id: 5, pageType: 'blank' },
    { id: 6, pageType: 'divider' },
  ],
  fileNupMap: { 0: 2, 1: 4, 2: 8 },
  previewCanvases: [{ width: 10, height: 10 }],
  _uploadMode: 'cont',
  renderThumbs() { renders++; },
  schedulePreview() { previews++; },
  showStatus() {},
  clearTimeout() {},
  PdfEditorPageSelection: { clearSelection() { cleared++; } },
  PdfUploadOptimization: { syncAggregateMode() { modeSyncs++; } },
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'file-removal.js' });
const api = context.PdfUploadedFileRemoval;
assert.ok(api);
assert.equal(api.stage, 'file-source-delete-and-index-compaction');

assert.equal(api.removeFile(7), false, 'invalid file indices must not alter work');
confirmed = false;
assert.equal(api.removeFile(1), false, 'cancel keeps the existing work');
assert.equal(context.uploadedFiles.length, 3);
confirmed = true;

elements.get('uploadZone').dataset.importBusy = '1';
assert.equal(api.removeFile(1), false, 'deleting during an import is unsafe');
elements.get('uploadZone').dataset.importBusy = '0';
assert.equal(api.removeFile(1), true);

assert.deepEqual(context.uploadedFiles.map(file => file.name), ['first.pdf', 'last.pdf']);
assert.deepEqual(context.parsedPages.map(page => page.id), [1, 4, 5, 6]);
assert.equal(context.parsedPages[1].file_index, 1, 'last file is reindexed');
assert.equal(context.parsedPages[1].page_index, 0, 'original page number is unchanged');
assert.equal(context.parsedPages[1].rotation, 90, 'page edits survive deletion');
assert.deepEqual(JSON.parse(JSON.stringify(context.fileNupMap)), { 0: 2, 1: 8 });
assert.equal(context.previewCanvases.length, 0);
assert.equal(context._uploadMode, 'cont');
assert.equal(renders, 1);
assert.equal(previews, 1);
assert.equal(cleared, 1);
assert.equal(modeSyncs, 1);
assert.equal(events[0].type, 'pdf-file-removed');
assert.equal(events[0].detail.pageCount, 2);
assert.equal(elements.get('downloadBtn').disabled, false);

// Removing the last source must not leave a stale preview or active download button.
assert.equal(api.removeFile(1), true);
assert.equal(api.removeFile(0), true);
assert.equal(context.uploadedFiles.length, 0);
assert.deepEqual(context.parsedPages.map(page => page.id), [5, 6], 'standalone blank/divider pages survive');
assert.equal(context._uploadMode, 'cont', 'independent blank pages remain available for a new PDF');
assert.equal(elements.get('downloadBtn').disabled, true);
assert.equal(elements.get('previewBtn').disabled, true);
assert.equal(context.fileNupMap[0], undefined);

// Fully empty work clears the old preview and lazy navigation.
context.parsedPages = [{ id: 7, file_index: 0, page_index: 0, pageType: 'pdf' }];
context.uploadedFiles = [{ name: 'only.pdf' }];
context.fileNupMap = { 0: 4 };
assert.equal(api.removeFile(0), true);
assert.equal(context.parsedPages.length, 0);
assert.equal(elements.get('previewBtn').disabled, true);
assert.equal(elements.get('previewScroll').children[0].className, 'empty-state');
assert.equal(elements.get('pdfLazyPreviewNav').dataset.active, 'false');
assert.equal(context.__pdfEditorLazyPreviewActive, false);

console.log('pdf uploaded source removal behavior passed');
