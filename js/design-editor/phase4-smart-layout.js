(function(){
  'use strict';
  if(window.__designEditorPhase4SmartLayoutV1)return;
  window.__designEditorPhase4SmartLayoutV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const SMART_TAG='phase4-v1';
  const CARD_ID='designPhase4SmartLayout';
  const STYLE_ID='designPhase4SmartLayoutStyles';
  let installed=false;
  let renderTimer=0;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const project=()=>window.DesignEditorApp?.project||null;
  const surface=()=>{
    const p=project();
    return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;
  };

  function setStatus(message,type='info'){
    const node=byId('editorStatus');if(!node)return;
    node.className=`editor-status ${type}`;node.textContent=message;
  }

  function roleStyle(role){
    const fallback={title:{size:34,weight:900,align:'center',color:'#12396d'},subtitle:{size:18,weight:800,align:'center',color:'#334155'},body:{size:11,weight:500,align:'left',color:'#334155'},info:{size:10,weight:700,align:'left',color:'#475569'},institution:{size:9,weight:700,align:'center',color:'#64748b'}};
    return window.DesignEditorPresets?.ROLE_PRESETS?.[role]||fallback[role]||fallback.body;
  }

  function text(role,text,x,y,w,overrides={}){
    const style=roleStyle(role);
    return {
      id:uid('smart_text'),type:'text',role,text,fontFamily:'Pretendard',size:overrides.size??style.size,weight:overrides.weight??style.weight,
      align:overrides.align??style.align,color:overrides.color??style.color,icon:overrides.icon||'none',x,y,w,
      letterSpacing:overrides.letterSpacing??0,lineHeight:overrides.lineHeight??1.26,locked:false,visible:true,smartLayout:SMART_TAG
    };
  }

  function shape(shapeKind,x,y,w,h,overrides={}){
    return {
      id:uid('smart_shape'),type:'shape',shape:shapeKind,name:'기본 배치 장식',x,y,w,h,
      fill:overrides.fill||'#dceeff',stroke:overrides.stroke||'#12396d',strokeWidth:overrides.strokeWidth??0.8,
      opacity:overrides.opacity??100,locked:false,visible:true,smartLayout:SMART_TAG
    };
  }

  function ensureArrays(current){
    if(!Array.isArray(current.elements))current.elements=[];
    if(!Array.isArray(current.extras))current.extras=[];
  }

  function removeSmart(current){
    ensureArrays(current);
    current.elements=current.elements.filter(item=>item.smartLayout!==SMART_TAG);
    current.extras=current.extras.filter(item=>item.smartLayout!==SMART_TAG);
  }

  function hasUserContent(current){
    ensureArrays(current);
    return current.elements.some(item=>item.smartLayout!==SMART_TAG)||current.extras.some(item=>item.smartLayout!==SMART_TAG);
  }

  function persistAndRefresh(message){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('기본 배치를 저장하지 못했습니다.','err');}
    window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{window.DesignEditorPhase2?.sync?.();setStatus(message,'ok');},70);
  }

  function addPosterLayout(p,current){
    const safe=clamp(Number(p.safe)||10,6,24),contentW=Math.max(40,p.width-safe*2);
    const isA3=p.width>=290||p.height>=410;
    current.extras.push(shape('rect',safe,safe,Math.min(28,contentW*.18),2.2,{fill:'#1d9bb2',stroke:'#1d9bb2',strokeWidth:.2}));
    current.elements.push(
      text('title','행사 제목을 입력하세요',safe,safe+10,contentW,{size:isA3?42:34,align:'left'}),
      text('subtitle','핵심 내용을 한 줄로 정리하세요',safe,safe+30,contentW,{size:isA3?19:16,align:'left',color:'#475569'}),
      text('info','2026. 00. 00.  00:00',safe,p.height-safe-45,contentW,{icon:'calendar',size:isA3?12:10}),
      text('info','장소를 입력하세요',safe,p.height-safe-32,contentW,{icon:'pin',size:isA3?12:10}),
      text('institution','주최 · 주관 기관명',safe,p.height-safe-12,contentW,{align:'left',size:isA3?10:9})
    );
  }

  function addFlyerLayout(p,current){
    const safe=clamp(Number(p.safe)||9,6,22),contentW=Math.max(36,p.width-safe*2);
    current.extras.push(shape('rect',safe,safe,contentW,1.6,{fill:'#12396d',stroke:'#12396d',strokeWidth:.2}));
    current.elements.push(
      text('title','안내 제목을 입력하세요',safe,safe+10,contentW,{size:28,align:'left'}),
      text('subtitle','전달할 핵심 내용을 간단히 적어주세요',safe,safe+27,contentW,{size:14,align:'left'}),
      text('body','본문 내용을 입력하세요.\n중요한 정보부터 짧고 명확하게 정리하면 읽기 편합니다.',safe,safe+52,contentW,{size:10.5,align:'left',lineHeight:1.55}),
      text('info','2026. 00. 00.  00:00 · 장소',safe,p.height-safe-29,contentW,{icon:'calendar',size:9.5}),
      text('institution','문의 · 주최기관',safe,p.height-safe-12,contentW,{align:'left',size:8.5})
    );
  }

  function panelBounds(p,current){
    const folds=(current.folds||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    return [0,...folds,p.width];
  }

  function addLeafletLayout(p,current){
    const bounds=panelBounds(p,current),labels=current.panels||[];
    for(let index=0;index<bounds.length-1;index+=1){
      const start=bounds[index],end=bounds[index+1],panelW=end-start;
      const pad=clamp(Math.min(Number(p.safe)||7,panelW*.1),4,10),x=start+pad,w=Math.max(20,panelW-pad*2);
      const label=String(labels[index]||`내용 ${index+1}`);
      const front=/앞표지/.test(label);
      const back=/뒷/.test(label);
      current.extras.push(shape('rect',x,p.safe||7,Math.min(18,w*.24),1.4,{fill:front?'#1d9bb2':'#12396d',stroke:front?'#1d9bb2':'#12396d',strokeWidth:.2}));
      if(front){
        current.elements.push(
          text('title','리플렛 제목',x,(p.safe||7)+11,w,{size:22,align:'left'}),
          text('subtitle','한 줄 소개를 입력하세요',x,(p.safe||7)+33,w,{size:11.5,align:'left'}),
          text('institution','기관명',x,p.height-(p.safe||7)-13,w,{align:'left',size:8.5})
        );
      }else if(back){
        current.elements.push(
          text('subtitle',label,x,(p.safe||7)+11,w,{size:13,align:'left'}),
          text('body','문의처와 추가 정보를 입력하세요.',x,(p.safe||7)+31,w,{size:9.2,align:'left',lineHeight:1.5}),
          text('institution','주소 · 연락처 · 웹사이트',x,p.height-(p.safe||7)-17,w,{align:'left',size:7.8})
        );
      }else{
        current.elements.push(
          text('subtitle',label,x,(p.safe||7)+11,w,{size:13,align:'left'}),
          text('body','이 면에 들어갈 내용을 입력하세요.\n문장을 짧게 나누면 읽기 편합니다.',x,(p.safe||7)+31,w,{size:9.2,align:'left',lineHeight:1.5})
        );
      }
    }
  }

  function addCustomLayout(p,current){
    const safe=clamp(Number(p.safe)||10,5,25),contentW=Math.max(30,p.width-safe*2);
    current.extras.push(shape('rect',safe,safe,Math.min(24,contentW*.2),1.8,{fill:'#1d9bb2',stroke:'#1d9bb2',strokeWidth:.2}));
    current.elements.push(
      text('title','제목을 입력하세요',safe,safe+11,contentW,{size:30,align:'left'}),
      text('subtitle','부제목 또는 핵심 설명',safe,safe+31,contentW,{size:14,align:'left'}),
      text('body','내용을 입력하세요.',safe,safe+57,contentW,{size:10.5,align:'left',lineHeight:1.5})
    );
  }

  function applySmartLayout(){
    const p=project(),current=surface();if(!p||!current)return setStatus('먼저 작업을 선택하세요.','err');
    if(hasUserContent(current)&&!confirm('현재 면에 직접 만든 내용이 있습니다. 기존 내용은 유지하고 기본 배치를 추가할까요?'))return;
    removeSmart(current);
    const preset=String(p.presetId||'');
    if(preset.startsWith('poster-'))addPosterLayout(p,current);
    else if(preset.startsWith('flyer-'))addFlyerLayout(p,current);
    else if(preset.startsWith('leaflet-'))addLeafletLayout(p,current);
    else addCustomLayout(p,current);
    persistAndRefresh('현재 면에 인쇄용 기본 배치를 적용했습니다. 내용만 바꿔서 사용할 수 있습니다.');
  }

  function clearSmartLayout(){
    const current=surface();if(!current)return;
    const before=(current.elements?.length||0)+(current.extras?.length||0);
    removeSmart(current);
    const after=(current.elements?.length||0)+(current.extras?.length||0);
    if(before===after)return setStatus('현재 면에 제거할 기본 배치가 없습니다.','info');
    persistAndRefresh('기본 배치만 제거했습니다. 직접 만든 내용은 그대로 유지했습니다.');
  }

  function approxTextHeight(item){
    const lines=String(item.text||'').split(/\n/).length;
    const sizeMm=(Number(item.size)||10)*25.4/72;
    return Math.max(4,sizeMm*lines*(Number(item.lineHeight)||1.26));
  }

  function safetyCheck(){
    const p=project(),current=surface();if(!p||!current)return;
    ensureArrays(current);
    const safe=clamp(Number(p.safe)||0,0,Math.min(p.width,p.height)/2);
    const issues=[];
    current.elements.filter(item=>item.visible!==false).forEach(item=>{
      const x=Number(item.x)||0,y=Number(item.y)||0,w=Math.max(0,Number(item.w)||0),h=approxTextHeight(item);
      if(x<safe-.2||y<safe-.2||x+w>p.width-safe+.2||y+h>p.height-safe+.2)issues.push('안전여백 밖 글씨');
      if((Number(item.size)||0)<8)issues.push('8pt 미만 글씨');
      (current.folds||[]).forEach(fold=>{if(x<fold+1.5&&x+w>fold-1.5)issues.push('접지선과 겹치는 글씨');});
    });
    current.extras.filter(item=>item.visible!==false&&item.type==='image').forEach(item=>{
      const x=Number(item.x)||0,y=Number(item.y)||0,w=Number(item.w)||0,h=Number(item.h)||0;
      if(x<safe-.2||y<safe-.2||x+w>p.width-safe+.2||y+h>p.height-safe+.2)issues.push('안전여백 밖 이미지');
    });
    const counts=issues.reduce((map,key)=>(map[key]=(map[key]||0)+1,map),{});
    const result=byId('phase4SafetyResult');
    if(!issues.length){
      if(result){result.className='phase4-result ok';result.textContent='안전여백 · 글자 크기 · 접지선 기준에 이상이 없습니다.';}
      return setStatus('현재 면 인쇄 안전 검사를 통과했습니다.','ok');
    }
    const summary=Object.entries(counts).map(([name,count])=>`${name} ${count}개`).join(' · ');
    if(result){result.className='phase4-result warn';result.textContent=summary;}
    setStatus(`인쇄 전 확인 필요: ${summary}`,'err');
  }

  function modeName(p){
    const preset=String(p?.presetId||'');
    if(preset.startsWith('poster-'))return '포스터';
    if(preset.startsWith('flyer-'))return '전단지';
    if(preset.startsWith('leaflet-'))return '리플렛';
    return '사용자 지정';
  }

  function installStyles(){
    if(byId(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .phase4-smart-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px}.phase4-smart-actions button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:8px 5px;font-size:8px;font-weight:900;cursor:pointer}.phase4-smart-actions button.primary{grid-column:1/-1;background:#12396d;border-color:#12396d;color:#fff}.phase4-smart-actions button:hover{filter:brightness(.98);border-color:#79b9c8}.phase4-smart-note{font-size:8px;color:#64748b;line-height:1.55;margin:0 0 8px}.phase4-mode{display:inline-block;margin-bottom:7px;border-radius:999px;background:#eef6ff;color:#1769e0;padding:4px 7px;font-size:7px;font-weight:950}.phase4-result{margin-top:8px;border-radius:8px;padding:7px 8px;font-size:7.5px;line-height:1.45;font-weight:850}.phase4-result.neutral{background:#f8fafc;color:#64748b}.phase4-result.ok{background:#ecfdf3;color:#16794f}.phase4-result.warn{background:#fff7ed;color:#b45309}
    `;document.head.appendChild(style);
  }

  function renderCard(){
    const card=byId(CARD_ID),p=project(),current=surface();if(!card||!p||!current)return;
    const mode=modeName(p),surfaceName=current.label||'현재 면';
    card.innerHTML=`<div class="side-label">전문 기본 배치</div><span class="phase4-mode">${mode} · ${surfaceName}</span><p class="phase4-smart-note">제목·본문·정보영역의 크기와 간격을 인쇄물에 맞춰 자동 배치합니다. 적용 후 글씨만 바꿔도 됩니다.</p><div class="phase4-smart-actions"><button id="phase4Apply" class="primary" type="button">현재 면 기본 배치 적용</button><button id="phase4Check" type="button">인쇄 안전 확인</button><button id="phase4Clear" type="button">기본 배치 제거</button></div><div id="phase4SafetyResult" class="phase4-result neutral">안전 확인을 누르면 여백·작은 글씨·접지선 겹침을 검사합니다.</div>`;
    byId('phase4Apply').addEventListener('click',applySmartLayout);
    byId('phase4Check').addEventListener('click',safetyCheck);
    byId('phase4Clear').addEventListener('click',clearSmartLayout);
  }

  function installCard(){
    if(byId(CARD_ID))return true;
    const sidebar=document.querySelector('.sidebar'),phase3=byId('designPhase3LayoutTools');if(!sidebar)return false;
    const card=document.createElement('section');card.id=CARD_ID;card.className='side-card';
    if(phase3?.nextSibling)sidebar.insertBefore(card,phase3.nextSibling);else sidebar.appendChild(card);
    renderCard();return true;
  }

  function queueRender(){
    clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(project()){installCard();renderCard();}},60);
  }

  function install(){
    if(installed)return true;
    if(!document.querySelector('.sidebar')||!window.DesignEditorApp)return false;
    installed=true;installStyles();installCard();
    ['click','change'].forEach(name=>document.addEventListener(name,queueRender,false));
    [180,500,1000,1800].forEach(delay=>setTimeout(queueRender,delay));
    window.DesignEditorSmartLayout={apply:applySmartLayout,check:safetyCheck,clear:clearSmartLayout,stage:'print-aware-smart-layout-and-safety'};
    return true;
  }

  function boot(){if(install())return;[180,420,800,1400,2400,3400].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
