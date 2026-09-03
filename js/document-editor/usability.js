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
    worklog:{
      label:'업무일지',title:'업무일지',
      html:'<h1>업무 일지</h1><table><tbody><tr><th style="width:15%">날짜</th><td>&nbsp;</td><th style="width:15%">날씨</th><td>&nbsp;</td></tr><tr><th>작성자</th><td>&nbsp;</td><th>소속·직위</th><td>&nbsp;</td></tr></tbody></table><h2>금일 업무</h2><table><tbody><tr><th style="width:15%">시간</th><th style="width:55%">업무 내용</th><th>결과·비고</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>익일 계획</h2><ul><li>&nbsp;</li><li>&nbsp;</li><li>&nbsp;</li></ul><h2>특이 사항</h2><p>&nbsp;</p><p><br></p><p style="text-align:right">작성자 (서명): _______________&nbsp;&nbsp; 확인자 (서명): _______________</p>',
      page:{orientation:'portrait',margin:'normal'}
    },
    approval:{
      label:'품의서',title:'품의서',
      html:'<h1 style="text-align:center">품 의 서</h1><table><tbody><tr><th style="width:20%">문서번호</th><td>&nbsp;</td><th style="width:20%">작성일</th><td>&nbsp;</td></tr><tr><th>작성 부서</th><td>&nbsp;</td><th>작성자</th><td>&nbsp;</td></tr><tr><th>제목</th><td colspan="3">&nbsp;</td></tr></tbody></table><h2>품의 내용</h2><p>아래와 같이 품의하오니 검토하여 주시기 바랍니다.</p><table><tbody><tr><th style="width:20%">품의 사유</th><td>&nbsp;</td></tr><tr><th>금액</th><td>&nbsp;</td></tr><tr><th>사용 목적</th><td>&nbsp;</td></tr><tr><th>사용 일정</th><td>&nbsp;</td></tr><tr><th>첨부 서류</th><td>&nbsp;</td></tr></tbody></table><h2>세부 내용</h2><p>세부 내용을 입력하세요.</p><p><br></p><p style="text-align:right">위와 같이 품의합니다.</p><p style="text-align:right">&nbsp;&nbsp;&nbsp;&nbsp; 년 &nbsp; 월 &nbsp; 일</p><p style="text-align:right">작성자: _______________ (서명)</p>',
      page:{orientation:'portrait',margin:'normal'}
    },
    daily_check:{
      label:'일일점검표',title:'일일점검표',
      html:'<h1>일일 점검표</h1><p><b>점검일</b>: &nbsp;&nbsp; 년 &nbsp; 월 &nbsp; 일 &nbsp;&nbsp;&nbsp; <b>담당자</b>: </p><p><b>점검 장소</b>: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <b>날씨</b>: </p><h2>점검 항목</h2><table><tbody><tr><th style="width:8%">번호</th><th>점검 항목</th><th style="width:10%">양호</th><th style="width:10%">불량</th><th style="width:10%">해당없음</th><th style="width:15%">비고</th></tr><tr><td style="text-align:center">1</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">2</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">3</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">4</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">5</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">6</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">7</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">8</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">9</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr><tr><td style="text-align:center">10</td><td>&nbsp;</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td style="text-align:center">□</td><td>&nbsp;</td></tr></tbody></table><h2>특이 사항</h2><p>&nbsp;</p><p>&nbsp;</p><h2>조치 결과</h2><table><tbody><tr><th>조치 일자</th><th>조치 내용</th><th>조치자</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></tbody></table><p><br></p><p style="text-align:right">확인자 (서명): _______________</p>',
      page:{orientation:'portrait',margin:'narrow'}
    },
    quotation:{
      label:'견적서',title:'견적서',
      html:'<h1 style="text-align:center">견 적 서</h1><table><tbody><tr><th style="width:15%">수신</th><td>&nbsp;</td><th style="width:15%">견적일</th><td>&nbsp;</td></tr><tr><th>발신</th><td>&nbsp;</td><th>유효기간</th><td>&nbsp;</td></tr><tr><th>연락처</th><td>&nbsp;</td><th>담당자</th><td>&nbsp;</td></tr></tbody></table><p><br></p><p><b>견적 총액: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 원 (부가세 포함)</b></p><h2>견적 내역</h2><table><tbody><tr><th style="width:6%">번호</th><th>품목·내역</th><th style="width:10%">규격</th><th style="width:8%">수량</th><th style="width:12%">단가</th><th style="width:12%">공급가</th><th style="width:10%">비고</th></tr><tr><td style="text-align:center">1</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><td style="text-align:center">2</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><td style="text-align:center">3</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><td style="text-align:center">4</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><td style="text-align:center">5</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><th colspan="5" style="text-align:right">공급가 합계</th><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><th colspan="5" style="text-align:right">부가세 (10%)</th><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr><tr><th colspan="5" style="text-align:right">합계</th><td style="text-align:right">&nbsp;</td><td>&nbsp;</td></tr></tbody></table><h2>특기 사항</h2><ul><li>납기: </li><li>결제 조건: </li><li>견적 유효 기간: 발행일로부터 30일</li></ul><p><br></p><p style="text-align:right">&nbsp;&nbsp;&nbsp;&nbsp; 년 &nbsp; 월 &nbsp; 일</p><p style="text-align:right">담당자: _______________ (서명)</p>',
      page:{orientation:'portrait',margin:'narrow'}
    },
    notice:{
      label:'안내문',title:'안내문',
      html:'<h1 style="text-align:center">안내문</h1><p><br></p><p>안녕하세요.</p><p>안내할 내용을 입력하세요.</p><h2>주요 내용</h2><ul><li>일시: </li><li>장소: </li><li>대상: </li></ul><p><br></p><p>감사합니다.</p>',
      page:{orientation:'portrait',margin:'normal'}
    },
    contract:{
      label:'계약서',title:'계약서',
      html:'<h1 style="text-align:center">계 약 서</h1><p style="text-align:center">계약번호: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p><p><br></p><table><tbody><tr><th style="width:20%">계약 명칭</th><td>&nbsp;</td></tr><tr><th>계약 기간</th><td>&nbsp;</td></tr><tr><th>계약 금액</th><td>&nbsp;</td></tr><tr><th>지급 조건</th><td>&nbsp;</td></tr></tbody></table><h2>제1조 (목적)</h2><p>이 계약은 _______________ 과(와) _______________ 사이에 체결되는 계약으로, 계약의 목적과 범위를 정함을 목적으로 합니다.</p><h2>제2조 (계약 내용)</h2><p>계약의 구체적인 내용을 입력하세요.</p><h2>제3조 (기간)</h2><p>이 계약의 유효 기간은 &nbsp; 년 &nbsp; 월 &nbsp; 일부터 &nbsp; 년 &nbsp; 월 &nbsp; 일까지로 합니다.</p><h2>제4조 (비밀유지)</h2><p>양 당사자는 계약 수행 중 알게 된 상대방의 비밀 정보를 제3자에게 누설하지 않습니다.</p><h2>제5조 (계약 해지)</h2><p>일방이 계약을 위반한 경우 상대방은 서면으로 통보한 후 계약을 해지할 수 있습니다.</p><p><br></p><p>이 계약의 성립을 증명하기 위하여 계약서 2부를 작성하고, 각자 서명·날인 후 1부씩 보관합니다.</p><p style="text-align:right">&nbsp;&nbsp;&nbsp;&nbsp; 년 &nbsp; 월 &nbsp; 일</p><p><br></p><table><tbody><tr><th style="width:10%">갑</th><th style="width:25%">주소</th><td>&nbsp;</td></tr><tr><td>&nbsp;</td><th>상호·성명</th><td>&nbsp;</td></tr><tr><td>&nbsp;</td><th>서명·날인</th><td style="height:40px">&nbsp;</td></tr><tr><th>을</th><th>주소</th><td>&nbsp;</td></tr><tr><td>&nbsp;</td><th>상호·성명</th><td>&nbsp;</td></tr><tr><td>&nbsp;</td><th>서명·날인</th><td style="height:40px">&nbsp;</td></tr></tbody></table>',
      page:{orientation:'portrait',margin:'normal'}
    },
    confirm:{
      label:'확인서',title:'확인서',
      html:'<h1 style="text-align:center">확 인 서</h1><p><br></p><table><tbody><tr><th style="width:20%">성명</th><td>&nbsp;</td><th style="width:20%">생년월일</th><td>&nbsp;</td></tr><tr><th>주소</th><td colspan="3">&nbsp;</td></tr></tbody></table><p><br></p><p>위 사람은 아래의 사실을 확인합니다.</p><p><br></p><ol><li>확인 내용을 입력하세요.</li><li>&nbsp;</li><li>&nbsp;</li></ol><p><br></p><p>위 사항이 사실임을 확인합니다.</p><p><br></p><p style="text-align:right">&nbsp;&nbsp;&nbsp;&nbsp; 년 &nbsp; 월 &nbsp; 일</p><p><br></p><p style="text-align:right">확인자: _______________</p><p style="text-align:right">서명 또는 인: _______________</p><p><br></p><p style="text-align:center">_______________ 귀중</p>',
      page:{orientation:'portrait',margin:'wide'}
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
