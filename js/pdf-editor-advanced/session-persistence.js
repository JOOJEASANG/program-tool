import {
  advancedState,
  resetAllState,
  clearHistory,
  emitStateChange,
} from './state.js';
import { clearPreviewCache } from './preview.js';

const $ = id => document.getElementById(id);
const MAX_SESSIONS = 10;
const MAX_FILES = 50;
const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const SESSION_COLLECTION = 'pdf_advanced_sessions';
const SESSION_FORMAT = 'program-studio-advanced-pdf-session';
let operationBusy = false;

const clone = value => JSON.parse(JSON.stringify(value));
const totalBytes = files => [...(files || [])].reduce((sum, file) => sum + Number(file?.size || 0), 0);
const pageKey = page => `${Number(page?.fileIndex)}:${Number(page?.pageIndex)}`;

function storageApi() {
  try { return window.firebase?.storage?.(); } catch (_) { return null; }
}

function setStatus(message, type = 'info') {
  const node = $('statusLine');
  if (!node) return;
  node.textContent = message || '';
  node.style.color = type === 'error' ? '#b91c1c' : type === 'success' ? '#166534' : '#64748b';
}

function setOperationBusy(busy, message = '') {
  operationBusy = !!busy;
  for (const id of ['advancedSessionSaveBtn', 'advancedSessionLoadBtn']) {
    const button = $(id);
    if (button) button.disabled = operationBusy;
  }
  if (message) setStatus(message);
}

function installStyles() {
  if ($('pdfAdvancedSessionPersistenceStyles')) return;
  const style = document.createElement('style');
  style.id = 'pdfAdvancedSessionPersistenceStyles';
  style.textContent = `
    .sidebar-top{padding-top:12px!important;padding-bottom:12px!important}
    .sidebar-top>.top-actions{display:grid!important;grid-template-columns:34px minmax(0,1fr) minmax(0,1.18fr) 34px!important;gap:6px!important;margin-top:0!important;align-items:center}
    .sidebar-top>.top-actions .advanced-nav-icon{width:34px;min-width:34px;padding:0!important;font-size:0!important;line-height:0}
    .sidebar-top>.top-actions .advanced-nav-icon svg{width:15px;height:15px}
    .sidebar-top>.top-actions .advanced-session-btn{min-width:0;padding:0 7px;white-space:nowrap;font-size:10px}
    .advanced-session-backdrop{position:fixed;inset:0;z-index:2000;background:rgba(15,23,42,.38);display:flex;align-items:center;justify-content:center;padding:18px}
    .advanced-session-backdrop[hidden]{display:none!important}
    .advanced-session-dialog{width:min(460px,94vw);max-height:min(620px,86vh);overflow:auto;background:#fff;border:1px solid #dbe3ec;border-radius:14px;box-shadow:0 22px 60px rgba(15,23,42,.24);padding:16px}
    .advanced-session-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}.advanced-session-head strong{font-size:15px;color:#172033}.advanced-session-head button{margin-left:auto;width:30px;height:30px;border:1px solid #dbe3ec;border-radius:8px;background:#fff;color:#64748b;cursor:pointer}
    .advanced-session-field{display:block;font-size:10px;font-weight:800;color:#475569}.advanced-session-field input{width:100%;height:38px;margin-top:6px;border:1px solid #cfd8e3;border-radius:8px;padding:0 10px;outline:none}.advanced-session-field input:focus{border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.08)}
    .advanced-session-status{min-height:18px;margin-top:9px;font-size:10px;line-height:1.45;color:#64748b}
    .advanced-session-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}.advanced-session-actions button{min-height:34px;padding:0 12px;border:1px solid #d5dee8;border-radius:8px;background:#fff;color:#334155;font-weight:800;cursor:pointer}.advanced-session-actions button.primary{border-color:#12396d;background:#12396d;color:#fff}
    .advanced-session-list{display:flex;flex-direction:column;gap:8px}.advanced-session-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid #dce4ec;border-radius:10px;background:#f8fafc}.advanced-session-copy{min-width:0}.advanced-session-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#1e293b}.advanced-session-copy span{display:block;margin-top:3px;font-size:9px;color:#64748b}.advanced-session-item-actions{display:flex;gap:5px}.advanced-session-item-actions button{height:30px;padding:0 9px;border:1px solid #cdd7e2;border-radius:7px;background:#fff;color:#334155;font-size:9px;font-weight:800;cursor:pointer}.advanced-session-item-actions button.delete{color:#b91c1c}.advanced-session-empty{padding:22px 8px;text-align:center;color:#94a3b8;font-size:11px}
  `;
  document.head.appendChild(style);
}

function ensureUi() {
  installStyles();
  if (!$('advancedSessionSaveModal')) {
    const save = document.createElement('div');
    save.id = 'advancedSessionSaveModal';
    save.className = 'advanced-session-backdrop';
    save.hidden = true;
    save.innerHTML = `
      <div class="advanced-session-dialog" role="dialog" aria-modal="true" aria-labelledby="advancedSessionSaveTitle">
        <div class="advanced-session-head"><strong id="advancedSessionSaveTitle">편집 내용 저장</strong><button type="button" data-close-save aria-label="닫기">×</button></div>
        <label class="advanced-session-field">저장 이름<input id="advancedSessionNameInput" type="text" maxlength="120" placeholder="예: 9월 표지 수정본"></label>
        <div class="advanced-session-status" id="advancedSessionSaveStatus" role="status"></div>
        <div class="advanced-session-actions"><button type="button" data-close-save>취소</button><button class="primary" id="advancedSessionSaveConfirm" type="button">저장</button></div>
      </div>`;
    document.body.appendChild(save);
    save.querySelectorAll('[data-close-save]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) save.hidden = true; }));
    save.addEventListener('click', event => { if (event.target === save && !operationBusy) save.hidden = true; });
    $('advancedSessionSaveConfirm').addEventListener('click', saveCurrentSession);
    $('advancedSessionNameInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); saveCurrentSession(); } });
  }
  if (!$('advancedSessionLoadModal')) {
    const load = document.createElement('div');
    load.id = 'advancedSessionLoadModal';
    load.className = 'advanced-session-backdrop';
    load.hidden = true;
    load.innerHTML = `
      <div class="advanced-session-dialog" role="dialog" aria-modal="true" aria-labelledby="advancedSessionLoadTitle">
        <div class="advanced-session-head"><strong id="advancedSessionLoadTitle">편집 내용 불러오기</strong><button type="button" data-close-load aria-label="닫기">×</button></div>
        <div class="advanced-session-list" id="advancedSessionList"></div>
      </div>`;
    document.body.appendChild(load);
    load.querySelectorAll('[data-close-load]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) load.hidden = true; }));
    load.addEventListener('click', event => { if (event.target === load && !operationBusy) load.hidden = true; });
  }
}

function captureState() {
  const selectedIndex = Math.max(0, advancedState.pages.findIndex(page => page.id === advancedState.selectedId));
  return {
    format: SESSION_FORMAT,
    version: 1,
    selectedIndex,
    paper: clone(advancedState.paper),
    margins: clone(advancedState.margins),
    headerFooter: clone(advancedState.headerFooter),
    pageNumbers: clone(advancedState.pageNumbers),
    pages: advancedState.pages.map(page => ({
      fileIndex: Number(page.fileIndex),
      pageIndex: Number(page.pageIndex),
      rotation: Number(page.rotation || 0),
      intrinsicRotation: Number(page.intrinsicRotation || 0),
      fineRotation: Number(page.fineRotation || 0),
      widthPt: Number(page.widthPt || 0),
      heightPt: Number(page.heightPt || 0),
      sourceWidthPt: Number(page.sourceWidthPt || page.widthPt || 0),
      sourceHeightPt: Number(page.sourceHeightPt || page.heightPt || 0),
      crop: clone(page.crop || { left: 0, top: 0, right: 0, bottom: 0 }),
      eraseRegions: clone(page.eraseRegions || []),
      scale: Number(page.scale || 1),
      offsetX: Number(page.offsetX || 0),
      offsetY: Number(page.offsetY || 0),
      orientationSource: String(page.orientationSource || ''),
      autoAligned: !!page.autoAligned,
    })),
  };
}

function validateSave(files, state) {
  if (!window.auth?.currentUser) throw new Error('로그인이 필요합니다.');
  if (!files.length) throw new Error('저장할 PDF가 없습니다.');
  if (files.length > MAX_FILES) throw new Error(`원본 PDF는 최대 ${MAX_FILES}개까지 저장할 수 있습니다.`);
  if (files.some(file => Number(file.size || 0) > MAX_FILE_BYTES)) throw new Error('PDF 한 파일은 최대 200MB까지 저장할 수 있습니다.');
  const bytes = totalBytes(files);
  if (bytes > MAX_TOTAL_BYTES) throw new Error('원본 PDF 전체 합계는 최대 300MB까지 저장할 수 있습니다.');
  if (!state.pages.length) throw new Error('저장할 편집 페이지가 없습니다.');
  for (const [index, page] of state.pages.entries()) {
    if (!Number.isInteger(page.fileIndex) || page.fileIndex < 0 || page.fileIndex >= files.length) throw new Error(`${index + 1}페이지의 원본 파일 연결이 올바르지 않습니다.`);
    if (!Number.isInteger(page.pageIndex) || page.pageIndex < 0) throw new Error(`${index + 1}페이지의 원본 페이지 정보가 올바르지 않습니다.`);
  }
  const serialized = JSON.stringify(state);
  if (serialized.length > 850000) throw new Error('편집 내용이 너무 커서 저장할 수 없습니다. 부분 지우기 영역 수를 줄여 주세요.');
  return { bytes, serialized };
}

async function cleanupStoragePaths(paths, storage = storageApi()) {
  if (!storage) return;
  await Promise.allSettled((paths || []).map(path => storage.ref(path).delete()));
}

async function trimOldSessions(collection) {
  const snapshot = await collection.orderBy('createdAt', 'asc').get();
  const excess = Math.max(0, snapshot.size - MAX_SESSIONS);
  if (!excess) return;
  for (const doc of snapshot.docs.slice(0, excess)) {
    await cleanupStoragePaths(doc.data()?.storagePaths || []);
    await doc.ref.delete();
  }
}

async function saveCurrentSession() {
  if (operationBusy) return false;
  ensureUi();
  const user = window.auth?.currentUser;
  const db = window.db;
  const storage = storageApi();
  if (!user || !db || !storage) {
    $('advancedSessionSaveStatus').textContent = '저장 서비스에 연결할 수 없습니다.';
    return false;
  }
  const files = [...advancedState.files];
  let state, checked;
  try {
    state = captureState();
    checked = validateSave(files, state);
  } catch (error) {
    $('advancedSessionSaveStatus').textContent = error.message;
    return false;
  }
  const name = ($('advancedSessionNameInput').value || '').trim() || 'PDF 편집 세션';
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const collection = db.collection('users').doc(user.uid).collection(SESSION_COLLECTION);
  const storagePaths = [];
  const status = $('advancedSessionSaveStatus');
  setOperationBusy(true, '편집 내용을 저장하는 중...');
  $('advancedSessionSaveConfirm').disabled = true;
  try {
    for (let index = 0; index < files.length; index += 1) {
      status.textContent = `원본 PDF 저장 중... (${index + 1}/${files.length})`;
      const path = `pdf_sessions/${user.uid}/${sessionId}/src_${index}.pdf`;
      storagePaths.push(path);
      await storage.ref(path).put(files[index], {
        contentType: 'application/pdf',
        customMetadata: { ownerUid: user.uid, purpose: 'pdf-session-source', sessionId },
      });
    }
    status.textContent = '편집 상태 저장 중...';
    await collection.add({
      name: name.slice(0, 120),
      sessionId,
      storagePaths,
      fileCount: files.length,
      pageCount: state.pages.length,
      totalBytes: checked.bytes,
      state: checked.serialized,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await trimOldSessions(collection).catch(error => console.warn('[pdf-advanced-session] cleanup failed', error));
    status.textContent = `저장 완료 · 원본 ${(checked.bytes / 1024 / 1024).toFixed(1)}MB`;
    setStatus('편집 내용을 저장했습니다.', 'success');
    setTimeout(() => { $('advancedSessionSaveModal').hidden = true; }, 700);
    return true;
  } catch (error) {
    await cleanupStoragePaths(storagePaths, storage);
    status.textContent = `저장 실패: ${error.message}`;
    setStatus(`편집 저장 실패: ${error.message}`, 'error');
    return false;
  } finally {
    $('advancedSessionSaveConfirm').disabled = false;
    setOperationBusy(false);
  }
}

function formatCreatedAt(value) {
  try {
    const date = value?.toDate?.() || new Date(value);
    if (!date || Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  } catch (_) { return ''; }
}

async function openLoadModal() {
  if (operationBusy) return;
  ensureUi();
  const user = window.auth?.currentUser;
  const db = window.db;
  if (!user || !db) return setStatus('저장 목록을 불러올 수 없습니다.', 'error');
  const modal = $('advancedSessionLoadModal');
  const list = $('advancedSessionList');
  modal.hidden = false;
  list.innerHTML = '<div class="advanced-session-empty">저장 목록을 불러오는 중...</div>';
  try {
    const snapshot = await db.collection('users').doc(user.uid).collection(SESSION_COLLECTION).orderBy('createdAt', 'desc').limit(20).get();
    list.replaceChildren();
    if (snapshot.empty) {
      list.innerHTML = '<div class="advanced-session-empty">저장된 PDF 편집 내용이 없습니다.</div>';
      return;
    }
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const item = document.createElement('div');
      item.className = 'advanced-session-item';
      const copy = document.createElement('div');
      copy.className = 'advanced-session-copy';
      const title = document.createElement('strong');
      title.textContent = String(data.name || 'PDF 편집 세션');
      const meta = document.createElement('span');
      meta.textContent = `${Number(data.pageCount || 0)}페이지 · ${Number(data.fileCount || 0)}파일${formatCreatedAt(data.createdAt) ? ` · ${formatCreatedAt(data.createdAt)}` : ''}`;
      copy.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'advanced-session-item-actions';
      const loadButton = document.createElement('button');
      loadButton.type = 'button'; loadButton.textContent = '불러오기';
      loadButton.addEventListener('click', () => loadSession(data));
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button'; deleteButton.className = 'delete'; deleteButton.textContent = '삭제';
      deleteButton.addEventListener('click', async () => {
        if (operationBusy || !confirm(`“${title.textContent}” 저장 내용을 삭제할까요?`)) return;
        setOperationBusy(true, '저장 내용을 삭제하는 중...');
        try {
          await cleanupStoragePaths(data.storagePaths || []);
          await doc.ref.delete();
          item.remove();
          if (!list.querySelector('.advanced-session-item')) list.innerHTML = '<div class="advanced-session-empty">저장된 PDF 편집 내용이 없습니다.</div>';
          setStatus('저장된 편집 내용을 삭제했습니다.', 'success');
        } catch (error) {
          setStatus(`저장 내용 삭제 실패: ${error.message}`, 'error');
        } finally { setOperationBusy(false); }
      });
      actions.append(loadButton, deleteButton);
      item.append(copy, actions);
      list.appendChild(item);
    }
  } catch (error) {
    list.innerHTML = `<div class="advanced-session-empty">목록 불러오기 실패: ${String(error.message || error)}</div>`;
  }
}

async function downloadSourceFiles(data) {
  const storage = storageApi();
  if (!storage) throw new Error('저장소에 연결할 수 없습니다.');
  const files = [];
  for (let index = 0; index < (data.storagePaths || []).length; index += 1) {
    setStatus(`원본 PDF 불러오는 중... (${index + 1}/${data.storagePaths.length})`);
    const path = data.storagePaths[index];
    const url = await storage.ref(path).getDownloadURL();
    const response = await fetch(url);
    if (!response.ok) throw new Error(`원본 PDF 다운로드 실패 (${response.status})`);
    const blob = await response.blob();
    files.push(new File([blob], `session_${index + 1}.pdf`, { type: 'application/pdf' }));
  }
  return files;
}

async function clearCurrentWork() {
  for (const documentProxy of advancedState.documents) {
    try { await documentProxy.destroy(); } catch (_) {}
  }
  clearPreviewCache();
  resetAllState();
  $('pageList')?.replaceChildren();
}

function waitForImport(expectedFiles, minimumPages, timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (!advancedState.busy && advancedState.files.length === expectedFiles && advancedState.pages.length >= minimumPages) return resolve(true);
      if (Date.now() - started > timeoutMs) return reject(new Error('원본 PDF를 불러오는 시간이 초과되었습니다.'));
      setTimeout(tick, 80);
    };
    setTimeout(tick, 80);
  });
}

function syncGlobalControls() {
  const value = (id, next) => { const node = $(id); if (node && next !== undefined && next !== null) node.value = String(next); };
  value('marginLeft', advancedState.margins.left); value('marginRight', advancedState.margins.right); value('marginTop', advancedState.margins.top); value('marginBottom', advancedState.margins.bottom);
  const hf = advancedState.headerFooter;
  if ($('hfEnabled')) $('hfEnabled').checked = !!hf.enabled;
  $('hfOptions')?.classList.toggle('disabled-block', !hf.enabled);
  value('headerLeft', hf.headerLeft); value('headerCenter', hf.headerCenter); value('headerRight', hf.headerRight);
  value('footerLeft', hf.footerLeft); value('footerCenter', hf.footerCenter); value('footerRight', hf.footerRight);
  value('hfFontSize', hf.fontSize); value('hfColor', hf.color); value('hfMargin', hf.margin);
  const pn = advancedState.pageNumbers;
  if ($('pnEnabled')) $('pnEnabled').checked = !!pn.enabled;
  $('pnOptions')?.classList.toggle('disabled-block', !pn.enabled);
  value('pnPosition', pn.position); value('pnFormat', pn.format); value('pnStart', pn.start); value('pnFontSize', pn.fontSize); value('pnColor', pn.color); value('pnMargin', pn.margin);
  if ($('pnExcludeFirst')) $('pnExcludeFirst').checked = !!pn.excludeFirst;
}

function applySavedPage(saved, page) {
  page.rotation = Number(saved.rotation || 0);
  page.intrinsicRotation = Number(saved.intrinsicRotation || 0);
  page.fineRotation = Number(saved.fineRotation || 0);
  if (Number(saved.widthPt) > 0) page.widthPt = Number(saved.widthPt);
  if (Number(saved.heightPt) > 0) page.heightPt = Number(saved.heightPt);
  if (Number(saved.sourceWidthPt) > 0) page.sourceWidthPt = Number(saved.sourceWidthPt);
  if (Number(saved.sourceHeightPt) > 0) page.sourceHeightPt = Number(saved.sourceHeightPt);
  page.crop = clone(saved.crop || { left: 0, top: 0, right: 0, bottom: 0 });
  page.eraseRegions = clone(saved.eraseRegions || []);
  page.scale = Number(saved.scale || 1);
  page.offsetX = Number(saved.offsetX || 0);
  page.offsetY = Number(saved.offsetY || 0);
  page.orientationSource = String(saved.orientationSource || '');
  page.autoAligned = !!saved.autoAligned;
  return page;
}

function restorePageListDom(restoredPages) {
  const list = $('pageList');
  if (!list) return;
  const items = new Map([...list.querySelectorAll('.page-item')].map(item => [String(item.dataset.pageId), item]));
  const keep = new Set();
  for (const page of restoredPages) {
    const item = items.get(String(page.id));
    if (!item) continue;
    keep.add(item);
    list.appendChild(item);
  }
  for (const item of items.values()) if (!keep.has(item)) item.remove();
  [...list.querySelectorAll('.page-item')].forEach((item, index) => {
    item.classList.toggle('selected', String(item.dataset.pageId) === String(advancedState.selectedId));
    const title = item.querySelector('.page-item-info strong');
    if (title) title.textContent = `${index + 1}페이지`;
  });
}

function restoreState(state) {
  if (state?.format !== SESSION_FORMAT || !Array.isArray(state.pages)) throw new Error('PDF편집에서 저장한 파일이 아닙니다.');
  const loadedMap = new Map(advancedState.pages.map(page => [pageKey(page), page]));
  const restored = [];
  for (const saved of state.pages) {
    const page = loadedMap.get(`${Number(saved.fileIndex)}:${Number(saved.pageIndex)}`);
    if (!page) throw new Error(`원본 ${Number(saved.fileIndex) + 1}번 파일의 ${Number(saved.pageIndex) + 1}페이지를 찾을 수 없습니다.`);
    restored.push(applySavedPage(saved, page));
  }
  advancedState.pages = restored;
  advancedState.paper = clone(state.paper || advancedState.paper);
  advancedState.margins = clone(state.margins || advancedState.margins);
  advancedState.headerFooter = clone(state.headerFooter || advancedState.headerFooter);
  advancedState.pageNumbers = clone(state.pageNumbers || advancedState.pageNumbers);
  const selectedIndex = Math.max(0, Math.min(restored.length - 1, Number(state.selectedIndex || 0)));
  advancedState.selectedId = restored[selectedIndex]?.id || restored[0]?.id || null;
  advancedState.eraseMode = false;
  clearHistory();
  syncGlobalControls();
  restorePageListDom(restored);
  emitStateChange('session-load');
  window.dispatchEvent(new Event('resize'));
  const selectedItem = [...($('pageList')?.querySelectorAll('.page-item') || [])].find(item => String(item.dataset.pageId) === String(advancedState.selectedId));
  selectedItem?.click();
}

async function loadSession(data) {
  if (operationBusy) return false;
  let state;
  try { state = JSON.parse(String(data.state || '')); } catch (_) { return setStatus('저장된 편집 상태를 읽을 수 없습니다.', 'error'); }
  if (state?.format !== SESSION_FORMAT) return setStatus('PDF편집에서 저장한 파일이 아닙니다.', 'error');
  if (!confirm(`“${String(data.name || 'PDF 편집 세션')}” 편집 내용을 불러올까요?\n현재 작업 중인 내용은 사라집니다.`)) return false;
  setOperationBusy(true, '편집 내용을 불러오는 중...');
  $('advancedSessionLoadModal').hidden = true;
  try {
    const files = await downloadSourceFiles(data);
    await clearCurrentWork();
    if (typeof DataTransfer !== 'function') throw new Error('이 브라우저에서는 저장 파일 불러오기를 지원하지 않습니다.');
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    const input = $('fileInput');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const sourcePageCount = Math.max(...state.pages.map(page => Number(page.pageIndex) + 1), 1);
    await waitForImport(files.length, Math.max(sourcePageCount, state.pages.length));
    restoreState(state);
    setStatus(`편집 내용 불러오기 완료 · ${advancedState.pages.length}페이지`, 'success');
    return true;
  } catch (error) {
    setStatus(`편집 불러오기 실패: ${error.message}`, 'error');
    return false;
  } finally { setOperationBusy(false); }
}

function openSaveModal() {
  if (operationBusy) return;
  ensureUi();
  if (!advancedState.files.length || !advancedState.pages.length) return setStatus('먼저 PDF 파일을 불러와 주세요.', 'error');
  $('advancedSessionNameInput').value = '';
  $('advancedSessionSaveStatus').textContent = '';
  $('advancedSessionSaveModal').hidden = false;
  setTimeout(() => $('advancedSessionNameInput').focus(), 50);
}

function bindTopActions() {
  ensureUi();
  $('advancedSessionSaveBtn')?.addEventListener('click', openSaveModal);
  $('advancedSessionLoadBtn')?.addEventListener('click', openLoadModal);
}

bindTopActions();
window.PdfAdvancedSessionPersistence = {
  captureState,
  validateSave,
  saveCurrentSession,
  openLoadModal,
  restoreState,
  loadSession,
  collection: SESSION_COLLECTION,
  stage: 'advanced-edit-session-source-files-state-restore-v1',
};
document.documentElement.dataset.pdfAdvancedSessionPersistence = '1';
