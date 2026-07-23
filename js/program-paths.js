(function(){
  if(window.__programStudioPathMapper)return;
  window.__programStudioPathMapper=true;
  const routes=new Map([
    ['/tools/pdf-editor.html','/pdf-editor/'],
    ['/tools/preflight.html','/pdf-preflight/'],
    ['/tools/pdf-Checker.html','/pdf-preflight/'],
    ['/tools/perfect-binding-cover.html','/perfect-binding-cover/']
  ]);
  function rewrite(root=document){root.querySelectorAll?.('a[href]').forEach(a=>{try{const u=new URL(a.getAttribute('href'),location.href);const target=routes.get(u.pathname);if(target){u.pathname=target;a.href=u.pathname+u.search+u.hash}}catch(_){}})}
  function boot(){rewrite();const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)rewrite(n)})));observer.observe(document.documentElement,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
