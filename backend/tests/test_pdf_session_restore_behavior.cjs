const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../pdf-editor/index.html'), 'utf8');
const start = source.indexOf('// Same-origin authenticated fallback for Firebase Storage objects.');
const end = source.indexOf('// Session modal events', start);
assert.ok(start >= 0 && end > start);
const controls = new Map();
const element = id => {
  if (!controls.has(id)) controls.set(id, {
    id, value:'', checked:false, disabled:false, textContent:'', style:{},
    classList:{toggle(){}, add(){}, remove(){}}, setAttribute(){},
    remove(){this.removed=true;}
  });
  return controls.get(id);
};
const body=element('sessionListBody');
const buttons=[{disabled:false},{disabled:false}];
body.querySelectorAll=()=>buttons;
body.prepend=node=>controls.set(node.id,node);
let message='';
let fail=false;
let directBlocked=false;
let secureRequests=0;
class MockFile {
  constructor(blobs,name){this.name=name;this.blob=blobs[0];this.marker=blobs[0].marker;this.size=blobs[0].size;this.type='application/pdf';}
  async arrayBuffer(){return typeof this.blob.arrayBuffer === 'function' ? this.blob.arrayBuffer() : Uint8Array.of(this.marker).buffer;}
}
const mockBlob=marker=>({marker,size:1});
const context={
  console,File:MockFile,Blob,URLSearchParams,setTimeout(){},confirm(){return true;},
  auth:{currentUser:{async getIdToken(){return 'verified-user-token';}}},
  document:{getElementById:element,createElement(){return {style:{},setAttribute(){},remove(){}};},querySelectorAll(){return[];},querySelector(){return null;}},
  $:element,
  storage:{ref(p){return {async getDownloadURL(){return 'https://local.test/'+p;}};}},
  async fetch(url,options={}) {
    if(url.startsWith('/api/pdf/session-source?')) {
      secureRequests += 1;
      assert.equal(options.headers.Authorization, 'Bearer verified-user-token');
      assert.equal(options.credentials, 'omit');
      const query=new URLSearchParams(url.split('?')[1]);
      if(fail) return {ok:false,status:404,async json(){return {detail:'저장된 원본 PDF가 없습니다.'};}};
      const index=Number(query.get('index'));
      return {
        ok:true, headers:{get(key){return key==='X-Session-File-Size' ? '1' : key==='X-Session-Offset' ? '0' : null;}},
        async arrayBuffer(){return Uint8Array.of(index===1?2:1).buffer;},
      };
    }
    if((fail && url.includes('src_1.pdf')) || directBlocked) throw Error('Failed to fetch');
    return {ok:true,async blob(){return mockBlob(url.includes('src_1.pdf')?2:1);}};
  },
  pdfjsLib:{getDocument({data}){
    const marker=data[0];
    const doc={numPages:2,async getPage(n){return {marker,number:n};}};
    return {promise:Promise.resolve(doc)};
  }},
  async renderPdfPage(page,scale,rotation){return {marker:page.marker,number:page.number,scale,rotation};},
  renderThumbs(){},renderHfSections(){},updateActualSizeUi(){},updateNupBadges(){},
  hideStatus(){},showStatus(msg){message=msg;},schedulePreview(){},
  makeBlankPage(){return {id:999,pageType:'blank'};},
  makeDividerPageObj(){return {id:998,pageType:'divider'};},
  _nextId:1,parsedPages:[{id:50,pageType:'pdf'}],
  uploadedFiles:[{name:'old.pdf'}],previewCanvases:[],fileNupMap:{},
  nup:2,orderLR:true,landscape:false,showBorder:false,
  actualSizeEnabled:false,actualWidthMm:null,actualHeightMm:null,
  wmEnabled:false,wmText:'',wmOpacity:0.15,wmAngle:0,wmColor:'#000000',
  hfEnabled:false,hfHL:'',hfHC:'',hfHR:'',hfFL:'',hfFC:'',hfFR:'',
  hfFontSize:9,hfColor:'#555555',hfApplyTo:'all',hfSections:[],hfStartPage:1,hfEndPage:null,
  pnEnabled:false,pnPosition:'bottom-center',pnFormat:'number',pnStart:1,pnStartPage:1,pnEndPage:null,
  pnFontSize:10,pnColor:'#333333',pnExcludeFirst:false,pnApplyTo:'all',facingPages:false,
  _uploadMode:'new',
  PdfUploadOptimization:{syncAggregateMode(){}},
};
context.window=context;context.makeId=()=>context._nextId++;
vm.createContext(context);
vm.runInContext(source.slice(start,end),context);
(async()=>{
  const data={name:'mixed PDFs',storagePaths:['sessions/x/src_0.pdf','sessions/x/src_1.pdf'],
    state:JSON.stringify({
      fileNames:['A.pdf','B.pdf'],
      pages:[
        {file_index:1,page_index:1,rotation:90},
        {file_index:0,page_index:0,rotation:0},
        {file_index:1,page_index:1,rotation:0},
        {pageType:'blank',groupBreak:true},
      ]
    })
  };
  assert.equal(await context.loadEditorSession(data,'id'),true);
  assert.equal(context.parsedPages.length,4, 'deleted source pages must stay deleted');
  assert.deepEqual(JSON.parse(JSON.stringify(context.parsedPages.slice(0,3).map(p=>[p.file_index,p.page_index]))),[[1,1],[0,0],[1,1]]);
  assert.notEqual(context.parsedPages[0].id,context.parsedPages[2].id,'duplicated source page needs unique editor ID');
  assert.deepEqual(JSON.parse(JSON.stringify(context.uploadedFiles.map(f=>f.name))),['A.pdf','B.pdf']);
  assert.equal(context.parsedPages[0].rotation,90);
  assert.equal(context.parsedPages[0].thumbCanvas.rotation,90);
  assert.equal(context.parsedPages[2].rotation,0);
  assert.equal(context.parsedPages[2].thumbCanvas.rotation,0,'unrotated duplicate must keep its base thumbnail');
  assert.equal(element('sessionListModal').style.display,'none');
  assert.match(message,/불러오기 완료/);
  // Simulate the actual browser CORS failure and verify the authenticated
  // same-origin chunk route rescues an otherwise valid saved session.
  directBlocked=true;
  const originalRequests=secureRequests;
  assert.equal(await context.loadEditorSession(data,'id'),true);
  assert.equal(secureRequests-originalRequests,2);
  assert.equal(context.parsedPages.length,4);
  assert.equal(context.parsedPages[0].pdfPage.marker,2);
  assert.equal(context.parsedPages[1].pdfPage.marker,1);
  const prior=context.parsedPages;
  fail=true;
  assert.equal(await context.loadEditorSession(data,'id'),false);
  assert.equal(context.parsedPages,prior,'failed download must preserve current document');
  assert.match(element('sessionRestoreStatus').textContent,/저장된 원본 PDF가 없습니다/);
  assert.ok(buttons.every(b=>!b.disabled));
  console.log('pdf session restore behavior passed');
  console.log('pdf session mixed file save-load recovery passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
