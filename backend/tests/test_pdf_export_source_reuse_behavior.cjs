const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

const source=fs.readFileSync(path.resolve(__dirname,'../../js/api.js'),'utf8');
const uploads=[],deletions=[],requests=[];
const storage={ref(storagePath){return {
  put(file){
    uploads.push({path:storagePath,file});
    const task={snapshot:{state:'success'},cancel(){}};
    task.on=(_event,_progress,_error,complete)=>queueMicrotask(complete);
    return task;
  },
  async delete(){deletions.push(storagePath);}
};}};
let files=[{name:'same.pdf',size:1200}];
const context={
  console,storage,AbortController,DOMException,URL,TextEncoder,Blob,
  setTimeout,clearTimeout,queueMicrotask,
  auth:{currentUser:{uid:'u1',async getIdToken(){return 'token';}}},
  firebase:{app(){return {options:{projectId:'unit-test-project'}};}},
  async fetch(url,params){
    assert.ok(url.endsWith('/api/pdf/process-storage'));
    const body=JSON.parse(params.body);
    requests.push(body);
    return {ok:true,status:200,headers:{get(){return 'application/pdf';}},async blob(){return new Blob(['%PDF-1.7']);}};
  },
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context);
const save=async(input, reuseSources=true)=>context.apiProcessPdf(input,{pages:[{file_index:0,page_index:0}]},{reuseSources});

(async()=>{
  const original=files[0];
  await save(files);
  assert.equal(uploads.length,1,'first unsaved export uploads original exactly once');
  assert.equal(deletions.length,0,'reusable input must survive successful download');
  assert.equal(requests[0].retain_temp_sources,true);
  await save(files);
  assert.equal(uploads.length,1,'subsequent download must reuse same input');
  assert.equal(requests[1].storage_paths[0],requests[0].storage_paths[0]);
  assert.equal(requests[1].source_session_doc,null);

  files=[{name:'modified.pdf',size:1200}];
  await save(files);
  assert.equal(uploads.length,2,'replaced File must upload exactly once');

  const savedPath='pdf_sessions/u1/previous123/src_0.pdf';
  context.PdfSessionSaveSafety={
    reusableSourcePaths(input){return {
      docId:'document123',
      paths:input.map(item=>item===files[0]?savedPath:null)
    };}
  };
  await save(files);
  assert.equal(uploads.length,2,'saved originals require no upload');
  assert.equal(requests.at(-1).source_session_doc,'document123');
  assert.equal(requests.at(-1).storage_paths[0],savedPath);
  assert.equal(deletions.length,0,'saved originals cannot be deleted by result export');

  context.PdfSessionSaveSafety=null;
  await save([original],false);
  assert.equal(uploads.length,3,'other tools retain one-shot upload');
  assert.equal(deletions.length,1,'other tools clean one-shot uploads');
  assert.equal(requests.at(-1).retain_temp_sources,undefined);
  console.log('pdf editor repeated export input reuse and legacy one-shot cleanup passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
