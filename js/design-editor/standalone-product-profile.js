// Standalone design-product profiles.
// Keeps product identity, UX labels and runtime capabilities in one place while
// the canonical design manifests remain unchanged for integrated-editor safety.
(function(){
  'use strict';
  if(window.DesignEditorStandaloneProducts)return;

  const PROFILES=Object.freeze({
    cover:Object.freeze({key:'cover',runtimeProduct:'cover',label:'표지',badge:'표지 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common','cover'])}),
    poster:Object.freeze({key:'poster',runtimeProduct:'poster',label:'포스터',badge:'포스터 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common'])}),
    flyer:Object.freeze({key:'flyer',runtimeProduct:'flyer',label:'전단지',badge:'전단지 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common'])}),
    invitation:Object.freeze({key:'invitation',runtimeProduct:'invitation',label:'초대장',badge:'초대장 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common'])}),
    notice:Object.freeze({key:'notice',runtimeProduct:'invitation',label:'안내장',badge:'안내장 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common'])}),
    leaflet:Object.freeze({key:'leaflet',runtimeProduct:'leaflet',label:'리플렛',badge:'리플렛 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common','fold'])})
  });

  function normalizeKey(value){
    const raw=String(value||'').trim().toLowerCase();
    if(raw==='leaflet2'||raw==='leaflet3')return'leaflet';
    return raw;
  }

  function get(value){return PROFILES[normalizeKey(value)]||null;}

  function fromLocation(search=location.search){
    const params=new URLSearchParams(search);
    const raw=normalizeKey(params.get('app'));
    if(raw==='invitation'&&params.get('surface')==='notice')return PROFILES.notice;
    return get(raw);
  }

  function allows(profile,capability){
    const item=typeof profile==='string'?get(profile):profile;
    return Boolean(item&&item.capabilities.includes(String(capability||'')));
  }

  window.DesignEditorStandaloneProducts=Object.freeze({
    profiles:PROFILES,
    get,
    fromLocation,
    allows,
    stage:'standalone-design-product-profiles-v1'
  });
})();
