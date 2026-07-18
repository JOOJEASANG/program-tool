// The server deletes every preflight_temp object after each operation.
// Reset the browser cache so a following action re-uploads instead of reusing
// a path that has already been securely removed.
(function () {
  if (window.__preflightTempClientV1) return;
  window.__preflightTempClientV1 = true;

  function install() {
    try {
      if (typeof _preflightStorageRequest !== 'function') {
        setTimeout(install, 80);
        return;
      }
      if (window.__preflightStorageRequestWrappedV1) return;
      window.__preflightStorageRequestWrappedV1 = true;
      const original = _preflightStorageRequest;
      _preflightStorageRequest = async function securePreflightStorageRequest() {
        try {
          return await original.apply(this, arguments);
        } finally {
          try { __preflightTemp = null; } catch (_) {}
        }
      };

      const uploadSub = document.querySelector('.upload-sub');
      if (uploadSub && !uploadSub.textContent.includes('자동 삭제')) {
        uploadSub.textContent += ' · 서버 임시파일은 작업 후 자동 삭제';
      }
    } catch (error) {
      console.warn('[preflight-temp] install failed', error);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
