// PDF operation progress, cancellation, and pre-save summary.
(function () {
  'use strict';
  if (window.__pdfOperationProgressSummaryV1) return;
  window.__pdfOperationProgressSummaryV1 = true;

  const byId = (id) => document.getElementById(id);
  let activeOperation = null;
  let downloadBypass = false;
  let previewBuildPatched = false;
  let displayPatched = false;
  let errorPatched = false;
  let attempts = 0;

  function editorReady() {
    try {
      return (
        Array.isArray(parsedPages) &&
        Array.isArray(uploadedFiles) &&
        typeof groupByNup === 'function' &&
        typeof getLayout === 'function' &&
        typeof buildOutputPage === 'function' &&
        typeof applyDocEdits === 'function'
      );
    } catch (_) {
      return false;
    }
  }

  function abortError(message = '작업이 취소되었습니다.') {
    try { return new DOMException(message, 'AbortError'); }
    catch (_) { const error = new Error(message); error.name = 'AbortError'; return error; }
  }

  function installStyles() {
    if (byId('pdfOperationUiStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfOperationUiStyles';
    style.textContent = `
      .pdf-operation-panel{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1600;width:min(440px,calc(100vw - 28px));padding:13px 14px;border:1px solid #cbd5e1;border-radius:13px;background:rgba(255,255,255,.98);box-shadow:0 18px 50px rgba(15,23,42,.24);display:none}
      .pdf-operation-panel.open{display:block}
      .pdf-operation-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
      .pdf-operation-title{font-size:12px;font-weight:900;color:#0f172a;flex:1}
      .pdf-operation-percent{font-size:11px;font-weight:900;color:#2563eb;min-width:34px;text-align:right}
      .pdf-operation-track{height:7px;border-radius:999px;background:#e2e8f0;overflow:hidden}
      .pdf-operation-fill{height:100%;width:0;background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);transition:width .18s ease}
      .pdf-operation-message{margin-top:7px;font-size:10px;font-weight:700;color:#64748b;line-height:1.45;min-height:15px}
      .pdf-operation-cancel{margin-top:9px;width:100%;min-height:32px;border:1px solid #fecaca;border-radius:8px;background:#fff5f5;color:#b91c1c;font:800 11px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .pdf-summary-overlay{position:fixed;inset:0;z-index:1550;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.52)}
      .pdf-summary-overlay.open{display:flex}
      .pdf-summary-card{width:min(520px,100%);max-height:min(720px,90vh);overflow:auto;border-radius:16px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.35)}
      .pdf-summary-head{padding:17px 19px 13px;border-bottom:1px solid #e5e7eb}
      .pdf-summary-head h2{font-size:16px;font-weight:900;color:#0f172a;margin:0}
      .pdf-summary-head p{font-size:10px;font-weight:650;color:#64748b;margin:5px 0 0;line-height:1.5}
      .pdf-summary-body{padding:15px 19px}
      .pdf-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .pdf-summary-item{padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
      .pdf-summary-item strong{display:block;font-size:9px;font-weight:850;color:#64748b;margin-bottom:3px}
      .pdf-summary-item span{font-size:12px;font-weight:900;color:#1e293b;line-height:1.35;word-break:break-word}
      .pdf-summary-warning{margin-top:10px;padding:9px 11px;border:1px solid #fde68a;border-radius:9px;background:#fffbeb;color:#92400e;font-size:10px;font-weight:750;line-height:1.55}
      .pdf-summary-actions{display:grid;grid-template-columns:1fr 1.4fr;gap:8px;padding:0 19px 18px}
      .pdf-summary-btn{min-height:40px;border-radius:10px;font:850 12px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .pdf-summary-btn.cancel{border:1px solid #cbd5e1;background:#f8fafc;color:#475569}
      .pdf-summary-btn.confirm{border:0;background:linear-gradient(135deg,#12396d,#2563eb);color:#fff}
      @media(max-width:520px){.pdf-summary-grid{grid-template-columns:1fr}.pdf-operation-panel{bottom:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureProgressPanel() {
    let panel = byId('pdfOperationPanel');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'pdfOperationPanel';
    panel.className = 'pdf-operation-panel';
    panel.setAttribute('role', 'status');
    panel.innerHTML = `
      <div class="pdf-operation-head">
        <span class="pdf-operation-title" id="pdfOperationTitle">PDF 작업 중</span>
        <span class="pdf-operation-percent" id="pdfOperationPercent">0%</span>
      </div>
      <div class="pdf-operation-track"><div class="pdf-operation-fill" id="pdfOperationFill"></div></div>
      <div class="pdf-operation-message" id="pdfOperationMessage"></div>
      <button type="button" class="pdf-operation-cancel" id="pdfOperationCancel">작업 취소</button>`;
    document.body.appendChild(panel);
    byId('pdfOperationCancel').addEventListener('click', () => {
      if (!activeOperation) return;
      activeOperation.cancelRequested = true;
      activeOperation.controller.abort();
      updateProgress({ percent: activeOperation.percent, message: '취소 요청을 처리하고 있습니다...' });
      byId('pdfOperationCancel').disabled = true;
    });
    return panel;
  }

  function ensureSummaryModal() {
    let overlay = byId('pdfSaveSummaryOverlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pdfSaveSummaryOverlay';
    overlay.className = 'pdf-summary-overlay';
    overlay.innerHTML = `
      <div class="pdf-summary-card" role="dialog" aria-modal="true" aria-labelledby="pdfSummaryTitle">
        <div class="pdf-summary-head">
          <h2 id="pdfSummaryTitle">PDF 저장 설정 확인</h2>
          <p>아래 설정으로 인쇄용 PDF를 생성합니다. 잘못된 항목이 있으면 취소 후 사이드바에서 수정하세요.</p>
        </div>
        <div class="pdf-summary-body"><div class="pdf-summary-grid" id="pdfSummaryGrid"></div><div class="pdf-summary-warning" id="pdfSummaryWarning"></div></div>
        <div class="pdf-summary-actions">
          <button type="button" class="pdf-summary-btn cancel" id="pdfSummaryCancel">돌아가기</button>
          <button type="button" class="pdf-summary-btn confirm" id="pdfSummaryConfirm">확인 후 PDF 생성</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    byId('pdfSummaryCancel').addEventListener('click', closeSummary);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) closeSummary(); });
    byId('pdfSummaryConfirm').addEventListener('click', confirmSave);
    return overlay;
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)}GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
    return `${Math.max(1, Math.round(value / 1024))}KB`;
  }

  function activeNup() {
    try { return Number(nup); } catch (_) { return Number(document.querySelector('.nup-btn.active')?.dataset.nup || 1); }
  }

  function summaryData() {
    const active = parsedPages.filter((page) => !page.excluded);
    const hidden = parsedPages.length - active.length;
    const nupValue = activeNup();
    const booklet = !!byId('bookletCheck')?.checked;
    let arranged = active;
    try {
      if (booklet && typeof bookletReorderPreview === 'function') arranged = bookletReorderPreview(active, nupValue);
    } catch (_) {}
    let outputPages = 0;
    try {
      for (const group of groupByNup(arranged)) {
        const layout = getLayout(group.n);
        outputPages += Math.ceil(group.pages.length / Math.max(1, layout.cols * layout.rows));
      }
    } catch (_) { outputPages = Math.ceil(arranged.length / Math.max(1, nupValue)); }

    let settings = { pw: 210, ph: 297 };
    try { settings = { ...settings, ...getSettings() }; } catch (_) {}
    const totalBytes = uploadedFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0);
    const pageNumber = byId('pnEnabled')?.checked
      ? `${document.querySelector('.pn-pos-btn.active')?.textContent?.trim() || '사용'} · ${byId('pnFontSize')?.value || 10}pt`
      : '사용 안 함';
    return {
      active: active.length,
      hidden,
      sourceTotal: parsedPages.length,
      nup: nupValue,
      outputPages,
      booklet,
      paper: `${settings.pw}×${settings.ph}mm ${settings.pw > settings.ph ? '가로' : '세로'}`,
      pageNumber,
      facing: !!byId('facingPages')?.checked,
      files: uploadedFiles.length,
      totalBytes,
    };
  }

  function openSummary() {
    if (!editorReady() || !parsedPages.some((page) => !page.excluded) || !uploadedFiles.length) return;
    const data = summaryData();
    const items = [
      ['원본 파일', `${data.files}개 · ${formatBytes(data.totalBytes)}`],
      ['페이지', `활성 ${data.active}쪽 · 숨김 ${data.hidden}쪽`],
      ['용지', data.paper],
      ['N-up 배치', `${data.nup}장 · 출력 예상 ${data.outputPages}쪽`],
      ['소책자', data.booklet ? '사용 · 페이지 순서 자동 재배치' : '사용 안 함'],
      ['양면 마주보기', data.facing ? '사용 · 짝수면 좌우 반전' : '사용 안 함'],
      ['페이지 번호', data.pageNumber],
      ['출력 품질', '원본 벡터·텍스트 품질 유지'],
    ];
    byId('pdfSummaryGrid').innerHTML = '';
    items.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'pdf-summary-item';
      const strong = document.createElement('strong');
      strong.textContent = label;
      const span = document.createElement('span');
      span.textContent = value;
      item.append(strong, span);
      byId('pdfSummaryGrid').appendChild(item);
    });
    const warnings = [];
    if (data.booklet) warnings.push('소책자 출력은 양면 인쇄 후 절단·접기 순서와 프린터의 넘김 방향을 확인해야 합니다.');
    if (data.outputPages > 100 || data.totalBytes > 150 * 1024 * 1024) warnings.push('대용량 작업은 서버 생성에 수 분이 걸릴 수 있습니다.');
    if (!warnings.length) warnings.push('설정이 맞으면 PDF 생성을 누르세요. 생성 중에도 취소할 수 있습니다.');
    byId('pdfSummaryWarning').textContent = warnings.join(' ');
    ensureSummaryModal().classList.add('open');
  }

  function closeSummary() {
    byId('pdfSaveSummaryOverlay')?.classList.remove('open');
  }

  function beginOperation(type, controller, title) {
    if (activeOperation) activeOperation.controller.abort();
    activeOperation = {
      type,
      controller: controller || new AbortController(),
      percent: 0,
      cancelRequested: false,
      startedAt: Date.now(),
    };
    ensureProgressPanel().classList.add('open');
    byId('pdfOperationTitle').textContent = title || (type === 'save' ? 'PDF 생성 중' : '미리보기 생성 중');
    byId('pdfOperationCancel').disabled = false;
    updateProgress({ percent: 0, message: '작업을 준비하고 있습니다...' });
    return activeOperation;
  }

  function updateProgress(progress = {}) {
    if (!activeOperation) return;
    const percent = Number.isFinite(Number(progress.percent)) ? Math.max(0, Math.min(100, Number(progress.percent))) : activeOperation.percent;
    activeOperation.percent = percent;
    byId('pdfOperationFill').style.width = `${percent}%`;
    byId('pdfOperationPercent').textContent = `${Math.round(percent)}%`;
    if (progress.message) byId('pdfOperationMessage').textContent = progress.message;
  }

  function finishOperation(result, message) {
    if (!activeOperation) return;
    const canceled = result === 'canceled' || activeOperation.cancelRequested;
    updateProgress({ percent: result === 'success' ? 100 : activeOperation.percent, message: message || (canceled ? '작업이 취소되었습니다.' : result === 'success' ? '작업이 완료되었습니다.' : '작업을 완료하지 못했습니다.') });
    const panel = byId('pdfOperationPanel');
    const delay = canceled || result === 'error' ? 1400 : 700;
    setTimeout(() => panel?.classList.remove('open'), delay);
    activeOperation = null;
  }

  function apiOptions() {
    if (!activeOperation || activeOperation.type !== 'save') return null;
    return {
      signal: activeOperation.controller.signal,
      onProgress: updateProgress,
      onStatus: message => updateProgress({ message }),
    };
  }

  function confirmSave() {
    closeSummary();
    const button = byId('downloadBtn');
    if (!button || button.disabled) return;
    beginOperation('save', new AbortController(), 'PDF 생성 중');
    downloadBypass = true;
    button.click();
  }

  function installDownloadGuard() {
    const button = byId('downloadBtn');
    if (!button || button.dataset.summaryGuardV1) return false;
    button.dataset.summaryGuardV1 = '1';
    button.addEventListener('click', (event) => {
      if (downloadBypass) {
        downloadBypass = false;
        return;
      }
      if (button.disabled) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openSummary();
    }, true);
    return true;
  }

  function previewOutputCount(pages) {
    let total = 0;
    for (const group of groupByNup(pages)) {
      const { cols, rows } = getLayout(group.n);
      total += Math.ceil(group.pages.length / Math.max(1, cols * rows));
    }
    return total;
  }

  function patchBuildAllPages() {
    if (previewBuildPatched) return true;
    if (typeof buildAllPages !== 'function') return false;
    const wrapped = async function buildAllPagesWithProgress(mm2px, useHi, overridePages = null) {
      const active = overridePages || parsedPages.filter((page) => !page.excluded);
      const groups = groupByNup(active);
      const total = previewOutputCount(active);
      const shouldShow = !!window.__pdfEditorManualPreviewRequest || total >= 30;
      const operation = shouldShow ? beginOperation('preview', new AbortController(), '미리보기 생성 중') : null;
      const signal = operation?.controller.signal;
      const output = [];
      try {
        for (const group of groups) {
          const { cols, rows } = getLayout(group.n);
          const perPage = cols * rows;
          const pageCount = Math.ceil(group.pages.length / perPage);
          for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            if (signal?.aborted) throw abortError();
            output.push(buildOutputPage(group.pages, pageIndex, cols, rows, mm2px, useHi, output.length));
            if (operation) updateProgress({ percent: 8 + (output.length / Math.max(1, total)) * 72, message: `미리보기 페이지 구성 중... (${output.length}/${total})` });
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }
        for (let index = 0; index < output.length; index += 1) {
          if (signal?.aborted) throw abortError();
          try { applyDocEdits(output[index], index, output.length, mm2px); }
          catch (error) { console.warn('[pdf-operation] overlay failed', index, error); }
          if (operation) updateProgress({ percent: 82 + ((index + 1) / Math.max(1, output.length)) * 12, message: '페이지 번호와 문서 요소 적용 중...' });
        }
        if (operation) updateProgress({ percent: 95, message: '미리보기 화면에 배치 중...' });
        return output;
      } catch (error) {
        if (operation) finishOperation(error?.name === 'AbortError' ? 'canceled' : 'error', error?.message);
        throw error;
      }
    };
    wrapped.__operationUiPatchedV1 = true;
    buildAllPages = wrapped;
    window.buildAllPages = wrapped;
    previewBuildPatched = true;
    return true;
  }

  function patchDisplayPreview() {
    if (displayPatched) return true;
    if (typeof displayPreview !== 'function') return false;
    if (displayPreview.__operationUiPatchedV1) {
      displayPatched = true;
      return true;
    }
    const original = displayPreview;
    const wrapped = function displayPreviewWithOperationFinish() {
      const result = original.apply(this, arguments);
      if (activeOperation?.type === 'preview') finishOperation('success', '미리보기가 완료되었습니다.');
      return result;
    };
    wrapped.__operationUiPatchedV1 = true;
    displayPreview = wrapped;
    window.displayPreview = wrapped;
    displayPatched = true;
    return true;
  }

  function patchPreviewError() {
    if (errorPatched) return true;
    if (typeof showPreviewError !== 'function') return false;
    const original = showPreviewError;
    const wrapped = function showPreviewErrorWithoutCancelNoise(stage, error) {
      if (error?.name === 'AbortError') {
        if (activeOperation?.type === 'preview') finishOperation('canceled', '미리보기 생성이 취소되었습니다.');
        try {
          if (typeof showStatus === 'function') {
            showStatus('미리보기 생성이 취소되었습니다.', 'info');
            setTimeout(() => { try { hideStatus(); } catch (_) {} }, 1500);
          }
        } catch (_) {}
        return;
      }
      if (activeOperation?.type === 'preview') finishOperation('error', error?.message);
      return original.apply(this, arguments);
    };
    wrapped.__operationUiPatchedV1 = true;
    showPreviewError = wrapped;
    window.showPreviewError = wrapped;
    errorPatched = true;
    return true;
  }

  function boot() {
    installStyles();
    ensureProgressPanel();
    ensureSummaryModal();
    const ready = editorReady();
    const downloadReady = installDownloadGuard();
    const buildReady = ready && patchBuildAllPages();
    const displayReady = ready && patchDisplayPreview();
    const errorReady = ready && patchPreviewError();
    if ((!ready || !downloadReady || !buildReady || !displayReady || !errorReady) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 170 + attempts * 60);
    }
  }

  window.PdfOperationManager = {
    beginOperation,
    updateProgress,
    finishOperation,
    apiOptions,
    openSummary,
    cancel: () => activeOperation?.controller.abort(),
    active: () => activeOperation,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
