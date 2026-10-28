// Duplex calibration and independent odd/even PDF offsets. Source vectors stay vectors.
(function(){
'use strict';
function install(){
 if(!window.PrintSpecialistUi)return setTimeout(install,80);
 const ui=window.PrintSpecialistUi;
 ui.register('duplex',{
  title:'양면 인쇄 위치 맞추기',
  description:'앞면·뒷면의 인쇄 위치 차이를 mm로 보정하고 시험 출력 PDF를 만듭니다.',
  markup:[
   '<div class="ps-fields">',
   '<label class="wide">2페이지 이상 양면 PDF 파일<input id="dxFile" type="file" accept=".pdf,application/pdf"></label>',
   '<label>프린터 설정 이름<input id="dxPrinter" type="text" maxlength="30" value="기본 프린터" placeholder="예: 사무실 제록스"></label>',
   '<label>시험 인쇄 용지<select id="dxPaper"><option value="A4">A4</option><option value="A3">A3</option></select></label>',
   '<label>보정 적용 페이지<select id="dxPages"><option value="odd">홀수=앞면, 짝수=뒷면</option><option value="even">짝수=앞면, 홀수=뒷면</option></select></label>',
   '<label>앞면 좌우 이동 (mm)<input id="dxFX" type="number" value="0" min="-15" max="15" step=".1"></label>',
   '<label>앞면 상하 이동 (mm)<input id="dxFY" type="number" value="0" min="-15" max="15" step=".1"></label>',
   '<label>뒷면 좌우 이동 (mm)<input id="dxBX" type="number" value="0" min="-15" max="15" step=".1"></label>',
   '<label>뒷면 상하 이동 (mm)<input id="dxBY" type="number" value="0" min="-15" max="15" step=".1"></label>',
   '</div>',
   '<p class="ps-help">먼저 시험용 양면 정렬표 PDF를 실제 프린터에 양면 출력하세요. 빛에 비춰 앞뒤 십자선이 어긋난 정도를 확인하고 mm 값을 입력합니다. <strong>양수는 오른쪽·위쪽, 음수는 왼쪽·아래쪽</strong>으로 이동합니다. 예: 뒷면이 오른쪽으로 2mm 밀려 있다면 뒷면 좌우 이동에 -2를 입력하세요.</p>',
   '<div class="ps-actions"><button id="dxTest" type="button" class="ps-btn secondary">시험용 양면 정렬표 PDF 만들기</button><button id="dxSave" type="button" class="ps-btn secondary">프린터 보정값 저장</button><button id="dxLoad" type="button" class="ps-btn secondary">보정값 불러오기</button><button id="dxRun" type="button" class="ps-btn">보정된 PDF 저장</button></div>',
   '<p class="ps-status" role="status" aria-live="polite">먼저 시험용 양면 정렬표를 출력하여 차이를 측정하세요.</p>',
   '<div class="ps-preview" id="dxSummary">수정할 PDF를 선택하면 페이지 수를 확인합니다.</div>',
   '<p class="ps-note">이 도구는 페이지 내용을 이동시키고 바깥으로 나간 부분을 잘라냅니다. 글꼴·벡터 본문을 가능한 한 유지하지만 주석·전자서명·양식은 보존되지 않을 수 있습니다. 원본을 보관하고 프린터 드라이버는 실제 크기 100%로 출력하세요. 긴쪽/짧은쪽 넘김 방향은 프린터에서 설정합니다.</p>'
  ].join(''),
  bind(body,ctx){
   const $=id=>body.querySelector('#'+id);
   let inputBytes=null,srcDoc=null;
   const mm=ctx.mm;
   $('dxFile').addEventListener('change',async()=>{
     const file=$('dxFile').files?.[0];inputBytes=null;srcDoc=null;
     if(!file)return;
     try{
       if(file.size>50*1024*1024)throw Error('파일은 50MB 이하로 선택하세요.');
       await ctx.library('pdf');
       inputBytes=await file.arrayBuffer();
       srcDoc=await window.PDFLib.PDFDocument.load(inputBytes,{ignoreEncryption:false});
       const pages=srcDoc.getPages();
       if(pages.length<2||pages.length>200)throw Error('양면 문서는 2~200페이지 PDF만 지원합니다.');
       if(pages.some(p=>p.getRotation().angle%360!==0))throw Error('회전 정보가 있는 PDF입니다. 먼저 PDF편집에서 회전을 적용해 저장하세요.');
       $('dxSummary').textContent=file.name+' · '+pages.length+'페이지 · 1페이지 '+(pages[0].getWidth()*25.4/72).toFixed(1)+' × '+(pages[0].getHeight()*25.4/72).toFixed(1)+'mm';
       ctx.setStatus(body,'보정할 PDF를 불러왔습니다. 앞뒤 보정값을 확인하세요.');
     }catch(e){inputBytes=null;srcDoc=null;ctx.setStatus(body,e.message,true);}
   });
   function values(){
     const n=['dxFX','dxFY','dxBX','dxBY'].map(id=>Number($(id).value));
     if(n.some(x=>!Number.isFinite(x)||Math.abs(x)>15))throw Error('이동값은 -15~15mm 범위로 입력하세요.');
     return n;
   }
   function line(page,x,y,s=4){
     const color=window.PDFLib.rgb(0,0,0);
     page.drawLine({start:{x:x-mm(s),y},end:{x:x+mm(s),y},thickness:.5,color});
     page.drawLine({start:{x,y:y-mm(s)},end:{x,y:y+mm(s)},thickness:.5,color});
     page.drawCircle({x,y,size:mm(.7),borderColor:color,borderWidth:.45});
   }
   $('dxTest').addEventListener('click',async()=>{
     try{
       await ctx.library('pdf');
       const [w,h]=$('dxPaper').value==='A3'?[297,420]:[210,297],pdf=await window.PDFLib.PDFDocument.create(),font=await pdf.embedFont(window.PDFLib.StandardFonts.Helvetica);
       for(let i=0;i<2;i++){
         const p=pdf.addPage([mm(w),mm(h)]),color=window.PDFLib.rgb(0,0,0);
         for(const x of [20,w/2,w-20])for(const y of [20,h/2,h-20])line(p,mm(x),mm(y),4);
         p.drawText(i===0?'FRONT (PAGE 1)':'BACK (PAGE 2)',{x:mm(22),y:mm(h-13),font,size:11,color});
         p.drawText('PRINT ACTUAL SIZE 100% - DO NOT FIT',{x:mm(22),y:mm(10),font,size:9,color});
       }
       ctx.download(await pdf.save(),'양면_위치측정_시험용.pdf');
       ctx.setStatus(body,'2페이지 시험용 PDF를 저장했습니다. 프린터에서 양면·실제 크기 100%로 출력하세요.');
     }catch(e){ctx.setStatus(body,e.message,true);}
   });
   function key(){return 'programStudioDuplex:'+($('dxPrinter').value.trim()||'기본 프린터');}
   $('dxSave').addEventListener('click',()=>{
     try{localStorage.setItem(key(),JSON.stringify(values()));ctx.setStatus(body,'현재 프린터의 이동 보정값만 이 브라우저에 저장했습니다.');}
     catch(e){ctx.setStatus(body,'저장 실패: '+e.message,true);}
   });
   $('dxLoad').addEventListener('click',()=>{
     try{const raw=localStorage.getItem(key());if(!raw)throw Error('해당 프린터의 저장 값이 없습니다.');
       const n=JSON.parse(raw);if(!Array.isArray(n)||n.length!==4||n.some(x=>typeof x!=='number'||Math.abs(x)>15))throw Error('저장된 값이 올바르지 않습니다.');
       ['dxFX','dxFY','dxBX','dxBY'].forEach((id,i)=>$(id).value=String(n[i]));
       ctx.setStatus(body,'프린터 보정값을 불러왔습니다.');
     }catch(e){ctx.setStatus(body,e.message,true);}
   });
   $('dxRun').addEventListener('click',async()=>{
     const button=$('dxRun');button.disabled=true;
     try{
       if(!srcDoc||!inputBytes)throw Error('2페이지 이상의 PDF를 먼저 선택하세요.');
       const [fx,fy,bx,by]=values(),pages=srcDoc.getPages(),out=await window.PDFLib.PDFDocument.create();
       // embedPdf preserves vector page content, unlike raster printing.
       const embedded=await out.embedPdf(inputBytes);
       for(let i=0;i<pages.length;i++){
         const source=pages[i],isFront=$('dxPages').value==='odd'?i%2===0:i%2===1;
         const shiftX=mm(isFront?fx:bx),shiftY=mm(isFront?fy:by);
         const w=source.getWidth(),h=source.getHeight();
         const dest=out.addPage([w,h]);
         dest.drawPage(embedded[i],{x:shiftX,y:shiftY,width:w,height:h});
       }
       ctx.download(await out.save(),'양면_위치보정_'+pages.length+'페이지.pdf');
       ctx.setStatus(body,'양면 보정 PDF '+pages.length+'페이지 저장 완료. 시험 출력 후 위치를 확인하세요.');
     }catch(e){ctx.setStatus(body,'PDF 보정 실패: '+e.message,true);}
     finally{button.disabled=false;}
   });
  }
 });
 let attempt=0;
 function launch(){
   if(document.getElementById('dxLaunch'))return true;
   const panel=document.querySelector('.advanced-sidebar .upload-section');
   if(!panel)return false;
   const button=document.createElement('button');button.id='dxLaunch';button.type='button';button.className='ps-launch';button.textContent='양면 인쇄 위치 맞추기 · 앞/뒤 mm 보정';
   button.addEventListener('click',()=>ui.open('duplex'));panel.appendChild(button);return true;
 }
 if(!launch()){const timer=setInterval(()=>{if(launch()||++attempt>70)clearInterval(timer);},80);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();