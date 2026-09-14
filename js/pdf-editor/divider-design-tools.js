// Rich divider-page styling controls layered on top of the existing divider + image editor.
(function(){
  'use strict';
  if(window.__pdfDividerDesignToolsV1)return;
  window.__pdfDividerDesignToolsV1=true;

  const PANEL_ID='pdfDividerDesignToolsV1';
  const STYLE_ID='pdfDividerDesignToolsStylesV1';
  let originalGet=null, originalRender=null, originalOpen=null, originalEdit=null;
  const $=id=>document.getElementById(id);
  const clamp=(value,min,max,fallback)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};

  const PRESETS={
    navy:{label:'클래식 네이비',bg:'#15385f',fg:'#ffffff',style:'lines',accent:'#54c6d3',border:'#ffffff',pattern:'none'},
    clean:{label:'미니멀 화이트',bg:'#ffffff',fg:'#172033',style:'simple',accent:'#1769e0',border:'#d9e2ec',pattern:'none',noBg:true},
    blue:{label:'포인트 블루',bg:'#eef6ff',fg:'#12396d',style:'simple',accent:'#1769e0',border:'#1769e0',pattern:'grid'},
    warm:{label:'웜 베이지',bg:'#f7f1e7',fg:'#40352c',style:'simple',accent:'#b7793f',border:'#cba77f',pattern:'dots'},
    green:{label:'딥 그린',bg:'#143d36',fg:'#ffffff',style:'band',accent:'#63d6ad',border:'#8ce8c8',pattern:'diagonal'},
    dark:{label:'모던 다크',bg:'#171b24',fg:'#ffffff',style:'simple',accent:'#8fa8ff',border:'#65718d',pattern:'grid'}
  };

  function installStyles(){
    if($(STYLE_ID))return;
    const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
      .pdf-div-design{border-top:1px solid #e5e7eb;margin-top:9px;padding-top:9px}.pdf-div-design-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.pdf-div-design-title strong{font-size:11px}.pdf-div-design-title span{font-size:8px;color:#64748b;font-weight:700}
      .pdf-div-presets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;margin-bottom:9px}.pdf-div-preset{border:1px solid #dbe3ee;border-radius:8px;background:#fff;padding:7px 5px;font-size:9px;font-weight:850;color:#334155;cursor:pointer}.pdf-div-preset:hover{background:#f8fbff;border-color:#93c5fd}
      .pdf-div-design-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pdf-div-design .field{margin-bottom:7px!important}.pdf-div-design label{font-size:9px!important}.pdf-div-design select,.pdf-div-design input[type=text],.pdf-div-design input[type=number]{font-size:10px!important;padding:5px 6px!important}.pdf-div-design input[type=color]{height:31px!important}
      .pdf-div-range{display:grid;grid-template-columns:58px minmax(0,1fr) 37px;align-items:center;gap:5px;margin-bottom:6px}.pdf-div-range label{margin:0!important;font-size:9px!important}.pdf-div-range input{min-width:0}.pdf-div-range output{font-size:8px;font-weight:850;text-align:right;color:#475569}
      .pdf-div-design-sub{font-size:9px;font-weight:900;color:#475569;margin:8px 0 6px;padding-top:7px;border-top:1px dashed #e2e8f0}
      @media(max-width:820px){.pdf-div-design-grid{grid-template-columns:1fr}.pdf-div-presets{grid-template-columns:repeat(3,minmax(0,1fr))}}
    `;document.head.appendChild(style);
  }

  function field(label,html){return `<div class="field"><label>${label}</label>${html}</div>`;}
  function makePanel(){
    if($(PANEL_ID))return $(PANEL_ID);
    const modal=$('dividerModal')?.querySelector('.modal-box');if(!modal)return null;
    const panel=document.createElement('div');panel.id=PANEL_ID;panel.className='pdf-div-design';
    panel.innerHTML=`
      <div class="pdf-div-design-title"><strong>간지 꾸미기</strong><span>프리셋 + 글자 + 장식</span></div>
      <div class="pdf-div-presets">${Object.entries(PRESETS).map(([id,p])=>`<button type="button" class="pdf-div-preset" data-divider-preset="${id}">${p.label}</button>`).join('')}</div>
      <div class="pdf-div-design-sub">글자</div>
      <div class="pdf-div-design-grid">
        ${field('정렬','<select id="dividerTextAlign"><option value="left">왼쪽</option><option value="center" selected>가운데</option><option value="right">오른쪽</option></select>')}
        ${field('강조 라벨','<input id="dividerBadgeText" type="text" maxlength="40" placeholder="예) SECTION 01">')}
      </div>
      <div class="pdf-div-range"><label>제목 크기</label><input id="dividerTitleSize" type="range" min="24" max="90" value="52"><output id="dividerTitleSizeVal">52</output></div>
      <div class="pdf-div-range"><label>부제 크기</label><input id="dividerSubtitleSize" type="range" min="12" max="50" value="28"><output id="dividerSubtitleSizeVal">28</output></div>
      <div class="pdf-div-range"><label>메모 크기</label><input id="dividerNoteSize" type="range" min="8" max="30" value="16"><output id="dividerNoteSizeVal">16</output></div>
      <div class="pdf-div-design-sub">테두리 · 포인트</div>
      <div class="pdf-div-design-grid">
        ${field('테두리','<select id="dividerBorderStyle"><option value="none">없음</option><option value="thin">실선</option><option value="double">이중선</option></select>')}
        ${field('테두리 색','<input id="dividerBorderColor" type="color" value="#ffffff">')}
        ${field('포인트 장식','<select id="dividerAccentStyle"><option value="none">없음</option><option value="top">상단 바</option><option value="bottom">하단 바</option><option value="left">왼쪽 바</option><option value="corners">모서리</option></select>')}
        ${field('포인트 색','<input id="dividerAccentColor" type="color" value="#54c6d3">')}
      </div>
      <div class="pdf-div-range"><label>테두리 굵기</label><input id="dividerBorderWidth" type="range" min="1" max="12" value="3"><output id="dividerBorderWidthVal">3</output></div>
      <div class="pdf-div-design-sub">배경 패턴</div>
      <div class="pdf-div-design-grid">
        ${field('패턴','<select id="dividerPattern"><option value="none">없음</option><option value="dots">점</option><option value="grid">격자</option><option value="diagonal">사선</option></select>')}
        ${field('패턴 색','<input id="dividerPatternColor" type="color" value="#ffffff">')}
        ${field('라벨 위치','<select id="dividerBadgePosition"><option value="top-left">왼쪽 위</option><option value="top-center">가운데 위</option><option value="top-right">오른쪽 위</option></select>')}
        ${field('라벨 배경','<input id="dividerBadgeBg" type="color" value="#1769e0">')}
      </div>
      <div class="pdf-div-range"><label>패턴 진하기</label><input id="dividerPatternOpacity" type="range" min="2" max="30" value="10"><output id="dividerPatternOpacityVal">10%</output></div>`;
    const local=$('pdfDividerLocalImagePanel');const footer=$('dividerConfirmBtn')?.parentElement;
    if(local?.parentElement) local.insertAdjacentElement('beforebegin',panel);
    else modal.insertBefore(panel,footer||null);
    return panel;
  }

  function read(){return {
    textAlign:$('dividerTextAlign')?.value||'center',titleSize:clamp($('dividerTitleSize')?.value,24,90,52),subtitleSize:clamp($('dividerSubtitleSize')?.value,12,50,28),noteSize:clamp($('dividerNoteSize')?.value,8,30,16),
    borderStyle:$('dividerBorderStyle')?.value||'none',borderColor:$('dividerBorderColor')?.value||'#ffffff',borderWidth:clamp($('dividerBorderWidth')?.value,1,12,3),
    accentStyle:$('dividerAccentStyle')?.value||'none',accentColor:$('dividerAccentColor')?.value||'#54c6d3',pattern:$('dividerPattern')?.value||'none',patternColor:$('dividerPatternColor')?.value||'#ffffff',patternOpacity:clamp($('dividerPatternOpacity')?.value,2,30,10)/100,
    badgeText:String($('dividerBadgeText')?.value||'').slice(0,40),badgePosition:$('dividerBadgePosition')?.value||'top-left',badgeBg:$('dividerBadgeBg')?.value||'#1769e0'
  };}

  function write(content={}){
    const set=(id,value)=>{const el=$(id);if(el&&value!=null)el.value=String(value);};
    set('dividerTextAlign',content.textAlign||'center');set('dividerTitleSize',content.titleSize??52);set('dividerSubtitleSize',content.subtitleSize??28);set('dividerNoteSize',content.noteSize??16);
    set('dividerBorderStyle',content.borderStyle||'none');set('dividerBorderColor',content.borderColor||content.fg||'#ffffff');set('dividerBorderWidth',content.borderWidth??3);
    set('dividerAccentStyle',content.accentStyle||'none');set('dividerAccentColor',content.accentColor||'#54c6d3');set('dividerPattern',content.pattern||'none');set('dividerPatternColor',content.patternColor||content.fg||'#ffffff');set('dividerPatternOpacity',Math.round(clamp(content.patternOpacity,0.02,0.30,0.10)*100));
    set('dividerBadgeText',content.badgeText||'');set('dividerBadgePosition',content.badgePosition||'top-left');set('dividerBadgeBg',content.badgeBg||content.accentColor||'#1769e0');syncOutputs();
  }
  function syncOutputs(){[['dividerTitleSize','dividerTitleSizeVal',''],['dividerSubtitleSize','dividerSubtitleSizeVal',''],['dividerNoteSize','dividerNoteSizeVal',''],['dividerBorderWidth','dividerBorderWidthVal',''],['dividerPatternOpacity','dividerPatternOpacityVal','%']].forEach(([a,b,s])=>{if($(a)&&$(b))$(b).textContent=$(a).value+s;});}
  function update(){syncOutputs();try{window.updateDividerPreview?.();}catch(_){} }

  function applyPreset(id){
    const p=PRESETS[id];if(!p)return;
    if($('dividerBg')){$('dividerBg').value=p.bg;$('dividerBg').disabled=Boolean(p.noBg);}
    if($('dividerNoBg'))$('dividerNoBg').checked=Boolean(p.noBg);
    if($('dividerFg'))$('dividerFg').value=p.fg;
    document.querySelector(`#dividerStyleRow [data-style="${p.style}"]`)?.click();
    if($('dividerAccentColor'))$('dividerAccentColor').value=p.accent;
    if($('dividerBorderColor'))$('dividerBorderColor').value=p.border;
    if($('dividerPatternColor'))$('dividerPatternColor').value=p.fg;
    if($('dividerPattern'))$('dividerPattern').value=p.pattern;
    if($('dividerAccentStyle'))$('dividerAccentStyle').value=id==='clean'?'top':id==='dark'?'left':'top';
    if($('dividerBorderStyle'))$('dividerBorderStyle').value=id==='clean'?'thin':'double';
    update();
  }

  function hexToRgb(hex){const n=parseInt(String(hex||'#000000').replace('#',''),16);return {r:(n>>16)&255,g:(n>>8)&255,b:n&255};}
  function drawDecor(ctx,c,w,h){
    const line=Math.max(1,Math.min(w,h)*(c.borderWidth||3)/600);ctx.save();
    if(c.pattern&&c.pattern!=='none'){
      const rgb=hexToRgb(c.patternColor);ctx.strokeStyle=`rgba(${rgb.r},${rgb.g},${rgb.b},${c.patternOpacity||.1})`;ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=Math.max(1,w/900);const gap=Math.max(18,Math.min(w,h)/14);
      if(c.pattern==='dots'){for(let y=gap/2;y<h;y+=gap)for(let x=gap/2;x<w;x+=gap){ctx.beginPath();ctx.arc(x,y,Math.max(1,gap*.045),0,Math.PI*2);ctx.fill();}}
      else if(c.pattern==='grid'){for(let x=gap;x<w;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=gap;y<h;y+=gap){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}}
      else if(c.pattern==='diagonal'){for(let x=-h;x<w;x+=gap){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke();}}
    }
    if(c.accentStyle&&c.accentStyle!=='none'){ctx.fillStyle=c.accentColor||'#54c6d3';const t=Math.max(4,Math.min(w,h)*.018);if(c.accentStyle==='top')ctx.fillRect(0,0,w,t);else if(c.accentStyle==='bottom')ctx.fillRect(0,h-t,w,t);else if(c.accentStyle==='left')ctx.fillRect(0,0,t,w>h?h:h);else if(c.accentStyle==='corners'){const len=Math.min(w,h)*.12;ctx.fillRect(0,0,len,t);ctx.fillRect(0,0,t,len);ctx.fillRect(w-len,h-t,len,t);ctx.fillRect(w-t,h-len,t,len);}}
    if(c.borderStyle&&c.borderStyle!=='none'){ctx.strokeStyle=c.borderColor||'#ffffff';ctx.lineWidth=line;const inset=line*2;ctx.strokeRect(inset,inset,w-inset*2,h-inset*2);if(c.borderStyle==='double'){const i2=inset+line*3;ctx.strokeRect(i2,i2,w-i2*2,h-i2*2);}}
    ctx.restore();
  }
  function drawText(ctx,c,w,h){
    const fg=c.noBg?'#111827':(c.fg||'#ffffff');const align=c.textAlign||'center';const x=align==='left'?w*.10:align==='right'?w*.90:w*.5;ctx.save();ctx.fillStyle=fg;ctx.textAlign=align;ctx.textBaseline='middle';
    const va=c.textVAlign||'center';let cy=(va==='top'?.22:va==='bottom'?.78:.5)*h+h*(Number(c.textVOffset||0)/100);const hasSub=Boolean(c.subtitle);const titleY=cy+(hasSub?-h*.055:0);
    if(c.title){const fs=Math.min(w*(Number(c.titleSize||52)/520),h*(Number(c.titleSize||52)/520),Number(c.titleSize||52)*1.75);ctx.font=`800 ${Math.max(12,fs)}px Pretendard,"Malgun Gothic",sans-serif`;ctx.fillText(c.title,x,titleY,w*.82);}
    if(c.subtitle){const fs=Math.min(w*(Number(c.subtitleSize||28)/620),h*(Number(c.subtitleSize||28)/620),Number(c.subtitleSize||28)*1.65);ctx.globalAlpha=.82;ctx.font=`500 ${Math.max(9,fs)}px Pretendard,"Malgun Gothic",sans-serif`;ctx.fillText(c.subtitle,x,cy+h*.08,w*.82);ctx.globalAlpha=1;}
    if(c.note){const fs=Math.min(w*(Number(c.noteSize||16)/650),h*(Number(c.noteSize||16)/650),Number(c.noteSize||16)*1.6);ctx.globalAlpha=.66;ctx.font=`500 ${Math.max(7,fs)}px Pretendard,"Malgun Gothic",sans-serif`;ctx.fillText(c.note,x,h*.88,w*.82);ctx.globalAlpha=1;}
    if(c.badgeText){const pad=Math.max(7,w*.012),fs=Math.max(8,Math.min(18,w*.025));ctx.font=`800 ${fs}px Pretendard,"Malgun Gothic",sans-serif`;const tw=ctx.measureText(c.badgeText).width,bw=tw+pad*2,bh=fs+pad*1.3;let bx=pad*2;if(c.badgePosition==='top-center')bx=(w-bw)/2;else if(c.badgePosition==='top-right')bx=w-bw-pad*2;const by=pad*2;ctx.globalAlpha=.94;ctx.fillStyle=c.badgeBg||'#1769e0';ctx.fillRect(bx,by,bw,bh);ctx.globalAlpha=1;ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.fillText(c.badgeText,bx+bw/2,by+bh/2);}
    ctx.restore();
  }

  function patch(){
    if(!originalGet&&typeof window.getDividerContent==='function')originalGet=window.getDividerContent;
    if(originalGet&&!window.getDividerContent.__designToolsV1){const fn=function(){return {...originalGet(),...read()};};fn.__designToolsV1=true;window.getDividerContent=fn;}
    if(!originalRender&&typeof window.renderDividerCanvas==='function')originalRender=window.renderDividerCanvas;
    if(originalRender&&!window.renderDividerCanvas.__designToolsV1){const fn=function(content,w,h){const base={...content,title:'',subtitle:'',note:'',badgeText:''};const canvas=originalRender(base,w,h);const ctx=canvas.getContext('2d');drawDecor(ctx,content,w,h);drawText(ctx,content,w,h);return canvas;};fn.__designToolsV1=true;window.renderDividerCanvas=fn;}
    if(!originalOpen&&typeof window.openDividerInsert==='function')originalOpen=window.openDividerInsert;
    if(originalOpen&&!window.openDividerInsert.__designToolsV1){const fn=function(...args){const result=originalOpen(...args);write({});setTimeout(update,0);return result;};fn.__designToolsV1=true;window.openDividerInsert=fn;}
    if(!originalEdit&&typeof window.editDivider==='function')originalEdit=window.editDivider;
    if(originalEdit&&!window.editDivider.__designToolsV1){const fn=function(page,...args){const result=originalEdit(page,...args);write(page?.dividerContent||{});setTimeout(update,0);return result;};fn.__designToolsV1=true;window.editDivider=fn;}
  }

  function bind(){
    document.querySelectorAll('[data-divider-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPreset(btn.dataset.dividerPreset)));
    ['dividerTextAlign','dividerTitleSize','dividerSubtitleSize','dividerNoteSize','dividerBorderStyle','dividerBorderColor','dividerBorderWidth','dividerAccentStyle','dividerAccentColor','dividerPattern','dividerPatternColor','dividerPatternOpacity','dividerBadgeText','dividerBadgePosition','dividerBadgeBg'].forEach(id=>$(id)?.addEventListener('input',update));
  }
  function boot(){installStyles();if(!makePanel())return false;patch();bind();write({});document.documentElement.dataset.pdfDividerDesignTools='1';window.PdfDividerDesignTools={presets:PRESETS,read,write,stage:'divider-design-tools-v1'};return true;}
  let tries=0;const timer=setInterval(()=>{tries++;if((window.renderDividerCanvas?.__localImageV1||tries>40)&&boot())clearInterval(timer);if(tries>100)clearInterval(timer);},80);
})();
