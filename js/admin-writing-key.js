(function(){
  if(window.__adminPublicDefaultsFromWritingV1)return;
  window.__adminPublicDefaultsFromWritingV1=true;
  if(!location.pathname.endsWith('/admin.html'))return;
  var FLAGS={
    'design-studio':true,
    'pdf-editor':true,
    'preflight':true,
    'invoice':true,
    'report':true,
    'writing':true
  };
  function wait(fn,n){
    n=n||0;
    if(window.auth&&window.db){fn();return;}
    if(n>100)return;
    setTimeout(function(){wait(fn,n+1);},100);
  }
  async function apply(){
    try{
      await db.collection('settings').doc('programs').set({public:FLAGS},{merge:true});
      if(typeof window.loadPublicAccess==='function')window.loadPublicAccess();
      if(typeof window.renderUsers==='function')window.renderUsers();
    }catch(e){console.warn('[admin-public-defaults]',e);}
  }
  wait(function(){auth.onAuthStateChanged(function(user){if(user)apply();});});
})();
