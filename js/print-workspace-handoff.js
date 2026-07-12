(() => {
  'use strict';

  if (!/\/tools\/print-workspace(?:\.html)?\/?$/.test(location.pathname)) return;

  const BRIDGE_FLAG = '__programToolDirectCheckerBridgeV1';
  let installing = false;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function showToast(message) {
    if (typeof window.toast === 'function') {
      window.toast(message);
      return;
    }
    console.info('[print-workspace]', message);
  }

  function editedFileName() {
    const ts = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    return `pdf_edit_${ts}.pdf`;
  }

  function updateWorkspaceFile(file) {
    const key = typeof window.fileKey === 'function'
      ? window.fileKey(file)
      : [file.name, file.size, file.lastModified].join('|');

    try {
      sharedFile = file;
      delivered.editor = key;
      delivered.checker = '';
    } catch (error) {
      console.warn('Workspace state update failed', error);
    }

    const name = document.getElementById('sharedFileName');
    if (name) {
      name.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)}MB · 편집 결과`;
      name.classList.remove('empty');
    }
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.disabled = false;

    return key;
  }

  async function directSelectInChecker(file, key) {
    const checkerFrame = document.getElementById('frame-checker');
    if (!checkerFrame) throw new Error('검수 도구 화면을 찾지 못했습니다.');

    for (let i = 0; i < 60; i++) {
      try {
        const selectFile = checkerFrame.contentWindow?.selectFile;
        if (typeof selectFile === 'function') {
          await selectFile.call(checkerFrame.contentWindow, file);
          try { delivered.checker = key; } catch (_) {}
          return;
        }
      } catch (_) {}
      await sleep(150);
    }
    throw new Error('검수 도구가 아직 준비되지 않았습니다.');
  }

  async function handoffEditedPdf(blob) {
    if (!blob || typeof blob.arrayBuffer !== 'function') return;

    const file = new File([blob], editedFileName(), {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
    const key = updateWorkspaceFile(file);

    showToast('편집 결과를 검수·보안 단계로 전달합니다.');

    if (typeof window.switchModule === 'function') {
      window.switchModule('checker');
    } else {
      document.querySelector('[data-module="checker"]')?.click();
    }

    await sleep(120);
    try {
      if (typeof delivered !== 'undefined' && delivered.checker === key) return;
    } catch (_) {}

    try {
      await directSelectInChecker(file, key);
      showToast('편집 결과를 검수·보안 도구에 불러왔습니다.');
    } catch (error) {
      console.error('Edited PDF handoff failed', error);
      showToast(error.message || '편집 결과 전달에 실패했습니다.');
    }
  }

  async function installBridge() {
    if (installing) return;
    installing = true;
    try {
      const editorFrame = document.getElementById('frame-editor');
      if (!editorFrame?.contentWindow) return;
      const editorWindow = editorFrame.contentWindow;
      if (editorWindow[BRIDGE_FLAG]) return;

      let original = null;
      for (let i = 0; i < 60; i++) {
        try {
          if (typeof editorWindow.apiProcessPdf === 'function') {
            original = editorWindow.apiProcessPdf;
            break;
          }
        } catch (_) {}
        await sleep(150);
      }
      if (!original || editorWindow[BRIDGE_FLAG]) return;

      editorWindow.apiProcessPdf = async function (...args) {
        const blob = await original.apply(this, args);
        setTimeout(() => handoffEditedPdf(blob), 0);
        return blob;
      };
      editorWindow[BRIDGE_FLAG] = true;
      console.info('Direct editor-to-checker PDF handoff enabled');
    } catch (error) {
      console.warn('Direct PDF handoff bridge installation failed', error);
    } finally {
      installing = false;
    }
  }

  function start() {
    const notice = document.querySelector('.notice');
    if (notice) {
      notice.innerHTML = '<strong>2차 통합 완료:</strong> 편집기에서 PDF 저장을 실행하면 다운로드와 내 파일함 저장은 그대로 진행되며, 생성된 결과 PDF가 검수·보안 탭으로 자동 전달됩니다. 같은 파일을 다시 선택할 필요 없이 바로 문서 검수나 암호 설정을 진행할 수 있습니다.';
    }

    const editorFrame = document.getElementById('frame-editor');
    editorFrame?.addEventListener('load', () => installBridge());
    installBridge();

    // iframe이 내부 인증 또는 새로고침으로 교체되는 경우에도 다시 연결합니다.
    setInterval(installBridge, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
