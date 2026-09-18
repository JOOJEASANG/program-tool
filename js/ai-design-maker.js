/* Standalone AI Design Maker — cover first. */
'use strict';

(() => {
  if (window.__aiDesignMakerCoverV1) return;
  window.__aiDesignMakerCoverV1 = true;

  const EXPORT_DPI = 300;
  const MAX_EXPORT_PIXELS = 60_000_000;
  const STORAGE_KEY = 'program-studio:ai-design-maker:cover:v1';
  const AI_COVER_PATH = '/api/preflight/ai-design-maker/cover-background';
  const AI_DIRECT_API_ORIGIN = 'https://api-7a5qpwzezq-uc.a.run.app';
  const PRESETS = Object.freeze({
    public: {
      name: '공공·교육',
      note: '정돈되고 신뢰감 있게',
      prompt: '한국 공공기관과 교육기관의 고급 보고서 표지처럼 신뢰감 있고 정돈된 편집 디자인. 넓은 여백, 절제된 기하학 요소, 명확한 정보 위계, 안정적인 그리드와 세련된 색 조합. 행정서식처럼 딱딱하거나 값싼 템플릿처럼 보이지 않게 한다.'
    },
    premium: {
      name: '프리미엄',
      note: '고급 보고서·백서',
      prompt: '프리미엄 컨설팅 리포트와 현대적인 에디토리얼 디자인을 결합한 표지. 충분한 네거티브 스페이스, 정교한 균형, 절제된 그래픽, 깊이감 있는 색 조합. 앞표지부터 책등과 뒤표지까지 하나의 시스템으로 연결한다.'
    },
    warm: {
      name: '따뜻한 교육',
      note: '사례집·교육자료',
      prompt: '교육, 성장, 협력, 지역공동체의 분위기를 따뜻하고 현대적으로 표현한다. 밝고 부드러운 색감과 유기적이지만 정돈된 형태를 사용하고 친근하되 유치하지 않게 한다.'
    },
    forum: {
      name: '포럼·행사',
      note: '역동적 에디토리얼',
      prompt: '포럼, 세미나, 워크숍 자료집에 맞는 현대적이고 감각적인 에디토리얼 표지. 역동적인 그래픽 리듬과 대담한 면 분할 또는 추상 그래픽을 사용하되 산만하지 않고 인쇄물로서 고급스럽게 마감한다.'
    },
    admin: {
      name: '업무·행정',
      note: '차분하고 단정하게',
      prompt: '행정·업무용 보고서에 적합한 차분하고 안정적인 표지. 낮은 장식 밀도, 분명한 구조, 절제된 색상과 단정한 시각 흐름. 구식 서식처럼 보이지 않도록 현대적인 편집 감각을 적용한다.'
    }
  });

  const $ = id => document.getElementById(id);
  const qa = selector => [...document.querySelectorAll(selector)];
  const state = {
    preset: 'public',
    background: null,
    backgroundUrl: '',
    generatedSpecKey: '',
    logo: null,
    renderQueued: false
  };

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  };
  const num = (id, fallback) => {
    const node = $(id);
    return node && String(node.value).trim() !== '' ? Number(node.value) : fallback;
  };

  function currentSpec() {
    const trimW = clamp(num('trimW', 210), 50, 1000, 210);
    const trimH = clamp(num('trimH', 297), 50, 1000, 297);
    const spine = clamp(num('spine', 10), 0, 100, 10);
    const bleed = clamp(num('bleed', 3), 0, 20, 3);
    const safe = clamp(num('safeZone', 5), 0, 80, 5);
    const wing = $('wingEnabled')?.checked ? clamp(num('wingW', 70), 20, 300, 70) : 0;
    return {
      trimW, trimH, spine, bleed, safe, wing,
      workW: trimW * 2 + spine + wing * 2 + bleed * 2,
      workH: trimH + bleed * 2
    };
  }

  function specKey(spec = currentSpec()) {
    return [spec.trimW,spec.trimH,spec.spine,spec.bleed,spec.safe,spec.wing].map(v => Number(v).toFixed(2)).join('|');
  }

  function readText() {
    return {
      title: $('title')?.value || '',
      subtitle: $('subtitle')?.value || '',
      dateText: $('dateText')?.value || '',
      department: $('department')?.value || '',
      organization: $('organization')?.value || '',
      backText: $('backText')?.value || '',
      contact: $('contact')?.value || '',
      spineTitle: $('spineTitle')?.value || '',
      spineDate: $('spineDate')?.value || '',
      spineCompany: $('spineCompany')?.value || '',
      spineOrientation: $('spineOrientation')?.value || 'rotate-up'
    };
  }

  function serializableState() {
    const ids = ['trimW','trimH','spine','bleed','safeZone','wingW','title','subtitle','dateText','department','organization','backText','contact','spineTitle','spineDate','spineCompany','spineOrientation','primaryColor','textColor','theme','stylePrompt'];
    const data = { preset: state.preset, wingEnabled: Boolean($('wingEnabled')?.checked), spineSync: Boolean($('spineSync')?.checked) };
    ids.forEach(id => { if ($(id)) data[id] = $(id).value; });
    return data;
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializableState()));
      const badge = $('saveState');
      if (badge) {
        badge.textContent = '저장됨';
        clearTimeout(saveLocal.timer);
        saveLocal.timer = setTimeout(() => { badge.textContent = '자동 저장'; }, 900);
      }
    } catch (_) {}
  }

  function loadLocal() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      Object.entries(data).forEach(([key,value]) => {
        const node = $(key);
        if (!node || key === 'wingEnabled' || key === 'spineSync') return;
        node.value = value;
      });
      if (typeof data.wingEnabled === 'boolean') $('wingEnabled').checked = data.wingEnabled;
      if (typeof data.spineSync === 'boolean') $('spineSync').checked = data.spineSync;
      if (data.preset && PRESETS[data.preset]) state.preset = data.preset;
    } catch (_) {}
  }

  function saveSessionNow() {
    saveLocal();
    setStatus('편집 내용을 저장했습니다.','현재 표지 규격과 문구·디자인 설정을 이 브라우저에 저장했습니다.','ok');
  }

  function loadSessionNow() {
    loadLocal();
    setupPresetCards();
    syncWing();
    syncSpineTitle();
    updateGeometry();
    updateProgress();
    scheduleRender();
    setStatus('저장한 편집 내용을 불러왔습니다.','저장된 규격과 문구·디자인 설정을 다시 적용했습니다.','ok');
  }

  function setStatus(title, message, tone = 'ok', debug = '') {
    const panel = document.querySelector('.status-panel');
    panel?.classList.remove('error','busy');
    if (tone === 'error') panel?.classList.add('error');
    if (tone === 'busy') panel?.classList.add('busy');
    if ($('statusIcon')) $('statusIcon').textContent = tone === 'error' ? '!' : tone === 'busy' ? '…' : '✓';
    if ($('statusTitle')) $('statusTitle').textContent = title;
    if ($('statusMessage')) $('statusMessage').textContent = message;
    if ($('statusDetails')) $('statusDetails').hidden = !debug;
    if ($('statusDebug')) $('statusDebug').textContent = debug || '';
  }

  function setupPresetCards() {
    const root = $('styleCards');
    if (!root) return;
    root.replaceChildren();
    Object.entries(PRESETS).forEach(([id,preset]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'style-card';
      button.dataset.preset = id;
      button.setAttribute('role','radio');
      button.innerHTML = '<strong>'+preset.name+'</strong><span>'+preset.note+'</span>';
      button.addEventListener('click', () => selectPreset(id, true));
      root.appendChild(button);
    });
    selectPreset(state.preset, false);
  }

  function selectPreset(id, replacePrompt) {
    if (!PRESETS[id]) id = 'public';
    state.preset = id;
    qa('.style-card').forEach(button => {
      const active = button.dataset.preset === id;
      button.classList.toggle('active', active);
      button.setAttribute('aria-checked', String(active));
    });
    if (replacePrompt && $('stylePrompt')) $('stylePrompt').value = PRESETS[id].prompt;
    saveLocal();
  }

  function syncWing() {
    const enabled = Boolean($('wingEnabled')?.checked);
    if ($('wingField')) $('wingField').hidden = !enabled;
  }

  function syncSpineTitle() {
    if ($('spineSync')?.checked && $('spineTitle')) $('spineTitle').value = $('title')?.value || '';
  }

  function fillSpineFromCover() {
    if ($('spineTitle')) $('spineTitle').value = $('title')?.value || '';
    if ($('spineDate')) $('spineDate').value = $('dateText')?.value || '';
    if ($('spineCompany')) $('spineCompany').value = $('organization')?.value || '';
    if ($('spineSync')) $('spineSync').checked = true;
    saveLocal();
    scheduleRender();
    setStatus('책등 문구를 채웠습니다.','앞표지 제목·날짜·기관명 기준으로 책등 입력값을 정리했습니다.','ok');
  }

  function updateProgress() {
    const spec=currentSpec();
    const validSpec=spec.trimW>=50&&spec.trimH>=50&&spec.spine>=0&&spec.bleed>=0;
    const hasTitle=Boolean(String($('title')?.value||'').trim());
    const hasStyle=Boolean(String($('stylePrompt')?.value||'').trim());
    const setState=(id,done,doneText,pendingText)=>{
      const node=$(id); if(!node)return;
      node.textContent=done?doneText:pendingText;
      node.classList.toggle('done',done);
      node.classList.toggle('need',!done);
    };
    setState('specState',validSpec,'완료','확인');
    setState('copyState',hasTitle,'완료','제목 필요');
    setState('styleState',hasStyle,'완료','스타일 필요');
    const generated=Boolean(state.background&&state.generatedSpecKey===specKey(spec));
    const stale=Boolean(state.background&&!generated);
    const badge=$('generationState');
    if(badge){
      badge.textContent=generated?'AI 배경 완료':stale?'규격 변경 · 재생성':'생성 전';
      badge.classList.toggle('ready',generated);
      badge.classList.toggle('stale',stale);
    }
  }

  function jumpToSection(id) {
    const section=$(id); if(!section)return;
    section.open=true;
    section.scrollIntoView({behavior:'smooth',block:'start'});
    setTimeout(()=>section.querySelector('input,textarea,select,button')?.focus({preventScroll:true}),260);
  }

  function updateSpinePolicy() {
    const spine = currentSpec().spine;
    const box = $('spinePolicy');
    if (!box) return;
    box.className = 'spine-policy';
    if (spine < 4) {
      box.classList.add('warn');
      box.textContent = '책등 4mm 미만: 인쇄 안정성을 위해 책등 문구는 출력에서 제외됩니다.';
    } else if (spine < 8) {
      box.classList.add('warn');
      box.textContent = '책등 4~7.9mm: 제목만 표시합니다.';
    } else if (spine < 12) {
      box.classList.add('ok');
      box.textContent = '책등 8~11.9mm: 제목과 날짜를 표시합니다.';
    } else {
      box.classList.add('ok');
      box.textContent = '책등 12mm 이상: 제목·날짜·회사명을 모두 표시할 수 있습니다.';
    }
  }

  function updateGeometry() {
    const spec = currentSpec();
    const wing = spec.wing ? ' · 날개 '+spec.wing.toFixed(1)+'mm×2' : '';
    const text = '완성 '+spec.trimW.toFixed(1)+'×'+spec.trimH.toFixed(1)+'mm · 책등 '+spec.spine.toFixed(1)+'mm · 도련 '+spec.bleed.toFixed(1)+'mm'+wing+' · 전체 '+spec.workW.toFixed(1)+'×'+spec.workH.toFixed(1)+'mm';
    if ($('geometryHint')) $('geometryHint').textContent = text;
    if ($('geometrySummary')) $('geometrySummary').textContent = text;
    updateSpinePolicy();
    updateProgress();
    const stale = Boolean(state.background && state.generatedSpecKey && state.generatedSpecKey !== specKey(spec));
    if ($('exportBtn')) $('exportBtn').disabled = !state.background || stale;
    if (stale) setStatus('규격이 변경되었습니다.','현재 규격에 맞게 AI 배경을 다시 생성해 주세요.','busy');
  }

  function scheduleRender() {
    if (state.renderQueued) return;
    state.renderQueued = true;
    requestAnimationFrame(() => {
      state.renderQueued = false;
      renderPreview();
    });
  }

  function canvasFitSize(spec) {
    const scroll = $('canvasScroll');
    const maxW = Math.max(340, (scroll?.clientWidth || 1000) - 72);
    const maxH = Math.max(300, (scroll?.clientHeight || 700) - 72);
    const scale = Math.min(maxW / spec.workW, maxH / spec.workH, 2.2);
    return { width: Math.max(300, Math.round(spec.workW * scale)), height: Math.max(220, Math.round(spec.workH * scale)), scale };
  }

  function drawEmpty(ctx,w,h) {
    const gradient = ctx.createLinearGradient(0,0,w,h);
    gradient.addColorStop(0,'#f8fafc');
    gradient.addColorStop(.55,'#eef2ff');
    gradient.addColorStop(1,'#fdf2f8');
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);
    ctx.save();
    ctx.globalAlpha = .22;
    ctx.strokeStyle = '#94a3b8';
    for(let x=-h;x<w+h;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x+h,h);ctx.stroke();}
    ctx.restore();
  }

  function line(ctx,x1,y1,x2,y2,color,dash=[]) {
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();
  }
  function rect(ctx,x,y,w,h,color,dash=[]) {
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.2;ctx.setLineDash(dash);ctx.strokeRect(x,y,w,h);ctx.restore();
  }
  function zone(ctx,text,x,y,w,h) {
    if(w<28||h<30)return;
    ctx.save();ctx.fillStyle='rgba(15,23,42,.70)';ctx.font='800 10px Pretendard, sans-serif';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(text,x+w/2,y+8);ctx.restore();
  }

  function drawGuides(ctx,spec,scale) {
    if (!$('guideToggle')?.checked) return;
    const b=spec.bleed*scale, wing=spec.wing*scale, tw=spec.trimW*scale, th=spec.trimH*scale, sw=spec.spine*scale, safe=spec.safe*scale;
    const backX=b+wing, spineX=backX+tw, frontX=spineX+sw, frontWingX=frontX+tw;
    if(spec.bleed>0) rect(ctx,.5,.5,spec.workW*scale-1,spec.workH*scale-1,'#db2777',[7,5]);
    rect(ctx,backX,b,tw,th,'#2563eb',[6,4]);rect(ctx,frontX,b,tw,th,'#2563eb',[6,4]);
    if(safe>0){rect(ctx,backX+safe,b+safe,Math.max(0,tw-safe*2),Math.max(0,th-safe*2),'#16a34a');rect(ctx,frontX+safe,b+safe,Math.max(0,tw-safe*2),Math.max(0,th-safe*2),'#16a34a');}
    if(sw>0){line(ctx,spineX,b,spineX,b+th,'#ef4444',[6,4]);line(ctx,frontX,b,frontX,b+th,'#ef4444',[6,4]);zone(ctx,'책등',spineX,b,sw,th);}
    if(wing>0){line(ctx,backX,b,backX,b+th,'#f59e0b',[8,4]);line(ctx,frontWingX,b,frontWingX,b+th,'#f59e0b',[8,4]);zone(ctx,'뒷날개',b,b,wing,th);zone(ctx,'앞날개',frontWingX,b,wing,th);}
    zone(ctx,'뒤표지',backX,b,tw,th);zone(ctx,'앞표지',frontX,b,tw,th);
  }

  function titlePt(text,trimW) {
    let pt=trimW<140?30:42;
    const n=[...String(text||'')].length;
    if(n>18)pt-=5;if(n>30)pt-=5;if(n>44)pt-=4;
    return clamp(pt,22,44,32);
  }
  function spinePt(spine,text) {
    let pt=clamp(spine*.95+4,8,15,9);
    const n=[...String(text||'')].length;
    if(n>18)pt-=1.5;if(n>28)pt-=1.5;
    return clamp(pt,7,15,8);
  }

  function textLayout(spec,scale) {
    const v=readText(), b=spec.bleed*scale, wing=spec.wing*scale, tw=spec.trimW*scale, th=spec.trimH*scale, sw=spec.spine*scale;
    const backX=b+wing, spineX=backX+tw, frontX=spineX+sw;
    const safe=Math.min(spec.safe,spec.trimW*.15,spec.trimH*.15)*scale;
    const ptPx=pt=>pt*25.4/72*scale;
    const list=[], add=item=>{if(String(item.text||'').trim())list.push(item);};
    add({text:v.title,x:frontX+safe,y:b+th*.12,w:Math.max(1,tw-safe*2),h:th*.20,fontPt:titlePt(v.title,spec.trimW),weight:900});
    add({text:v.subtitle,x:frontX+safe,y:b+th*.34,w:Math.max(1,tw-safe*2),h:th*.12,fontPt:17,weight:700});
    add({text:v.dateText,x:frontX+safe,y:b+th*.61,w:Math.max(1,tw-safe*2),h:th*.06,fontPt:10,weight:700});
    add({text:v.department,x:frontX+safe,y:b+th*.68,w:Math.max(1,tw-safe*2),h:th*.07,fontPt:10,weight:700});
    add({text:v.organization,x:frontX+safe,y:b+th*.87,w:Math.max(1,tw-safe*2),h:th*.07,fontPt:11,weight:850});
    add({text:v.backText,x:backX+safe,y:b+th*.16,w:Math.max(1,tw-safe*2),h:th*.58,fontPt:10.5,weight:600});
    add({text:v.contact,x:backX+safe,y:b+th*.84,w:Math.max(1,tw-safe*2),h:th*.12,fontPt:9,weight:750});
    if(spec.spine>=4&&v.spineTitle){
      const fp=spinePt(spec.spine,v.spineTitle);
      if(v.spineOrientation==='vertical')add({text:v.spineTitle,x:spineX+sw*.12,y:b+th*.18,w:sw*.76,h:th*.62,fontPt:fp,weight:900,vertical:true,align:'center'});
      else add({text:v.spineTitle,x:spineX+sw/2-th*.31,y:b+th/2-sw*.34,w:th*.62,h:sw*.68,fontPt:fp,weight:900,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    if(spec.spine>=8&&v.spineDate){
      const fp=clamp(spinePt(spec.spine,v.spineDate)-2,7,10,8);
      if(v.spineOrientation==='vertical')add({text:v.spineDate,x:spineX+sw*.18,y:b+th*.06,w:sw*.64,h:th*.10,fontPt:fp,weight:800,vertical:true,align:'center'});
      else add({text:v.spineDate,x:spineX+sw/2-th*.09,y:b+th*.14-sw*.25,w:th*.18,h:sw*.5,fontPt:fp,weight:800,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    if(spec.spine>=12&&v.spineCompany){
      const fp=clamp(spinePt(spec.spine,v.spineCompany)-3,7,9.5,8);
      if(v.spineOrientation==='vertical')add({text:v.spineCompany,x:spineX+sw*.18,y:b+th*.82,w:sw*.64,h:th*.13,fontPt:fp,weight:800,vertical:true,align:'center'});
      else add({text:v.spineCompany,x:spineX+sw/2-th*.12,y:b+th*.86-sw*.25,w:th*.24,h:sw*.5,fontPt:fp,weight:800,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    list.forEach(item=>item.fontPx=ptPx(item.fontPt));
    return list;
  }

  function wrapped(ctx,text,x,y,maxWidth,lineHeight,align='left',maxHeight=Infinity){
    let cy=y;
    for(const paragraph of String(text||'').split(/\n/)){
      if(cy+lineHeight>y+maxHeight)break;
      const lines=[];let lineText='';
      for(const char of [...paragraph]){
        const test=lineText+char;
        if(lineText&&ctx.measureText(test).width>maxWidth){lines.push(lineText);lineText=char;}else lineText=test;
      }
      if(lineText||!paragraph.length)lines.push(lineText);
      for(const value of lines){
        if(cy+lineHeight>y+maxHeight)break;
        let dx=x;ctx.textAlign=align;
        if(align==='center')dx=x+maxWidth/2;else if(align==='right')dx=x+maxWidth;
        ctx.fillText(value,dx,cy);cy+=lineHeight;
      }
      cy+=lineHeight*.12;
    }
  }

  function vertical(ctx,text,x,y,w,h,lineHeight){
    ctx.textAlign='center';let cy=y;
    for(const char of [...String(text||'').replace(/\s+/g,'')]){if(cy+lineHeight>y+h)break;ctx.fillText(char,x+w/2,cy);cy+=lineHeight;}
  }

  function drawTextItem(ctx,item,color,fontOverride){
    if(!String(item.text||'').trim())return;
    const font=fontOverride||item.fontPx;
    ctx.save();ctx.fillStyle=color;ctx.font=(item.weight||700)+' '+font+'px Pretendard, "Noto Sans KR", Arial, sans-serif';ctx.textBaseline='top';
    if(item.vertical)vertical(ctx,item.text,item.x,item.y,item.w,item.h,font*1.14);
    else if(item.rotate){const cx=item.x+item.w/2,cy=item.y+item.h/2;ctx.translate(cx,cy);ctx.rotate(item.rotate*Math.PI/180);wrapped(ctx,item.text,-item.w/2,-item.h/2,item.w,font*1.16,item.align||'center',item.h);}
    else wrapped(ctx,item.text,item.x,item.y,item.w,font*1.2,item.align||'left',item.h);
    ctx.restore();
  }

  function logoRect(spec,scale){
    if(!state.logo)return null;
    const b=spec.bleed*scale,wing=spec.wing*scale,tw=spec.trimW*scale,th=spec.trimH*scale,sw=spec.spine*scale,safe=spec.safe*scale;
    const frontX=b+wing+tw+sw;
    const maxW=tw*.24,maxH=th*.08,ratio=state.logo.naturalWidth/state.logo.naturalHeight;
    let w=maxW,h=w/ratio;if(h>maxH){h=maxH;w=h*ratio;}
    return {x:frontX+tw-safe-w,y:b+th*.88-h,w,h};
  }

  function drawLogo(ctx,spec,scale){
    const r=logoRect(spec,scale);if(!r)return;ctx.drawImage(state.logo,r.x,r.y,r.w,r.h);
  }

  function renderPreview(){
    const canvas=$('previewCanvas'),spec=currentSpec();if(!canvas)return;
    const fit=canvasFitSize(spec),dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.width=fit.width+'px';canvas.style.height=fit.height+'px';canvas.width=Math.round(fit.width*dpr);canvas.height=Math.round(fit.height*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    if(state.background?.naturalWidth)ctx.drawImage(state.background,0,0,fit.width,fit.height);else drawEmpty(ctx,fit.width,fit.height);
    drawLogo(ctx,spec,fit.scale);
    const color=$('textColor')?.value||'#ffffff';
    textLayout(spec,fit.scale).forEach(item=>drawTextItem(ctx,item,color));
    drawGuides(ctx,spec,fit.scale);
    updateGeometry();
  }

  function waitForImage(image){
    if(image.complete&&image.naturalWidth)return Promise.resolve();
    return new Promise((resolve,reject)=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',()=>reject(new Error('이미지를 읽지 못했습니다.')),{once:true});});
  }

  function deployedAiHost() {
    const host=String(location.hostname||'').toLowerCase();
    return host==='program-tool.web.app'
      || host==='program-tool.firebaseapp.com'
      || (host.startsWith('program-tool--')&&host.endsWith('.web.app'));
  }

  function resolveApiUrl(url) {
    if(url===AI_COVER_PATH&&deployedAiHost())return AI_DIRECT_API_ORIGIN+url;
    return url;
  }

  function clientRequestId() {
    if(globalThis.crypto?.randomUUID)return 'ai-'+crypto.randomUUID();
    return 'ai-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  }

  async function authFetch(url,options={}){
    const user=window.auth?.currentUser;
    if(!user)throw Object.assign(new Error('로그인이 필요합니다.'),{status:401,code:'AUTH_REQUIRED'});
    const token=await user.getIdToken();
    const requestId=clientRequestId();
    const target=resolveApiUrl(url);
    const headers=new Headers(options.headers||{});
    headers.set('Authorization','Bearer '+token);
    headers.set('Content-Type','application/json');
    headers.set('X-Request-ID',requestId);
    let response;
    try{
      response=await fetch(target,{...options,headers});
    }catch(cause){
      const err=new Error('AI 생성 서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.');
      err.status=0;err.code='AI_DIRECT_API_NETWORK';err.requestId=requestId;err.raw=String(cause?.message||cause||'');err.transport=target.startsWith(AI_DIRECT_API_ORIGIN)?'direct-function':'hosting';throw err;
    }
    const raw=await response.text();
    let data={};try{data=raw?JSON.parse(raw):{};}catch(_){data={detail:''};}
    if(!response.ok){
      const htmlGateway=/^\s*<!doctype html/i.test(raw)||/^\s*<html/i.test(raw);
      const code=data.code||(htmlGateway&&response.status>=500?'AI_GATEWAY_ERROR':'');
      const message=data.detail||(htmlGateway&&response.status>=500
        ?'AI 생성 서버 연결이 중간에서 종료되었습니다. 잠시 후 다시 시도해 주세요.'
        :'AI 표지 생성 요청에 실패했습니다.');
      const err=new Error(message);
      err.status=response.status;err.code=code;err.requestId=data.request_id||response.headers.get('x-request-id')||requestId;err.raw=raw.slice(0,1200);err.transport=target.startsWith(AI_DIRECT_API_ORIGIN)?'direct-function':'hosting';throw err;
    }
    return data;
  }

  function themeContext(){
    const t=readText();
    return [
      '표지 용도: 인쇄용 책/보고서 전체 펼침 표지',
      t.title?'주제 참고 제목: '+t.title:'',
      t.organization?'기관 성격: '+t.organization:'',
      $('theme')?.value?'핵심 키워드: '+$('theme').value:'',
      '선호 주조색: '+($('primaryColor')?.value||'#315c8c')
    ].filter(Boolean).join('\n');
  }

  async function generate(){
    const title=String($('title')?.value||'').trim();
    if(!title){setStatus('제목을 먼저 입력해 주세요.','앞표지 제목은 필수입니다.','error');$('title')?.focus();return;}
    const spec=currentSpec(), ratio=spec.workW/spec.workH;
    if(ratio<1/3||ratio>3){setStatus('현재 표지 비율을 생성할 수 없습니다.','완성 규격·책등·날개 폭을 확인해 주세요.','error');return;}
    const button=$('generateBtn');button.disabled=true;
    setStatus('AI 배경을 생성하고 있습니다.','표지 비율에 맞는 배경을 만드는 중입니다. 생성에는 시간이 걸릴 수 있습니다.','busy');
    try{
      const prompt=String($('stylePrompt')?.value||PRESETS[state.preset].prompt).trim();
      const data=await authFetch(AI_COVER_PATH,{
        method:'POST',
        body:JSON.stringify({
          trim_width_mm:spec.trimW,trim_height_mm:spec.trimH,spine_mm:spec.spine,wing_mm:spec.wing,bleed_mm:spec.bleed,
          preset_name:PRESETS[state.preset].name,
          style_request:prompt+'\nPreferred dominant color: '+($('primaryColor')?.value||'#315c8c')+'.',
          theme_context:themeContext()
        })
      });
      if(!data.image_base64)throw new Error('AI 이미지 결과가 비어 있습니다.');
      const image=new Image();image.src='data:'+(data.mime_type||'image/png')+';base64,'+data.image_base64;await waitForImage(image);
      state.background=image;state.backgroundUrl=image.src;state.generatedSpecKey=specKey(spec);
      $('exportBtn').disabled=false;scheduleRender();
      updateProgress();
      setStatus('AI 배경 생성 완료','문구는 별도 레이어로 유지됩니다. 문구나 색상을 수정하면 미리보기에 바로 반영됩니다.','ok');
    }catch(error){
      const debug=['HTTP: '+(error.status||'unknown'),'code: '+(error.code||'unknown'),'request_id: '+(error.requestId||'none'),'transport: '+(error.transport||'direct-function'),error.raw?'response: '+error.raw:''].filter(Boolean).join('\n');
      setStatus('AI 배경 생성 실패',error.message||'AI 표지 생성 요청에 실패했습니다.','error',debug);
    }finally{button.disabled=false;}
  }

  function canvasBlob(canvas){
    return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG 데이터를 만들지 못했습니다.')),'image/png'));
  }
  function u32(value){return new Uint8Array([(value>>>24)&255,(value>>>16)&255,(value>>>8)&255,value&255]);}
  function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
  function pngChunk(type,data){
    const typeBytes=new TextEncoder().encode(type),crcInput=new Uint8Array(typeBytes.length+data.length);crcInput.set(typeBytes);crcInput.set(data,typeBytes.length);
    const out=new Uint8Array(12+data.length);out.set(u32(data.length),0);out.set(typeBytes,4);out.set(data,8);out.set(u32(crc32(crcInput)),8+data.length);return out;
  }
  async function withPngDpi(blob,dpi){
    const bytes=new Uint8Array(await blob.arrayBuffer()),signature=bytes.slice(0,8),parts=[signature],ppm=Math.round(dpi/0.0254);
    const physData=new Uint8Array(9);physData.set(u32(ppm),0);physData.set(u32(ppm),4);physData[8]=1;const phys=pngChunk('pHYs',physData);
    let offset=8;
    while(offset+12<=bytes.length){
      const len=((bytes[offset]<<24)|(bytes[offset+1]<<16)|(bytes[offset+2]<<8)|bytes[offset+3])>>>0;
      const end=offset+12+len;if(end>bytes.length)break;
      const type=String.fromCharCode(...bytes.slice(offset+4,offset+8));
      if(type!=='pHYs')parts.push(bytes.slice(offset,end));
      if(type==='IHDR')parts.push(phys);
      offset=end;if(type==='IEND')break;
    }
    return new Blob(parts,{type:'image/png'});
  }

  async function exportPng(){
    if(!state.background){setStatus('먼저 AI 배경을 생성해 주세요.','생성된 배경이 있어야 300dpi로 저장할 수 있습니다.','error');return;}
    const spec=currentSpec();
    if(state.generatedSpecKey!==specKey(spec)){setStatus('규격이 변경되었습니다.','현재 규격으로 AI 배경을 다시 생성한 뒤 저장해 주세요.','error');return;}
    const ppm=EXPORT_DPI/25.4,w=Math.round(spec.workW*ppm),h=Math.round(spec.workH*ppm),pixels=w*h;
    if(pixels>MAX_EXPORT_PIXELS){setStatus('300dpi 저장 한도를 초과했습니다.','현재 규격은 '+(pixels/1e6).toFixed(1)+'MP입니다. 규격 또는 날개 폭을 확인해 주세요.','error');return;}
    const button=$('exportBtn');button.disabled=true;
    setStatus('300dpi 파일을 만들고 있습니다.','배경과 한글 문구·책등·로고를 실제 인쇄 크기로 합성하는 중입니다.','busy');
    try{
      await document.fonts?.ready;
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
      ctx.drawImage(state.background,0,0,w,h);
      drawLogo(ctx,spec,ppm);
      const color=$('textColor')?.value||'#ffffff';
      textLayout(spec,ppm).forEach(item=>drawTextItem(ctx,item,color,item.fontPt*EXPORT_DPI/72));
      const raw=await canvasBlob(canvas),png=await withPngDpi(raw,EXPORT_DPI),url=URL.createObjectURL(png),a=document.createElement('a');
      a.href=url;a.download='cover-'+spec.trimW+'x'+spec.trimH+'-spine-'+spec.spine+'mm-300dpi.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
      setStatus('300dpi 저장 완료','실제 전체 펼침 규격과 300dpi 메타데이터로 PNG를 저장했습니다.','ok');
    }catch(error){setStatus('PNG 저장 실패',error.message||'파일 저장 중 오류가 발생했습니다.','error');}
    finally{button.disabled=false;}
  }

  function resetAll(){
    if(!confirm('입력한 문구와 설정을 초기화할까요?'))return;
    try{localStorage.removeItem(STORAGE_KEY);}catch(_){}
    location.reload();
  }

  async function loadLogo(file){
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setStatus('지원하지 않는 로고 파일입니다.','PNG, JPEG, WEBP만 사용할 수 있습니다.','error');return;}
    const url=URL.createObjectURL(file),image=new Image();image.src=url;
    try{await waitForImage(image);state.logo=image;if($('logoName'))$('logoName').textContent=file.name;if($('clearLogo'))$('clearLogo').hidden=false;scheduleRender();setStatus('로고를 불러왔습니다.','앞표지 하단에 자동 배치했습니다.','ok');}
    catch(error){URL.revokeObjectURL(url);setStatus('로고를 읽지 못했습니다.',error.message,'error');}
  }

  function clearLogo(){
    if(state.logo?.src?.startsWith('blob:'))URL.revokeObjectURL(state.logo.src);
    state.logo=null;if($('logoInput'))$('logoInput').value='';if($('logoName'))$('logoName').textContent='없음';if($('clearLogo'))$('clearLogo').hidden=true;scheduleRender();
  }

  function bind(){
    loadLocal();setupPresetCards();syncWing();syncSpineTitle();
    if(!$('stylePrompt').value)$('stylePrompt').value=PRESETS[state.preset].prompt;
    qa('.size-chip').forEach(button=>button.addEventListener('click',()=>{
      const [w,h]=button.dataset.size.split(',');$('trimW').value=w;$('trimH').value=h;qa('.size-chip').forEach(x=>x.classList.toggle('active',x===button));saveLocal();scheduleRender();
    }));
    const watched=['trimW','trimH','spine','bleed','safeZone','wingW','title','subtitle','dateText','department','organization','backText','contact','spineTitle','spineDate','spineCompany','spineOrientation','primaryColor','textColor','theme','stylePrompt'];
    watched.forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='title')syncSpineTitle();saveLocal();updateProgress();scheduleRender();}));
    $('wingEnabled')?.addEventListener('change',()=>{syncWing();saveLocal();scheduleRender();});
    $('spineSync')?.addEventListener('change',()=>{syncSpineTitle();saveLocal();updateProgress();scheduleRender();});
    $('fillSpineBtn')?.addEventListener('click',fillSpineFromCover);
    $('aiDesignSessionSaveBtn')?.addEventListener('click',saveSessionNow);
    $('aiDesignSessionLoadBtn')?.addEventListener('click',loadSessionNow);
    qa('[data-jump]').forEach(button=>button.addEventListener('click',()=>jumpToSection(button.dataset.jump)));
    $('guideToggle')?.addEventListener('change',scheduleRender);
    $('generateBtn')?.addEventListener('click',generate);
    $('exportBtn')?.addEventListener('click',exportPng);
    $('resetBtn')?.addEventListener('click',resetAll);
    $('logoInput')?.addEventListener('change',event=>loadLogo(event.target.files?.[0]));
    $('clearLogo')?.addEventListener('click',clearLogo);
    $('logoutBtn')?.addEventListener('click',()=>window.auth?.signOut().then(()=>location.replace('/')));
    window.addEventListener('resize',()=>scheduleRender());
    updateGeometry();updateProgress();scheduleRender();
  }

  async function authorize(){
    const gate=$('authGate'),shell=$('makerShell'),message=$('authMessage'),login=$('authLogin');
    if(!window.auth){message.textContent='로그인 모듈을 불러오지 못했습니다.';login.hidden=false;return;}
    window.auth.onAuthStateChanged(async user=>{
      if(!user){message.textContent='AI 디자인 제작을 사용하려면 로그인해 주세요.';login.hidden=false;shell.hidden=true;gate.hidden=false;return;}
      try{
        const access=await window.ProgramAccess.getAccess(user);
        if(!access.approved){message.textContent='관리자 승인 후 사용할 수 있습니다.';login.hidden=true;shell.hidden=true;gate.hidden=false;return;}
        if($('userName'))$('userName').textContent=user.displayName||user.email||'사용자';
        gate.hidden=true;shell.hidden=false;bind();
      }catch(error){message.textContent='사용 권한을 확인하지 못했습니다. 잠시 후 새로고침해 주세요.';login.hidden=false;}
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',authorize,{once:true});else authorize();
})();
