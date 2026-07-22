(()=>{
  if(!location.pathname.includes('perfect-binding-cover'))return;
  const $=id=>document.getElementById(id);
  const KEY='programTool.coverEditor.layerStyle.v1';
  const defs=[
    ['frontTitle','앞표지 제목','frontTitle'],['frontSubtitle','앞표지 부제목','frontSubtitle'],
    ['institutionName','기관명','institutionName'],['issuerName','발행처','issuerName'],['publishYearLine','발행년도','publishYearLine'],
    ['spineTop','책등 상단','spineTop'],['spineCenter','책등 중앙','spineCenter'],['spineBottom','책등 하단','spineBottom'],
    ['backTitleExtra','뒤표지 제목','backTitleExtra'],['backBodyExtra','뒤표지 본문','backBodyExtra']
  ].map(([key,label,field])=>({key,label,field}));
  const defaults=()=>({order:defs.map(v=>v.key),layers:Object.fromEntries(defs.map(v=>[v.key,{visible:true,locked:false,color:'',weight:700,tracking:0,align:'center',opacity:100}]))});
  let data=defaults(),current='frontTitle',wrapped=false,applying=false;
  const def=k=>defs.find(v=>v.key===k),row=k=>document.querySelector(`#coverLayerList [data-layer="${k}"]`);
  function load(){try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved){data={...defaults(),...saved,layers:{...defaults().layers,...(saved.layers||{})}}}}catch(_){}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(_){} }
  function style(k){return data.layers[k]||(data.layers[k]=defaults().layers[k])}
  function textValues(){const out=[];defs.forEach(d=>{const v=($(d.field)?.value||'').trim();if(!v)return;v.split(/\n/).forEach(line=>{if(line.trim())out.push({key:d.key,text:line.trim()})})});return out.sort((a,b)=>b.text.length-a.text.length)}
  function matchText(text,map){const t=String(text||'').trim();return map.find(v=>v.text===t)?.key||null}
  function drawTracked(ctx,original,text,x,y,maxWidth,st){
    const chars=[...String(text)],gap=Number(st.tracking||0);if(!gap||chars.length<2)return original.call(ctx,text,x,y,maxWidth);
    const widths=chars.map(ch=>ctx.measureText(ch).width),total=widths.reduce((a,b)=>a+b,0)+gap*(chars.length-1);let start=x;
    if(ctx.textAlign==='center')start=x-total/2;else if(ctx.textAlign==='right'||ctx.textAlign==='end')start=x-total;
    ctx.save();ctx.textAlign='left';chars.forEach((ch,i)=>{original.call(ctx,ch,start,y);start+=widths[i]+gap});ctx.restore();
  }
  function wrapRenderer(){
    if(wrapped||typeof window.renderCover!=='function')return;wrapped=true;const prior=window.renderCover;
    window.renderCover=function(){
      const saved={},hidden=data.layers,map=textValues();
      defs.forEach(d=>{const el=$(d.field);if(el){saved[d.field]=el.value;if(hidden[d.key]?.visible===false)el.value=''}});
      const publisher=$('publisher'),backText=$('backText');if(publisher){saved.publisher=publisher.value;publisher.value=['institutionName','issuerName','publishYearLine'].filter(k=>style(k).visible!==false).map(k=>($(k)?.value||'').trim()).filter(Boolean).join('\n')}
      if(backText){saved.backText=backText.value;backText.value=['backTitleExtra','backBodyExtra'].filter(k=>style(k).visible!==false).map(k=>($(k)?.value||'').trim()).filter(Boolean).join('\n\n')}
      const proto=CanvasRenderingContext2D.prototype,original=proto.fillText;
      proto.fillText=function(text,x,y,maxWidth){const key=matchText(text,map),st=key?style(key):null;if(!st||st.visible===false)return st?undefined:original.call(this,text,x,y,maxWidth);this.save();try{if(st.color)this.fillStyle=st.color;this.globalAlpha*=Math.max(0,Math.min(1,Number(st.opacity||100)/100));if(st.align)this.textAlign=st.align;const font=this.font||'';this.font=font.match(/^\s*(normal|bold|[1-9]00)\s+/)?font.replace(/^\s*(normal|bold|[1-9]00)\s+/,`${st.weight||700} `):`${st.weight||700} ${font}`;return drawTracked(this,original,text,x,y,maxWidth,st)}finally{this.restore()}};
      try{return prior.apply(this,arguments)}finally{proto.fillText=original;Object.entries(saved).forEach(([id,v])=>{const el=$(id);if(el)el.value=v})}
    };
  }
  function fire(el){if(!el)return;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
  function rerender(){try{window.requestRender?.()}catch(_){} }
  function locked(){return style(current).locked}
  function applyOrder(){const list=$('coverLayerList');if(!list)return;data.order.forEach(k=>{const r=row(k);if(r)list.appendChild(r)})}
  function paintRows(){defs.forEach(d=>{const r=row(d.key);if(!r)return;const st=style(d.key);r.style.opacity=st.visible===false?'.45':'1';r.dataset.locked=st.locked?'1':'0';let tools=r.querySelector('.layer-style-tools');if(!tools){tools=document.createElement('span');tools.className='layer-style-tools';tools.style.cssText='display:flex;gap:3px;margin-left:auto';tools.innerHTML='<button type="button" data-eye title="표시/숨김" style="border:0;background:transparent;cursor:pointer;padding:2px">●</button><button type="button" data-lock title="잠금/해제" style="border:0;background:transparent;cursor:pointer;padding:2px">○</button>';r.appendChild(tools);tools.querySelector('[data-eye]').onclick=e=>{e.stopPropagation();st.visible=!st.visible;save();paintRows();syncPanel();rerender()};tools.querySelector('[data-lock]').onclick=e=>{e.stopPropagation();st.locked=!st.locked;save();paintRows();syncPanel()}}
      tools.querySelector('[data-eye]').textContent=st.visible===false?'◌':'●';tools.querySelector('[data-lock]').textContent=st.locked?'🔒':'○';
    })}
  function move(dir){const i=data.order.indexOf(current),j=i+dir;if(i<0||j<0||j>=data.order.length)return;[data.order[i],data.order[j]]=[data.order[j],data.order[i]];save();applyOrder();paintRows()}
  function buildPanel(){
    if($('coverLayerStylePanel'))return;const anchor=$('coverMultiPanel')||$('coverLayerProperty');if(!anchor)return;
    const p=document.createElement('div');p.id='coverLayerStylePanel';p.style.cssText='margin-top:8px;padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc';
    p.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px"><strong style="font-size:10px">레이어 관리·텍스트 속성</strong><span id="layerStyleName" style="font-size:9px;color:#64748b"></span></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-bottom:7px"><button class="mini-btn" id="layerVisible">표시</button><button class="mini-btn" id="layerLocked">잠금</button><button class="mini-btn" id="layerUp">위로</button><button class="mini-btn" id="layerDown">아래로</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><label style="font-size:9px;font-weight:800">글자색<input id="layerColor" type="color" style="width:100%;height:30px"></label><label style="font-size:9px;font-weight:800">굵기<select id="layerWeight" style="width:100%;height:30px"><option value="400">보통</option><option value="500">중간</option><option value="700">굵게</option><option value="900">아주 굵게</option></select></label><label style="font-size:9px;font-weight:800">자간<input id="layerTracking" type="range" min="-2" max="12" step="1"></label><label style="font-size:9px;font-weight:800">투명도<input id="layerOpacity" type="range" min="10" max="100" step="5"></label></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:6px"><button class="mini-btn" data-align="left">왼쪽</button><button class="mini-btn" data-align="center">가운데</button><button class="mini-btn" data-align="right">오른쪽</button></div><div id="layerStyleHint" style="font-size:8px;color:#64748b;margin-top:6px">속성은 미리보기와 PDF·PNG 출력에 함께 적용됩니다.</div>`;
    anchor.after(p);
    $('layerVisible').onclick=()=>{const s=style(current);s.visible=!s.visible;save();paintRows();syncPanel();rerender()};
    $('layerLocked').onclick=()=>{const s=style(current);s.locked=!s.locked;save();paintRows();syncPanel()};$('layerUp').onclick=()=>move(-1);$('layerDown').onclick=()=>move(1);
    ['layerColor','layerWeight','layerTracking','layerOpacity'].forEach(id=>$(id).addEventListener('input',()=>{const s=style(current);s.color=$('layerColor').value;s.weight=+$('layerWeight').value;s.tracking=+$('layerTracking').value;s.opacity=+$('layerOpacity').value;save();rerender()}));
    p.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>{style(current).align=b.dataset.align;save();syncPanel();rerender()});
  }
  function syncPanel(){const d=def(current),s=style(current);if(!d||!$('coverLayerStylePanel'))return;$('layerStyleName').textContent=d.label;$('layerVisible').textContent=s.visible===false?'숨김 해제':'표시 중';$('layerLocked').textContent=s.locked?'잠금 해제':'잠금';$('layerColor').value=s.color||$('textColor')?.value||'#12396d';$('layerWeight').value=String(s.weight||700);$('layerTracking').value=s.tracking||0;$('layerOpacity').value=s.opacity||100;document.querySelectorAll('#coverLayerStylePanel [data-align]').forEach(b=>b.classList.toggle('active',b.dataset.align===(s.align||'center')));const i=data.order.indexOf(current);$('layerUp').disabled=i<=0;$('layerDown').disabled=i<0||i>=data.order.length-1;const ids=['posX','posY','itemScale','spinePartX','spinePartY','spinePartScale'];ids.forEach(id=>{if($(id))$(id).disabled=s.locked})}
  function bind(){
    const list=$('coverLayerList');if(!list)return;buildPanel();applyOrder();paintRows();syncPanel();
    list.addEventListener('click',e=>{const r=e.target.closest('[data-layer]');if(!r)return;current=r.dataset.layer;setTimeout(syncPanel,0)},true);
    const block=e=>{if(!locked())return;if(['pointerdown','wheel'].includes(e.type)){e.preventDefault();e.stopImmediatePropagation()}else if(e.target&&['posX','posY','itemScale','spinePartX','spinePartY','spinePartScale'].includes(e.target.id)){e.preventDefault();e.stopImmediatePropagation();syncPanel()} };
    const c=$('previewCanvas');c?.addEventListener('pointerdown',block,true);c?.addEventListener('wheel',block,{capture:true,passive:false});document.addEventListener('input',block,true);document.addEventListener('change',block,true);
  }
  function init(){load();wrapRenderer();setTimeout(()=>{wrapRenderer();bind();rerender()},350)}
  document.addEventListener('DOMContentLoaded',init);
})();