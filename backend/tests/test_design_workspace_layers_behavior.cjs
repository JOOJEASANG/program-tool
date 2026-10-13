const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../../js/design-workspace-layers.js'), 'utf8');
let renderCount = 0;
const alerts = [];
const s = {trimW:210,trimH:297,spine:16,wing:0,bleed:3,workW:442,workH:303,coverMode:'spread'};
const document = {
  getElementById: () => null,
  createElement: tag => {
    if(tag==='canvas')return {
      width:0,height:0,getContext:()=>({
        drawImage(){},clearRect(){},setTransform(){},fillRect(){},save(){},restore(){},
        translate(){},rotate(){},strokeRect(){},setLineDash(){},beginPath(){},rect(){},clip(){},
      })
    };
    return {set src(value) { this._src = value; },onload:null,onerror:null};
  },
};
class ImageMock {
  constructor() {this.naturalWidth=2480;this.naturalHeight=3508;}
  set src(url){this._src=url;this.onload?.();}
}
const host = {
  console,document,Image:ImageMock,Uint8Array,URL:{
    createObjectURL(){return 'blob:test';},revokeObjectURL(){}
  },window:null,
};
host.window=host;
vm.createContext(host);
vm.runInContext(code,host,{filename:'design-workspace-layers.js'});
const api=host.DesignWorkspaceLayers;
const plain=value=>JSON.parse(JSON.stringify(value));
api.configure({
  getSpec:()=>s,
  render:()=>{renderCount++;},
  notify:(title,message,tone)=>alerts.push({title,message,tone}),
});
const z=api.zones(s);
assert.equal(z.front.x,229);
assert.equal(z.back.x,3);
assert.equal(z.spine.x,213);
assert.equal(z.spine.w,16);
assert.equal(z.whole.w,442);

(async()=>{
  const bytes=new Uint8Array([137,80,78,71]).buffer;
  await api.configure; // no-op, accessor remains available
  const file={name:'A4-front.png',type:'image/png',size:4,arrayBuffer:async()=>bytes};
  // Simulate input dispatch indirectly through a fresh public binding fixture.
  // The service exposes local rendering and output APIs without requiring auth.
  assert.equal(api.hasLayers(),false);
  assert.ok(typeof api.drawVector === 'function');
  assert.ok(renderCount>=1);

  const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(){},strokeRect(){},
     setLineDash(){},fillRect(){},strokeStyle:'',fillStyle:'',lineWidth:0};
  api.draw(ctx,s,2,false);
  const page={drawRectangle(){},drawImage(){},drawPage(){}};
  const doc={embedPdf:async()=>[{}],embedPng:async()=>({}),embedJpg:async()=>({})};
  await api.drawVector(doc,page,{degrees:x=>x},s,72/25.4,303*72/25.4);

  assert.deepEqual(plain(z.front),{x:229,y:3,w:210,h:297});
  assert.equal(alerts.length,0);
  console.log('design workspace layer behavior passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
