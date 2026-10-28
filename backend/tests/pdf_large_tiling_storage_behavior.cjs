const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/pdf-large-output-tiling.js','utf8');
const start=source.indexOf('  async function storage(){');
const end=source.indexOf('  async function readDelivery(',start);
assert.ok(start>=0&&end>start,'storage helper must be extractable');
let loads=0;
const fakeStorage={ref:()=>({put:async()=>{},delete:async()=>{}})};
const listeners={};
const script={addEventListener:(event,handler)=>{listeners[event]=handler;}};
const window={firebase:{}};
const document={
  getElementById:()=>null,
  createElement:tag=>{assert.equal(tag,'script');return script;},
  head:{appendChild:node=>{
    loads++;
    assert.equal(node.id,'pdfLargeOutputStorageSdk');
    assert.ok(node.src.includes('firebase-storage-compat.js'));
    window.firebase.storage=()=>fakeStorage;
    Promise.resolve().then(()=>listeners.load());
  }}
};
const ctx={window,document,Promise};
vm.runInNewContext(source.slice(start,end),ctx);
(async()=>{
  const storage1=await vm.runInNewContext('storage()',ctx);
  const storage2=await vm.runInNewContext('storage()',ctx);
  assert.equal(storage1,fakeStorage);
  assert.equal(storage2,fakeStorage);
  assert.equal(loads,1,'Storage SDK must be loaded only once');
  console.log('pdf poster Storage first-run behavior passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
