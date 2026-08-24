// Administrator operations overview for deployed Program Studio tools.
(function(){
  'use strict';
  if(window.__adminOperationsOverviewV1)return;
  window.__adminOperationsOverviewV1=true;
  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/admin'&&path!=='/admin.html'&&!path.endsWith('/admin.html'))return;

  const DOC_ID='professional_program_suite';
  const PANEL_ID='adminOperationsPanel';
  const NAV_ID='adminOperationsNav';
  const TOOLS=[
    {id:'pdf-editor',name:'PDF 편집 · 인쇄배치',icon:'PDF',url:'pdf-editor/',desc:'페이지 편집, N-up, 소책자와 최종 출력 PDF 생성'},
    {id:'pdf-utility',name:'PDF 검사 · 유틸리티',icon:'✓',url:'pdf-preflight/',desc:'DPI·폰트·규격·도련 검사와 PDF 정리 도구'},
    {id:'image-editor',name:'이미지 편집기',icon:'◐',url:'image-editor/',desc:'자르기, 리사이즈, 배경 제거와 이미지 보정'},
    {id:'design-editor',name:'디자인 편집기',icon:'✦',url:'design-editor/',desc:'포스터, 전단, 책표지와 리플렛 제작'},
    {id:'document-editor',name:'문서 편집기',icon:'▤',url:'document-editor/',desc:'업무·기관 문서 작성과 편집'}
  ];
  let config=null;
  let busy=false;

  const $=id=>document.getElementById(id);
  const esc=value=>String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalized=value=>String(value||'').replace(/^\/+/, '').replace(/\/+$/, '')+'/' ;

  function installStyles(){
    if($('adminOperationsStyles'))return;
    const style=document.createElement('style');
    style.id='adminOperationsStyles';
    style.textContent=`
      .aop-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}.aop-metric{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px}.aop-metric span{font-size:9px;color:var(--muted);font-weight:850}.aop-metric strong{display:block;font-size:23px;margin-top:5px;color:#12396d}.aop-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}.aop-state{font-size:9px;font-weight:900;color:#64748b;margin-left:auto}.aop-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.aop-tool{border:1px solid #e2e8f0;border-radius:13px;padding:12px;background:#f8fafc}.aop-tool-head{display:flex;gap:9px;align-items:center}.aop-icon{width:35px;height:35px;border-radius:10px;background:#fff;border:1px solid #e2e8f0;display:grid;place-items:center;color:#1769e0;font-size:10px;font-weight:950}.aop-info{min-width:0;flex:1}.aop-name{font-size:11px;font-weight:950}.aop-desc{font-size:8px;color:#667085;margin-top:3px;line-height:1.4}.aop-badge{font-size:8px;font-weight:950;border-radius:999px;padding:4px 7px;white-space:nowrap}.aop-badge.ok{background:#dcfce7;color:#166534}.aop-badge.warn{background:#fef3c7;color:#92400e}.aop-meta{display:grid;gap:3px;margin-top:9px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:8px;color:#667085}.aop-meta b{color:#475467}.aop-actions{display:flex;gap:6px;margin-top:9px}.aop-open{border:1px solid #cbd5e1;background:#fff;color:#1769e0;border-radius:8px;padding:6px 8px;font-size:8px;font-weight:900;text-decoration:none}.aop-warning{margin-top:12px;padding:10px 11px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:10px;font-size:9px;line-height:1.5}.aop-ok{margin-top:12px;padding:10px 11px;border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:10px;font-size:9px;font-weight:850}.aop-dash{margin-top:14px;padding:13px 14px;border:1px solid #dce6ef;border-radius:13px;background:#f8fbfd;display:flex;align-items:center;gap:10px}.aop-dash strong{font-size:11px}.aop-dash span{font-size:9px;color:#667085;margin-left:5px}.aop-dash button{margin-left:auto}
      @media(max-width:900px){.aop-list{grid-template-columns:1fr}.aop-summary{grid-template-columns:1fr}.aop-state{width:100%;margin-left:0}.aop-dash{align-items:flex-start;flex-direction:column}.aop-dash button{margin-left:0}}
    `;
    document.head.appendChild(style);
  }

  function makeNav(){
    if($(NAV_ID))return;
    const side=document.querySelector('.side');
    if(!side)return;
    const foot=side.querySelector('.sidefoot');
    const button=document.createElement('button');
    button.id=NAV_ID;
    button.className='navbtn';
    button.type='button';
    button.innerHTML='<span>🩺</span>운영 점검';
    side.insertBefore(button,foot||null);
    button.addEventListener('click',openPanel);
  }

  function makePanel(){
    if($(PANEL_ID))return;
    const content=document.querySelector('.main .content');
    if(!content)return;
    const panel=document.createElement('section');
    panel.id=PANEL_ID;
    panel.className='panel';
    panel.innerHTML=`<div class="hero"><h2>프로그램 운영 점검</h2><p>실제 배포된 도구와 관리자 설정을 비교하고, 자주 쓰는 프로그램을 바로 열어 확인합니다.</p></div>
      <div class="aop-summary" id="aopSummary"></div>
      <div class="card"><div class="aop-toolbar"><button class="btn soft" id="aopReload" type="button">상태 새로고침</button><button class="btn primary" id="aopSync" type="button">완성 도구 상태 정리</button><span class="aop-state" id="aopState"></span></div><div class="aop-list" id="aopList"></div><div id="aopMessage"></div></div>`;
    content.appendChild(panel);
    $('aopReload').addEventListener('click',load);
    $('aopSync').addEventListener('click',syncCanonical);
  }

  function makeDashboardShortcut(){
    if($('adminOperationsDashboardShortcut'))return;
    const dash=$('dashboard');
    if(!dash)return;
    const node=document.createElement('div');
    node.id='adminOperationsDashboardShortcut';
    node.className='aop-dash';
    node.innerHTML='<div><strong>🩺 프로그램 운영 점검</strong><span>배포된 도구와 관리자 공개 설정이 맞는지 확인합니다.</span></div><button type="button" class="btn soft">점검 열기</button>';
    node.querySelector('button').addEventListener('click',openPanel);
    dash.appendChild(node);
  }

  function configPrograms(){return Array.isArray(config?.programs)?config.programs:[];}
  function configured(tool){return configPrograms().find(item=>String(item?.id||'')===tool.id)||null;}
  function mismatch(tool){
    const item=configured(tool);
    if(!item)return ['관리자 설정에 없음'];
    const problems=[];
    if(item.status!=='active')problems.push('상태가 준비 중');
    if(normalized(item.url)!==normalized(tool.url))problems.push('주소 불일치');
    return problems;
  }

  function render(){
    const list=$('aopList');
    const summary=$('aopSummary');
    if(!list||!summary)return;
    const problems=TOOLS.filter(tool=>mismatch(tool).length);
    const hidden=TOOLS.filter(tool=>configured(tool)?.visible===false).length;
    summary.innerHTML=`<div class="aop-metric"><span>배포 확인 도구</span><strong>${TOOLS.length}</strong></div><div class="aop-metric"><span>설정 불일치</span><strong>${problems.length}</strong></div><div class="aop-metric"><span>홈 숨김</span><strong>${hidden}</strong></div>`;
    list.replaceChildren();
    for(const tool of TOOLS){
      const item=configured(tool);
      const issues=mismatch(tool);
      const card=document.createElement('article');
      card.className='aop-tool';
      const visible=item?item.visible!==false:true;
      const statusText=issues.length?issues.join(' · '):'배포 상태와 일치';
      card.innerHTML=`<div class="aop-tool-head"><div class="aop-icon">${esc(tool.icon)}</div><div class="aop-info"><div class="aop-name">${esc(tool.name)}</div><div class="aop-desc">${esc(tool.desc)}</div></div><span class="aop-badge ${issues.length?'warn':'ok'}">${issues.length?'확인 필요':'정상'}</span></div><div class="aop-meta"><span><b>실제 주소</b> /${esc(tool.url)}</span><span><b>관리자 설정</b> ${item?`${esc(item.status||'미지정')} · ${visible?'공개':'숨김'} · ${esc(item.url||'주소 없음')}`:'설정 없음'}</span><span><b>판정</b> ${esc(statusText)}</span></div><div class="aop-actions"><a class="aop-open" href="/${esc(tool.url)}" target="_blank" rel="noopener">실제 화면 열기 ↗</a></div>`;
      list.appendChild(card);
    }
    const message=$('aopMessage');
    if(message)message.innerHTML=problems.length?`<div class="aop-warning">${problems.length}개 도구의 관리자 상태 또는 주소가 실제 배포 상태와 다릅니다. <b>완성 도구 상태 정리</b>는 공개/숨김 설정과 순서는 그대로 두고, 완성된 도구의 상태와 주소만 현재 경로로 맞춥니다.</div>`:'<div class="aop-ok">완성된 핵심 도구의 관리자 상태와 주소가 현재 배포 경로와 일치합니다.</div>';
  }

  function setBusy(value,text=''){
    busy=Boolean(value);
    ['aopReload','aopSync'].forEach(id=>{const node=$(id);if(node)node.disabled=busy;});
    const state=$('aopState');
    if(state)state.textContent=text;
  }

  async function load(){
    if(busy)return;
    if(!window.db){setTimeout(load,250);return;}
    setBusy(true,'설정 확인 중...');
    try{
      const snapshot=await db.collection('settings').doc(DOC_ID).get();
      config=snapshot.exists?(snapshot.data()||{}):{version:1,programs:[]};
      render();
      setBusy(false,snapshot.exists?'관리자 설정과 비교 완료':'저장된 프로그램 설정 없음');
    }catch(error){
      console.warn('Admin operations overview load failed',error);
      config={version:1,programs:[]};
      render();
      setBusy(false,'설정을 불러오지 못했습니다.');
    }
  }

  async function syncCanonical(){
    if(busy||!window.db)return;
    const needs=TOOLS.filter(tool=>mismatch(tool).length);
    if(!needs.length){setBusy(false,'정리할 항목이 없습니다.');return;}
    if(!confirm(`완성된 도구 ${needs.length}개의 상태와 주소를 현재 배포 기준으로 맞출까요?\n홈 공개/숨김과 프로그램 순서는 변경하지 않습니다.`))return;
    setBusy(true,'완성 도구 상태 정리 중...');
    try{
      const source=configPrograms().map(item=>({...item}));
      const byId=new Map(source.map((item,index)=>[String(item?.id||''),index]));
      for(const tool of TOOLS){
        const index=byId.get(tool.id);
        if(index===undefined){
          source.push({id:tool.id,name:tool.name,desc:tool.desc,url:tool.url,status:'active',visible:true});
        }else{
          source[index]={...source[index],url:tool.url,status:'active'};
        }
      }
      await db.collection('settings').doc(DOC_ID).set({version:1,programs:source,updatedAt:new Date().toISOString()},{merge:true});
      config={...(config||{}),version:1,programs:source};
      render();
      setBusy(false,'현재 배포 상태로 정리 완료');
      window.AdminProfessionalProgramManager?.reload?.();
    }catch(error){
      console.error('Admin operations sync failed',error);
      setBusy(false,'정리 실패 · 권한 또는 연결 상태를 확인하세요.');
    }
  }

  function openPanel(){
    document.querySelectorAll('.panel').forEach(panel=>panel.classList.remove('on'));
    document.querySelectorAll('.navbtn').forEach(button=>button.classList.remove('on'));
    $(PANEL_ID)?.classList.add('on');
    $(NAV_ID)?.classList.add('on');
    if($('pageTitle'))$('pageTitle').textContent='운영 점검';
    if($('pageSub'))$('pageSub').textContent='배포된 프로그램과 관리자 설정을 비교합니다.';
    load();
  }

  function bindOtherNav(){
    document.addEventListener('click',event=>{
      const button=event.target?.closest?.('.navbtn');
      if(!button||button.id===NAV_ID)return;
      $(NAV_ID)?.classList.remove('on');
      $(PANEL_ID)?.classList.remove('on');
    },true);
  }

  function install(){
    if(!document.querySelector('.side')||!document.querySelector('.main .content'))return false;
    installStyles();makeNav();makePanel();makeDashboardShortcut();bindOtherNav();
    window.AdminOperationsOverview={open:openPanel,reload:load,sync:syncCanonical,stage:'admin-operations-overview-v1'};
    document.documentElement.dataset.adminOperationsOverview='1';
    setTimeout(load,500);
    return true;
  }

  let attempts=0;
  function boot(){attempts+=1;if(install())return;if(attempts<80)setTimeout(boot,100);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
