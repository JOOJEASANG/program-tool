(function(){
  'use strict';
  if(window.__designEditorRuntimeDiagnosticsV1)return;
  window.__designEditorRuntimeDiagnosticsV1=true;

  const path=location.pathname.replace(/\/+$/,'')||'/';
  if(path!=='/design-editor/general'&&path!=='/design-editor/general.html'&&!path.endsWith('/design-editor/general.html'))return;

  const STORAGE_KEY='programTool.designEditor.runtimeDiagnostics.v1';
  const MAX_RECORDS=40;
  const MAX_TEXT=320;
  const STYLE_ID='designEditorRuntimeDiagnosticsStyles';
  const BUTTON_ID='designDiagnosticsButton';
  const MODAL_ID='designDiagnosticsModal';
  let memoryRecords=[];
  let installed=false;

  const byId=id=>document.getElementById(id);
  const now=()=>new Date().toISOString();
  function cleanText(value){
    let text=String(value??'');
    text=text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]');
    text=text.replace(/data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+/gi,'[data-url]');
    text=text.replace(/blob:https?:\/\/[^\s)]+/gi,'[blob-url]');
    return text.slice(0,MAX_TEXT);
  }
  function cleanUrl(value){
    if(!value)return'';
    try{return new URL(String(value),location.href).pathname.slice(0,MAX_TEXT);}catch(_){return cleanText(value);}
  }
  function loadRecords(){
    try{
      const parsed=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'[]');
      memoryRecords=Array.isArray(parsed)?parsed.slice(-MAX_RECORDS):[];
    }catch(_){memoryRecords=[];}
  }
  function persistRecords(){
    try{sessionStorage.setItem(STORAGE_KEY,JSON.stringify(memoryRecords.slice(-MAX_RECORDS)));}catch(_){}
  }
  function record(type,message,extra){
    const item={time:now(),type:cleanText(type||'info'),message:cleanText(message||'')};
    if(extra&&typeof extra==='object'){
      const safe={};
      Object.entries(extra).slice(0,8).forEach(([key,value])=>{
        if(/url|src|href/i.test(key))safe[key]=cleanUrl(value);
        else if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')safe[key]=cleanText(value);
      });
      if(Object.keys(safe).length)item.extra=safe;
    }
    memoryRecords.push(item);
    if(memoryRecords.length>MAX_RECORDS)memoryRecords=memoryRecords.slice(-MAX_RECORDS);
    persistRecords();
    refreshButton();
    return item;
  }
  function clear(){memoryRecords=[];persistRecords();refreshButton();}

  function storageCheck(kind){
    if(kind==='indexedDB')return typeof indexedDB!=='undefined';
    try{
      const key='__programStudioDesignDiagnostics';
      localStorage.setItem(key,'1');
      localStorage.removeItem(key);
      return true;
    }catch(_){return false;}
  }
  function projectSummary(){
    const project=window.DesignEditorApp?.project;
    if(!project)return{ready:false};
    const surfaces=Array.isArray(project.surfaces)?project.surfaces:[];
    let textCount=0,imageCount=0,shapeCount=0,missingImages=0;
    surfaces.forEach(surface=>{
      textCount+=Array.isArray(surface?.elements)?surface.elements.length:0;
      (Array.isArray(surface?.extras)?surface.extras:[]).forEach(item=>{
        if(item?.type==='image'){
          imageCount+=1;
          if(!item.src&&!item.assetId)missingImages+=1;
        }else if(item?.type==='shape')shapeCount+=1;
      });
    });
    return{
      ready:true,
      presetId:cleanText(project.presetId||''),
      width:Number(project.width)||0,
      height:Number(project.height)||0,
      surfaces:surfaces.length,
      textElements:textCount,
      images:imageCount,
      shapes:shapeCount,
      missingImages,
      activeSurfaceExists:surfaces.some(surface=>surface?.id===project.activeSurface)
    };
  }
  function runtimeSummary(){
    const manifest=Array.isArray(window.ProgramStudioDesignEditorRuntimeManifest)?window.ProgramStudioDesignEditorRuntimeManifest:[];
    const modules=manifest.map(entry=>{
      const node=byId(entry.id);
      return{
        id:cleanText(entry.id),
        status:node?.dataset?.failed||((node?.dataset?.loaded==='true')?'loaded':node?'pending':'missing')
      };
    });
    return{
      expected:manifest.length,
      loaded:modules.filter(item=>item.status==='loaded').length,
      failed:modules.filter(item=>item.status==='error'||item.status==='timeout').length,
      missing:modules.filter(item=>item.status==='missing').length,
      modules
    };
  }
  function audit(){
    const runtime=runtimeSummary();
    const storage={localStorage:storageCheck('localStorage'),indexedDB:storageCheck('indexedDB')};
    const project=projectSummary();
    const issues=[];
    runtime.modules.filter(item=>item.status==='error'||item.status==='timeout').forEach(item=>issues.push(`런타임 모듈 ${item.id}: ${item.status}`));
    if(!storage.localStorage)issues.push('브라우저 로컬 저장소를 사용할 수 없습니다.');
    if(!storage.indexedDB)issues.push('브라우저 이미지 저장소를 사용할 수 없습니다.');
    if(project.ready){
      if(project.width<=0||project.height<=0)issues.push('작업 문서 크기가 올바르지 않습니다.');
      if(project.surfaces<1)issues.push('작업면이 없습니다.');
      if(!project.activeSurfaceExists)issues.push('현재 작업면 참조가 올바르지 않습니다.');
      if(project.missingImages>0)issues.push(`원본 참조가 없는 이미지 ${project.missingImages}개가 있습니다.`);
    }
    return{ok:issues.length===0,runtime,storage,project,issues};
  }
  function report(){
    return{
      format:'program-studio-design-runtime-diagnostics',
      version:1,
      generatedAt:now(),
      path:location.pathname,
      appVersion:cleanText(window.ProgramStudioVersion||''),
      browser:cleanText(navigator.userAgent),
      viewport:{width:innerWidth,height:innerHeight,devicePixelRatio:Number(devicePixelRatio)||1},
      health:audit(),
      records:memoryRecords.slice(-MAX_RECORDS)
    };
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;
    style.textContent=`
      .design-diagnostics-btn{margin-left:auto;border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:7px;padding:4px 8px;font-size:7px;font-weight:900;cursor:pointer}.design-diagnostics-btn[data-state="warn"]{border-color:#f59e0b;color:#92400e;background:#fffbeb}.design-diagnostics-overlay{position:fixed;inset:0;z-index:10050;background:rgba(15,23,42,.42);display:grid;place-items:center;padding:20px}.design-diagnostics-panel{width:min(680px,94vw);max-height:84vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 24px 70px rgba(15,23,42,.28);padding:18px;color:#0f172a}.design-diagnostics-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.design-diagnostics-head h2{margin:0;font-size:15px}.design-diagnostics-summary{margin:12px 0;padding:10px;border-radius:9px;background:#f8fafc;font-size:9px;line-height:1.6}.design-diagnostics-summary[data-state="warn"]{background:#fffbeb;color:#92400e}.design-diagnostics-list{display:grid;gap:6px;margin:10px 0}.design-diagnostics-row{padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:8px;line-height:1.5}.design-diagnostics-empty{color:#64748b;font-size:8px}.design-diagnostics-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:14px}.design-diagnostics-actions button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:7px 10px;font-size:8px;font-weight:900;cursor:pointer}.design-diagnostics-actions .primary{background:#12396d;color:#fff;border-color:#12396d}
    `;
    document.head.appendChild(style);
  }
  function refreshButton(){
    const button=byId(BUTTON_ID);if(!button)return;
    const health=audit();
    const errorCount=memoryRecords.filter(item=>item.type==='error'||item.type==='rejection'||item.type==='runtime-error'||item.type==='runtime-timeout').length;
    const count=health.issues.length+errorCount;
    button.dataset.state=count?'warn':'ok';
    button.textContent=count?`진단 ${count}`:'진단 정상';
    button.title=count?'확인이 필요한 런타임 진단 항목이 있습니다.':'최근 런타임 진단에서 문제가 발견되지 않았습니다.';
  }
  function closeModal(){byId(MODAL_ID)?.remove();}
  function modalRow(text){const node=document.createElement('div');node.className='design-diagnostics-row';node.textContent=text;return node;}
  function showModal(){
    closeModal();
    const data=report();
    const overlay=document.createElement('div');overlay.id=MODAL_ID;overlay.className='design-diagnostics-overlay';
    const panel=document.createElement('div');panel.className='design-diagnostics-panel';
    const head=document.createElement('div');head.className='design-diagnostics-head';
    const title=document.createElement('h2');title.textContent='편집기 진단';head.appendChild(title);
    const close=document.createElement('button');close.type='button';close.textContent='닫기';close.addEventListener('click',closeModal);head.appendChild(close);panel.appendChild(head);
    const summary=document.createElement('div');summary.className='design-diagnostics-summary';summary.dataset.state=data.health.ok?'ok':'warn';
    summary.textContent=data.health.ok?`런타임 ${data.health.runtime.loaded}/${data.health.runtime.expected} · 로컬 저장 정상 · 현재 작업 구조 정상`:`확인 필요 ${data.health.issues.length}건 · 런타임 ${data.health.runtime.loaded}/${data.health.runtime.expected}`;
    panel.appendChild(summary);
    const list=document.createElement('div');list.className='design-diagnostics-list';
    if(data.health.issues.length)data.health.issues.forEach(item=>list.appendChild(modalRow(item)));
    data.records.slice(-12).reverse().forEach(item=>list.appendChild(modalRow(`${item.time} · ${item.type} · ${item.message}`)));
    if(!list.children.length){const empty=document.createElement('div');empty.className='design-diagnostics-empty';empty.textContent='최근 오류 기록이 없습니다.';list.appendChild(empty);}
    panel.appendChild(list);
    const actions=document.createElement('div');actions.className='design-diagnostics-actions';
    const clearButton=document.createElement('button');clearButton.type='button';clearButton.textContent='기록 지우기';clearButton.addEventListener('click',()=>{clear();showModal();});actions.appendChild(clearButton);
    const copyButton=document.createElement('button');copyButton.type='button';copyButton.className='primary';copyButton.textContent='진단 정보 복사';copyButton.addEventListener('click',()=>copyReport(copyButton));actions.appendChild(copyButton);
    panel.appendChild(actions);overlay.appendChild(panel);overlay.addEventListener('click',event=>{if(event.target===overlay)closeModal();});document.body.appendChild(overlay);
  }
  async function copyReport(button){
    const text=JSON.stringify(report(),null,2);
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
      }
      button.textContent='복사됨';setTimeout(()=>{button.textContent='진단 정보 복사';},1000);
    }catch(_){button.textContent='복사 실패';}
  }
  function installButton(){
    const footer=document.querySelector('.editor-footer');if(!footer||byId(BUTTON_ID))return false;
    const button=document.createElement('button');button.id=BUTTON_ID;button.type='button';button.className='design-diagnostics-btn';button.addEventListener('click',showModal);footer.appendChild(button);refreshButton();return true;
  }

  function bindErrors(){
    window.addEventListener('error',event=>{
      const target=event.target;
      if(target&&target!==window&&(target.src||target.href)){
        record('resource-error','리소스를 불러오지 못했습니다.',{tag:target.tagName||'',src:target.src||target.href||''});
        return;
      }
      record('error',event.message||'스크립트 오류',{source:event.filename||'',line:event.lineno||0,column:event.colno||0});
    },true);
    window.addEventListener('unhandledrejection',event=>{
      const reason=event.reason;
      record('rejection',reason?.message||reason||'처리되지 않은 비동기 오류');
    });
    window.addEventListener('programstudio:runtime-script-result',event=>{
      const detail=event.detail||{};
      if(detail.status==='error'||detail.status==='timeout')record(`runtime-${detail.status}`,`런타임 모듈 ${detail.id||''} 로드 실패`,{src:detail.src||''});
      setTimeout(refreshButton,0);
    });
  }
  function install(){
    if(installed)return;
    installed=true;loadRecords();installStyles();bindErrors();installButton();
    [300,900,1800,3500].forEach(delay=>setTimeout(()=>{installButton();refreshButton();},delay));
    window.DesignEditorRuntimeDiagnostics={record,report,audit,clear,stage:'local-runtime-qa-diagnostics'};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
