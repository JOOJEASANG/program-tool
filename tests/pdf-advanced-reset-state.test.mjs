import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = new EventTarget();
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}
const { advancedState, checkpoint, undo, resetAllState } = await import('../js/pdf-editor-advanced/state.js');

test('reset preserves references held by live editor input handlers', () => {
  const original = {
    paper: advancedState.paper,
    margins: advancedState.margins,
    headerFooter: advancedState.headerFooter,
    pageNumbers: advancedState.pageNumbers,
  };
  advancedState.paper.preset = 'a3';
  advancedState.margins.left = 14;
  advancedState.headerFooter.enabled = true;
  advancedState.pageNumbers.start = 42;
  resetAllState();
  for (const name of Object.keys(original)) assert.equal(advancedState[name], original[name], name);
  assert.equal(advancedState.paper.preset, 'original');
  assert.equal(advancedState.margins.left, 0);
  assert.equal(advancedState.headerFooter.enabled, false);
  assert.equal(advancedState.pageNumbers.start, 1);
  original.margins.right = 12;
  assert.equal(advancedState.margins.right, 12);
});

test('undo keeps editor setting references after restoring a snapshot', () => {
  resetAllState();
  const previous = advancedState.paper;
  const oldMargins = advancedState.margins;
  advancedState.margins.left = 3;
  checkpoint('좌측 여백');
  advancedState.margins.left = 19;
  advancedState.paper.preset = 'a4';
  assert.equal(undo(), true);
  assert.equal(advancedState.paper, previous);
  assert.equal(advancedState.margins, oldMargins);
  assert.equal(advancedState.margins.left, 3);
  assert.equal(advancedState.paper.preset, 'original');
});
