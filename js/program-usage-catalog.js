// Shared Program Studio usage-quota catalog.
(function(){
  'use strict';
  if(window.ProgramUsageCatalog)return;

  const DEFAULT_GUEST_LIMIT=3;
  const DEFAULT_MEMBER_LIMIT=10;
  const DEFAULT_PERIOD='daily';
  const registry=new Map();
  const ID_RE=/^[a-z0-9][a-z0-9-]{1,63}$/;

  function normalize(entry){
    if(!entry||!ID_RE.test(String(entry.id||'')))throw new Error('Invalid program usage id');
    const paths=Array.isArray(entry.paths)?entry.paths.map(value=>String(value||'').trim()).filter(Boolean):[];
    return Object.freeze({
      id:String(entry.id),
      name:String(entry.name||entry.id),
      paths:Object.freeze(paths),
      defaultGuestLimit:Number.isInteger(entry.defaultGuestLimit)?entry.defaultGuestLimit:DEFAULT_GUEST_LIMIT,
      defaultMemberLimit:Number.isInteger(entry.defaultMemberLimit)?entry.defaultMemberLimit:DEFAULT_MEMBER_LIMIT,
      defaultPeriod:entry.defaultPeriod==='monthly'?'monthly':DEFAULT_PERIOD,
      quotaEnabledByDefault:entry.quotaEnabledByDefault!==false,
      source:String(entry.source||'catalog')
    });
  }

  function register(entry){
    const normalized=normalize(entry);
    registry.set(normalized.id,normalized);
    return normalized;
  }

  [
    {id:'print-checker',name:'인쇄물 사전 검토',paths:['/print-checker'],source:'built-in'},
    {id:'smart-print-layout',name:'스마트 인쇄배치',paths:['/smart-print-layout'],source:'built-in'},
    {id:'pdf-editor',name:'PDF배치',paths:['/pdf-editor'],source:'built-in'},
    {id:'pdf-editor-advanced',name:'PDF편집',paths:['/pdf-editor-advanced'],source:'built-in'},
    {id:'pdf-preflight',name:'PDF 도구 모음',paths:['/pdf-preflight','/pdf-suite','/tools/preflight','/tools/pdf-Checker'],source:'built-in'}
  ].forEach(register);

  function list(){return [...registry.values()];}
  function get(id){return registry.get(String(id||''))||null;}
  function resolve(pathname=location.pathname){
    const explicit=document.documentElement?.dataset?.usageProgramId;
    if(explicit&&registry.has(explicit))return explicit;
    const path=String(pathname||'').replace(/\/+$/,'')||'/';
    let best=null;
    for(const entry of registry.values()){
      for(const raw of entry.paths){
        const candidate=String(raw||'').replace(/\/+$/,'')||'/';
        if(path===candidate||path.startsWith(candidate+'/')){
          if(!best||candidate.length>best.path.length)best={id:entry.id,path:candidate};
        }
      }
    }
    return best?.id||null;
  }

  window.ProgramUsageCatalog=Object.freeze({
    register,
    list,
    get,
    resolve,
    defaultGuestLimit:DEFAULT_GUEST_LIMIT,
    defaultMemberLimit:DEFAULT_MEMBER_LIMIT,
    defaultPeriod:DEFAULT_PERIOD,
    idPattern:ID_RE.source,
    stage:'program-usage-catalog-v1'
  });
})();
