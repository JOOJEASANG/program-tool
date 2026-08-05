// Safe editor-session persistence for multiple source PDFs.
(function () {
  'use strict';
  if (window.__pdfSessionSaveSafetyV1) return;
  window.__pdfSessionSaveSafetyV1 = true;

  const MAX_INSTALL_ATTEMPTS = 40;
  const MAX_SESSIONS = 10;
  let installAttempts = 0;
  let active = false;
  let lockSnapshot = null;

  const byId = (id) => document.getElementById(id);

  function editorReady() {
    try {
      return Boolean(
        window.auth && window.db && window.storage && window.firebase
        && typeof window.collectEditorState === 'function'
        && Array.isArray(window.uploadedFiles)
        && Array.isArray(window.parsedPages)
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

  function validateSnapshot(files, state) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error('저장할 원본 PDF가 없습니다.');
    }
    if (!state || !Array.isArray(state.pages)) {
      throw new Error('편집 페이지 상태를 확인할 수 없습니다.');
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
    };
  }

  function mutationElements() {
    const selectors = [
      '#fileInput', '#uploadZone', '#navSessionBtn', '#navSessionLoadBtn',
      '#previewBtn', '#downloadBtn', '#resetBtn',
      '.mode-btn', '#thumbArea button', '#thumbArea input',
      '#previewScroll button', '#previewScroll input'
    ];
    return [...document.querySelectorAll(selectors.join(','))]
      .filter((element, index, all) => all.indexOf(element) === index)
      .filter((element) => element.id !== 'sessionSaveConfirm');
  }

  function blockMutation(event) {
    if (!active) return;
    const target = event.target;
    if (target && target.closest?.('#sessionSaveModal')) return;
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
    document.addEventListener('drop', blockMutation, true);
    document.addEventListener('keydown', blockMutationKey, true);
  }

  function unlockEditor() {
    const body = document.body;
    const snapshot = lockSnapshot;
    lockSnapshot = null;
    document.removeEventListener('drop', blockMutation, true);
    document.removeEventListener('keydown', blockMutationKey, true);

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

  async function cleanupUploadedPaths(paths) {
    if (!Array.isArray(paths) || paths.length === 0) return [];
    return Promise.allSettled(paths.map((path) => window.storage.ref(path).delete()));
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
      await cleanupUploadedPaths(paths);
      await collection.doc(document.id).delete();
    }
  }

  function setStatus(message, color) {
    const status = byId('sessionSaveStatus');
    if (!status) return;
    status.textContent = message;
    if (color) status.style.color = color;
  }

  async function saveSessionSafely() {
    if (active) return false;
    const user = window.auth?.currentUser;
    const files = Array.isArray(window.uploadedFiles) ? [...window.uploadedFiles] : [];
    if (!user || files.length === 0) return false;

    let state;
    try {
      state = cloneSerializable(window.collectEditorState());
      validateSnapshot(files, state);
    } catch (error) {
      setStatus(`저장 전 확인 실패: ${error.message}`, '#dc2626');
      return false;
    }

    const name = (byId('sessionNameInput')?.value || '').trim() || '편집 세션';
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const storagePaths = [];
    const collection = window.db.collection('users').doc(user.uid).collection('pdf_sessions');
    const confirmButton = byId('sessionSaveConfirm');
    let documentRef = null;

    active = true;
    if (confirmButton) confirmButton.disabled = true;
    lockEditor();
    setStatus('파일 업로드 중...', '#6b7280');

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setStatus(`파일 업로드 중... (${index + 1}/${files.length})`, '#6b7280');
        const path = `pdf_sessions/${user.uid}/${sessionId}/src_${index}.pdf`;
        await window.storage.ref(path).put(file, { contentType: 'application/pdf' });
        storagePaths.push(path);
      }

      setStatus('상태 저장 중...', '#6b7280');
      documentRef = await collection.add({
        name,
        sessionId,
        storagePaths: [...storagePaths],
        fileCount: files.length,
        pageCount: state.pages.length,
        state: JSON.stringify(state),
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      });

      try {
        await trimOldSessions(collection, documentRef.id);
      } catch (trimError) {
        console.warn('[pdf-session] old session cleanup failed', trimError);
      }

      setStatus('✅ 저장 완료!', '#166534');
      setTimeout(() => {
        const modal = byId('sessionSaveModal');
        if (modal) modal.style.display = 'none';
      }, 1200);
      return true;
    } catch (error) {
      if (!documentRef) await cleanupUploadedPaths(storagePaths);
      setStatus(`저장 실패: ${error.message} · 업로드된 임시 파일을 정리했습니다.`, '#dc2626');
      return false;
    } finally {
      active = false;
      unlockEditor();
      if (confirmButton) confirmButton.disabled = false;
    }
  }

  function interceptSave(event) {
    if (active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    saveSessionSafely().catch((error) => {
      console.error('[pdf-session] safe save failed', error);
      setStatus(`저장 실패: ${error.message}`, '#dc2626');
      active = false;
      unlockEditor();
      const confirmButton = byId('sessionSaveConfirm');
      if (confirmButton) confirmButton.disabled = false;
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
    if (button.dataset.sessionSaveSafetyV1 !== 'true') {
      button.dataset.sessionSaveSafetyV1 = 'true';
      button.addEventListener('click', interceptSave, true);
    }
    if (input.dataset.sessionSaveSafetyV1 !== 'true') {
      input.dataset.sessionSaveSafetyV1 = 'true';
      input.addEventListener('keydown', interceptEnter, true);
    }
    return true;
  }

  window.PdfSessionSaveSafety = {
    save: saveSessionSafely,
    validateSnapshot,
    cleanupUploadedPaths,
    active: () => active,
    stage: 'multi-source-snapshot-failure-cleanup',
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
