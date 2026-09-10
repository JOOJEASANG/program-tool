(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const SESSION_COLLECTION = 'pdf_smart_layout_sessions';
  const SESSION_FORMAT = 'program-studio-smart-print-layout-session';
  const MAX_SESSIONS = 10;
  const MAX_FILES = 30;
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
  let operationBusy = false;

  function layoutApi() {
    return window.SmartPrintLayout || null;
  }

  function storageApi() {
    try { return window.firebase?.storage?.(); } catch (_) { return null; }
  }

  function setStatus(message = '', type = '') {
    const node = $('statusLine');
    if (!node) return;
    node.textContent = message;
    node.className = `status${type ? ` ${type}` : ''}`;
  }

  function setBusy(value) {
    operationBusy = Boolean(value);
    for (const id of ['smartSessionSaveBtn', 'smartSessionLoadBtn']) {
      const button = $(id);
      if (button) button.disabled = operationBusy;
    }
  }

  function ensureUi() {
    if (!$('smartSessionSaveModal')) {
      const save = document.createElement('div');
      save.id = 'smartSessionSaveModal';
      save.className = 'smart-session-backdrop';
      save.hidden = true;
      save.innerHTML = `
        <div class="smart-session-dialog" role="dialog" aria-modal="true" aria-labelledby="smartSessionSaveTitle">
          <div class="smart-session-head"><strong id="smartSessionSaveTitle">편집 내용 저장</strong><button type="button" data-close-save aria-label="닫기">×</button></div>
          <label class="smart-session-field">저장 이름<input id="smartSessionNameInput" type="text" maxlength="120" placeholder="예: 명함 A3 자동배치"></label>
          <div class="smart-session-status" id="smartSessionSaveStatus" role="status"></div>
          <div class="smart-session-actions"><button type="button" data-close-save>취소</button><button class="primary" id="smartSessionSaveConfirm" type="button">저장</button></div>
        </div>`;
      document.body.appendChild(save);
      save.querySelectorAll('[data-close-save]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) save.hidden = true; }));
      save.addEventListener('click', event => { if (event.target === save && !operationBusy) save.hidden = true; });
      $('smartSessionSaveConfirm').addEventListener('click', saveCurrentSession);
      $('smartSessionNameInput').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveCurrentSession();
        }
      });
    }

    if (!$('smartSessionLoadModal')) {
      const load = document.createElement('div');
      load.id = 'smartSessionLoadModal';
      load.className = 'smart-session-backdrop';
      load.hidden = true;
      load.innerHTML = `
        <div class="smart-session-dialog" role="dialog" aria-modal="true" aria-labelledby="smartSessionLoadTitle">
          <div class="smart-session-head"><strong id="smartSessionLoadTitle">편집 내용 불러오기</strong><button type="button" data-close-load aria-label="닫기">×</button></div>
          <div class="smart-session-list" id="smartSessionList"></div>
        </div>`;
      document.body.appendChild(load);
      load.querySelectorAll('[data-close-load]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) load.hidden = true; }));
      load.addEventListener('click', event => { if (event.target === load && !operationBusy) load.hidden = true; });
    }
  }

  function captureSettings() {
    return {
      paperPreset: $('paperPreset')?.value || 'a3',
      paperWidth: Number($('paperWidth')?.value || 297),
      paperHeight: Number($('paperHeight')?.value || 420),
      marginMm: Number($('marginMm')?.value || 5),
      gapMm: Number($('gapMm')?.value || 3),
      allowRotate: Boolean($('allowRotate')?.checked),
      sideMode: $('sideMode')?.value || 'auto',
      flipEdge: $('flipEdge')?.value || 'long',
      cropMarks: Boolean($('cropMarks')?.checked),
    };
  }

  function captureState() {
    const api = layoutApi();
    const items = api?.state?.items || [];
    return {
      format: SESSION_FORMAT,
      version: 1,
      fileNames: items.map(item => String(item.name || item.file?.name || 'source.pdf').slice(0, 180)),
      settings: captureSettings(),
    };
  }

  function validateSave(files, state) {
    if (!window.auth?.currentUser) throw new Error('로그인이 필요합니다.');
    if (!files.length) throw new Error('저장할 PDF가 없습니다.');
    if (files.length > MAX_FILES) throw new Error(`원본 PDF는 최대 ${MAX_FILES}개까지 저장할 수 있습니다.`);
    if (files.some(file => Number(file?.size || 0) <= 0 || Number(file?.size || 0) > MAX_FILE_BYTES)) throw new Error('PDF 한 파일은 20MB 이하만 저장할 수 있습니다.');
    const totalBytes = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error('원본 PDF 전체 합계는 최대 300MB까지 저장할 수 있습니다.');
    const serialized = JSON.stringify(state);
    if (serialized.length > 850000) throw new Error('편집 설정이 너무 커서 저장할 수 없습니다.');
    return { totalBytes, serialized };
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
    const api = layoutApi();
    const user = window.auth?.currentUser;
    const db = window.db;
    const storage = storageApi();
    const status = $('smartSessionSaveStatus');
    if (!api || !user || !db || !storage) {
      status.textContent = '저장 서비스에 연결할 수 없습니다.';
      return false;
    }

    const items = api.state?.items || [];
    const files = items.map(item => item.file).filter(Boolean);
    let captured, checked;
    try {
      captured = captureState();
      checked = validateSave(files, captured);
    } catch (error) {
      status.textContent = error.message;
      return false;
    }

    const name = ($('smartSessionNameInput').value || '').trim() || '스마트 인쇄배치';
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const collection = db.collection('users').doc(user.uid).collection(SESSION_COLLECTION);
    const storagePaths = [];
    setBusy(true);
    $('smartSessionSaveConfirm').disabled = true;
    setStatus('편집 내용을 저장하는 중...');

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

      status.textContent = '배치 설정 저장 중...';
      const pageCount = Math.max(1, items.reduce((sum, item) => sum + Number(item.pageCount || 1), 0));
      await collection.add({
        name: name.slice(0, 120),
        sessionId,
        storagePaths,
        fileCount: files.length,
        pageCount,
        totalBytes: checked.totalBytes,
        state: checked.serialized,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await trimOldSessions(collection).catch(error => console.warn('[smart-layout-session] cleanup failed', error));
      status.textContent = `저장 완료 · 원본 ${(checked.totalBytes / 1024 / 1024).toFixed(1)}MB`;
      setStatus('편집 내용을 저장했습니다.', 'success');
      setTimeout(() => { $('smartSessionSaveModal').hidden = true; }, 650);
      return true;
    } catch (error) {
      await cleanupStoragePaths(storagePaths, storage);
      status.textContent = `저장 실패: ${error.message}`;
      setStatus(`편집 저장 실패: ${error.message}`, 'error');
      return false;
    } finally {
      $('smartSessionSaveConfirm').disabled = false;
      setBusy(false);
    }
  }

  function formatCreatedAt(value) {
    try {
      const date = value?.toDate?.() || new Date(value);
      if (!date || Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
    } catch (_) {
      return '';
    }
  }

  async function openLoadModal() {
    if (operationBusy) return;
    ensureUi();
    const user = window.auth?.currentUser;
    const db = window.db;
    if (!user || !db) return setStatus('저장 목록을 불러올 수 없습니다.', 'error');

    const modal = $('smartSessionLoadModal');
    const list = $('smartSessionList');
    modal.hidden = false;
    list.innerHTML = '<div class="smart-session-empty">저장 목록을 불러오는 중...</div>';

    try {
      const snapshot = await db.collection('users').doc(user.uid).collection(SESSION_COLLECTION).orderBy('createdAt', 'desc').limit(20).get();
      list.replaceChildren();
      if (snapshot.empty) {
        list.innerHTML = '<div class="smart-session-empty">저장된 스마트 인쇄배치 내용이 없습니다.</div>';
        return;
      }

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const item = document.createElement('div');
        item.className = 'smart-session-item';

        const copy = document.createElement('div');
        copy.className = 'smart-session-copy';
        const title = document.createElement('strong');
        title.textContent = String(data.name || '스마트 인쇄배치');
        const meta = document.createElement('span');
        const created = formatCreatedAt(data.createdAt);
        meta.textContent = `${Number(data.fileCount || 0)}개 PDF${created ? ` · ${created}` : ''}`;
        copy.append(title, meta);

        const actions = document.createElement('div');
        actions.className = 'smart-session-item-actions';
        const loadButton = document.createElement('button');
        loadButton.type = 'button';
        loadButton.textContent = '불러오기';
        loadButton.addEventListener('click', () => loadSession(doc.id, data));
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'delete';
        deleteButton.textContent = '삭제';
        deleteButton.addEventListener('click', () => deleteSession(doc.id, data, item));
        actions.append(loadButton, deleteButton);

        item.append(copy, actions);
        list.appendChild(item);
      }
    } catch (error) {
      list.innerHTML = `<div class="smart-session-empty">저장 목록을 불러오지 못했습니다: ${escapeHtml(error.message)}</div>`;
    }
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function applySavedSettings(saved = {}) {
    const preset = $('paperPreset');
    if (preset) {
      preset.value = ['a4', 'b4', 'a3', 'sra3', 'a3plus', 'custom'].includes(saved.paperPreset) ? saved.paperPreset : 'custom';
      preset.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if ($('paperWidth') && Number.isFinite(Number(saved.paperWidth))) $('paperWidth').value = Number(saved.paperWidth);
    if ($('paperHeight') && Number.isFinite(Number(saved.paperHeight))) $('paperHeight').value = Number(saved.paperHeight);
    if ($('marginMm') && Number.isFinite(Number(saved.marginMm))) $('marginMm').value = Number(saved.marginMm);
    if ($('gapMm') && Number.isFinite(Number(saved.gapMm))) $('gapMm').value = Number(saved.gapMm);
    if ($('allowRotate')) $('allowRotate').checked = Boolean(saved.allowRotate);
    if ($('sideMode') && ['auto', 'single', 'duplex'].includes(saved.sideMode)) $('sideMode').value = saved.sideMode;
    if ($('flipEdge') && ['long', 'short'].includes(saved.flipEdge)) $('flipEdge').value = saved.flipEdge;
    if ($('cropMarks')) $('cropMarks').checked = Boolean(saved.cropMarks);
    layoutApi()?.recalculate?.();
  }

  async function waitForImport(expectedCount, timeoutMs = 90000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const api = layoutApi();
      const count = api?.state?.items?.length || 0;
      if (!api?.state?.busy && count >= expectedCount) return true;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    throw new Error('PDF 불러오기가 제한 시간을 초과했습니다.');
  }

  async function loadSession(docId, data) {
    if (operationBusy) return false;
    const api = layoutApi();
    const storage = storageApi();
    if (!api || !storage) return setStatus('불러오기 서비스에 연결할 수 없습니다.', 'error');

    let saved;
    try {
      saved = JSON.parse(String(data.state || ''));
      if (saved.format !== SESSION_FORMAT || !saved.settings) throw new Error('저장 형식이 올바르지 않습니다.');
    } catch (error) {
      setStatus(`저장 내용을 읽을 수 없습니다: ${error.message}`, 'error');
      return false;
    }

    setBusy(true);
    setStatus('저장된 PDF를 불러오는 중...');
    try {
      const paths = Array.isArray(data.storagePaths) ? data.storagePaths : [];
      if (!paths.length) throw new Error('저장된 원본 PDF가 없습니다.');
      const files = [];
      for (let index = 0; index < paths.length; index += 1) {
        setStatus(`원본 PDF 불러오는 중... (${index + 1}/${paths.length})`);
        const url = await storage.ref(paths[index]).getDownloadURL();
        const response = await fetch(url);
        if (!response.ok) throw new Error(`원본 PDF 다운로드 실패 (${response.status})`);
        const blob = await response.blob();
        const filename = String(saved.fileNames?.[index] || `session_${index + 1}.pdf`).replace(/[\\/:*?"<>|]/g, '_');
        files.push(new File([blob], filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`, { type: 'application/pdf' }));
      }

      $('resetBtn')?.click();
      applySavedSettings(saved.settings);

      const transfer = new DataTransfer();
      files.forEach(file => transfer.items.add(file));
      const input = $('fileInput');
      if (!input) throw new Error('PDF 입력 화면을 찾을 수 없습니다.');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await waitForImport(files.length);
      api.recalculate?.();
      $('smartSessionLoadModal').hidden = true;
      setStatus(`저장된 편집 내용을 불러왔습니다. · ${files.length}개 PDF`, 'success');
      return true;
    } catch (error) {
      setStatus(`불러오기 실패: ${error.message}`, 'error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession(docId, data, node) {
    if (operationBusy) return;
    const user = window.auth?.currentUser;
    const db = window.db;
    if (!user || !db) return;
    if (!window.confirm('이 저장 내용을 삭제할까요?')) return;
    setBusy(true);
    try {
      await db.collection('users').doc(user.uid).collection(SESSION_COLLECTION).doc(docId).delete();
      await cleanupStoragePaths(data.storagePaths || []);
      node?.remove();
      if (!$('smartSessionList')?.children.length) $('smartSessionList').innerHTML = '<div class="smart-session-empty">저장된 스마트 인쇄배치 내용이 없습니다.</div>';
      setStatus('저장 내용을 삭제했습니다.', 'success');
    } catch (error) {
      setStatus(`저장 내용 삭제 실패: ${error.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function openSaveModal() {
    if (operationBusy) return;
    ensureUi();
    const api = layoutApi();
    if (!api?.state?.items?.length) return setStatus('먼저 PDF를 불러와 주세요.', 'error');
    $('smartSessionSaveStatus').textContent = '';
    $('smartSessionSaveModal').hidden = false;
    const input = $('smartSessionNameInput');
    input.value = '';
    setTimeout(() => input.focus(), 0);
  }

  function bind() {
    ensureUi();
    $('smartSessionSaveBtn')?.addEventListener('click', openSaveModal);
    $('smartSessionLoadBtn')?.addEventListener('click', openLoadModal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.SmartPrintLayoutSessions = { openSaveModal, openLoadModal, stage: 'firebase-session-v1' };
})();
