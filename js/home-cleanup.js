(function(){
  if(window.__homeCleanupV2)return;
  window.__homeCleanupV2=true;

  var CHECK_NAME='PDF파일검수기';
  var EDITOR_NAME='PDF문서편집기';
  var AI_WORDS=['AI','GPT','Gemini','제미나이','OpenAI','자동 생성','AI 탑재 ·','AI와 함께','AI가 작업을 도와드립니다.'];

  function walk(fn){
    try{
      var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),nodes=[];
      while(w.nextNode())nodes.push(w.currentNode);
      nodes.forEach(fn);
    }catch(e){}
  }

  function stripAiText(s){
    AI_WORDS.forEach(function(w){s=s.split(w).join('');});
    return s.replace(/\s*·\s*·\s*/g,' · ').replace(/\s{2,}/g,' ').trim();
  }

  function cleanText(){
    walk(function(node){
      var s=node.nodeValue||'';
      s=s.split('PDF 편집기').join(EDITOR_NAME)
        .split('PDF 문서 편집기').join(EDITOR_NAME)
        .split('문서 사전 검수기').join(CHECK_NAME)
        .split('문서사전검수기').join(CHECK_NAME)
        .split('인쇄 사전 검수기').join(CHECK_NAME)
        .split('인쇄사전검수기').join(CHECK_NAME)
        .split('PDF 사전검수기').join(CHECK_NAME)
        .split('Pre-flight Checker').join(CHECK_NAME)
        .split('Pre-flight').join('PDF검수');
      node.nodeValue=stripAiText(s);
    });
  }

  function cleanCards(){
    document.querySelectorAll('.prog-card').forEach(function(card){
      var name=card.querySelector('.prog-name');
      var desc=card.querySelector('.prog-desc');
      var href=card.getAttribute('href')||'';
      var text=(card.textContent||'')+' '+href;

      if(name && (/PDF\s*편집기|PDF\s*문서\s*편집기/.test(name.textContent||'') || /pdf-editor/.test(href))){
        name.textContent=EDITOR_NAME;
        if(desc) desc.textContent='PDF 문서를 편집합니다. N-up·간지·머리말·꼬리말·워터마크·페이지 번호·압축·암호·빈 페이지 제거 기능을 사용할 수 있습니다.';
      }

      if(name && (/문서.*검수|인쇄.*검수|파일.*검수|Pre-flight/.test(name.textContent||'') || /preflight|pdf-Checker/i.test(href) || /검수/.test(text))){
        name.textContent=CHECK_NAME;
        if(card.tagName.toLowerCase()==='a') card.setAttribute('href','tools/pdf-Checker.html');
        if(desc) desc.textContent='PDF 파일 품질을 무료 규칙 기반으로 점검합니다. 해상도·폰트 임베딩·색상 모드·페이지 규격 등을 확인합니다.';
      }

      card.querySelectorAll('.prog-tag').forEach(function(tag){
        var t=tag.textContent||'';
        if(/AI|GPT|Gemini|제미나이|OpenAI/.test(t)) tag.remove();
        if(/Pre-flight|사전/.test(t)) tag.textContent='PDF검수';
      });
    });
  }

  function removeAiProgramCards(){
    document.querySelectorAll('.prog-card').forEach(function(card){
      var name=(card.querySelector('.prog-name')||{}).textContent||'';
      if(/AI\s*글쓰기|문서\s*요약|이미지\s*도구/.test(name)) card.remove();
    });
  }

  function run(){
    cleanText();
    cleanCards();
    removeAiProgramCards();
  }

  document.addEventListener('DOMContentLoaded',run);
  setInterval(run,700);
})();
