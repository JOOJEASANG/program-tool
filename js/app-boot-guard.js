(function(){
  if(window.__programStudioBootGuardV1)return;
  window.__programStudioBootGuardV1=true;

  const root=document.documentElement;
  root.classList.add('app-booting');

  const style=document.createElement('style');
  style.id='programStudioBootGuardStyle';
  style.textContent=`
    html.app-booting body{opacity:0!important;pointer-events:none!important}
    html.app-booting::before{
      content:"";position:fixed;inset:0;z-index:2147483646;background:#f8fafc;
    }
    html.app-booting::after{
      content:"";position:fixed;left:50%;top:50%;z-index:2147483647;
      width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
      border:3px solid #dbe5ee;border-top-color:#1769e0;
      animation:programStudioBootSpin .72s linear infinite;
    }
    @keyframes programStudioBootSpin{to{transform:rotate(360deg)}}
    @media(prefers-reduced-motion:reduce){html.app-booting::after{animation-duration:1.4s}}
  `;
  document.head.appendChild(style);

  let revealed=false;
  function reveal(){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={reveal};
  window.addEventListener('pageshow',event=>{if(event.persisted)reveal()});
  setTimeout(reveal,5000);
})();