(()=>{
'use strict';
const PALETTE=['#ffffff','#f8fafc','#e2e8f0','#94a3b8','#475569','#0f172a','#12396d','#1d5f7a','#0e7490','#1d9bb2','#2563eb','#4f46e5','#7c3aed','#be185d','#dc2626','#ea580c','#ca8a04','#16a34a'];
const fire=el=>{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};
function decorate(input){
  if(!input||input.dataset.paletteReady)return;
  input.dataset.paletteReady='1';
  input.style.width='100%';input.style.height='34px';input.style.cursor='pointer';input.style.display='block';
  const box=document.createElement('div');box.className='visual-color-palette';
  box.style.cssText='display:grid;grid-template-columns:repeat(9,1fr);gap:4px;margin-top:6px';
  PALETTE.forEach(color=>{const b=document.createElement('button');b.type='button';b.title=color;b.setAttribute('aria-label',`색상 ${color}`);b.style.cssText=`height:23px;border-radius:6px;border:1px solid #cbd5e1;background:${color};cursor:pointer;padding:0`;b.onclick=()=>{input.value=color;fire(input);paint()};box.appendChild(b)});
  const paint=()=>{[...box.children].forEach(b=>{const on=b.title.toLowerCase()===String(input.value).toLowerCase();b.style.outline=on?'2px solid #1d9bb2':'none';b.style.outlineOffset=on?'1px':'0'})};
  input.after(box);input.addEventListener('input',paint);paint();
}
function loadSmartGuides(){if(!location.pathname.includes('perfect-binding-cover')||document.querySelector('script[data-cover-smart-guides]'))return;const script=document.createElement('script');script.src='../js/cover-smart-guides.js?v=20260722-6';script.dataset.coverSmartGuides='1';document.head.appendChild(script)}
document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('input[type=color]').forEach(decorate);loadSmartGuides()});
window.CMYKColor={decorate};
})();