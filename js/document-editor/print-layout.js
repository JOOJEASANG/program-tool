(function(root){
  'use strict';
  if(root.DocumentEditorPrintLayout)return;

  const SETTINGS_KEY='programStudio.documentEditor.printLayout.stage5';
  const DEFAULTS={header:'',footer:'',headerEnabled:false,footerEnabled:false};
  let settings={...DEFAULTS};

  const $=id=>document.getElementById(id);
  const core=()=>root.DocumentEditorApp;
  const page=()=>$('documentPage');
  const cleanText=(value,max=120)=>String(value==null?'':value).replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ').trim().slice(0,max);

  function normalizedSettings(value={}){
    return{
      header:cleanText(value.header),
      footer:cleanText(value.footer),
      headerEnabled:Boolean(value.headerEnabled),
      footerEnabled:Boolean(value.footerEnabled)
    };
  }
  function saveSettings(){
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));return true}catch(_){return false}
  }
  function readSettings(){
    try{return normalizedSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(_){return{...DEFAULTS}}
  }
  function setNote(message,tone=''){
    const node=$('printLayoutState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function setMainStatus(message,tone='ok'){
    const node=$('statusText');if(node){node.textContent=message;node.dataset.tone=tone;}
  }
  function applySettings(next={},options={}){
    settings=normalizedSettings({...settings,...next});
    if($('printHeaderText'))$('printHeaderText').value=settings.header;
    if($('printFooterText'))$('printFooterText').value=settings.footer;
    if($('printHeaderEnabled'))$('printHeaderEnabled').checked=settings.headerEnabled;
    if($('printFooterEnabled'))$('printFooterEnabled').checked=settings.footerEnabled;

    const header=$('documentPrintHeader'),footer=$('documentPrintFooter'),node=page();
    if(header){header.textContent=settings.header;header.dataset.active=String(settings.headerEnabled&&Boolean(settings.header));}
    if(footer){footer.textContent=settings.footer;footer.dataset.active=String(settings.footerEnabled&&Boolean(settings.footer));}
    if(node){node.dataset.printHeader=String(settings.headerEnabled&&Boolean(settings.header));node.dataset.printFooter=String(settings.footerEnabled&&Boolean(settings.footer));}

    if(options.save!==false)saveSettings();
    const active=[];if(settings.headerEnabled&&settings.header)active.push('머리말');if(settings.footerEnabled&&settings.footer)active.push('꼬리말');
    setNote(active.length?`${active.join(' · ')}을(를) 인쇄에 적용합니다.`:'인쇄 머리말·꼬리말을 사용하지 않습니다.','ok');
    return{...settings};
  }
  function selectionRange(){
    const node=page(),selection=root.getSelection?.();if(!node)return null;
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0),container=range.commonAncestorContainer.nodeType===3?range.commonAncestorContainer.parentNode:range.commonAncestorContainer;
      if(container&&node.contains(container))return range;
    }
    const range=document.createRange();range.selectNodeContents(node);range.collapse(false);return range;
  }
  function refreshPageBreaks(){
    page()?.querySelectorAll('[data-document-page-break="true"]').forEach(marker=>{
      marker.setAttribute('contenteditable','false');
      marker.setAttribute('aria-label','페이지 나누기');
      if(!marker.firstChild)marker.appendChild(document.createElement('br'));
    });
    return page()?.querySelectorAll('[data-document-page-break="true"]').length||0;
  }
  function insertPageBreak(){
    const node=page(),range=selectionRange();if(!node||!range)return false;
    const marker=document.createElement('div');marker.dataset.documentPageBreak='true';marker.setAttribute('contenteditable','false');marker.setAttribute('aria-label','페이지 나누기');marker.appendChild(document.createElement('br'));
    const next=document.createElement('p');next.appendChild(document.createElement('br'));
    try{
      range.deleteContents();range.insertNode(next);range.insertNode(marker);
      const selection=root.getSelection?.(),caret=document.createRange();caret.selectNodeContents(next);caret.collapse(true);selection?.removeAllRanges();selection?.addRange(caret);next.scrollIntoView?.({block:'center'});
      core()?.updateCounts?.();core()?.saveDraft?.();setMainStatus('현재 위치에 페이지 나누기를 넣었습니다.');setNote(`페이지 나누기 ${refreshPageBreaks()}개가 문서에 있습니다.`,'ok');return true;
    }catch(error){setNote('페이지 나누기를 넣지 못했습니다.','warn');return false;}
  }
  function removeAllPageBreaks(){
    const markers=[...(page()?.querySelectorAll('[data-document-page-break="true"]')||[])];
    markers.forEach(marker=>marker.remove());
    if(markers.length){core()?.updateCounts?.();core()?.saveDraft?.();setMainStatus(`페이지 나누기 ${markers.length}개를 삭제했습니다.`);}
    setNote(markers.length?'페이지 나누기를 모두 삭제했습니다.':'삭제할 페이지 나누기가 없습니다.',markers.length?'ok':'warn');return markers.length;
  }
  function bind(){
    $('insertPageBreakBtn')?.addEventListener('click',insertPageBreak);
    $('removePageBreaksBtn')?.addEventListener('click',removeAllPageBreaks);
    $('printHeaderText')?.addEventListener('input',event=>applySettings({header:event.target.value}));
    $('printFooterText')?.addEventListener('input',event=>applySettings({footer:event.target.value}));
    $('printHeaderEnabled')?.addEventListener('change',event=>applySettings({headerEnabled:event.target.checked}));
    $('printFooterEnabled')?.addEventListener('change',event=>applySettings({footerEnabled:event.target.checked}));
  }
  function boot(){
    if(!core())return;
    settings=readSettings();applySettings(settings,{save:false});refreshPageBreaks();bind();document.documentElement.dataset.documentEditorPrintLayoutReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorPrintLayout={
    applySettings,getSettings:()=>({...settings}),insertPageBreak,removeAllPageBreaks,refreshPageBreaks,
    constants:{settingsKey:SETTINGS_KEY},
    stage:'document-editor-print-layout-stage5'
  };
})(window);
