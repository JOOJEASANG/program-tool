// Centered PDF Utility home: shared upload first, four category columns, work/result modal.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCenteredV1)return;
  window.__programStudioPdfUtilityCenteredV1=true;

  const MIB=1024*1024;
  const MAX_FILE_BYTES=500*MIB;
  const MAX_TOTAL_BYTES=800*MIB;
  const MAX_FILES=10;
  const SERVER_TIMEOUT_MS=9*60*1000;
  const LONG_STORAGE_ENDPOINT=/^\/api\/(?:preflight\/(?:check-storage|fix-storage|auto-fix-storage|compress-storage)|pdf-utility\/(?:merge-storage|extract-storage|remove-blank-storage|security-storage|background-cleanup-storage|background-cleanup-crop-storage))$/;
  const CATEGORY_META={
    pages:{icon:'📑',title:'페이지 · 문서',desc:'합치기 · 나누기 · 정리 · 회전',tone:'blue'},
    convert:{icon:'🔄',title:'변환 · OCR',desc:'PDF ↔ 이미지 · OCR · 텍스트',tone:'cyan'},
    security:{icon:'🔐',title:'편집 · 보안',desc:'암호 · 개인정보 · 문서 정리',tone:'violet'},
    inspect:{icon:'🧰',title:'최적화 · 검사',desc:'검사 · 압축 · 안전 수정',tone:'green'}
  };
  const CATEGORY_ORDER=['pages','convert','security','inspect'];
  const SERVER_TOOL_NAMES=new Set(['PDF 합치기','페이지 추출·나누기','선택 페이지 → PDF']);
  const state={files:[],activeIndex:0,installed:false,resultUrl:''};
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]));
  const fileKey=file=>`${file?.name||''}|${Number(file?.size||0)}|${Number(file?.lastModified||0)}`;
  const totalBytes=()=>state.files.reduce((sum,file)=>sum+Number(file?.size||0),0);
  const humanBytes=bytes=>{const n=Number(bytes||0);if(n>=MIB)return `${(n/MIB).toFixed(n>=100*MIB?0:1)}MB`;return `${Math.max(1,Math.round(n/1024))}KB`;};
  const activeFile=()=>state.files[state.activeIndex]||state.files[0]||null;
  const toolName=button=>button?.dataset.pdfuCoreSource||button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';

  function installLongEndpointBridge(){
    if(window.__pdfUtilityLongStorageFetchV1)return;
    window.__pdfUtilityLongStorageFetchV1=true;
    const nativeFetch=window.fetch.bind(window);
    window.fetch=function pdfUtilityLongFetch(input,init){
      const raw=typeof input==='string'?input:(input?.url||'');
      let path='';
      try{const url=new URL(raw,location.origin);if(url.origin===location.origin)path=url.pathname;}catch(_){path=String(raw||'').split('?')[0];}
      if(path&&LONG_STORAGE_ENDPOINT.test(path)){
        let project='program-tool';
        try{project=window.firebase?.app?.().options?.projectId||project;}catch(_){}
        const direct=`https://us-central1-${project}.cloudfunctions.net/api${path}`;
        return nativeFetch(direct,{...(init||{}),mode:'cors',credentials:'omit'});
      }
      return nativeFetch(input,init);
    };
    document.documentElement.dataset.pdfUtilityLongStorageFetch='ready';
  }

  function installStyle(){
    if($('pdfUtilityCenteredStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCenteredStyle';
    style.textContent=`
      html[data-pdf-utility-layout="centered"] body{overflow:auto!important;background:#eef3f7!important}
      html[data-pdf-utility-layout="centered"] .wrap{max-width:none!important;margin:0!important;padding:0!important}
      html[data-pdf-utility-layout="centered"] .hero,html[data-pdf-utility-layout="centered"] .quick,html[data-pdf-utility-layout="centered"] .footer{display:none!important}
      .pdfuc-home{min-height:calc(100vh - 62px);padding:32px clamp(16px,3vw,46px) 64px;background:linear-gradient(180deg,#f8fbff 0,#eef3f7 100%)}
      .pdfuc-inner{width:min(1180px,100%);margin:0 auto}.pdfuc-head{text-align:center;margin:4px auto 22px}.pdfuc-kicker{font-size:10px;font-weight:950;letter-spacing:1.2px;color:#2563eb}.pdfuc-head h1{font-size:clamp(27px,4vw,38px);font-weight:950;color:#0f2f59;letter-spacing:-1px;margin-top:4px}.pdfuc-head p{font-size:12px;color:#64748b;line-height:1.65;margin-top:7px}
      .pdfuc-upload-wrap{width:min(760px,100%);margin:0 auto 24px}.pdfuc-upload{display:block;border:2px dashed #9fbfd9;border-radius:22px;background:#fff;padding:34px 24px;text-align:center;cursor:pointer;box-shadow:0 12px 34px rgba(15,47,89,.07);transition:.18s}.pdfuc-upload:hover,.pdfuc-upload.drag{border-color:#2563eb;background:#f8fbff;transform:translateY(-1px)}.pdfuc-upload.has-files{border-style:solid;border-color:#67c7d8;background:linear-gradient(180deg,#f4fdff,#fff)}.pdfuc-upload-icon{width:66px;height:66px;margin:0 auto 12px;border-radius:19px;display:grid;place-items:center;background:linear-gradient(135deg,#dbeafe,#cffafe);font-size:31px}.pdfuc-upload strong{display:block;font-size:17px;color:#0f2f59}.pdfuc-upload span{display:block;font-size:11px;color:#64748b;margin-top:6px;line-height:1.55}.pdfuc-upload b{color:#1d4ed8}.pdfuc-input{display:none!important}
      .pdfuc-files{display:grid;gap:7px;margin-top:10px}.pdfuc-file{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 11px;border:1px solid #dbe5ee;border-radius:11px;background:#fff;cursor:pointer;text-align:left}.pdfuc-file.active{border-color:#67c7d8;background:#f0fdff}.pdfuc-file-num{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;background:#eff6ff;color:#1d4ed8;font-size:10px;font-weight:950}.pdfuc-file-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;font-weight:900;color:#172033}.pdfuc-file-meta{font-size:9px;color:#94a3b8;margin-top:2px}.pdfuc-file-remove{width:29px;height:29px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;color:#64748b;cursor:pointer}.pdfuc-file-remove:hover{background:#fee2e2;color:#b91c1c;border-color:#fecaca}.pdfuc-upload-summary{text-align:center;font-size:10px;font-weight:850;color:#0e7490;margin-top:9px;min-height:16px}
      .pdfuc-section-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin:28px 0 12px}.pdfuc-section-title strong{font-size:16px;color:#0f2f59}.pdfuc-section-title span{font-size:10px;color:#94a3b8}.pdfuc-categories{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}.pdfuc-category{min-width:0;border:1px solid #dce5ef;border-radius:18px;background:#fff;padding:14px;box-shadow:0 8px 24px rgba(15,23,42,.045)}.pdfuc-cat-head{min-height:84px;padding:5px 5px 12px;border-bottom:1px solid #edf2f7;margin-bottom:8px}.pdfuc-cat-icon{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;font-size:19px;margin-bottom:8px}.pdfuc-category[data-tone="blue"] .pdfuc-cat-icon{background:#eff6ff}.pdfuc-category[data-tone="cyan"] .pdfuc-cat-icon{background:#ecfeff}.pdfuc-category[data-tone="violet"] .pdfuc-cat-icon{background:#f5f3ff}.pdfuc-category[data-tone="green"] .pdfuc-cat-icon{background:#ecfdf5}.pdfuc-cat-head strong{display:block;font-size:13px;color:#172033}.pdfuc-cat-head span{display:block;font-size:9px;color:#64748b;line-height:1.45;margin-top:3px}
      .pdfuc-category .pdfu-menu-group{margin:0!important}.pdfuc-category .pdfu-menu-group-head{display:none!important}.pdfuc-category .pdfu-menu-item{display:grid!important;width:100%!important;grid-template-columns:25px minmax(0,1fr) auto!important;gap:7px!important;align-items:center!important;min-height:44px!important;padding:8px!important;margin:2px 0!important;border:1px solid transparent!important;border-radius:9px!important;background:#fff!important;text-align:left!important;cursor:pointer!important}.pdfuc-category .pdfu-menu-item:hover{border-color:#dbeafe!important;background:#f8fbff!important}.pdfuc-category .pdfu-menu-item.active{border-color:#bfdbfe!important;background:#eff6ff!important;box-shadow:none!important}.pdfuc-category .pdfu-menu-icon{font-size:14px!important}.pdfuc-category .pdfu-menu-name{font-size:9.5px!important;line-height:1.35!important;font-weight:880!important}.pdfuc-category .pdfu-menu-badge{font-size:7px!important;padding:3px 5px!important}
      .pdfuc-modal{display:none;position:fixed;inset:0;z-index:1600;background:rgba(15,23,42,.62);backdrop-filter:blur(5px);padding:18px;align-items:center;justify-content:center}.pdfuc-modal.open{display:flex}.pdfuc-dialog{width:min(1180px,100%);height:min(880px,92vh);background:#eef3f7;border-radius:22px;overflow:hidden;box-shadow:0 34px 100px rgba(0,0,0,.34);display:flex;flex-direction:column}.pdfuc-modal-top{height:54px;flex:0 0 54px;background:#fff;border-bottom:1px solid #dbe4ee;display:flex;align-items:center;gap:10px;padding:0 14px 0 18px}.pdfuc-modal-top strong{font-size:13px;color:#0f2f59}.pdfuc-modal-file{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#64748b}.pdfuc-modal-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;color:#475569;font-size:21px;cursor:pointer}.pdfuc-dialog>.pdfu-stage{flex:1;min-height:0!important;height:auto!important;display:flex!important;overflow:hidden!important}.pdfuc-dialog .pdfu-stage-head{flex:0 0 68px!important}.pdfuc-dialog .pdfu-stage-body{flex:1!important;min-height:0!important;overflow:auto!important}.pdfuc-dialog .pdfud-card{min-height:auto!important}.pdfuc-dialog .pdfud-grid{grid-template-columns:minmax(300px,410px) minmax(0,1fr)!important}.pdfuc-dialog .pdfu-frame,.pdfuc-dialog .pdfu-frame-shell{min-height:640px!important}
      .pdfuc-server-card{width:min(860px,100%);margin:0 auto;background:#fff;border:1px solid #dce5ef;border-radius:18px;padding:22px;box-shadow:0 8px 26px rgba(15,23,42,.05)}.pdfuc-server-intro{font-size:11px;line-height:1.65;color:#64748b}.pdfuc-server-files{display:grid;gap:7px;margin-top:14px}.pdfuc-server-file{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;background:#f8fafc;font-size:10px}.pdfuc-server-file strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}.pdfuc-server-file span{color:#94a3b8;white-space:nowrap}.pdfuc-server-field{margin-top:14px}.pdfuc-server-field label{display:block;font-size:10px;font-weight:900;color:#334155;margin-bottom:5px}.pdfuc-server-field input{width:100%;border:1.5px solid #dbe4ee;border-radius:10px;padding:10px 12px;outline:none}.pdfuc-server-field input:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(37,99,235,.08)}.pdfuc-server-run{margin-top:15px;width:100%;border:0;border-radius:11px;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff;padding:12px 15px;font-size:11px;font-weight:950;cursor:pointer}.pdfuc-server-run:disabled{opacity:.45;cursor:not-allowed}.pdfuc-server-progress{display:none;margin-top:13px;padding:12px;border-radius:11px;background:#eff6ff}.pdfuc-server-progress.show{display:block}.pdfuc-server-progress strong{display:block;font-size:10px;color:#1d4ed8;margin-bottom:7px}.pdfuc-server-track{height:7px;border-radius:999px;background:#dbeafe;overflow:hidden}.pdfuc-server-fill{height:100%;width:0;background:linear-gradient(90deg,#2563eb,#0891b2);transition:width .2s}.pdfuc-server-pct{text-align:right;font-size:9px;color:#64748b;margin-top:5px}.pdfuc-server-result{display:none;margin-top:13px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:14px;color:#166534}.pdfuc-server-result.show{display:block}.pdfuc-server-result strong{font-size:12px}.pdfuc-server-result p{font-size:10px;line-height:1.55;margin-top:4px}.pdfuc-result-download{display:inline-flex;margin-top:10px;border:0;border-radius:9px;background:#166534;color:#fff;padding:9px 12px;font-size:10px;font-weight:900;text-decoration:none}.pdfuc-server-error{display:none;margin-top:12px;border:1px solid #fecaca;background:#fef2f2;color:#b91c1c;border-radius:10px;padding:10px 11px;font-size:10px;line-height:1.55}.pdfuc-server-error.show{display:block}
      .pdfuc-footnote{margin-top:16px;text-align:center;font-size:9px;color:#94a3b8;line-height:1.55}
      @media(max-width:980px){.pdfuc-categories{grid-template-columns:repeat(2,minmax(0,1fr))}.pdfuc-dialog .pdfud-grid{grid-template-columns:1fr!important}.pdfuc-dialog{height:94vh}.pdfuc-modal{padding:10px}}
      @media(max-width:600px){.pdfuc-home{padding:22px 11px 44px}.pdfuc-upload{padding:26px 14px}.pdfuc-categories{grid-template-columns:1fr}.pdfuc-section-title{align-items:flex-start;flex-direction:column}.pdfuc-dialog{height:96vh;border-radius:16px}.pdfuc-modal{padding:5px}.pdfuc-modal-file{display:none}.pdfuc-dialog .pdfu-stage-head{height:auto!important;min-height:74px!important;flex-basis:auto!important}.pdfuc-server-card{padding:15px}}
    `;
    document.head.appendChild(style);
  }

  function renderFiles(){
    const list=$('pdfUtilityCenteredFiles'),summary=$('pdfUtilityCenteredSummary'),zone=$('pdfUtilityCenteredUpload');
    if(!list||!summary||!zone)return;
    list.replaceChildren();
    state.files.forEach((file,index)=>{
      const row=document.createElement('div');row.className='pdfuc-file'+(index===state.activeIndex?' active':'');row.dataset.index=String(index);
      row.innerHTML=`<span class="pdfuc-file-num">${index+1}</span><span><span class="pdfuc-file-name" title="${esc(file.name)}">${esc(file.name)}</span><span class="pdfuc-file-meta">${humanBytes(file.size)} · ${index===state.activeIndex?'현재 선택':'클릭하여 선택'}</span></span><button type="button" class="pdfuc-file-remove" aria-label="${esc(file.name)} 삭제">×</button>`;
      row.addEventListener('click',event=>{if(event.target.closest('button'))return;state.activeIndex=index;renderFiles();});
      row.querySelector('button').addEventListener('click',()=>{state.files.splice(index,1);state.activeIndex=Math.max(0,Math.min(state.activeIndex,state.files.length-1));renderFiles();});
      list.appendChild(row);
    });
    zone.classList.toggle('has-files',state.files.length>0);
    summary.textContent=state.files.length?`${state.files.length}개 · 전체 ${humanBytes(totalBytes())} / 800MB · 선택: ${activeFile()?.name||''}`:'PDF 한 파일 최대 500MB · 여러 파일 전체 최대 800MB';
    document.documentElement.dataset.pdfUtilityCenteredFileCount=String(state.files.length);
  }

  function addFiles(raw){
    const incoming=Array.from(raw||[]).filter(Boolean);
    if(!incoming.length)return;
    const invalid=incoming.find(file=>file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||''));
    if(invalid){alert('PDF 파일만 업로드할 수 있습니다.');return;}
    const tooLarge=incoming.find(file=>Number(file.size||0)>MAX_FILE_BYTES);
    if(tooLarge){alert(`${tooLarge.name}: PDF 한 파일은 최대 500MB까지 가능합니다.`);return;}
    const existing=new Set(state.files.map(fileKey));
    const unique=incoming.filter(file=>!existing.has(fileKey(file)));
    if(state.files.length+unique.length>MAX_FILES){alert(`PDF는 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`);return;}
    const next=totalBytes()+unique.reduce((sum,file)=>sum+Number(file.size||0),0);
    if(next>MAX_TOTAL_BYTES){alert('여러 파일의 전체 합계는 최대 800MB까지 가능합니다.');return;}
    const wasEmpty=!state.files.length;state.files.push(...unique);if(wasEmpty)state.activeIndex=0;renderFiles();
  }

  function buildUpload(home){
    const wrap=document.createElement('section');wrap.className='pdfuc-upload-wrap';
    wrap.innerHTML=`<label class="pdfuc-upload" id="pdfUtilityCenteredUpload"><span class="pdfuc-upload-icon">📂</span><strong>PDF 파일을 여기에 올려주세요</strong><span>클릭하거나 파일을 끌어다 놓으세요.<br><b>파일당 최대 500MB</b> · 여러 파일 전체 최대 800MB · 최대 10개</span><input class="pdfuc-input" id="pdfUtilityCenteredInput" type="file" accept="application/pdf,.pdf" multiple></label><div class="pdfuc-files" id="pdfUtilityCenteredFiles"></div><div class="pdfuc-upload-summary" id="pdfUtilityCenteredSummary"></div>`;
    home.appendChild(wrap);
    const input=$('pdfUtilityCenteredInput'),zone=$('pdfUtilityCenteredUpload');
    input?.addEventListener('change',()=>{addFiles(input.files);input.value='';});
    ['dragenter','dragover'].forEach(type=>zone?.addEventListener(type,event=>{event.preventDefault();zone.classList.add('drag');}));
    ['dragleave','drop'].forEach(type=>zone?.addEventListener(type,event=>{event.preventDefault();zone.classList.remove('drag');if(type==='drop')addFiles(event.dataTransfer?.files);}));
    renderFiles();
  }

  function categoryKey(group){
    const raw=String(group?.dataset.pdfuCoreGroup||group?.dataset.pdfuGroup||'').toLowerCase();
    if(raw==='pages'||raw==='basic')return 'pages';
    if(raw==='convert')return 'convert';
    if(raw==='security'||raw==='edit')return 'security';
    return 'inspect';
  }

  function buildCategories(home,menu){
    const head=document.createElement('div');head.className='pdfuc-section-title';head.innerHTML='<strong>원하는 작업을 선택하세요</strong><span>파일을 먼저 올린 뒤 메뉴를 누르면 작업·결과가 레이어창에서 열립니다.</span>';
    const grid=document.createElement('div');grid.className='pdfuc-categories';grid.id='pdfUtilityCenteredCategories';
    const buckets=new Map(CATEGORY_ORDER.map(key=>[key,[]]));
    [...menu.querySelectorAll(':scope > .pdfu-menu-group')].forEach(group=>buckets.get(categoryKey(group))?.push(group));
    CATEGORY_ORDER.forEach(key=>{
      const meta=CATEGORY_META[key];const card=document.createElement('section');card.className='pdfuc-category';card.dataset.category=key;card.dataset.tone=meta.tone;
      card.innerHTML=`<div class="pdfuc-cat-head"><span class="pdfuc-cat-icon">${meta.icon}</span><strong>${meta.title}</strong><span>${meta.desc}</span></div><div class="pdfuc-cat-tools"></div>`;
      const slot=card.querySelector('.pdfuc-cat-tools');(buckets.get(key)||[]).forEach(group=>slot.appendChild(group));grid.appendChild(card);
    });
    home.append(head,grid);
  }

  function openModal(button){
    const overlay=$('pdfUtilityCenteredModal');if(!overlay)return;
    overlay.classList.add('open');document.body.style.overflow='hidden';
    const name=button?.querySelector('.pdfu-menu-name')?.textContent?.trim()||toolName(button)||'PDF 작업';
    const title=$('pdfUtilityCenteredModalTitle');if(title)title.textContent=name;
    const file=$('pdfUtilityCenteredModalFile');if(file)file.textContent=state.files.length?`선택 파일 · ${activeFile()?.name||''}${state.files.length>1?` 외 ${state.files.length-1}개`:''}`:'레이어 안에서 파일을 선택할 수도 있습니다.';
    if(!SERVER_TOOL_NAMES.has(toolName(button))){[0,40,120,260].forEach(delay=>setTimeout(()=>seedStageFiles(name),delay));}
  }

  function closeModal(){const overlay=$('pdfUtilityCenteredModal');overlay?.classList.remove('open');document.body.style.overflow='';}

  function seedInput(input,files){
    if(!input||!files.length||typeof DataTransfer==='undefined')return false;
    const key=files.map(fileKey).join('||');if(input.dataset.pdfucSeedKey===key)return true;
    try{const dt=new DataTransfer();files.forEach(file=>dt.items.add(file));input.files=dt.files;input.dataset.pdfucSeedKey=key;input.dispatchEvent(new Event('change',{bubbles:true}));return true;}catch(_){return false;}
  }

  function seedStageFiles(name){
    if(!state.files.length)return;
    const stage=$('pdfUtilityStageBody');if(!stage)return;
    const active=activeFile();const merge=/합치기/.test(name);
    stage.querySelectorAll('input[type="file"]').forEach(input=>{
      const accept=String(input.accept||'').toLowerCase();if(accept.includes('image/')&&!accept.includes('pdf'))return;
      seedInput(input,merge&&input.multiple?state.files:[active]);
    });
  }

  async function ensureStorage(){
    if(typeof firebase==='undefined')throw new Error('Firebase를 사용할 수 없습니다.');
    if(!firebase.storage){
      await new Promise((resolve,reject)=>{
        const existing=$('pdfUtilityCenteredStorageSdk');
        if(existing){existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',()=>reject(new Error('Storage 모듈을 불러오지 못했습니다.')),{once:true});return;}
        const script=document.createElement('script');script.id='pdfUtilityCenteredStorageSdk';script.src='https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';script.onload=resolve;script.onerror=()=>reject(new Error('Storage 모듈을 불러오지 못했습니다.'));document.head.appendChild(script);
      });
    }
    const storage=firebase.storage();
    try{storage.setMaxUploadRetryTime?.(20*60*1000);storage.setMaxOperationRetryTime?.(10*60*1000);}catch(_){}
    return storage;
  }

  function setServerProgress(root,percent,text){
    const box=root.querySelector('.pdfuc-server-progress'),fill=root.querySelector('.pdfuc-server-fill'),label=root.querySelector('.pdfuc-server-progress strong'),pct=root.querySelector('.pdfuc-server-pct');
    box?.classList.add('show');if(fill)fill.style.width=`${Math.max(0,Math.min(100,Math.round(percent)))}%`;if(label)label.textContent=text||'처리 중';if(pct)pct.textContent=`${Math.round(percent)}%`;
  }

  function showServerError(root,message){const box=root.querySelector('.pdfuc-server-error');if(!box)return;box.textContent=message||'처리 중 오류가 발생했습니다.';box.classList.add('show');}

  async function uploadFilesToStorage(files,root){
    const user=window.auth?.currentUser;if(!user)throw new Error('로그인이 필요합니다.');
    const storage=await ensureStorage();const sid=`util${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`.slice(0,36);const paths=[];
    for(let index=0;index<files.length;index+=1){
      const file=files[index];const safe=String(file.name||`file_${index+1}.pdf`).replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,70);const path=`pdf_temp/${user.uid}/${sid}/${String(index+1).padStart(2,'0')}_${safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf'}`;paths.push(path);
      const task=storage.ref(path).put(file,{contentType:'application/pdf'});
      await new Promise((resolve,reject)=>task.on('state_changed',snapshot=>{
        const ratio=Number(snapshot.bytesTransferred||0)/Math.max(1,Number(snapshot.totalBytes||file.size||1));const overall=(index+ratio)/Math.max(1,files.length);setServerProgress(root,5+overall*38,`${index+1}/${files.length} · ${file.name} 업로드 중`);
      },reject,resolve));
    }
    return{storage,paths,user};
  }

  async function fetchTimed(url,options){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),SERVER_TIMEOUT_MS);
    try{return await fetch(url,{...(options||{}),signal:controller.signal});}
    catch(error){if(error?.name==='AbortError')throw new Error('대용량 PDF 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');throw error;}
    finally{clearTimeout(timer);}
  }

  async function readError(resp){try{const data=await resp.clone().json();return data.detail||data.message||`서버 오류 (${resp.status})`;}catch(_){return (await resp.text().catch(()=>''))||`서버 오류 (${resp.status})`;}}

  async function readResultBlob(resp,storage){
    const type=resp.headers.get('content-type')||'';if(!type.includes('application/json'))return resp.blob();
    const data=await resp.json();if(data?.delivery!=='storage'||!data.download_url)throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result=await fetch(data.download_url,{cache:'no-store'});if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');const blob=await result.blob();if(data.storage_path)storage.ref(data.storage_path).delete().catch(()=>{});return blob;
  }

  function showResult(root,blob,filename,detail){
    if(state.resultUrl)URL.revokeObjectURL(state.resultUrl);state.resultUrl=URL.createObjectURL(blob);
    const result=root.querySelector('.pdfuc-server-result');if(!result)return;result.innerHTML=`<strong>작업 완료</strong><p>${esc(detail||filename)}</p><a class="pdfuc-result-download" href="${state.resultUrl}" download="${esc(filename)}">결과 PDF 다운로드</a>`;result.classList.add('show');setServerProgress(root,100,'완료');
  }

  async function runServerMerge(root){
    if(state.files.length<2)throw new Error('PDF 합치기는 파일을 2개 이상 올려주세요.');
    if(totalBytes()>MAX_TOTAL_BYTES)throw new Error('합칠 PDF 전체 용량은 최대 800MB입니다.');
    const button=root.querySelector('.pdfuc-server-run');button.disabled=true;root.querySelector('.pdfuc-server-error')?.classList.remove('show');root.querySelector('.pdfuc-server-result')?.classList.remove('show');
    let upload=null;
    try{
      setServerProgress(root,3,'대용량 합치기 준비 중');upload=await uploadFilesToStorage(state.files,root);setServerProgress(root,48,'서버에서 PDF를 합치는 중');
      const token=await upload.user.getIdToken(true);const resp=await fetchTimed('/api/pdf-utility/merge-storage',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({storage_paths:upload.paths,filenames:state.files.map(file=>file.name)})});
      if(!resp.ok)throw new Error(await readError(resp));const pages=Number(resp.headers.get('X-PDF-Page-Count')||0);const blob=await readResultBlob(resp,upload.storage);showResult(root,blob,`PDF_합치기_${state.files.length}개.pdf`,`파일 ${state.files.length}개${pages?` · 총 ${pages}페이지`:''}를 합쳤습니다.`);
    }finally{if(upload)await Promise.allSettled(upload.paths.map(path=>upload.storage.ref(path).delete()));button.disabled=false;}
  }

  async function runServerExtract(root){
    const file=activeFile();if(!file)throw new Error('페이지를 추출할 PDF를 먼저 올려주세요.');const selection=root.querySelector('[data-pdfuc-range]')?.value?.trim()||'';if(!selection)throw new Error('추출할 페이지를 입력하세요. 예: 1-3,5');
    const button=root.querySelector('.pdfuc-server-run');button.disabled=true;root.querySelector('.pdfuc-server-error')?.classList.remove('show');root.querySelector('.pdfuc-server-result')?.classList.remove('show');let upload=null;
    try{
      setServerProgress(root,3,'대용량 페이지 추출 준비 중');upload=await uploadFilesToStorage([file],root);setServerProgress(root,48,'서버에서 선택 페이지를 추출하는 중');
      const token=await upload.user.getIdToken(true);const resp=await fetchTimed('/api/pdf-utility/extract-storage',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({storage_path:upload.paths[0],filename:file.name,page_selection:selection})});
      if(!resp.ok)throw new Error(await readError(resp));const pages=Number(resp.headers.get('X-PDF-Page-Count')||0);const blob=await readResultBlob(resp,upload.storage);showResult(root,blob,`${String(file.name||'document').replace(/\.pdf$/i,'')}_페이지추출.pdf`,`${pages||selection} 페이지 범위 추출이 완료되었습니다.`);
    }finally{if(upload)await Promise.allSettled(upload.paths.map(path=>upload.storage.ref(path).delete()));button.disabled=false;}
  }

  function setStageHeader(title,desc){const t=$('pdfUtilityStageTitle'),d=$('pdfUtilityStageDesc'),b=$('pdfUtilityStageBadge'),a=$('pdfUtilityStageAction');if(t)t.textContent=title;if(d)d.textContent=desc;if(b){b.textContent='500MB 서버 처리';b.style.background='#ecfdf5';b.style.color='#047857';}if(a)a.classList.remove('show');}

  function mountServerTool(button,name){
    openModal(button);const stage=$('pdfUtilityStageBody');if(!stage)return;
    const isMerge=name==='PDF 합치기';setStageHeader(isMerge?'PDF 합치기':'페이지 추출·나누기',isMerge?'등록한 PDF를 현재 목록 순서대로 하나로 합칩니다.':'선택한 PDF에서 원하는 페이지만 새 PDF로 저장합니다.');
    const files=isMerge?state.files:(activeFile()?[activeFile()]:[]);const card=document.createElement('section');card.className='pdfuc-server-card';
    card.innerHTML=`<div class="pdfuc-server-intro">${isMerge?'여러 파일을 Firebase Storage에 안전하게 올린 뒤 서버에서 순서대로 합칩니다.':'선택 파일을 Storage 경유로 처리하므로 큰 PDF도 브라우저 메모리에 통째로 올리지 않습니다.'}<br><b>파일당 최대 500MB · 작업 합계 최대 800MB</b></div><div class="pdfuc-server-files">${files.length?files.map((file,index)=>`<div class="pdfuc-server-file"><strong>${isMerge?`${index+1}. `:''}${esc(file.name)}</strong><span>${humanBytes(file.size)}</span></div>`).join(''):'<div class="pdfuc-server-file"><strong>먼저 위 화면에서 PDF 파일을 업로드하세요.</strong><span>-</span></div>'}</div>${isMerge?'':'<div class="pdfuc-server-field"><label>추출 페이지</label><input data-pdfuc-range type="text" placeholder="예: 1-3,5" inputmode="text"></div>'}<button type="button" class="pdfuc-server-run" ${isMerge?(files.length<2?'disabled':''):(files.length?'':'disabled')}>${isMerge?'PDF 합치기 실행':'페이지 추출 실행'}</button><div class="pdfuc-server-progress"><strong>준비 중</strong><div class="pdfuc-server-track"><div class="pdfuc-server-fill"></div></div><div class="pdfuc-server-pct">0%</div></div><div class="pdfuc-server-result"></div><div class="pdfuc-server-error"></div>`;
    stage.replaceChildren(card);card.querySelector('.pdfuc-server-run').addEventListener('click',async()=>{try{if(isMerge)await runServerMerge(card);else await runServerExtract(card);}catch(error){showServerError(card,error?.message||'PDF 처리 중 오류가 발생했습니다.');}});
    document.querySelectorAll('[data-pdfu-tool]').forEach(node=>node.classList.toggle('active',node===button));
  }

  function installServerToolIntercept(){
    document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-pdfu-tool]');if(!button)return;const name=toolName(button);if(!SERVER_TOOL_NAMES.has(name))return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();mountServerTool(button,name);
    },true);
  }

  function wireToolOpen(grid){
    grid.querySelectorAll('[data-pdfu-tool]').forEach(button=>{
      button.addEventListener('pointerdown',()=>openModal(button));
      button.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')openModal(button);});
      button.addEventListener('click',()=>{if(SERVER_TOOL_NAMES.has(toolName(button)))return;openModal(button);const name=button.querySelector('.pdfu-menu-name')?.textContent?.trim()||'';[0,60,180].forEach(delay=>setTimeout(()=>seedStageFiles(name),delay));});
    });
  }

  function install(){
    if(state.installed)return true;
    const split=$('pdfUtilitySplit'),menu=$('pdfUtilityMenu'),stage=split?.querySelector('.pdfu-stage');
    if(!split||!menu||!stage){setTimeout(install,80);return false;}
    state.installed=true;installStyle();installLongEndpointBridge();installServerToolIntercept();
    const home=document.createElement('main');home.className='pdfuc-home';home.innerHTML='<div class="pdfuc-inner" id="pdfUtilityCenteredInner"><header class="pdfuc-head"><div class="pdfuc-kicker">PDF UTILITY</div><h1>PDF 유틸리티</h1><p>파일을 먼저 올리고 필요한 기능을 선택하세요. 작업 과정과 결과는 별도 레이어창에서 확인합니다.</p></header></div>';
    const inner=home.querySelector('#pdfUtilityCenteredInner');buildUpload(inner);buildCategories(inner,menu);inner.insertAdjacentHTML('beforeend','<div class="pdfuc-footnote">대용량 서버 작업은 파일당 최대 500MB, 여러 파일 작업은 총 800MB까지 처리합니다. OCR·이미지 변환처럼 브라우저 메모리를 사용하는 일부 로컬 기능은 PC 환경에 따라 처리 속도가 달라질 수 있습니다.</div>');
    const overlay=document.createElement('div');overlay.className='pdfuc-modal';overlay.id='pdfUtilityCenteredModal';overlay.innerHTML='<div class="pdfuc-dialog" role="dialog" aria-modal="true" aria-labelledby="pdfUtilityCenteredModalTitle"><div class="pdfuc-modal-top"><strong id="pdfUtilityCenteredModalTitle">PDF 작업</strong><span class="pdfuc-modal-file" id="pdfUtilityCenteredModalFile"></span><button class="pdfuc-modal-close" id="pdfUtilityCenteredModalClose" type="button" aria-label="닫기">×</button></div></div>';
    overlay.querySelector('.pdfuc-dialog').appendChild(stage);document.body.appendChild(overlay);
    $('pdfUtilityCenteredModalClose')?.addEventListener('click',closeModal);overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&overlay.classList.contains('open'))closeModal();});
    split.replaceChildren(home);wireToolOpen(inner);
    document.documentElement.dataset.pdfUtilityLayout='centered';document.documentElement.dataset.pdfUtilityCentered='ready-v1';
    return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCentered=Object.freeze({openForTool:openModal,addFiles,maxFileBytes:MAX_FILE_BYTES,maxTotalBytes:MAX_TOTAL_BYTES,get files(){return [...state.files];},stage:'pdf-utility-centered-v1'});
})();
