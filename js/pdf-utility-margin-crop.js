// PDF Utility: combined background cleanup + margin crop controls.
(function () {
  'use strict';
  if (window.__pdfUtilityMarginCropV1) return;
  window.__pdfUtilityMarginCropV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  const $ = (id) => document.getElementById(id);

  function installStyles() {
    if ($('pdfUtilityMarginCropStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityMarginCropStyles';
    style.textContent = `
      .pdfu-margin-box{margin-top:14px;padding:13px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fbfd}
      .pdfu-margin-title{font-size:12px;font-weight:950;color:#12396d;margin-bottom:4px}
      .pdfu-margin-desc{font-size:10px;line-height:1.5;color:#64748b;margin-bottom:10px}
      .pdfu-margin-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .pdfu-margin-field{display:grid;grid-template-columns:44px minmax(0,1fr) 28px;align-items:center;gap:5px}
      .pdfu-margin-field label{font-size:10px;font-weight:900;color:#475569}
      .pdfu-margin-input{width:100%;border:1px solid #d5dee8;border-radius:8px;background:#fff;padding:8px 8px;font-size:12px;font-weight:800;outline:none;text-align:right}
      .pdfu-margin-input:focus{border-color:#1d9bb2;box-shadow:0 0 0 3px rgba(29,155,178,.1)}
      .pdfu-margin-unit{font-size:10px;color:#94a3b8;font-weight:800}
      .pdfu-margin-zero{margin-top:8px;font-size:9px;color:#64748b;line-height:1.45}
      @media(max-width:480px){.pdfu-margin-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureMarginControls() {
    const body = $('pdfUtilityModalBody');
    const run = $('pdfUtilityModalRun');
    if (!body || !run) return;
    if (!body.querySelector('.pdfu-margin-box')) {
      const box = document.createElement('div');
      box.className = 'pdfu-margin-box';
      box.innerHTML = `
        <div class="pdfu-margin-title">여백 자르기</div>
        <div class="pdfu-margin-desc">배경색 제거와 동시에 페이지 가장자리 여백을 잘라냅니다. 수치는 mm 단위이며 모든 페이지에 적용됩니다.</div>
        <div class="pdfu-margin-grid">
          <div class="pdfu-margin-field"><label for="pdfuMarginTop">위</label><input id="pdfuMarginTop" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
          <div class="pdfu-margin-field"><label for="pdfuMarginBottom">아래</label><input id="pdfuMarginBottom" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
          <div class="pdfu-margin-field"><label for="pdfuMarginLeft">왼쪽</label><input id="pdfuMarginLeft" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
          <div class="pdfu-margin-field"><label for="pdfuMarginRight">오른쪽</label><input id="pdfuMarginRight" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
        </div>
        <div class="pdfu-margin-zero">네 값을 모두 0mm로 두면 기존 배경색 제거와 동일하게 처리됩니다.</div>`;
      body.appendChild(box);
    }
  }

  function getActiveFile() {
    const input = $('fileInput');
    const files = input?.files ? Array.from(input.files) : [];
    if (!files.length) return null;
    const activeRow = document.querySelector('.pdfu-file-row.active');
    const index = Number(activeRow?.dataset?.index);
    return Number.isInteger(index) && index >= 0 && files[index] ? files[index] : files[0];
  }

  function marginValue(id) {
    const value = Number($(id)?.value || 0);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('여백은 0~100mm 사이의 숫자로 입력하세요.');
    return Math.round(value * 10) / 10;
  }

  async function ensureStorage() {
    if (window.storage?.ref) return window.storage;
    if (typeof firebase !== 'undefined' && firebase.storage) {
      window.storage = firebase.storage();
      return window.storage;
    }
    await new Promise((resolve, reject) => {
      const existing = document.getElementById('firebaseStorageCompatSdk');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'firebaseStorageCompatSdk';
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase Storage SDK 로드 실패'));
      document.head.appendChild(script);
    });
    if (!firebase?.storage) throw new Error('Firebase Storage를 초기화할 수 없습니다.');
    window.storage = firebase.storage();
    return window.storage;
  }

  async function uploadPdf(file) {
    const user = window.auth?.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    if (!file || file.type !== 'application/pdf') throw new Error('PDF 파일만 처리할 수 있습니다.');
    if (file.size > 500 * 1024 * 1024) throw new Error('PDF 한 파일은 최대 500MB까지 처리할 수 있습니다.');
    const storage = await ensureStorage();
    const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const path = `pdf_temp/${user.uid}/${session}/background-crop.pdf`;
    await storage.ref(path).put(file, { contentType: 'application/pdf' });
    return path;
  }

  async function readDelivery(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response.blob();
    const delivery = await response.json();
    if (delivery?.delivery !== 'storage' || !delivery.download_url) throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result = await fetch(delivery.download_url, { cache: 'no-store' });
    if (!result.ok) throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob = await result.blob();
    if (delivery.storage_path) {
      try {
        const storage = await ensureStorage();
        await storage.ref(delivery.storage_path).delete();
      } catch (_) {}
    }
    return blob;
  }

  function downloadBlob(blob, file) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function runCombined(event) {
    const title = $('pdfUtilityModalTitle')?.textContent || '';
    const strengthInput = document.querySelector('input[name="pdfuBgStrength"]:checked');
    if (!title.includes('배경색 제거') || !strengthInput) return false;

    const margins = {
      top: marginValue('pdfuMarginTop'),
      bottom: marginValue('pdfuMarginBottom'),
      left: marginValue('pdfuMarginLeft'),
      right: marginValue('pdfuMarginRight'),
    };
    if (!margins.top && !margins.bottom && !margins.left && !margins.right) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    const file = getActiveFile();
    if (!file) {
      if (typeof window.showError === 'function') window.showError('배경색을 제거할 PDF를 선택하세요.');
      return true;
    }

    const run = $('pdfUtilityModalRun');
    const close = $('pdfUtilityModalClose');
    const cancel = $('pdfUtilityModalCancel');
    const buttons = document.querySelectorAll('.pdfu-action');
    [run, close, cancel].forEach((button) => { if (button) button.disabled = true; });
    buttons.forEach((button) => { button.disabled = true; });

    try {
      if (typeof window.showCheckStatus === 'function') window.showCheckStatus(`${file.name} 배경색 제거와 여백 자르기를 시작합니다.`);
      if (typeof window.setProgress === 'function') window.setProgress(3, '⬜', '배경색 제거 + 여백 자르기 준비 중');
      run.textContent = '처리 중...';

      const path = await uploadPdf(file);
      if (typeof window.setProgress === 'function') window.setProgress(45, '⬜', '서버에서 배경색 제거와 여백 자르기 중');
      const token = await window.auth.currentUser.getIdToken(true);
      const response = await fetch('/api/pdf-utility/background-cleanup-crop-storage', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_path: path,
          filename: file.name,
          strength: strengthInput.value,
          margin_top_mm: margins.top,
          margin_bottom_mm: margins.bottom,
          margin_left_mm: margins.left,
          margin_right_mm: margins.right,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail || `서버 오류 (${response.status})`);
      }
      if (typeof window.setProgress === 'function') window.setProgress(92, '⬇️', '완성 PDF 내려받는 중');
      const blob = await readDelivery(response);
      const base = file.name.replace(/\.pdf$/i, '') || 'document';
      downloadBlob(blob, `${base}_배경제거_여백자르기.pdf`);
      if (typeof window.setProgress === 'function') window.setProgress(100, '✅', '배경색 제거 + 여백 자르기 완료');
      if (typeof window.showCheckStatus === 'function') window.showCheckStatus('배경색 제거와 지정한 네 방향 여백 자르기가 완료되었습니다.', 'ok');
      setTimeout(() => { if (typeof window.stopProgress === 'function') window.stopProgress(); }, 900);
      $('pdfUtilityModalOverlay')?.classList.remove('open');
    } catch (error) {
      if (typeof window.showError === 'function') window.showError(error?.message || '배경색 제거와 여백 자르기에 실패했습니다.');
      if (typeof window.showCheckStatus === 'function') window.showCheckStatus(error?.message || '처리에 실패했습니다.', 'err');
    } finally {
      [run, close, cancel].forEach((button) => { if (button) button.disabled = false; });
      buttons.forEach((button) => { button.disabled = false; });
      if (run) run.textContent = '배경 제거 + 여백 자르기 실행';
    }
    return true;
  }

  function install() {
    installStyles();
    const observer = new MutationObserver(() => ensureMarginControls());
    observer.observe(document.body, { childList: true, subtree: true });

    const attach = () => {
      const run = $('pdfUtilityModalRun');
      if (!run || run.dataset.marginCropBound === 'true') return;
      run.dataset.marginCropBound = 'true';
      run.addEventListener('click', (event) => {
        runCombined(event).catch((error) => console.error('[pdf utility margin crop]', error));
      }, true);
    };

    const timer = setInterval(() => {
      ensureMarginControls();
      attach();
      if ($('pdfUtilityModalRun')) clearInterval(timer);
    }, 250);
    setTimeout(() => clearInterval(timer), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
