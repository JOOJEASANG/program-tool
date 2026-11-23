'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const filename = path.resolve(__dirname, '../../js/smart-print-layout/final-controls.js');
let source = fs.readFileSync(filename, 'utf8');
const anchor = "if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });";
assert.ok(source.includes(anchor), 'test hook insertion point must exist');
source = source.replace(anchor, "window.__smartTest = {trimRequired, validateTrimConfig, refreshDownloadState, finalizedSettings};\n  " + anchor);
const nodes = new Map();
function control(id, options = {}) {
  const value = {id, value: '', checked: false, disabled: false, textContent: '', hidden: false, ...options};
  nodes.set(id, value);
  return value;
}
const download = control('downloadBtn', {disabled: true});
const reason = control('downloadReadiness', {hidden: true});
const width = control('trimGuideWidth');
const height = control('trimGuideHeight');
const autoFit = control('autoFitTrim', {checked: false});
const crop = control('cropMarks', {checked: false});
const fitMode = control('fitMode', {value: 'contain'});
const statusLine = control('statusLine');
const layout = {state: {items: [{id: 1}],plan: {sheets: [[]]},busy: false},recalculate() {}};
let pending = false;
const window = {
  SmartPrintLayout: layout,
  SmartPrintLayoutEnhancements: {hasPendingSizes: () => pending},
};
const document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById(id) {return nodes.get(id) || null;},
};
vm.runInNewContext(source, {window,document,console}, {filename});
const api=window.__smartTest;
assert.ok(api, 'output readiness functions should be available');

api.refreshDownloadState();
assert.equal(download.disabled, false, 'no trim needed if both features disabled');
assert.equal(reason.hidden, true);
let request = api.finalizedSettings({});
assert.equal('trim_width_mm' in request, false, 'no 0mm trim field in request');
assert.equal('trim_height_mm' in request, false);

autoFit.checked=true;
api.refreshDownloadState();
assert.equal(download.disabled, true, 'auto fit requires both dimensions');
assert.match(reason.textContent, /가로·세로/);
assert.throws(()=>api.validateTrimConfig(), /재단 가로·세로/);

width.value='90';
height.value='50';
api.refreshDownloadState();
assert.equal(download.disabled,false, 'valid target size unblocks download');
request=api.finalizedSettings({});
assert.equal(request.trim_width_mm,90);
assert.equal(request.trim_height_mm,50);
assert.equal(request.auto_fit_trim,true);

autoFit.checked=false;
crop.checked=true;
height.value='';
api.refreshDownloadState();
assert.equal(download.disabled,true, 'crop marks require both trim dimensions');
height.value='50';
api.refreshDownloadState();
assert.equal(download.disabled,false);
pending=true;
api.refreshDownloadState();
assert.equal(download.disabled,true, 'pending image conversions must not be bypassed');
pending=false;
layout.state.busy=true;
api.refreshDownloadState();
assert.equal(download.disabled,true);
layout.state.busy=false;
layout.state.plan=null;
api.refreshDownloadState();
assert.equal(download.disabled,true, 'invalid layout blocks download');

console.log('smart-print download readiness scenarios passed');
