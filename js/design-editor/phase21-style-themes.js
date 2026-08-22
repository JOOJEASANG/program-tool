(function(){
  'use strict';
  if(window.__designEditorStyleThemesV1)return;
  window.__designEditorStyleThemesV1=true;
  if(new URLSearchParams(location.search).get('embed')!=='1')return;

  const STYLE_ID='designEditorStyleThemesStyles';
  const PANEL_ID='designStyleThemePanel';
  const DRAFT_KEY='programTool.designEditor.draft.v1';
  const THEMES={
    clean:{name:'깔끔',bg:'#ffffff',title:'#12396d',subtitle:'#334155',body:'#334155',info:'#475569',institution:'#64748b',accent:'#1d9bb2',soft:'#eef7fa',line:'#b8d9e1',titleStyle:'bar'},
    public:{name:'공공기관',bg:'#ffffff',title:'#174a7e',subtitle:'#315f8c',body:'#334155',info:'#46637d',institution:'#5f7080',accent:'#2f80c9',soft:'#edf5fc',line:'#b8d2ea',titleStyle:'line'},
    event:{name:'행사홍보',bg:'#fffefe',title:'#512c78',subtitle:'#70459a',body:'#3b3144',info:'#5f526a',institution:'#766b80',accent:'#df4e84',soft:'#fff0f5',line:'#f2bfd1',titleStyle:'highlight'},
    warm:{name:'따뜻한 감성',bg:'#fffdf8',title:'#70452f',subtitle:'#8c624b',body:'#54483f',info:'#76655a',institution:'#8a7a70',accent:'#d9865b',soft:'#fff3e9',line:'#edc9b2',titleStyle:'underline'}
  };
  let installed=false;

  const byId=id=>document.getElementById(id);
  const project=()=>window.DesignEditorApp?.project||null;
  const generatedShape=item=>Boolean(item?.smartLayout||item?.componentBlock||item?.printBlock);

  function setStatus(message,type='ok'){
    const node=byId('editorStatus');if(!node)return;node.className=`editor-status ${type}`;node.textContent=message;
  }

  function applyText(item,theme){
    const role=String(item.role||'body');
    if(role==='title'){
      item.color=theme.title;item.weight=Math.max(800,Number(item.weight)||800);item.titleStyle=theme.titleStyle;item.titleAccent=theme.accent;
    }else if(role==='subtitle'){
      item.color=theme.subtitle;item.weight=Math.max(700,Number(item.weight)||700);item.titleAccent=theme.accent;
      if(item.titleStyle&&item.titleStyle!=='none')item.titleStyle=theme.titleStyle==='highlight'?'line':theme.titleStyle;
    }else if(role==='info')item.color=theme.info;
    else if(role==='institution')item.color=theme.institution;
    else item.color=theme.body;
  }

  function applyGeneratedShape(item,theme){
    if(item.type!=='shape'||!generatedShape(item))return;
    if(item.shape==='line'){item.stroke=theme.accent;return;}
    const isDark=String(item.fill||'').toLowerCase()==='#12396d';
    item.fill=isDark?theme.title:theme.soft;item.stroke=isDark?theme.title:theme.line;
    if(item.shape==='rect'&&item.cornerRadius==null)item.cornerRadius=3;
  }

  function applyTheme(key){
    const p=project(),theme=THEMES[key];if(!p||!theme)return;
    (p.surfaces||[]).forEach(surface=>{
      surface.background=theme.bg;
      (surface.elements||[]).filter(item=>item.type==='text').forEach(item=>applyText(item,theme));
      (surface.extras||[]).forEach(item=>applyGeneratedShape(item,theme));
    });
    p.styleTheme=key;
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(p));}catch(_){return setStatus('스타일 테마를 저장하지 못했습니다.','err');}
    window.DesignEditorDraftScope?.saveCurrent?.('style-theme');window.DesignEditorApp?.resumeDraft?.();
    setTimeout(()=>{
      window.DesignEditorPhase2?.sync?.();window.DesignEditorQuickDesign?.sync?.();window.DesignEditorSimpleInterface?.sync?.();window.DesignEditorCanvasQuickbar?.sync?.();renderSelected();setStatus(`${theme.name} 스타일을 전체 면에 적용했습니다.`,'ok');
    },80);
  }

  function installStyles(){
    if(byId(STYLE_ID))return;const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .style-theme-panel{margin-top:8px;padding-top:8px;border-top:1px solid #e6edf2}.style-theme-title{font-size:7.5px;font-weight:950;color:#64748b;margin-bottom:6px}.style-theme-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}.style-theme-btn{display:grid;grid-template-columns:1fr auto;align-items:center;gap:5px;border:1px solid #d7e0e9;border-radius:9px;background:#fff;padding:7px 8px;color:#475569;font-size:7.5px;font-weight:900;cursor:pointer;text-align:left}.style-theme-btn:hover{border-color:#79b9c8;background:#f8fdff}.style-theme-btn.on{border-color:#1d9bb2;box-shadow:0 0 0 2px #1d9bb214}.style-theme-swatches{display:flex;gap:2px}.style-theme-swatch{width:9px;height:9px;border-radius:50%;border:1px solid #ffffff;box-shadow:0 0 0 1px #d7e0e9}.style-theme-note{margin-top:6px;color:#8793a1;font-size:6.8px;line-height:1.45}
    `;document.head.appendChild(style);
  }

  function buttonMarkup(key,theme,current){
    return `<button type="button" class="style-theme-btn${current===key?' on':''}" data-style-theme="${key}"><span>${theme.name}</span><span class="style-theme-swatches"><i class="style-theme-swatch" style="background:${theme.title}"></i><i class="style-theme-swatch" style="background:${theme.accent}"></i><i class="style-theme-swatch" style="background:${theme.soft}"></i></span></button>`;
  }

  function renderSelected(){
    const panel=byId(PANEL_ID),current=project()?.styleTheme||'';if(!panel)return;
    panel.querySelectorAll('[data-style-theme]').forEach(button=>button.classList.toggle('on',button.dataset.styleTheme===current));
  }

  function installPanel(){
    if(byId(PANEL_ID))return true;
    const card=byId('designQuickDesignTools');if(!card)return false;
    const panel=document.createElement('div');panel.id=PANEL_ID;panel.className='style-theme-panel';
    const current=project()?.styleTheme||'';
    panel.innerHTML=`<div class="style-theme-title">전체 스타일 · 내용은 그대로</div><div class="style-theme-grid">${Object.entries(THEMES).map(([key,theme])=>buttonMarkup(key,theme,current)).join('')}</div><div class="style-theme-note">글자 내용·위치·사진은 유지하고 전체 면의 색상과 제목 분위기만 정돈합니다.</div>`;
    card.appendChild(panel);panel.querySelectorAll('[data-style-theme]').forEach(button=>button.addEventListener('click',()=>applyTheme(button.dataset.styleTheme)));return true;
  }

  function install(){
    if(installed)return true;if(!window.DesignEditorApp)return false;installStyles();if(!installPanel())return false;installed=true;
    window.DesignEditorStyleThemes={applyTheme,themes:THEMES,stage:'curated-content-preserving-style-themes'};return true;
  }
  function boot(){if(install())return;[220,480,900,1500,2500,3600].forEach(delay=>setTimeout(install,delay));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
