/* Print-ready duplex export: two separate physical pages, not one wide cover spread. */
'use strict';
(() => {
  if(window.DesignDuplexOutput)return;
  const CDN_PDF='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
  const CDN_ZIP='https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
  const scripts=new Map();
  function library(url,globalName){
    if(window[globalName])return Promise.resolve(window[globalName]);
    if(!scripts.has(url))scripts.set(url,new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=url;
      script.onload=()=>window[globalName]?resolve(window[globalName]):reject(new Error('인쇄용 출력 구성요소를 읽지 못했습니다.'));
      script.onerror=()=>reject(new Error('출력 라이브러리를 내려받지 못했습니다. 인터넷 연결을 확인하세요.'));
      document.head.appendChild(script);
    }).catch(error=>{scripts.delete(url);throw error;}));
    return scripts.get(url);
  }
  function dimensions(spec,scale){
    const sideWidth=(spec.trimW+spec.bleed*2)*scale;
    const height=spec.workH*scale;
    const shift=spec.trimW*scale;
    return {sideWidth,height,shift};
  }
  async function splitPdf(blob,spec){
    const lib=await library(CDN_PDF,'PDFLib');
    const bytes=await blob.arrayBuffer();
    const doc=await lib.PDFDocument.create();
    const [source]=await doc.embedPdf(bytes,[0]);
    const scale=72/25.4,{sideWidth,height,shift}=dimensions(spec,scale);
    for(const [index,name] of ['back','front'].entries()){
      const page=doc.addPage([sideWidth,height]);
      page.drawPage(source,{x:index===0?0:-shift,y:0,width:spec.workW*scale,height});
      if(spec.bleed>0)page.setTrimBox(spec.bleed*scale,spec.bleed*scale,spec.trimW*scale,spec.trimH*scale);
      page.setBleedBox(0,0,sideWidth,height);
    }
    doc.setTitle('Program Studio 양면 인쇄 디자인');
    doc.setCreator('Program Studio');
    return new Blob([await doc.save()],{type:'application/pdf'});
  }
  async function pngZip(canvas,spec,pngWithDpi){
    const ZIP=await library(CDN_ZIP,'JSZip');
    const zip=new ZIP();
    const scale=300/25.4,{sideWidth,shift}=dimensions(spec,scale);
    const width=Math.round(sideWidth),step=Math.round(shift);
    for(const [index,name] of ['back','front'].entries()){
      const side=document.createElement('canvas');
      side.width=width;
      side.height=canvas.height;
      const sx=index===0?0:step;
      side.getContext('2d').drawImage(canvas,sx,0,width,canvas.height,0,0,width,canvas.height);
      const blob=await new Promise((resolve,reject)=>side.toBlob(x=>x?resolve(x):reject(new Error('양면 PNG 생성 실패')),'image/png'));
      const png=await pngWithDpi(blob);
      zip.file((index===0?'01-back':'02-front')+'-300dpi.png',png);
      side.width=1;side.height=1;
    }
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:5}});
  }
  window.DesignDuplexOutput={splitPdf,pngZip,dimensions};
})();