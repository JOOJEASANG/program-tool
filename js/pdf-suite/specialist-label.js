// Label specialist PDF engines and support embedding utility features without blurring standalone program roles.
(function(){
  'use strict';
  if(window.__programStudioPdfSpecialistLabelV3)return;
  window.__programStudioPdfSpecialistLabelV3=true;

  const params=new URLSearchParams(location.search);
  const embedded=params.get('embed')==='1';
  let requestedTool=params.get('tool')||'';

  function installStyle(){
    if(document.getElementById('pdfSpecialistLabelStyle'))return;
    const style=document.createElement('style');
    style.id='pdfSpecialistLabelStyle';
    style.textContent=`
      .pdf-specialist-role{margin:0 0 14px;border:1px solid #bfdbfe;background:#eff6ff;color:#334155;border-radius:12px;padding:10px 12px;font:800 11px/1.55 Pretendard,"Noto Sans KR",sans-serif}
      .pdf-specialist-role a{color:#1d4ed8;font-weight:950;text-decoration:none}.pdf-specialist-role strong{color:#0f2f59}
      .pdf-editor-specialist-link{display:block;margin:0 0 12px;border:1px solid #bfdbfe;background:#eff6ff;color:#334155;border-radius:10px;padding:9px 10px;font:800 10px/1.5 Pretendard,"Noto Sans KR",sans-serif;text-decoration:none}
      .pdf-specialist-focus{margin:0 0 12px;border:1px solid #bae6fd;background:#f0fdff;color:#0e7490;border-radius:10px;padding:9px 11px;font:850 10px/1.5 Pretendard,"Noto Sans KR",sans-serif}
      .pdf-specialist-focus strong{color:#155e75}
      .pdf-specialist-focus-target{outline:3px solid rgba(37,99,235,.3)!important;outline-offset:3px!important;border-color:#60a5fa!important}
      html[data-pdf-specialist-embed="true"] body{padding-top:0!important}
      html[data-pdf-specialist-embed="true"] .top-nav{display:none!important}
      html[data-pdf-specialist-embed="true"] .hero,html[data-pdf-specialist-embed="true"] #pdfSpecialistRole,html[data-pdf-specialist-embed="true"] #pdfEditorSpecialistLink{display:none!important}
      html[data-pdf-specialist-embed="true"] .container{padding-top:14px!important;padding-bottom:24px!important}
      html[data-pdf-specialist-embed="true"] .app{height:100vh!important}
    `;
    document.head.appendChild(style);
  }

  function installFocus(container){
    if(!embedded||!container||document.getElementById('pdfSpecialistFocus'))return;
    const focus=document.createElement('div');
    focus.id='pdfSpecialistFocus';
    focus.className='pdf-specialist-focus';
    focus.innerHTML='<strong>PDF 유틸리티에서 선택한 기능</strong> · <span></span>';
    focus.querySelector('span').textContent=requestedTool||'PDF 작업';
    container.prepend(focus);
  }

  function installPreflight(){
    document.title=embedded?'PDF 유틸리티 · 검사·변환':'PDF 검사·변환 · Program Studio';
    const nav=document.querySelector('.nav-title');
    if(nav)nav.textContent='PDF 검사·변환';
    const hero=document.querySelector('.hero');
    const heading=hero?.querySelector('h1');
    const copy=hero?.querySelector('p');
    if(heading)heading.textContent='PDF 검사·변환';
    if(copy)copy.textContent='인쇄 진단, 암호, 압축, 변환처럼 전문 엔진이 필요한 PDF 작업을 처리합니다.';
    const container=document.querySelector('.container');
    if(container&&!embedded&&!document.getElementById('pdfSpecialistRole')){
      const role=document.createElement('div');
      role.id='pdfSpecialistRole';
      role.className='pdf-specialist-role';
      role.innerHTML='<strong>PDF 유틸리티 내부 엔진</strong> · 일반 PDF 작업은 <a href="../pdf-suite/">PDF 유틸리티</a>에서 한곳에 모아 사용할 수 있습니다.';
      container.prepend(role);
    }
    installFocus(container);
    document.documentElement.dataset.pdfSpecialist='preflight';
  }

  function installEditor(){
    document.title=embedded?'PDF 유틸리티 · 일반 편집':'PDF 편집 · N-UP 배치 · Program Studio';
    const nav=document.querySelector('.nav-title');
    if(nav)nav.textContent=embedded?'PDF 일반 편집':'PDF 편집 · N-UP 배치';
    const aside=document.querySelector('aside');
    const heading=aside?.querySelector('h1');
    if(heading)heading.textContent=embedded?'PDF 일반 편집':'PDF 편집 · N-UP 배치';
    if(aside&&!embedded&&!document.getElementById('pdfEditorSpecialistLink')){
      const link=document.createElement('a');
      link.id='pdfEditorSpecialistLink';
      link.className='pdf-editor-specialist-link';
      link.href='../index.html';
      link.textContent='← 프로그램 목록으로 돌아가기';
      aside.prepend(link);
    }
    installFocus(aside);
    document.documentElement.dataset.pdfSpecialist='editor';
  }

  function candidates(){
    return [...document.querySelectorAll('button,a,.sec-head,.mode-btn,.action-btn,label')].filter(node=>node.offsetParent!==null||embedded);
  }

  function focusTerms(tool){
    const text=String(tool||'');
    const mappings=[
      [/프리플라이트|문서 구조|인쇄 진단/,['문서 검수','검수']],
      [/암호 설정|AES/,['암호 설정']],
      [/암호 해제/,['암호 해제']],
      [/압축/,['압축']],
      [/이미지.*PDF|이미지 → PDF/,['이미지','PDF']],
      [/PDF 이미지|이미지 변환/,['이미지 변환','PDF → 이미지']],
      [/N-up|다면/,['N-up','다면']],
      [/소책자|책자|중철/,['소책자','중철']],
      [/페이지 번호/,['페이지 번호','쪽번호']],
      [/재단|인쇄 마크/,['재단','마크']],
      [/여백|크롭|배경/,['여백','크롭']],
      [/출력 준비/,['출력 준비','준비 상태']]
    ];
    for(const [pattern,terms] of mappings)if(pattern.test(text))return terms;
    return text?[text]:[];
  }

  function highlightRequestedTool(){
    document.querySelectorAll('.pdf-specialist-focus-target').forEach(node=>node.classList.remove('pdf-specialist-focus-target'));
    const terms=focusTerms(requestedTool);
    if(!terms.length)return;
    const target=candidates().find(node=>{
      const text=(node.textContent||'').replace(/\s+/g,' ').trim();
      return terms.some(term=>text.includes(term));
    });
    if(!target)return;
    target.classList.add('pdf-specialist-focus-target');
    try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){ }
  }

  function install(){
    installStyle();
    if(embedded)document.documentElement.dataset.pdfSpecialistEmbed='true';
    const path=location.pathname;
    if(/(^|\/)pdf-preflight(\/|$)/.test(path))installPreflight();
    if(/(^|\/)pdf-editor(\/|$)/.test(path))installEditor();
    if(embedded)[250,700,1400].forEach(delay=>setTimeout(highlightRequestedTool,delay));
  }

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.data?.type!=='program-pdf-workspace-focus')return;
    requestedTool=String(event.data.tool||'');
    const focus=document.querySelector('#pdfSpecialistFocus span');
    if(focus)focus.textContent=requestedTool||'PDF 작업';
    highlightRequestedTool();
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();