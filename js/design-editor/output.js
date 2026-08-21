(function(){
  'use strict';
  if(window.__designEditorOutputV1)return;
  window.__designEditorOutputV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor'&&path!=='/design-editor/index.html'&&!path.endsWith('/design-editor/index.html'))return;

  const DPI=300;
  const PX_PER_MM=DPI/25.4;
  const MAX_PIXELS=42000000;
  const CARD_ID='designOutputTools';
  const LOADER_ID='designOutputJsPdfLoader';
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
      .design-output-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}.design-output-grid button{border:0;border-radius:8px;padding:9px 7px;font-size:9px;font-weight:950;cursor:pointer}.design-output-grid .png{background:#ecfeff;color:#0e7490;border:1px solid #a5e5ef}.design-output-grid .pdf{background:#12396d;color:#fff}.design-output-grid button:disabled{opacity:.5;cursor:not-allowed}.design-output-note{font-size:8px;color:#64748b;line-height:1.5;margin-top:7px}
    `;document.head.appendChild(style);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    card.innerHTML=`<div class="side-label">인쇄 파일 만들기</div><div class="design-output-grid"><button id="designPngBtn" class="png" type="button">300DPI PNG</button><button id="designPdfBtn" class="pdf" type="button">300DPI PDF</button></div><div class="design-output-note">가이드선은 제외하고 재단 여백까지 포함해 출력합니다. PDF는 앞·뒷면/리플렛 양면을 한 파일에 넣습니다.</div>`;
    sidebar.insertBefore(card,inspector);byId('designPngBtn')?.addEventListener('click',exportPng);byId('designPdfBtn')?.addEventListener('click',exportPdf);return true;
  }

  function setBusy(value){
    busy=Boolean(value);['designPngBtn','designPdfBtn'].forEach(id=>{const node=byId(id);if(node)node.disabled=busy;});
  }

  function safeName(value){return String(value||'design').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,80)||'design';}

  function loadImage(src){
    return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('출력용 이미지를 읽지 못했습니다.'));image.src=src;});
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

  function drawText(ctx,item,bleedPx){
    const x=bleedPx+Number(item.x||0)*PX_PER_MM,y=bleedPx+Number(item.y||0)*PX_PER_MM,w=Math.max(1,Number(item.w||40)*PX_PER_MM);
    const sizePx=Math.max(1,Number(item.size||11)*DPI/72),lineHeight=sizePx*clamp(Number(item.lineHeight)||1.26,.8,3),color=item.color||'#172033';
    ctx.save();ctx.fillStyle=color;ctx.font=`${Number(item.weight)||500} ${sizePx}px ${item.fontFamily||'Pretendard'}, Arial, sans-serif`;ctx.textBaseline='top';ctx.textAlign='left';
    if('letterSpacing'in ctx)ctx.letterSpacing=`${(Number(item.letterSpacing)||0)*PX_PER_MM}px`;
    const iconWidth=drawIcon(ctx,item.icon,x,y,sizePx,color);const textX=x+iconWidth;const textW=Math.max(1,w-iconWidth);const lines=wrapLines(ctx,item.text||'',textW);
    lines.forEach((line,index)=>{let tx=textX;if(item.align==='center')tx=textX+textW/2;else if(item.align==='right')tx=textX+textW;ctx.textAlign=item.align==='center'?'center':item.align==='right'?'right':'left';ctx.fillText(line,tx,y+index*lineHeight,textW);});ctx.restore();
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
      if(item.type==='image'){const image=await loadImage(item.src);fitImage(ctx,image,item,x,y,w,h);continue;}
      ctx.save();ctx.globalAlpha=clamp(Number(item.opacity)||100,1,100)/100;ctx.lineWidth=Math.max(1,(Number(item.strokeWidth)||1)*PX_PER_MM);ctx.strokeStyle=item.stroke||'#12396d';ctx.fillStyle=item.fill||'#dceeff';
      if(item.shape==='line'){ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();}
      else if(item.shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}
      else{ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);}ctx.restore();
    }
    return {canvas,totalW,totalH};
  }

  function downloadDataUrl(dataUrl,name){const link=document.createElement('a');link.href=dataUrl;link.download=name;document.body.appendChild(link);link.click();link.remove();}

  async function exportPng(){
    const p=project(),surface=activeSurface(p);if(!p||!surface||busy)return;
    setBusy(true);setStatus('300DPI PNG를 만드는 중입니다.','info');
    try{const {canvas}=await renderSurface(p,surface);downloadDataUrl(canvas.toDataURL('image/png'),`${safeName(p.name)}_${safeName(surface.label)}_300dpi.png`);setStatus('300DPI PNG를 만들었습니다.','ok');}
    catch(error){setStatus(error.message||'PNG 출력에 실패했습니다.','err');}
    finally{setBusy(false);}
  }

  function ensurePdfLoader(){
    if(window.CoverJsPdfLoader)return Promise.resolve(window.CoverJsPdfLoader);
    return new Promise((resolve,reject)=>{
      let script=byId(LOADER_ID);if(script){script.addEventListener('load',()=>resolve(window.CoverJsPdfLoader),{once:true});script.addEventListener('error',()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.')),{once:true});return;}
      script=document.createElement('script');script.id=LOADER_ID;script.src='/js/cover-jspdf-loader.js?v=20260806-1';script.onload=()=>window.CoverJsPdfLoader?resolve(window.CoverJsPdfLoader):reject(new Error('PDF 출력 모듈을 확인하지 못했습니다.'));script.onerror=()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.'));document.head.appendChild(script);
    });
  }

  async function exportPdf(){
    const p=project();if(!p||!p.surfaces?.length||busy)return;
    setBusy(true);setStatus('300DPI PDF를 만드는 중입니다.','info');
    try{
      const loader=await ensurePdfLoader(),JsPdf=await loader.ensure();let pdf=null;
      for(let index=0;index<p.surfaces.length;index+=1){
        const surface=p.surfaces[index],rendered=await renderSurface(p,surface),orientation=rendered.totalW>=rendered.totalH?'landscape':'portrait';
        if(!pdf)pdf=new JsPdf({orientation,unit:'mm',format:[rendered.totalW,rendered.totalH],compress:true});
        else pdf.addPage([rendered.totalW,rendered.totalH],orientation);
        pdf.addImage(rendered.canvas.toDataURL('image/jpeg',.96),'JPEG',0,0,rendered.totalW,rendered.totalH,undefined,'FAST');
      }
      pdf.save(`${safeName(p.name)}_300dpi.pdf`);setStatus(`300DPI PDF를 만들었습니다. ${p.surfaces.length}개 면이 포함됐습니다.`,'ok');
    }catch(error){setStatus(error.message||'PDF 출력에 실패했습니다.','err');}
    finally{setBusy(false);}
  }

  function install(){
    if(installed)return true;if(!document.querySelector('.sidebar')||!byId('inspector'))return false;
    installed=true;installStyles();installCard();window.DesignEditorOutput={renderSurface,exportPng,exportPdf,dpi:DPI,stage:'300dpi-print-output'};return true;
  }
  function boot(){if(install())return;[250,600,1100,2000,3200].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
