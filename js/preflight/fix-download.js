// Preflight adjustment download helper.
// Adds a free rule-based adjustment PDF download button after inspection.
(function () {
  if (window.__preflightFixDownloadV5) return;
  window.__preflightFixDownloadV5 = true;

  const PROGRAM_NAME = 'PDF 사전검수기';
  const ADJUST_BUTTON_TEXT = '조정 가능한 부분만 처리 후 다운로드';
  const ADJUSTING_TEXT = '조정 중...';

  function $(id) { return document.getElementById(id); }
  function hasIssues(report) {
    return !!(report && Array.isArray(report.checks) && report.checks.some((c) => c.severity === 'warning' || c.severity === 'fail'));
  }
  function safeText(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function sanitizeReport(report) {
    if (!report || typeof report !== 'object') return report;
    return {
      ...report,
      filename: safeText(report.filename),
      checks: Array.isArray(report.checks) ? report.checks.map((c) => ({
        ...c,
        id: safeText(c.id),
        label: safeText(c.label),
        detail: safeText(c.detail),
        severity: ['pass', 'warning', 'fail'].includes(c.severity) ? c.severity : 'warning',
        page_refs: Array.isArray(c.page_refs)
          ? c.page_refs.map((p) => Number.parseInt(p, 10)).filter((p) => Number.isFinite(p) && p > 0)
          : []
      })) : []
    };
  }
  function replaceTextNode(root, from, to) {
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach((node) => {
        if ((node.nodeValue || '').includes(from)) node.nodeValue = node.nodeValue.replaceAll(from, to);
      });
    } catch (_) {}
  }
  function localizeProgramName() {
    document.title = `${PROGRAM_NAME} · Program Tool`;
    const h1 = document.querySelector('.page-head h1');
    if (h1) h1.textContent = PROGRAM_NAME;
    const nav = document.querySelector('.nav-title');
    if (nav) nav.textContent = `🔍 ${PROGRAM_NAME}`;
    replaceTextNode(document.body, '인쇄 사전 검수기', PROGRAM_NAME);
    replaceTextNode(document.body, '인쇄 검수기', PROGRAM_NAME);
    replaceTextNode(document.body, 'Pre-flight Checker', PROGRAM_NAME);
  }
  function ensureButton() {
    if ($('preflightFixBtn')) return $('preflightFixBtn');
    const resultsHeader = document.querySelector('.results-header');
    if (!resultsHeader) return null;
    const btn = document.createElement('button');
    btn.id = 'preflightFixBtn';
    btn.type = 'button';
    btn.className = 'run-btn';
    btn.style.marginLeft = '0';
    btn.style.marginTop = '10px';
    btn.style.display = 'none';
    btn.textContent = ADJUST_BUTTON_TEXT;
    const note = document.createElement('div');
    note.id = 'preflightFixNote';
    note.style.cssText = 'font-size:12px;color:#64748b;line-height:1.5;margin-top:6px;display:none;';
    note.textContent = '조정 기능은 페이지 규격 통일, 파일 재정리, 압축 저장처럼 안전하게 처리 가능한 항목만 자동 처리합니다. 저해상도 이미지, 없는 폰트, 잘린 도련은 원본 교체가 필요할 수 있습니다.';
    resultsHeader.parentElement.insertBefore(btn, resultsHeader.nextSibling);
    btn.insertAdjacentElement('afterend', note);
    btn.onclick = runFix;
    return btn;
  }
  function getSelectedPdf() {
    if (window.selectedFile) return window.selectedFile;
    const input = $('fileInput');
    if (input && input.files && input.files[0]) {
      window.selectedFile = input.files[0];
      return input.files[0];
    }
    return null;
  }
  async function runFix() {
    try {
      const pdf = getSelectedPdf();
      if (!pdf) return alert('먼저 PDF 파일을 업로드하세요.');
      const btn = $('preflightFixBtn');
      if (btn) { btn.disabled = true; btn.textContent = ADJUSTING_TEXT; }
      const blob = await apiPreflightFix(pdf);
      downloadBlob(blob, `${basePdfName(pdf)}_adjusted.pdf`);
      if (btn) btn.textContent = ADJUST_BUTTON_TEXT;
      alert('조정 가능한 부분만 처리한 PDF를 다운로드했습니다. 다시 검수해서 남은 항목을 확인하세요.');
    } catch (e) {
      alert('조정 실패: ' + (e.message || e));
    } finally {
      const btn = $('preflightFixBtn');
      if (btn) { btn.disabled = false; btn.textContent = ADJUST_BUTTON_TEXT; }
    }
  }
  function basePdfName(file) {
    return (file?.name || 'document.pdf').replace(/\.pdf$/i, '');
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function wrapRenderResults() {
    if (window.__preflightRenderWrappedV5 || typeof window.renderResults !== 'function') return;
    const original = window.renderResults;
    window.renderResults = function wrappedRenderResults(report) {
      const safeReport = sanitizeReport(report);
      const result = original.call(this, safeReport);
      setTimeout(() => {
        localizeProgramName();
        const btn = ensureButton();
        const note = $('preflightFixNote');
        const show = hasIssues(safeReport);
        if (btn) btn.style.display = show ? 'inline-flex' : 'none';
        if (note) note.style.display = show ? 'block' : 'none';
      }, 0);
      return result;
    };
    window.__preflightRenderWrappedV5 = true;
  }

  function installSharedPdfTools() {
    if (window.__preflightSharedPdfToolsInstalled) return;
    try {
      window.eval(`
        if (!window.__preflightSharedPdfToolsInstalled) {
          window.__preflightSharedPdfToolsInstalled = true;

          function __pfEsc(v){return String(v??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]))}
          function __pfGetSelectedPdf(){
            if (window.selectedFile) return window.selectedFile;
            if (typeof selectedFile !== 'undefined' && selectedFile) { window.selectedFile = selectedFile; return selectedFile; }
            const input=document.getElementById('fileInput');
            if(input&&input.files&&input.files[0]){ window.selectedFile=input.files[0]; return input.files[0]; }
            return null;
          }
          function __pfBasePdfName(file){return (file?.name||'document.pdf').replace(/\\.pdf$/i,'')}
          function __pfSharedPdfBox(title){
            const f=__pfGetSelectedPdf();
            if(!f){
              return '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:12px 14px;font-size:12px;font-weight:800;line-height:1.5;margin-bottom:12px;">먼저 위쪽 업로드 영역에 PDF 파일을 한 번 업로드하세요.</div>';
            }
            const mb=(f.size/1024/1024).toFixed(1);
            return '<div style="background:#ecfeff;border:1px solid #a5f3fc;color:#0f7490;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.5;margin-bottom:12px;">'
              + '<div style="font-weight:900;margin-bottom:4px;">현재 업로드한 PDF 사용</div>'
              + '<div style="font-weight:700;color:#155e75;word-break:break-all;">' + __pfEsc(f.name) + ' · ' + mb + ' MB</div>'
              + '<div style="font-size:11px;color:#64748b;margin-top:4px;">' + (title||'추가 도구') + ' 실행 시 이 파일을 그대로 사용합니다. 다른 파일로 바꾸려면 상단 업로드 영역에서 다시 선택하세요.</div>'
              + '</div>';
          }
          function __pfDownload(blob, filename){
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url; a.download=filename; a.click();
            setTimeout(()=>URL.revokeObjectURL(url),1000);
          }
          async function __pfRunRepair(){
            const f=__pfGetSelectedPdf();
            if(!f) throw new Error('먼저 PDF 파일을 업로드하세요.');
            const blob=await apiPreflightFix(f);
            return {blob, filename: __pfBasePdfName(f)+'_repaired.pdf'};
          }

          if (typeof TOOL_DEFS !== 'undefined') {
            TOOL_DEFS.repair = {
              title: '🧰 PDF 복구/정상화',
              desc: '열림 오류, 깨진 구조, 비정상 객체가 있는 PDF를 가능한 범위에서 다시 정리해 다운로드합니다.',
              body: __pfSharedPdfBox('PDF 복구/정상화') + '<div style="font-size:11px;color:#64748b;line-height:1.6;background:#f8fafc;border-radius:8px;padding:9px 10px;">파일 구조를 재정리하고 페이지를 새 PDF로 다시 구성합니다. 심하게 손상되어 열 수 없는 파일은 복구가 제한될 수 있습니다.</div>',
              run: __pfRunRepair,
            };

            if (TOOL_DEFS.encrypt) {
              TOOL_DEFS.encrypt.body = __pfSharedPdfBox('암호 설정') + '<label class="tool-field-label">새 비밀번호</label><input type="password" id="tm-pw" placeholder="32자 이내" maxlength="32" class="tool-input">';
              TOOL_DEFS.encrypt.run = async () => {
                const f=__pfGetSelectedPdf();
                if(!f) throw new Error('먼저 PDF 파일을 업로드하세요.');
                const pw=document.getElementById('tm-pw').value.trim();
                if(!pw) throw new Error('비밀번호를 입력하세요.');
                return {...await apiPdfTool('encrypt', f, {password: pw}), filename: __pfBasePdfName(f)+'_encrypted.pdf'};
              };
            }
            if (TOOL_DEFS.decrypt) {
              TOOL_DEFS.decrypt.body = __pfSharedPdfBox('암호 해제') + '<label class="tool-field-label">현재 비밀번호</label><input type="password" id="tm-pw" class="tool-input">';
              TOOL_DEFS.decrypt.run = async () => {
                const f=__pfGetSelectedPdf();
                if(!f) throw new Error('먼저 PDF 파일을 업로드하세요.');
                return {...await apiPdfTool('decrypt', f, {password: document.getElementById('tm-pw').value}), filename: __pfBasePdfName(f)+'_decrypted.pdf'};
              };
            }
            if (TOOL_DEFS.ocr) {
              TOOL_DEFS.ocr.body = __pfSharedPdfBox('OCR 텍스트 인식') + '<div style="font-size:11px;color:#475569;margin-top:2px;background:#f1f5f9;padding:8px 10px;border-radius:8px;">⏱ 페이지당 약 2~5초 소요됩니다. 결과물은 텍스트 검색·복사가 가능한 PDF입니다.</div>';
              TOOL_DEFS.ocr.run = async () => {
                const f=__pfGetSelectedPdf();
                if(!f) throw new Error('먼저 PDF 파일을 업로드하세요.');
                return {...await apiPdfTool('ocr', f), filename: __pfBasePdfName(f)+'_ocr.pdf'};
              };
            }
          }

          if (!document.getElementById('repairPdfToolBtn')) {
            const grid=document.querySelector('.tools-grid');
            if(grid){
              const btn=document.createElement('button');
              btn.className='tool-btn';
              btn.id='repairPdfToolBtn';
              btn.type='button';
              btn.onclick=()=>openTool('repair');
              btn.innerHTML='<span class="t-icon">🧰</span>PDF 복구/정상화<span class="t-desc">깨진 PDF 재정리</span>';
              const firstPdfBtn=[...grid.querySelectorAll('.tool-btn')].find(b=>(b.textContent||'').includes('암호 설정'));
              if(firstPdfBtn) grid.insertBefore(btn, firstPdfBtn); else grid.appendChild(btn);
            }
          }

          if (typeof openTool === 'function' && !window.__preflightOpenToolWrapped) {
            const __oldOpenTool=openTool;
            openTool=function patchedOpenTool(id){
              const result=__oldOpenTool.apply(this, arguments);
              setTimeout(()=>{
                try{
                  const body=document.getElementById('toolModalBody');
                  if(body && ['repair','encrypt','decrypt','ocr'].includes(id)){
                    const f=__pfGetSelectedPdf();
                    if(!f){
                      const run=document.getElementById('toolRunBtn');
                      if(run) run.disabled=true;
                    }
                  }
                }catch(_){ }
              },0);
              return result;
            };
            window.__preflightOpenToolWrapped=true;
          }

          if (typeof runTool === 'function' && !window.__preflightRunToolWrapped) {
            const __oldRunTool=runTool;
            runTool=async function patchedRunTool(){
              if(!currentTool) return;
              const def=TOOL_DEFS[currentTool];
              const status=document.getElementById('toolStatus');
              const runBtn=document.getElementById('toolRunBtn');
              status.style.color='#2563eb';
              status.textContent='처리 중...';
              runBtn.disabled=true;
              try{
                const result=await def.run();
                const blob=result && result.blob ? result.blob : result;
                const filename=(result && result.filename) ? result.filename : currentTool+'_'+new Date().toISOString().slice(0,10)+'.pdf';
                __pfDownload(blob, filename);
                status.style.color='#15803d';
                status.textContent='✓ 완료! 다운로드되었습니다.';
                setTimeout(closeTool,1500);
              }catch(e){
                status.style.color='#dc2626';
                status.textContent='❌ '+(e.message||e);
                runBtn.disabled=false;
              }
            };
            window.__preflightRunToolWrapped=true;
          }
        }
      `);
      return true;
    } catch (e) {
      console.warn('[preflight-tools] install failed', e);
      return false;
    }
  }

  function updateToolHint() {
    const sec = document.querySelector('.tools-section');
    if (!sec || $('sharedPdfToolHint')) return;
    const hint = document.createElement('div');
    hint.id = 'sharedPdfToolHint';
    hint.style.cssText = 'font-size:11px;color:#64748b;line-height:1.5;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:9px 11px;margin:0 0 12px;';
    hint.textContent = 'PDF 도구는 위에서 업로드한 PDF를 그대로 사용합니다. 이미지 → PDF만 이미지 파일을 별도로 선택합니다.';
    const grid = sec.querySelector('.tools-grid');
    if (grid) sec.insertBefore(hint, grid);
  }

  function boot() {
    localizeProgramName();
    wrapRenderResults();
    ensureButton();
    installSharedPdfTools();
    updateToolHint();
  }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
