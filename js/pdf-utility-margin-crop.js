// PDF Utility: background cleanup + edge-content removal using current PdfUtility selection.
(function () {
  'use strict';
  if (window.__pdfUtilityBackgroundMarginV2) return;
  window.__pdfUtilityBackgroundMarginV2 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(
    path === '/pdf-preflight' ||
    path.endsWith('/pdf-preflight/index.html') ||
    path.endsWith('/tools/pdf-Checker.html') ||
    path.endsWith('/tools/preflight.html')
  )) return;

  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);

  function installStyles() {
    if ($('pdfUtilityBackgroundMarginStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityBackgroundMarginStylesV2';
    style.textContent = `
      .pdfu-margin-box{width:100%;max-width:none;margin-top:14px;padding:13px;border:1px solid #dbe5ee;border-radius:12px;background:#f8fbfd;box-sizing:border-box}
      .pdfu-margin-title{font-size:12px;font-weight:950;color:#12396d;margin-bottom:4px}
      .pdfu-margin-desc{font-size:10px;line-height:1.55;color:#64748b;margin-bottom:10px}
      .pdfu-margin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
      .pdfu-margin-field{display:grid;grid-template-columns:44px minmax(0,1fr) 28px;align-items:center;gap:5px;min-width:0}
      .pdfu-margin-field label{font-size:10px;font-weight:900;color:#475569}
      .pdfu-margin-input{width:100%;min-width:0;border:1px solid #d5dee8;border-radius:8px;background:#fff;padding:8px;font-size:12px;font-weight:800;outline:none;text-align:right;box-sizing:border-box}
      .pdfu-margin-input:focus{border-color:#1d9bb2;box-shadow:0 0 0 3px rgba(29,155,178,.1)}
      .pdfu-margin-unit{font-size:10px;color:#94a3b8;font-weight:800}
      .pdfu-margin-zero{margin-top:8px;font-size:9px;color:#64748b;line-height:1.5}
      html.pdfu-background-margin-busy .action-btn{pointer-events:none!important;opacity:.55}
      #pdfPreflightOutputToolDock[data-panel-size="narrow"] .pdfu-margin-grid,
      #pdfPreflightOutputToolDock[data-panel-size="compact"] .pdfu-margin-grid{grid-template-columns:1fr}
      @media(max-width:480px){.pdfu-margin-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function isBackgroundDialog() {
    const title = $('pdfUtilityModalTitle')?.textContent || '';
    const strength = document.querySelector('input[name="pdfuBgStrength"]');
    return title.includes('배경색 제거') && Boolean(strength);
  }

  function marginMarkup() {
    return `
      <div class="pdfu-margin-title">여백 내용 제거</div>
      <div class="pdfu-margin-desc">위·아래·왼쪽·오른쪽에 입력한 mm만큼의 가장자리 내용도 함께 삭제합니다. 페이지 크기는 그대로 유지되고 삭제 영역은 흰색으로 정리됩니다.</div>
      <div class="pdfu-margin-grid">
        <div class="pdfu-margin-field"><label for="pdfuMarginTop">위</label><input id="pdfuMarginTop" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
        <div class="pdfu-margin-field"><label for="pdfuMarginBottom">아래</label><input id="pdfuMarginBottom" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
        <div class="pdfu-margin-field"><label for="pdfuMarginLeft">왼쪽</label><input id="pdfuMarginLeft" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
        <div class="pdfu-margin-field"><label for="pdfuMarginRight">오른쪽</label><input id="pdfuMarginRight" class="pdfu-margin-input" type="number" min="0" max="100" step="0.1" value="0" inputmode="decimal"><span class="pdfu-margin-unit">mm</span></div>
      </div>
      <div class="pdfu-margin-zero">네 값을 모두 0mm로 두면 배경색만 제거합니다. 입력값은 모든 페이지에 동일하게 적용됩니다.</div>`;
  }

  function syncMarginControls() {
    const body = $('pdfUtilityModalBody');
    if (!body) return;
    let box = body.querySelector('.pdfu-margin-box');
    if (!isBackgroundDialog()) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement('div');
      box.className = 'pdfu-margin-box';
      box.dataset.pdfUtilityBackgroundMargin = 'v2';
      box.innerHTML = marginMarkup();
      body.appendChild(box);
    }
  }

  function selectedFile() {
    const state = window.PdfUtility?.state;
    if (!state || !Array.isArray(state.files)) return null;
    const index = Number(state.activeIndex);
    if (!Number.isInteger(index) || index < 0) return state.files[0] || null;
    return state.files[index] || state.files[0] || null;
  }

  function marginValue(id) {
    const raw = $(id)?.value;
    const value = raw === '' || raw == null ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('여백은 0~100mm 사이의 숫자로 입력하세요.');
    }
    return Math.round(value * 10) / 10;
  }

  function readMargins() {
    return {
      top: marginValue('pdfuMarginTop'),
      bottom: marginValue('pdfuMarginBottom'),
      left: marginValue('pdfuMarginLeft'),
      right: marginValue('pdfuMarginRight'),
    };
  }

  function hasMargin(margins) {
    return Boolean(margins.top || margins.bottom || margins.left || margins.right);
  }

  async function ensureStorage() {
    if (typeof window._ensureStorage === 'function') return window._ensureStorage();
    if (window.storage?.ref) return window.storage;
    if (typeof firebase !== 'undefined' && firebase.storage) {
      window.storage = firebase.storage();
      return window.storage;
    }
    await new Promise((resolve, reject) => {
      const existing = $('firebaseStorageCompatSdk');
      if (existing) {
        if (typeof firebase !== 'undefined' && firebase.storage) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Firebase Storage SDK 로드 실패')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = 'firebaseStorageCompatSdk';
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase Storage SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
    if (typeof firebase === 'undefined' || !firebase.storage) throw new Error('Firebase Storage를 초기화할 수 없습니다.');
    window.storage = firebase.storage();
    return window.storage;
  }

  async function readDelivery(response, storageInstance) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response.blob();
    const delivery = await response.json();
    if (delivery?.delivery !== 'storage' || !delivery.download_url) {
      throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    }
    const result = await fetch(delivery.download_url, { cache: 'no-store' });
    if (!result.ok) throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob = await result.blob();
    if (delivery.storage_path && storageInstance) {
      try { await storageInstance.ref(delivery.storage_path).delete(); } catch (_) {}
    }
    return blob;
  }

  function safeBaseName(file) {
    return String(file?.name || 'document.pdf')
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .slice(0, 70) || 'document';
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

  function setBusyVisual(busy) {
    document.documentElement.classList.toggle('pdfu-background-margin-busy', busy);
    ['pdfUtilityModalRun', 'pdfUtilityModalClose', 'pdfUtilityModalCancel'].forEach((id) => {
      const node = $(id);
      if (node) node.disabled = busy;
    });
  }

  async function runCombined(event) {
    if (!isBackgroundDialog()) return false;
    const margins = readMargins();
    if (!hasMargin(margins)) return false;

    event.preventDefault();
    event.stopImmediatePropagation();

    const file = selectedFile();
    if (!file) {
      if (typeof window.showError === 'function') window.showError('배경색을 제거할 PDF를 선택하세요.');
      else alert('배경색을 제거할 PDF를 선택하세요.');
      return true;
    }
    if (Number(file.size || 0) > MAX_FILE_BYTES) {
      if (typeof window.showError === 'function') window.showError('PDF 한 파일은 최대 200MB까지 처리할 수 있습니다.');
      return true;
    }

    const utilityState = window.PdfUtility?.state;
    if (utilityState?.busy) return true;
    if (utilityState) utilityState.busy = true;
    setBusyVisual(true);
    if (typeof window.setPageBusy === 'function') window.setPageBusy(true, '배경색·여백 내용 제거');

    let storageInstance = null;
    let storagePath = '';
    try {
      const user = window.auth?.currentUser;
      if (!user) throw new Error('로그인이 필요합니다.');
      const strength = document.querySelector('input[name="pdfuBgStrength"]:checked')?.value || 'medium';
      if (typeof window.showCheckStatus === 'function') window.showCheckStatus(`${file.name} 배경색과 지정 여백 내용을 제거하는 중입니다.`);
      if (typeof window.setProgress === 'function') window.setProgress(3, '⬜', '배경색 + 여백 내용 제거 준비 중');

      storageInstance = await ensureStorage();
      const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      storagePath = `pdf_temp/${user.uid}/${session}/background-margin.pdf`;
      await storageInstance.ref(storagePath).put(file, { contentType: 'application/pdf' });

      if (typeof window.setProgress === 'function') window.setProgress(48, '⬜', '서버에서 배경색과 가장자리 내용 제거 중');
      const token = await user.getIdToken(true);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 285000);
      let response;
      try {
        response = await fetch('/api/pdf-utility/background-cleanup-crop-storage', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storage_path: storagePath,
            filename: file.name,
            strength,
            margin_top_mm: margins.top,
            margin_bottom_mm: margins.bottom,
            margin_left_mm: margins.left,
            margin_right_mm: margins.right,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('처리 시간이 초과되었습니다. 파일 크기나 페이지 수를 줄여 다시 시도하세요.');
        throw error;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        let message = `서버 오류 (${response.status})`;
        try {
          const payload = await response.json();
          message = payload?.detail || payload?.message || message;
        } catch (_) {}
        throw new Error(message);
      }

      const blob = await readDelivery(response, storageInstance);
      downloadBlob(blob, `${safeBaseName(file)}_배경제거_여백내용제거.pdf`);
      if (typeof window.setProgress === 'function') window.setProgress(100, '✅', '배경색 + 여백 내용 제거 완료');
      if (typeof window.showCheckStatus === 'function') {
        window.showCheckStatus(`배경색 제거 완료 · 여백 내용 제거 위 ${margins.top} / 아래 ${margins.bottom} / 왼쪽 ${margins.left} / 오른쪽 ${margins.right}mm`, 'ok');
      }
      setTimeout(() => {
        if (typeof window.stopProgress === 'function' && !window.PdfUtility?.state?.busy) window.stopProgress();
      }, 900);
      $('pdfUtilityModalOverlay')?.classList.remove('open');
    } catch (error) {
      const message = error?.message || '배경색과 여백 내용 제거에 실패했습니다.';
      if (typeof window.showError === 'function') window.showError(message);
      else alert(message);
      if (typeof window.showCheckStatus === 'function') window.showCheckStatus(message, 'err');
    } finally {
      if (storagePath && storageInstance) {
        try { await storageInstance.ref(storagePath).delete(); } catch (_) {}
      }
      if (utilityState) utilityState.busy = false;
      setBusyVisual(false);
      if (typeof window.setPageBusy === 'function') window.setPageBusy(false);
    }
    return true;
  }

  function attachRunCapture() {
    const run = $('pdfUtilityModalRun');
    if (!run || run.dataset.backgroundMarginV2Bound === '1') return;
    run.dataset.backgroundMarginV2Bound = '1';
    run.addEventListener('click', (event) => {
      runCombined(event).catch((error) => console.error('[pdf utility background margin v2]', error));
    }, true);
  }

  function sync() {
    installStyles();
    syncMarginControls();
    attachRunCapture();
  }

  function install() {
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    const timer = setInterval(sync, 250);
    setTimeout(() => clearInterval(timer), 15000);
    window.PdfUtilityBackgroundMargin = {
      sync,
      selectedFile,
      readMargins,
      stage: 'background-margin-v2',
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
