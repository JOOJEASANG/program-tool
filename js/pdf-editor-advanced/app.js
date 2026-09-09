import {
  advancedState,
  selectedPage,
  checkpoint,
  undo,
  redo,
  clearHistory,
  emitStateChange,
  emitHistoryChange,
  resetAllState,
  serializeSettings,
} from './state.js';
import {
  clearPreviewCache,
  renderSelectedPreview,
  currentLayout,
  backingPointFromClient,
  sourceNormalizedFromBacking,
  sourceSideForVisualEdge,
} from './preview.js';
import { processAdvancedPdf } from './api.js';

const $ = id => document.getElementById(id);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const PT_PER_MM = 72 / 25.4;
let idCounter = 1;
let renderToken = 0;
let renderTimer = 0;
let activeGesture = null;
let eraseGesture = null;
const controlTransactions = new WeakSet();

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

function normalizeQuarter(value) {
  const normalized = ((Number(value || 0) % 360) + 360) % 360;
  return [0, 90, 180, 270].reduce((best, candidate) => {
    const distance = Math.min(Math.abs(normalized - candidate), 360 - Math.abs(normalized - candidate));
    const bestDistance = Math.min(Math.abs(normalized - best), 360 - Math.abs(normalized - best));
    return distance < bestDistance ? candidate : best;
  }, 0);
}

function setStatus(message, type = 'info') {
  const element = $('statusLine');
  element.textContent = message || '';
  element.style.color = type === 'error' ? '#b91c1c' : type === 'success' ? '#166534' : '#64748b';
}

function setBusy(busy, message = '처리 중...') {
  advancedState.busy = !!busy;
  $('busyOverlay').hidden = !busy;
  $('busyText').textContent = message;
  $('uploadBtn').disabled = busy;
  $('downloadBtn').disabled = busy || !advancedState.pages.length;
  $('clearAllBtn').disabled = busy || !advancedState.pages.length;
}

function makePageId() { return `adv-${Date.now().toString(36)}-${idCounter++}`; }

function outputPoints(page) {
  return page.rotation === 90 || page.rotation === 270
    ? { width: page.heightPt, height: page.widthPt }
    : { width: page.widthPt, height: page.heightPt };
}

function validateMargins() {
  for (const page of advancedState.pages) {
    const out = outputPoints(page);
    const leftRight = (advancedState.margins.left + advancedState.margins.right) * PT_PER_MM;
    const topBottom = (advancedState.margins.top + advancedState.margins.bottom) * PT_PER_MM;
    if (leftRight >= out.width - 2 || topBottom >= out.height - 2) {
      throw new Error('여백 합계가 페이지 크기보다 큽니다. 여백 값을 줄여 주세요.');
    }
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(refreshPreview, 0);
}

async function refreshPreview() {
  const token = ++renderToken;
  const page = selectedPage();
  syncSelectedControls();
  if (!page) {
    $('emptyState').hidden = false;
    $('pageStage').hidden = true;
    $('selectionLabel').textContent = 'PDF를 불러오면 편집 화면이 표시됩니다.';
    return;
  }
  $('emptyState').hidden = true;
  $('pageStage').hidden = false;
  $('selectionLabel').textContent = `${advancedState.pages.indexOf(page) + 1}페이지 · ${page.sourceName}`;
  try {
    const layout = await renderSelectedPreview($('previewCanvas'));
    if (token !== renderToken || !layout || layout.pageId !== selectedPage()?.id) return;
    positionEditFrame(layout);
  } catch (error) {
    console.error(error);
    setStatus(`미리보기 오류: ${error.message}`, 'error');
  }
}

function positionEditFrame(layout) {
  const canvas = $('previewCanvas');
  const frame = $('editFrame');
  const scaleX = canvas.clientWidth / Math.max(1, canvas.width);
  const scaleY = canvas.clientHeight / Math.max(1, canvas.height);
  frame.style.left = `${layout.dest.x * scaleX}px`;
  frame.style.top = `${layout.dest.y * scaleY}px`;
  frame.style.width = `${Math.max(2, layout.dest.width * scaleX)}px`;
  frame.style.height = `${Math.max(2, layout.dest.height * scaleY)}px`;
}

function selectedInputsDisabled(disabled) {
  ['scaleRange','offsetXRange','offsetYRange','cropLeft','cropTop','cropRight','cropBottom',
    'rotateLeftBtn','rotateRightBtn','eraseModeBtn','resetPageBtn'].forEach(id => { $(id).disabled = disabled; });
}

function syncSelectedControls() {
  const page = selectedPage();
  selectedInputsDisabled(!page || advancedState.busy);
  if (!page) {
    $('scaleValue').textContent = '100%'; $('offsetXValue').textContent = '0.0 mm'; $('offsetYValue').textContent = '0.0 mm';
    return;
  }
  $('scaleRange').value = String(Math.round(page.scale * 100)); $('scaleValue').textContent = `${Math.round(page.scale * 100)}%`;
  $('offsetXRange').value = String(page.offsetX); $('offsetXValue').textContent = `${page.offsetX.toFixed(1)} mm`;
  $('offsetYRange').value = String(page.offsetY); $('offsetYValue').textContent = `${page.offsetY.toFixed(1)} mm`;
  $('cropLeft').value = (page.crop.left * 100).toFixed(1);
  $('cropTop').value = (page.crop.top * 100).toFixed(1);
  $('cropRight').value = (page.crop.right * 100).toFixed(1);
  $('cropBottom').value = (page.crop.bottom * 100).toFixed(1);
  $('eraseModeBtn').classList.toggle('active', advancedState.eraseMode);
  $('eraseModeBtn').textContent = advancedState.eraseMode ? '부분 지우기 종료' : '부분 지우기';
  $('pageStage').classList.toggle('erase-active', advancedState.eraseMode);
}

function syncGlobalControls() {
  $('marginLeft').value = advancedState.margins.left;
  $('marginRight').value = advancedState.margins.right;
  $('marginTop').value = advancedState.margins.top;
  $('marginBottom').value = advancedState.margins.bottom;
  const hf = advancedState.headerFooter;
  $('hfEnabled').checked = hf.enabled; $('hfOptions').classList.toggle('disabled-block', !hf.enabled);
  $('headerLeft').value = hf.headerLeft; $('headerCenter').value = hf.headerCenter; $('headerRight').value = hf.headerRight;
  $('footerLeft').value = hf.footerLeft; $('footerCenter').value = hf.footerCenter; $('footerRight').value = hf.footerRight;
  $('hfFontSize').value = hf.fontSize; $('hfColor').value = hf.color; $('hfMargin').value = hf.margin;
  const pn = advancedState.pageNumbers;
  $('pnEnabled').checked = pn.enabled; $('pnOptions').classList.toggle('disabled-block', !pn.enabled);
  $('pnPosition').value = pn.position; $('pnFormat').value = pn.format; $('pnStart').value = pn.start;
  $('pnFontSize').value = pn.fontSize; $('pnColor').value = pn.color; $('pnMargin').value = pn.margin; $('pnExcludeFirst').checked = pn.excludeFirst;
}

function syncHistoryButtons() {
  $('undoBtn').disabled = !advancedState.history.length || advancedState.busy;
  $('redoBtn').disabled = !advancedState.future.length || advancedState.busy;
}

function updatePageCount() {
  $('pageCountBadge').textContent = String(advancedState.pages.length);
  $('downloadBtn').disabled = advancedState.busy || !advancedState.pages.length;
  $('clearAllBtn').disabled = advancedState.busy || !advancedState.pages.length;
}

async function rebuildPageList() {
  const list = $('pageList');
  list.replaceChildren();
  advancedState.pages.forEach((page, index) => {
    const item = document.createElement('div'); item.className = 'page-item'; item.dataset.pageId = page.id;
    item.classList.toggle('selected', page.id === advancedState.selectedId);
    const info = document.createElement('div'); info.className = 'page-item-info';
    const title = document.createElement('strong'); title.textContent = `${index + 1}페이지`;
    info.append(title);
    const remove = document.createElement('button'); remove.className = 'page-remove'; remove.type = 'button'; remove.title = '페이지 제외'; remove.textContent = '×';
    item.append(info, remove);
    item.addEventListener('click', event => {
      if (event.target === remove) return;
      advancedState.selectedId = page.id; advancedState.eraseMode = false;
      list.querySelectorAll('.page-item').forEach(node => node.classList.toggle('selected', node.dataset.pageId === page.id));
      scheduleRender();
    });
    remove.addEventListener('click', event => {
      event.stopPropagation();
      checkpoint('페이지 제외');
      const currentIndex = advancedState.pages.findIndex(candidate => candidate.id === page.id);
      advancedState.pages.splice(currentIndex, 1);
      if (advancedState.selectedId === page.id) advancedState.selectedId = advancedState.pages[Math.min(currentIndex, advancedState.pages.length - 1)]?.id || null;
      advancedState.eraseMode = false; emitStateChange('page-remove');
      rebuildPageList(); updatePageCount(); scheduleRender();
    });
    list.appendChild(item);
  });
  updatePageCount();
}

async function loadPdfFiles(fileList) {
  if (advancedState.busy) return;
  const incoming = [...fileList];
  if (!incoming.length) return;
  const existingBytes = advancedState.files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const newBytes = incoming.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (existingBytes + newBytes > 300 * 1024 * 1024) return setStatus('전체 PDF 용량은 300 MB 이하여야 합니다.', 'error');
  if (incoming.some(file => !file.name.toLowerCase().endsWith('.pdf'))) return setStatus('PDF 파일만 불러올 수 있습니다.', 'error');
  if (incoming.some(file => file.size > 200 * 1024 * 1024)) return setStatus('PDF 한 파일은 200 MB 이하여야 합니다.', 'error');

  setBusy(true, 'PDF 파일을 읽는 중...');
  const staged = [];
  try {
    let baseFileIndex = advancedState.files.length;
    for (let fileOffset = 0; fileOffset < incoming.length; fileOffset++) {
      const file = incoming[fileOffset];
      setStatus(`PDF 읽는 중... (${fileOffset + 1}/${incoming.length})`);
      const data = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const fileIndex = baseFileIndex + fileOffset;
      const pages = [];
      if (advancedState.pages.length + staged.reduce((sum, item) => sum + item.pages.length, 0) + pdf.numPages > 2000) {
        try { await pdf.destroy(); } catch (_) {}
        throw new Error('고급 편집은 최대 2,000페이지까지 처리할 수 있습니다.');
      }
      for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
        const pdfPage = await pdf.getPage(pageIndex + 1);
        const viewport = pdfPage.getViewport({ scale: 1, rotation: 0 });
        const intrinsicRotation = normalizeQuarter(pdfPage.rotate || 0);
        pages.push({
          id: makePageId(), fileIndex, pageIndex, sourceName: file.name,
          widthPt: viewport.width, heightPt: viewport.height,
          rotation: intrinsicRotation, intrinsicRotation, fineRotation: 0,
          crop: { left: 0, top: 0, right: 0, bottom: 0 },
          eraseRegions: [], scale: 1, offsetX: 0, offsetY: 0,
        });
      }
      staged.push({ file, pdf, pages });
    }
    checkpoint('PDF 추가');
    for (const item of staged) {
      advancedState.files.push(item.file); advancedState.documents.push(item.pdf); advancedState.pages.push(...item.pages);
    }
    if (!advancedState.selectedId) advancedState.selectedId = advancedState.pages[0]?.id || null;
    emitStateChange('upload');
    await rebuildPageList(); scheduleRender();
    setStatus(`PDF ${incoming.length}개 · 총 ${advancedState.pages.length}페이지를 불러왔습니다.`, 'success');
  } catch (error) {
    for (const item of staged) { try { await item.pdf.destroy(); } catch (_) {} }
    setStatus(error.message || 'PDF를 불러오지 못했습니다.', 'error');
  } finally {
    setBusy(false); $('fileInput').value = '';
  }
}

function beginControl(control, label) {
  if (controlTransactions.has(control)) return;
  checkpoint(label); controlTransactions.add(control);
}
function endControl(control) { controlTransactions.delete(control); }

function bindRange(id, label, apply) {
  const input = $(id);
  input.addEventListener('pointerdown', () => beginControl(input, label));
  input.addEventListener('focus', () => beginControl(input, label));
  input.addEventListener('input', () => { const page = selectedPage(); if (!page) return; apply(page, Number(input.value)); emitStateChange(label); scheduleRender(); });
  input.addEventListener('change', () => endControl(input)); input.addEventListener('blur', () => endControl(input));
}

function bindNumber(id, label, apply) {
  const input = $(id);
  input.addEventListener('focus', () => beginControl(input, label));
  input.addEventListener('input', () => { const page = selectedPage(); if (!page) return; apply(page, Number(input.value)); emitStateChange(label); scheduleRender(); });
  input.addEventListener('change', () => endControl(input)); input.addEventListener('blur', () => endControl(input));
}

function setCrop(page, side, value) {
  const opposite = side === 'left' ? 'right' : side === 'right' ? 'left' : side === 'top' ? 'bottom' : 'top';
  const max = Math.max(0, .94 - Number(page.crop[opposite] || 0));
  page.crop[side] = clamp(Number.isFinite(value) ? value : 0, 0, Math.min(.9, max));
}

function bindGlobalNumber(id, label, target, key) {
  const input = $(id);
  input.addEventListener('focus', () => beginControl(input, label));
  input.addEventListener('input', () => { target[key] = clamp(Number(input.value) || 0, 0, 80); emitStateChange(label); scheduleRender(); });
  input.addEventListener('change', () => endControl(input)); input.addEventListener('blur', () => endControl(input));
}

function bindGlobalText(id, label, target, key) {
  const input = $(id);
  input.addEventListener('focus', () => beginControl(input, label));
  input.addEventListener('input', () => { target[key] = input.value.slice(0, 500); emitStateChange(label); scheduleRender(); });
  input.addEventListener('change', () => endControl(input)); input.addEventListener('blur', () => endControl(input));
}

function startCornerGesture(event, corner) {
  const page = selectedPage(), layout = currentLayout(); if (!page || !layout) return;
  event.preventDefault(); checkpoint('크기 조절');
  const canvasRect = $('previewCanvas').getBoundingClientRect();
  const sx = canvasRect.width / layout.canvasWidth, sy = canvasRect.height / layout.canvasHeight;
  const center = { x: canvasRect.left + (layout.dest.x + layout.dest.width/2)*sx, y: canvasRect.top + (layout.dest.y + layout.dest.height/2)*sy };
  const startDist = Math.max(10, Math.hypot(event.clientX-center.x,event.clientY-center.y));
  activeGesture = { type:'scale', pageId:page.id, startScale:page.scale, center, startDist, corner };
}

function startEdgeGesture(event, edge) {
  const page = selectedPage(), layout = currentLayout(); if (!page || !layout) return;
  event.preventDefault(); checkpoint('가장자리 잘라내기');
  const canvasRect = $('previewCanvas').getBoundingClientRect();
  const sx = canvasRect.width / layout.canvasWidth, sy = canvasRect.height / layout.canvasHeight;
  activeGesture = {
    type:'crop', pageId:page.id, edge,
    sourceSide:sourceSideForVisualEdge(edge,page.rotation),
    startX:event.clientX,startY:event.clientY,
    width:Math.max(8,layout.dest.width*sx),height:Math.max(8,layout.dest.height*sy),
    crop:{...page.crop},
  };
}

function moveGesture(event) {
  if (!activeGesture) return;
  const page = advancedState.pages.find(item=>item.id===activeGesture.pageId); if (!page) return;
  if (activeGesture.type === 'scale') {
    const dist = Math.max(4,Math.hypot(event.clientX-activeGesture.center.x,event.clientY-activeGesture.center.y));
    page.scale = clamp(activeGesture.startScale * dist / activeGesture.startDist,.5,3);
  } else {
    const g=activeGesture; const horizontal=g.edge==='left'||g.edge==='right';
    let inward;
    if(g.edge==='left') inward=event.clientX-g.startX; else if(g.edge==='right') inward=g.startX-event.clientX;
    else if(g.edge==='top') inward=event.clientY-g.startY; else inward=g.startY-event.clientY;
    const fraction=inward/(horizontal?g.width:g.height);
    const side=g.sourceSide; const opposite=side==='left'?'right':side==='right'?'left':side==='top'?'bottom':'top';
    const remaining=(side==='left'||side==='right')?1-g.crop.left-g.crop.right:1-g.crop.top-g.crop.bottom;
    const next=g.crop[side]+fraction*remaining;
    page.crop={...g.crop}; page.crop[side]=clamp(next,0,Math.min(.9,.94-g.crop[opposite]));
  }
  emitStateChange(activeGesture.type); scheduleRender();
}
function endGesture(){activeGesture=null;}

function startErase(event) {
  if (!advancedState.eraseMode || !selectedPage() || !currentLayout()) return;
  const point = backingPointFromClient($('previewCanvas'), event.clientX, event.clientY);
  const normalized = sourceNormalizedFromBacking(point); if (!normalized) return;
  const stageRect=$('pageStage').getBoundingClientRect();
  eraseGesture={startClient:{x:event.clientX-stageRect.left,y:event.clientY-stageRect.top},startSource:normalized};
  const box=$('eraseRect');box.hidden=false;box.style.left=`${eraseGesture.startClient.x}px`;box.style.top=`${eraseGesture.startClient.y}px`;box.style.width='0px';box.style.height='0px';
  event.preventDefault();
}
function moveErase(event){
  if(!eraseGesture)return;const stageRect=$('pageStage').getBoundingClientRect();const x=event.clientX-stageRect.left,y=event.clientY-stageRect.top;const s=eraseGesture.startClient;const box=$('eraseRect');box.style.left=`${Math.min(s.x,x)}px`;box.style.top=`${Math.min(s.y,y)}px`;box.style.width=`${Math.abs(x-s.x)}px`;box.style.height=`${Math.abs(y-s.y)}px`;
}
function endErase(event){
  if(!eraseGesture)return;const page=selectedPage();const point=backingPointFromClient($('previewCanvas'),event.clientX,event.clientY);const end=sourceNormalizedFromBacking(point);const start=eraseGesture.startSource;eraseGesture=null;$('eraseRect').hidden=true;if(!page||!end)return;const region={x0:Math.min(start.x,end.x),y0:Math.min(start.y,end.y),x1:Math.max(start.x,end.x),y1:Math.max(start.y,end.y)};if(region.x1-region.x0<.003||region.y1-region.y0<.003)return;checkpoint('부분 지우기');page.eraseRegions.push(region);if(page.eraseRegions.length>40)page.eraseRegions.shift();emitStateChange('erase');scheduleRender();
}

function bindUi() {
  $('uploadBtn').addEventListener('click',()=>{if(!advancedState.busy)$('fileInput').click();});
  $('fileInput').addEventListener('change',event=>loadPdfFiles(event.target.files));
  $('clearAllBtn').addEventListener('click',async()=>{
    if(!advancedState.pages.length||advancedState.busy)return;if(!confirm('현재 고급 편집 작업을 모두 비울까요?'))return;
    for(const doc of advancedState.documents){try{await doc.destroy();}catch(_){}}
    clearPreviewCache();resetAllState();rebuildPageList();syncGlobalControls();scheduleRender();setStatus('작업을 비웠습니다.');
  });
  $('logoutBtn').addEventListener('click',()=>auth.signOut().then(()=>location.href='/index.html'));
  $('undoBtn').addEventListener('click',()=>{if(undo()){rebuildPageList();syncGlobalControls();scheduleRender();}});
  $('redoBtn').addEventListener('click',()=>{if(redo()){rebuildPageList();syncGlobalControls();scheduleRender();}});
  $('rotateLeftBtn').addEventListener('click',()=>{const p=selectedPage();if(!p)return;checkpoint('왼쪽 회전');p.rotation=(p.rotation+270)%360;emitStateChange('rotate');scheduleRender();});
  $('rotateRightBtn').addEventListener('click',()=>{const p=selectedPage();if(!p)return;checkpoint('오른쪽 회전');p.rotation=(p.rotation+90)%360;emitStateChange('rotate');scheduleRender();});
  $('resetPageBtn').addEventListener('click',()=>{const p=selectedPage();if(!p)return;checkpoint('페이지 보정 초기화');Object.assign(p,{rotation:normalizeQuarter(p.intrinsicRotation||0),fineRotation:0,crop:{left:0,top:0,right:0,bottom:0},eraseRegions:[],scale:1,offsetX:0,offsetY:0});advancedState.eraseMode=false;emitStateChange('reset-page');scheduleRender();});
  $('eraseModeBtn').addEventListener('click',()=>{if(!selectedPage())return;advancedState.eraseMode=!advancedState.eraseMode;syncSelectedControls();});

  bindRange('scaleRange','크기 조절',(p,v)=>p.scale=clamp(v/100,.5,3));
  bindRange('offsetXRange','좌우 이동',(p,v)=>p.offsetX=clamp(v,-100,100));
  bindRange('offsetYRange','상하 이동',(p,v)=>p.offsetY=clamp(v,-100,100));
  bindNumber('cropLeft','왼쪽 잘라내기',(p,v)=>setCrop(p,'left',v/100));
  bindNumber('cropTop','위 잘라내기',(p,v)=>setCrop(p,'top',v/100));
  bindNumber('cropRight','오른쪽 잘라내기',(p,v)=>setCrop(p,'right',v/100));
  bindNumber('cropBottom','아래 잘라내기',(p,v)=>setCrop(p,'bottom',v/100));

  bindGlobalNumber('marginLeft','왼쪽 여백',advancedState.margins,'left');bindGlobalNumber('marginRight','오른쪽 여백',advancedState.margins,'right');bindGlobalNumber('marginTop','위 여백',advancedState.margins,'top');bindGlobalNumber('marginBottom','아래 여백',advancedState.margins,'bottom');
  $('hfEnabled').addEventListener('change',()=>{checkpoint('머리말 꼬리말');advancedState.headerFooter.enabled=$('hfEnabled').checked;$('hfOptions').classList.toggle('disabled-block',!advancedState.headerFooter.enabled);emitStateChange('hf');scheduleRender();});
  bindGlobalText('headerLeft','머리말',advancedState.headerFooter,'headerLeft');bindGlobalText('headerCenter','머리말',advancedState.headerFooter,'headerCenter');bindGlobalText('headerRight','머리말',advancedState.headerFooter,'headerRight');
  bindGlobalText('footerLeft','꼬리말',advancedState.headerFooter,'footerLeft');bindGlobalText('footerCenter','꼬리말',advancedState.headerFooter,'footerCenter');bindGlobalText('footerRight','꼬리말',advancedState.headerFooter,'footerRight');
  bindGlobalNumber('hfMargin','머리말 꼬리말 간격',advancedState.headerFooter,'margin');
  $('hfFontSize').addEventListener('change',()=>{checkpoint('머리말 글자 크기');advancedState.headerFooter.fontSize=clamp(Number($('hfFontSize').value)||10,5,72);emitStateChange('hf-font');scheduleRender();});
  $('hfColor').addEventListener('input',()=>{advancedState.headerFooter.color=$('hfColor').value;emitStateChange('hf-color');scheduleRender();});

  $('pnEnabled').addEventListener('change',()=>{checkpoint('페이지 번호');advancedState.pageNumbers.enabled=$('pnEnabled').checked;$('pnOptions').classList.toggle('disabled-block',!advancedState.pageNumbers.enabled);emitStateChange('pn');scheduleRender();});
  $('pnPosition').addEventListener('change',()=>{checkpoint('페이지 번호 위치');advancedState.pageNumbers.position=$('pnPosition').value;emitStateChange('pn');scheduleRender();});
  $('pnFormat').addEventListener('change',()=>{checkpoint('페이지 번호 형식');advancedState.pageNumbers.format=$('pnFormat').value;emitStateChange('pn');scheduleRender();});
  $('pnStart').addEventListener('change',()=>{checkpoint('페이지 번호 시작');advancedState.pageNumbers.start=Number($('pnStart').value)||1;emitStateChange('pn');scheduleRender();});
  $('pnFontSize').addEventListener('change',()=>{checkpoint('페이지 번호 글자');advancedState.pageNumbers.fontSize=clamp(Number($('pnFontSize').value)||10,5,72);emitStateChange('pn');scheduleRender();});
  $('pnMargin').addEventListener('change',()=>{checkpoint('페이지 번호 간격');advancedState.pageNumbers.margin=clamp(Number($('pnMargin').value)||0,0,80);emitStateChange('pn');scheduleRender();});
  $('pnColor').addEventListener('input',()=>{advancedState.pageNumbers.color=$('pnColor').value;emitStateChange('pn');scheduleRender();});
  $('pnExcludeFirst').addEventListener('change',()=>{checkpoint('첫 페이지 번호 제외');advancedState.pageNumbers.excludeFirst=$('pnExcludeFirst').checked;emitStateChange('pn');scheduleRender();});

  document.querySelectorAll('[data-corner]').forEach(handle=>handle.addEventListener('pointerdown',event=>startCornerGesture(event,handle.dataset.corner)));
  document.querySelectorAll('[data-edge]').forEach(handle=>handle.addEventListener('pointerdown',event=>startEdgeGesture(event,handle.dataset.edge)));
  window.addEventListener('pointermove',event=>{moveGesture(event);moveErase(event);});
  window.addEventListener('pointerup',event=>{endGesture();endErase(event);});
  $('previewCanvas').addEventListener('pointerdown',startErase);

  $('zoomInBtn').addEventListener('click',()=>{advancedState.zoom=clamp(advancedState.zoom+.1,.5,2.5);$('zoomLabel').textContent=`${Math.round(advancedState.zoom*100)}%`;scheduleRender();});
  $('zoomOutBtn').addEventListener('click',()=>{advancedState.zoom=clamp(advancedState.zoom-.1,.5,2.5);$('zoomLabel').textContent=`${Math.round(advancedState.zoom*100)}%`;scheduleRender();});
  $('zoomFitBtn').addEventListener('click',()=>{advancedState.zoom=1;$('zoomLabel').textContent='맞춤';scheduleRender();});
  window.addEventListener('resize',scheduleRender);

  $('downloadBtn').addEventListener('click',async()=>{
    if(advancedState.busy||!advancedState.pages.length)return;
    try{validateMargins();}catch(error){return setStatus(error.message,'error');}
    const controller=new AbortController();setBusy(true,'편집 PDF를 생성하는 중...');setStatus('편집 PDF 생성 준비 중...');
    try{
      const blob=await processAdvancedPdf(advancedState.files,serializeSettings(),{signal:controller.signal,onStatus:message=>{setStatus(message);$('busyText').textContent=message;},onProgress:progress=>{if(Number.isFinite(progress))$('busyText').textContent=`편집 PDF 생성 중... ${Math.round(progress)}%`;}});
      const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='advanced-edited.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);setStatus('편집 PDF 다운로드를 시작했습니다.','success');
    }catch(error){console.error(error);setStatus(error.name==='AbortError'?'작업이 취소되었습니다.':`PDF 생성 실패: ${error.message}`,'error');}
    finally{setBusy(false);}
  });

  window.addEventListener('pdf-advanced-history-change',syncHistoryButtons);
  window.addEventListener('pdf-advanced-state-change',()=>{syncHistoryButtons();updatePageCount();});
}

async function initialize() {
  bindUi(); syncGlobalControls(); syncHistoryButtons(); updatePageCount();
  try {
    const accessPromise = window.ProgramAccessReady || Promise.resolve(null);
    await accessPromise;
    if (!window.auth?.currentUser) throw new Error('로그인이 필요합니다.');
    document.documentElement.classList.remove('app-booting');
    document.documentElement.dataset.pdfAdvancedStandalone='ready';
    setStatus('PDF 파일을 불러와 주세요.');
  } catch (error) {
    console.error(error); setStatus('접근 권한을 확인할 수 없습니다.', 'error');
  }
}

initialize();
