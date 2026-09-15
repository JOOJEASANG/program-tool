// Interaction and readability refinements for the centered PDF Utility workspace.
(function(){
  'use strict';
  if(window.__programStudioPdfUtilityCenteredFixesV1)return;
  window.__programStudioPdfUtilityCenteredFixesV1=true;

  const $=id=>document.getElementById(id);

  function installStyle(){
    if($('pdfUtilityCenteredFixesStyle'))return;
    const style=document.createElement('style');
    style.id='pdfUtilityCenteredFixesStyle';
    style.textContent=`
      .pdfuc-upload.drag{
        border-color:#2563eb!important;
        background:#eff6ff!important;
        box-shadow:0 0 0 5px rgba(37,99,235,.10),0 14px 36px rgba(15,47,89,.10)!important;
      }
      .pdfuc-cat-head{min-height:108px!important;padding:7px 6px 14px!important}
      .pdfuc-cat-icon{width:52px!important;height:52px!important;border-radius:15px!important;font-size:28px!important;margin-bottom:10px!important}
      .pdfuc-cat-head strong{font-size:16px!important;line-height:1.35!important;font-weight:950!important}
      .pdfuc-cat-head>span:not(.pdfuc-cat-icon){font-size:10.5px!important;line-height:1.5!important;margin-top:4px!important}
      .pdfuc-category .pdfu-menu-item{
        grid-template-columns:34px minmax(0,1fr) auto!important;
        gap:9px!important;
        min-height:54px!important;
        padding:10px 9px!important;
        border-radius:11px!important;
      }
      .pdfuc-category .pdfu-menu-icon{font-size:20px!important;line-height:1!important}
      .pdfuc-category .pdfu-menu-name{font-size:12.5px!important;line-height:1.4!important;font-weight:900!important;white-space:normal!important}
      .pdfuc-category .pdfu-menu-badge{font-size:8.5px!important;padding:4px 6px!important}
      @media(max-width:600px){
        .pdfuc-cat-head{min-height:96px!important}
        .pdfuc-cat-icon{width:48px!important;height:48px!important;font-size:25px!important}
        .pdfuc-category .pdfu-menu-name{font-size:12px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function filesFromTransfer(dataTransfer){
    if(!dataTransfer)return [];
    const direct=Array.from(dataTransfer.files||[]).filter(Boolean);
    if(direct.length)return direct;
    return Array.from(dataTransfer.items||[])
      .filter(item=>item&&item.kind==='file')
      .map(item=>{try{return item.getAsFile?.()||null;}catch(_){return null;}})
      .filter(Boolean);
  }

  function isFileDrag(dataTransfer){
    if(!dataTransfer)return false;
    if((dataTransfer.files?.length||0)>0)return true;
    if(Array.from(dataTransfer.items||[]).some(item=>item?.kind==='file'))return true;
    return Array.from(dataTransfer.types||[]).includes('Files');
  }

  function zoneFromEvent(event){
    const target=event?.target;
    if(!(target instanceof Element))return null;
    return target.closest('#pdfUtilityCenteredUpload');
  }

  function handleDrag(event){
    const zone=zoneFromEvent(event);
    if(!zone||!isFileDrag(event.dataTransfer))return;
    event.preventDefault();
    event.stopPropagation();
    try{event.dataTransfer.dropEffect='copy';}catch(_){}
    zone.classList.add('drag');
  }

  function handleDrop(event){
    const zone=zoneFromEvent(event);
    if(!zone)return;
    event.preventDefault();
    event.stopPropagation();
    zone.classList.remove('drag');
    const files=filesFromTransfer(event.dataTransfer);
    if(!files.length)return;
    window.ProgramStudioPdfUtilityCentered?.addFiles?.(files);
    document.documentElement.dataset.pdfUtilityCenteredLastDrop=String(files.length);
  }

  function handleDragLeave(event){
    const zone=event.currentTarget;
    if(!(zone instanceof Element))return;
    const next=event.relatedTarget;
    if(next instanceof Node&&zone.contains(next))return;
    zone.classList.remove('drag');
  }

  function bindDropzone(){
    const zone=$('pdfUtilityCenteredUpload');
    if(!zone||!window.ProgramStudioPdfUtilityCentered)return false;
    if(zone.dataset.pdfucDropFix==='1')return true;
    zone.dataset.pdfucDropFix='1';
    document.addEventListener('dragenter',handleDrag,true);
    document.addEventListener('dragover',handleDrag,true);
    document.addEventListener('drop',handleDrop,true);
    zone.addEventListener('dragleave',handleDragLeave);
    document.documentElement.dataset.pdfUtilityCenteredDropzone='ready-v2';
    return true;
  }

  function install(){
    installStyle();
    if(bindDropzone())return;
    let tries=0;
    const timer=setInterval(()=>{
      tries+=1;
      if(bindDropzone()||tries>=100)clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.ProgramStudioPdfUtilityCenteredFixes=Object.freeze({
    filesFromTransfer,
    bindDropzone,
    stage:'pdf-utility-centered-fixes-v1'
  });
})();
