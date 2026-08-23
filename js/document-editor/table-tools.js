(function(root){
  'use strict';
  if(root.DocumentEditorTableTools)return;

  let selectedCell=null;
  const $=id=>document.getElementById(id);
  const page=()=>$('documentPage');
  const core=()=>root.DocumentEditorApp;

  function setNote(message,tone=''){
    const node=$('tableToolsState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }
  function setMainStatus(message,tone='ok'){
    const node=$('statusText');if(node){node.textContent=message;node.dataset.tone=tone;}
  }
  function clearSelection(){
    selectedCell?.classList.remove('document-selected-cell');selectedCell=null;
  }
  function validCell(cell){return Boolean(cell&&cell.isConnected&&page()?.contains(cell)&&/^(?:TD|TH)$/.test(cell.tagName));}
  function tableHasSpans(table){
    return [...table.querySelectorAll('td,th')].some(cell=>(Number(cell.colSpan)||1)>1||(Number(cell.rowSpan)||1)>1);
  }
  function selectCell(cell){
    if(!validCell(cell)){clearSelection();setNote('편집할 표 셀을 문서에서 선택해주세요.','warn');return null;}
    if(selectedCell!==cell){selectedCell?.classList.remove('document-selected-cell');selectedCell=cell;selectedCell.classList.add('document-selected-cell');}
    const table=cell.closest('table'),row=cell.parentElement;
    const info={cell,row,table,rowIndex:[...table.rows].indexOf(row),columnIndex:cell.cellIndex,rows:table.rows.length,columns:Math.max(...[...table.rows].map(item=>item.cells.length),0)};
    setNote(`${info.rowIndex+1}행 ${info.columnIndex+1}열 선택 · ${info.rows}행 × ${info.columns}열`,'ok');
    return info;
  }
  function selectedInfo(){return validCell(selectedCell)?selectCell(selectedCell):null;}
  function requireSimpleTable(){
    const info=selectedInfo();if(!info){setNote('먼저 문서 안의 표 셀을 클릭해주세요.','warn');return null;}
    if(tableHasSpans(info.table)){setNote('병합된 셀이 있는 표는 행·열 구조 변경을 지원하지 않습니다.','warn');return null;}
    return info;
  }
  function finish(message,cell=null){
    core()?.updateCounts?.();core()?.saveDraft?.();
    if(cell)selectCell(cell);else clearSelection();
    setMainStatus(message);if(!cell)setNote(message,'ok');return true;
  }
  function cloneCellKind(reference){
    const cell=document.createElement(reference?.tagName==='TH'?'th':'td');cell.innerHTML='&nbsp;';return cell;
  }
  function addRowAfter(){
    const info=requireSimpleTable();if(!info)return false;
    const section=info.row.parentElement,newRow=document.createElement('tr');
    [...info.row.cells].forEach(cell=>newRow.appendChild(cloneCellKind(cell.tagName==='TH'&&section.tagName!=='THEAD'?null:cell)));
    info.row.insertAdjacentElement('afterend',newRow);
    return finish('선택한 행 아래에 새 행을 추가했습니다.',newRow.cells[Math.min(info.columnIndex,newRow.cells.length-1)]);
  }
  function deleteRow(){
    const info=requireSimpleTable();if(!info)return false;
    if(info.table.rows.length<=1)return deleteTable();
    const targetIndex=info.rowIndex,cellIndex=info.columnIndex;info.row.remove();
    const nextRow=info.table.rows[Math.min(targetIndex,info.table.rows.length-1)],next=nextRow?.cells[Math.min(cellIndex,nextRow.cells.length-1)]||nextRow?.cells[0];
    return finish('선택한 행을 삭제했습니다.',next||null);
  }
  function addColumnAfter(){
    const info=requireSimpleTable();if(!info)return false;
    const index=info.columnIndex;
    [...info.table.rows].forEach(row=>{
      const reference=row.cells[Math.min(index,row.cells.length-1)]||null,newCell=cloneCellKind(reference);
      if(reference)reference.insertAdjacentElement('afterend',newCell);else row.appendChild(newCell);
    });
    const row=info.table.rows[info.rowIndex],next=row?.cells[Math.min(index+1,row.cells.length-1)];
    return finish('선택한 열 오른쪽에 새 열을 추가했습니다.',next||null);
  }
  function deleteColumn(){
    const info=requireSimpleTable();if(!info)return false;
    if(info.columns<=1)return deleteTable();
    const index=info.columnIndex,rowIndex=info.rowIndex;
    [...info.table.rows].forEach(row=>row.cells[index]?.remove());
    const row=info.table.rows[Math.min(rowIndex,info.table.rows.length-1)],next=row?.cells[Math.min(index,row.cells.length-1)]||row?.cells[0];
    return finish('선택한 열을 삭제했습니다.',next||null);
  }
  function deleteTable(){
    const info=selectedInfo();if(!info){setNote('삭제할 표의 셀을 먼저 선택해주세요.','warn');return false;}
    const table=info.table,paragraph=document.createElement('p');paragraph.innerHTML='<br>';table.insertAdjacentElement('afterend',paragraph);table.remove();
    finish('표를 삭제했습니다.');paragraph.focus?.();return true;
  }
  function normalizeLink(value){
    let raw=String(value||'').trim();if(!raw)return'';
    if(/^mailto:/i.test(raw))return /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(raw)?raw:'';
    if(!/^https?:\/\//i.test(raw)){
      if(!/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/:?#].*)?$/i.test(raw))return'';
      raw='https://'+raw;
    }
    try{const url=new URL(raw);return /^(?:http:|https:)$/.test(url.protocol)?url.href:'';}catch(_){return'';}
  }
  function selectedRange(){
    const node=page(),selection=root.getSelection?.();if(!node||!selection||!selection.rangeCount)return null;
    const range=selection.getRangeAt(0),container=range.commonAncestorContainer.nodeType===3?range.commonAncestorContainer.parentElement:range.commonAncestorContainer;
    return container&&node.contains(container)?range:null;
  }
  function applyLink(value){
    const href=normalizeLink(value);if(!href){setNote('http(s) 주소 또는 이메일(mailto:)을 입력해주세요.','warn');return false;}
    const range=selectedRange();if(!range){setNote('링크를 적용할 문서 글자를 선택하거나 커서를 놓아주세요.','warn');return false;}
    const anchor=document.createElement('a');anchor.href=href;anchor.target='_blank';anchor.rel='noopener noreferrer';
    if(range.collapsed)anchor.textContent=href;else anchor.appendChild(range.extractContents());
    range.insertNode(anchor);range.setStartAfter(anchor);range.collapse(true);
    const selection=root.getSelection?.();selection?.removeAllRanges();selection?.addRange(range);
    core()?.updateCounts?.();core()?.saveDraft?.();setNote('링크를 적용했습니다.','ok');setMainStatus('선택한 글자에 링크를 적용했습니다.');return anchor;
  }
  function unlink(){
    const range=selectedRange();if(!range){setNote('링크 안에 커서를 놓아주세요.','warn');return false;}
    const element=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
    const anchor=element?.closest?.('a');if(!anchor||!page()?.contains(anchor)){setNote('현재 위치에 해제할 링크가 없습니다.','warn');return false;}
    const parent=anchor.parentNode,last=anchor.lastChild;anchor.replaceWith(...anchor.childNodes);
    if(last&&parent?.contains(last)){range.selectNodeContents(last.nodeType===3?last.parentElement||parent:last);range.collapse(false);}
    core()?.updateCounts?.();core()?.saveDraft?.();setNote('링크를 해제했습니다.','ok');setMainStatus('링크를 해제했습니다.');return true;
  }
  function bind(){
    page()?.addEventListener('click',event=>{
      const cell=event.target?.closest?.('td,th');if(cell&&page()?.contains(cell))selectCell(cell);else clearSelection();
    });
    $('tableAddRowBtn')?.addEventListener('click',addRowAfter);
    $('tableDeleteRowBtn')?.addEventListener('click',deleteRow);
    $('tableAddColBtn')?.addEventListener('click',addColumnAfter);
    $('tableDeleteColBtn')?.addEventListener('click',deleteColumn);
    $('tableDeleteBtn')?.addEventListener('click',deleteTable);
    $('applyLinkBtn')?.addEventListener('click',()=>applyLink($('linkUrl')?.value));
    $('unlinkBtn')?.addEventListener('click',unlink);
  }
  function boot(){
    if(!core()||!root.DocumentEditorWorkflow)return;
    bind();document.documentElement.dataset.documentEditorTableToolsReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorTableTools={
    selectCell,getSelected:()=>selectedInfo(),addRowAfter,deleteRow,addColumnAfter,deleteColumn,deleteTable,normalizeLink,applyLink,unlink,
    stage:'document-editor-table-tools-stage4'
  };
})(window);
