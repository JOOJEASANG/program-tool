// Phase 18 · result-first simple design workflow.
// Keeps professional editor features available, but makes the default path: background/logo -> text -> output.
(function(){
  'use strict';
  if(window.__designEditorSimpleResultV1)return;
  window.__designEditorSimpleResultV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const params=new URLSearchParams(location.search);
  const supported=path==='/design-editor/general'||path==='/design-editor/general.html'||path.endsWith('/design-editor/general.html');
  if(!supported||params.get('embed')!=='1')return;

  const CARD_ID='designSimpleResultTools';
  const STYLE_ID='designSimpleResultStyles';
  const ADVANCED_KEY='programTool.designEditor.simpleAdvanced.v1';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const DPI=300;
  const PX_PER_MM=DPI/25.4;
  const MAX_PIXELS=42000000;
  let installed=false;
  let pendingRole='';
  let beforeImageIds=new Set();
  let advanced=false;
  let observer=null;
  let syncTimer=0;
  let outputBusy=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };
  const imageItems=()=>surface()?.extras?.filter(item=>item.type==='image')||[];
  const backgroundItem=()=>imageItems().find(item=>item.simpleRole==='background')||null;

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function persist(reason='simple-result'){
    try{
      const p=project();if(!p)return false;
      localStorage.setItem(DRAFT_KEY,JSON.stringify(p));
      window.DesignEditorDraftScope?.saveCurrent?.(reason);
      const state=byId('saveState');if(state)state.textContent='자동 저장됨';
      return true;
    }catch(_){setStatus('현재 작업을 자동 저장하지 못했습니다.','err');return false;}
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      #${CARD_ID}{border-color:#cfe0ec!important;background:linear-gradient(180deg,#fbfdff,#f7fbfe)!important;box-shadow:0 5px 16px rgba(15,39,72,.045)!important}
      .simple-result-head{display:flex;align-items:flex-start;gap:8px;margin-bottom:9px}.simple-result-head-copy{flex:1;min-width:0}.simple-result-title{font-size:11px;font-weight:950;color:#173b66}.simple-result-sub{margin-top:3px;font-size:7.5px;line-height:1.45;color:#728198}.simple-result-step{margin-top:8px;padding-top:8px;border-top:1px solid #e6edf3}.simple-result-step:first-of-type{margin-top:0;padding-top:0;border-top:0}.simple-result-step-label{margin-bottom:5px;font-size:7px;font-weight:950;color:#7a8798;letter-spacing:.2px}.simple-result-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.simple-result-grid.three{grid-template-columns:repeat(3,minmax(0,1fr))}.simple-result-btn{min-height:34px;border:1px solid #d7e1ea;border-radius:9px;background:#fff;color:#40536b;padding:6px 5px;font-size:8px;font-weight:900;cursor:pointer}.simple-result-btn:hover{border-color:#91b6d6;background:#f2f8ff;color:#17466f}.simple-result-btn.primary{border-color:#1769e0;background:#1769e0;color:#fff}.simple-result-btn.primary:hover{background:#145fc8;color:#fff}.simple-result-btn.soft{border-color:#aadce3;background:#effdff;color:#0e7490}.simple-result-btn.danger{color:#b42318;background:#fff8f7}.simple-result-btn[hidden]{display:none!important}.simple-result-advanced{width:100%;margin-top:9px;border:0;background:transparent;color:#728198;text-align:left;padding:4px 1px;font-size:7.5px;font-weight:850;cursor:pointer}.simple-result-advanced:hover{color:#17466f}.design-simple-basic-hidden{display:none!important}.design-simple-background{z-index:4!important;pointer-events:none!important;outline:none!important;box-shadow:none!important}.design-simple-background img{pointer-events:none!important}.design-simple-role-badge{display:inline-flex;align-items:center;height:20px;border-radius:999px;padding:0 7px;background:#eef6ff;color:#1769e0;font-size:6.8px;font-weight:950}.simple-result-output-note{margin-top:5px;font-size:6.8px;line-height:1.4;color:#8a97a8}
      html[data-design-simple-advanced="0"] .ps-tool-rail-button[data-ps-tool-step="arrange"],html[data-design-simple-advanced="0"] .ps-tool-rail-button[data-ps-tool-step="all"]{display:none!important}
      @media(max-width:620px){.simple-result-grid.three{grid-template-columns:repeat(3,minmax(70px,1fr))}.simple-result-btn{min-height:36px}}
    `;document.head.appendChild(style);
  }

  function currentImageIds(){return new Set(imageItems().map(item=>item.id));}

  function chooseImage(role){
    pendingRole=role;
    beforeImageIds=currentImageIds();
    const button=byId('phase2AddImage');
    if(!button){
      setStatus('이미지 추가 기능을 준비하는 중입니다. 잠시 후 다시 눌러 주세요.','info');
      setTimeout(()=>chooseImage(role),180);
      return false;
    }
    button.click();
    setStatus(role==='background'?'배경으로 사용할 이미지를 선택하세요.':'로고 또는 사진을 선택하세요.','info');
    return true;
  }

  function findNewImage(){
    return imageItems().find(item=>!beforeImageIds.has(item.id))||null;
  }

  function waitForNewImage(attempt=0){
    if(!pendingRole)return;
    const item=findNewImage();
    if(item){
      const role=pendingRole;pendingRole='';beforeImageIds.clear();applyImageRole(role,item.id);return;
    }
    if(attempt>=24){pendingRole='';beforeImageIds.clear();return;}
    setTimeout(()=>waitForNewImage(attempt+1),70+Math.min(attempt,8)*18);
  }

  function applyImageRole(role,id){
    const p=project(),s=surface();if(!p||!s||!Array.isArray(s.extras))return false;
    const item=s.extras.find(entry=>entry.id===id&&entry.type==='image');if(!item)return false;
    if(role==='background'){
      s.extras=s.extras.filter(entry=>entry===item||entry.simpleRole!=='background');
      item.simpleRole='background';item.locked=true;item.fit='cover';item.focusX=50;item.focusY=50;item.opacity=100;
      const bleed=Math.max(0,Number(p.bleed)||0);
      item.x=-bleed;item.y=-bleed;item.w=Number(p.width)+bleed*2;item.h=Number(p.height)+bleed*2;
      item.name=`배경 · ${String(item.name||'이미지').replace(/^배경 · /,'')}`;
      s.extras=[item,...s.extras.filter(entry=>entry!==item)];
      persist('simple-background');window.DesignEditorPhase2?.sync?.();queueSync();
      setStatus('배경 이미지를 재단 여백까지 꽉 채웠습니다.','ok');return true;
    }
    if(role==='logo'){
      item.simpleRole='logo';item.locked=false;item.fit='contain';item.opacity=100;
      const aspect=Math.max(.05,Number(item.aspect)||1);
      const safe=Math.max(0,Number(p.safe)||0);
      let w=Math.min(55,Math.max(24,Number(p.width)*.24));
      let h=w/aspect;
      const maxH=Math.max(14,Number(p.height)*.22);
      if(h>maxH){h=maxH;w=h*aspect;}
      item.w=Math.min(w,Math.max(10,Number(p.width)-safe*2));
      item.h=Math.min(h,Math.max(8,Number(p.height)-safe*2));
      item.x=Math.min(safe,Math.max(0,Number(p.width)-item.w));
      item.y=Math.min(safe,Math.max(0,Number(p.height)-item.h));
      item.name=`로고·사진 · ${String(item.name||'이미지').replace(/^로고·사진 · /,'')}`;
      persist('simple-logo');window.DesignEditorPhase2?.sync?.();queueSync();
      setStatus('로고·사진을 안전여백 안에 배치했습니다. 드래그해서 위치만 맞추면 됩니다.','ok');return true;
    }
    return false;
  }

  function removeBackground(){
    const s=surface();if(!s?.extras)return false;
    const count=s.extras.length;s.extras=s.extras.filter(item=>item.simpleRole!=='background');
    if(s.extras.length===count)return false;
    persist('simple-background-remove');window.DesignEditorPhase2?.sync?.();queueSync();setStatus('배경 이미지를 제거했습니다.','ok');return true;
  }

  function styleRoleNodes(){
    const s=surface();if(!s)return;
    document.querySelectorAll('#artboard .phase2-extra-object[data-extra-id]').forEach(node=>{
      const item=s.extras?.find(entry=>entry.id===node.dataset.extraId);
      const isBackground=item?.simpleRole==='background';
      node.classList.toggle('design-simple-background',isBackground);
      if(isBackground){node.classList.remove('selected','ps-multi-selected');node.setAttribute('aria-label','배경 이미지');}
    });
  }

  function advancedCandidates(){
    const result=new Set();
    const nativeAdd=byId('addTitleBtn')?.closest('.side-card');if(nativeAdd)result.add(nativeAdd);
    const layers=byId('layerList')?.closest('.side-card');if(layers)result.add(layers);
    const ids=[
      'designWorkflowStatusV2','designQuickDesignTools','designPhase2Tools','designPhase4SmartLayout','designAdvancedTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designDiagnosticsTools',
      'designElementClipboardTools','designProjectFileTools','designRotationTools'
    ];
    ids.forEach(id=>{const node=byId(id);if(node)result.add(node);});
    document.querySelectorAll('.sidebar .side-card,.ps-tool-panel>.side-card').forEach(node=>{
      const key=`${node.id||''} ${node.querySelector('.side-label,summary,.inspector-title')?.textContent||''}`;
      if(/Component|Recipe|Template|StyleTheme|SmartLayout|Advanced|정밀|고급 도구|컴포넌트|레시피|템플릿|테마|진단|인쇄 품질|인쇄 안전/i.test(key))result.add(node);
    });
    result.delete(byId(CARD_ID));result.delete(byId('inspector'));result.delete(byId('designOutputTools'));
    return [...result];
  }

  function applyAdvancedVisibility(){
    document.documentElement.dataset.designSimpleAdvanced=advanced?'1':'0';
    advancedCandidates().forEach(node=>node.classList.toggle('design-simple-basic-hidden',!advanced));
    const toggle=byId(CARD_ID)?.querySelector('[data-simple-action="advanced"]');
    if(toggle){toggle.textContent=advanced?'▾ 고급 편집 숨기기':'▸ 고급 편집 보기';toggle.setAttribute('aria-expanded',String(advanced));}
  }

  function setAdvanced(value){
    advanced=Boolean(value);
    try{localStorage.setItem(ADVANCED_KEY,advanced?'1':'0');}catch(_){}
    applyAdvancedVisibility();
    if(!advanced&&window.ProgramStudioEditorToolRail?.activeStep==='arrange')window.ProgramStudioEditorToolRail.select?.('compose');
    return advanced;
  }

  function syncCard(){
    const card=byId(CARD_ID);if(!card)return;
    const bg=backgroundItem();
    const remove=card.querySelector('[data-simple-action="remove-background"]');if(remove)remove.hidden=!bg;
    const badge=card.querySelector('[data-simple-role-badge]');if(badge){badge.hidden=!bg;badge.textContent=bg?'배경 적용됨':'';}
  }

  function ensureCard(){
    if(byId(CARD_ID))return true;
    const inspector=byId('inspector');
    const host=document.querySelector('.ps-tool-panel')||document.querySelector('.sidebar');
    if(!host||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';card.dataset.psToolStep='compose';
    card.innerHTML=`<div class="simple-result-head"><div class="simple-result-head-copy"><div class="simple-result-title">빠른 제작</div><div class="simple-result-sub">배경·로고·글씨만 넣고 바로 결과물을 만듭니다.</div></div><span class="design-simple-role-badge" data-simple-role-badge hidden></span></div>
      <div class="simple-result-step"><div class="simple-result-step-label">1 · 이미지</div><div class="simple-result-grid"><button class="simple-result-btn soft" type="button" data-simple-action="background">배경 이미지</button><button class="simple-result-btn" type="button" data-simple-action="logo">로고·사진</button><button class="simple-result-btn danger" type="button" data-simple-action="remove-background" hidden>배경 제거</button></div></div>
      <div class="simple-result-step"><div class="simple-result-step-label">2 · 글씨</div><div class="simple-result-grid three"><button class="simple-result-btn" type="button" data-simple-action="title">제목</button><button class="simple-result-btn" type="button" data-simple-action="body">본문</button><button class="simple-result-btn" type="button" data-simple-action="info">날짜·장소</button></div></div>
      <div class="simple-result-step"><div class="simple-result-step-label">3 · 결과물</div><div class="simple-result-grid"><button class="simple-result-btn primary" type="button" data-simple-action="png">PNG 만들기</button><button class="simple-result-btn primary" type="button" data-simple-action="pdf">PDF 만들기</button></div><div class="simple-result-output-note">300DPI로 만듭니다. 배경 이미지는 재단 여백까지 포함합니다.</div></div>
      <button class="simple-result-advanced" type="button" data-simple-action="advanced" aria-expanded="false">▸ 고급 편집 보기</button>`;
    if(inspector.parentElement===host)host.insertBefore(card,inspector);else host.appendChild(card);
    card.addEventListener('click',event=>{
      const button=event.target.closest('[data-simple-action]');if(!button)return;
      const action=button.dataset.simpleAction;
      if(action==='background'||action==='logo'){window.ProgramStudioEditorToolRail?.select?.('compose');chooseImage(action);return;}
      if(action==='remove-background'){removeBackground();return;}
      if(action==='title'){byId('addTitleBtn')?.click();window.ProgramStudioEditorToolRail?.select?.('edit');return;}
      if(action==='body'){byId('addBodyBtn')?.click();window.ProgramStudioEditorToolRail?.select?.('edit');return;}
      if(action==='info'){byId('addInfoBtn')?.click();window.ProgramStudioEditorToolRail?.select?.('edit');return;}
      if(action==='png'){exportPng();return;}
      if(action==='pdf'){exportPdf();return;}
      if(action==='advanced')setAdvanced(!advanced);
    });
    return true;
  }

  function safeName(value){return String(value||'design').trim().replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,'_').slice(0,80)||'design';}
  function loadImage(src){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('출력용 이미지를 읽지 못했습니다.'));image.src=src;});}
  function rotation(item){const value=Number(item?.rotation);return Number.isFinite(value)?value:0;}
  function withRotation(ctx,item,x,y,w,h,draw){const angle=rotation(item);if(!angle){draw();return;}const cx=x+w/2,cy=y+h/2;ctx.save();ctx.translate(cx,cy);ctx.rotate(angle*Math.PI/180);ctx.translate(-cx,-cy);try{draw();}finally{ctx.restore();}}
  function fitImage(ctx,image,item,x,y,w,h){
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)return;
    const contain=item.fit==='contain',scale=contain?Math.min(w/iw,h/ih):Math.max(w/iw,h/ih),dw=iw*scale,dh=ih*scale;
    const fx=clamp(Number(item.focusX??50),0,100)/100,fy=clamp(Number(item.focusY??50),0,100)/100;
    const dx=x+(w-dw)*fx,dy=y+(h-dh)*fy;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.globalAlpha=clamp(Number(item.opacity)||100,1,100)/100;ctx.drawImage(image,dx,dy,dw,dh);ctx.restore();
  }
  function wrapLines(ctx,text,maxWidth){
    const lines=[];String(text||'').split(/\n/).forEach(paragraph=>{
      if(!paragraph){lines.push('');return;}
      let line='';
      paragraph.split(/\s+/).forEach(word=>{const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width<=maxWidth){line=test;return;}if(line)lines.push(line);line=word;});
      if(line)lines.push(line);
    });return lines.length?lines:[''];
  }
  function drawText(ctx,item,bleedPx){
    const x=bleedPx+(Number(item.x)||0)*PX_PER_MM,y=bleedPx+(Number(item.y)||0)*PX_PER_MM,w=Math.max(1,(Number(item.w)||40)*PX_PER_MM);
    const sizePx=Math.max(1,(Number(item.size)||11)*DPI/72),lineHeight=sizePx*clamp(Number(item.lineHeight)||1.26,.8,3);
    ctx.save();ctx.fillStyle=item.color||'#172033';ctx.font=`${Number(item.weight)||500} ${sizePx}px ${item.fontFamily||'Pretendard'}, Arial, sans-serif`;ctx.textBaseline='top';
    const lines=wrapLines(ctx,item.text||'',w);lines.forEach((line,index)=>{let tx=x;ctx.textAlign='left';if(item.align==='center'){tx=x+w/2;ctx.textAlign='center';}else if(item.align==='right'){tx=x+w;ctx.textAlign='right';}ctx.fillText(line,tx,y+index*lineHeight,w);});ctx.restore();
  }
  function roundedRect(ctx,x,y,w,h,r){
    const radius=clamp(Number(r)||0,0,Math.min(w,h)/2);ctx.beginPath();
    if(!radius){ctx.rect(x,y,w,h);return;}ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
  }
  async function drawExtra(ctx,item,bleedPx){
    const x=bleedPx+(Number(item.x)||0)*PX_PER_MM,y=bleedPx+(Number(item.y)||0)*PX_PER_MM,w=Math.max(1,(Number(item.w)||1)*PX_PER_MM),h=Math.max(1,(Number(item.h)||1)*PX_PER_MM);
    if(item.type==='image'){const image=await loadImage(item.src);withRotation(ctx,item,x,y,w,h,()=>fitImage(ctx,image,item,x,y,w,h));return;}
    withRotation(ctx,item,x,y,w,h,()=>{ctx.save();ctx.globalAlpha=clamp(Number(item.opacity)||100,1,100)/100;ctx.lineWidth=Math.max(1,(Number(item.strokeWidth)||1)*PX_PER_MM);ctx.strokeStyle=item.stroke||'#12396d';ctx.fillStyle=item.fill||'#dceeff';if(item.shape==='line'){ctx.beginPath();ctx.moveTo(x,y+h/2);ctx.lineTo(x+w,y+h/2);ctx.stroke();}else if(item.shape==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);ctx.fill();ctx.stroke();}else{roundedRect(ctx,x,y,w,h,(Number(item.cornerRadius)||0)*PX_PER_MM);ctx.fill();if(Number(item.strokeWidth)!==0)ctx.stroke();}ctx.restore();});
  }

  async function renderSurface(p,s){
    if(!p||!s)throw new Error('출력할 작업면이 없습니다.');
    const bleed=Math.max(0,Number(p.bleed)||0),totalW=Number(p.width)+bleed*2,totalH=Number(p.height)+bleed*2;
    const width=Math.max(1,Math.round(totalW*PX_PER_MM)),height=Math.max(1,Math.round(totalH*PX_PER_MM));
    if(width*height>MAX_PIXELS)throw new Error('현재 규격은 300DPI 출력 시 너무 큽니다.');
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:false});
    ctx.fillStyle=s.background||'#ffffff';ctx.fillRect(0,0,width,height);const bleedPx=bleed*PX_PER_MM;
    const extras=(s.extras||[]).filter(item=>item.visible!==false);
    for(const item of extras.filter(item=>item.simpleRole==='background'))await drawExtra(ctx,item,bleedPx);
    (s.elements||[]).filter(item=>item.visible!==false&&item.type==='text').forEach(item=>drawText(ctx,item,bleedPx));
    for(const item of extras.filter(item=>item.simpleRole!=='background'))await drawExtra(ctx,item,bleedPx);
    return{canvas,totalW,totalH,width,height};
  }

  function download(dataUrl,name){const link=document.createElement('a');link.href=dataUrl;link.download=name;document.body.appendChild(link);link.click();link.remove();}
  async function outputGate(format){const gate=window.DesignEditorFinalPrintCheck?.confirmBeforeOutput;return gate?Boolean(await gate({format})):true;}
  function setOutputBusy(value){outputBusy=Boolean(value);byId(CARD_ID)?.querySelectorAll('[data-simple-action="png"],[data-simple-action="pdf"]').forEach(button=>button.disabled=outputBusy);}

  async function exportPng(){
    const p=project(),s=surface();if(!p||!s||outputBusy)return false;
    if(!backgroundItem()){window.DesignEditorOutput?.exportPng?.();return true;}
    if(!(await outputGate('png')))return false;
    setOutputBusy(true);setStatus('300DPI PNG를 만드는 중입니다.','info');
    try{const rendered=await renderSurface(p,s);download(rendered.canvas.toDataURL('image/png'),`${safeName(p.name)}_${safeName(s.label)}_300dpi.png`);setStatus(`PNG를 만들었습니다. ${rendered.width}×${rendered.height}px`, 'ok');return true;}catch(error){setStatus(error.message||'PNG를 만들지 못했습니다.','err');return false;}finally{setOutputBusy(false);}
  }
  async function ensurePdfLoader(){
    if(window.CoverJsPdfLoader)return window.CoverJsPdfLoader;
    return new Promise((resolve,reject)=>{let script=byId('designSimpleResultPdfLoader');if(script){script.addEventListener('load',()=>resolve(window.CoverJsPdfLoader),{once:true});return;}script=document.createElement('script');script.id='designSimpleResultPdfLoader';script.src='/js/cover-jspdf-loader.js?v=20260806-1';script.onload=()=>window.CoverJsPdfLoader?resolve(window.CoverJsPdfLoader):reject(new Error('PDF 출력 모듈을 확인하지 못했습니다.'));script.onerror=()=>reject(new Error('PDF 출력 모듈을 불러오지 못했습니다.'));document.head.appendChild(script);});
  }
  async function exportPdf(){
    const p=project();if(!p?.surfaces?.length||outputBusy)return false;
    if(!p.surfaces.some(s=>(s.extras||[]).some(item=>item.simpleRole==='background'))){window.DesignEditorOutput?.exportPdf?.();return true;}
    if(!(await outputGate('pdf')))return false;
    setOutputBusy(true);setStatus('300DPI PDF를 만드는 중입니다.','info');
    try{
      const loader=await ensurePdfLoader(),JsPdf=await loader.ensure();let pdf=null;
      const lossless=byId('designPdfProfile')?.value==='lossless';
      for(let index=0;index<p.surfaces.length;index+=1){const rendered=await renderSurface(p,p.surfaces[index]),orientation=rendered.totalW>=rendered.totalH?'landscape':'portrait';if(!pdf)pdf=new JsPdf({orientation,unit:'mm',format:[rendered.totalW,rendered.totalH],compress:true});else pdf.addPage([rendered.totalW,rendered.totalH],orientation);const data=lossless?rendered.canvas.toDataURL('image/png'):rendered.canvas.toDataURL('image/jpeg',.96);pdf.addImage(data,lossless?'PNG':'JPEG',0,0,rendered.totalW,rendered.totalH,undefined,lossless?undefined:'FAST');}
      pdf.save(`${safeName(p.name)}_${lossless?'300dpi_lossless':'300dpi'}.pdf`);setStatus(`PDF를 만들었습니다. ${p.surfaces.length}개 면`, 'ok');return true;
    }catch(error){setStatus(error.message||'PDF를 만들지 못했습니다.','err');return false;}finally{setOutputBusy(false);}
  }

  function interceptLegacyOutput(event){
    if(!backgroundItem())return;
    const button=event.target?.closest?.('#designPngBtn,#designPdfBtn');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.id==='designPngBtn')exportPng();else exportPdf();
  }

  function sync(){
    clearTimeout(syncTimer);if(!project()||byId('editorShell')?.classList.contains('hidden'))return false;
    ensureCard();styleRoleNodes();applyAdvancedVisibility();syncCard();return true;
  }
  function queueSync(delay=18){clearTimeout(syncTimer);syncTimer=setTimeout(()=>requestAnimationFrame(sync),delay);}

  function bind(){
    document.addEventListener('change',event=>{if(event.target?.id==='phase2ImageInput'&&event.target.files?.length&&pendingRole)setTimeout(()=>waitForNewImage(),40);},true);
    document.addEventListener('click',interceptLegacyOutput,true);
    ['click','input','change','pointerup'].forEach(name=>document.addEventListener(name,()=>queueSync(20),false));
    const root=document.querySelector('.sidebar');
    if(root&&typeof MutationObserver==='function'){observer=new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length||record.removedNodes.length))queueSync(24);});observer.observe(root,{childList:true,subtree:true});}
  }

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!byId('inspector')||!document.querySelector('.sidebar')||!window.DesignEditorApp)return false;
    installed=true;try{advanced=localStorage.getItem(ADVANCED_KEY)==='1';}catch(_){advanced=false;}
    installStyles();ensureCard();bind();sync();document.documentElement.dataset.designSimpleResult='1';
    window.DesignEditorSimpleResultWorkflow={sync,applyImageRole,removeBackground,setAdvanced,exportPng,exportPdf,renderSurface,get advanced(){return advanced;},stage:'simple-result-background-logo-text-output-v1'};
    [140,340,720,1300,2300,3600].forEach(delay=>setTimeout(()=>queueSync(0),delay));return true;
  }
  function boot(){if(install())return;[120,300,650,1200,2200,3400].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();