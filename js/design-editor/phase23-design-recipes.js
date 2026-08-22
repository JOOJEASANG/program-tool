(function(){
  'use strict';
  if(window.__designEditorDesignRecipesV1)return;
  window.__designEditorDesignRecipesV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const CARD_ID='designRecipeTools';
  const STYLE_ID='designRecipeStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const RECIPES=Object.freeze({
    publicNotice:{name:'공공 안내',theme:'public',blocks:['title','event','contact','footer'],description:'제목·일정·문의·기관정보를 차분한 공공기관 스타일로 구성'},
    eventPoster:{name:'행사 포스터',theme:'event',blocks:['title','event','footer'],description:'행사 제목과 일정 정보를 강조하는 홍보형 구성'},
    cleanFlyer:{name:'깔끔 전단',theme:'clean',blocks:['title','contact','footer'],description:'핵심 제목과 연락처 중심의 단정한 전단 구성'},
    warmGuide:{name:'따뜻한 안내',theme:'warm',blocks:['title','event','contact'],description:'부드러운 분위기의 모임·교육·안내문 구성'}
  });
  let installed=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){const p=project();return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;}
  function setStatus(message,type='ok'){const node=byId('editorStatus');if(node){node.className=`editor-status ${type}`;node.textContent=message;}}

  function blockApi(){return window.DesignEditorComponentBlocks||null;}
  function applyBlock(kind){
    const api=blockApi();if(!api)return false;
    if(kind==='title')api.insertTitleBlock?.();
    else if(kind==='event')api.insertEventInfo?.();
    else if(kind==='contact')api.insertContactBlock?.();
    else if(kind==='footer')api.insertFooterBlock?.();
    else return false;
    return true;
  }

  function persistRecipe(surface,key){
    const p=project();if(!p||!surface)return;
    if(!Array.isArray(surface.designRecipesApplied))surface.designRecipesApplied=[];
    if(!surface.designRecipesApplied.includes(key))surface.designRecipesApplied.push(key);
    p.lastDesignRecipe=key;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.('design-recipe');
  }

  function applyRecipe(key){
    const recipe=RECIPES[key],current=surface(),api=blockApi();
    if(!recipe||!current)return;
    if(!api)return setStatus('빠른 구성 모듈을 아직 불러오지 못했습니다.','err');
    if(Array.isArray(current.designRecipesApplied)&&current.designRecipesApplied.includes(key))return setStatus('이 면에는 같은 스타터 레시피가 이미 적용되어 있습니다.','info');
    recipe.blocks.forEach(applyBlock);
    window.DesignEditorStyleThemes?.applyTheme?.(recipe.theme);
    persistRecipe(current,key);
    setTimeout(()=>{
      window.DesignEditorPhase2?.sync?.();
      window.DesignEditorCanvasQuickbar?.sync?.();
      renderSelected();
      setStatus(`${recipe.name} 스타터 구성을 추가했습니다. 기존 내용은 삭제하지 않았습니다.`,'ok');
    },120);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .design-recipe-grid{display:grid;gap:6px}.design-recipe-btn{border:1px solid #d8e1e8;border-radius:10px;background:#fff;padding:8px 9px;text-align:left;cursor:pointer}.design-recipe-btn:hover{border-color:#86beca;background:#f8fdff}.design-recipe-btn.on{border-color:#1d9bb2;background:#f0fdff}.design-recipe-btn strong{display:block;font-size:8px;color:#12396d}.design-recipe-btn span{display:block;margin-top:3px;font-size:6.8px;line-height:1.4;color:#778391}.design-recipe-note{margin:7px 0 0;font-size:6.8px;line-height:1.45;color:#8793a1}
    `;document.head.appendChild(style);
  }

  function renderSelected(){
    const current=surface(),applied=new Set(current?.designRecipesApplied||[]);
    document.querySelectorAll('[data-design-recipe]').forEach(button=>button.classList.toggle('on',applied.has(button.dataset.designRecipe)));
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),inspector=byId('inspector');if(!sidebar||!inspector)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';card.style.order='-7';
    card.innerHTML=`<div class="side-label">스타터 디자인 레시피</div><div class="design-recipe-grid">${Object.entries(RECIPES).map(([key,item])=>`<button type="button" class="design-recipe-btn" data-design-recipe="${key}"><strong>${item.name}</strong><span>${item.description}</span></button>`).join('')}</div><p class="design-recipe-note">기존 글자·사진·도형은 삭제하지 않고 필요한 구성요소를 추가한 뒤 전체 색상 분위기를 맞춥니다. 같은 면에는 동일 레시피를 중복 추가하지 않습니다.</p>`;
    sidebar.insertBefore(card,inspector);
    card.querySelectorAll('[data-design-recipe]').forEach(button=>button.addEventListener('click',()=>applyRecipe(button.dataset.designRecipe)));
    renderSelected();return true;
  }

  function install(){
    if(installed)return true;
    if(!window.DesignEditorApp||!window.DesignEditorComponentBlocks||!window.DesignEditorStyleThemes)return false;
    installStyles();if(!installCard())return false;installed=true;
    window.DesignEditorDesignRecipes={applyRecipe,recipes:RECIPES,stage:'non-destructive-mode-ready-starter-recipes'};
    return true;
  }
  function boot(){if(install())return;[250,550,950,1600,2600,3800].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
