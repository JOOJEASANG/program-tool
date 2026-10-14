const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const layoutSource = fs.readFileSync(path.resolve(__dirname, '../../js/pdf-editor/layout-export.js'), 'utf8');
const htmlSource = fs.readFileSync(path.resolve(__dirname, '../../pdf-editor/index.html'), 'utf8');
const engineSource = fs.readFileSync(path.resolve(__dirname, '../../backend/services/pdf_engine.py'), 'utf8');
const start = layoutSource.indexOf('  function repeatCutGeometry(');
const stop = layoutSource.indexOf('  function syncLegacyMargins()', start);
assert.ok(start >= 0 && stop > start, 'repeat-cut geometry helper must exist');
const code = layoutSource.slice(start, stop);
const context = { PT_TO_MM: 25.4 / 72, FALLBACK_MARGIN_MM: 10 * 25.4 / 72 };
vm.createContext(context);
vm.runInContext(code + '\nthis.geometry = repeatCutGeometry;', context, {
  filename: 'layout-export-repeat-cut-geometry.js',
});
const near = (actual, expected) => assert.ok(
  Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`
);
const margins = {left:9, right:15, top:7, bottom:21};
for (const {pw, ph, cols, rows} of [
  {pw:210, ph:297, cols:1, rows:2},
  {pw:297, ph:210, cols:2, rows:1},
  {pw:210, ph:297, cols:2, rows:2},
]) {
  const geometry = context.geometry(pw, ph, cols, rows, margins);
  near(geometry.tileW, pw / cols);
  near(geometry.tileH, ph / rows);
  near(geometry.cellW, pw / cols - margins.left - margins.right);
  near(geometry.cellH, ph / rows - margins.top - margins.bottom);
  for (let row=0; row<rows; row++) {
    for (let col=0; col<cols; col++) {
      const tileX = col * geometry.tileW;
      const tileY = row * geometry.tileH;
      const leftEdge = tileX + geometry.margins.left;
      const topEdge = tileY + geometry.margins.top;
      const rightGap = tileX + geometry.tileW - (leftEdge + geometry.cellW);
      const bottomGap = tileY + geometry.tileH - (topEdge + geometry.cellH);
      near(leftEdge - tileX, 9);
      near(rightGap, 15);
      near(topEdge - tileY, 7);
      near(bottomGap, 21);
    }
  }
}
const tiny = context.geometry(40, 40, 2, 2, {left:80,right:80,top:80,bottom:80});
assert.ok(tiny.cellW > 0 && tiny.cellH > 0, 'overflowing margins fall back safely');
assert.equal(tiny.margins.left, tiny.margins.right);
assert.equal(tiny.margins.top, tiny.margins.bottom);

for (const marker of [
  'const cut = repeated ? repeatCutGeometry(pw, ph, cols, rows, margins) : null',
  'column * cut.tileW + margins.left',
  'row * cut.tileH + margins.top',
  'cut ? column * cut.tileW * mm2px : cellX',
  'cut ? row * cut.tileH * mm2px : cellY',
  'output.dataset.repeatCutPieceMargins = cut',
]) assert.ok(layoutSource.includes(marker), 'layout preview must apply cut geometry: ' + marker);
for (const marker of [
  'repeatCutGeometry?.(', 'const cellW = cut ? cut.cellW', 'const cellH = cut ? cut.cellH',
]) assert.ok(htmlSource.includes(marker), 'base renderer must use matching geometry: ' + marker);
for (const marker of [
  'def _build_repeat_cut_layout(',
  'layout.tile_rects[slot_idx] if layout.tile_rects',
  'if repeat_cut',
]) assert.ok(engineSource.includes(marker), 'PDF export must share trim geometry: ' + marker);
console.log('PDF repeat cut-piece margins verified');
