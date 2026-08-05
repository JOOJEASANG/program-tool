'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/cover-ui-runtime-normalizer.js', 'utf8');

class ClassList {
  constructor(...names) { this.names = new Set(names); }
  contains(name) { return this.names.has(name); }
  add(name) { this.names.add(name); }
  remove(name) { this.names.delete(name); }
  toggle(name, force) {
    const next = force === undefined ? !this.names.has(name) : Boolean(force);
    if (next) this.names.add(name);
    else this.names.delete(name);
    return next;
  }
}

class Element {
  constructor(id = '', classes = []) {
    this.id = id;
    this.classList = new ClassList(...classes);
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.attributes = {};
  }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  matches(selector) {
    return selector.includes('input') && this.id.startsWith('color');
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener() {}
}

const parent1 = new Element('parent1');
const input1 = parent1.appendChild(new Element('colorStatic'));
const cover1 = parent1.appendChild(new Element('cover1', ['cover-color-palette']));
const visual1 = parent1.appendChild(new Element('visual1', ['visual-color-palette']));
const parent2 = new Element('parent2');
const input2 = parent2.appendChild(new Element('colorDynamic'));
const cover2 = parent2.appendChild(new Element('cover2', ['cover-color-palette']));
const status = new Element('status');
const documentElement = new Element('html');
const head = new Element('head');
const body = new Element('body');
const ids = new Map([['status', status]]);

const documentObject = {
  documentElement,
  head,
  activeElement: input1,
  querySelectorAll(selector) { return selector === 'input[type="color"]' ? [input1, input2] : []; },
  getElementById(id) { return ids.get(id) || null; },
  createElement(tag) { return new Element(tag); },
  addEventListener() {},
};

const viewport = {
  height: 600,
  addEventListener() {},
};
const windowObject = {
  innerHeight: 1000,
  visualViewport: viewport,
  matchMedia() { return { matches: true }; },
  addEventListener() {},
};

const context = {
  window: windowObject,
  document: documentObject,
  location: { pathname: '/perfect-binding-cover/' },
  setTimeout(callback) { callback(); return 1; },
  console,
};
windowObject.window = windowObject;
windowObject.document = documentObject;
vm.createContext(context);
vm.runInContext(source, context);

const api = windowObject.CoverUiRuntimeNormalizer;
assert(api, 'CoverUiRuntimeNormalizer API must be exposed');
assert.strictEqual(api.stage, 'palette-mobile-dock-runtime-normalization');
assert.strictEqual(parent1.children.includes(cover1), false);
assert.strictEqual(parent1.children.includes(visual1), true);
assert.strictEqual(input1.dataset.coverPaletteOwner, 'visual');
assert.strictEqual(parent2.children.includes(cover2), true);
assert.strictEqual(input2.dataset.coverPaletteOwner, 'cover');
assert.strictEqual(documentElement.classList.contains('cover-virtual-keyboard-open'), true);
assert.strictEqual(status.attributes.role, 'status');
assert.strictEqual(status.attributes['aria-live'], 'polite');
assert.strictEqual(head.children.some((child) => child.id === 'coverKeyboardDockSafetyStyle'), true);

documentObject.activeElement = body;
viewport.height = 920;
assert.strictEqual(api.updateKeyboardState(), false);
assert.strictEqual(documentElement.classList.contains('cover-virtual-keyboard-open'), false);

console.log('cover-ui-runtime-normalizer behavior passed');
