const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'js', 'cover-template-surface-cleanup.js'), 'utf8');

class Element {
  constructor(tagName = 'div', id = '') {
    this.tagName = tagName.toUpperCase();
    this.id = id;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.textContent = '';
    this.innerHTML = '';
  }
  appendChild(child) {
    if (child.parentElement) child.remove();
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  replaceChildren(...children) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    for (const child of children) this.appendChild(child);
  }
  remove() {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  querySelector(selector) {
    if (selector === 'label') return walk(this).find((node) => node.tagName === 'LABEL') || null;
    if (selector.startsWith('#')) return walk(this).find((node) => node.id === selector.slice(1)) || null;
    return null;
  }
}

function walk(root) {
  const nodes = [];
  for (const child of root.children) {
    nodes.push(child, ...walk(child));
  }
  return nodes;
}

const documentRoot = new Element('body');
const registry = new Map();
function add(parent, tagName, id = '') {
  const node = new Element(tagName, id);
  parent.appendChild(node);
  if (id) registry.set(id, node);
  return node;
}

const card = add(documentRoot, 'section', 'templateCard');
add(card, 'div', 'oldHeader');
const builtin = add(card, 'div', 'builtinBlock');
add(builtin, 'select', 'coverBuiltinPreset');
add(builtin, 'button', 'applyBuiltinPreset');
const personal = add(card, 'div', 'personalBlock');
add(personal, 'select', 'userCoverTemplate');
add(personal, 'input', 'userCoverTemplateName');
add(personal, 'button', 'saveUserCoverTemplate');
add(personal, 'button', 'applyUserCoverTemplate');
add(personal, 'button', 'deleteUserCoverTemplate');
const admin = add(card, 'div', 'adminBlock');
add(admin, 'label', 'adminLabel').textContent = '관리자 제공 이미지 템플릿';
add(admin, 'select', 'coverTemplateSelect');
add(admin, 'div', 'coverTemplateInfo');
add(admin, 'div', 'adminTemplateArea');

const document = {
  readyState: 'complete',
  body: documentRoot,
  createElement: (tagName) => new Element(tagName),
  getElementById: (id) => registry.get(id) || null,
  addEventListener() {},
};

const window = {};
const context = {
  window,
  document,
  location: { pathname: '/perfect-binding-cover/' },
  setTimeout: (fn) => { fn(); return 1; },
  console,
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'cover-template-surface-cleanup.js' });

assert.strictEqual(card.dataset.adminImageOnly, '1');
assert.strictEqual(card.children.length, 2);
assert.strictEqual(card.children[1], admin);
assert.ok(card.children[0].innerHTML.includes('제공 이미지 템플릿'));
assert.strictEqual(admin.style.marginTop, '0');
assert.strictEqual(admin.style.paddingTop, '0');
assert.strictEqual(admin.style.borderTop, '0');
assert.strictEqual(card.attributes['aria-label'], '관리자 제공 이미지 템플릿');
assert.ok(walk(card).some((node) => node.id === 'coverTemplateSelect'));
assert.ok(walk(card).some((node) => node.id === 'adminTemplateArea'));
for (const id of [
  'coverBuiltinPreset', 'applyBuiltinPreset', 'userCoverTemplate', 'userCoverTemplateName',
  'saveUserCoverTemplate', 'applyUserCoverTemplate', 'deleteUserCoverTemplate',
]) {
  assert.ok(!walk(card).some((node) => node.id === id), `${id} should not remain in the active card`);
}
assert.strictEqual(window.CoverTemplateSurfaceCleanup.stage, 'admin-image-template-only');
console.log('cover-template-surface-cleanup behavior passed');
