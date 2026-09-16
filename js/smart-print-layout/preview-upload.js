(() => {
  'use strict';
  if (window.__smartPrintPreviewUploadV1) return;
  window.__smartPrintPreviewUploadV1 = true;

  const $ = id => document.getElementById(id);
  const SUPPORTED = /\.(?:pdf|jpe?g|png|webp)$/i;
  const SUPPORTED_MIME = /^(?:application\/pdf|image\/(?:jpeg|png|webp))$/i;

  function setStatus(message, type = '') {
    const line = $('statusLine');
    if (!line) return;
    line.textContent = message;
    line.className = `status${type ? ` ${type}` : ''}`;
  }

  function isSupported(file) {
    return Boolean(file && (SUPPORTED.test(String(file.name || '')) || SUPPORTED_MIME.test(String(file.type || ''))));
  }

  function forwardFiles(files) {
    const input = $('fileInput');
    const incoming = Array.from(files || []);
    if (!input || !incoming.length) return false;
    if (input.disabled || window.SmartPrintLayout?.state?.busy || window.SmartPrintLayoutImageInput?.busy) {
      setStatus('현재 파일을 처리하는 중입니다. 완료 후 다시 올려 주세요.', 'error');
      return false;
    }
    const unsupported = incoming.filter(file => !isSupported(file));
    if (unsupported.length) {
      setStatus(`지원하지 않는 파일이 포함되어 있습니다: ${unsupported.slice(0, 3).map(file => file.name || '알 수 없는 파일').join(', ')}. PDF, JPG, PNG, WEBP만 사용해 주세요.`, 'error');
      return false;
    }

    try {
      if (typeof DataTransfer === 'function') {
        const transfer = new DataTransfer();
        incoming.forEach(file => transfer.items.add(file));
        input.files = transfer.files;
      } else if (files && typeof files.length === 'number') {
        input.files = files;
      } else {
        throw new Error('현재 브라우저에서는 드래그앤드롭 업로드를 지원하지 않습니다.');
      }
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (error) {
      setStatus(error?.message || '미리보기 영역에서 파일을 추가하지 못했습니다.', 'error');
      return false;
    }
  }

  function injectStyles() {
    if ($('smartPreviewUploadStyles')) return;
    const style = document.createElement('style');
    style.id = 'smartPreviewUploadStyles';
    style.textContent = `
      .canvas-shell{transition:border-color .14s ease,background-color .14s ease,box-shadow .14s ease}
      .canvas-shell.smart-file-drag{border-color:#14b8a6;background:#edfdfa;box-shadow:inset 0 0 0 2px rgba(20,184,166,.18)}
      .canvas-shell.smart-file-drag::after{content:'PDF / 이미지 놓아서 추가';position:absolute;z-index:40;inset:12px;display:grid;place-items:center;border:2px dashed #14b8a6;border-radius:12px;background:rgba(240,253,250,.9);color:#0f766e;font:900 13px/1.4 Pretendard,"Noto Sans KR",sans-serif;pointer-events:none}
      #emptyPreview{cursor:pointer}
      #emptyPreview:focus-visible{outline:3px solid rgba(20,184,166,.22);outline-offset:6px;border-radius:10px}
    `;
    document.head.appendChild(style);
  }

  function bind() {
    const shell = $('canvasShell');
    const empty = $('emptyPreview');
    const input = $('fileInput');
    if (!shell || !input || shell.dataset.previewUploadBound === 'true') return false;
    shell.dataset.previewUploadBound = 'true';

    let dragDepth = 0;
    shell.addEventListener('dragenter', event => {
      if (!event.dataTransfer?.types?.includes?.('Files')) return;
      event.preventDefault();
      dragDepth += 1;
      shell.classList.add('smart-file-drag');
    });
    shell.addEventListener('dragover', event => {
      if (!event.dataTransfer?.types?.includes?.('Files')) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      shell.classList.add('smart-file-drag');
    });
    shell.addEventListener('dragleave', event => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth || !shell.contains(event.relatedTarget)) {
        dragDepth = 0;
        shell.classList.remove('smart-file-drag');
      }
    });
    shell.addEventListener('drop', event => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      shell.classList.remove('smart-file-drag');
      forwardFiles(event.dataTransfer?.files || []);
    });

    if (empty) {
      empty.tabIndex = 0;
      empty.setAttribute('role', 'button');
      empty.setAttribute('aria-label', 'PDF 또는 이미지 파일 업로드');
      empty.addEventListener('click', () => { if (!input.disabled) input.click(); });
      empty.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (!input.disabled) input.click();
      });
    }

    document.documentElement.dataset.smartPrintPreviewUpload = 'ready';
    return true;
  }

  function boot() {
    injectStyles();
    bind();
  }

  window.SmartPrintLayoutPreviewUpload = { forwardFiles, isSupported, bind, stage: 'preview-canvas-upload-v1' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
