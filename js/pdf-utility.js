// PDF Utility: batch preflight, merge, background cleanup, compression and repair.
(function () {
  'use strict';
  if (window.__pdfUtilityV1) return;
  window.__pdfUtilityV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(
    path === '/pdf-preflight' ||
    path.endsWith('/pdf-preflight/index.html') ||
    path.endsWith('/tools/pdf-Checker.html') ||
    path.endsWith('/tools/preflight.html')
  )) return;

  const MAX_FILES = 10;
  const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const INSTALL_DELAYS = [0, 150, 350, 700, 1200, 2000];
  const state = {
    files: [],
    activeIndex: 0,
    reports: new Map(),
    errors: new Map(),
    busy: false,
    installed: false,
    dragIndex: null,
  };

  const $ = (id) => document.getElementById(id);
  const fileKey = (file) => `${file.name}|${file.size}|${file.lastModified}`;
  const mb = (bytes) => `${(Number(bytes || 0) / 1024 / 1024).toFixed(1)}MB`;
  const totalBytes = () => state.files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const activeFile = () => state.files[state.activeIndex] || null;

  function safeText(value) {
    return String(value == null ? '' : value).replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
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

  function showError(message) {
    if (typeof window.showError === 'function') window.showError(message);
    else alert(message);
  }

  function showStatus(message, type = 'info') {
    if (typeof window.showCheckStatus === 'function') window.showCheckStatus(message, type);
  }

  function setProgress(percent, icon, message) {
    const box = $('progressBox');
    if (box) box.style.display = 'block';
    if (typeof window.setProgress === 'function') {
      window.setProgress(Math.max(0, Math.min(100, Math.round(percent))), icon, message);
    }
  }

  function stopProgressSoon() {
    setTimeout(() => {
      if (!state.busy && typeof window.stopProgress === 'function') window.stopProgress();
    }, 900);
  }

  function installStyles() {
    if ($('pdfUtilityStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityStyles';
    style.textContent = `
      .pdfu-file-list{margin-top:12px;border:1px solid #dbe5ee;border-radius:14px;background:#fff;overflow:hidden}
      .pdfu-file-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#f8fbfd;border-bottom:1px solid #e2e8f0;font-size:11px;font-weight:900;color:#475569}
      .pdfu-file-head strong{color:#12396d}.pdfu-file-items{max-height:310px;overflow:auto}
      .pdfu-file-row{display:grid;grid-template-columns:28px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 11px;border-bottom:1px solid #edf2f7;cursor:pointer;background:#fff}
      .pdfu-file-row:last-child{border-bottom:0}.pdfu-file-row:hover{background:#f8fcff}.pdfu-file-row.active{background:#ecfeff;box-shadow:inset 3px 0 #1d9bb2}.pdfu-file-row.dragging{opacity:.45}
      .pdfu-index{width:25px;height:25px;border-radius:8px;background:#eef4f8;display:grid;place-items:center;font-size:10px;font-weight:950;color:#12396d}
      .pdfu-file-name{font-size:11px;font-weight:900;color:#172033;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pdfu-file-meta{font-size:9px;color:#64748b;margin-top:3px;display:flex;gap:7px;flex-wrap:wrap}
      .pdfu-file-status.pass{color:#15803d}.pdfu-file-status.warn{color:#a16207}.pdfu-file-status.fail{color:#dc2626}.pdfu-file-status.pending{color:#64748b}
      .pdfu-row-actions{display:flex;align-items:center;gap:4px}.pdfu-row-btn{width:27px;height:27px;border:1px solid #dbe5ee;background:#f8fafc;border-radius:7px;cursor:pointer;font-size:11px;font-weight:900;color:#475569}.pdfu-row-btn:hover:not(:disabled){background:#eef6fa;border-color:#9ccbd5}.pdfu-row-btn:disabled{opacity:.35;cursor:not-allowed}
      .pdfu-limit-note{font-size:9px;color:#64748b;line-height:1.5;margin-top:8px;padding:8px 10px;border-radius:9px;background:#f8fafc;border:1px solid #e2e8f0}
      .pdfu-batch-results{display:none;margin-top:20px}.pdfu-batch-results.show{display:block}.pdfu-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border:1px solid #dbe5ee;border-radius:16px;padding:16px 18px;margin-bottom:11px}.pdfu-summary strong{font-size:15px}.pdfu-summary span{font-size:11px;color:#64748b;font-weight:800}
      .pdfu-result-list{display:grid;gap:8px}.pdfu-result-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:12px 14px}.pdfu-result-name{font-size:12px;font-weight:900}.pdfu-result-meta{font-size:10px;color:#64748b;margin-top:4px}.pdfu-result-score{font-weight:950}.pdfu-detail-btn{border:1px solid #bae6fd;background:#ecfeff;color:#0e7490;border-radius:8px;padding:7px 9px;font-size:10px;font-weight:900;cursor:pointer}.pdfu-detail-btn:hover{background:#cffafe}
      .pdfu-modal-overlay{display:none;position:fixed;inset:0;z-index:1200;background:rgba(15,23,42,.58);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}.pdfu-modal-overlay.open{display:flex}.pdfu-modal{width:min(500px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:23px;box-shadow:0 28px 80px rgba(0,0,0,.3)}
      .pdfu-modal-head{display:flex;gap:10px;align-items:center;margin-bottom:10px}.pdfu-modal-title{flex:1;font-size:19px;font-weight:950}.pdfu-modal-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f5f9;cursor:pointer;font-size:20px}.pdfu-modal-desc{font-size:12px;color:#64748b;line-height:1.55;margin-bottom:14px}.pdfu-choice{display:flex;align-items:flex-start;gap:9px;border:1px solid #e2e8f0;border-radius:11px;padding:11px;margin-bottom:8px;cursor:pointer}.pdfu-choice:has(input:checked){border-color:#67c7d8;background:#ecfeff}.pdfu-choice input{margin-top:2px;accent-color:#12396d}.pdfu-choice strong{display:block;font-size:12px}.pdfu-choice small{display:block;font-size:10px;color:#64748b;line-height:1.45;margin-top:3px}.pdfu-warning{margin-top:12px;border:1px solid #fed7aa;background:#fff7ed;color:#9a3412;border-radius:10px;padding:10px 11px;font-size:10px;line-height:1.55;font-weight:750}.pdfu-modal-footer{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.pdfu-modal-btn{border-radius:10px;padding:10px 16px;font-size:11px;font-weight:900;cursor:pointer}.pdfu-modal-btn.cancel{border:1px solid #dbe5ee;background:#f8fafc;color:#475569}.pdfu-modal-btn.run{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}.pdfu-modal-btn:disabled,.pdfu-modal-close:disabled{opacity:.45;cursor:not-allowed}
      .action-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}.pdfu-action .action-chip{white-space:nowrap}
      @media(max-width:820px){.action-grid{grid-template-columns:1fr!important}.pdfu-file-row{grid-template-columns:26px minmax(0,1fr)}.pdfu-row-actions{grid-column:2;justify-content:flex-end}.pdfu-summary{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function updateBranding() {
    document.title = 'PDF유틸리티 · Program Studio';
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = '최대 10개 PDF 일괄 검수, PDF 합치기, 배경색 제거, 용량 줄이기, 복구와 암호 기능을 제공하는 PDF유틸리티입니다.';
    const navTitle = document.querySelector('.nav-title');
    if (navTitle) navTitle.textContent = 'PDF유틸리티';
    const badge = document.querySelector('.hero-badge');
    if (badge) badge.textContent = '📄 PDF UTILITY';
    const heroTitle = document.querySelector('.hero h1');
    if (heroTitle) heroTitle.textContent = 'PDF유틸리티';
    const heroText = document.querySelector('.hero p');
    if (heroText) heroText.textContent = '여러 PDF를 한 번에 검사하고, 합치기·배경색 제거·용량 줄이기·복구·암호 작업까지 한 곳에서 처리하세요.';
    const steps = document.querySelector('.hero-steps');
    if (steps) steps.innerHTML = '<span class="hero-step">1. PDF 최대 10개 추가</span><span class="hero-step">2. 검수·합치기·정리</span><span class="hero-step">3. 결과 확인·다운로드</span>';
    const uploadTitle = document.querySelector('.upload-title');
    if (uploadTitle) uploadTitle.textContent = 'PDF 파일을 최대 10개까지 올려주세요';
    const uploadSub = document.querySelector('.upload-sub');
    if (uploadSub) uploadSub.innerHTML = '클릭하거나 여러 PDF를 끌어다 놓으세요.<br>최대 10개 · 전체 합계 200MB · PDF 형식만 지원';
    const firstPanelTitle = document.querySelector('.workspace>.panel:first-child .panel-title');
    if (firstPanelTitle) firstPanelTitle.textContent = 'PDF 파일 선택';
    const firstPanelDesc = document.querySelector('.workspace>.panel:first-child .panel-desc');
    if (firstPanelDesc) firstPanelDesc.textContent = '여러 파일을 등록한 뒤 순서를 바꾸거나 하나를 선택해 개별 작업을 할 수 있습니다.';
    const workDesc = document.querySelector('.workspace>.panel:nth-child(2) .panel-desc');
    if (workDesc) workDesc.textContent = '일괄 작업은 모든 파일에, 개별 작업은 현재 선택한 파일에 적용됩니다.';
  }

  function makeFileList() {
    if ($('pdfUtilityFileList')) return;
    const zone = $('uploadZone');
    if (!zone) return;
    const list = document.createElement('div');
    list.id = 'pdfUtilityFileList';
    list.className = 'pdfu-file-list';
    list.innerHTML = '<div class="pdfu-file-head"><span>등록 파일</span><strong id="pdfUtilityFileSummary">0 / 10</strong></div><div class="pdfu-file-items" id="pdfUtilityFileItems"></div>';
    zone.insertAdjacentElement('afterend', list);
    const note = document.createElement('div');
    note.className = 'pdfu-limit-note';
    note.textContent = '일괄 검수와 합치기는 최대 10개, 전체 합계 200MB까지 지원합니다. 행을 드래그하거나 ↑↓ 버튼으로 합치기 순서를 바꿀 수 있습니다. 암호·복구·배경 제거·용량 줄이기는 선택된 한 파일에 적용됩니다.';
    list.insertAdjacentElement('afterend', note);
  }

  function reportSummary(file) {
    const key = fileKey(file);
    const error = state.errors.get(key);
    if (error) return { cls: 'fail', text: '검사 실패' };
    const report = state.reports.get(key);
    if (!report) return { cls: 'pending', text: '미검사' };
    const checks = Array.isArray(report.checks) ? report.checks : [];
    const fails = checks.filter((check) => check.severity === 'fail').length;
    const warns = checks.filter((check) => check.severity === 'warning').length;
    if (fails) return { cls: 'fail', text: `불량 ${fails}` };
    if (warns) return { cls: 'warn', text: `경고 ${warns}` };
    return { cls: 'pass', text: '정상' };
  }

  function renderFileList() {
    const items = $('pdfUtilityFileItems');
    const summary = $('pdfUtilityFileSummary');
    if (!items || !summary) return;
    summary.textContent = `${state.files.length} / ${MAX_FILES} · ${mb(totalBytes())} / 200MB`;
    items.innerHTML = '';
    state.files.forEach((file, index) => {
      const report = state.reports.get(fileKey(file));
      const status = reportSummary(file);
      const row = document.createElement('div');
      row.className = `pdfu-file-row${index === state.activeIndex ? ' active' : ''}`;
      row.draggable = !state.busy;
      row.dataset.index = String(index);
      row.innerHTML = `
        <div class="pdfu-index">${index + 1}</div>
        <div><div class="pdfu-file-name" title="${safeText(file.name)}">${safeText(file.name)}</div><div class="pdfu-file-meta"><span>${mb(file.size)}</span><span>${report ? `${Number(report.page_count || 0)}페이지` : '페이지 수 미확인'}</span><span class="pdfu-file-status ${status.cls}">${status.text}</span></div></div>
        <div class="pdfu-row-actions"><button type="button" class="pdfu-row-btn" data-act="up" title="위로" ${index === 0 || state.busy ? 'disabled' : ''}>↑</button><button type="button" class="pdfu-row-btn" data-act="down" title="아래로" ${index === state.files.length - 1 || state.busy ? 'disabled' : ''}>↓</button><button type="button" class="pdfu-row-btn" data-act="remove" title="삭제" ${state.busy ? 'disabled' : ''}>×</button></div>`;
      row.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        selectActive(index);
      });
      row.querySelectorAll('button').forEach((button) => button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.act;
        if (action === 'up') moveFile(index, index - 1);
        if (action === 'down') moveFile(index, index + 1);
        if (action === 'remove') removeFile(index);
      }));
      row.addEventListener('dragstart', () => {
        state.dragIndex = index;
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => {
        state.dragIndex = null;
        row.classList.remove('dragging');
      });
      row.addEventListener('dragover', (event) => event.preventDefault());
      row.addEventListener('drop', (event) => {
        event.preventDefault();
        if (state.dragIndex == null || state.dragIndex === index) return;
        moveFile(state.dragIndex, index);
      });
      items.appendChild(row);
    });
    const filename = $('uploadFilename');
    if (filename) {
      filename.style.display = state.files.length ? 'block' : 'none';
      filename.textContent = state.files.length
        ? `✓ ${state.files.length}개 선택 · 전체 ${mb(totalBytes())}`
        : '';
    }
    $('uploadZone')?.classList.toggle('has-file', state.files.length > 0);
    syncUtilityButtons();
  }

  function setLegacyActive(file) {
    if (!file || typeof window.selectFile !== 'function') return;
    window.selectFile(file);
  }

  function selectActive(index) {
    if (!state.files.length) return;
    state.activeIndex = Math.max(0, Math.min(state.files.length - 1, Number(index) || 0));
    setLegacyActive(activeFile());
    renderFileList();
  }

  function moveFile(from, to) {
    if (state.busy || from < 0 || to < 0 || from >= state.files.length || to >= state.files.length) return;
    const active = activeFile();
    const [item] = state.files.splice(from, 1);
    state.files.splice(to, 0, item);
    state.activeIndex = Math.max(0, state.files.indexOf(active));
    renderFileList();
  }

  function removeFile(index) {
    if (state.busy || index < 0 || index >= state.files.length) return;
    const [removed] = state.files.splice(index, 1);
    if (removed) {
      state.reports.delete(fileKey(removed));
      state.errors.delete(fileKey(removed));
    }
    if (state.files.length) {
      state.activeIndex = Math.min(state.activeIndex, state.files.length - 1);
      setLegacyActive(activeFile());
    } else {
      state.activeIndex = 0;
      if (typeof originalResetAll === 'function') originalResetAll();
    }
    renderFileList();
    renderBatchResults();
  }

  function addFiles(rawFiles) {
    if (state.busy) return;
    const incoming = Array.from(rawFiles || []).filter(Boolean);
    if (!incoming.length) return;
    const existing = new Set(state.files.map(fileKey));
    const unique = incoming.filter((file) => !existing.has(fileKey(file)));
    const invalid = unique.find((file) => !file.name?.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf');
    if (invalid) return showError('PDF 파일만 업로드할 수 있습니다.');
    const tooLarge = unique.find((file) => Number(file.size || 0) > MAX_FILE_BYTES);
    if (tooLarge) return showError(`${tooLarge.name}: PDF 한 파일은 최대 200MB까지 가능합니다.`);
    if (state.files.length + unique.length > MAX_FILES) return showError(`PDF는 최대 ${MAX_FILES}개까지 등록할 수 있습니다.`);
    const nextTotal = totalBytes() + unique.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (nextTotal > MAX_TOTAL_BYTES) return showError('등록한 PDF의 전체 합계는 최대 200MB까지 가능합니다.');
    state.files.push(...unique);
    if (state.files.length === unique.length) state.activeIndex = 0;
    setLegacyActive(activeFile());
    renderFileList();
    if (typeof window.hideError === 'function') window.hideError();
  }

  function interceptFileEvents() {
    const input = $('fileInput');
    const zone = $('uploadZone');
    if (!input || !zone || input.dataset.pdfUtilityBound === '1') return;
    input.dataset.pdfUtilityBound = '1';
    input.multiple = true;
    input.setAttribute('multiple', 'multiple');
    input.addEventListener('change', (event) => {
      event.stopImmediatePropagation();
      addFiles(event.target.files);
      event.target.value = '';
    }, true);
    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      zone.classList.remove('dragover');
      addFiles(event.dataTransfer?.files);
    }, true);
  }

  function makeAction(id, icon, name, desc, chip, chipClass, handler) {
    if ($(id)) return $(id);
    const grid = document.querySelector('.action-grid');
    if (!grid) return null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn pdfu-action';
    button.id = id;
    button.innerHTML = `<span class="action-chip ${chipClass}">${chip}</span><div class="action-icon" style="background:#eef7ff">${icon}</div><div class="action-name">${name}</div><div class="action-desc">${desc}</div>`;
    button.addEventListener('click', handler);
    grid.appendChild(button);
    return button;
  }

  function setupActions() {
    const check = $('checkBtn');
    if (check) {
      check.querySelector('.action-name').textContent = '최대 10개 일괄 검수';
      check.querySelector('.action-desc').textContent = '등록한 PDF를 순서대로 검사하고 파일별 점수와 경고를 모아 보여줍니다.';
      const chip = check.querySelector('.action-chip');
      if (chip) chip.textContent = '일괄 점검';
    }
    const encrypt = $('encryptBtn');
    if (encrypt) {
      encrypt.querySelector('.action-name').textContent = '선택 파일 암호 설정';
      encrypt.querySelector('.action-desc').textContent = '현재 선택한 PDF 한 개에 비밀번호를 설정합니다.';
    }
    const decrypt = $('decryptBtn');
    if (decrypt) {
      decrypt.querySelector('.action-name').textContent = '선택 파일 암호 해제';
      decrypt.querySelector('.action-desc').textContent = '현재 선택한 PDF 한 개의 암호 해제를 시도합니다.';
    }
    makeAction('pdfUtilityMergeBtn', '🔗', 'PDF 합치기', '등록한 PDF를 현재 목록 순서대로 하나의 파일로 합칩니다.', '최대 10개', 'chip-blue', runMerge);
    makeAction('pdfUtilityBackgroundBtn', '⬜', '배경색 제거', '선택 파일의 밝은 종이색·연한 배경을 흰색 쪽으로 정리합니다.', '선택 파일', 'chip-amber', openBackgroundModal);
    makeAction('pdfUtilityCompressBtn', '🗜️', 'PDF 용량 줄이기', '선택 파일을 인쇄·공유 용도에 맞춰 가볍게 만듭니다.', '선택 파일', 'chip-green', openCompressModal);
    makeAction('pdfUtilityRepairBtn', '🛠️', 'PDF 복구·정상화', '열림 오류나 구조 문제가 있는 선택 PDF를 다시 저장해 정상화합니다.', '선택 파일', 'chip-blue', runRepair);
  }

  function syncUtilityButtons() {
    const hasFile = state.files.length > 0;
    const active = activeFile();
    const merge = $('pdfUtilityMergeBtn');
    const background = $('pdfUtilityBackgroundBtn');
    const compress = $('pdfUtilityCompressBtn');
    const repair = $('pdfUtilityRepairBtn');
    if (merge) merge.disabled = state.busy || state.files.length < 2;
    for (const button of [background, compress, repair]) if (button) button.disabled = state.busy || !active;
    const check = $('checkBtn');
    if (check) check.disabled = state.busy || !hasFile;
    const reset = $('inlineResetBtn');
    if (reset) reset.disabled = state.busy;
  }

  function makeBatchResults() {
    if ($('pdfUtilityBatchResults')) return;
    const results = $('results');
    if (!results) return;
    const section = document.createElement('section');
    section.id = 'pdfUtilityBatchResults';
    section.className = 'pdfu-batch-results';
    section.innerHTML = '<div class="pdfu-summary" id="pdfUtilitySummary"></div><div class="pdfu-result-list" id="pdfUtilityResultList"></div>';
    results.insertAdjacentElement('beforebegin', section);
  }

  function renderBatchResults() {
    makeBatchResults();
    const section = $('pdfUtilityBatchResults');
    const summary = $('pdfUtilitySummary');
    const list = $('pdfUtilityResultList');
    if (!section || !summary || !list) return;
    const completed = state.files.filter((file) => state.reports.has(fileKey(file)) || state.errors.has(fileKey(file)));
    if (!completed.length) {
      section.classList.remove('show');
      list.innerHTML = '';
      return;
    }
    section.classList.add('show');
    let normal = 0, warning = 0, failed = 0;
    for (const file of completed) {
      const status = reportSummary(file);
      if (status.cls === 'pass') normal += 1;
      else if (status.cls === 'warn') warning += 1;
      else if (status.cls === 'fail') failed += 1;
    }
    summary.innerHTML = `<strong>PDF 일괄 검수 결과</strong><span>검사 ${completed.length}/${state.files.length} · 정상 ${normal} · 경고 ${warning} · 오류 ${failed}</span>`;
    list.innerHTML = '';
    state.files.forEach((file, index) => {
      const key = fileKey(file);
      const report = state.reports.get(key);
      const error = state.errors.get(key);
      if (!report && !error) return;
      const row = document.createElement('article');
      row.className = 'pdfu-result-row';
      if (error) {
        row.innerHTML = `<div><div class="pdfu-result-name">${safeText(file.name)}</div><div class="pdfu-result-meta" style="color:#dc2626">검사 실패 · ${safeText(error)}</div></div>`;
      } else {
        const checks = Array.isArray(report.checks) ? report.checks : [];
        const fail = checks.filter((check) => check.severity === 'fail').length;
        const warn = checks.filter((check) => check.severity === 'warning').length;
        const pass = checks.filter((check) => check.severity === 'pass').length;
        row.innerHTML = `<div><div class="pdfu-result-name">${safeText(file.name)}</div><div class="pdfu-result-meta"><span class="pdfu-result-score">점수 ${Number(report.score || 0)}</span> · ${Number(report.page_count || 0)}페이지 · 통과 ${pass} · 경고 ${warn} · 불량 ${fail}</div></div><button type="button" class="pdfu-detail-btn">상세 보기</button>`;
        row.querySelector('button').addEventListener('click', () => {
          selectActive(index);
          if (typeof window.renderResults === 'function') window.renderResults(report);
        });
      }
      list.appendChild(row);
    });
  }

  async function withBusy(label, operation) {
    if (state.busy) return null;
    state.busy = true;
    if (typeof window.setPageBusy === 'function') window.setPageBusy(true, label);
    syncUtilityButtons();
    renderFileList();
    try {
      return await operation();
    } finally {
      state.busy = false;
      if (typeof window.setPageBusy === 'function') window.setPageBusy(false);
      syncUtilityButtons();
      renderFileList();
    }
  }

  async function runBatchCheck() {
    if (!state.files.length) return showError('먼저 PDF 파일을 등록하세요.');
    return withBusy('검수 중', async () => {
      state.reports.clear();
      state.errors.clear();
      $('results') && ($('results').style.display = 'none');
      renderBatchResults();
      if (typeof window.stopProgress === 'function') window.stopProgress();
      const started = Date.now();
      for (let index = 0; index < state.files.length; index += 1) {
        const file = state.files[index];
        const percent = (index / state.files.length) * 100;
        setProgress(percent, '🔍', `${index + 1}/${state.files.length} · ${file.name} 검사 중`);
        showStatus(`${index + 1}/${state.files.length} · ${file.name} 검수 중...`);
        try {
          const report = await window.apiPreflightCheck(file, {
            onStatus: (message) => message && showStatus(`${index + 1}/${state.files.length} · ${message}`),
          });
          state.reports.set(fileKey(file), report);
        } catch (error) {
          state.errors.set(fileKey(file), error?.message || '검수 실패');
        }
        renderFileList();
        renderBatchResults();
      }
      setProgress(100, '✅', `${state.files.length}개 PDF 검수 완료`);
      const failed = state.errors.size;
      showStatus(`일괄 검수 완료 · ${state.files.length}개 중 ${failed ? `${failed}개 검사 실패` : '전체 검사 완료'} · ${Math.max(1, Math.round((Date.now() - started) / 1000))}초`, failed ? 'info' : 'ok');
      stopProgressSoon();
      if (state.files.length === 1) {
        const report = state.reports.get(fileKey(state.files[0]));
        if (report && typeof window.renderResults === 'function') window.renderResults(report);
      } else {
        $('pdfUtilityBatchResults')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  async function ensureStorage() {
    if (typeof window._ensureStorage === 'function') return window._ensureStorage();
    if (firebase.storage) return firebase.storage();
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase Storage SDK를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
    return firebase.storage();
  }

  async function readPdfResponse(response, storageInstance) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return response.blob();
    const delivery = await response.json();
    if (delivery?.delivery !== 'storage' || !delivery.download_url) throw new Error('완성 PDF 다운로드 정보가 올바르지 않습니다.');
    const result = await fetch(delivery.download_url, { cache: 'no-store' });
    if (!result.ok) throw new Error('완성 PDF를 내려받지 못했습니다.');
    const blob = await result.blob();
    if (delivery.storage_path && storageInstance) {
      try { await storageInstance.ref(delivery.storage_path).delete(); } catch (_) {}
    }
    return blob;
  }

  async function uploadPdfFiles(files, prefix, statusLabel) {
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const storageInstance = await ensureStorage();
    const session = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const paths = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const safe = file.name.replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 70) || `file_${index + 1}.pdf`;
      const name = `${String(index + 1).padStart(2, '0')}_${safe.toLowerCase().endsWith('.pdf') ? safe : safe + '.pdf'}`;
      const storagePath = `${prefix}/${user.uid}/${session}/${name}`;
      paths.push(storagePath);
      showStatus(`${statusLabel} (${index + 1}/${files.length})`);
      setProgress(5 + ((index + 1) / files.length) * 35, '📤', `${index + 1}/${files.length} 파일 업로드 중`);
      await storageInstance.ref(storagePath).put(file, { contentType: 'application/pdf' });
    }
    return { storageInstance, paths };
  }

  async function callStoragePdfEndpoint(endpoint, payload, upload) {
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const token = await user.getIdToken(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 285000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = `서버 오류 (${response.status})`;
        try {
          const error = await response.json();
          message = error?.detail || error?.message || message;
        } catch (_) {}
        throw new Error(message);
      }
      return { blob: await readPdfResponse(response, upload.storageInstance), response };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('처리 시간이 초과되었습니다. 파일 크기나 페이지 수를 줄여 다시 시도하세요.');
      throw error;
    } finally {
      clearTimeout(timer);
      await Promise.allSettled(upload.paths.map((storagePath) => upload.storageInstance.ref(storagePath).delete()));
    }
  }

  async function runMerge() {
    if (state.files.length < 2) return showError('PDF 합치기는 2개 이상의 파일을 등록하세요.');
    return withBusy('PDF 합치기', async () => {
      showStatus(`PDF ${state.files.length}개를 현재 순서대로 합치는 중입니다.`);
      setProgress(2, '🔗', 'PDF 합치기 준비 중');
      const upload = await uploadPdfFiles(state.files, 'pdf_temp', '합칠 PDF 업로드 중');
      setProgress(48, '🔗', '서버에서 PDF 합치는 중');
      const { blob, response } = await callStoragePdfEndpoint('/api/pdf-utility/merge-storage', {
        storage_paths: upload.paths,
        filenames: state.files.map((file) => file.name),
      }, upload);
      const pages = Number(response.headers.get('X-PDF-Page-Count') || 0);
      downloadBlob(blob, `PDF_합치기_${state.files.length}개${pages ? `_${pages}p` : ''}.pdf`);
      setProgress(100, '✅', 'PDF 합치기 완료');
      showStatus(`PDF 합치기 완료 · ${state.files.length}개${pages ? ` · 총 ${pages}페이지` : ''}`, 'ok');
      stopProgressSoon();
    }).catch((error) => {
      showError(error?.message || 'PDF 합치기에 실패했습니다.');
      showStatus(error?.message || 'PDF 합치기 실패', 'err');
    });
  }

  function makeUtilityModal() {
    if ($('pdfUtilityModalOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdfUtilityModalOverlay';
    overlay.className = 'pdfu-modal-overlay';
    overlay.innerHTML = '<div class="pdfu-modal"><div class="pdfu-modal-head"><h2 class="pdfu-modal-title" id="pdfUtilityModalTitle"></h2><button type="button" class="pdfu-modal-close" id="pdfUtilityModalClose">×</button></div><div class="pdfu-modal-desc" id="pdfUtilityModalDesc"></div><div id="pdfUtilityModalBody"></div><div class="pdfu-modal-footer"><button type="button" class="pdfu-modal-btn cancel" id="pdfUtilityModalCancel">취소</button><button type="button" class="pdfu-modal-btn run" id="pdfUtilityModalRun">실행</button></div></div>';
    document.body.appendChild(overlay);
    const close = () => { if (!state.busy) overlay.classList.remove('open'); };
    $('pdfUtilityModalClose').addEventListener('click', close);
    $('pdfUtilityModalCancel').addEventListener('click', close);
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  }

  function openBackgroundModal() {
    const file = activeFile();
    if (!file) return showError('배경색을 제거할 PDF를 선택하세요.');
    makeUtilityModal();
    $('pdfUtilityModalTitle').textContent = 'PDF 배경색 제거';
    $('pdfUtilityModalDesc').textContent = `선택 파일: ${file.name}`;
    $('pdfUtilityModalBody').innerHTML = `
      <label class="pdfu-choice"><input type="radio" name="pdfuBgStrength" value="light"><span><strong>약하게</strong><small>아주 연한 회색·종이색만 부드럽게 밝힙니다.</small></span></label>
      <label class="pdfu-choice"><input type="radio" name="pdfuBgStrength" value="medium" checked><span><strong>보통</strong><small>누런 종이색·연한 컬러 배경을 흰색 쪽으로 정리합니다.</small></span></label>
      <label class="pdfu-choice"><input type="radio" name="pdfuBgStrength" value="strong"><span><strong>강하게</strong><small>배경 제거 효과가 크지만 연한 사진·도형 색상도 밝아질 수 있습니다.</small></span></label>
      <div class="pdfu-warning"><strong>주의:</strong> 배경 제거 결과는 페이지를 이미지로 다시 구성합니다. 텍스트 선택·검색이나 링크 기능이 사라질 수 있고 사진 색상이 달라질 수 있으므로 원본 PDF는 반드시 보관하세요.</div>`;
    const run = $('pdfUtilityModalRun');
    run.textContent = '배경 제거 실행';
    run.onclick = async () => {
      const strength = document.querySelector('input[name="pdfuBgStrength"]:checked')?.value || 'medium';
      await runBackgroundCleanup(strength);
      if (!state.busy) $('pdfUtilityModalOverlay').classList.remove('open');
    };
    $('pdfUtilityModalOverlay').classList.add('open');
  }

  async function runBackgroundCleanup(strength) {
    const file = activeFile();
    if (!file) return showError('배경색을 제거할 PDF를 선택하세요.');
    const promise = withBusy('배경색 제거', async () => {
      $('pdfUtilityModalRun').disabled = true;
      $('pdfUtilityModalClose').disabled = true;
      $('pdfUtilityModalCancel').disabled = true;
      showStatus(`${file.name} 배경색을 정리하는 중입니다.`);
      setProgress(3, '⬜', '배경색 제거 준비 중');
      const upload = await uploadPdfFiles([file], 'pdf_temp', 'PDF 업로드 중');
      setProgress(48, '⬜', '서버에서 배경색 정리 중');
      const { blob } = await callStoragePdfEndpoint('/api/pdf-utility/background-cleanup-storage', {
        storage_path: upload.paths[0],
        filename: file.name,
        strength,
      }, upload);
      downloadBlob(blob, `${safeBaseName(file)}_배경제거.pdf`);
      setProgress(100, '✅', '배경색 제거 완료');
      showStatus('배경색 제거 PDF를 다운로드했습니다. 원본과 비교해 연한 글자·사진을 확인하세요.', 'ok');
      stopProgressSoon();
    });
    try { await promise; } catch (error) {
      showError(error?.message || '배경색 제거에 실패했습니다.');
      showStatus(error?.message || '배경색 제거 실패', 'err');
    } finally {
      for (const id of ['pdfUtilityModalRun', 'pdfUtilityModalClose', 'pdfUtilityModalCancel']) if ($(id)) $(id).disabled = false;
    }
  }

  function openCompressModal() {
    const file = activeFile();
    if (!file) return showError('용량을 줄일 PDF를 선택하세요.');
    makeUtilityModal();
    $('pdfUtilityModalTitle').textContent = 'PDF 용량 줄이기';
    $('pdfUtilityModalDesc').textContent = `선택 파일: ${file.name} · ${mb(file.size)}`;
    $('pdfUtilityModalBody').innerHTML = `
      <label class="pdfu-choice"><input type="radio" name="pdfuCompress" value="small"><span><strong>작은 용량</strong><small>120DPI 중심 · 이메일·화면 공유용</small></span></label>
      <label class="pdfu-choice"><input type="radio" name="pdfuCompress" value="balanced" checked><span><strong>균형</strong><small>150DPI 중심 · 일반 문서 공유용</small></span></label>
      <label class="pdfu-choice"><input type="radio" name="pdfuCompress" value="clear"><span><strong>선명하게</strong><small>180DPI 중심 · 글자 선명도를 조금 더 유지</small></span></label>
      <div class="pdfu-warning">용량 줄이기는 페이지를 이미지화하여 다시 구성합니다. 원본보다 화질이 낮아질 수 있으므로 인쇄 원본은 별도로 보관하세요.</div>`;
    const run = $('pdfUtilityModalRun');
    run.textContent = '용량 줄이기 실행';
    run.onclick = async () => {
      const quality = document.querySelector('input[name="pdfuCompress"]:checked')?.value || 'balanced';
      await runCompress(quality);
      if (!state.busy) $('pdfUtilityModalOverlay').classList.remove('open');
    };
    $('pdfUtilityModalOverlay').classList.add('open');
  }

  async function runCompress(quality) {
    const file = activeFile();
    if (!file) return showError('용량을 줄일 PDF를 선택하세요.');
    const promise = withBusy('용량 줄이기', async () => {
      for (const id of ['pdfUtilityModalRun', 'pdfUtilityModalClose', 'pdfUtilityModalCancel']) if ($(id)) $(id).disabled = true;
      showStatus(`${file.name} 용량을 줄이는 중입니다.`);
      setProgress(3, '🗜️', 'PDF 경량화 준비 중');
      const upload = await uploadPdfFiles([file], 'preflight_temp', 'PDF 업로드 중');
      setProgress(48, '🗜️', '서버에서 PDF 경량화 중');
      const { blob } = await callStoragePdfEndpoint('/api/preflight/compress-storage', {
        storage_path: upload.paths[0],
        filename: file.name,
        params: { quality },
      }, upload);
      downloadBlob(blob, `${safeBaseName(file)}_용량줄임_${quality}.pdf`);
      setProgress(100, '✅', 'PDF 용량 줄이기 완료');
      showStatus('용량을 줄인 PDF를 다운로드했습니다.', 'ok');
      stopProgressSoon();
    });
    try { await promise; } catch (error) {
      showError(error?.message || 'PDF 용량 줄이기에 실패했습니다.');
      showStatus(error?.message || 'PDF 용량 줄이기 실패', 'err');
    } finally {
      for (const id of ['pdfUtilityModalRun', 'pdfUtilityModalClose', 'pdfUtilityModalCancel']) if ($(id)) $(id).disabled = false;
    }
  }

  async function runRepair() {
    const file = activeFile();
    if (!file) return showError('복구할 PDF를 선택하세요.');
    return withBusy('PDF 복구', async () => {
      showStatus(`${file.name} PDF 구조를 복구·정상화하는 중입니다.`);
      setProgress(5, '🛠️', 'PDF 복구 준비 중');
      const blob = await window.apiPreflightFix(file, {
        onStatus: (message) => message && showStatus(message),
      });
      downloadBlob(blob, `${safeBaseName(file)}_복구.pdf`);
      setProgress(100, '✅', 'PDF 복구 완료');
      showStatus('복구·정상화한 PDF를 다운로드했습니다.', 'ok');
      stopProgressSoon();
    }).catch((error) => {
      showError(error?.message || 'PDF 복구에 실패했습니다.');
      showStatus(error?.message || 'PDF 복구 실패', 'err');
    });
  }

  let originalResetAll = null;
  function installResetOverride() {
    if (originalResetAll || typeof window.resetAll !== 'function') return;
    originalResetAll = window.resetAll;
    window.resetAll = function pdfUtilityResetAll() {
      if (state.busy) return;
      state.files = [];
      state.activeIndex = 0;
      state.reports.clear();
      state.errors.clear();
      originalResetAll();
      renderFileList();
      renderBatchResults();
      const input = $('fileInput');
      if (input) input.value = '';
    };
  }

  function install() {
    if (state.installed) return true;
    if (
      typeof window.selectFile !== 'function' ||
      typeof window.runCheck !== 'function' ||
      typeof window.resetAll !== 'function' ||
      typeof window.apiPreflightCheck !== 'function' ||
      typeof window.apiPreflightFix !== 'function' ||
      !$('uploadZone') || !$('fileInput') || !document.querySelector('.action-grid')
    ) return false;

    state.installed = true;
    installStyles();
    updateBranding();
    makeFileList();
    makeBatchResults();
    makeUtilityModal();
    interceptFileEvents();
    setupActions();
    installResetOverride();
    window.runCheck = runBatchCheck;
    window.PdfUtility = {
      state,
      addFiles,
      selectActive,
      runBatchCheck,
      runMerge,
      openBackgroundModal,
      openCompressModal,
      runRepair,
      stage: 'pdf-utility-batch-tools-v1',
    };
    document.documentElement.dataset.pdfUtility = '1';
    renderFileList();
    syncUtilityButtons();
    return true;
  }

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
