/**
 * API client for Program Tool backend.
 * Reads BACKEND_URL from window._ENV (injected at runtime or set in firebase-config.js).
 */

const API_BASE = window._ENV?.BACKEND_URL || 'https://program-tool-backend-REPLACE.a.run.app';

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

  const resp = await fetch(`${API_BASE}/api/pdf/process`, {
    method: 'POST',
    headers,
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'PDF 처리 중 오류가 발생했습니다.');
  }
  return resp.blob();
}

/**
 * Run pre-flight check.
 * @param {File} file - PDF file
 * @param {boolean} useAi - whether to include AI visual analysis
 * @returns {Promise<object>} PreflightReport JSON
 */
async function apiPreflightCheck(file, useAi = false) {
  const headers = await _authHeaders();
  const form = new FormData();
  form.append('file', file);
  form.append('use_ai', String(useAi));

  const resp = await fetch(`${API_BASE}/api/preflight/check`, {
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
