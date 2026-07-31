// PDF save summary and API-backed progress display. Cancellation is integrated in the next stage.
(function () {
  'use strict';
  if (window.__pdfSaveOperationV2) return;
  window.__pdfSaveOperationV2 = true;

  const $ = (id) => document.getElementById(id);
  let bypassNextDownload = false;
  let attempts = 0;
  let previousFocus = null;
  let activeOperation = null;
  let operationSequence = 0;

  function editorReady() {
    try {
      return Array.isArray(parsedPages)
        && Array.isArray(uploadedFiles)
        && typeof groupByNup === 'function'
        && typeof getLayout === 'function'
        && typeof getSettings === 'function';
    } catch (_) {
      return false;
    }
  }

  function formatBytes(bytes) {
    const value = Math.max(0, Number(bytes || 0));
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)}GB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)}MB`;
    return `${Math.max(1, Math.round(value / 1024))}KB`;
  }

  function activeNup() {
    try { return Number(nup || 1); }
    catch (_) { return Number(document.querySelector('.nup-btn.active')?.dataset?.nup || 1); }
  }

  function outputPageCount(pages) {
    let total = 0;
    try {
      for (const group of groupByNup(pages)) {
        const layout = getLayout(group.n);
        total += Math.ceil(group.pages.length / Math.max(1, layout.cols * layout.rows));
      }
    } catch (_) {
      total = Math.ceil(pages.length / Math.max(1, activeNup()));
    }
    return total;
  }

  function printMarkSettings() {
    try { return window.PdfPrintMarks?.settings?.() || { enabled: false, bleed_mm: 0 }; }
    catch (_) { return { enabled: false, bleed_mm: 0 }; }
  }

  function marginSettings() {
    try {
      return window.PdfEditorLayoutExport?.marginValues?.() || {
        left: Number($('marginLeft')?.value || $('marginH')?.value || 10),
        right: Number($('marginRight')?.value || $('marginH')?.value || 10),
        top: Number($('marginTop')?.value || $('marginV')?.value || 10),
        bottom: Number($('marginBottom')?.value || $('marginV')?.value || 10),
      };
    } catch (_) {
      return { left: 10, right: 10, top: 10, bottom: 10 };
    }
  }

  function summaryData() {
    const active = parsedPages.filter((page) => !page.excluded);
    const nupValue = activeNup();
    const booklet = !!$('bookletCheck')?.checked;
    let arranged = active;
    try {
      if (booklet && typeof bookletReorderPreview === 'function') {
        arranged = bookletReorderPreview(active, nupValue) || active;
      }
    } catch (_) {}

    let paper = { pw: 210, ph: 297 };
    try { paper = { ...paper, ...getSettings() }; } catch (_) {}
    const marks = printMarkSettings();
    const margins = marginSettings();
    const pageNumberEnabled = (() => {
      try { return !!pnEnabled; }
      catch (_) { return !!$('pnEnabled')?.checked; }
    })();
    const pageNumberPosition = document.querySelector('.pn-pos-btn.active')?.textContent?.trim() || '설정 위치';
    const totalBytes = uploadedFiles.reduce((sum, file) => sum + Number(file?.size || 0), 0);

    return {
      files: uploadedFiles.length,
      totalBytes,
      sourcePages: parsedPages.length,
      activePages: active.length,
      hiddenPages: parsedPages.length - active.length,
      outputPages: outputPageCount(arranged),
      nup: nupValue,
      booklet,
      paper: `${paper.pw}×${paper.ph}mm ${paper.pw > paper.ph ? '가로' : '세로'}`,
      margins,
      facing: !!$('facingPages')?.checked,
      pageNumber: pageNumberEnabled
        ? `${pageNumberPosition} · ${$('pnFontSize')?.value || 10}pt · 공간 자동 확보 ${$('pnAutoReserve')?.checked === false ? '끔' : '켬'}`
        : '사용 안 함',
      headerFooter: $('hfEnabled')?.checked ? '사용' : '사용 안 함',
      watermark: $('wmEnabled')?.checked ? '사용' : '사용 안 함',
      cropMarks: !!marks.enabled,
      bleedMm: Math.max(0, Number(marks.bleed_mm || 0)),
    };
  }

  function installStyles() {
    if ($('pdfSaveOperationStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'pdfSaveOperationStylesV2';
    style.textContent = `
      .pdf-save-summary-overlay{position:fixed;inset:0;z-index:1550;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.54)}
      .pdf-save-summary-overlay.open{display:flex}
      .pdf-save-summary-card{width:min(560px,100%);max-height:min(760px,92vh);overflow:auto;border-radius:16px;background:#fff;box-shadow:0 24px 80px rgba(15,23,42,.36)}
      .pdf-save-summary-head{padding:17px 19px 13px;border-bottom:1px solid #e5e7eb}
      .pdf-save-summary-head h2{margin:0;color:#0f172a;font-size:16px;font-weight:900}
      .pdf-save-summary-head p{margin:5px 0 0;color:#64748b;font-size:10px;font-weight:650;line-height:1.55}
      .pdf-save-summary-body{padding:15px 19px}
      .pdf-save-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .pdf-save-summary-item{padding:9px 10px;border:1px solid #e2e8f0;border-radius:9px;background:#f8fafc}
      .pdf-save-summary-item strong{display:block;margin-bottom:3px;color:#64748b;font-size:9px;font-weight:850}
      .pdf-save-summary-item span{display:block;color:#1e293b;font-size:12px;font-weight:900;line-height:1.4;word-break:keep-all}
      .pdf-save-summary-warning{margin-top:10px;padding:9px 11px;border:1px solid #fde68a;border-radius:9px;background:#fffbeb;color:#92400e;font-size:10px;font-weight:750;line-height:1.6}
      .pdf-save-summary-actions{display:grid;grid-template-columns:1fr 1.45fr;gap:8px;padding:0 19px 18px}
      .pdf-save-summary-button{min-height:40px;border-radius:10px;font:850 12px Pretendard,"Noto Sans KR",sans-serif;cursor:pointer}
      .pdf-save-summary-button.cancel{border:1px solid #cbd5e1;background:#f8fafc;color:#475569}
      .pdf-save-summary-button.confirm{border:0;background:linear-gradient(135deg,#12396d,#2563eb);color:#fff}
      .pdf-save-progress-panel{position:fixed;left:50%;bottom:22px;z-index:1600;display:none;width:min(460px,calc(100vw - 28px));padding:13px 14px;transform:translateX(-50%);border:1px solid #cbd5e1;border-radius:13px;background:rgba(255,255,255,.985);box-shadow:0 18px 50px rgba(15,23,42,.24)}
      .pdf-save-progress-panel.open{display:block}
      .pdf-save-progress-head{display:flex;align-items:center;gap:10px;margin-bottom:9px}
      .pdf-save-progress-title{flex:1;color:#0f172a;font-size:12px;font-weight:900}
      .pdf-save-progress-percent{min-width:38px;color:#2563eb;font-size:11px;font-weight:900;text-align:right}
      .pdf-save-progress-track{height:7px;overflow:hidden;border-radius:999px;background:#e2e8f0}
      .pdf-save-progress-fill{height:100%;width:0;background:linear-gradient(90deg,#12396d,#2563eb,#1d9bb2);transition:width .18s ease}
      .pdf-save-progress-message{min-height:15px;margin-top:7px;color:#64748b;font-size:10px;font-weight:700;line-height:1.45}
      .pdf-save-progress-panel.success .pdf-save-progress-percent{color:#047857}
      .pdf-save-progress-panel.error .pdf-save-progress-percent{color:#b91c1c}
      @media(max-width:520px){.pdf-save-summary-grid{grid-template-columns:1fr}.pdf-save-summary-actions{grid-template-columns:1fr}.pdf-save-progress-panel{bottom:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    let overlay = $('pdfSaveSummaryOverlayV1');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'pdfSaveSummaryOverlayV1';
    overlay.className = 'pdf-save-summary-overlay';
    overlay.innerHTML = `
      <div class="pdf-save-summary-card" role="dialog" aria-modal="true" aria-labelledby="pdfSaveSummaryTitleV1">
        <div class="pdf-save-summary-head">
          <h2 id="pdfSaveSummaryTitleV1">PDF 저장 설정 최종 확인</h2>
          <p>아래 설정으로 PDF를 생성합니다. 수정할 내용이 있으면 돌아가기를 누르세요.</p>
        </div>
        <div class="pdf-save-summary-body">
          <div class="pdf-save-summary-grid" id="pdfSaveSummaryGridV1"></div>
          <div class="pdf-save-summary-warning" id="pdfSaveSummaryWarningV1"></div>
        </div>
        <div class="pdf-save-summary-actions">
          <button type="button" class="pdf-save-summary-button cancel" id="pdfSaveSummaryCancelV1">돌아가기</button>
          <button type="button" class="pdf-save-summary-button confirm" id="pdfSaveSummaryConfirmV1">확인 후 PDF 생성</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    $('pdfSaveSummaryCancelV1').addEventListener('click', closeSummary);
    $('pdfSaveSummaryConfirmV1').addEventListener('click', confirmSave);
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeSummary();
    });
    return overlay;
  }

  function ensureProgressPanel() {
    let panel = $('pdfSaveProgressPanelV2');
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = 'pdfSaveProgressPanelV2';
    panel.className = 'pdf-save-progress-panel';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.innerHTML = `
      <div class="pdf-save-progress-head">
        <span class="pdf-save-progress-title" id="pdfSaveProgressTitleV2">PDF 생성 중</span>
        <span class="pdf-save-progress-percent" id="pdfSaveProgressPercentV2">0%</span>
      </div>
      <div class="pdf-save-progress-track"><div class="pdf-save-progress-fill" id="pdfSaveProgressFillV2"></div></div>
      <div class="pdf-save-progress-message" id="pdfSaveProgressMessageV2">저장 작업을 준비하고 있습니다...</div>`;
    document.body.appendChild(panel);
    return panel;
  }

  function renderSummary(data) {
    const items = [
      ['원본 파일', `${data.files}개 · ${formatBytes(data.totalBytes)}`],
      ['페이지', `활성 ${data.activePages}쪽 · 숨김 ${data.hiddenPages}쪽`],
      ['출력 예상', `${data.outputPages}쪽 · 기본 ${data.nup}장/면`],
      ['용지', data.paper],
      ['개별 여백', `좌 ${data.margins.left} · 우 ${data.margins.right} · 상 ${data.margins.top} · 하 ${data.margins.bottom}mm`],
      ['양면 마주보기', data.facing ? '사용 · 짝수면 좌우 교환' : '사용 안 함'],
      ['소책자', data.booklet ? '사용 · 출력 순서 재배치' : '사용 안 함'],
      ['페이지 번호', data.pageNumber],
      ['머리말·꼬리말', data.headerFooter],
      ['워터마크', data.watermark],
      ['재단선', data.cropMarks ? '사용' : '사용 안 함'],
      ['도련 작업영역', data.cropMarks ? `${data.bleedMm}mm` : '재단선 사용 시 설정'],
    ];
    const grid = $('pdfSaveSummaryGridV1');
    grid.replaceChildren();
    items.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'pdf-save-summary-item';
      const title = document.createElement('strong');
      title.textContent = label;
      const copy = document.createElement('span');
      copy.textContent = value;
      item.append(title, copy);
      grid.appendChild(item);
    });

    const warnings = [];
    if (data.booklet) warnings.push('소책자는 프린터 양면 넘김 방향과 첫 용지 시험 출력을 확인하세요.');
    if (data.cropMarks && data.bleedMm > 0) warnings.push('도련 영역은 원본 그림을 자동 확대하지 않으므로 원본에 도련 이미지가 없으면 바깥쪽이 흰색일 수 있습니다.');
    if (data.outputPages > 100 || data.totalBytes > 150 * 1024 * 1024) warnings.push('대용량 작업은 생성 시간이 길어질 수 있습니다. 진행 상태는 저장 패널에서 확인할 수 있습니다.');
    if (!warnings.length) warnings.push('설정이 맞으면 PDF 생성을 누르세요. 생성 단계가 화면에 표시됩니다.');
    $('pdfSaveSummaryWarningV1').textContent = warnings.join(' ');
  }

  function openSummary() {
    if (activeOperation) {
      ensureProgressPanel().focus?.();
      return false;
    }
    if (!editorReady() || !uploadedFiles.length || !parsedPages.length) return false;
    if (!parsedPages.some((page) => !page.excluded)) return false;
    previousFocus = document.activeElement;
    renderSummary(summaryData());
    ensureModal().classList.add('open');
    $('pdfSaveSummaryConfirmV1')?.focus();
    return true;
  }

  function closeSummary() {
    $('pdfSaveSummaryOverlayV1')?.classList.remove('open');
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
  }

  function updateProgress(progress = {}) {
    if (!activeOperation) return;
    const next = Number(progress.percent);
    const percent = Number.isFinite(next)
      ? Math.max(activeOperation.percent, Math.max(0, Math.min(100, next)))
      : activeOperation.percent;
    activeOperation.percent = percent;
    $('pdfSaveProgressFillV2').style.width = `${percent}%`;
    $('pdfSaveProgressPercentV2').textContent = `${Math.round(percent)}%`;
    if (progress.message) $('pdfSaveProgressMessageV2').textContent = progress.message;
  }

  function monitorDownloadButton(sequence, attempt = 0) {
    if (!activeOperation || activeOperation.sequence !== sequence) return;
    const button = $('downloadBtn');
    if (attempt > 0 && button && !button.disabled) {
      finishOperation(
        activeOperation.percent >= 100 ? 'success' : 'error',
        activeOperation.percent >= 100
          ? 'PDF 생성이 완료되었습니다.'
          : 'PDF 생성을 완료하지 못했습니다. 화면의 오류 메시지를 확인하세요.',
      );
      return;
    }
    if (attempt >= 620) {
      finishOperation('error', '저장 작업 상태를 확인하지 못했습니다. 다시 시도하세요.');
      return;
    }
    setTimeout(() => monitorDownloadButton(sequence, attempt + 1), 500);
  }

  function beginSaveOperation() {
    if (activeOperation) return false;
    const panel = ensureProgressPanel();
    panel.classList.remove('success', 'error');
    panel.classList.add('open');
    operationSequence += 1;
    activeOperation = {
      type: 'save',
      sequence: operationSequence,
      percent: 0,
      startedAt: Date.now(),
    };
    $('pdfSaveProgressTitleV2').textContent = 'PDF 생성 중';
    $('pdfSaveProgressFillV2').style.width = '0%';
    $('pdfSaveProgressPercentV2').textContent = '0%';
    $('pdfSaveProgressMessageV2').textContent = '저장 작업을 준비하고 있습니다...';
    setTimeout(() => monitorDownloadButton(activeOperation?.sequence || 0), 250);
    return true;
  }

  function finishOperation(result, message) {
    if (!activeOperation) return;
    const panel = ensureProgressPanel();
    const success = result === 'success';
    const canceled = result === 'canceled';
    if (success) updateProgress({ percent: 100, message: message || 'PDF 생성이 완료되었습니다.' });
    else updateProgress({ message: message || (canceled ? '작업이 중단되었습니다.' : 'PDF 생성에 실패했습니다.') });
    panel.classList.toggle('success', success);
    panel.classList.toggle('error', !success);
    $('pdfSaveProgressTitleV2').textContent = success ? 'PDF 생성 완료' : canceled ? 'PDF 작업 중단' : 'PDF 생성 실패';
    const hideDelay = success ? 900 : 2200;
    activeOperation = null;
    setTimeout(() => panel.classList.remove('open', 'success', 'error'), hideDelay);
  }

  function apiOptions() {
    if (!activeOperation || activeOperation.type !== 'save') return null;
    return {
      onProgress: updateProgress,
      onStatus: (message) => updateProgress({ message }),
    };
  }

  function confirmSave() {
    const button = $('downloadBtn');
    if (!button || button.disabled || !beginSaveOperation()) return;
    closeSummary();
    bypassNextDownload = true;
    button.click();
  }

  function installDownloadGuard() {
    const button = $('downloadBtn');
    if (!button || button.dataset.saveSummaryGuardV2) return !!button;
    button.dataset.saveSummaryGuardV2 = '1';
    button.addEventListener('click', (event) => {
      if (bypassNextDownload) {
        bypassNextDownload = false;
        return;
      }
      if (button.disabled || activeOperation) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      openSummary();
    }, true);
    return true;
  }

  function boot() {
    installStyles();
    ensureModal();
    ensureProgressPanel();
    const ready = editorReady();
    const guardReady = installDownloadGuard();
    if ((!ready || !guardReady) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 170 + attempts * 60);
    }
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && $('pdfSaveSummaryOverlayV1')?.classList.contains('open')) closeSummary();
  });

  window.PdfSaveOperation = {
    openSummary,
    closeSummary,
    summaryData,
    active: () => activeOperation,
    stage: 'summary-progress',
  };
  window.PdfOperationManager = {
    apiOptions,
    updateProgress,
    finishOperation,
    active: () => activeOperation,
    stage: 'progress-only',
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
