// Device-aware cover output budget and jsPDF recovery at the output boundary.
(function () {
  'use strict';
  if (window.__coverOutputPerformanceSafetyV1) return;
  window.__coverOutputPerformanceSafetyV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 260, 700, 1200, 2000, 3000];
  const HARD_PIXEL_CAP = 52_000_000;
  const CANVAS_DIMENSION_CAP = 16_384;
  const WORKING_BYTES_PER_PIXEL = 12;
  const JSPDF_FALLBACK_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  const OUTPUTS = {
    pdfBtn: { kind: 'pdf', dpi: 300, label: '300DPI RGB PDF' },
    guidePdfBtn: { kind: 'guide', dpi: 300, label: '가이드 PDF' },
    pngBtn: { kind: 'png', dpi: 180, label: '미리보기 PNG' },
  };

  let jsPdfPromise = null;
  let pendingRetryButton = null;

  const byId = (id) => document.getElementById(id);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positive = (value, fallback) => {
    const number = finite(value, fallback);
    return number > 0 ? number : fallback;
  };

  function devicePixelCap(deviceMemory) {
    const memory = finite(deviceMemory, 0);
    if (memory > 0 && memory <= 2) return 24_000_000;
    if (memory > 0 && memory <= 4) return 34_000_000;
    if (memory > 0 && memory <= 8) return 46_000_000;
    return HARD_PIXEL_CAP;
  }

  function normalizeSpec(source) {
    const spec = source && typeof source === 'object' ? source : {};
    const trimW = positive(spec.trimW, 210);
    const trimH = positive(spec.trimH, 297);
    const bleed = Math.max(0, finite(spec.bleed, 3));
    const spine = Math.max(0, finite(spec.spine, 0));
    const totalW = positive(spec.totalW, trimW * 2 + spine + bleed * 2);
    const totalH = positive(spec.totalH, trimH + bleed * 2);
    return { trimW, trimH, bleed, spine, totalW, totalH };
  }

  function currentSpec() {
    try {
      if (typeof getSpec === 'function') return normalizeSpec(getSpec());
    } catch (_) {}

    const trimW = positive(byId('trimW')?.value, 210);
    const trimH = positive(byId('trimH')?.value, 297);
    const bleed = Math.max(0, finite(byId('bleed')?.value, 3));
    const manual = Boolean(byId('manualSpine')?.checked);
    const pageCount = Math.max(2, Math.round(finite(byId('pageCount')?.value, 160)));
    const caliper = Math.max(0, finite(byId('paperCaliper')?.value, 0.1));
    const adjust = finite(byId('bindingAdjust')?.value, 0.5);
    const spine = manual
      ? Math.max(0, finite(byId('spineManual')?.value, 0))
      : Math.max(0, Math.ceil(pageCount / 2) * caliper + adjust);
    return normalizeSpec({ trimW, trimH, bleed, spine });
  }

  function calculateOutputBudget(sourceSpec, kind = 'pdf', deviceMemory = 0) {
    const spec = normalizeSpec(sourceSpec);
    const output = Object.values(OUTPUTS).find((entry) => entry.kind === kind) || OUTPUTS.pdfBtn;
    const widthPx = Math.max(1, Math.round(spec.totalW * output.dpi / 25.4));
    const heightPx = Math.max(1, Math.round(spec.totalH * output.dpi / 25.4));
    const pixels = widthPx * heightPx;
    const deviceCap = devicePixelCap(deviceMemory);
    const pixelCap = Math.min(HARD_PIXEL_CAP, deviceCap);
    const rawBytes = pixels * 4;
    const estimatedWorkingBytes = pixels * WORKING_BYTES_PER_PIXEL;
    const invalid = !Number.isFinite(pixels) || pixels <= 0;
    const dimensionExceeded = widthPx > CANVAS_DIMENSION_CAP || heightPx > CANVAS_DIMENSION_CAP;
    const pixelExceeded = pixels > pixelCap;
    const allowed = !invalid && !dimensionExceeded && !pixelExceeded;
    let reason = '';
    if (invalid) reason = '출력 규격을 계산하지 못했습니다.';
    else if (dimensionExceeded) reason = `캔버스 한 변이 ${CANVAS_DIMENSION_CAP.toLocaleString()}px 제한을 초과합니다.`;
    else if (pixelExceeded) reason = `현재 기기 기준 ${pixelCap.toLocaleString()}픽셀 제한을 초과합니다.`;

    return {
      kind: output.kind,
      label: output.label,
      dpi: output.dpi,
      spec,
      widthPx,
      heightPx,
      pixels,
      pixelCap,
      rawBytes,
      estimatedWorkingBytes,
      allowed,
      reason,
    };
  }

  function formatMegabytes(bytes) {
    return `${Math.max(1, Math.round(bytes / (1024 * 1024))).toLocaleString()}MB`;
  }

  function setStatus(message, type = 'info') {
    try {
      if (typeof window.setStatus === 'function') {
        window.setStatus(message, type);
        return;
      }
    } catch (_) {}
    const status = byId('status');
    if (!status) return;
    status.textContent = message;
    status.className = `status ${type}`;
  }

  function stopOutput(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function hasBlockingPreflightError() {
    try {
      if (window.CoverRuntimeSafety?.hasBlockingPreflightError?.()) return true;
    } catch (_) {}
    const summary = String(byId('coverPreflightSummary')?.textContent || '').trim();
    if (summary.startsWith('출력 전 수정 필요')) return true;
    return [...(byId('coverPreflightList')?.querySelectorAll?.('strong') || [])]
      .some((node) => String(node.textContent || '').trim().startsWith('✕'));
  }

  function jsPdfReady() {
    return typeof window.jspdf?.jsPDF === 'function';
  }

  function ensureJsPdf() {
    if (jsPdfReady()) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPdfPromise) return jsPdfPromise;

    jsPdfPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-cover-jspdf-fallback="1"]');
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (!error && jsPdfReady()) resolve(window.jspdf.jsPDF);
        else reject(error || new Error('PDF 라이브러리를 불러오지 못했습니다.'));
      };
      script.addEventListener('load', () => finish(), { once: true });
      script.addEventListener('error', () => finish(new Error('PDF 라이브러리 연결에 실패했습니다.')), { once: true });
      setTimeout(() => finish(new Error('PDF 라이브러리 연결 시간이 초과됐습니다.')), 12_000);
      if (!existing) {
        script.src = JSPDF_FALLBACK_URL;
        script.async = true;
        script.dataset.coverJspdfFallback = '1';
        document.head.appendChild(script);
      }
    }).catch((error) => {
      jsPdfPromise = null;
      throw error;
    });
    return jsPdfPromise;
  }

  function annotateBudget(button, budget) {
    button.dataset.coverOutputWidthPx = String(budget.widthPx);
    button.dataset.coverOutputHeightPx = String(budget.heightPx);
    button.dataset.coverOutputPixels = String(budget.pixels);
    button.dataset.coverOutputWorkingMb = String(Math.round(budget.estimatedWorkingBytes / (1024 * 1024)));
  }

  function blockForBudget(event, button, budget) {
    stopOutput(event);
    setStatus(
      `${budget.label} 생성 중단 · ${budget.reason} `
      + `예상 ${budget.widthPx.toLocaleString()}×${budget.heightPx.toLocaleString()}px, `
      + `작업 메모리 약 ${formatMegabytes(budget.estimatedWorkingBytes)}입니다. 규격·재단 여백·책등 폭을 줄이세요.`,
      'err',
    );
    button.closest?.('.download-card')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
  }

  function recoverJsPdf(event, button) {
    stopOutput(event);
    if (pendingRetryButton) {
      setStatus('PDF 라이브러리를 연결하는 중입니다. 잠시 후 자동으로 다시 시작합니다.', 'info');
      return;
    }
    pendingRetryButton = button;
    button.disabled = true;
    setStatus('PDF 라이브러리 연결을 복구하는 중입니다.', 'info');
    ensureJsPdf()
      .then(() => {
        const retry = pendingRetryButton;
        pendingRetryButton = null;
        if (retry) retry.disabled = false;
        setStatus('PDF 라이브러리 연결을 복구했습니다. 출력을 다시 시작합니다.', 'ok');
        retry?.click();
      })
      .catch((error) => {
        const retry = pendingRetryButton;
        pendingRetryButton = null;
        if (retry) retry.disabled = false;
        setStatus(error?.message || 'PDF 라이브러리를 연결하지 못했습니다.', 'err');
      });
  }

  function handleOutputClick(event) {
    const button = event.currentTarget;
    const output = OUTPUTS[button?.id];
    if (!output) return;
    if (hasBlockingPreflightError()) return;

    const budget = calculateOutputBudget(currentSpec(), output.kind, navigator.deviceMemory || 0);
    annotateBudget(button, budget);
    if (!budget.allowed) {
      blockForBudget(event, button, budget);
      return;
    }
    if (output.kind !== 'png' && !jsPdfReady()) recoverJsPdf(event, button);
  }

  function install() {
    for (const id of Object.keys(OUTPUTS)) {
      const button = byId(id);
      if (!button || button.dataset.coverOutputSafetyV1 === '1') continue;
      button.dataset.coverOutputSafetyV1 = '1';
      button.addEventListener('click', handleOutputClick, { capture: true });
    }
  }

  window.CoverOutputPerformanceSafety = {
    normalizeSpec,
    currentSpec,
    devicePixelCap,
    calculateOutputBudget,
    ensureJsPdf,
    handleOutputClick,
    stage: 'device-output-budget-jspdf-recovery',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
