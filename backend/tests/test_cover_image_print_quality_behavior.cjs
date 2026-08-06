const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../js/cover-image-print-quality.js'),
  'utf8',
);

const window = {};
const document = {
  getElementById() { return null; },
};
const context = vm.createContext({
  window,
  document,
  location: { pathname: '/perfect-binding-cover/index.html' },
  setTimeout() { return 0; },
  requestAnimationFrame() { return 0; },
  cancelAnimationFrame() {},
  MutationObserver: undefined,
  Number,
  Math,
});
vm.runInContext(source, context, { filename: 'cover-image-print-quality.js' });

const api = window.CoverImagePrintQuality;
assert.equal(typeof api?.calculateEffectiveDpi, 'function');
assert.equal(api.stage, 'effective-print-dpi-diagnostics');

const optimal = api.calculateEffectiveDpi({
  imageWidth: 3000,
  imageHeight: 4200,
  rectWidthMm: 210,
  rectHeightMm: 297,
  fit: 'cover',
  scalePercent: 100,
});
assert.equal(optimal.available, true);
assert.ok(optimal.dpi > 350 && optimal.dpi < 370);
assert.equal(optimal.grade.level, 'excellent');

const enlarged = api.calculateEffectiveDpi({
  imageWidth: 3000,
  imageHeight: 4200,
  rectWidthMm: 210,
  rectHeightMm: 297,
  fit: 'cover',
  scalePercent: 200,
});
assert.ok(enlarged.dpi > 175 && enlarged.dpi < 185);
assert.ok(Math.abs(enlarged.dpi * 2 - optimal.dpi) < 0.01);
assert.equal(enlarged.grade.level, 'low');

const contained = api.calculateEffectiveDpi({
  imageWidth: 3000,
  imageHeight: 4200,
  rectWidthMm: 210,
  rectHeightMm: 297,
  fit: 'contain',
  scalePercent: 100,
});
assert.equal(contained.hasBlankArea, true);
assert.equal(contained.cropPercent, 0);
assert.ok(contained.renderedHeightMm < 297);

const cropped = api.calculateEffectiveDpi({
  imageWidth: 4000,
  imageHeight: 2000,
  rectWidthMm: 210,
  rectHeightMm: 297,
  fit: 'cover',
  scalePercent: 100,
});
assert.ok(cropped.cropPercent > 60);
assert.equal(cropped.hasBlankArea, false);

const missing = api.calculateEffectiveDpi({});
assert.equal(missing.available, false);
assert.equal(missing.dpi, 0);

assert.equal(api.gradeDpi(310).level, 'excellent');
assert.equal(api.gradeDpi(270).level, 'good');
assert.equal(api.gradeDpi(200).level, 'caution');
assert.equal(api.gradeDpi(150).level, 'low');
assert.equal(api.gradeDpi(100).level, 'danger');
console.log('cover-image-print-quality behavior passed');
