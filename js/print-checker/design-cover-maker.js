/* Integrated AI cover maker — image background + exact editable print typography. */
'use strict';

(() => {
  if (window.__designCoverMakerV2) return;
  window.__designCoverMakerV2 = true;

  const EXPORT_DPI = 300;
  const MAX_EXPORT_PIXELS = 60_000_000;
  const SAFE_MM = 10;
  const PRESETS = Object.freeze({
    public: {
      name: '공공기관·교육청',
      text: '한국 공공기관·교육청의 고급 보고서 표지처럼 신뢰감 있고 정돈된 디자인. 넓은 여백, 절제된 기하학 요소, 명확한 정보 위계, 안정적인 그리드와 세련된 색 조합을 사용한다. 행정문서처럼 딱딱하지 않으면서도 공신력과 전문성이 느껴지게 하고, 값싼 템플릿이나 행사 전단 느낌은 피한다.',
    },
    premium: {
      name: '미니멀 프리미엄 리포트',
      text: '프리미엄 컨설팅 리포트와 현대적인 편집 디자인을 결합한 표지. 충분한 네거티브 스페이스, 정교한 균형, 절제된 그래픽, 깊이감 있는 단색 또는 두세 가지 색의 조합을 사용한다. 앞표지는 강한 시각적 중심을 갖되 장식은 최소화하고, 뒤표지와 책등까지 하나의 완성도 높은 시스템으로 연결한다.',
    },
    warm: {
      name: '따뜻한 교육·사례집',
      text: '교육, 성장, 협력, 지역공동체의 분위기를 따뜻하고 현대적으로 표현한다. 밝고 부드러운 색감과 유기적이지만 정돈된 형태를 사용하고, 친근하되 유치하지 않게 한다. 학교·교육기관 사례집에 어울리는 깨끗한 인쇄물 감성과 충분한 여백을 유지한다.',
    },
    forum: {
      name: '트렌디 포럼·행사 자료집',
      text: '포럼, 세미나, 워크숍 자료집에 맞는 현대적이고 감각적인 에디토리얼 표지. 역동적인 그래픽 리듬과 대담한 면 분할 또는 추상 그래픽을 사용하되, 전체 구조는 절제되고 전문적으로 유지한다. 흔한 행사 포스터처럼 산만하거나 과장된 효과는 피하고, 인쇄물로서 고급스럽게 마감한다.',
    },
    admin: {
      name: '차분한 행정·업무문서',
      text: '행정·업무용 보고서에 적합한 차분하고 안정적인 표지. 낮은 장식 밀도, 분명한 구조, 절제된 색상과 단정한 시각 흐름을 사용한다. 공식 문서의 신뢰성을 유지하면서도 구식 서식처럼 보이지 않도록 현대적인 편집 감각과 섬세한 배경 그래픽을 적용한다.',
    },
  });

  const state = { mode: 'review', imageUrl: '', imageMeta: null, resizeTimer: 0 };
  const $ = (id) => document.getElementById(id);
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const px = (value) => `${Number(value || 0).toFixed(2)}px`;

  function reviewGeometry() {
    const remembered = window.DesignReviewGeometry?.get?.() || {};
    return {
      trimW: clamp(remembered.trimW || 210, 50, 1000),
      trimH: clamp(remembered.trimH || 297, 50, 1000),
      spine: clamp(remembered.spine || 0, 0, 100),
      bleed: clamp(remembered.bleed ?? 3, 0, 20),
    };
  }

  function currentSpec() {
    const trimW = clamp($('cmTrimW')?.value || 210, 50, 1000);
    const trimH = clamp($('cmTrimH')?.value || 297, 50, 1000);
    const spine = clamp($('cmSpine')?.value || 0, 0, 100);
    const bleed = clamp($('cmBleed')?.value ?? 3, 0, 20);
    return { trimW, trimH, spine, bleed, workW: trimW * 2 + spine + bleed * 2, workH: trimH + bleed * 2 };
  }

  function markReviewUi() {
    $('productGrid')?.closest('.sb-section')?.classList.add('review-only');
    $('specSection')?.classList.add('review-only');
    $('uploadZone')?.closest('.sb-section')?.classList.add('review-only');
    $('adjPanel')?.classList.add('review-only');
    q('.action-row')?.classList.add('review-only');
  }

  function installModeSwitch() {
    if ($('designModeSwitch')) return;
    const nav = q('.sidebar .sb-nav');
    if (!nav) return;
    const wrap = document.createElement('div');
    wrap.id = 'designModeSwitch';
    wrap.className = 'design-mode-switch';
    wrap.innerHTML = `
      <button type="button" class="design-mode-btn is-active" data-design-mode="review">디자인 검토<small>완성 파일·인쇄 사양 확인</small></button>
      <button type="button" class="design-mode-btn" data-design-mode="maker">AI 표지 제작<small>뒤표지·책등·앞표지 제작</small></button>`;
    nav.insertAdjacentElement('afterend', wrap);
    wrap.addEventListener('click', (event) => {
      const button = event.target.closest('[data-design-mode]');
      if (button) setMode(button.dataset.designMode);
    });
  }

  function installMakerPanel() {
    if ($('coverMakerPanel')) return;
    const switcher = $('designModeSwitch');
    if (!switcher) return;
    const panel = document.createElement('section');
    panel.id = 'coverMakerPanel';
    panel.className = 'cover-maker-panel';
    panel.innerHTML = `
      <div class="cm-head">
        <div class="cm-kicker">AI COVER MAKER</div>
        <div class="cm-title">AI 표지 제작</div>
        <div class="cm-desc">AI는 전체 펼침 배경을 만들고 제목·책등·기관명은 정확한 편집 글자로 올립니다.</div>
      </div>
      <div class="cm-group">
        <div class="cm-group-title">완성 규격 <small>디자인 검토 값 자동 연동</small></div>
        <div class="cm-grid2">
          <label class="cm-field"><span class="cm-label">가로</span><span class="cm-input-row"><input id="cmTrimW" class="cm-input" type="number" min="50" max="1000" step="0.1"><span class="cm-unit">mm</span></span></label>
          <label class="cm-field"><span class="cm-label">세로</span><span class="cm-input-row"><input id="cmTrimH" class="cm-input" type="number" min="50" max="1000" step="0.1"><span class="cm-unit">mm</span></span></label>
          <label class="cm-field"><span class="cm-label">책등</span><span class="cm-input-row"><input id="cmSpine" class="cm-input" type="number" min="0" max="100" step="0.1"><span class="cm-unit">mm</span></span></label>
          <label class="cm-field"><span class="cm-label">도련</span><span class="cm-input-row"><input id="cmBleed" class="cm-input" type="number" min="0" max="20" step="0.1"><span class="cm-unit">mm</span></span></label>
        </div>
        <div class="cm-hint" id="cmGeometryHint"></div>
      </div>
      <div class="cm-group">
        <div class="cm-group-title">앞표지</div>
        <label class="cm-field"><span class="cm-label">제목 <span class="req">*</span></span><input id="cmTitle" class="cm-input" maxlength="180" placeholder="예: 2026 마을교육 운영사례집"></label>
        <label class="cm-field"><span class="cm-label">부제</span><input id="cmSubtitle" class="cm-input" maxlength="220" placeholder="필요한 경우 입력"></label>
        <div class="cm-grid2">
          <label class="cm-field"><span class="cm-label">문서 종류</span><select id="cmDocType" class="cm-select"><option>결과보고서</option><option>운영계획서</option><option>사례집</option><option>자료집</option><option>안내서</option><option>백서</option><option>기타</option></select></label>
          <label class="cm-field"><span class="cm-label">발행일·연도</span><input id="cmDate" class="cm-input" maxlength="80" placeholder="예: 2026. 09."></label>
        </div>
        <label class="cm-field"><span class="cm-label">기관·회사명</span><input id="cmOrg" class="cm-input" maxlength="160" placeholder="예: 천안마을교육 사회적협동조합"></label>
        <label class="cm-field"><span class="cm-label">부서·시리즈명</span><input id="cmDepartment" class="cm-input" maxlength="160" placeholder="선택 입력"></label>
      </div>
      <div class="cm-group">
        <div class="cm-group-title">뒤표지</div>
        <label class="cm-field"><span class="cm-label">소개문·본문</span><textarea id="cmBackText" class="cm-textarea" maxlength="700" placeholder="뒤표지에 넣을 소개문이나 설명"></textarea></label>
        <label class="cm-field"><span class="cm-label">하단 연락처·회사정보</span><textarea id="cmContact" class="cm-textarea" maxlength="360" placeholder="주소, 홈페이지, 문의처 등"></textarea></label>
      </div>
      <div class="cm-group">
        <div class="cm-group-title">책등 <small>폭별 인쇄 안전 정책</small></div>
        <label class="cm-check"><input id="cmSpineSync" type="checkbox" checked> 앞표지 제목을 책등 제목으로 사용</label>
        <label class="cm-field"><span class="cm-label">책등 제목</span><input id="cmSpineTitle" class="cm-input" maxlength="180"></label>
        <div class="cm-grid2">
          <label class="cm-field"><span class="cm-label">날짜·연도</span><input id="cmSpineDate" class="cm-input" maxlength="60"></label>
          <label class="cm-field"><span class="cm-label">하단 회사명</span><input id="cmSpineCompany" class="cm-input" maxlength="100"></label>
        </div>
        <label class="cm-field"><span class="cm-label">글자 방향</span><select id="cmSpineOrientation" class="cm-select"><option value="rotate-up">눕힌 글씨 · 아래→위</option><option value="rotate-down">눕힌 글씨 · 위→아래</option><option value="vertical">세로글씨 · 한글 세움</option></select></label>
        <div id="cmSpinePolicy" class="cm-spine-policy"></div>
      </div>
      <div class="cm-group">
        <div class="cm-group-title">디자인 스타일 <small>선택 후 직접 수정 가능</small></div>
        <label class="cm-field"><span class="cm-label">프롬프트 프리셋</span><select id="cmPreset" class="cm-select"></select></label>
        <div class="cm-grid2">
          <label class="cm-field"><span class="cm-label">배경 주조색</span><input id="cmPrimaryColor" class="cm-color" type="color" value="#1F4E79"></label>
          <label class="cm-field"><span class="cm-label">글자색</span><input id="cmTextColor" class="cm-color" type="color" value="#FFFFFF"></label>
        </div>
        <label class="cm-field"><span class="cm-label">주제·키워드</span><textarea id="cmTheme" class="cm-textarea" maxlength="900" placeholder="예: 교육, 마을, 협력, 성장, 미래"></textarea></label>
        <label class="cm-field"><span class="cm-label">디자인 프롬프트</span><textarea id="cmStyle" class="cm-textarea cm-prompt" maxlength="2200"></textarea></label>
        <div class="cm-hint">AI는 배경만 생성합니다. 한글 제목·날짜·기관명·책등 문구는 별도 편집 글자로 처리합니다.</div>
      </div>
      <div class="cm-actions">
        <button id="cmGenerate" type="button" class="cm-generate">AI 표지 배경 생성</button>
        <div id="cmStatus" class="cm-status">제목과 디자인 방향을 입력한 뒤 생성하세요.</div>
      </div>`;
    switcher.insertAdjacentElement('afterend', panel);
  }

  function installWorkspace() {
    if ($('coverMakerWorkspace')) return;
    const canvasWrap = q('.canvas-wrap', $('printCheckerMain'));
    if (!canvasWrap) return;
    const workspace = document.createElement('div');
    workspace.id = 'coverMakerWorkspace';
    workspace.className = 'cover-maker-workspace';
    workspace.innerHTML = `
      <div class="cm-workbar">
        <div class="cm-workbar-title">AI 표지 미리보기</div>
        <span id="cmMeta" class="cm-workbar-meta">A4 기본 · 뒤표지 + 책등 + 앞표지</span>
        <button id="cmRebuild" class="cm-tool" type="button" disabled>같은 설정으로 다시 생성</button>
        <button id="cmExport" class="cm-tool primary" type="button" disabled>PNG 300dpi 저장</button>
      </div>`;
    canvasWrap.insertAdjacentElement('beforebegin', workspace);
    const scroll = document.createElement('div');
    scroll.id = 'cmStageScroll';
    scroll.className = 'cm-stage-scroll';
    scroll.innerHTML = `
      <div id="cmStage" class="cm-stage">
        <img id="cmStageBg" class="cm-stage-bg" alt="AI 생성 표지 배경" hidden>
        <div class="cm-stage-empty">AI 표지 제작을 선택한 뒤<br>왼쪽 내용을 입력하고 배경을 생성하세요.<br><small>제목·책등·회사명은 정확한 편집 글자로 표시됩니다.</small></div>
        <div class="cm-stage-note">뒤표지 · 책등 · 앞표지 전체 펼침</div>
      </div>`;
    canvasWrap.appendChild(scroll);
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
    $('cmStyle').value = PRESETS.public.text;
  }

  function syncGeometryFromReview() {
    const geometry = reviewGeometry();
    $('cmTrimW').value = geometry.trimW;
    $('cmTrimH').value = geometry.trimH;
    $('cmSpine').value = geometry.spine;
    $('cmBleed').value = geometry.bleed;
    updateGeometryUi();
  }

  function updateSpinePolicy(spine) {
    const box = $('cmSpinePolicy');
    if (!box) return;
    box.className = 'cm-spine-policy';
    if (spine < 4) {
      box.classList.add('is-warn');
      box.textContent = '책등 4mm 미만: 글자 인쇄 안정성이 낮아 책등 문구를 미리보기·출력에서 제외합니다.';
    } else if (spine < 8) {
      box.classList.add('is-warn');
      box.textContent = '책등 4~7.9mm: 제목만 표시하며 날짜와 하단 회사명은 자동 제외됩니다.';
    } else if (spine < 12) {
      box.classList.add('is-ok');
      box.textContent = '책등 8~11.9mm: 제목과 날짜를 표시합니다. 하단 회사명은 12mm 이상에서 표시합니다.';
    } else {
      box.classList.add('is-ok');
      box.textContent = '책등 12mm 이상: 제목·날짜·하단 회사명을 모두 배치할 수 있습니다.';
    }
  }

  function updateGeometryUi() {
    const spec = currentSpec();
    const hint = $('cmGeometryHint');
    if (hint) hint.textContent = `전체 펼침 ${spec.workW.toFixed(1)} × ${spec.workH.toFixed(1)} mm · 뒤 ${spec.trimW.toFixed(1)} + 책등 ${spec.spine.toFixed(1)} + 앞 ${spec.trimW.toFixed(1)} mm`;
    updateSpinePolicy(spec.spine);
    renderStage();
  }

  function setMode(mode) {
    const next = mode === 'maker' ? 'maker' : 'review';
    state.mode = next;
    document.body.classList.toggle('is-cover-maker', next === 'maker');
    qa('[data-design-mode]').forEach((button) => button.classList.toggle('is-active', button.dataset.designMode === next));
    if (next === 'maker') {
      try { window.DesignReviewGeometry?.save?.(); } catch (_) {}
      syncGeometryFromReview();
      setTimeout(renderStage, 40);
    }
    const url = new URL(location.href);
    if (next === 'maker') url.searchParams.set('mode', 'maker');
    else url.searchParams.delete('mode');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function setStatus(message, tone = '') {
    const node = $('cmStatus');
    if (!node) return;
    node.textContent = message;
    node.className = `cm-status${tone ? ` is-${tone}` : ''}`;
  }

  function syncSpineTitle() {
    if ($('cmSpineSync')?.checked) $('cmSpineTitle').value = $('cmTitle')?.value || '';
  }

  function bindForm() {
    ['cmTrimW', 'cmTrimH', 'cmSpine', 'cmBleed'].forEach((id) => $(id)?.addEventListener('input', updateGeometryUi));
    ['cmSubtitle', 'cmDocType', 'cmDate', 'cmOrg', 'cmDepartment', 'cmBackText', 'cmContact', 'cmSpineDate', 'cmSpineCompany', 'cmSpineOrientation', 'cmTextColor'].forEach((id) => $(id)?.addEventListener('input', renderStage));
    $('cmTitle')?.addEventListener('input', () => { syncSpineTitle(); renderStage(); });
    $('cmSpineTitle')?.addEventListener('input', () => {
      if ($('cmSpineSync')?.checked && $('cmSpineTitle').value !== $('cmTitle').value) $('cmSpineSync').checked = false;
      renderStage();
    });
    $('cmSpineSync')?.addEventListener('change', () => { syncSpineTitle(); renderStage(); });
    $('cmPreset')?.addEventListener('change', () => {
      const preset = PRESETS[$('cmPreset').value];
      if (preset) $('cmStyle').value = preset.text;
    });
    $('cmGenerate')?.addEventListener('click', generateCover);
    $('cmRebuild')?.addEventListener('click', generateCover);
    $('cmExport')?.addEventListener('click', exportCoverPng);
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

  function themeContext() {
    return [
      `문서 종류: ${$('cmDocType')?.value || ''}`,
      `주제/키워드: ${$('cmTheme')?.value || ''}`,
      `기관 성격: ${$('cmOrg')?.value || ''}`,
      `부서/시리즈: ${$('cmDepartment')?.value || ''}`,
      `선호 주조색: ${$('cmPrimaryColor')?.value || '#1F4E79'}`,
    ].filter((value) => !value.endsWith(': ')).join('\n');
  }

  function waitForImage(image) {
    if (!image) return Promise.resolve();
    if (image.complete && image.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }

  async function generateCover() {
    const title = ($('cmTitle')?.value || '').trim();
    const style = ($('cmStyle')?.value || '').trim();
    if (!title) {
      setStatus('앞표지 제목을 입력해 주세요.', 'error');
      $('cmTitle')?.focus();
      return;
    }
    if (!style) {
      setStatus('디자인 프롬프트를 선택하거나 입력해 주세요.', 'error');
      $('cmStyle')?.focus();
      return;
    }
    const spec = currentSpec();
    const ratio = spec.workW / spec.workH;
    if (ratio < 1 / 3 || ratio > 3) {
      setStatus('현재 전체 펼침 비율은 이미지 생성 범위를 벗어납니다. 완성 규격이나 책등을 확인해 주세요.', 'error');
      return;
    }

    const generate = $('cmGenerate');
    const rebuild = $('cmRebuild');
    if (generate) generate.disabled = true;
    if (rebuild) rebuild.disabled = true;
    setStatus('최신 GPT Image가 뒤표지·책등·앞표지 전체 배경을 설계하고 있습니다…');
    try {
      const data = await authFetch('/api/preflight/ai-design/cover-image', {
        method: 'POST',
        body: JSON.stringify({
          trim_width_mm: spec.trimW,
          trim_height_mm: spec.trimH,
          spine_mm: spec.spine,
          bleed_mm: spec.bleed,
          preset_name: PRESETS[$('cmPreset')?.value]?.name || 'custom',
          style_request: `${style}\nPreferred dominant color: ${$('cmPrimaryColor')?.value || '#1F4E79'}.`,
          theme_context: themeContext(),
        }),
      });
      if (!data.image_base64) throw new Error('AI 이미지 결과가 비어 있습니다.');
      state.imageUrl = `data:${data.mime_type || 'image/png'};base64,${data.image_base64}`;
      state.imageMeta = data;
      const image = $('cmStageBg');
      image.src = state.imageUrl;
      image.hidden = false;
      await waitForImage(image);
      $('cmStage')?.classList.add('has-image');
      $('cmExport').disabled = false;
      $('cmRebuild').disabled = false;
      $('cmMeta').textContent = `${data.model || 'GPT Image'} · ${data.size || ''} · ${data.quality || 'high'} · ${spec.workW.toFixed(1)}×${spec.workH.toFixed(1)}mm`;
      renderStage();
      setStatus('표지 배경 생성 완료. 제목·뒤표지·책등 글자는 직접 수정할 수 있고 300dpi 저장에 그대로 반영됩니다.', 'ok');
    } catch (error) {
      setStatus(error?.message || 'AI 표지 생성에 실패했습니다.', 'error');
    } finally {
      if (generate) generate.disabled = false;
      if (rebuild && state.imageUrl) rebuild.disabled = false;
    }
  }

  function titlePt(text, trimW) {
    let pt = trimW < 140 ? 30 : 42;
    const length = [...String(text || '')].length;
    if (length > 18) pt -= 5;
    if (length > 30) pt -= 5;
    if (length > 44) pt -= 4;
    return clamp(pt, 22, 44);
  }

  function spinePt(spine, text) {
    let pt = clamp(spine * 0.95 + 4, 8, 15);
    const length = [...String(text || '')].length;
    if (length > 18) pt -= 1.5;
    if (length > 28) pt -= 1.5;
    return clamp(pt, 7, 15);
  }

  function textValues() {
    return {
      title: $('cmTitle')?.value || '', subtitle: $('cmSubtitle')?.value || '', docType: $('cmDocType')?.value || '',
      date: $('cmDate')?.value || '', org: $('cmOrg')?.value || '', department: $('cmDepartment')?.value || '',
      backText: $('cmBackText')?.value || '', contact: $('cmContact')?.value || '', spineTitle: $('cmSpineTitle')?.value || '',
      spineDate: $('cmSpineDate')?.value || '', spineCompany: $('cmSpineCompany')?.value || '',
      orientation: $('cmSpineOrientation')?.value || 'rotate-up',
    };
  }

  function computeTextLayout(spec, scale) {
    const value = textValues();
    const bleed = spec.bleed * scale;
    const trimW = spec.trimW * scale;
    const trimH = spec.trimH * scale;
    const spineW = spec.spine * scale;
    const backX = bleed;
    const spineX = bleed + trimW;
    const frontX = spineX + spineW;
    const safe = Math.min(SAFE_MM, spec.trimW * 0.08) * scale;
    const ptPx = (pt) => pt * 25.4 / 72 * scale;
    const items = [];
    const add = (item) => { if (item.text) items.push(item); };

    add({ id: 'frontTitle', field: 'cmTitle', cls: 'cm-front-title', text: value.title, x: frontX + safe, y: bleed + trimH * 0.12, w: trimW - safe * 2, h: trimH * 0.20, fontPt: titlePt(value.title, spec.trimW), weight: 900, align: 'left' });
    add({ id: 'frontSubtitle', field: 'cmSubtitle', cls: 'cm-front-subtitle', text: value.subtitle, x: frontX + safe, y: bleed + trimH * 0.34, w: trimW - safe * 2, h: trimH * 0.12, fontPt: 17, weight: 700, align: 'left' });
    add({ id: 'frontDocType', field: 'cmDocType', cls: 'cm-front-meta', text: value.docType, x: frontX + safe, y: bleed + trimH * 0.56, w: trimW - safe * 2, h: trimH * 0.06, fontPt: 11, weight: 800, align: 'left' });
    add({ id: 'frontDate', field: 'cmDate', cls: 'cm-front-meta', text: value.date, x: frontX + safe, y: bleed + trimH * 0.62, w: trimW - safe * 2, h: trimH * 0.06, fontPt: 10, weight: 700, align: 'left' });
    add({ id: 'frontDepartment', field: 'cmDepartment', cls: 'cm-front-meta', text: value.department, x: frontX + safe, y: bleed + trimH * 0.68, w: trimW - safe * 2, h: trimH * 0.07, fontPt: 10, weight: 700, align: 'left' });
    add({ id: 'frontOrg', field: 'cmOrg', cls: 'cm-front-org', text: value.org, x: frontX + safe, y: bleed + trimH * 0.88, w: trimW - safe * 2, h: trimH * 0.07, fontPt: 11, weight: 850, align: 'left' });
    add({ id: 'backText', field: 'cmBackText', cls: 'cm-back-copy', text: value.backText, x: backX + safe, y: bleed + trimH * 0.16, w: trimW - safe * 2, h: trimH * 0.58, fontPt: 10.5, weight: 600, align: 'left' });
    add({ id: 'backContact', field: 'cmContact', cls: 'cm-back-contact', text: value.contact, x: backX + safe, y: bleed + trimH * 0.84, w: trimW - safe * 2, h: trimH * 0.12, fontPt: 9, weight: 750, align: 'left' });

    if (spec.spine >= 4 && value.spineTitle) {
      const fontPt = spinePt(spec.spine, value.spineTitle);
      if (value.orientation === 'vertical') add({ id: 'spineTitle', field: 'cmSpineTitle', cls: 'cm-spine-text vertical', text: value.spineTitle, x: spineX + spineW * 0.12, y: bleed + trimH * 0.18, w: spineW * 0.76, h: trimH * 0.62, fontPt, weight: 900, align: 'center', vertical: true });
      else add({ id: 'spineTitle', field: 'cmSpineTitle', cls: 'cm-spine-text', text: value.spineTitle, x: spineX + spineW / 2 - trimH * 0.31, y: bleed + trimH / 2 - spineW * 0.34, w: trimH * 0.62, h: spineW * 0.68, fontPt, weight: 900, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }
    if (spec.spine >= 8 && value.spineDate) {
      const fontPt = clamp(spinePt(spec.spine, value.spineDate) - 2, 7, 10);
      if (value.orientation === 'vertical') add({ id: 'spineDate', field: 'cmSpineDate', cls: 'cm-spine-date vertical', text: value.spineDate, x: spineX + spineW * 0.18, y: bleed + trimH * 0.06, w: spineW * 0.64, h: trimH * 0.10, fontPt, weight: 800, align: 'center', vertical: true });
      else add({ id: 'spineDate', field: 'cmSpineDate', cls: 'cm-spine-date', text: value.spineDate, x: spineX + spineW / 2 - trimH * 0.09, y: bleed + trimH * 0.14 - spineW * 0.25, w: trimH * 0.18, h: spineW * 0.5, fontPt, weight: 800, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }
    if (spec.spine >= 12 && value.spineCompany) {
      const fontPt = clamp(spinePt(spec.spine, value.spineCompany) - 3, 7, 9.5);
      if (value.orientation === 'vertical') add({ id: 'spineCompany', field: 'cmSpineCompany', cls: 'cm-spine-company vertical', text: value.spineCompany, x: spineX + spineW * 0.18, y: bleed + trimH * 0.82, w: spineW * 0.64, h: trimH * 0.13, fontPt, weight: 800, align: 'center', vertical: true });
      else add({ id: 'spineCompany', field: 'cmSpineCompany', cls: 'cm-spine-company', text: value.spineCompany, x: spineX + spineW / 2 - trimH * 0.12, y: bleed + trimH * 0.86 - spineW * 0.25, w: trimH * 0.24, h: spineW * 0.5, fontPt, weight: 800, align: 'center', rotate: value.orientation === 'rotate-down' ? 90 : -90 });
    }

    items.forEach((item) => { item.fontPx = ptPx(item.fontPt); });
    return items;
  }

  function clearStageOverlays() {
    qa('#cmStage .cm-guide,#cmStage .cm-guide-label,#cmStage .cm-text-layer').forEach((node) => node.remove());
  }

  function addGuide(stage, className, x, y, width, height, label = '') {
    const guide = document.createElement('div');
    guide.className = `cm-guide ${className}`;
    Object.assign(guide.style, { left: px(x), top: px(y), width: px(width), height: px(height) });
    stage.appendChild(guide);
    if (!label) return;
    const tag = document.createElement('div');
    tag.className = 'cm-guide-label';
    tag.textContent = label;
    Object.assign(tag.style, { left: px(x + 3), top: px(y + 3) });
    stage.appendChild(tag);
  }

  function drawGuides(spec, scale) {
    const stage = $('cmStage');
    if (!stage) return;
    const bleed = spec.bleed * scale;
    const width = spec.trimW * scale;
    const height = spec.trimH * scale;
    const spine = spec.spine * scale;
    addGuide(stage, 'trim', bleed, bleed, width, height, '뒤표지');
    if (spine > 0) addGuide(stage, 'spine', bleed + width, bleed, spine, height, `책등 ${spec.spine.toFixed(1)}mm`);
    addGuide(stage, 'trim', bleed + width + spine, bleed, width, height, '앞표지');
    const safe = Math.min(SAFE_MM, spec.trimW * 0.08) * scale;
    addGuide(stage, 'safe', bleed + safe, bleed + safe, Math.max(0, width - safe * 2), Math.max(0, height - safe * 2));
    addGuide(stage, 'safe', bleed + width + spine + safe, bleed + safe, Math.max(0, width - safe * 2), Math.max(0, height - safe * 2));
  }

  function addTextLayer(stage, item, color) {
    const node = document.createElement('div');
    node.id = `cmLayer-${item.id}`;
    node.className = `cm-text-layer ${item.cls || ''}`;
    node.dataset.field = item.field;
    node.contentEditable = 'true';
    node.spellcheck = false;
    node.textContent = item.text;
    Object.assign(node.style, {
      left: px(item.x), top: px(item.y), width: px(Math.max(1, item.w)), height: px(Math.max(1, item.h)),
      fontSize: px(item.fontPx), fontWeight: String(item.weight || 700), textAlign: item.align || 'left', color,
    });
    if (item.rotate) node.style.transform = `rotate(${item.rotate}deg)`;
    if (item.vertical) {
      node.style.writingMode = 'vertical-rl';
      node.style.textOrientation = 'upright';
    }
    node.addEventListener('input', () => {
      const field = $(item.field);
      if (field) field.value = node.innerText.replace(/\n{3,}/g, '\n\n').trim();
    });
    stage.appendChild(node);
  }

  function renderStage() {
    const stage = $('cmStage');
    if (!stage) return;
    const spec = currentSpec();
    const availableW = Math.max(440, Math.min(1180, (q('.canvas-wrap')?.clientWidth || window.innerWidth - 360) - 56));
    const availableH = Math.max(360, Math.min(760, window.innerHeight - 190));
    const scale = Math.max(0.35, Math.min(availableW / spec.workW, availableH / spec.workH, 3));
    stage.style.width = px(spec.workW * scale);
    stage.style.height = px(spec.workH * scale);
    clearStageOverlays();
    drawGuides(spec, scale);
    computeTextLayout(spec, scale).forEach((item) => addTextLayer(stage, item, $('cmTextColor')?.value || '#FFFFFF'));
    if ($('cmMeta') && !state.imageMeta) $('cmMeta').textContent = `${spec.trimW.toFixed(1)}×${spec.trimH.toFixed(1)}mm · 책등 ${spec.spine.toFixed(1)}mm · 도련 ${spec.bleed.toFixed(1)}mm`;
  }

  function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align = 'left', maxHeight = Infinity) {
    let cursorY = y;
    String(text || '').split(/\n/).forEach((paragraph) => {
      if (cursorY + lineHeight > y + maxHeight) return;
      const lines = [];
      let line = '';
      [...paragraph].forEach((char) => {
        const test = line + char;
        if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = char; }
        else line = test;
      });
      if (line || !paragraph.length) lines.push(line);
      lines.forEach((value) => {
        if (cursorY + lineHeight > y + maxHeight) return;
        let drawX = x;
        if (align === 'center') { ctx.textAlign = 'center'; drawX = x + maxWidth / 2; }
        else if (align === 'right') { ctx.textAlign = 'right'; drawX = x + maxWidth; }
        else ctx.textAlign = 'left';
        ctx.fillText(value, drawX, cursorY);
        cursorY += lineHeight;
      });
      cursorY += lineHeight * 0.12;
    });
  }

  function drawVerticalText(ctx, text, x, y, width, height, lineHeight) {
    ctx.textAlign = 'center';
    let cursorY = y;
    for (const char of [...String(text || '').replace(/\s+/g, '')]) {
      if (cursorY + lineHeight > y + height) break;
      ctx.fillText(char, x + width / 2, cursorY);
      cursorY += lineHeight;
    }
  }

  function layerTextForExport(item) {
    const node = $(`cmLayer-${item.id}`);
    return node ? node.innerText.trim() : item.text;
  }

  function drawTextItem(ctx, item, color) {
    const text = layerTextForExport(item);
    if (!text) return;
    const fontPx = item.fontPt * EXPORT_DPI / 72;
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `${item.weight || 700} ${fontPx}px Pretendard, "Noto Sans KR", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    if (item.vertical) {
      drawVerticalText(ctx, text, item.x, item.y, item.w, item.h, fontPx * 1.14);
    } else if (item.rotate) {
      const cx = item.x + item.w / 2;
      const cy = item.y + item.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(item.rotate * Math.PI / 180);
      drawWrappedText(ctx, text, -item.w / 2, -item.h / 2, item.w, fontPx * 1.16, item.align || 'center', item.h);
    } else {
      drawWrappedText(ctx, text, item.x, item.y, item.w, fontPx * 1.2, item.align || 'left', item.h);
    }
    ctx.restore();
  }

  function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let index = 0; index < bytes.length; index += 1) {
      crc ^= bytes[index];
      for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function u32(value) {
    return new Uint8Array([(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255]);
  }

  function readU32(bytes, offset) {
    return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
  }

  function concatBytes(...parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let offset = 0;
    parts.forEach((part) => { output.set(part, offset); offset += part.length; });
    return output;
  }

  function pngChunk(typeName, data) {
    const type = new TextEncoder().encode(typeName);
    return concatBytes(u32(data.length), type, data, u32(crc32(concatBytes(type, data))));
  }

  async function withPngDpi(blob, dpi) {
    const source = new Uint8Array(await blob.arrayBuffer());
    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    if (source.length < 33 || !signature.every((value, index) => source[index] === value)) return blob;

    const ppm = Math.round(dpi / 0.0254);
    const phys = pngChunk('pHYs', concatBytes(u32(ppm), u32(ppm), new Uint8Array([1])));
    const parts = [source.slice(0, 8)];
    let offset = 8;
    let inserted = false;

    while (offset + 12 <= source.length) {
      const length = readU32(source, offset);
      const end = offset + 12 + length;
      if (end > source.length) return blob;
      const type = String.fromCharCode(source[offset + 4], source[offset + 5], source[offset + 6], source[offset + 7]);
      const chunk = source.slice(offset, end);
      if (type !== 'pHYs') parts.push(chunk);
      if (type === 'IHDR' && !inserted) {
        parts.push(phys);
        inserted = true;
      }
      offset = end;
      if (type === 'IEND') break;
    }
    if (!inserted) return blob;
    return new Blob([concatBytes(...parts)], { type: 'image/png' });
  }

  function canvasBlob(canvas) {
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG 파일을 만들지 못했습니다.')), 'image/png'));
  }

  async function exportCoverPng() {
    if (!state.imageUrl) {
      setStatus('먼저 AI 표지 배경을 생성해 주세요.', 'error');
      return;
    }
    const spec = currentSpec();
    const pxPerMm = EXPORT_DPI / 25.4;
    const width = Math.round(spec.workW * pxPerMm);
    const height = Math.round(spec.workH * pxPerMm);
    const pixels = width * height;
    if (pixels > MAX_EXPORT_PIXELS) {
      setStatus(`현재 규격은 300dpi에서 ${(pixels / 1_000_000).toFixed(1)}MP입니다. 브라우저 안전 한도를 초과해 저장을 중단했습니다.`, 'error');
      return;
    }

    const button = $('cmExport');
    button.disabled = true;
    setStatus('실제 300dpi 기준으로 배경과 한글·책등 글자를 합성하고 있습니다…');
    try {
      await document.fonts?.ready;
      const background = new Image();
      background.src = state.imageUrl;
      await waitForImage(background);
      if (!background.naturalWidth) throw new Error('AI 표지 배경을 읽지 못했습니다.');

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('브라우저에서 출력 캔버스를 만들지 못했습니다.');
      ctx.drawImage(background, 0, 0, width, height);
      const color = $('cmTextColor')?.value || '#FFFFFF';
      computeTextLayout(spec, pxPerMm).forEach((item) => drawTextItem(ctx, item, color));

      const raw = await canvasBlob(canvas);
      const png = await withPngDpi(raw, EXPORT_DPI);
      const url = URL.createObjectURL(png);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cover-${spec.trimW}x${spec.trimH}-spine-${spec.spine}mm-300dpi-${Date.now()}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus('300dpi 전체 펼침 표지 저장 완료. PNG에는 300dpi 해상도 정보가 하나만 기록됩니다.', 'ok');
    } catch (error) {
      setStatus(error?.message || 'PNG 저장 중 오류가 발생했습니다.', 'error');
    } finally {
      button.disabled = false;
    }
  }

  function handleResize() {
    clearTimeout(state.resizeTimer);
    state.resizeTimer = setTimeout(() => { if (state.mode === 'maker') renderStage(); }, 80);
  }

  function boot() {
    markReviewUi();
    installModeSwitch();
    installMakerPanel();
    installWorkspace();
    populatePresets();
    syncGeometryFromReview();
    syncSpineTitle();
    bindForm();
    renderStage();
    window.addEventListener('resize', handleResize);
    setMode(new URLSearchParams(location.search).get('mode') === 'maker' ? 'maker' : 'review');

    window.DesignCoverMaker = Object.freeze({
      open: () => setMode('maker'),
      review: () => setMode('review'),
      render: renderStage,
      get spec() { return currentSpec(); },
      presets: PRESETS,
      exportDpi: EXPORT_DPI,
      stage: 'integrated-cover-maker-v2',
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
