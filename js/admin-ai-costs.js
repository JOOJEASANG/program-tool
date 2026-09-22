/* Administrator AI billing and Program Studio image-usage dashboard. */
(function(){
  'use strict';
  if(window.__programAdminAiCostsV1)return;
  window.__programAdminAiCostsV1=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/admin'||path==='/admin.html'))return;

  const $=id=>document.getElementById(id);
  const API_PATH='/api/admin/ai-costs';
  let loaded=false;
  let loading=false;

  function usd(value){
    const number=Number(value)||0;
    const digits=Math.abs(number)>0&&Math.abs(number)<1?4:2;
    return '$'+number.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
  }

  function integer(value){
    return (Number(value)||0).toLocaleString('ko-KR');
  }

  function setText(id,value){
    const node=$(id);
    if(node)node.textContent=value;
  }

  function clear(node){
    if(node)node.replaceChildren();
  }

  function emptyRow(message){
    const row=document.createElement('div');
    row.className='ai-cost-empty';
    row.textContent=message;
    return row;
  }

  function makeBreakdownRow(label,value,meta=''){
    const row=document.createElement('div');
    row.className='ai-cost-row';
    const copy=document.createElement('div');
    copy.className='ai-cost-row-copy';
    const strong=document.createElement('strong');
    strong.textContent=label;
    copy.appendChild(strong);
    if(meta){
      const small=document.createElement('small');
      small.textContent=meta;
      copy.appendChild(small);
    }
    const amount=document.createElement('b');
    amount.textContent=value;
    row.append(copy,amount);
    return row;
  }

  function renderDaily(costs){
    const box=$('aiCostDaily');
    clear(box);
    const rows=Array.isArray(costs?.daily)?costs.daily.slice(-14).reverse():[];
    if(!rows.length){
      box?.appendChild(emptyRow('이번 달 비용 집계가 아직 없습니다.'));
      return;
    }
    rows.forEach(item=>box.appendChild(makeBreakdownRow(item.date,usd(item.amount))));
  }

  function renderLineItems(costs){
    const box=$('aiCostLineItems');
    clear(box);
    const rows=Array.isArray(costs?.line_items)?costs.line_items:[];
    if(!rows.length){
      box?.appendChild(emptyRow('비용 항목 데이터가 없습니다.'));
      return;
    }
    rows.slice(0,12).forEach(item=>box.appendChild(makeBreakdownRow(item.name||'기타',usd(item.amount))));
  }

  function renderModels(data){
    const box=$('aiCostModels');
    clear(box);
    const openai=Array.isArray(data?.openai_images?.by_model)?data.openai_images.by_model:[];
    const local=Array.isArray(data?.program_studio?.by_model)?data.program_studio.by_model:[];
    const rows=openai.length?openai:local;
    if(!rows.length){
      box?.appendChild(emptyRow('모델별 생성 기록이 아직 없습니다.'));
      return;
    }
    rows.forEach(item=>{
      const requests=integer(item.requests);
      const images=item.images===undefined?'':(' · 이미지 '+integer(item.images)+'장');
      box.appendChild(makeBreakdownRow(item.model||'미지정',requests+'회',images.replace(/^ · /,'')));
    });
  }

  function renderProgramDaily(summary){
    const box=$('aiProgramDaily');
    clear(box);
    const rows=Array.isArray(summary?.daily)?summary.daily.filter(item=>Number(item.requests)>0).slice(-14).reverse():[];
    if(!rows.length){
      box?.appendChild(emptyRow('Program Studio 성공 생성 기록이 아직 없습니다.'));
      return;
    }
    rows.forEach(item=>{
      const meta='기본 '+integer(item.standard)+' · 고품질 '+integer(item.high);
      box.appendChild(makeBreakdownRow(item.date,integer(item.requests)+'회',meta));
    });
  }

  function renderUnavailable(data){
    setText('aiCostToday','조회 불가');
    setText('aiCostWeek','조회 불가');
    setText('aiCostMonth','조회 불가');
    setText('aiOpenAiImages','-');
    const status=$('aiCostStatus');
    if(status){
      status.className='ai-cost-notice warn';
      status.textContent=data?.detail||'OpenAI 실제 비용을 불러올 수 없습니다.';
    }
    const scope=$('aiCostScope');
    if(scope){
      scope.className='ai-cost-scope warn';
      scope.textContent=data?.code==='OPENAI_ADMIN_KEY_MISSING'
        ?'OPENAI_ADMIN_KEY 설정 필요'
        :'OpenAI 비용 조회 확인 필요';
    }
    renderDaily(null);
    renderLineItems(null);
  }

  function render(data){
    const program=data?.program_studio||{};
    setText('aiProgramMonth',integer(program.month_requests)+'회');
    setText('aiProgramToday',integer(program.today_requests)+'회');
    setText('aiProgramWeek',integer(program.last_7_days_requests)+'회');
    setText('aiProgramQuality','기본 '+integer(program.standard_requests)+' · 고품질 '+integer(program.high_requests));
    renderProgramDaily(program);
    renderModels(data);

    if(!data?.available){
      renderUnavailable(data);
      return;
    }

    const costs=data.costs||{};
    setText('aiCostToday',usd(costs.today));
    setText('aiCostWeek',usd(costs.last_7_days));
    setText('aiCostMonth',usd(costs.month_to_date));
    setText('aiOpenAiImages',integer(data.openai_images?.month_requests)+'회');

    const scope=$('aiCostScope');
    if(scope){
      scope.className='ai-cost-scope '+(data.scope==='organization'?'warn':'ok');
      scope.textContent=data.scope_label||'OpenAI 비용';
    }
    const status=$('aiCostStatus');
    if(status){
      status.className='ai-cost-notice '+(data.scope==='organization'?'warn':'ok');
      status.textContent=data.scope==='organization'
        ?'OPENAI_PROJECT_ID가 없어 OpenAI 조직 전체 실제 비용을 표시합니다. Program Studio 프로젝트만 보려면 프로젝트 ID를 서버에 설정하세요.'
        :'OpenAI Costs API의 실제 집계 금액입니다. 청구 시스템 집계에는 약간의 지연이 있을 수 있습니다.';
    }

    const period=data.period||{};
    setText('aiCostPeriod',period.start&&period.end?period.start+' ~ '+period.end+' · '+(period.timezone||'Asia/Seoul'):'이번 달');
    renderDaily(costs);
    renderLineItems(costs);
  }

  async function loadCosts(force=false){
    if(loading||(!force&&loaded))return;
    const user=window.auth?.currentUser;
    if(!user)return;
    loading=true;
    const button=$('aiCostRefreshBtn');
    if(button){button.disabled=true;button.textContent='조회 중...';}
    const status=$('aiCostStatus');
    if(status){status.className='ai-cost-notice';status.textContent='OpenAI 실제 비용을 확인하고 있습니다.';}
    try{
      const token=await user.getIdToken();
      const response=await fetch(API_PATH,{
        method:'GET',
        headers:{Authorization:'Bearer '+token,Accept:'application/json'},
        cache:'no-store'
      });
      const raw=await response.text();
      let data={};
      try{data=raw?JSON.parse(raw):{};}catch(_){}
      if(!response.ok)throw new Error(data.detail||'AI 비용 조회에 실패했습니다.');
      render(data);
      loaded=true;
    }catch(error){
      render({
        available:false,
        detail:error.message||'AI 비용 조회에 실패했습니다.',
        program_studio:{}
      });
    }finally{
      loading=false;
      if(button){button.disabled=false;button.textContent='비용 새로고침';}
    }
  }

  document.querySelector('[data-tab="aiCosts"]')?.addEventListener('click',()=>loadCosts(false));
  $('aiCostRefreshBtn')?.addEventListener('click',()=>loadCosts(true));
  $('refreshBtn')?.addEventListener('click',()=>{if(loaded)loadCosts(true);});

  window.ProgramAdminAiCosts={load:loadCosts};
})();
