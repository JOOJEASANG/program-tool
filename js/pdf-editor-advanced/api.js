async function readApiError(response, fallback) {
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    const body = await response.json().catch(() => null);
    return body?.detail || body?.message || fallback;
  }
  const text = await response.text().catch(() => '');
  return text.trim() || fallback;
}

async function readDelivery(response) {
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) return response.blob();
  const delivery = await response.json();
  if (delivery?.delivery !== 'storage' || !delivery.download_url) {
    throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
  }
  const result = await fetch(delivery.download_url, { cache: 'no-store' });
  if (!result.ok) throw new Error('완성 PDF를 내려받지 못했습니다.');
  const blob = await result.blob();
  if (delivery.storage_path) {
    try { await firebase.storage().ref(delivery.storage_path).delete(); }
    catch (error) { console.warn('[pdf-advanced] result cleanup failed', error); }
  }
  return blob;
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

async function storageProcess(files, settings, token, signal, onStatus, onProgress) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  const storage = firebase.storage();
  const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const paths = [];
  try {
    for (let index = 0; index < files.length; index++) {
      if (signal?.aborted) throw new DOMException('작업이 취소되었습니다.', 'AbortError');
      onStatus?.(`원본 PDF 업로드 중... (${index + 1}/${files.length})`);
      const path = `pdf_temp/${user.uid}/${session}/${index}.pdf`;
      paths.push(path);
      await uploadFile(storage.ref(path), files[index], signal, ratio => {
        onProgress?.(((index + ratio) / files.length) * 45);
      });
    }
    onStatus?.('서버에서 고급 편집 PDF 생성 중...');
    onProgress?.(55);
    const response = await fetch('/api/pdf/advanced/process-storage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_paths: paths, settings }),
      signal,
    });
    if (!response.ok) throw new Error(await readApiError(response, `서버 오류 (${response.status})`));
    onProgress?.(92);
    return await readDelivery(response);
  } catch (error) {
    await Promise.allSettled(paths.map(path => storage.ref(path).delete()));
    throw error;
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

  if (totalBytes <= 18 * 1024 * 1024) {
    try {
      onStatus?.('고급 편집 PDF 생성 중...'); onProgress?.(20);
      const blob = await directProcess(files, settings, token, signal);
      onProgress?.(100); return blob;
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      console.warn('[pdf-advanced] direct processing failed; retrying with storage', error);
    }
  }
  const blob = await storageProcess(files, settings, token, signal, onStatus, onProgress);
  onProgress?.(100);
  return blob;
}
