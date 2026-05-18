(function(){
  if(window.__pdfFileCheckLabelsV1)return;
  window.__pdfFileCheckLabelsV1=true;
  var NAME='PDF 파일 검수기';
  var BAD=['문서 사전 검수기','문서사전검수기','인쇄 사전 검수기','인쇄사전검수기','인쇄 검수기','PDF 사전검수기','Pre-flight Checker','Pre-flight'];
  function txt(root,a,b){
    try{var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n=[];while(w.nextNode())n.push(w.currentNode);n.forEach(function(x){if((x.nodeValue||'').indexOf(a)>-1)x.nodeValue=x.nodeValue.split(a).join(b);});}catch(e){}
  }
  function run(){
    document.title=NAME+' · Program Tool';
    var h=document.querySelector('.page-head h1'); if(h)h.textContent=NAME;
    var nav=document.querySelector('.nav-title'); if(nav)nav.textContent='🔍 '+NAME;
    var p=document.querySelector('.page-head p'); if(p)p.textContent='PDF의 해상도·도련·폰트·색상 모드 등을 무료 규칙 기반으로 검수합니다.';
    var note=document.querySelector('.free-note'); if(note)note.textContent='무료 규칙 기반 검사만 사용합니다.';
    BAD.forEach(function(v){txt(document.body,v,NAME);});
    txt(document.body,'AI',''); txt(document.body,'GPT',''); txt(document.body,'Gemini',''); txt(document.body,'제미나이','');
  }
  document.addEventListener('DOMContentLoaded',run);
  setInterval(run,700);
})();
