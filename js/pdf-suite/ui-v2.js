// Program Studio PDF Utility Workspace v2 — category, search and progressive disclosure UX.
(function(){
  'use strict';
  if(window.__programStudioPdfSuiteUiV2)return;
  window.__programStudioPdfSuiteUiV2=true;

  const $=id=>document.getElementById(id);
  let category='all';
  let showPlanned=false;

  function normalize(value){
    return String(value||'').trim().toLowerCase().replace(/\s+/g,' ');
  }

  function tools(){
    return Array.from(document.querySelectorAll('.catalog .tool[data-status]'));
  }

  function sections(){
    return Array.from(document.querySelectorAll('.catalog .section[data-category]'));
  }

  function visibleToolCount(){
    return tools().filter(tool=>!tool.classList.contains('hidden-tool')).length;
  }

  function availableToolCount(){
    return tools().filter(tool=>tool.dataset.status!=='planned').length;
  }

  function updateCount(query){
    const node=$('suiteResultCount');
    if(!node)return;
    const count=visibleToolCount();
    const total=availableToolCount();
    if(query)node.innerHTML=`검색 결과 <strong>${count}개</strong>`;
    else if(category!=='all')node.innerHTML=`선택 카테고리 <strong>${count}개</strong>`;
    else node.innerHTML=`바로 사용할 수 있는 도구 <strong>${total}개</strong>${showPlanned?` · 준비 중 포함 <strong>${count}개</strong>`:''}`;
  }

  function apply(){
    const search=$('suiteSearch');
    const query=normalize(search?.value);
    let matched=0;

    tools().forEach(tool=>{
      const section=tool.closest('.section[data-category]');
      const toolCategory=section?.dataset.category||'';
      const planned=tool.dataset.status==='planned';
      const text=normalize(`${tool.textContent||''} ${tool.dataset.keywords||''}`);
      const categoryMatch=category==='all'||toolCategory===category;
      const searchMatch=!query||text.includes(query);
      const plannedMatch=!planned||showPlanned;
      const visible=categoryMatch&&searchMatch&&plannedMatch;
      tool.classList.toggle('hidden-tool',!visible);
      if(visible)matched+=1;
    });

    sections().forEach(section=>{
      const anyVisible=Boolean(section.querySelector('.tool[data-status]:not(.hidden-tool)'));
      section.classList.toggle('hidden-section',!anyVisible);
    });

    const clear=$('suiteSearchClear');
    clear?.classList.toggle('show',Boolean(query));
    const zero=$('suiteZeroState');
    zero?.classList.toggle('show',matched===0);
    $('futurePanel')?.classList.toggle('show',showPlanned&&category==='all'&&!query);
    updateCount(query);

    document.documentElement.dataset.pdfSuiteCategory=category;
    document.documentElement.dataset.pdfSuiteShowPlanned=showPlanned?'1':'0';
    document.documentElement.dataset.pdfSuiteVisibleTools=String(matched);
  }

  function setCategory(next){
    category=next||'all';
    const tabs=$('suiteCategoryTabs');
    tabs?.querySelectorAll('[data-category-filter]').forEach(button=>{
      const active=button.dataset.categoryFilter===category;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',active?'true':'false');
      button.tabIndex=active?0:-1;
    });
    apply();
  }

  function bindCategoryTabs(){
    const tabs=$('suiteCategoryTabs');
    if(!tabs||tabs.dataset.bound==='1')return;
    tabs.dataset.bound='1';
    tabs.addEventListener('click',event=>{
      const button=event.target.closest('[data-category-filter]');
      if(!button)return;
      setCategory(button.dataset.categoryFilter||'all');
    });
    tabs.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const buttons=Array.from(tabs.querySelectorAll('[data-category-filter]'));
      if(!buttons.length)return;
      const current=Math.max(0,buttons.indexOf(document.activeElement));
      let next=current;
      if(event.key==='ArrowRight')next=(current+1)%buttons.length;
      else if(event.key==='ArrowLeft')next=(current-1+buttons.length)%buttons.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=buttons.length-1;
      event.preventDefault();
      buttons[next].focus();
      setCategory(buttons[next].dataset.categoryFilter||'all');
    });
  }

  function bindSearch(){
    const search=$('suiteSearch');
    const clear=$('suiteSearchClear');
    if(search&&search.dataset.uiV2Bound!=='1'){
      search.dataset.uiV2Bound='1';
      search.addEventListener('input',apply);
      search.addEventListener('keydown',event=>{
        if(event.key==='Escape'&&search.value){
          search.value='';
          apply();
        }
      });
    }
    if(clear&&clear.dataset.uiV2Bound!=='1'){
      clear.dataset.uiV2Bound='1';
      clear.addEventListener('click',()=>{
        if(search)search.value='';
        apply();
        search?.focus();
      });
    }
  }

  function bindPlannedToggle(){
    const button=$('showPlanned');
    if(!button||button.dataset.bound==='1')return;
    button.dataset.bound='1';
    button.addEventListener('click',()=>{
      showPlanned=!showPlanned;
      button.setAttribute('aria-pressed',showPlanned?'true':'false');
      button.textContent=showPlanned?'준비 중 기능 숨기기':'준비 중 기능 보기';
      apply();
    });
  }

  function bindQuickSearchShortcut(){
    document.addEventListener('keydown',event=>{
      const target=event.target;
      const typing=target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target?.isContentEditable;
      if(typing)return;
      if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey){
        event.preventDefault();
        $('suiteSearch')?.focus();
      }
    });
  }

  function boot(){
    bindCategoryTabs();
    bindSearch();
    bindPlannedToggle();
    bindQuickSearchShortcut();
    setCategory('all');
    window.ProgramStudioPdfSuiteUi=Object.freeze({
      apply,
      setCategory,
      getState:()=>({category,showPlanned,visible:visibleToolCount()}),
      stage:'pdf-suite-workspace-v2'
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();