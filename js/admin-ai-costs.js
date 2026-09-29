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

  function krw(value,fx){
    const rate=Number(fx?.rate)||0;
    if(!fx?.available||rate<=0)return '';
    const won=Math.round((Number(value)||0)*rate);
    return '₩'+won.toLocaleString('ko-KR');
  }

  function integer(value){
    return (Number(value)||0).toLocaleString('ko-KR');
  }

  function rateText(fx){
    const rate=Number(fx?.rate)||0;
    if(!fx?.available||rate<=0)return '환율 조회 불가';
    return '1 USD = ₩'+rate.toLocaleString('ko-KR',{minimumFractionDigits:1,maximumFractionDigits:2});
  }

  function localDateTime(value){
    if(!value)return '';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return String(value);
    return date.toLocaleString('ko-KR',{
      timeZone:'Asia/Seoul',
      month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false
    });
  }

  function setText(id,value){
    const node=$(id);
    if(node)node.textContent=value;
  }

  function clear(node){
    if(node)node.replaceChildren();
  }

  function ensureDynamicUi(){
    const panel=$('aiCosts');
    if(!panel)return;

    const head=panel.querySelector('.ai-cost-head');
    const metrics=panel.querySelector('.ai-cost-metrics');
    const actions=panel.querySelector('.ai-cost-head-actions');
    const subtitle=head?.querySelector('.cardsub');
    if(subtitle){
      subtitle.textContent='OpenAI 실제 USD 비용을 최신 USD/KRW 환율로 원화 환산하고, Program Studio의 성공 생성 횟수와 함께 표시합니다.';
    }

    if(actions&&!$('aiCostFx')){
      const fx=document.createElement('span');
      fx.id='aiCostFx';
      fx.className='ai-cost-scope';
      fx.textContent='환율 조회 전';
      actions.insertBefore(fx,$('aiCostRefreshBtn')||null);
    }

    if(metrics&&!$('aiCostTotalCard')){
      const card=document.createElement('div');
      card.id='aiCostTotalCard';
      card.className='card';
      card.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:14px;padding:18px 20px;background:linear-gradient(135deg,#f8fbff,#eef6ff);';
      const copy=document.createElement('div');
      copy.style.minWidth='0';
      const title=document.createElement('div');
      title.className='cardtitle';
      title.textContent='AI 사용 합계금액';
      const sub=document.createElement('div');
      sub.className='cardsub';
      sub.id='aiCostTotalPeriod';
      sub.style.marginBottom='0';
      sub.textContent='누적 실제 비용을 조회하면 표시합니다.';
      copy.append(title,sub);

      const amount=document.createElement('div');
      amount.style.cssText='text-align:right;white-space:nowrap;';
      const strong=document.createElement('strong');
      strong.id='aiCostTotal';
      strong.style.cssText='display:block;font-size:28px;letter-spacing:-.04em;color:#0b2a55;';
      strong.textContent='-';
      const small=document.createElement('small');
      small.id='aiCostTotalUsd';
      small.style.cssText='display:block;margin-top:5px;color:#667085;font-size:9px;';
      small.textContent='USD 원본 금액';
      amount.append(strong,small);
      card.append(copy,amount);
      metrics.parentNode.insertBefore(card,metrics);
    }
  }

  function metricSmall(id){
    const node=$(id);
    return node?.parentElement?.querySelector('small')||null;
  }

  function setMoneyMetric(id,value,fx,smallText=''){
    const main=krw(value,fx)||usd(value);
    setText(id,main);
    const small=metricSmall(id);
    if(small){
      const usdText=usd(value);
      small.textContent=smallText?smallText+' · '+usdText:usdText+(fx?.available?' · '+rateText(fx):'');
    }
  }

  function displayMoney(value,fx){
    return krw(value,fx)||usd(value);
  }

  function displayMoneyMeta(value,fx,meta=''){
    const base=fx?.available?usd(value):'';
    return [meta,base].filter(Boolean).join(' · ');
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

  function renderDaily(costs,fx){
    const box=$('aiCostDaily');
    clear(box);
    const rows=Array.isArray(costs?.daily)?costs.daily.slice(-14).reverse():[];
    if(!rows.length){
      box?.appendChild(emptyRow('이번 달 비용 집계가 아직 없습니다.'));
      return;
    }
    rows.forEach(item=>box.appendChild(makeBreakdownRow(
      item.date,
      displayMoney(item.amount,fx),
      displayMoneyMeta(item.amount,fx)
    )));
  }

  function renderLineItems(costs,fx){
    const box=$('aiCostLineItems');
    clear(box);
    const rows=Array.isArray(costs?.line_items)?costs.line_items:[];
    if(!rows.length){
      box?.appendChild(emptyRow('비용 항목 데이터가 없습니다.'));
      return;
    }
    rows.slice(0,12).forEach(item=>box.appendChild(makeBreakdownRow(
      item.name||'기타',
      displayMoney(item.amount,fx),
      displayMoneyMeta(item.amount,fx)
    )));
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

  function renderFx(fx){
    const chip=$('aiCostFx');
    if(!chip)return;
    if(fx?.available&&Number(fx.rate)>0){
      chip.className='ai-cost-scope '+(fx.stale?'warn':'ok');
      chip.textContent=rateText(fx)+(fx.stale?' · 마지막 정상값':'');
    }else{
      chip.className='ai-cost-scope warn';
      chip.textContent='환율 조회 불가';
    }
  }

  function renderTotal(costs,totalPeriod,fx){
    const total=costs?.total_to_date;
    const available=costs?.total_available!==false&&total!==null&&total!==undefined;
    if(!available){
      setText('aiCostTotal','조회 불가');
      setText('aiCostTotalUsd','누적 비용 조회를 확인해 주세요.');
      return;
    }
    setText('aiCostTotal',displayMoney(total,fx));
    setText('aiCostTotalUsd',usd(total)+(fx?.available?' · '+rateText(fx):' · 환율 조회 불가'));
    const period=totalPeriod||{};
    setText(
      'aiCostTotalPeriod',
      period.start&&period.end
        ?period.start+' ~ '+period.end+' 실제 OpenAI 비용 합계'
        :'누적 실제 OpenAI 비용 합계'
    );
  }

  function renderUnavailable(data){
    ensureDynamicUi();
    setText('aiCostToday','조회 불가');
    setText('aiCostWeek','조회 불가');
    setText('aiCostMonth','조회 불가');
    setText('aiCostTotal','조회 불가');
    setText('aiCostTotalUsd','OpenAI 실제 비용 조회 실패');
    setText('aiOpenAiImages','-');
    renderFx(data?.exchange_rate||{});
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
    renderDaily(null,null);
    renderLineItems(null,null);
  }

  function render(data){
    ensureDynamicUi();
    const program=data?.program_studio||{};
    setText('aiProgramMonth',integer(program.month_requests)+'회');
    setText('aiProgramToday',integer(program.today_requests)+'회');
    setText('aiProgramWeek',integer(program.last_7_days_requests)+'회');
    setText('aiProgramQuality','기능 적용 이후 · 기본 '+integer(program.standard_requests)+' · 고품질 '+integer(program.high_requests));
    renderProgramDaily(program);
    renderModels(data);

    if(!data?.available){
      renderUnavailable(data);
      return;
    }

    const costs=data.costs||{};
    const fx=data.exchange_rate||{};
    const period=data.period||{};
    const periodLabel=period.start&&period.end?period.start+' ~ '+period.end:'이번 달';
    setMoneyMetric('aiCostToday',costs.today,fx,'오늘 OpenAI 청구');
    setMoneyMetric('aiCostWeek',costs.last_7_days,fx,'최근 7일');
    setMoneyMetric('aiCostMonth',costs.month_to_date,fx,periodLabel);
    setText('aiOpenAiImages',integer(data.openai_images?.month_requests)+'회');
    renderFx(fx);
    renderTotal(costs,data.total_period,fx);

    const scope=$('aiCostScope');
    if(scope){
      scope.className='ai-cost-scope '+(data.scope==='organization'?'warn':'ok');
      scope.textContent=data.scope_label||'OpenAI 비용';
    }
    const status=$('aiCostStatus');
    if(status){
      const fxInfo=fx?.available
        ?' 원화는 '+rateText(fx)+' 기준 참고 금액입니다.'+(fx.fetched_at?' 환율 조회 '+localDateTime(fx.fetched_at)+'.':'')
        :' 환율을 불러오지 못해 USD 원본 금액으로 표시합니다.';
      status.className='ai-cost-notice '+(data.scope==='organization'||fx?.stale?'warn':'ok');
      status.textContent=(data.scope==='organization'
        ?'OPENAI_PROJECT_ID가 없어 OpenAI 조직 전체 실제 비용을 표시합니다. Program Studio 프로젝트만 보려면 프로젝트 ID를 서버에 설정하세요.'
        :'OpenAI Costs API의 실제 집계 금액입니다. 청구 시스템 집계에는 약간의 지연이 있을 수 있습니다.')+fxInfo;
    }

    setText('aiCostPeriod',periodLabel+(fx?.available?' · '+usd(costs.month_to_date):''));
    renderDaily(costs,fx);
    renderLineItems(costs,fx);
  }

  async function loadCosts(force=false){
    if(loading||(!force&&loaded))return;
    const user=window.auth?.currentUser;
    if(!user)return;
    loading=true;
    ensureDynamicUi();
    const button=$('aiCostRefreshBtn');
    if(button){button.disabled=true;button.textContent='조회 중...';}
    const status=$('aiCostStatus');
    if(status){status.className='ai-cost-notice';status.textContent='OpenAI 실제 비용과 최신 환율을 확인하고 있습니다.';}
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

  ensureDynamicUi();
  document.querySelector('[data-tab="aiCosts"]')?.addEventListener('click',()=>loadCosts(false));
  $('aiCostRefreshBtn')?.addEventListener('click',()=>loadCosts(true));
  $('refreshBtn')?.addEventListener('click',()=>{if(loaded)loadCosts(true);});

  window.ProgramAdminAiCosts={load:loadCosts};
})();
