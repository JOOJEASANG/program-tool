const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-layout-lock.js'),
  'utf8',
);

function element(id, disabled = false) {
  const attributes = new Map();
  return {
    id,
    disabled,
    style: {},
    attributes,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
  };
}

const canvas = element('previewCanvas');
const posX = element('posX');
const posY = element('posY', true);
const reset = element('resetTargetBtn');
const controls = [posX, posY, reset];
const byId = new Map([
  ['previewCanvas', canvas],
]);
const storage = new Map();
const dispatched = [];
const document = {
  documentElement: { dataset: {}, style: {} },
  head: { appendChild() {} },
  getElementById(id) { return byId.get(id) || null; },
  createElement() { return { id: '', textContent: '' }; },
  querySelector() { return null; },
  querySelectorAll(selector) {
    assert.ok(selector.includes('#posX'));
    return controls;
  },
  addEventListener() {},
  dispatchEvent(event) { dispatched.push(event); return true; },
};
const localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, String(value)); },
};
class CustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}
const window = {};
const context = vm.createContext({
  window,
  document,
  localStorage,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  CustomEvent,
});
vm.runInContext(source, context, { filename: 'cover-layout-lock.js' });

const api = window.CoverLayoutLock;
assert.equal(api.stage, 'accidental-layout-change-protection');
assert.equal(api.locked, false);

assert.equal(api.setLocked(true, false), true);
assert.equal(api.locked, true);
assert.equal(storage.get('programTool.coverEditor.layoutLock.v1'), '1');
assert.equal(document.documentElement.dataset.coverLayoutLocked, '1');
assert.equal(canvas.style.pointerEvents, 'none');
assert.equal(canvas.getAttribute('aria-disabled'), 'true');
assert.equal(posX.disabled, true);
assert.equal(posY.disabled, true);
assert.equal(reset.disabled, true);
assert.equal(posX.getAttribute('data-cover-layout-lock-was-disabled'), '0');
assert.equal(posY.getAttribute('data-cover-layout-lock-was-disabled'), '1');
assert.equal(dispatched.at(-1).type, 'cover-layout-lock-change');
assert.deepEqual(JSON.parse(JSON.stringify(dispatched.at(-1).detail)), { locked: true });

assert.equal(api.setLocked(false, false), false);
assert.equal(api.locked, false);
assert.equal(storage.get('programTool.coverEditor.layoutLock.v1'), '0');
assert.equal(document.documentElement.dataset.coverLayoutLocked, '0');
assert.equal(canvas.style.pointerEvents, '');
assert.equal(canvas.getAttribute('aria-disabled'), null);
assert.equal(posX.disabled, false);
assert.equal(posY.disabled, true, 'control disabled before locking must stay disabled');
assert.equal(reset.disabled, false);
assert.equal(posX.getAttribute('data-cover-layout-lock-was-disabled'), null);
assert.deepEqual(JSON.parse(JSON.stringify(dispatched.at(-1).detail)), { locked: false });
console.log('cover-layout-lock behavior passed');
