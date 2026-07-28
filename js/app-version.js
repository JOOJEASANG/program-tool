// Program Studio version observer. Version changes are recorded without forcing a reload.
(function(){
  if(window.__appVersionObserverV4)return;
  window.__appVersionObserverV4=true;
  if(/^\/login(?:\.html)?\/?$/.test(location.pathname))return;

  const LOCAL_KEY='programStudioVersion';

  async function check(){
    try{
      const response=await fetch('/version.json?t='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache'}
      });
      if(!response.ok)return;
      const data=await response.json();
      const currentVersion=String(data.version||'').trim();
      if(!currentVersion||currentVersion==='unknown')return;

      const previousVersion=localStorage.getItem(LOCAL_KEY)||'';
      localStorage.setItem(LOCAL_KEY,currentVersion);
      window.ProgramStudioVersion={
        version:currentVersion,
        previousVersion,
        changed:Boolean(previousVersion&&previousVersion!==currentVersion),
        label:String(data.label||''),
        updatedAt:String(data.updatedAt||'')
      };

      if(previousVersion&&previousVersion!==currentVersion){
        window.dispatchEvent(new CustomEvent('program-studio-version-changed',{
          detail:window.ProgramStudioVersion
        }));
      }
    }catch(error){
      console.warn('Program Studio version check failed',error);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',check,{once:true});
  }else{
    check();
  }
})();
