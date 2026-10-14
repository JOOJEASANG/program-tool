const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../pdf-editor/index.html'), 'utf8');
const start = source.indexOf('async function loadEditorSession(d, docId) {');
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
class MockFile {
  constructor(blobs,name){this.name=name;this.marker=blobs[0].marker;this.size=blobs[0].size;this.type='application/pdf';}
  async arrayBuffer(){return Uint8Array.of(this.marker).buffer;}
}
const mockBlob=marker=>({marker,size:1});
const context={
  console,File:MockFile,setTimeout(){},confirm(){return true;},
  document:{createElement(){return {style:{},setAttribute(){},remove(){}};},querySelectorAll(){return[];},querySelector(){return null;}},
  $:element,
  storage:{ref(p){return {async getDownloadURL(){return 'https://local.test/'+p;}};}},
  async fetch(url) {
    if(fail && url.includes('src_1.pdf')) throw Error('network failure');
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
        {file_index:1,page_index:1,rotation:0},
        {file_index:0,page_index:0,rotation:0},
        {file_index:1,page_index:1,rotation:90},
        {pageType:'blank',groupBreak:true},
      ]
    })
  };
  assert.equal(await context.loadEditorSession(data,'id'),true);
  assert.equal(context.parsedPages.length,4, 'deleted source pages must stay deleted');
  assert.deepEqual(context.parsedPages.slice(0,3).map(p=>[p.file_index,p.page_index]),[[1,1],[0,0],[1,1]]);
  assert.notEqual(context.parsedPages[0].id,context.parsedPages[2].id,'duplicated source page needs unique editor ID');
  assert.deepEqual(context.uploadedFiles.map(f=>f.name),['A.pdf','B.pdf']);
  assert.equal(context.parsedPages[2].rotation,90);
  assert.equal(element('sessionListModal').style.display,'none');
  assert.match(message,/불러오기 완료/);
  const prior=context.parsedPages;
  fail=true;
  assert.equal(await context.loadEditorSession(data,'id'),false);
  assert.equal(context.parsedPages,prior,'failed download must preserve current document');
  assert.match(element('sessionRestoreStatus').textContent,/network failure/);
  assert.ok(buttons.every(b=>!b.disabled));
  console.log('pdf session restore behavior passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
