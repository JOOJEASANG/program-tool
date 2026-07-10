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

  function placeResetBelowActions() {
    const navReset = document.getElementById('navResetBtn');
    if (navReset) navReset.style.display = 'none';

    const resetBtn = document.getElementById('inlineResetBtn');
    const actionGrid = document.querySelector('.action-grid');
    if (!resetBtn || !actionGrid) return;

    resetBtn.textContent = '↻ 화면 전체 초기화';
    resetBtn.style.width = '100%';
    resetBtn.style.marginTop = '14px';
    resetBtn.style.padding = '12px 16px';
    resetBtn.style.borderRadius = '12px';
    resetBtn.style.border = '1px solid #dbe4ee';
    resetBtn.style.background = '#f8fafc';
    resetBtn.style.color = '#475569';
    resetBtn.style.fontSize = '12px';
    resetBtn.style.fontWeight = '900';
    resetBtn.style.cursor = 'pointer';
    actionGrid.insertAdjacentElement('afterend', resetBtn);
  }

  function escapeText(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  async function waitForBrowserOcr() {
    for (let i = 0; i < 100; i += 1) {
      if (typeof window.runBrowserPdfOcr === 'function') return window.runBrowserPdfOcr;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('브라우저 OCR 모듈을 불러오지 못했습니다. 인터넷 연결 후 새로고침하세요.');
  }

  function patchBrowserOcr() {
    if (typeof TOOL_DEFS === 'undefined' || !TOOL_DEFS.ocr) return;

    TOOL_DEFS.ocr.title = 'PDF OCR 변환';
    TOOL_DEFS.ocr.desc = '서버 업로드 없이 이 브라우저에서 한국어·영어 문자를 인식해 검색 가능한 PDF를 만듭니다.';
    TOOL_DEFS.ocr.runLabel = '브라우저 OCR 실행';
    TOOL_DEFS.ocr.runningText = '브라우저 OCR을 준비하는 중...';
    TOOL_DEFS.ocr.body = () => {
      const file = window.selectedFile;
      return `<div class="selected-file-note">사용 파일: ${escapeText(file?.name || '선택된 파일 없음')}</div>`
        + '<div class="tool-warn">OCR은 현재 브라우저에서 직접 실행됩니다. 파일이 외부 OCR 서버로 전송되지 않으며, 최초 실행 시 한국어·영어 인식 데이터를 내려받습니다.</div>'
        + '<div class="tool-help">최대 30페이지까지 처리합니다. 페이지 수와 컴퓨터 성능에 따라 시간이 오래 걸릴 수 있으니 처리 중에는 이 탭을 닫지 마세요.</div>'
        + '<label class="tool-check"><input type="checkbox" id="tm-ocr-confirm"> 브라우저 OCR 처리 안내를 확인했습니다.</label>';
    };
    TOOL_DEFS.ocr.run = async () => {
      if (!document.getElementById('tm-ocr-confirm')?.checked) {
        throw new Error('브라우저 OCR 처리 안내를 확인해 주세요.');
      }
      const file = window.selectedFile;
      if (!file) throw new Error('먼저 PDF 파일을 업로드하세요.');
      const runBrowserPdfOcr = await waitForBrowserOcr();
      const status = document.getElementById('toolStatus');
      const blob = await runBrowserPdfOcr(file, (message) => {
        if (status) {
          status.style.color = '#2563eb';
          status.textContent = message;
        }
      });
      return { blob };
    };
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

    placeResetBelowActions();
    patchBrowserOcr();

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
      if (id === 'ocr') patchBrowserOcr();
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
