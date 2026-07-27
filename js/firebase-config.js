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

// The legacy PDF editor performs one Promise.all() over admin, public-program,
// and user-permission documents. A permission-denied response for either settings
// document used to abort the whole check before the approved user document could
// be evaluated. On the PDF editor only, treat denied optional settings reads as
// unavailable snapshots. Authentication and user_permissions checks remain real.
(()=>{
  const isPdfEditor=/\/(?:tools\/pdf-editor\.html|pdf-editor(?:\/index\.html)?)\/?$/.test(location.pathname);
  const proto=firebase.firestore?.DocumentReference?.prototype;
  if(!isPdfEditor||!proto||proto.__programStudioPdfEditorSettingsFallback)return;
  const originalGet=proto.get;
  if(typeof originalGet!=='function')return;
  Object.defineProperty(proto,'__programStudioPdfEditorSettingsFallback',{value:true});
  proto.get=async function(...args){
    try{return await originalGet.apply(this,args)}catch(error){
      const isOptionalSettingsDoc=this.parent?.id==='settings'&&['admin','programs'].includes(this.id);
      const code=String(error?.code||'').toLowerCase();
      if(!isOptionalSettingsDoc||!(code.includes('permission-denied')||code.includes('permission_denied')))throw error;
      return{exists:false,id:this.id,ref:this,data:()=>undefined};
    }
  };
})();

// Legacy PDF editor pages read programs['pdf-editor'] directly instead of using
// ProgramAccess. Normalize approved permission snapshots at the shared Firebase
// boundary so account-level approval remains authoritative until those pages are
// fully migrated to the common guard.
(()=>{
  const proto=firebase.firestore?.DocumentSnapshot?.prototype;
  if(!proto||proto.__programStudioApprovedAccessNormalized)return;
  const originalData=proto.data;
  if(typeof originalData!=='function')return;
  Object.defineProperty(proto,'__programStudioApprovedAccessNormalized',{value:true});
  proto.data=function(...args){
    const data=originalData.apply(this,args);
    if(this.ref?.parent?.id!=='user_permissions'||!data||data.status!=='approved')return data;
    return{...data,programs:{...(data.programs||{}),'pdf-editor':true,preflight:true,'design-studio':true}};
  };
})();

(()=>{if(document.getElementById('programStudioCacheBootstrap'))return;const s=document.createElement('script');s.id='programStudioCacheBootstrap';s.src='/js/sw-register.js?v=2026.07.28.001';s.defer=true;document.head.appendChild(s)})();

window.ProgramAccess={
  _cache:new Map(),
  _cacheTtlMs:30000,
  normalizeEmail:v=>String(v||'').trim().toLowerCase(),
  _cacheGet(key){const item=this._cache.get(key);if(!item||Date.now()-item.time>this._cacheTtlMs){this._cache.delete(key);return undefined}return item.value},
  _cacheSet(key,value){this._cache.set(key,{value,time:Date.now()});return value},
  clearCache(user){const uid=typeof user==='string'?user:user?.uid;if(!uid){this._cache.clear();return}for(const key of this._cache.keys())if(key.includes(`:${uid}`))this._cache.delete(key)},
  async isAdmin(user){
    if(!user)return false;
    const cacheKey=`admin:${user.uid}`;
    const cached=this._cacheGet(cacheKey);
    if(cached!==undefined)return cached;
    try{
      const tokenResult=await user.getIdTokenResult(false);
      if(tokenResult?.claims?.admin===true)return this._cacheSet(cacheKey,true);
    }catch(e){console.warn('Admin claim could not be read.',e)}
    const email=this.normalizeEmail(user.email);
    if(!email)return this._cacheSet(cacheKey,false);
    try{
      const snap=await db.collection('settings').doc('admin').get();
      const emails=snap.exists&&Array.isArray(snap.data().emails)?snap.data().emails:[];
      return this._cacheSet(cacheKey,emails.map(value=>this.normalizeEmail(value)).includes(email));
    }catch(_){return this._cacheSet(cacheKey,false)}
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
    const cached=this._cacheGet('public-programs');
    if(cached!==undefined)return cached;
    const snap=await db.collection('settings').doc('programs').get().catch(()=>null);
    const data=snap&&snap.exists?snap.data():{};
    return this._cacheSet('public-programs',data&&typeof data.public==='object'&&data.public?data.public:{});
  },
  async getAccess(user){
    if(!user)return{loggedIn:false,admin:false,approved:false,status:'signed_out',profile:null};
    const cacheKey=`access:${user.uid}`;
    const cached=this._cacheGet(cacheKey);
    if(cached!==undefined)return cached;
    const adminPromise=this.isAdmin(user).catch(()=>false);
    const profilePromise=(async()=>{
      try{return await this.ensureUserDocument(user)}catch(e){
        console.warn('User profile could not be loaded or created.',e);
        try{const snap=await db.collection('user_permissions').doc(user.uid).get();return snap.exists?snap.data():null}catch(_){return null}
      }
    })();
    const [admin,profile]=await Promise.all([adminPromise,profilePromise]);
    const status=admin?'approved':String(profile?.status||'pending');
    return this._cacheSet(cacheKey,{loggedIn:true,admin,approved:admin||status==='approved',status,profile});
  },
  async canUseProgram(user,programId){
    if(!user||!programId)return{allowed:false,status:'signed_out',admin:false,public:false,profile:null};
    const [access,publicPrograms]=await Promise.all([this.getAccess(user),this.getPublicPrograms()]);
    const publicAccess=publicPrograms?.[programId]===true;
    const assigned=access.status==='approved';
    const allowed=access.admin||publicAccess||access.status==='approved';
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
    const timeoutMs=Math.max(3000,Number(options.timeoutMs)||8000);
    if(!auth){document.documentElement.style.visibility='';location.replace(loginUrl);return null;}
    return new Promise(resolve=>{
      let settled=false;
      let unsubscribe=()=>{};
      const root=document.documentElement;
      const finish=value=>{
        if(settled)return;
        settled=true;
        clearTimeout(timer);
        try{unsubscribe()}catch(_){}
        root.style.visibility='';
        delete root.dataset.accessChecking;
        resolve(value);
      };
      const redirect=url=>{finish(null);location.replace(url)};
      const timer=setTimeout(()=>{
        console.warn('Program access check timed out.');
        redirect(`${waitingUrl}?status=timeout&program=${encodeURIComponent(programId||'')}`);
      },timeoutMs);
      unsubscribe=auth.onAuthStateChanged(async user=>{
        if(settled)return;
        if(!user){redirect(loginUrl);return;}
        try{
          this.clearCache(user);
          const access=programId?await this.canUseProgram(user,programId):await this.getAccess(user);
          if(settled)return;
          const allowed=programId?access.allowed:access.approved;
          if(!allowed){
            const status=access.status==='approved'?'forbidden':(access.status||'pending');
            redirect(`${waitingUrl}?status=${encodeURIComponent(status)}&program=${encodeURIComponent(programId||'')}`);
            return;
          }
          root.dataset.accessReady='true';
          root.dataset.programAccess=programId||'approved';
          finish(access);
        }catch(e){
          console.error(e);
          redirect(`${waitingUrl}?status=error&program=${encodeURIComponent(programId||'')}`);
        }
      },error=>{
        console.error('Authentication state could not be read.',error);
        redirect(`${waitingUrl}?status=error&program=${encodeURIComponent(programId||'')}`);
      });
    });
  }
};

(()=>{
  const programId=ProgramAccess.programForPath(location.pathname);
  if(auth&&programId){
    const root=document.documentElement;
    root.style.visibility='hidden';
    root.dataset.accessChecking='true';
    const watchdog=setTimeout(()=>{
      root.style.visibility='';
      root.dataset.accessWatchdog='released';
    },8500);
    ProgramAccess.guardTool({programId,timeoutMs:8000}).finally(()=>{
      clearTimeout(watchdog);
      root.style.visibility='';
      delete root.dataset.accessChecking;
    });
  }
})();

window.addEventListener('DOMContentLoaded',async()=>{
  const year=new Date().getFullYear();
  document.querySelectorAll('[data-current-year],#copyrightYear').forEach(el=>el.textContent=year);
  const footer=document.querySelector('footer');
  if(!footer)return;
  footer.querySelectorAll('span').forEach(el=>{if(/©\s*\d{4}/.test(el.textContent||''))el.textContent=el.textContent.replace(/©\s*\d{4}/g,`© ${year}`)});
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
    }catch(_){}
  }
});
