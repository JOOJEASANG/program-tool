(()=>{
'use strict';
if(!location.pathname.includes('perfect-binding-cover'))return;
const $=id=>document.getElementById(id);
let enabled=true,threshold=3,hideTimer=null,lastSide='front';
const num=(id,fallback)=>{const v=Number($(id)?.value);return Number.isFinite(v)?v:fallback};
const fire=el=>{el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))};
function selectedSide(){
  const sel=$('editTarget'),opt=sel?.selectedOptions?.[0],text=((opt?.textContent||'')+' '+(opt?.value||'')).toLowerCase();
  if(/back|뒤표지/.test(text))return'back';
  if(/front|앞표지|title|subtitle|publisher|institution|issuer|year/.test(text))return'front';
  const a=document.activeElement?.id||'';
  if(/^back/.test(a))return'back';
  if(/^(front|institution|issuer|publish)/.test(a))return'front';
  return lastSide;
}
function spreadCenters(){
  const trim=num('trimW',210),bleed=num('bleed',3),spine=typeof window.getSpine==='function'?Number(window.getSpine())||0:num('spineManual',10);
  const total=trim*2+spine+bleed*2;
  return{back:(bleed+trim/2)/total*100,front:(bleed+trim+spine+trim/2)/total*100};
}
function ensureOverlay(){
  const wrap=$('previewCanvas')?.parentElement;if(!wrap)return null;
  let o=$('coverSmartGuideOverlay');if(o)return o;
  o=document.createElement('div');o.id='coverSmartGuideOverlay';o.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:8;overflow:hidden';
  o.innerHTML='<div data-guide-x style="display:none;position:absolute;top:0;bottom:0;width:2px;background:#ec4899;box-shadow:0 0 0 1px rgba(255,255,255,.8)"></div><div data-guide-label style="display:none;position:absolute;top:8px;padding:4px 7px;border-radius:999px;background:#ec4899;color:#fff;font-size:9px;font-weight:900;line-height:1.2;white-space:nowrap"></div>';
  wrap.style.position='relative';wrap.appendChild(o);return o;
}
function clearGuide(){const o=$('coverSmartGuideOverlay');if(!o)return;o.querySelectorAll('[data-guide-x],[data-guide-label]').forEach(el=>el.style.display='none')}
function showCenter(side){
  const o=ensureOverlay();if(!o)return;const x=spreadCenters()[side],line=o.querySelector('[data-guide-x]'),label=o.querySelector('[data-guide-label]');
  line.style.display='block';line.style.left=x+'%';label.style.display='block';label.style.left=`calc(${x}% + 7px)`;label.textContent=side==='front'?'앞표지 가운데':'뒤표지 가운데';
  clearTimeout(hideTimer);hideTimer=setTimeout(clearGuide,700);
}
function setStatus(text){if($('smartGuideStatus'))$('smartGuideStatus').textContent=text}
function snapCurrent(){
  if(!enabled)return false;const x=$('posX');if(!x)return false;const value=Number(x.value);if(!Number.isFinite(value)||Math.abs(value-50)>threshold)return false;
  const side=selectedSide();lastSide=side;if(value!==50){x.value=50;fire(x)}showCenter(side);setStatus(`${side==='front'?'앞표지':'뒤표지'} 가운데 정렬됨`);return true;
}
function buildPanel(){
  document.getElementById('coverLayerPanel')?.remove();document.getElementById('coverMultiPanel')?.remove();document.getElementById('coverLayerStylePanel')?.remove();
  if($('coverSmartGuidePanel'))return;
  const settings=document.querySelector('.settings');if(!settings)return;
  const panel=document.createElement('section');panel.className='card';panel.id='coverSmartGuidePanel';
  panel.innerHTML='<div class="card-head"><span class="step">G</span><div><div class="card-title">스마트 가운데 정렬</div><div class="card-note">앞표지는 앞표지 중앙, 뒤표지는 뒤표지 중앙에만 자동 정렬됩니다.</div></div></div><label class="checkline"><input id="smartGuideEnabled" type="checkbox" checked> 가운데 자석 정렬 사용</label><div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-top:9px"><label style="font-size:10px;font-weight:850;color:#475569">흡착 범위</label><strong id="smartGuideThreshold" style="font-size:10px;color:#12396d">3%</strong></div><input id="smartGuideRange" type="range" min="1" max="8" step="1" value="3" style="width:100%;margin-top:4px;accent-color:#12396d"><div id="smartGuideStatus" style="margin-top:7px;font-size:9px;color:#64748b">표지별 가운데 정렬 사용 중</div>';
  settings.prepend(panel);
  $('smartGuideEnabled').onchange=e=>{enabled=e.target.checked;setStatus(enabled?'표지별 가운데 정렬 사용 중':'스마트 가이드 꺼짐');if(!enabled)clearGuide()};
  $('smartGuideRange').oninput=e=>{threshold=Number(e.target.value);$('smartGuideThreshold').textContent=threshold+'%'};
}
function bind(){
  const x=$('posX');if(x&&!x.dataset.coverSideSnap){x.dataset.coverSideSnap='1';x.addEventListener('input',()=>{if(x.dataset.snapping)return;x.dataset.snapping='1';snapCurrent();setTimeout(()=>delete x.dataset.snapping,0)},true)}
  $('editTarget')?.addEventListener('change',()=>{lastSide=selectedSide();clearGuide()});
  const c=$('previewCanvas');if(c&&!c.dataset.coverDragSnap){c.dataset.coverDragSnap='1';c.addEventListener('pointermove',e=>{if(!enabled||!(e.buttons&1))return;requestAnimationFrame(snapCurrent)},false);c.addEventListener('pointerup',()=>{snapCurrent();setTimeout(clearGuide,250)},false);c.addEventListener('pointercancel',clearGuide,false)}
}
function fixSpinePanel(){
  const p=$('spineIndependentPanel');if(!p)return;p.style.background='#fff';p.style.border='1px solid #dbe5ee';p.style.borderRadius='10px';p.style.padding='10px';
  const buttons=$('spinePartButtons');if(buttons){buttons.style.gridTemplateColumns='repeat(3,minmax(0,1fr))';buttons.style.gap='5px'}
  p.querySelectorAll('input[type=range]').forEach(el=>{el.style.width='100%';el.style.accentColor='#12396d'});
}
function init(){buildPanel();ensureOverlay();bind();fixSpinePanel();setInterval(()=>{bind();fixSpinePanel();document.getElementById('coverLayerPanel')?.remove();document.getElementById('coverMultiPanel')?.remove();document.getElementById('coverLayerStylePanel')?.remove()},800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));else setTimeout(init,100);
})();