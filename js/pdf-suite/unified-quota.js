// Apply the shared daily-free quota to successful jobs in the unified PDF workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUnifiedQuotaV1)return;
  window.__programStudioPdfUnifiedQuotaV1=true;

  let pending=null;
  let serial=0;

  function buttonAction(button){return `unified-${button?.dataset?.pdfUnifiedRun||'pdf'}`;}

  async function gate(button){
    if(!window.ProgramPdfDailyFree?.canStart){
      button.dataset.pdfUnifiedQuotaPass='1';
      button.click();
      return;
    }
    const action=buttonAction(button);
    const result=await window.ProgramPdfDailyFree.canStart(action);
    if(!result.ok){alert(result.message);return;}
    pending={id:++serial,action,committed:false,startedAt:Date.now()};
    button.dataset.pdfUnifiedQuotaPass='1';
    button.click();
  }

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('#pdfUnifiedRun[data-pdf-unified-run]');
    if(!button||button.disabled)return;
    if(button.dataset.pdfUnifiedQuotaPass==='1'){
      delete button.dataset.pdfUnifiedQuotaPass;
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    gate(button).catch(error=>alert(error?.message||'무료 사용량을 확인하지 못했습니다.'));
  },true);

  const observer=new MutationObserver(records=>{
    if(!pending||pending.committed)return;
    const success=records.some(record=>record.type==='attributes'&&record.attributeName==='data-pdf-unified-last-result');
    if(!success)return;
    const current=pending;
    current.committed=true;
    if(window.ProgramPdfDailyFree?.commitSuccess){
      window.ProgramPdfDailyFree.commitSuccess(current.action).catch(error=>console.warn('[pdf-unified-quota] commit failed',error));
    }
    setTimeout(()=>{if(pending?.id===current.id)pending=null;},1800);
  });
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-pdf-unified-last-result']});

  window.ProgramStudioPdfUnifiedQuota=Object.freeze({stage:'pdf-suite-unified-quota-v1'});
})();