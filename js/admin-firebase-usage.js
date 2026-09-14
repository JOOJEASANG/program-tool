// Near-real-time Firebase / Google Cloud usage panel for administrators.
(function(){
  'use strict';
  if(window.__adminFirebaseUsageV1)return;
  window.__adminFirebaseUsageV1=true;
  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(path!=='/admin'&&path!=='/admin.html')return;

  let timer=null,busy=false,lastPayload=null;
  const $=id=>document.getElementById(id);
  const GIB=1024*1024*1024;

  function style(){
    if($('firebaseUsageStyles'))return;
    const el=document.createElement('style');el.id='firebaseUsageStyles';el.textContent=`
      .firebase-usage-nav-enabled{}
      .fu-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between;margin-bottom:14px}.fu-head h3{margin:0;font-size:15px}.fu-head p{margin:4px 0 0;color:#667085;font-size:10px;line-height:1.5}.fu-head-actions{display:flex;gap:7px;align-items:center}.fu-updated{font-size:9px;color:#667085;font-weight:800}
      .fu-note{padding:11px 12px;border-radius:11px;background:#eff8ff;border:1px solid #b9ddf7;color:#24527a;font-size:10px;line-height:1.55;margin-bottom:12px}.fu-note.good{background:#ecfdf3;border-color:#b7e5cf;color:#067647}.fu-note.warn{background:#fff8e5;border-color:#f6d98f;color:#8a5b00}
      .fu-section{margin:15px 0 7px;font-size:11px;font-weight:950;color:#344054}.fu-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.fu-card{border:1px solid #e4eaf1;border-radius:12px;padding:12px;background:#fbfcfe}.fu-label{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:9px;color:#667085;font-weight:850}.fu-label b{font-size:8px;border-radius:999px;padding:3px 6px;background:#eef2f6;color:#667085}.fu-value{font-size:20px;font-weight:950;margin:7px 0 8px;color:#172033}.fu-value small{font-size:9px;color:#667085;font-weight:800}.fu-track{height:7px;border-radius:999px;background:#e9eef4;overflow:hidden}.fu-fill{height:100%;background:#20a275;border-radius:999px;min-width:0;transition:width .25s}.fu-card.warn .fu-fill{background:#e19a19}.fu-card.danger .fu-fill{background:#db3d4d}.fu-card.unavailable{opacity:.7}.fu-meta{display:flex;justify-content:space-between;gap:8px;margin-top:6px;color:#7b8797;font-size:8px;font-weight:750}.fu-error{font-size:8px;color:#b42318;margin-top:6px;line-height:1.35;word-break:break-word}.fu-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.fu-links a{font-size:9px;font-weight:850;color:#1769e0;text-decoration:none;border:1px solid #cfe0f4;border-radius:8px;padding:7px 9px;background:#fff}
      @media(max-width:1050px){.fu-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:760px){.side.firebase-usage-nav-enabled{grid-template-columns:auto repeat(5,minmax(0,1fr))}.fu-grid{grid-template-columns:1fr}.fu-head{flex-direction:column}.fu-head-actions{width:100%;justify-content:space-between}}
    `;document.head.appendChild(el);
  }

  function install(){
    if($('firebaseUsage'))return true;
    const side=document.querySelector('.side'),businessBtn=document.querySelector('[data-tab="business"]'),content=document.querySelector('main.content');
    if(!side||!businessBtn||!content)return false;
    style();side.classList.add('firebase-usage-nav-enabled');
    const nav=document.createElement('button');nav.className='navbtn';nav.dataset.tab='firebaseUsage';nav.innerHTML='<span>📊</span>서버 사용량';businessBtn.insertAdjacentElement('afterend',nav);
    const panel=document.createElement('section');panel.className='panel';panel.id='firebaseUsage';panel.innerHTML=`
      <div class="card"><div class="fu-head"><div><h3>Firebase 무료할당량 사용 현황</h3><p>Cloud Monitoring 지표 기반 근실시간 값입니다. 사용량을 저장하기 위한 별도 Firestore 카운터는 만들지 않습니다.</p></div><div class="fu-head-actions"><span id="fuUpdated" class="fu-updated">조회 전</span><button type="button" class="btn soft" id="fuRefresh">새로고침</button></div></div>
      <div id="fuOptimize" class="fu-note good">횟수제한 카운터를 제거해 프로그램 실행 시 발생하던 추가 Firestore 쓰기를 없앴습니다.</div>
      <div id="fuDelay" class="fu-note">Cloud Monitoring 지표는 수 분 정도 지연될 수 있습니다.</div>
      <div class="fu-section">Cloud Firestore · 일일 무료 구간</div><div class="fu-grid" id="fuFirestore"></div>
      <div class="fu-section">Cloud Functions / Cloud Run · 월간 참고치</div><div class="fu-grid" id="fuFunctions"></div>
      <div class="fu-section">Cloud Storage · 월간/현재 무료 구간</div><div class="fu-grid" id="fuStorage"></div>
      <div id="fuScope" class="fu-note warn" style="margin-top:14px">Functions 무료 할당량은 결제 계정 단위여서 프로젝트 값은 참고용입니다.</div>
      <div class="fu-links"><a href="https://console.firebase.google.com/project/program-tool/usage" target="_blank" rel="noopener">Firebase 사용량</a><a href="https://console.cloud.google.com/monitoring?project=program-tool" target="_blank" rel="noopener">Cloud Monitoring</a><a href="https://console.cloud.google.com/billing?project=program-tool" target="_blank" rel="noopener">Cloud Billing</a></div>
      <div id="fuGlobalError" class="fu-error"></div></div>`;
    content.appendChild(panel);
    nav.addEventListener('click',()=>openPanel(nav,panel));$('fuRefresh').addEventListener('click',()=>load(true));
    return true;
  }

  function openPanel(nav,panel){
    document.querySelectorAll('[data-tab]').forEach(node=>node.classList.toggle('on',node===nav));
    document.querySelectorAll('.panel').forEach(node=>node.classList.toggle('on',node===panel));
    if($('pageTitle'))$('pageTitle').textContent='서버 사용량';if($('pageSub'))$('pageSub').textContent='Firebase 무료할당량과 Cloud Monitoring 지표를 확인합니다.';
    load(false);startTimer();
  }
  function startTimer(){clearInterval(timer);timer=setInterval(()=>{if($('firebaseUsage')?.classList.contains('on'))load(false);},60000);}

  function number(value){return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(Number(value||0));}
  function bytes(value){const n=Number(value||0);if(n>=GIB)return `${(n/GIB).toFixed(2)} GB`;if(n>=1024*1024)return `${(n/(1024*1024)).toFixed(1)} MB`;if(n>=1024)return `${(n/1024).toFixed(1)} KB`;return `${number(n)} B`;}
  function format(item){if(!item?.available)return '조회 불가';if(item.unit==='bytes')return bytes(item.value);if(item.unit==='GB-s')return `${number(item.value)} GB-s`;return number(item.value);}
  function limit(item){if(!item?.limit)return '-';if(item.unit==='bytes')return bytes(item.limit);if(item.unit==='GB-s')return `${number(item.limit)} GB-s`;return number(item.limit);}
  function tone(item){const p=Number(item?.percent||0);return p>=90?'danger':p>=70?'warn':'';}
  function card(label,item){const p=item?.percent==null?0:Math.min(100,Math.max(0,item.percent));const unavailable=!item?.available;return `<div class="fu-card ${tone(item)} ${unavailable?'unavailable':''}"><div class="fu-label"><span>${label}</span>${item?.approximate?'<b>근사치</b>':''}</div><div class="fu-value">${format(item)} <small>/ ${limit(item)}</small></div><div class="fu-track"><div class="fu-fill" style="width:${p}%"></div></div><div class="fu-meta"><span>${item?.period||''}</span><span>${item?.percent==null?'':item.percent+'%'}</span></div>${item?.error?`<div class="fu-error">${escapeHtml(item.error)}</div>`:''}</div>`;}
  function escapeHtml(v){return String(v||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

  function render(data){
    lastPayload=data;$('fuGlobalError').textContent='';
    const f=data.firestore||{},fn=data.functions||{},s=data.storage||{};
    $('fuFirestore').innerHTML=card('문서 읽기',f.reads)+card('문서 쓰기',f.writes)+card('문서 삭제',f.deletes);
    $('fuFunctions').innerHTML=card('함수/Cloud Run 요청',fn.requests)+card('GB-초 추정',fn.gbSecondsApprox);
    $('fuStorage').innerHTML=card('저장 용량',s.storedBytes)+card('업로드 작업',s.uploadOps)+card('다운로드 작업',s.downloadOps)+card('네트워크 송신량',s.egressBytes);
    if($('fuDelay'))$('fuDelay').textContent=data.monitoringDelay||'Cloud Monitoring 값은 수 분 지연될 수 있습니다.';
    if($('fuScope'))$('fuScope').textContent=data.quotaScopeNote||'Functions 값은 프로젝트 사용량 기반 참고치입니다.';
    if($('fuOptimize'))$('fuOptimize').textContent=data.optimization?.note||'관리자 승인 방식으로 불필요한 사용횟수 카운터 쓰기를 줄였습니다.';
    if($('fuUpdated')){const d=data.updatedAt?new Date(data.updatedAt):new Date();$('fuUpdated').textContent=`${d.toLocaleTimeString('ko-KR')} 기준${data.cacheAgeSeconds?` · 캐시 ${data.cacheAgeSeconds}초`:''}`;}
  }

  async function load(force){
    if(busy)return;busy=true;if($('fuRefresh'))$('fuRefresh').disabled=true;
    try{
      const user=window.auth?.currentUser;if(!user)throw new Error('관리자 로그인이 필요합니다.');
      const token=await user.getIdToken();
      const resp=await fetch('/api/admin/firebase-usage',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const data=await resp.json().catch(()=>({}));if(!resp.ok)throw new Error(data.detail||data.error||`사용량 조회 실패 (${resp.status})`);
      render(data);
    }catch(error){if($('fuGlobalError'))$('fuGlobalError').textContent=`사용량 조회 오류: ${error?.message||error}`;if(!lastPayload&&$('fuUpdated'))$('fuUpdated').textContent='조회 실패';}
    finally{busy=false;if($('fuRefresh'))$('fuRefresh').disabled=false;}
  }

  let tries=0;const bootTimer=setInterval(()=>{tries++;if(install()){clearInterval(bootTimer);window.AdminFirebaseUsage={load,get last(){return lastPayload;},stage:'admin-firebase-usage-monitoring-v1'};}else if(tries>80)clearInterval(bootTimer);},100);
})();
