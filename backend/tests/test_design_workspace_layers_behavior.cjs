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
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]).buffer;
  const file={name:'A4-front.png',type:'image/png',size:4,arrayBuffer:async()=>bytes};
  assert.equal(api.hasLayers(),false);
  await api.importFiles([file]);
  assert.equal(api.hasLayers(),true);
  assert.equal(api.layers.length,1);
  assert.equal(api.active.name,'A4-front.png');
  assert.ok(Math.abs(api.active.x-229)<1);
  assert.ok(Math.abs(api.active.w-210)<1);
  assert.equal(api.active.type,'image');

  let drawn=0,png=0,pdf=0;
  const ctx={save(){},restore(){},translate(){},rotate(){},drawImage(){drawn++;},strokeRect(){},
     setLineDash(){},fillRect(){},strokeStyle:'',fillStyle:'',lineWidth:0};
  api.draw(ctx,s,2,false);
  assert.equal(drawn,1);
  api.draw(ctx,s,2,true);
  assert.equal(drawn,1,'selection handles must not draw imported artwork on top of text');
  const page={drawRectangle(){},drawImage(){png++;},drawPage(){pdf++;}};
  const doc={
    embedPdf:async()=>[{}],
    embedPng:async()=>({}),
    embedJpg:async()=>({})
  };
  await api.drawVector(doc,page,{degrees:x=>x},s,72/25.4,303*72/25.4);
  assert.equal(png,1,'bitmap must survive vector PDF export');

  // A separate PDF source must be embedded using the original PDF bytes.
  let embeddedPdf=0;
  let maxRenderedPdfScale=0;
  host.pdfjsLib={
    GlobalWorkerOptions:{},
    getDocument:()=>({promise:Promise.resolve({
      numPages:2,
      getPage:async()=>({
        getViewport:({scale})=>{maxRenderedPdfScale=Math.max(scale,maxRenderedPdfScale);return {width:595*scale,height:842*scale};},
        render:()=>({promise:Promise.resolve()})
      }),
      destroy(){}
    })})
  };
  await api.importFiles([{name:'source.pdf',type:'application/pdf',size:4,arrayBuffer:async()=>bytes}]);
  assert.equal(api.layers.length,2);
  assert.equal(api.active.type,'pdf');
  const pdfDoc={
    embedPdf:async(payload,indices)=>{embeddedPdf++;assert.equal(indices[0],0);return [{}];},
    embedPng:async()=>({}),embedJpg:async()=>({})
  };
  await api.drawVector(pdfDoc,page,{degrees:x=>x},s,72/25.4,303*72/25.4);
  assert.equal(embeddedPdf,1);
  assert.equal(pdf,1,'PDF must draw as a source PDF page, not rasterized preview');
  await api.drawForExport(ctx,s,300/25.4);
  assert.ok(maxRenderedPdfScale>3,'300dpi image output must rerender imported PDF instead of scaling preview');
  assert.equal(drawn,3,'image and PDF must both be composited in final raster export');
  api.removeSelected();
  assert.equal(api.layers.length,1);
  assert.deepEqual(plain(z.front),{x:229,y:3,w:210,h:297});
  assert.equal(alerts.length,2);
  // Two overlapping import requests must respect the same global 16-layer
  // limit; no request may race ahead while a PDF/image is being decoded.
  const extras=Array.from({length:17},(_,i)=>({...file,name:'extra-'+i+'.png'}));
  await Promise.all([api.importFiles(extras.slice(0,8)),api.importFiles(extras.slice(8))]);
  assert.equal(api.layers.length,16,'concurrent import exceeded the layer count limit');
  assert.equal(alerts.filter(x=>x.tone==='error').length,2,'rejected excess imports need an error');
  const previousRenders=renderCount;
  assert.equal(api.clearAll({silent:true}),16,'clear must dispose all file layers');
  assert.equal(api.hasLayers(),false);
  assert.equal(api.layers.length,0);
  assert.equal(renderCount,previousRenders,'silent gallery clear should not repaint an intermediate state');
  let finishOldRead;
  const slowFile={...file,name:'old-gallery.png',
    arrayBuffer:()=>new Promise(resolve=>{finishOldRead=resolve;})};
  const oldBatch=api.importFiles([slowFile]);
  // Let the queued file begin reading but defer its completion until after
  // a new gallery replaces the canvas.
  for(let n=0;n<10 && !finishOldRead;n++)await Promise.resolve();
  assert.equal(typeof finishOldRead,'function');
  assert.equal(api.clearAll({silent:true}),0);
  finishOldRead(bytes);
  await oldBatch;
  assert.equal(api.layers.length,0,'in-flight image read resurrected an old gallery layer');
  await api.importFiles([{...file,name:'current-gallery.png'}]);
  assert.equal(api.layers.length,1,'fresh imports after a gallery replacement were blocked');
  api.clearAll({silent:true});
  assert.equal(api.layers.length,0);
  console.log('design workspace layer behavior passed');
})().catch(err=>{console.error(err);process.exitCode=1;});
