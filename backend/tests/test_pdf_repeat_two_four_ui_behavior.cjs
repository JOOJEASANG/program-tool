const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.resolve(__dirname, '../../js/pdf-editor/nup-repeat.js'), 'utf8');
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
  groupByNup: pages => [{n:2, pages}],
  apiProcessPdf(_files, settings) { return settings; },
  collectEditorState() { return {}; },
  async loadEditorSession() {return true;},
  MutationObserver: class {observe() {}},
  queueMicrotask() {},
};
context.window = context;
vm.createContext(context);
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

  api.setEnabled(false, {schedule:false});
  assert.equal(api.enabled(), false);
  await context.loadEditorSession({state: JSON.stringify({repeatSamePage:true, repeatSamePageCount:2})});
  assert.equal(api.enabled(), true, 'saved editor session explicitly restores repeat setting');
  assert.equal(api.count(), 2);
  console.log('pdf repeat two-four UI behavior passed');
})().catch(err => { console.error(err); process.exitCode=1; });
