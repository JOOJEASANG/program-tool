// Shared image -> one-page PDF adapter. Keeps existing PDF engines PDF-only internally.
(function(){
  'use strict';
  if(window.ProgramImagePdfAdapter)return;

  const DEFAULT_DPI=300;
  const MAX_IMAGE_BYTES=25*1024*1024;
  const MAX_PIXELS=40*1000*1000;
  const IMAGE_EXT=/\.(?:jpe?g|png|webp)$/i;
  const PDF_EXT=/\.pdf$/i;
  const JSPDF_SRC='https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  let jsPdfPromise=null;

  function isPdf(file){
    return Boolean(file&&((file.type||'').toLowerCase()==='application/pdf'||PDF_EXT.test(file.name||'')));
  }

  function isImage(file){
    if(!file)return false;
    const type=(file.type||'').toLowerCase();
    return type==='image/jpeg'||type==='image/png'||type==='image/webp'||IMAGE_EXT.test(file.name||'');
  }

  function isSupported(file){return isPdf(file)||isImage(file);}

  function acceptString(){
    return 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
  }

  async function loadBitmap(file){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_){ }
      try{return await createImageBitmap(file);}catch(_){ }
    }
    const url=URL.createObjectURL(file);
    try{
      const image=new Image();
      image.decoding='async';
      image.src=url;
      if(typeof image.decode==='function')await image.decode();
      else await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('이미지를 읽지 못했습니다.'));});
      return image;
    }finally{
      URL.revokeObjectURL(url);
    }
  }

  async function getJsPdf(){
    const current=window.jspdf?.jsPDF;
    if(typeof current==='function')return current;
    if(!jsPdfPromise){
      jsPdfPromise=new Promise((resolve,reject)=>{
        const existing=document.querySelector(`script[data-program-image-jspdf="1"]`)||
          Array.from(document.scripts||[]).find(script=>String(script.src||'').includes('/jspdf@2.5.1/'));
        const script=existing||document.createElement('script');
        let timer;
        const cleanup=()=>{clearTimeout(timer);script.removeEventListener('load',onLoad);script.removeEventListener('error',onError);};
        const onLoad=()=>{const ctor=window.jspdf?.jsPDF;cleanup();if(typeof ctor==='function')resolve(ctor);else reject(new Error('이미지 PDF 변환 모듈을 초기화하지 못했습니다.'));};
        const onError=()=>{cleanup();reject(new Error('이미지 PDF 변환 모듈을 불러오지 못했습니다.'));};
        script.addEventListener('load',onLoad,{once:true});
        script.addEventListener('error',onError,{once:true});
        timer=setTimeout(onError,15000);
        if(!existing){script.src=JSPDF_SRC;script.async=true;script.dataset.programImageJspdf='1';document.head.appendChild(script);}
        else if(typeof window.jspdf?.jsPDF==='function')onLoad();
      }).catch(error=>{jsPdfPromise=null;throw error;});
    }
    return jsPdfPromise;
  }

  function safeBaseName(name){
    const value=String(name||'image').replace(/\.[^.]+$/,'').trim()||'image';
    return value.replace(/[\\/:*?"<>|]+/g,'_').slice(0,120);
  }

  function canvasToJpeg(canvas,quality){
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('이미지 변환 캔버스를 만들지 못했습니다.');
    return canvas.toDataURL('image/jpeg',quality);
  }

  async function imageToPdf(file,options={}){
    if(!isImage(file))throw new Error(`${file?.name||'파일'}: JPG, PNG, WEBP 이미지만 사용할 수 있습니다.`);
    if(file.size>MAX_IMAGE_BYTES)throw new Error(`${file.name}: 이미지는 25MB 이하 파일을 사용해 주세요.`);

    const dpi=Math.max(72,Math.min(600,Number(options.dpi)||DEFAULT_DPI));
    const bitmap=await loadBitmap(file);
    const width=Number(bitmap.width||bitmap.naturalWidth||0);
    const height=Number(bitmap.height||bitmap.naturalHeight||0);
    if(!width||!height)throw new Error(`${file.name}: 이미지 크기를 확인할 수 없습니다.`);
    if(width*height>MAX_PIXELS)throw new Error(`${file.name}: 이미지가 너무 큽니다. 4천만 픽셀 이하 이미지를 사용해 주세요.`);

    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('이미지 변환 캔버스를 만들지 못했습니다.');
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(bitmap,0,0,width,height);
    try{bitmap.close?.();}catch(_){ }

    const widthMm=width/dpi*25.4;
    const heightMm=height/dpi*25.4;
    const JsPdf=await getJsPdf();
    const pdf=new JsPdf({
      orientation:widthMm>heightMm?'landscape':'portrait',
      unit:'mm',
      format:[widthMm,heightMm],
      compress:true,
      putOnlyUsedFonts:true
    });
    const jpeg=canvasToJpeg(canvas,Number(options.quality)||0.92);
    pdf.addImage(jpeg,'JPEG',0,0,widthMm,heightMm,undefined,'FAST');
    const blob=pdf.output('blob');
    canvas.width=1;canvas.height=1;
    const pdfFile=new File([blob],`${safeBaseName(file.name)}.pdf`,{type:'application/pdf',lastModified:file.lastModified||Date.now()});
    Object.defineProperties(pdfFile,{
      __sourceType:{value:'image',enumerable:false},
      __displayName:{value:file.name,enumerable:false},
      __imageMeta:{value:{widthPx:width,heightPx:height,widthMm,heightMm,dpi,originalType:file.type||''},enumerable:false}
    });
    return pdfFile;
  }

  async function normalizeFile(file,options={}){
    if(isPdf(file))return file;
    if(isImage(file))return imageToPdf(file,options);
    throw new Error(`${file?.name||'파일'}: PDF, JPG, PNG, WEBP 파일만 사용할 수 있습니다.`);
  }

  async function normalizeFiles(files,options={}){
    const output=[];
    for(const file of Array.from(files||[])){
      if(!isSupported(file))continue;
      output.push(await normalizeFile(file,options));
    }
    return output;
  }

  window.ProgramImagePdfAdapter={
    isPdf,isImage,isSupported,acceptString,imageToPdf,normalizeFile,normalizeFiles,
    defaultDpi:DEFAULT_DPI,
    jsPdfSource:JSPDF_SRC,
    stage:'image-pdf-adapter-v1-pdf-core-isolation'
  };
})();
