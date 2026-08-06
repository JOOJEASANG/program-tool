// Synchronous lazy-loader boundary for cover PDF output. No network request occurs until ensure() is called.
(function () {
  'use strict';
  if (window.CoverJsPdfLoader) return;

  const URLS = [
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
  ];
  const LOAD_TIMEOUT_MS = 6000;
  let pending = null;

  function ready() {
    return typeof window.jspdf?.jsPDF === 'function';
  }

  function loadUrl(url, index) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (!error && ready()) {
          resolve(window.jspdf.jsPDF);
          return;
        }
        script.remove();
        reject(error || new Error('PDF 라이브러리를 확인하지 못했습니다.'));
      };
      const timer = setTimeout(
        () => finish(new Error('PDF 라이브러리 연결 시간이 초과됐습니다.')),
        LOAD_TIMEOUT_MS,
      );
      script.async = true;
      script.src = url;
      script.dataset.coverJspdfLoader = String(index + 1);
      script.onload = () => finish();
      script.onerror = () => finish(new Error('PDF 라이브러리 연결에 실패했습니다.'));
      document.head.appendChild(script);
    });
  }

  async function loadFrom(index) {
    try {
      return await loadUrl(URLS[index], index);
    } catch (error) {
      if (index + 1 < URLS.length) return loadFrom(index + 1);
      throw error;
    }
  }

  function ensure() {
    if (ready()) return Promise.resolve(window.jspdf.jsPDF);
    if (pending) return pending;
    pending = loadFrom(0).catch((error) => {
      pending = null;
      throw error;
    });
    return pending;
  }

  window.CoverJsPdfLoader = {
    ensure,
    ready,
    get loading() { return Boolean(pending && !ready()); },
    stage: 'synchronous-lazy-jspdf-boundary',
  };
})();
