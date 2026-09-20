/* Standalone AI Design Maker — cover first. */
'use strict';

(() => {
  if (window.__aiDesignMakerCoverV1) return;
  window.__aiDesignMakerCoverV1 = true;

  const EXPORT_DPI = 300;
  const MAX_EXPORT_PIXELS = 60_000_000;
  const STORAGE_KEY_PREFIX = 'program-studio:ai-design-maker:cover:v2';
  const LEGACY_STORAGE_KEY = 'program-studio:ai-design-maker:cover:v1';
  let STORAGE_KEY = '';
  const TEXT_LAYOUT_SCHEMA_VERSION = 5;
  const AI_COVER_PATH = '/api/preflight/ai-design-maker/cover-background';
  const AI_DIRECT_API_ORIGIN = 'https://api-7a5qpwzezq-uc.a.run.app';
  const PRESET_MIGRATION = Object.freeze({premium:'report',forum:'event'});
  const PRESET_PROMPTS_KO = Object.freeze({
    report: '세련된 현대 보고서 표지를 만들어 주세요. 밝은 바탕을 유지하되 색을 지나치게 희석하지 말고 중채도의 블루·딥티얼·코발트·슬레이트 계열 포인트를 사용해 명확한 대비를 주세요. 에디토리얼 그리드, 큰 면 분할, 얇은 프레임, 정돈된 이미지 영역, 선형 요소 등에서 한두 가지를 선택해 전문 출판물처럼 구성하세요. 도형만 반복하지 말고 타이포그래피가 올라갈 공간과 시각적 초점을 분명히 나눠 주세요.',
    admin: '업무·행정 문서에 맞는 신뢰감 있는 표지를 만들어 주세요. 화이트·라이트그레이 바탕과 네이비·블루그레이·딥티얼의 또렷한 포인트를 사용하고, 정보 문서다운 그리드와 정돈된 구획, 얇은 라인, 데이터·문서 구조를 연상시키는 시각 요소를 활용하세요. 흔한 파란 물결이나 낡은 관공서 템플릿은 피하고 현대적인 행정 보고서처럼 보여 주세요.',
    public: '공공기관·정책자료 표지를 만들어 주세요. 신뢰성과 공공성을 유지하면서 박물관·공공디자인 기관의 현대 출판물처럼 세련되게 구성하세요. 절제된 네이비·청록·블루·그린 계열과 높은 가독성, 구조적 그리드, 지역·정책·시민성을 암시하는 상징적 시각 언어를 사용하되 흔한 클립아트와 파란 물결은 피해주세요.',
    proposal: '프리미엄 사업 제안서 표지를 만들어 주세요. 화이트 또는 차콜·딥블루 기반에 코발트·에메랄드·시안 같은 선명한 포인트를 사용하고, 대각선 분할·강한 에디토리얼 프레임·레이어 깊이·정교한 이미지 크롭 등 설득력 있는 비즈니스 프레젠테이션 감각을 주세요. 너무 연하거나 밋밋하지 않게 대비를 분명히 해주세요.',
    event: '행사·포럼·컨퍼런스용 표지를 만들어 주세요. 단순 보고서 도형에서 벗어나 포스터처럼 리듬감 있고 시선을 끄는 구성을 사용하세요. 블루·퍼플·코랄·오렌지 등 세련된 중채도 포인트와 빛·움직임·공간감·사진 또는 일러스트 요소를 활용할 수 있습니다. 단, 실제 글자나 로고는 생성하지 말고 제목 영역은 확보해 주세요.',
    workbook: '문제집·워크북 표지를 만들어 주세요. 학습용으로 명확하고 정돈된 인상을 주면서 번호 배지, 섹션 탭, 노트·격자·학습 구조를 연상시키는 시각 요소를 현대적으로 사용하세요. 학생 친화적이지만 유치하지 않게, 밝은 배경과 선명한 블루·그린·오렌지 포인트로 영역 구분이 분명하게 보이도록 해주세요.',
    education: '교육자료집·사례집 표지를 만들어 주세요. 따뜻함과 전문성을 함께 살리고 책·배움·성장·협업·교실·지역공동체를 연상시키는 일러스트, 아이콘, 사진적 장면 또는 에디토리얼 구성을 활용하세요. 민트·블루·그린·오렌지 계열을 너무 흐리지 않은 중채도로 사용하고, 어린이용 만화처럼 보이지 않도록 세련된 출판물 수준을 유지해 주세요.',
    other: '특정 문서 유형에 제한되지 않는 자유 용도의 표지를 만들어 주세요. 주제·키워드와 사용자가 입력한 디자인 요청문구를 가장 우선해서 해석하고, 내용에 맞는 사진·일러스트·에디토리얼·도형·혼합형 구성을 선택하세요. 정해진 보고서 템플릿에 억지로 맞추지 말고 목적에 어울리는 전문적인 인쇄물 수준의 시각 언어와 충분한 타이포그래피 안전영역을 확보해 주세요.'
  });

  const PRESETS = Object.freeze({
    report: {
      name: '보고서',
      note: '정돈된 에디토리얼 · 전문 보고서',
      prompt: 'Create a sophisticated modern report cover with clear editorial hierarchy, stronger mid-saturation blue, teal, cobalt or slate accents, refined contrast, structured grids, clean framing and optional image-led composition. Avoid washed-out pastel styling and avoid relying only on abstract geometric patterns.',
      primaryColor: '#d9e8f1', textColor: '#164e6d'
    },
    admin: {
      name: '행정',
      note: '업무문서 · 신뢰감 있는 구조',
      prompt: 'Create a contemporary administrative publication cover with a clean institutional grid, crisp blue-gray, navy or deep-teal accents, clear information architecture and refined editorial structure. It should feel modern and authoritative, never like an old government brochure or a generic wave template.',
      primaryColor: '#d8e6ee', textColor: '#1f5067'
    },
    public: {
      name: '공공기관',
      note: '정책·기관 출판물 · 현대적 공공디자인',
      prompt: 'Create a premium public-institution or policy publication cover with civic clarity, strong editorial discipline, refined navy, teal, blue or green accents, and symbolic visual storytelling. Use contemporary institutional design rather than generic government graphics.',
      primaryColor: '#dce9e6', textColor: '#174f55'
    },
    proposal: {
      name: '제안서',
      note: '비즈니스 · 설득력 있는 프리미엄',
      prompt: 'Create a premium proposal or pitch-document cover with stronger contrast, sophisticated business styling, bold but controlled composition, layered depth, editorial image crops or architectural geometry, and confident cobalt, emerald, cyan, charcoal or deep-blue accents. Do not make it pale or timid.',
      primaryColor: '#d8e4f0', textColor: '#183f66'
    },
    event: {
      name: '행사',
      note: '포럼·컨퍼런스 · 역동적인 포스터 감각',
      prompt: 'Create a polished event, forum or conference cover with dynamic poster energy, refined mid-saturation blue, purple, coral or orange accents, expressive rhythm, light, movement, photography or illustration when appropriate. Avoid reducing the design to only thin lines and geometric patterns.',
      primaryColor: '#eadff1', textColor: '#56346f'
    },
    workbook: {
      name: '문제집',
      note: '학습용 · 명확한 구획과 집중도',
      prompt: 'Create a modern workbook or study-material cover with clear learning-oriented sections, badges, tabs, grid or notebook cues, simple educational iconography and crisp blue, green or orange accents. Keep it organized, approachable and professional rather than childish.',
      primaryColor: '#e2ead8', textColor: '#35592f'
    },
    education: {
      name: '교육자료집',
      note: '교육·사례집 · 따뜻하고 전문적으로',
      prompt: 'Create a refined educational publication cover balancing warmth and professionalism. Use learning, growth, collaboration, classroom or community motifs through editorial illustration, tasteful iconography, photography or hybrid layouts. Use medium-strength mint, blue, green or orange accents and avoid washed-out pastel or childish cartoon styling.',
      primaryColor: '#dcecdf', textColor: '#315b45'
    },
    other: {
      name: '기타',
      note: '자유 용도 · 요청문구 중심',
      prompt: 'Create a professional print cover for a custom or uncategorized purpose. Treat the user theme, keywords and custom style request as the primary art direction, and choose the most appropriate editorial, photographic, illustrated, geometric or hybrid visual language. Do not force the result into a report template; preserve clear typography-safe space and production-ready hierarchy.',
      primaryColor: '#e2e5e9', textColor: '#263746'
    }
  });

  const VISUAL_MODE_PROMPTS = Object.freeze({
    auto: 'Choose a visual approach that best fits the document type. Vary the composition between generations instead of defaulting to geometric patterns.',
    editorial: 'Use editorial art direction: strong grid, framing, asymmetric page architecture, image windows, rules, crops and premium publication spacing.',
    geometry: 'Use refined geometry or pattern as the main visual language, with controlled shapes, lines, grids or modular forms and clear hierarchy.',
    infographic: 'Use tasteful iconographic or infographic-inspired visual cues, diagram-like structures, data marks or symbolic objects without any readable text.',
    photo: 'Use a sophisticated photographic or photo-collage background approach with a believable subject, architectural, environmental, material or thematic imagery. Leave clear text-safe space and never include readable signage or text.',
    illustration: 'Use a professional editorial illustration approach with thematic scenes, objects or symbolic visual storytelling. Keep it publication-grade rather than cartoonish.',
    hybrid: 'Combine one photographic or illustrated focal element with restrained editorial geometry, framing or graphic accents. Keep the composition coherent and premium.'
  });

  const COLOR_INTENSITY_PROMPTS = Object.freeze({
    soft: 'Use a soft but still legible palette; avoid washed-out or low-contrast results.',
    refined: 'Use refined medium saturation with slightly richer color, clean contrast and sophisticated print-friendly tones. Do not make the palette faded or overly pastel.',
    vivid: 'Use noticeably clearer, more energetic color contrast while staying professional and print-safe; avoid neon.',
    premium: 'Use deeper premium tones such as navy, charcoal, deep teal, emerald or cobalt with controlled lighter counterpoints and elegant contrast.'
  });

  const MOOD_PROMPTS = Object.freeze({
    auto: 'Infer the most appropriate mood from the selected document type and semantic context.',
    trust: 'Emphasize trust, stability, clarity and institutional confidence.',
    refined: 'Emphasize elegant contemporary art direction, premium spacing and sophisticated visual restraint.',
    warm: 'Emphasize warmth, approachability, human connection and calm optimism without becoming childish.',
    dynamic: 'Emphasize movement, energy, visual rhythm and strong focal composition while preserving text readability.'
  });

  const COMPOSITION_VARIANTS = Object.freeze([
    'Use an asymmetric editorial composition with the visual focus weighted toward one corner and a quiet opposing text zone.',
    'Use a framed publication composition with a strong edge, cropped image or illustration field and generous clean interior space.',
    'Use a vertical editorial rhythm with one dominant visual column and a separate calm title field.',
    'Use a diagonal or layered composition with one strong visual movement and restrained supporting accents.',
    'Use a modular grid composition with distinct visual zones, subtle depth and a clear hierarchy rather than one repeated pattern.',
    'Use a focal-image composition with one thematic photographic or illustrated subject and minimal supporting graphics.'
  ]);

  const $ = id => document.getElementById(id);
  const qa = selector => [...document.querySelectorAll(selector)];
  const state = {
    preset: 'report',
    background: null,
    backgroundUrl: '',
    generatedSpecKey: '',
    logo: null,
    renderQueued: false,
    promptLanguage: 'ko',
    customFields: [],
    textLayouts: {},
    selectedTextId: '',
    selectedTextUiId: '',
    textPointer: null,
    shapes: [],
    selectedShapeId: '',
    selectedElements: [],
    groups: {},
    shapePointer: null,
    groupPointer: null,
    snapGuide: null,
    backgroundSource: '',
    coverMode: 'spread',
    generationQuality: 'standard',
    generationProgress: 0,
    generationProgressTimer: null,
    sizeMode: 'a4',
    galleryItems: [],
    lastGeneratedPrompt: '',
    lastGeneratedPresetName: ''
  };

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
  };
  const num = (id, fallback) => {
    const node = $(id);
    return node && String(node.value).trim() !== '' ? Number(node.value) : fallback;
  };
  const FONT_FAMILIES = new Set(['Pretendard','Noto Sans KR','Malgun Gothic','Nanum Gothic','Nanum Myeongjo','Batang']);
  const FONT_WEIGHTS = new Set([400,500,700,800,900]);
  const normalizeFontFamily = value => FONT_FAMILIES.has(String(value||'')) ? String(value) : '';
  const normalizeFontWeight = value => FONT_WEIGHTS.has(Number(value)) ? Number(value) : 0;
  const normalizeColor = value => /^#[0-9a-f]{6}$/i.test(String(value||'')) ? String(value).toLowerCase() : '';
  const normalizeCmyk = value => ({
    c:clamp(value?.c,0,100,0),m:clamp(value?.m,0,100,0),y:clamp(value?.y,0,100,0),k:clamp(value?.k,0,100,0)
  });
  const cmykToRgb = value => {
    const v=normalizeCmyk(value),c=v.c/100,m=v.m/100,y=v.y/100,k=v.k/100;
    return {r:Math.round(255*(1-c)*(1-k)),g:Math.round(255*(1-m)*(1-k)),b:Math.round(255*(1-y)*(1-k))};
  };
  const cmykToHex = value => {
    const {r,g,b}=cmykToRgb(value),hex=n=>n.toString(16).padStart(2,'0');
    return '#'+hex(r)+hex(g)+hex(b);
  };
  const hexToCmyk = value => {
    const hex=normalizeColor(value)||'#000000',r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
    const k=1-Math.max(r,g,b);
    if(k>=.999)return {c:0,m:0,y:0,k:100};
    return normalizeCmyk({c:(1-r-k)/(1-k)*100,m:(1-g-k)/(1-k)*100,y:(1-b-k)/(1-k)*100,k:k*100});
  };
  const cmykCss = value => {const {r,g,b}=cmykToRgb(value);return 'rgb('+r+','+g+','+b+')';};
  const CMYK_GROUPS = Object.freeze({
    primaryColor:{prefix:'primary',target:'primaryColor'},
    textColor:{prefix:'text',target:'textColor'},
    selectedText:{prefix:'selectedText'},
    shapeFill:{prefix:'shapeFill'},
    shapeStroke:{prefix:'shapeStroke'}
  });
  function setCmykInputs(group,value){
    const meta=CMYK_GROUPS[group];if(!meta)return;
    const v=normalizeCmyk(value),hex=cmykToHex(v);
    ['C','M','Y','K'].forEach(key=>{const node=$(meta.prefix+key);if(node)node.value=Math.round(v[key.toLowerCase()]);});
    const picker=$(meta.prefix+'ColorPicker');if(picker&&document.activeElement!==picker)picker.value=hex;
  }
  function readCmykInputs(group,fallback={c:0,m:0,y:0,k:100}){
    const meta=CMYK_GROUPS[group];if(!meta)return normalizeCmyk(fallback);
    return normalizeCmyk({
      c:$(meta.prefix+'C')?.value,m:$(meta.prefix+'M')?.value,y:$(meta.prefix+'Y')?.value,k:$(meta.prefix+'K')?.value
    });
  }
  function syncGlobalCmykFromHex(target){
    const group=target==='primaryColor'?'primaryColor':'textColor';
    const node=$(target);if(!node)return;
    setCmykInputs(group,hexToCmyk(node.value));
  }
  function applyGlobalCmyk(group){
    const meta=CMYK_GROUPS[group],node=meta?.target?$(meta.target):null;if(!meta||!node)return;
    const value=readCmykInputs(group,hexToCmyk(node.value));
    node.value=cmykToHex(value);setCmykInputs(group,value);saveLocal();scheduleRender();
  }
  function applyColorChoice(group,hex){
    const value=hexToCmyk(hex),meta=CMYK_GROUPS[group];if(!meta)return;
    if(meta.target){
      const node=$(meta.target);if(!node)return;node.value=cmykToHex(value);setCmykInputs(group,value);saveLocal();scheduleRender();return;
    }
    if(group==='selectedText'){
      if(!state.selectedTextId)return;const layout=textLayoutState(state.selectedTextId);
      layout.cmyk=value;layout.color=cmykToHex(value);setCmykInputs(group,value);saveLocal();scheduleRender();return;
    }
    const shape=selectedShape();if(!shape)return;
    if(group==='shapeFill')shape.fillCmyk=value;
    else if(group==='shapeStroke')shape.strokeCmyk=value;
    else return;
    setCmykInputs(group,value);saveLocal();scheduleRender();
  }
  const selectionKey=(kind,id)=>kind+':'+String(id||'');
  const parseSelectionKey=key=>String(key||'').startsWith('text:')
    ?{kind:'text',id:String(key).slice(5)}
    :String(key||'').startsWith('shape:')?{kind:'shape',id:String(key).slice(6)}:null;
  function selectionCount(){return Array.isArray(state.selectedElements)?state.selectedElements.length:0;}
  function selectionHas(kind,id){return state.selectedElements.includes(selectionKey(kind,id));}
  function elementKeyExists(key){
    const parsed=parseSelectionKey(key);if(!parsed)return false;
    if(parsed.kind==='shape')return state.shapes.some(item=>item.id===parsed.id);
    if(DIRECT_TEXT_SOURCE_IDS.has(parsed.id))return true;
    if(parsed.id.startsWith('custom:'))return state.customFields.some(item=>'custom:'+item.id===parsed.id);
    return false;
  }
  function cleanGroups(){
    const next={};
    Object.entries(state.groups||{}).forEach(([groupId,keys])=>{
      const valid=[...new Set((Array.isArray(keys)?keys:[]).filter(elementKeyExists))];
      if(valid.length>=2)next[groupId]=valid;
    });
    state.groups=next;
  }
  function groupIdForKey(key){
    for(const [groupId,keys] of Object.entries(state.groups||{}))if(keys.includes(key))return groupId;
    return '';
  }
  function groupMembersForKey(key){
    const groupId=groupIdForKey(key);return groupId?[...(state.groups[groupId]||[])]:[key];
  }
  function selectedGroupIds(){
    const ids=new Set();
    state.selectedElements.forEach(key=>{const id=groupIdForKey(key);if(id)ids.add(id);});
    return [...ids];
  }
  function exactSelectedGroupId(){
    if(selectionCount()<2)return '';
    const selected=new Set(state.selectedElements);
    for(const [groupId,keys] of Object.entries(state.groups||{})){
      if(keys.length===selected.size&&keys.every(key=>selected.has(key)))return groupId;
    }
    return '';
  }
  function removeKeyFromGroups(key){
    Object.entries(state.groups||{}).forEach(([groupId,keys])=>{
      if(!keys.includes(key))return;
      const next=keys.filter(item=>item!==key);
      if(next.length>=2)state.groups[groupId]=next;else delete state.groups[groupId];
    });
  }
  function clearSelection(){
    state.selectedElements=[];state.selectedTextId='';state.selectedShapeId='';state.selectedTextUiId='';state.textPointer=null;state.shapePointer=null;state.groupPointer=null;
  }
  function syncPrimarySelection(preferredKey=''){
    const keys=state.selectedElements;
    const key=keys.includes(preferredKey)?preferredKey:(keys[keys.length-1]||'');
    const parsed=parseSelectionKey(key);
    state.selectedTextId=parsed?.kind==='text'?parsed.id:'';
    state.selectedShapeId=parsed?.kind==='shape'?parsed.id:'';
    state.selectedTextUiId='';
  }
  function setSingleSelection(kind,id){
    const key=selectionKey(kind,id),keys=groupMembersForKey(key).filter(elementKeyExists);
    state.selectedElements=keys.length?keys:[key];syncPrimarySelection(key);
  }
  function toggleSelection(kind,id){
    const key=selectionKey(kind,id),keys=groupMembersForKey(key).filter(elementKeyExists);
    const allSelected=keys.length&&keys.every(item=>state.selectedElements.includes(item));
    if(allSelected)state.selectedElements=state.selectedElements.filter(item=>!keys.includes(item));
    else state.selectedElements=[...new Set([...state.selectedElements,...keys])];
    syncPrimarySelection(allSelected?'':key);
  }
  function groupSelectionKeys(keys){
    const selected=[...new Set((keys||[]).filter(elementKeyExists))];if(selected.length<2)return '';
    Object.entries(state.groups||{}).forEach(([groupId,members])=>{
      const remaining=members.filter(key=>!selected.includes(key));
      if(remaining.length>=2)state.groups[groupId]=remaining;else delete state.groups[groupId];
    });
    const groupId='group-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);
    state.groups[groupId]=selected;state.selectedElements=[...selected];syncPrimarySelection(selected[selected.length-1]);return groupId;
  }
  function groupSelectedElements(){
    if(selectionCount()<2)return;
    groupSelectionKeys(state.selectedElements);saveLocal();syncTextEditUi();scheduleRender();
  }
  function ungroupSelectedElements(){
    const ids=selectedGroupIds();if(!ids.length)return;
    ids.forEach(id=>delete state.groups[id]);saveLocal();syncTextEditUi();scheduleRender();
  }
  const fontStack = family => {
    const name=normalizeFontFamily(family)||'Pretendard';
    if(name==='Pretendard')return 'Pretendard, "Noto Sans KR", "Malgun Gothic", Arial, sans-serif';
    if(name==='Noto Sans KR')return '"Noto Sans KR", Pretendard, "Malgun Gothic", Arial, sans-serif';
    if(name==='Malgun Gothic')return '"Malgun Gothic", Pretendard, Arial, sans-serif';
    if(name==='Nanum Gothic')return '"Nanum Gothic", Pretendard, "Malgun Gothic", Arial, sans-serif';
    if(name==='Nanum Myeongjo')return '"Nanum Myeongjo", Batang, serif';
    return 'Batang, "Times New Roman", serif';
  };


  function currentSpec() {
    const coverMode=state.coverMode==='front'?'front':'spread';
    const trimW = clamp(num('trimW', 210), 50, 1000, 210);
    const trimH = clamp(num('trimH', 297), 50, 1000, 297);
    const bleed = clamp(num('bleed', 3), 0, 20, 3);
    const safe = clamp(num('safeZone', 10), 0, 80, 10);
    const spine = coverMode==='front' ? 0 : clamp(num('spine', 10), 0, 100, 10);
    const wing = coverMode==='front' ? 0 : ($('wingEnabled')?.checked ? clamp(num('wingW', 70), 20, 300, 70) : 0);
    return {
      coverMode, trimW, trimH, spine, bleed, safe, wing,
      workW: coverMode==='front' ? trimW + bleed * 2 : trimW * 2 + spine + wing * 2 + bleed * 2,
      workH: trimH + bleed * 2
    };
  }

  function specKey(spec = currentSpec()) {
    return [spec.coverMode,spec.trimW,spec.trimH,spec.spine,spec.bleed,spec.wing].map(v => typeof v==='number'?Number(v).toFixed(2):v).join('|');
  }

  function readText() {
    return {
      title: $('title')?.value || '',
      backText: $('backText')?.value || '',
      spineTop: $('spineTop')?.value || '',
      spineMiddle: $('spineMiddle')?.value || '',
      spineBottom: $('spineBottom')?.value || '',
      spineTopPlacement: $('spineTopPlacement')?.value === 'free' ? 'free' : 'auto',
      spineMiddlePlacement: $('spineMiddlePlacement')?.value === 'free' ? 'free' : 'auto',
      spineBottomPlacement: $('spineBottomPlacement')?.value === 'free' ? 'free' : 'auto',
      spineOrientation: $('spineOrientation')?.value || 'rotate-up',
      customFields: state.customFields.filter(item => String(item.value || '').trim())
    };
  }

  function serializableState() {
    const ids = ['trimW','trimH','spine','bleed','safeZone','wingW','title','backText','spineTop','spineMiddle','spineBottom','spineTopPlacement','spineMiddlePlacement','spineBottomPlacement','spineOrientation','visualMode','colorIntensity','designMood','primaryColor','textColor','theme','stylePrompt'];
    const data = {
      preset: state.preset,
      wingEnabled: Boolean($('wingEnabled')?.checked),
      spineSync: Boolean($('spineSync')?.checked),
      promptLanguage: state.promptLanguage,
      customFields: state.customFields,
      textLayouts: state.textLayouts,
      shapes: state.shapes,
      groups: state.groups,
      coverMode: state.coverMode,
      generationQuality: state.generationQuality,
      sizeMode: state.sizeMode,
      textLayoutSchemaVersion: TEXT_LAYOUT_SCHEMA_VERSION
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
      if (!String($('spineMiddle')?.value || '').trim() && String(data.spineTitle || '').trim() && $('spineMiddle')) {
        $('spineMiddle').value = String(data.spineTitle).slice(0,180);
      }
      const restoredPreset=PRESET_MIGRATION[data.preset]||data.preset;
      if (restoredPreset && PRESETS[restoredPreset]) state.preset = restoredPreset;
      if (data.coverMode === 'front' || data.coverMode === 'spread') state.coverMode = data.coverMode;
      if (['a4','b5','a5','custom'].includes(data.sizeMode)) state.sizeMode = data.sizeMode;
      else {
        const w=Number(data.trimW),h=Number(data.trimH);
        state.sizeMode = w===210&&h===297?'a4':w===182&&h===257?'b5':w===148&&h===210?'a5':'custom';
      }
      if (data.generationQuality === 'high' || data.generationQuality === 'standard') state.generationQuality = data.generationQuality;
      if (data.promptLanguage === 'en' || data.promptLanguage === 'ko') state.promptLanguage = data.promptLanguage;
      if (Array.isArray(data.customFields)) state.customFields = data.customFields.slice(0, 12).map(item => {
        const legacyLabel=String(item?.label || '').trim();
        const legacyValue=String(item?.value || '').trim();
        return {
          id: String(item?.id || ('custom-'+Math.random().toString(36).slice(2))),
          surface: item?.surface === 'back' ? 'back' : 'front',
          value: (legacyLabel && legacyValue ? legacyLabel+' '+legacyValue : (legacyValue || legacyLabel)).slice(0,700)
        };
      });
      const legacyTextLayout = Number(data.textLayoutSchemaVersion || 0) < TEXT_LAYOUT_SCHEMA_VERSION;
      const normalizeTextLayout = (layout, fallbackAlign = 'left') => {
        const rawFontSize=Number(layout?.fontSizePt);
        const hasCustomFontSize=Number.isFinite(rawFontSize) && rawFontSize > 0 && !(legacyTextLayout && rawFontSize <= 4);
        const normalized={
          dx: clamp(layout?.dx, -2000, 2000, 0),
          dy: clamp(layout?.dy, -2000, 2000, 0),
          widthScale: clamp(layout?.widthScale, .25, 2.5, 1),
          fontScale: clamp(layout?.fontScale, .35, 3, 1),
          align: ['left','center','right'].includes(layout?.align) ? layout.align : fallbackAlign,
          boxAlign: ['left','center','right'].includes(layout?.boxAlign) ? layout.boxAlign : '',
          fontFamily: normalizeFontFamily(layout?.fontFamily),
          fontSizePt: hasCustomFontSize ? clamp(rawFontSize,4,160,0) : 0,
          fontWeight: normalizeFontWeight(layout?.fontWeight),
          lineHeight: clamp(layout?.lineHeight,.8,2.2,1.2),
          color: normalizeColor(layout?.color),
          cmyk: layout?.cmyk ? normalizeCmyk(layout.cmyk) : null
        };
        if(Object.prototype.hasOwnProperty.call(layout||{},'text'))normalized.text=String(layout.text||'').slice(0,700);
        return normalized;
      };
      if (data.textLayouts && typeof data.textLayouts === 'object') {
        Object.entries(data.textLayouts).forEach(([id,layout]) => {
          state.textLayouts[String(id)] = normalizeTextLayout(layout);
        });
      }
      if (state.textLayouts.spineTitle && !state.textLayouts.spineMiddle) {
        state.textLayouts.spineMiddle = state.textLayouts.spineTitle;
        delete state.textLayouts.spineTitle;
      }
      if (data.titleLayout && typeof data.titleLayout === 'object' && !state.textLayouts.title) {
        state.textLayouts.title = normalizeTextLayout(data.titleLayout);
      }
      if(Array.isArray(data.shapes)){
        state.shapes=data.shapes.slice(0,80).map((item,index)=>normalizeShape(item,index)).filter(Boolean);
      }
      if(data.groups&&typeof data.groups==='object'&&!Array.isArray(data.groups)){
        state.groups={};
        Object.entries(data.groups).slice(0,80).forEach(([groupId,keys])=>{
          if(!Array.isArray(keys))return;
          const clean=[...new Set(keys.map(String).filter(key=>key.startsWith('text:')||key.startsWith('shape:'))) ].slice(0,80);
          if(clean.length>=2)state.groups[String(groupId)]=clean;
        });
      }
      cleanGroups();
    } catch (_) {}
  }

  function saveSessionNow() {
    saveLocal();
    setStatus(
      '편집 설정을 저장했습니다.',
      '규격·문구·배치 설정은 이 브라우저에 저장됩니다. AI 배경 이미지와 완성 디자인은 상단의 “현재 디자인 저장”으로 디자인 보관함에 별도 저장해 주세요.',
      'ok'
    );
  }

  function loadSessionNow() {
    loadLocal();
    setupPresetCards();
    syncCoverMode();
    syncSizeMode();
    syncGenerationQuality();
    syncSpineTitle();
    renderCustomFields();
    syncPromptLanguageUi(false);
    syncTextEditUi();
    updateGeometry();
    updateProgress();
    scheduleRender();
    setStatus(
      '저장한 편집 설정을 불러왔습니다.',
      '브라우저에 저장된 규격·문구·배치 설정을 다시 적용했습니다. AI 배경 이미지는 디자인 보관함에서 확인해 주세요.',
      'ok'
    );
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

  function setGenerationProgress(value) {
    state.generationProgress=clamp(value,0,100,0);
    const root=$('generationProgress'),bar=$('generationProgressBar'),label=$('generationProgressText');
    if(root)root.hidden=false;
    if(label){label.hidden=false;label.textContent=Math.round(state.generationProgress)+'%';}
    if(bar)bar.style.width=state.generationProgress+'%';
  }

  function startGenerationProgress() {
    if(state.generationProgressTimer)clearInterval(state.generationProgressTimer);
    setGenerationProgress(4);
    state.generationProgressTimer=setInterval(()=>{
      const p=state.generationProgress;
      const step=p<25?4:p<55?3:p<78?2:p<90?1:.35;
      setGenerationProgress(Math.min(94,p+step));
    },650);
  }

  function finishGenerationProgress(success=true) {
    if(state.generationProgressTimer){clearInterval(state.generationProgressTimer);state.generationProgressTimer=null;}
    if(success){
      setGenerationProgress(100);
      setTimeout(()=>{
        const root=$('generationProgress'),label=$('generationProgressText');
        if(root)root.hidden=true;
        if(label)label.hidden=true;
      },900);
    }else{
      const root=$('generationProgress'),label=$('generationProgressText'),bar=$('generationProgressBar');
      if(root)root.hidden=true;
      if(label)label.hidden=true;
      if(bar)bar.style.width='0%';
      state.generationProgress=0;
    }
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
    const roots={front:$('frontExtraFields'),back:$('backExtraFields')};
    Object.values(roots).forEach(root=>root?.replaceChildren());
    ['front','back'].forEach(surface=>{
      const root=roots[surface];if(!root)return;
      const items=state.customFields.filter(item=>item.surface===surface);
      if(!items.length){
        const empty=document.createElement('div');
        empty.className='custom-field-empty';
        empty.textContent='추가 문구 없음';
        root.appendChild(empty);
        return;
      }
      items.forEach((item,index)=>{
        const row=document.createElement('div');
        row.className='extra-copy-row';
        row.dataset.customId=item.id;

        const value=document.createElement('textarea');
        value.maxLength=700;value.rows=2;
        value.placeholder=(surface==='front'?'앞표지':'뒤표지')+' 추가 문구 '+(index+1);
        value.value=item.value||'';
        value.dataset.customValue='1';
        value.setAttribute('aria-label',(surface==='front'?'앞표지':'뒤표지')+' 추가 문구');

        const remove=document.createElement('button');
        remove.type='button';remove.className='custom-field-remove';remove.textContent='×';
        remove.title='문구 삭제';remove.setAttribute('aria-label','추가 문구 삭제');

        value.addEventListener('input',()=>{
          item.value=value.value;
          const textId='custom:'+item.id;
          const layout=state.textLayouts[textId];
          if(layout&&Object.prototype.hasOwnProperty.call(layout,'text'))delete layout.text;
          if(state.selectedTextId===textId)state.selectedTextUiId='';
          saveLocal();syncTextEditUi();scheduleRender();
        });
        remove.addEventListener('click',()=>{
          const textId='custom:'+item.id;
          state.customFields=state.customFields.filter(entry=>entry.id!==item.id);
          delete state.textLayouts[textId];
          const removedKey=selectionKey('text',textId);
          state.selectedElements=state.selectedElements.filter(key=>key!==removedKey);removeKeyFromGroups(removedKey);
          if(state.selectedTextId===textId)syncPrimarySelection();
          renderCustomFields();syncTextEditUi();saveLocal();scheduleRender();
        });
        row.append(value,remove);
        root.appendChild(row);
      });
    });
  }

  function addCustomField(surface='front') {
    if (state.customFields.length >= 12) {
      setStatus('추가 문구는 최대 12개까지 가능합니다.','필요 없는 문구를 삭제한 뒤 다시 추가해 주세요.','error');
      return;
    }
    if(surface==='back'&&state.coverMode==='front')return;
    const item={id:'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),surface:surface==='back'?'back':'front',value:''};
    state.customFields.push(item);
    renderCustomFields();saveLocal();scheduleRender();
    requestAnimationFrame(()=>document.querySelector('[data-custom-id="'+item.id+'"] textarea')?.focus());
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
    if(replacePrompt){syncGlobalCmykFromHex('primaryColor');syncGlobalCmykFromHex('textColor');}
    saveLocal();
    scheduleRender();
  }

  function syncWing() {
    const enabled = Boolean($('wingEnabled')?.checked);
    if ($('wingField')) $('wingField').hidden = !enabled;
  }

  function syncCoverMode() {
    const selected=document.querySelector('input[name="coverMode"]:checked');
    if(selected)state.coverMode=selected.value==='front'?'front':'spread';
    qa('input[name="coverMode"]').forEach(input=>{input.checked=input.value===state.coverMode;});
    document.documentElement.dataset.coverMode=state.coverMode;
    renderCustomFields();
    const front=state.coverMode==='front';
    if($('coverModeHeading'))$('coverModeHeading').textContent=front?'앞표지 단면 제작':'표지 전체 펼침 제작';
    if($('coverModeDescription'))$('coverModeDescription').textContent=front
      ?'앞표지 한 면만 실제 인쇄 규격으로 디자인합니다. 기본 문구 1개와 필요한 추가 문구를 자유롭게 배치하세요.'
      :'앞표지·책등·뒤표지를 한 번에 제작합니다. 규격 → 문구 → 스타일 순서로 입력하세요.';
    if($('previewModeTitle'))$('previewModeTitle').textContent=front?'앞표지 미리보기':'전체 펼침 미리보기';
    if($('backgroundModeHint'))$('backgroundModeHint').textContent=front
      ?'직접 만든 앞표지 이미지를 불러오면 도련 포함 바깥 적색선 전체 영역을 꽉 채워 배치합니다.'
      :'직접 만든 전체 펼침 표지를 불러오면 바깥 적색선 전체 영역을 꽉 채워 배치합니다. 그 위에 문구를 자유롭게 편집할 수 있습니다.';
    syncWing();
    updateGeometry();
    syncTextEditUi();
    scheduleRender();
  }

  function syncSizeMode() {
    qa('.size-chip').forEach(button=>button.classList.toggle('active',button.dataset.sizeId===state.sizeMode));
    if($('customSizeFields'))$('customSizeFields').hidden=state.sizeMode!=='custom';
  }

  function syncGenerationQuality() {
    qa('input[name="generationQuality"]').forEach(input=>{
      input.checked=input.value===state.generationQuality;
    });
  }

  function syncSpineTitle() {
    if ($('spineSync')?.checked && $('spineMiddle')) {
      $('spineMiddle').value = String($('title')?.value || '').split(/\n/)[0].slice(0,180);
      const middleLayout=state.textLayouts.spineMiddle;
      if(middleLayout&&Object.prototype.hasOwnProperty.call(middleLayout,'text'))delete middleLayout.text;
    }
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
    setState('copyState',hasTitle,'완료','앞표지 필요');
    setState('styleState',hasStyle,'완료','스타일 필요');
    const generated=Boolean(state.background&&state.generatedSpecKey===specKey(spec));
    const stale=Boolean(state.background&&!generated);
    const badge=$('generationState');
    if(badge){
      badge.textContent=generated?(state.backgroundSource==='upload'?'직접 표지 적용':'AI 배경 완료'):stale?'규격 변경 · 배경 재적용':'생성 전';
      badge.classList.toggle('ready',generated);
      badge.classList.toggle('stale',stale);
    }
    if($('saveGalleryBtn'))$('saveGalleryBtn').disabled=!generated;
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
      box.textContent = '책등 4~7.9mm: 상·중·하 문구가 표시되지만 폭이 좁아 작은 글자 크기가 적용될 수 있습니다.';
    } else {
      box.classList.add('ok');
      box.textContent = '책등 8mm 이상: 상·중·하 문구를 각각 자동정렬하거나 자유배치할 수 있습니다.';
    }
  }

  function updateGeometry() {
    const spec = currentSpec();
    const wing = spec.wing ? ' · 날개 '+spec.wing.toFixed(1)+'mm×2' : '';
    const text = spec.coverMode==='front'
      ? '앞표지 '+spec.trimW.toFixed(1)+'×'+spec.trimH.toFixed(1)+'mm · 도련 '+spec.bleed.toFixed(1)+'mm · 작업 '+spec.workW.toFixed(1)+'×'+spec.workH.toFixed(1)+'mm'
      : '완성 '+spec.trimW.toFixed(1)+'×'+spec.trimH.toFixed(1)+'mm · 책등 '+spec.spine.toFixed(1)+'mm · 도련 '+spec.bleed.toFixed(1)+'mm'+wing+' · 전체 '+spec.workW.toFixed(1)+'×'+spec.workH.toFixed(1)+'mm';
    const compact = spec.coverMode==='front'
      ? spec.trimW.toFixed(1)+'×'+spec.trimH.toFixed(1)+'mm · 작업 '+spec.workW.toFixed(1)+'×'+spec.workH.toFixed(1)+'mm'
      : spec.trimW.toFixed(1)+'×'+spec.trimH.toFixed(1)+'mm · 책등 '+spec.spine.toFixed(1)+'mm · 전체 '+spec.workW.toFixed(1)+'×'+spec.workH.toFixed(1)+'mm';
    if ($('geometryHint')) $('geometryHint').textContent = text;
    if ($('geometrySummary')) $('geometrySummary').textContent = compact;
    if(spec.coverMode==='spread')updateSpinePolicy();
    updateProgress();
    const stale = Boolean(state.background && state.generatedSpecKey && state.generatedSpecKey !== specKey(spec));
    if ($('exportBtn')) $('exportBtn').disabled = !state.background || stale;
    if (stale) setStatus('규격이 변경되었습니다.','현재 규격에 맞게 AI 배경을 다시 생성하거나 직접 만든 표지 이미지를 다시 불러와 주세요.','busy');
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
    const b=spec.bleed*scale, tw=spec.trimW*scale, th=spec.trimH*scale, safe=spec.safe*scale;
    if(spec.bleed>0) rect(ctx,.5,.5,spec.workW*scale-1,spec.workH*scale-1,'#db2777',[7,5]);
    if(spec.coverMode==='front'){
      const frontX=b;
      rect(ctx,frontX,b,tw,th,'#2563eb',[6,4]);
      if(safe>0)rect(ctx,frontX+safe,b+safe,Math.max(0,tw-safe*2),Math.max(0,th-safe*2),'#16a34a');
      zone(ctx,'앞표지',frontX,b,tw,th);
      return;
    }
    const wing=spec.wing*scale,sw=spec.spine*scale;
    const backX=b+wing, spineX=backX+tw, frontX=spineX+sw, frontWingX=frontX+tw;
    rect(ctx,backX,b,tw,th,'#2563eb',[6,4]);rect(ctx,frontX,b,tw,th,'#2563eb',[6,4]);
    if(safe>0){rect(ctx,backX+safe,b+safe,Math.max(0,tw-safe*2),Math.max(0,th-safe*2),'#16a34a');rect(ctx,frontX+safe,b+safe,Math.max(0,tw-safe*2),Math.max(0,th-safe*2),'#16a34a');}
    if(sw>0){
      line(ctx,spineX,b,spineX,b+th,'rgba(37,99,235,.68)',[6,4]);
      line(ctx,frontX,b,frontX,b+th,'rgba(37,99,235,.68)',[6,4]);
      const spineInset=Math.min(sw*.18,1.5*scale);
      if(sw>spineInset*2+2){
        line(ctx,spineX+spineInset,b,spineX+spineInset,b+th,'rgba(22,163,74,.52)',[2,3]);
        line(ctx,frontX-spineInset,b,frontX-spineInset,b+th,'rgba(22,163,74,.52)',[2,3]);
      }
      zone(ctx,'책등 '+spec.spine.toFixed(1)+'mm',spineX,b,sw,th);
    }
    if(wing>0){line(ctx,backX,b,backX,b+th,'#f59e0b',[8,4]);line(ctx,frontWingX,b,frontWingX,b+th,'#f59e0b',[8,4]);zone(ctx,'뒷날개',b,b,wing,th);zone(ctx,'앞날개',frontWingX,b,wing,th);}
    zone(ctx,'뒤표지',backX,b,tw,th);zone(ctx,'앞표지',frontX,b,tw,th);
  }

  function titlePt(text,trimW) {
    let pt=trimW<140?36:50;
    const n=[...String(text||'')].length;
    if(n>18)pt-=5;if(n>30)pt-=6;if(n>44)pt-=5;
    return clamp(pt,26,52,38);
  }
  function spinePt(spine,text) {
    let pt=clamp(spine*.58+4.2,7.5,12.5,9);
    const n=[...String(text||'')].length;
    if(n>18)pt-=1;if(n>28)pt-=1.2;if(n>40)pt-=1;
    return clamp(pt,7,12.5,8);
  }

  function textLayoutState(id, fallbackAlign = 'left') {
    const current=state.textLayouts[id] || {};
    const rawFontSize=Number(current.fontSizePt);
    const normalized={
      dx:clamp(current.dx,-2000,2000,0),
      dy:clamp(current.dy,-2000,2000,0),
      widthScale:clamp(current.widthScale,.25,2.5,1),
      fontScale:clamp(current.fontScale,.35,3,1),
      align:['left','center','right'].includes(current.align)?current.align:fallbackAlign,
      boxAlign:['left','center','right'].includes(current.boxAlign)?current.boxAlign:'',
      fontFamily:normalizeFontFamily(current.fontFamily),
      fontSizePt:Number.isFinite(rawFontSize)&&rawFontSize>0?clamp(rawFontSize,4,160,0):0,
      fontWeight:normalizeFontWeight(current.fontWeight),
      lineHeight:clamp(current.lineHeight,.8,2.2,1.2),
      color:normalizeColor(current.color),
      cmyk:current.cmyk?normalizeCmyk(current.cmyk):null
    };
    if(Object.prototype.hasOwnProperty.call(current,'text'))normalized.text=String(current.text||'').slice(0,700);
    state.textLayouts[id]=normalized;
    return normalized;
  }

  const SPINE_TEXT_IDS = new Set(['spineTop','spineMiddle','spineBottom']);

  function spinePlacementControlId(id){
    return SPINE_TEXT_IDS.has(id) ? id+'Placement' : '';
  }

  function spinePlacementMode(id){
    const controlId=spinePlacementControlId(id);
    return controlId&&$(controlId)?.value==='free'?'free':'auto';
  }

  function setSpinePlacementMode(id,mode){
    const controlId=spinePlacementControlId(id);
    const control=controlId?$(controlId):null;
    if(control)control.value=mode==='free'?'free':'auto';
  }

  function textItemLabel(id) {
    const fixed={
      title:'앞표지 문구',
      backText:'뒤표지 문구',
      spineTop:'책등 · 상 문구',
      spineMiddle:'책등 · 중 문구',
      spineBottom:'책등 · 하 문구'
    };
    if(fixed[id])return fixed[id];
    if(String(id||'').startsWith('custom:')){
      const customId=String(id).slice(7);
      const item=state.customFields.find(entry=>entry.id===customId);
      return (item?.surface==='back'?'뒤표지':'앞표지')+' · 추가 문구';
    }
    return '문구';
  }
  const DIRECT_TEXT_SOURCE_IDS = new Set(['title','backText','spineTop','spineMiddle','spineBottom']);

  function selectedTextItem(){
    if(!state.selectedTextId)return null;
    return textLayout(currentSpec(),1).find(item=>item.id===state.selectedTextId)||null;
  }

  function setSelectedTextContent(value){
    const id=state.selectedTextId;if(!id)return;
    const layout=textLayoutState(id);
    layout.text=String(value||'').slice(0,700);
    if(DIRECT_TEXT_SOURCE_IDS.has(id)&&$(id)){
      $(id).value=layout.text;
      if(id==='spineMiddle'&&$('spineSync')?.checked)$('spineSync').checked=false;
      if(id==='title'){
        syncSpineTitle();
        if($('spineSync')?.checked){
          const spineLayout=state.textLayouts.spineMiddle;
          if(spineLayout&&Object.prototype.hasOwnProperty.call(spineLayout,'text'))delete spineLayout.text;
        }
      }
    }else if(String(id).startsWith('custom:')){
      const customId=String(id).slice(7);
      const custom=state.customFields.find(entry=>entry.id===customId);
      if(custom){
        custom.value=layout.text;
        const input=document.querySelector('[data-custom-id="'+customId+'"] textarea');
        if(input&&document.activeElement!==input)input.value=layout.text;
      }
    }
    saveLocal();updateProgress();scheduleRender();
  }

  function clearTextOverrideForSource(id){
    const layout=state.textLayouts[id];
    if(layout&&Object.prototype.hasOwnProperty.call(layout,'text'))delete layout.text;
    if(state.selectedTextId===id)state.selectedTextUiId='';
  }


  function applyTextEdit(item,spec,scale) {
    if(!item.id)return item;
    const edit=textLayoutState(item.id,item.align||'left');
    if(Object.prototype.hasOwnProperty.call(edit,'text'))item.text=edit.text;
    const autoSpine=item.surface==='spine'&&SPINE_TEXT_IDS.has(item.id)&&spinePlacementMode(item.id)==='auto';
    if(!autoSpine){
      item.x+=edit.dx*scale;
      item.y+=edit.dy*scale;
    }
    item.w=Math.max(item.minW||5*scale,item.w*edit.widthScale);
    const basePt=edit.fontSizePt||item.fontPt;
    item.fontPt=clamp(basePt*edit.fontScale,4,160,basePt);
    item.align=edit.align;
    item.fontFamily=edit.fontFamily||item.fontFamily||'Pretendard';
    item.weight=edit.fontWeight||item.weight||700;
    item.lineHeight=edit.lineHeight||item.lineHeight||1.2;
    item.color=edit.cmyk?cmykToHex(edit.cmyk):(edit.color||item.color||'');
    return item;
  }

  function textLayout(spec,scale) {
    const v=readText(), b=spec.bleed*scale, tw=spec.trimW*scale, th=spec.trimH*scale;
    const wing=spec.wing*scale,sw=spec.spine*scale;
    const backX=spec.coverMode==='front'?b:b+wing;
    const spineX=backX+tw;
    const frontX=spec.coverMode==='front'?b:spineX+sw;
    const safe=Math.min(spec.safe,spec.trimW*.15,spec.trimH*.15)*scale;
    const ptPx=pt=>pt*25.4/72*scale;
    const list=[];
    const add=item=>{
      applyTextEdit(item,spec,scale);
      if(!String(item.text||'').trim())return;
      item.fontPx=ptPx(item.fontPt);
      list.push(item);
    };
    const contentW=Math.max(1,tw-safe*2);

    add({id:'title',surface:'front',text:v.title,x:frontX+safe,y:b+th*.15,w:contentW*.86,h:th*.38,fontPt:titlePt(v.title,spec.trimW),weight:900,align:'left'});

    const frontCustom=v.customFields.filter(item=>item.surface!=='back');
    const backCustom=spec.coverMode==='spread'?v.customFields.filter(item=>item.surface==='back'):[];
    const addCustomEntries=(entries,surface,x,startY,areaH)=>{
      const step=entries.length?Math.min(th*.075,areaH/entries.length):0;
      entries.forEach((entry,index)=>{
        const text=String(entry.value||'').trim();
        add({id:'custom:'+entry.id,surface,text,x:x+safe,y:startY+index*step,w:contentW*.72,h:Math.max(th*.052,step*.95),fontPt:12,weight:700,align:'left'});
      });
    };
    addCustomEntries(frontCustom,'front',frontX,b+th*.60,th*.30);

    if(spec.coverMode==='spread'){
      add({id:'backText',surface:'back',text:v.backText,x:backX+safe,y:b+th*.16,w:contentW*.82,h:th*.48,fontPt:14,weight:650,align:'left'});
      addCustomEntries(backCustom,'back',backX,b+th*.70,th*.22);
    }

    if(spec.coverMode==='spread'&&spec.spine>=4){
      const spineEntries=[
        {id:'spineTop',text:v.spineTop,slot:'top',center:.17},
        {id:'spineMiddle',text:v.spineMiddle,slot:'middle',center:.50},
        {id:'spineBottom',text:v.spineBottom,slot:'bottom',center:.83}
      ];
      spineEntries.forEach(entry=>{
        if(!String(entry.text||'').trim())return;
        const fp=spinePt(spec.spine,entry.text);
        if(v.spineOrientation==='vertical'){
          const slotH=th*.26;
          add({id:entry.id,surface:'spine',text:entry.text,x:spineX+sw*.12,y:b+th*entry.center-slotH/2,w:sw*.76,h:slotH,fontPt:fp,weight:900,vertical:true,align:'center',spineSlot:entry.slot});
        }else{
          const slotW=th*.26,slotH=sw*.72;
          add({id:entry.id,surface:'spine',text:entry.text,x:spineX+sw/2-slotW/2,y:b+th*entry.center-slotH/2,w:slotW,h:slotH,fontPt:fp,weight:900,rotate:v.spineOrientation==='rotate-down'?90:-90,align:'center',spineSlot:entry.slot});
        }
      });
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
    const font=fontOverride||item.fontPx,lineHeight=font*clamp(item.lineHeight,.8,2.2,1.2);
    ctx.save();ctx.fillStyle=item.color||color;ctx.font=(item.weight||700)+' '+font+'px '+fontStack(item.fontFamily);ctx.textBaseline='top';
    if(item.vertical)vertical(ctx,item.text,item.x,item.y,item.w,item.h,lineHeight);
    else if(item.rotate){const cx=item.x+item.w/2,cy=item.y+item.h/2;ctx.translate(cx,cy);ctx.rotate(item.rotate*Math.PI/180);wrapped(ctx,item.text,-item.w/2,-item.h/2,item.w,lineHeight,item.align||'center',item.h);}
    else wrapped(ctx,item.text,item.x,item.y,item.w,lineHeight,item.align||'left',item.h);
    ctx.restore();
  }

  function textVisualBounds(ctx,item,fontOverride){
    const font=fontOverride||item.fontPx;
    ctx.save();
    ctx.font=(item.weight||700)+' '+font+'px '+fontStack(item.fontFamily);
    ctx.textBaseline='top';
    if(item.vertical){
      const chars=[...String(item.text||'').replace(/\s+/g,'')].length;
      const lineHeight=font*clamp(item.lineHeight,.8,2.2,1.2);
      const h=Math.min(item.h,Math.max(lineHeight,chars*lineHeight));
      const w=Math.min(item.w,Math.max(font*1.25,font));
      ctx.restore();
      return {x:item.x+(item.w-w)/2,y:item.y,w,h};
    }
    const lineHeight=font*clamp(item.lineHeight,.8,2.2,1.2);
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

  const SHAPE_TYPES=new Set(['line','rect','roundRect','ellipse','star','sparkle','diamond']);
  function normalizeShape(item,index=0){
    const type=SHAPE_TYPES.has(item?.type)?item.type:'rect';
    const fallbackStroke={c:100,m:65,y:0,k:10},fallbackFill={c:12,m:4,y:0,k:0};
    return {
      id:String(item?.id||('shape-'+Date.now().toString(36)+'-'+index)),
      type,
      x:clamp(item?.x,-2000,2000,20),y:clamp(item?.y,-2000,2000,20),
      w:clamp(item?.w,.5,2000,50),h:clamp(item?.h,.1,2000,type==='line'?0.1:30),
      strokeWidth:clamp(item?.strokeWidth,.1,12,.5),
      strokeCmyk:normalizeCmyk(item?.strokeCmyk||fallbackStroke),
      fillCmyk:normalizeCmyk(item?.fillCmyk||fallbackFill),
      strokeEnabled:type==='line'?true:item?.strokeEnabled!==false,
      opacity:clamp(item?.opacity,0,1,1)
    };
  }
  function selectedShape(){return state.shapes.find(item=>item.id===state.selectedShapeId)||null;}
  function shapeLabel(type){return {line:'선',rect:'박스',roundRect:'둥근박스',ellipse:'원',star:'별 아이콘',sparkle:'반짝임 아이콘',diamond:'다이아몬드 아이콘'}[type]||'도형';}
  function createShape(type){
    if(!SHAPE_TYPES.has(type))return;
    const spec=currentSpec(),zone=coverSurfaceRect('front',spec,1)||{x:spec.bleed,y:spec.bleed,w:spec.trimW,h:spec.trimH};
    const icon=['star','sparkle','diamond'].includes(type),w=icon?18:Math.min(60,zone.w*.55),h=type==='line'?.1:(icon?18:Math.min(type==='ellipse'?36:42,zone.h*.18));
    const shape=normalizeShape({
      id:'shape-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),type,
      x:zone.x+(zone.w-w)/2,y:zone.y+zone.h*.56,w,h,
      opacity:type==='line'?1:(icon?.92:.82),
      strokeWidth:icon?.35:.5,
      strokeEnabled:type==='line'?true:!icon
    });
    state.shapes.push(shape);setSingleSelection('shape',shape.id);
    saveLocal();syncTextEditUi();scheduleRender();
  }
  function shapePixelBounds(shape,scale){
    const x=shape.x*scale,y=shape.y*scale,w=shape.w*scale,h=shape.h*scale;
    return {x:Math.min(x,x+w),y:Math.min(y,y+h),w:Math.abs(w),h:Math.max(Math.abs(h),1)};
  }
  function drawRoundRectPath(ctx,x,y,w,h,r){
    const radius=Math.min(Math.abs(w)/2,Math.abs(h)/2,r);
    ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+w-radius,y);ctx.quadraticCurveTo(x+w,y,x+w,y+radius);ctx.lineTo(x+w,y+h-radius);ctx.quadraticCurveTo(x+w,y+h,x+w-radius,y+h);ctx.lineTo(x+radius,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-radius);ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
  }
  function drawStarPath(ctx,x,y,w,h,points=5,inner=.45){
    const cx=x+w/2,cy=y+h/2,rx=Math.abs(w)/2,ry=Math.abs(h)/2;ctx.beginPath();
    for(let i=0;i<points*2;i++){const r=i%2?inner:1,a=-Math.PI/2+i*Math.PI/points,px=cx+Math.cos(a)*rx*r,py=cy+Math.sin(a)*ry*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();
  }
  function drawSparklePath(ctx,x,y,w,h){
    const cx=x+w/2,cy=y+h/2;ctx.beginPath();ctx.moveTo(cx,y);ctx.lineTo(cx+w*.12,cy-h*.12);ctx.lineTo(x+w,cy);ctx.lineTo(cx+w*.12,cy+h*.12);ctx.lineTo(cx,y+h);ctx.lineTo(cx-w*.12,cy+h*.12);ctx.lineTo(x,cy);ctx.lineTo(cx-w*.12,cy-h*.12);ctx.closePath();
  }
  function drawDiamondPath(ctx,x,y,w,h){ctx.beginPath();ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h/2);ctx.lineTo(x+w/2,y+h);ctx.lineTo(x,y+h/2);ctx.closePath();}
  function drawShape(ctx,shape,scale){
    const x=shape.x*scale,y=shape.y*scale,w=shape.w*scale,h=shape.h*scale;
    ctx.save();ctx.globalAlpha=shape.opacity;ctx.strokeStyle=cmykCss(shape.strokeCmyk);ctx.fillStyle=cmykCss(shape.fillCmyk);ctx.lineWidth=Math.max(.7,shape.strokeWidth*scale);
    if(shape.type==='line'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+h);ctx.stroke();}
    else{
      if(shape.type==='ellipse'){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2);}
      else if(shape.type==='roundRect')drawRoundRectPath(ctx,x,y,w,h,Math.min(5*scale,Math.abs(w)*.18,Math.abs(h)*.18));
      else if(shape.type==='star')drawStarPath(ctx,x,y,w,h);
      else if(shape.type==='sparkle')drawSparklePath(ctx,x,y,w,h);
      else if(shape.type==='diamond')drawDiamondPath(ctx,x,y,w,h);
      else{ctx.beginPath();ctx.rect(x,y,w,h);}
      ctx.fill();if(shape.strokeEnabled)ctx.stroke();
    }
    ctx.restore();
  }
  function pointSegmentDistance(point,x1,y1,x2,y2){
    const dx=x2-x1,dy=y2-y1,len=dx*dx+dy*dy;if(!len)return Math.hypot(point.x-x1,point.y-y1);
    const t=Math.max(0,Math.min(1,((point.x-x1)*dx+(point.y-y1)*dy)/len)),px=x1+t*dx,py=y1+t*dy;
    return Math.hypot(point.x-px,point.y-py);
  }
  function findShapeAtPoint(point,scale){
    for(let i=state.shapes.length-1;i>=0;i--){
      const shape=state.shapes[i],x=shape.x*scale,y=shape.y*scale,w=shape.w*scale,h=shape.h*scale;
      if(shape.type==='line'){if(pointSegmentDistance(point,x,y,x+w,y+h)<=7)return shape;}
      else if(pointInBounds(point,shapePixelBounds(shape,scale),5))return shape;
    }
    return null;
  }
  function drawShapeSelection(ctx,scale){
    if(selectionCount()!==1)return;const shape=selectedShape();if(!shape)return;
    const bounds=shapePixelBounds(shape,scale);ctx.save();ctx.strokeStyle='rgba(37,99,235,.70)';ctx.lineWidth=1.2;ctx.setLineDash([]);ctx.strokeRect(bounds.x-3,bounds.y-3,bounds.w+6,bounds.h+6);ctx.fillStyle='rgba(37,99,235,.82)';ctx.fillRect(bounds.x+bounds.w-4,bounds.y+bounds.h-4,8,8);ctx.restore();
  }
  function deleteSelectedShape(){
    if(!state.selectedShapeId)return;
    const id=state.selectedShapeId,key=selectionKey('shape',id);state.shapes=state.shapes.filter(item=>item.id!==id);state.selectedElements=state.selectedElements.filter(item=>item!==key);removeKeyFromGroups(key);syncPrimarySelection();state.shapePointer=null;saveLocal();syncTextEditUi();scheduleRender();
  }
  function deleteTextElement(id){
    if(!id)return;
    if(String(id).startsWith('custom:')){
      const customId=String(id).slice(7);
      state.customFields=state.customFields.filter(item=>item.id!==customId);
      delete state.textLayouts[id];
      return;
    }
    if(!DIRECT_TEXT_SOURCE_IDS.has(id))return;
    const input=$(id);if(input)input.value='';
    const layout=textLayoutState(id);layout.text='';
    if(id==='spineMiddle'&&$('spineSync')?.checked)$('spineSync').checked=false;
    if(id==='title'&&$('spineSync')?.checked)syncSpineTitle();
  }
  function deleteSelectedElements(){
    if(!selectionCount())return;
    const keys=[...state.selectedElements],shapeIds=new Set(),textIds=[];
    keys.forEach(key=>{
      const parsed=parseSelectionKey(key);if(!parsed)return;
      if(parsed.kind==='shape')shapeIds.add(parsed.id);
      else if(parsed.kind==='text')textIds.push(parsed.id);
    });
    if(shapeIds.size)state.shapes=state.shapes.filter(item=>!shapeIds.has(item.id));
    textIds.forEach(deleteTextElement);
    keys.forEach(removeKeyFromGroups);cleanGroups();
    clearSelection();renderCustomFields();saveLocal();updateProgress();syncTextEditUi();scheduleRender();
  }
  function templateShape(type,props={}){
    return normalizeShape({
      id:'shape-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7),
      type,strokeWidth:.45,strokeEnabled:type==='line'?true:false,opacity:.9,
      strokeCmyk:hexToCmyk('#334155'),fillCmyk:hexToCmyk('#7c3aed'),...props
    });
  }
  function createDecorationTemplate(templateId){
    const spec=currentSpec(),zone=coverSurfaceRect('front',spec,1);if(!zone)return;
    if(state.shapes.length>68){setStatus('꾸밈 요소가 많습니다.','기존 도형을 일부 삭제한 뒤 꾸밈 템플릿을 추가해 주세요.','error');return;}
    const x=zone.x,y=zone.y,w=zone.w,h=zone.h,accent=hexToCmyk('#7c3aed'),ink=hexToCmyk('#334155'),soft=hexToCmyk('#c4b5fd');
    let items=[];
    if(templateId==='minimal-corner'){
      const len=Math.min(24,w*.16),gap=Math.min(5,w*.03);
      items=[
        templateShape('line',{x:x+gap,y:y+gap,w:len,h:.1,strokeCmyk:ink,strokeWidth:.35,opacity:.78}),
        templateShape('line',{x:x+gap,y:y+gap,w:.5,h:len,strokeCmyk:ink,strokeWidth:.35,opacity:.78}),
        templateShape('line',{x:x+w-gap-len,y:y+h-gap,w:len,h:.1,strokeCmyk:ink,strokeWidth:.35,opacity:.78}),
        templateShape('line',{x:x+w-gap,y:y+h-gap-len,w:.5,h:len,strokeCmyk:ink,strokeWidth:.35,opacity:.78})
      ];
    }else if(templateId==='editorial-line'){
      items=[
        templateShape('line',{x:x+w*.08,y:y+h*.17,w:.5,h:h*.60,strokeCmyk:ink,strokeWidth:.5,opacity:.72}),
        templateShape('sparkle',{x:x+w*.055,y:y+h*.10,w:10,h:10,fillCmyk:accent,opacity:.88}),
        templateShape('diamond',{x:x+w*.07,y:y+h*.81,w:7,h:7,fillCmyk:soft,opacity:.84})
      ];
    }else if(templateId==='premium-frame'){
      const inset=Math.min(7,w*.04),fw=w-inset*2,fh=h-inset*2;
      items=[
        templateShape('line',{x:x+inset,y:y+inset,w:fw,h:.1,strokeCmyk:ink,strokeWidth:.32,opacity:.58}),
        templateShape('line',{x:x+inset,y:y+h-inset,w:fw,h:.1,strokeCmyk:ink,strokeWidth:.32,opacity:.58}),
        templateShape('line',{x:x+inset,y:y+inset,w:.5,h:fh,strokeCmyk:ink,strokeWidth:.32,opacity:.58}),
        templateShape('line',{x:x+w-inset,y:y+inset,w:.5,h:fh,strokeCmyk:ink,strokeWidth:.32,opacity:.58}),
        templateShape('diamond',{x:x+w*.48,y:y+inset-3,w:8,h:8,fillCmyk:accent,opacity:.85})
      ];
    }else if(templateId==='modern-accent'){
      items=[
        templateShape('ellipse',{x:x+w*.76,y:y+h*.08,w:24,h:24,fillCmyk:soft,opacity:.34}),
        templateShape('sparkle',{x:x+w*.83,y:y+h*.11,w:12,h:12,fillCmyk:accent,opacity:.92}),
        templateShape('diamond',{x:x+w*.74,y:y+h*.16,w:7,h:7,fillCmyk:ink,opacity:.75}),
        templateShape('line',{x:x+w*.66,y:y+h*.23,w:w*.24,h:.1,strokeCmyk:ink,strokeWidth:.35,opacity:.55})
      ];
    }
    if(!items.length)return;
    state.shapes.push(...items);
    groupSelectionKeys(items.map(item=>selectionKey('shape',item.id)));
    saveLocal();syncTextEditUi();scheduleRender();
  }

  function logoRect(spec,scale){
    if(!state.logo)return null;
    const b=spec.bleed*scale,wing=spec.wing*scale,tw=spec.trimW*scale,th=spec.trimH*scale,sw=spec.spine*scale,safe=spec.safe*scale;
    const frontX=spec.coverMode==='front'?b:b+wing+tw+sw;
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

  function textSurfaceForId(id){
    if(id==='title')return 'front';
    if(id==='backText')return 'back';
    if(SPINE_TEXT_IDS.has(id))return 'spine';
    if(String(id||'').startsWith('custom:')){
      const customId=String(id).slice(7);
      return state.customFields.find(item=>item.id===customId)?.surface==='back'?'back':'front';
    }
    return 'front';
  }

  function coverSurfaceRect(surface,spec,scale){
    const b=spec.bleed*scale,tw=spec.trimW*scale,th=spec.trimH*scale,wing=spec.wing*scale,sw=spec.spine*scale;
    const safe=Math.min(spec.safe,spec.trimW*.15,spec.trimH*.15)*scale;
    const safeW=Math.max(1,tw-safe*2),safeH=Math.max(1,th-safe*2);
    if(surface==='front'){
      const trimX=spec.coverMode==='front'?b:b+wing+tw+sw;
      return {x:trimX+safe,y:b+safe,w:safeW,h:safeH,surface:'front'};
    }
    if(surface==='back'&&spec.coverMode==='spread'){
      return {x:b+wing+safe,y:b+safe,w:safeW,h:safeH,surface:'back'};
    }
    if(surface==='spine'&&spec.coverMode==='spread'&&sw>0){
      const spineX=b+wing+tw;
      const spineSafeX=Math.min(sw*.12,1.2*scale);
      return {x:spineX+spineSafeX,y:b+safe,w:Math.max(1,sw-spineSafeX*2),h:Math.max(1,th-safe*2),surface:'spine'};
    }
    return null;
  }

  function drawSnapGuide(ctx){
    const guide=state.snapGuide;if(!guide)return;
    ctx.save();
    ctx.strokeStyle='rgba(124,58,237,.92)';
    ctx.lineWidth=1.2;
    ctx.setLineDash([4,4]);
    if(guide.snapX){ctx.beginPath();ctx.moveTo(guide.centerX,guide.zone.y);ctx.lineTo(guide.centerX,guide.zone.y+guide.zone.h);ctx.stroke();}
    if(guide.snapY){ctx.beginPath();ctx.moveTo(guide.zone.x,guide.centerY);ctx.lineTo(guide.zone.x+guide.zone.w,guide.centerY);ctx.stroke();}
    ctx.restore();
  }

  function renderPreview(){
    const canvas=$('previewCanvas'),spec=currentSpec();if(!canvas)return;
    const fit=canvasFitSize(spec),dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.style.width=fit.width+'px';canvas.style.height=fit.height+'px';canvas.width=Math.round(fit.width*dpr);canvas.height=Math.round(fit.height*dpr);
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,fit.width,fit.height);
    if(state.background?.naturalWidth)drawBackgroundImage(ctx,state.background,fit.width,fit.height);
    state.shapes.forEach(shape=>drawShape(ctx,shape,fit.scale));
    drawLogo(ctx,spec,fit.scale);
    const color=$('textColor')?.value||'#ffffff';
    const items=textLayout(spec,fit.scale);
    items.forEach(item=>drawTextItem(ctx,item,color));
    drawGuides(ctx,spec,fit.scale);
    if($('cropMarkToggle')?.checked)drawCropMarks(ctx,spec,fit.scale);
    drawSnapGuide(ctx);
    drawTextSelection(ctx,items);
    drawShapeSelection(ctx,fit.scale);
    drawMultiSelection(ctx,items,fit.scale);
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
    if(selectionCount()!==1||!state.selectedTextId)return;
    const item=items.find(entry=>entry.id===state.selectedTextId);if(!item)return;
    const bounds=textVisualBounds(ctx,item);
    ctx.save();
    ctx.strokeStyle='rgba(79,70,229,.72)';ctx.lineWidth=1.25;ctx.setLineDash([]);
    ctx.strokeRect(bounds.x-3,bounds.y-3,bounds.w+6,bounds.h+6);
    ctx.fillStyle='rgba(79,70,229,.82)';
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

  function selectionDescriptors(ctx,items,scale){
    const descriptors=[];
    state.selectedElements.forEach(key=>{
      const parsed=parseSelectionKey(key);if(!parsed)return;
      if(parsed.kind==='text'){
        const item=items.find(entry=>entry.id===parsed.id);if(!item)return;
        descriptors.push({key,kind:'text',id:parsed.id,item,bounds:textVisualBounds(ctx,item)});
      }else{
        const shape=state.shapes.find(entry=>entry.id===parsed.id);if(!shape)return;
        descriptors.push({key,kind:'shape',id:parsed.id,shape,bounds:shapePixelBounds(shape,scale)});
      }
    });
    return descriptors;
  }
  function descriptorGroupBounds(descriptors){
    if(!descriptors.length)return null;
    const left=Math.min(...descriptors.map(d=>d.bounds.x)),top=Math.min(...descriptors.map(d=>d.bounds.y));
    const right=Math.max(...descriptors.map(d=>d.bounds.x+d.bounds.w)),bottom=Math.max(...descriptors.map(d=>d.bounds.y+d.bounds.h));
    return {x:left,y:top,w:right-left,h:bottom-top};
  }
  function drawMultiSelection(ctx,items,scale){
    if(selectionCount()<2)return;
    const descriptors=selectionDescriptors(ctx,items,scale),group=descriptorGroupBounds(descriptors);if(!group)return;
    ctx.save();ctx.strokeStyle='rgba(79,70,229,.66)';ctx.lineWidth=1.25;ctx.setLineDash([]);
    ctx.strokeRect(group.x-4,group.y-4,group.w+8,group.h+8);ctx.restore();
  }
  function captureSelectionSnapshot(){
    return state.selectedElements.map(key=>{
      const parsed=parseSelectionKey(key);if(!parsed)return null;
      if(parsed.kind==='text'){
        const layout=textLayoutState(parsed.id);return {key,kind:'text',id:parsed.id,dx:layout.dx,dy:layout.dy};
      }
      const shape=state.shapes.find(entry=>entry.id===parsed.id);return shape?{key,kind:'shape',id:parsed.id,x:shape.x,y:shape.y}:null;
    }).filter(Boolean);
  }
  function applySelectionSnapshotMove(snapshot,dx,dy){
    snapshot.forEach(entry=>{
      if(entry.kind==='text'){
        const layout=textLayoutState(entry.id);layout.boxAlign='';layout.dx=entry.dx+dx;layout.dy=entry.dy+dy;
        if(textSurfaceForId(entry.id)==='spine')setSpinePlacementMode(entry.id,'free');
      }else{
        const shape=state.shapes.find(item=>item.id===entry.id);if(shape){shape.x=entry.x+dx;shape.y=entry.y+dy;}
      }
    });
  }
  function nudgeSelectedElements(dx,dy){
    const spec=currentSpec();if(!selectionCount())return;
    state.selectedElements.forEach(key=>{
      const parsed=parseSelectionKey(key);if(!parsed)return;
      if(parsed.kind==='text'){
        const layout=textLayoutState(parsed.id);layout.boxAlign='';
        if(textSurfaceForId(parsed.id)==='spine')setSpinePlacementMode(parsed.id,'free');
        layout.dx=clamp(layout.dx+dx,-spec.workW,spec.workW,0);layout.dy=clamp(layout.dy+dy,-spec.workH,spec.workH,0);
      }else{
        const shape=state.shapes.find(item=>item.id===parsed.id);if(!shape)return;
        shape.x=clamp(shape.x+dx,0,Math.max(0,spec.workW-shape.w),shape.x);shape.y=clamp(shape.y+dy,0,Math.max(0,spec.workH-shape.h),shape.y);
      }
    });
    saveLocal();syncTextEditUi();scheduleRender();
  }
  function alignSelectedElements(mode){
    if(selectionCount()<2||!['left','center','right'].includes(mode))return;
    const canvas=$('previewCanvas'),ctx=canvas?.getContext('2d'),spec=currentSpec(),fit=canvasFitSize(spec);if(!ctx)return;
    const items=textLayout(spec,fit.scale),descriptors=selectionDescriptors(ctx,items,fit.scale),group=descriptorGroupBounds(descriptors);if(!group)return;
    const groupCenter=group.x+group.w/2,groupRight=group.x+group.w;
    descriptors.forEach(desc=>{
      const target=mode==='left'?group.x:mode==='center'?groupCenter-desc.bounds.w/2:groupRight-desc.bounds.w;
      const delta=(target-desc.bounds.x)/fit.scale;
      if(desc.kind==='text'){
        const layout=textLayoutState(desc.id);layout.boxAlign='';layout.dx+=delta;
        if(textSurfaceForId(desc.id)==='spine')setSpinePlacementMode(desc.id,'free');
      }else desc.shape.x+=delta;
    });
    saveLocal();syncTextEditUi();scheduleRender();
  }

  function syncTextEditUi(){
    const count=selectionCount(),multi=count>1,selected=state.selectedTextId,shape=selectedShape();
    const label=$('selectedTextLabel'),inspectorLabel=$('inspectorSelectedLabel'),modeTitle=$('inspectorModeTitle');
    const item=count===1&&selected?selectedTextItem():null,active=Boolean(item),shapeActive=Boolean(count===1&&shape);
    const exactGroup=exactSelectedGroupId(),groupIds=selectedGroupIds();
    if($('multiSelectPanel'))$('multiSelectPanel').hidden=!multi;
    if($('multiSelectCount'))$('multiSelectCount').textContent=multi?(exactGroup?'그룹 · '+count+'개 요소':count+'개 요소 선택'):'';
    if($('groupSelectionBtn'))$('groupSelectionBtn').disabled=!multi||Boolean(exactGroup);
    if($('ungroupSelectionBtn'))$('ungroupSelectionBtn').disabled=!groupIds.length;
    if(label)label.textContent=multi?(exactGroup?'그룹 · '+count+'개 요소':count+'개 요소 선택'):active?textItemLabel(selected):(shapeActive?shapeLabel(shape.type):'문구·도형을 클릭해 선택');
    if(inspectorLabel)inspectorLabel.textContent=multi?(exactGroup?'묶인 요소를 하나처럼 이동·정렬할 수 있습니다.':'선택한 요소를 함께 이동·정렬하거나 묶을 수 있습니다.'):active?textItemLabel(selected):(shapeActive?shapeLabel(shape.type)+' 선택됨':'미리보기에서 문구나 도형을 선택하세요.');
    if(modeTitle)modeTitle.textContent=multi?(exactGroup?'그룹 편집':'다중 요소 편집'):shapeActive?'도형 편집':'문구 편집';
    if($('shapeInspector'))$('shapeInspector').hidden=!shapeActive;
    if($('textInspectorEmpty'))$('textInspectorEmpty').hidden=active||shapeActive||multi;
    if($('textInspectorFields'))$('textInspectorFields').hidden=!active;
    if(shapeActive){
      if($('shapeInspectorTitle'))$('shapeInspectorTitle').textContent=shapeLabel(shape.type);
      if($('shapeStrokeWidth')&&document.activeElement!==$('shapeStrokeWidth'))$('shapeStrokeWidth').value=Number(shape.strokeWidth).toFixed(1);
      if($('shapeOpacity')&&document.activeElement!==$('shapeOpacity'))$('shapeOpacity').value=Math.round(shape.opacity*100);
      if($('shapeFillSection'))$('shapeFillSection').hidden=shape.type==='line';
      if($('shapeStrokeToggleRow'))$('shapeStrokeToggleRow').hidden=shape.type==='line';
      if($('shapeStrokeTransparent'))$('shapeStrokeTransparent').checked=shape.type!=='line'&&!shape.strokeEnabled;
      setCmykInputs('shapeFill',shape.fillCmyk);setCmykInputs('shapeStroke',shape.strokeCmyk);
    }
    const layout=active?textLayoutState(selected):null;
    qa('[data-text-align]').forEach(button=>{button.disabled=!active;button.classList.toggle('active',Boolean(layout&&button.dataset.textAlign===layout.align));});
    qa('[data-box-align]').forEach(button=>{
      const surface=active?textSurfaceForId(selected):'',boxEnabled=active&&surface!=='spine';
      button.disabled=!boxEnabled;button.classList.toggle('active',Boolean(boxEnabled&&layout&&button.dataset.boxAlign===layout.boxAlign));
    });
    if($('resetTextLayout'))$('resetTextLayout').disabled=!active;
    if(!active){state.selectedTextUiId='';return;}
    const content=$('selectedTextValue');
    if(content&&(state.selectedTextUiId!==selected||document.activeElement!==content))content.value=item.text||'';
    if($('selectedFontFamily'))$('selectedFontFamily').value=normalizeFontFamily(item.fontFamily)||'Pretendard';
    if($('selectedFontSize')&&document.activeElement!==$('selectedFontSize'))$('selectedFontSize').value=Number(item.fontPt||10).toFixed(1);
    if($('selectedFontWeight'))$('selectedFontWeight').value=String(normalizeFontWeight(item.weight)||700);
    if($('selectedLineHeight')&&document.activeElement!==$('selectedLineHeight'))$('selectedLineHeight').value=Number(item.lineHeight||1.2).toFixed(2);
    setCmykInputs('selectedText',layout?.cmyk||hexToCmyk(normalizeColor(item.color)||normalizeColor($('textColor')?.value)||'#ffffff'));
    state.selectedTextUiId=selected;
  }
  function alignSelectedTextBox(mode){
    if(!state.selectedTextId||!['left','center','right'].includes(mode))return;
    const spec=currentSpec(),surface=textSurfaceForId(state.selectedTextId);
    if(surface==='spine')return;
    const item=textLayout(spec,1).find(entry=>entry.id===state.selectedTextId);
    const zone=coverSurfaceRect(surface,spec,1);
    if(!item||!zone)return;
    const layout=textLayoutState(state.selectedTextId,item.align||'left');
    let targetX=zone.x;
    if(mode==='center')targetX=zone.x+(zone.w-item.w)/2;
    else if(mode==='right')targetX=zone.x+zone.w-item.w;
    layout.dx=clamp(layout.dx+(targetX-item.x),-spec.workW,spec.workW,0);
    layout.boxAlign=mode;
    state.snapGuide=null;
    saveLocal();syncTextEditUi();scheduleRender();
  }

  function bindTextCanvasEditing(){
    const canvas=$('previewCanvas');if(!canvas)return;
    const SNAP_PX=9;
    canvas.addEventListener('pointerdown',event=>{
      const point=canvasPoint(event),spec=currentSpec(),fit=canvasFitSize(spec),ctx=canvas.getContext('2d');if(!point||!ctx)return;
      const items=textLayout(spec,fit.scale),single=selectionCount()===1;
      const selectedText=single&&state.selectedTextId?items.find(item=>item.id===state.selectedTextId)||null:null;
      const selectedTextBounds=selectedText?textVisualBounds(ctx,selectedText):null;
      const selectedShapeItem=single?selectedShape():null,selectedShapeBounds=selectedShapeItem?shapePixelBounds(selectedShapeItem,fit.scale):null,hs=16;
      const onTextHandle=selectedTextBounds&&point.x>=selectedTextBounds.x+selectedTextBounds.w-hs&&point.x<=selectedTextBounds.x+selectedTextBounds.w+hs&&point.y>=selectedTextBounds.y+selectedTextBounds.h-hs&&point.y<=selectedTextBounds.y+selectedTextBounds.h+hs;
      const onShapeHandle=selectedShapeBounds&&point.x>=selectedShapeBounds.x+selectedShapeBounds.w-hs&&point.x<=selectedShapeBounds.x+selectedShapeBounds.w+hs&&point.y>=selectedShapeBounds.y+selectedShapeBounds.h-hs&&point.y<=selectedShapeBounds.y+selectedShapeBounds.h+hs;
      const textHit=onTextHandle&&selectedText?{item:selectedText,bounds:selectedTextBounds}:findTextAtPoint(ctx,items,point);
      const shapeHit=!textHit?findShapeAtPoint(point,fit.scale):null;
      const hitKind=textHit?'text':shapeHit?'shape':'',hitId=textHit?.item.id||shapeHit?.id||'';
      if(event.shiftKey){
        if(hitKind&&hitId){event.preventDefault();toggleSelection(hitKind,hitId);state.textPointer=null;state.shapePointer=null;state.groupPointer=null;state.snapGuide=null;syncTextEditUi();scheduleRender();}
        return;
      }
      if(!hitKind&&!onShapeHandle&&!onTextHandle){
        clearSelection();state.snapGuide=null;syncTextEditUi();scheduleRender();return;
      }
      const effectiveKind=onShapeHandle&&selectedShapeItem&&!textHit?'shape':hitKind;
      const effectiveId=onShapeHandle&&selectedShapeItem&&!textHit?selectedShapeItem.id:hitId;
      if(!effectiveKind||!effectiveId)return;
      event.preventDefault();
      if(selectionCount()>1&&selectionHas(effectiveKind,effectiveId)){
        const descriptors=selectionDescriptors(ctx,items,fit.scale),group=descriptorGroupBounds(descriptors);if(!group)return;
        canvas.setPointerCapture?.(event.pointerId);state.textPointer=null;state.shapePointer=null;state.snapGuide=null;
        state.groupPointer={id:event.pointerId,startX:point.x,startY:point.y,scale:fit.scale,canvasW:fit.width,canvasH:fit.height,groupBounds:group,snapshot:captureSelectionSnapshot()};
        syncTextEditUi();scheduleRender();return;
      }
      if(!selectionHas(effectiveKind,effectiveId)||selectionCount()!==1)setSingleSelection(effectiveKind,effectiveId);
      if(effectiveKind==='shape'){
        const shape=state.shapes.find(item=>item.id===effectiveId);if(!shape)return;
        const bounds=shapePixelBounds(shape,fit.scale);canvas.setPointerCapture?.(event.pointerId);state.textPointer=null;state.groupPointer=null;state.snapGuide=null;
        const resize=Boolean(onShapeHandle&&selectedShapeItem?.id===effectiveId);
        state.shapePointer={id:event.pointerId,shapeId:effectiveId,mode:resize?'resize':'move',startX:point.x,startY:point.y,start:{...shape},startBounds:bounds,scale:fit.scale};
        syncTextEditUi();scheduleRender();return;
      }
      const hit=textHit&&textHit.item.id===effectiveId?textHit:{item:items.find(item=>item.id===effectiveId),bounds:null};if(!hit.item)return;
      if(!hit.bounds)hit.bounds=textVisualBounds(ctx,hit.item);
      const layout=textLayoutState(effectiveId,hit.item.align||'left'),surface=textSurfaceForId(effectiveId),zone=coverSurfaceRect(surface,spec,fit.scale);
      canvas.setPointerCapture?.(event.pointerId);state.shapePointer=null;state.groupPointer=null;
      state.textPointer={id:event.pointerId,textId:effectiveId,mode:onTextHandle&&selectedText?.id===effectiveId?'resize':'move',startX:point.x,startY:point.y,start:{...layout},startBounds:{...hit.bounds},startBox:{x:hit.item.x,y:hit.item.y,w:hit.item.w,h:hit.item.h},zone,baseW:Math.max(24,hit.bounds.w),baseH:Math.max(18,hit.bounds.h),scale:fit.scale};
      state.snapGuide=null;syncTextEditUi();scheduleRender();
    });
    canvas.addEventListener('pointermove',event=>{
      const groupDrag=state.groupPointer;
      if(groupDrag&&groupDrag.id===event.pointerId){
        const point=canvasPoint(event);if(!point)return;event.preventDefault();
        const g=groupDrag.groupBounds,rawDx=point.x-groupDrag.startX,rawDy=point.y-groupDrag.startY;
        const dx=Math.max(-g.x,Math.min(groupDrag.canvasW-(g.x+g.w),rawDx)),dy=Math.max(-g.y,Math.min(groupDrag.canvasH-(g.y+g.h),rawDy));
        applySelectionSnapshotMove(groupDrag.snapshot,dx/groupDrag.scale,dy/groupDrag.scale);scheduleRender();return;
      }
      const shapeDrag=state.shapePointer;
      if(shapeDrag&&shapeDrag.id===event.pointerId){
        const point=canvasPoint(event),shape=state.shapes.find(item=>item.id===shapeDrag.shapeId);if(!point||!shape)return;event.preventDefault();
        const spec=currentSpec(),dx=(point.x-shapeDrag.startX)/shapeDrag.scale,dy=(point.y-shapeDrag.startY)/shapeDrag.scale;
        if(shapeDrag.mode==='move'){
          shape.x=clamp(shapeDrag.start.x+dx,0,Math.max(0,spec.workW-shape.w),shapeDrag.start.x);
          shape.y=clamp(shapeDrag.start.y+dy,0,Math.max(0,spec.workH-shape.h),shapeDrag.start.y);
        }else{
          shape.w=clamp(shapeDrag.start.w+dx,.5,Math.max(.5,spec.workW-shape.x),shapeDrag.start.w);
          shape.h=clamp(shapeDrag.start.h+dy,shape.type==='line'?.1:.5,Math.max(.5,spec.workH-shape.y),shapeDrag.start.h);
        }
        scheduleRender();return;
      }
      const drag=state.textPointer;if(!drag||drag.id!==event.pointerId)return;
      const point=canvasPoint(event);if(!point)return;event.preventDefault();
      let dx=point.x-drag.startX,dy=point.y-drag.startY;const layout=textLayoutState(drag.textId);
      if(drag.mode==='move'){
        if(textSurfaceForId(drag.textId)==='spine')setSpinePlacementMode(drag.textId,'free');
        state.snapGuide=null;
        if(drag.zone&&drag.startBounds&&drag.startBox){
          const zoneLeft=drag.zone.x,zoneCenterX=drag.zone.x+drag.zone.w/2,zoneRight=drag.zone.x+drag.zone.w,zoneCenterY=drag.zone.y+drag.zone.h/2;
          const boxLeft=drag.startBox.x+dx,boxCenter=drag.startBox.x+drag.startBox.w/2+dx,boxRight=drag.startBox.x+drag.startBox.w+dx;
          const xCandidates=[{delta:zoneLeft-boxLeft,lineX:zoneLeft},{delta:zoneCenterX-boxCenter,lineX:zoneCenterX},{delta:zoneRight-boxRight,lineX:zoneRight}].sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta));
          const xSnap=xCandidates[0]&&Math.abs(xCandidates[0].delta)<=SNAP_PX?xCandidates[0]:null,candidateCenterY=drag.startBounds.y+drag.startBounds.h/2+dy,snapY=Math.abs(candidateCenterY-zoneCenterY)<=SNAP_PX;
          if(xSnap)dx+=xSnap.delta;if(snapY)dy+=zoneCenterY-candidateCenterY;
          if(xSnap||snapY)state.snapGuide={zone:drag.zone,centerX:xSnap?.lineX||zoneCenterX,centerY:zoneCenterY,snapX:Boolean(xSnap),snapY};
        }
        const spec=currentSpec();layout.boxAlign='';layout.dx=clamp(drag.start.dx+dx/drag.scale,-spec.workW,spec.workW,0);layout.dy=clamp(drag.start.dy+dy/drag.scale,-spec.workH,spec.workH,0);
      }else{
        layout.boxAlign='';layout.widthScale=clamp(drag.start.widthScale*(1+dx/drag.baseW),.25,2.5,1);layout.fontScale=clamp(drag.start.fontScale*(1+dy/drag.baseH),.35,3,1);
      }
      scheduleRender();
    });
    const finish=event=>{
      const textDone=state.textPointer&&(!event||state.textPointer.id===event.pointerId),shapeDone=state.shapePointer&&(!event||state.shapePointer.id===event.pointerId),groupDone=state.groupPointer&&(!event||state.groupPointer.id===event.pointerId);
      if(textDone||shapeDone||groupDone){state.textPointer=null;state.shapePointer=null;state.groupPointer=null;state.snapGuide=null;saveLocal();syncTextEditUi();scheduleRender();}
    };
    canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  }
  function resetSelectedTextLayout(){
    if(!state.selectedTextId)return;
    const current=textLayoutState(state.selectedTextId);
    const item=textLayout(currentSpec(),1).find(entry=>entry.id===state.selectedTextId);
    const reset={
      dx:0,dy:0,widthScale:1,fontScale:1,align:item?.rotate||item?.vertical?'center':'left',boxAlign:'',
      fontFamily:'',fontSizePt:0,fontWeight:0,lineHeight:1.2,color:'',cmyk:null
    };
    if(Object.prototype.hasOwnProperty.call(current,'text'))reset.text=current.text;
    state.textLayouts[state.selectedTextId]=reset;
    if(SPINE_TEXT_IDS.has(state.selectedTextId))setSpinePlacementMode(state.selectedTextId,'auto');
    state.selectedTextUiId='';
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

  function selectedDesignDirection(){
    const visual=$('visualMode')?.value||'auto';
    const intensity=$('colorIntensity')?.value||'refined';
    const mood=$('designMood')?.value||'auto';
    const variant=COMPOSITION_VARIANTS[Math.floor(Math.random()*COMPOSITION_VARIANTS.length)];
    return [
      'Visual approach: '+(VISUAL_MODE_PROMPTS[visual]||VISUAL_MODE_PROMPTS.auto),
      'Color direction: '+(COLOR_INTENSITY_PROMPTS[intensity]||COLOR_INTENSITY_PROMPTS.refined),
      'Mood direction: '+(MOOD_PROMPTS[mood]||MOOD_PROMPTS.auto),
      'Composition variation for this generation: '+variant
    ].join('\n');
  }

  function themeContext(){
    const t=readText(),spec=currentSpec();
    const custom=t.customFields.map(item=>{
      const value=String(item.value||'').trim();
      if(!value)return '';
      return (item.surface==='back'?'뒤표지':'앞표지')+' 추가 문구: '+value;
    }).filter(Boolean);
    return [
      spec.coverMode==='front'?'표지 용도: 인쇄용 앞표지 단면':'표지 용도: 인쇄용 책/보고서 전체 펼침 표지',
      '디자인 종류: '+(PRESETS[state.preset]?.name||'보고서'),
      t.title?'앞표지 문구의 의미 참고: '+t.title:'',
      spec.coverMode==='spread'&&t.backText?'뒤표지 문구의 의미 참고: '+t.backText:'',
      ...custom,
      $('theme')?.value?'주제·키워드: '+$('theme').value:'',
      '선호 주조색: '+($('primaryColor')?.value||'#315c8c'),
      '주의: 위 문구는 배경 콘셉트의 의미 참고용이며 이미지 안에 실제 글자로 그리지 않는다.'
    ].filter(Boolean).join('\n');
  }

  async function generate(){
    const title=String($('title')?.value||'').trim();
    if(!title){setStatus('앞표지 문구를 먼저 입력해 주세요.','앞표지 기본 문구는 필수입니다.','error');$('title')?.focus();return;}
    const spec=currentSpec(), ratio=spec.workW/spec.workH;
    if(ratio<1/3||ratio>3){setStatus('현재 표지 비율을 생성할 수 없습니다.','완성 규격·책등·날개 폭을 확인해 주세요.','error');return;}
    const button=$('generateBtn');button.disabled=true;
    setStatus('AI 배경을 생성하고 있습니다.',state.generationQuality==='high'?'고품질 AI 배경을 생성 중입니다. 최종 저장은 300dpi로 출력됩니다.':'기본 품질 AI 배경을 생성 중입니다. 최종 저장은 300dpi로 출력됩니다.','busy');
    startGenerationProgress();
    try{
      const prompt=String($('stylePrompt')?.value||presetPrompt()).trim();
      const designGuardrails=[
        'Create a contemporary, production-ready print cover with professional art direction and clear hierarchy.',
        'Default color treatment should be slightly richer and more sophisticated than pale pastel: refined medium saturation, crisp contrast, and print-friendly tones.',
        'Do not default every design to thin lines, circles, waves, geometric networks or abstract patterns. Let the selected document category and visual approach determine the visual language.',
        'Photography, editorial illustration, iconographic/infographic structures, image crops, frames, grids, layered fields, architectural composition and refined geometry are all allowed when they fit the selected visual approach.',
        'Preserve a clear text-safe area for the application typography and never generate readable words, letters, logos, labels or pseudo-text.',
        'The OUTER BLEED BOUNDARY is the artwork canvas. Fill the entire canvas edge-to-edge; artwork may crop naturally at the outside edge.',
        spec.coverMode==='spread'
          ?'Do not create a visible center spine strip, seam, fold, vertical band, or abrupt color break. The artwork must flow continuously through the exact spine area.'
          :'This is FRONT COVER ONLY. Compose one portrait cover, not a spread, not a mockup, and do not invent a back cover or spine.',
        'Avoid washed-out low-contrast pastel, dated government brochure waves, generic stock-template decoration, glossy 3D effects, fake text and clutter.'
      ].join('\n');
      const designDirection=selectedDesignDirection();
      const data=await authFetch(AI_COVER_PATH,{
        method:'POST',
        body:JSON.stringify({
          cover_mode:spec.coverMode,quality_mode:state.generationQuality,trim_width_mm:spec.trimW,trim_height_mm:spec.trimH,spine_mm:spec.spine,wing_mm:spec.wing,bleed_mm:spec.bleed,
          preset_name:PRESETS[state.preset].name,
          style_request:prompt+'\n'+designDirection+'\n'+designGuardrails+'\nPreferred dominant color: '+($('primaryColor')?.value||'#315c8c')+'.',
          theme_context:themeContext()
        })
      });
      if(!data.image_base64)throw new Error('AI 이미지 결과가 비어 있습니다.');
      const image=new Image();image.src='data:'+(data.mime_type||'image/png')+';base64,'+data.image_base64;await waitForImage(image);
      if(state.backgroundSource==='upload'&&state.backgroundUrl?.startsWith('blob:'))URL.revokeObjectURL(state.backgroundUrl);
      state.background=image;state.backgroundUrl=image.src;state.backgroundSource='ai';state.generatedSpecKey=specKey(spec);
      state.lastGeneratedPrompt=prompt;
      state.lastGeneratedPresetName=PRESETS[state.preset].name;
      if($('backgroundInput'))$('backgroundInput').value='';
      if($('backgroundName'))$('backgroundName').textContent='AI 생성 배경';
      if($('clearBackground'))$('clearBackground').hidden=false;
      $('exportBtn').disabled=false;scheduleRender();
      updateProgress();
      setStatus('AI 배경 생성 완료',spec.coverMode==='front'?'앞표지 배경과 문구 레이어를 자유롭게 편집할 수 있습니다.':'문구는 별도 레이어로 유지됩니다. 문구나 색상을 수정하면 미리보기에 바로 반영됩니다.','ok');
      finishGenerationProgress(true);
    }catch(error){
      const debug=['HTTP: '+(error.status||'unknown'),'code: '+(error.code||'unknown'),'request_id: '+(error.requestId||'none'),'transport: '+(error.transport||'direct-function'),error.raw?'response: '+error.raw:''].filter(Boolean).join('\n');
      setStatus('AI 배경 생성 실패',error.message||'AI 표지 생성 요청에 실패했습니다.','error',debug);
      finishGenerationProgress(false);
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
    drawBackgroundImage(ctx,state.background,w,h);
    state.shapes.forEach(shape=>drawShape(ctx,shape,ppm));
    drawLogo(ctx,spec,ppm);
    const color=$('textColor')?.value||'#ffffff';
    textLayout(spec,ppm).forEach(item=>drawTextItem(ctx,item,color,item.fontPt*EXPORT_DPI/72));
    if($('cropMarkToggle')?.checked)drawCropMarks(ctx,spec,ppm);
    return {canvas,spec,w,h};
  }

  async function exportPng(){
    if(!state.background){setStatus('배경을 먼저 준비해 주세요.','AI 배경을 생성하거나 직접 만든 표지 이미지를 불러와야 300dpi로 저장할 수 있습니다.','error');return;}
    const spec=currentSpec();
    if(state.generatedSpecKey!==specKey(spec)){setStatus('규격이 변경되었습니다.','현재 규격으로 AI 배경을 다시 생성하거나 직접 만든 표지 이미지를 다시 불러온 뒤 저장해 주세요.','error');return;}
    const button=$('exportBtn');button.disabled=true;
    setStatus('300dpi PNG를 만들고 있습니다.','배경·문구·책등·로고'+($('cropMarkToggle')?.checked?'·재단선':'')+'을 실제 인쇄 크기로 합성하는 중입니다.','busy');
    try{
      const {canvas}=await buildExportCanvas();
      const raw=await canvasBlob(canvas),png=await withPngDpi(raw,EXPORT_DPI),url=URL.createObjectURL(png),a=document.createElement('a');
      a.href=url;a.download=(spec.coverMode==='front'?'front-cover-'+spec.trimW+'x'+spec.trimH:'cover-'+spec.trimW+'x'+spec.trimH+'-spine-'+spec.spine+'mm')+'-300dpi.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
      setStatus('PNG 저장 완료',spec.coverMode==='front'?'앞표지 실제 규격과 300dpi 메타데이터로 저장했습니다.':'실제 전체 펼침 규격과 300dpi 메타데이터로 이미지를 저장했습니다.','ok');
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
    if(!state.background){setStatus('배경을 먼저 준비해 주세요.','AI 배경을 생성하거나 직접 만든 표지 이미지를 불러와야 PDF로 저장할 수 있습니다.','error');return;}
    const spec=currentSpec();
    if(state.generatedSpecKey!==specKey(spec)){setStatus('규격이 변경되었습니다.','현재 규격으로 AI 배경을 다시 생성하거나 직접 만든 표지 이미지를 다시 불러온 뒤 저장해 주세요.','error');return;}
    const button=$('exportBtn');button.disabled=true;
    setStatus('인쇄용 PDF를 만들고 있습니다.','300dpi 디자인을 실제 전체 펼침 크기의 1페이지 PDF로 만드는 중입니다.','busy');
    try{
      const {canvas,w,h}=await buildExportCanvas();
      const jpegBlob=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('PDF용 이미지 데이터를 만들지 못했습니다.')),'image/jpeg',.98));
      const jpeg=new Uint8Array(await jpegBlob.arrayBuffer());
      const pdf=pdfFromJpeg(jpeg,w,h,spec.workW*72/25.4,spec.workH*72/25.4),url=URL.createObjectURL(pdf),a=document.createElement('a');
      a.href=url;a.download=(spec.coverMode==='front'?'front-cover-'+spec.trimW+'x'+spec.trimH:'cover-'+spec.trimW+'x'+spec.trimH+'-spine-'+spec.spine+'mm')+'-300dpi.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
      setStatus('PDF 저장 완료',spec.coverMode==='front'?'앞표지 실제 규격의 인쇄용 PDF로 저장했습니다.':'전체 펼침 실제 규격의 인쇄용 PDF로 저장했습니다.','ok');
    }catch(error){setStatus('PDF 저장 실패',error.message||'PDF 저장 중 오류가 발생했습니다.','error');}
    finally{button.disabled=false;}
  }

  function exportDesign(){return $('exportFormat')?.value==='pdf'?exportPdf():exportPng();}
  function syncExportButton(){if($('exportBtn'))$('exportBtn').textContent=$('exportFormat')?.value==='pdf'?'300dpi PDF 저장':'300dpi PNG 저장';}

  function galleryDateText(value){
    const date=value?.toDate?.()||null;
    if(!date)return '방금 저장';
    return date.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function galleryErrorDebug(error,stage=''){
    return [
      stage?'단계: '+stage:'',
      error?.code?'code: '+error.code:'',
      error?.name?'name: '+error.name:'',
      error?.message?'message: '+error.message:'',
      error?.serverResponse?'response: '+String(error.serverResponse).slice(0,1200):''
    ].filter(Boolean).join('\n');
  }

  async function buildGalleryPreviewBlob(){
    if(!state.background)throw new Error('저장할 표지 디자인이 없습니다.');
    const spec=currentSpec(),maxEdge=1600;
    const scale=Math.min(maxEdge/spec.workW,maxEdge/spec.workH);
    const w=Math.max(320,Math.round(spec.workW*scale)),h=Math.max(320,Math.round(spec.workH*scale));
    await document.fonts?.ready;
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');
    drawBackgroundImage(ctx,state.background,w,h);
    state.shapes.forEach(shape=>drawShape(ctx,shape,scale));
    drawLogo(ctx,spec,scale);
    const color=$('textColor')?.value||'#ffffff';
    textLayout(spec,scale).forEach(item=>drawTextItem(ctx,item,color));
    return new Promise((resolve,reject)=>canvas.toBlob(
      blob=>blob?resolve(blob):reject(new Error('보관함용 미리보기 이미지를 만들지 못했습니다.')),
      'image/jpeg',.88
    ));
  }

  async function saveCurrentDesignToGallery(){
    const spec=currentSpec(),user=window.auth?.currentUser,button=$('saveGalleryBtn');
    if(!user){setStatus('로그인이 필요합니다.','디자인 보관함은 로그인 후 사용할 수 있습니다.','error');return;}
    if(!window.storage||!window.db){setStatus('보관함 연결을 사용할 수 없습니다.','Firebase 저장 연결을 확인해 주세요.','error','stage: initialize\nstorage: '+Boolean(window.storage)+'\nfirestore: '+Boolean(window.db));return;}
    if(!state.background||state.generatedSpecKey!==specKey(spec)){setStatus('저장할 디자인이 없습니다.','현재 규격에 맞는 디자인을 먼저 생성해 주세요.','error');return;}
    const title=String($('title')?.value||'').trim()||'제목 없는 표지';
    const prompt=String(state.lastGeneratedPrompt||$('stylePrompt')?.value||presetPrompt()).trim().slice(0,5000);
    const designId='design_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);
    const imagePath='ai_design_gallery/'+user.uid+'/'+designId+'/preview.jpg';
    const imageRef=window.storage.ref(imagePath);
    const docRef=window.db.collection('users').doc(user.uid).collection('ai_design_gallery').doc(designId);
    if(button){button.disabled=true;button.textContent='저장 중...';}
    setStatus('디자인을 보관함에 저장하고 있습니다.','완성된 표지 이미지와 디자인 요청문구를 함께 저장하는 중입니다.','busy');
    let uploaded=false,stage='인증 갱신';
    try{
      await user.getIdToken(true);
      stage='미리보기 생성';
      const blob=await buildGalleryPreviewBlob();
      stage='미리보기 업로드';
      await imageRef.put(blob,{
        contentType:'image/jpeg',
        customMetadata:{ownerUid:user.uid,purpose:'ai-design-gallery-preview',designId}
      });
      uploaded=true;
      stage='보관함 기록 저장';
      const createdAt=firebase.firestore.Timestamp.now();
      await docRef.set({
        id:designId,
        title:title.slice(0,180),
        prompt,
        presetId:String(state.preset||'').slice(0,80),
        presetName:String(state.lastGeneratedPresetName||PRESETS[state.preset]?.name||'').slice(0,120),
        coverMode:spec.coverMode,
        qualityMode:state.generationQuality,
        trimWidth:spec.trimW,
        trimHeight:spec.trimH,
        imagePath,
        createdAt
      });
      stage='저장 결과 확인';
      const verified=await docRef.get();
      if(!verified.exists)throw Object.assign(new Error('저장한 디자인 기록을 다시 확인하지 못했습니다.'),{code:'gallery/verify-failed'});
      setStatus('디자인 보관함에 저장했습니다.','저장 기록을 다시 확인했습니다. 디자인 보관함에서 바로 확인할 수 있습니다.','ok');
      await openGallery(true);
    }catch(error){
      if(uploaded)try{await imageRef.delete();}catch(_){}
      setStatus('디자인 저장 실패',error.message||'보관함 저장 중 오류가 발생했습니다.','error',galleryErrorDebug(error,stage));
    }finally{
      if(button){button.textContent='현재 디자인 저장';button.disabled=!state.background||state.generatedSpecKey!==specKey(currentSpec());}
    }
  }

  function closeGallery(){
    if($('galleryModal'))$('galleryModal').hidden=true;
  }

  function closeGalleryDetail(){
    if($('galleryDetailModal'))$('galleryDetailModal').hidden=true;
    if($('galleryDetailImage'))$('galleryDetailImage').removeAttribute('src');
  }

  function openGalleryDetail(item){
    if(!item)return;
    if($('galleryDetailImage'))$('galleryDetailImage').src=item.imageUrl||'';
    if($('galleryDetailTitle'))$('galleryDetailTitle').textContent=item.title||'저장된 디자인';
    if($('galleryDetailMeta'))$('galleryDetailMeta').textContent=[
      item.presetName||'',
      item.coverMode==='front'?'앞표지만':'전체 펼침',
      (item.trimWidth&&item.trimHeight)?item.trimWidth+'×'+item.trimHeight+'mm':'',
      galleryDateText(item.createdAt)
    ].filter(Boolean).join(' · ');
    if($('galleryDetailPrompt'))$('galleryDetailPrompt').textContent=item.prompt||'요청문구 없음';
    if($('galleryDetailModal'))$('galleryDetailModal').hidden=false;
  }

  function renderGallery(query=''){
    const root=$('galleryGrid'),empty=$('galleryEmpty'),count=$('galleryCount');
    if(!root)return;
    const needle=String(query||'').trim().toLowerCase();
    const items=state.galleryItems.filter(item=>{
      const hay=[item.title,item.prompt,item.presetName,item.coverMode].join(' ').toLowerCase();
      return !needle||hay.includes(needle);
    });
    root.replaceChildren();
    if(count)count.textContent=items.length+'개';
    if(empty)empty.hidden=items.length>0;
    items.forEach(item=>{
      const card=document.createElement('button');
      card.type='button';card.className='gallery-card';
      const imageWrap=document.createElement('span');imageWrap.className='gallery-card-image';
      if(item.imageUrl){
        const image=document.createElement('img');image.loading='lazy';image.alt=(item.title||'저장된 표지')+' 미리보기';image.src=item.imageUrl;
        imageWrap.appendChild(image);
      }else{
        const missing=document.createElement('span');missing.className='gallery-card-no-image';missing.textContent='미리보기 없음';
        imageWrap.appendChild(missing);
      }
      const copy=document.createElement('span');copy.className='gallery-card-copy';
      const title=document.createElement('strong');title.textContent=item.title||'제목 없는 표지';
      const prompt=document.createElement('p');prompt.textContent=item.prompt||'요청문구 없음';
      const meta=document.createElement('span');meta.textContent=[item.presetName||'',galleryDateText(item.createdAt)].filter(Boolean).join(' · ');
      copy.append(title,prompt,meta);card.append(imageWrap,copy);
      card.addEventListener('click',()=>openGalleryDetail(item));
      root.appendChild(card);
    });
  }

  async function loadGallery(){
    const user=window.auth?.currentUser;
    if(!user||!window.db)throw new Error('디자인 보관함 데이터 연결을 사용할 수 없습니다.');
    try{await user.getIdToken();}catch(_){}
    let snapshot;
    try{
      snapshot=await window.db.collection('users').doc(user.uid).collection('ai_design_gallery')
        .orderBy('createdAt','desc').limit(100).get();
    }catch(error){
      if(!['failed-precondition','unimplemented'].includes(String(error?.code||'')))throw error;
      snapshot=await window.db.collection('users').doc(user.uid).collection('ai_design_gallery').limit(100).get();
    }
    const items=await Promise.all(snapshot.docs.map(async doc=>{
      const item={id:doc.id,...doc.data(),imageUrl:'',previewError:''};
      if(window.storage&&item.imagePath){
        try{item.imageUrl=await window.storage.ref(item.imagePath).getDownloadURL();}
        catch(error){item.previewError=String(error?.code||error?.message||'preview-unavailable');}
      }
      return item;
    }));
    items.sort((a,b)=>{
      const at=a.createdAt?.toMillis?.()||0,bt=b.createdAt?.toMillis?.()||0;
      return bt-at;
    });
    state.galleryItems=items;
    renderGallery($('gallerySearch')?.value||'');
  }

  async function openGallery(forceReload=false){
    if($('galleryModal'))$('galleryModal').hidden=false;
    if(!state.galleryItems.length||forceReload){
      if($('galleryGrid'))$('galleryGrid').replaceChildren();
      if($('galleryEmpty')){$('galleryEmpty').hidden=false;$('galleryEmpty').textContent='보관함을 불러오는 중입니다.';}
      try{
        await loadGallery();
        if($('galleryEmpty'))$('galleryEmpty').textContent='저장한 디자인이 없습니다.';
      }catch(error){
        if($('galleryEmpty')){$('galleryEmpty').hidden=false;$('galleryEmpty').textContent='보관함을 불러오지 못했습니다.';}
        setStatus('디자인 보관함 불러오기 실패',error.message||'잠시 후 다시 시도해 주세요.','error',galleryErrorDebug(error,'보관함 목록 조회'));
      }
    }else renderGallery($('gallerySearch')?.value||'');
  }

  function resetAll(){
    if(!confirm('입력한 문구와 설정을 초기화할까요?'))return;
    try{localStorage.removeItem(STORAGE_KEY);}catch(_){}
    location.reload();
  }

  async function loadBackground(file){
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){
      setStatus('지원하지 않는 표지 이미지입니다.','PNG, JPEG, WEBP만 사용할 수 있습니다.','error');return;
    }
    const url=URL.createObjectURL(file),image=new Image();image.src=url;
    try{
      await waitForImage(image);
      if(state.backgroundSource==='upload'&&state.backgroundUrl?.startsWith('blob:'))URL.revokeObjectURL(state.backgroundUrl);
      state.background=image;state.backgroundUrl=url;state.backgroundSource='upload';state.generatedSpecKey=specKey(currentSpec());
      state.lastGeneratedPrompt=String($('stylePrompt')?.value||presetPrompt()).trim();
      state.lastGeneratedPresetName=PRESETS[state.preset]?.name||'직접 배경';
      if($('backgroundName'))$('backgroundName').textContent=file.name;
      if($('clearBackground'))$('clearBackground').hidden=false;
      if($('exportBtn'))$('exportBtn').disabled=false;
      scheduleRender();updateProgress();
      const spec=currentSpec();
      setStatus('직접 만든 표지를 배치했습니다.',spec.coverMode==='front'?'앞표지 이미지를 도련 포함 전체 영역에 꽉 채워 배치했습니다.':'이미지는 바깥 적색선 전체 영역을 꽉 채우고, 문구 레이어는 그 위에서 자유롭게 편집할 수 있습니다.','ok');
    }catch(error){
      URL.revokeObjectURL(url);
      setStatus('표지 이미지를 읽지 못했습니다.',error.message||'이미지 파일을 확인해 주세요.','error');
    }
  }

  function clearBackground(){
    if(state.backgroundSource==='upload'&&state.backgroundUrl?.startsWith('blob:'))URL.revokeObjectURL(state.backgroundUrl);
    state.background=null;state.backgroundUrl='';state.backgroundSource='';state.generatedSpecKey='';
    if($('backgroundInput'))$('backgroundInput').value='';
    if($('backgroundName'))$('backgroundName').textContent='없음';
    if($('clearBackground'))$('clearBackground').hidden=true;
    if($('exportBtn'))$('exportBtn').disabled=true;
    if($('saveGalleryBtn'))$('saveGalleryBtn').disabled=true;
    scheduleRender();updateProgress();
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
    loadLocal();setupPresetCards();syncCoverMode();syncSizeMode();syncGenerationQuality();syncSpineTitle();renderCustomFields();syncPromptLanguageUi(false);syncGlobalCmykFromHex('primaryColor');syncGlobalCmykFromHex('textColor');syncTextEditUi();syncExportButton();
    if(!$('stylePrompt').value)$('stylePrompt').value=presetPrompt();
    qa('.size-chip').forEach(button=>button.addEventListener('click',()=>{
      state.sizeMode=button.dataset.sizeId||'custom';
      if(state.sizeMode!=='custom'&&button.dataset.size){
        const [w,h]=button.dataset.size.split(',');
        $('trimW').value=w;$('trimH').value=h;
      }
      syncSizeMode();saveLocal();updateGeometry();scheduleRender();
      if(state.sizeMode==='custom')requestAnimationFrame(()=>$('trimW')?.focus());
    }));
    qa('input[name="coverMode"]').forEach(input=>input.addEventListener('change',()=>{
      state.coverMode=input.value==='front'?'front':'spread';
      clearSelection();
      if(state.background){
        state.generatedSpecKey='';
        if($('exportBtn'))$('exportBtn').disabled=true;
        setStatus('표지 범위가 변경되었습니다.','새 범위에 맞게 AI 배경을 다시 생성하거나 표지 이미지를 다시 불러와 주세요.','busy');
      }
      syncCoverMode();saveLocal();
    }));
    qa('input[name="generationQuality"]').forEach(input=>input.addEventListener('change',()=>{
      state.generationQuality=input.value==='high'?'high':'standard';
      syncGenerationQuality();saveLocal();
    }));
    const watched=['trimW','trimH','spine','bleed','safeZone','wingW','title','backText','spineTop','spineMiddle','spineBottom','spineOrientation','visualMode','colorIntensity','designMood','primaryColor','textColor','theme','stylePrompt'];
    watched.forEach(id=>$(id)?.addEventListener('input',()=>{
      if(id==='trimW'||id==='trimH'){state.sizeMode='custom';syncSizeMode();}
      if(['title','backText','spineTop','spineMiddle','spineBottom'].includes(id))clearTextOverrideForSource(id);
      if(id==='spineMiddle'&&$('spineSync')?.checked)$('spineSync').checked=false;
      if(id==='title')syncSpineTitle();
      saveLocal();updateProgress();syncTextEditUi();scheduleRender();
    }));
    SPINE_TEXT_IDS.forEach(id=>{
      const control=$(id+'Placement');
      control?.addEventListener('change',()=>{
        const layout=textLayoutState(id,'center');
        if(control.value!=='free'){
          control.value='auto';
          layout.dx=0;
          layout.dy=0;
          layout.boxAlign='';
        }
        saveLocal();syncTextEditUi();scheduleRender();
      });
    });
    $('wingEnabled')?.addEventListener('change',()=>{syncWing();saveLocal();scheduleRender();});
    $('spineSync')?.addEventListener('change',()=>{syncSpineTitle();saveLocal();updateProgress();scheduleRender();});
    $('manualBtn')?.addEventListener('click',event=>window.ProgramManualHomeModal?.open('ai-design-maker',event.currentTarget));
    $('aiDesignSessionSaveBtn')?.addEventListener('click',saveSessionNow);
    $('aiDesignSessionLoadBtn')?.addEventListener('click',loadSessionNow);
    qa('[data-jump]').forEach(button=>button.addEventListener('click',()=>jumpToSection(button.dataset.jump)));
    $('guideToggle')?.addEventListener('change',scheduleRender);
    $('cropMarkToggle')?.addEventListener('change',scheduleRender);
    $('generateBtn')?.addEventListener('click',generate);
    $('galleryBtn')?.addEventListener('click',()=>openGallery(false));
    $('saveGalleryBtn')?.addEventListener('click',saveCurrentDesignToGallery);
    $('galleryRefreshBtn')?.addEventListener('click',()=>openGallery(true));
    $('gallerySearch')?.addEventListener('input',event=>renderGallery(event.target.value));
    qa('[data-gallery-close]').forEach(node=>node.addEventListener('click',closeGallery));
    qa('[data-gallery-detail-close]').forEach(node=>node.addEventListener('click',closeGalleryDetail));
    $('exportBtn')?.addEventListener('click',exportDesign);
    $('exportFormat')?.addEventListener('change',syncExportButton);
    $('addFrontTextBtn')?.addEventListener('click',()=>addCustomField('front'));
    $('addBackTextBtn')?.addEventListener('click',()=>addCustomField('back'));
    qa('input[name="promptLanguage"]').forEach(input=>input.addEventListener('change',()=>{
      const previous=state.promptLanguage;
      const oldDefaults=Object.keys(PRESETS).flatMap(id=>[PRESETS[id].prompt,PRESET_PROMPTS_KO[id]]);
      const current=String($('stylePrompt')?.value||'').trim();
      state.promptLanguage=input.value==='en'?'en':'ko';
      syncPromptLanguageUi(!current||oldDefaults.includes(current));
      saveLocal();updateProgress();
      if(previous!==state.promptLanguage)scheduleRender();
    }));
    qa('[data-add-shape]').forEach(button=>button.addEventListener('click',()=>createShape(button.dataset.addShape)));
    qa('[data-decoration-template]').forEach(button=>button.addEventListener('click',()=>createDecorationTemplate(button.dataset.decorationTemplate)));
    $('deleteShapeBtn')?.addEventListener('click',deleteSelectedShape);
    $('shapeStrokeWidth')?.addEventListener('input',event=>{const shape=selectedShape();if(!shape)return;shape.strokeWidth=clamp(event.target.value,.1,12,.5);saveLocal();scheduleRender();});
    $('shapeOpacity')?.addEventListener('input',event=>{const shape=selectedShape();if(!shape)return;shape.opacity=clamp(Number(event.target.value)/100,0,1,1);saveLocal();scheduleRender();});
    $('shapeStrokeTransparent')?.addEventListener('change',event=>{const shape=selectedShape();if(!shape||shape.type==='line')return;shape.strokeEnabled=!event.target.checked;saveLocal();scheduleRender();});
    qa('.color-bar-input').forEach(input=>input.addEventListener('input',()=>{
      const group=input.closest('[data-color-group]')?.dataset.colorGroup;if(group)applyColorChoice(group,input.value);
    }));
    qa('[data-color-preset]').forEach(button=>button.addEventListener('click',()=>{
      const group=button.dataset.colorGroup,hex=button.dataset.colorPreset,picker=CMYK_GROUPS[group]?$(CMYK_GROUPS[group].prefix+'ColorPicker'):null;
      if(picker)picker.value=hex;if(group&&hex)applyColorChoice(group,hex);
    }));
    qa('[data-multi-align]').forEach(button=>button.addEventListener('click',()=>alignSelectedElements(button.dataset.multiAlign)));
    $('groupSelectionBtn')?.addEventListener('click',groupSelectedElements);
    $('ungroupSelectionBtn')?.addEventListener('click',ungroupSelectedElements);
    qa('[data-box-align]').forEach(button=>button.addEventListener('click',()=>alignSelectedTextBox(button.dataset.boxAlign)));
    qa('[data-text-align]').forEach(button=>button.addEventListener('click',()=>{
      if(!state.selectedTextId)return;
      textLayoutState(state.selectedTextId).align=button.dataset.textAlign;
      syncTextEditUi();saveLocal();scheduleRender();
    }));
    $('selectedTextValue')?.addEventListener('input',event=>setSelectedTextContent(event.target.value));
    $('selectedFontFamily')?.addEventListener('change',event=>{
      if(!state.selectedTextId)return;
      textLayoutState(state.selectedTextId).fontFamily=normalizeFontFamily(event.target.value);
      saveLocal();syncTextEditUi();scheduleRender();
    });
    $('selectedFontSize')?.addEventListener('input',event=>{
      if(!state.selectedTextId)return;
      const layout=textLayoutState(state.selectedTextId);
      layout.fontSizePt=clamp(event.target.value,4,160,10);layout.fontScale=1;
      saveLocal();scheduleRender();
    });
    $('selectedFontWeight')?.addEventListener('change',event=>{
      if(!state.selectedTextId)return;
      textLayoutState(state.selectedTextId).fontWeight=normalizeFontWeight(event.target.value)||700;
      saveLocal();syncTextEditUi();scheduleRender();
    });
    $('selectedLineHeight')?.addEventListener('input',event=>{
      if(!state.selectedTextId)return;
      textLayoutState(state.selectedTextId).lineHeight=clamp(event.target.value,.8,2.2,1.2);
      saveLocal();scheduleRender();
    });
    $('resetTextLayout')?.addEventListener('click',resetSelectedTextLayout);
    bindTextCanvasEditing();
    $('resetBtn')?.addEventListener('click',resetAll);
    $('backgroundInput')?.addEventListener('change',event=>loadBackground(event.target.files?.[0]));
    $('clearBackground')?.addEventListener('click',clearBackground);
    $('logoInput')?.addEventListener('change',event=>loadLogo(event.target.files?.[0]));
    $('clearLogo')?.addEventListener('click',clearLogo);
    $('logoutBtn')?.addEventListener('click',()=>window.auth?.signOut().then(()=>location.replace('/')));
    window.addEventListener('resize',()=>scheduleRender());
    window.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        if(!$('galleryDetailModal')?.hidden)closeGalleryDetail();
        else if(!$('galleryModal')?.hidden)closeGallery();
        else{clearSelection();state.snapGuide=null;syncTextEditUi();scheduleRender();}
        return;
      }
      const target=event.target,typing=target&&(target.matches?.('input,textarea,select')||target.isContentEditable);if(typing)return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='g'){
        event.preventDefault();if(event.shiftKey)ungroupSelectedElements();else groupSelectedElements();return;
      }
      if((event.key==='Delete'||event.key==='Backspace')&&selectionCount()){event.preventDefault();deleteSelectedElements();return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||!selectionCount())return;
      const step=event.shiftKey?1:.2,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
      event.preventDefault();nudgeSelectedElements(dx,dy);
    });
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
        STORAGE_KEY=STORAGE_KEY_PREFIX+':'+user.uid;
        try{localStorage.removeItem(LEGACY_STORAGE_KEY);}catch(_){}
        gate.hidden=true;shell.hidden=false;bind();
      }catch(error){message.textContent='사용 권한을 확인하지 못했습니다. 잠시 후 새로고침해 주세요.';login.hidden=false;}
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',authorize,{once:true});else authorize();
})();
