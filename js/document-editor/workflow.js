(function(root){
  'use strict';
  if(root.DocumentEditorWorkflow)return;

  const SETTINGS_KEY='programStudio.documentEditor.pageSettings.stage2';
  const PROJECT_FORMAT='program-studio-document-project';
  const PROJECT_VERSION=2;
  const MAX_PROJECT_BYTES=5_000_000;
  const PAGE_PRESETS={
    orientation:{portrait:{label:'세로',width:210,height:297},landscape:{label:'가로',width:297,height:210}},
    margin:{normal:{label:'보통',x:18,y:20},narrow:{label:'좁게',x:12,y:14},wide:{label:'넓게',x:25,y:25}}
  };
  let pageSettings={orientation:'portrait',margin:'normal'};

  const $=id=>document.getElementById(id);
  const core=()=>root.DocumentEditorApp;
  const page=()=>$('documentPage');
  const escapeRegExp=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function setWorkflowNote(id,message,tone=''){
    const node=$(id);if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function setMainStatus(message,tone='ok'){
    const node=$('statusText');if(node){node.textContent=message;node.dataset.tone=tone;}
  }
  function validOrientation(value){return Object.prototype.hasOwnProperty.call(PAGE_PRESETS.orientation,value)?value:'portrait';}
  function validMargin(value){return Object.prototype.hasOwnProperty.call(PAGE_PRESETS.margin,value)?value:'normal';}
  function normalizedPageSettings(value={}){
    return{orientation:validOrientation(value.orientation),margin:validMargin(value.margin)};
  }
  function savePageSettings(){
    try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(pageSettings));return true}catch(_){return false}
  }
  function readPageSettings(){
    try{return normalizedPageSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'))}catch(_){return normalizedPageSettings()}
  }
  function applyPageSettings(next={},options={}){
    pageSettings=normalizedPageSettings({...pageSettings,...next});
    const orientation=PAGE_PRESETS.orientation[pageSettings.orientation],margin=PAGE_PRESETS.margin[pageSettings.margin],node=page();
    if(node){
      node.dataset.orientation=pageSettings.orientation;
      node.style.setProperty('--document-page-width',orientation.width+'mm');
      node.style.setProperty('--document-page-height',orientation.height+'mm');
      node.style.setProperty('--document-margin-x',margin.x+'mm');
      node.style.setProperty('--document-margin-y',margin.y+'mm');
    }
    if($('pageOrientation'))$('pageOrientation').value=pageSettings.orientation;
    if($('pageMargin'))$('pageMargin').value=pageSettings.margin;
    if($('pageMeta'))$('pageMeta').textContent=`A4 ${orientation.label}`;
    setWorkflowNote('pageSetupState',`A4 ${orientation.label} · ${margin.label} 여백`,'ok');
    let printStyle=$('documentPagePrintStyle');
    if(!printStyle){printStyle=document.createElement('style');printStyle.id='documentPagePrintStyle';document.head.appendChild(printStyle);}
    printStyle.textContent=`@media print{@page{size:A4 ${pageSettings.orientation};margin:0}}`;
    if(options.save!==false)savePageSettings();
    return{...pageSettings,width:orientation.width,height:orientation.height,marginX:margin.x,marginY:margin.y};
  }
  function textNodes(){
    const result=[],node=page();if(!node)return result;
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT,{acceptNode(text){return text.nodeValue?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT}});
    let current;while((current=walker.nextNode()))result.push(current);return result;
  }
  function countMatches(text,query){
    if(!query)return 0;
    const pattern=new RegExp(escapeRegExp(query),'gi');return (String(text).match(pattern)||[]).length;
  }
  function findText(query){
    query=String(query||'').trim();if(!query){setWorkflowNote('findState','찾을 내용을 입력해주세요.','warn');return{count:0,found:false};}
    const nodes=textNodes();let total=0,first=null,firstIndex=-1;
    for(const node of nodes){
      const value=node.nodeValue||'',lower=value.toLocaleLowerCase(),needle=query.toLocaleLowerCase(),count=countMatches(value,query);total+=count;
      if(first==null){const index=lower.indexOf(needle);if(index>=0){first=node;firstIndex=index;}}
    }
    if(first){
      const range=document.createRange();range.setStart(first,firstIndex);range.setEnd(first,firstIndex+query.length);
      const selection=root.getSelection?.();selection?.removeAllRanges();selection?.addRange(range);
      first.parentElement?.scrollIntoView?.({block:'center',behavior:'smooth'});
    }
    setWorkflowNote('findState',total?`“${query}” ${total}개를 찾았습니다.`:`“${query}”을(를) 찾지 못했습니다.`,total?'ok':'warn');
    return{count:total,found:Boolean(first)};
  }
  function replaceAllText(query,replacement=''){
    query=String(query||'').trim();replacement=String(replacement??'');
    if(!query){setWorkflowNote('findState','찾을 내용을 입력해주세요.','warn');return 0;}
    const pattern=new RegExp(escapeRegExp(query),'gi');let replaced=0;
    for(const node of textNodes()){
      const value=node.nodeValue||'',matches=value.match(pattern);if(!matches?.length)continue;
      replaced+=matches.length;node.nodeValue=value.replace(pattern,replacement);
    }
    if(replaced){core()?.updateCounts?.();core()?.saveDraft?.();setMainStatus(`${replaced}곳의 텍스트를 바꿨습니다.`);}
    setWorkflowNote('findState',replaced?`${replaced}곳을 “${replacement}”으로 바꿨습니다.`:`“${query}”을(를) 찾지 못했습니다.`,replaced?'ok':'warn');
    return replaced;
  }
  function sanitizeDocumentHtml(html){
    const template=document.createElement('template');template.innerHTML=String(html||'');
    template.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form,svg,math,video,audio,source,canvas').forEach(node=>node.remove());
    const allowed=new Set(['P','DIV','BR','H1','H2','H3','SPAN','B','STRONG','I','EM','U','FONT','A','UL','OL','LI','TABLE','TBODY','THEAD','TFOOT','TR','TD','TH','IMG','BLOCKQUOTE','HR','SUP','SUB']);
    const allowedAttrs=new Set(['style','color','face','size','href','target','rel','colspan','rowspan','alt','src','width','height']);
    [...template.content.querySelectorAll('*')].forEach(node=>{
      if(!allowed.has(node.tagName)){node.replaceWith(...node.childNodes);return;}
      [...node.attributes].forEach(attr=>{if(!allowedAttrs.has(attr.name.toLowerCase()))node.removeAttribute(attr.name);});
      if(node.hasAttribute('style')&&/(?:url\s*\(|expression\s*\(|@import)/i.test(node.getAttribute('style')||''))node.removeAttribute('style');
      if(node.tagName==='A'){
        const href=(node.getAttribute('href')||'').trim();
        if(!/^(?:https?:\/\/|mailto:)/i.test(href)){node.replaceWith(...node.childNodes);return;}
        const target=node.getAttribute('target');
        if(target&&target!=='_blank'&&target!=='_self')node.removeAttribute('target');
        if(node.getAttribute('target')==='_blank')node.setAttribute('rel','noopener noreferrer');else node.removeAttribute('rel');
      }
      if(node.tagName==='IMG'){
        const src=node.getAttribute('src')||'';
        if(!/^data:image\/(?:png|jpeg|webp);base64,/i.test(src))node.remove();
      }
    });
    return template.innerHTML||'<p><br></p>';
  }
  function buildProject(){
    const state=core()?.getState?.()||{};
    return{format:PROJECT_FORMAT,version:PROJECT_VERSION,title:String(state.title||'제목 없는 문서').slice(0,100),html:String(state.html||'<p><br></p>'),page:{...pageSettings},exportedAt:new Date().toISOString()};
  }
  function serializeProject(){return JSON.stringify(buildProject(),null,2);}
  function ensureProjectSize(text){if(new Blob([text]).size>MAX_PROJECT_BYTES)throw new Error('문서 파일이 5MB를 초과합니다. 큰 이미지를 줄인 뒤 다시 저장해주세요.');}
  function projectBlob(){const text=serializeProject();ensureProjectSize(text);return new Blob([text],{type:'application/json'});}
  function safeFileStem(){return String($('documentTitle')?.value||'document').trim().replace(/[\\/:*?"<>|]+/g,'_').slice(0,80)||'document';}
  function downloadProject(){
    try{
      const blob=projectBlob(),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`${safeFileStem()}.document.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);setWorkflowNote('projectState',`${anchor.download} 저장을 시작했습니다.`,'ok');return blob;
    }catch(error){setWorkflowNote('projectState',error.message||String(error),'warn');throw error;}
  }
  function validateProject(payload){
    if(!payload||payload.format!==PROJECT_FORMAT||payload.version!==PROJECT_VERSION||typeof payload.html!=='string')throw new Error('지원되는 Program Studio 문서 파일이 아닙니다.');
    return payload;
  }
  function restoreProject(payload){
    payload=validateProject(payload);
    const html=sanitizeDocumentHtml(payload.html);ensureProjectSize(JSON.stringify({...payload,html}));
    if($('documentTitle'))$('documentTitle').value=String(payload.title||'제목 없는 문서').slice(0,100)||'제목 없는 문서';
    core()?.setContent?.(html,{save:false});applyPageSettings(payload.page||{}, {save:true});core()?.saveDraft?.();
    setWorkflowNote('projectState','문서 파일을 불러왔습니다.','ok');setMainStatus('문서 파일의 내용과 페이지 설정을 복원했습니다.');
    return{title:$('documentTitle')?.value||'',html:core()?.getContent?.()||'',page:{...pageSettings}};
  }
  function parseProject(text){ensureProjectSize(String(text||''));return validateProject(JSON.parse(String(text||'')));}
  async function importProjectFile(file){
    if(!file)throw new Error('문서 파일을 선택해주세요.');if(file.size>MAX_PROJECT_BYTES)throw new Error('문서 파일은 5MB 이하만 불러올 수 있습니다.');
    try{return restoreProject(parseProject(await file.text()));}catch(error){setWorkflowNote('projectState',error.message||'문서 파일을 불러오지 못했습니다.','warn');throw error;}
  }
  function bind(){
    $('pageOrientation')?.addEventListener('change',event=>applyPageSettings({orientation:event.target.value}));
    $('pageMargin')?.addEventListener('change',event=>applyPageSettings({margin:event.target.value}));
    $('findNextBtn')?.addEventListener('click',()=>findText($('findText')?.value));
    $('replaceAllBtn')?.addEventListener('click',()=>replaceAllText($('findText')?.value,$('replaceText')?.value));
    $('findText')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();findText(event.target.value);}});
    $('projectExportBtn')?.addEventListener('click',downloadProject);
    $('projectImportBtn')?.addEventListener('click',()=>$('projectFileInput')?.click());
    $('projectFileInput')?.addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';if(file)await importProjectFile(file).catch(()=>{});});
  }
  function boot(){
    if(!core())return;
    pageSettings=readPageSettings();applyPageSettings(pageSettings,{save:false});bind();document.documentElement.dataset.documentEditorWorkflowReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorWorkflow={
    applyPageSettings,getPageSettings:()=>({...pageSettings}),findText,replaceAllText,sanitizeDocumentHtml,buildProject,serializeProject,projectBlob,parseProject,restoreProject,importProjectFile,downloadProject,
    constants:{settingsKey:SETTINGS_KEY,projectFormat:PROJECT_FORMAT,projectVersion:PROJECT_VERSION,maxProjectBytes:MAX_PROJECT_BYTES},
    stage:'document-editor-workflow-stage2'
  };
})(window);
