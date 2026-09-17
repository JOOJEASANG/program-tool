/* Unified Design Review / AI Cover Maker — shared preview canvas + overlay editor. */
'use strict';

(() => {
  if (window.__designCoverMakerV3) return;
  window.__designCoverMakerV3 = true;

  const EXPORT_DPI = 300;
  const MAX_EXPORT_PIXELS = 60_000_000;
  const PRESETS = Object.freeze({
    public: { name: '공공기관·교육청', text: '한국 공공기관·교육청의 고급 보고서 표지처럼 신뢰감 있고 정돈된 디자인. 넓은 여백, 절제된 기하학 요소, 명확한 정보 위계, 안정적인 그리드와 세련된 색 조합을 사용한다. 행정문서처럼 딱딱하지 않으면서도 공신력과 전문성이 느껴지게 하고, 값싼 템플릿이나 행사 전단 느낌은 피한다.' },
    premium: { name: '미니멀 프리미엄 리포트', text: '프리미엄 컨설팅 리포트와 현대적인 편집 디자인을 결합한 표지. 충분한 네거티브 스페이스, 정교한 균형, 절제된 그래픽, 깊이감 있는 단색 또는 두세 가지 색의 조합을 사용한다. 앞표지는 강한 시각적 중심을 갖되 장식은 최소화하고, 뒤표지와 책등까지 하나의 완성도 높은 시스템으로 연결한다.' },
    warm: { name: '따뜻한 교육·사례집', text: '교육, 성장, 협력, 지역공동체의 분위기를 따뜻하고 현대적으로 표현한다. 밝고 부드러운 색감과 유기적이지만 정돈된 형태를 사용하고, 친근하되 유치하지 않게 한다. 학교·교육기관 사례집에 어울리는 깨끗한 인쇄물 감성과 충분한 여백을 유지한다.' },
    forum: { name: '트렌디 포럼·행사 자료집', text: '포럼, 세미나, 워크숍 자료집에 맞는 현대적이고 감각적인 에디토리얼 표지. 역동적인 그래픽 리듬과 대담한 면 분할 또는 추상 그래픽을 사용하되, 전체 구조는 절제되고 전문적으로 유지한다. 흔한 행사 포스터처럼 산만하거나 과장된 효과는 피하고, 인쇄물로서 고급스럽게 마감한다.' },
    admin: { name: '차분한 행정·업무문서', text: '행정·업무용 보고서에 적합한 차분하고 안정적인 표지. 낮은 장식 밀도, 분명한 구조, 절제된 색상과 단정한 시각 흐름을 사용한다. 공식 문서의 신뢰성을 유지하면서도 구식 서식처럼 보이지 않도록 현대적인 편집 감각과 섬세한 배경 그래픽을 적용한다.' },
  });

  const state = { preview: 'review', imageUrl: '', imageMeta: null, image: null, generatedSpecKey: '', resizeTimer: 0 };
  const $ = (id) => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max, fallback = min) => {
    const number = Number(value);
    const safe = Number.isFinite(number) ? number : fallback;
    return Math.max(min, Math.min(max, safe));
  };
  const checker = () => (typeof PrintChecker !== 'undefined' ? PrintChecker : null);
  const valueOf = (id, fallback = 0) => {
    const node = $(id);
    return node && String(node.value ?? '').trim() !== '' ? Number(node.value) : fallback;
  };

  function ensureCoverProduct() {
    const product = checker()?.getState?.().product;
    if (product === 'cover') return true;
    checker()?.selectProduct?.('cover');
    setTimeout(() => {
      try { window.DesignReviewGeometry?.apply?.({ force: false }); } catch (_) {}
      updateGeometrySummary();
    }, 0);
    return false;
  }

  function currentSpec() {
    const trimW = clamp(valueOf('trimW', 210), 50, 1000, 210);
    const trimH = clamp(valueOf('trimH', 297), 50, 1000, 297);
    const spine = clamp(valueOf('spine', 0), 0, 100, 0);
    const bleed = clamp(valueOf('bleed', 3), 0, 20, 3);
    const safeZone = clamp(valueOf('safeZone', 3), 0, 80, 3);
    const hasWing = Boolean($('hasWing')?.checked);
    const wing = hasWing ? clamp(valueOf('wingW', 0), 0, 300, 0) : 0;
    return { trimW, trimH, spine, bleed, safeZone, hasWing, wing, workW: trimW * 2 + spine + wing * 2 + bleed * 2, workH: trimH + bleed * 2 };
  }

  function specKey(spec = currentSpec()) {
    return [spec.trimW, spec.trimH, spec.spine, spec.bleed, spec.safeZone, spec.wing].map((value) => Number(value).toFixed(2)).join('|');
  }

  function specSummary(spec = currentSpec()) {
    const wingText = spec.wing > 0 ? ` · 날개 ${spec.wing.toFixed(1)}mm×2` : '';
    return `완성 ${spec.trimW.toFixed(1)}×${spec.trimH.toFixed(1)}mm · 책등 ${spec.spine.toFixed(1)}mm · 도련 ${spec.bleed.toFixed(1)}mm · 안전 ${spec.safeZone.toFixed(1)}mm${wingText}`;
  }

  function installToolbar() {
    if ($('coverMakerToolbar')) return;
    const zoom = $('previewZoomToolbar');
    if (!zoom) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'coverMakerToolbar';
    toolbar.className = 'cover-maker-toolbar';
    toolbar.innerHTML = `
      <div class="cm-toolbar-copy"><strong id="cmPreviewLabel">검토 미리보기</strong><span id="cmToolbarMeta">검토 옵션을 그대로 AI 표지 제작에 사용합니다.</span></div>
      <div class="cm-toolbar-actions">
        <button id="cmReviewPreview" class="cm-tool" type="button" hidden>검토 미리보기</button>
        <button id="cmOpenDialog" class="cm-tool primary" type="button">AI 표지 제작</button>
        <button id="cmRebuild" class="cm-tool" type="button" disabled hidden>배경 다시 생성</button>
        <button id="cmExport" class="cm-tool" type="button" disabled hidden>PNG 300dpi 저장</button>
      </div>`;
    zoom.insertAdjacentElement('afterend', toolbar);
  }

  function installDialog() {
    if ($('coverMakerDialog')) return;
    const dialog = document.createElement('div');
    dialog.id = 'coverMakerDialog';
    dialog.className = 'cover-maker-dialog';
    dialog.hidden = true;
    dialog.innerHTML = `
      <div class="cm-dialog-backdrop" data-cm-close></div>
      <section class="cm-dialog-card" role="dialog" aria-modal="true" aria-labelledby="cmDialogTitle">
        <header class="cm-dialog-head">
          <div><div class="cm-kicker">AI COVER MAKER</div><h2 id="cmDialogTitle">표지 문구 · AI 디자인 설정</h2><p>왼쪽 검토 사양을 그대로 사용합니다. 규격은 여기에서 따로 입력하지 않습니다.</p></div>
          <button class="cm-dialog-close" type="button" aria-label="닫기" data-cm-close>×</button>
        </header>
        <div class="cm-geometry-summary"><strong>적용 중인 검토 옵션</strong><span id="cmGeometryHint"></span></div>
        <div class="cm-dialog-body">
          <div class="cm-dialog-column">
            <section class="cm-group">
              <div class="cm-group-title">앞표지 문구</div>
              <label class="cm-field"><span class="cm-label">제목 <span class="req">*</span></span><input id="cmTitle" class="cm-input" maxlength="180" placeholder="예: 2026 마을교육 운영사례집"></label>
              <label class="cm-field"><span class="cm-label">부제</span><input id="cmSubtitle" class="cm-input" maxlength="220" placeholder="필요한 경우 입력"></label>
              <div class="cm-grid2">
                <label class="cm-field"><span class="cm-label">문서 종류</span><select id="cmDocType" class="cm-select"><option>결과보고서</option><option>운영계획서</option><option>사례집</option><option>자료집</option><option>안내서</option><option>백서</option><option>기타</option></select></label>
                <label class="cm-field"><span class="cm-label">발행일·연도</span><input id="cmDate" class="cm-input" maxlength="80" placeholder="예: 2026. 09."></label>
              </div>
              <label class="cm-field"><span class="cm-label">기관·회사명</span><input id="cmOrg" class="cm-input" maxlength="160" placeholder="예: 천안마을교육 사회적협동조합"></label>
              <label class="cm-field"><span class="cm-label">부서·시리즈명</span><input id="cmDepartment" class="cm-input" maxlength="160" placeholder="선택 입력"></label>
            </section>
            <section class="cm-group">
              <div class="cm-group-title">뒤표지 문구</div>
              <label class="cm-field"><span class="cm-label">소개문·본문</span><textarea id="cmBackText" class="cm-textarea" maxlength="700" placeholder="뒤표지에 넣을 소개문이나 설명"></textarea></label>
              <label class="cm-field"><span class="cm-label">하단 연락처·회사정보</span><textarea id="cmContact" class="cm-textarea" maxlength="360" placeholder="주소, 홈페이지, 문의처 등"></textarea></label>
            </section>
            <section class="cm-group">
              <div class="cm-group-title">책등 문구 <small>검토의 책등 두께 자동 적용</small></div>
              <label class="cm-check"><input id="cmSpineSync" type="checkbox" checked> 앞표지 제목을 책등 제목으로 사용</label>
              <label class="cm-field"><span class="cm-label">책등 제목</span><input id="cmSpineTitle" class="cm-input" maxlength="180"></label>
              <div class="cm-grid2"><label class="cm-field"><span class="cm-label">날짜·연도</span><input id="cmSpineDate" class="cm-input" maxlength="60"></label><label class="cm-field"><span class="cm-label">하단 회사명</span><input id="cmSpineCompany" class="cm-input" maxlength="100"></label></div>
              <label class="cm-field"><span class="cm-label">글자 방향</span><select id="cmSpineOrientation" class="cm-select"><option value="rotate-up">눕힌 글씨 · 아래→위</option><option value="rotate-down">눕힌 글씨 · 위→아래</option><option value="vertical">세로글씨 · 한글 세움</option></select></label>
              <div id="cmSpinePolicy" class="cm-spine-policy"></div>
            </section>
          </div>
          <div class="cm-dialog-column">
            <section class="cm-group">
              <div class="cm-group-title">AI 디자인 <small>프리셋 선택 후 직접 수정</small></div>
              <label class="cm-field"><span class="cm-label">프롬프트 프리셋</span><select id="cmPreset" class="cm-select"></select></label>
              <div class="cm-grid2"><label class="cm-field"><span class="cm-label">배경 주조색</span><input id="cmPrimaryColor" class="cm-color" type="color" value="#1F4E79"></label><label class="cm-field"><span class="cm-label">글자색</span><input id="cmTextColor" class="cm-color" type="color" value="#FFFFFF"></label></div>
              <label class="cm-field"><span class="cm-label">주제·키워드</span><textarea id="cmTheme" class="cm-textarea" maxlength="900" placeholder="예: 교육, 마을, 협력, 성장, 미래"></textarea></label>
              <label class="cm-field"><span class="cm-label">디자인 프롬프트</span><textarea id="cmStyle" class="cm-textarea cm-prompt" maxlength="2200"></textarea></label>
              <div class="cm-hint">AI는 배경만 생성합니다. 정확한 한글 제목·날짜·기관명·책등 문구는 같은 미리보기 캔버스에 별도로 합성합니다.</div>
            </section>
            <section class="cm-group cm-dialog-help"><div class="cm-group-title">현재 캔버스 적용 방식</div><p>검토에서 설정한 완성사이즈, 책등, 도련, 안전영역, 날개 폭을 그대로 사용합니다.</p><p>AI 결과는 별도 작업판이 아니라 현재 검토 미리보기 캔버스에 표시됩니다.</p><p>규격을 바꾸면 캔버스가 즉시 다시 계산되며, 이미 생성한 배경은 새 규격으로 다시 생성하도록 안내합니다.</p></section>
          </div>
        </div>
        <footer class="cm-dialog-foot"><div id="cmStatus" class="cm-status">문구와 디자인 방향을 입력하면 현재 검토 규격으로 생성합니다.</div><div class="cm-dialog-actions"><button type="button" class="cm-tool" data-cm-close>미리보기만 보기</button><button id="cmGenerate" type="button" class="cm-generate">현재 검토 옵션으로 AI 배경 생성</button></div></footer>
      </section>`;
    document.body.appendChild(dialog);
  }

  function populatePresets() {
    const select = $('cmPreset');
    if (!select || select.options.length) return;
    Object.entries(PRESETS).forEach(([value, preset]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = preset.name;
      select.appendChild(option);
    });
    select.value = 'public';
    if ($('cmStyle')) $('cmStyle').value = PRESETS.public.text;
  }

  function updateSpinePolicy(spine) {
    const box = $('cmSpinePolicy');
    if (!box) return;
    box.className = 'cm-spine-policy';
    if (spine < 4) { box.classList.add('is-warn'); box.textContent = '책등 4mm 미만: 글자 인쇄 안정성이 낮아 책등 문구를 미리보기·출력에서 제외합니다.'; }
    else if (spine < 8) { box.classList.add('is-warn'); box.textContent = '책등 4~7.9mm: 제목만 표시하며 날짜와 하단 회사명은 자동 제외됩니다.'; }
    else if (spine < 12) { box.classList.add('is-ok'); box.textContent = '책등 8~11.9mm: 제목과 날짜를 표시합니다. 하단 회사명은 12mm 이상에서 표시합니다.'; }
    else { box.classList.add('is-ok'); box.textContent = '책등 12mm 이상: 제목·날짜·하단 회사명을 모두 배치할 수 있습니다.'; }
  }

  function updateGeometrySummary() {
    const spec = currentSpec();
    if ($('cmGeometryHint')) $('cmGeometryHint').textContent = `${specSummary(spec)} · 전체 펼침 ${spec.workW.toFixed(1)}×${spec.workH.toFixed(1)}mm`;
    if ($('cmToolbarMeta')) {
      const changed = Boolean(state.imageUrl && state.generatedSpecKey && state.generatedSpecKey !== specKey(spec));
      $('cmToolbarMeta').textContent = changed ? `${specSummary(spec)} · 규격 변경됨 — AI 배경 재생성 필요` : specSummary(spec);
      $('cmToolbarMeta').classList.toggle('is-warn', changed);
      if ($('cmExport')) $('cmExport').disabled = !state.imageUrl || changed;
      if ($('cmRebuild')) $('cmRebuild').disabled = !state.imageUrl;
    }
    updateSpinePolicy(spec.spine);
  }

  function openDialog() {
    ensureCoverProduct();
    setPreviewMode('ai');
    updateGeometrySummary();
    const dialog = $('coverMakerDialog');
    if (!dialog) return;
    dialog.hidden = false;
    document.body.classList.add('cm-dialog-open');
    setTimeout(() => $('cmTitle')?.focus(), 30);
  }

  function closeDialog() {
    const dialog = $('coverMakerDialog');
    if (dialog) dialog.hidden = true;
    document.body.classList.remove('cm-dialog-open');
  }

  function setPreviewMode(mode) {
    state.preview = mode === 'ai' ? 'ai' : 'review';
    document.body.classList.toggle('is-cover-preview', state.preview === 'ai');
    if ($('cmPreviewLabel')) $('cmPreviewLabel').textContent = state.preview === 'ai' ? 'AI 표지 미리보기' : '검토 미리보기';
    if ($('cmOpenDialog')) $('cmOpenDialog').textContent = state.preview === 'ai' ? '문구·AI 설정' : 'AI 표지 제작';
    if ($('cmReviewPreview')) $('cmReviewPreview').hidden = state.preview !== 'ai';
    if ($('cmRebuild')) $('cmRebuild').hidden = state.preview !== 'ai';
    if ($('cmExport')) $('cmExport').hidden = state.preview !== 'ai';
    updateGeometrySummary();
    if (state.preview === 'ai') renderAiCanvas();
    else {
      const current = checker()?.getState?.().product || 'cover';
      checker()?.selectProduct?.(current, { syncUrl: false });
    }
  }

  function syncSpineTitle() { if ($('cmSpineSync')?.checked && $('cmSpineTitle')) $('cmSpineTitle').value = $('cmTitle')?.value || ''; }
  function setStatus(message, tone = '') { const node = $('cmStatus'); if (node) { node.textContent = message; node.className = `cm-status${tone ? ` is-${tone}` : ''}`; } }

  function themeContext() {
    return [`문서 종류: ${$('cmDocType')?.value || ''}`, `주제/키워드: ${$('cmTheme')?.value || ''}`, `기관 성격: ${$('cmOrg')?.value || ''}`, `부서/시리즈: ${$('cmDepartment')?.value || ''}`, `선호 주조색: ${$('cmPrimaryColor')?.value || '#1F4E79'}`].filter((value) => !value.endsWith(': ')).join('\n');
  }

  async function authFetch(url, options = {}) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const token = await user.getIdToken();
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || 'AI 표지 생성 요청에 실패했습니다.');
    return data;
  }

  function waitForImage(image) {
    if (!image) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => { image.addEventListener('load', resolve, { once: true }); image.addEventListener('error', resolve, { once: true }); });
  }

  async function generateCover() {
    ensureCoverProduct();
    const title = ($('cmTitle')?.value || '').trim();
    const style = ($('cmStyle')?.value || '').trim();
    if (!title) { setStatus('앞표지 제목을 입력해 주세요.', 'error'); $('cmTitle')?.focus(); return; }
    if (!style) { setStatus('디자인 프롬프트를 선택하거나 입력해 주세요.', 'error'); $('cmStyle')?.focus(); return; }
    const spec = currentSpec();
    const ratio = spec.workW / spec.workH;
    if (ratio < 1 / 3 || ratio > 3) { setStatus('현재 전체 펼침 비율은 이미지 생성 범위를 벗어납니다. 검토 사양의 완성 규격·책등·날개를 확인해 주세요.', 'error'); return; }
    const generate = $('cmGenerate');
    const rebuild = $('cmRebuild');
    if (generate) generate.disabled = true;
    if (rebuild) rebuild.disabled = true;
    setStatus('GPT Image가 현재 검토 옵션 기준으로 전체 펼침 표지 배경을 만들고 있습니다…');
    try {
      const data = await authFetch('/api/preflight/ai-design/cover-image', { method: 'POST', body: JSON.stringify({ trim_width_mm: spec.trimW, trim_height_mm: spec.trimH, spine_mm: spec.spine, wing_mm: spec.wing, bleed_mm: spec.bleed, preset_name: PRESETS[$('cmPreset')?.value]?.name || 'custom', style_request: `${style}\nPreferred dominant color: ${$('cmPrimaryColor')?.value || '#1F4E79'}.`, theme_context: themeContext() }) });
      if (!data.image_base64) throw new Error('AI 이미지 결과가 비어 있습니다.');
      const image = new Image();
      image.src = `data:${data.mime_type || 'image/png'};base64,${data.image_base64}`;
      await waitForImage(image);
      if (!image.naturalWidth) throw new Error('AI 표지 배경을 읽지 못했습니다.');
      state.imageUrl = image.src;
      state.image = image;
      state.imageMeta = data;
      state.generatedSpecKey = specKey(spec);
      setPreviewMode('ai');
      if ($('cmExport')) $('cmExport').disabled = false;
      if ($('cmRebuild')) $('cmRebuild').disabled = false;
      renderAiCanvas();
      setStatus('생성 완료. 레이어 창을 닫아도 같은 검토 미리보기 캔버스에서 결과를 확인할 수 있습니다.', 'ok');
    } catch (error) { setStatus(error?.message || 'AI 표지 생성에 실패했습니다.', 'error'); }
    finally { if (generate) generate.disabled = false; if (rebuild) rebuild.disabled = !state.imageUrl; }
  }

  function textValues() {
    return { title: $('cmTitle')?.value || '', subtitle: $('cmSubtitle')?.value || '', docType: $('cmDocType')?.value || '', date: $('cmDate')?.value || '', org: $('cmOrg')?.value || '', department: $('cmDepartment')?.value || '', backText: $('cmBackText')?.value || '', contact: $('cmContact')?.value || '', spineTitle: $('cmSpineTitle')?.value || '', spineDate: $('cmSpineDate')?.value || '', spineCompany: $('cmSpineCompany')?.value || '', orientation: $('cmSpineOrientation')?.value || 'rotate-up' };
  }

  function titlePt(text, trimW) { let pt = trimW < 140 ? 30 : 42; const length = [...String(text || '')].length; if (length > 18) pt -= 5; if (length > 30) pt -= 5; if (length > 44) pt -= 4; return clamp(pt, 22, 44, 32); }
  function spinePt(spine, text) { let pt = clamp(spine * 0.95 + 4, 8, 15, 9); const length = [...String(text || '')].length; if (length > 18) pt -= 1.5; if (length > 28) pt -= 1.5; return clamp(pt, 7, 15, 8); }

  function computeTextLayout(spec, scale) {
    const value = textValues();
    const bleed = spec.bleed * scale, wing = spec.wing * scale, trimW = spec.trimW * scale, trimH = spec.trimH * scale, spineW = spec.spine * scale;
    const backX = bleed + wing, spineX = backX + trimW, frontX = spineX + spineW;
    const safe = Math.min(spec.safeZone, spec.trimW * 0.15, spec.trimH * 0.15) * scale;
    const ptPx = (pt) => pt * 25.4 / 72 * scale;
    const items = [];
    const add = (item) => { if (String(item.text || '').trim()) items.push(item); };
    add({ text: value.title, x: frontX + safe, y: bleed + trimH * 0.12, w: Math.max(1, trimW - safe * 2), h: trimH * 0.20, fontPt: titlePt(value.title, spec.trimW), weight: 900, align: 'left' });
    add({ text: value.subtitle, x: frontX + safe, y: bleed + trimH * 0.34, w: Math.max(1, trimW - safe * 2), h: trimH * 0.12, fontPt: 17, weight: 700, align: 'left' });
    add({ text: value.docType, x: frontX + safe, y: bleed + trimH * 0.56, w: Math.max(1, trimW - safe * 2), h: trimH * 0.06, fontPt: 11, weight: 800, align: 'left' });
    add({ text: value.date, x: frontX + safe, y: bleed + trimH * 0.62, w: Math.max(1, trimW - safe * 2), h: trimH * 0.06, fontPt: 10, weight: 700, align: 'left' });
    add({ text: value.department, x: frontX + safe, y: bleed + trimH * 0.68, w: Math.max(1, trimW - safe * 2), h: trimH * 0.07, fontPt: 10, weight: 700, align: 'left' });
    add({ text: value.org, x: frontX + safe, y: bleed + trimH * 0.88, w: Math.max(1, trimW - safe * 2), h: trimH * 0.07, fontPt: 11, weight: 850, align: 'left' });
    add({ text: value.backText, x: backX + safe, y: bleed + trimH * 0.16, w: Math.max(1, trimW - safe * 2), h: trimH * 0.58, fontPt: 10.5, weight: 600, align: 'left' });
    add({ text: value.contact, x: backX + safe, y: bleed + trimH * 0.84, w: Math.max(1, trimW - safe * 2), h: trimH * 0.12, fontPt: 9, weight: 750, align: 'left' });
    if (spec.spine >= 4 && value.spineTitle) {
      const fontPt = spinePt(spec.spine, value.spineTitle);
      if (value.orientation === 'vertical') add({ text: value.spineTitle, x: spineX + spineW * 0.12, y: bleed + trimH * 0.18, w: spineW * 0.76, h: trimH * 0.62, fontPt, weight: 900, align: 'center', vertical: true });
      else add({ text: value.spineTitle, x: spineX + spineW / 2 - trimH * 0.31, y: bleed + trimH / 2 - spineW * 0.34, w: trimH * 0.62, h: spineW * 0.68, fontPt, weight: 900, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }
    if (spec.spine >= 8 && value.spineDate) {
      const fontPt = clamp(spinePt(spec.spine, value.spineDate) - 2, 7, 10, 8);
      if (value.orientation === 'vertical') add({ text: value.spineDate, x: spineX + spineW * 0.18, y: bleed + trimH * 0.06, w: spineW * 0.64, h: trimH * 0.10, fontPt, weight: 800, align: 'center', vertical: true });
      else add({ text: value.spineDate, x: spineX + spineW / 2 - trimH * 0.09, y: bleed + trimH * 0.14 - spineW * 0.25, w: trimH * 0.18, h: spineW * 0.5, fontPt, weight: 800, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }
    if (spec.spine >= 12 && value.spineCompany) {
      const fontPt = clamp(spinePt(spec.spine, value.spineCompany) - 3, 7, 9.5, 8);
      if (value.orientation === 'vertical') add({ text: value.spineCompany, x: spineX + spineW * 0.18, y: bleed + trimH * 0.82, w: spineW * 0.64, h: trimH * 0.13, fontPt, weight: 800, align: 'center', vertical: true });
      else add({ text: value.spineCompany, x: spineX + spineW / 2 - trimH * 0.12, y: bleed + trimH * 0.86 - spineW * 0.25, w: trimH * 0.24, h: spineW * 0.5, fontPt, weight: 800, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }
    items.forEach((item) => { item.fontPx = ptPx(item.fontPt); });
    return items;
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align = 'left', maxHeight = Infinity) {
    let cursorY = y;
    String(text || '').split(/\n/).forEach((paragraph) => {
      if (cursorY + lineHeight > y + maxHeight) return;
      const lines = []; let lineText = '';
      [...paragraph].forEach((char) => { const test = lineText + char; if (lineText && ctx.measureText(test).width > maxWidth) { lines.push(lineText); lineText = char; } else lineText = test; });
      if (lineText || !paragraph.length) lines.push(lineText);
      lines.forEach((value) => { if (cursorY + lineHeight > y + maxHeight) return; let drawX = x; if (align === 'center') { ctx.textAlign = 'center'; drawX = x + maxWidth / 2; } else if (align === 'right') { ctx.textAlign = 'right'; drawX = x + maxWidth; } else ctx.textAlign = 'left'; ctx.fillText(value, drawX, cursorY); cursorY += lineHeight; });
      cursorY += lineHeight * 0.12;
    });
  }

  function drawVerticalText(ctx, text, x, y, width, height, lineHeight) { ctx.textAlign = 'center'; let cursorY = y; for (const char of [...String(text || '').replace(/\s+/g, '')]) { if (cursorY + lineHeight > y + height) break; ctx.fillText(char, x + width / 2, cursorY); cursorY += lineHeight; } }

  function drawTextItem(ctx, item, color, fontPxOverride = null) {
    const text = String(item.text || '').trim(); if (!text) return;
    const fontPx = fontPxOverride || item.fontPx;
    ctx.save(); ctx.fillStyle = color; ctx.font = `${item.weight || 700} ${fontPx}px Pretendard, "Noto Sans KR", Arial, sans-serif`; ctx.textBaseline = 'top';
    if (item.vertical) drawVerticalText(ctx, text, item.x, item.y, item.w, item.h, fontPx * 1.14);
    else if (item.rotate) { const cx = item.x + item.w / 2, cy = item.y + item.h / 2; ctx.translate(cx, cy); ctx.rotate(item.rotate * Math.PI / 180); drawWrappedText(ctx, text, -item.w / 2, -item.h / 2, item.w, fontPx * 1.16, item.align || 'center', item.h); }
    else drawWrappedText(ctx, text, item.x, item.y, item.w, fontPx * 1.2, item.align || 'left', item.h);
    ctx.restore();
  }

  function line(ctx, x1, y1, x2, y2, color, dash = []) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore(); }
  function rect(ctx, x, y, w, h, color, dash = []) { ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash(dash); ctx.strokeRect(x, y, w, h); ctx.restore(); }
  function zoneLabel(ctx, text, x, y, w, h) { if (!text || w < 22 || h < 28) return; ctx.save(); ctx.fillStyle = 'rgba(15,23,42,.68)'; ctx.font = '800 9px Pretendard, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + w / 2, y + Math.min(18, h * 0.08)); ctx.restore(); }

  function drawAiGuides(ctx, spec, scale) {
    const bleed = spec.bleed * scale, wing = spec.wing * scale, trimW = spec.trimW * scale, trimH = spec.trimH * scale, spine = spec.spine * scale, safe = spec.safeZone * scale;
    const backX = bleed + wing, spineX = backX + trimW, frontX = spineX + spine, frontWingX = frontX + trimW;
    if (spec.bleed > 0) rect(ctx, 0.5, 0.5, spec.workW * scale - 1, spec.workH * scale - 1, '#ec4899', [7, 5]);
    rect(ctx, backX, bleed, trimW, trimH, '#3b82f6', [6, 4]); rect(ctx, frontX, bleed, trimW, trimH, '#3b82f6', [6, 4]);
    if (safe > 0) { rect(ctx, backX + safe, bleed + safe, Math.max(0, trimW - safe * 2), Math.max(0, trimH - safe * 2), '#22c55e'); rect(ctx, frontX + safe, bleed + safe, Math.max(0, trimW - safe * 2), Math.max(0, trimH - safe * 2), '#22c55e'); }
    if (spine > 0) { line(ctx, spineX, bleed, spineX, bleed + trimH, '#ef4444', [6, 4]); line(ctx, frontX, bleed, frontX, bleed + trimH, '#ef4444', [6, 4]); zoneLabel(ctx, '책등', spineX, bleed, spine, trimH); }
    if (wing > 0) { line(ctx, backX, bleed, backX, bleed + trimH, '#f59e0b', [8, 4]); line(ctx, frontWingX, bleed, frontWingX, bleed + trimH, '#f59e0b', [8, 4]); zoneLabel(ctx, '뒷날개', bleed, bleed, wing, trimH); zoneLabel(ctx, '앞날개', frontWingX, bleed, wing, trimH); }
    zoneLabel(ctx, '뒤표지', backX, bleed, trimW, trimH); zoneLabel(ctx, '앞표지', frontX, bleed, trimW, trimH);
  }

  function drawAiEmpty(ctx, canvas) {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height); gradient.addColorStop(0, '#eef4f8'); gradient.addColorStop(1, '#dce8ef'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#64748b'; ctx.textAlign = 'center'; ctx.font = '800 14px Pretendard, sans-serif'; ctx.fillText('같은 검토 캔버스에서 AI 표지를 미리봅니다', canvas.width / 2, canvas.height / 2 - 10); ctx.font = '600 11px Pretendard, sans-serif'; ctx.fillText('문구·AI 설정을 열어 배경을 생성하세요', canvas.width / 2, canvas.height / 2 + 14); ctx.textAlign = 'left';
  }

  function renderAiCanvas() {
    if (state.preview !== 'ai') return;
    const canvas = $('previewCanvas'), wrap = q('.canvas-wrap'); if (!canvas || !wrap) return;
    const spec = currentSpec(); const width = Math.max(320, Math.floor(wrap.clientWidth || 900) - 36), scale = width / spec.workW, height = Math.max(180, Math.round(spec.workH * scale));
    canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height); if (state.image?.naturalWidth) ctx.drawImage(state.image, 0, 0, width, height); else drawAiEmpty(ctx, canvas);
    drawAiGuides(ctx, spec, scale); const color = $('cmTextColor')?.value || '#FFFFFF'; computeTextLayout(spec, scale).forEach((item) => drawTextItem(ctx, item, color)); updateGeometrySummary();
  }

  function onReviewSpecChanged() { updateGeometrySummary(); if (state.preview === 'ai') requestAnimationFrame(renderAiCanvas); }

  function bindUi() {
    $('cmOpenDialog')?.addEventListener('click', openDialog); $('cmReviewPreview')?.addEventListener('click', () => setPreviewMode('review')); $('cmRebuild')?.addEventListener('click', () => { openDialog(); generateCover(); }); $('cmExport')?.addEventListener('click', exportCoverPng);
    qa('[data-cm-close]', $('coverMakerDialog')).forEach((node) => node.addEventListener('click', closeDialog));
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('coverMakerDialog')?.hidden) closeDialog(); });
    ['cmSubtitle', 'cmDocType', 'cmDate', 'cmOrg', 'cmDepartment', 'cmBackText', 'cmContact', 'cmSpineDate', 'cmSpineCompany', 'cmSpineOrientation', 'cmTextColor'].forEach((id) => $(id)?.addEventListener('input', renderAiCanvas));
    $('cmTitle')?.addEventListener('input', () => { syncSpineTitle(); renderAiCanvas(); });
    $('cmSpineTitle')?.addEventListener('input', () => { if ($('cmSpineSync')?.checked && $('cmSpineTitle').value !== $('cmTitle').value) $('cmSpineSync').checked = false; renderAiCanvas(); });
    $('cmSpineSync')?.addEventListener('change', () => { syncSpineTitle(); renderAiCanvas(); });
    $('cmPreset')?.addEventListener('change', () => { const preset = PRESETS[$('cmPreset').value]; if (preset && $('cmStyle')) $('cmStyle').value = preset.text; });
    $('cmGenerate')?.addEventListener('click', generateCover);
    $('specForm')?.addEventListener('input', () => setTimeout(onReviewSpecChanged, 0)); $('specForm')?.addEventListener('change', () => setTimeout(onReviewSpecChanged, 0));
    $('productGrid')?.addEventListener('click', () => setTimeout(() => { if (checker()?.getState?.().product !== 'cover' && state.preview === 'ai') setPreviewMode('review'); updateGeometrySummary(); }, 0));
    $('runBtn')?.addEventListener('click', () => setPreviewMode('review'), true);
    $('resetBtn')?.addEventListener('click', () => { state.imageUrl = ''; state.imageMeta = null; state.image = null; state.generatedSpecKey = ''; if ($('cmExport')) $('cmExport').disabled = true; if ($('cmRebuild')) $('cmRebuild').disabled = true; setPreviewMode('review'); }, true);
    window.addEventListener('resize', () => { clearTimeout(state.resizeTimer); state.resizeTimer = setTimeout(renderAiCanvas, 80); });
  }

  function crc32(bytes) { let crc = 0xFFFFFFFF; for (let index = 0; index < bytes.length; index += 1) { crc ^= bytes[index]; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); } return (crc ^ 0xFFFFFFFF) >>> 0; }
  function u32(value) { return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]); }
  function readU32(bytes, offset) { return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0; }
  function concatBytes(...parts) { const total = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(total); let offset = 0; parts.forEach((part) => { output.set(part, offset); offset += part.length; }); return output; }
  function pngChunk(typeName, data) { const type = new TextEncoder().encode(typeName); return concatBytes(u32(data.length), type, data, u32(crc32(concatBytes(type, data)))); }

  async function withPngDpi(blob, dpi) {
    const source = new Uint8Array(await blob.arrayBuffer()), signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); if (source.length < 33 || !signature.every((value, index) => source[index] === value)) return blob;
    const ppm = Math.round(dpi / 0.0254), phys = pngChunk('pHYs', concatBytes(u32(ppm), u32(ppm), new Uint8Array([1]))), parts = [source.slice(0, 8)]; let offset = 8, inserted = false;
    while (offset + 12 <= source.length) { const length = readU32(source, offset), end = offset + 12 + length; if (end > source.length) return blob; const type = String.fromCharCode(source[offset + 4], source[offset + 5], source[offset + 6], source[offset + 7]), chunk = source.slice(offset, end); if (type !== 'pHYs') parts.push(chunk); if (type === 'IHDR' && !inserted) { parts.push(phys); inserted = true; } offset = end; if (type === 'IEND') break; }
    if (!inserted) return blob; return new Blob([concatBytes(...parts)], { type: 'image/png' });
  }
  function canvasBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 파일을 만들지 못했습니다.')), 'image/png')); }

  async function exportCoverPng() {
    if (!state.imageUrl || !state.image?.naturalWidth) { setStatus('먼저 AI 표지 배경을 생성해 주세요.', 'error'); openDialog(); return; }
    const spec = currentSpec();
    if (state.generatedSpecKey && state.generatedSpecKey !== specKey(spec)) { setStatus('검토 규격이 변경되었습니다. 현재 옵션으로 AI 배경을 다시 생성한 뒤 저장해 주세요.', 'error'); openDialog(); return; }
    const pxPerMm = EXPORT_DPI / 25.4, width = Math.round(spec.workW * pxPerMm), height = Math.round(spec.workH * pxPerMm), pixels = width * height;
    if (pixels > MAX_EXPORT_PIXELS) { setStatus(`현재 규격은 300dpi에서 ${(pixels / 1_000_000).toFixed(1)}MP입니다. 브라우저 안전 한도를 초과해 저장을 중단했습니다.`, 'error'); openDialog(); return; }
    const button = $('cmExport'); if (button) button.disabled = true; setStatus('실제 300dpi 기준으로 배경과 한글·책등 글자를 합성하고 있습니다…');
    try {
      await document.fonts?.ready; const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('브라우저에서 출력 캔버스를 만들지 못했습니다.');
      ctx.drawImage(state.image, 0, 0, width, height); const color = $('cmTextColor')?.value || '#FFFFFF'; computeTextLayout(spec, pxPerMm).forEach((item) => drawTextItem(ctx, item, color, item.fontPt * EXPORT_DPI / 72));
      const raw = await canvasBlob(canvas), png = await withPngDpi(raw, EXPORT_DPI), url = URL.createObjectURL(png), link = document.createElement('a'); link.href = url; link.download = `cover-${spec.trimW}x${spec.trimH}-spine-${spec.spine}mm-300dpi-${Date.now()}.png`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 4000); setStatus('300dpi 전체 펼침 표지 저장 완료.', 'ok');
    } catch (error) { setStatus(error?.message || 'PNG 저장 중 오류가 발생했습니다.', 'error'); } finally { if (button) button.disabled = false; }
  }

  function boot() {
    installToolbar(); installDialog(); populatePresets(); syncSpineTitle(); bindUi(); updateGeometrySummary();
    window.DesignCoverMaker = Object.freeze({ open: openDialog, review: () => setPreviewMode('review'), preview: () => setPreviewMode('ai'), render: renderAiCanvas, get spec() { return currentSpec(); }, presets: PRESETS, exportDpi: EXPORT_DPI, stage: 'shared-preview-canvas-v3' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();