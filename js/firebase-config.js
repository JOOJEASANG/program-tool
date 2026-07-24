const firebaseConfig = {
  apiKey: "AIzaSyAfbBsZVWfUXyDxP-FrNdnO4r71dnmAd1U",
  authDomain: "program-tool.firebaseapp.com",
  projectId: "program-tool",
  storageBucket: "program-tool.firebasestorage.app",
  messagingSenderId: "660190959615",
  appId: "1:660190959615:web:86959be41774132c84b9ca",
  measurementId: "G-1Y1FC82J4X"
};
if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth=typeof firebase.auth==='function'?firebase.auth():null;
const googleProvider=auth?new firebase.auth.GoogleAuthProvider():null;
const db=firebase.firestore();
window.auth=auth;
window.db=db;
window.googleProvider=googleProvider;
window.firebaseConfig=firebaseConfig;

// 모든 주요 페이지에서 동일한 캐시·버전 관리 모듈을 한 번만 실행합니다.
(()=>{if(document.getElementById('programStudioCacheBootstrap'))return;const s=document.createElement('script');s.id='programStudioCacheBootstrap';s.src='/js/sw-register.js?v=2026.07.24.020';s.defer=true;document.head.appendChild(s)})();

window.ProgramAccess={
  normalizeEmail:v=>String(v||'').trim().toLowerCase(),
  async isAdmin(user){
    if(!user)return false;
    const email=this.normalizeEmail(user.email);
    if(!email)return false;
    const snap=await db.collection('settings').doc('admin').get();
    const emails=snap.exists&&Array.isArray(snap.data().emails)?snap.data().emails:[];
    return emails.map(value=>this.normalizeEmail(value)).includes(email);
  },
  async ensureUserDocument(user){
    if(!user)return null;
    const ref=db.collection('user_permissions').doc(user.uid);
    const snap=await ref.get();
    if(!snap.exists){
      const data={uid:user.uid,email:this.normalizeEmail(user.email),displayName:user.displayName||'',status:'pending',plan:'free',programs:{'pdf-editor':false,preflight:false,'design-studio':false},createdAt:firebase.firestore.FieldValue.serverTimestamp()};
      await ref.set(data);return data;
    }
    return snap.data();
  },
  async getPublicPrograms(){
    const snap=await db.collection('settings').doc('programs').get().catch(()=>null);
    const data=snap&&snap.exists?snap.data():{};
    return data&&typeof data.public==='object'&&data.public?data.public:{};
  },
  async getAccess(user){
    if(!user)return{loggedIn:false,admin:false,approved:false,status:'signed_out',profile:null};
    const admin=await this.isAdmin(user).catch(()=>false);
    let profile=null;
    try{profile=await this.ensureUserDocument(user)}catch(e){
      console.warn('User profile could not be loaded or created.',e);
      try{const snap=await db.collection('user_permissions').doc(user.uid).get();profile=snap.exists?snap.data():null}catch(_){profile=null}
    }
    const status=admin?'approved':String(profile?.status||'pending');
    return{loggedIn:true,admin,approved:admin||status==='approved',status,profile};
  },
  async canUseProgram(user,programId){
    if(!user||!programId)return{allowed:false,status:'signed_out',admin:false,public:false,profile:null};
    const [access,publicPrograms]=await Promise.all([this.getAccess(user),this.getPublicPrograms()]);
    const publicAccess=publicPrograms?.[programId]===true;
    const assigned=access.profile?.programs?.[programId]===true;
    const allowed=access.admin||publicAccess||(access.status==='approved'&&assigned);
    return{...access,allowed,public:publicAccess,assigned,programId};
  },
  programForPath(pathname){
    const path=String(pathname||'').replace(/\\/g,'/').replace(/\/+$/,'');
    if(['/tools/pdf-editor.html','/pdf-editor','/pdf-editor/index.html'].some(item=>path.endsWith(item)))return'pdf-editor';
    if(['/tools/preflight.html','/tools/pdf-Checker.html','/pdf-preflight','/pdf-preflight/index.html'].some(item=>path.endsWith(item)))return'preflight';
    if(['/tools/perfect-binding-cover.html','/perfect-binding-cover','/perfect-binding-cover/index.html'].some(item=>path.endsWith(item)))return'design-studio';
    return'';
  },
  async guardTool(options={}){
    const loginUrl=options.loginUrl||'../login.html';
    const waitingUrl=options.waitingUrl||'../approval-waiting.html';
    const programId=options.programId||this.programForPath(location.pathname);
    if(!auth){location.replace(loginUrl);return;}
    return new Promise(resolve=>auth.onAuthStateChanged(async user=>{
      if(!user){location.replace(loginUrl);return;}
      try{
        const access=programId?await this.canUseProgram(user,programId):await this.getAccess(user);
        const allowed=programId?access.allowed:access.approved;
        if(!allowed){
          const status=access.status==='approved'?'forbidden':(access.status||'pending');
          location.replace(`${waitingUrl}?status=${encodeURIComponent(status)}&program=${encodeURIComponent(programId||'')}`);
          return;
        }
        document.documentElement.dataset.accessReady='true';
        document.documentElement.dataset.programAccess=programId||'approved';
        resolve(access);
      }catch(e){
        console.error(e);
        location.replace(`${waitingUrl}?status=error&program=${encodeURIComponent(programId||'')}`);
      }
    }));
  }
};

(()=>{
  const programId=ProgramAccess.programForPath(location.pathname);
  if(auth&&programId){
    document.documentElement.style.visibility='hidden';
    ProgramAccess.guardTool({programId}).then(()=>document.documentElement.style.visibility='');
  }
})();

window.addEventListener('DOMContentLoaded',async()=>{
  const year=new Date().getFullYear();
  document.querySelectorAll('[data-current-year],#copyrightYear').forEach(el=>el.textContent=year);
  const footer=document.querySelector('footer');
  if(!footer)return;
  footer.innerHTML=footer.innerHTML.replace(/©\s*\d{4}/g,`© ${year}`);
  const shell=footer.querySelector('.footer-inner')||footer;
  const hasLegalUi=!!footer.querySelector('.footer-links,.footer-legal,[data-legal]');
  if(!hasLegalUi){
    const style=document.createElement('style');style.textContent='.footer-legal{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.footer-legal a{color:inherit;text-decoration:none}.footer-business-name{font-size:10px;line-height:1.5;opacity:.72}@media(max-width:650px){.footer-legal{margin-top:12px}}';document.head.appendChild(style);
    const legal=document.createElement('div');legal.className='footer-legal';legal.innerHTML='<a href="/guide.html">이용안내</a><a href="/terms.html">이용약관</a><a href="/privacy.html">개인정보처리방침</a>';
    shell.appendChild(legal);
  }
  if(!footer.querySelector('.footer-business-name')){
    try{
      let snap=await db.collection('settings').doc('business').get().catch(()=>null);
      if(!snap||!snap.exists)snap=await db.collection('site_settings').doc('business').get().catch(()=>null);
      const business=snap&&snap.exists?snap.data():{};
      const name=String(business.bizName||'').trim();
      if(name){
        const info=document.createElement('span');
        info.className='footer-business-name';
        info.textContent=name;
        const copyright=[...footer.querySelectorAll('span')].find(el=>(el.textContent||'').includes('©'));
        if(copyright)copyright.insertAdjacentElement('afterend',info);else shell.appendChild(info);
      }
    }catch(_){ }
  }
});