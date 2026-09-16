// Large-file Storage fallback for authenticated PDF Suite direct tools.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityLargeStorageV1)return;
  window.__programStudioPdfUtilityLargeStorageV1=true;

  const original=window.ProgramStudioPdfUtilityDirectBridge;
  if(!original)return;

  const MIB=1024*1024;
  const DIRECT_MAX=20*MIB;
  const LEGACY_STORAGE_MAX=200*MIB;
  const MAX_FILE_BYTES=500*MIB;
  const SERVER_TIMEOUT_MS=9*60*1000;
  const STORAGE_TYPES=new Set(['preflight','auto-fix','compress','remove-blank','encrypt','decrypt','background-crop']);
  const STORAGE_AUTH_RETRY_CODES=new Set(['storage/unauthorized','storage/unauthenticated']);

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const filenameBase=file=>String(file?.name||'document.pdf').replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)||'document';

  function setStatus(root,text,error=false){
    const el=root?.querySelector('.pdfud-status');
    if(!el)return;
    el.textContent=text;
    el.className='pdfud-status show'+(error?' error':'');
  }
  function download(blob,name){
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  }
  async function readError(resp){
    try{const data=await resp.clone().json();return data.detail||data.message||`서버 오류 (${resp.status})`;}
    catch(_){return (await resp.text().catch(()=>''))||`서버 오류 (${resp.status})`;}
  }
  async function ensureStorage(){
    if(typeof firebase==='undefined')throw new Error('Firebase를 사용할 수 없습니다.');
    if(!firebase.storage){
      await new Promise((resolve,reject)=>{
        const found=document.getElementById('pdfUtilityLargeStorageSdk');
        if(found){found.addEventListener('load',resolve,{once:true});found.addEventListener('error',()=>reject(new Error('Storage 모듈을 불러오지 못했습니다.')),{once:true});return;}
        const script=document.createElement('script');
        script.id='pdfUtilityLargeStorageSdk';
        script.src='https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
        script.onload=resolve;script.onerror=()=>reject(new Error('Storage 모듈을 불러오지 못했습니다.'));
        document.head.appendChild(script);
      });
    }
    const storage=firebase.storage();
    try{storage.setMaxUploadRetryTime?.(20*60*1000);storage.setMaxOperationRetryTime?.(10*60*1000);}catch(_){}
    return storage;
  }
  function storageErrorCode(error){return String(error?.code||'').trim().toLowerCase();}
  async function refreshStorageAuth(user){
    if(!user?.getIdToken)throw new Error('로그인이 필요합니다.');
    await user.getIdToken(true);
    await new Promise(resolve=>setTimeout(resolve,120));
  }
  async function uploadOnce(ref,file,root){
    const task=ref.put(file,{contentType:'application/pdf'});
    if(!task?.on)return task;
    await new Promise((resolve,reject)=>{
      task.on('state_changed',snapshot=>{
        const total=Number(snapshot.totalBytes||file.size||1);
        const percent=Math.max(0,Math.min(100,Math.round(Number(snapshot.bytesTransferred||0)*100/total)));
        setStatus(root,`대용량 Storage 업로드 중… ${percent}%`);
      },reject,resolve);
    });
  }
  async function uploadWithProgress(ref,file,root,user){
    try{
      return await uploadOnce(ref,file,root);
    }catch(error){
      if(!STORAGE_AUTH_RETRY_CODES.has(storageErrorCode(error)))throw error;
      setStatus(root,'로그인 권한을 새로 확인한 뒤 업로드를 다시 시도합니다…');
      await refreshStorageAuth(user);
      try{
        return await uploadOnce(ref,file,root);
      }catch(retryError){
        if(STORAGE_AUTH_RETRY_CODES.has(storageErrorCode(retryError))){
          throw new Error('대용량 임시 저장 권한을 확인하지 못했습니다. 다시 로그인한 뒤 시도해 주세요.');
        }
        throw retryError;
      }
    }
  }
  async function fetchTimed(url,options){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),SERVER_TIMEOUT_MS);
    try{return await fetch(url,{...options,signal:controller.signal});}
    catch(error){if(error?.name==='AbortError')throw new Error('대용량 PDF 처리 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.');throw error;}
    finally{clearTimeout(timer);}
  }
  async function deliveryBlob(resp,storage){
    const type=resp.headers.get('content-type')||'';
    if(!type.includes('application/json'))return resp.blob();
    const data=await resp.json();
    if(data?.delivery!=='storage'||!data.download_url)throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const out=await fetch(data.download_url,{cache:'no-store'});
    if(!out.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob=await out.blob();
    if(data.storage_path){storage.ref(data.storage_path).delete().catch(()=>{});}
    return{blob,data};
  }

  function paramsFor(type,root){
    if(type==='auto-fix')return{
      normalize_page_size:Boolean(root.querySelector('[data-opt="normalize"]')?.checked),
      pad_mode:String(root.querySelector('[data-opt="pad"]')?.value||'none')
    };
    if(type==='compress'){
      const raw=String(root.querySelector('[data-opt="quality"]')?.value||'medium');
      return{quality:raw==='low'?'small':raw==='high'?'clear':'balanced'};
    }
    if(type==='encrypt'||type==='decrypt')return{password:String(root.querySelector('[data-opt="password"]')?.value||'')};
    if(type==='background-crop')return{
      strength:String(root.querySelector('[data-opt="strength"]')?.value||'medium'),
      margin_top_mm:Number(root.querySelector('[data-opt="top"]')?.value||0),
      margin_bottom_mm:Number(root.querySelector('[data-opt="bottom"]')?.value||0),
      margin_left_mm:Number(root.querySelector('[data-opt="left"]')?.value||0),
      margin_right_mm:Number(root.querySelector('[data-opt="right"]')?.value||0)
    };
    return{};
  }

  function validate(type,file,root){
    if(!file)throw new Error('PDF 파일을 선택하세요.');
    if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name||''))throw new Error('PDF 파일만 선택할 수 있습니다.');
    if(Number(file.size||0)>MAX_FILE_BYTES)throw new Error('대용량 서버 작업은 PDF 한 파일 최대 500MB까지 지원합니다.');
    const params=paramsFor(type,root);
    if(type==='encrypt'){
      const pw=params.password,pw2=String(root.querySelector('[data-opt="password2"]')?.value||'');
      if(pw.length<4||pw.length>32)throw new Error('비밀번호는 4~32자로 입력하세요.');
      if(pw!==pw2)throw new Error('비밀번호 확인이 일치하지 않습니다.');
    }
    if(type==='decrypt'&&!params.password)throw new Error('현재 비밀번호를 입력하세요.');
    return params;
  }

  async function runLarge(type,root,file){
    const params=validate(type,file,root);
    const user=window.auth?.currentUser;
    if(!user)throw new Error('로그인이 필요합니다.');
    setStatus(root,'대용량 업로드 권한을 확인하는 중입니다…');
    await refreshStorageAuth(user);
    const storage=await ensureStorage();
    const sid=`large${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`.slice(0,36);
    const prefix=['preflight','auto-fix','compress'].includes(type)?'preflight_temp':'pdf_temp';
    const path=`${prefix}/${user.uid}/${sid}/source.pdf`;
    const ref=storage.ref(path);
    let uploaded=false;
    try{
      await uploadWithProgress(ref,file,root,user);uploaded=true;
      setStatus(root,'업로드 완료 · 서버에서 처리 중입니다. 큰 파일은 수 분 걸릴 수 있습니다…');
      const headers={Authorization:`Bearer ${await user.getIdToken(true)}`,'Content-Type':'application/json'};
      let endpoint='';
      let body={storage_path:path,filename:file.name};
      if(type==='preflight')endpoint='/api/preflight/check-storage';
      if(type==='auto-fix'){endpoint='/api/preflight/auto-fix-storage';body.params=params;}
      if(type==='compress'){endpoint='/api/preflight/compress-storage';body.params=params;}
      if(type==='remove-blank')endpoint='/api/pdf-utility/remove-blank-storage';
      if(type==='encrypt'||type==='decrypt'){
        endpoint='/api/pdf-utility/security-storage';
        body={...body,operation:type,password:params.password};
      }
      if(type==='background-crop'){
        endpoint='/api/pdf-utility/background-cleanup-crop-storage';
        body={...body,...params};
      }
      const resp=await fetchTimed(endpoint,{method:'POST',headers,body:JSON.stringify(body)});
      if(!resp.ok)throw new Error(await readError(resp));

      if(type==='preflight'){
        const report=await resp.json();
        const checks=Array.isArray(report.checks)?report.checks:[];
        root.querySelector('.pdfud-result').innerHTML=`<div class="pdfud-result-head"><div class="pdfud-score">${Number(report.score||0)}</div><div><strong>${esc(report.filename||file.name)}</strong><div class="pdfud-copy" style="margin:3px 0 0">${Number(report.page_count||0)}페이지 · 항목 ${checks.length}개</div></div></div><div class="pdfud-checks">${checks.map(c=>`<div class="pdfud-check ${esc(c.severity||'')}"><strong>${c.severity==='fail'?'❌':c.severity==='warning'?'⚠️':'✅'} ${esc(c.label||'검사 항목')}</strong><p>${esc(c.detail||'')}</p></div>`).join('')}</div>`;
        setStatus(root,'대용량 문서 진단이 완료되었습니다.');
        return;
      }

      const delivered=await deliveryBlob(resp,storage);
      const blob=delivered?.blob||delivered;
      let name=`${filenameBase(file)}_처리완료.pdf`;
      if(type==='auto-fix')name=`${filenameBase(file)}_인쇄안전수정.pdf`;
      if(type==='compress')name=`${filenameBase(file)}_압축.pdf`;
      if(type==='remove-blank')name=`${filenameBase(file)}_빈페이지제거.pdf`;
      if(type==='encrypt')name=`${filenameBase(file)}_암호설정.pdf`;
      if(type==='decrypt')name=`${filenameBase(file)}_암호해제.pdf`;
      if(type==='background-crop')name=`${filenameBase(file)}_배경및여백제거.pdf`;
      download(blob,name);
      root.querySelector('.pdfud-result').innerHTML=`<div class="pdfud-empty"><div><strong style="display:block;color:#166534;font-size:15px">완료</strong><p>${esc(name)} 다운로드가 시작되었습니다.</p></div></div>`;
      setStatus(root,'대용량 Storage 처리가 완료되었습니다.');
    }finally{
      if(uploaded)ref.delete().catch(()=>{});
    }
  }

  function installLargeHandler(tool){
    const type=original.typeFor?.(tool?.name)||'';
    if(!STORAGE_TYPES.has(type))return;
    const stage=document.getElementById('pdfUtilityStageBody');
    const root=stage?.querySelector('.pdfud-card:last-child');
    if(!root||root.dataset.largeStorageBound==='1')return;
    root.dataset.largeStorageBound='1';
    const copy=root.querySelector('.pdfud-copy');
    if(copy)copy.insertAdjacentHTML('afterend','<div class="pdfud-inline-note">대용량 모드: 직접 전송은 20MB 이하, 큰 PDF는 Storage로 자동 전환됩니다. 서버 작업은 파일당 최대 500MB입니다.</div>');
    root.addEventListener('click',async event=>{
      const button=event.target.closest?.('.pdfud-run');
      if(!button)return;
      const file=root.querySelector('.pdfud-file-input')?.files?.[0]||null;
      const size=Number(file?.size||0);
      const threshold=type==='background-crop'?LEGACY_STORAGE_MAX:DIRECT_MAX;
      if(size<=threshold)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      if(button.disabled)return;
      button.disabled=true;
      try{await runLarge(type,root,file);}
      catch(error){setStatus(root,error?.message||'대용량 PDF 처리 중 오류가 발생했습니다.',true);}
      finally{button.disabled=false;}
    },true);
  }

  function activate(tool){
    const ok=original.activate(tool);
    if(ok)installLargeHandler(tool);
    return ok;
  }
  const wrapped=Object.freeze({
    activate,
    handles:name=>original.handles?.(name),
    requiresAuth:name=>original.requiresAuth?.(name),
    reset:()=>original.reset?.(),
    typeFor:name=>original.typeFor?.(name),
    stage:'pdf-utility-large-storage-v1',
    maxFileBytes:MAX_FILE_BYTES
  });
  window.ProgramStudioPdfUtilityDirectBridge=wrapped;
  document.documentElement.dataset.pdfUtilityLargeStorage='500mb-v1';
})();