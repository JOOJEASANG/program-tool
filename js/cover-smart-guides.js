(()=>{
  if(!location.pathname.includes('perfect-binding-cover'))return;
  const $=id=>document.getElementById(id);
  const SNAP_POINTS=[3,10,14,25,50,75,86,90,97];
  const CENTER_POINTS=[25,50,75];
  let enabled=true,threshold=3,activeGuides={x:null,y:null},hideTimer=null;
  const nearest=(value,points=SNAP_POINTS)=>{let best=null,dist=Infinity;points.forEach(p=>{const d=Math.abs(value-p);if(d<dist){dist=d;best=p}});return dist<=threshold?best:null};
  function buildPanel(){
    if($('coverSmartGuidePanel'))return;
    const layer=$('coverLayerPanel'),settings=document.querySelector('.settings');if(!settings)return;
    const panel=document.createElement('section');panel.className='card';panel.id='coverSmartGuidePanel';
    panel.innerHTML=`<div class="card-head"><span class="step">G</span><div><div class="card-title">스마트 가이드</div><div class="card-note">객체를 중앙선과 주요 위치에 자동으로 맞춥니다.</div></div></div>
      <label class="checkline"><input id="smartGuideEnabled" type="checkbox" checked> 스마트 가이드·자석 정렬 사용</label>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:9px"><label style="font-size:10px;font-weight:850;color:#475569">흡착 범위</label><strong id="smartGuideThreshold" style="font-size:10px;color:#12396d">3%</strong></div>
      <input id="smartGuideRange" type="range" min="1" max="8" step="1" value="3" style="width:100%;margin-top:4px;accent-color:#12396d">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px"><button type="button" class="mini-btn" data-snap-y="25">위 1/4</button><button type="button" class="mini-btn" data-snap-y="50">정중앙</button><button type="button" class="mini-btn" data-snap-y="75">아래 1/4</button></div>
      <div id="smartGuideStatus" style="margin-top:7px;font-size:9px;color:#64748b">스마트 가이드 사용 중</div>`;
    if(layer)layer.after(panel);else settings.prepend(panel);
    $('smartGuideEnabled').addEventListener('change',e=>{enabled=e.target.checked;setStatus(enabled?'스마트 가이드 사용 중':'스마트 가이드 꺼짐');if(!enabled)clearGuides()});
    $('smartGuideRange').addEventListener('input',e=>{threshold=+e.target.value;$('smartGuideThreshold').textContent=threshold+'%'});
    panel.querySelectorAll('[data-snap-y]').forEach(b=>b.addEventListener('click',()=>snapSelectedY(+b.dataset.snapY)));
  }
  function ensureOverlay(){
    const wrap=$('previewCanvas')?.parentElement;if(!wrap)return null;
    let overlay=$('coverSmartGuideOverlay');if(overlay)return overlay;
    overlay=document.createElement('div');overlay.id='coverSmartGuideOverlay';overlay.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden';
    overlay.innerHTML='<div data-guide-x style="display:none;position:absolute;top:0;bottom:0;width:1px;background:#ec4899;box-shadow:0 0 0 1px rgba(255,255,255,.7)"></div><div data-guide-y style="display:none;position:absolute;left:0;right:0;height:1px;background:#ec4899;box-shadow:0 0 0 1px rgba(255,255,255,.7)"></div><div data-guide-label style="display:none;position:absolute;padding:3px 6px;border-radius:999px;background:#ec4899;color:white;font-size:9px;font-weight:900;line-height:1.2"></div>';
    wrap.style.position='relative';wrap.appendChild(overlay);return overlay;
  }
  function showGuides(x,y,label){
    const o=ensureOverlay();if(!o)return;const gx=o.querySelector('[data-guide-x]'),gy=o.querySelector('[data-guide-y]'),gl=o.querySelector('[data-guide-label]');
    if(x!=null){gx.style.display='block';gx.style.left=x+'%'}else gx.style.display='none';
    if(y!=null){gy.style.display='block';gy.style.top=y+'%'}else gy.style.display='none';
    if(label){gl.style.display='block';gl.style.left=`calc(${x??50}% + 7px)`;gl.style.top=`calc(${y??8}% + 7px)`;gl.textContent=label}else gl.style.display='none';
    activeGuides={x,y};clearTimeout(hideTimer);hideTimer=setTimeout(clearGuides,700);
  }
  function clearGuides(){const o=$('coverSmartGuideOverlay');if(!o)return;o.querySelectorAll('[data-guide-x],[data-guide-y],[data-guide-label]').forEach(el=>el.style.display='none');activeGuides={x:null,y:null}}
  function setStatus(text){if($('smartGuideStatus'))$('smartGuideStatus').textContent=text}
  function selectedSpineKey(){return document.querySelector('#spinePartButtons button.primary')?.dataset.key||document.querySelector('#spinePartButtons button[style*="outline"]')?.dataset.key||null}
  function applyRange(id,value){const el=$(id);if(!el)return;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
  function snapSelectedY(value){
    const key=selectedSpineKey();if(key&&$('spinePartY')){applyRange('spinePartY',value);showGuides(50,value,`${value}% 맞춤`);setStatus(`${key==='spineTop'?'책등 상단':key==='spineBottom'?'책등 하단':'책등 중앙'} · Y ${value}%`);return}
    if($('posY')){applyRange('posY',value);showGuides(null,value,`Y ${value}%`);setStatus(`선택 객체 · Y ${value}%`)}
  }
  function bindSpineSnap(){
    const c=$('previewCanvas');if(!c||c.dataset.smartGuideBound)return;c.dataset.smartGuideBound='1';
    c.addEventListener('pointermove',e=>{
      if(!enabled||!c.hasPointerCapture?.(e.pointerId))return;
      const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*100,y=(e.clientY-r.top)/r.height*100;
      const sx=nearest(x,[0,25,50,75,100]),sy=nearest(y);
      if(sx!=null&&$('spinePartX'))applyRange('spinePartX',sx);
      if(sy!=null&&$('spinePartY'))applyRange('spinePartY',sy);
      if(sx!=null||sy!=null){showGuides(sx,sy,[sx!=null?`X ${sx}%`:'',sy!=null?`Y ${sy}%`:''].filter(Boolean).join(' · '));setStatus('자석 정렬됨')}
    },false);
    c.addEventListener('pointerup',()=>setTimeout(clearGuides,250),false);
    c.addEventListener('pointercancel',clearGuides,false);
  }
  function bindGeneralRanges(){
    ['posX','posY'].forEach(id=>{const el=$(id);if(!el||el.dataset.smartGuideBound)return;el.dataset.smartGuideBound='1';el.addEventListener('input',()=>{if(!enabled||el.dataset.snapping)return;const points=id==='posX'?[0,25,50,75,100]:SNAP_POINTS,s=nearest(+el.value,points);if(s==null)return;el.dataset.snapping='1';el.value=s;setTimeout(()=>delete el.dataset.snapping,0);showGuides(id==='posX'?s:null,id==='posY'?s:null,`${id==='posX'?'X':'Y'} ${s}%`);setStatus('선택 객체 자석 정렬됨')})})
  }
  function init(){buildPanel();ensureOverlay();bindSpineSnap();bindGeneralRanges();setInterval(()=>{bindSpineSnap();bindGeneralRanges()},1200)}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80));
})();
