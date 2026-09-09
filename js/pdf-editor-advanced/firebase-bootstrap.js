(function(){
  'use strict';
  if(window.__pdfAdvancedFirebaseBootstrapV1)return;
  window.__pdfAdvancedFirebaseBootstrapV1=true;

  const config={
    apiKey:'AIzaSyAfbBsZVWfUXyDxP-FrNdnO4r71dnmAd1U',
    authDomain:'program-tool.firebaseapp.com',
    projectId:'program-tool',
    storageBucket:'program-tool.firebasestorage.app',
    messagingSenderId:'660190959615',
    appId:'1:660190959615:web:86959be41774132c84b9ca',
    measurementId:'G-1Y1FC82J4X'
  };

  if(!window.firebase||typeof firebase.initializeApp!=='function'){
    window.ProgramAccessReady=Promise.reject(new Error('Firebase를 불러오지 못했습니다.'));
    return;
  }
  if(!firebase.apps.length)firebase.initializeApp(config);

  const auth=typeof firebase.auth==='function'?firebase.auth():null;
  const db=typeof firebase.firestore==='function'?firebase.firestore():null;
  window.auth=auth;
  window.db=db;
  window.firebaseConfig=config;

  const persistenceReady=auth
    ? auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error=>{
        console.warn('[pdf-advanced] auth persistence setup failed',error);
      })
    : Promise.resolve();
  window.authPersistenceReady=persistenceReady;

  function normalizedEmail(value){return String(value||'').trim().toLowerCase();}
  async function isAdmin(user){
    try{
      const token=await user.getIdTokenResult(false);
      if(token?.claims?.admin===true)return true;
    }catch(_){}
    if(!db||!user?.email)return false;
    try{
      const snap=await db.collection('settings').doc('admin').get();
      const emails=snap.exists&&Array.isArray(snap.data()?.emails)?snap.data().emails:[];
      return emails.map(normalizedEmail).includes(normalizedEmail(user.email));
    }catch(_){return false;}
  }
  async function approved(user){
    if(await isAdmin(user))return {allowed:true,admin:true,status:'approved'};
    if(!db)return {allowed:false,admin:false,status:'error'};
    try{
      const snap=await db.collection('user_permissions').doc(user.uid).get();
      const status=snap.exists?String(snap.data()?.status||'pending'):'pending';
      return {allowed:status==='approved',admin:false,status};
    }catch(_){return {allowed:false,admin:false,status:'error'};}
  }

  window.ProgramAccessReady=(async()=>{
    await persistenceReady;
    if(!auth)throw new Error('로그인 서비스를 사용할 수 없습니다.');
    return new Promise((resolve,reject)=>{
      let settled=false;
      let unsubscribe=()=>{};
      const finish=value=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        try{unsubscribe();}catch(_){}
        resolve(value);
      };
      const redirect=(url)=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        try{unsubscribe();}catch(_){}
        location.replace(url);
      };
      const timer=setTimeout(()=>reject(new Error('로그인 상태 확인 시간이 초과되었습니다.')),8000);
      unsubscribe=auth.onAuthStateChanged(async user=>{
        if(settled)return;
        if(!user){redirect('/login.html');return;}
        const access=await approved(user);
        if(!access.allowed){
          redirect(`/approval-waiting.html?status=${encodeURIComponent(access.status)}&program=pdf-editor`);
          return;
        }
        document.documentElement.dataset.programAccess='pdf-editor';
        finish(access);
      },reject);
    });
  })();

  document.documentElement.dataset.pdfAdvancedFirebase='ready';
})();
