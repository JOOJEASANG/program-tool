(function(){
  'use strict';
  if(window.__designEditorPrintBlocksV1)return;
  window.__designEditorPrintBlocksV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const STYLE_ID='designEditorPrintBlocksStyles';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const TAG='print-block-v1';
  let installed=false;

  const byId=id=>document.getElementById(id);
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const uid=prefix=>`${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  const project=()=>window.DesignEditorApp?.project||null;
  function surface(){const p=project();return p?.surfaces?.find(item=>item.id===p.activeSurface)||p?.surfaces?.[0]||null;}
  function ensure(current){if(!Array.isArray(current.elements))current.elements=[];if(!Array.isArray(current.extras))current.extras=[];}

  function setStatus(message,type='ok'){const node=byId('editorStatus');if(node){node.className=`editor-status ${type}`;node.textContent=message;}}
  function style(role){return window.DesignEditorPresets?.ROLE_PRESETS?.[role]||{size:10,weight:600,align:'left',color:'#334155'};}
  function text(group,role,value,x,y,w,extra={}){
    const base=style(role);return{id:uid('print_text'),type:'text',role,text:value,fontFamily:'Pretendard',size:extra.size??base.size,weight:extra.weight??base.weight,align:extra.align??base.align,color:extra.color??base.color,icon:extra.icon||'none',x,y,w,letterSpacing:0,lineHeight:extra.lineHeight??1.26,locked:false,visible:true,titleStyle:extra.titleStyle||'none',titleAccent:extra.titleAccent||'#1d9bb2',printBlock:TAG,componentGroup:group};
  }
  function shape(group,x,y,w,h,extra={}){
    return{id:uid('print_shape'),type:'shape',shape:'rect',name:'전문 구성 배경',x,y,w,h,fill:extra.fill||'#f1f7fb',stroke:extra.stroke||'#bfd8e3',strokeWidth:extra.strokeWidth??.6,opacity:100,cornerRadius:extra.cornerRadius??4,shapeShadow:Boolean(extra.shapeShadow),locked:false,visible:true,printBlock:TAG,componentGroup:group};
  }

  function region(){
    const p=project(),current=surface();if(!p||!current)return null;
    const safe=clamp(Number(p.safe)||8,4,24),folds=(current.folds||[]).map(Number).filter(Number.isFinite).sort((a,b)=>a-b),bounds=[0,...folds,Number(p.width)||210],labels=current.panels||[];
    let index=labels.findIndex(label=>/앞표지/.test(String(label)));if(index<0)index=0;
    const start=bounds[index]??0,end=bounds[index+1]??(Number(p.width)||210),panelW=Math.max(20,end-start),pad=clamp(Math.min(safe,panelW*.1),4,10);
    return{x:start+pad,w:Math.max(20,panelW-pad*2),top:safe,bottom:(Number(p.height)||297)-safe};
  }

  function save(message){
    const p=project();if(!p)return;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('구성요소를 저장하지 못했습니다.','err');}
    window.DesignEditorDraftScope?.saveCurrent?.('professional-print-block');window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{window.DesignEditorPhase2?.sync?.();window.DesignEditorQuickDesign?.sync?.();window.DesignEditorSimpleInterface?.sync?.();window.DesignEditorCanvasQuickbar?.sync?.();setStatus(message,'ok');},80);
  }

  function insertHighlight(){
    const current=surface(),r=region();if(!current||!r)return;ensure(current);const group=uid('highlight'),h=Math.min(38,Math.max(28,r.w*.22)),y=clamp(r.top+Math.max(46,r.w*.18),r.top,r.bottom-h);
    current.extras.push(shape(group,r.x,y,r.w,h,{fill:'#f0fbfd',stroke:'#8ecbd6',cornerRadius:5}));
    current.elements.push(text(group,'subtitle','강조 안내',r.x+6,y+6,r.w-12,{size:12,titleStyle:'bar'}),text(group,'body','중요한 내용을 짧고 명확하게 입력하세요.',r.x+6,y+19,r.w-12,{size:9.5,lineHeight:1.45}));
    save('강조 안내 박스를 넣었습니다.');
  }

  function insertKeyFacts(){
    const current=surface(),r=region();if(!current||!r)return;ensure(current);const group=uid('facts'),gap=3,h=24,y=clamp(r.top+Math.max(58,r.w*.24),r.top,r.bottom-h);
    const horizontal=r.w>=86,count=3,boxW=horizontal?(r.w-gap*(count-1))/count:r.w;
    const facts=[['calendar','일시','2026. 00. 00'],['pin','장소','장소 입력'],['people','대상','참여 대상']];
    facts.forEach((fact,index)=>{const x=horizontal?r.x+index*(boxW+gap):r.x,yy=horizontal?y:y+index*(h+gap);current.extras.push(shape(group,x,yy,boxW,h,{fill:'#f8fafc',stroke:'#d7e0e9',cornerRadius:4}));current.elements.push(text(group,'info',fact[1],x+4,yy+4,boxW-8,{icon:fact[0],size:8.5,color:'#64748b'}),text(group,'body',fact[2],x+4,yy+13,boxW-8,{size:9,weight:700,color:'#172033'}));});
    save('일시·장소·대상 카드 3개를 넣었습니다.');
  }

  function selectedImage(){const node=document.querySelector('.phase2-extra-object.selected');if(!node)return null;return surface()?.extras?.find(item=>item.id===node.dataset.extraId&&item.type==='image')||null;}
  function insertPhotoCaption(){
    const image=selectedImage(),current=surface(),p=project();if(!image||!current||!p)return setStatus('사진을 먼저 선택한 뒤 사진 설명을 눌러주세요.','info');
    ensure(current);const group=uid('caption'),w=Math.max(28,Number(image.w)||40),height=14;let y=(Number(image.y)||0)+(Number(image.h)||0)+3;if(y+height>Number(p.height)-(Number(p.safe)||0))y=Math.max(Number(p.safe)||0,(Number(image.y)||0)-height-3);
    current.elements.push(text(group,'body','사진 설명을 입력하세요.',Number(image.x)||0,y,w,{size:8.5,color:'#64748b',lineHeight:1.35}));save('선택한 사진에 설명 글씨를 붙였습니다.');
  }

  function insertBrandBar(){
    const current=surface(),r=region();if(!current||!r)return;ensure(current);const group=uid('brand'),h=18,y=Math.max(r.top,r.bottom-h);
    current.extras.push(shape(group,r.x,y,r.w,h,{fill:'#12396d',stroke:'#12396d',cornerRadius:3}));
    current.elements.push(text(group,'institution','주최 · 주관 · 운영 기관명을 입력하세요',r.x+6,y+5,r.w-12,{size:8.5,color:'#ffffff',weight:700}));save('하단 기관 바를 넣었습니다.');
  }

  function installStyles(){
    if(byId(STYLE_ID))return;const styleNode=document.createElement('style');styleNode.id=STYLE_ID;styleNode.textContent=`.print-block-more{margin-top:7px;border-top:1px solid #e6edf2;padding-top:7px}.print-block-more>summary{cursor:pointer;list-style:none;color:#64748b;font-size:7.5px;font-weight:900}.print-block-more>summary::-webkit-details-marker{display:none}.print-block-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.print-block-grid button{border:1px solid #d7e0e9;border-radius:8px;background:#fff;color:#475569;padding:8px 4px;font-size:7.5px;font-weight:900;cursor:pointer}.print-block-grid button:hover{border-color:#79b9c8;background:#f0fdff}`;document.head.appendChild(styleNode);
  }

  function installIntoComponentCard(){
    const card=byId('designComponentBlocksTools');if(!card||byId('designPrintBlocksMore'))return Boolean(card);
    const details=document.createElement('details');details.id='designPrintBlocksMore';details.className='print-block-more';details.innerHTML='<summary>더 많은 전문 구성</summary><div class="print-block-grid"><button id="printBlockHighlight" type="button">강조 안내</button><button id="printBlockFacts" type="button">핵심 3정보</button><button id="printBlockCaption" type="button">사진 설명</button><button id="printBlockBrand" type="button">하단 기관 바</button></div>';card.appendChild(details);
    byId('printBlockHighlight').addEventListener('click',insertHighlight);byId('printBlockFacts').addEventListener('click',insertKeyFacts);byId('printBlockCaption').addEventListener('click',insertPhotoCaption);byId('printBlockBrand').addEventListener('click',insertBrandBar);return true;
  }

  function install(){
    if(installed)return true;if(!window.DesignEditorApp||!byId('inspector'))return false;
    installStyles();if(!installIntoComponentCard())return false;installed=true;window.DesignEditorPrintBlocks={insertHighlight,insertKeyFacts,insertPhotoCaption,insertBrandBar,stage:'professional-one-click-print-block-presets'};return true;
  }
  function boot(){if(install())return;[220,480,900,1500,2500,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
