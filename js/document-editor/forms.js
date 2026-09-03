(function(root){
  'use strict';
  if(root.DocumentEditorForms)return;

  const TAB_KEY='programStudio.documentEditor.formsTab.stage8';
  const CATEGORIES=[
    {key:'all',label:'전체'},
    {key:'work',label:'업무'},
    {key:'sales',label:'거래·주문'},
    {key:'hr',label:'인사·노무'},
    {key:'check',label:'점검·관리'},
    {key:'official',label:'공문·계약'}
  ];
  // 표시용 메타데이터: 콘텐츠(HTML/제목)는 usability.js가 소유하고, 여기서는 분류·설명·노출 순서만 관리합니다.
  const CATALOG=[
    {key:'meeting',cat:'work',desc:'일시·안건·논의·결정 표'},
    {key:'weekly',cat:'work',desc:'주간 업무·다음 주 계획'},
    {key:'worklog',cat:'work',desc:'일자별 업무·익일 계획'},
    {key:'approval',cat:'work',desc:'결재 정보·품의 내용'},
    {key:'expense',cat:'work',desc:'지출 항목·합계 표'},
    {key:'quotation',cat:'sales',desc:'품목 명세·합계·부가세'},
    {key:'transaction',cat:'sales',desc:'거래 내역·공급가·세액'},
    {key:'order',cat:'sales',desc:'발주 품목·납품 조건'},
    {key:'receipt',cat:'sales',desc:'금액·수령 확인'},
    {key:'employment',cat:'hr',desc:'근무 조건·임금·서명'},
    {key:'leave',cat:'hr',desc:'휴가 종류·기간·사유'},
    {key:'resume',cat:'hr',desc:'인적사항·학력·경력'},
    {key:'delegation',cat:'hr',desc:'위임 사항·위임/수임인'},
    {key:'daily_check',cat:'check',desc:'10항목 양호/불량 체크'},
    {key:'checklist',cat:'check',desc:'완료 체크·항목·메모'},
    {key:'schedule',cat:'check',desc:'주간 요일별 근무 배정'},
    {key:'notice',cat:'official',desc:'제목·주요 내용 안내'},
    {key:'contract',cat:'official',desc:'조항·갑을 서명란'},
    {key:'confirm',cat:'official',desc:'확인 내용·서명란'}
  ];
  const TODAY=()=>{const d=new Date();return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;};
  const BLOCKS={
    approval:'<table style="width:auto;margin:0 0 10px auto"><tbody><tr><th style="width:56px">담당</th><th style="width:56px">팀장</th><th style="width:56px">대표</th></tr><tr><td style="height:46px">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table>',
    signature:'<p style="text-align:right">성명: _______________ (서명 또는 인)</p>',
    infotable:'<table><tbody><tr><th style="width:25%">항목</th><td>&nbsp;</td></tr><tr><th style="width:25%">항목</th><td>&nbsp;</td></tr></tbody></table>',
    itemtable:'<table><tbody><tr><th style="width:8%">번호</th><th>내용</th><th style="width:18%">수량</th><th style="width:20%">금액</th></tr><tr><td style="text-align:center">1</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td></tr><tr><td style="text-align:center">2</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td></tr><tr><td style="text-align:center">3</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td></tr><tr><th colspan="3" style="text-align:right">합계</th><td style="text-align:right">&nbsp;</td></tr></tbody></table>',
    checkbox:'□ '
  };

  const $=id=>document.getElementById(id);
  const core=()=>root.DocumentEditorApp;
  const usability=()=>root.DocumentEditorUsability;
  const page=()=>$('documentPage');

  function setFormNote(message,tone=''){
    const node=$('formToolsState');if(!node)return;
    node.textContent=message;node.classList.remove('ok','warn');if(tone)node.classList.add(tone);
  }

  /* ---------- 커서 위치에 삽입 ---------- */
  function rangeInsidePage(){
    const node=page(),selection=root.getSelection&&root.getSelection();if(!node)return null;
    if(selection&&selection.rangeCount){
      const range=selection.getRangeAt(0);
      let container=range.commonAncestorContainer;container=container.nodeType===3?container.parentNode:container;
      if(container&&node.contains(container))return range;
    }
    node.focus();const range=document.createRange();range.selectNodeContents(node);range.collapse(false);
    if(selection){selection.removeAllRanges();selection.addRange(range);}
    return range;
  }
  function insertAtCursor(html){
    const node=page(),range=rangeInsidePage();if(!node||!range)return false;
    range.deleteContents();
    const fragment=range.createContextualFragment(String(html||''));
    const tail=fragment.lastChild;
    range.insertNode(fragment);
    if(tail){range.setStartAfter(tail);range.collapse(true);const selection=root.getSelection&&root.getSelection();if(selection){selection.removeAllRanges();selection.addRange(range);}}
    core()&&core().updateCounts&&core().updateCounts();core()&&core().saveDraft&&core().saveDraft();
    return true;
  }
  function insertBlock(kind){
    const html=kind==='today'?TODAY():BLOCKS[kind];
    if(html==null){setFormNote('삽입할 요소를 찾지 못했습니다.','warn');return false;}
    const done=insertAtCursor(html);
    if(done)setFormNote('요소를 문서에 삽입했습니다.','ok');
    return done;
  }

  /* ---------- 빈칸 강조 보기 ---------- */
  function toggleBlanks(force){
    const node=page();if(!node)return false;
    const next=typeof force==='boolean'?force:node.dataset.showBlanks!=='true';
    if(next)node.dataset.showBlanks='true';else delete node.dataset.showBlanks;
    const btn=$('formBlankToggle');if(btn){btn.classList.toggle('on',next);btn.setAttribute('aria-pressed',String(next));}
    setFormNote(next?'채워야 할 표 칸을 화면에서만 표시합니다. (인쇄 안 됨)':'빈칸 강조를 껐습니다.','ok');
    return next;
  }

  /* ---------- 사이드바 탭 ---------- */
  function readTab(){try{return localStorage.getItem(TAB_KEY)||'forms'}catch(_){return 'forms'}}
  function saveTab(value){try{localStorage.setItem(TAB_KEY,value)}catch(_){}}
  function activateTab(name){
    const tabs=[...document.querySelectorAll('[data-form-tab]')];
    const panes=[...document.querySelectorAll('[data-form-pane]')];
    if(!tabs.length)return false;
    const valid=tabs.some(tab=>tab.dataset.formTab===name)?name:tabs[0].dataset.formTab;
    tabs.forEach(tab=>{const on=tab.dataset.formTab===valid;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',String(on));});
    panes.forEach(pane=>{pane.hidden=pane.dataset.formPane!==valid;});
    saveTab(valid);
    return true;
  }

  /* ---------- 템플릿 갤러리 ---------- */
  let activeCat='all';
  function catalogWithLabels(){
    const meta=(usability()&&usability().templates&&usability().templates())||{};
    return CATALOG.filter(item=>meta[item.key]).map(item=>({...item,label:meta[item.key].label||item.key}));
  }
  function renderCards(){
    const list=$('formTemplateList');if(!list)return;
    const items=catalogWithLabels().filter(item=>activeCat==='all'||item.cat===activeCat);
    list.textContent='';
    if(!items.length){const empty=document.createElement('div');empty.className='form-picker-empty';empty.textContent='해당 분류의 양식이 없습니다.';list.appendChild(empty);return;}
    items.forEach(item=>{
      const card=document.createElement('button');card.type='button';card.className='form-template-card';card.dataset.templateKey=item.key;
      const name=document.createElement('span');name.className='ftc-name';name.textContent=item.label;
      const desc=document.createElement('span');desc.className='ftc-desc';desc.textContent=item.desc||'';
      card.appendChild(name);card.appendChild(desc);
      card.addEventListener('click',()=>{usability()&&usability().applyTemplate&&usability().applyTemplate(item.key);});
      list.appendChild(card);
    });
  }
  function renderChips(){
    const bar=$('formTemplateChips');if(!bar)return;
    bar.textContent='';
    CATEGORIES.forEach(category=>{
      const chip=document.createElement('button');chip.type='button';chip.className='form-cat-chip';chip.dataset.cat=category.key;chip.textContent=category.label;
      if(category.key===activeCat)chip.classList.add('active');
      chip.addEventListener('click',()=>{activeCat=category.key;bar.querySelectorAll('.form-cat-chip').forEach(node=>node.classList.toggle('active',node.dataset.cat===activeCat));renderCards();});
      bar.appendChild(chip);
    });
  }
  function renderPicker(){renderChips();renderCards();}

  /* ---------- 바인딩 ---------- */
  function bind(){
    document.querySelectorAll('[data-form-tab]').forEach(tab=>tab.addEventListener('click',()=>activateTab(tab.dataset.formTab)));
    document.querySelectorAll('[data-form-insert]').forEach(btn=>btn.addEventListener('click',()=>insertBlock(btn.dataset.formInsert)));
    $('formBlankToggle')&&$('formBlankToggle').addEventListener('click',()=>toggleBlanks());
  }
  function boot(){
    if(!core())return;
    renderPicker();bind();activateTab(readTab());
    document.documentElement.dataset.documentEditorFormsReady='1';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.DocumentEditorForms={
    insertBlock,toggleBlanks,activateTab,renderPicker,
    catalog:()=>catalogWithLabels(),
    categories:()=>CATEGORIES.map(item=>({...item})),
    constants:{tabKey:TAB_KEY},
    stage:'document-editor-forms-stage8'
  };
})(window);
