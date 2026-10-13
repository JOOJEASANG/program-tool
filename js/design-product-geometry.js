/* Product-aware print geometry: physical panels, fold positions and preview guides.
 * Guides are preview-only. PDF/PNG exports use the same underlying size/spec. */
'use strict';
(() => {
  if(window.DesignProductGeometry)return;
  const $=id=>document.getElementById(id);
  const number=(id,fallback)=>{const n=Number($(id)?.value);return Number.isFinite(n)&&n>0?n:fallback;};
  const studio=()=>document.documentElement.dataset.designStudio||'cover';
  const side=()=>new URLSearchParams(location.search).get('side')==='inside'?'inside':'outside';
  function adapt(spec,kind=studio()){
    if(kind==='cover')return spec;
    const b=spec.bleed, left=spec.trimW,h=spec.trimH;
    const make=(id,x,w,label)=>({id,x,y:b,w,h,label});
    let panels=[],folds=[],workW=spec.workW,foldType='';
    if(kind==='leaflet'){
      const middle=number('leafletPanelCenter',left);
      const right=number('leafletPanelRight',left);
      const type=$('leafletFoldType')?.value==='accordion'?'accordion':'roll';
      workW=b*2+left+middle+right;
      spec.spine=middle;spec.wing=0;foldType=type;
      const names=type==='roll'
        ? side()==='outside'?['접어 넣는 면','뒷면','표지']:['안쪽 왼쪽','안쪽 가운데','안쪽 오른쪽']
        :side()==='outside'?['왼쪽 면','가운데 면','오른쪽 면']:['안쪽 왼쪽','안쪽 가운데','안쪽 오른쪽'];
      panels=[make('back',b,left,names[0]),make('spine',b+left,middle,names[1]),make('front',b+left+middle,right,names[2])];
      folds=[b+left,b+left+middle];
    }else if(kind==='invitation'&&spec.coverMode==='frontBack'&&$('invitationFoldType')?.value!=='flat'){
      const total=left*2;
      const split=Math.max(25,Math.min(total-25,number('invitationFoldPosition',left)));
      foldType='half-fold';
      panels=[make('back',b,split,side()==='outside'?'겉면 · 뒷표지':'안쪽 · 왼쪽'),
              make('front',b+split,total-split,side()==='outside'?'겉면 · 앞표지':'안쪽 · 오른쪽')];
      folds=[b+split];
    }else if(spec.coverMode==='frontBack'){
      panels=[make('back',b,left,kind==='flyer'?'전단지 뒷면':'초대장 뒷면'),
              make('front',b+left,left,kind==='flyer'?'전단지 앞면':'초대장 앞면')];
    }else{
      panels=[make(spec.coverMode,b,left,kind==='flyer'?'전단지 '+(spec.coverMode==='back'?'뒷면':'앞면'):'초대장 '+(spec.coverMode==='back'?'뒷면':'앞면'))];
    }
    return {...spec,spine:spec.spine,wing:0,workW,panelWidths:panels.map(p=>p.w),panels,folds,foldType,productType:kind,productSide:side()};
  }
  function render(ctx,s,scale,{rect,line,zone}){
    if(!s?.panels)return false;
    const b=s.bleed*scale,safe=s.safe*scale,th=s.trimH*scale;
    if(s.bleed>0)rect(ctx,.5,.5,s.workW*scale-1,s.workH*scale-1,'#db2777',[7,5]);
    for(const panel of s.panels){
      const x=panel.x*scale,w=panel.w*scale;
      rect(ctx,x,b,w,th,'#2563eb',[6,4]);
      if(safe>0&&w>safe*2&&th>safe*2)rect(ctx,x+safe,b+safe,w-safe*2,th-safe*2,'#16a34a',[3,3]);
      zone(ctx,panel.label,x,b,w,th);
    }
    for(let i=0;i<s.folds.length;i++){
      const x=s.folds[i]*scale;
      line(ctx,x,b,x,b+th,'#e11d48',[8,4]);
      ctx.save();ctx.fillStyle='#be123c';ctx.font='700 10px Pretendard, sans-serif';ctx.textAlign='center';ctx.fillText('접는선 '+(i+1),x,b+th-10);ctx.restore();
    }
    return true;
  }
  function summary(s){
    if(!s?.panels)return '';
    const p=s.panels.map(x=>x.w.toFixed(1)).join(' + ');
    const postfix=s.foldType==='half-fold'?'접는 위치 '+s.panels[0].w.toFixed(1)+'mm (왼쪽부터)':s.productType==='leaflet'?(s.foldType==='roll'?'말아접기':'병풍접기'):'';
    return s.panels.length+'면 · '+p+'mm · '+s.workW.toFixed(1)+'×'+s.workH.toFixed(1)+'mm'+(postfix?' · '+postfix:'');
  }
  function warnings(s){
    if(!s?.panels)return [];
    const messages=[];
    if(s.productType==='leaflet'){
      if(s.foldType==='roll'&&Math.min(...s.panelWidths)===Math.max(...s.panelWidths))
        messages.push('말아접기는 접혀 들어가는 패널을 약 1~2mm 좁게 조절하는 경우가 많습니다. 실제 인쇄소 규격을 확인하세요.');
      if(s.foldType==='roll'&&s.panelWidths[0]>=Math.min(s.panelWidths[1],s.panelWidths[2]))
        messages.push('말아접기 왼쪽 안쪽 패널이 다른 패널보다 좁은지 확인하세요.');
    }
    if(s.foldType==='half-fold'&&Math.abs(s.panels[0].w-s.panels[1].w)>15)
      messages.push('비대칭 접지: 접었을 때 표지 가장자리 겹침과 여백을 검토하세요.');
    if(s.panels.some(p=>p.w<=s.safe*2))messages.push('패널 폭이 안전영역 양쪽 여백보다 작습니다.');
    return messages;
  }
  window.DesignProductGeometry={adapt,render,summary,warnings};
})();