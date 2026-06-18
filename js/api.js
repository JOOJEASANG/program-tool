/**
 * API client — calls /api/** on the same domain.
 * Firebase Hosting rewrites /api/** → Cloud Function "api".
 */

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

  const uid = user.uid;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const storagePaths = [];
  const token = await user.getIdToken(true);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 310000);

  const cleanup = () => storagePaths.forEach(p => storage.ref(p).delete().catch(() => {}));

  try {
    // 1. Upload source files to Storage (no HTTP body size limit)
    for (let i = 0; i < files.length; i++) {
      onStatus && onStatus(`파일 업로드 중... (${i + 1}/${files.length})`);
      const path = `pdf_temp/${uid}/${sessionId}/${i}.pdf`;
      await storage.ref(path).put(files[i], { contentType: 'application/pdf' });
      storagePaths.push(path);
    }

    onStatus && onStatus('서버에서 PDF 생성 중... (페이지가 많으면 1~2분 소요될 수 있습니다)');

    // 2. Ask backend to read from Storage, process, and return the PDF
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

    // Fallback: direct upload. This fixes cases where Storage upload/read is blocked
    // by bucket config, rules, or eventual consistency. For very large files the
    // direct route can still fail, in which case the original detail is preserved.
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

async function apiPreflightCheck(file) {
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
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || '검수 중 오류가 발생했습니다.');
  }
  return resp.json();
}

async function apiPreflightFix(file) {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('file', file);

  const resp = await fetch('/api/preflight/fix', {
    method: 'POST',
    headers,
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'PDF 보정 중 오류가 발생했습니다.');
  }
  return resp.blob();
}
