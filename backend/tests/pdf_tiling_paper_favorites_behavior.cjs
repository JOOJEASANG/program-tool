const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('js/pdf-large-output-tiling.js','utf8');
const shared=fs.readFileSync('js/shared-paper-favorites.js','utf8');
const nodes=new Map(), data=new Map(), events=[];
function node(id){
  if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,style:{},options:[],
    replaceChildren(){this.options=[];this.value='';},appendChild(option){this.options.push(option);}});
  return nodes.get(id);
}
const document={getElementById:id=>id==='plotSavedPaper'?node(id):nodes.get(id)||null,
  createElement:()=>({value:'',textContent:''})};
const ctx={document,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},
  Event:class{constructor(type){this.type=type;}},console,confirm:()=>true,dispatchEvent:e=>events.push(e.type),
  PAPER:{A4:[210,297],A3:[297,420]}, $:node, renderPreview:()=>{}};
ctx.window=ctx;vm.createContext(ctx);
vm.runInContext(shared,ctx);
const start=source.indexOf('  function paperStatus('),end=source.indexOf('  function openModal()',start);
vm.runInContext(source.slice(start,end),ctx);
node('plotPaper').value='CUSTOM';node('plotPaperWidth').value='305';node('plotPaperHeight').value='457';
node('plotPaperName').value='디지털 305×457';ctx.saveFavorite();
assert.equal(ctx.SharedPaperFavorites.load().length,1);
const saved=ctx.SharedPaperFavorites.load()[0];
assert.equal(saved.width,305);assert.equal(saved.height,457);
assert.equal(node('plotSavedPaper').value,saved.id);
node('plotPaper').value='A4';node('plotPaperWidth').value='210';ctx.applyFavorite();
assert.equal(node('plotPaper').value,'CUSTOM');assert.equal(node('plotPaperWidth').value,305);
assert.equal(Number(node('plotPaperHeight').value),457);assert.equal(node('plotCustomPaper').hidden,false);
node('plotPaperWidth').value='1201';ctx.saveFavorite();assert.equal(ctx.SharedPaperFavorites.load()[0].width,305);
node('plotPaperWidth').value='305';ctx.deleteFavorite();assert.equal(ctx.SharedPaperFavorites.load().length,0);
assert.equal(node('plotPaperWidth').value,'305');
assert.equal(node('plotPaperHeight').value,457);
assert.ok(events.includes('shared-paper-favorites-change'));
console.log('tiling shared paper favorites behavior passed');
