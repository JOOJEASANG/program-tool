// PDF editor upload/render stability patch.
// Replaces the original handleFile() in the global scope so parsedPages/uploadedFiles are updated correctly.
(function () {
  if (window.__pdfEditorUploadFixV2) return;
  window.__pdfEditorUploadFixV2 = true;

  function install() {
    if (window.__pdfEditorInternalUploadFixV2) return true;
    // Verify required globals are available before patching.
    if (typeof parsedPages === 'undefined' || typeof uploadedFiles === 'undefined') return false;

    window.__pdfEditorInternalUploadFixV2 = true;

    function __clearNupSessionState() {
      try {
        localStorage.removeItem('programToolPdfFileNupOverridesV1');
        localStorage.removeItem('programToolPdfPageNupOverridesV1');
        localStorage.removeItem('programToolPdfSelectedPageOrdinalV1');
      } catch (_) {}
    }

    async function __safePdfGetDocument(buf) {
      try {
        return await pdfjsLib.getDocument({ data: buf, disableWorker: true }).promise;
      } catch (firstError) {
        console.warn('[pdf-upload-fix] disableWorker load failed, retrying with worker', firstError);
        return await pdfjsLib.getDocument({ data: buf }).promise;
      }
    }

    async function __safeRenderPdfPage(pdfPage, scale, rotation) {
      const viewport = pdfPage.getViewport({ scale, rotation });
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      return canvas;
    }

    window.handleFile = async function patchedHandleFile(file) {
      const isPdf = !!file && ((file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || ''));
      if (!isPdf) {
        showStatus('PDF 파일만 업로드할 수 있습니다.', 'error');
        return;
      }

      const isNew = _uploadMode === 'new';
      const isBreak = _uploadMode === 'break';

      if (isNew) {
        __clearNupSessionState();
        parsedPages = [];
        uploadedFiles = [];
        previewCanvases = [];
        document.getElementById('previewBtn').disabled = true;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>페이지 렌더링 중...</p></div>';
      }

      const fileIdx = uploadedFiles.length;
      uploadedFiles.push(file);
      const shortName = file.name.length > 28 ? file.name.slice(0, 26) + '…' : file.name;
      showStatus('"' + file.name + '" 로딩 중...');

      try {
        const buf = await file.arrayBuffer();
        const pdfDoc = await __safePdfGetDocument(buf);
        const total = pdfDoc.numPages || 0;
        if (!total) throw new Error('PDF 페이지를 찾을 수 없습니다.');

        for (let i = 1; i <= total; i++) {
          showStatus('"' + shortName + '" 렌더링 중... (' + i + ' / ' + total + ')');
          const pdfPage = await pdfDoc.getPage(i);
          const thumbCanvas = await __safeRenderPdfPage(pdfPage, 0.9, 0);
          const groupBreak = !isNew && isBreak && i === 1;
          parsedPages.push({
            id: makeId(), pdfPage, thumbCanvas,
            excluded: false, nupOverride: null, nupDisabled: false,
            sourceFile: shortName, groupBreak, rotation: 0, pageType: 'pdf',
            file_index: fileIdx, page_index: i - 1,
          });
          await new Promise(r => setTimeout(r, 0));
        }

        renderThumbs();
        document.getElementById('previewBtn').disabled = false;
        showStatus('"' + shortName + '" ' + total + '페이지 로드 완료', 'success');

        if (isNew) {
          document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active', 'break-active'));
          const contBtn = document.querySelector('.mode-btn[data-mode="cont"]');
          if (contBtn) contBtn.classList.add('active');
          _uploadMode = 'cont';
        }

        setTimeout(() => {
          try {
            triggerPreview();
            hideStatus();
          } catch (previewError) {
            console.warn('[pdf-upload-fix] preview after upload failed', previewError);
            hideStatus();
          }
        }, 250);
      } catch (e) {
        console.error(e);
        uploadedFiles.splice(fileIdx, 1);
        document.getElementById('previewBtn').disabled = parsedPages.length === 0;
        document.getElementById('downloadBtn').disabled = true;
        document.getElementById('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>PDF 렌더링 실패<br><span style="font-size:11px;color:#991b1b;">' + (e.message || e) + '</span></p></div>';
        showStatus('파일 로딩 실패: ' + (e.message || e), 'error');
      }
    };

    return true;
  }

  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 500);
  setInterval(install, 2000);
})();
