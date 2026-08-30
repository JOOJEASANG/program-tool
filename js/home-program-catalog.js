// Apply the administrator-managed public program catalog to the home page.
(function(){
  'use strict';
  if(window.__homeProgramCatalogV1)return;
  window.__homeProgramCatalogV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/'&&path!=='/index.html')return;

  const DOC_ID='public_program_catalog';
  const text=v=>String(v==null?'':v);
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const breaks=v=>esc(v).replace(/\r?\n/g,'<br>');
  const ICONS={
    design:'M4 20h4L19 9a2 2 0 0 0 0-3l-1-1a2 2 0 0 0-3 0L4 16v4Zm10-13 4 4M4 21h16',
    pdf:'M6 3h8l4 4v14H6V3Zm8 0v5h4M9 12h2v2H9v-2Zm4 0h2v2h-2v-2Zm-4 4h2m2 0h2',
    check:'M6 3h8l4 4v5M14 3v5h4M6 3v18h7m1-4 2 2 4-5',
    image:'M4 5h16v14H4V5Zm2 11 4-4 3 3 2-2 3 3M9 9h.01'
  };

  function ready(){return window.ProgramCatalogCore&&window.db&&typeof CATEGORIES!=='undefined'&&typeof buildNav==='function'&&typeof switchCategory==='function';}
  function homeCategory(c){return{label:text(c.name),accent:c.accent,title:text(c.sectionTitle||c.name),badge:text(c.badge),heroTitle:`${esc(c.heroTitle||c.name)}${c.heroAccent?` <span>${esc(c.heroAccent)}</span>`:''}`,lead:text(c.lead),copy:breaks(c.copy),visual:[text(c.visualIcon||'🧰'),text(c.visualTitle||c.name),text(c.visualText)],programs:c.programs.map(p=>({name:esc(p.name),icon:esc(p.icon||'🧰'),accent:p.accent,bg:p.bg,desc:esc(p.desc),url:window.ProgramCatalogCore.safeUrl(p.url),tags:p.tags.map(esc),coming:p.status!=='active'||!window.ProgramCatalogCore.safeUrl(p.url)}))};}

  function iconKey(card){
    const href=text(card.getAttribute('href')).toLowerCase(),name=text(card.querySelector('.name')?.textContent).replace(/\s+/g,'');
    if(href.includes('design-editor')||name.includes('디자인'))return'design';
    if(href.includes('pdf-preflight')||name.includes('인쇄전검사')||name.includes('검사'))return'check';
    if(href.includes('pdf-editor')||name.includes('PDF편집'))return'pdf';
    if(href.includes('image-editor')||name.includes('이미지'))return'image';
    return'';
  }
  function decorateProgramIcons(){
    document.querySelectorAll('#programGrid .card').forEach(card=>{
      const icon=card.querySelector('.icon'),key=iconKey(card);if(!icon||!key)return;
      icon.setAttribute('aria-hidden','true');
      icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${ICONS[key]}"/></svg>`;
    });
  }
  function installIcons(){
    if(!document.getElementById('homeProgramIconStyleV1')){
      const s=document.createElement('style');s.id='homeProgramIconStyleV1';s.textContent='#programGrid .card .icon svg{width:29px;height:29px}';document.head.appendChild(s);
    }
    decorateProgramIcons();
    const grid=document.getElementById('programGrid');
    if(grid&&typeof MutationObserver==='function'&&!grid.dataset.iconWatch){grid.dataset.iconWatch='1';new MutationObserver(decorateProgramIcons).observe(grid,{childList:true});}
  }

  function applyHeroTheme(id){const c=window.__programCatalogById?.[id],hero=document.getElementById('hero');if(c&&hero)hero.style.background=`linear-gradient(145deg,#071a38,#0b2a55 50%,${c.accent})`;}
  function installSwitchTheme(){
    if(window.__programCatalogSwitchWrapped||typeof switchCategory!=='function')return;
    const delegate=switchCategory;
    switchCategory=function(key,scroll){const result=delegate(key,scroll);applyHeroTheme(key);decorateProgramIcons();return result;};
    window.__programCatalogSwitchWrapped=true;
  }
  function applyCatalog(raw){
    if(!ready())return false;
    const catalog=window.ProgramCatalogCore.publicCatalog(raw);if(!catalog.categories.length)return false;
    const next={},byId={};for(const c of catalog.categories){next[c.id]=homeCategory(c);byId[c.id]=c;}
    Object.keys(CATEGORIES).forEach(k=>delete CATEGORIES[k]);Object.assign(CATEGORIES,next);window.__programCatalogById=byId;installSwitchTheme();
    document.getElementById('studioNav')?.replaceChildren();const first=catalog.categories[0].id;active=first;buildNav();switchCategory(first,false);decorateProgramIcons();
    document.documentElement.dataset.managedProgramCatalog='1';window.dispatchEvent(new CustomEvent('program-catalog-applied',{detail:{categories:catalog.categories.length}}));return true;
  }
  async function loadCatalog(){if(!ready())return false;try{const snap=await db.collection('settings').doc(DOC_ID).get();return snap.exists?applyCatalog(snap.data()||{}):false;}catch(error){console.warn('Managed program catalog load failed; static home catalog remains active.',error);return false;}}
  async function install(){installIcons();for(let i=0;i<10;i+=1){if(ready())return loadCatalog();await new Promise(r=>setTimeout(r,180));}return false;}

  window.HomeProgramCatalog={install,loadCatalog,applyCatalog,decorateProgramIcons,stage:'admin-managed-home-navigation-and-programs-with-svg-icons'};
  install();
})();