'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/pdf-editor/file-context-scope.js', 'utf8');

class Element {
  constructor(id = '') {
    this.id = id;
    this.className = '';
    this.children = [];
    this.listeners = {};
    this.classList = {
      add: () => {},
      remove: () => {},
    };
  }
  append(...children) { this.children.push(...children); }
  prepend(child) { this.children.unshift(child); }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const thumbArea = new Element('thumbArea');
const thumbMenu = new Element('thumbCtxMenu');
const document = {
  readyState: 'complete',
  getElementById(id) {
    if (id === 'thumbArea') return thumbArea;
    if (id === 'thumbCtxMenu') return thumbMenu;
    return null;
  },
  createElement() { return new Element(); },
  createTextNode(text) { return { textContent: text }; },
  addEventListener() {},
};

class MutationObserver {
  constructor(callback) { this.callback = callback; }
  observe() { this.callback(); }
}

const pages = [
  { file_index: 0, page_index: 0, pageType: 'pdf', pdfPage: {}, sourceFile: 'first.pdf', groupBreak: false },
  { file_index: 1, page_index: 0, pageType: 'pdf', pdfPage: {}, sourceFile: 'break.pdf', groupBreak: true },
  { file_index: 1, page_index: 1, pageType: 'pdf', pdfPage: {}, sourceFile: 'break.pdf', groupBreak: false },
  { file_index: 2, page_index: 0, pageType: 'pdf', pdfPage: {}, sourceFile: 'continuous.pdf', groupBreak: false },
];

const context = {
  window: {
    _openThumbCtxMenu() {},
  },
  document,
  MutationObserver,
  parsedPages: pages,
  renderPdfPage: async () => ({}),
  renderThumbs() {},
  schedulePreview() {},
  setTimeout,
  console,
};
context.window.window = context.window;
context.window.document = document;
vm.createContext(context);
vm.runInContext(source, context);

const api = context.window.PdfFileContextScope;
assert(api, 'PdfFileContextScope API must be exposed');

const fileScope = api.resolveScopeFor(pages[1], pages, new Set([1]));
assert.strictEqual(fileScope.mode, 'file');
assert.strictEqual(fileScope.fileIndex, 1);
assert.strictEqual(fileScope.pages.length, 2);
assert(fileScope.pages.every((page) => page.file_index === 1));

const documentScope = api.resolveScopeFor(pages[3], pages, new Set([1]));
assert.strictEqual(documentScope.mode, 'document');
assert.strictEqual(documentScope.pages.length, 4);

const noCrossFileLeak = fileScope.pages.some((page) => page.file_index !== 1);
assert.strictEqual(noCrossFileLeak, false);
console.log('file-context-scope behavior passed');
