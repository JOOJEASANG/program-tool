(function(){
  if(window.__adminPublicDefaultsV1)return;
  window.__adminPublicDefaultsV1=true;
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
  async function ok(user){
    if(!user)return false;
    var email=String(user.email||'').trim().toLowerCase();
    var doc=await db.collection('settings').doc('admin').get();
    var list=doc.exists?(doc.data().emails||[]):[];
    return list.map(function(e){return String(e).trim().toLowerCase();}).indexOf(email)>=0;
  }
  async function apply(user){
    try{
      if(!(await ok(user)))return;
      await db.collection('settings').doc('programs').set({public:FLAGS},{merge:true});
      if(typeof window.renderPublicList==='function')window.renderPublicList();
      if(typeof window.renderUsers==='function')window.renderUsers();
    }catch(e){console.warn('[admin-public-defaults]',e);}
  }
  wait(function(){auth.onAuthStateChanged(apply);});
})();
