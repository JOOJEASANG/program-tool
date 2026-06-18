// PDF checker compression helper.
// Adds a shared-file PDF lightening tool without requiring another upload.
(function () {
  if (window.__preflightCompressHelperV1) return;
  window.__preflightCompressHelperV1 = true;

  function install() {
    try {
      window.eval(`
        if (!window.__preflightCompressToolInstalledV1) {
          window.__preflightCompressToolInstalledV1 = true;
          window.__preflightCompressTemp = window.__preflightCompressTemp || null;

          function __pfCompressEsc(v){return String(v??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]))}
          function __pfCompressFile(){
            if (window.selectedFile) return window.selectedFile;
            if (typeof selectedFile !== 'undefined' && selectedFile) { window.selectedFile = selectedFile; return selectedFile; }
            const input=document.getElementById('fileInput');
            if(input&&input.files&&input.files[0]){ window.selectedFile=input.files[0]; return input.files[0]; }
            return null;
          }
          function __pfCompressBase(file){return (file?.name||'document.pdf').replace(/\\.pdf$/i,'')}
          function __pfCompressSame(file){
            const t=window.__preflightCompressTemp;
            return t&&t.file===file&&t.name===file.name&&t.size===file.size&&t.lastModified===file.lastModified&&t.path;
          }
          async function __pfCompressStorage(){
            if(typeof _ensureStorage==='function') return await _ensureStorage();
            if(typeof storage!=='undefined'&&storage&&storage.ref) return storage;
            if(window.storage&&window.storage.ref) return window.storage;
            if(typeof firebase!=='undefined'&&firebase.storage){ window.storage=firebase.storage(); return window.storage; }
            throw new Error('Firebase Storage를 초기화할 수 없습니다. 새로고침 후 다시 시도하세요.');
          }
          async function __pfCompressPath(file){
            if(__pfCompressSame(file)) return window.__preflightCompressTemp.path;
            const user=auth.currentUser;
            if(!user) throw new Error('로그인이 필요합니다.');
            const st=await __pfCompressStorage();
            const uid=user.uid;
            const sessionId=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
            const safeName=(file.name||'document.pdf').replace(/[^a-zA-Z0-9_.-]/g,'_').slice(0,80)||'document.pdf';
            const path='preflight_temp/'+uid+'/'+sessionId+'/'+(safeName.toLowerCase().endsWith('.pdf')?safeName:safeName+'.pdf');
            await st.ref(path).put(file,{contentType:'application/pdf'});
            window.__preflightCompressTemp={file,name:file.name,size:file.size,lastModified:file.lastModified,path};
            return path;
          }
          function __pfCompressBox(){
            const f=__pfCompressFile();
            if(!f) return '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:12px 14px;font-size:12px;font-weight:800;line-height:1.5;margin-bottom:12px;">먼저 위쪽 업로드 영역에 PDF 파일을 한 번 업로드하세요.</div>';
            const mb=(f.size/1024/1024).toFixed(1);
            return '<div style="background:#ecfeff;border:1px solid #a5f3fc;color:#0f7490;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.5;margin-bottom:12px;"><div style="font-weight:900;margin-bottom:4px;">현재 업로드한 PDF 사용</div><div style="font-weight:700;color:#155e75;word-break:break-all;">'+__pfCompressEsc(f.name)+' · '+mb+' MB</div><div style="font-size:11px;color:#64748b;margin-top:4px;">이 파일을 다시 업로드하지 않고 바로 경량화합니다.</div></div>';
          }
          async function __pfRunCompress(){
            const f=__pfCompressFile();
            if(!f) throw new Error('먼저 PDF 파일을 업로드하세요.');
            const q=(document.getElementById('tm-quality')?.value||'balanced');
            const path=await __pfCompressPath(f);
            const token=await auth.currentUser.getIdToken(true);
            const resp=await fetch('/api/preflight/compress-storage',{
              method:'POST',
              headers:{Authorization:'Bearer '.concat(token),'Content-Type':'application/json'},
              body:JSON.stringify({storage_path:path,filename:f.name||'document.pdf',params:{quality:q}})
            });
            if(!resp.ok){
              let msg='PDF 경량화 중 오류가 발생했습니다.';
              try{const err=await resp.json(); msg=err.detail||msg;}catch(_){ }
              throw new Error(msg);
            }
            const blob=await resp.blob();
            return {blob, filename: __pfCompressBase(f)+'_light_'+q+'.pdf'};
          }
          function __pfInstallCompressDef(){
            if(typeof TOOL_DEFS==='undefined') return;
            TOOL_DEFS.compress = {
              title:'🪶 PDF 경량화/압축',
              desc:'용량이 큰 PDF를 적정 해상도 이미지 PDF로 다시 만들어 파일을 가볍게 합니다.',
              body:__pfCompressBox()+'<label class="tool-field-label">압축 강도</label><select id="tm-quality" class="tool-select"><option value="small">강하게 줄이기 · 화면확인용</option><option value="balanced" selected>권장 · 균형</option><option value="clear">선명도 우선 · 용량 조금 큼</option></select><div style="font-size:11px;color:#92400e;margin-top:8px;background:#fffbeb;border:1px solid #fde68a;padding:8px 10px;border-radius:8px;line-height:1.6;">※ 이미지/효과가 무거운 PDF를 가볍게 만드는 기능입니다. 페이지가 이미지화되므로 텍스트 검색·복사는 제한될 수 있습니다.</div>',
              run:__pfRunCompress,
            };
          }
          function __pfAddCompressButton(){
            if(document.getElementById('compressPdfToolBtn')) return;
            const grid=document.querySelector('.tools-grid');
            if(!grid) return;
            const btn=document.createElement('button');
            btn.className='tool-btn';
            btn.id='compressPdfToolBtn';
            btn.type='button';
            btn.onclick=function(){ __pfInstallCompressDef(); openTool('compress'); };
            btn.innerHTML='<span class="t-icon">🪶</span>PDF 경량화/압축<span class="t-desc">무거운 PDF 줄이기</span>';
            const ref=[...grid.querySelectorAll('.tool-btn')].find(b=>(b.textContent||'').includes('PDF 복구')||(b.textContent||'').includes('암호 설정'));
            if(ref) grid.insertBefore(btn,ref); else grid.appendChild(btn);
          }
          if(typeof openTool==='function'&&!window.__preflightCompressOpenWrapped){
            const oldOpenTool=openTool;
            openTool=function(id){
              if(id==='compress') __pfInstallCompressDef();
              const r=oldOpenTool.apply(this,arguments);
              setTimeout(()=>{const run=document.getElementById('toolRunBtn'); if(run&&id==='compress') run.disabled=!__pfCompressFile();},0);
              return r;
            };
            window.__preflightCompressOpenWrapped=true;
          }
          if(typeof selectFile==='function'&&!window.__preflightCompressSelectWrapped){
            const oldSelectFile=selectFile;
            selectFile=function(f){
              const r=oldSelectFile.apply(this,arguments);
              window.__preflightCompressTemp=null;
              __pfInstallCompressDef();
              return r;
            };
            window.__preflightCompressSelectWrapped=true;
          }
          __pfInstallCompressDef();
          __pfAddCompressButton();
        }
      `);
    } catch (e) {
      console.warn('[preflight-compress] install failed', e);
    }
  }

  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 400);
  setInterval(install, 1200);
})();
