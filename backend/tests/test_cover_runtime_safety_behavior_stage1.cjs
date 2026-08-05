'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/cover-runtime-safety.js', 'utf8');

class Element {
  constructor(id, value = '') {
    this.id = id;
    this.value = value;
    this.dataset = {};
    this.listeners = {};
    this.textContent = '';
    this.scrollCalls = 0;
  }
  addEventListener(type, listener, options) {
    this.listeners[type] = { listener, options };
  }
  querySelectorAll(selector) {
    if (this.id === 'coverPreflightList' && selector === 'strong') {
      return this.errorNodes || [];
    }
    return [];
  }
  scrollIntoView() { this.scrollCalls += 1; }
}

const elements = new Map();
for (const id of [
  'frontTitle', 'frontSubtitle', 'publisher', 'publishYear', 'backText',
  'spineTitle', 'spineTop', 'spineCenter', 'spineBottom',
  'pdfBtn', 'guidePdfBtn', 'pngBtn', 'coverPreflightList',
  'coverPreflightSummary', 'coverPreflightCard',
]) elements.set(id, new Element(id));

elements.get('frontTitle').value = '숨겨진 구형 제목';
elements.get('spineTitle').value = '원래 책등 제목';
elements.get('coverPreflightList').errorNodes = [{ textContent: '✕ 앞표지 제목 누락' }];
elements.get('coverPreflightSummary').textContent = '출력 전 수정 필요 · 오류 1개 · 주의 0개';

let statusMessage = null;
const windowObject = {
  renderCover() {
    elements.get('frontTitle').value = '';
    elements.get('spineTitle').value = '';
    throw new Error('forced render failure');
  },
  CoverProjectStateBridge: {
    primaryText(side) {
      return side === 'front' ? '현재 화면의 제목 / 2026' : '';
    },
  },
  setStatus(message, type) { statusMessage = { message, type }; },
};

const documentObject = {
  getElementById(id) { return elements.get(id) || null; },
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

const api = windowObject.CoverRuntimeSafety;
assert(api, 'CoverRuntimeSafety API must be exposed');
assert.strictEqual(api.stage, 'runtime-audit-preflight-render-filename');

assert.throws(() => windowObject.renderCover(), /forced render failure/);
assert.strictEqual(elements.get('frontTitle').value, '숨겨진 구형 제목');
assert.strictEqual(elements.get('spineTitle').value, '원래 책등 제목');

assert.strictEqual(api.safeFileStem(), '현재 화면의 제목 _ 2026');
assert.strictEqual(windowObject.safeName(), '현재 화면의 제목 _ 2026');

const pdfButton = elements.get('pdfBtn');
assert(pdfButton.listeners.click, 'PDF output guard must be installed');
assert.strictEqual(pdfButton.listeners.click.options.capture, true);
const eventState = { prevented: false, immediate: false, stopped: false };
pdfButton.listeners.click.listener({
  preventDefault() { eventState.prevented = true; },
  stopImmediatePropagation() { eventState.immediate = true; },
  stopPropagation() { eventState.stopped = true; },
});
assert.deepStrictEqual(eventState, { prevented: true, immediate: true, stopped: true });
assert.strictEqual(statusMessage.type, 'err');
assert.strictEqual(elements.get('coverPreflightCard').scrollCalls, 1);

elements.get('coverPreflightList').errorNodes = [{ textContent: '✓ 재단 여백 확인' }];
elements.get('coverPreflightSummary').textContent = '점검 완료 · 8개 항목 정상';
const allowedState = { prevented: false, immediate: false, stopped: false };
pdfButton.listeners.click.listener({
  preventDefault() { allowedState.prevented = true; },
  stopImmediatePropagation() { allowedState.immediate = true; },
  stopPropagation() { allowedState.stopped = true; },
});
assert.deepStrictEqual(allowedState, { prevented: false, immediate: false, stopped: false });

console.log('cover-runtime-safety behavior passed');
