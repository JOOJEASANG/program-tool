const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/pdf-editor/page-count-hint.js'), 'utf8');
const makePages = () => [1, 2, 3, 4].map(id => ({
  id, pageType: 'pdf', pdfPage: {id}, excluded: false, rotation: 0, thumbCanvas: {id},
}));
let nextId = 100, renders = 0, previews = 0, rotations = 0;
const host = {
  console,
  document: {
    readyState: 'loading',
    getElementById() { return null; },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  parsedPages: makePages(),
  uploadedFiles: [{name: '본문.pdf', size: 100, lastModified: 1}],
  setTimeout() { return 0; },
  clearTimeout() {},
  requestAnimationFrame() { return 0; },
  queueMicrotask(callback) { callback(); },
  MutationObserver: class {},
  showStatus() {},
  hideStatus() {},
  renderThumbs() { renders++; },
  schedulePreview() { previews++; },
  makeBlankPage() { return {id: nextId++, pageType: 'blank', excluded: false, rotation: 0}; },
  async renderPdfPage(_pdf, _scale, rotate) { rotations++; return {rotated: rotate}; },
};
host.window = host;
vm.createContext(host);
vm.runInContext(source, host, {filename:'page-count-hint.js'});
const api = host.PdfPageProductivity;
assert(api, 'page productivity public API must load');
const ids = () => host.parsedPages.map(p => p.id);
const check = (actual, expected, msg) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, msg);
const selected = () => { api.clearSelection(); api.setSelectionMode(true); api.selectedIds.add(1); api.selectedIds.add(2); };

(async () => {
  selected();
  check(api.contextSelectionIdsForPage(host.parsedPages[0]), [1, 2], 'checked page includes full selection');
  check(api.contextSelectionIdsForPage(host.parsedPages[2]), [], 'unselected right-click is single-page');
  api.setSelectionMode(false);
  check(api.contextSelectionIdsForPage(host.parsedPages[0]), [], 'outside selection mode is single-page');

  selected();
  const snapshot = api.contextSelectionIdsForPage(host.parsedPages[0]);
  assert.equal(await api.runContextAction('rotate', snapshot, 90), true);
  check(host.parsedPages.map(p=>p.rotation), [90,90,0,0], 'both checked pages rotate');
  assert.equal(rotations, 2, 'both PDF thumbnails regenerated');
  await api.undo();
  check(host.parsedPages.map(p=>p.rotation), [0,0,0,0], 'one undo restores whole rotation');
  await api.redo();
  check(host.parsedPages.map(p=>p.rotation), [90,90,0,0], 'one redo reapplies whole rotation');

  selected();
  assert.equal(await api.runContextAction('hide', snapshot), true);
  check(host.parsedPages.map(p=>p.excluded), [true,true,false,false], 'hide applies only to checked pages');
  await api.undo();
  check(host.parsedPages.map(p=>p.excluded), [false,false,false,false], 'undo restores hidden pages');
  assert.equal(await api.runContextAction('hide', snapshot), true);
  assert.equal(await api.runContextAction('show', snapshot), true);
  check(host.parsedPages.map(p=>p.excluded), [false,false,false,false], 'unhide applies to all checked pages');

  selected();
  assert.equal(await api.runContextAction('insertBefore', snapshot), true);
  check(ids(), [100,1,101,2,3,4], 'one blank before each checked page');
  await api.undo();
  check(ids(), [1,2,3,4], 'undo removes all new blanks together');
  assert.equal(await api.runContextAction('insertAfter', snapshot), true);
  check(ids(), [1,102,2,103,3,4], 'one blank after each checked page');
  await api.undo();
  check(ids(), [1,2,3,4], 'undo restores original ordering');

  selected();
  assert.equal(await api.runContextAction('delete', snapshot), true);
  check(ids(), [3,4], 'delete removes both checked pages only');
  assert.equal(api.selectedIds.size, 0, 'deleted page selection is cleared');
  await api.undo();
  check(ids(), [1,2,3,4], 'undo restores both deleted pages');

  assert.equal(await api.runContextAction('rotate', [9999], 90), false, 'stale context IDs cannot change pages');
  assert.ok(renders > 0 && previews > 0, 'batch operations refresh sidebar and right preview');
  console.log('pdf-editor batch right-click behavior passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
