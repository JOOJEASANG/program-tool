/* Shared print paper favorites: reuse Smart Print Layout's original storage key. */
(() => {
  'use strict';
  if(window.SharedPaperFavorites)return;
  const KEY='program-studio.smart-print.paper-presets.v1',MAX=30;
  const $=id=>document.getElementById(id);
  const round=n=>Math.round(Number(n)*10)/10;
  const valid=n=>Number.isFinite(Number(n))&&Number(n)>=50&&Number(n)<=2000;
  const fixed={a5:[148,210],b5:[182,257],a4:[210,297],b4:[257,364],a3:[297,420],
    sra3:[320,450],a3plus:[329,483],letter:[216,279],card:[105,148]};
  function load(){
    try {
      const raw=JSON.parse(localStorage.getItem(KEY)||'[]');
      if(!Array.isArray(raw))return [];
      const names=new Set();
      return raw.filter(item=>{
        if(!item||typeof item.id!=='string'||!/^[a-z0-9-]{1,64}$/i.test(item.id)
          ||typeof item.name!=='string'||!item.name.trim()||item.name.length>32
          ||!valid(item.width)||!valid(item.height))return false;
        const name=item.name.trim().toLowerCase();
        if(names.has(name))return false;
        names.add(name);return true;
      }).slice(0,MAX).map(item=>({id:item.id,name:item.name.trim(),
        width:round(item.width),height:round(item.height)}));
    }catch(_){return [];}
  }
  function write(items){
    try{
      localStorage.setItem(KEY,JSON.stringify(items));
      window.dispatchEvent(new Event('shared-paper-favorites-change'));return true;
    }catch(_){return false;}
  }
  function save(name,width,height){
    name=String(name||'').trim();
    if(!name||name.length>32)return {error:'규격 이름은 1~32자로 입력해 주세요.'};
    if(!valid(width)||!valid(height))return {error:'가로·세로는 50~2,000mm로 입력해 주세요.'};
    const items=load(),prev=items.find(item=>item.name.toLowerCase()===name.toLowerCase());
    if(!prev&&items.length>=MAX)return {error:'용지 규격은 최대 30개까지 저장할 수 있습니다.'};
    const item=prev?{...prev,name,width:round(width),height:round(height)}
      :{id:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9),
         name,width:round(width),height:round(height)};
    const future=prev?items.map(p=>p.id===prev.id?item:p):[...items,item];
    return write(future)?{item}:{error:'브라우저 저장소를 사용할 수 없습니다.'};
  }
  function remove(id){
    const items=load(),item=items.find(p=>p.id===id);
    if(!item)return {error:'삭제할 규격을 선택해 주세요.'};
    return write(items.filter(p=>p.id!==id))?{item}:{error:'브라우저 저장소를 사용할 수 없습니다.'};
  }
  function adapter(){
    if($('paperPreset')&&$('paperSavePreset'))return {kind:'native',target:$('paperPreset')};
    if($('advancedPaperSize')&&$('advancedPaperCustomW')&&$('advancedPaperCustomH'))
      return {kind:'advanced',target:$('advancedPaperSize'),w:$('advancedPaperCustomW'),h:$('advancedPaperCustomH')};
    if($('paperSize')&&$('customW')&&$('customH'))
      return {kind:'pdf-layout',target:$('paperSize'),w:$('customW'),h:$('customH')};
    if($('sizePreset')&&$('trimWidth')&&$('trimHeight'))
      return {kind:'design',target:$('sizePreset'),w:$('trimWidth'),h:$('trimHeight')};
    return null;
  }
  function trigger(node,type){node?.dispatchEvent(new Event(type,{bubbles:true}));}
  function dimensions(a){
    if(!a||a.kind==='native')return null;
    if(a.kind==='design')return [Number(a.w.value),Number(a.h.value)];
    return a.target.value==='custom'?[Number(a.w.value),Number(a.h.value)]
      :(fixed[a.target.value]||[Number(a.w.value),Number(a.h.value)]);
  }
  function apply(a,item){
    if(!a?.w||!a?.h||!item)return;
    a.target.value='custom';trigger(a.target,'change');
    a.w.value=String(item.width);a.h.value=String(item.height);
    trigger(a.w,'change');trigger(a.h,'change');
    trigger(a.w,'input');trigger(a.h,'input');
  }
  function styles(){
    if($('sharedPaperFavoritesStyles'))return;
    const style=document.createElement('style');style.id='sharedPaperFavoritesStyles';
    style.textContent=[
      '.shared-paper-favorites{display:flex;flex-direction:column;gap:6px;margin:9px 0;padding:10px;border:1px solid #cbdce4;border-radius:9px;background:#f6fafb;color:#284259;font-family:Pretendard,"Noto Sans KR",system-ui,sans-serif}',
      '.shared-paper-favorites label{font-size:10px;font-weight:900;color:#33566b}',
      '.shared-paper-favorites .shared-paper-row{display:flex;gap:5px;min-width:0}',
      '.shared-paper-favorites select,.shared-paper-favorites input{flex:1 1 auto;min-width:0;height:33px;border:1px solid #cbd9e4;border-radius:7px;background:#fff;color:#243c55;padding:5px 7px;font-size:11px}',
      '.shared-paper-favorites button{flex:0 0 auto;min-height:32px;padding:5px 9px;border:1px solid #0f766e;border-radius:7px;background:#0f766e;color:#fff;cursor:pointer;font-size:10px;font-weight:850}',
      '.shared-paper-favorites button.secondary{border-color:#cbd5e1;background:#fff;color:#3b546c}',
      '.shared-paper-favorites button:disabled{opacity:.48;cursor:not-allowed}',
      '.shared-paper-favorites small{font-size:9px;line-height:1.5;color:#64748b}',
      '.shared-paper-favorites .shared-paper-status{min-height:13px;font-size:10px}',
      '@media(max-width:520px){.shared-paper-favorites .shared-paper-row{flex-wrap:wrap}}'
    ].join('\n');
    document.head.appendChild(style);
  }
  function mount(a){
    if(!a||a.kind==='native'||$('sharedPaperFavorites'))return;
    styles();
    const div=document.createElement('div');div.id='sharedPaperFavorites';
    div.className='shared-paper-favorites';
    div.innerHTML=[
      '<label for="sharedPaperSelect">자주 쓰는 용지 · 모든 프로그램 공통</label>',
      '<div class="shared-paper-row"><select id="sharedPaperSelect" aria-label="저장한 용지 규격"><option value="">저장된 용지 선택</option></select><button type="button" id="sharedPaperApply">적용</button></div>',
      '<div class="shared-paper-row"><input id="sharedPaperName" type="text" maxlength="32" aria-label="저장할 규격 이름" placeholder="예: 디지털출력 305×457"><button type="button" id="sharedPaperSave">현재 크기 저장</button><button type="button" id="sharedPaperDelete" class="secondary">삭제</button></div>',
      '<small>같은 브라우저에서 PDF배치·PDF편집·스마트 인쇄배치·디자인 보완이 목록을 공유합니다.</small>',
      '<div id="sharedPaperStatus" class="shared-paper-status" role="status" aria-live="polite"></div>'
    ].join('');
    const parent=a.target.closest('.field')||a.target.closest('.tool-section')||a.target.parentElement;
    if(a.kind==='advanced')a.target.insertAdjacentElement('afterend',div);
    else parent.insertAdjacentElement('afterend',div);
    const select=$('sharedPaperSelect');
    const message=(text,error=false)=>{
      $('sharedPaperStatus').textContent=text;
      $('sharedPaperStatus').style.color=error?'#b42336':'#0f766e';
    };
    const refresh=()=>{
      const selected=select.value;
      select.replaceChildren();
      const blank=document.createElement('option');blank.value='';blank.textContent='저장된 용지 선택';
      select.appendChild(blank);
      load().forEach(item=>{
        const option=document.createElement('option');option.value=item.id;
        option.textContent=item.name+' · '+item.width+'×'+item.height+'mm';
        select.appendChild(option);
      });
      if([...select.options].some(o=>o.value===selected))select.value=selected;
      $('sharedPaperDelete').disabled=!select.value;
    };
    const choose=()=>{
      const item=load().find(p=>p.id===select.value);
      if(!item)return message('저장된 용지 규격을 선택해 주세요.',true);
      const limit=a.kind==='design'?1500:1200;
      if(item.width>limit||item.height>limit)return message(
        '이 프로그램은 최대 '+limit+'mm까지 지원합니다. 다른 규격을 선택해 주세요.',true);
      apply(a,item);message(item.name+' · '+item.width+'×'+item.height+'mm 적용');
    };
    $('sharedPaperApply').addEventListener('click',choose);
    select.addEventListener('change',()=>{refresh();if(select.value)choose();});
    $('sharedPaperSave').addEventListener('click',()=>{
      const size=dimensions(a);
      const result=save($('sharedPaperName').value,size?.[0],size?.[1]);
      if(result.error)return message(result.error,true);
      refresh();select.value=result.item.id;
      $('sharedPaperDelete').disabled=false;
      message('저장했습니다: '+result.item.name);
    });
    $('sharedPaperDelete').addEventListener('click',()=>{
      const item=load().find(p=>p.id===select.value);
      if(!item||!window.confirm('저장한 용지 "'+item.name+'"을 삭제할까요?'))return;
      const result=remove(item.id);
      if(result.error)return message(result.error,true);
      refresh();message('삭제했습니다. 현재 크기는 유지됩니다.');
    });
    window.addEventListener('shared-paper-favorites-change',refresh);
    window.addEventListener('storage',event=>{if(event.key===KEY)refresh();});
    refresh();document.documentElement.dataset.sharedPaperFavorites='mounted';
  }
  function boot(){
    const a=adapter();
    if(a?.kind==='native'){
      document.documentElement.dataset.sharedPaperFavorites='native';return true;
    }
    if(a?.w&&a?.h){mount(a);return true;}
    return false;
  }
  window.SharedPaperFavorites={load,save,remove,dimensions,apply,storageKey:KEY};
  if(!boot()){
    const observer=new MutationObserver(()=>{if(boot())observer.disconnect();});
    observer.observe(document.documentElement,{childList:true,subtree:true});
    window.addEventListener('load',()=>{if(boot())observer.disconnect();},{once:true});
  }
})();