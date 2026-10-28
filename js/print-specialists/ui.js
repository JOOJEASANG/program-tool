// Shared accessible workspace for three print-only tools. No document editor or AI calls.
(function(){
  'use strict';
  if(window.PrintSpecialistUi)return;
  const modules=new Map();
  const $=id=>document.getElementById(id);
  function loadScript(src,check){
    if(check())return Promise.resolve();
    return new Promise((resolve,reject)=>{
      let script=[...document.scripts].find(item=>item.src===new URL(src,location.href).href);
      const done=()=>check()?resolve():reject(new Error('필요한 처리 라이브러리를 불러오지 못했습니다.'));
      if(script){script.addEventListener('load',done,{once:true});script.addEventListener('error',reject,{once:true});return;}
      script=document.createElement('script');script.src=src;script.async=true;script.onload=done;
      script.onerror=()=>reject(new Error('라이브러리 연결에 실패했습니다. 인터넷 연결을 확인하세요.'));
      document.head.appendChild(script);
    });
  }
  function library(name){
    if(name==='pdf')return loadScript('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',()=>!!window.PDFLib);
    if(name==='xlsx')return loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>!!window.XLSX);
    if(name==='qr')return loadScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',()=>typeof window.QRCode==='function');
    if(name==='pdfjs')return loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',()=>!!window.pdfjsLib)
      .then(()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';});
    return Promise.reject(new Error('지원하지 않는 라이브러리'));
  }
  function installStyles(){
    if($('printSpecialistStyle'))return;
    const style=document.createElement('style');style.id='printSpecialistStyle';
    style.textContent=[
      '.ps-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:30000;padding:15px;background:rgba(15,23,42,.72);font-family:Pretendard,"Noto Sans KR",sans-serif}',
      '.ps-overlay.open{display:flex}.ps-dialog{width:min(960px,100%);max-height:94vh;overflow:auto;background:#fff;color:#172033;border-radius:18px;box-shadow:0 25px 100px #0005}',
      '.ps-head{position:sticky;top:0;z-index:1;background:#fff;border-bottom:1px solid #dce5ed;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:15px}',
      '.ps-head h2{font-size:20px;font-weight:850;margin:0}.ps-head p{font-size:12px;color:#64748b;margin:4px 0 0}.ps-close{padding:7px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;cursor:pointer;font-size:14px}',
      '.ps-body{padding:20px}.ps-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ps-fields label{font-size:13px;font-weight:700;color:#334155;display:grid;gap:6px}',
      '.ps-fields input,.ps-fields select{width:100%;box-sizing:border-box;min-height:38px;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;background:white;color:#172033}',
      '.ps-fields input[type=checkbox]{width:auto;min-height:auto}.ps-fields .wide{grid-column:1/-1}.ps-help{font-size:12px;line-height:1.7;color:#475569;margin:12px 0}.ps-actions{display:flex;flex-wrap:wrap;gap:10px;margin:16px 0}',
      '.ps-btn{border:0;border-radius:10px;padding:11px 17px;background:#155e75;color:#fff;font-size:13px;font-weight:800;cursor:pointer}.ps-btn.secondary{background:#e2e8f0;color:#334155}.ps-btn:disabled{opacity:.5;cursor:wait}',
      '.ps-status{font-size:13px;color:#0f766e;min-height:21px;white-space:pre-wrap}.ps-status.error{color:#b91c1c}.ps-preview{width:100%;min-height:130px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:auto;display:grid;place-items:center;padding:10px;box-sizing:border-box}',
      '.ps-preview canvas{max-width:100%;height:auto;border:1px solid #cbd5e1}.ps-note{font-size:12px;color:#64748b;line-height:1.7}.ps-launch{display:block;box-sizing:border-box;width:100%;margin-top:12px;text-align:left;padding:12px 14px;border:1px solid #90c7d4;border-radius:10px;background:#ecfeff;color:#155e75;font-weight:850;cursor:pointer;font-size:13px}',
      '@media(max-width:650px){.ps-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.ps-dialog{max-height:97vh}.ps-body{padding:12px}.ps-head{padding:12px}.ps-head h2{font-size:17px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function mount(){
    installStyles();let overlay=$('printSpecialistOverlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='printSpecialistOverlay';overlay.className='ps-overlay';
    overlay.innerHTML='<div class="ps-dialog" role="dialog" aria-modal="true" aria-labelledby="psTitle"><header class="ps-head"><div><h2 id="psTitle"></h2><p id="psSub"></p></div><button type="button" class="ps-close" id="psClose">닫기 ×</button></header><div class="ps-body" id="psBody"></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
    $('psClose').addEventListener('click',close);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close();});
    return overlay;
  }
  function close(){const element=$('printSpecialistOverlay');element?.classList.remove('open');element?.removeAttribute('data-active-tool');}
  function open(id){
    const tool=modules.get(id);if(!tool)throw new Error('등록되지 않은 작업입니다.');
    const overlay=mount();$('psTitle').textContent=tool.title;$('psSub').textContent=tool.description;
    $('psBody').innerHTML=tool.markup;$('psBody').scrollTop=0;
    overlay.dataset.activeTool=id;overlay.classList.add('open');
    tool.bind($('psBody'),{library,download,setStatus,close,mm:mm=>mm*72/25.4});
    $('psClose').focus();
  }
  function setStatus(body,message,error=false){const status=body.querySelector('.ps-status');if(status){status.textContent=message;status.classList.toggle('error',error);}}
  function download(data,filename,mime='application/pdf'){
    const blob=data instanceof Blob?data:new Blob([data],{type:mime});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),20000);
  }
  function register(id,tool){modules.set(id,tool);}
  window.PrintSpecialistUi=Object.freeze({register,open,close,library,download,setStatus,mm:mm=>mm*72/25.4});
})();