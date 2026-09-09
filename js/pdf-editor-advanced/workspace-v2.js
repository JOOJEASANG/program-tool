import { advancedState, selectedPage, checkpoint, emitStateChange } from './state.js';
import { renderPagePreview, outputPagePoints } from './preview.js';

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const sleepFrame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
let pairRenderToken = 0;
let pairTimer = 0;
let orientationBusy = false;
let fineTransaction = false;
let rotationGesture = null;

function normalizeQuarter(value) {
  const normalized = ((Number(value || 0) % 360) + 360) % 360;
  const candidates = [0, 90, 180, 270];
  return candidates.reduce((best, candidate) => {
    const d = Math.min(Math.abs(normalized - candidate), 360 - Math.abs(normalized - candidate));
    const bd = Math.min(Math.abs(normalized - best), 360 - Math.abs(normalized - best));
    return d < bd ? candidate : best;
  }, 0);
}
function normalizeSigned(value) {
  return ((Number(value || 0) + 180) % 360 + 360) % 360 - 180;
}
function normalizeFine(value) {
  return clamp(Math.round((Number(value) || 0) * 10) / 10, -15, 15);
}
function setStatus(message, type = 'info') {
  const status = $('statusLine');
  if (!status) return;
  status.textContent = message;
  status.style.color = type === 'error' ? '#b91c1c' : type === 'success' ? '#166534' : '#64748b';
}
function requestMainRender() {
  window.dispatchEvent(new Event('resize'));
  schedulePairRender();
}

function installCss() {
  if (document.getElementById('pdfAdvancedWorkspaceV2Css')) return;
  const link = document.createElement('link');
  link.id = 'pdfAdvancedWorkspaceV2Css';
  link.rel = 'stylesheet';
  link.href = '/css/pdf-editor-advanced-workspace-v2.css?v=20260909-1';
  document.head.appendChild(link);
}

function ensurePairShell() {
  const scroll = $('previewScroll');
  const stage = $('pageStage');
  if (!scroll || !stage) return null;
  let row = $('pairPreviewRow');
  if (!row) {
    row = document.createElement('div');
    row.id = 'pairPreviewRow';
    row.className = 'pair-preview-row';
    scroll.insertBefore(row, stage);
    row.appendChild(stage);

    const selectedBadge = document.createElement('span');
    selectedBadge.id = 'selectedPairBadge';
    selectedBadge.className = 'pair-page-badge selected';
    stage.appendChild(selectedBadge);

    const companion = document.createElement('div');
    companion.id = 'companionStage';
    companion.className = 'page-stage companion-stage';
    companion.hidden = true;
    companion.innerHTML = '<canvas id="companionCanvas"></canvas><span id="companionPairBadge" class="pair-page-badge"></span>';
    companion.addEventListener('click', () => {
      const id = companion.dataset.pageId;
      if (!id) return;
      const index = advancedState.pages.findIndex(page => String(page.id) === String(id));
      if (index >= 0) selectPageByIndex(index);
    });
    row.appendChild(companion);
  }

  const toolbar = document.querySelector('.workspace-toolbar');
  if (toolbar && !$('pairNav')) {
    const nav = document.createElement('div');
    nav.id = 'pairNav';
    nav.className = 'pair-nav';
    nav.innerHTML = '<button id="pairPrevBtn" type="button" aria-label="이전 페이지">◀ 이전</button><span id="pairPageLabel">0 / 0</span><button id="pairNextBtn" type="button" aria-label="다음 페이지">다음 ▶</button>';
    const actions = toolbar.querySelector('.toolbar-actions');
    toolbar.insertBefore(nav, actions || null);
    $('pairPrevBtn').addEventListener('click', () => navigatePage(-1));
    $('pairNextBtn').addEventListener('click', () => navigatePage(1));
  }
  return row;
}

function selectedIndex() {
  return advancedState.pages.findIndex(page => page.id === advancedState.selectedId);
}

function selectPageByIndex(index) {
  const page = advancedState.pages[index];
  if (!page) return;
  const item = [...($('pageList')?.querySelectorAll('.page-item') || [])].find(node => node.dataset.pageId === page.id);
  if (item) {
    item.click();
  } else {
    advancedState.selectedId = page.id;
    advancedState.eraseMode = false;
    emitStateChange('page-navigation');
    requestMainRender();
  }
  setTimeout(() => { syncExtraControls(); schedulePairRender(); }, 0);
}

function navigatePage(direction) {
  const index = selectedIndex();
  if (index < 0) return;
  const target = index + direction;
  if (target >= 0 && target < advancedState.pages.length) selectPageByIndex(target);
}

async function renderPair() {
  pairTimer = 0;
  const token = ++pairRenderToken;
  const row = ensurePairShell();
  const stage = $('pageStage');
  const companion = $('companionStage');
  if (!row || !stage || !companion) return;
  const index = selectedIndex();
  if (index < 0) {
    row.hidden = true;
    companion.hidden = true;
    if ($('pairPageLabel')) $('pairPageLabel').textContent = `0 / ${advancedState.pages.length}`;
    return;
  }
  row.hidden = false;
  const start = index - (index % 2);
  const end = Math.min(start + 2, advancedState.pages.length);
  if ($('pairPageLabel')) $('pairPageLabel').textContent = `${start + 1}-${end} / ${advancedState.pages.length}`;
  if ($('pairPrevBtn')) $('pairPrevBtn').disabled = index <= 0;
  if ($('pairNextBtn')) $('pairNextBtn').disabled = index >= advancedState.pages.length - 1;
  if ($('selectedPairBadge')) $('selectedPairBadge').textContent = `${index + 1}페이지 · 편집 중`;

  const otherIndex = index % 2 === 0 ? index + 1 : index - 1;
  const other = advancedState.pages[otherIndex];
  if (!other) {
    companion.hidden = true;
    return;
  }
  companion.hidden = false;
  companion.dataset.pageId = other.id;
  $('companionPairBadge').textContent = `${otherIndex + 1}페이지 · 클릭하여 편집`;
  if (otherIndex < index) row.insertBefore(companion, stage);
  else row.appendChild(companion);
  try {
    await renderPagePreview(other, $('companionCanvas'), { trackLayout: false });
    if (token !== pairRenderToken) return;
  } catch (error) {
    console.warn('[pdf-advanced] companion preview failed', error);
  }
}

function schedulePairRender(delay = 45) {
  clearTimeout(pairTimer);
  pairTimer = setTimeout(renderPair, delay);
}

async function initializeDocumentOrientations() {
  if (orientationBusy) return;
  const pending = advancedState.pages.filter(page => page.intrinsicRotation == null);
  if (!pending.length) return;
  orientationBusy = true;
  document.documentElement.classList.add('orientation-pending');
  try {
    for (let index = 0; index < pending.length; index++) {
      const page = pending[index];
      const pdf = advancedState.documents[page.fileIndex];
      if (!pdf) continue;
      const pdfPage = await pdf.getPage(page.pageIndex + 1);
      const intrinsic = normalizeQuarter(pdfPage.rotate || 0);
      page.intrinsicRotation = intrinsic;
      page.rotation = intrinsic;
      page.fineRotation = normalizeFine(page.fineRotation || 0);
      page.orientationSource = 'pdf-rotate';
      if (index % 24 === 23) await sleepFrame();
    }
    emitStateChange('document-orientation');
    requestMainRender();
  } catch (error) {
    console.warn('[pdf-advanced] document orientation initialization failed', error);
  } finally {
    orientationBusy = false;
    document.documentElement.classList.remove('orientation-pending');
    schedulePairRender(0);
  }
}

function ensurePageDefaults(page) {
  if (!page) return;
  if (page.intrinsicRotation == null) page.intrinsicRotation = normalizeQuarter(page.rotation || 0);
  page.rotation = normalizeQuarter(page.rotation || 0);
  page.fineRotation = normalizeFine(page.fineRotation || 0);
}

function ensureExtraControls() {
  const section = $('pageEditSection');
  if (!section || $('fineRotationRange')) return;
  const firstGrid = section.querySelector('.button-grid.four');
  const orientActions = document.createElement('div');
  orientActions.className = 'button-grid two advanced-orient-actions';
  orientActions.innerHTML = '<button id="portraitFitBtn" class="tool-btn" type="button">세로로 맞춤</button><button id="autoAlignAllBtn" class="tool-btn" type="button">전체 자동 회전·정렬</button>';
  firstGrid?.insertAdjacentElement('afterend', orientActions);

  const fine = document.createElement('div');
  fine.className = 'fine-rotation-block';
  fine.innerHTML = '<div class="fine-rotation-head"><strong>미세 회전</strong><input id="fineRotationNumber" type="number" min="-15" max="15" step="0.1" value="0" aria-label="미세 회전 각도"></div><div class="fine-rotation-line"><input id="fineRotationRange" type="range" min="-15" max="15" step="0.1" value="0"><button id="fineRotationResetBtn" type="button">0°</button></div><div class="fine-rotation-help">0.1° 단위 · 미리보기의 보라색 ↻ 핸들을 끌어서도 조정할 수 있습니다.</div>';
  orientActions.insertAdjacentElement('afterend', fine);

  const frame = $('editFrame');
  if (frame && !$('fineRotateHandle')) {
    const handle = document.createElement('i');
    handle.id = 'fineRotateHandle';
    handle.className = 'fine-rotate-handle';
    handle.setAttribute('role', 'button');
    handle.setAttribute('aria-label', '선택 페이지 미세 회전');
    handle.title = '드래그하여 미세 회전';
    handle.textContent = '↻';
    frame.appendChild(handle);
    handle.addEventListener('pointerdown', beginFineRotationGesture);
  }

  $('portraitFitBtn').addEventListener('click', rotateSelectedPortrait);
  $('autoAlignAllBtn').addEventListener('click', autoAlignAllPages);
  bindFineControl($('fineRotationRange'));
  bindFineControl($('fineRotationNumber'));
  $('fineRotationResetBtn').addEventListener('click', () => {
    const page = selectedPage();
    if (!page || Math.abs(Number(page.fineRotation || 0)) < 0.0001) return;
    checkpoint('미세 회전 초기화');
    page.fineRotation = 0;
    emitStateChange('fine-rotation');
    syncExtraControls();
    requestMainRender();
  });
}

function bindFineControl(input) {
  if (!input) return;
  const begin = () => {
    if (fineTransaction || !selectedPage()) return;
    checkpoint('미세 회전');
    fineTransaction = true;
  };
  const finish = () => { fineTransaction = false; };
  input.addEventListener('pointerdown', begin);
  input.addEventListener('focus', begin);
  input.addEventListener('input', () => {
    const page = selectedPage();
    if (!page) return;
    page.fineRotation = normalizeFine(input.value);
    syncExtraControls(input.id);
    emitStateChange('fine-rotation');
    requestMainRender();
  });
  input.addEventListener('change', finish);
  input.addEventListener('blur', finish);
}

function syncExtraControls(sourceId = '') {
  const page = selectedPage();
  ensureExtraControls();
  const disabled = !page || advancedState.busy;
  for (const id of ['portraitFitBtn','fineRotationRange','fineRotationNumber','fineRotationResetBtn']) {
    if ($(id)) $(id).disabled = disabled;
  }
  if ($('autoAlignAllBtn')) $('autoAlignAllBtn').disabled = advancedState.busy || !advancedState.pages.length;
  if (!page) return;
  ensurePageDefaults(page);
  const fine = normalizeFine(page.fineRotation);
  if (sourceId !== 'fineRotationRange' && $('fineRotationRange')) $('fineRotationRange').value = String(fine);
  if (sourceId !== 'fineRotationNumber' && $('fineRotationNumber')) $('fineRotationNumber').value = fine.toFixed(1);
  if ($('fineRotationResetBtn')) $('fineRotationResetBtn').disabled = disabled || Math.abs(fine) < 0.0001;
  if ($('fineRotateHandle')) $('fineRotateHandle').hidden = disabled;
}

function rotateSelectedPortrait() {
  const page = selectedPage();
  if (!page) return;
  ensurePageDefaults(page);
  const out = outputPagePoints(page);
  if (out.height >= out.width) {
    setStatus('선택 페이지가 이미 세로 방향입니다.', 'info');
    return;
  }
  checkpoint('세로 방향 맞춤');
  page.rotation = normalizeQuarter(page.rotation + 90);
  emitStateChange('portrait-fit');
  requestMainRender();
  setStatus('선택 페이지를 세로 방향으로 회전했습니다.', 'success');
}

function textOrientationPlan(textContent, baseRotation) {
  const groups = new Map([[0,{weight:0,residual:0,chars:0}],[90,{weight:0,residual:0,chars:0}],[180,{weight:0,residual:0,chars:0}],[270,{weight:0,residual:0,chars:0}]]);
  let totalWeight = 0;
  let totalChars = 0;
  for (const item of textContent?.items || []) {
    const text = String(item?.str || '').replace(/\s+/g, '');
    if (!text) continue;
    if (textContent?.styles?.[item.fontName]?.vertical) continue;
    const transform = item?.transform || [];
    const a = Number(transform[0]);
    const b = Number(transform[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.hypot(a, b) < 0.01) continue;
    const rawAngle = Math.atan2(b, a) * 180 / Math.PI;
    const effective = normalizeSigned(rawAngle + baseRotation);
    const quarter = normalizeQuarter(effective);
    const quarterSigned = quarter === 270 ? -90 : quarter;
    const residual = normalizeSigned(effective - quarterSigned);
    const weight = Math.max(1, text.length) * Math.max(1, Math.min(40, Math.hypot(a, b)));
    const group = groups.get(quarter);
    group.weight += weight;
    group.residual += residual * weight;
    group.chars += text.length;
    totalWeight += weight;
    totalChars += text.length;
  }
  if (totalChars < 8 || totalWeight <= 0) return null;
  const [quarter, dominant] = [...groups.entries()].sort((a,b) => b[1].weight - a[1].weight)[0];
  if (!dominant || dominant.weight / totalWeight < 0.58 || dominant.chars < 6) return null;
  const meanResidual = dominant.residual / Math.max(1, dominant.weight);
  const quarterCorrection = (360 - quarter) % 360;
  const fineCorrection = Math.abs(meanResidual) <= 8 ? normalizeFine(-meanResidual) : 0;
  return { quarterCorrection, fineCorrection, confidence: dominant.weight / totalWeight, chars: dominant.chars };
}

async function autoAlignAllPages() {
  if (advancedState.busy || !advancedState.pages.length) return;
  const button = $('autoAlignAllBtn');
  button.disabled = true;
  button.classList.add('auto-align-running');
  await initializeDocumentOrientations();
  const plans = [];
  let noText = 0;
  try {
    for (let index = 0; index < advancedState.pages.length; index++) {
      const page = advancedState.pages[index];
      ensurePageDefaults(page);
      setStatus(`글씨 방향 분석 중... ${index + 1}/${advancedState.pages.length}`);
      const pdf = advancedState.documents[page.fileIndex];
      const pdfPage = pdf ? await pdf.getPage(page.pageIndex + 1) : null;
      if (!pdfPage) { noText++; continue; }
      const textContent = await pdfPage.getTextContent();
      const base = normalizeQuarter(page.intrinsicRotation ?? page.rotation);
      const plan = textOrientationPlan(textContent, base);
      if (!plan) { noText++; continue; }
      plans.push({ page, base, ...plan });
      if (index % 18 === 17) await sleepFrame();
    }

    const changed = plans.filter(plan => {
      const nextRotation = normalizeQuarter(plan.base + plan.quarterCorrection);
      return nextRotation !== normalizeQuarter(plan.page.rotation) || Math.abs(plan.fineCorrection - Number(plan.page.fineRotation || 0)) >= 0.05;
    });
    if (!changed.length) {
      setStatus(noText ? `자동 정렬할 변경사항이 없습니다. 텍스트를 읽을 수 없는 ${noText}페이지는 그대로 유지했습니다.` : '모든 페이지의 글씨 방향이 이미 정렬되어 있습니다.', 'success');
      return;
    }

    checkpoint('전체 자동 회전·정렬');
    let quarterChanged = 0;
    let fineChanged = 0;
    for (const plan of changed) {
      const nextRotation = normalizeQuarter(plan.base + plan.quarterCorrection);
      if (nextRotation !== normalizeQuarter(plan.page.rotation)) quarterChanged++;
      if (Math.abs(plan.fineCorrection - Number(plan.page.fineRotation || 0)) >= 0.05) fineChanged++;
      plan.page.rotation = nextRotation;
      plan.page.fineRotation = plan.fineCorrection;
      plan.page.autoAligned = true;
    }
    emitStateChange('auto-align-all');
    syncExtraControls();
    requestMainRender();
    setStatus(`자동 정렬 완료 · 방향 회전 ${quarterChanged}페이지 · 미세 정렬 ${fineChanged}페이지${noText ? ` · 텍스트 판독 불가 ${noText}페이지 유지` : ''}`, 'success');
  } catch (error) {
    console.error(error);
    setStatus(`자동 회전·정렬 실패: ${error.message}`, 'error');
  } finally {
    button.classList.remove('auto-align-running');
    button.disabled = advancedState.busy || !advancedState.pages.length;
  }
}

function pointerAngle(event, rect) {
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
}
function angleDelta(current, start) { return normalizeSigned(current - start); }

function beginFineRotationGesture(event) {
  if (event.button !== 0) return;
  const page = selectedPage();
  const frame = $('editFrame');
  if (!page || !frame || advancedState.busy) return;
  event.preventDefault(); event.stopPropagation();
  const rect = frame.getBoundingClientRect();
  rotationGesture = {
    pointerId: event.pointerId,
    page,
    handle: event.currentTarget,
    rect,
    startPointer: pointerAngle(event, rect),
    startFine: normalizeFine(page.fineRotation),
    changed: false,
  };
  event.currentTarget.classList.add('rotating');
  try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
}

function moveFineRotationGesture(event) {
  const gesture = rotationGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  event.preventDefault();
  const delta = angleDelta(pointerAngle(event, gesture.rect), gesture.startPointer);
  const next = normalizeFine(gesture.startFine + delta);
  if (!gesture.changed && Math.abs(next - gesture.startFine) >= 0.05) {
    checkpoint('미세 회전');
    gesture.changed = true;
  }
  gesture.page.fineRotation = next;
  syncExtraControls();
  let hint = $('fineRotateHint');
  if (!hint) {
    hint = document.createElement('span');
    hint.id = 'fineRotateHint'; hint.className = 'fine-rotate-hint';
    $('editFrame')?.appendChild(hint);
  }
  hint.textContent = `${next >= 0 ? '+' : ''}${next.toFixed(1)}°`;
  requestMainRender();
}

function endFineRotationGesture(event) {
  const gesture = rotationGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  try { gesture.handle.releasePointerCapture?.(event.pointerId); } catch (_) {}
  gesture.handle.classList.remove('rotating');
  $('fineRotateHint')?.remove();
  rotationGesture = null;
  if (gesture.changed) emitStateChange('fine-rotation');
  syncExtraControls();
  requestMainRender();
}

function handleStateChange(event) {
  const reason = event?.detail?.reason || '';
  if (reason === 'upload') initializeDocumentOrientations();
  if (reason === 'reset-page') {
    const page = selectedPage();
    if (page) {
      page.rotation = normalizeQuarter(page.intrinsicRotation || 0);
      page.fineRotation = 0;
    }
  }
  advancedState.pages.forEach(ensurePageDefaults);
  syncExtraControls();
  schedulePairRender();
}

function install() {
  installCss();
  ensurePairShell();
  ensureExtraControls();
  advancedState.pages.forEach(ensurePageDefaults);
  syncExtraControls();
  schedulePairRender(0);

  window.addEventListener('pdf-advanced-state-change', handleStateChange);
  window.addEventListener('resize', () => schedulePairRender());
  $('pageList')?.addEventListener('click', () => setTimeout(() => { syncExtraControls(); schedulePairRender(0); }, 0), true);
  document.querySelector('.toolbar-actions')?.addEventListener('click', () => schedulePairRender(80), true);
  window.addEventListener('pointermove', moveFineRotationGesture, { passive: false });
  window.addEventListener('pointerup', endFineRotationGesture);
  window.addEventListener('pointercancel', endFineRotationGesture);
  document.documentElement.dataset.pdfAdvancedWorkspaceV2 = 'orientation-pair-fine-auto';
}

install();
