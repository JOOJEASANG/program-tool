// PDF Utility transfer/cost guard: max 10 files, 500MB per file and per job.
(function () {
  'use strict';
  if (window.__pdfUtilityCostGuardV1) return;
  window.__pdfUtilityCostGuardV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  const MAX_FILES = 10;
  const MAX_BYTES = 500 * 1024 * 1024;
  const DIRECT_SECURITY_BYTES = 20 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);
  const fileKey = (file) => `${file.name}|${file.size}|${file.lastModified}`;
  const mb = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)}MB`;
  let installed = false;
  let uiObserver = null;
  let buttonObserver = null;

  function state() { return window.PdfUtility?.state || null; }
  function activeFile() {
    const current = state();
    return current?.files?.[current.activeIndex] || null;
  }
  function totalBytes() {
    return (state()?.files || []).reduce((sum, file) => sum + Number(file?.size || 0), 0);
  }
  function showError(message) {
    if (typeof window.showError === 'function') window.showError(message);
    else alert(message);
  }
  function hideError() {
    if (typeof window.hideError === 'function') window.hideError();
  }
  function showStatus(message, type = 'info') {
    if (typeof window.showCheckStatus === 'function') window.showCheckStatus(message, type);
  }
  function safeBaseName(file) {
    return String(file?.name || 'document.pdf').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'document';
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function rewriteLimitText() {
    const summary = $('pdfUtilityFileSummary');
    if (summary) summary.textContent = `${state()?.files?.length || 0} / ${MAX_FILES} · ${mb(totalBytes())} / 500MB`;
    const note = document.querySelector('.pdfu-limit-note');
    if (note) note.textContent = 'PDF는 최대 10개, 한 파일 최대 500MB, 한 번 작업 전체 합계 500MB까지 등록할 수 있습니다. 대용량 변환 작업은 서버 비용과 안정성을 위해 페이지·해상도 한도가 별도로 적용됩니다.';
    const uploadSub = document.querySelector('.upload-sub');
    if (uploadSub) uploadSub.innerHTML = '클릭하거나 여러 PDF를 끌어다 놓으세요.<br>최대 10개 · 파일당/전체 합계 500MB · PDF 형식만 지원';
    syncLargeSecurityButtons();
  }

  function renderAfterAdd() {
    const current = state();
    if (!current?.files?.length) return;
    window.PdfUtility.selectActive(Math.min(current.activeIndex || 0, current.files.length - 1));
    hideError();
    rewriteLimitText();
  }

  function addFiles500(rawFiles) {
    const current = state();
    if (!current || current.busy) return;
    const incoming = Array.from(rawFiles || []).filter(Boolean);
    if (!incoming.length) return;
    const existing = new Set(current.files.map(fileKey));
    const unique = incoming.filter((file) => !existing.has(fileKey(file)));
    const invalid = unique.find((file) => !file.name?.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf');
    if (invalid) return showError('PDF 파일만 업로드할 수 있습니다.');
    const tooLarge = unique.find((file) => Number(file.size || 0) > MAX_BYTES);
    if (tooLarge) return showError(`${tooLarge.name}: PDF 한 파일은 최대 500MB까지 가능합니다.`);
    if (current.files.length + unique.length > MAX_FILES) return showError(`PDF는 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`);
    const nextTotal = totalBytes() + unique.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (nextTotal > MAX_BYTES) return showError('한 번 작업에 등록하는 PDF 전체 합계는 최대 500MB까지 가능합니다.');
    current.files.push(...unique);
    if (current.files.length === unique.length) current.activeIndex = 0;
    renderAfterAdd();
  }

  function replaceUploadHandlers() {
    const input = $('fileInput');
    const zone = $('uploadZone');
    if (!input || !zone || input.dataset.pdfUtility500 === '1') return false;

    const nextInput = input.cloneNode(true);
    nextInput.dataset.pdfUtility500 = '1';
    nextInput.multiple = true;
    nextInput.setAttribute('multiple', 'multiple');
    input.replaceWith(nextInput);

    const nextZone = zone.cloneNode(true);
    nextZone.removeAttribute('onclick');
    nextZone.dataset.pdfUtility500 = '1';
    zone.replaceWith(nextZone);

    nextZone.addEventListener('click', () => nextInput.click());
    nextZone.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        nextInput.click();
      }
    });
    nextInput.addEventListener('change', (event) => {
      addFiles500(event.target.files);
      event.target.value = '';
    });
    for (const name of ['dragenter', 'dragover']) {
      nextZone.addEventListener(name, (event) => {
        event.preventDefault();
        nextZone.classList.add('dragover');
      });
    }
    nextZone.addEventListener('dragleave', () => nextZone.classList.remove('dragover'));
    nextZone.addEventListener('drop', (event) => {
      event.preventDefault();
      nextZone.classList.remove('dragover');
      addFiles500(event.dataTransfer?.files);
    });
    return true;
  }

  async function ensureStorage() {
    if (typeof window._ensureStorage === 'function') return window._ensureStorage();
    if (window.storage?.ref) return window.storage;
    if (firebase.storage) {
      window.storage = firebase.storage();
      return window.storage;
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase Storage SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
    window.storage = firebase.storage();
    return window.storage;
  }

  function installSecurityStyles() {
    if ($('pdfCostSecurityStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfCostSecurityStyles';
    style.textContent = `
      .pdfcost-overlay{display:none;position:fixed;inset:0;z-index:1400;background:rgba(15,23,42,.62);align-items:center;justify-content:center;padding:18px}.pdfcost-overlay.open{display:flex}
      .pdfcost-box{width:min(510px,100%);background:#fff;border-radius:20px;padding:23px;box-shadow:0 30px 80px rgba(0,0,0,.3)}
      .pdfcost-head{display:flex;gap:12px;align-items:center}.pdfcost-head h2{flex:1;font-size:19px}.pdfcost-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;font-size:20px;cursor:pointer}
      .pdfcost-file{margin:12px 0;padding:10px 12px;border:1px solid #bae6fd;background:#f0fdff;border-radius:10px;font-size:11px;font-weight:800;color:#0e7490;word-break:break-all}
      .pdfcost-label{display:block;font-size:11px;font-weight:900;margin:10px 0 6px}.pdfcost-input{width:100%;border:1.5px solid #d9e2ec;border-radius:10px;padding:10px 12px;font-size:13px}
      .pdfcost-note{margin-top:11px;padding:10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;font-size:10px;line-height:1.55;color:#64748b}
      .pdfcost-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.pdfcost-btn{border-radius:10px;padding:10px 16px;font-size:11px;font-weight:900;cursor:pointer}.pdfcost-cancel{border:1px solid #dbe5ee;background:#f8fafc}.pdfcost-run{border:0;background:#12396d;color:#fff}.pdfcost-btn:disabled,.pdfcost-close:disabled{opacity:.45;cursor:not-allowed}
      .pdfcost-status{margin-top:10px;font-size:11px;font-weight:800;color:#2563eb;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function makeSecurityModal() {
    if ($('pdfCostSecurityOverlay')) return;
    installSecurityStyles();
    const overlay = document.createElement('div');
    overlay.id = 'pdfCostSecurityOverlay';
    overlay.className = 'pdfcost-overlay';
    overlay.innerHTML = `
      <div class="pdfcost-box">
        <div class="pdfcost-head"><h2 id="pdfCostSecurityTitle">PDF 암호 작업</h2><button type="button" class="pdfcost-close" id="pdfCostSecurityClose">×</button></div>
        <div class="pdfcost-file" id="pdfCostSecurityFile"></div>
        <div id="pdfCostSecurityFields"></div>
        <div class="pdfcost-note">20MB를 초과한 PDF는 브라우저에서 Firebase Storage로 직접 전송한 뒤 서버가 처리합니다. 입력 임시파일과 다운로드 결과는 작업 직후 삭제를 시도하며, 비정상 종료 파일도 짧은 보존시간 뒤 자동 정리됩니다.</div>
        <div class="pdfcost-actions"><button type="button" class="pdfcost-btn pdfcost-cancel" id="pdfCostSecurityCancel">취소</button><button type="button" class="pdfcost-btn pdfcost-run" id="pdfCostSecurityRun">실행</button></div>
        <div class="pdfcost-status" id="pdfCostSecurityStatus"></div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => { if (overlay.dataset.busy !== '1') overlay.classList.remove('open'); };
    $('pdfCostSecurityClose').addEventListener('click', close);
    $('pdfCostSecurityCancel').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  async function readDelivery(response, storageInstance) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response.blob();
    const delivery = await response.json();
    if (delivery?.delivery !== 'storage' || !delivery.download_url) throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    if (Number(delivery.size_bytes || 0) > MAX_BYTES) throw new Error('완성 PDF가 500MB 다운로드 한도를 초과합니다.');
    const result = await fetch(delivery.download_url, { cache: 'no-store' });
    if (!result.ok) throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob = await result.blob();
    if (blob.size > MAX_BYTES) throw new Error('완성 PDF가 500MB 다운로드 한도를 초과합니다.');
    if (delivery.storage_path) {
      try { await storageInstance.ref(delivery.storage_path).delete(); } catch (_) {}
    }
    return blob;
  }

  async function runLargeSecurity(operation, password) {
    const file = activeFile();
    if (!file) throw new Error('암호 작업을 할 PDF를 선택하세요.');
    if (file.size > MAX_BYTES) throw new Error('PDF 한 파일은 최대 500MB까지 가능합니다.');
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const storageInstance = await ensureStorage();
    const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const safe = (file.name || 'document.pdf').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 70) || 'document.pdf';
    const storagePath = `pdf_temp/${user.uid}/${session}/security_${safe.toLowerCase().endsWith('.pdf') ? safe : safe + '.pdf'}`;
    let uploaded = false;
    try {
      showStatus(`${file.name} 대용량 암호 작업용 업로드 중...`);
      await storageInstance.ref(storagePath).put(file, { contentType: 'application/pdf' });
      uploaded = true;
      const token = await user.getIdToken(true);
      showStatus(`${operation === 'encrypt' ? '암호 설정' : '암호 해제'} 처리 중...`);
      const response = await fetch('/api/pdf-utility/security-storage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath, filename: file.name, operation, password })
      });
      if (!response.ok) {
        let message = `서버 오류 (${response.status})`;
        try { const body = await response.json(); message = body?.detail || body?.message || message; } catch (_) {}
        throw new Error(message);
      }
      const blob = await readDelivery(response, storageInstance);
      downloadBlob(blob, `${safeBaseName(file)}_${operation === 'encrypt' ? '암호설정' : '암호해제'}.pdf`);
      showStatus('암호 작업이 완료되어 PDF를 다운로드했습니다.', 'ok');
    } finally {
      if (uploaded) {
        try { await storageInstance.ref(storagePath).delete(); } catch (_) {}
      }
    }
  }

  function openLargeSecurity(operation) {
    const file = activeFile();
    if (!file) return showError('암호 작업을 할 PDF를 선택하세요.');
    makeSecurityModal();
    const overlay = $('pdfCostSecurityOverlay');
    overlay.dataset.operation = operation;
    $('pdfCostSecurityTitle').textContent = operation === 'encrypt' ? '대용량 PDF 암호 설정' : '대용량 PDF 암호 해제';
    $('pdfCostSecurityFile').textContent = `${file.name} · ${mb(file.size)}`;
    $('pdfCostSecurityFields').innerHTML = operation === 'encrypt'
      ? '<label class="pdfcost-label">새 비밀번호 (4~32자)</label><input class="pdfcost-input" id="pdfCostPassword" type="password" maxlength="32"><label class="pdfcost-label">비밀번호 확인</label><input class="pdfcost-input" id="pdfCostPassword2" type="password" maxlength="32">'
      : '<label class="pdfcost-label">현재 비밀번호</label><input class="pdfcost-input" id="pdfCostPassword" type="password" placeholder="비밀번호가 없으면 비워두고 실행">';
    $('pdfCostSecurityStatus').textContent = '';
    overlay.classList.add('open');
    setTimeout(() => $('pdfCostPassword')?.focus(), 50);
  }

  function bindLargeSecurity() {
    makeSecurityModal();
    for (const [id, operation] of [['encryptBtn', 'encrypt'], ['decryptBtn', 'decrypt']]) {
      const button = $(id);
      if (!button || button.dataset.pdfUtilityLargeSecurity === '1') continue;
      button.dataset.pdfUtilityLargeSecurity = '1';
      button.addEventListener('click', (event) => {
        const file = activeFile();
        if (!file || file.size <= DIRECT_SECURITY_BYTES) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        openLargeSecurity(operation);
      }, true);
    }
    const run = $('pdfCostSecurityRun');
    if (run && run.dataset.bound !== '1') {
      run.dataset.bound = '1';
      run.addEventListener('click', async () => {
        const overlay = $('pdfCostSecurityOverlay');
        const operation = overlay.dataset.operation;
        const password = $('pdfCostPassword')?.value || '';
        const confirm = $('pdfCostPassword2')?.value || '';
        if (operation === 'encrypt') {
          if (password.length < 4 || password.length > 32) return showError('비밀번호는 4~32자로 입력하세요.');
          if (password !== confirm) return showError('비밀번호 확인이 일치하지 않습니다.');
        }
        overlay.dataset.busy = '1';
        for (const id of ['pdfCostSecurityRun', 'pdfCostSecurityClose', 'pdfCostSecurityCancel']) if ($(id)) $(id).disabled = true;
        $('pdfCostSecurityStatus').textContent = '처리 중입니다. 대용량 파일은 시간이 걸릴 수 있습니다.';
        try {
          await runLargeSecurity(operation, password);
          overlay.classList.remove('open');
        } catch (error) {
          $('pdfCostSecurityStatus').textContent = error?.message || '암호 작업에 실패했습니다.';
          showError(error?.message || '암호 작업에 실패했습니다.');
        } finally {
          overlay.dataset.busy = '0';
          for (const id of ['pdfCostSecurityRun', 'pdfCostSecurityClose', 'pdfCostSecurityCancel']) if ($(id)) $(id).disabled = false;
        }
      });
    }
  }

  function syncLargeSecurityButtons() {
    const file = activeFile();
    if (!file || file.size <= DIRECT_SECURITY_BYTES) return;
    for (const id of ['encryptBtn', 'decryptBtn']) {
      const button = $(id);
      if (!button) continue;
      if (!state()?.busy) button.disabled = false;
      button.title = '최대 500MB PDF까지 Storage 기반 암호 작업을 지원합니다.';
    }
  }

  function watchUi() {
    if (!uiObserver) {
      uiObserver = new MutationObserver(() => queueMicrotask(rewriteLimitText));
      const list = $('pdfUtilityFileList');
      if (list) uiObserver.observe(list, { childList: true, subtree: true, characterData: true });
    }
    if (!buttonObserver) {
      buttonObserver = new MutationObserver(() => queueMicrotask(syncLargeSecurityButtons));
      for (const id of ['encryptBtn', 'decryptBtn']) {
        const button = $(id);
        if (button) buttonObserver.observe(button, { attributes: true, attributeFilter: ['disabled', 'title'] });
      }
    }
  }

  function install() {
    if (installed) return;
    if (!window.PdfUtility || !$('pdfUtilityFileList') || !$('fileInput') || !$('uploadZone')) {
      setTimeout(install, 80);
      return;
    }
    installed = true;
    replaceUploadHandlers();
    bindLargeSecurity();
    watchUi();
    rewriteLimitText();
    document.documentElement.dataset.pdfUtilityCostGuard = '1';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
