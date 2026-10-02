(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  function dispatch(el){el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))}
  function bindFormMenus(){
    $$('input,textarea,select').forEach(el=>ProgramContextMenu.bind(el,()=>({groups:[{label:'편집',items:[
      {label:'복사',disabled:!('selectionStart'in el)||el.selectionStart===el.selectionEnd,action:()=>document.execCommand('copy')},
      {label:'붙여넣기',action:async()=>{try{const text=await navigator.clipboard.readText();if('selectionStart'in el){const s=el.selectionStart,e=el.selectionEnd;el.setRangeText(text,s,e,'end')}else el.value=text;dispatch(el)}catch(_){el.focus();document.execCommand('paste')}}},
      {label:'전체 선택',action:()=>{el.focus();el.select?.()}},
      {label:'내용 지우기',className:'danger',action:()=>{el.value='';dispatch(el)}}
    ]},{label:'값 조절',items:[
      {label:'값 증가',disabled:el.type!=='number'&&el.type!=='range',action:()=>{el.stepUp?.();dispatch(el)}},
      {label:'값 감소',disabled:el.type!=='number'&&el.type!=='range',action:()=>{el.stepDown?.();dispatch(el)}}
    ]}]})));
    $$('button').forEach(el=>ProgramContextMenu.bind(el,()=>({groups:[{label:'버튼',items:[{label:'실행',disabled:el.disabled,action:()=>el.click()},{label:'설명 보기',action:()=>alert(el.title||el.getAttribute('aria-label')||el.textContent.trim()||'버튼')}]}]})));
  }
  function addCoverFields(){
    if(!location.pathname.includes('perfect-binding-cover'))return;
    const publisher=$('#publisher'),year=$('#publishYear'),back=$('#backText'),spine=$('#spineTitle');
    if(!publisher||$('#institutionName'))return;
    const wrap=publisher.closest('.grid2')||publisher.parentElement;
    const box=document.createElement('div');box.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px';
    box.innerHTML='<div class="field"><label>기관명</label><input id="institutionName" type="text" placeholder="예: 한국초등학교"></div><div class="field"><label>발행처</label><input id="issuerName" type="text" placeholder="예: 교무부"></div><div class="field"><label>발행 연도</label><input id="publishYearLine" type="text" value="2026"></div>';
    wrap.after(box);publisher.closest('.field').style.display='none';year.closest('.field').style.display='none';
    const syncFront=()=>{publisher.value=[$('#institutionName').value,$('#issuerName').value,$('#publishYearLine').value].filter(Boolean).join('\n');year.value='';dispatch(publisher)};
    ['institutionName','issuerName','publishYearLine'].forEach(id=>$('#'+id).addEventListener('input',syncFront));syncFront();
    if(back){const b=document.createElement('div');b.innerHTML='<div class="field"><label>뒤표지 제목</label><input id="backTitleExtra" type="text" placeholder="선택사항"></div><div class="field"><label>뒤표지 추가 문구</label><textarea id="backBodyExtra" placeholder="주소, 연락처, 안내 문구 등"></textarea></div>';back.closest('.field').after(b);const syncBack=()=>{back.value=[$('#backTitleExtra').value,$('#backBodyExtra').value].filter(Boolean).join('\n\n');dispatch(back)};['backTitleExtra','backBodyExtra'].forEach(id=>$('#'+id).addEventListener('input',syncBack))}
    if(spine){const s=document.createElement('div');s.innerHTML='<div class="grid3"><div class="field"><label>책등 상단</label><input id="spineTop" type="text" placeholder="연도"></div><div class="field"><label>책등 중앙</label><input id="spineCenter" type="text" placeholder="제목"></div><div class="field"><label>책등 하단</label><input id="spineBottom" type="text" placeholder="기관명"></div></div>';spine.closest('.field').after(s);spine.closest('.field').style.display='none';const syncSpine=()=>{spine.value=[$('#spineTop').value,$('#spineCenter').value,$('#spineBottom').value].filter(Boolean).join('  ·  ');dispatch(spine)};['spineTop','spineCenter','spineBottom'].forEach(id=>$('#'+id).addEventListener('input',syncSpine))}
    const canvas=$('#previewCanvas');if(canvas){canvas.addEventListener('wheel',e=>{const active=$('#editTarget')?.value||'';const text=/(Title|Subtitle|publisher|backText|spine)/i.test(active);if(!text)return;e.preventDefault();const input=/spine/i.test(active)?$('#spineTextSize'):$('#titleSize');if(!input)return;input.value=Math.max(Number(input.min||5),Math.min(Number(input.max||100),Number(input.value||12)+(e.deltaY<0?1:-1)));dispatch(input)},{passive:false});ProgramContextMenu.bind(canvas,()=>({groups:[{label:'선택 요소',items:[{label:'가운데 정렬',action:()=>$('#centerTargetBtn')?.click()},{label:'선택 초기화',action:()=>$('#resetTargetBtn')?.click()},{label:'한 단계 확대',action:()=>{const i=$('#itemScale');if(i){i.value=Math.min(Number(i.max),Number(i.value)+5);dispatch(i)}}},{label:'한 단계 축소',action:()=>{const i=$('#itemScale');if(i){i.value=Math.max(Number(i.min),Number(i.value)-5);dispatch(i)}}}]},{label:'전체',items:[{label:'가이드 켜기',action:()=>$('#guideOnBtn')?.click()},{label:'완성본 보기',action:()=>$('#guideOffBtn')?.click()},{label:'전체 배치 초기화',className:'danger',action:()=>$('#resetAllLayoutBtn')?.click()}]}]}))}
  }
  function addPdfEditorMenu(){if(!location.pathname.includes('pdf-editor'))return;const canvas=$('canvas');if(canvas)ProgramContextMenu.bind(canvas,()=>({groups:[{label:'페이지 편집',items:[{label:'미리보기 다시 그리기',action:()=>window.renderPreview?.()},{label:'선택 페이지 초기화',action:()=>window.location.reload()}]}]}));
    $$('input[type=color]').forEach(el=>{const label=(el.closest('.field')?.textContent||'').toLowerCase();if(label.includes('간지')||el.id.toLowerCase().includes('divider')){el.value='#ffffff';el.dataset.transparent='true'}})
  }
  function addPdfToolMenu(){
    if(!location.pathname.includes('pdf-preflight'))return;
    const zone=$('.upload-zone');
    if(zone)ProgramContextMenu.bind(zone,()=>({groups:[{label:'파일',items:[{label:'PDF 파일 선택',action:()=>$('#fileInput')?.click()},{label:'선택 초기화',className:'danger',action:()=>$('#inlineResetBtn')?.click()}]},{label:'도구',items:[...$$('.action-btn').map(btn=>({label:btn.querySelector('.action-name')?.textContent||btn.textContent.trim(),disabled:btn.disabled,action:()=>btn.click()}))]}]}))
  }

  function enhancePdfPreflight(){
    if(!location.pathname.includes('pdf-preflight'))return;
    const overlay=$('#toolModalOverlay'),body=$('#toolModalBody'),status=$('#toolStatus'),runBtn=$('#toolRunBtn');
    if(!overlay||!body||!status||!runBtn)return;
    const actionButtons=['#checkBtn','#encryptBtn','#decryptBtn'].map($).filter(Boolean);
    let activeTool='';
    let layerBusy=false;

    if(!$('#pdfPreflightLayerV3Styles')){
      const style=document.createElement('style');
      style.id='pdfPreflightLayerV3Styles';
      style.textContent=`
        .tool-modal-overlay{padding:18px!important;align-items:stretch!important;justify-content:center!important;background:rgba(15,23,42,.66)!important;backdrop-filter:blur(8px)!important}
        .tool-modal-box{width:min(1180px,100%)!important;height:min(860px,calc(100vh - 36px))!important;max-height:none!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;border:1px solid rgba(203,213,225,.82)!important;border-radius:24px!important;padding:0!important;box-shadow:0 34px 100px rgba(15,23,42,.38)!important}
        .tool-modal-head{flex:0 0 auto!important;padding:25px 30px 10px!important;margin:0!important}
        .tool-modal-title{font-size:23px!important;letter-spacing:-.55px!important}.tool-modal-close{width:40px!important;height:40px!important;border-radius:12px!important}
        .tool-modal-desc{flex:0 0 auto!important;padding:0 30px 22px!important;margin:0!important;border-bottom:1px solid #e7edf4!important;font-size:13px!important;line-height:1.65!important}
        #toolModalBody{flex:1!important;min-height:0!important;overflow:auto!important;padding:24px 30px!important;display:flex!important;flex-direction:column!important;background:#fff!important}
        .tool-modal-status{flex:0 0 auto!important;min-height:104px!important;margin:0 30px 18px!important;padding:16px 18px!important;border:1px solid #e1e8f0!important;border-radius:14px!important;background:#f8fafc!important;color:#526176!important;font-size:13px!important;font-weight:850!important;line-height:1.65!important}
        .tool-modal-status:empty::before{content:'작업 현황이 여기에 표시됩니다.';color:#94a3b8;font-weight:750}
        .tool-modal-footer{flex:0 0 auto!important;position:static!important;margin:0!important;padding:18px 30px 22px!important;border-top:1px solid #e7edf4!important;background:#fff!important}
        .tm-cancel-btn,.tm-run-btn{min-width:132px!important;min-height:46px!important;border-radius:12px!important;font-size:13px!important}
        .ps-modal-upload{flex:1;min-height:390px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border:2px dashed #a8bfd9;border-radius:20px;background:linear-gradient(180deg,#fbfdff,#f5f9fd);padding:36px;cursor:pointer;transition:.16s}
        .ps-modal-upload:hover,.ps-modal-upload.dragover{border-color:#1d9bb2;background:#f2fbfd}
        .ps-modal-upload input{display:none}.ps-modal-upload-icon{width:72px;height:72px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,#dbeafe,#cffafe);font-size:32px;margin-bottom:17px}.ps-modal-upload strong{font-size:18px;color:#0f172a}.ps-modal-upload span{margin-top:8px;font-size:12px;line-height:1.6;color:#64748b}
        .ps-modal-work{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);gap:18px;min-height:100%}
        .ps-modal-file-card,.ps-modal-control{border:1px solid #e0e7ef;border-radius:18px;background:#fbfcfe;padding:22px}.ps-modal-file-card{display:flex;flex-direction:column;justify-content:center;min-height:300px}.ps-modal-file-icon{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;background:#e8f3ff;color:#1769e0;font-size:24px;margin-bottom:16px}.ps-modal-file-card h3{font-size:17px;letter-spacing:-.35px}.ps-modal-file-name{margin-top:9px;font-size:13px;font-weight:900;color:#334155;word-break:break-all}.ps-modal-file-meta{margin-top:5px;font-size:11px;color:#7c899a}.ps-modal-file-help{margin-top:18px;padding-top:15px;border-top:1px solid #e4eaf1;font-size:11px;line-height:1.65;color:#64748b}
        .ps-modal-control{background:#fff}.ps-modal-control-title{font-size:13px;font-weight:950;color:#334155;margin-bottom:14px}.ps-modal-control .tool-field-label{font-size:12px!important;margin:0 0 7px!important}.ps-modal-control .tool-input{min-height:48px!important;margin-bottom:15px!important;font-size:14px!important}.ps-modal-control .tool-help{margin-top:2px!important;font-size:11px!important;line-height:1.6!important}.ps-modal-ready{margin-top:15px;padding:12px 13px;border-radius:11px;background:#eef8f4;color:#147451;font-size:11px;font-weight:850;line-height:1.55}
        @media(max-width:760px){.tool-modal-overlay{padding:8px!important}.tool-modal-box{height:calc(100vh - 16px)!important;border-radius:20px!important}.tool-modal-head{padding:20px 18px 8px!important}.tool-modal-title{font-size:20px!important}.tool-modal-desc{padding:0 18px 17px!important}#toolModalBody{padding:18px!important}.tool-modal-status{min-height:86px!important;margin:0 18px 14px!important;padding:13px 14px!important}.tool-modal-footer{padding:14px 18px 18px!important}.tm-cancel-btn,.tm-run-btn{flex:1!important;min-width:0!important}.ps-modal-upload{min-height:280px;padding:26px 18px}.ps-modal-work{grid-template-columns:1fr;min-height:auto}.ps-modal-file-card{min-height:210px}.ps-modal-control{padding:18px}}
      `;
      document.head.appendChild(style);
    }

    const fileSize=file=>file?`${(Number(file.size||0)/1024/1024).toFixed(1)}MB`:'';
    const esc=value=>String(value??'').replace(/[<>&"']/g,ch=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[ch]));
    const currentFile=()=>window.selectedFile||null;
    const setLayerStatus=(message,type='info')=>{status.textContent=message||'';status.style.color=type==='ok'?'#15803d':type==='err'?'#dc2626':'#526176';status.style.background=type==='ok'?'#f4fbf7':type==='err'?'#fff7f7':'#f8fafc';status.style.borderColor=type==='ok'?'#cfe8da':type==='err'?'#f0d0d4':'#e1e8f0'};
    const uploadMarkup=()=>`<label class="ps-modal-upload" id="psModalUpload" for="psModalFileInput"><span class="ps-modal-upload-icon">📂</span><strong>PDF 파일을 올려주세요</strong><span>클릭하거나 파일을 끌어다 놓으세요.<br>문서 검수 최대 200MB · 암호 기능 최대 20MB</span><input id="psModalFileInput" type="file" accept=".pdf,application/pdf"></label>`;
    const fileCard=file=>`<div class="ps-modal-file-card"><div class="ps-modal-file-icon">PDF</div><h3>선택한 PDF</h3><div class="ps-modal-file-name">${esc(file?.name||'')}</div><div class="ps-modal-file-meta">${fileSize(file)}</div><div class="ps-modal-file-help">이 파일을 기준으로 현재 작업을 실행합니다. 다른 파일을 사용하려면 작업창을 닫고 다시 선택하거나 아래 파일 변경 영역을 이용하세요.</div></div>`;
    const changeFileMarkup=()=>`<label class="tool-help" for="psModalFileInput" style="display:block;cursor:pointer;text-align:center;margin-top:14px!important">다른 PDF 선택<input id="psModalFileInput" type="file" accept=".pdf,application/pdf" style="display:none"></label>`;

    const definitions={
      check:{title:'PDF 문서 검수',desc:'업로드부터 검사 진행 상황과 결과 확인까지 하나의 큰 작업창에서 진행합니다.',runLabel:'검수 시작'},
      encrypt:{title:'PDF 암호 설정',desc:'PDF를 업로드하고 새 비밀번호를 설정해 보호된 파일로 저장합니다.',runLabel:'암호 설정'},
      decrypt:{title:'PDF 암호 해제',desc:'PDF를 업로드하고 자동 해제를 먼저 시도합니다. 필요한 경우 현재 비밀번호를 입력할 수 있습니다.',runLabel:'암호 해제'}
    };

    function renderLayer(){
      const def=definitions[activeTool];if(!def)return;
      const file=currentFile();
      $('#toolModalTitle').textContent=def.title;
      $('#toolModalDesc').textContent=def.desc;
      runBtn.textContent=def.runLabel;
      runBtn.disabled=layerBusy||!file;
      if(!file){body.innerHTML=uploadMarkup();bindModalPicker();return}
      let controls='';
      if(activeTool==='check')controls='<div class="ps-modal-control"><div class="ps-modal-control-title">작업 준비</div><div class="tool-help">해상도·폰트·색상 모드·페이지 규격 등 인쇄 전 주요 항목을 검사합니다.</div><div class="ps-modal-ready">PDF가 준비되었습니다. 아래 “검수 시작”을 누르면 진행 상황이 작업 현황에 표시됩니다.</div>'+changeFileMarkup()+'</div>';
      else if(activeTool==='encrypt')controls='<div class="ps-modal-control"><div class="ps-modal-control-title">암호 설정</div><label class="tool-field-label">새 비밀번호</label><input type="password" id="psModalPw" class="tool-input" maxlength="32" placeholder="4~32자"><label class="tool-field-label">비밀번호 확인</label><input type="password" id="psModalPw2" class="tool-input" maxlength="32" placeholder="한 번 더 입력"><div class="tool-help">비밀번호를 잊으면 문서를 열기 어려울 수 있으니 별도로 보관하세요.</div>'+changeFileMarkup()+'</div>';
      else controls='<div class="ps-modal-control"><div class="ps-modal-control-title">암호 해제</div><label class="tool-field-label">현재 비밀번호</label><input type="password" id="psModalPw" class="tool-input" placeholder="모르면 비워두고 자동 해제 시도"><div class="tool-help">비밀번호를 비워두면 자동 해제를 먼저 시도합니다. 실패하면 현재 비밀번호를 입력한 뒤 다시 실행하세요.</div>'+changeFileMarkup()+'</div>';
      body.innerHTML=`<div class="ps-modal-work">${fileCard(file)}${controls}</div>`;
      bindModalPicker();
    }

    function acceptModalFile(file){
      if(!file)return;
      if(!/\.pdf$/i.test(file.name||'')&&file.type!=='application/pdf'){setLayerStatus('PDF 파일만 선택할 수 있습니다.','err');return}
      if(Number(file.size||0)>200*1024*1024){setLayerStatus('문서 검수 파일은 최대 200MB까지 지원합니다.','err');return}
      if(typeof window.selectFile==='function')window.selectFile(file);
      else window.selectedFile=file;
      renderLayer();
      if((activeTool==='encrypt'||activeTool==='decrypt')&&Number(file.size||0)>20*1024*1024)setLayerStatus('암호 설정·해제는 20MB 이하 PDF만 지원합니다.','err');
      else setLayerStatus('PDF 파일 선택 완료 · 작업을 실행할 수 있습니다.','ok');
    }

    function bindModalPicker(){
      const input=$('#psModalFileInput'),drop=$('#psModalUpload');
      if(input){input.addEventListener('change',()=>acceptModalFile(input.files?.[0]||null),{once:true})}
      if(drop){
        ['dragenter','dragover'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.add('dragover')}));
        ['dragleave','drop'].forEach(type=>drop.addEventListener(type,event=>{event.preventDefault();drop.classList.remove('dragover')}));
        drop.addEventListener('drop',event=>acceptModalFile(Array.from(event.dataTransfer?.files||[]).find(file=>/\.pdf$/i.test(file.name||'')||file.type==='application/pdf')||null));
      }
    }

    function openEnhancedTool(tool){
      if(layerBusy||!definitions[tool])return;
      activeTool=tool;
      renderLayer();
      setLayerStatus(currentFile()?'PDF 파일이 준비되었습니다. 작업을 실행하세요.':'PDF 파일을 먼저 선택하세요.');
      overlay.classList.add('open');
      document.body.style.overflow='hidden';
      requestAnimationFrame(()=>currentFile()?$('#psModalPw')?.focus():$('#psModalUpload')?.focus());
    }

    function closeEnhancedTool(force=false){
      if(layerBusy&&!force)return;
      overlay.classList.remove('open');
      document.body.style.overflow='';
      activeTool='';
      body.innerHTML='';
      setLayerStatus('');
      runBtn.textContent='실행';
      actionButtons.forEach(button=>button.disabled=false);
    }

    async function runEnhancedTool(){
      if(layerBusy||!activeTool)return;
      const file=currentFile();
      if(!file){setLayerStatus('먼저 PDF 파일을 선택하세요.','err');return}
      if((activeTool==='encrypt'||activeTool==='decrypt')&&Number(file.size||0)>20*1024*1024){setLayerStatus('암호 설정·해제는 20MB 이하 PDF만 지원합니다.','err');return}
      layerBusy=true;runBtn.disabled=true;actionButtons.forEach(button=>button.disabled=true);
      if(typeof window.setPageBusy==='function')window.setPageBusy(true,activeTool==='check'?'검수 중':'PDF 처리 중');
      const started=Date.now();
      try{
        if(activeTool==='check'){
          setLayerStatus('PDF 구조를 읽고 문서 검수를 시작합니다...');
          const report=await window.apiPreflightCheck(file,{onStatus:message=>message&&setLayerStatus(message)});
          if(typeof window.renderResults==='function')window.renderResults(report);
          setLayerStatus(`검수 완료 · ${Math.max(1,Math.round((Date.now()-started)/1000))}초 · 작업창을 닫으면 상세 결과를 확인할 수 있습니다.`,'ok');
        }else if(activeTool==='encrypt'){
          const pw=$('#psModalPw')?.value.trim()||'',pw2=$('#psModalPw2')?.value.trim()||'';
          if(pw.length<4)throw new Error('비밀번호는 4자 이상 입력하세요.');
          if(pw!==pw2)throw new Error('비밀번호 확인이 일치하지 않습니다.');
          setLayerStatus('새 비밀번호를 적용해 보호 PDF를 만드는 중입니다...');
          const {blob}=await window.apiPdfTool('encrypt',file,{password:pw});
          window.downloadBlob(blob,`${window.safeBaseName(file)}_암호설정.pdf`);
          setLayerStatus(`암호 설정 완료 · ${Math.max(1,Math.round((Date.now()-started)/1000))}초 · 파일을 다운로드했습니다.`,'ok');
        }else{
          const pw=$('#psModalPw')?.value||'';
          setLayerStatus(pw?'입력한 비밀번호를 확인하고 암호를 해제하는 중입니다...':'비밀번호 없이 자동 암호 해제를 시도합니다...');
          const {blob}=await window.apiPdfTool('decrypt',file,{password:pw});
          window.downloadBlob(blob,`${window.safeBaseName(file)}_암호해제.pdf`);
          setLayerStatus(`암호 해제 완료 · ${Math.max(1,Math.round((Date.now()-started)/1000))}초 · 파일을 다운로드했습니다.`,'ok');
        }
        runBtn.textContent=activeTool==='check'?'다시 검수':'다시 실행';
      }catch(error){
        const message=error?.message||'처리 중 오류가 발생했습니다.';
        setLayerStatus(!$('#psModalPw')?.value&&activeTool==='decrypt'&&/비밀번호|암호|password|403/i.test(message)?'자동 해제가 되지 않았습니다. 현재 비밀번호를 입력한 뒤 다시 실행하세요.':message,'err');
      }finally{
        layerBusy=false;
        if(typeof window.setPageBusy==='function')window.setPageBusy(false);
        runBtn.disabled=false;
        actionButtons.forEach(button=>button.disabled=false);
      }
    }

    window.openTool=openEnhancedTool;
    window.closeTool=closeEnhancedTool;
    window.runTool=runEnhancedTool;
    const originalReset=window.resetAll;
    if(typeof originalReset==='function')window.resetAll=function(){originalReset();setTimeout(()=>actionButtons.forEach(button=>button.disabled=false),0)};
    const handlers={checkBtn:'check',encryptBtn:'encrypt',decryptBtn:'decrypt'};
    Object.entries(handlers).forEach(([id,tool])=>{const button=document.getElementById(id);if(button){button.disabled=false;button.onclick=()=>openEnhancedTool(tool)}});
    const observer=new MutationObserver(()=>{if(!layerBusy)actionButtons.forEach(button=>{if(button.disabled)button.disabled=false})});
    actionButtons.forEach(button=>observer.observe(button,{attributes:true,attributeFilter:['disabled']}));
  }

  document.addEventListener('DOMContentLoaded',()=>{enhancePdfPreflight();bindFormMenus();addCoverFields();addPdfEditorMenu();addPdfToolMenu()});
})();