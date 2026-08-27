// PDF preflight result prioritization and filtering.
(function(){
  'use strict';
  if(window.__pdfPreflightWorkflowV2)return;
  window.__pdfPreflightWorkflowV2=true;

  const path=(location.pathname||'/').replace(/\/+$/,'')||'/';
  if(!(path==='/pdf-preflight'||path==='/pdf-preflight/index.html'||path.endsWith('/pdf-preflight/index.html')||path.endsWith('/tools/preflight.html')||path.endsWith('/tools/pdf-Checker.html')))return;

  const ORDER={fail:0,warning:1,pass:2,unknown:3};
  let activeFilter='all';
  let observer=null;
  let queued=false;

  function severity(card){
    const badge=card?.querySelector('.check-badge');
    if(badge?.classList.contains('fail'))return'fail';
    if(badge?.classList.contains('warning'))return'warning';
    if(badge?.classList.contains('pass'))return'pass';
    return'unknown';
  }

  function installStyles(){
    if(document.getElementById('pdfPreflightWorkflowV2Styles'))return;
    const style=document.createElement('style');style.id='pdfPreflightWorkflowV2Styles';style.textContent=`
      .preflight-priority-v2{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 13px;padding:11px 12px;border:1px solid #dce5ef;border-radius:13px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.04)}.preflight-priority-label{margin-right:auto;font-size:11px;font-weight:900;color:#475569}.preflight-filter{min-height:34px;border:1px solid #dbe4ed;border-radius:9px;background:#f8fafc;color:#475569;padding:0 10px;font-size:10px;font-weight:900;cursor:pointer}.preflight-filter.active{border-color:#7ba8d3;background:#eef6ff;color:#155184}.preflight-filter[data-filter="fail"]{color:#b42318}.preflight-filter[data-filter="warning"]{color:#a15c05}.preflight-filter[data-filter="pass"]{color:#16704e}
      #checksGrid .check-card{position:relative;transition:.15s}#checksGrid .check-card[data-preflight-severity="fail"]{border-left:4px solid #dc2626;background:#fffafa}#checksGrid .check-card[data-preflight-severity="warning"]{border-left:4px solid #d97706;background:#fffdf8}#checksGrid .check-card[data-preflight-severity="pass"]{border-left:4px solid #16a34a}#checksGrid .check-card.preflight-filter-hidden{display:none}.preflight-priority-text{font-size:9px;font-weight:950;letter-spacing:.03em;margin-top:5px}.check-card[data-preflight-severity="fail"] .preflight-priority-text{color:#b42318}.check-card[data-preflight-severity="warning"] .preflight-priority-text{color:#a15c05}.check-card[data-preflight-severity="pass"] .preflight-priority-text{color:#16704e}
      @media(max-width:520px){.preflight-priority-label{width:100%;margin-right:0}.preflight-filter{flex:1;padding:0 7px}}
    `;document.head.appendChild(style);
  }

  function installToolbar(){
    if(document.getElementById('preflightPriorityV2'))return true;
    const grid=document.getElementById('checksGrid');if(!grid)return false;
    const bar=document.createElement('div');bar.id='preflightPriorityV2';bar.className='preflight-priority-v2';bar.setAttribute('aria-label','검사 결과 필터');bar.innerHTML='<span class="preflight-priority-label">중요한 결과부터 확인하세요</span><button class="preflight-filter active" type="button" data-filter="all">전체 0</button><button class="preflight-filter" type="button" data-filter="fail">문제 0</button><button class="preflight-filter" type="button" data-filter="warning">확인 0</button><button class="preflight-filter" type="button" data-filter="pass">정상 0</button>';
    grid.insertAdjacentElement('beforebegin',bar);
    bar.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{activeFilter=button.dataset.filter||'all';sync();}));
    return true;
  }

  function priorityLabel(level){return level==='fail'?'우선 수정 필요':level==='warning'?'확인 권장':level==='pass'?'정상':'확인';}

  function sync(){
    queued=false;
    const grid=document.getElementById('checksGrid'),bar=document.getElementById('preflightPriorityV2');if(!grid||!bar)return;
    const cards=[...grid.querySelectorAll(':scope > .check-card')];
    const counts={all:cards.length,fail:0,warning:0,pass:0,unknown:0};
    cards.forEach((card,index)=>{
      const level=severity(card);counts[level]+=1;card.dataset.preflightSeverity=level;card.dataset.preflightOriginalOrder=card.dataset.preflightOriginalOrder||String(index);
      let label=card.querySelector('.preflight-priority-text');if(!label){label=document.createElement('div');label.className='preflight-priority-text';const copy=card.querySelector('.check-detail')?.parentElement||card.querySelector('div:last-child')||card;copy.appendChild(label);}label.textContent=priorityLabel(level);
      card.classList.toggle('preflight-filter-hidden',activeFilter!=='all'&&level!==activeFilter);
    });
    const sorted=[...cards].sort((a,b)=>ORDER[severity(a)]-ORDER[severity(b)]||Number(a.dataset.preflightOriginalOrder||0)-Number(b.dataset.preflightOriginalOrder||0));
    const current=[...grid.querySelectorAll(':scope > .check-card')];
    if(sorted.some((card,index)=>current[index]!==card))sorted.forEach(card=>grid.appendChild(card));
    const labels={all:'전체',fail:'문제',warning:'확인',pass:'정상'};
    bar.querySelectorAll('[data-filter]').forEach(button=>{const key=button.dataset.filter;button.textContent=`${labels[key]} ${counts[key]||0}`;button.classList.toggle('active',key===activeFilter);button.setAttribute('aria-pressed',String(key===activeFilter));});
    const summary=document.getElementById('resSummary');if(summary&&cards.length){summary.dataset.prioritySummary='1';if(counts.fail)summary.title=`문제 ${counts.fail}개를 먼저 확인하세요.`;else if(counts.warning)summary.title=`확인 필요 ${counts.warning}개가 있습니다.`;else summary.title='검사 항목이 정상입니다.';}
  }

  function queueSync(){if(queued)return;queued=true;queueMicrotask(sync);}

  function install(attempt=0){
    installStyles();if(!installToolbar()){if(attempt<16)setTimeout(()=>install(attempt+1),90+attempt*40);return;}
    const grid=document.getElementById('checksGrid');if(grid&&!observer){observer=new MutationObserver(queueSync);observer.observe(grid,{childList:true});}
    sync();window.PdfPreflightWorkflowV2={refresh:sync,setFilter:value=>{activeFilter=['all','fail','warning','pass'].includes(value)?value:'all';sync();},stage:'pdf-preflight-priority-v2'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>install(),{once:true});else install();
})();