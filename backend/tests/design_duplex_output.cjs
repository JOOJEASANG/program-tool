const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync('js/design-duplex-output.js','utf8');
const pages=[],sources=[],images=[],files=[];
const fakeDoc={
 embedPdf:async bytes=>[{width:1234,height:567}],
 addPage:dimensions=>{
   const page={dims:dimensions,setTrimBox(){},setBleedBox(){},
    drawPage:(_source,args)=>{sources.push(args);}};
   pages.push(page);return page;
 },
 setTitle(){},setCreator(){},save:async()=>new Uint8Array([37,80,68,70])
};
class FakeZip{
 file(name,blob){files.push({name,blob});}
 async generateAsync(){return new Blob(['zip'],{type:'application/zip'});}
}
const document={createElement(tag){assert.equal(tag,'canvas');return {
 width:0,height:0,getContext:()=>({drawImage(...args){images.push(args);}}),
 toBlob(callback){callback(new Blob(['png'],{type:'image/png'}));}
};}};
const window={PDFLib:{PDFDocument:{create:async()=>fakeDoc}},JSZip:FakeZip};
const sandbox={window,document,Blob,Map,Promise,setTimeout,clearTimeout};
vm.runInNewContext(code,sandbox);
const s={trimW:210,trimH:297,bleed:3,workW:426,workH:303};
(async()=>{
  const pdf=await window.DesignDuplexOutput.splitPdf(new Blob(['source'],{type:'application/pdf'}),s);
  assert.equal(pdf.type,'application/pdf');
  assert.equal(pages.length,2);
  assert.equal(sources.length,2);
  assert.ok(sources[0].x<0,'front page must crop the right half of the spread');
  assert.equal(sources[1].x,0,'back page must crop the left half');
  const width=(s.trimW+2*s.bleed)*72/25.4;
  assert.ok(Math.abs(pages[0].dims[0]-width)<0.01);
  const canvas={width:5032,height:3579};
  const zip=await window.DesignDuplexOutput.pngZip(canvas,s,async b=>b);
  assert.equal(zip.type,'application/zip');
  assert.deepEqual(files.map(f=>f.name),['01-front-300dpi.png','02-back-300dpi.png']);
  assert.equal(images.length,2);
  assert.ok(images[0][1]>0,'front PNG crops right panel');
  assert.equal(images[1][1],0,'back PNG crops left panel');
  console.log('duplex export behavior passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
