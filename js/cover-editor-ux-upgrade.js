(()=>{
  if(!location.pathname.includes('perfect-binding-cover'))return;
  const $=id=>document.getElementById(id);
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const parts={
    spineTop:{label:'책등 상단',field:'spineTop',x:50,y:14,scale:100},
    spineCenter:{label:'책등 중앙',field:'spineCenter',x:50,y:50,scale:100},
    spineBottom:{label:'책등 하단',field:'spineBottom',x:50,y:86,scale:100}
  };
  let active='spineCenter',drag=null,hitBoxes={};

  function request(){try{window.requestRender?.()}catch(_){}}
  function dispatch(el){el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))}
  function replaceWithTextarea(id,rows=2){
    const old=$(id);if(!old||old.tagName==='TEXTAREA')return old;
    const ta=document.createElement('textarea');
    [...old.attributes].forEach(a=>{if(a.name!=='type'&&a.name!=='value')ta.setAttribute(a.name,a.value)});
    ta.rows=rows;ta.value=old.value||old.getAttribute('value')||'';
    ta.style.resize='vertical';ta.style.minHeight=(rows*24+18)+'px';
    old.replaceWith(ta);ta.addEventListener('input',request);ta.addEventListener('change',request);return ta;
  }
  function syncFront(){
    const hidden=$('publisher');if(!hidden)return;
    hidden.value=[$('institutionName')?.value,$('issuerName')?.value,$('publishYearLine')?.value].map(v=>(v||'').trim()).filter(Boolean).join('\n');
    dispatch(hidden);request();
  }
  function syncBack(){
    const hidden=$('backText');if(!hidden)return;
    hidden.value=[$('backTitleExtra')?.value,$('backBodyExtra')?.value].map(v=>(v||'').trim()).filter(Boolean).join('\n\n');
    dispatch(hidden);request();
  }
  function buildControls(){
    if($('spineIndependentPanel'))return;
    const anchor=$('spineTop')?.closest('.grid3')||$('spineCenter')?.parentElement;if(!anchor)return;
    const panel=document.createElement('div');panel.id='spineIndependentPanel';
    panel.style.cssText='margin-top:10px;padding:12px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc';
    panel.innerHTML=`<div style="font-size:12px;font-weight:900;margin-bottom:8px">책등 요소별 위치·크기</div>
      <div id="spinePartButtons" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <label style="font-size:11px;font-weight:800">가로 위치<input id="spinePartX" type="range" min="0" max="100" step="1"></label>
        <label style="font-size:11px;font-weight:800">세로 위치<input id="spinePartY" type="range" min="3" max="97" step="1"></label>
        <label style="font-size:11px;font-weight:800">글자 크기<input id="spinePartScale" type="range" min="50" max="200" step="1"></label>
      </div>
      <div style="display:flex;gap:6px;margin-top:9px"><button type="button" id="spinePartCenter" class="btn secondary">가운데 맞춤</button><button type="button" id="spinePartReset" class="btn secondary">선택 초기화</button></div>
      <div id="spinePartHint" style="font-size:10px;color:#64748b;margin-top:7px">미리보기에서 각 책등 글자를 직접 드래그할 수 있습니다.</div>`;
    anchor.after(panel);
    const buttons=$('spinePartButtons');
    Object.entries(parts).forEach(([key,p])=>{const b=document.createElement('button');b.type='button';b.dataset.key=key;b.className='btn secondary';b.textContent=p.label;b.onclick=()=>select(key);buttons.appendChild(b)});
    ['spinePartX','spinePartY','spinePartScale'].forEach(id=>$(id).addEventListener('input',()=>{const p=parts[active];p.x=+$('spinePartX').value;p.y=+$('spinePartY').value;p.scale=+$('spinePartScale').value;syncControls();request()}));
    $('spinePartCenter').onclick=()=>{parts[active].x=50;syncControls();request()};
    $('spinePartReset').onclick=()=>{const defaults={spineTop:[50,14,100],spineCenter:[50,50,100],spineBottom:[50,86,100]}[active];Object.assign(parts[active],{x:defaults[0],y:defaults[1],scale:defaults[2]});syncControls();request()};
    select(active);
  }
  function select(key){active=key;syncControls();request();document.dispatchEvent(new CustomEvent('cover-spine-selected',{detail:{key}}))}
  function syncControls(){
    const p=parts[active];if(!p)return;
    if($('spinePartX'))$('spinePartX').value=p.x;
    if($('spinePartY'))$('spinePartY').value=p.y;
    if($('spinePartScale'))$('spinePartScale').value=p.scale;
    document.querySelectorAll('#spinePartButtons button').forEach(b=>{b.classList.toggle('primary',b.dataset.key===active);b.style.outline=b.dataset.key===active?'2px solid #1d9bb2':'none'});
    if($('spinePartHint'))$('spinePartHint').textContent=`${p.label} 선택 · X ${Math.round(p.x)}% · Y ${Math.round(p.y)}% · 크기 ${Math.round(p.scale)}%`;
  }
  function drawPart(ctx,key,s,pxPerMm,spineX,bleed,trimH){
    const p=parts[key],value=($(p.field)?.value||'').trim();if(!value||s.spine<2.2){hitBoxes[key]=null;return}
    const spine=s.spine*pxPerMm,cx=spineX+spine*clamp(p.x/100,0,1),cy=bleed+trimH*clamp(p.y/100,0,1);
    const basePt=Math.min(clamp(parseFloat($('spineTextSize')?.value||11),5,30),Math.max(5,s.spine/(25.4/72)*.56));
    let fontPx=basePt*pxPerMm*25.4/72*clamp(p.scale/100,.5,2),dir=$('spineDirection')?.value||'bottomToTop';
    const lines=value.split(/\n/);ctx.save();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${key==='spineCenter'?900:700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;
    if(dir==='vertical'){
      const chars=[...value.replace(/\s+/g,'')],gap=fontPx*1.05,total=Math.max(fontPx,chars.length*gap);chars.forEach((ch,i)=>ctx.fillText(ch,cx,cy+(i-(chars.length-1)/2)*gap));hitBoxes[key]={x:spineX,y:cy-Math.min(total/2,trimH*.14),w:spine,h:Math.min(total,trimH*.28),cx,cy};
    }else{
      ctx.translate(cx,cy);ctx.rotate(dir==='topToBottom'?Math.PI/2:-Math.PI/2);
      const gap=fontPx*1.18,maxWidth=trimH*.30;let widest=0;lines.forEach(line=>widest=Math.max(widest,ctx.measureText(line).width));while(widest>maxWidth&&fontPx>pxPerMm*1.5){fontPx*=.95;ctx.font=`${key==='spineCenter'?900:700} ${fontPx}px Pretendard,"Malgun Gothic",sans-serif`;widest=Math.max(...lines.map(l=>ctx.measureText(l).width),0)}
      lines.forEach((line,i)=>ctx.fillText(line,0,(i-(lines.length-1)/2)*gap));const h=Math.min(Math.max(fontPx*2,widest+16),trimH*.28);hitBoxes[key]={x:spineX,y:cy-h/2,w:spine,h,cx,cy};
    }
    ctx.restore();
    if(key===active){const b=hitBoxes[key];ctx.save();ctx.strokeStyle='#f59e0b';ctx.lineWidth=Math.max(2,pxPerMm*.45);ctx.setLineDash([6,4]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.restore()}
  }
  function installRenderer(){
    if(window.__coverUxWrapped||typeof window.renderCover!=='function')return;window.__coverUxWrapped=true;
    const original=window.renderCover;
    window.renderCover=function(canvas,dpi=110,withGuides,interactive){
      const fields=['spineTop','spineCenter','spineBottom','spineTitle'],saved={};fields.forEach(id=>{const el=$(id);if(el){saved[id]=el.value;el.value=''}});
      const s=original.apply(this,arguments);fields.forEach(id=>{const el=$(id);if(el&&id in saved)el.value=saved[id]});
      const ctx=canvas.getContext('2d'),pxPerMm=dpi/25.4,spineX=(s.bleed+s.trimW)*pxPerMm,bleed=s.bleed*pxPerMm,trimH=s.trimH*pxPerMm;hitBoxes={};
      drawPart(ctx,'spineTop',s,pxPerMm,spineX,bleed,trimH);drawPart(ctx,'spineCenter',s,pxPerMm,spineX,bleed,trimH);drawPart(ctx,'spineBottom',s,pxPerMm,spineX,bleed,trimH);return s;
    };
  }
  function canvasPoint(e,c){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
  function distanceToBox(p,b){if(!b)return Infinity;const dx=p.x<b.x?b.x-p.x:p.x>b.x+b.w?p.x-(b.x+b.w):0,dy=p.y<b.y?b.y-p.y:p.y>b.y+b.h?p.y-(b.y+b.h):0;return Math.hypot(dx,dy)+(Math.abs(p.y-b.cy)*.08)}
  function nearestPart(p){return Object.keys(parts).map(key=>({key,d:distanceToBox(p,hitBoxes[key])})).filter(v=>Number.isFinite(v.d)&&v.d<40).sort((a,b)=>a.d-b.d)[0]?.key||null}
  function bindCanvas(){const c=$('previewCanvas');if(!c||c.dataset.spineUx)return;c.dataset.spineUx='1';
    c.addEventListener('pointerdown',e=>{if(e.button!==0)return;const pt=canvasPoint(e,c),key=nearestPart(pt);if(!key)return;e.preventDefault();e.stopImmediatePropagation();select(key);drag={id:e.pointerId,key,start:pt,x:parts[key].x,y:parts[key].y};c.setPointerCapture(e.pointerId)},true);
    c.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const pt=canvasPoint(e,c),p=parts[drag.key],box=hitBoxes[drag.key];p.x=clamp(drag.x+(pt.x-drag.start.x)/Math.max(1,box.w)*100,0,100);p.y=clamp(drag.y+(pt.y-drag.start.y)/Math.max(1,c.height)*100,3,97);syncControls();request();e.preventDefault();e.stopImmediatePropagation()},true);
    const end=e=>{if(drag&&drag.id===e.pointerId){drag=null;try{c.releasePointerCapture(e.pointerId)}catch(_){}}};c.addEventListener('pointerup',end,true);c.addEventListener('pointercancel',end,true);
    c.addEventListener('wheel',e=>{const pt=canvasPoint(e,c),key=nearestPart(pt);if(!key)return;e.preventDefault();e.stopImmediatePropagation();select(key);parts[key].scale=clamp(parts[key].scale+(e.deltaY<0?5:-5),50,200);syncControls();request()},{passive:false,capture:true});
  }
  function findEditOption(words){const sel=$('editTarget');if(!sel)return null;return [...sel.options].find(o=>words.some(w=>(o.textContent+o.value).toLowerCase().includes(w.toLowerCase())))||null}
  const layerDefs=[
    {key:'frontTitle',label:'앞표지 제목',field:'frontTitle',words:['제목','title']},
    {key:'frontSubtitle',label:'앞표지 부제목',field:'frontSubtitle',words:['부제','subtitle']},
    {key:'institutionName',label:'기관명',field:'institutionName',words:['기관']},
    {key:'issuerName',label:'발행처',field:'issuerName',words:['발행처','publisher']},
    {key:'publishYearLine',label:'발행년도',field:'publishYearLine',words:['발행년도','연도','year']},
    {key:'spineTop',label:'책등 상단',field:'spineTop',spine:true},
    {key:'spineCenter',label:'책등 중앙',field:'spineCenter',spine:true},
    {key:'spineBottom',label:'책등 하단',field:'spineBottom',spine:true},
    {key:'backTitleExtra',label:'뒤표지 제목',field:'backTitleExtra',words:['뒤표지 제목','back title']},
    {key:'backBodyExtra',label:'뒤표지 본문',field:'backBodyExtra',words:['뒤표지','back']}
  ];
  let selectedLayer='frontTitle';
  function buildLayerPanel(){
    if($('coverLayerPanel'))return;
    const settings=document.querySelector('.settings');if(!settings)return;
    const panel=document.createElement('section');panel.className='card';panel.id='coverLayerPanel';
    panel.innerHTML=`<div class="card-head"><span class="step">L</span><div><div class="card-title">레이어와 속성</div><div class="card-note">편집할 글자를 선택한 뒤 위치와 크기를 조절하세요.</div></div></div><div id="coverLayerList" style="display:grid;gap:5px"></div><div id="coverLayerProperty" style="margin-top:9px;padding:9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:9px"></div>`;
    settings.prepend(panel);
    const list=$('coverLayerList');
    layerDefs.forEach(def=>{const row=document.createElement('button');row.type='button';row.dataset.layer=def.key;row.style.cssText='display:flex;align-items:center;gap:7px;width:100%;border:1px solid #dbe5ee;background:#fff;border-radius:8px;padding:7px 8px;text-align:left;cursor:pointer;font-size:10px;font-weight:850;color:#334155';row.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:#1d9bb2"></span><span style="flex:1">${def.label}</span><span style="font-size:9px;color:#94a3b8">선택</span>`;row.onclick=()=>selectLayer(def.key);list.appendChild(row)});
    selectLayer(selectedLayer);
  }
  function selectLayer(key){
    const def=layerDefs.find(v=>v.key===key);if(!def)return;selectedLayer=key;
    document.querySelectorAll('#coverLayerList [data-layer]').forEach(b=>{const on=b.dataset.layer===key;b.style.background=on?'#ecfeff':'#fff';b.style.borderColor=on?'#67c7d8':'#dbe5ee';b.style.color=on?'#0e7490':'#334155'});
    if(def.spine){select(key);$('spineIndependentPanel')?.scrollIntoView({behavior:'smooth',block:'nearest'})}
    else{const opt=findEditOption(def.words||[]),sel=$('editTarget');if(opt&&sel){sel.value=opt.value;dispatch(sel)}$(def.field)?.focus({preventScroll:true})}
    renderLayerProperty(def);
  }
  function renderLayerProperty(def){
    const box=$('coverLayerProperty');if(!box)return;
    const field=$(def.field),text=(field?.value||'').trim();
    if(def.spine){const p=parts[def.key];box.innerHTML=`<div style="font-size:10px;font-weight:900;margin-bottom:6px">${def.label}</div><div style="font-size:9px;color:#64748b;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text||'입력 내용 없음'}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px"><button type="button" data-action="x" class="mini-btn">X ${Math.round(p.x)}%</button><button type="button" data-action="y" class="mini-btn">Y ${Math.round(p.y)}%</button><button type="button" data-action="scale" class="mini-btn">크기 ${Math.round(p.scale)}%</button></div>`;box.querySelector('[data-action="x"]').onclick=()=>$('spinePartX')?.focus();box.querySelector('[data-action="y"]').onclick=()=>$('spinePartY')?.focus();box.querySelector('[data-action="scale"]').onclick=()=>$('spinePartScale')?.focus();return}
    box.innerHTML=`<div style="font-size:10px;font-weight:900;margin-bottom:6px">${def.label}</div><div style="font-size:9px;color:#64748b;margin-bottom:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text||'입력 내용 없음'}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px"><button type="button" data-focus="posX" class="mini-btn">가로 위치</button><button type="button" data-focus="posY" class="mini-btn">세로 위치</button><button type="button" data-focus="itemScale" class="mini-btn">크기</button></div>`;box.querySelectorAll('[data-focus]').forEach(b=>b.onclick=()=>$(b.dataset.focus)?.focus())
  }
  function init(){
    ['frontTitle','frontSubtitle','institutionName','issuerName','backTitleExtra','backBodyExtra'].forEach(id=>replaceWithTextarea(id,id==='backBodyExtra'?4:2));
    ['institutionName','issuerName','publishYearLine'].forEach(id=>$(id)?.addEventListener('input',syncFront));
    ['backTitleExtra','backBodyExtra'].forEach(id=>$(id)?.addEventListener('input',syncBack));
    layerDefs.forEach(def=>$(def.field)?.addEventListener('input',()=>{if(selectedLayer===def.key)renderLayerProperty(def)}));
    syncFront();syncBack();buildControls();installRenderer();bindCanvas();buildLayerPanel();request();
    document.addEventListener('cover-spine-selected',e=>{selectedLayer=e.detail.key;const def=layerDefs.find(v=>v.key===selectedLayer);if(def){document.querySelectorAll('#coverLayerList [data-layer]').forEach(b=>{const on=b.dataset.layer===selectedLayer;b.style.background=on?'#ecfeff':'#fff';b.style.borderColor=on?'#67c7d8':'#dbe5ee'});renderLayerProperty(def)}});
    document.addEventListener('keydown',e=>{if(!parts[active]||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;const step=e.shiftKey?5:1;if(e.key==='ArrowLeft')parts[active].x-=step;else if(e.key==='ArrowRight')parts[active].x+=step;else if(e.key==='ArrowUp')parts[active].y-=step;else if(e.key==='ArrowDown')parts[active].y+=step;else return;parts[active].x=clamp(parts[active].x,0,100);parts[active].y=clamp(parts[active].y,3,97);syncControls();const def=layerDefs.find(v=>v.key===active);if(def)renderLayerProperty(def);request();e.preventDefault()});
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
})();