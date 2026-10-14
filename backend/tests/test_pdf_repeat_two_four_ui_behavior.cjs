const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.resolve(__dirname, '../../js/pdf-editor/nup-repeat.js'), 'utf8');
const editor = fs.readFileSync(path.resolve(__dirname, '../../pdf-editor/index.html'), 'utf8');
const canonicalStart = editor.indexOf('function groupByNup(pages) {');
const canonicalEnd = editor.indexOf('// ── Draw one page into a cell', canonicalStart);
assert.ok(canonicalStart !== -1 && canonicalEnd > canonicalStart);
const canonicalGroupSource = editor.slice(canonicalStart, canonicalEnd);
const registry = new Map();
const repeatButtons = [];
function node(tag) {
  let id = '';
  const item = {
    tagName: tag.toUpperCase(), dataset: {}, style: {}, checked: false,
    disabled: false, value: '', textContent: '', listeners: {},
    children: [],
    get id() { return id; },
    set id(value) { id = value; registry.set(id, item); },
    classList: {toggle(name, enabled) { item.active = enabled; }},
    append(...children) { item.children.push(...children); },
    appendChild(child) { item.children.push(child); return child; },
    setAttribute(name, value) { item[name] = value; },
    addEventListener(event, callback) { item.listeners[event] = callback; },
    insertAdjacentElement(_position, child) { item.children.push(child); },
  };
  return item;
}
const grid = node('div'); grid.id = 'nupGrid';
const booklet = node('input'); booklet.id = 'bookletCheck';
const head = node('head');
const document = {
  readyState: 'complete',
  documentElement: {dataset: {}}, head,
  createElement: node,
  getElementById: id => registry.get(id) || null,
  querySelectorAll: selector => selector === '[data-repeat-count]' ? repeatButtons : [],
  addEventListener() {},
};
const originalCreate = document.createElement;
document.createElement = tag => {
  const el = originalCreate(tag);
  if (tag === 'button') repeatButtons.push(el);
  return el;
};
const saved = new Map([
  ['programToolPdfNupRepeatSamePageV1', '1'], // Legacy ON preference MUST NOT reactivate the checkbox.
  ['programToolPdfNupRepeatCountV2', '3'], // Migrated to 4, not exposed as third button.
]);
const localStorage = {
  getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem: (key, val) => saved.set(key, String(val)),
};
const context = {
  document, localStorage, console,
  setTimeout() {},
  // The real inline editor groupByNup() also performs repetition; test that
  // the extension does not replicate those repeated groups a second time.
  apiProcessPdf(_files, settings) { return settings; },
  collectEditorState() { return {}; },
  async loadEditorSession() {return true;},
  MutationObserver: class {observe() {}},
  queueMicrotask() {},
};
context.window = context;
vm.createContext(context);
vm.runInContext(
  'const NUP_LAYOUTS = {1:{},2:{},4:{}}; const fileNupMap = {}; let nup = 2;\n' + canonicalGroupSource,
  context,
  {filename: 'pdf-editor-inline-group-by-nup.js'},
);
vm.runInContext(src, context, {filename: 'nup-repeat.js'});
(async () => {
  const api = context.PdfEditorNupRepeat;
  assert.equal(api.enabled(), false, 'must start unchecked even after legacy ON preference');
  assert.equal(api.count(), 4, 'old 3-copy choice migrates to supported 4');
  assert.deepEqual(repeatButtons.map(b => b.textContent), ['2개', '4개']);
  assert.ok(repeatButtons.every(b => b.disabled), 'buttons disabled while repeat is off');
  const firstPage = {page_index:0, file_index:0, excluded:false};
  assert.equal(api.repeatGroups([{n:2,pages:[firstPage]}])[0].pages.length, 1);

  api.setEnabled(true, {schedule:false});
  assert.ok(repeatButtons.every(b => !b.disabled));
  api.setCount(2, {schedule:false, persist:false});
  const two = api.expandSettingsPages({pages:[firstPage],booklet:false});
  assert.equal(two.repeat_cell_overlays, true);
  assert.equal(two.pages.length, 2);
  assert.ok(two.pages.every(p => p.nup_override === 2));
  assert.equal(api.expandSettingsPages(two).pages.length, 2, 'repeat payload must not double-expand');

  api.setCount(4, {schedule:false, persist:false});
  const four = api.expandSettingsPages({pages:[firstPage],booklet:false});
  assert.equal(four.pages.length, 4);
  assert.ok(four.pages.every(p => p.nup_override === 4));
  assert.equal(api.repeatGroups([{n:2,pages:[firstPage]}])[0].pages.length, 4);
  assert.ok(repeatButtons[1].active);
  assert.equal(api.expandSettingsPages(four).pages.length, 4);

  // The mixed source order is the user's actual edited page-list order,
  // including moving pages from separate uploaded PDFs into the middle.
  const mixed = [
    {id: 1, file_index:0, page_index:0, pageType:'pdf', excluded:false},
    {id: 5, file_index:1, page_index:1, pageType:'pdf', excluded:false},
    {id: 2, file_index:0, page_index:1, pageType:'pdf', excluded:false},
    {id: 6, file_index:1, page_index:2, pageType:'pdf', excluded:false},
    {id: 3, file_index:0, page_index:2, pageType:'pdf', excluded:false},
  ];
  for (const count of [2, 4]) {
    api.setCount(count, {schedule:false, persist:false});
    const groups = context.groupByNup(mixed);
    assert.equal(groups.length, mixed.length,
      `${count}-up: each original edited page must consume exactly one output sheet`);
    groups.forEach((group, index) => {
      assert.equal(group.repeated, true);
      assert.equal(group.n, count);
      assert.equal(group.pages.length, count, 'same source must appear only in its own sheet');
      assert.ok(group.pages.every(p => p === mixed[index]),
        'the NEXT output sheet must advance to the NEXT reordered source page');
    });
    const again = api.repeatGroups(groups);
    assert.equal(again.length, mixed.length);
    again.forEach((group, index) => {
      assert.equal(group.pages.length, count, 'repeating a finished group must be idempotent');
      assert.ok(group.pages.every(p => p === mixed[index]));
    });
    const expanded = api.expandSettingsPages({pages:mixed.map(p => ({
      file_index:p.file_index, page_index:p.page_index, excluded:false,
    })),booklet:false});
    assert.equal(expanded.pages.length, mixed.length * count);
    for (let index = 0; index < mixed.length; index += 1) {
      const batch = expanded.pages.slice(index * count, (index + 1) * count);
      assert.ok(batch.every(p => p.file_index === mixed[index].file_index
        && p.page_index === mixed[index].page_index));
      assert.equal(batch[0].group_break, true);
      assert.ok(batch.slice(1).every(p => !p.group_break));
    }
    assert.equal(api.expandSettingsPages(expanded).pages.length, mixed.length * count);
  }

  api.setEnabled(false, {schedule:false});
  assert.equal(api.enabled(), false);
  await context.loadEditorSession({state: JSON.stringify({repeatSamePage:true, repeatSamePageCount:2})});
  assert.equal(api.enabled(), true, 'saved editor session explicitly restores repeat setting');
  assert.equal(api.count(), 2);
  console.log('pdf repeat two-four UI behavior passed');
})().catch(err => { console.error(err); process.exitCode=1; });
