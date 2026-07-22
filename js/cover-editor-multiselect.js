(()=>{
  if(!location.pathname.includes('perfect-binding-cover'))return;
  const $=id=>document.getElementById(id);
  const selected=new Set();
  let internalSelect=false,busy=false;

  const isSpine=key=>/^spine(Top|Center|Bottom)$/.test(key);
  const rowFor=key=>document.querySelector(`#coverLayerList [data-layer="${key}"]`);
  const fire=el=>{if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
  const num=(el,fallback=50)=>{const v=Number(el?.value);return Number.isFinite(v)?v:fallback};

  function selectForRead(key){
    const row=rowFor(key);if(!row)return false;
    internalSelect=true;row.click();internalSelect=false;return true;
  }
  function readPosition(key){
    if(!selectForRead(key))return null;
    return isSpine(key)?{x:num($('spinePartX')),y:num($('spinePartY'))}:{x:num($('posX')),y:num($('posY'))};
  }
  function writePosition(key,pos){
    if(!selectForRead(key))return;
    const x=isSpine(key)?$('spinePartX'):$('posX'),y=isSpine(key)?$('spinePartY'):$('posY');
    if(x&&Number.isFinite(pos.x)){x.value=Math.max(num(x,0),Math.min(Number(x.max||100),pos.x));fire(x)}
    if(y&&Number.isFinite(pos.y)){y.value=Math.max(Number(y.min||0),Math.min(Number(y.max||100),pos.y));fire(y)}
  }
  function restorePrimary(){const key=[...selected][0];if(key)selectForRead(key)}
  function entries(){
    const out=[];for(const key of selected){const p=readPosition(key);if(p)out.push({key,...p})}restorePrimary();return out;
  }
  function runBatch(mutator){
    if(busy||selected.size<2)return;busy=true;
    try{const list=entries();if(list.length<2)return;mutator(list);for(const item of list)writePosition(item.key,item);restorePrimary();refresh();}
    finally{busy=false}
  }
  function align(axis,mode){runBatch(list=>{const values=list.map(v=>v[axis]);const target=mode==='min'?Math.min(...values):mode==='max'?Math.max(...values):50;list.forEach(v=>v[axis]=target)})}
  function distribute(axis){runBatch(list=>{list.sort((a,b)=>a[axis]-b[axis]);const start=list[0][axis],end=list[list.length-1][axis],gap=(end-start)/(list.length-1);list.forEach((v,i)=>v[axis]=start+gap*i)})}
  function moveGroup(dx,dy){runBatch(list=>list.forEach(v=>{v.x+=dx;v.y+=dy}))}

  function buildPanel(){
    if($('coverMultiPanel'))return;
    const list=$('coverLayerList');if(!list)return;
    const panel=document.createElement('div');panel.id='coverMultiPanel';panel.style.cssText='margin:8px 0;padding:9px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc';
    panel.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:7px"><strong style="font-size:10px">다중 선택·정렬</strong><span id="coverMultiCount" style="font-size:9px;color:#64748b">1개 선택</span></div><div style="font-size:8px;color:#64748b;margin-bottom:7px">Ctrl 또는 Shift를 누른 채 레이어를 클릭해 여러 개 선택</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px"><button class="mini-btn" data-a="x:min">왼쪽</button><button class="mini-btn" data-a="x:center">가로 중앙</button><button class="mini-btn" data-a="x:max">오른쪽</button><button class="mini-btn" data-a="y:min">위쪽</button><button class="mini-btn" data-a="y:center">세로 중앙</button><button class="mini-btn" data-a="y:max">아래쪽</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px"><button class="mini-btn" data-d="x">가로 균등 배치</button><button class="mini-btn" data-d="y">세로 균등 배치</button></div><button id="coverMultiClear" class="mini-btn" style="width:100%;margin-top:4px">단일 선택으로 돌아가기</button>`;
    list.after(panel);
    panel.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const [axis,mode]=b.dataset.a.split(':');align(axis,mode)});
    panel.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>distribute(b.dataset.d));
    $('coverMultiClear').onclick=()=>{const first=[...selected][0]||document.querySelector('#coverLayerList [data-layer]')?.dataset.layer;selected.clear();if(first)selected.add(first);restorePrimary();refresh()};
  }
  function refresh(){
    document.querySelectorAll('#coverLayerList [data-layer]').forEach(row=>{
      const on=selected.has(row.dataset.layer);row.style.boxShadow=on?'inset 0 0 0 2px #0ea5e9':'none';
      const badge=row.lastElementChild;if(badge)badge.textContent=on?(selected.size>1?'그룹':'선택'):'선택';
    });
    if($('coverMultiCount'))$('coverMultiCount').textContent=`${selected.size||1}개 선택`;
    document.querySelectorAll('#coverMultiPanel button[data-a],#coverMultiPanel button[data-d]').forEach(b=>b.disabled=selected.size<2);
  }
  function bind(){
    const list=$('coverLayerList');if(!list||list.dataset.multiBound)return;list.dataset.multiBound='1';
    const initial=document.querySelector('#coverLayerList [data-layer]')?.dataset.layer;if(initial)selected.add(initial);
    list.addEventListener('click',e=>{
      if(internalSelect)return;const row=e.target.closest('[data-layer]');if(!row)return;const key=row.dataset.layer;
      if(e.ctrlKey||e.metaKey||e.shiftKey){e.preventDefault();e.stopImmediatePropagation();selected.has(key)?selected.delete(key):selected.add(key);if(!selected.size)selected.add(key);internalSelect=true;row.click();internalSelect=false;refresh();return}
      selected.clear();selected.add(key);setTimeout(refresh,0);
    },true);
    document.addEventListener('keydown',e=>{
      if(selected.size<2||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
      const step=e.shiftKey?5:1;let dx=0,dy=0;if(e.key==='ArrowLeft')dx=-step;else if(e.key==='ArrowRight')dx=step;else if(e.key==='ArrowUp')dy=-step;else if(e.key==='ArrowDown')dy=step;else return;
      e.preventDefault();e.stopImmediatePropagation();moveGroup(dx,dy);
    },true);
    buildPanel();refresh();
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(bind,250));
})();