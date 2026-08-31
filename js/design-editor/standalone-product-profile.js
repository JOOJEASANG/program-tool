// Standalone design-product profiles.
// Keeps product identity, UX labels, runtime capabilities and product-specific
// sidebar order in one place while canonical editor manifests stay unchanged.
(function(){
  'use strict';
  if(window.DesignEditorStandaloneProducts)return;

  const MENU_ORDERS=Object.freeze({
    cover:Object.freeze([
      'designEmbeddedModeCard','designCoverSettingsTools','designCoverSpineTools',
      'designSimpleResultTools','designContentAddTools','designComponentBlocksTools','designPhase2Tools','designQuickDesignTools',
      'inspector','designPhase4SmartLayout','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ]),
    poster:Object.freeze([
      'designEmbeddedModeCard','designSimpleResultTools','designRecipeTools','designPhase4SmartLayout','designComponentBlocksTools',
      'designContentAddTools','designPhase2Tools','designQuickDesignTools','inspector','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ]),
    flyer:Object.freeze([
      'designEmbeddedModeCard','designSimpleResultTools','designComponentBlocksTools','designRecipeTools','designPhase4SmartLayout',
      'designContentAddTools','designPhase2Tools','designQuickDesignTools','inspector','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ]),
    invitation:Object.freeze([
      'designEmbeddedModeCard','designSimpleResultTools','designComponentBlocksTools','designRecipeTools','designContentAddTools',
      'designPhase2Tools','designQuickDesignTools','inspector','designPhase4SmartLayout','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ]),
    notice:Object.freeze([
      'designEmbeddedModeCard','designSimpleResultTools','designRecipeTools','designComponentBlocksTools','designContentAddTools',
      'designPhase2Tools','designQuickDesignTools','inspector','designPhase4SmartLayout','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ]),
    leaflet:Object.freeze([
      'designEmbeddedModeCard','designPhase4SmartLayout','designSimpleResultTools','designComponentBlocksTools','designRecipeTools',
      'designContentAddTools','designPhase2Tools','designQuickDesignTools','inspector','designLayerTools',
      'designPrintQualityTools','designPrintSafetyTools','designFinalPrintCheckTools','designOutputTools','designAdvancedTools'
    ])
  });

  const PROFILES=Object.freeze({
    cover:Object.freeze({key:'cover',runtimeProduct:'cover',label:'표지',badge:'표지 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common','cover']),sidebarOrder:MENU_ORDERS.cover}),
    poster:Object.freeze({key:'poster',runtimeProduct:'poster',label:'포스터',badge:'포스터 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common']),sidebarOrder:MENU_ORDERS.poster}),
    flyer:Object.freeze({key:'flyer',runtimeProduct:'flyer',label:'전단지',badge:'전단지 전용 작업',needsFoldRuntime:false,needsProductMenu:false,capabilities:Object.freeze(['common']),sidebarOrder:MENU_ORDERS.flyer}),
    invitation:Object.freeze({key:'invitation',runtimeProduct:'invitation',label:'초대장',badge:'초대장 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common']),sidebarOrder:MENU_ORDERS.invitation}),
    notice:Object.freeze({key:'notice',runtimeProduct:'invitation',label:'안내장',badge:'안내장 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common']),sidebarOrder:MENU_ORDERS.notice}),
    leaflet:Object.freeze({key:'leaflet',runtimeProduct:'leaflet',label:'리플렛',badge:'리플렛 전용 작업',needsFoldRuntime:true,needsProductMenu:true,capabilities:Object.freeze(['common','fold']),sidebarOrder:MENU_ORDERS.leaflet})
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
    menuOrders:MENU_ORDERS,
    get,
    fromLocation,
    allows,
    stage:'standalone-design-product-profiles-v1'
  });
})();