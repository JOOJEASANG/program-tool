// PDF editor upload/render stability patch.
// Replaces the original handleFile() inside the page's global lexical scope so parsedPages/uploadedFiles are updated correctly.
(function () {
  if (window.__pdfEditorUploadFixV3) return;
  window.__pdfEditorUploadFixV3 = true;

  function install() {
    try {
      window.eval(`
        if (!window.__pdfEditorInternalUploadFixV3) {
          window.__pdfEditorInternalUploadFixV3 = true;

          const __PDF_LARGE_PAGE_LIMIT = 25;
          const __PDF_HUGE_PAGE_LIMIT = 80;
          const __PDF_LARGE_BYTE_LIMIT = 30 * 1024 * 1024;
          const __PDF_HUGE_BYTE_LIMIT = 80 * 1024 * 1024;

          function __clearNupSessionState() {
            try {
              localStorage.removeItem('programToolPdfFileNupOverridesV1');
              localStorage.removeItem('programToolPdfPageNupOverridesV1');
              localStorage.removeItem('programToolPdfSelectedPageOrdinalV1');
            } catch (_) {}
          }

          function __setFastMode(enabled, reason) {
            window.__pdfEditorFastMode = !!enabled;
            window.__pdfEditorFastModeReason = reason || '';
            const hint = document.getElementById('livePreviewHint');
            if (hint) {
              hint.textContent = enabled ? '빠른 편집 모드 ON' : '실시간 미리보기 ON';
              hint.style.color = enabled ? '#b45309' : '#64748b';
            }
          }

          function __fastModeMessage(total, fileSize) {
            const mb = fileSize ? Math.round(fileSize / 1024 / 1024) : 0;
            return '대용량/복잡한 PDF라 빠른 편집 모드로 열었습니다. 편집 중에는 자동 미리보기를 줄이고, PDF 저장은 원본 품질로 처리됩니다.'
              + (total ? ' (' + total + '페이지' : '')
              + (mb ? ', ' + mb + 'MB' : '')
              + (total || mb ? ')' : '');
          }

          function __showFastModePlaceholder(total, fileSize) {
            const scroll = $('previewScroll');
            if (!scroll) return;
            const msg = __fastModeMessage(total || parsedPages.length, fileSize || 0);
            scroll.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><p><b>빠른 편집 모드</b><br><span style="font-size:12px;color:#92400e;line-height:1.6;display:inline-block;margin-top:6px;max-width:420px;">' + msg + '<br>필요할 때만 <b>미리보기 새로고침</b>을 눌러 확인하세요.</span></p></div>';
            if ($('previewInfo')) $('previewInfo').textContent = '빠른 편집 모드 · 페이지 목록에서 순서/제외/회전 편집 가능';
            if ($('previewPages')) $('previewPages').textContent = total ? '총 ' + total + '페이지' : '';
          }

          async function __safePdfGetDocument(buf, heavyMode) {
            const options = {
              data: buf,
              disableAutoFetch: !!heavyMode,
              disableStream: false,
              disableFontFace: !!heavyMode,
            };
            try {
              return await pdfjsLib.getDocument({ ...options, disableWorker: true }).promise;
            } catch (firstError) {
              console.warn('[pdf-upload-fix] disableWorker load failed, retrying with worker', firstError);
              return await pdfjsLib.getDocument(options).promise;
            }
          }

          async function __safeRenderPdfPage(pdfPage, scale, rotation, heavyMode) {
            const viewport = pdfPage.getViewport({ scale, rotation });
            const canvas = document.createElement('canvas');
            const maxSide = heavyMode ? 900 : 1400;
            let w = Math.max(1, Math.floor(viewport.width));
            let h = Math.max(1, Math.floor(viewport.height));
            const ratio = Math.min(1, maxSide / Math.max(w, h));
            w = Math.max(1, Math.floor(w * ratio));
            h = Math.max(1, Math.floor(h * ratio));
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { alpha: false });
            const renderViewport = ratio < 1 ? pdfPage.getViewport({ scale: scale * ratio, rotation }) : viewport;
            try {
              await pdfPage.render({ canvasContext: ctx, viewport: renderViewport, intent: 'display' }).promise;
            } catch (e) {
              console.warn('[pdf-upload-fix] page render failed, using placeholder', e);
              ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
              ctx.strokeStyle = '#e5e7eb'; ctx.strokeRect(2, 2, w - 4, h - 4);
              ctx.fillStyle = '#991b1b'; ctx.font = '12px sans-serif';
              ctx.fillText('렌더링 생략', 10, 24);
            }
            return canvas;
          }

          // Preview calls made by timers/watchdogs should not freeze large documents.
          if (!window.__pdfEditorFastPreviewGuardInstalled && typeof triggerPreview === 'function') {
            window.__pdfEditorFastPreviewGuardInstalled = true;
            const __originalTriggerPreview = triggerPreview;
            triggerPreview = async function guardedTriggerPreview() {
              if (window.__pdfEditorFastMode && !window.__pdfEditorManualPreviewRequest) {
                __showFastModePlaceholder(parsedPages.length, 0);
                $('previewBtn').disabled = false;
                $('downloadBtn').disabled = parsedPages.length === 0;
                return;
              }
              try {
                return await __originalTriggerPreview.apply(this, arguments);
              } finally {
                window.__pdfEditorManualPreviewRequest = false;
              }
            };
            document.addEventListener('click', function(e) {
              const btn = e.target && e.target.closest ? e.target.closest('#previewBtn') : null;
              if (btn) window.__pdfEditorManualPreviewRequest = true;
            }, true);
          }

          handleFile = async function patchedHandleFile(file) {
            const isPdf = !!file && ((file.type || '').includes('pdf') || /\\.pdf$/i.test(file.name || ''));
            if (!isPdf) {
              showStatus('PDF 파일만 업로드할 수 있습니다.', 'error');
              return;
            }

            const isNew = _uploadMode === 'new';
            const isBreak = _uploadMode === 'break';

            if (isNew) {
              __clearNupSessionState();
              __setFastMode(false, '');
              parsedPages = [];
              uploadedFiles = [];
              previewCanvases = [];
              fileNupMap = {};
              $('previewBtn').disabled = true;
              $('downloadBtn').disabled = true;
              $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">⏳</div><p>페이지 렌더링 중...</p></div>';
            }

            const fileIdx = uploadedFiles.length;
            uploadedFiles.push(file);
            const shortName = file.name.length > 28 ? file.name.slice(0, 26) + '…' : file.name;
            showStatus('"' + file.name + '" 로딩 중...');

            try {
              const buf = await file.arrayBuffer();
              const likelyHeavyBySize = file.size >= __PDF_LARGE_BYTE_LIMIT;
              const pdfDoc = await __safePdfGetDocument(buf, likelyHeavyBySize);
              const total = pdfDoc.numPages || 0;
              if (!total) throw new Error('PDF 페이지를 찾을 수 없습니다.');

              const heavyMode = total >= __PDF_LARGE_PAGE_LIMIT || file.size >= __PDF_LARGE_BYTE_LIMIT || window.__pdfEditorFastMode;
              const hugeMode = total >= __PDF_HUGE_PAGE_LIMIT || file.size >= __PDF_HUGE_BYTE_LIMIT;
              if (heavyMode) __setFastMode(true, __fastModeMessage(total, file.size));

              const thumbScale = hugeMode ? 0.28 : (heavyMode ? 0.42 : 0.75);
              const batchYield = hugeMode ? 1 : (heavyMode ? 2 : 6);

              for (let i = 1; i <= total; i++) {
                showStatus('"' + shortName + '" 렌더링 중... (' + i + ' / ' + total + ')' + (heavyMode ? ' · 빠른모드' : ''));
                const pdfPage = await pdfDoc.getPage(i);
                const thumbCanvas = await __safeRenderPdfPage(pdfPage, thumbScale, 0, heavyMode);
                const groupBreak = !isNew && isBreak && i === 1;
                parsedPages.push({
                  id: makeId(), pdfPage, thumbCanvas,
                  excluded: false, nupOverride: null, nupDisabled: false,
                  sourceFile: shortName, groupBreak, rotation: 0, pageType: 'pdf',
                  file_index: fileIdx, page_index: i - 1,
                });
                if (i % batchYield === 0) await new Promise(r => setTimeout(r, heavyMode ? 12 : 0));
              }

              renderThumbs();
              $('previewBtn').disabled = false;
              $('downloadBtn').disabled = false;

              if (isNew) {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active','break-active'));
                const contBtn = document.querySelector('.mode-btn[data-mode="cont"]');
                if (contBtn) contBtn.classList.add('active');
                _uploadMode = 'cont';
              }

              if (heavyMode) {
                __showFastModePlaceholder(total, file.size);
                showStatus('"' + shortName + '" ' + total + '페이지 로드 완료 · 빠른 편집 모드', 'success');
                setTimeout(hideStatus, 3500);
                return;
              }

              showStatus('"' + shortName + '" ' + total + '페이지 로드 완료', 'success');
              setTimeout(() => {
                try {
                  window.__pdfEditorManualPreviewRequest = true;
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
              $('previewBtn').disabled = parsedPages.length === 0;
              $('downloadBtn').disabled = parsedPages.length === 0;
              $('previewScroll').innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>PDF 렌더링 실패<br><span style="font-size:11px;color:#991b1b;">' + (e.message || e) + '</span></p></div>';
              showStatus('파일 로딩 실패: ' + (e.message || e), 'error');
            }
          };
        }
      `);
      return true;
    } catch (e) {
      console.warn('[pdf-upload-fix] install failed', e);
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 500);
  setInterval(install, 2000);
})();
