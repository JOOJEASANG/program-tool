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

/**
 * Process PDF with backend.
 * Files are uploaded to Firebase Storage first to bypass the 32 MB HTTP body limit.
 * @param {File[]} files - source PDF files in order
 * @param {object} settings - PdfProcessRequest JSON
 * @param {{ onStatus?: (msg: string) => void }} [opts]
 * @returns {Promise<Blob>} output PDF blob
 */
async function apiProcessPdf(files, settings, { onStatus } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');

  const uid = user.uid;
  const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const storagePaths = [];

  // 1. Upload source files to Storage (no HTTP body size limit)
  for (let i = 0; i < files.length; i++) {
    onStatus && onStatus(`파일 업로드 중... (${i + 1}/${files.length})`);
    const path = `pdf_temp/${uid}/${sessionId}/${i}.pdf`;
    await storage.ref(path).put(files[i], { contentType: 'application/pdf' });
    storagePaths.push(path);
  }

  onStatus && onStatus('서버에서 PDF 생성 중... (페이지가 많으면 1~2분 소요될 수 있습니다)');

  const token = await user.getIdToken();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 310000);

  const cleanup = () => storagePaths.forEach(p => storage.ref(p).delete().catch(() => {}));

  try {
    // 2. Ask backend to read from Storage, process, and return the PDF
    const resp = await fetch('/api/pdf/process-storage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_paths: storagePaths, settings }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    cleanup();

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: `서버 오류 (${resp.status})` }));
      throw new Error(err.detail || 'PDF 처리 중 오류가 발생했습니다.');
    }
    return resp.blob();
  } catch (e) {
    clearTimeout(timeoutId);
    cleanup();
    if (e.name === 'AbortError') {
      throw new Error('처리 시간 초과 (5분). 페이지 수를 줄이거나 파일 크기를 줄여 다시 시도하세요.');
    }
    throw e;
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
