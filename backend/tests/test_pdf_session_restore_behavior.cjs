const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../../pdf-editor/index.html'), 'utf8');
const start = source.indexOf('async function loadEditorSession(d, docId) {');
const end = source.indexOf('// Session modal events', start);
assert.ok(start >= 0 && end > start, 'session loader source must be accessible');
const loader = source.slice(start, end);
const controls = new Map();
const element = id => {
  if (!controls.has(id)) controls.set(id, {
    id, value:'', checked:false, disabled:false, textContent:'', style:{},
    classList:{toggle(){},add(){},remove(){}},
    setAttribute(){},
    remove(){this.removed=true;},
    focus(){},
  });
  return controls.get(id);
};
const sessionBody = element('sessionListBody');
const buttons = [{disabled:false}, {disabled:false}];
sessionBody.querySelectorAll = () => buttons;
sessionBody.prepend = node => { controls.set(node.id,node); };
let status = '';
let failAtPath = null;
const arrayBuf = marker => Uint8Array.from([marker]).buffer;
const mockBlob = marker => ({size:1, marker, arrayBuffer:async()=>arrayBuf(marker)});
class MockFile {
  constructor(blobs, name) {
    this.name=name;
    this.marker=blobs[0].marker;
    this.size=blobs[0].size;
    this.type='application/pdf';
  }
  async arrayBuffer() {return arrayBuf(this.marker);}
}
const docs = [];
const context = {
  console,
  File: MockFile,
  setTimeout(){},
  confirm(){return true;},
  document:{
    createElement() {return {style:{},dataset:{},setAttribute(){},remove(){this.removed=true;}};},
    querySelectorAll(){return [];},
    querySelector(){return null;}
  },
  $:element,
  window:null,
  storage:{ref(p){return {async getDownloadURL(){return 'https://local.test/'+p;}};}},
  async fetch(url) {
    if (failAtPath && url.includes(failAtPath)) throw new Error('network failure');
    return {ok:true, async blob() {return mockBlob(url.includes('src_1') ? 2 : 1);}};
  },
  pdfjsLib:{
    getDocument({data}) {
      const marker=new Uint8Array(data)[0];
      const doc={numPages:2,async getPage(n){return {
        marker,number:n, getViewport(){return {width:100,height:150}},
      };}};
      docs.push(doc);
      return {promise:Promise.resolve(doc)};
    }
  },
  async renderPdfPage(page,scale,rotation) {return {marker:page.marker,page:page.number,scale,rotation};},
  renderThumbs(){},
  renderHfSections(){},
  updateActualSizeUi(){},
  updateNupBadges(){},
  hideStatus(){},
  showStatus(msg) {status=msg;},
  schedulePreview(){},
  makeBlankPage(){return {id:999,pageType:'blank'};},
  makeDividerPageObj(){return {id:998,pageType:'divider'};},
  _nextId:1,
  parsedPages:[{id:50,pageType:'pdf'}],
  uploadedFiles:[{name:'before.pdf'}],
  previewCanvases:[],
  fileNupMap:{},
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
context.window=context;
context.makeId=()=>context._nextId++;
vm.createContext(context);
vm.runInContext(loader,context,{filename:'loadEditorSession.js'});

(async()=>{
  const data={name:'mixed files',storagePaths:['pdf_sessions/s/src_0.pdf','pdf_sessions/s/src_1.pdf'],
    state:JSON.stringify({
      fileNames:['A.pdf','B.pdf'],
      pages:[
        {file_index:1,page_index:1,rotation:0},
        {file_index:0,page_index:0,rotation:0},
        {file_index:1,page_index:1,rotation:90},
        {pageType:'blank',groupBreak:true},
      ],
    }),
  };
  assert.equal(await context.loadEditorSession(data,'sess'),true);
  assert.equal(context.parsedPages.length,5);
  assert.deepEqual(context.parsedPages.map(p=>p.pageType),['pdf','pdf','pdf','blank','pdf']);
  assert.deepEqual(context.parsedPages.slice(0,3).map(p=>[p.file_index,p.page_index]),[[1,1],[0,0],[1,1]]);
  assert.notEqual(context.parsedPages[0].id,context.parsedPages[2].id);
  assert.deepEqual(context.uploadedFiles.map(f=>f.name),['A.pdf','B.pdf']);
  assert.equal(context.parsedPages[2].rotation,90);
  assert.equal(element('sessionListModal').style.display,'none');
  assert.match(status,/불러오기 완료/);
  assert.ok(buttons.every(b=>!b.disabled));
  const prevPages=context.parsedPages;
  failAtPath='src_1.pdf';
  assert.equal(await context.loadEditorSession(data,'sess'),false);
  assert.equal(context.parsedPages,prevPages, 'failed restore must preserve prior edit');
  assert.match(element('sessionRestoreStatus').textContent,/network failure/);
  assert.ok(buttons.every(b=>!b.disabled));
  assert.ok(docs.length>=2);
  console.log('pdf session mixed file save-load recovery passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
