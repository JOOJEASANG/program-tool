(function(root){
  'use strict';
  if(root.DocumentEditorComments)return;

  const STORAGE_KEY='programStudio.documentEditor.comments.stage7';
  const MAX_COMMENTS=200;
  const MAX_TEXT=600;
  const MAX_QUOTE=160;
  const BLOCK_SELECTOR='p,h1,h2,h3,li,td,th,blockquote,div';
  let comments=[];
  let pendingAnchor=null;
  let refreshTimer=null;

  const $=id=>document.getElementById(id);
  const page=()=>$('documentPage');
  const core=()=>root.DocumentEditorApp;
  const normalizeText=value=>String(value||'').replace(/\s+/g,' ').trim();
  const clone=value=>JSON.parse(JSON.stringify(value));

  function setState(message,tone=''){
    const node=$('commentState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function safePath(value){
    if(!Array.isArray(value)||value.length>32)return[];
    return value.map(Number).filter(item=>Number.isInteger(item)&&item>=0&&item<10000);
  }
  function safeComment(value){
    if(!value||typeof value!=='object')return null;
    const text=normalizeText(value.text).slice(0,MAX_TEXT);if(!text)return null;
    const anchor=value.anchor&&typeof value.anchor==='object'?value.anchor:{};
    const quote=normalizeText(anchor.quote).slice(0,MAX_QUOTE);
    if(!quote)return null;
    const tag=/^(P|H1|H2|H3|LI|TD|TH|BLOCKQUOTE|DIV)$/.test(String(anchor.tag||'').toUpperCase())?String(anchor.tag).toUpperCase():'P';
    return{
      id:String(value.id||makeId()).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||makeId(),
      text,
      createdAt:String(value.createdAt||new Date().toISOString()).slice(0,40),
      anchor:{path:safePath(anchor.path),quote,tag}
    };
  }
  function normalizeComments(value){
    if(!Array.isArray(value))return[];
    const seen=new Set(),result=[];
    for(const item of value){
      const comment=safeComment(item);if(!comment||seen.has(comment.id))continue;
      seen.add(comment.id);result.push(comment);if(result.length>=MAX_COMMENTS)break;
    }
    return result;
  }
  function makeId(){
    if(root.crypto?.randomUUID)return 'c_'+root.crypto.randomUUID().replace(/-/g,'');
    return 'c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
  }
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(comments));return true}catch(_){setState('메모를 브라우저에 저장하지 못했습니다.','warn');return false;}
  }
  function read(){
    try{return normalizeComments(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'))}catch(_){return[]}
  }
  function blockFromNode(node){
    const rootPage=page();if(!rootPage||!node)return null;
    let element=node.nodeType===1?node:node.parentElement;
    while(element&&element!==rootPage){
      if(element.matches?.(BLOCK_SELECTOR)&&!element.matches('[data-document-page-break="true"]'))return element;
      element=element.parentElement;
    }
    return null;
  }
  function pathFor(element){
    const rootPage=page(),path=[];let current=element;
    if(!rootPage||!current||!rootPage.contains(current))return[];
    while(current&&current!==rootPage){
      const parent=current.parentElement;if(!parent)return[];
      const index=[...parent.children].indexOf(current);if(index<0)return[];
      path.unshift(index);current=parent;
    }
    return current===rootPage?path:[];
  }
  function anchorFor(element,selectionText=''){
    if(!element)return null;
    const quote=normalizeText(selectionText)||normalizeText(element.innerText||element.textContent||'');
    if(!quote)return null;
    return{path:pathFor(element),quote:quote.slice(0,MAX_QUOTE),tag:element.tagName};
  }
  function captureAnchor(){
    const rootPage=page(),selection=root.getSelection?.();
    if(!rootPage||!selection||!selection.rangeCount)return pendingAnchor;
    const range=selection.getRangeAt(0),container=range.commonAncestorContainer;
    if(!rootPage.contains(container.nodeType===1?container:container.parentNode))return pendingAnchor;
    const block=blockFromNode(container);if(!block)return pendingAnchor;
    const selected=selection.isCollapsed?'':selection.toString();
    const next=anchorFor(block,selected);if(next)pendingAnchor=next;
    return pendingAnchor;
  }
  function elementAtPath(path){
    let current=page();
    for(const index of safePath(path)){current=current?.children?.[index];if(!current)return null;}
    return current&&current!==page()?current:null;
  }
  function matchesAnchor(element,anchor){
    if(!element||!anchor||element.matches?.('[data-document-page-break="true"]'))return false;
    const text=normalizeText(element.innerText||element.textContent||''),quote=normalizeText(anchor.quote);
    return Boolean(text&&quote&&(text.includes(quote)||quote.includes(text.slice(0,Math.min(text.length,quote.length)))));
  }
  function resolveAnchor(comment){
    const anchor=comment?.anchor;if(!anchor)return null;
    const direct=elementAtPath(anchor.path);
    if(direct&&matchesAnchor(direct,anchor))return direct;
    const rootPage=page();if(!rootPage)return null;
    const candidates=[...rootPage.querySelectorAll(BLOCK_SELECTOR)].filter(node=>!node.matches('[data-document-page-break="true"]'));
    const sameTag=candidates.filter(node=>node.tagName===anchor.tag);
    return sameTag.find(node=>matchesAnchor(node,anchor))||candidates.find(node=>matchesAnchor(node,anchor))||null;
  }
  function navigateToComment(id){
    const comment=comments.find(item=>item.id===id);if(!comment)return false;
    const target=resolveAnchor(comment);if(!target){setState('이 메모의 원래 문단을 찾기 어렵습니다. 문서 내용이 크게 바뀌었을 수 있습니다.','warn');render();return false;}
    target.scrollIntoView?.({block:'center',behavior:'smooth'});target.focus?.();
    const selection=root.getSelection?.(),range=document.createRange();range.selectNodeContents(target);selection?.removeAllRanges();selection?.addRange(range);
    pendingAnchor=anchorFor(target,comment.anchor.quote);
    render(id);setState('메모가 연결된 문단으로 이동했습니다.','ok');return true;
  }
  function render(activeId=''){
    const list=$('documentCommentList');if(!list)return comments.length;
    list.replaceChildren();
    if(!comments.length){
      const empty=document.createElement('div');empty.className='comment-empty';empty.textContent='아직 문서 메모가 없습니다.';list.appendChild(empty);setState('문단을 선택한 뒤 메모를 추가할 수 있습니다.');return 0;
    }
    for(const comment of comments){
      const item=document.createElement('div');item.className='comment-item';if(comment.id===activeId)item.classList.add('active');
      const target=resolveAnchor(comment);item.dataset.resolved=String(Boolean(target));
      const jump=document.createElement('button');jump.type='button';jump.className='comment-jump';jump.dataset.commentId=comment.id;
      const quote=document.createElement('span');quote.className='comment-quote';quote.textContent=comment.anchor.quote;
      const text=document.createElement('span');text.className='comment-copy';text.textContent=comment.text;
      const meta=document.createElement('small');meta.textContent=target?'문단으로 이동':'원래 문단 찾기 어려움';
      jump.append(quote,text,meta);
      const remove=document.createElement('button');remove.type='button';remove.className='comment-delete';remove.dataset.commentDelete=comment.id;remove.setAttribute('aria-label','메모 삭제');remove.textContent='삭제';
      item.append(jump,remove);list.appendChild(item);
    }
    setState(`문서 메모 ${comments.length}개`,'ok');return comments.length;
  }
  function addComment(value){
    const text=normalizeText(value??$('commentText')?.value).slice(0,MAX_TEXT);
    if(!text){setState('메모 내용을 입력해주세요.','warn');return null;}
    const anchor=captureAnchor()||pendingAnchor;
    if(!anchor){setState('먼저 문서에서 메모를 연결할 문단을 선택해주세요.','warn');return null;}
    if(comments.length>=MAX_COMMENTS){setState(`메모는 최대 ${MAX_COMMENTS}개까지 저장할 수 있습니다.`,'warn');return null;}
    const comment=safeComment({id:makeId(),text,createdAt:new Date().toISOString(),anchor});
    if(!comment)return null;
    comments.push(comment);save();if($('commentText'))$('commentText').value='';render(comment.id);setState('선택한 문단에 메모를 추가했습니다.','ok');return clone(comment);
  }
  function deleteComment(id){
    const before=comments.length;comments=comments.filter(item=>item.id!==id);if(comments.length===before)return false;
    save();render();setState('메모를 삭제했습니다.','ok');return true;
  }
  function clearComments(options={}){
    comments=[];pendingAnchor=null;if(options.save!==false)save();render();return true;
  }
  function importComments(value,options={}){
    comments=normalizeComments(value);pendingAnchor=null;if(options.save!==false)save();render();return getComments();
  }
  function getComments(){return clone(comments);}
  function scheduleRender(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>render(),120);}
  function isBlankDocument(){
    const rootPage=page();return Boolean(rootPage)&&normalizeText(rootPage.innerText)===''&&!rootPage.querySelector('img,table')&&String($('documentTitle')?.value||'')==='제목 없는 문서';
  }
  function bind(){
    document.addEventListener('selectionchange',()=>captureAnchor());
    page()?.addEventListener('pointerup',()=>captureAnchor());
    page()?.addEventListener('keyup',()=>captureAnchor());
    $('addCommentBtn')?.addEventListener('click',()=>addComment());
    $('commentText')?.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();addComment();}});
    $('clearCommentsBtn')?.addEventListener('click',()=>{if(comments.length&&root.confirm('문서 메모를 모두 삭제할까요?'))clearComments();});
    $('documentCommentList')?.addEventListener('click',event=>{
      const deleteButton=event.target.closest?.('[data-comment-delete]');if(deleteButton){deleteComment(deleteButton.dataset.commentDelete);return;}
      const jump=event.target.closest?.('[data-comment-id]');if(jump)navigateToComment(jump.dataset.commentId);
    });
    const observer=new MutationObserver(scheduleRender);if(page())observer.observe(page(),{subtree:true,childList:true,characterData:true});
    $('newDocumentBtn')?.addEventListener('click',()=>setTimeout(()=>{if(isBlankDocument())clearComments();},0));
    if(core()?.newDocument){
      const original=core().newDocument.bind(core());core().newDocument=(...args)=>{const result=original(...args);if(result)clearComments();return result;};
    }
  }
  function boot(){
    if(!page()||!core())return;
    comments=read();bind();render();document.documentElement.dataset.documentEditorCommentsReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorComments={
    addComment,deleteComment,clearComments,importComments,getComments,navigateToComment,captureAnchor,resolveAnchor,render,
    constants:{storageKey:STORAGE_KEY,maxComments:MAX_COMMENTS,maxText:MAX_TEXT},
    stage:'document-editor-comments-stage7'
  };
})(window);
