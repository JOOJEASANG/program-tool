(function(){
  if(window.__programStudioPlatformHealthV1)return;
  window.__programStudioPlatformHealthV1=true;

  const STORAGE_KEY='programStudioPlatformHealthV1';
  const MAX_EVENTS=30;
  const notices=new Map();
  let events=[];
  let container=null;

  function safePath(value){
    try{
      const url=new URL(String(value||''),location.origin);
      return url.origin===location.origin?url.pathname:'external-resource';
    }catch(_){
      return '';
    }
  }

  function readEvents(){
    try{
      const parsed=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
      if(Array.isArray(parsed))events=parsed.slice(-MAX_EVENTS);
    }catch(_){
      events=[];
    }
  }

  function persistEvents(){
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(events.slice(-MAX_EVENTS)))}catch(_){}
  }

  function record(type,detail={}){
    const safeDetail={};
    if(detail&&typeof detail==='object'){
      if(detail.id)safeDetail.id=String(detail.id).slice(0,100);
      if(detail.status)safeDetail.status=String(detail.status).slice(0,40);
      if(detail.name)safeDetail.name=String(detail.name).slice(0,80);
      if(detail.source)safeDetail.source=safePath(detail.source);
      if(Number.isFinite(Number(detail.line)))safeDetail.line=Number(detail.line);
      if(Number.isFinite(Number(detail.column)))safeDetail.column=Number(detail.column);
      if(Number.isFinite(Number(detail.failed)))safeDetail.failed=Math.max(0,Number(detail.failed));
      if(Number.isFinite(Number(detail.total)))safeDetail.total=Math.max(0,Number(detail.total));
    }
    events.push({
      time:new Date().toISOString(),
      type:String(type||'event').slice(0,60),
      path:location.pathname,
      detail:safeDetail
    });
    if(events.length>MAX_EVENTS)events=events.slice(-MAX_EVENTS);
    persistEvents();
  }

  function ensureUi(){
    if(container&&container.isConnected)return container;
    if(!document.body)return null;

    if(!document.getElementById('programStudioHealthStyles')){
      const style=document.createElement('style');
      style.id='programStudioHealthStyles';
      style.textContent=`
        #programStudioHealthNotices{position:fixed;right:14px;bottom:14px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;max-width:min(390px,calc(100vw - 28px));pointer-events:none;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .program-studio-health-notice{display:flex;align-items:flex-start;gap:10px;padding:11px 12px;border:1px solid rgba(15,23,42,.16);border-radius:12px;background:rgba(255,255,255,.97);box-shadow:0 12px 30px rgba(15,23,42,.16);color:#0f172a;font-size:13px;line-height:1.45;pointer-events:auto;backdrop-filter:blur(8px)}
        .program-studio-health-notice[data-tone="warning"]{border-color:rgba(180,83,9,.28);background:rgba(255,251,235,.98)}
        .program-studio-health-notice[data-tone="error"]{border-color:rgba(185,28,28,.28);background:rgba(254,242,242,.98)}
        .program-studio-health-notice[data-tone="success"]{border-color:rgba(21,128,61,.25);background:rgba(240,253,244,.98)}
        .program-studio-health-message{flex:1;min-width:0}
        .program-studio-health-actions{display:flex;gap:6px;flex:0 0 auto}
        .program-studio-health-notice button{border:1px solid rgba(15,23,42,.18);border-radius:8px;background:#fff;color:#0f172a;padding:5px 8px;font:inherit;font-weight:700;cursor:pointer}
        .program-studio-health-notice button:focus-visible{outline:3px solid rgba(37,99,235,.35);outline-offset:2px}
        @media(max-width:640px){#programStudioHealthNotices{left:10px;right:10px;bottom:10px;max-width:none}.program-studio-health-notice{font-size:12px}}
        @media(prefers-reduced-motion:reduce){.program-studio-health-notice{scroll-behavior:auto;transition:none!important;animation:none!important}}
      `;
      document.head.appendChild(style);
    }

    container=document.getElementById('programStudioHealthNotices');
    if(!container){
      container=document.createElement('div');
      container.id='programStudioHealthNotices';
      container.setAttribute('aria-live','polite');
      container.setAttribute('aria-relevant','additions text');
      document.body.appendChild(container);
    }
    return container;
  }

  function dismissNotice(key){
    const node=notices.get(key);
    if(node&&node.isConnected)node.remove();
    notices.delete(key);
  }

  function showNotice(key,{message,tone='warning',actionLabel='',onAction=null,autoHideMs=0}={}){
    const host=ensureUi();
    if(!host||!message)return;
    dismissNotice(key);

    const notice=document.createElement('div');
    notice.className='program-studio-health-notice';
    notice.dataset.tone=tone;
    notice.setAttribute('role',tone==='error'?'alert':'status');

    const text=document.createElement('div');
    text.className='program-studio-health-message';
    text.textContent=message;
    notice.appendChild(text);

    if(actionLabel&&typeof onAction==='function'){
      const actions=document.createElement('div');
      actions.className='program-studio-health-actions';
      const button=document.createElement('button');
      button.type='button';
      button.textContent=actionLabel;
      button.addEventListener('click',onAction);
      actions.appendChild(button);
      notice.appendChild(actions);
    }

    host.appendChild(notice);
    notices.set(key,notice);
    if(autoHideMs>0)setTimeout(()=>dismissNotice(key),autoHideMs);
  }

  function syncNetworkState(){
    if(navigator.onLine===false){
      record('network-offline');
      showNotice('network',{
        message:'인터넷 연결이 끊겼습니다. 서버 처리와 클라우드 저장은 연결 후 다시 시도하세요.',
        tone:'warning'
      });
      return;
    }
    if(notices.has('network')){
      dismissNotice('network');
      record('network-online');
      showNotice('network-restored',{
        message:'인터넷 연결이 복구되었습니다.',
        tone:'success',
        autoHideMs:2500
      });
    }
  }

  function showVersionNotice(detail){
    if(!detail||!detail.changed)return;
    record('version-changed',{name:detail.version});
    showNotice('version',{
      message:'새 버전이 배포되었습니다. 현재 작업을 저장한 뒤 새로고침하면 최신 기능이 적용됩니다.',
      tone:'warning',
      actionLabel:'새로고침',
      onAction:()=>location.reload()
    });
  }

  function showRuntimeFailure(detail){
    if(!detail||!['error','timeout'].includes(detail.status))return;
    record('runtime-script-failure',{
      id:detail.id,
      status:detail.status,
      source:detail.src
    });
    showNotice('runtime-failure',{
      message:'일부 기능을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 새로고침해 주세요.',
      tone:'error',
      actionLabel:'새로고침',
      onAction:()=>location.reload()
    });
  }

  function showRuntimeSummary(detail){
    const failed=Math.max(0,Number(detail?.failed)||0);
    if(!failed)return;
    record('runtime-startup-failure',{failed,total:Number(detail?.total)||0});
    showNotice('runtime-failure',{
      message:'일부 기능 초기화에 실패했습니다. 작업을 시작하기 전에 새로고침해 주세요.',
      tone:'error',
      actionLabel:'새로고침',
      onAction:()=>location.reload()
    });
  }

  function init(){
    ensureUi();
    syncNetworkState();
    showVersionNotice(window.ProgramStudioVersion);
  }

  readEvents();
  window.addEventListener('online',syncNetworkState);
  window.addEventListener('offline',syncNetworkState);
  window.addEventListener('program-studio-version-changed',event=>showVersionNotice(event.detail));
  window.addEventListener('programstudio:runtime-script-result',event=>showRuntimeFailure(event.detail));
  window.addEventListener('programstudio:runtime-ready',event=>showRuntimeSummary(event.detail));
  window.addEventListener('error',event=>{
    if(event.target&&event.target!==window){
      const source=event.target.src||event.target.href||'';
      record('resource-error',{name:event.target.tagName||'resource',source});
      return;
    }
    record('runtime-error',{
      name:event.error?.name||'Error',
      source:event.filename||'',
      line:event.lineno,
      column:event.colno
    });
  },true);
  window.addEventListener('unhandledrejection',event=>{
    record('unhandled-rejection',{name:event.reason?.name||'PromiseRejection'});
  });

  window.ProgramStudioHealth=Object.freeze({
    record,
    getReport(){
      return {
        generatedAt:new Date().toISOString(),
        path:location.pathname,
        online:navigator.onLine!==false,
        version:window.ProgramStudioVersion?.version||'',
        events:events.slice()
      };
    },
    clear(){events=[];persistEvents();}
  });

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
