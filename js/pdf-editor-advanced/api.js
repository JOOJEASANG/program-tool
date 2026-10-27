async function readApiError(response, fallback) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await response.json().catch(() => null);
    return body?.detail || body?.message || fallback;
  }
  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}

// Storage results are already prepared as attachments by the API. Fetching
// their cross-origin signed URLs as blobs can be blocked by bucket CORS rules
// and forces the entire PDF into browser memory. Let the browser download
// directly instead. The result object is removed by the server TTL cleanup.
export async function readDelivery(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) {
    const blob = await response.blob();
    if (!blob.size) throw new Error('완성 PDF 파일이 비어 있습니다.');
    return blob;
  }
  const delivery = await response.json();
  if (delivery?.delivery !== 'storage' || !delivery.download_url) {
    throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
  }
  let url;
  try { url = new URL(delivery.download_url); }
  catch (_) { throw new Error('완성 PDF 다운로드 주소가 올바르지 않습니다.'); }
  if (url.protocol !== 'https:') throw new Error('안전한 PDF 다운로드 주소가 아닙니다.');
  return { delivery: 'storage', download_url: url.href,
    filename: String(delivery.filename || 'advanced-edited.pdf'),
    expires_at: String(delivery.expires_at || '') };
}

async function directProcess(files, settings, token, signal) {
  const form = new FormData();
  for (const file of files) form.append('files', file);
  form.append('settings', JSON.stringify(settings));
  const response = await fetch('/api/pdf/advanced/process', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal,
  });
  if (!response.ok) throw new Error(await readApiError(response, `서버 오류 (${response.status})`));
  return readDelivery(response);
}

function uploadFile(ref, file, signal, onProgress) {
  const task = ref.put(file, { contentType: 'application/pdf' });
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => { if (settled) return; settled = true; signal?.removeEventListener('abort', abort); fn(value); };
    const abort = () => { try { task.cancel(); } catch (_) {} done(reject, new DOMException('작업이 취소되었습니다.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    task.on('state_changed', snapshot => {
      if (!snapshot.totalBytes) return;
      onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
    }, error => done(reject, error), () => done(resolve, task.snapshot));
  });
}

const reusableInputs = new Map();
let reusableOwner = '';

async function storageProcess(files, settings, token, signal, onStatus, onProgress) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const storage = firebase.storage();
  if (reusableOwner !== user.uid) {
    reusableInputs.clear();
    reusableOwner = user.uid;
  }
  const saved = window.PdfAdvancedSessionPersistence?.reusableSourcePaths?.(files);
  const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const paths = [];
  const newlyUploaded = [];
  let success = false;
  try {
    for (let index = 0; index < files.length; index++) {
      if (signal?.aborted) throw new DOMException('작업이 취소되었습니다.', 'AbortError');
      const savedPath = saved?.paths?.[index];
      if (savedPath) { paths.push(savedPath); continue; }
      const cached = reusableInputs.get(files[index]);
      if (cached?.uid === user.uid) { paths.push(cached.path); continue; }
      onStatus?.(`새 원본 PDF 업로드 중... (${index + 1}/${files.length})`);
      const path = `pdf_temp/${user.uid}/${session}/${index}.pdf`;
      paths.push(path);
      newlyUploaded.push(path);
      await uploadFile(storage.ref(path), files[index], signal, ratio => {
        onProgress?.(((index + ratio) / files.length) * 45);
      });
      reusableInputs.set(files[index], {uid:user.uid,path});
    }
    onStatus?.(newlyUploaded.length ? '서버에서 고급 편집 PDF 생성 중...' : '원본 재업로드 없이 PDF 생성 중...');
    onProgress?.(55);
    const response = await fetch('/api/pdf/advanced/process-storage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_paths: paths, settings, retain_temp_sources: true,
        source_session_doc: saved?.docId || null }),
      signal,
    });
    if (!response.ok) throw new Error(await readApiError(response, `서버 오류 (${response.status})`));
    onProgress?.(92);
    const output = await readDelivery(response);
    success = true;
    return output;
  } catch (error) {
    if (error?.name !== 'AbortError' && error?.name !== 'TypeError') {
      // Cached temporary originals may have expired or been removed.
      for (const [file, cached] of reusableInputs)
        if (paths.includes(cached.path)) reusableInputs.delete(file);
    }
    throw error;
  } finally {
    if (!success) {
      for (const [file, cached] of reusableInputs)
        if (newlyUploaded.includes(cached.path)) reusableInputs.delete(file);
      await Promise.allSettled(newlyUploaded.map(path => storage.ref(path).delete()));
    }
  }
}

export async function processAdvancedPdf(files, settings, { signal, onStatus, onProgress } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  if (!Array.isArray(files) || !files.length) throw new Error('처리할 PDF 파일이 없습니다.');
  const totalBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (totalBytes > 300 * 1024 * 1024) throw new Error('전체 PDF 용량은 300 MB 이하여야 합니다.');
  if (files.some(file => Number(file.size || 0) > 200 * 1024 * 1024)) throw new Error('PDF 한 파일은 200 MB 이하여야 합니다.');
  const token = await user.getIdToken(true);
  if (signal?.aborted) throw new DOMException('작업이 취소되었습니다.', 'AbortError');

  // The browser retains unchanged inputs while the tab stays open. Sending
  // only settings for subsequent exports avoids uploading full PDFs again.
  const blob = await storageProcess(files, settings, token, signal, onStatus, onProgress);
  onProgress?.(100);
  return blob;
}
