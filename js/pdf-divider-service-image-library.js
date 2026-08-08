// Size-aware administrator image library for PDF divider pages.
(function () {
  'use strict';
  if (window.__pdfDividerServiceImageLibraryV1) return;
  window.__pdfDividerServiceImageLibraryV1 = true;
  const pathname = location.pathname.replace(/\/+$/, '') || '/';
  if (!['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some((p) => pathname === p || pathname.endsWith(p))) return;

  const KIND = 'service-image-v2';
  const STYLE_ID = 'pdfDividerServiceImageStyles';
  const PANEL_ID = 'pdfDividerServiceImagePanel';
  const imageCache = new Map();
  let installed = false;
  let images = [];
  let selectedId = '';
  let originalGetDividerContent = null;
  let originalRenderDividerCanvas = null;
  let originalOpenDividerInsert = null;
  let originalEditDivider = null;
  let originalMakeDividerPageObj = null;
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v == null ? '' : v);

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style'); el.id = STYLE_ID;
    el.textContent = `
      .pdf-div-svc{border-top:1px solid #e5e7eb;margin-top:10px;padding-top:9px}.pdf-div-svc-head{display:flex;align-items:center;gap:6px;margin-bottom:6px}.pdf-div-svc-head strong{font-size:11px}.pdf-div-svc-head button{margin-left:auto}.pdf-div-svc-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;max-height:210px;overflow:auto}.pdf-div-svc-item{border:1px solid #dbe4ec;border-radius:8px;background:#f8fafc;padding:5px;cursor:pointer;text-align:left}.pdf-div-svc-item.on{border-color:#7c3aed;background:#f5f3ff;box-shadow:0 0 0 2px #7c3aed14}.pdf-div-svc-thumb{aspect-ratio:4/3;border:1px solid #e5e7eb;background:#fff;border-radius:6px;overflow:hidden}.pdf-div-svc-thumb img{width:100%;height:100%;object-fit:cover}.pdf-div-svc-name{font-size:8px;font-weight:900;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pdf-div-svc-meta{font-size:7px;color:#64748b;margin-top:2px}.pdf-div-svc-empty{grid-column:1/-1;border:1px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;color:#94a3b8;font-size:9px}.pdf-div-svc-status{font-size:8px;color:#64748b;line-height:1.4;margin-top:5px}.pdf-div-svc-actions{display:flex;gap:5px;margin-top:6px}
      @media(max-width:720px){.pdf-div-svc-list{grid-template-columns:repeat(2,minmax(0,1fr))}}`;
    document.head.appendChild(el);
  }
  function itemTargets(item) { return Array.isArray(item.targets) ? item.targets : []; }
  function currentPaper() { try { const s = getSettings(); return { w:Number(s.pw), h:Number(s.ph) }; } catch (_) { return {w:210,h:297}; } }
  function sizeMatches(item) { const p=currentPaper(),w=Number(item.widthMm||0),h=Number(item.heightMm||0); if(!(w>0&&h>0))return true; return (Math.abs(w-p.w)<=3&&Math.abs(h-p.h)<=3)||(Math.abs(h-p.w)<=3&&Math.abs(w-p.h)<=3); }
  function sizeLabel(item) { return ({a5:'A5',b5iso:'B5 ISO',b5jis:'B5 JIS',a4:'A4',a3:'A3',b4:'B4',custom:'직접 규격'})[item.sizeCode] || `${Number(item.widthMm||0)}×${Number(item.heightMm||0)}mm`; }
  function selectedItem() { return images.find((x)=>x.id===selectedId)||null; }
  function status(message){const el=$('pdfDividerServiceStatus');if(el)el.textContent=message;}
  function makePanel(){
    if($(PANEL_ID))return $(PANEL_ID);const modal=$('dividerModal')?.querySelector('.modal-box');if(!modal)return null;
    const panel=document.createElement('div');panel.id=PANEL_ID;panel.className='pdf-div-svc';panel.innerHTML=`<div class="pdf-div-svc-head"><strong>관리자 제공 간지 이미지</strong><button type="button" class="btn-sm" id="pdfDividerServiceRefresh" style="width:auto;padding:4px 7px">새로고침</button></div><div class="pdf-div-svc-list" id="pdfDividerServiceList"></div><div class="pdf-div-svc-actions"><button type="button" class="btn-sm" id="pdfDividerServiceClear">이미지 배경 해제</button></div><div class="pdf-div-svc-status" id="pdfDividerServiceStatus"></div>`;
    const confirm=$('dividerConfirmBtn')?.parentElement;modal.insertBefore(panel,confirm||null);return panel;
  }
  function preload(item){
    if(!item?.imageUrl)return Promise.reject(new Error('이미지 주소가 없습니다.'));if(imageCache.has(item.imageUrl))return Promise.resolve(imageCache.get(item.imageUrl));
    return new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.onload=()=>{imageCache.set(item.imageUrl,img);resolve(img)};img.onerror=()=>reject(new Error('간지 이미지를 불러오지 못했습니다.'));img.src=item.imageUrl;});
  }
  function drawText(ctx, content, w, h) {
    const fg=content.fg||'#ffffff',vAlign=content.textVAlign||'center',vOffsetPct=(Number(content.textVOffset)||0)/100;let cy=vAlign==='top'?h*.22:vAlign==='bottom'?h*.78:h*.5;cy+=h*vOffsetPct;const titleOffset=content.subtitle?-h*.06:0;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=Math.max(1,h*.004);
    if(content.title){const fs=Math.min(w*.1,h*.1,90);ctx.fillStyle=fg;ctx.globalAlpha=1;ctx.font=`bold ${fs}px "Pretendard","Malgun Gothic",sans-serif`;ctx.fillText(content.title,w/2,cy+titleOffset);}
    if(content.subtitle){const fs=Math.min(w*.055,h*.055,50);ctx.fillStyle=fg;ctx.globalAlpha=.86;ctx.font=`${fs}px "Pretendard","Malgun Gothic",sans-serif`;ctx.fillText(content.subtitle,w/2,cy+h*.08);}
    if(content.note){const fs=Math.min(w*.035,h*.035,30);ctx.fillStyle=fg;ctx.globalAlpha=.72;ctx.font=`${fs}px "Pretendard","Malgun Gothic",sans-serif`;ctx.fillText(content.note,w/2,h*.88);}
    ctx.restore();
    if(Array.isArray(content.extraTexts)){for(const item of content.extraTexts.slice(0,30)){if(!item||item.hidden||!text(item.text).trim())continue;ctx.save();ctx.translate(w*Math.max(0,Math.min(100,Number(item.x)||50))/100,h*Math.max(0,Math.min(100,Number(item.y)||70))/100);ctx.rotate((Number(item.rotation)||0)*Math.PI/180);ctx.globalAlpha=Math.max(.05,Math.min(1,Number(item.opacity)||1));ctx.fillStyle=item.color||fg;ctx.textAlign=item.align==='left'?'left':item.align==='right'?'right':'center';ctx.textBaseline='middle';const fs=Math.max(6,Math.min(96,Number(item.size)||18));ctx.font=`${Number(item.weight)>=700?'bold ':''}${item.italic?'italic ':''}${fs}px "Pretendard","Malgun Gothic",sans-serif`;ctx.fillText(text(item.text).slice(0,500),0,0);ctx.restore();}}
  }
  function renderServiceDivider(content,w,h){
    const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const img=imageCache.get(content.serviceImageUrl);ctx.fillStyle=content.bg||'#ffffff';ctx.fillRect(0,0,w,h);if(img){const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight),dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);}
    drawText(ctx,content,w,h);return c;
  }
  function patchFunctions(){
    if(!originalRenderDividerCanvas&&typeof window.renderDividerCanvas==='function')originalRenderDividerCanvas=window.renderDividerCanvas;
    if(originalRenderDividerCanvas&&!window.renderDividerCanvas.__serviceImageV1){const patched=function(content,w,h){if(content?.serviceImageUrl&&imageCache.has(content.serviceImageUrl))return renderServiceDivider(content,w,h);return originalRenderDividerCanvas(content,w,h);};patched.__serviceImageV1=true;window.renderDividerCanvas=patched;}
    if(!originalGetDividerContent&&typeof window.getDividerContent==='function')originalGetDividerContent=window.getDividerContent;
    if(originalGetDividerContent&&!window.getDividerContent.__serviceImageV1){const patched=function(){const content=originalGetDividerContent();const item=selectedItem();if(item){content.serviceImageId=item.id;content.serviceImageUrl=item.imageUrl;content.serviceImagePath=item.imagePath;content.serviceImageName=item.name;content.serviceImageSize=item.sizeCode;}return content;};patched.__serviceImageV1=true;window.getDividerContent=patched;}
    if(!originalOpenDividerInsert&&typeof window.openDividerInsert==='function')originalOpenDividerInsert=window.openDividerInsert;
    if(originalOpenDividerInsert&&!window.openDividerInsert.__serviceImageV1){const patched=function(){selectedId='';render();const result=Reflect.apply(originalOpenDividerInsert,this,arguments);setTimeout(()=>loadImages().catch(()=>{}),0);return result;};patched.__serviceImageV1=true;window.openDividerInsert=patched;}
    if(!originalEditDivider&&typeof window.editDivider==='function')originalEditDivider=window.editDivider;
    if(originalEditDivider&&!window.editDivider.__serviceImageV1){const patched=function(page){selectedId=page?.dividerContent?.serviceImageId||'';const result=Reflect.apply(originalEditDivider,this,arguments);const item=selectedItem();if(item)preload(item).then(()=>{render();try{updateDividerPreview();}catch(_){}}).catch(()=>{});else render();return result;};patched.__serviceImageV1=true;window.editDivider=patched;}
    if(!originalMakeDividerPageObj&&typeof window.makeDividerPageObj==='function')originalMakeDividerPageObj=window.makeDividerPageObj;
    if(originalMakeDividerPageObj&&!window.makeDividerPageObj.__serviceImageV1){const patched=function(content){const page=originalMakeDividerPageObj(content);if(content?.serviceImageUrl&&!imageCache.has(content.serviceImageUrl)){const shadow={id:content.serviceImageId,imageUrl:content.serviceImageUrl};preload(shadow).then(()=>{page.thumbCanvas=window.renderDividerCanvas(content,200,283);try{renderThumbs();}catch(_){}}).catch(()=>{});}return page;};patched.__serviceImageV1=true;window.makeDividerPageObj=patched;}
  }
  function render(){
    const list=$('pdfDividerServiceList');if(!list)return;const shown=images.filter(sizeMatches);list.replaceChildren();if(!shown.length){const e=document.createElement('div');e.className='pdf-div-svc-empty';e.textContent=images.length?'현재 출력 용지 규격에 맞는 간지 이미지가 없습니다.':'관리자가 공개한 간지 이미지가 없습니다.';list.appendChild(e);}else shown.forEach((item)=>{const b=document.createElement('button');b.type='button';b.className=`pdf-div-svc-item${item.id===selectedId?' on':''}`;const th=document.createElement('div');th.className='pdf-div-svc-thumb';const im=document.createElement('img');im.alt=item.name||'간지 이미지';im.loading='lazy';im.src=item.imageUrl;th.appendChild(im);const n=document.createElement('div');n.className='pdf-div-svc-name';n.textContent=item.name||'간지 이미지';const m=document.createElement('div');m.className='pdf-div-svc-meta';m.textContent=`${sizeLabel(item)}${item.category?` · ${item.category}`:''}`;b.append(th,n,m);b.addEventListener('click',async()=>{selectedId=item.id;render();status('이미지를 불러오는 중입니다...');try{await preload(item);status(`“${item.name||'간지 이미지'}” 선택`);updateDividerPreview();}catch(e){status(e.message);}});list.appendChild(b);});const p=currentPaper();status(`현재 출력 ${Math.round(p.w)}×${Math.round(p.h)}mm · 사용 가능 ${shown.length}개`);
  }
  async function loadImages(){const snap=await db.collection('cover_templates').where('isPublic','==',true).get();images=snap.docs.map((d)=>({id:d.id,...d.data()})).filter((x)=>x.kind===KIND&&x.imageUrl&&itemTargets(x).includes('pdf-divider')).sort((a,b)=>text(a.name).localeCompare(text(b.name),'ko'));render();return images;}
  function bind(){
    $('pdfDividerServiceRefresh')?.addEventListener('click',()=>loadImages().catch((e)=>status(e.message)));$('pdfDividerServiceClear')?.addEventListener('click',()=>{selectedId='';render();status('이미지 배경을 사용하지 않습니다.');try{updateDividerPreview();}catch(_){}});$('paperSize')?.addEventListener('change',()=>setTimeout(render,0));['customW','customH'].forEach((id)=>$(id)?.addEventListener('input',()=>setTimeout(render,0)));document.addEventListener('service-images-changed',()=>loadImages().catch(()=>{}));
  }
  function install(){patchFunctions();if(installed)return true;if(!$('dividerModal')||!window.db||typeof window.renderDividerCanvas!=='function')return false;styles();if(!makePanel())return false;bind();installed=true;document.documentElement.dataset.pdfDividerServiceImages='1';loadImages().catch((e)=>status(e.message));return true;}
  window.PdfDividerServiceImageLibrary={install,loadImages,preload,renderServiceDivider,get images(){return [...images]},kind:KIND,stage:'size-aware-pdf-divider-service-images'};
  [700,1300,2200].forEach((d)=>setTimeout(install,d));
})();