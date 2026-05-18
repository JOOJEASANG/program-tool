(function(){
  if(window.__homeCleanupV1)return;
  window.__homeCleanupV1=true;
  var CHECK_NAME='PDF 파일 검수기';
  var WORDS=['AI','GPT','Gemini','제미나이','OpenAI','자동 생성'];
  function walk(fn){try{var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n=[];while(w.nextNode())n.push(w.currentNode);n.forEach(fn);}catch(e){}}
  function cleanText(){
    walk(function(x){
      var s=x.nodeValue||'';
      s=s.split('문서 사전 검수기').join(CHECK_NAME).split('문서사전검수기').join(CHECK_NAME).split('인쇄 사전 검수기').join(CHECK_NAME).split('인쇄사전검수기').join(CHECK_NAME).split('Pre-flight').join('PDF 검수');
      WORDS.forEach(function(w){s=s.split(w).join('');});
      x.nodeValue=s.replace(/·\s*·/g,'·').replace(/\s{2,}/g,' ');
    });
  }
  function cleanCards(){
    document.querySelectorAll('.prog-card').forEach(function(card){
      var name=card.querySelector('.prog-name');
      if(name && /문서.*검수|인쇄.*검수|Pre-flight/.test(name.textContent||'')) name.textContent=CHECK_NAME;
      var desc=card.querySelector('.prog-desc');
      if(desc){
        var t=desc.textContent||'';
        if((name&&name.textContent===CHECK_NAME)||/검수/.test(t)) desc.textContent='PDF 품질을 무료 규칙 기반으로 점검합니다. 해상도·폰트 임베딩·색상 모드 등을 확인합니다.';
        else desc.textContent=t.replace(/AI/g,'').replace(/GPT/g,'').replace(/Gemini/g,'').replace(/제미나이/g,'').replace(/OpenAI/g,'').replace(/자동 생성/g,'');
      }
      card.querySelectorAll('.prog-tag').forEach(function(tag){
        var t=tag.textContent||'';
        if(/AI|GPT|Gemini|제미나이|OpenAI/.test(t)) tag.remove();
        if(/Pre-flight/.test(t)) tag.textContent='PDF 검수';
      });
    });
  }
  function run(){cleanText();cleanCards();}
  document.addEventListener('DOMContentLoaded',run);
  setInterval(run,700);
})();
