'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/cover-output-performance-safety.js', 'utf8');

class Element {
  constructor(id, value = '') {
    this.id = id;
    this.value = value;
    this.checked = false;
    this.dataset = {};
    this.listeners = {};
    this.disabled = false;
    this.textContent = '';
    this.className = '';
  }
  addEventListener(type, listener, options) { this.listeners[type] = { listener, options }; }
  closest() { return { scrollIntoView() {} }; }
  click() {}
  querySelectorAll() { return []; }
}

const elements = new Map();
for (const id of ['pdfBtn', 'guidePdfBtn', 'pngBtn', 'status', 'coverPreflightSummary', 'coverPreflightList']) {
  elements.set(id, new Element(id));
}

let activeSpec = { trimW: 210, trimH: 297, bleed: 3, spine: 8.5, totalW: 434.5, totalH: 303 };
const documentObject = {
  head: { appendChild() {} },
  getElementById(id) { return elements.get(id) || null; },
  querySelector() { return null; },
  createElement() { return new Element('script'); },
};
const windowObject = {
  CoverRuntimeSafety: { hasBlockingPreflightError() { return false; } },
};
const context = {
  window: windowObject,
  document: documentObject,
  location: { pathname: '/perfect-binding-cover/' },
  navigator: { deviceMemory: 2 },
  getSpec() { return activeSpec; },
  setTimeout(callback, delay) { if (delay < 4000) callback(); return 1; },
  console,
};
windowObject.window = windowObject;
windowObject.document = documentObject;
vm.createContext(context);
vm.runInContext(source, context);

const api = windowObject.CoverOutputPerformanceSafety;
assert(api, 'CoverOutputPerformanceSafety API must be exposed');
assert.strictEqual(api.stage, 'device-output-budget-jspdf-recovery');

const a4 = api.calculateOutputBudget(activeSpec, 'pdf', 2);
assert.strictEqual(a4.dpi, 300);
assert.strictEqual(a4.allowed, true);
assert(a4.pixels > 18_000_000 && a4.pixels < 19_000_000);
assert.strictEqual(a4.pixelCap, 24_000_000);

const b5 = api.calculateOutputBudget({ trimW: 182, trimH: 257, bleed: 3, spine: 8.5 }, 'pdf', 2);
assert.strictEqual(b5.allowed, true);
assert(b5.pixels > 13_000_000 && b5.pixels < 15_000_000);

const a5 = api.calculateOutputBudget({ trimW: 148, trimH: 210, bleed: 3, spine: 8.5 }, 'pdf', 2);
assert.strictEqual(a5.allowed, true);
assert(a5.pixels > 9_000_000 && a5.pixels < 10_000_000);

const customLowMemory = api.calculateOutputBudget({ trimW: 300, trimH: 450, bleed: 10, spine: 100 }, 'pdf', 4);
assert.strictEqual(customLowMemory.allowed, false);
assert.strictEqual(customLowMemory.pixelCap, 34_000_000);
assert.match(customLowMemory.reason, /현재 기기 기준/);

const customHighMemory = api.calculateOutputBudget({ trimW: 300, trimH: 450, bleed: 10, spine: 100 }, 'pdf', 16);
assert.strictEqual(customHighMemory.allowed, true);
assert(customHighMemory.pixels > 46_000_000 && customHighMemory.pixels < 49_000_000);

const customPng = api.calculateOutputBudget({ trimW: 300, trimH: 450, bleed: 10, spine: 100 }, 'png', 2);
assert.strictEqual(customPng.dpi, 180);
assert.strictEqual(customPng.allowed, true);
assert(customPng.pixels < 18_000_000);

const tooWide = api.calculateOutputBudget({ trimW: 900, trimH: 300, bleed: 3, spine: 20 }, 'pdf', 16);
assert.strictEqual(tooWide.allowed, false);
assert.match(tooWide.reason, /한 변/);

activeSpec = { trimW: 300, trimH: 450, bleed: 10, spine: 100, totalW: 720, totalH: 470 };
const pdfButton = elements.get('pdfBtn');
const blocked = { prevented: false, immediate: false, stopped: false };
pdfButton.listeners.click.listener({
  currentTarget: pdfButton,
  preventDefault() { blocked.prevented = true; },
  stopImmediatePropagation() { blocked.immediate = true; },
  stopPropagation() { blocked.stopped = true; },
});
assert.deepStrictEqual(blocked, { prevented: true, immediate: true, stopped: true });
assert.match(elements.get('status').textContent, /생성 중단/);
assert(Number(pdfButton.dataset.coverOutputPixels) > 46_000_000);

activeSpec = { trimW: 148, trimH: 210, bleed: 3, spine: 8.5, totalW: 310.5, totalH: 216 };
const pngButton = elements.get('pngBtn');
const allowed = { prevented: false, immediate: false, stopped: false };
pngButton.listeners.click.listener({
  currentTarget: pngButton,
  preventDefault() { allowed.prevented = true; },
  stopImmediatePropagation() { allowed.immediate = true; },
  stopPropagation() { allowed.stopped = true; },
});
assert.deepStrictEqual(allowed, { prevented: false, immediate: false, stopped: false });

console.log('cover-output-performance behavior passed');
