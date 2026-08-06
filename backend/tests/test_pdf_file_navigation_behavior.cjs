const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/pdf-editor/file-navigation.js'),
  'utf8',
);

const pages = [
  { id: 1, file_index: 0, page_index: 0, sourceFile: '본문.pdf', excluded: false },
  { id: 2, pageType: 'blank', excluded: false },
  { id: 3, file_index: 0, page_index: 2, sourceFile: '본문.pdf', excluded: true },
  { id: 4, file_index: 1, page_index: 0, sourceFile: '부록.pdf', excluded: false },
  { id: 5, file_index: 1, page_index: 1, sourceFile: '부록.pdf', excluded: false },
  { id: 6, file_index: 0, page_index: 3, sourceFile: '본문.pdf', excluded: false },
];
const files = [{ name: '본문 원본.pdf' }, { name: '부록 원본.pdf' }];

const document = {
  getElementById() { return null; },
  createElement() { return {}; },
  addEventListener() {},
  documentElement: { dataset: {} },
};
const context = {
  console,
  document,
  location: { pathname: '/pdf-editor/index.html' },
  parsedPages: pages,
  uploadedFiles: files,
  setTimeout() { return 0; },
  requestAnimationFrame() { return 0; },
  MutationObserver: function MutationObserver() {},
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  Math,
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'file-navigation.js' });
const api = context.PdfFileNavigation;

(async () => {
  assert.equal(api.stage, 'file-collapse-edited-original-page-jump');
  assert.deepEqual(JSON.parse(JSON.stringify(api.uniqueNumbers([3, 1, 3, 2]))), [1, 2, 3]);
  assert.equal(api.compactRanges([1, 2, 3, 7, 8]), '1–3, 7–8');
  assert.equal(api.compactRanges([1, 3, 5]), '1, 3 외 1구간');
  assert.equal(api.compactRanges([]), '없음');

  const groups = api.buildFileGroups(pages, files);
  assert.equal(groups.size, 2);
  const main = groups.get('0');
  assert.equal(main.name, '본문.pdf');
  assert.deepEqual(JSON.parse(JSON.stringify(main.edited)), [1, 3, 6]);
  assert.deepEqual(JSON.parse(JSON.stringify(main.originals)), [1, 3, 4]);
  assert.equal(main.editedRange, '1, 3 외 1구간');
  assert.equal(main.originalRange, '1, 3–4');
  assert.equal(main.pages.length, 3);
  assert.equal(main.excluded, 1);
  assert.equal(main.segments, 3);
  assert.ok(main.summary.includes('숨김 1'));

  const appendix = groups.get('1');
  assert.equal(appendix.editedRange, '4–5');
  assert.equal(appendix.originalRange, '1–2');
  assert.equal(appendix.segments, 1);

  assert.equal(api.editedPageAt(1, pages).id, 1);
  assert.equal(api.editedPageAt(2, pages).id, 2);
  assert.equal(api.editedPageAt(0, pages), null);
  assert.equal(api.editedPageAt(20, pages), null);
  assert.equal(api.originalPageAt(0, 3, pages).id, 3);
  assert.equal(api.originalPageAt(1, 2, pages).id, 5);
  assert.equal(api.originalPageAt(0, 2, pages), null);

  api.toggleFile('0');
  assert.equal(api.getCollapsedFiles().has('0'), true);
  api.toggleFile('0');
  assert.equal(api.getCollapsedFiles().has('0'), false);
  api.collapseAll();
  assert.deepEqual([...api.getCollapsedFiles()].sort(), ['0', '1']);
  assert.equal(
    await api.showOutput(pages[2]),
    false,
    'excluded page without an output descriptor must preserve the current preview',
  );
  api.expandAll();
  assert.equal(api.getCollapsedFiles().size, 0);

  console.log('pdf-file-navigation behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
