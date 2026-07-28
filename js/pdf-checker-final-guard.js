(() => {
  const PREFLIGHT_MAX_BYTES = 200 * 1024 * 1024;
  let toolBusy = false;
  let checkBusy = false;
  let installed = false;

  function setModalControlsDisabled(disabled) {
    const cancelBtn = document.querySelector('#toolModalOverlay .tm-cancel-btn');
    const closeBtn = document.querySelector('#toolModalOverlay .tool-modal-close');
    if (cancelBtn) cancelBtn.disabled = disabled;
    if (closeBtn) closeBtn.disabled = disabled;
  }

  function placeResetBelowActions() {
    const navReset = document.getElementById('navResetBtn');
    if (navReset) navReset.remove();

    const resetBtn = document.getElementById('inlineResetBtn');
    const actionGrid = document.querySelector('.action-grid');
    if (!resetBtn || !actionGrid) return;

    resetBtn.className = 'reset-bar-btn';
    resetBtn.disabled = false;
    resetBtn.removeAttribute('style');
    resetBtn.innerHTML = '<span class="reset-bar-icon">↻</span>'
      + '<span><strong>화면 전체 초기화</strong><small>선택한 파일과 검수 결과, 진행 상태를 모두 지웁니다.</small></span>';
    resetBtn.onclick = () => window.resetAll?.();
    actionGrid.insertAdjacentElement('afterend', resetBtn);
  }

  function removeOcrFeature() {
    document.querySelectorAll('.action-btn').forEach((button) => {
      const click = button.getAttribute('onclick') || '';
      const text = button.textContent || '';
      if (/ocr/i.test(click) || /OCR/i.test(text)) button.remove();
    });

    if (typeof TOOL_DEFS !== 'undefined' && TOOL_DEFS.ocr) delete TOOL_DEFS.ocr;

    const browserOcrScript = document.getElementById('browserPdfOcrScript');
    if (browserOcrScript) browserOcrScript.remove();

    const heroText = document.querySelector('.hero p');
    if (heroText) {
      heroText.textContent = 'PDF 파일을 한 번만 업로드한 뒤 문서 검수, 암호 설정, 자동 암호 해제 기능을 필요한 순서대로 실행하세요.';
    }

    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.content = 'PDF 검수와 암호 설정·해제를 한 번의 파일 업로드로 처리하는 PDF 문서 도구입니다.';
    }

    const uploadSub = document.querySelector('.upload-sub');
    if (uploadSub) {
      uploadSub.textContent = '문서 검수 최대 200MB · 암호 설정·해제 최대 20MB · PDF만 지원';
    }

    if (!document.getElementById('pdfToolsResetBelowStyle')) {
      const style = document.createElement('style');
      style.id = 'pdfToolsResetBelowStyle';
      style.textContent = `
        .action-grid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        .reset-bar-btn{width:100%;margin-top:14px;border:1px solid #dbe4ee;background:linear-gradient(180deg,#f8fafc,#f1f5f9);color:#475569;border-radius:13px;padding:13px 15px;display:flex;align-items:center;justify-content:center;gap:10px;text-align:left;cursor:pointer;transition:.18s}
        .reset-bar-btn:hover:not(:disabled){border-color:#94a3b8;background:#eef2f7;box-shadow:0 8px 20px rgba(71,85,105,.1)}
        .reset-bar-btn:disabled{opacity:.45;cursor:not-allowed}
        .reset-bar-icon{width:34px;height:34px;border-radius:10px;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:900;flex-shrink:0}
        .reset-bar-btn strong{display:block;font-size:12px;font-weight:950;color:#334155}
        .reset-bar-btn small{display:block;margin-top:2px;font-size:10px;font-weight:700;color:#94a3b8}
        @media(max-width:820px){.action-grid{grid-template-columns:1fr!important}}
      `;
      document.head.appendChild(style);
    }
  }

  function install() {
    if (installed) return;
    if (
      typeof window.selectFile !== 'function' ||
      typeof window.runCheck !== 'function' ||
      typeof window.openTool !== 'function' ||
      typeof window.closeTool !== 'function' ||
      typeof window.runTool !== 'function' ||
      !document.getElementById('uploadZone')
    ) {
      setTimeout(install, 50);
      return;
    }
    installed = true;

    removeOcrFeature();
    placeResetBelowActions();

    const originalSelectFile = window.selectFile;
    window.selectFile = function selectFileWithLimit(file) {
      if (file && file.size > PREFLIGHT_MAX_BYTES) {
        const input = document.getElementById('fileInput');
        if (input) input.value = '';
        if (typeof window.showError === 'function') {
          window.showError('문서 검수 파일은 최대 200MB까지 지원합니다.');
        }
        return;
      }
      return originalSelectFile(file);
    };

    const originalRunCheck = window.runCheck;
    window.runCheck = async function guardedRunCheck() {
      if (checkBusy || toolBusy) return;
      checkBusy = true;
      try {
        return await originalRunCheck();
      } finally {
        checkBusy = false;
      }
    };

    const originalOpenTool = window.openTool;
    window.openTool = function guardedOpenTool(id) {
      if (id === 'ocr') return;
      if (toolBusy || checkBusy) return;
      return originalOpenTool(id);
    };

    const originalCloseTool = window.closeTool;
    window.closeTool = function guardedCloseTool() {
      if (toolBusy) return;
      return originalCloseTool();
    };

    const originalRunTool = window.runTool;
    window.runTool = async function guardedRunTool() {
      const overlay = document.getElementById('toolModalOverlay');
      const runBtn = document.getElementById('toolRunBtn');
      if (toolBusy || checkBusy || !overlay?.classList.contains('open') || runBtn?.disabled) return;
      toolBusy = true;
      setModalControlsDisabled(true);
      try {
        return await originalRunTool();
      } finally {
        toolBusy = false;
        setModalControlsDisabled(false);
      }
    };

    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Enter') return;
        const overlay = document.getElementById('toolModalOverlay');
        if (!overlay?.classList.contains('open')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        window.runTool();
      },
      true
    );
  }

  install();
})();
