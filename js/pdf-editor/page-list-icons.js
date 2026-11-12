// Korean SVG icon-and-label buttons for PDF배치's right page list.
// Existing event handlers remain attached to the original buttons.
(function(){
'use strict';
if(window.__pdfPageListIconsV1)return;
window.__pdfPageListIconsV1=true;
const NS='http://www.w3.org/2000/svg';
const ICONS={
 'check-square':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m7 12 3 3 7-7"/>',
 square:'<rect x="3" y="3" width="18" height="18" rx="2"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v7m4-7v7"/>',
 link:'<path d="M10 13a5 5 0 0 0 7 .5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
 split:'<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="m8 8 11 11M14 10l5-5M8 16l4-4"/>',
 chevron:'<path d="m6 9 6 6 6-6"/>',
 grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 'chevrons-up':'<path d="m7 14 5-5 5 5m-10 6 5-5 5 5"/>',
 'chevrons-down':'<path d="m7 4 5 5 5-5m-10 6 5 5 5-5"/>',
 'rotate-left':'<path d="M3 12a9 9 0 1 0 3-6M3 4v5h5"/>',
 'rotate-right':'<path d="M21 12a9 9 0 1 1-3-6m3-2v5h-5"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
 'eye-off':'<path d="M2 2l20 20M10.6 5.1A11 11 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3 3.8M6.4 6.4C3.6 8.2 2 12 2 12s4 7 10 7a9 9 0 0 0 4.6-1.2"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/>',
 'move-top':'<path d="M4 4h16M12 8v12m-5-7 5-5 5 5"/>',
 'move-bottom':'<path d="M4 20h16M12 4v12m-5-5 5 5 5-5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 minus:'<path d="M5 12h14"/>',
 'list-check':'<path d="m3 6 2 2 3-3M12 7h9m-18 9 2 2 3-3m4 1h9"/>',
 'odd-even':'<path d="M4 5h16M4 12h16M4 19h16"/>',
 shuffle:'<path d="m18 14 4 4-4 4M2 18h3c7 0 7-12 14-12h3M18 2l4 4-4 4M2 6h3c2 0 3 1 4 3m5 6c1 2 2 3 5 3h3"/>',
 mouse:'<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 2v8"/>',
 undo:'<path d="M9 14 4 9l5-5M4 9h9a7 7 0 1 1 0 14"/>',
 redo:'<path d="m15 14 5-5-5-5m5 5h-9a7 7 0 1 0 0 14"/>'
};
const defs={
 '.pdf-file-order-handle':['grip','이동','드래그하여 파일 순서 변경'],
 '.pdf-file-nav-toggle':['chevron','접기','이 파일 페이지 접기 또는 펼치기'],
 '.pdf-file-select-btn:not(.is-clear)':['check-square','전체','이 파일 페이지만 전체 선택'],
 '.pdf-file-select-btn.is-clear':['square','해제','이 파일의 페이지 선택 해제'],
 '.pdf-file-delete-btn':['trash','삭제','이 PDF 파일 및 모든 페이지 삭제'],
 '#pdfCollapseAllFiles':['chevrons-up','모두 접기','모든 파일 페이지 접기'],
 '#pdfExpandAllFiles':['chevrons-down','모두 펼치기','모든 파일 페이지 펼치기'],
 '#pdfEditedPageJumpButton':['arrow','이동','편집 페이지 번호로 이동'],
 '#pdfOriginalPageJumpButton':['arrow','이동','원본 파일 페이지 번호로 이동'],
 '#pageSelectionModeBtnV3':['check-square','다중 선택','다중 선택 켜기 또는 종료'],
 '#pageSelectionToolbar [data-selection-action="all"]':['check-square','전체','전체 페이지 선택'],
 '#pageSelectionToolbar [data-selection-action="clear"]':['square','해제','전체 페이지 선택 해제'],
 '#pageSelectionToolbar [data-selection-action="range-replace"]':['list-check','범위','범위 선택'],
 '#pageSelectionToolbar [data-selection-action="range-add"]':['plus','추가','선택 범위 추가'],
 '#pageSelectionToolbar [data-selection-action="range-remove"]':['minus','빼기','선택 범위 제거'],
 '#pageSelectionToolbar [data-selection-action="odd"]':['odd-even','홀수','홀수 페이지 선택'],
 '#pageSelectionToolbar [data-selection-action="even"]':['odd-even','짝수','짝수 페이지 선택'],
 '#pageSelectionToolbar [data-selection-action="invert"]':['shuffle','반전','페이지 선택 반전'],
 '#pageSelectionToolbar [data-selection-action="drag"]':['mouse','드래그','드래그로 페이지 선택'],
 '#pageUndoBtnV3':['undo','취소','일괄 작업 취소'],
 '#pageRedoBtnV3':['redo','다시','일괄 작업 다시 실행']
};
const batches=[
 ['rotate-left','좌회전','선택 페이지 왼쪽 90도 회전'],
 ['rotate-right','우회전','선택 페이지 오른쪽 90도 회전'],
 ['eye-off','숨김','선택 페이지 숨김'],
 ['eye','표시','선택 페이지 숨김 해제'],
 ['copy','복제','선택 페이지 복제'],
 ['move-top','맨 앞','선택 페이지 맨 앞으로 이동'],
 ['move-bottom','맨 뒤','선택 페이지 맨 뒤로 이동'],
 ['trash','삭제','선택 페이지 삭제']
];
function icon(name){
 const svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','15');svg.setAttribute('height','15');
 svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
 svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');
 svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');
 svg.classList.add('pdf-page-action-icon');
 svg.innerHTML=ICONS[name]||ICONS.square;
 return svg;
}
function decorate(button,shape,label,fallback){
 if(!button||!ICONS[shape])return;
 const state=shape+':'+label;
 if(button.dataset.pdfIcon===state&&button.querySelector('.pdf-page-action-icon'))return;
 // Preserve existing descriptive titles, especially file names in delete controls.
 const description=button.dataset.pdfIconDescription||button.getAttribute('aria-label')||button.title||fallback||label;
 button.dataset.pdfIconDescription=description;
 button.setAttribute('aria-label',description);
 if(!button.title)button.title=description;
 button.classList.add('pdf-page-icon-button');
 const caption=document.createElement('span');caption.className='pdf-page-action-label';caption.textContent=label;
 button.replaceChildren(icon(shape),caption);
 button.dataset.pdfIcon=state;
}
function decorateAll(){
 const root=document.getElementById('sb-pages');if(!root)return;
 for(const [selector,entry] of Object.entries(defs)){
   root.querySelectorAll(selector).forEach(button=>{
     let [shape,label,hint]=entry;
     if(button.id==='pageSelectionModeBtnV3'&&button.classList.contains('active'))label='선택 종료';
     decorate(button,shape,label,hint);
   });
 }
 root.querySelectorAll('.pdf-file-boundary').forEach(button=>{
   const separate=button.getAttribute('aria-pressed')==='true';
   decorate(button,separate?'split':'link',separate?'새 묶음':'연속','파일 출력 묶음 전환');
 });
 root.querySelectorAll('.page-productivity-actions button[data-batch-action]').forEach((button,i)=>{
   if(batches[i])decorate(button,...batches[i]);
 });
 const go=document.getElementById('pageJumpInputV3')?.nextElementSibling;
 if(go?.tagName==='BUTTON')decorate(go,'arrow','이동','입력한 편집 페이지로 이동');
}
function install(){
 const root=document.getElementById('sb-pages');if(!root)return;
 if(!document.getElementById('pdfPageListIconStyles')){
   const style=document.createElement('style');style.id='pdfPageListIconStyles';
   style.textContent=[
     '#pageSidebar .pdf-page-icon-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;min-height:32px;min-width:0;padding:0 6px!important;font-family:inherit;font-size:10px!important;font-weight:800!important;white-space:nowrap!important;vertical-align:middle}',
     '#pageSidebar .pdf-page-action-icon{display:block;flex:0 0 15px;width:15px;height:15px;pointer-events:none}',
     '#pageSidebar .pdf-page-action-label{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis}',
     '#pageSidebar .pdf-file-action-row{gap:4px!important}',
     '#pageSidebar .pdf-file-action-row>.pdf-page-icon-button{padding:0 4px!important;flex:1 1 0!important;font-size:9px!important}',
     '#pageSidebar .pdf-file-delete-btn.pdf-page-icon-button{color:#b91c1c!important;border-color:#fecaca}',
     '#pageSidebar .pdf-page-icon-button:focus-visible{outline:2px solid #2563eb!important;outline-offset:1px}',
     '#pageSidebar #thumbArea .thumb-item .pdf-page-select-checkbox{width:21px;height:21px;left:5px;top:5px;z-index:14;accent-color:#2563eb}',
     '#pageSidebar #thumbArea .thumb-item .thumb-wrap{cursor:pointer!important}',
     '#pageSidebar #thumbArea .thumb-item.page-selected .thumb-wrap{outline:3px solid #2563eb!important;outline-offset:1px}',
     '@media(max-width:420px){#pageSidebar .pdf-file-action-row>.pdf-page-icon-button{gap:2px!important;font-size:8px!important}}'
   ].join('\n');
   document.head.appendChild(style);
 }
 let frame=0;
 const queue=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;decorateAll();});};
 new MutationObserver(queue).observe(root,{childList:true,subtree:true});
 document.addEventListener('pdf-page-selection-change',queue);
 decorateAll();
 window.PdfPageListIcons={refresh:queue,stage:'right-page-icon-actions-v1'};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();