// Direct result-area compression button for PDF checker.
(function () {
  if (window.__preflightResultCompressButtonV1) return;
  window.__preflightResultCompressButtonV1 = true;

  let temp = null;

  function file() {
    return window.selectedFile || (document.getElementById('fileInput') && document.getElementById('fileInput').files[0]) || null;
  }
  function baseName(f) {
    return (f && f.name ? f.name : 'document.pdf').replace(/\.pdf$/i, '');
  }
  function shouldShow() {
    const f = file();
    if (!f) return false;
    if (f.size >= 20 * 1024 * 1024) return true;
    const text = document.getElementById('results') ? document.getElementById('results').textContent || '' : '';
    return text.includes('파일 용량/복잡도') || text.includes('대용량 PDF') || text.includes('페이지당 평균');
  }
  function loadScriptOnce(id, src) {
    return new Promise((resolve, reject) => {
      const old = document.getElementById(id);
      if (old) {
        old.addEventListener('load', resolve, { once: true });
        old.addEventListener('error', reject, { once: true });
        if (old.dataset.loaded === 'true') resolve();
        return;
      }
      const s = document.createElement('script');
      s.id = id;
      s.src = src;
      s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
      s.onerror = () => reject(new Error('Storage SDK 로드 실패'));
      document.head.appendChild(s);
    });
  }
  async function storageRef() {
    if (window.storage && window.storage.ref) return window.storage;
    if (typeof storage !== 'undefined' && storage && storage.ref) return storage;
    if (typeof firebase !== 'undefined' && !firebase.storage) {
      await loadScriptOnce('firebaseStorageCompatSdkResultCompress', 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js');
    }
    if (typeof firebase !== 'undefined' && firebase.storage) {
      window.storage = firebase.storage();
      return window.storage;
    }
    throw new Error('Firebase Storage를 초기화할 수 없습니다. 새로고침 후 다시 시도하세요.');
  }
  async function ensurePath(f) {
    if (temp && temp.file === f && temp.name === f.name && temp.size === f.size && temp.lastModified === f.lastModified && temp.path) return temp.path;
    if (!auth.currentUser) throw new Error('로그인이 필요합니다.');
    const st = await storageRef();
    const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const safe = (f.name || 'document.pdf').replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80) || 'document.pdf';
    const name = safe.toLowerCase().endsWith('.pdf') ? safe : safe + '.pdf';
    const path = 'preflight_temp/' + auth.currentUser.uid + '/' + sessionId + '/' + name;
    await st.ref(path).put(f, { contentType: 'application/pdf' });
    temp = { file: f, name: f.name, size: f.size, lastModified: f.lastModified, path };
    return path;
  }
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function compress(btn) {
    const f = file();
    if (!f) return alert('먼저 PDF 파일을 업로드하세요.');
    const old = btn.textContent;
    btn.disabled = true;
    btn.textContent = '업로드/경량화 처리 중...';
    try {
      const path = await ensurePath(f);
      const token = await auth.currentUser.getIdToken(true);
      const resp = await fetch('/api/preflight/compress-storage', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path, filename: f.name || 'document.pdf', params: { quality: 'balanced' } }),
      });
      if (!resp.ok) {
        let msg = 'PDF 경량화 중 오류가 발생했습니다.';
        try { const err = await resp.json(); msg = err.detail || msg; } catch (_) {}
        throw new Error(msg);
      }
      const blob = await resp.blob();
      download(blob, baseName(f) + '_light_balanced.pdf');
      btn.textContent = '완료 · 다시 다운로드';
    } catch (e) {
      alert('PDF 경량화 실패: ' + (e.message || e));
      btn.textContent = old;
    } finally {
      btn.disabled = false;
    }
  }
  function addButton() {
    const results = document.getElementById('results');
    if (!results || results.style.display === 'none') return;
    if (!shouldShow()) return;
    if (document.getElementById('resultCompressDownloadBtn')) return;

    const header = results.querySelector('.results-header') || results.firstElementChild || results;
    const box = document.createElement('div');
    box.id = 'resultCompressDownloadBox';
    box.style.cssText = 'margin:0 0 16px;padding:14px 16px;border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;color:#9a3412;font-size:12px;line-height:1.55;';
    box.innerHTML = '<div style="font-weight:900;margin-bottom:6px;">이 PDF는 용량이 커서 경량화가 권장됩니다.</div><div style="color:#64748b;margin-bottom:10px;">현재 업로드한 파일을 다시 선택하지 않고, 권장 품질로 가볍게 만든 PDF를 다운로드합니다.</div>';
    const btn = document.createElement('button');
    btn.id = 'resultCompressDownloadBtn';
    btn.type = 'button';
    btn.className = 'run-btn';
    btn.style.cssText = 'margin-left:0;min-height:38px;padding:0 16px;border-radius:10px;background:#1d4ed8;color:#fff;border:0;font-weight:900;cursor:pointer;display:inline-flex;width:auto;';
    btn.textContent = 'PDF 경량화 후 다운로드';
    btn.onclick = () => compress(btn);
    box.appendChild(btn);
    if (header.nextSibling) results.insertBefore(box, header.nextSibling);
    else results.appendChild(box);
  }
  function resetWatch() {
    const old = document.getElementById('resultCompressDownloadBox');
    if (old && !shouldShow()) old.remove();
  }
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'fileInput') {
      temp = null;
      const old = document.getElementById('resultCompressDownloadBox');
      if (old) old.remove();
    }
  }, true);
  setInterval(() => { resetWatch(); addButton(); }, 600);
  document.addEventListener('DOMContentLoaded', () => setTimeout(addButton, 800));
})();
