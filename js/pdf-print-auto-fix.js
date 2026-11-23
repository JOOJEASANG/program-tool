// Print production corrections: opt-in conversion, comparison, proof and save.
(function () {
  'use strict';
  if (window.__pdfPrintAutoFixV2) return;
  window.__pdfPrintAutoFixV2 = true;

  const $ = id => document.getElementById(id);
  const path = location.pathname.replace(/\/+$/, '') || '/';
  const activeRoute = path === '/pdf-preflight' ||
    path.endsWith('/pdf-preflight/index.html') ||
    path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html');
  const DIRECT_LIMIT = 20 * 1024 * 1024;
  const PDFJS_SRC = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
  const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  const CHECK_IDS = ['color_mode','dpi','font_embed','bleed','safe_margin','transparency'];
  const LABELS = {
    color_mode:'RGB·CMYK', dpi:'이미지 해상도', font_embed:'폰트 포함',
    bleed:'도련', safe_margin:'재단 안전여백', transparency:'투명도'
  };
  const fileKey = file => [file?.name || '', Number(file?.size || 0), Number(file?.lastModified || 0)].join('|');
  let pdfJsPromise = null;
  const widgets = new Set();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);

  function installStyles() {
    if ($('pdfPrintAutoFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPrintAutoFixStyles';
    style.textContent = [
      '.ppaf-widget{display:none;margin-top:14px;border:1px solid #cbd5e1;border-radius:16px;background:#fff;padding:16px;color:#1e293b}',
      '.ppaf-widget.show{display:block}.ppaf-head{font-size:15px;font-weight:950;color:#12396d}.ppaf-sub{font-size:11px;color:#64748b;line-height:1.65;margin:6px 0 14px}',
      '.ppaf-file{word-break:break-all;font-size:10px;color:#475569;margin:3px 0 11px}.ppaf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
      '.ppaf-choice{display:flex;align-items:flex-start;gap:8px;padding:11px;border:1px solid #dbe5ee;border-radius:11px;background:#f8fafc;cursor:pointer}',
      '.ppaf-choice input{flex:0 0 auto;margin-top:3px;accent-color:#075985}.ppaf-choice strong{display:block;font-size:11px;font-weight:900;color:#1e293b}',
      '.ppaf-choice small{display:block;font-size:10px;line-height:1.55;color:#64748b;margin-top:3px}',
      '.ppaf-tag{font-size:9px;color:#8a5b00;margin-top:5px;display:block}.ppaf-note{margin:12px 0;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;padding:10px;font-size:10px;line-height:1.65;color:#92400e}',
      '.ppaf-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px}.ppaf-row label{font-size:10px;font-weight:800}',
      '.ppaf-row select{font-size:11px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}',
      '.ppaf-btn{border:0;border-radius:10px;padding:11px 14px;background:#12396d;color:#fff;font-size:11px;font-weight:900;cursor:pointer}',
      '.ppaf-btn.secondary{background:#0f766e}.ppaf-btn:disabled{opacity:.43;cursor:not-allowed}',
      '.ppaf-status{font-size:10px;color:#475569;line-height:1.6;margin-top:9px;min-height:16px}.ppaf-status.error{color:#b91c1c}',
      '.ppaf-compare{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px}.ppaf-compare[hidden]{display:none}',
      '.ppaf-previews{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}',
      '.ppaf-preview-card{border:1px solid #d7e1eb;border-radius:11px;background:#f8fafc;padding:10px;text-align:center}',
      '.ppaf-preview-card strong{display:block;font-size:11px;margin-bottom:8px}.ppaf-preview-card canvas{display:block;max-width:100%;height:auto;margin:auto;background:white;box-shadow:0 2px 8px #0001}',
      '.ppaf-summary{font-size:10px;line-height:1.8;color:#475569;margin:11px 0}.ppaf-summary ul{margin:6px 0;padding-left:18px}',
      '.ppaf-confirm{display:flex;align-items:flex-start;gap:7px;font-size:10px;line-height:1.65;margin:12px 0;color:#334155}.ppaf-confirm input{margin-top:3px}',
      '@media(max-width:760px){.ppaf-grid,.ppaf-previews{grid-template-columns:1fr}.ppaf-widget{padding:12px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function optionsHtml() {
    const choices = [
      ['cmyk','RGB → CMYK 인쇄 색상 변환','사진·벡터를 포함한 페이지 전체를 CMYK로 변환합니다. 실제 프린터 ICC와 색 차이가 날 수 있습니다.','color_mode'],
      ['font','폰트 모양 고정','빠진 폰트를 새로 삽입하지 않고 현재 화면의 글자 모양을 이미지로 고정합니다. 텍스트 검색·편집은 불가합니다.','font_embed'],
      ['flatten','투명도·그림자 병합','현재 보이는 모습을 흰 바탕에 합쳐 인쇄 시 투명도 해석 차이를 줄입니다.','transparency'],
      ['bleed','3mm 도련 보조 생성','페이지 가장자리의 픽셀을 바깥 3mm로 연장합니다. 진짜 배경 원본을 복원하지는 못합니다.','bleed'],
      ['margin','안전여백 3mm 확보','페이지 전체를 재단선 안쪽으로 축소하고 흰 테두리를 둡니다. 글자뿐 아니라 그림·크기도 변합니다.','safe_margin'],
      ['sharp','저해상도 선명도 약하게 보정','가벼운 선명도 필터를 적용합니다. 실제 원본 이미지 DPI나 누락된 세부정보는 복원하지 못합니다.','dpi']
    ];
    return choices.map(item =>
      '<label class="ppaf-choice"><input type="checkbox" data-fix="' + item[0] + '"><span><strong>' +
      item[1] + '</strong><small>' + item[2] + '</small><em class="ppaf-tag" data-signal="' +
      item[3] + '">검사 결과 확인 전</em></span></label>'
    ).join('');
  }

  function createWidget(host, getContext, onSave) {
    installStyles();
    const panel = document.createElement('section');
    panel.className = 'ppaf-widget';
    panel.setAttribute('aria-label','인쇄 문제 자동 수정');
    panel.innerHTML = [
      '<div class="ppaf-head">인쇄 문제 자동 수정 · 인쇄용 보정</div>',
      '<p class="ppaf-sub">원본을 지키며 필요한 문제만 선택하세요. 색상·폰트·투명도 변환은 페이지를 이미지로 다시 만들기 때문에 인쇄 전 반드시 비교해야 합니다.</p>',
      '<div class="ppaf-file" data-file></div>',
      '<div class="ppaf-grid">', optionsHtml(), '</div>',
      '<div class="ppaf-row"><label>인쇄용 렌더링 품질 <select data-dpi><option value="200">200 DPI · 빠름</option><option value="300" selected>300 DPI · 권장</option><option value="400">400 DPI · 고품질·대용량</option></select></label></div>',
      '<div class="ppaf-note">주의: RGB→CMYK는 일반 SWOP 계열 변환이며 출력기 전용 ICC 보증이 아닙니다. 모든 수정은 페이지를 이미지로 재구성하므로 원본 텍스트·벡터의 편집 가능성이 사라집니다. 저화질 원본이나 누락된 폰트를 마법처럼 복원하지 못하며 도련·안전여백 보정은 외관을 변경합니다.</div>',
      '<button class="ppaf-btn" data-prepare disabled type="button">수정 후 결과 비교하기</button>',
      '<div class="ppaf-status" data-status role="status" aria-live="polite">파일을 검사한 뒤 보정할 항목을 선택하세요.</div>',
      '<div class="ppaf-compare" data-compare hidden>',
      '<strong style="font-size:12px">수정 전 · 수정 후 비교</strong>',
      '<div class="ppaf-row"><label>비교 페이지 <select data-page></select></label></div>',
      '<div class="ppaf-previews">',
      '<div class="ppaf-preview-card"><strong>수정 전 (원본)</strong><canvas data-before></canvas></div>',
      '<div class="ppaf-preview-card"><strong>수정 후 (인쇄용)</strong><canvas data-after></canvas></div>',
      '</div><div class="ppaf-summary" data-summary></div>',
      '<label class="ppaf-confirm"><input type="checkbox" data-confirm> 미리보기와 변환 주의사항을 확인했고 실제 인쇄 전 시험 출력을 하겠습니다.</label>',
      '<button class="ppaf-btn secondary" data-save type="button" disabled>확인 후 출력용 PDF 저장</button>',
      '</div>'
    ].join('');
    host.appendChild(panel);
    const find = key => panel.querySelector('[data-' + key + ']');
    const state = {key:'', blob:null, docs:null, busy:false, original:null, report:null, epoch:0, saved:false};
    const status = (message,error=false) => {
      const el=find('status'); if(!el) return; el.textContent=message;
      el.classList.toggle('error',Boolean(error));
    };
    const context = () => getContext() || {file:null,report:null};
    const settings = () => {
      const checked = key => Boolean(panel.querySelector('[data-fix="' + key + '"]')?.checked);
      return {
        convert_cmyk:checked('cmyk'), protect_fonts:checked('font'),
        flatten_transparency:checked('flatten'),
        add_bleed_mm:checked('bleed') ? 3 : 0,
        safe_margin_mm:checked('margin') ? 3 : 0,
        enhance_sharpness:checked('sharp'), render_dpi:Number(find('dpi').value)
      };
    };
    const anyOption = () => [...panel.querySelectorAll('[data-fix]')].some(node=>node.checked);
    function clearPreview() {
      state.epoch += 1;
      if(state.docs) state.docs.forEach(doc=>{try{doc.destroy()?.catch?.(()=>{});}catch(_){}});
      state.docs=null; state.blob=null; state.saved=false;
      find('compare').hidden=true;find('confirm').checked=false;find('save').disabled=true;
      const before=find('before'),after=find('after');
      before.width=before.height=after.width=after.height=1;
    }
    function syncButtons() {
      const {file}=context();
      find('prepare').disabled=state.busy||!file||!anyOption();
      find('save').disabled=state.busy||!state.blob||!find('confirm').checked||state.saved;
    }
    function signals(report) {
      CHECK_IDS.forEach(id=>{
        const el=panel.querySelector('[data-signal="' + id + '"]');
        if(!el) return;
        const item=(report?.checks||[]).find(v=>v.id===id);
        el.textContent=!item?'검사 전':item.severity==='pass'?'검사 통과':item.severity==='fail'?'검사 오류': '검사 경고';
      });
    }
    function sync() {
      const ctx=context(),file=ctx.file, key=fileKey(file);
      if(!file){panel.classList.remove('show');if(state.key){state.key='';clearPreview();}return;}
      panel.classList.add('show');
      if(state.key!==key){
        state.key=key;clearPreview();state.original=file;state.report=ctx.report||null;
        panel.querySelectorAll('[data-fix]').forEach(el=>{el.checked=false;});
        if((ctx.report?.checks||[]).some(item=>item.id==='color_mode'&&item.severity!=='pass')) {
          panel.querySelector('[data-fix="cmyk"]').checked=true;
        }
        status('수정할 항목을 선택한 다음 미리보기를 확인하세요.');
      }
      if(ctx.report) state.report=ctx.report;
      find('file').textContent=file.name+' · '+(file.size/1048576).toFixed(1)+'MB'+
        (state.report?' · '+Number(state.report.page_count||0)+'페이지 검수 완료':' · 검사 결과가 없으면 결과 생성 전에 검사합니다');
      signals(state.report);
      syncButtons();
    }

    async function ensurePdfJs() {
      if(window.pdfjsLib?.getDocument){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return window.pdfjsLib;}
      if(!pdfJsPromise) pdfJsPromise=new Promise((resolve,reject)=>{
        const script=document.createElement('script');
        script.src=PDFJS_SRC;script.async=true;
        script.onload=()=>window.pdfjsLib?.getDocument?resolve(window.pdfjsLib):reject(new Error('PDF 미리보기 엔진이 없습니다.'));
        script.onerror=()=>reject(new Error('PDF 미리보기 엔진을 불러오지 못했습니다.'));
        document.head.appendChild(script);
      }).catch(error=>{pdfJsPromise=null;throw error;});
      const lib=await pdfJsPromise;
      lib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
      return lib;
    }
    async function openPreviewDocs(file,blob,epoch) {
      const lib=await ensurePdfJs();
      const original=await lib.getDocument({data:await file.arrayBuffer()}).promise;
      try{
        const fixed=await lib.getDocument({data:await blob.arrayBuffer()}).promise;
        if(epoch!==state.epoch){await original.destroy();await fixed.destroy();return;}
        state.docs=[original,fixed];
        const select=find('page');
        select.replaceChildren();
        for(let i=1;i<=original.numPages;i++){
          const option=document.createElement('option');option.value=String(i);option.textContent=i+' / '+original.numPages+'페이지';
          select.appendChild(option);
        }
        find('compare').hidden=false;
        await drawPair();
      }catch(error){await original.destroy();throw error;}
    }
    async function drawPage(doc,num,canvas) {
      const page=await doc.getPage(num);
      const view=page.getViewport({scale:1});
      const scale=Math.min(1.6,Math.max(0.2,370/view.width));
      const viewport=page.getViewport({scale});
      canvas.width=Math.max(1,Math.round(viewport.width));
      canvas.height=Math.max(1,Math.round(viewport.height));
      const ctx=canvas.getContext('2d',{alpha:false});
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:ctx,viewport,background:'#fff'}).promise;
    }
    async function drawPair() {
      if(!state.docs) return;
      const page=Math.max(1,Number(find('page').value||1));
      await Promise.all([
        drawPage(state.docs[0],page,find('before')),
        drawPage(state.docs[1],page,find('after'))
      ]);
    }
    async function getToken() {
      const user=window.auth?.currentUser;
      if(!user) throw new Error('로그인이 필요합니다.');
      return user.getIdToken(true);
    }
    async function storage() {
      if(typeof window._ensureStorage==='function')return window._ensureStorage();
      if(window.storage)return window.storage;
      if(window.firebase?.storage)return window.firebase.storage();
      throw new Error('대용량 PDF 임시 저장소를 사용할 수 없습니다.');
    }
    async function resultBlob(response) {
      if(!response.ok){
        const info=await response.json().catch(()=>({}));
        throw new Error(info?.detail||'인쇄 문제 수정에 실패했습니다. ('+response.status+')');
      }
      if(!(response.headers.get('content-type')||'').includes('application/json'))return response.blob();
      const info=await response.json();
      if(info?.delivery!=='storage'||!info.download_url)throw new Error('출력 PDF 수신 정보가 올바르지 않습니다.');
      const result=await fetch(info.download_url,{cache:'no-store'});
      if(!result.ok)throw new Error('완성 PDF를 내려받지 못했습니다.');
      const blob=await result.blob();
      if(info.storage_path){try{await (await storage()).ref(info.storage_path).delete();}catch(error){console.warn('[print-fix] output cleanup',error);}}
      return blob;
    }
    async function requestAutoFix(file,params){
      const authToken=await getToken();
      if(Number(file.size||0)<=DIRECT_LIMIT){
        const form=new FormData();form.append('file',file);form.append('params',JSON.stringify(params));
        return resultBlob(await fetch('/api/preflight/auto-fix',{
          method:'POST',headers:{Authorization:'Bearer '+authToken},body:form
        }));
      }
      const st=await storage(),user=window.auth.currentUser;
      const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
      const safe=String(file.name||'document.pdf').replace(/[^A-Za-z0-9_.-]/g,'_').slice(0,80);
      const destination='preflight_temp/'+user.uid+'/'+id+'/'+(safe.toLowerCase().endsWith('.pdf')?safe:safe+'.pdf');
      try{
        status('대용량 원본을 임시 업로드하고 있습니다.');
        await st.ref(destination).put(file,{contentType:'application/pdf'});
        return resultBlob(await fetch('/api/preflight/auto-fix-storage',{
          method:'POST',headers:{Authorization:'Bearer '+authToken,'Content-Type':'application/json'},
          body:JSON.stringify({storage_path:destination,filename:file.name,params})
        }));
      }finally{try{await st.ref(destination).delete();}catch(_){}}
    }
    function issueList(report) {
      return CHECK_IDS.map(id=>{
        const item=(report?.checks||[]).find(c=>c.id===id);
        return {id,label:LABELS[id],status:item?.severity||'unknown'};
      });
    }
    function summary(original,after,params) {
      const warnings=[];
      if(params.convert_cmyk)warnings.push('CMYK 변환은 일반 SWOP 기준입니다. 출력기 전용 ICC와 다를 수 있으므로 색 교정을 확인하세요.');
      if(params.protect_fonts)warnings.push('폰트는 새로 포함한 것이 아니라 화면에 보이는 글자를 픽셀로 고정했습니다.');
      if(params.flatten_transparency)warnings.push('투명도는 합성됐지만 기존 레이어와 편집 가능성은 보존되지 않습니다.');
      if(params.add_bleed_mm)warnings.push('3mm 도련은 바깥 픽셀 복제 방식입니다. 가장자리 글자·무늬는 실제 재단 전 확인해야 합니다.');
      if(params.safe_margin_mm)warnings.push('안전여백은 글자만 옮기는 대신 페이지 전체를 축소하므로 실물 요소 크기가 작아집니다.');
      if(params.enhance_sharpness)warnings.push('선명도 필터는 원본에 없는 해상도·디테일을 만들어내지 못합니다.');
      warnings.push('전체 페이지가 '+params.render_dpi+'DPI 이미지로 재작성되어 원본 텍스트 검색·벡터 확대·편집 기능이 사라집니다.');
      const before=issueList(original), post=issueList(after);
      const statusWord=s=>s==='pass'?'통과':s==='fail'?'오류':s==='warning'?'경고':'미검사';
      let html='<strong>검사 전후 요약</strong><ul>';
      before.forEach((entry,i)=>{
        html+='<li>'+esc(entry.label)+': '+statusWord(entry.status)+' → '+statusWord(post[i].status)+'</li>';
      });
      html+='</ul><strong>실제 보정 한계 및 인쇄 전 확인</strong><ul>';
      warnings.forEach(s=>{html+='<li>'+esc(s)+'</li>';});
      html+='<li>수정 후 PDF는 전체 페이지를 이미지로 재구성합니다. DPI·폰트·안전여백 검사는 텍스트와 원본 사진의 품질을 더 이상 제대로 평가하지 못할 수 있습니다.</li></ul>';
      return html;
    }
    async function runPreview() {
      const {file}=context();
      if(!file||state.busy||!anyOption())return;
      clearPreview();
      const epoch=state.epoch, opts=settings(), originKey=fileKey(file);
      state.busy=true;syncButtons();
      try {
        if(!state.report&&typeof window.apiPreflightCheck==='function'){
          status('원본의 인쇄 문제를 먼저 검사하고 있습니다.');
          try{state.report=await window.apiPreflightCheck(file);}catch(error){console.warn('[print-fix] original preflight',error);}
          signals(state.report);
        }
        status('선택한 인쇄 보정을 적용하고 있습니다. 전체 페이지를 처리합니다.');
        const blob=await requestAutoFix(file,opts);
        if(epoch!==state.epoch||fileKey(context().file)!==originKey)return;
        state.blob=blob;
        status('수정 전·후 페이지를 불러오고 있습니다.');
        await openPreviewDocs(file,blob,epoch);
        if(epoch!==state.epoch)return;
        let after=null;
        if(typeof window.apiPreflightCheck==='function'){
          status('수정된 PDF를 다시 검사하고 있습니다.');
          try{
            after=await window.apiPreflightCheck(
              new File([blob], 'print_check.pdf', {type:'application/pdf'})
            );
          }catch(error){console.warn('[print-fix] post-fix check',error);}
        }
        find('summary').innerHTML=summary(state.report,after,opts);
        status('전후 비교가 준비됐습니다. 다른 페이지도 확인한 뒤 저장해 주세요.');
      }catch(error){
        clearPreview();status(error?.message||'인쇄 보정에 실패했습니다.',true);
      }finally{state.busy=false;syncButtons();}
    }
    function save() {
      const {file}=context();
      if(!state.blob||state.busy||!find('confirm').checked||state.saved)return;
      if(fileKey(file)!==state.key){status('원본 파일이 변경되었습니다. 다시 보정하세요.',true);return;}
      const name=String(file.name||'document.pdf').replace(/\.pdf$/i,'')+'_print_fixed.pdf';
      const url=URL.createObjectURL(state.blob);
      const a=document.createElement('a');a.href=url;a.download=name;
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      state.saved=true;syncButtons();
      status('출력용 PDF 저장을 시작했습니다. 실제 인쇄 전 시험 출력으로 색과 재단을 확인하세요.');
      if(typeof onSave==='function'){
        Promise.resolve(onSave(state.blob,name,file)).catch(error=>status(error?.message||'저장 후 재검사에 실패했습니다.',true));
      }
    }
    panel.querySelectorAll('[data-fix]').forEach(control=>control.addEventListener('change',()=>{clearPreview();syncButtons();}));
    find('dpi').addEventListener('change',()=>{clearPreview();syncButtons();});
    find('prepare').addEventListener('click',runPreview);
    find('confirm').addEventListener('change',syncButtons);
    find('page').addEventListener('change',()=>drawPair().catch(error=>status(error?.message||'페이지 미리보기 실패',true)));
    find('save').addEventListener('click',save);
    const widget={panel,sync,clearPreview};
    widgets.add(widget);sync();return widget;
  }

  function currentContext(){
    const utility=window.PdfUtility,files=utility?.state?.files||[];
    const index=Math.max(0,Math.min(files.length-1,Number(utility?.state?.activeIndex||0)));
    const file=files[index]||null;
    const report=file?utility.state.reports?.get(fileKey(file)):null;
    return {file,report,utility,index};
  }
  let mainWidget=null;
  function render(){
    if(!mainWidget)return;
    mainWidget.sync();
  }
  function installMain(){
    if(!activeRoute)return false;
    const utility=window.PdfUtility;
    if(!utility||!$('results'))return false;
    if(mainWidget)return true;
    const anchor=$('pdfPrintReadiness')||$('results');
    const host=document.createElement('div');
    host.id='pdfPrintAutoFix';
    anchor.insertAdjacentElement(anchor.id==='results'?'beforebegin':'afterend',host);
    mainWidget=createWidget(host,currentContext,async(blob,name,original)=>{
      const ctx=currentContext(),u=ctx.utility;
      if(!u||ctx.file!==original)return;
      const result=new File([blob],name,{type:'application/pdf',lastModified:Date.now()});
      u.state.reports?.delete(fileKey(original));
      u.state.errors?.delete(fileKey(original));
      u.state.files[ctx.index]=result;
      u.state.activeIndex=ctx.index;
      if(typeof u.selectActive==='function')u.selectActive(ctx.index);
      if(typeof u.runBatchCheck==='function')await u.runBatchCheck();
    });
    let queued=false;
    const observer=new MutationObserver(()=>{
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{queued=false;render();});
    });
    [$('pdfUtilityFileItems'),$('pdfUtilityBatchResults'),$('pdfPrintReadiness'),$('results')]
      .filter(Boolean).forEach(node=>observer.observe(node,{childList:true,subtree:true,characterData:true}));
    document.addEventListener('click',event=>{
      if(event.target.closest('.pdfu-file-row,.pdfu-detail-btn,#checkBtn'))setTimeout(render,0);
    });
    document.documentElement.dataset.pdfPrintAutoFix='production-v2';
    return true;
  }
  function mountStandalone(root,getFile){
    if(!root)throw new Error('인쇄 보정 작업 공간이 없습니다.');
    const host=root.querySelector('.pdfud-result')||root;
    // Remove the 300px empty-state placeholder before mounting real options.
    host.replaceChildren();
    const widget=createWidget(host,()=>({file:getFile?.()||null,report:null}),null);
    widget.sync();
    return widget;
  }
  window.PdfPrintAutoFix={render, mountStandalone, version:'production-print-fix-v2'};
  if(activeRoute){
    let attempts=0;
    function install(){attempts+=1;if(installMain())return;if(attempts<80)setTimeout(install,100);}
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else install();
  }
})();