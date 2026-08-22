(function(){
  'use strict';
  if(window.__designEditorSmartSnapV1)return;
  window.__designEditorSmartSnapV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const STYLE_ID='designEditorSmartSnapStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const SNAP_MM=2.2;
  let installed=false;
  let moving=false;
  let snapped=false;
  let clearTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  }
  function ppm(){
    const p=project(),board=byId('artboard');
    if(!p||!board)return 1;
    return Math.max(.001,board.getBoundingClientRect().width/Math.max(1,Number(p.width)+(Number(p.bleed)||0)*2));
  }

  function selectedRecord(){
    const current=surface();if(!current)return null;
    const extraNode=document.querySelector('.phase2-extra-object.selected');
    if(extraNode){
      const item=current.extras?.find(entry=>entry.id===extraNode.dataset.extraId);
      if(item)return{kind:'extra',item,node:extraNode};
    }
    const textNode=document.querySelector('.design-text.selected');
    if(textNode){
      const item=current.elements?.find(entry=>entry.id===textNode.dataset.id&&entry.type==='text');
      if(item)return{kind:'text',item,node:textNode};
    }
    return null;
  }

  function textHeight(item,node){
    const scale=ppm();
    if(node?.isConnected){const px=node.getBoundingClientRect().height;if(px>0)return Math.max(4,px/scale);}
    const lines=Math.max(1,String(item?.text||'').split(/\n/).length);
    return Math.max(4,(Number(item?.size)||10)*25.4/72*lines*(Number(item?.lineHeight)||1.26));
  }

  function recordRect(record){
    if(!record)return null;
    const item=record.item,w=Math.max(.5,Number(item.w)||.5),h=record.kind==='extra'?Math.max(.5,Number(item.h)||.5):textHeight(item,record.node);
    return{x:Number(item.x)||0,y:Number(item.y)||0,w,h};
  }

  function allOtherRects(record){
    const current=surface();if(!current)return[];
    const rows=[];
    (current.elements||[]).forEach(item=>{
      if(item.id===record.item.id||item.visible===false||item.type!=='text')return;
      const node=document.querySelector(`.design-text[data-id="${CSS.escape(item.id)}"]`);
      rows.push({id:item.id,kind:'text',rect:{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(.5,Number(item.w)||.5),h:textHeight(item,node)}});
    });
    (current.extras||[]).forEach(item=>{
      if(item.id===record.item.id||item.visible===false)return;
      rows.push({id:item.id,kind:'extra',rect:{x:Number(item.x)||0,y:Number(item.y)||0,w:Math.max(.5,Number(item.w)||.5),h:Math.max(.5,Number(item.h)||.5)}});
    });
    return rows;
  }

  const pointsX=rect=>({left:rect.x,center:rect.x+rect.w/2,right:rect.x+rect.w});
  const pointsY=rect=>({top:rect.y,middle:rect.y+rect.h/2,bottom:rect.y+rect.h});
  const overlaps=(a1,a2,b1,b2)=>Math.min(a2,b2)-Math.max(a1,b1)>-1;

  function bestAlignment(rect,others,axis){
    const own=axis==='x'?pointsX(rect):pointsY(rect),keys=axis==='x'?['left','center','right']:['top','middle','bottom'];
    let best=null;
    others.forEach(other=>{
      const target=axis==='x'?pointsX(other.rect):pointsY(other.rect);
      keys.forEach(key=>{
        const delta=target[key]-own[key],distance=Math.abs(delta);
        if(distance>SNAP_MM)return;
        if(!best||distance<best.distance)best={distance,delta,value:target[key],kind:'align',label:key};
      });
    });
    return best;
  }

  function bestEqualGap(rect,others,axis){
    if(axis==='x'){
      const sameRow=others.filter(row=>overlaps(rect.y,rect.y+rect.h,row.rect.y,row.rect.y+row.rect.h));
      const left=sameRow.filter(row=>row.rect.x+row.rect.w<=rect.x+SNAP_MM).sort((a,b)=>(b.rect.x+b.rect.w)-(a.rect.x+a.rect.w))[0];
      const right=sameRow.filter(row=>row.rect.x>=rect.x+rect.w-SNAP_MM).sort((a,b)=>a.rect.x-b.rect.x)[0];
      if(!left||!right)return null;
      const free=right.rect.x-(left.rect.x+left.rect.w)-rect.w;if(free<0)return null;
      const desired=left.rect.x+left.rect.w+free/2,delta=desired-rect.x,distance=Math.abs(delta);
      return distance<=SNAP_MM?{distance,delta,value:desired+rect.w/2,kind:'gap',label:'가로 간격'}:null;
    }
    const sameColumn=others.filter(row=>overlaps(rect.x,rect.x+rect.w,row.rect.x,row.rect.x+row.rect.w));
    const above=sameColumn.filter(row=>row.rect.y+row.rect.h<=rect.y+SNAP_MM).sort((a,b)=>(b.rect.y+b.rect.h)-(a.rect.y+a.rect.h))[0];
    const below=sameColumn.filter(row=>row.rect.y>=rect.y+rect.h-SNAP_MM).sort((a,b)=>a.rect.y-b.rect.y)[0];
    if(!above||!below)return null;
    const free=below.rect.y-(above.rect.y+above.rect.h)-rect.h;if(free<0)return null;
    const desired=above.rect.y+above.rect.h+free/2,delta=desired-rect.y,distance=Math.abs(delta);
    return distance<=SNAP_MM?{distance,delta,value:desired+rect.h/2,kind:'gap',label:'세로 간격'}:null;
  }

  function choose(a,b){if(!a)return b;if(!b)return a;return a.distance<=b.distance?a:b;}

  function clearGuides(delay=0){
    clearTimeout(clearTimer);
    const run=()=>byId('artboard')?.querySelectorAll('.phase19-smart-guide,.phase19-gap-badge').forEach(node=>node.remove());
    if(delay)clearTimer=setTimeout(run,delay);else run();
  }

  function showGuides(xSnap,ySnap){
    const board=byId('artboard'),p=project(),scale=ppm();if(!board||!p)return;
    clearGuides();
    const add=(snap,axis)=>{
      if(!snap)return;
      const line=document.createElement('span');line.className=`phase19-smart-guide ${axis==='x'?'vertical':'horizontal'}${snap.kind==='gap'?' gap':''}`;
      if(axis==='x')line.style.left=`${((Number(p.bleed)||0)+snap.value)*scale}px`;else line.style.top=`${((Number(p.bleed)||0)+snap.value)*scale}px`;
      board.appendChild(line);
      if(snap.kind==='gap'){
        const badge=document.createElement('span');badge.className='phase19-gap-badge';badge.textContent='간격 맞춤';
        if(axis==='x'){badge.style.left=line.style.left;badge.style.top='8px';}else{badge.style.top=line.style.top;badge.style.left='8px';}
        board.appendChild(badge);
      }
    };
    add(xSnap,'x');add(ySnap,'y');
  }

  function applyPosition(record){
    const p=project(),scale=ppm();if(!p||!record?.node)return;
    const bleed=Number(p.bleed)||0,item=record.item;
    record.node.style.left=`${(bleed+(Number(item.x)||0))*scale}px`;
    record.node.style.top=`${(bleed+(Number(item.y)||0))*scale}px`;
  }

  function smartSnap(){
    const record=selectedRecord(),p=project();if(!moving||!record||!p||record.item.locked)return;
    const rect=recordRect(record),others=allOtherRects(record);if(!rect||!others.length)return clearGuides();
    const xSnap=choose(bestAlignment(rect,others,'x'),bestEqualGap(rect,others,'x'));
    const ySnap=choose(bestAlignment(rect,others,'y'),bestEqualGap(rect,others,'y'));
    if(!xSnap&&!ySnap)return clearGuides();
    if(xSnap)record.item.x=clamp(rect.x+xSnap.delta,0,Math.max(0,Number(p.width)-rect.w));
    if(ySnap)record.item.y=clamp(rect.y+ySnap.delta,0,Math.max(0,Number(p.height)-rect.h));
    applyPosition(record);showGuides(xSnap,ySnap);snapped=true;
  }

  function persist(){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){}
    window.DesignEditorDraftScope?.saveCurrent?.('object-smart-snap');
    const state=byId('saveState');if(state)state.textContent='자동 저장됨';
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .phase19-smart-guide{position:absolute;z-index:145;pointer-events:none;background:#e11d8a;opacity:.82}.phase19-smart-guide.vertical{top:0;bottom:0;width:1px}.phase19-smart-guide.horizontal{left:0;right:0;height:1px}.phase19-smart-guide.gap{background:#7c3aed;opacity:.78}.phase19-gap-badge{position:absolute;z-index:146;pointer-events:none;transform:translate(-50%,-50%);border-radius:999px;background:#7c3aed;color:#fff;padding:3px 6px;font-size:6.5px;font-weight:900;white-space:nowrap;box-shadow:0 2px 8px #0f172a24}
    `;document.head.appendChild(style);
  }

  function beginPointer(event){
    if(event.button!==0)return;
    if(event.target?.closest?.('.phase3-resize-handle,.phase12-rotation-handle,#designCanvasQuickbar')){moving=false;return;}
    moving=Boolean(event.target?.closest?.('.design-object,.phase2-extra-object'));snapped=false;
  }
  function movePointer(event){if(moving&&event.buttons)smartSnap();}
  function finishPointer(){
    if(!moving)return;
    moving=false;if(snapped)persist();snapped=false;clearGuides(450);
    requestAnimationFrame(()=>window.DesignEditorCanvasQuickbar?.sync?.());
  }

  function bindEvents(){
    document.addEventListener('pointerdown',beginPointer,true);
    document.addEventListener('pointermove',movePointer,{passive:true});
    document.addEventListener('pointerup',finishPointer);document.addEventListener('pointercancel',finishPointer);
  }

  function install(){
    if(installed)return true;
    if(!byId('artboard')||!window.DesignEditorApp)return false;
    installed=true;installStyles();bindEvents();
    window.DesignEditorSmartSnap={sync:smartSnap,stage:'object-alignment-and-equal-gap-smart-snap'};
    return true;
  }
  function boot(){if(install())return;[180,420,850,1500,2600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
