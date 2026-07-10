(() => {
  const COMMON_MAX_BYTES = 100 * 1024 * 1024;
  let toolBusy = false;
  let checkBusy = false;
  let installed = false;

  function setModalControlsDisabled(disabled) {
    const cancelBtn = document.querySelector('#toolModalOverlay .tm-cancel-btn');
    const closeBtn = document.querySelector('#toolModalOverlay .tool-modal-close');
    if (cancelBtn) cancelBtn.disabled = disabled;
    if (closeBtn) closeBtn.disabled = disabled;
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

    const uploadSub = document.querySelector('.upload-sub');
    if (uploadSub) {
      uploadSub.textContent = '공통 기능 최대 100 MB · PDF만 지원 · 업로드 후 아래 기능 버튼을 선택';
    }

    const originalSelectFile = window.selectFile;
    window.selectFile = function selectFileWithLimit(file) {
      if (file && file.size > COMMON_MAX_BYTES) {
        const input = document.getElementById('fileInput');
        if (input) input.value = '';
        if (typeof window.showError === 'function') {
          window.showError('검수·암호·OCR 공통 사용 파일은 최대 100 MB까지 지원합니다.');
        }
        return;
      }
      return originalSelectFile(file);
    };

    const originalOcrNotice = window.ocrNotice;
    window.ocrNotice = function finalOcrNotice() {
      const original = typeof originalOcrNotice === 'function' ? originalOcrNotice() : '';
      return original.replace(
        '</div><label class="tool-check">',
        ' OCR은 최대 30페이지까지 처리할 수 있으며, 서버에 Tesseract OCR 엔진과 한국어·영어 언어 데이터가 준비되어 있어야 합니다.</div><label class="tool-check">'
      );
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
