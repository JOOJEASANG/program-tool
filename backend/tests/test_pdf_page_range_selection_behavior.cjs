const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../js/pdf-editor/page-selection-preview-focus.js'), 'utf8');
const pages = [
  {id: 1, pageType: 'pdf', file_index: 0, page_index: 0},
  {id: 2, pageType: 'pdf', file_index: 1, page_index: 2},
  {id: 3, pageType: 'pdf', file_index: 0, page_index: 1},
  {id: 4, pageType: 'blank'},
  {id: 5, pageType: 'pdf', file_index: 1, page_index: 0},
  {id: 6, pageType: 'pdf', file_index: 1, page_index: 4},
  {id: 7, pageType: 'pdf', file_index: 0, page_index: 4},
];
const document = {
  readyState: 'loading',
  addEventListener() {},
  getElementById() {return null;},
  querySelectorAll() {return [];},
  dispatchEvent() {},
  documentElement: {dataset: {}},
};
const context = {
  window: null,
  document,
  parsedPages: pages,
  uploadedFiles: [{name:'A.pdf'}, {name:'B.pdf'}],
  CustomEvent: class CustomEvent {constructor(type, options) {this.type=type;this.detail=options.detail;}},
  console,
  setTimeout() {},
};
context.window=context;
vm.createContext(context);
vm.runInContext(source, context, {filename:'page-selection-preview-focus.js'});
const api=context.PdfEditorPageSelection;
const chosen=()=>[...api.selectedIds].sort((a,b)=>a-b);
const plain=value=>JSON.parse(JSON.stringify(value));

assert.equal(api.parseRangeExpression('1-5, 7',7).ok,true);
assert.equal(api.parseRangeExpression('1-8',7).ok,false);
assert.equal(api.parseRangeExpression('5-3',7).ok,false);
assert.equal(api.parseRangeExpression('1,,2',7).ok,false);
assert.equal(api.parseRangeExpression('abc',7).ok,false);
assert.equal(api.parseRangeExpression('',7).ok,false);
assert.equal(api.parseRangeExpression('0',7).ok,false);
assert.equal(api.parseRangeExpression('1-90000000',7).ok,false);
assert.equal(api.parseRangeExpression('1-2-3',7).ok,false);
assert.equal(api.selectRange('1-3,6','all','replace').affected,4);
assert.deepEqual(chosen(),[1,2,3,6]);
assert.equal(api.selectRange('1-2','file:0','replace').affected,2);
assert.deepEqual(chosen(),[1,3]); // File A original pages 1-2, irrespective of edited order.
assert.equal(api.selectRange('1,3','file:1','add').affected,2);
assert.deepEqual(chosen(),[1,2,3,5]);
assert.equal(api.selectRange('2','file:0','remove').affected,1);
assert.deepEqual(chosen(),[1,2,5]);
assert.equal(api.selectRange('2-4','file:1','replace').affected,1); // Deleted/missing original pages are skipped.
assert.deepEqual(chosen(),[2]);
assert.equal(api.selectRange('1-5','file:0','replace').affected,3);
assert.deepEqual(chosen(),[1,3,7]);
assert.equal(api.selectParity('all','even').affected,3);
assert.deepEqual(chosen(),[2,4,6]); // Includes blank page in edited-order selection.
assert.equal(api.selectParity('file:0','odd').affected,2);
assert.deepEqual(chosen(),[1,7]);
const selectedBefore=chosen();
assert.equal(api.selectRange('4-3','all','replace').ok,false);
assert.deepEqual(chosen(),selectedBefore, 'Invalid range must preserve existing selection');
assert.equal(api.selectRange('40','file:1','replace').ok,false);
assert.deepEqual(chosen(),selectedBefore);
assert.equal(api.selectRange('1','file:500','replace').ok,false);
assert.deepEqual(chosen(),selectedBefore);
assert.equal(api.invertScopeSelection('file:1').affected,3);
assert.deepEqual(chosen(),[1,2,5,6,7], 'File B inversion must preserve File A selection');
api.clearSelection();
assert.deepEqual(chosen(),[]);
assert.equal(api.selectFile(1),3);
assert.deepEqual(chosen(),[2,5,6]);
assert.equal(api.clearFile(1),3);
assert.deepEqual(chosen(),[]);
assert.deepEqual(plain(api.scopePages('file:1').map(x=>x.number)),[3,1,5]);
console.log('pdf page range selection behavior passed');
