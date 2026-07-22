(()=>{
  async function renderRegistry(){
    if(!window.db||!window.auth)return;
    const user=auth.currentUser;if(!user)return;
    const access=await ProgramAccess.getAccess(user).catch(()=>null);if(!access?.approved)return;
    const snap=await db.collection('settings').doc('programs').get().catch(()=>null);const items=snap?.exists&&Array.isArray(snap.data().items)?snap.data().items:[];if(!items.length)return;
    const slider=document.getElementById('slider');if(!slider)return;slider.innerHTML='';
    const icons=['📝','🔍','📚','🧩','🖨️','📐','✂️','🗂️'];
    items.filter(p=>p.active!==false).forEach((p,i)=>{const a=document.createElement('a');a.href=p.url;a.className='card';a.innerHTML=`<div class="icon" style="background:${p.bg||'#eef4f8'}">${p.icon||icons[i%icons.length]}</div><div class="name">${p.name||p.key}</div><div class="desc">${p.description||'인쇄 문서 작업 프로그램입니다.'}</div><div class="tags"><span class="tag">${p.category||'프로그램'}</span></div><div class="cta">시작하기 →</div>`;slider.appendChild(a)});
    const count=document.getElementById('count');if(count)count.textContent=`사용 가능 ${items.filter(p=>p.active!==false).length}개${access.admin?' · 관리자 모드':''}`;
  }
  window.addEventListener('load',()=>setTimeout(renderRegistry,300));
})();