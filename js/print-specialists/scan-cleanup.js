// Scan-to-print cleanup, processed entirely in the browser; output is raster PDF.
(function(){
'use strict';
function install(){
 if(!window.PrintSpecialistUi)return setTimeout(install,80);
 const ui=window.PrintSpecialistUi;
 ui.register('scan',{
  title:'스캔 문서 깨끗하게',
  description:'종이 원고 PDF·사진의 얼룩·회색 배경·검은 테두리·기울기를 정리합니다.',
  markup:[
   '<div class="ps-fields">',
   '<label class="wide">스캔 파일 (PDF, JPG, PNG)<input type="file" id="scFile" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"></label>',
   '<label>화질 모드<select id="scMode"><option value="bw">흑백 문서 (선명한 글자)</option><option value="gray">회색조 (사진/음영 보존)</option></select></label>',
   '<label>배경 밝게 (기준 0~255)<input id="scThreshold" type="number" value="205" min="110" max="245"></label>',
   '<label>농도 보정<select id="scContrast"><option value="1">보통</option><option value="1.3" selected>조금 진하게</option><option value="1.6">진하게</option></select></label>',
   '<label>기울기 수동 보정 (°)<input id="scRotate" type="number" min="-5" max="5" step=".1" value="0"></label>',
   '<label>외곽 검은 테두리 제거 (mm)<input id="scBorder" type="number" min="0" max="10" step=".5" value="2"></label>',
   '<label>이미지 입력 시 PDF 용지<select id="scPaper"><option value="A4">A4 (210×297mm)</option><option value="A3">A3 (297×420mm)</option><option value="B5">B5 (182×257mm)</option></select></label>',
   '<label>인쇄 해상도<select id="scDpi"><option value="200">200dpi (속도 우선)</option><option value="300" selected>300dpi (인쇄 권장)</option></select></label>',
   '</div>',
   '<p class="ps-help">OCR 문자를 다시 쓰는 기능은 아닙니다. 스캔 이미지의 회색 바탕·번짐을 정리하고 기울기를 수동 보정합니다. 양면 비침이나 접힘 그림자는 원고 상태에 따라 남을 수 있으니 첫 장 미리보기를 확인하세요.</p>',
   '<div class="ps-actions"><button type="button" class="ps-btn secondary" id="scPreview">첫 장 보정 미리보기</button><button class="ps-btn" type="button" id="scRun">깨끗한 인쇄용 PDF 저장</button></div>',
   '<p class="ps-status" role="status" aria-live="polite">스캔 문서를 선택하세요. 파일은 브라우저에서만 처리합니다.</p>',
   '<div class="ps-preview" id="scPreviewBox">보정된 첫 장이 표시됩니다.</div>',
   '<p class="ps-note">PDF 최대 20페이지·파일 50MB. 결과는 이미지 PDF이며 원본의 검색 가능한 텍스트 레이어는 보존되지 않습니다. 원본 PDF는 별도로 보관하세요.</p>'
  ].join(''),
  bind(body,ctx){
   const $=id=>body.querySelector('#'+id);
   let file=null,pages=0,kind='',pdfBytes=null;
   $('scFile').addEventListener('change',async()=>{
    file=$('scFile').files?.[0]||null;pages=0;kind='';pdfBytes=null;
    if(!file)return;
    try{
      if(file.size>50*1024*1024)throw Error('스캔 파일은 50MB 이하만 지원합니다.');
      kind=/\.pdf$/i.test(file.name)||file.type==='application/pdf'?'pdf':'image';
      if(kind==='pdf'){
        await ctx.library('pdfjs');pdfBytes=await file.arrayBuffer();
        const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(pdfBytes.slice(0))}).promise;
        pages=doc.numPages;await doc.destroy();
      }else pages=1;
      if(pages>20)throw Error('20페이지를 초과했습니다. PDF를 나누어 처리하세요.');
      ctx.setStatus(body,file.name+' · '+pages+'페이지 선택됨');
    }catch(e){file=null;ctx.setStatus(body,e.message,true);}
   });
   function options(){
     const degree=Number($('scRotate').value),border=Number($('scBorder').value),threshold=Number($('scThreshold').value),contrast=Number($('scContrast').value);
     if(![degree,border,threshold,contrast].every(Number.isFinite)||Math.abs(degree)>5||border<0||border>10||threshold<110||threshold>245)throw Error('보정 옵션을 확인하세요.');
     return {degree,border,threshold,contrast,mode:$('scMode').value,dpi:Number($('scDpi').value),paper:$('scPaper').value};
   }
   async function sourceAt(index,dpi){
     let widthMm,heightMm,canvas;
     if(kind==='pdf'){
       // Separate copy prevents pdfjs from detaching a reusable ArrayBuffer.
       const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(pdfBytes.slice(0))}).promise;
       try{
         const page=await doc.getPage(index+1),vp=page.getViewport({scale:dpi/72});
         widthMm=vp.width*25.4/dpi;heightMm=vp.height*25.4/dpi;
         if(vp.width*vp.height>24000000)throw Error('페이지가 너무 큽니다. 200dpi로 낮춰주세요.');
         canvas=document.createElement('canvas');canvas.width=Math.round(vp.width);canvas.height=Math.round(vp.height);
         const c=canvas.getContext('2d',{alpha:false});c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);
         await page.render({canvasContext:c,viewport:vp,background:'#ffffff'}).promise;
       }finally{await doc.destroy();}
     }else{
       const image=await createImageBitmap(file);
       try{
         const sizes={A4:[210,297],A3:[297,420],B5:[182,257]},p=sizes[$('scPaper').value];
         if(image.width>image.height){widthMm=p[1];heightMm=p[0];}else [widthMm,heightMm]=p;
         const w=Math.round(widthMm*dpi/25.4),h=Math.round(heightMm*dpi/25.4);
         canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
         const c=canvas.getContext('2d',{alpha:false});c.fillStyle='white';c.fillRect(0,0,w,h);
         const factor=Math.min(w/image.width,h/image.height);
         c.drawImage(image,(w-image.width*factor)/2,(h-image.height*factor)/2,image.width*factor,image.height*factor);
       }finally{image.close();}
     }
     return {canvas,widthMm,heightMm};
   }
   function clean(src,opt){
     const {canvas:original,widthMm,heightMm}=src;
     const canvas=document.createElement('canvas');canvas.width=original.width;canvas.height=original.height;
     const c=canvas.getContext('2d',{willReadFrequently:true,alpha:false});
     c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
     const angle=opt.degree*Math.PI/180;
     c.save();c.translate(canvas.width/2,canvas.height/2);c.rotate(angle);
     c.drawImage(original,-original.width/2,-original.height/2);c.restore();
     const data=c.getImageData(0,0,canvas.width,canvas.height),pix=data.data;
     const cutoff=opt.threshold;
     for(let i=0;i<pix.length;i+=4){
       const gray=Math.round(.2126*pix[i]+.7152*pix[i+1]+.0722*pix[i+2]);
       let out;
       if(opt.mode==='bw')out=gray<cutoff?0:255;
       else{
         // Raise off-white paper to pure white while preserving pencil tones.
         const adjusted=255-(255-gray)*opt.contrast;
         out=adjusted>cutoff?255:Math.max(0,Math.min(255,Math.round(adjusted)));
       }
       pix[i]=out;pix[i+1]=out;pix[i+2]=out;pix[i+3]=255;
     }
     c.putImageData(data,0,0);
     const edge=Math.round(opt.border*canvas.width/widthMm);
     if(edge>0){c.fillStyle='#fff';c.fillRect(0,0,canvas.width,edge);c.fillRect(0,canvas.height-edge,canvas.width,edge);
       c.fillRect(0,0,edge,canvas.height);c.fillRect(canvas.width-edge,0,edge,canvas.height);}
     return canvas;
   }
   async function execute(preview){
     const run=$('scRun'),prev=$('scPreview');run.disabled=true;prev.disabled=true;
     try{
       if(!file)throw Error('먼저 PDF 또는 사진 파일을 선택하세요.');
       const opt=options(),dpi=preview?96:opt.dpi;
       await ctx.library('pdf');if(kind==='pdf')await ctx.library('pdfjs');
       const out=preview?null:await window.PDFLib.PDFDocument.create();
       for(let i=0;i<(preview?1:pages);i++){
         ctx.setStatus(body,'스캔 보정 중 · '+(i+1)+' / '+(preview?1:pages)+'페이지');
         const src=await sourceAt(i,dpi),cleaned=clean(src,opt);
         if(i===0){const shown=document.createElement('canvas');const scale=Math.min(1,760/cleaned.width);shown.width=Math.round(cleaned.width*scale);shown.height=Math.round(cleaned.height*scale);
           shown.getContext('2d').drawImage(cleaned,0,0,shown.width,shown.height);$('scPreviewBox').replaceChildren(shown);}
         if(out){
           const image=await out.embedJpg(cleaned.toDataURL('image/jpeg',opt.mode==='bw'?.94:.91));
           const w=ctx.mm(src.widthMm),h=ctx.mm(src.heightMm);
           out.addPage([w,h]).drawImage(image,{x:0,y:0,width:w,height:h});
         }
       }
       if(out){ctx.download(await out.save(),'스캔_인쇄복원.pdf');ctx.setStatus(body,pages+'페이지 보정 PDF 저장 완료. 글자·사진을 확대해 확인하세요.');}
       else ctx.setStatus(body,'첫 장 미리보기입니다. 원고에 따라 밝기·기울기를 조절하세요.');
     }catch(e){ctx.setStatus(body,'처리 실패: '+e.message,true);}
     finally{run.disabled=false;prev.disabled=false;}
   }
   $('scPreview').addEventListener('click',()=>execute(true));
   $('scRun').addEventListener('click',()=>execute(false));
  }
 });
 // Capture the genuine catalog menu on window before the PDF Suite document
 // capture listeners; no nested generic PDF modal is created.
 window.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-pdfu-tool]');
   if(!button||button.dataset.pdfuCoreSource!=='스캔 문서 깨끗하게')return;
   event.preventDefault();event.stopImmediatePropagation();ui.open('scan');
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();