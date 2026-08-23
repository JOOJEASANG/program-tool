(function(root){
  'use strict';
  if(root.DocumentEditorOutline)return;

  let activeIndex=-1;
  let refreshTimer=null;
  let observer=null;

  const $=id=>document.getElementById(id);
  const page=()=>$('documentPage');
  const headingNodes=()=>[...(page()?.querySelectorAll('h1,h2,h3')||[])];
  const cleanText=value=>String(value||'').replace(/\s+/g,' ').trim();

  function collectHeadings(){
    return headingNodes().map((node,index)=>({index,level:Number(node.tagName.slice(1)),text:cleanText(node.textContent)||`제목 ${index+1}`}));
  }
  function setState(message,tone=''){
    const node=$('outlineState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function renderOutline(){
    const list=$('documentOutlineList');if(!list)return[];
    const headings=collectHeadings();list.replaceChildren();
    if(!headings.length){
      const empty=document.createElement('div');empty.className='document-outline-empty';empty.textContent='제목 1·2·3을 사용하면 여기에 문서 개요가 표시됩니다.';list.appendChild(empty);activeIndex=-1;setState('문서에 제목이 없습니다.');return headings;
    }
    headings.forEach(item=>{
      const button=document.createElement('button');button.type='button';button.className='document-outline-item level-'+item.level;button.dataset.outlineIndex=String(item.index);button.dataset.outlineLevel=String(item.level);button.classList.toggle('active',item.index===activeIndex);
      const badge=document.createElement('span');badge.className='document-outline-level';badge.textContent='H'+item.level;
      const label=document.createElement('span');label.className='document-outline-text';label.textContent=item.text;
      button.append(badge,label);button.addEventListener('click',()=>focusHeading(item.index));list.appendChild(button);
    });
    setState(`제목 ${headings.length}개 · 클릭하면 해당 위치로 이동합니다.`,'ok');return headings;
  }
  function focusHeading(index){
    const nodes=headingNodes(),node=nodes[Number(index)];if(!node){renderOutline();return false;}
    activeIndex=Number(index);node.scrollIntoView?.({block:'center',behavior:'smooth'});node.focus?.();
    try{
      const range=document.createRange(),selection=root.getSelection?.();range.selectNodeContents(node);selection?.removeAllRanges();selection?.addRange(range);
    }catch(_){}
    document.querySelectorAll('#documentOutlineList [data-outline-index]').forEach(button=>button.classList.toggle('active',Number(button.dataset.outlineIndex)===activeIndex));
    const item=collectHeadings()[activeIndex];setState(item?`H${item.level} · ${item.text}`:'제목 위치로 이동했습니다.','ok');return true;
  }
  function scheduleRefresh(){
    clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>renderOutline(),90);
  }
  function bind(){
    const node=page();if(!node)return;
    node.addEventListener('input',scheduleRefresh);
    observer=new MutationObserver(scheduleRefresh);observer.observe(node,{subtree:true,childList:true,characterData:true});
    $('refreshOutlineBtn')?.addEventListener('click',renderOutline);
  }
  function boot(){
    if(!page())return;bind();renderOutline();document.documentElement.dataset.documentEditorOutlineReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorOutline={
    collectHeadings,renderOutline,focusHeading,
    getState:()=>({headings:collectHeadings(),activeIndex}),
    stage:'document-editor-outline-stage6'
  };
})(window);
