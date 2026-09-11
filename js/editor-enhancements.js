(()=>{
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
  function dispatch(el){el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))}
  function bindFormMenus(){
    $$('input,textarea,select').forEach(el=>ProgramContextMenu.bind(el,()=>({groups:[{label:'편집',items:[
      {label:'복사',disabled:!('selectionStart'in el)||el.selectionStart===el.selectionEnd,action:()=>document.execCommand('copy')},
      {label:'붙여넣기',action:async()=>{try{const text=await navigator.clipboard.readText();if('selectionStart'in el){const s=el.selectionStart,e=el.selectionEnd;el.setRangeText(text,s,e,'end')}else el.value=text;dispatch(el)}catch(_){el.focus();document.execCommand('paste')}}},
      {label:'전체 선택',action:()=>{el.focus();el.select?.()}},
      {label:'내용 지우기',className:'danger',action:()=>{el.value='';dispatch(el)}}
    ]},{label:'값 조절',items:[
      {label:'값 증가',disabled:el.type!=='number'&&el.type!=='range',action:()=>{el.stepUp?.();dispatch(el)}},
      {label:'값 감소',disabled:el.type!=='number'&&el.type!=='range',action:()=>{el.stepDown?.();dispatch(el)}}
    ]}]})));
    $$('button').forEach(el=>ProgramContextMenu.bind(el,()=>({groups:[{label:'버튼',items:[{label:'실행',disabled:el.disabled,action:()=>el.click()},{label:'설명 보기',action:()=>alert(el.title||el.getAttribute('aria-label')||el.textContent.trim()||'버튼')}]}]})));
  }
  function addCoverFields(){
    if(!location.pathname.includes('perfect-binding-cover'))return;
    const publisher=$('#publisher'),year=$('#publishYear'),back=$('#backText'),spine=$('#spineTitle');
    if(!publisher||$('#institutionName'))return;
    const wrap=publisher.closest('.grid2')||publisher.parentElement;
    const box=document.createElement('div');box.style.cssText='grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:4px';
    box.innerHTML='<div class="field"><label>기관명</label><input id="institutionName" type="text" placeholder="예: 한국초등학교"></div><div class="field"><label>발행처</label><input id="issuerName" type="text" placeholder="예: 교무부"></div><div class="field"><label>발행 연도</label><input id="publishYearLine" type="text" value="2026"></div>';
    wrap.after(box);publisher.closest('.field').style.display='none';year.closest('.field').style.display='none';
    const syncFront=()=>{publisher.value=[$('#institutionName').value,$('#issuerName').value,$('#publishYearLine').value].filter(Boolean).join('\n');year.value='';dispatch(publisher)};
    ['institutionName','issuerName','publishYearLine'].forEach(id=>$('#'+id).addEventListener('input',syncFront));syncFront();
    if(back){const b=document.createElement('div');b.innerHTML='<div class="field"><label>뒤표지 제목</label><input id="backTitleExtra" type="text" placeholder="선택사항"></div><div class="field"><label>뒤표지 추가 문구</label><textarea id="backBodyExtra" placeholder="주소, 연락처, 안내 문구 등"></textarea></div>';back.closest('.field').after(b);const syncBack=()=>{back.value=[$('#backTitleExtra').value,$('#backBodyExtra').value].filter(Boolean).join('\n\n');dispatch(back)};['backTitleExtra','backBodyExtra'].forEach(id=>$('#'+id).addEventListener('input',syncBack))}
    if(spine){const s=document.createElement('div');s.innerHTML='<div class="grid3"><div class="field"><label>책등 상단</label><input id="spineTop" type="text" placeholder="연도"></div><div class="field"><label>책등 중앙</label><input id="spineCenter" type="text" placeholder="제목"></div><div class="field"><label>책등 하단</label><input id="spineBottom" type="text" placeholder="기관명"></div></div>';spine.closest('.field').after(s);spine.closest('.field').style.display='none';const syncSpine=()=>{spine.value=[$('#spineTop').value,$('#spineCenter').value,$('#spineBottom').value].filter(Boolean).join('  ·  ');dispatch(spine)};['spineTop','spineCenter','spineBottom'].forEach(id=>$('#'+id).addEventListener('input',syncSpine))}
    const canvas=$('#previewCanvas');if(canvas){canvas.addEventListener('wheel',e=>{const active=$('#editTarget')?.value||'';const text=/(Title|Subtitle|publisher|backText|spine)/i.test(active);if(!text)return;e.preventDefault();const input=/spine/i.test(active)?$('#spineTextSize'):$('#titleSize');if(!input)return;input.value=Math.max(Number(input.min||5),Math.min(Number(input.max||100),Number(input.value||12)+(e.deltaY<0?1:-1)));dispatch(input)},{passive:false});ProgramContextMenu.bind(canvas,()=>({groups:[{label:'선택 요소',items:[{label:'가운데 정렬',action:()=>$('#centerTargetBtn')?.click()},{label:'선택 초기화',action:()=>$('#resetTargetBtn')?.click()},{label:'한 단계 확대',action:()=>{const i=$('#itemScale');if(i){i.value=Math.min(Number(i.max),Number(i.value)+5);dispatch(i)}}},{label:'한 단계 축소',action:()=>{const i=$('#itemScale');if(i){i.value=Math.max(Number(i.min),Number(i.value)-5);dispatch(i)}}}]},{label:'전체',items:[{label:'가이드 켜기',action:()=>$('#guideOnBtn')?.click()},{label:'완성본 보기',action:()=>$('#guideOffBtn')?.click()},{label:'전체 배치 초기화',className:'danger',action:()=>$('#resetAllLayoutBtn')?.click()}]}]}))}
  }
  function addPdfEditorMenu(){if(!location.pathname.includes('pdf-editor'))return;const canvas=$('canvas');if(canvas)ProgramContextMenu.bind(canvas,()=>({groups:[{label:'페이지 편집',items:[{label:'미리보기 다시 그리기',action:()=>window.renderPreview?.()},{label:'선택 페이지 초기화',action:()=>window.location.reload()}]}]}));
    $$('input[type=color]').forEach(el=>{const label=(el.closest('.field')?.textContent||'').toLowerCase();if(label.includes('간지')||el.id.toLowerCase().includes('divider')){el.value='#ffffff';el.dataset.transparent='true'}})
  }
  function addPdfToolMenu(){if(!location.pathname.includes('pdf-Checker'))return;const zone=$('.upload-zone');if(zone)ProgramContextMenu.bind(zone,()=>({groups:[{label:'파일',items:[{label:'PDF 파일 선택',action:()=>$('#fileInput')?.click()},{label:'선택 초기화',className:'danger',action:()=>$('#resetBtn')?.click()}]},{label:'도구',items:[...$$('.action-btn').map(btn=>({label:btn.querySelector('.action-name')?.textContent||btn.textContent.trim(),disabled:btn.disabled,action:()=>btn.click()}))]}]}))}
  document.addEventListener('DOMContentLoaded',()=>{bindFormMenus();addCoverFields();addPdfEditorMenu();addPdfToolMenu()});
})();