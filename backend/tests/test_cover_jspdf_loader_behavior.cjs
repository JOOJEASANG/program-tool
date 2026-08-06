const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-jspdf-loader.js'),
  'utf8',
);

const appended = [];
const removed = [];
const document = {
  createElement(tagName) {
    assert.equal(tagName, 'script');
    return {
      async: false,
      src: '',
      dataset: {},
      onload: null,
      onerror: null,
      remove() { removed.push(this.src); },
    };
  },
  head: {
    appendChild(script) { appended.push(script); },
  },
};
const window = {};
const context = vm.createContext({ window, document, setTimeout, clearTimeout, Promise, Error });
vm.runInContext(source, context, { filename: 'cover-jspdf-loader.js' });

assert.equal(appended.length, 0, 'module evaluation must not request jsPDF');
assert.equal(typeof window.CoverJsPdfLoader?.ensure, 'function');
assert.equal(window.CoverJsPdfLoader.ready(), false);

(async () => {
  const first = window.CoverJsPdfLoader.ensure();
  const duplicate = window.CoverJsPdfLoader.ensure();
  assert.equal(first, duplicate, 'concurrent output requests must share one promise');
  assert.equal(appended.length, 1);
  assert.match(appended[0].src, /jsdelivr/);

  appended[0].onerror();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(appended.length, 2, 'fallback CDN should be attempted after failure');
  assert.match(appended[1].src, /unpkg/);
  assert.equal(removed.length, 1);

  class JsPdfMock {}
  window.jspdf = { jsPDF: JsPdfMock };
  appended[1].onload();
  const loaded = await first;
  assert.equal(loaded, JsPdfMock);
  assert.equal(window.CoverJsPdfLoader.ready(), true);

  const cached = await window.CoverJsPdfLoader.ensure();
  assert.equal(cached, JsPdfMock);
  assert.equal(appended.length, 2, 'ready loader must not append another script');
  console.log('cover-jspdf-loader behavior passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
