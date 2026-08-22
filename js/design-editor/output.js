(function(){
  'use strict';
  if(window.__designEditorOutputV1)return;
  window.__designEditorOutputV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor/general'&&path!=='/design-editor/general.html'&&!path.endsWith('/design-editor/general.html'))return;

  const DPI=300;
  const PX_PER_MM=DPI/25.4;
  const MAX_PIXELS=42000000;
  const CARD_ID='designOutputTools';
  const LOADER_ID='designOutputJsPdfLoader';
  const PDF_PROFILES=Object.freeze({
    standard:{id:'standard',label:'표준 PDF · 용량 최적화',format:'JPEG',extension:'300dpi'},
    lossless:{id:'lossless',label:'고품질 PDF · 무손실 PNG',format:'PNG',extension:'300dpi_lossless'}
  });
  let installed=false;
  let busy=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const activeSurface=p=>p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function installStyles(){
    if(byId('designOutputStyles'))return;
    const style=document.createElement('style');style.id='designOutputStyles';style.textContent=`
      .design-output-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.design-output-grid button{border:0;border-radius:8px;padding:9px 7px;font-size:9px;font-weight:950;cursor:pointer}.design-output-grid .png{background:#ecfeff;color:#0e7490;border:1px solid #a5e5ef}.design-output-grid .pdf{background:#12396d;color:#fff}.design-output-grid button:disabled{opacity:.5;cursor:not-allowed}.design-output-profile{margin:0 0 7px}.design-output-profile label{display:block;font-size:8px;font-weight:900;color:#64748b;margin-bottom:4px}.design-output-profile select{width:100%;border:1px solid #cfd8e3;border-radius:8px;padding:7px 8px;background:#fff;color:#172033;font-size:9px;outline:none}.design-output-note{font-size:8px;color:#64748b;line-height:1.5;margin-top:7px}.design-output-tech{margin-top:5px;border-radius:7px;background:#f8fafc;padding:6px 7px;font-size:7px;line-height:1.45;color:#667085}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">인쇄 파일 만들기</div><div class="design-output-profile"><label for="designPdfProfile">PDF 품질</label><select id="designPdfProfile"><option value="standard">표준 PDF · 용량 최적화</option><option value="lossless">고품질 PDF · 무손실 PNG</option></select></div><div class="design-output-grid"><button id="designPngBtn" class="png" type="button">300DPI PNG</button><button id="designPdfBtn" class="pdf" type="button">300DPI PDF</button></div><div class="design-output-note">가이드선은 제외하고 재단 여백까지 포함해 출력합니다. PDF는 앞·뒷면/리플렛 양면을 한 파일에 넣습니다.</div><div class="design-output-tech">현재 출력 색상은 RGB입니다. 고품질 PDF는 JPEG 재압축 없이 300DPI PNG 페이지를 넣어 글자·선·도형의 래스터 압축 손실을 줄이는 대신 파일이 커질 수 있습니다.</div>`;
    sidebar.insertBefore(card,inspector);byId('designPngBtn')?.addEventListener('click',exportPng);byId('designPdfBtn')?.addEventListener('click',exportPdf);return true;
  }

  function selectedPdfProfile(){
    const value=String(byId('designPdfProfile')?.value||'standard');
    return PDF_PROFILES[value]||PDF_PROFILES.standard;
  }

  function setBusy(value){
    busy=Boolean(value);['designPngBtn','designPdfBtn','designPdfProfile'].forEach(id=>{const node=byId(id);if(node)node.disabled=busy;});
  }

  function safeName(value){return String(value||'design').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,80)||'design';}

  function expectedOutputSpec(p){
    const bleed=Math.max(0,Number(p?.bleed)||0);
    const widthMm=(Number(p?.width)||0)+bleed*2;
    const heightMm=(Number(p?.height)||0)+bleed*2;
    return{
      dpi:DPI,
      widthMm,
      heightMm,
      widthPx:Math.max(1,Math.round(widthMm*PX_PER_MM)),
      heightPx:Math.max(1,Math.round(heightMm*PX_PER_MM)),
      surfaceCount:Array.isArray(p?.surfaces)?p.surfaces.length:0
    };
  }

  function verificationFailure(message){
    const error=new Error(message);
    error.code='OUTPUT_VERIFICATION_FAILED';
    return error;
  }

  function verifyRenderedSurface(rendered,spec){
    if(!spec||spec.widthMm<=0||spec.heightMm<=0)throw verificationFailure('출력 문서 규격을 확인할 수 없습니다.');
    if(!rendered?.canvas)throw verificationFailure('출력 렌더 캔버스를 확인할 수 없습니다.');
    if(rendered.canvas.width!==spec.widthPx||rendered.canvas.height!==spec.heightPx){
      throw verificationFailure(`300DPI 출력 픽셀 규격이 예상값과 다릅니다. 예상 ${spec.widthPx}×${spec.heightPx}px, 실제 ${rendered.canvas.width}×${rendered.canvas.height}px입니다.`);
    }
    const actualW=Number(rendered.totalW),actualH=Number(rendered.totalH);
    if(!Number.isFinite(actualW)||!Number.isFinite(actualH)||Math.abs(actualW-spec.widthMm)>.001||Math.abs(actualH-spec.heightMm)>.001){
      throw verificationFailure('출력 문서의 mm 규격이 예상값과 다릅니다.');
    }
    return true;
  }

  function verifyPdfDocument(pdf,spec,renderedCount){
    if(!spec||spec.surfaceCount<1)throw verificationFailure('PDF에 포함할 작업면을 확인할 수 없습니다.');
    if(renderedCount!==spec.surfaceCount)throw verificationFailure(`PDF 렌더 면 수가 예상값과 다릅니다. 예상 ${spec.surfaceCount}개, 실제 ${renderedCount}개입니다.`);
    const pageCount=typeof pdf?.getNumberOfPages==='function'?Number(pdf.getNumberOfPages()):renderedCount;
    if(!Number.isFinite(pageCount)||pageCount!==spec.surfaceCount)throw verificationFailure(`PDF 페이지 수가 예상값과 다릅니다. 예상 ${spec.surfaceCount}개, 실제 ${pageCount}개입니다.`);
    return pageCount;
  }

  function recordVerificationFailure(error,format,spec){
    if(error?.code!=='OUTPUT_VERIFICATION_FAILED')return;
    window.DesignEditorRuntimeDiagnostics?.record?.('output-verification-error',error.message||'출력 결과 검증 실패',{
      format,
      expectedWidthPx:Number(spec?.widthPx)||0,
      expectedHeightPx:Number(spec?.heightPx)||0,
      surfaces:Number(spec?.surfaceCount)||0
    });
  }

  function loadImage(src){
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('출력용 이미지를 읽지 못했습니다.'));image.src=src;});
  }

  function rotationDegrees(item){
    const value=Number(item?.rotation);
    if(!Number.isFinite(value))return 0;
    return ((value+180)%360+360)%360-180;
  }

  function withRotation(ctx,item,x,y,w,h,draw){
    const angle=rotationDegrees(item);
    if(!angle){draw();return;}
    const cx=x+w/2,cy=y+h/2;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(angle*Math.PI/180);ctx.translate(-cx,-cy);
    try{draw();}finally{ctx.restore();}
  }

  function roundedRectPath(ctx,x,y,w,h,radius){
    const r=clamp(Number(radius)||0,0,Math.min(w,h)/2);
    ctx.beginPath();
    if(!r){ctx.rect(x,y,w,h);return;}
    ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
  }

  function fitImage(ctx,image,item,x,y,w,h){
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)return;
    const contain=item.fit==='contain';const scale=contain?Math.min(w/iw,h/ih):Math.max(w/iw,h/ih);const dw=iw*scale,dh=ih*scale;
    const fx=clamp(Number(item.focusX??50),0,100)/100,fy=clamp(Number(item.focusY??50),0,100)/100;
    const dx=x+(w-dw)*fx,dy=y+(h-dh)*fy;
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=clamp(Number(item.opacity)||100,1,100)/100;ctx.drawImage(image,dx,dy,dw,dh);ctx.restore();
  }

  function wrapLines(ctx,text,maxWidth){
    const paragraphs=String(text||'').split(/\n/),lines=[];
    paragraphs.forEach((paragraph,pIndex)=>{
      if(!paragraph){lines.push('');return;}
      const words=paragraph.split(/\s+/);let line='';
      words.forEach(word=>{
        const test=line?`${line} ${word}`:word;
        if(ctx.measureText(test).width<=maxWidth){line=test;return;}
        if(line)lines.push(line);
        if(ctx.measureText(word).width<=maxWidth){line=word;return;}
        let chunk='';
        [...word].forEach(char=>{const trial=chunk+char;if(chunk&&ctx.measureText(trial).width>maxWidth){lines.push(chunk);chunk=char;}else chunk=trial;});
        line=chunk;
      });
      if(line)lines.push(line);
      if(pIndex<paragraphs.length-1&&paragraph==='')lines.push('');
    });
    return lines.length?lines:[''];
  }

  function drawIcon(ctx,name,x,y,size,color){
    if(!name||name==='none')return 0;
    const s=size,midY=y+s*.55;ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(1,s*.07);ctx.lineCap='round';ctx.lineJoin='round';
    if(name==='calendar'){ctx.strokeRect(x+s*.08,y+s*.16,s*.82,s*.72);ctx.beginPath();ctx.moveTo(x+s*.08,y+s*.38);ctx.lineTo(x+s*.9,y+s*.38);ctx.moveTo(x+s*.28,y+s*.05);ctx.lineTo(x+s*.28,y+s*.25);ctx.moveTo(x+s*.7,y+s*.05);ctx.lineTo(x+s*.7,y+s*.25);ctx.stroke();}
    else if(name==='clock'){ctx.beginPath();ctx.arc(x+s*.5,midY,s*.4,0,Math.PI*2);ctx.moveTo(x+s*.5,midY);ctx.lineTo(x+s*.5,y+s*.32);ctx.moveTo(x+s*.5,midY);ctx.lineTo(x+s*.7,y+s*.66);ctx.stroke();}
    else if(name==='pin'){ctx.beginPath();ctx.arc(x+s*.5,y+s*.42,s*.3,Math.PI*.15,Math.PI*.85,true);ctx.quadraticCurveTo(x+s*.5,y+s*.98,x+s*.25,y+s*.55);ctx.stroke();ctx.beginPath();ctx.arc(x+s*.5,y+s*.4,s*.08,0,Math.PI*2);ctx.stroke();}
    else if(name==='check'){ctx.beginPath();ctx.arc(x+s*.5,midY,s*.4,0,Math.PI*2);ctx.moveTo(x+s*.3,midY);ctx.lineTo(x+s*.46,y+s*.68);ctx.lineTo(x+s*.73,y+s*.38);ctx.stroke();}
    else if(name==='people'){ctx.beginPath();ctx.arc(x+s*.36,y+s*.34,s*.15,0,Math.PI*2);ctx.arc(x+s*.7,y+s*.4,s*.11,0,Math.PI*2);ctx.moveTo(x+s*.08,y+s*.88);ctx.quadraticCurveTo(x+s*.36,y+s*.58,x+s*.64,y+s*.88);ctx.moveTo(x+s*.56,y+s*.72);ctx.quadraticCurveTo(x+s*.78,y+s*.62,x+s*.9,y+s*.86);ctx.stroke();}
    else if(name==='phone'){ctx.beginPath();ctx.moveTo(x+s*.25,y+s*.17);ctx.lineTo(x+s*.42,y+s*.36);ctx.lineTo(x+s*.33,y+s*.47);ctx.quadraticCurveTo(x+s*.5,y+s*.7,x+s*.68,y+s*.75);ctx.lineTo(x+s*.78,y+s*.65);ctx.lineTo(x+s*.94,y+s*.82);ctx.quadraticCurveTo(x+s*.78,y+s*.99,x+s*.48,y+s*.79);ctx.quadraticCurveTo(x+s*.15,y+s*.55,x+s*.25,y+s*.17);ctx.stroke();}
    ctx.restore();return s*1.18;
  }

  function drawTitleDecoration(ctx,item,x,y,w,sizePx,blockHeight){
    const style=String(item.titleStyle||'none'),accent=item.titleAccent||'#1d9bb2';
    if(style==='none')return 0;
    ctx.save();ctx.fillStyle=accent;ctx.strokeStyle=accent;ctx.lineCap='round';ctx.lineJoin='round';
    let inset=0;
    if(style==='bar'){
      const barW=Math.max(2,sizePx*.13),barH=Math.max(sizePx,blockHeight*.9);roundedRectPath(ctx,x,y+Math.max(0,(blockHeight-barH)/2),barW,barH,barW/2);ctx.fill();inset=barW+sizePx*.22;
    }else if(style==='line'){
      const lineW=sizePx*.82,lineH=Math.max(2,sizePx*.08);roundedRectPath(ctx,x,y+sizePx*.55,lineW,lineH,lineH/2);ctx.fill();inset=lineW+sizePx*.18;
    }else if(style==='dot'){
      const r=sizePx*.13;ctx.beginPath();ctx.arc(x+r,y+sizePx*.57,r,0,Math.PI*2);ctx.fill();inset=r*2+sizePx*.18;
    }else if(style==='pill'){
      ctx.globalAlpha=.10;roundedRectPath(ctx,x-sizePx*.12,y-sizePx*.12,w+sizePx*.24,blockHeight+sizePx*.24,sizePx*.45);ctx.fill();ctx.globalAlpha=.42;ctx.lineWidth=Math.max(1,sizePx*.035);ctx.stroke();
    }else if(style==='highlight'){
      ctx.globalAlpha=.22;roundedRectPath(ctx,x-sizePx*.03,y+sizePx*.58,w+sizePx*.06,Math.max(sizePx*.42,blockHeight-sizePx*.58),sizePx*.08);ctx.fill();
    }else if(style==='underline'){
      ctx.globalAlpha=.95;ctx.lineWidth=Math.max(2,sizePx*.08);ctx.beginPath();ctx.moveTo(x,y+blockHeight+sizePx*.12);ctx.lineTo(x+w,y+blockHeight+sizePx*.12);ctx.stroke();
    }
    ctx.restore();return inset;
  }

  function drawText(ctx,item,bleedPx){
    const x=bleedPx+Number(item.x||0)*PX_PER_MM,y=bleedPx+Number(item.y||0)*PX_PER_MM,w=Math.max(1,Number(item.w||40)*PX_PER_MM);
    const sizePx=Math.max(1,Number(item.size||11)*DPI/72),lineHeight=sizePx*clamp(Number(item.lineHeight)||1.26,.8,3),color=item.color||'#172033';
    ctx.save();ctx.fillStyle=color;ctx.font=`${Number(item.weight)||500} ${sizePx}px ${item.fontFamily||'Pretendard'}, Arial, sans-serif`;ctx.textBaseline='top';ctx.textAlign='left';
    if('letterSpacing'in ctx)ctx.letterSpacing=`${(Number(item.letterSpacing)||0)*PX_PER_MM}px`;
    const rawIconWidth=item.icon&&item.icon!=='none'?sizePx*1.18:0;const preliminaryTextW=Math.max(1,w-rawIconWidth);const lines=wrapLines(ctx,item.text||'',preliminaryTextW);const blockHeight=Math.max(sizePx,lines.length*lineHeight);
    const angle=rotationDegrees(item);
    if(angle){const cx=x+w/2,cy=y+blockHeight/2;ctx.translate(cx,cy);ctx.rotate(angle*Math.PI/180);ctx.translate(-cx,-cy);}
    const titleInset=drawTitleDecoration(ctx,item,x,y,w,sizePx,blockHeight);const iconX=x+titleInset;const iconWidth=drawIcon(ctx,item.icon,iconX,y,sizePx,color);const textX=iconX+iconWidth;const textW=Math.max(1,w-titleInset-iconWidth);const finalLines=wrapLines(ctx,item.text||'',textW);
    ctx.fillStyle=color;
    finalLines.forEach((line,index)=>{let tx=textX;if(item.align==='center')tx=textX+textW/2;else if(item.align==='right')tx=textX+textW;ctx.textAlign=item.align==='center'?'center':item.align==='right'?'right':'left';ctx.fillText(line,tx,y+index*lineHeight,textW);});ctx.restore();
  }

  async function renderSurface(p,surface){
    const totalW=Number(p.width)+Number(p.bleed||0)*2,totalH=Number(p.height)+Number(p.bleed||0)*2,width=Math.round(totalW*PX_PER_MM),height=Math.round(totalH*PX_PER_MM);
    if(width*height>MAX_PIXELS)throw new Error('현재 규격은 300DPI 출력 시 너무 큽니다. 규격을 줄여 주세요.');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle=surface.background||'#ffffff';ctx.fillRect(0,0,width,height);const bleedPx=Number(p.bleed||0)*PX_PER_MM;
    (surface.elements||[]).filter(item=>item.visible!==false&&item.type==='text').forEach(item=>drawText(ctx,item,bleedPx));
    for(const item of surface.extras||[]){
      if(item.visible===false)continue;
      const x=bleedPx+Number(item.x||0)*PX_PER_MM,y=bleedPx+Number(item.y||0)*PX_PER_MM,w=Math.max(1,Number(item.w||1)*PX_PER_MM),h=Math.max(1,Number(item.h||1)*PX_PER_MM);
      if(item.type==='image'){
        const image=await loadImage(item.src);withRotation(ctx,item,x,y,w,h,()=>fitImage(ctx,image,item,x,y,w,h));continue;
      }
      withRotation(ctx,item,x,y,w,h,()=>{
        ctx.save();ctx.globalAlpha=clamp(Number(item.opacity)||100,1,100)/100;ctx.lineWidth=Math.max(1,(Number(item.strokeWidth)||1)*PX_PER_MM);ctx.strokeStyle=item.stroke||'#12396d';ctx.fillStyle=item.fill||'#dceeff';
        if(item.shape==='line'){ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();}
        else if(item.shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
        else{
          const radius=clamp(Number(item.cornerRadius)||0,0,Math.min(Number(item.w)||0,Number(item.h)||0)/2)*PX_PER_MM;
          roundedRectPath(ctx,x,y,w,h,radius);
          if(item.shapeShadow){ctx.shadowColor='rgba(15,23,42,.20)';ctx.shadowBlur=1.8*PX_PER_MM;ctx.shadowOffsetY=.9*PX_PER_MM;}
          ctx.fill();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.stroke();
        }
        ctx.restore();
      });
    }
    return {canvas,totalW,totalH};
  }

  function downloadDataUrl(dataUrl,name){const link=document.createElement('a');link.href=dataUrl;link.download=name;document.body.appendChild(link);link.click();link.remove();}

  async function exportPng(){
    const p=project(),surface=activeSurface(p);if(!p||!surface||busy)return;
    const gate=window.DesignEditorFinalPrintCheck?.confirmBeforeOutput;
    if(gate&&!(await gate({format:'png'})))return;
    const spec=expectedOutputSpec(p);
    setBusy(true);setStatus('300DPI PNG를 만드는 중입니다.','info');
    try{
      const rendered=await renderSurface(p,surface);
      verifyRenderedSurface(rendered,spec);
      downloadDataUrl(rendered.canvas.toDataURL('image/png'),`${safeName(p.name)}_${safeName(surface.label)}_300dpi.png`);
      setStatus(`300DPI PNG를 검증 후 만들었습니다. ${spec.widthPx}×${spec.heightPx}px입니다.`,'ok');
    }catch(error){
      recordVerificationFailure(error,'png',spec);
      setStatus(error?.code==='OUTPUT_VERIFICATION_FAILED'?`PNG 출력 검증 실패로 저장을 중단했습니다. ${error.message}`:(error.message||'PNG 출력에 실패했습니다.'),'err');
    }finally{setBusy(false);}
  }

  function ensurePdfLoader(){
    if(window.CoverJsPdfLoader)return Promise.resolve(window.CoverJsPdfLoader);
    return new Promise((resolve,reject)=>{
      let script=byId(LOADER_ID);if(script){script.addEventListener('load',()=>resolve(window.CoverJsPdfLoader),{once:true});script.addEventListener('error',()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.')),{once:true});return;}
      script=document.createElement('script');script.id=LOADER_ID;script.src='/js/cover-jspdf-loader.js?v=20260806-1';script.onload=()=>window.CoverJsPdfLoader?resolve(window.CoverJsPdfLoader):reject(new Error('PDF 출력 모듈을 확인하지 못했습니다.'));script.onerror=()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.'));document.head.appendChild(script);
    });
  }

  function pdfImagePayload(canvas,profile){
    if(profile.id==='lossless')return{data:canvas.toDataURL('image/png'),format:'PNG',compression:undefined};
    return{data:canvas.toDataURL('image/jpeg',.96),format:'JPEG',compression:'FAST'};
  }

  async function exportPdf(){
    const p=project();if(!p||!p.surfaces?.length||busy)return;
    const gate=window.DesignEditorFinalPrintCheck?.confirmBeforeOutput;
    if(gate&&!(await gate({format:'pdf'})))return;
    const profile=selectedPdfProfile(),spec=expectedOutputSpec(p);
    setBusy(true);setStatus(`${profile.label}를 만드는 중입니다.`,'info');
    try{
      const loader=await ensurePdfLoader(),JsPdf=await loader.ensure();let pdf=null,renderedCount=0;
      for(let index=0;index<p.surfaces.length;index+=1){
        const surface=p.surfaces[index],rendered=await renderSurface(p,surface),orientation=rendered.totalW>=rendered.totalH?'landscape':'portrait';
        verifyRenderedSurface(rendered,spec);
        if(!pdf)pdf=new JsPdf({orientation,unit:'mm',format:[rendered.totalW,rendered.totalH],compress:true});
        else pdf.addPage([rendered.totalW,rendered.totalH],orientation);
        const image=pdfImagePayload(rendered.canvas,profile);
        pdf.addImage(image.data,image.format,0,0,rendered.totalW,rendered.totalH,undefined,image.compression);
        renderedCount+=1;
      }
      const pageCount=verifyPdfDocument(pdf,spec,renderedCount);
      pdf.save(`${safeName(p.name)}_${profile.extension}.pdf`);
      setStatus(`${profile.label}를 검증 후 만들었습니다. ${pageCount}개 면 · ${spec.widthPx}×${spec.heightPx}px입니다.`,'ok');
    }catch(error){
      recordVerificationFailure(error,'pdf',spec);
      setStatus(error?.code==='OUTPUT_VERIFICATION_FAILED'?`PDF 출력 검증 실패로 저장을 중단했습니다. ${error.message}`:(error.message||'PDF 출력에 실패했습니다.'),'err');
    }finally{setBusy(false);}
  }

  function install(){
    if(installed)return true;if(!document.querySelector('.sidebar')||!byId('inspector'))return false;
    installed=true;installStyles();installCard();window.DesignEditorOutput={renderSurface,exportPng,exportPdf,pdfImagePayload,selectedPdfProfile,expectedOutputSpec,verifyRenderedSurface,verifyPdfDocument,pdfProfiles:PDF_PROFILES,dpi:DPI,colorSpace:'RGB',stage:'selectable-standard-lossless-300dpi-pdf-output-with-postrender-verification'};return true;
  }
  function boot(){if(install())return;[250,600,1100,2000,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();