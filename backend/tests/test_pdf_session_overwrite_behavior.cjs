const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../../js/pdf-editor/session-save-safety.js'),'utf8');
const nodes=new Map();
function byId(id){
 if(!nodes.has(id))nodes.set(id,{
  id,dataset:{},style:{},disabled:false,value:'',hidden:false,textContent:'',listeners:{},attrs:{},
  addEventListener(type,fn){this.listeners[type]=fn;},
  getAttribute(k){return this.attrs[k]??null;},
  setAttribute(k,v){this.attrs[k]=v;},
  removeAttribute(k){delete this.attrs[k];}
 });
 return nodes.get(id);
}
['sessionSaveConfirm','sessionOverwriteConfirm','sessionOverwriteDescription','sessionSaveStatus','sessionNameInput','sessionSaveModal'].forEach(byId);
const body={dataset:{},attrs:{},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
const document={readyState:'complete',body,getElementById:byId,querySelectorAll(){return[];},addEventListener(){},removeEventListener(){}};
const docs=new Map(),objects=new Map(),deleted=[];
const oldSessionId='previous123',oldPath='pdf_sessions/u1/previous123/src_0.pdf';
docs.set('doc-old',{name:'거래처A',sessionId:oldSessionId,storagePaths:[oldPath],fileCount:1,pageCount:1,state:'{}',createdAt:'ORIGINAL-CREATED'});
objects.set(oldPath,'original-bytes');
let nextId=1,failUpload=false,collision=false,confirmed=true,putCount=0,txnCount=0;
const refFor=id=>({id,async get(){return {exists:docs.has(id),data:()=>docs.get(id)};}});
const collection={
 doc:refFor,
 async add(payload){const id='new-'+nextId++;docs.set(id,payload);return refFor(id);},
 orderBy(){return {async get(){return {size:docs.size,docs:[...docs.entries()].map(([id,data])=>({id,data:()=>data}))};}};}
};
const db={
 collection(){return {doc(){return {collection(){return collection;}};}};},
 async runTransaction(callback){
  txnCount++;
  return callback({
   async get(ref){return ref.get();},
   update(ref,payload){if(!docs.has(ref.id))throw Error('document missing');docs.set(ref.id,{...docs.get(ref.id),...payload});}
  });
 }
};
const storage={ref(p){return {
 async put(file,metadata){
  putCount++;if(failUpload)throw Error('simulated Storage outage');
  if(objects.has(p))throw Error('immutable storage path');
  assert.equal(metadata.customMetadata.ownerUid,'u1');
  objects.set(p,file.name);
  if(collision)docs.get('doc-old').sessionId='updated-elsewhere';
 },
 async delete(){if(!objects.has(p))throw {code:'storage/object-not-found'};objects.delete(p);deleted.push(p);}
};}};
const context={document,auth:{currentUser:{uid:'u1'}},db,storage,console,TextEncoder,
 crypto:{randomUUID:(()=>{let n=0;return ()=>'00000000-0000-4000-8000-'+(++n).toString().padStart(12,'0');})()},
 firebase:{firestore:{FieldValue:{serverTimestamp:()=> 'UPDATED-TIMESTAMP'}}},
 uploadedFiles:[{name:'modified.pdf',size:1024}],
 parsedPages:[{file_index:0,page_index:0,pageType:'pdf'}],
 collectEditorState(){return {pages:[{file_index:0,page_index:0,pageType:'pdf',groupBreak:false}]};},
 setTimeout(){},confirm(){return confirmed;}
};
context.window=context;vm.createContext(context);vm.runInContext(source,context);
const api=context.PdfSessionSaveSafety;
(async()=>{
 assert.equal(api.setLoadedSession({docId:'doc-old',sessionId:oldSessionId,storagePaths:[oldPath],name:'거래처A',uid:'u1'}),true);
 api.prepareSaveDialog();
 assert.equal(byId('sessionOverwriteConfirm').hidden,false);
 assert.equal(byId('sessionNameInput').value,'거래처A');
 assert.equal(byId('sessionSaveConfirm').textContent,'새 이름으로 저장');
 assert.ok(byId('sessionOverwriteConfirm').listeners.click);
 byId('sessionNameInput').value='new name ignored by overwrite';
 assert.equal(await api.save('overwrite'),true);
 assert.equal(docs.size,1,'overwrite updates original list item');
 assert.equal(docs.get('doc-old').name,'거래처A','overwrite preserves saved name');
 assert.equal(docs.get('doc-old').createdAt,'ORIGINAL-CREATED');
 assert.notEqual(docs.get('doc-old').sessionId,oldSessionId);
 assert.equal(objects.has(oldPath),true,'unchanged original must survive overwrite');
 assert.equal(objects.has(docs.get('doc-old').storagePaths[0]),true);
 assert.equal(api.currentLoadedSession().docId,'doc-old');
 assert.equal(putCount,0,'an unchanged PDF requires no upload');
 assert.equal(api.currentLoadedSession().storagePaths[0],oldPath);
 assert.equal(api.reusableSourcePaths(context.uploadedFiles).paths[0],oldPath);
 assert.equal(txnCount,1);
 const original=JSON.stringify(docs.get('doc-old'));
 const committedPaths=[...docs.get('doc-old').storagePaths];
 const oldPuts=putCount;
 confirmed=false;
 assert.equal(await api.save('overwrite'),false);
 assert.equal(putCount,oldPuts,'cancel must not upload');
 confirmed=true;
 // Replacing a File object is an explicit source change and must upload anew.
 context.uploadedFiles=[{name:'replacement.pdf',size:1024}];
 assert.equal(api.reusableSourcePaths(context.uploadedFiles).paths[0],null);
 failUpload=true;
 assert.equal(await api.save('overwrite'),false,'upload fail must not change old revision');
 assert.equal(JSON.stringify(docs.get('doc-old')),original);
 assert.ok(committedPaths.every(p=>objects.has(p)));
 failUpload=false;
 collision=true;
 assert.equal(await api.save('overwrite'),false,'transaction protects concurrent updates');
 assert.equal(docs.size,1);
 assert.equal(docs.get('doc-old').sessionId,'updated-elsewhere');
 assert.equal(api.currentLoadedSession().docId,'doc-old');
 collision=false;
 // Restore the last committed revision and verify changed sources replace it.
 docs.get('doc-old').sessionId=JSON.parse(original).sessionId;
 assert.equal(await api.save('overwrite'),true);
 assert.equal(putCount>0,true,'changed source must upload');
 assert.equal(objects.has(oldPath),false,'replaced source removed only after commit');
 const replacedPath=docs.get('doc-old').storagePaths[0];
 assert.equal(objects.has(replacedPath),true);
 assert.equal(api.currentLoadedSession().storagePaths[0],replacedPath);
 api.clearLoadedSession();
 assert.equal(byId('sessionOverwriteConfirm').hidden,true);
 assert.equal(api.currentLoadedSession(),null);
 byId('sessionNameInput').value='독립 새 작업';
 assert.equal(await api.save('new'),true);
 assert.equal(docs.size,2);
 assert.ok([...docs.values()].some(d=>d.name==='독립 새 작업'));
 assert.notEqual(api.currentLoadedSession().docId,'doc-old');
 assert.equal(api.setLoadedSession({docId:'doc-old',sessionId:'previous123',storagePaths:['pdf_sessions/u2/previous123/src_0.pdf'],uid:'u1',name:'INVALID'}),false);
 console.log('pdf session safe overwrite, cancel, rollback, conflict and save-as-new passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
