(function(){
  if(window.__homeHeaderFooterRefineV1)return;
  window.__homeHeaderFooterRefineV1=true;

  function injectStyles(){
    if(document.getElementById('homeHeaderFooterRefineStyles'))return;
    const style=document.createElement('style');
    style.id='homeHeaderFooterRefineStyles';
    style.textContent=`
      .user{
        gap:7px!important;
        padding:4px 9px 4px 4px!important;
        border-radius:12px!important;
        border-color:#dce4ee!important;
        background:#f8fafc!important;
        box-shadow:0 1px 2px rgba(15,23,42,.04)!important;
        transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important;
      }
      .user:hover,.user.open{
        border-color:#c7d3e1!important;
        background:#fff!important;
        box-shadow:0 7px 18px rgba(15,23,42,.08)!important;
      }
      .avatar{
        width:28px!important;
        height:28px!important;
        border-radius:8px!important;
        font-size:10px!important;
        font-weight:900!important;
        box-shadow:none!important;
        flex:0 0 28px!important;
      }
      .user-name{
        max-width:88px!important;
        font-size:11px!important;
        font-weight:850!important;
        color:#344054!important;
      }
      .dropdown{
        top:calc(100% + 8px)!important;
        width:220px!important;
        padding:7px!important;
        border-radius:14px!important;
        box-shadow:0 18px 45px rgba(15,23,42,.16)!important;
      }
      .account-simple{gap:9px!important;padding:10px!important}
      .account-mini{
        width:30px!important;
        height:30px!important;
        border-radius:9px!important;
        font-size:11px!important;
        flex:0 0 30px!important;
      }
      .footer-business{display:none!important}
      .footer-business-name{
        color:rgba(255,255,255,.72);
        font-size:11px;
        font-weight:800;
        white-space:nowrap;
        padding-left:18px;
        border-left:1px solid rgba(255,255,255,.18);
      }
      @media(max-width:760px){
        .user{padding-right:5px!important}
        .user-name{display:none!important}
        .footer-business-name{padding-left:0;border-left:0}
      }
    `;
    document.head.appendChild(style);
  }

  function findCopyright(footer){
    const direct=[...footer.querySelectorAll('.footer-right > span')];
    return direct.find(el=>(el.textContent||'').includes('©'))
      || [...footer.querySelectorAll('span')].find(el=>(el.textContent||'').includes('©'))
      || null;
  }

  async function loadBusinessName(){
    const footer=document.querySelector('footer');
    if(!footer)return;
    const copyright=findCopyright(footer);
    if(!copyright)return;

    let label=footer.querySelector('.footer-business-name');
    if(!label){
      label=document.createElement('span');
      label.className='footer-business-name';
      label.hidden=true;
      copyright.insertAdjacentElement('afterend',label);
    }

    try{
      let snap=await db.collection('settings').doc('business').get().catch(()=>null);
      if(!snap||!snap.exists)snap=await db.collection('site_settings').doc('business').get().catch(()=>null);
      const business=snap&&snap.exists?snap.data():{};
      const name=String(business.bizName||'').trim();
      if(!name){label.remove();return;}
      label.textContent=name;
      label.hidden=false;
    }catch(_){
      label.remove();
    }
  }

  function keepDetailedBusinessHidden(){
    const footer=document.querySelector('footer');
    if(!footer||footer.__businessDetailObserver)return;
    footer.__businessDetailObserver=true;
    new MutationObserver(()=>{
      footer.querySelectorAll('.footer-business').forEach(el=>el.setAttribute('aria-hidden','true'));
    }).observe(footer,{childList:true,subtree:true});
  }

  function boot(){injectStyles();keepDetailedBusinessHidden();loadBusinessName()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();