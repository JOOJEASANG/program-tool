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
(()=>{if(document.getElementById('programStudioCacheBootstrap'))return;const s=document.createElement('script');s.id='programStudioCacheBootstrap';s.src='/js/sw-register.js?v=2026.07.23.002';s.defer=true;document.head.appendChild(s)})();

window.ProgramAccess={
  normalizeEmail:v=>String(v||'').trim().toLowerCase(),
  async isAdmin(user){
    if(!user)return false;
    const email=this.normalizeEmail(user.email);
    const [legacy,direct,profile]=await Promise.all([
      db.collection('settings').doc('admin').get().catch(()=>null),
      db.collection('admins').doc(email).get().catch(()=>null),
      db.collection('user_permissions').doc(user.uid).get().catch(()=>null)
    ]);
    const legacyEmails=legacy&&legacy.exists?legacy.data().emails||[]:[];
    const legacyMatch=legacyEmails.map(v=>this.normalizeEmail(v)).includes(email);
    const directMatch=!!(direct&&direct.exists);
    const profileData=profile&&profile.exists?profile.data():{};
    const profileMatch=profileData.role==='admin'||profileData.isAdmin===true||profileData.admin===true;
    return legacyMatch||directMatch||profileMatch;
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
  async getAccess(user){
    if(!user)return{loggedIn:false,admin:false,approved:false,status:'signed_out'};
    const admin=await this.isAdmin(user).catch(()=>false);
    let profile=null;
    try{profile=await this.ensureUserDocument(user)}catch(e){
      console.warn('User profile could not be loaded or created.',e);
      try{const snap=await db.collection('user_permissions').doc(user.uid).get();profile=snap.exists?snap.data():null}catch(_){profile=null}
    }
    const status=admin?'approved':String(profile?.status||'pending');
    return{loggedIn:true,admin,approved:admin||status==='approved',status,profile};
  },
  async guardTool(options={}){
    const loginUrl=options.loginUrl||'../login.html';
    const waitingUrl=options.waitingUrl||'../approval-waiting.html';
    if(!auth){location.replace(loginUrl);return;}
    return new Promise(resolve=>auth.onAuthStateChanged(async user=>{
      if(!user){location.replace(loginUrl);return;}
      try{const access=await this.getAccess(user);if(!access.approved){location.replace(`${waitingUrl}?status=${encodeURIComponent(access.status||'pending')}`);return;}document.documentElement.dataset.accessReady='true';resolve(access)}catch(e){console.error(e);location.replace(`${waitingUrl}?status=error`)}
    }));
  }
};

(()=>{
  const path=location.pathname.replace(/\\/g,'/').replace(/\/+$/,'');
  const protectedTools=['/tools/pdf-editor.html','/tools/preflight.html','/tools/pdf-Checker.html','/tools/perfect-binding-cover.html','/pdf-editor','/pdf-editor/index.html','/pdf-preflight','/pdf-preflight/index.html','/perfect-binding-cover','/perfect-binding-cover/index.html'];
  if(auth&&protectedTools.some(item=>path.endsWith(item))){document.documentElement.style.visibility='hidden';ProgramAccess.guardTool().then(()=>document.documentElement.style.visibility='')}
})();

window.addEventListener('DOMContentLoaded',async()=>{
  const year=new Date().getFullYear();
  document.querySelectorAll('[data-current-year],#copyrightYear').forEach(el=>el.textContent=year);
  const footer=document.querySelector('footer');
  if(!footer)return;
  footer.innerHTML=footer.innerHTML.replace(/©\s*\d{4}/g,`© ${year}`);
  const shell=footer.querySelector('.footer-inner')||footer;
  // 메인 페이지가 자체 레이어형 약관 메뉴를 제공하면 중복 링크를 만들지 않습니다.
  const hasLegalUi=!!footer.querySelector('.footer-links,.footer-legal,[data-legal]');
  if(!hasLegalUi){
    const style=document.createElement('style');style.textContent='.footer-legal{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.footer-legal a{color:inherit;text-decoration:none}.footer-business{margin-top:8px;font-size:10px;line-height:1.65;opacity:.72;max-width:900px}@media(max-width:650px){.footer-legal{margin-top:12px}}';document.head.appendChild(style);
    const legal=document.createElement('div');legal.className='footer-legal';legal.innerHTML='<a href="/guide.html">이용안내</a><a href="/terms.html">이용약관</a><a href="/privacy.html">개인정보처리방침</a>';
    shell.appendChild(legal);
  }
  if(!footer.querySelector('.footer-business')){
    const info=document.createElement('div');info.className='footer-business';footer.appendChild(info);
    try{let snap=await db.collection('settings').doc('business').get().catch(()=>null);if(!snap||!snap.exists)snap=await db.collection('site_settings').doc('business').get().catch(()=>null);const b=snap&&snap.exists?snap.data():{};const p=[b.bizName,b.bizOwner&&`대표 ${b.bizOwner}`,b.bizNumber&&`사업자등록번호 ${b.bizNumber}`,b.bizMailOrder&&`통신판매업 ${b.bizMailOrder}`,b.bizAddress,b.bizPhone,b.bizEmail].filter(Boolean);info.textContent=p.join(' · ');if(!p.length)info.remove()}catch(e){info.remove()}
  }
});
