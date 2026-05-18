// PDF editor N-UP auto preview + per-file N-UP persistence module.
(function () {
  if (window.__pdfEditorNupHelperV3) return;
  window.__pdfEditorNupHelperV3 = true;

  function installInternalPatch() {
    try {
      window.eval(`
        if (!window.__pdfEditorInternalNupAutoV3) {
          window.__pdfEditorInternalNupAutoV3 = true;
          window.__pdfEditorFileNupMapV3 = window.__pdfEditorFileNupMapV3 || {};
          window.__pdfEditorAutoPreviewTimerV3 = null;

          function __nupValuesV3() { return [1, 2, 4, 6, 8, 9]; }
          function __isPdfPageV3(page) { return page && (!page.pageType || page.pageType === 'pdf' || page.page_type === 'normal'); }
          function __safeFileNameV3(file, idx) {
            return (file && file.name) ? file.name : '파일 ' + (idx + 1);
          }
          function __currentNupV3() {
            var value = Number(nup || 2);
            return __nupValuesV3().includes(value) ? value : 2;
          }
          function __mapNupToFileV3(fileIndex, value) {
            value = Number(value);
            if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
            if (__nupValuesV3().includes(value)) window.__pdfEditorFileNupMapV3[fileIndex] = value;
            else delete window.__pdfEditorFileNupMapV3[fileIndex];
          }
          function __applyFileNupMapV3() {
            if (!Array.isArray(parsedPages)) return;
            parsedPages.forEach(function(page) {
              if (!__isPdfPageV3(page)) return;
              var fi = Number(page.file_index ?? page.fileIndex);
              if (!Number.isInteger(fi) || fi < 0) return;
              var mapped = Number(window.__pdfEditorFileNupMapV3[fi]);
              if (__nupValuesV3().includes(mapped)) {
                page.nupOverride = mapped;
                page.nup_override = mapped;
                page.nupDisabled = false;
                page.nup_disabled = false;
              }
            });
          }
          function __hasPagesV3() {
            return Array.isArray(parsedPages) && parsedPages.some(function(p) { return !p.excluded; });
          }
          function __scheduleAutoPreviewV3(delay) {
            clearTimeout(window.__pdfEditorAutoPreviewTimerV3);
            window.__pdfEditorAutoPreviewTimerV3 = setTimeout(function() {
              try {
                __applyFileNupMapV3();
                __renderFileNupPanelV3();
                if (__hasPagesV3() && $('previewBtn') && !$('previewBtn').disabled && typeof triggerPreview === 'function') {
                  triggerPreview();
                }
              } catch (e) {
                console.warn('[pdf-nup-auto] preview failed', e);
              }
            }, delay == null ? 250 : delay);
          }
          function __installHandleFileWrapperV3() {
            if (typeof handleFile !== 'function') return;
            if (handleFile.__nupAutoWrappedV3) return;
            var originalHandleFile = handleFile;
            var wrapped = async function nupAutoHandleFileWrapper(file) {
              var beforeCount = Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
              var nupAtUpload = __currentNupV3();
              var result = await originalHandleFile.apply(this, arguments);
              var afterCount = Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
              if (afterCount > beforeCount) {
                for (var i = beforeCount; i < afterCount; i++) __mapNupToFileV3(i, nupAtUpload);
                __applyFileNupMapV3();
                if (typeof renderThumbs === 'function') renderThumbs();
                __renderFileNupPanelV3();
                __scheduleAutoPreviewV3(350);
              }
              return result;
            };
            wrapped.__nupAutoWrappedV3 = true;
            wrapped.__nupAutoOriginalV3 = originalHandleFile;
            handleFile = wrapped;
          }
          function __installNupButtonEventsV3() {
            document.querySelectorAll('.nup-btn').forEach(function(btn) {
              if (btn.__nupAutoClickV3) return;
              btn.__nupAutoClickV3 = true;
              btn.addEventListener('click', function() {
                setTimeout(function() {
                  var latestFileIndex = Array.isArray(uploadedFiles) ? uploadedFiles.length - 1 : -1;
                  if (latestFileIndex >= 0) {
                    __mapNupToFileV3(latestFileIndex, __currentNupV3());
                    __applyFileNupMapV3();
                    if (typeof renderThumbs === 'function') renderThumbs();
                  }
                  __renderFileNupPanelV3();
                  __scheduleAutoPreviewV3(120);
                }, 0);
              }, true);
            });
          }
          function __installLayoutAutoPreviewEventsV3() {
            if (window.__pdfEditorLayoutAutoPreviewEventsV3) return;
            window.__pdfEditorLayoutAutoPreviewEventsV3 = true;
            document.addEventListener('change', function(event) {
              var target = event.target;
              if (!target) return;
              if (target.id === 'fileInput') return;
              if (target.matches && target.matches('select,input[type="number"],input[type="checkbox"],input[type="color"]')) {
                __scheduleAutoPreviewV3(300);
              }
            }, true);
            document.addEventListener('input', function(event) {
              var target = event.target;
              if (!target) return;
              if (target.matches && target.matches('input[type="number"],input[type="text"],input[type="range"]')) {
                __scheduleAutoPreviewV3(450);
              }
            }, true);
            var resetBtn = $('resetBtn');
            if (resetBtn && !resetBtn.__nupAutoResetV3) {
              resetBtn.__nupAutoResetV3 = true;
              resetBtn.addEventListener('click', function() {
                window.__pdfEditorFileNupMapV3 = {};
                setTimeout(__renderFileNupPanelV3, 100);
              }, true);
            }
          }
          function __installFileNupPanelV3() {
            if ($('fileNupOverridePanel')) return;
            var nupGrid = document.querySelector('.nup-grid');
            if (!nupGrid) return;
            var panel = document.createElement('div');
            panel.id = 'fileNupOverridePanel';
            panel.className = 'field';
            panel.style.cssText = 'margin-top:10px;padding:10px;border:1.5px dashed #c4b5fd;border-radius:10px;background:#faf5ff;';
            panel.innerHTML = '<label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:6px;display:block;">파일별 N-UP 배치</label>'
              + '<div id="fileNupModeText" style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:8px;">N-UP 버튼을 누르면 최근 업로드한 파일에 적용되고 미리보기가 자동 갱신됩니다.</div>'
              + '<div id="fileNupOverrideList"></div>'
              + '<button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:8px;">지금 미리보기 갱신</button>';
            nupGrid.insertAdjacentElement('afterend', panel);
            var refreshBtn = $('fileNupRefreshBtn');
            if (refreshBtn) refreshBtn.onclick = function() { __scheduleAutoPreviewV3(30); };
          }
          function __renderFileNupPanelV3() {
            __installFileNupPanelV3();
            var list = $('fileNupOverrideList');
            if (!list) return;
            var fileCount = Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
            if (!fileCount) {
              list.innerHTML = '<div style="font-size:11px;color:#64748b;line-height:1.45;">PDF 파일을 업로드하면 파일별 N-UP 선택칸이 표시됩니다. 업로드 전 선택한 N-UP은 새 파일에 자동 적용됩니다.</div>';
              return;
            }
            var rows = [];
            for (var i = 0; i < fileCount; i++) {
              var current = Number(window.__pdfEditorFileNupMapV3[i] || __currentNupV3());
              var name = __safeFileNameV3(uploadedFiles[i], i);
              var shortName = name.length > 18 ? name.slice(0, 17) + '…' : name;
              rows.push('<div style="display:grid;grid-template-columns:1fr 110px;gap:6px;align-items:center;margin-bottom:6px;">'
                + '<div title="' + name.replace(/"/g, '&quot;') + '" style="font-size:11px;font-weight:800;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (i + 1) + '. ' + shortName + '</div>'
                + '<select class="file-nup-select" data-file-index="' + i + '" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">'
                + __nupValuesV3().map(function(v) { return '<option value="' + v + '" ' + (current === v ? 'selected' : '') + '>' + v + '장</option>'; }).join('')
                + '</select></div>');
            }
            list.innerHTML = rows.join('');
            list.querySelectorAll('.file-nup-select').forEach(function(sel) {
              sel.onchange = function() {
                __mapNupToFileV3(Number(sel.dataset.fileIndex), Number(sel.value));
                __applyFileNupMapV3();
                if (typeof renderThumbs === 'function') renderThumbs();
                __scheduleAutoPreviewV3(80);
              };
            });
          }
          function __bootNupAutoV3() {
            try {
              if (Array.isArray(uploadedFiles) && uploadedFiles.length === 0 && Array.isArray(parsedPages) && parsedPages.length === 0) {
                window.__pdfEditorFileNupMapV3 = {};
              }
              __installHandleFileWrapperV3();
              __installNupButtonEventsV3();
              __installLayoutAutoPreviewEventsV3();
              __renderFileNupPanelV3();
              __applyFileNupMapV3();
            } catch (e) {
              console.warn('[pdf-nup-auto] boot failed', e);
            }
          }
          window.__pdfEditorBootNupAutoV3 = __bootNupAutoV3;
          window.__pdfEditorScheduleAutoPreviewV3 = __scheduleAutoPreviewV3;
          setInterval(__bootNupAutoV3, 700);
          __bootNupAutoV3();
        } else if (typeof window.__pdfEditorBootNupAutoV3 === 'function') {
          window.__pdfEditorBootNupAutoV3();
        }
      `);
      return true;
    } catch (e) {
      console.warn('[pdf-nup-auto] install failed', e);
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', installInternalPatch);
  setTimeout(installInternalPatch, 500);
  setInterval(installInternalPatch, 1500);
})();
