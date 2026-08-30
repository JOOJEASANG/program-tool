(function(){
  'use strict';
  if(window.__pdfBookletMenuPolishV1)return;
  window.__pdfBookletMenuPolishV1=true;

  function apply(){
    const row=document.getElementById('bookletRow');
    const check=document.getElementById('bookletCheck');
    if(!row||!check)return false;

    row.classList.add('booklet-option-card');
    const label=row.querySelector('label');
    const spans=label?label.querySelectorAll('span'):[];
    if(spans[0])spans[0].textContent='소책자 배치';
    if(spans[1])spans[1].textContent='양면 인쇄 후 절단·접기용 순서로 자동 배치';
    check.setAttribute('aria-label','소책자 배치 사용');

    if(!document.getElementById('pdfBookletMenuPolishStyleV1')){
      const style=document.createElement('style');
      style.id='pdfBookletMenuPolishStyleV1';
      style.textContent=`
        #bookletRow.booklet-option-card{
          margin-top:9px!important;
          padding:10px 11px!important;
          border:1px solid #dbe3ee;
          border-radius:10px;
          background:#f8fafc;
          transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;
        }
        #bookletRow.booklet-option-card:hover{
          border-color:#bfdbfe;
          background:#f5f9ff;
        }
        #bookletRow.booklet-option-card:has(#bookletCheck:checked){
          border-color:#93c5fd;
          background:#eff6ff;
          box-shadow:inset 3px 0 0 var(--primary);
        }
        #bookletRow.booklet-option-card>label{
          display:grid!important;
          grid-template-columns:minmax(0,1fr) 34px;
          grid-template-rows:auto auto;
          align-items:center!important;
          column-gap:10px!important;
          row-gap:2px!important;
          margin:0!important;
          cursor:pointer!important;
        }
        #bookletRow.booklet-option-card>label>span:first-of-type{
          grid-column:1;
          grid-row:1;
          font-size:11px!important;
          line-height:1.35;
          font-weight:850!important;
          color:#1f2937!important;
          letter-spacing:-.1px;
        }
        #bookletRow.booklet-option-card>label>span:nth-of-type(2){
          grid-column:1;
          grid-row:2;
          font-size:9.5px!important;
          line-height:1.45;
          font-weight:600!important;
          color:#7c8798!important;
          white-space:normal;
          word-break:keep-all;
        }
        #bookletRow.booklet-option-card #bookletCheck{
          appearance:none;
          -webkit-appearance:none;
          grid-column:2;
          grid-row:1 / span 2;
          justify-self:end;
          position:relative;
          width:34px!important;
          height:19px!important;
          margin:0!important;
          border:0!important;
          border-radius:999px;
          background:#cbd5e1;
          cursor:pointer!important;
          outline:none;
          box-shadow:none!important;
          transition:background .15s ease;
        }
        #bookletRow.booklet-option-card #bookletCheck::after{
          content:'';
          position:absolute;
          top:2px;
          left:2px;
          width:15px;
          height:15px;
          border-radius:50%;
          background:#fff;
          box-shadow:0 1px 3px rgba(15,23,42,.25);
          transition:transform .15s ease;
        }
        #bookletRow.booklet-option-card #bookletCheck:checked{
          background:var(--primary);
        }
        #bookletRow.booklet-option-card #bookletCheck:checked::after{
          transform:translateX(15px);
        }
        #bookletRow.booklet-option-card #bookletCheck:focus-visible{
          outline:3px solid rgba(37,99,235,.18);
          outline-offset:2px;
        }
        #bookletRow.booklet-option-card #bookletPadInfo{
          margin:8px 0 0!important;
          padding:6px 8px!important;
          border-radius:7px;
          background:#dbeafe;
          color:#1d4ed8!important;
          font-size:9.5px!important;
          line-height:1.4;
          font-weight:800!important;
        }
      `;
      document.head.appendChild(style);
    }
    return true;
  }

  if(!apply()){
    const observer=new MutationObserver(()=>{
      if(apply())observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
})();
