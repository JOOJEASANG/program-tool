/**
 * API client — calls /api/** on the same domain.
 * Firebase Hosting rewrites /api/** → Cloud Function "api".
 */

// The PDF editor performs an access check before deferred helper scripts may
// finish loading. During Hosting-only preview deployments the new access route
// is not present yet, so convert only 404/405/5xx responses to the existing
// signed-in-member behavior. Deployed 401/403 responses remain authoritative.
(function installEarlyAccessFallback() {
  if (window.__programToolEarlyAccessFallbackV1) return;
  window.__programToolEarlyAccessFallbackV1 = true;
  const originalFetch = window.fetch.bind(window);
  const knownPrograms = new Set(['pdf-editor', 'preflight', 'perfect-binding-cover']);
  window.fetch = async function earlyAccessFetch(input, options = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/access/')) {
      return originalFetch(input, options);
    }
    try {
      const response = await originalFetch(input, options);
      if (response.status !== 404 && response.status !== 405 && response.status < 500) return response;
    } catch (_) {}
    const programId = decodeURIComponent(url.pathname.slice('/api/access/'.length));
    const allowed = knownPrograms.has(programId) && Boolean(auth.currentUser);
    return new Response(JSON.stringify({
      programId,
      allowed,
      isAdmin: false,
      isPublic: allowed,
      isApproved: false,
      compatibilityMode: true,
    }), {
      status: allowed ? 200 : 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  };
})();

async function _getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  return user.getIdToken();
}

async function _authHeaders() {
  const token = await _getToken();
  return { Authorization: `Bearer ${token}` };
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

async function _processPdfDirect(files, settings, token, signal, onStatus) {
  onStatus && onStatus('임시 업로드 방식 실패 → 직접 업로드 방식으로 재시도 중...');
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  form.append('settings', JSON.stringify(settings));

  const resp = await fetch('/api/pdf/process', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });

  if (!resp.ok) {
    const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
    throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
  }
  return resp.blob();
}

/**
 * Process PDF with backend.
 * Primary path uploads files to Firebase Storage first to bypass HTTP body limits.
 * If that path fails, it falls back to direct multipart upload for better reliability.
 * @param {File[]} files - source PDF files in order
 * @param {object} settings - PdfProcessRequest JSON
 * @param {{ onStatus?: (msg: string) => void }} [opts]
 * @returns {Promise<Blob>} output PDF blob
 */
async function apiProcessPdf(files, settings, { onStatus } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!Array.isArray(files) || !files.length) throw new Error('처리할 PDF 파일이 없습니다.');

  const st = await _ensureStorage();
  const uid = user.uid;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const storagePaths = [];
  const token = await user.getIdToken(true);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 310000);

  const cleanup = () => storagePaths.forEach(p => st.ref(p).delete().catch(() => {}));

  try {
    for (let i = 0; i < files.length; i++) {
      onStatus && onStatus(`파일 업로드 중... (${i + 1}/${files.length})`);
      const path = `pdf_temp/${uid}/${sessionId}/${i}.pdf`;
      await st.ref(path).put(files[i], { contentType: 'application/pdf' });
      storagePaths.push(path);
    }

    onStatus && onStatus('서버에서 PDF 생성 중... (페이지가 많으면 1~2분 소요될 수 있습니다)');

    const resp = await fetch('/api/pdf/process-storage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_paths: storagePaths, settings }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
      throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
    }

    const blob = await resp.blob();
    clearTimeout(timeoutId);
    cleanup();
    return blob;
  } catch (storageErr) {
    cleanup();
    if (storageErr.name === 'AbortError') {
      clearTimeout(timeoutId);
      throw new Error('처리 시간 초과 (5분). 페이지 수를 줄이거나 파일 크기를 줄여 다시 시도하세요.');
    }

    try {
      const blob = await _processPdfDirect(files, settings, token, controller.signal, onStatus);
      clearTimeout(timeoutId);
      return blob;
    } catch (directErr) {
      clearTimeout(timeoutId);
      throw new Error(
        'PDF 저장 실패: ' + (directErr?.message || storageErr?.message || '알 수 없는 오류')
        + (storageErr?.message ? ` / 임시 업로드 오류: ${storageErr.message}` : '')
      );
    }
  }
}

async function apiPdfTool(op, fileOrFiles, params = {}) {
  const headers = await _authHeaders();
  const form = new FormData();
  if (Array.isArray(fileOrFiles)) {
    fileOrFiles.forEach(f => form.append('files', f));
  } else if (fileOrFiles) {
    form.append('file', fileOrFiles);
  }
  Object.entries(params).forEach(([k, v]) => form.append(k, v));

  const resp = await fetch(`/api/pdf-tools/${op}`, { method: 'POST', headers, body: form });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `${op} 실패`);
  }
  const removed = resp.headers.get('X-Removed-Count');
  const blob = await resp.blob();
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
    await st.ref(path).put(file, { contentType: 'application/pdf' });
    __preflightTemp = { file, name: file.name, size: file.size, lastModified: file.lastModified, path };
    return path;
  })();
  __preflightTemp = { file, name: file.name, size: file.size, lastModified: file.lastModified, path: null, uploadPromise };
  return uploadPromise;
}

async function _preflightStorageRequest(endpoint, file, { expectBlob = false, onStatus } = {}) {
  const token = await _getToken();
  const path = await _ensurePreflightStoragePath(file, onStatus);
  onStatus && onStatus(endpoint.includes('check') ? '서버에서 PDF 검수 중...' : '서버에서 PDF 복구/정상화 중...');
  const resp = await fetch(`/api/preflight/${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ storage_path: path, filename: file.name || 'document.pdf' }),
  });
  if (!resp.ok) {
    const msg = await _readApiError(resp, `서버 오류 (${resp.status})`);
    throw new Error(msg || 'PDF 처리 중 오류가 발생했습니다.');
  }
  return expectBlob ? resp.blob() : resp.json();
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
  return resp.blob();
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