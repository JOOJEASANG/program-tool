(function(){
  'use strict';
  if(window.__programStudioUiBootstrapV2)return;
  window.__programStudioUiBootstrapV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  const isHome=path==='/'||path==='/index.html';

  if(isHome&&!document.getElementById('programStudioSimpleHomeSearch')){
    const style=document.createElement('style');
    style.id='programStudioSimpleHomeSearch';
    style.textContent=`
      body[data-home-suite] .search-wrap{
        flex:1!important;
        max-width:380px!important;
        height:36px!important;
        gap:0!important;
        padding:0 12px!important;
        background:#fff!important;
        border:1px solid #d8e0e8!important;
        border-radius:8px!important;
        box-shadow:none!important;
        transition:none!important;
      }
      body[data-home-suite] .search-wrap:focus-within{
        background:#fff!important;
        border-color:#aeb9c6!important;
        box-shadow:none!important;
      }
      body[data-home-suite] .search-icon{display:none!important}
      body[data-home-suite] .search{
        padding:0!important;
        background:transparent!important;
        border:0!important;
        outline:0!important;
        box-shadow:none!important;
        font-size:12px!important;
        font-weight:500!important;
        color:#1e293b!important;
      }
      body[data-home-suite] .search::placeholder{color:#9aa5b1!important}
      @media(max-width:768px){body[data-home-suite] .search-wrap{max-width:none!important;height:38px!important}}
    `;
    document.head.appendChild(style);
    const simplifyPlaceholder=()=>{
      const input=document.getElementById('search');
      if(input)input.placeholder='프로그램 검색';
    };
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',simplifyPlaceholder,{once:true});
    else simplifyPlaceholder();
  }

  const core=document.createElement('script');
  core.src='/js/program-studio-ui-v2-core.js?v=20261002-1';
  core.async=false;
  core.dataset.programStudioUiCore='1';
  core.addEventListener('error',()=>console.warn('Program Studio shared UI core could not be loaded.'));
  document.head.appendChild(core);
})();