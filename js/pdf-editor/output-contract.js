// Keep browser preview, saved sessions, and backend export on one output contract.
(function () {
  'use strict';
  if (window.__pdfOutputContractV1) return;
  window.__pdfOutputContractV1 = true;

  const byId = (id) => document.getElementById(id);
  const numberValue = (id, fallback) => {
    const value = Number(byId(id)?.value);
    return Number.isFinite(value) ? value : fallback;
  };
  const currentOrder = () => {
    try { return orderLR === false ? 'column-major' : 'row-major'; }
    catch (_) { return 'row-major'; }
  };

  function enrichSettings(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    settings.page_order = currentOrder();
    settings.margin_left_mm = numberValue('marginLeft', numberValue('marginH', 10));
    settings.margin_right_mm = numberValue('marginRight', numberValue('marginH', 10));
    settings.margin_top_mm = numberValue('marginTop', numberValue('marginV', 10));
    settings.margin_bottom_mm = numberValue('marginBottom', numberValue('marginV', 10));
    settings.page_numbers = settings.page_numbers || {};
    settings.page_numbers.auto_reserve_space =
      !(byId('pnAutoReserve') && !byId('pnAutoReserve').checked);
    return settings;
  }

  function enrichEditorState(state) {
    const next = state && typeof state === 'object' ? state : {};
    next.pageOrder = currentOrder();
    next.marginLeft = numberValue('marginLeft', numberValue('marginH', 10));
    next.marginRight = numberValue('marginRight', numberValue('marginH', 10));
    next.marginTop = numberValue('marginTop', numberValue('marginV', 10));
    next.marginBottom = numberValue('marginBottom', numberValue('marginV', 10));
    next.pnAutoReserve = !(byId('pnAutoReserve') && !byId('pnAutoReserve').checked);
    return next;
  }

  function restoreContractState(data) {
    let state = {};
    try { state = JSON.parse(data?.state || '{}'); } catch (_) {}
    try {
      orderLR = state.pageOrder !== 'column-major';
      byId('orderLR')?.classList.toggle('active', orderLR);
      byId('orderTB')?.classList.toggle('active', !orderLR);
    } catch (_) {}
    const fields = {
      marginLeft: state.marginLeft,
      marginRight: state.marginRight,
      marginTop: state.marginTop,
      marginBottom: state.marginBottom,
    };
    Object.entries(fields).forEach(([id, value]) => {
      if (Number.isFinite(Number(value)) && byId(id)) byId(id).value = String(value);
    });
    if (byId('pnAutoReserve') && typeof state.pnAutoReserve === 'boolean') {
      byId('pnAutoReserve').checked = state.pnAutoReserve;
    }
    window.PdfPreviewController?.invalidate?.();
    try { schedulePreview(0); } catch (_) {}
  }

  function wrapSessionLoad() {
    if (window.__pdfOutputLoadWrappedV1 || typeof window.loadEditorSession !== 'function') return false;
    const original = window.loadEditorSession;
    const wrapped = async function outputContractLoad(data, documentId) {
      const result = await original.call(this, data, documentId);
      restoreContractState(data);
      return result;
    };
    window.loadEditorSession = wrapped;
    try { loadEditorSession = wrapped; } catch (_) {}
    window.__pdfOutputLoadWrappedV1 = true;
    return true;
  }

  async function safeSaveEditorSession() {
    const user = window.auth?.currentUser;
    let files;
    try { files = Array.isArray(uploadedFiles) ? [...uploadedFiles] : []; }
    catch (_) { files = []; }
    if (!user || !files.length || !window.storage || !window.db) return;

    const confirmButton = byId('sessionSaveConfirm');
    const status = byId('sessionSaveStatus');
    const rawName = String(byId('sessionNameInput')?.value || '').trim();
    const name = (rawName || '편집 세션').slice(0, 80);
    const sessionId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const collection = db.collection('users').doc(user.uid).collection('pdf_sessions');
    const storagePaths = [];
    let createdDocument = null;

    if (confirmButton) confirmButton.disabled = true;
    if (status) {
      status.style.color = '#6b7280';
      status.textContent = '파일 업로드 중...';
    }

    try {
      for (let index = 0; index < files.length; index += 1) {
        if (status) status.textContent = `파일 업로드 중... (${index + 1}/${files.length})`;
        const path = `pdf_sessions/${user.uid}/${sessionId}/src_${index}.pdf`;
        await storage.ref(path).put(files[index], { contentType: 'application/pdf' });
        storagePaths.push(path);
      }

      let state = {};
      try { state = enrichEditorState(collectEditorState()); }
      catch (_) { state = enrichEditorState({}); }

      if (status) status.textContent = '상태 저장 중...';
      createdDocument = await collection.add({
        name,
        sessionId,
        storagePaths,
        fileCount: files.length,
        pageCount: Array.isArray(parsedPages) ? parsedPages.length : 0,
        state: JSON.stringify(state),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const snapshot = await collection.orderBy('createdAt', 'asc').get();
      const removable = snapshot.docs
        .filter((doc) => doc.id !== createdDocument.id)
        .slice(0, Math.max(0, snapshot.size - 10));
      for (const documentSnapshot of removable) {
        const oldData = documentSnapshot.data() || {};
        await Promise.allSettled(
          (Array.isArray(oldData.storagePaths) ? oldData.storagePaths : [])
            .map((path) => storage.ref(path).delete())
        );
        await documentSnapshot.ref.delete();
      }

      if (status) {
        status.style.color = '#166534';
        status.textContent = '저장 완료!';
      }
      setTimeout(() => {
        if (byId('sessionSaveModal')) byId('sessionSaveModal').style.display = 'none';
      }, 900);
    } catch (error) {
      if (createdDocument) {
        await createdDocument.delete().catch(() => {});
      }
      await Promise.allSettled(storagePaths.map((path) => storage.ref(path).delete()));
      if (status) {
        status.style.color = '#dc2626';
        status.textContent = `저장 실패: ${error?.message || '알 수 없는 오류'}`;
      }
    } finally {
      if (confirmButton) confirmButton.disabled = false;
    }
  }

  function installSafeSessionSave() {
    const button = byId('sessionSaveConfirm');
    if (!button || button.dataset.outputContractBound) return !!button;
    button.dataset.outputContractBound = '1';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      safeSaveEditorSession();
    }, true);
    const input = byId('sessionNameInput');
    input?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      safeSaveEditorSession();
    }, true);
    return true;
  }

  function installHeaderFooterInputGuard() {
    if (window.__pdfHeaderFooterInputGuardV1) return;
    window.__pdfHeaderFooterInputGuardV1 = true;
    const setters = {
      hfHL: (value) => { try { hfHL = value; } catch (_) {} },
      hfHC: (value) => { try { hfHC = value; } catch (_) {} },
      hfHR: (value) => { try { hfHR = value; } catch (_) {} },
      hfFL: (value) => { try { hfFL = value; } catch (_) {} },
      hfFC: (value) => { try { hfFC = value; } catch (_) {} },
      hfFR: (value) => { try { hfFR = value; } catch (_) {} },
    };
    document.addEventListener('input', (event) => {
      const target = event.target;
      const setter = target && setters[target.id];
      if (!setter) return;
      event.stopImmediatePropagation();
      setter(String(target.value || ''));
      try { schedulePreview(500); } catch (_) {}
    }, true);
  }

  function boot(attempt) {
    const loadReady = wrapSessionLoad();
    const saveReady = installSafeSessionSave();
    installHeaderFooterInputGuard();
    if ((!loadReady || !saveReady) && attempt < 16) {
      setTimeout(() => boot(attempt + 1), 120 + attempt * 50);
    }
  }

  window.PdfOutputContract = {
    enrichSettings,
    enrichEditorState,
    restoreContractState,
    safeSaveEditorSession,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(0), { once: true });
  } else {
    boot(0);
  }
})();
