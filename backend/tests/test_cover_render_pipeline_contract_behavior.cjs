const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const source = fs.readFileSync(path.join(ROOT, 'js', 'cover-render-pipeline-contract.js'), 'utf8');

const retired = [];
function script(src) {
  return {
    src,
    dataset: {},
    getAttribute(name) { return name === 'src' ? src : null; },
    remove() { retired.push(src); },
  };
}
const scripts = [
  script('../js/cover-editor-multiselect.js'),
  script('../js/cover-editor-layer-style.js'),
  script('../js/cover-editor-image-tools.js'),
];
const scheduled = [];
const baseRender = function baseRender(value) { return value + 7; };
const window = { renderCover: baseRender };
const warnings = [];
const context = {
  window,
  document: { querySelectorAll: () => scripts },
  location: { pathname: '/perfect-binding-cover/' },
  setTimeout: (fn, delay) => { scheduled.push({ fn, delay }); return scheduled.length; },
  console: { warn: (message) => warnings.push(String(message)) },
  Reflect,
  Error,
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'cover-render-pipeline-contract.js' });

scheduled.sort((a, b) => a.delay - b.delay).forEach(({ fn }) => fn());

assert.strictEqual(window.CoverRenderPipeline.installed, true);
assert.notStrictEqual(window.renderCover, baseRender);
assert.strictEqual(window.CoverRenderPipeline.delegate, baseRender);
assert.strictEqual(window.renderCover(5), 12);
assert.strictEqual(window.CoverRenderPipeline.render(9), 16);
assert.strictEqual(window.renderCover.__coverRenderPipelineOwner, true);
assert.deepStrictEqual(retired.sort(), [
  '../js/cover-editor-layer-style.js',
  '../js/cover-editor-multiselect.js',
]);
assert.strictEqual(scripts[2].dataset.coverCompatibilityRetired, undefined);
assert.strictEqual(window.CoverRenderPipeline.detectDrift(), false);
window.renderCover = function unexpectedLateWrapper(value) { return value; };
assert.strictEqual(window.CoverRenderPipeline.detectDrift(), true);
assert.strictEqual(window.CoverRenderPipeline.driftDetected, true);
assert.ok(warnings.some((message) => message.includes('ownership changed')));
assert.strictEqual(window.CoverRenderPipeline.stage, 'final-render-entrypoint-contract');
console.log('cover-render-pipeline-contract behavior passed');
