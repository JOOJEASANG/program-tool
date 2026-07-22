(()=>{
'use strict';
if(!location.pathname.includes('perfect-binding-cover'))return;
/* 레이어·속성 기능은 사용 흐름을 단순화하기 위해 제거했습니다.
   기존 저장값이 렌더링을 덮어쓰지 않도록 이 파일은 의도적으로 비활성 상태를 유지합니다. */
try{localStorage.removeItem('programTool.coverEditor.layerStyle.v1')}catch(_){}
function cleanup(){
  ['coverLayerStylePanel','coverLayerProperty'].forEach(id=>document.getElementById(id)?.remove());
  ['posX','posY','itemScale','spinePartX','spinePartY','spinePartScale'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(cleanup,120));else setTimeout(cleanup,120);
})();