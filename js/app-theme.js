(function(root){
  'use strict';
  if(root.ProgramStudioTheme)return;

  const STORAGE_KEY='program-studio-theme';
  const THEMES=new Set(['light','dark']);
  const doc=document;
  const html=doc.documentElement;

  function storedTheme(){
    try{
      const value=root.localStorage.getItem(STORAGE_KEY);
      return THEMES.has(value)?value:null;
    }catch(_){return null;}
  }

  function normalize(theme){return THEMES.has(theme)?theme:'light';}

  function apply(theme,{persist=true,emit=true}={}){
    const next=normalize(theme);
    html.dataset.psTheme=next;
    html.style.colorScheme=next;
    if(persist){try{root.localStorage.setItem(STORAGE_KEY,next)}catch(_){}}
    updateButtons(next);
    if(emit)root.dispatchEvent(new CustomEvent('programstudio:themechange',{detail:{theme:next}}));
    return next;
  }

  function current(){return normalize(html.dataset.psTheme||storedTheme()||'light');}

  function toggle(){return apply(current()==='dark'?'light':'dark');}

  function buttonLabel(theme){return theme==='dark'?'☀ 라이트':'☾ 다크';}

  function updateButtons(theme=current()){
    doc.querySelectorAll('[data-program-studio-theme-toggle]').forEach(button=>{
      button.textContent=buttonLabel(theme);
      button.setAttribute('aria-label',theme==='dark'?'라이트 모드로 변경':'다크 모드로 변경');
      button.setAttribute('title',theme==='dark'?'라이트 모드':'다크 모드');
      button.setAttribute('aria-pressed',theme==='dark'?'true':'false');
    });
  }

  function createButton(){
    const button=doc.createElement('button');
    button.type='button';
    button.className='ps-theme-toggle';
    button.dataset.programStudioThemeToggle='1';
    button.addEventListener('click',toggle);
    updateButton(button,current());
    return button;
  }

  function updateButton(button,theme){
    button.textContent=buttonLabel(theme);
    button.setAttribute('aria-label',theme==='dark'?'라이트 모드로 변경':'다크 모드로 변경');
    button.setAttribute('title',theme==='dark'?'라이트 모드':'다크 모드');
    button.setAttribute('aria-pressed',theme==='dark'?'true':'false');
  }

  function findMount(){
    const selectors=[
      '.header-actions', '.nav-user', '.topbar-actions', '.top-bar-actions',
      '.toolbar-actions', '.app-actions', '.header-right', '.nav-actions'
    ];
    for(const selector of selectors){
      const node=doc.querySelector(selector);
      if(node)return node;
    }
    return null;
  }

  function mount(){
    if(doc.querySelector('[data-program-studio-theme-toggle]')){updateButtons();return;}
    const button=createButton();
    const target=findMount();
    if(target){target.appendChild(button);return;}
    button.classList.add('ps-theme-toggle-floating');
    doc.body.appendChild(button);
  }

  const initial=normalize(storedTheme()||'light');
  apply(initial,{persist:false,emit:false});

  function boot(){mount();updateButtons();doc.documentElement.dataset.programStudioThemeReady='1';}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();

  root.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY||!THEMES.has(event.newValue))return;
    apply(event.newValue,{persist:false});
  });

  root.ProgramStudioTheme={apply,toggle,current,storageKey:STORAGE_KEY,stage:'program-studio-theme-v1'};
})(window);
