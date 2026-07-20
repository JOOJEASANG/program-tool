const firebaseConfig = {
  apiKey: "AIzaSyAfbBsZVWfUXyDxP-FrNdnO4r71dnmAd1U",
  authDomain: "program-tool.firebaseapp.com",
  projectId: "program-tool",
  storageBucket: "program-tool.firebasestorage.app",
  messagingSenderId: "660190959615",
  appId: "1:660190959615:web:86959be41774132c84b9ca",
  measurementId: "G-1Y1FC82J4X"
};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth();
const googleProvider=new firebase.auth.GoogleAuthProvider();
const db=firebase.firestore();

window.ProgramAccess={
  normalizeEmail:v=>String(v||'').trim().toLowerCase(),
  async isAdmin(user){
    if(!user)return false;
    const doc=await db.collection('settings').doc('admin').get();
    if(!doc.exists)return false;
    const email=this.normalizeEmail(user.email);
    return (doc.data().emails||[]).map(this.normalizeEmail).includes(email);
  },
  async ensureUserDocument(user){
    if(!user)return null;
    const ref=db.collection('users').doc(user.uid);
    const snap=await ref.get();
    const common={email:this.normalizeEmail(user.email),displayName:user.displayName||'',photoURL:user.photoURL||'',lastLoginAt:firebase.firestore.FieldValue.serverTimestamp()};
    if(!snap.exists){
      await ref.set({...common,status:'pending',createdAt:firebase.firestore.FieldValue.serverTimestamp(),approvedAt:null,approvedBy:null});
      return {...common,status:'pending'};
    }
    await ref.set(common,{merge:true});
    return snap.data();
  },
  async getAccess(user){
    if(!user)return{loggedIn:false,admin:false,approved:false,status:'signed_out'};
    const admin=await this.isAdmin(user).catch(()=>false);
    const profile=await this.ensureUserDocument(user);
    const status=admin?'approved':String(profile?.status||'pending');
    return{loggedIn:true,admin,approved:admin||status==='approved',status,profile};
  },
  async guardTool(options={}){
    const loginUrl=options.loginUrl||'../login.html';
    const waitingUrl=options.waitingUrl||'../approval-waiting.html';
    return new Promise(resolve=>auth.onAuthStateChanged(async user=>{
      if(!user){location.replace(loginUrl);return;}
      try{
        const access=await this.getAccess(user);
        if(!access.approved){location.replace(`${waitingUrl}?status=${encodeURIComponent(access.status||'pending')}`);return;}
        document.documentElement.dataset.accessReady='true'; resolve(access);
      }catch(e){console.error(e);location.replace(`${waitingUrl}?status=error`);}
    }));
  }
};

(()=>{
  const path=location.pathname.replace(/\\/g,'/');
  const protectedTools=['/tools/pdf-editor.html','/tools/preflight.html','/tools/perfect-binding-cover.html'];
  if(protectedTools.some(item=>path.endsWith(item))){
    document.documentElement.style.visibility='hidden';
    ProgramAccess.guardTool().then(()=>document.documentElement.style.visibility='');
  }
})();
