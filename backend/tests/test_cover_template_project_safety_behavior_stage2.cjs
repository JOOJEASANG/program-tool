'use strict';

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/cover-template-project-safety.js', 'utf8');

class Element {
  constructor(id, value = '') {
    this.id = id;
    this.value = value;
    this.type = 'text';
    this.dataset = {};
    this.listeners = {};
  }
  addEventListener(type, listener, options) { this.listeners[type] = { listener, options }; }
  dispatchEvent() {}
  click() {}
}

const elements = new Map([
  ['trimW', new Element('trimW', '210')],
  ['frontColor', new Element('frontColor', '#f8fbff')],
]);
const deletedPaths = [];
const windowObject = {
  CoverProjectStateBridge: {
    snapshot() {
      return {
        textZones: {
          front: { top: [{ id: 'title', text: '현재 제목', size: 28, color: '#12396d', x: 50, y: 20, scale: 100 }], center: [], bottom: [] },
          spine: { top: [], center: [], bottom: [] },
          back: { top: [], center: [], bottom: [] },
        },
        imageEffects: {
          frontImage: { rotation: 90, flipX: true, flipY: false, brightness: 110, contrast: 95, saturation: 80 },
          backImage: { rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100 },
        },
      };
    },
  },
  firebase: {
    storage() {
      return {
        ref(path) {
          return {
            async delete() {
              deletedPaths.push(path);
              if (path === 'missing') {
                const error = new Error('missing');
                error.code = 'storage/object-not-found';
                throw error;
              }
              if (path === 'denied') {
                const error = new Error('denied');
                error.code = 'storage/unauthorized';
                throw error;
              }
            },
          };
        },
      };
    },
  },
  alert() {},
  confirm() { return true; },
};

const context = {
  window: windowObject,
  document: { getElementById(id) { return elements.get(id) || null; } },
  location: { pathname: '/perfect-binding-cover/' },
  localStorage: {
    data: new Map(),
    getItem(key) { return this.data.get(key) || null; },
    setItem(key, value) { this.data.set(key, String(value)); },
  },
  state: { layout: { frontTitle: { x: 50, y: 40, scale: 100 } } },
  Event: class Event { constructor(type) { this.type = type; } },
  Option: class Option {},
  setTimeout(callback) { callback(); return 1; },
  getComputedStyle() { return { display: 'block' }; },
  console,
};
windowObject.window = windowObject;
windowObject.document = context.document;
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  const api = windowObject.CoverTemplateProjectSafety;
  assert(api, 'CoverTemplateProjectSafety API must be exposed');
  assert.strictEqual(api.stage, 'template-project-storage-validation');

  const template = api.snapshotTemplate('학교 표지');
  assert.strictEqual(template.templateVersion, 2);
  assert.strictEqual(template.extended.textZones.front.top[0].text, '현재 제목');
  assert.strictEqual(template.extended.imageEffects.frontImage.rotation, 90);
  assert.strictEqual(template.layout.frontTitle.y, 40);

  const normalized = api.normalizeProject({
    type: 'program-tool-cover-project',
    version: 2,
    values: { trimW: 210, unknown: 'ignored' },
    layout: { frontImage: { x: 999, y: -999, scale: 999 } },
    extended: template.extended,
  });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(normalized.layout.frontImage)), { x: 100, y: -100, scale: 500 });
  assert.strictEqual(normalized.values.unknown, undefined);
  assert.strictEqual(normalized.extended.textZones.front.top[0].text, '현재 제목');

  const legacy = api.normalizeProject({
    type: 'program-tool-cover-project',
    version: 1,
    values: {},
    layout: {},
  });
  assert.strictEqual(legacy.extended, null);

  assert.throws(() => api.normalizeProject({
    type: 'program-tool-cover-project',
    version: 3,
    values: {},
    layout: {},
  }), /지원하지 않는 프로젝트 버전/);

  const tooMany = Array.from({ length: 61 }, (_, index) => ({ id: String(index), text: 'x' }));
  assert.throws(() => api.normalizeProject({
    type: 'program-tool-cover-project',
    version: 2,
    values: {},
    layout: {},
    extended: {
      textZones: {
        front: { top: tooMany, center: [], bottom: [] },
        spine: { top: [], center: [], bottom: [] },
        back: { top: [], center: [], bottom: [] },
      },
      imageEffects: {},
    },
  }), /글자 레이어는 60개 이하/);

  assert.strictEqual(await api.deleteStoragePath('missing'), true);
  await assert.rejects(() => api.deleteStoragePath('denied'), /denied/);
  assert.deepStrictEqual(deletedPaths, ['missing', 'denied']);

  console.log('cover-template-project-safety behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
