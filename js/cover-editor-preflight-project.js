(() => {
  'use strict';
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const $ = (id) => document.getElementById(id);
  const PROJECT_TYPE = 'program-tool-cover-project';
  const PROJECT_VERSION = 2;
  const FIELD_IDS = [
    'trimW','trimH','bleed','safeMargin','pageCount','paperCaliper','bindingAdjust',
    'manualSpine','spineManual','frontColor','backColor','spineColor','textColor',
    'titleSize','spineTextSize','spineDirection','frontTitle','frontSubtitle',
    'publisher','publishYear','backText','spineTitle','imageFit'
  ];
  const num = (id, fallback = 0) => {
    const value = parseFloat($(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  };
  const fire = (element) => {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function bridge() { return window.CoverProjectStateBridge || null; }

  function projectCard() {
    return `<section class="card" id="coverPreflightCard"><div class="card-head"><span class="step">✓</span><div><div class="card-title">인쇄 전 점검·프로젝트</div><div class="card-note">출력 오류를 확인하고 작업 파일을 저장하거나 복원합니다.</div></div></div><div class="grid2"><button class="mini-btn active" id="runCoverPreflight" type="button">인쇄 전 자동 점검</button><button class="mini-btn" id="refreshCoverPreflight" type="button">다시 검사</button></div><div id="coverPreflightSummary" style="margin-top:8px;padding:8px;border:1px solid #dbe5ee;border-radius:8px;background:#f8fafc;font-size:9px;font-weight:850;color:#475569">검사를 실행하세요.</div><div id="coverPreflightList" style="display:grid;gap:5px;margin-top:7px"></div><div style="margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0"><div class="grid2"><button class="mini-btn active" id="exportCoverProject" type="button">프로젝트 파일 저장</button><button class="mini-btn" id="importCoverProjectBtn" type="button">프로젝트 파일 열기</button></div><input id="importCoverProjectInput" type="file" accept="application/json,.json,.ptcover" style="display:none"><div class="card-note" style="margin-top:6px">규격·문구·색상·배치·텍스트 레이어·이미지 효과를 저장합니다. 원본 업로드 이미지는 제외됩니다.</div></div></section>`;
  }

  function issue(level, title, detail) { return { level, title, detail }; }

  function imageDpi(image, side) {
    if (!image) return null;
    const trimW = num('trimW', 210);
    const trimH = num('trimH', 297);
    const fit = $('imageFit')?.value || 'cover';
    const pixelW = image.naturalWidth || image.width || 0;
    const pixelH = image.naturalHeight || image.height || 0;
    if (!pixelW || !pixelH) return issue('warn', `${side} 이미지 해상도 확인 불가`, '이미지 크기 정보를 읽지 못했습니다.');
    let usedW = trimW;
    let usedH = trimH;
    if (fit === 'contain') {
      const imageRatio = pixelW / pixelH;
      const targetRatio = trimW / trimH;
      if (imageRatio > targetRatio) usedH = trimW / imageRatio;
      else usedW = trimH * imageRatio;
    }
    const dpi = Math.min(pixelW / (usedW / 25.4), pixelH / (usedH / 25.4));
    if (dpi < 150) return issue('error', `${side} 이미지 해상도 매우 낮음`, `${Math.round(dpi)} DPI 예상 · 인쇄 시 흐려질 가능성이 큽니다.`);
    if (dpi < 250) return issue('warn', `${side} 이미지 해상도 부족`, `${Math.round(dpi)} DPI 예상 · 300 DPI 이미지를 권장합니다.`);
    return issue('ok', `${side} 이미지 해상도 양호`, `${Math.round(dpi)} DPI 예상`);
  }

  function currentTitle(side, legacyId) {
    return bridge()?.primaryText?.(side) || String($(legacyId)?.value || '').trim();
  }

  function runPreflight() {
    const output = [];
    const bleed = num('bleed', 0);
    const safe = num('safeMargin', 0);
    const trimW = num('trimW', 210);
    const trimH = num('trimH', 297);
    const pages = Math.round(num('pageCount', 0));
    let spine = 0;
    try {
      spine = typeof getSpine === 'function'
        ? getSpine()
        : (num('manualSpine', 0) ? num('spineManual', 0) : Math.ceil(pages / 2) * num('paperCaliper', .1) + num('bindingAdjust', .5));
    } catch (_) { spine = 0; }

    output.push(bleed < 3
      ? issue('error', '재단 여백 부족', `${bleed}mm · 일반 인쇄는 사방 3mm 이상을 권장합니다.`)
      : issue('ok', '재단 여백 확인', `${bleed}mm`));
    output.push(safe < 7
      ? issue('warn', '안전 여백이 좁음', `${safe}mm · 중요한 글자는 재단선에서 7~10mm 이상 떨어뜨리세요.`)
      : issue('ok', '안전 여백 확인', `${safe}mm`));
    if (trimW <= 0 || trimH <= 0) output.push(issue('error', '완성 규격 오류', '가로·세로 규격을 확인하세요.'));
    if (pages < 2) output.push(issue('error', '페이지 수 오류', '본문 페이지 수는 2페이지 이상이어야 합니다.'));
    output.push(spine < 2.2
      ? issue('warn', '책등 폭이 매우 좁음', `${spine.toFixed(1)}mm · 책등 글자가 잘리거나 읽기 어려울 수 있습니다.`)
      : issue('ok', '책등 폭 확인', `${spine.toFixed(1)}mm`));

    const title = currentTitle('front', 'frontTitle');
    const spineTitle = currentTitle('spine', 'spineTitle');
    const publisher = String($('publisher')?.value || '').trim();
    if (!title) output.push(issue('error', '앞표지 제목 누락', '앞표지 제목을 입력하세요.'));
    else if (title.length > 70) output.push(issue('warn', '앞표지 제목이 김', `${title.length}자 · 줄바꿈과 글자 크기를 확인하세요.`));
    else output.push(issue('ok', '앞표지 제목 확인', `${title.length}자`));
    if (!publisher && !bridge()?.primaryText?.('back')) output.push(issue('warn', '기관명·발행처 누락', '기관 납품 문서라면 발행처를 입력하세요.'));
    if (spine >= 2.2 && !spineTitle) output.push(issue('warn', '책등 제목 누락', '책등 폭은 충분하지만 책등 문구가 비어 있습니다.'));
    const titlePt = num('titleSize', 28);
    if (titlePt < 14) output.push(issue('warn', '앞표지 제목이 작음', `${titlePt}pt · 표지 제목은 보통 18pt 이상을 권장합니다.`));

    const front = imageDpi(typeof state !== 'undefined' ? state.frontImage : null, '앞표지');
    const back = imageDpi(typeof state !== 'undefined' ? state.backImage : null, '뒤표지');
    if (front) output.push(front);
    else output.push(issue('warn', '앞표지 이미지 없음', '배경색만 사용하는 디자인인지 확인하세요.'));
    if (back) output.push(back);

    if (typeof state !== 'undefined' && state.layout) {
      for (const [key, position] of Object.entries(state.layout)) {
        if (!position || !Number.isFinite(+position.x) || !Number.isFinite(+position.y)) continue;
        if (+position.x < 3 || +position.x > 97 || +position.y < 3 || +position.y > 97) {
          output.push(issue('warn', '요소가 재단선에 가까움', `${key} 위치 X ${Math.round(position.x)}%, Y ${Math.round(position.y)}%`));
        }
      }
    }
    renderPreflight(output);
    return output;
  }

  function renderPreflight(items) {
    const errors = items.filter((item) => item.level === 'error').length;
    const warnings = items.filter((item) => item.level === 'warn').length;
    const normal = items.filter((item) => item.level === 'ok').length;
    const summary = $('coverPreflightSummary');
    const list = $('coverPreflightList');
    if (summary) {
      summary.textContent = errors
        ? `출력 전 수정 필요 · 오류 ${errors}개 · 주의 ${warnings}개`
        : (warnings ? `출력 가능 · 주의사항 ${warnings}개 확인` : `점검 완료 · ${normal}개 항목 정상`);
      summary.style.borderColor = errors ? '#fecaca' : warnings ? '#fde68a' : '#bbf7d0';
      summary.style.background = errors ? '#fef2f2' : warnings ? '#fffbeb' : '#f0fdf4';
      summary.style.color = errors ? '#b91c1c' : warnings ? '#92400e' : '#166534';
    }
    if (!list) return;
    const icon = { error: '✕', warn: '!', ok: '✓' };
    const color = { error: '#b91c1c', warn: '#92400e', ok: '#166534' };
    const background = { error: '#fef2f2', warn: '#fffbeb', ok: '#f0fdf4' };
    list.replaceChildren();
    items.forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = `padding:7px 8px;border-radius:8px;background:${background[item.level]};font-size:9px;color:${color[item.level]}`;
      const title = document.createElement('strong');
      title.textContent = `${icon[item.level]} ${item.title}`;
      const detail = document.createElement('div');
      detail.style.cssText = 'font-size:8px;margin-top:2px;opacity:.85';
      detail.textContent = item.detail || '';
      row.append(title, detail);
      list.appendChild(row);
    });
  }

  function snapshotProject() {
    const values = {};
    FIELD_IDS.forEach((id) => {
      const element = $(id);
      if (element) values[id] = element.type === 'checkbox' ? element.checked : element.value;
    });
    return {
      type: PROJECT_TYPE,
      version: PROJECT_VERSION,
      app: 'Program Tool 표지 제작',
      savedAt: new Date().toISOString(),
      values,
      layout: typeof state !== 'undefined' && state.layout ? clone(state.layout) : {},
      extended: bridge()?.snapshot?.() || null,
      note: '원본 업로드 이미지는 포함되지 않습니다.'
    };
  }

  function safeName() {
    const title = (currentTitle('front', 'frontTitle') || '표지작업').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40) || '표지작업';
    return `${title}_${new Date().toISOString().slice(0, 10)}.ptcover.json`;
  }

  function exportProject() {
    const blob = new Blob([JSON.stringify(snapshotProject(), null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = safeName();
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyProject(data) {
    if (!data || data.type !== PROJECT_TYPE) throw new Error('Program Tool 표지 프로젝트 파일이 아닙니다.');
    if (!data.values || typeof data.values !== 'object') throw new Error('프로젝트 설정이 손상되었습니다.');
    for (const [id, value] of Object.entries(data.values)) {
      const element = $(id);
      if (!element) continue;
      if (element.type === 'checkbox') element.checked = !!value;
      else element.value = value ?? '';
      fire(element);
    }
    if (data.layout && typeof state !== 'undefined' && state.layout) {
      for (const [key, value] of Object.entries(data.layout)) {
        if (!value) continue;
        if (!state.layout[key]) state.layout[key] = {};
        Object.assign(state.layout[key], value);
      }
    }
    bridge()?.restore?.(data.extended || data.projectState || null);
    if (typeof syncControls === 'function') syncControls();
    if (typeof updateCalculation === 'function') updateCalculation();
    if (typeof requestRender === 'function') requestRender();
    setTimeout(runPreflight, 120);
  }

  async function importProject(file) {
    if (!file) return;
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error('JSON 형식이 올바르지 않습니다.'); }
    applyProject(data);
  }

  function bind() {
    if ($('coverPreflightCard')) return;
    const settings = document.querySelector('.settings');
    if (!settings) return;
    settings.insertAdjacentHTML('beforeend', projectCard());
    $('runCoverPreflight').onclick = runPreflight;
    $('refreshCoverPreflight').onclick = runPreflight;
    $('exportCoverProject').onclick = exportProject;
    $('importCoverProjectBtn').onclick = () => $('importCoverProjectInput').click();
    $('importCoverProjectInput').onchange = async (event) => {
      try {
        await importProject(event.target.files?.[0]);
        alert('프로젝트 파일을 불러왔습니다.');
      } catch (error) {
        alert(error.message || '프로젝트 파일을 불러오지 못했습니다.');
      } finally {
        event.target.value = '';
      }
    };
    ['pdfBtn', 'guidePdfBtn', 'pngBtn'].forEach((id) => $(id)?.addEventListener('click', () => {
      const result = runPreflight();
      if (result.some((item) => item.level === 'error')) {
        setTimeout(() => alert('인쇄 전 점검에서 오류가 발견되었습니다. 왼쪽 점검 결과를 확인하세요.'), 0);
      }
    }, { capture: true }));
    setTimeout(runPreflight, 350);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(bind, 300));
  else setTimeout(bind, 300);
})();
