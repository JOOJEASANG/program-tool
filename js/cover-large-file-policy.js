// Repo-wide source upload policy for user-owned cover images.
(function () {
  'use strict';
  if (window.__coverLargeFilePolicyV1) return;
  window.__coverLargeFilePolicyV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const MAX_SOURCE_BYTES = 500 * 1024 * 1024;
  const MAX_DECODED_PIXELS = 50_000_000;
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  let installed = false;

  function validateFile(file) {
    if (!file || !TYPES.has(file.type)) {
      throw new Error('JPG·PNG·WEBP 이미지만 사용할 수 있습니다.');
    }
    if (Number(file.size || 0) > MAX_SOURCE_BYTES) {
      throw new Error('표지 원본 이미지는 한 파일 최대 500MB까지 사용할 수 있습니다.');
    }
  }

  function loadImageFile500(file) {
    return new Promise((resolve, reject) => {
      try { validateFile(file); } catch (error) { reject(error); return; }
      const url = URL.createObjectURL(file);
      const image = new Image();
      const cleanup = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
      image.onload = () => {
        const pixels = Number(image.naturalWidth || 0) * Number(image.naturalHeight || 0);
        if (!pixels || pixels > MAX_DECODED_PIXELS) {
          cleanup();
          reject(new Error('이미지 해상도는 5천만 픽셀 이하로 사용해 주세요.'));
          return;
        }
        cleanup();
        resolve(image);
      };
      image.onerror = () => {
        cleanup();
        reject(new Error('이미지 형식을 확인해 주세요.'));
      };
      image.src = url;
    });
  }

  function updateUi() {
    for (const id of ['frontUploadBox', 'backUploadBox']) {
      const sub = document.getElementById(id)?.querySelector('.upload-sub');
      if (sub) sub.textContent = 'JPG · PNG · WEBP · 최대 500MB';
    }
    const spread = document.querySelector('#coverSpreadLocal .cover-spread-note');
    if (spread) {
      spread.textContent = '사용자가 직접 선택한 이미지 한 장을 뒤표지 → 책등 → 앞표지까지 이어서 채웁니다. 원본 최대 500MB · 해상도 5천만 픽셀 이하 · 사용 권한이 있는 이미지만 업로드해 주세요.';
    }
    const front = document.getElementById('frontInput');
    const section = front?.closest('section.card');
    if (section && !document.getElementById('coverLargeFilePolicyNote')) {
      const note = document.createElement('div');
      note.id = 'coverLargeFilePolicyNote';
      note.className = 'card-note';
      note.style.marginTop = '7px';
      note.textContent = '원본 이미지 파일은 한 파일 최대 500MB까지 선택할 수 있습니다. 브라우저 메모리 보호를 위해 해상도는 5천만 픽셀 이하로 제한됩니다.';
      section.appendChild(note);
    }
  }

  function install() {
    if (installed) { updateUi(); return true; }
    if (typeof window.loadImageFile !== 'function') return false;
    window.loadImageFile = loadImageFile500;
    try { loadImageFile = loadImageFile500; } catch (_) {}
    window.CoverFileTransferPolicy = {
      maxSourceBytes: MAX_SOURCE_BYTES,
      maxDecodedPixels: MAX_DECODED_PIXELS,
      validateFile,
      loadImageFile: loadImageFile500,
      stage: 'cover-source-500mb-decoded-pixel-guard',
    };
    installed = true;
    document.documentElement.dataset.coverFileTransferPolicy = '1';
    updateUi();
    return true;
  }

  let attempts = 0;
  const retry = () => {
    attempts += 1;
    if (install() || attempts >= 50) return;
    setTimeout(retry, 100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', retry, { once: true });
  else retry();
  setTimeout(updateUi, 1800);
})();
