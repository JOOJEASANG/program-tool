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
  const PRESET_PROMPTS_KO = Object.freeze({
    premium: '여백을 넉넉히 사용한 고급 편집디자인 표지를 만들어 주세요. 정돈된 그리드와 세련된 비대칭 구성, 절제된 주조색과 1~2개의 포인트 색상을 사용하고 장식보다 비율·리듬·크기 대비로 완성도를 높여 주세요. 앞표지는 명확한 중심을 두고 뒤표지는 더 차분하게 연결해 주세요. 광택 효과, 물결 리본, 흔한 기업 브로슈어 느낌, 과도한 그라데이션, 클립아트는 피해주세요.',
    admin: '현대적인 업무·행정 보고서 표지를 만들어 주세요. 정확한 편집 그리드, 안정적인 여백, 신뢰감 있는 정보 구조와 절제된 비대칭 구성을 사용해 주세요. 딥 네이비, 차콜, 뮤트 블루, 웜 그레이, 딥 틸 계열을 중심으로 고급 연차보고서처럼 보이게 해주세요. 오래된 관공서 브로슈어, 파란 물결, 광택 리본, 입체 도형과 장식 과다는 피해주세요.',
    forum: '밝고 세련된 포럼·컨퍼런스 출판물 표지를 만들어 주세요. 아이보리·오프화이트처럼 밝은 바탕에 파우더 블루, 세이지, 연보라, 피치, 블러시 계열의 부드러운 파스텔 포인트를 1~2개 사용하고 넓은 여백과 섬세한 편집 그리드로 구성해 주세요. 거대한 원·반원·두꺼운 네이비 블록처럼 흔한 관공서 브로슈어 도형은 피하고, 작은 기하학적 리듬이나 얇은 선, 은은한 질감으로 현대적인 문화·포럼 아이덴티티처럼 보여 주세요. 앞표지는 밝고 산뜻하며 제목이 들어갈 공간이 충분해야 하고 뒤표지는 더 차분하게 연결해 주세요.',
    education: '따뜻하지만 유치하지 않은 교육·사례집 표지를 만들어 주세요. 부드러운 편집 구조와 우아한 여백, 절제된 유기적 또는 기하학적 형태, 자연스럽고 차분한 색감에 하나의 포인트 색상을 사용해 주세요. 전문 출판물처럼 정돈하고 어린이용 일러스트, 만화 아이콘, 낙서, 복잡한 콜라주, 오래된 브로슈어 물결 그래픽은 피해주세요.',
    public: '명확하고 품격 있는 공공·정책 출판물 표지를 만들어 주세요. 정돈된 그리드, 충분한 여백, 절제된 추상 구조와 차분한 색상으로 프리미엄 정책보고서나 기관 출판물처럼 구성해 주세요. 흔한 관공서 이미지, 파란 물결, 상징 클립아트, 광택 그라데이션, 과도한 엠블럼과 오래된 행정 템플릿 느낌은 피해주세요.'
  });

  const PRESETS = Object.freeze({
    premium: {
      name: '프리미엄 미니멀',
      note: '가장 세련되고 절제된 편집디자인',
      prompt: 'Create an elegant premium editorial cover system with generous negative space, disciplined grid logic, refined asymmetry, one quiet base tone and one or two restrained accent colors. Build visual interest through proportion, rhythm, scale, subtle geometry and carefully controlled depth rather than decoration. The front cover should feel art-directed and contemporary, the back cover quieter, and the whole spread should look like a high-end publication rather than a template. Avoid glossy effects, decorative waves, corporate swooshes, stock brochure layouts, obvious gradients, clip-art, and generic office graphics.'
    },
    admin: {
      name: '업무·행정',
      note: '현대적이고 신뢰감 있는 보고서',
      prompt: 'Create a contemporary business and administrative publication cover with a precise editorial grid, calm authority, strong spacing and sophisticated information architecture. Use clean geometry, restrained asymmetry, subtle line or block systems, and a professional palette such as deep navy, charcoal, muted blue, warm gray or dark teal. It should resemble a premium annual report or institutional publication, not an old government brochure. Avoid blue ribbon waves, glossy swooshes, generic corporate templates, beveled shapes, clip-art icons, and decorative clutter.'
    },
    forum: {
      name: '포럼·행사',
      note: '컨퍼런스 아이덴티티처럼 세련되게',
      prompt: 'Create a bright, airy and sophisticated conference/forum publication cover. Use an off-white or ivory base with soft pastel accents such as powder blue, sage, pale lavender, peach or blush. Favor generous whitespace, fine editorial grids, subtle line work, restrained small-scale geometry and gentle texture. The result should feel like a contemporary cultural conference identity or premium editorial booklet. Avoid dark navy dominance, giant circles or semicircles, heavy geometric blocks, government-brochure styling, ribbon waves, neon, glossy effects, excessive gradients and stock-template aesthetics.', primaryColor: '#dbeaf4', textColor: '#27445f'
    },
    education: {
      name: '교육·사례집',
      note: '따뜻하지만 유치하지 않은 자료집',
      prompt: 'Create a refined educational and case-study publication cover that feels warm, intelligent, contemporary and trustworthy. Use soft editorial structure, elegant spacing, restrained organic or geometric forms, subtle depth and a calm visual rhythm. Use light neutrals or muted natural colors with one controlled accent. Keep the result professional and publication-like rather than playful. Avoid childish illustrations, school-poster styling, cartoon icons, decorative doodles, busy collage layouts, dated brochure waves, and low-end template graphics.'
    },
    public: {
      name: '공공·정책',
      note: '고급 공공출판물·정책보고서',
      prompt: 'Create a high-end public institution or policy publication cover with clarity, dignity and contemporary editorial quality. Use a disciplined grid, clean negative space, subtle abstract structure, restrained color and a memorable but quiet visual system. The result should feel like a premium policy report or museum-quality institutional publication rather than a generic government handout. Avoid patriotic clichés, government clip-art, blue wave motifs, symbolic stock imagery, glossy gradients, crowded emblems, and dated administrative templates.'
    }
  });

  const $ = id => document.getElementById(id);
  const qa = selector => [...document.querySelectorAll(selector)];
  const state = {
    preset: 'premium',
    background: null,
    backgroundUrl: '',
    generatedSpecKey: '',
    logo: null,
    renderQueued: false,
    promptLanguage: 'ko',
    customFields: [],
    textLayouts: {},
    selectedTextId: '',
    textPointer: null,
    backgroundSource: ''
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
      spineOrientation: $('spineOrientation')?.value || 'rotate-up',
      eventDate: $('eventDate')?.value || '',
      eventPlace: $('eventPlace')?.value || '',
      hostText: $('hostText')?.value || '',
      organizerText: $('organizerText')?.value || '',
      customFields: state.customFields.filter(item => String(item.label || '').trim() || String(item.value || '').trim())
    };
  }

  function serializableState() {
    const ids = ['trimW','trimH','spine','bleed','safeZone','wingW','title','subtitle','dateText','department','organization','eventDate','eventPlace','hostText','organizerText','backText','contact','spineTitle','spineDate','spineCompany','spineOrientation','primaryColor','textColor','theme','stylePrompt'];
    const data = {
      preset: state.preset,
      wingEnabled: Boolean($('wingEnabled')?.checked),
      spineSync: Boolean($('spineSync')?.checked),
      promptLanguage: state.promptLanguage,
      customFields: state.customFields,
      textLayouts: state.textLayouts
    };
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
      if (data.promptLanguage === 'en' || data.promptLanguage === 'ko') state.promptLanguage = data.promptLanguage;
      if (Array.isArray(data.customFields)) state.customFields = data.customFields.slice(0, 12).map(item => ({
        id: String(item?.id || ('custom-'+Math.random().toString(36).slice(2))),
        label: String(item?.label || '').slice(0, 40),
        value: String(item?.value || '').slice(0, 220)
      }));
      const normalizeTextLayout = (layout, fallbackAlign = 'left') => ({
        dx: clamp(layout?.dx, -2000, 2000, 0),
        dy: clamp(layout?.dy, -2000, 2000, 0),
        widthScale: clamp(layout?.widthScale, .25, 2.5, 1),
        fontScale: clamp(layout?.fontScale, .35, 3, 1),
        align: ['left','center','right'].includes(layout?.align) ? layout.align : fallbackAlign
      });
      if (data.textLayouts && typeof data.textLayouts === 'object') {
        Object.entries(data.textLayouts).forEach(([id,layout]) => {
          state.textLayouts[String(id)] = normalizeTextLayout(layout);
        });
      }
      if (data.titleLayout && typeof data.titleLayout === 'object' && !state.textLayouts.title) {
        state.textLayouts.title = normalizeTextLayout(data.titleLayout);
      }
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

  function presetPrompt(id = state.preset) {
    if (state.promptLanguage === 'ko') return PRESET_PROMPTS_KO[id] || PRESET_PROMPTS_KO.public;
    return PRESETS[id]?.prompt || PRESETS.public.prompt;
  }

  function syncPromptLanguageUi(replaceDefault = false) {
    qa('input[name="promptLanguage"]').forEach(input => { input.checked = input.value === state.promptLanguage; });
    const hint = $('promptLanguageHint');
    if (hint) hint.textContent = state.promptLanguage === 'ko'
      ? '한글 모드 · 프리셋 설명도 한글로 입력됩니다.'
      : 'English mode · preset instructions are written in English.';
    const prompt = $('stylePrompt');
    if (prompt) {
      prompt.placeholder = state.promptLanguage === 'ko'
        ? '원하는 디자인 방향을 한글로 자유롭게 입력하세요.'
        : 'Describe the desired design direction in English.';
      if (replaceDefault || !String(prompt.value || '').trim()) prompt.value = presetPrompt();
    }
  }

  function renderCustomFields() {
    const root = $('customFields');
    if (!root) return;
    root.replaceChildren();
    if (!state.customFields.length) {
      const empty = document.createElement('div');
      empty.className = 'custom-field-empty';
      empty.textContent = '추가 항목이 없습니다.';
      root.appendChild(empty);
      return;
    }
    state.customFields.forEach(item => {
      const row = document.createElement('div');
      row.className = 'custom-field-row';
      row.dataset.customId = item.id;
      const label = document.createElement('input');
      label.type = 'text'; label.maxLength = 40; label.placeholder = '항목명'; label.value = item.label;
      label.dataset.customLabel = '1'; label.setAttribute('aria-label','추가 항목명');
      const value = document.createElement('input');
      value.type = 'text'; value.maxLength = 220; value.placeholder = '내용'; value.value = item.value;
      value.dataset.customValue = '1'; value.setAttribute('aria-label','추가 항목 내용');
      const remove = document.createElement('button');
      remove.type = 'button'; remove.className = 'custom-field-remove'; remove.textContent = '×';
      remove.title = '항목 삭제'; remove.setAttribute('aria-label','추가 항목 삭제');
      const update = () => {
        item.label = label.value;
        item.value = value.value;
        saveLocal();
        scheduleRender();
      };
      label.addEventListener('input', update); value.addEventListener('input', update);
      remove.addEventListener('click', () => {
        state.customFields = state.customFields.filter(x => x.id !== item.id);
        renderCustomFields(); saveLocal(); scheduleRender();
      });
      row.append(label,value,remove); root.appendChild(row);
    });
  }

  function addCustomField() {
    if (state.customFields.length >= 12) {
      setStatus('추가 항목은 최대 12개까지 가능합니다.','필요 없는 항목을 삭제한 뒤 다시 추가해 주세요.','error');
      return;
    }
    const item = { id: 'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6), label: '', value: '' };
    state.customFields.push(item);
    renderCustomFields(); saveLocal(); scheduleRender();
    requestAnimationFrame(() => document.querySelector('[data-custom-id="'+item.id+'"] input')?.focus());
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
    if (replacePrompt && $('stylePrompt')) $('stylePrompt').value = presetPrompt(id);
    if (replacePrompt && PRESETS[id]?.primaryColor && $('primaryColor')) $('primaryColor').value = PRESETS[id].primaryColor;
    if (replacePrompt && PRESETS[id]?.textColor && $('textColor')) $('textColor').value = PRESETS[id].textColor;
    saveLocal();
    scheduleRender();
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
    } else if (spine < 16) {
      box.classList.add('ok');
      box.textContent = '책등 12~15.9mm: 제목과 날짜를 우선 표시합니다. 회사명은 16mm 이상에서 자동 표시됩니다.';
    } else {
      box.classList.add('ok');
      box.textContent = '책등 16mm 이상: 제목·날짜·회사명을 모두 표시할 수 있습니다.';
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
    const maxW = Math.max(340, (scroll?.clientWidth || 1000) - 20);
    const maxH = Math.max(300, (scroll?.clientHeight || 700) - 20);
    const scale = Math.min(maxW / spec.workW, maxH / spec.workH, 4);
    return { width: Math.max(300, Math.round(spec.workW * scale)), height: Math.max(220, Math.round(spec.workH * scale)), scale };
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
    if(sw>0){
      ctx.save();
      ctx.fillStyle='rgba(239,68,68,.055)';
      ctx.fillRect(spineX,b,sw,th);
      ctx.restore();
      line(ctx,spineX,b,spineX,b+th,'#ef4444',[6,4]);
      line(ctx,frontX,b,frontX,b+th,'#ef4444',[6,4]);
      const spineInset=Math.min(sw*.18,1.5*scale);
      if(sw>spineInset*2+2){
        line(ctx,spineX+spineInset,b,spineX+spineInset,b+th,'rgba(239,68,68,.65)',[2,3]);
        line(ctx,frontX-spineInset,b,frontX-spineInset,b+th,'rgba(239,68,68,.65)',[2,3]);
      }
      zone(ctx,'책등 '+spec.spine.toFixed(1)+'mm',spineX,b,sw,th);
    }
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
    let pt=clamp(spine*.58+4.2,7.5,12.5,9);
    const n=[...String(text||'')].length;
    if(n>18)pt-=1;if(n>28)pt-=1.2;if(n>40)pt-=1;
    return clamp(pt,7,12.5,8);
  }

  function textLayoutState(id, fallbackAlign = 'left') {
    const current=state.textLayouts[id] || {};
    const normalized={
      dx:clamp(current.dx,-2000,2000,0),
      dy:clamp(current.dy,-2000,2000,0),
      widthScale:clamp(current.widthScale,.25,2.5,1),
      fontScale:clamp(current.fontScale,.35,3,1),
      align:['left','center','right'].includes(current.align)?current.align:fallbackAlign
    };
    state.textLayouts[id]=normalized;
    return normalized;
  }

  function textItemLabel(id) {
    const fixed={
      title:'앞표지 제목',subtitle:'부제',eventDate:'일시',eventPlace:'장소',hostText:'주최',organizerText:'주관',
      dateText:'발행일·연도',department:'발행 부서',organization:'기관·회사명',
      backText:'뒤표지 소개문',contact:'뒤표지 하단 정보',
      spineTitle:'책등 제목',spineDate:'책등 날짜',spineCompany:'책등 회사명'
    };
    if(fixed[id])return fixed[id];
    if(String(id||'').startsWith('custom:')){
      const customId=String(id).slice(7);
      const item=state.customFields.find(entry=>entry.id===customId);
      return String(item?.label||'추가 문구').trim()||'추가 문구';
    }
    return '문구';
  }

  function applyTextEdit(item,spec,scale) {
    if(!item.id)return item;
    const edit=textLayoutState(item.id,item.align||'left');
    item.x+=edit.dx*scale;
    item.y+=edit.dy*scale;
    item.w=Math.max(item.minW||5*scale,item.w*edit.widthScale);
    item.fontPt=clamp(item.fontPt*edit.fontScale,4,160,item.fontPt);
    item.align=edit.align;
    return item;
  }

  function textLayout(spec,scale) {
    const v=readText(), b=spec.bleed*scale, wing=spec.wing*scale, tw=spec.trimW*scale, th=spec.trimH*scale, sw=spec.spine*scale;
    const backX=b+wing, spineX=backX+tw, frontX=spineX+sw;
    const safe=Math.min(spec.safe,spec.trimW*.15,spec.trimH*.15)*scale;
    const ptPx=pt=>pt*25.4/72*scale;
    const list=[];
    const add=item=>{
      if(!String(item.text||'').trim())return;
      applyTextEdit(item,spec,scale);
      item.fontPx=ptPx(item.fontPt);
      list.push(item);
    };
    const contentW=Math.max(1,tw-safe*2);
    add({id:'title',text:v.title,x:frontX+safe,y:b+th*.12,w:contentW,h:th*.24,fontPt:titlePt(v.title,spec.trimW),weight:900,align:'left'});
    add({id:'subtitle',text:v.subtitle,x:frontX+safe,y:b+th*.34,w:contentW,h:th*.12,fontPt:17,weight:700,align:'left'});

    const eventEntries=[
      {id:'eventDate',label:'일시',text:v.eventDate},
      {id:'eventPlace',label:'장소',text:v.eventPlace},
      {id:'hostText',label:'주최',text:v.hostText},
      {id:'organizerText',label:'주관',text:v.organizerText},
      ...v.customFields.map(item=>({
        id:'custom:'+item.id,
        label:String(item.label||'').trim(),
        text:String(item.value||'').trim()
      }))
    ].filter(item=>String(item.text||item.label||'').trim());
    const infoStart=b+th*.52;
    const infoArea=th*.205;
    const infoStep=eventEntries.length?Math.min(th*.047,infoArea/eventEntries.length):0;
    eventEntries.forEach((entry,index)=>{
      const text=entry.label&&entry.text?entry.label+'  '+entry.text:(entry.text||entry.label);
      add({id:entry.id,text,x:frontX+safe,y:infoStart+index*infoStep,w:contentW,h:Math.max(th*.035,infoStep*.98),fontPt:9.2,weight:720,align:'left'});
    });

    add({id:'dateText',text:v.dateText,x:frontX+safe,y:b+th*.77,w:contentW,h:th*.045,fontPt:9.5,weight:700,align:'left'});
    add({id:'department',text:v.department,x:frontX+safe,y:b+th*.82,w:contentW,h:th*.045,fontPt:9.5,weight:700,align:'left'});
    add({id:'organization',text:v.organization,x:frontX+safe,y:b+th*.89,w:contentW,h:th*.06,fontPt:11,weight:850,align:'left'});
    add({id:'backText',text:v.backText,x:backX+safe,y:b+th*.16,w:contentW,h:th*.58,fontPt:10.5,weight:600,align:'left'});
    add({id:'contact',text:v.contact,x:backX+safe,y:b+th*.84,w:contentW,h:th*.12,fontPt:9,weight:750,align:'left'});

    if(spec.spine>=4&&v.spineTitle){
      const fp=spinePt(spec.spine,v.spineTitle);
      if(v.spineOrientation==='vertical')add({id:'spineTitle',text:v.spineTitle,x:spineX+sw*.12,y:b+th*.18,w:sw*.76,h:th*.62,fontPt:fp,weight:900,vertical:true,align:'center'});
      else add({id:'spineTitle',text:v.spineTitle,x:spineX+sw/2-th*.31,y:b+th/2-sw*.34,w:th*.62,h:sw*.68,fontPt:fp,weight:900,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    if(spec.spine>=8&&v.spineDate){
      const fp=clamp(spinePt(spec.spine,v.spineDate)-2,7,10,8);
      if(v.spineOrientation==='vertical')add({id:'spineDate',text:v.spineDate,x:spineX+sw*.18,y:b+th*.06,w:sw*.64,h:th*.10,fontPt:fp,weight:800,vertical:true,align:'center'});
      else add({id:'spineDate',text:v.spineDate,x:spineX+sw/2-th*.09,y:b+th*.14-sw*.25,w:th*.18,h:sw*.5,fontPt:fp,weight:800,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    if(spec.spine>=16&&v.spineCompany){
      const fp=clamp(spinePt(spec.spine,v.spineCompany)-3,7,9.5,8);
      if(v.spineOrientation==='vertical')add({id:'spineCompany',text:v.spineCompany,x:spineX+sw*.18,y:b+th*.82,w:sw*.64,h:th*.13,fontPt:fp,weight:800,vertical:true,align:'center'});
      else add({id:'spineCompany',text:v.spineCompany,x:spineX+sw/2-th*.12,y:b+th*.86-sw*.25,w:th*.24,h:sw*.5,fontPt:fp,weight:800,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center'});
    }
    return list;
  }

  function wrappedLayout(ctx,text,maxWidth,lineHeight,maxHeight=Infinity){
    const rows=[];
    let cy=0,maxLineWidth=0;
    for(const paragraph of String(text||'').split(/\n/)){
      if(cy+lineHeight>maxHeight)break;
      const lines=[];let lineText='';
      for(const char of [...paragraph]){
        const test=lineText+char;
        if(lineText&&ctx.measureText(test).width>maxWidth){lines.push(lineText);lineText=char;}else lineText=test;
      }
      if(lineText||!paragraph.length)lines.push(lineText);
      for(const value of lines){
        if(cy+lineHeight>maxHeight)break;
        const width=Math.min(maxWidth,ctx.measureText(value).width);
        rows.push({text:value,y:cy,width});
        maxLineWidth=Math.max(maxLineWidth,width);
        cy+=lineHeight;
      }
      cy+=lineHeight*.12;
    }
    return {rows,width:maxLineWidth,height:Math.min(maxHeight,Math.max(0,cy-lineHeight*.12))};
  }

  function wrapped(ctx,text,x,y,maxWidth,lineHeight,align='left',maxHeight=Infinity){
    const layout=wrappedLayout(ctx,text,maxWidth,lineHeight,maxHeight);
    for(const row of layout.rows){
      let dx=x;ctx.textAlign=align;
      if(align==='center')dx=x+maxWidth/2;else if(align==='right')dx=x+maxWidth;
      ctx.fillText(row.text,dx,y+row.y);
    }
    return layout;
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

  function textVisualBounds(ctx,item,fontOverride){
    const font=fontOverride||item.fontPx;
    ctx.save();
    ctx.font=(item.weight||700)+' '+font+'px Pretendard, "Noto Sans KR", Arial, sans-serif';
    ctx.textBaseline='top';
    if(item.vertical){
      const chars=[...String(item.text||'').replace(/\s+/g,'')].length;
      const lineHeight=font*1.14;
      const h=Math.min(item.h,Math.max(lineHeight,chars*lineHeight));
      const w=Math.min(item.w,Math.max(font*1.25,font));
      ctx.restore();
      return {x:item.x+(item.w-w)/2,y:item.y,w,h};
    }
    const lineHeight=font*(item.rotate?1.16:1.2);
    const metrics=wrappedLayout(ctx,item.text,item.w,lineHeight,item.h);
    const rawW=Math.min(item.w,Math.max(font*.55,metrics.width));
    const rawH=Math.min(item.h,Math.max(lineHeight,metrics.height));
    if(item.rotate){
      const cx=item.x+item.w/2,cy=item.y+item.h/2;
      ctx.restore();
      return {x:cx-rawH/2,y:cy-rawW/2,w:rawH,h:rawW};
    }
    let x=item.x;
    if((item.align||'left')==='center')x=item.x+(item.w-rawW)/2;
    else if(item.align==='right')x=item.x+item.w-rawW;
    ctx.restore();
    return {x,y:item.y,w:rawW,h:rawH};
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

  function drawBackgroundImage(ctx,image,w,h){
    if(!image?.naturalWidth||!image?.naturalHeight)return;
    const sourceRatio=image.naturalWidth/image.naturalHeight,targetRatio=w/h;
    let sx=0,sy=0,sw=image.naturalWidth,sh=image.naturalHeight;
    if(sourceRatio>targetRatio){
      sw=image.naturalHeight*targetRatio;
      sx=(image.naturalWidth-sw)/2;
    }else if(sourceRatio<targetRatio){
      sh=image.naturalWidth/targetRatio;
      sy=(image.naturalHeight-sh)/2;
    }
    ctx.drawImage(image,sx,sy,sw,sh,0,0,w,h);
  }

  function renderPreview(){
    const canvas=$('previewCanvas'),spec=currentSpec();if(!canvas)return;
    const fit=canvasFitSize(spec),dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.width=fit.width+'px';canvas.style.height=fit.height+'px';canvas.width=Math.round(fit.width*dpr);canvas.height=Math.round(fit.height*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,fit.width,fit.height);
    if(state.background?.naturalWidth)drawBackgroundImage(ctx,state.background,fit.width,fit.height);
    drawLogo(ctx,spec,fit.scale);
    const color=$('textColor')?.value||'#ffffff';
    const items=textLayout(spec,fit.scale);
    items.forEach(item=>drawTextItem(ctx,item,color));
    drawGuides(ctx,spec,fit.scale);
    if($('cropMarkToggle')?.checked)drawCropMarks(ctx,spec,fit.scale);
    drawTextSelection(ctx,items);
    updateGeometry();
  }

  function drawCropMarks(ctx,spec,scale) {
    const b=spec.bleed*scale,w=spec.workW*scale,h=spec.workH*scale;
    const left=b,right=w-b,top=b,bottom=h-b;
    const len=Math.max(5,Math.min(18,(spec.bleed||3)*scale*.82));
    const gap=Math.max(1,.45*scale);
    ctx.save();ctx.strokeStyle='rgba(15,23,42,.92)';ctx.lineWidth=Math.max(.65,.22*scale);ctx.setLineDash([]);
    const seg=(x1,y1,x2,y2)=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();};
    seg(left,Math.max(0,top-gap-len),left,Math.max(0,top-gap));
    seg(right,Math.max(0,top-gap-len),right,Math.max(0,top-gap));
    seg(left,Math.min(h,bottom+gap),left,Math.min(h,bottom+gap+len));
    seg(right,Math.min(h,bottom+gap),right,Math.min(h,bottom+gap+len));
    seg(Math.max(0,left-gap-len),top,Math.max(0,left-gap),top);
    seg(Math.max(0,left-gap-len),bottom,Math.max(0,left-gap),bottom);
    seg(Math.min(w,right+gap),top,Math.min(w,right+gap+len),top);
    seg(Math.min(w,right+gap),bottom,Math.min(w,right+gap+len),bottom);
    ctx.restore();
  }

  function drawTextSelection(ctx,items){
    if(!state.selectedTextId)return;
    const item=items.find(entry=>entry.id===state.selectedTextId);if(!item)return;
    const bounds=textVisualBounds(ctx,item);
    ctx.save();
    ctx.strokeStyle='#7c3aed';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
    ctx.strokeRect(bounds.x-4,bounds.y-4,bounds.w+8,bounds.h+8);
    ctx.setLineDash([]);ctx.fillStyle='#7c3aed';
    const hs=10;ctx.fillRect(bounds.x+bounds.w-hs/2,bounds.y+bounds.h-hs/2,hs,hs);
    ctx.restore();
  }

  function canvasPoint(event) {
    const canvas=$('previewCanvas'),rect=canvas?.getBoundingClientRect();
    if(!canvas||!rect||!rect.width||!rect.height)return null;
    return {x:(event.clientX-rect.left)*(canvas.clientWidth/rect.width),y:(event.clientY-rect.top)*(canvas.clientHeight/rect.height)};
  }

  function pointInBounds(point,bounds,padding=5){
    return point.x>=bounds.x-padding&&point.x<=bounds.x+bounds.w+padding&&point.y>=bounds.y-padding&&point.y<=bounds.y+bounds.h+padding;
  }

  function findTextAtPoint(ctx,items,point){
    for(let index=items.length-1;index>=0;index--){
      const item=items[index],bounds=textVisualBounds(ctx,item);
      if(pointInBounds(point,bounds,6))return {item,bounds};
    }
    return null;
  }

  function syncTextEditUi(){
    const selected=state.selectedTextId;
    const label=$('selectedTextLabel');
    if(label)label.textContent=selected?textItemLabel(selected):'문구를 클릭해 선택';
    const layout=selected?textLayoutState(selected):null;
    qa('[data-text-align]').forEach(button=>{
      button.disabled=!selected;
      button.classList.toggle('active',Boolean(layout&&button.dataset.textAlign===layout.align));
    });
    if($('resetTextLayout'))$('resetTextLayout').disabled=!selected;
  }

  function bindTextCanvasEditing(){
    const canvas=$('previewCanvas');if(!canvas)return;
    canvas.addEventListener('pointerdown',event=>{
      const point=canvasPoint(event),spec=currentSpec(),fit=canvasFitSize(spec),ctx=canvas.getContext('2d');
      if(!point||!ctx)return;
      const items=textLayout(spec,fit.scale);
      let selected=items.find(item=>item.id===state.selectedTextId)||null;
      let selectedBounds=selected?textVisualBounds(ctx,selected):null;
      const hs=16;
      const onHandle=selectedBounds&&point.x>=selectedBounds.x+selectedBounds.w-hs&&point.x<=selectedBounds.x+selectedBounds.w+hs&&point.y>=selectedBounds.y+selectedBounds.h-hs&&point.y<=selectedBounds.y+selectedBounds.h+hs;
      let hit=onHandle&&selected?{item:selected,bounds:selectedBounds}:findTextAtPoint(ctx,items,point);
      if(!hit){
        state.selectedTextId='';state.textPointer=null;syncTextEditUi();scheduleRender();return;
      }
      event.preventDefault();
      state.selectedTextId=hit.item.id;
      const layout=textLayoutState(hit.item.id,hit.item.align||'left');
      canvas.setPointerCapture?.(event.pointerId);
      state.textPointer={
        id:event.pointerId,
        textId:hit.item.id,
        mode:onHandle&&selected?.id===hit.item.id?'resize':'move',
        startX:point.x,startY:point.y,start:{...layout},
        baseW:Math.max(24,hit.bounds.w),baseH:Math.max(18,hit.bounds.h),scale:fit.scale
      };
      syncTextEditUi();scheduleRender();
    });
    canvas.addEventListener('pointermove',event=>{
      const drag=state.textPointer;
      if(!drag||drag.id!==event.pointerId)return;
      const point=canvasPoint(event);if(!point)return;event.preventDefault();
      const dx=point.x-drag.startX,dy=point.y-drag.startY;
      const layout=textLayoutState(drag.textId);
      if(drag.mode==='move'){
        const spec=currentSpec();
        layout.dx=clamp(drag.start.dx+dx/drag.scale,-spec.workW,spec.workW,0);
        layout.dy=clamp(drag.start.dy+dy/drag.scale,-spec.workH,spec.workH,0);
      }else{
        layout.widthScale=clamp(drag.start.widthScale*(1+dx/drag.baseW),.25,2.5,1);
        layout.fontScale=clamp(drag.start.fontScale*(1+dy/drag.baseH),.35,3,1);
      }
      saveLocal();syncTextEditUi();scheduleRender();
    });
    const finish=event=>{
      if(state.textPointer&&(!event||state.textPointer.id===event.pointerId)){
        state.textPointer=null;saveLocal();syncTextEditUi();scheduleRender();
      }
    };
    canvas.addEventListener('pointerup',finish);
    canvas.addEventListener('pointercancel',finish);
  }

  function resetSelectedTextLayout(){
    if(!state.selectedTextId)return;
    const item=textLayout(currentSpec(),1).find(entry=>entry.id===state.selectedTextId);
    state.textLayouts[state.selectedTextId]={dx:0,dy:0,widthScale:1,fontScale:1,align:item?.rotate||item?.vertical?'center':'left'};
    saveLocal();syncTextEditUi();scheduleRender();
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
      const prompt=String($('stylePrompt')?.value||presetPrompt()).trim();
      const designGuardrails=[
        'Art direction: contemporary editorial publication design; polished, restrained, confident, and print-focused.',
        'Use generous negative space, a disciplined grid, controlled contrast, and a limited cohesive color system.',
        'Do not create a visible center spine strip, seam, fold, vertical band, or color break. The artwork must flow continuously through the exact spine area; the application will overlay the exact spine guides and text later.',
        'Avoid outdated public brochure aesthetics, ribbon waves, glossy corporate swooshes, generic stock templates, bevels, lens flares, excessive glow, busy gradients, clip-art, pseudo-3D decoration, and random decorative icons.'
      ].join('\n');
      const data=await authFetch(AI_COVER_PATH,{
        method:'POST',
        body:JSON.stringify({
          trim_width_mm:spec.trimW,trim_height_mm:spec.trimH,spine_mm:spec.spine,wing_mm:spec.wing,bleed_mm:spec.bleed,
          preset_name:PRESETS[state.preset].name,
          style_request:prompt+'\n'+designGuardrails+'\nPreferred dominant color: '+($('primaryColor')?.value||'#315c8c')+'.',
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

  async function buildExportCanvas() {
    const spec=currentSpec(),ppm=EXPORT_DPI/25.4,w=Math.round(spec.workW*ppm),h=Math.round(spec.workH*ppm),pixels=w*h;
    if(pixels>MAX_EXPORT_PIXELS)throw Object.assign(new Error('현재 규격은 '+(pixels/1e6).toFixed(1)+'MP로 300dpi 저장 한도를 초과합니다.'),{code:'EXPORT_PIXEL_LIMIT'});
    await document.fonts?.ready;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
    ctx.drawImage(state.background,0,0,w,h);
    drawLogo(ctx,spec,ppm);
    const color=$('textColor')?.value||'#ffffff';
    textLayout(spec,ppm).forEach(item=>drawTextItem(ctx,item,color,item.fontPt*EXPORT_DPI/72));
    if($('cropMarkToggle')?.checked)drawCropMarks(ctx,spec,ppm);
    return {canvas,spec,w,h};
  }

  async function exportPng(){
    if(!state.background){setStatus('먼저 AI 배경을 생성해 주세요.','생성된 배경이 있어야 300dpi로 저장할 수 있습니다.','error');return;}
    const spec=currentSpec();
    if(state.generatedSpecKey!==specKey(spec)){setStatus('규격이 변경되었습니다.','현재 규격으로 AI 배경을 다시 생성한 뒤 저장해 주세요.','error');return;}
    const button=$('exportBtn');button.disabled=true;
    setStatus('300dpi PNG를 만들고 있습니다.','배경·문구·책등·로고'+($('cropMarkToggle')?.checked?'·재단선':'')+'을 실제 인쇄 크기로 합성하는 중입니다.','busy');
    try{
      const {canvas}=await buildExportCanvas();
      const raw=await canvasBlob(canvas),png=await withPngDpi(raw,EXPORT_DPI),url=URL.createObjectURL(png),a=document.createElement('a');
      a.href=url;a.download='cover-'+spec.trimW+'x'+spec.trimH+'-spine-'+spec.spine+'mm-300dpi.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
      setStatus('PNG 저장 완료','실제 전체 펼침 규격과 300dpi 메타데이터로 이미지를 저장했습니다.','ok');
    }catch(error){setStatus('PNG 저장 실패',error.message||'파일 저장 중 오류가 발생했습니다.','error');}
    finally{button.disabled=false;}
  }

  function asciiBytes(text){return new TextEncoder().encode(text);}
  function concatBytes(parts){const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let off=0;parts.forEach(p=>{out.set(p,off);off+=p.length;});return out;}
  function pdfFromJpeg(jpeg,width,height,pageWidthPt,pageHeightPt){
    const content='q '+pageWidthPt.toFixed(3)+' 0 0 '+pageHeightPt.toFixed(3)+' 0 0 cm /Im0 Do Q';
    const bodies=[
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidthPt.toFixed(3)+' '+pageHeightPt.toFixed(3)+'] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
      null,
      '<< /Length '+asciiBytes(content).length+' >>\nstream\n'+content+'\nendstream'
    ];
    const parts=[asciiBytes('%PDF-1.4\n%AI Design Maker\n')],offsets=[0];
    let offset=parts[0].length;
    for(let i=0;i<5;i++){
      offsets[i+1]=offset;
      const head=asciiBytes((i+1)+' 0 obj\n');
      let body;
      if(i===3){
        const meta=asciiBytes('<< /Type /XObject /Subtype /Image /Width '+width+' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+' >>\nstream\n');
        body=concatBytes([meta,jpeg,asciiBytes('\nendstream')]);
      }else body=asciiBytes(bodies[i]);
      const tail=asciiBytes('\nendobj\n');
      parts.push(head,body,tail);offset+=head.length+body.length+tail.length;
    }
    const xrefOffset=offset;
    let xref='xref\n0 6\n0000000000 65535 f \n';
    for(let i=1;i<=5;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    xref+='trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xrefOffset+'\n%%EOF';
    parts.push(asciiBytes(xref));
    return new Blob(parts,{type:'application/pdf'});
  }

  async function exportPdf(){
    if(!state.background){setStatus('먼저 AI 배경을 생성해 주세요.','생성된 배경이 있어야 PDF로 저장할 수 있습니다.','error');return;}
    const spec=currentSpec();
    if(state.generatedSpecKey!==specKey(spec)){setStatus('규격이 변경되었습니다.','현재 규격으로 AI 배경을 다시 생성한 뒤 저장해 주세요.','error');return;}
    const button=$('exportBtn');button.disabled=true;
    setStatus('인쇄용 PDF를 만들고 있습니다.','300dpi 디자인을 실제 전체 펼침 크기의 1페이지 PDF로 만드는 중입니다.','busy');
    try{
      const {canvas,w,h}=await buildExportCanvas();
      const jpegBlob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PDF용 이미지 데이터를 만들지 못했습니다.')),'image/jpeg',.98));
      const jpeg=new Uint8Array(await jpegBlob.arrayBuffer());
      const pdf=pdfFromJpeg(jpeg,w,h,spec.workW*72/25.4,spec.workH*72/25.4),url=URL.createObjectURL(pdf),a=document.createElement('a');
      a.href=url;a.download='cover-'+spec.trimW+'x'+spec.trimH+'-spine-'+spec.spine+'mm-300dpi.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
      setStatus('PDF 저장 완료','전체 펼침 실제 규격의 인쇄용 PDF로 저장했습니다.','ok');
    }catch(error){setStatus('PDF 저장 실패',error.message||'PDF 저장 중 오류가 발생했습니다.','error');}
    finally{button.disabled=false;}
  }

  function exportDesign(){return $('exportFormat')?.value==='pdf'?exportPdf():exportPng();}
  function syncExportButton(){if($('exportBtn'))$('exportBtn').textContent=$('exportFormat')?.value==='pdf'?'300dpi PDF 저장':'300dpi PNG 저장';}

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
    loadLocal();setupPresetCards();syncWing();syncSpineTitle();renderCustomFields();syncPromptLanguageUi(false);syncTitleAlignButtons();syncExportButton();
    if(!$('stylePrompt').value)$('stylePrompt').value=presetPrompt();
    qa('.size-chip').forEach(button=>button.addEventListener('click',()=>{
      const [w,h]=button.dataset.size.split(',');$('trimW').value=w;$('trimH').value=h;qa('.size-chip').forEach(x=>x.classList.toggle('active',x===button));saveLocal();scheduleRender();
    }));
    const watched=['trimW','trimH','spine','bleed','safeZone','wingW','title','subtitle','dateText','department','organization','eventDate','eventPlace','hostText','organizerText','backText','contact','spineTitle','spineDate','spineCompany','spineOrientation','primaryColor','textColor','theme','stylePrompt'];
    watched.forEach(id=>$(id)?.addEventListener('input',()=>{if(id==='title')syncSpineTitle();saveLocal();updateProgress();scheduleRender();}));
    $('wingEnabled')?.addEventListener('change',()=>{syncWing();saveLocal();scheduleRender();});
    $('spineSync')?.addEventListener('change',()=>{syncSpineTitle();saveLocal();updateProgress();scheduleRender();});
    $('fillSpineBtn')?.addEventListener('click',fillSpineFromCover);
    $('manualBtn')?.addEventListener('click',event=>window.ProgramManualHomeModal?.open('ai-design-maker',event.currentTarget));
    $('aiDesignSessionSaveBtn')?.addEventListener('click',saveSessionNow);
    $('aiDesignSessionLoadBtn')?.addEventListener('click',loadSessionNow);
    qa('[data-jump]').forEach(button=>button.addEventListener('click',()=>jumpToSection(button.dataset.jump)));
    $('guideToggle')?.addEventListener('change',scheduleRender);
    $('cropMarkToggle')?.addEventListener('change',scheduleRender);
    $('generateBtn')?.addEventListener('click',generate);
    $('exportBtn')?.addEventListener('click',exportDesign);
    $('exportFormat')?.addEventListener('change',syncExportButton);
    $('addCustomFieldBtn')?.addEventListener('click',addCustomField);
    qa('input[name="promptLanguage"]').forEach(input=>input.addEventListener('change',()=>{
      const previous=state.promptLanguage;
      const oldDefaults=Object.keys(PRESETS).flatMap(id=>[PRESETS[id].prompt,PRESET_PROMPTS_KO[id]]);
      const current=String($('stylePrompt')?.value||'').trim();
      state.promptLanguage=input.value==='en'?'en':'ko';
      syncPromptLanguageUi(!current||oldDefaults.includes(current));
      saveLocal();updateProgress();
      if(previous!==state.promptLanguage)scheduleRender();
    }));
    qa('[data-title-align]').forEach(button=>button.addEventListener('click',()=>{
      state.titleLayout.align=button.dataset.titleAlign;
      state.titleSelected=true;syncTitleAlignButtons();saveLocal();scheduleRender();
    }));
    $('resetTitleLayout')?.addEventListener('click',resetTitleLayout);
    bindTitleCanvasEditing();
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
