(() => {
  'use strict';
  if (window.__printCheckerSessionPersistenceV1) return;
  window.__printCheckerSessionPersistenceV1 = true;

  const $ = id => document.getElementById(id);
  const SESSION_COLLECTION = 'print_checker_sessions';
  const SESSION_FORMAT = 'program-studio-print-checker-session';
  const MAX_SESSIONS = 10;
  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  let currentSourceFile = null;
  let operationBusy = false;
  let storageReadyPromise = null;

  function setBusy(value) {
    operationBusy = Boolean(value);
    for (const id of ['printCheckerSessionSaveBtn', 'printCheckerSessionLoadBtn']) {
      const button = $(id);
      if (button) button.disabled = operationBusy;
    }
  }

  function installStyles() {
    if ($('printCheckerSessionStyles')) return;
    const style = document.createElement('style');
    style.id = 'printCheckerSessionStyles';
    style.textContent = `
      .checker-session-backdrop{position:fixed;inset:0;z-index:2200;background:rgba(15,23,42,.38);display:flex;align-items:center;justify-content:center;padding:18px}
      .checker-session-backdrop[hidden]{display:none!important}
      .checker-session-dialog{width:min(460px,94vw);max-height:min(620px,86vh);overflow:auto;background:#fff;border:1px solid #dbe3ec;border-radius:14px;box-shadow:0 22px 60px rgba(15,23,42,.24);padding:16px}
      .checker-session-head{display:flex;align-items:center;gap:10px;margin-bottom:13px}.checker-session-head strong{font-size:15px;color:#172033}.checker-session-head button{margin-left:auto;width:30px;height:30px;border:1px solid #dbe3ec;border-radius:8px;background:#fff;color:#64748b;cursor:pointer}
      .checker-session-field{display:block;font-size:10px;font-weight:800;color:#475569}.checker-session-field input{width:100%;height:38px;margin-top:6px;border:1px solid #cfd8e3;border-radius:8px;padding:0 10px;outline:none}.checker-session-field input:focus{border-color:#1d9bb2;box-shadow:0 0 0 2px rgba(29,155,178,.08)}
      .checker-session-status{min-height:18px;margin-top:9px;font-size:10px;line-height:1.45;color:#64748b}
      .checker-session-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}.checker-session-actions button{min-height:34px;padding:0 12px;border:1px solid #d5dee8;border-radius:8px;background:#fff;color:#334155;font-weight:800;cursor:pointer}.checker-session-actions button.primary{border-color:#12396d;background:#12396d;color:#fff}
      .checker-session-list{display:flex;flex-direction:column;gap:8px}.checker-session-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:10px;border:1px solid #dce4ec;border-radius:10px;background:#f8fafc}.checker-session-copy{min-width:0}.checker-session-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#1e293b}.checker-session-copy span{display:block;margin-top:3px;font-size:9px;color:#64748b}.checker-session-item-actions{display:flex;gap:5px}.checker-session-item-actions button{height:30px;padding:0 9px;border:1px solid #cdd7e2;border-radius:7px;background:#fff;color:#334155;font-size:9px;font-weight:800;cursor:pointer}.checker-session-item-actions button.delete{color:#b91c1c}.checker-session-empty{padding:22px 8px;text-align:center;color:#94a3b8;font-size:11px}
    `;
    document.head.appendChild(style);
  }

  function ensureUi() {
    installStyles();
    if (!$('printCheckerSessionSaveModal')) {
      const save = document.createElement('div');
      save.id = 'printCheckerSessionSaveModal';
      save.className = 'checker-session-backdrop';
      save.hidden = true;
      save.innerHTML = `
        <div class="checker-session-dialog" role="dialog" aria-modal="true" aria-labelledby="printCheckerSessionSaveTitle">
          <div class="checker-session-head"><strong id="printCheckerSessionSaveTitle">편집 내용 저장</strong><button type="button" data-close-save aria-label="닫기">×</button></div>
          <label class="checker-session-field">저장 이름<input id="printCheckerSessionNameInput" type="text" maxlength="120" placeholder="예: A4 리플렛 최종 점검"></label>
          <div class="checker-session-status" id="printCheckerSessionSaveStatus" role="status"></div>
          <div class="checker-session-actions"><button type="button" data-close-save>취소</button><button class="primary" id="printCheckerSessionSaveConfirm" type="button">저장</button></div>
        </div>`;
      document.body.appendChild(save);
      save.querySelectorAll('[data-close-save]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) save.hidden = true; }));
      save.addEventListener('click', event => { if (event.target === save && !operationBusy) save.hidden = true; });
      $('printCheckerSessionSaveConfirm').addEventListener('click', saveCurrentSession);
      $('printCheckerSessionNameInput').addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveCurrentSession();
        }
      });
    }

    if (!$('printCheckerSessionLoadModal')) {
      const load = document.createElement('div');
      load.id = 'printCheckerSessionLoadModal';
      load.className = 'checker-session-backdrop';
      load.hidden = true;
      load.innerHTML = `
        <div class="checker-session-dialog" role="dialog" aria-modal="true" aria-labelledby="printCheckerSessionLoadTitle">
          <div class="checker-session-head"><strong id="printCheckerSessionLoadTitle">편집 내용 불러오기</strong><button type="button" data-close-load aria-label="닫기">×</button></div>
          <div class="checker-session-list" id="printCheckerSessionList"></div>
        </div>`;
      document.body.appendChild(load);
      load.querySelectorAll('[data-close-load]').forEach(button => button.addEventListener('click', () => { if (!operationBusy) load.hidden = true; }));
      load.addEventListener('click', event => { if (event.target === load && !operationBusy) load.hidden = true; });
    }
  }

  function ensureStorageApi() {
    if (window.firebase && typeof firebase.storage === 'function') return Promise.resolve(firebase.storage());
    if (storageReadyPromise) return storageReadyPromise;
    storageReadyPromise = new Promise((resolve, reject) => {
      const existing = document.getElementById('printCheckerFirebaseStorageCompat');
      const finish = () => {
        if (window.firebase && typeof firebase.storage === 'function') resolve(firebase.storage());
        else reject(new Error('파일 저장 서비스를 불러오지 못했습니다.'));
      };
      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', () => reject(new Error('파일 저장 서비스를 불러오지 못했습니다.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'printCheckerFirebaseStorageCompat';
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', () => reject(new Error('파일 저장 서비스를 불러오지 못했습니다.')), { once: true });
      document.head.appendChild(script);
    }).catch(error => {
      storageReadyPromise = null;
      throw error;
    });
    return storageReadyPromise;
  }

  function extensionFor(file) {
    const type = String(file?.type || '').toLowerCase();
    if (type === 'application/pdf') return 'pdf';
    if (type === 'image/png') return 'png';
    if (type === 'image/webp') return 'webp';
    if (type === 'image/jpeg') return 'jpg';
    const match = String(file?.name || '').toLowerCase().match(/\.(pdf|png|jpe?g|webp)$/);
    return match ? (match[1] === 'jpeg' ? 'jpg' : match[1]) : '';
  }

  function normalizedContentType(file, extension) {
    if (extension === 'pdf') return 'application/pdf';
    if (extension === 'png') return 'image/png';
    if (extension === 'webp') return 'image/webp';
    return 'image/jpeg';
  }

  function captureState() {
    const checker = window.PrintChecker?.getState?.() || {};
    return {
      format: SESSION_FORMAT,
      version: 1,
      sourceName: String(currentSourceFile?.name || 'source').slice(0, 180),
      sourceType: String(currentSourceFile?.type || ''),
      checker: {
        product: checker.product || '',
        fileSide: checker.fileSide || 'front',
        specs: checker.specs || {},
      },
      adjustment: {
        x: Number($('adjX')?.value || 0),
        y: Number($('adjY')?.value || 0),
        scale: Number($('adjScale')?.value || 100),
        fileHasBleed: Boolean($('fileHasBleed')?.checked),
      },
      hadReport: Boolean($('reportSection') && !$('reportSection').hidden),
    };
  }

  function validateSave(file, state) {
    if (!window.auth?.currentUser) throw new Error('로그인이 필요합니다.');
    if (!file) throw new Error('먼저 검토할 PDF 또는 이미지를 올려 주세요.');
    if (!extensionFor(file)) throw new Error('PDF·PNG·JPEG·WEBP 파일만 저장할 수 있습니다.');
    if (Number(file.size || 0) <= 0 || Number(file.size || 0) > MAX_FILE_BYTES) throw new Error('원본 파일은 200MB 이하만 저장할 수 있습니다.');
    if (!state.checker.product) throw new Error('제품 유형을 먼저 선택해 주세요.');
    const serialized = JSON.stringify(state);
    if (new TextEncoder().encode(serialized).byteLength > 850000) throw new Error('편집 설정이 너무 커서 저장할 수 없습니다.');
    return serialized;
  }

  async function cleanupStoragePaths(paths, storage) {
    if (!storage) return;
    await Promise.allSettled((paths || []).map(pathValue => storage.ref(pathValue).delete()));
  }

  async function trimOldSessions(collection, storage) {
    const snapshot = await collection.orderBy('createdAt', 'asc').get();
    const excess = Math.max(0, snapshot.size - MAX_SESSIONS);
    for (const doc of snapshot.docs.slice(0, excess)) {
      await cleanupStoragePaths(doc.data()?.storagePaths || [], storage);
      await doc.ref.delete();
    }
  }

  async function saveCurrentSession() {
    if (operationBusy) return false;
    ensureUi();
    const status = $('printCheckerSessionSaveStatus');
    const user = window.auth?.currentUser;
    const db = window.db;
    let state, serialized;
    try {
      state = captureState();
      serialized = validateSave(currentSourceFile, state);
    } catch (error) {
      status.textContent = error.message;
      return false;
    }
    if (!user || !db) {
      status.textContent = '저장 서비스에 연결할 수 없습니다.';
      return false;
    }

    const extension = extensionFor(currentSourceFile);
    const contentType = normalizedContentType(currentSourceFile, extension);
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const storagePath = `print_checker_sessions/${user.uid}/${sessionId}/source.${extension}`;
    const collection = db.collection('users').doc(user.uid).collection(SESSION_COLLECTION);
    const name = ($('printCheckerSessionNameInput')?.value || '').trim() || '인쇄물 사전 검토';
    setBusy(true);
    $('printCheckerSessionSaveConfirm').disabled = true;
    status.textContent = '원본 파일을 저장하는 중...';

    let storage = null;
    try {
      storage = await ensureStorageApi();
      await storage.ref(storagePath).put(currentSourceFile, {
        contentType,
        customMetadata: { ownerUid: user.uid, purpose: 'print-checker-session-source', sessionId },
      });
      status.textContent = '검토 설정을 저장하는 중...';
      const pageCount = Math.max(1, Math.min(5000, Number(window.PrintChecker?.getState?.()?.pdfPageCount || 1)));
      await collection.add({
        name: name.slice(0, 120),
        sessionId,
        storagePaths: [storagePath],
        fileCount: 1,
        pageCount: Math.round(pageCount),
        totalBytes: Number(currentSourceFile.size || 0),
        state: serialized,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      await trimOldSessions(collection, storage).catch(error => console.warn('[print-checker-session] cleanup failed', error));
      status.textContent = '저장 완료';
      setTimeout(() => { $('printCheckerSessionSaveModal').hidden = true; }, 650);
      return true;
    } catch (error) {
      if (storage) await cleanupStoragePaths([storagePath], storage);
      status.textContent = `저장 실패: ${error.message}`;
      return false;
    } finally {
      $('printCheckerSessionSaveConfirm').disabled = false;
      setBusy(false);
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
    const modal = $('printCheckerSessionLoadModal');
    const list = $('printCheckerSessionList');
    modal.hidden = false;
    list.innerHTML = '<div class="checker-session-empty">저장 목록을 불러오는 중...</div>';
    if (!user || !db) {
      list.innerHTML = '<div class="checker-session-empty">저장 목록을 불러올 수 없습니다.</div>';
      return;
    }
    try {
      const snapshot = await db.collection('users').doc(user.uid).collection(SESSION_COLLECTION).orderBy('createdAt', 'desc').limit(20).get();
      list.replaceChildren();
      if (snapshot.empty) {
        list.innerHTML = '<div class="checker-session-empty">저장된 인쇄물 검토 내용이 없습니다.</div>';
        return;
      }
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const item = document.createElement('div');
        item.className = 'checker-session-item';
        const copy = document.createElement('div');
        copy.className = 'checker-session-copy';
        const title = document.createElement('strong');
        title.textContent = String(data.name || '인쇄물 사전 검토');
        const meta = document.createElement('span');
        const created = formatCreatedAt(data.createdAt);
        meta.textContent = `${Number(data.pageCount || 1)}p${created ? ` · ${created}` : ''}`;
        copy.append(title, meta);
        const actions = document.createElement('div');
        actions.className = 'checker-session-item-actions';
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
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'checker-session-empty';
      empty.textContent = `저장 목록을 불러오지 못했습니다: ${error.message}`;
      list.appendChild(empty);
    }
  }

  function applySavedSpecs(specs = {}) {
    const form = $('specForm');
    if (!form) return;
    for (const [id, value] of Object.entries(specs)) {
      const input = $(id);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value == null ? '' : String(value);
    }
    const wingGroup = $('wingWGroup');
    if (wingGroup && $('hasWing')) wingGroup.hidden = !$('hasWing').checked;
    form.dispatchEvent(new Event('input', { bubbles: true }));
    form.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setAdjustment(id, value) {
    const input = $(id);
    if (!input || value == null) return;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function loadSession(docId, data) {
    if (operationBusy) return false;
    let saved;
    try {
      saved = JSON.parse(String(data.state || ''));
      if (saved.format !== SESSION_FORMAT || !saved.checker?.product) throw new Error('저장 형식이 올바르지 않습니다.');
    } catch (error) {
      window.alert(`저장 내용을 읽을 수 없습니다: ${error.message}`);
      return false;
    }

    const pathValue = Array.isArray(data.storagePaths) ? data.storagePaths[0] : '';
    if (!pathValue) {
      window.alert('저장된 원본 파일이 없습니다.');
      return false;
    }

    setBusy(true);
    try {
      const storage = await ensureStorageApi();
      const url = await storage.ref(pathValue).getDownloadURL();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`원본 파일 다운로드 실패 (${response.status})`);
      const blob = await response.blob();
      const extension = extensionFor({ name: pathValue, type: saved.sourceType || blob.type });
      const filename = String(saved.sourceName || `saved-source.${extension || 'pdf'}`).replace(/[\\/:*?"<>|]/g, '_');
      const type = saved.sourceType || normalizedContentType(null, extension || 'pdf');
      const file = new File([blob], filename, { type });

      window.PrintChecker?.selectProduct?.(saved.checker.product);
      applySavedSpecs(saved.checker.specs || {});
      currentSourceFile = file;
      const input = $('fileInput');
      if (input && typeof DataTransfer === 'function') {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        input.files = transfer.files;
      }
      const loaded = await window.PrintChecker?.inspectFile?.(file);
      if (loaded === false) throw new Error('원본 파일을 다시 열지 못했습니다.');

      const bleed = $('fileHasBleed');
      if (bleed) {
        bleed.checked = Boolean(saved.adjustment?.fileHasBleed);
        bleed.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setAdjustment('adjX', saved.adjustment?.x ?? 0);
      setAdjustment('adjY', saved.adjustment?.y ?? 0);
      setAdjustment('adjScale', saved.adjustment?.scale ?? 100);
      await window.PrintChecker?.setFileSide?.(saved.checker.fileSide || 'front');
      if (saved.hadReport) window.PrintChecker?.runCheck?.();
      $('printCheckerSessionLoadModal').hidden = true;
      return true;
    } catch (error) {
      window.alert(`불러오기 실패: ${error.message}`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function deleteSession(docId, data, node) {
    if (operationBusy || !window.confirm('이 저장 내용을 삭제할까요?')) return;
    const user = window.auth?.currentUser;
    const db = window.db;
    if (!user || !db) return;
    setBusy(true);
    try {
      const storage = await ensureStorageApi();
      await db.collection('users').doc(user.uid).collection(SESSION_COLLECTION).doc(docId).delete();
      await cleanupStoragePaths(data.storagePaths || [], storage);
      node?.remove();
      if (!$('printCheckerSessionList')?.children.length) {
        $('printCheckerSessionList').innerHTML = '<div class="checker-session-empty">저장된 인쇄물 검토 내용이 없습니다.</div>';
      }
    } catch (error) {
      window.alert(`저장 내용 삭제 실패: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  function openSaveModal() {
    if (operationBusy) return;
    ensureUi();
    const status = $('printCheckerSessionSaveStatus');
    status.textContent = '';
    if (!currentSourceFile) {
      status.textContent = '먼저 검토할 PDF 또는 이미지를 올려 주세요.';
    }
    $('printCheckerSessionSaveModal').hidden = false;
    const input = $('printCheckerSessionNameInput');
    input.value = '';
    setTimeout(() => input.focus(), 0);
  }

  function trackSourceFile() {
    $('fileInput')?.addEventListener('change', event => {
      currentSourceFile = event.currentTarget?.files?.[0] || null;
    }, true);
    $('uploadZone')?.addEventListener('drop', event => {
      currentSourceFile = event.dataTransfer?.files?.[0] || null;
    }, true);
    $('resetBtn')?.addEventListener('click', () => { currentSourceFile = null; });
  }

  function bind() {
    ensureUi();
    trackSourceFile();
    $('printCheckerSessionSaveBtn')?.addEventListener('click', openSaveModal);
    $('printCheckerSessionLoadBtn')?.addEventListener('click', openLoadModal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();

  window.PrintCheckerSessions = Object.freeze({
    openSaveModal,
    openLoadModal,
    stage: 'firebase-session-v1',
  });
})();