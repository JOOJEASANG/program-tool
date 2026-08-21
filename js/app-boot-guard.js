(function(){
  if(window.__programStudioBootGuardV2)return;
  window.__programStudioBootGuardV2=true;

  const root=document.documentElement;
  root.classList.add('app-booting');

  const style=document.createElement('style');
  style.id='programStudioBootGuardStyle';
  style.textContent=`
    html.app-booting body{pointer-events:none!important}
    html.app-booting::before{
      content:"";position:fixed;inset:0;z-index:2147483646;background:rgba(248,250,252,.96);
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

  // Access checks can take several seconds on a cold Firebase session. Keep the
  // already-rendered tool visible while permission is checked instead of showing
  // a blank page. Redirect behavior remains controlled by firebase-config.js.
  const accessStyle=document.createElement('style');
  accessStyle.id='programStudioAccessVisibilityStyle';
  accessStyle.textContent='html[data-access-checking] body{visibility:visible!important}';
  document.head.appendChild(accessStyle);

  let revealed=false;
  function reveal(){
    if(revealed)return;
    revealed=true;
    root.classList.remove('app-booting');
    root.dataset.appReady='true';
    requestAnimationFrame(()=>style.remove());
  }

  window.ProgramStudioBoot={...(window.ProgramStudioBoot||{}),reveal};
  window.addEventListener('pageshow',event=>{if(event.persisted)reveal()});
  setTimeout(reveal,1800);
})();
