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
 * @param {File[]} files - source PDF files in order
 * @param {object} settings - PdfProcessRequest JSON
 * @returns {Promise<Blob>} output PDF blob
 */
async function apiProcessPdf(files, settings) {
  const headers = await _authHeaders();
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  form.append('settings', JSON.stringify(settings));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 310000);

  try {
    const resp = await fetch('/api/pdf/process', {
      method: 'POST',
      headers,
      body: form,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: `서버 오류 (${resp.status})` }));
      throw new Error(err.detail || 'PDF 처리 중 오류가 발생했습니다.');
    }
    return resp.blob();
  } catch (e) {
    clearTimeout(timeoutId);
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
