// Selected PDF source pages: compact content-margin editor in the right page rail.
// The canonical left-panel engine still owns preview, export and session persistence.
(function(){
  'use strict';
  if(window.__pdfSelectedPageMarginsV1)return;
  window.__pdfSelectedPageMarginsV1=true;
  const EDGES=['left','right','top','bottom'];
  const id=x=>document.getElementById(x);
  function init(){
    const panel=id('pageSelectedMarginPanel');
    const area=id('thumbArea');
    if(!panel||!area)return;
    const count=id('pageSelectedMarginCount'),status=id('pageSelectedMarginStatus');
    const apply=id('pageSelectedMarginApply'),reset=id('pageSelectedMarginReset');
    const fields=Object.fromEntries(EDGES.map(edge=>[edge,id('pageSelectedMargin'+edge[0].toUpperCase()+edge.slice(1))]));
    let previousKey=null,frame=0;
    const dirty=new Set();
    const api=()=>window.PdfEditorLayoutExport;
    function selection(){
      return api()?.selectedSourcePages?.()||[];
    }
    function selectedKey(pages){
      return pages.map(p=>String(p.id)).sort().join(',');
    }
    function setStatus(message,error=false){
      if(!status)return;
      status.textContent=message;
      status.dataset.error=error?'true':'false';
    }
    function refresh(force=false){
      const engine=api();
      const pages=selection();
      // Selection can change due to upload or deletion without changing count.
      const key=selectedKey(pages);
      panel.hidden=!area.closest('#thumbSection')||!(id('thumbSection')?.style.display!=='none');
      count.textContent=pages.length+'페이지';
      const ready=Boolean(engine?.applySelectedPageMargins)&&pages.length>0;
      for(const edge of EDGES)fields[edge].disabled=!ready;
      apply.disabled=!ready;reset.disabled=!ready;
      if(!force&&previousKey===key)return;
      previousKey=key;dirty.clear();
      if(!ready){
        for(const edge of EDGES){fields[edge].value='';fields[edge].placeholder='–';}
        setStatus('페이지를 선택하면 해당 페이지만 여백을 변경할 수 있습니다.');
        return;
      }
      const globals=engine.marginValues();
      for(const edge of EDGES){
        const values=pages.map(page=>engine.pageCellMargins(page,globals)[edge]);
        const same=values.every(value=>value===values[0]);
        fields[edge].value=same?String(values[0]):'';
        fields[edge].placeholder=same?'mm':'혼합';
      }
      const ordinals=pages.map(page=>{
        try{return parsedPages.indexOf(page)+1;}catch(_){return 0;}
      }).filter(n=>n>0);
      setStatus(ordinals.length<=4
        ? ordinals.join(', ')+'페이지 선택 · 이 페이지만 수정'
        : pages.length+'페이지 선택 · 수정한 방향만 적용');
    }
    for(const edge of EDGES)fields[edge].addEventListener('input',()=>dirty.add(edge));
    apply.addEventListener('click',()=>{
      const engine=api();
      if(!engine?.applySelectedPageMargins)return setStatus('개별 여백 기능을 불러오지 못했습니다.',true);
      // A blank mixed-value input stays unchanged unless specifically edited.
      const changes={};
      for(const edge of dirty){
        const element=fields[edge];
        const raw=element.value.trim();
        if(!raw)continue;
        changes[edge]=raw;
      }
      const result=engine.applySelectedPageMargins(changes);
      if(!result.ok)return setStatus(result.error,true);
      refresh(true);
      setStatus(result.count+'페이지의 개별 여백을 적용했습니다.');
    });
    reset.addEventListener('click',()=>{
      const engine=api();
      if(!engine?.applySelectedPageMargins)return setStatus('개별 여백 기능을 불러오지 못했습니다.',true);
      const result=engine.applySelectedPageMargins({},true);
      if(!result.ok)return setStatus(result.error,true);
      refresh(true);
      setStatus(result.count+'페이지의 개별 여백을 초기화했습니다. 전체 여백을 따릅니다.');
    });
    const queue=(force=false)=>{
      if(force){refresh(true);return;}
      if(frame)return;
      frame=requestAnimationFrame(()=>{frame=0;refresh(false);});
    };
    document.addEventListener('pdf-page-selection-change',()=>queue());
    document.addEventListener('pdf-page-margin-change',()=>queue(true));
    document.addEventListener('pdf-import-committed',()=>queue(true));
    document.addEventListener('pdf-file-removed',()=>queue(true));
    ['marginLeft','marginRight','marginTop','marginBottom'].forEach(name=>{
      id(name)?.addEventListener('change',()=>queue(true));
    });
    new MutationObserver(()=>queue()).observe(area,{childList:true,subtree:false});
    const section=id('thumbSection');
    if(section)new MutationObserver(()=>queue(true)).observe(section,{attributes:true,attributeFilter:['style','hidden']});
    queue(true);
    window.PdfSelectedPageMargins={
      refresh:()=>refresh(true),
      get selectedCount(){return selection().length;},
      stage:'right-sidebar-selected-page-content-margins-v1',
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();