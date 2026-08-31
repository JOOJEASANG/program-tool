// Enforce one consistent source/working-set policy before PDF.js or Storage allocation.
(function () {
  'use strict';
  if (window.__pdfEditorTransferLimitGuardV2) return;
  window.__pdfEditorTransferLimitGuardV2 = true;
  if (!location.pathname.includes('pdf-editor')) return;

  const MAX_FILE_BYTES = 200 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);

  function currentFiles() {
    try { return Array.isArray(uploadedFiles) ? uploadedFiles : []; } catch (_) { return []; }
  }

  function currentMode() {
    try { return String(_uploadMode || 'new'); } catch (_) { return 'new'; }
  }

  function byteSum(files) {
    return Array.from(files || []).reduce((sum, file) => sum + Number(file?.size || 0), 0);
  }

  function validate(files, mode = currentMode()) {
    const incoming = Array.from(files || []).filter(Boolean);
    if (!incoming.length) return { ok: true, totalBytes: byteSum(currentFiles()) };
    const nonPdf = incoming.find((file) => !((file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || '')));
    if (nonPdf) return { ok: false, message: 'PDF 파일만 업로드할 수 있습니다.' };
    const tooLarge = incoming.find((file) => Number(file.size || 0) > MAX_FILE_BYTES);
    if (tooLarge) return { ok: false, message: `“${tooLarge.name}” 파일은 200MB를 초과해 추가할 수 없습니다.` };
    const existing = mode === 'new' ? 0 : byteSum(currentFiles());
    const totalBytes = existing + byteSum(incoming);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return { ok: false, message: 'PDF 편집기의 현재 작업 파일 전체 합계는 최대 300MB까지 가능합니다.' };
    }
    return { ok: true, totalBytes };
  }

  function show(message) {
    if (typeof window.showStatus === 'function') {
      try { window.showStatus(message, 'error'); return; } catch (_) {}
    }
    const bar = $('statusBar');
    if (bar) {
      bar.style.display = 'flex';
      bar.className = 'status-bar error';
      bar.textContent = `❌ ${message}`;
      return;
    }
    alert(message);
  }

  function block(event, result) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.target?.id === 'fileInput') event.target.value = '';
    show(result.message);
  }

  function onChange(event) {
    const input = event.target;
    if (!input || input.id !== 'fileInput') return;
    const result = validate(input.files, currentMode());
    if (!result.ok) block(event, result);
  }

  function onDrop(event) {
    if (!event.target?.closest?.('#uploadZone')) return;
    const result = validate(event.dataTransfer?.files, currentMode());
    if (!result.ok) block(event, result);
  }

  function validateSessionSave(event) {
    if (!event.target?.closest?.('#sessionSaveConfirm')) return;
    const files = currentFiles();
    const tooLarge = files.find((file) => Number(file?.size || 0) > MAX_FILE_BYTES);
    const total = byteSum(files);
    if (!tooLarge && total <= MAX_TOTAL_BYTES) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const message = tooLarge
      ? `“${tooLarge.name}” 파일은 200MB를 초과해 세션에 저장할 수 없습니다.`
      : '저장 세션의 원본 PDF 전체 합계는 최대 300MB까지 가능합니다.';
    const status = $('sessionSaveStatus');
    if (status) { status.textContent = message; status.style.color = '#dc2626'; }
    else show(message);
  }

  function addUiNote() {
    const zone = $('uploadZone');
    if (!zone || $('pdfEditorTransferPolicyNote')) return false;
    const note = document.createElement('div');
    note.id = 'pdfEditorTransferPolicyNote';
    note.style.cssText = 'margin-top:7px;padding:7px 9px;border:1px solid #dbe5ee;border-radius:8px;background:#f8fafc;color:#64748b;font-size:9px;line-height:1.45;font-weight:700';
    note.textContent = 'PDF 한 파일 최대 200MB · 현재 작업 전체 합계 최대 300MB. 대용량 문서는 미리보기를 자동으로 줄여 브라우저 메모리와 Storage 비용을 보호합니다.';
    zone.insertAdjacentElement('afterend', note);
    return true;
  }

  document.addEventListener('change', onChange, true);
  document.addEventListener('drop', onDrop, true);
  document.addEventListener('click', validateSessionSave, true);

  window.PdfEditorTransferPolicy = {
    maxFileBytes: MAX_FILE_BYTES,
    maxTotalBytes: MAX_TOTAL_BYTES,
    validate,
    byteSum,
    stage: 'pdf-editor-200mb-file-300mb-working-set-cost-guard-v2',
  };

  let attempts = 0;
  const install = () => {
    attempts += 1;
    if (addUiNote() || attempts >= 40) return;
    setTimeout(install, 100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
