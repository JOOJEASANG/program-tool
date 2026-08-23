(function(root){
  'use strict';
  if(root.DocumentEditorUsability)return;

  const ZOOM_KEY='programStudio.documentEditor.zoom.stage3';
  const ZOOM_LEVELS=[75,90,100,110,125,150];
  const TEMPLATES=Object.freeze({
    meeting:{
      label:'회의록',title:'회의록',
      html:'<h1>회의록</h1><p><b>일시</b>: </p><p><b>장소</b>: </p><p><b>참석자</b>: </p><h2>회의 안건</h2><ol><li>안건을 입력하세요.</li></ol><h2>논의 내용</h2><p>주요 논의 내용을 입력하세요.</p><h2>결정 및 후속 일정</h2><table><tbody><tr><th>항목</th><th>담당</th><th>기한</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p>',
      page:{orientation:'portrait',margin:'normal'}
    },
    weekly:{
      label:'주간 업무보고',title:'주간 업무보고',
      html:'<h1>주간 업무보고</h1><p><b>작성일</b>: </p><p><b>작성자</b>: </p><h2>이번 주 주요 업무</h2><table><tbody><tr><th>업무</th><th>진행 상태</th><th>비고</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>다음 주 계획</h2><ul><li>계획을 입력하세요.</li></ul><h2>공유·요청 사항</h2><p><br></p>',
      page:{orientation:'portrait',margin:'normal'}
    },
    notice:{
      label:'안내문',title:'안내문',
      html:'<h1 style="text-align:center">안내문</h1><p><br></p><p>안녕하세요.</p><p>안내할 내용을 입력하세요.</p><h2>주요 내용</h2><ul><li>일시: </li><li>장소: </li><li>대상: </li></ul><p><br></p><p>감사합니다.</p>',
      page:{orientation:'portrait',margin:'normal'}
    }
  });
  let currentZoom=100;

  const $=id=>document.getElementById(id);
  const core=()=>root.DocumentEditorApp;
  const workflow=()=>root.DocumentEditorWorkflow;
  const page=()=>$('documentPage');

  function normalizeZoom(value){
    const requested=Math.round(Number(value)||100);
    return ZOOM_LEVELS.reduce((best,item)=>Math.abs(item-requested)<Math.abs(best-requested)?item:best,100);
  }
  function setNote(message,tone=''){
    const node=$('usabilityState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function setMainStatus(message,tone='ok'){
    const node=$('statusText');if(node){node.textContent=message;node.dataset.tone=tone;}
  }
  function saveZoom(){try{localStorage.setItem(ZOOM_KEY,String(currentZoom));return true}catch(_){return false}}
  function readZoom(){try{return normalizeZoom(localStorage.getItem(ZOOM_KEY)||100)}catch(_){return 100}}
  function applyZoom(value,options={}){
    currentZoom=normalizeZoom(value);
    const node=page();
    if(node){node.dataset.zoom=String(currentZoom);node.style.zoom=String(currentZoom/100);}
    if($('documentZoom'))$('documentZoom').value=String(currentZoom);
    setNote(`화면 확대 ${currentZoom}% · 인쇄 크기는 그대로 유지됩니다.`,'ok');
    if(options.save!==false)saveZoom();
    return currentZoom;
  }
  function hasMeaningfulContent(){
    const state=core()?.getState?.()||{};
    return Boolean(String(state.text||'').trim()||page()?.querySelector('table,img'));
  }
  function applyTemplate(key,options={}){
    const template=TEMPLATES[String(key||'')];
    if(!template){setNote('사용할 문서 양식을 선택해주세요.','warn');return false;}
    if(!options.force&&hasMeaningfulContent()&&!root.confirm(`현재 내용을 지우고 “${template.label}” 양식을 시작할까요?`))return false;
    if($('documentTitle'))$('documentTitle').value=template.title;
    core()?.setContent?.(template.html,{save:false});
    workflow()?.applyPageSettings?.(template.page,{save:true});
    core()?.updateCounts?.();core()?.saveDraft?.();
    setNote(`“${template.label}” 양식을 적용했습니다.`,'ok');setMainStatus(`${template.label} 양식으로 새 문서를 시작했습니다.`);
    page()?.focus();
    return{key:String(key),title:template.title,label:template.label};
  }
  function selectionRangeInsidePage(){
    const node=page(),selection=root.getSelection?.();if(!node||!selection)return null;
    if(selection.rangeCount){
      const range=selection.getRangeAt(0),container=range.commonAncestorContainer.nodeType===3?range.commonAncestorContainer.parentNode:range.commonAncestorContainer;
      if(container&&node.contains(container))return range;
    }
    node.focus();const range=document.createRange();range.selectNodeContents(node);range.collapse(false);selection.removeAllRanges();selection.addRange(range);return range;
  }
  function insertSanitizedHtml(html){
    const node=page(),range=selectionRangeInsidePage();if(!node||!range)return false;
    range.deleteContents();const fragment=range.createContextualFragment(String(html||'')),tail=fragment.lastChild;range.insertNode(fragment);
    if(tail){range.setStartAfter(tail);range.collapse(true);const selection=root.getSelection?.();selection?.removeAllRanges();selection?.addRange(range);}
    core()?.updateCounts?.();core()?.saveDraft?.();return true;
  }
  function handlePaste(event){
    const node=page(),target=event?.target;if(!node||!target||!(target===node||node.contains(target)))return false;
    const clipboard=event.clipboardData;if(!clipboard||typeof clipboard.getData!=='function')return false;
    const html=clipboard.getData('text/html');if(!html)return false;
    const sanitizer=workflow()?.sanitizeDocumentHtml;if(typeof sanitizer!=='function')return false;
    const safe=sanitizer(html);event.preventDefault?.();
    const inserted=insertSanitizedHtml(safe);
    if(inserted){setNote('외부 서식의 위험 요소를 제거하고 붙여넣었습니다.','ok');setMainStatus('안전하게 정리한 내용을 붙여넣었습니다.');}
    return inserted;
  }
  function bind(){
    $('documentZoom')?.addEventListener('change',event=>applyZoom(event.target.value));
    $('applyTemplateBtn')?.addEventListener('click',()=>applyTemplate($('documentTemplate')?.value));
    page()?.addEventListener('paste',handlePaste);
  }
  function boot(){
    if(!core()||!workflow())return;
    currentZoom=readZoom();applyZoom(currentZoom,{save:false});bind();document.documentElement.dataset.documentEditorUsabilityReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorUsability={
    applyZoom,getZoom:()=>currentZoom,applyTemplate,handlePaste,insertSanitizedHtml,
    templates:()=>Object.fromEntries(Object.entries(TEMPLATES).map(([key,value])=>[key,{label:value.label,title:value.title}])),
    constants:{zoomKey:ZOOM_KEY,zoomLevels:[...ZOOM_LEVELS]},
    stage:'document-editor-usability-stage3'
  };
})(window);
