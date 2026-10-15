// Safe editor-session persistence for multiple source PDFs.
(function () {
  'use strict';
  if (window.__pdfSessionSaveSafetyV2) return;
  window.__pdfSessionSaveSafetyV2 = true;

  const MAX_INSTALL_ATTEMPTS = 40;
  const MAX_SESSIONS = 10;
  const MAX_SESSION_FILES = 50;
  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const MAX_SESSION_BYTES = 300 * 1024 * 1024;
  const MAX_STATE_BYTES = 780 * 1024;
  let installAttempts = 0;
  let active = false;
  let lockSnapshot = null;
  let loadedSession = null;

  const byId = (id) => document.getElementById(id);
  const totalBytes = (files) => Array.from(files || []).reduce((sum, file) => sum + Number(file?.size || 0), 0);
  const utf8Bytes = (value) => new TextEncoder().encode(String(value ?? '')).byteLength;

  function editorReady() {
    try {
      return Boolean(
        typeof auth !== 'undefined'
        && typeof db !== 'undefined'
        && typeof storage !== 'undefined'
        && typeof firebase !== 'undefined'
        && typeof collectEditorState === 'function'
        && typeof uploadedFiles !== 'undefined'
        && Array.isArray(uploadedFiles)
        && typeof parsedPages !== 'undefined'
        && Array.isArray(parsedPages)
        && byId('sessionSaveConfirm')
        && byId('sessionNameInput')
        && byId('sessionSaveStatus')
      );
    } catch (_) {
      return false;
    }
  }

  function cloneSerializable(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function validateSnapshot(files, state, stateJson = JSON.stringify(state)) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('저장할 원본 PDF가 없습니다.');
    }
    if (files.length > MAX_SESSION_FILES) {
      throw new Error(`저장 세션은 원본 PDF를 최대 ${MAX_SESSION_FILES}개까지 보관할 수 있습니다.`);
    }
    const bytes = totalBytes(files);
    if (files.some((file) => Number(file?.size || 0) > MAX_FILE_BYTES)) {
      throw new Error('저장 세션의 PDF 한 파일은 최대 200MB까지 가능합니다.');
    }
    if (bytes > MAX_SESSION_BYTES) {
      throw new Error('저장 세션의 원본 PDF 전체 합계는 최대 300MB까지 가능합니다.');
    }
    if (!state || !Array.isArray(state.pages)) {
      throw new Error('편집 페이지 상태를 확인할 수 없습니다.');
    }
    const stateBytes = utf8Bytes(stateJson);
    if (stateBytes > MAX_STATE_BYTES) {
      throw new Error('편집 상태가 너무 커서 세션을 저장할 수 없습니다. 작업을 나누어 저장해 주세요.');
    }

    state.pages.forEach((page, index) => {
      const type = page?.pageType || 'pdf';
      if (type === 'blank' || type === 'divider') return;
      const fileIndex = Number(page?.file_index);
      const pageIndex = Number(page?.page_index);
      if (!Number.isInteger(fileIndex) || fileIndex < 0 || fileIndex >= files.length) {
        throw new Error(`${index + 1}페이지의 원본 파일 연결이 올바르지 않습니다.`);
      }
      if (!Number.isInteger(pageIndex) || pageIndex < 0) {
        throw new Error(`${index + 1}페이지의 원본 페이지 번호가 올바르지 않습니다.`);
      }
    });

    return {
      fileCount: files.length,
      pageCount: state.pages.length,
      breakCount: state.pages.filter((page) => Boolean(page?.groupBreak)).length,
      totalBytes: bytes,
      stateBytes,
      stateJson,
    };
  }

  function mutationElements() {
    const selectors = [
      '#fileInput', '#uploadZone', '#navSessionBtn', '#navSessionLoadBtn',
      '#previewBtn', '#downloadBtn', '#resetBtn',
      '.mode-btn', '#thumbArea', '#thumbCtxMenu',
      '#thumbArea button', '#thumbArea input',
      '#previewScroll button', '#previewScroll input'
    ];
    return [...document.querySelectorAll(selectors.join(','))]
      .filter((element, index, all) => all.indexOf(element) === index)
      .filter((element) => element.id !== 'sessionSaveConfirm');
  }

  function isEditorMutationTarget(target) {
    return Boolean(target?.closest?.(
      '#thumbArea, #thumbCtxMenu, #uploadZone, .mode-btn, '
      + '#navSessionBtn, #navSessionLoadBtn, #previewBtn, #downloadBtn, #resetBtn'
    ));
  }

  function blockMutation(event) {
    if (!active) return;
    const target = event.target;
    if (target && target.closest?.('#sessionSaveModal')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function blockPointerMutation(event) {
    if (!active || !isEditorMutationTarget(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function blockMutationKey(event) {
    if (!active) return;
    const key = String(event.key || '').toLowerCase();
    const mutates = key === 'delete' || key === 'backspace'
      || ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y'));
    if (!mutates) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function installMutationBlockers() {
    document.addEventListener('drop', blockMutation, true);
    document.addEventListener('keydown', blockMutationKey, true);
    document.addEventListener('click', blockPointerMutation, true);
    document.addEventListener('contextmenu', blockPointerMutation, true);
    document.addEventListener('pointerdown', blockPointerMutation, true);
    document.addEventListener('dragstart', blockPointerMutation, true);
  }

  function removeMutationBlockers() {
    document.removeEventListener('drop', blockMutation, true);
    document.removeEventListener('keydown', blockMutationKey, true);
    document.removeEventListener('click', blockPointerMutation, true);
    document.removeEventListener('contextmenu', blockPointerMutation, true);
    document.removeEventListener('pointerdown', blockPointerMutation, true);
    document.removeEventListener('dragstart', blockPointerMutation, true);
  }

  function lockEditor() {
    const body = document.body;
    const elements = mutationElements().map((element) => ({
      element,
      disabled: 'disabled' in element ? element.disabled : null,
      ariaDisabled: element.getAttribute('aria-disabled'),
      pointerEvents: element.style.pointerEvents,
    }));

    elements.forEach(({ element }) => {
      if ('disabled' in element) element.disabled = true;
      element.setAttribute('aria-disabled', 'true');
      if (!('disabled' in element)) element.style.pointerEvents = 'none';
    });

    lockSnapshot = {
      elements,
      ariaBusy: body.getAttribute('aria-busy'),
    };
    body.dataset.pdfSessionSaving = 'true';
    body.setAttribute('aria-busy', 'true');
    installMutationBlockers();
  }

  function unlockEditor() {
    const body = document.body;
    const snapshot = lockSnapshot;
    lockSnapshot = null;
    removeMutationBlockers();

    if (snapshot) {
      snapshot.elements.forEach(({ element, disabled, ariaDisabled, pointerEvents }) => {
        if ('disabled' in element && disabled !== null) element.disabled = disabled;
        if (ariaDisabled === null) element.removeAttribute('aria-disabled');
        else element.setAttribute('aria-disabled', ariaDisabled);
        element.style.pointerEvents = pointerEvents;
      });
      if (snapshot.ariaBusy === null) body.removeAttribute('aria-busy');
      else body.setAttribute('aria-busy', snapshot.ariaBusy);
    }
    delete body.dataset.pdfSessionSaving;
  }

  function isMissingStorageError(error) {
    return error?.code === 'storage/object-not-found'
      || error?.code === 'object-not-found';
  }

  async function deleteStoragePath(path) {
    try {
      await storage.ref(path).delete();
      return { path, missing: false };
    } catch (error) {
      if (isMissingStorageError(error)) return { path, missing: true };
      throw error;
    }
  }

  async function cleanupUploadedPaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return [];
    return Promise.allSettled(paths.map((path) => deleteStoragePath(path)));
  }

  async function trimOldSessions(collection, newDocumentId) {
    const snapshot = await collection.orderBy('createdAt', 'asc').get();
    const excess = Math.max(0, snapshot.size - MAX_SESSIONS);
    if (!excess) return;

    const removable = snapshot.docs
      .filter((document) => document.id !== newDocumentId)
      .slice(0, excess);

    for (const document of removable) {
      const paths = document.data()?.storagePaths || [];
      const results = await cleanupUploadedPaths(paths);
      if (results.some((result) => result.status === 'rejected')) {
        console.warn('[pdf-session] source cleanup incomplete; keeping session document', document.id);
        continue;
      }
      await collection.doc(document.id).delete();
    }
  }

  function normalizeLoadedSession(session) {
    if (!session || typeof session !== 'object') return null;
    const { docId, sessionId, uid, name, storagePaths } = session;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(docId || ''))
      || !/^[A-Za-z0-9_-]{8,40}$/.test(String(sessionId || ''))
      || !Array.isArray(storagePaths) || !storagePaths.length
      || !uid || typeof uid !== 'string') return null;
    if (!storagePaths.every((path, i) =>
      path === `pdf_sessions/${uid}/${sessionId}/src_${i}.pdf`)) return null;
    return { docId, sessionId, uid, name: String(name || '편집 세션'), storagePaths: [...storagePaths] };
  }

  function setLoadedSession(session) {
    loadedSession = normalizeLoadedSession(session);
    updateSaveDialog();
    return !!loadedSession;
  }

  function clearLoadedSession() {
    loadedSession = null;
    updateSaveDialog();
  }

  function currentLoadedSession() {
    const user = auth?.currentUser;
    return loadedSession && user?.uid === loadedSession.uid ? { ...loadedSession } : null;
  }

  function updateSaveDialog() {
    const target = currentLoadedSession();
    const overwriteButton = byId('sessionOverwriteConfirm');
    const description = byId('sessionOverwriteDescription');
    if (overwriteButton) {
      overwriteButton.hidden = !target;
      overwriteButton.style.display = target ? '' : 'none';
      overwriteButton.disabled = active;
    }
    if (description) {
      description.hidden = !target;
      description.style.display = target ? '' : 'none';
      description.textContent = target
        ? `현재 불러온 저장본: "${target.name}" · 덮어쓰기를 누르면 같은 목록 항목이 갱신됩니다.`
        : '';
    }
    const newButton = byId('sessionSaveConfirm');
    if (newButton) newButton.textContent = target ? '새 이름으로 저장' : '새 편집 저장';
  }

  function prepareSaveDialog() {
    updateSaveDialog();
    const target = currentLoadedSession();
    const nameInput = byId('sessionNameInput');
    if (nameInput) nameInput.value = target ? target.name.slice(0, 40) : '';
  }

  function setStatus(message, color) {
    const status = byId('sessionSaveStatus');
    if (!status) return;
    status.textContent = message;
    if (color) status.style.color = color;
  }

  async function saveSessionSafely(mode = 'new') {
    if (active || !editorReady()) return false;
    const user = auth.currentUser;
    const files = [...uploadedFiles];
    if (!user || files.length === 0) return false;

    let state;
    let snapshotMeta;
    try {
      state = cloneSerializable(collectEditorState());
      const stateJson = JSON.stringify(state);
      snapshotMeta = validateSnapshot(files, state, stateJson);
    } catch (error) {
      setStatus(`저장 전 확인 실패: ${error.message}`, '#dc2626');
      return false;
    }

    const requestedOverwrite = mode === 'overwrite';
    const target = requestedOverwrite ? currentLoadedSession() : null;
    if (requestedOverwrite && !target) {
      setStatus('덮어쓸 저장본이 없습니다. 편집 불러오기에서 해당 저장본을 먼저 선택하세요.', '#dc2626');
      return false;
    }
    const name = requestedOverwrite
      ? target.name
      : ((byId('sessionNameInput')?.value || '').trim() || '편집 세션').slice(0, 40);
    if (target && !window.confirm(`기존 저장본 "${target.name}"에 현재 수정 내용을 덮어쓸까요?\\n이전 저장본의 내용은 복원할 수 없습니다.`)) return false;
    const sessionId = window.crypto.randomUUID().replace(/-/g, '');
    const storagePaths = [];
    const collection = db.collection('users').doc(user.uid).collection('pdf_sessions');
    const confirmButton = byId('sessionSaveConfirm');
    const overwriteButton = byId('sessionOverwriteConfirm');
    let documentRef = null;

    active = true;
    if (confirmButton) confirmButton.disabled = true;
    if (overwriteButton) overwriteButton.disabled = true;
    lockEditor();
    setStatus('파일 업로드 중...', '#6b7280');

    try {
      if (target) {
        // Preflight before uploading any replacement source. The final check
        // is repeated atomically in a Firestore transaction below.
        const currentDoc = await collection.doc(target.docId).get();
        const current = currentDoc.exists ? currentDoc.data() || {} : null;
        if (!current || current.sessionId !== target.sessionId
          || JSON.stringify(current.storagePaths) !== JSON.stringify(target.storagePaths)) {
          throw new Error('저장본이 다른 창에서 변경되었거나 삭제되었습니다. 다시 불러온 뒤 저장해 주세요.');
        }
      }
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`파일 업로드 중... (${index + 1}/${files.length})`, '#6b7280');
        const path = `pdf_sessions/${user.uid}/${sessionId}/src_${index}.pdf`;
        storagePaths.push(path);
        await storage.ref(path).put(file, {
          contentType: 'application/pdf',
          customMetadata: {
            ownerUid: user.uid,
            purpose: 'pdf-session-source',
            sessionId,
          },
        });
      }

      setStatus('상태 저장 중...', '#6b7280');
      const payload = {
        name: name.slice(0, 120),
        sessionId,
        storagePaths: [...storagePaths],
        fileCount: files.length,
        pageCount: state.pages.length,
        totalBytes: snapshotMeta.totalBytes,
        state: snapshotMeta.stateJson,
      };
      if (target) {
        const targetRef = collection.doc(target.docId);
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(targetRef);
          const current = snapshot.exists ? snapshot.data() || {} : null;
          if (!current || current.sessionId !== target.sessionId
            || JSON.stringify(current.storagePaths) !== JSON.stringify(target.storagePaths)) {
            throw new Error('저장본이 다른 창에서 변경되었습니다. 다시 불러온 뒤 덮어쓰기 해 주세요.');
          }
          transaction.update(targetRef, {
            ...payload,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        });
        documentRef = targetRef;
      } else {
        documentRef = await collection.add({
          ...payload,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      }
      setLoadedSession({
        docId: documentRef.id, sessionId, storagePaths, name: payload.name, uid: user.uid,
      });
      if (target) {
        // Old source files are immutable. Delete only AFTER the new revision
        // and Firestore document are committed; a partial failure leaves
        // the original revision untouched.
        try {
          const results = await cleanupUploadedPaths(target.storagePaths);
          if (results.some(result => result.status === 'rejected')) {
            console.warn('[pdf-session] old revision cleanup deferred');
          }
        } catch (_) {
          console.warn('[pdf-session] old revision cleanup deferred');
        }
      } else {
        try {
          await trimOldSessions(collection, documentRef.id);
        } catch (trimError) {
          console.warn('[pdf-session] old session cleanup failed', trimError);
        }
      }

      setStatus(`✅ ${target ? '기존 저장본 덮어쓰기 완료!' : '새 편집 저장 완료!'} · 원본 ${(snapshotMeta.totalBytes / 1024 / 1024).toFixed(1)}MB`, '#166534');
      setTimeout(() => {
        const modal = byId('sessionSaveModal');
        if (modal) modal.style.display = 'none';
      }, 1200);
      return true;
    } catch (error) {
      if (!documentRef) await cleanupUploadedPaths(storagePaths);
      setStatus(`저장 실패: ${error.message} · 업로드된 임시 파일 정리를 시도했습니다.`, '#dc2626');
      return false;
    } finally {
      active = false;
      unlockEditor();
      if (confirmButton) confirmButton.disabled = false;
      if (overwriteButton) overwriteButton.disabled = false;
      updateSaveDialog();
    }
  }

  function interceptSave(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (active) return;
    saveSessionSafely('new').catch((error) => {
      console.error('[pdf-session] safe save failed', error);
      setStatus(`저장 실패: ${error.message}`, '#dc2626');
      active = false;
      unlockEditor();
      const confirmButton = byId('sessionSaveConfirm');
      if (confirmButton) confirmButton.disabled = false;
    });
  }

  function interceptOverwrite(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (active) return;
    saveSessionSafely('overwrite').catch((error) => {
      console.error('[pdf-session] overwrite failed', error);
      setStatus(`덮어쓰기 실패: ${error.message}`, '#dc2626');
      active = false;
      unlockEditor();
      updateSaveDialog();
    });
  }

  function interceptEnter(event) {
    if (event.key !== 'Enter') return;
    interceptSave(event);
  }

  function install() {
    if (!editorReady()) {
      if (installAttempts < MAX_INSTALL_ATTEMPTS) {
        installAttempts += 1;
        setTimeout(install, 100 + installAttempts * 25);
      }
      return false;
    }

    const button = byId('sessionSaveConfirm');
    const input = byId('sessionNameInput');
    const overwrite = byId('sessionOverwriteConfirm');
    if (overwrite && overwrite.dataset.sessionOverwriteBound !== 'true') {
      overwrite.dataset.sessionOverwriteBound = 'true';
      overwrite.addEventListener('click', interceptOverwrite, true);
    }
    if (button.dataset.sessionSaveSafetyV2 !== 'true') {
      button.dataset.sessionSaveSafetyV2 = 'true';
      button.addEventListener('click', interceptSave, true);
    }
    if (input.dataset.sessionSaveSafetyV2 !== 'true') {
      input.dataset.sessionSaveSafetyV2 = 'true';
      input.addEventListener('keydown', interceptEnter, true);
    }
    updateSaveDialog();
    return true;
  }

  window.PdfSessionSaveSafety = {
    save: saveSessionSafely,
    setLoadedSession,
    clearLoadedSession,
    currentLoadedSession,
    prepareSaveDialog,
    validateSnapshot,
    cleanupUploadedPaths,
    active: () => active,
    maxSessionBytes: MAX_SESSION_BYTES,
    maxFileBytes: MAX_FILE_BYTES,
    maxSessionFiles: MAX_SESSION_FILES,
    maxStateBytes: MAX_STATE_BYTES,
    stage: 'multi-source-snapshot-300mb-cost-guard-v3-state-preflight',
    reviewFixes: 'thumbnail-lock-not-found-cleanup-owner-metadata-state-byte-precheck',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
