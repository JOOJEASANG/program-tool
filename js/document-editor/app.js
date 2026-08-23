(function(root){
  'use strict';
  if(root.DocumentEditorApp)return;

  const DRAFT_KEY='programStudio.documentEditor.stage1';
  const MAX_DRAFT_BYTES=4_500_000;
  const MAX_IMAGE_BYTES=12_000_000;
  const IMAGE_MAX_EDGE=1600;
  let saveTimer=null;
  let lastSavedAt=0;

  const $=id=>document.getElementById(id);
  const editor=()=>$('documentPage');
  const titleInput=()=>$('documentTitle');
  const escapeHtml=value=>String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const clampInt=(value,min,max,fallback)=>{const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback};

  function setStatus(message,tone='ok'){
    const status=$('statusText');if(status){status.textContent=message;status.dataset.tone=tone;}
  }
  function setDraftState(message,warn=false){
    const node=$('draftState');if(!node)return;node.textContent=message;node.classList.toggle('warn',Boolean(warn));
  }
  function plainText(){return String(editor()?.innerText||'').replace(/\u00a0/g,' ').trim();}
  function updateCounts(){
    const text=plainText();
    const words=text?text.split(/\s+/).filter(Boolean).length:0;
    if($('wordCount'))$('wordCount').textContent=String(words);
    if($('charCount'))$('charCount').textContent=String(text.length);
    return{words,characters:text.length};
  }
  function draftPayload(){
    return{
      format:'program-studio-document',version:1,
      title:String(titleInput()?.value||'제목 없는 문서').trim().slice(0,100)||'제목 없는 문서',
      html:editor()?.innerHTML||'<p><br></p>',
      savedAt:new Date().toISOString()
    };
  }
  function saveDraft(){
    try{
      const payload=JSON.stringify(draftPayload());
      if(new Blob([payload]).size>MAX_DRAFT_BYTES)throw new Error('문서 저장 용량이 큽니다. 큰 이미지를 줄이거나 일부 내용을 정리해주세요.');
      localStorage.setItem(DRAFT_KEY,payload);lastSavedAt=Date.now();
      setDraftState('자동 저장됨 · '+new Date(lastSavedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}));
      return true;
    }catch(error){setDraftState(error.message||'자동 저장에 실패했습니다.',true);return false;}
  }
  function scheduleSave(){
    clearTimeout(saveTimer);setDraftState('저장 중…');saveTimer=setTimeout(()=>saveDraft(),450);
  }
  function readDraft(){
    try{
      const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return null;
      const payload=JSON.parse(raw);if(payload?.format!=='program-studio-document'||payload.version!==1||typeof payload.html!=='string')return null;
      return payload;
    }catch(_){return null;}
  }
  function restoreDraft(){
    const payload=readDraft();if(!payload)return false;
    editor().innerHTML=payload.html||'<p><br></p>';titleInput().value=String(payload.title||'제목 없는 문서').slice(0,100);
    updateCounts();setDraftState('저장된 문서를 복구했습니다.');setStatus('이 브라우저에 저장된 문서를 복구했습니다.');return true;
  }
  function clearDraft(){
    try{localStorage.removeItem(DRAFT_KEY);setDraftState('저장본 없음');setStatus('브라우저 자동 저장본을 삭제했습니다.');return true}catch(_){return false}
  }
  function setContent(html,options={}){
    if(!editor())return false;
    editor().innerHTML=String(html||'<p><br></p>');updateCounts();
    if(options.save!==false)scheduleSave();return true;
  }
  function getContent(){return editor()?.innerHTML||'';}
  function ensureEditorSelection(){
    const node=editor();if(!node)return false;
    const selection=root.getSelection?.();
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0),container=range.commonAncestorContainer.nodeType===3?range.commonAncestorContainer.parentNode:range.commonAncestorContainer;
      if(container&&node.contains(container))return true;
    }
    node.focus();
    const range=document.createRange();range.selectNodeContents(node);range.collapse(false);
    selection?.removeAllRanges();selection?.addRange(range);return true;
  }
  function command(name,value=null){
    if(!editor())return false;ensureEditorSelection();
    try{
      const ok=document.execCommand(name,false,value);scheduleSave();updateCounts();return ok;
    }catch(error){setStatus('이 브라우저에서 해당 서식을 적용하지 못했습니다.','warn');return false;}
  }
  function format(commandName,value=null){return command(commandName,value);}
  function insertHtml(html){
    if(!editor())return false;ensureEditorSelection();
    try{
      if(document.execCommand('insertHTML',false,String(html))) {scheduleSave();updateCounts();return true;}
    }catch(_){}
    editor().insertAdjacentHTML('beforeend',String(html));scheduleSave();updateCounts();return true;
  }
  function insertTable(rows=3,cols=3){
    rows=clampInt(rows,1,20,3);cols=clampInt(cols,1,10,3);
    const cells=Array.from({length:rows},(_,r)=>'<tr>'+Array.from({length:cols},(_,c)=>`<td>${r===0?`열 ${c+1}`:'&nbsp;'}</td>`).join('')+'</tr>').join('');
    const ok=insertHtml(`<table><tbody>${cells}</tbody></table><p><br></p>`);if(ok)setStatus(`${rows}행 × ${cols}열 표를 넣었습니다.`);return ok;
  }
  function insertImageDataUrl(dataUrl,alt='삽입 이미지'){
    if(!/^data:image\/(?:png|jpeg|webp);base64,/i.test(String(dataUrl||'')))return false;
    const ok=insertHtml(`<img src="${String(dataUrl).replace(/"/g,'&quot;')}" alt="${escapeHtml(alt).slice(0,120)}"><p><br></p>`);if(ok)setStatus('이미지를 문서에 넣었습니다.');return ok;
  }
  async function fileToDataUrl(file){
    return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('이미지 파일을 읽지 못했습니다.'));reader.readAsDataURL(file)});
  }
  async function decodeImage(file){
    if(typeof createImageBitmap==='function'){
      try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(_){}
    }
    const src=await fileToDataUrl(file);
    return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('이미지를 열 수 없습니다.'));image.src=src});
  }
  async function prepareImage(file){
    if(!file||!String(file.type||'').startsWith('image/'))throw new Error('PNG, JPG 또는 WebP 이미지를 선택해주세요.');
    if(file.size>MAX_IMAGE_BYTES)throw new Error('이미지는 12MB 이하 파일을 사용해주세요.');
    const source=await decodeImage(file),width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
    const scale=Math.min(1,IMAGE_MAX_EDGE/Math.max(width,height)),outW=Math.max(1,Math.round(width*scale)),outH=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');canvas.width=outW;canvas.height=outH;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,outW,outH);if(typeof source.close==='function')source.close();
    const dataUrl=canvas.toDataURL('image/webp',.86);return{dataUrl,width:outW,height:outH};
  }
  async function insertImageFile(file){
    try{setStatus('이미지를 준비하는 중입니다…');const prepared=await prepareImage(file);insertImageDataUrl(prepared.dataUrl,file.name||'삽입 이미지');return prepared}catch(error){setStatus(error.message||String(error),'warn');throw error}
  }
  function newDocument(force=false){
    const hasContent=plainText().length>0||Boolean(editor()?.querySelector('img,table'));
    if(!force&&hasContent&&!root.confirm('현재 문서를 비우고 새 문서를 시작할까요?'))return false;
    clearTimeout(saveTimer);editor().innerHTML='<p><br></p>';titleInput().value='제목 없는 문서';clearDraft();updateCounts();setDraftState('새 문서 · 자동 저장 준비됨');setStatus('새 문서를 시작했습니다.');editor().focus();return true;
  }
  function printDocument(){saveDraft();setStatus('인쇄 창에서 PDF로 저장을 선택할 수 있습니다.');root.print();return true;}
  function bindToolbar(){
    document.querySelectorAll('[data-command]').forEach(button=>button.addEventListener('click',()=>command(button.dataset.command)));
    $('blockFormat')?.addEventListener('change',event=>command('formatBlock',event.target.value));
    $('fontName')?.addEventListener('change',event=>command('fontName',event.target.value));
    $('fontSize')?.addEventListener('change',event=>command('fontSize',event.target.value));
    $('foreColor')?.addEventListener('input',event=>command('foreColor',event.target.value));
    $('hiliteColor')?.addEventListener('input',event=>command('hiliteColor',event.target.value));
  }
  function bindActions(){
    editor()?.addEventListener('input',()=>{updateCounts();scheduleSave()});
    titleInput()?.addEventListener('input',scheduleSave);
    $('insertTableBtn')?.addEventListener('click',()=>insertTable($('tableRows')?.value,$('tableCols')?.value));
    $('insertImageBtn')?.addEventListener('click',()=>$('imageInput')?.click());
    $('imageInput')?.addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';if(file)await insertImageFile(file).catch(()=>{})});
    $('saveNowBtn')?.addEventListener('click',()=>{clearTimeout(saveTimer);saveDraft();setStatus('문서를 지금 저장했습니다.')});
    $('clearDraftBtn')?.addEventListener('click',()=>{if(root.confirm('이 브라우저의 자동 저장본을 삭제할까요?'))clearDraft()});
    $('newDocumentBtn')?.addEventListener('click',()=>newDocument(false));
    $('printBtn')?.addEventListener('click',printDocument);
    document.addEventListener('keydown',event=>{
      const mod=event.ctrlKey||event.metaKey;if(!mod)return;
      if(event.key.toLowerCase()==='s'){event.preventDefault();clearTimeout(saveTimer);saveDraft();setStatus('문서를 저장했습니다.');}
      if(event.key.toLowerCase()==='p'){event.preventDefault();printDocument();}
    });
  }
  function boot(){
    bindToolbar();bindActions();
    const restored=restoreDraft();if(!restored){updateCounts();setDraftState('자동 저장 준비됨');}
    document.documentElement.dataset.documentEditorReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorApp={
    setContent,getContent,format,insertTable,insertImageDataUrl,insertImageFile,saveDraft,restoreDraft,clearDraft,newDocument,printDocument,updateCounts,
    getState:()=>({title:titleInput()?.value||'',html:getContent(),text:plainText(),counts:updateCounts(),hasDraft:Boolean(readDraft()),lastSavedAt}),
    draftKey:DRAFT_KEY,
    stage:'document-editor-core-stage1'
  };
})(window);
