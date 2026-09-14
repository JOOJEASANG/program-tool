/**
 * API client.
 * 일반 API는 Firebase Hosting의 /api/** rewrite를 사용하고,
 * 60초를 넘길 수 있는 PDF 생성 작업은 Cloud Functions 직접 URL을 사용한다.
 */

const PDF_LONG_API_REGION = 'us-central1';

function _firebaseProjectId() {
  try { return firebase.app().options.projectId || 'program-tool'; }
  catch (_) { return 'program-tool'; }
}

function _currentProgramId() {
  const fromAccess = window.ProgramAccess?.programForPath?.(location.pathname);
  const fromCatalog = window.ProgramUsageCatalog?.resolve?.(location.pathname);
  return String(fromAccess || fromCatalog || document.documentElement?.dataset?.usageProgramId || '').trim();
}

function _programHeaders(token, extra = {}) {
  const headers = { Authorization: `Bearer ${token}`, ...extra };
  const programId = _currentProgramId();
  if (programId) headers['X-Program-ID'] = programId;
  return headers;
}

function _longPdfApiUrl(path) {
  const suffix = String(path || '').startsWith('/') ? String(path) : '/' + String(path || '');
  return `https://${PDF_LONG_API_REGION}-${_firebaseProjectId()}.cloudfunctions.net/api${suffix}`;
}

async function _fetchLongPdfApi(path, init = {}) {
  try {
    return await fetch(_longPdfApiUrl(path), {
      ...init,
      mode: 'cors',
      credentials: 'omit',
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new Error(
      'PDF 처리 서버 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요: '
      + (error?.message || '연결 오류')
    );
  }
}

async function _getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.getIdToken();
}

async function _authHeaders() {
  const token = await _getToken();
  return _programHeaders(token);
}

async function _readApiError(resp, fallback) {
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const err = await resp.json().catch(() => null);
    return err?.detail || err?.message || fallback;
  }
  const text = await resp.text().catch(() => '');
  return text?.trim() || fallback;
}

function _loadScriptOnce(id, src) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      if (existing.dataset.loaded === 'true') resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => { script.dataset.loaded = 'true'; resolve(); };
    script.onerror = () => reject(new Error('Firebase Storage SDK 로드 실패'));
    document.head.appendChild(script);
  });
}

async function _ensureStorage() {
  if (typeof storage !== 'undefined' && storage && storage.ref) return storage;
  if (!firebase.storage) {
    await _loadScriptOnce('firebaseStorageCompatSdk', 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js');
  }
  if (!firebase.storage) throw new Error('Firebase Storage를 초기화할 수 없습니다.');
  window.storage = firebase.storage();
  return window.storage;
}

function _delayWithSignal(ms, signal) {
  if (!signal) return new Promise(resolve => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(_makeAbortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(_makeAbortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function _fetchPdfResult(downloadUrl, { signal, attempts = 3 } = {}) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const resultResp = await fetch(downloadUrl, {
        cache: 'no-store',
        credentials: 'omit',
        signal,
      });
      if (!resultResp.ok) {
        throw new Error(`완성 PDF 다운로드 실패 (${resultResp.status})`);
      }
      return resultResp;
    } catch (error) {
      if (error?.name === 'AbortError' || signal?.aborted) throw error;
      lastError = error;
      if (attempt < attempts) await _delayWithSignal(attempt * 700, signal);
    }
  }
  throw new Error(
    '완성 PDF 다운로드 연결에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요: '
    + (lastError?.message || '연결 오류')
  );
}

async function _readPdfDelivery(resp, { signal } = {}) {
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return resp.blob();
  const delivery = await resp.json();
  if (delivery?.delivery !== 'storage' || !delivery.download_url) {
    throw new Error('PDF 다운로드 정보가 올바르지 않습니다.');
  }
  const resultResp = await _fetchPdfResult(delivery.download_url, { signal });
  const blob = await resultResp.blob();
  if (delivery.storage_path) {
    try {
      const st = await _ensureStorage();
      await st.ref(delivery.storage_path).delete();
    } catch (error) {
      console.warn('[pdf] temporary result cleanup failed', error);
    }
  }
  return blob;
}

function _preparePdfSettings(settings) {
  let next = settings && typeof settings === 'object' ? { ...settings } : {};
  next = window.PdfOutputContract?.enrichSettings?.(next) || next;
  next = window.PdfEditorLayoutExport?.patchSettings?.(next) || next;
  if (window.PdfPrintMarks?.settings) {
    next.print_marks = window.PdfPrintMarks.settings();
  }
  return next;
}

function _preparePdfOptions(options = {}) {
  const managed = window.PdfOperationManager?.apiOptions?.();
  if (!managed) return { ...options, __managedOperation: false };
  return {
    ...options,
    signal: managed.signal,
    onStatus: message => {
      options.onStatus?.(message);
      managed.onStatus?.(message);
    },
    onProgress: progress => {
      options.onProgress?.(progress);
      managed.onProgress?.(progress);
    },
    __managedOperation: true,
  };
}

function _finishManagedPdfOperation(managed, result, message) {
  if (managed) window.PdfOperationManager?.finishOperation?.(result, message);
}

function _makeAbortError(message = '작업이 취소되었습니다.') {
  try { return new DOMException(message, 'AbortError'); }
  catch (_) { const error = new Error(message); error.name = 'AbortError'; return error; }
}

function _reportProgress(callback, stage, percent, message, current, total) {
  if (typeof callback !== 'function') return;
  callback({
    stage,
    percent: Number.isFinite(Number(percent)) ? Math.max(0, Math.min(100, Number(percent))) : null,
    message: message || '',
    current: Number.isFinite(Number(current)) ? Number(current) : null,
    total: Number.isFinite(Number(total)) ? Number(total) : null,
  });
}

function _uploadStorageFile(ref, file, { signal, onProgress, fileIndex, fileCount } = {}) {
  if (signal?.aborted) return Promise.reject(_makeAbortError());
  const task = ref.put(file, { contentType: 'application/pdf' });
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      callback(value);
    };
    const onAbort = () => {
      try { task.cancel(); } catch (_) {}
      finish(reject, _makeAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    task.on(
      'state_changed',
      snapshot => {
        const ratio = snapshot.totalBytes ? snapshot.bytesTransferred / snapshot.totalBytes : 0;
        const overall = ((fileIndex || 0) + ratio) / Math.max(1, fileCount || 1);
        _reportProgress(onProgress, 'upload', 5 + overall * 35, '원본 PDF 업로드 중', (fileIndex || 0) + 1, fileCount || 1);
      },
      error => {
        if (error?.code === 'storage/canceled' || signal?.aborted) finish(reject, _makeAbortError());
        else finish(reject, error);
      },
      () => finish(resolve, task.snapshot)
    );
  });
}

async function _processPdfDirect(files, settings, token, signal, onStatus, onProgress) {
  onStatus && onStatus('임시 업로드 방식 실패 → 직접 업로드 방식으로 재시도 중...');
  _reportProgress(onProgress, 'direct-upload', 35, '직접 업로드 방식으로 재시도 중');
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  form.append('settings', JSON.stringify(settings));

  const resp = await _fetchLongPdfApi('/api/pdf/process', {
    method: 'POST',
    headers: _programHeaders(token),
    body: form,
    signal,
  });

  if (!resp.ok) {
    const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
    throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
  }
  _reportProgress(onProgress, 'download', 92, '완성 PDF 내려받는 중');
  return _readPdfDelivery(resp, { signal });
}

async function apiProcessPdf(files, settings, options = {}) {
  const preparedOptions = _preparePdfOptions(options);
  const { onStatus, onProgress, signal, __managedOperation } = preparedOptions;
  settings = _preparePdfSettings(settings);
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!Array.isArray(files) || !files.length) throw new Error('처리할 PDF 파일이 없습니다.');
  if (signal?.aborted) throw _makeAbortError();

  _reportProgress(onProgress, 'prepare', 2, '저장 작업 준비 중');
  const st = await _ensureStorage();
  const uid = user.uid;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const storagePaths = [];
  const token = await user.getIdToken(true);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 290000);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  const cleanup = async () => {
    await Promise.allSettled(storagePaths.map(path => st.ref(path).delete()));
  };

  try {
    for (let i = 0; i < files.length; i++) {
      if (controller.signal.aborted) throw _makeAbortError();
      onStatus && onStatus(`파일 업로드 중... (${i + 1}/${files.length})`);
      const path = `pdf_temp/${uid}/${sessionId}/${i}.pdf`;
      storagePaths.push(path);
      await _uploadStorageFile(st.ref(path), files[i], {
        signal: controller.signal,
        onProgress,
        fileIndex: i,
        fileCount: files.length,
      });
    }

    onStatus && onStatus('서버에서 PDF 생성 중... (대용량·소책자 작업은 몇 분 걸릴 수 있습니다)');
    _reportProgress(onProgress, 'server', 45, '서버에서 PDF 생성 중');
    const resp = await _fetchLongPdfApi('/api/pdf/process-storage', {
      method: 'POST',
      headers: _programHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ storage_paths: storagePaths, settings }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
      throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
    }

    _reportProgress(onProgress, 'download', 92, '완성 PDF 내려받는 중');
    const blob = await _readPdfDelivery(resp, { signal: controller.signal });
    _reportProgress(onProgress, 'complete', 100, 'PDF 생성 완료');
    _finishManagedPdfOperation(__managedOperation, 'success', 'PDF 생성이 완료되었습니다.');
    return blob;
  } catch (storageErr) {
    if (storageErr?.name === 'AbortError' || signal?.aborted || controller.signal.aborted) {
      _finishManagedPdfOperation(__managedOperation, 'canceled', '작업이 취소되었습니다.');
      throw _makeAbortError(signal?.aborted ? '작업이 취소되었습니다.' : '처리 시간이 초과되었습니다. 페이지 수나 파일 크기를 줄여 다시 시도하세요.');
    }

    const directBytes = files.reduce((sum, file) => sum + Number(file?.size || 0), 0);
    if (directBytes > 20 * 1024 * 1024) {
      _finishManagedPdfOperation(__managedOperation, 'error', storageErr?.message);
      throw new Error('대용량 PDF 저장에 실패했습니다. 잠시 후 다시 시도하세요: ' + (storageErr?.message || '임시 업로드 오류'));
    }
    try {
      const blob = await _processPdfDirect(files, settings, token, controller.signal, onStatus, onProgress);
      _reportProgress(onProgress, 'complete', 100, 'PDF 생성 완료');
      _finishManagedPdfOperation(__managedOperation, 'success', 'PDF 생성이 완료되었습니다.');
      return blob;
    } catch (directErr) {
      if (directErr?.name === 'AbortError' || signal?.aborted || controller.signal.aborted) {
        _finishManagedPdfOperation(__managedOperation, 'canceled', '작업이 취소되었습니다.');
        throw _makeAbortError();
      }
      _finishManagedPdfOperation(__managedOperation, 'error', directErr?.message);
      throw new Error(
        'PDF 저장 실패: ' + (directErr?.message || storageErr?.message || '알 수 없는 오류')
        + (storageErr?.message ? ` / 임시 업로드 오류: ${storageErr.message}` : '')
      );
    }
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', forwardAbort);
    await cleanup();
  }
}

async function apiPdfTool(op, fileOrFiles, params = {}) {
  const headers = await _authHeaders();
  const form = new FormData();
  if (Array.isArray(fileOrFiles)) {
    const totalBytes = fileOrFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0);
    if (totalBytes > 20 * 1024 * 1024) throw new Error('PDF 도구의 전체 파일 용량은 20MB 이하여야 합니다.');
    fileOrFiles.forEach(f => form.append('files', f));
  } else if (fileOrFiles) {
    if (Number(fileOrFiles.size || 0) > 20 * 1024 * 1024) throw new Error('PDF 도구는 20MB 이하 파일만 지원합니다.');
    form.append('file', fileOrFiles);
  }
  Object.entries(params).forEach(([k, v]) => form.append(k, v));

  const resp = await fetch(`/api/pdf-tools/${op}`, { method: 'POST', headers, body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `${op} 실패`);
  }
  const removed = resp.headers.get('X-Removed-Count');
  const blob = await _readPdfDelivery(resp);
  return { blob, meta: { removed: removed ? Number(removed) : null } };
}

let __preflightTemp = null;

function _samePreflightFile(file) {
  return __preflightTemp
    && __preflightTemp.file === file
    && __preflightTemp.name === file.name
    && __preflightTemp.size === file.size
    && __preflightTemp.lastModified === file.lastModified;
}

async function _ensurePreflightStoragePath(file, onStatus) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!file) throw new Error('PDF 파일을 먼저 선택하세요.');
  if (_samePreflightFile(file) && __preflightTemp.path) return __preflightTemp.path;
  if (_samePreflightFile(file) && __preflightTemp.uploadPromise) return __preflightTemp.uploadPromise;

  const st = await _ensureStorage();
  const uid = user.uid;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const safeName = (file.name || 'document.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80) || 'document.pdf';
  const path = `preflight_temp/${uid}/${sessionId}/${safeName.toLowerCase().endsWith('.pdf') ? safeName : safeName + '.pdf'}`;

  const uploadPromise = (async () => {
    onStatus && onStatus('대용량 PDF 임시 업로드 중...');
    try {
      await st.ref(path).put(file, { contentType: 'application/pdf' });
      __preflightTemp = { file, name: file.name, size: file.size, lastModified: file.lastModified, path };
      return path;
    } catch (err) {
      __preflightTemp = null;
      throw err;
    }
  })();
  __preflightTemp = { file, name: file.name, size: file.size, lastModified: file.lastModified, path: null, uploadPromise };
  return uploadPromise;
}

async function _preflightStorageRequest(endpoint, file, { expectBlob = false, onStatus } = {}) {
  const token = await _getToken();
  const path = await _ensurePreflightStoragePath(file, onStatus);
  onStatus && onStatus(endpoint.includes('check') ? '서버에서 PDF 검수 중...' : '서버에서 PDF 복구/정상화 중...');
  try {
    const resp = await fetch(`/api/preflight/${endpoint}`, {
      method: 'POST',
      headers: _programHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ storage_path: path, filename: file.name || 'document.pdf' }),
    });
    if (!resp.ok) {
      const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
      throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
    }
    return expectBlob ? _readPdfDelivery(resp) : resp.json();
  } finally {
    __preflightTemp = null;
  }
}

async function _preflightDirectCheck(file) {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('file', file);
  form.append('use_ai', 'false');

  const resp = await fetch('/api/preflight/check', {
    method: 'POST',
    headers,
    body: form,
  });

  if (!resp.ok) {
    const msg = await _readApiError(resp, resp.statusText || '검수 중 오류가 발생했습니다.');
    throw new Error(msg || '검수 중 오류가 발생했습니다.');
  }
  return resp.json();
}

async function apiPreflightCheck(file, opts = {}) {
  const useStorage = (file?.size || 0) > 20 * 1024 * 1024;
  if (useStorage) return _preflightStorageRequest('check-storage', file, opts);
  try {
    return await _preflightDirectCheck(file);
  } catch (directErr) {
    return _preflightStorageRequest('check-storage', file, {
      ...opts,
      onStatus: opts.onStatus || (() => {})
    }).catch(storageErr => {
      throw new Error((storageErr?.message || '검수 실패') + (directErr?.message ? ` / 직접 업로드 오류: ${directErr.message}` : ''));
    });
  }
}

async function _preflightDirectFix(file) {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('file', file);

  const resp = await fetch('/api/preflight/fix', {
    method: 'POST',
    headers,
    body: form,
  });

  if (!resp.ok) {
    const msg = await _readApiError(resp, resp.statusText || 'PDF 보정 중 오류가 발생했습니다.');
    throw new Error(msg || 'PDF 보정 중 오류가 발생했습니다.');
  }
  return _readPdfDelivery(resp);
}

async function apiPreflightFix(file, opts = {}) {
  const useStorage = (file?.size || 0) > 20 * 1024 * 1024 || _samePreflightFile(file);
  if (useStorage) return _preflightStorageRequest('fix-storage', file, { ...opts, expectBlob: true });
  try {
    return await _preflightDirectFix(file);
  } catch (directErr) {
    return _preflightStorageRequest('fix-storage', file, { ...opts, expectBlob: true }).catch(storageErr => {
      throw new Error((storageErr?.message || 'PDF 보정 실패') + (directErr?.message ? ` / 직접 업로드 오류: ${directErr.message}` : ''));
    });
  }
}
