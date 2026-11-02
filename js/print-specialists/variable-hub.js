// One entry point for general and multi-up variable printing.
(function(){
'use strict';
if(window.__variablePrintHubV1)return;window.__variablePrintHubV1=true;
function install(){
  if(!window.PrintSpecialistUi)return setTimeout(install,80);
  const ui=window.PrintSpecialistUi;
  ui.register('variable-hub',{
    title:'가변데이터 자동인쇄',
    description:'원본 PDF와 엑셀 명단으로 서로 다른 인쇄물을 한 번에 제작',
    markup:[
      '<p class="ps-help">작업물 크기와 출력 방식에 맞춰 선택하세요. 원본 디자인은 그대로 두고 이름·번호·학년·주소 같은 가변 내용만 자동으로 바뀝니다.</p>',
      '<div class="ps-fields">',
      '<label class="wide">가변인쇄 방식<select id="vhMode">',
      '<option value="certificates">일반 가변인쇄 · 한 사람당 1페이지 (상장·수료증·초청장 등)</option>',
      '<option value="multi-variable">다단 가변인쇄 · 한 용지에 서로 다른 여러 사람 (명찰·쿠폰·회원증·라벨 등)</option>',
      '<option value="variable">간편 명찰·번호표·QR 자동 출력 (기존 기능)</option>',
      '</select></label>',
      '</div>',
      '<p id="vhInfo" class="ps-help"></p>',
      '<div class="ps-actions"><button id="vhStart" type="button" class="ps-btn">선택한 방식으로 작업 시작</button></div>',
      '<p class="ps-note">일반/다단 모두 원본 1페이지 PDF + Excel·CSV를 사용합니다. 다단은 PDF 자체의 크기가 완성품 재단 크기여야 합니다. 1회 최대 300건, 출력은 인쇄 배율 100%를 권장합니다. QR코드가 필요하면 간편 명찰·번호표 모드를 선택하세요.</p>'
    ].join(''),
    bind(body){
      const select=body.querySelector('#vhMode'),info=body.querySelector('#vhInfo');
      function refresh(){
        info.textContent=select.value==='certificates'
          ?'예: 상장 PDF 1개 + 100명 엑셀 → 이름·생년월일·학년이 달라지는 A4 PDF 100페이지'
          :select.value==='multi-variable'
          ?'예: 90×50mm 명찰 PDF 1개 + 100명 엑셀 → A3 한 장마다 서로 다른 명찰 여러 개 배치, 재단선 선택 가능'
          :'예: 원본 디자인이 없는 이름표·번호표·QR 쿠폰을 엑셀 명단으로 빠르게 생성';
      }
      select.addEventListener('change',refresh);
      body.querySelector('#vhStart').addEventListener('click',()=>ui.open(select.value));
      refresh();
    }
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();