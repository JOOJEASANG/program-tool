// PDF editor per-file N-UP persistence module.
// Purpose: in non-continuous/break workflows, each uploaded PDF can keep its own N-UP value.
(function () {
  if (window.__pdfEditorNupHelperV4) return;
  window.__pdfEditorNupHelperV4 = true;

  function installInternalPatch() {
    try {
      window.eval(`
        if (!window.__pdfEditorInternalNupPerFileV4) {
          window.__pdfEditorInternalNupPerFileV4 = true;
          window.__pdfEditorFileNupMapV4 = window.__pdfEditorFileNupMapV4 || {};
          window.__pdfEditorKnownFileCountV4 = 0;
          window.__pdfEditorLastNupV4 = 2;
          window.__pdfEditorNupPreviewTimerV4 = null;

          function __nupValuesV4() { return [1, 2, 4, 6, 8, 9]; }
          function __isNormalPdfPageV4(page) {
            return page && ((!page.pageType && !page.page_type) || page.pageType === 'pdf' || page.page_type === 'normal');
          }
          function __currentNupV4() {
            var value = Number(nup || window.__pdfEditorLastNupV4 || 2);
            return __nupValuesV4().includes(value) ? value : 2;
          }
          function __fileCountV4() {
            return Array.isArray(uploadedFiles) ? uploadedFiles.length : 0;
          }
          function __fileIndexV4(page) {
            var fi = Number(page && (page.file_index ?? page.fileIndex));
            return Number.isInteger(fi) && fi >= 0 ? fi : null;
          }
          function __shortNameV4(file, idx) {
            var name = file && file.name ? String(file.name) : '파일 ' + (idx + 1);
            return name.length > 20 ? name.slice(0, 19) + '…' : name;
          }
          function __lockMissingFilesV4(value) {
            value = Number(value);
            if (!__nupValuesV4().includes(value)) value = __currentNupV4();
            for (var i = 0; i < __fileCountV4(); i++) {
              if (!__nupValuesV4().includes(Number(window.__pdfEditorFileNupMapV4[i]))) {
                window.__pdfEditorFileNupMapV4[i] = value;
              }
            }
          }
          function __detectNewFilesV4() {
            var count = __fileCountV4();
            if (count === 0 && Array.isArray(parsedPages) && parsedPages.length === 0) {
              window.__pdfEditorFileNupMapV4 = {};
              window.__pdfEditorKnownFileCountV4 = 0;
              return;
            }
            if (count > window.__pdfEditorKnownFileCountV4) {
              var uploadNup = __currentNupV4();
              for (var i = window.__pdfEditorKnownFileCountV4; i < count; i++) {
                window.__pdfEditorFileNupMapV4[i] = uploadNup;
              }
              window.__pdfEditorKnownFileCountV4 = count;
            } else if (count < window.__pdfEditorKnownFileCountV4) {
              var next = {};
              for (var j = 0; j < count; j++) {
                if (__nupValuesV4().includes(Number(window.__pdfEditorFileNupMapV4[j]))) next[j] = Number(window.__pdfEditorFileNupMapV4[j]);
              }
              window.__pdfEditorFileNupMapV4 = next;
              window.__pdfEditorKnownFileCountV4 = count;
            }
          }
          function __setFileNupV4(fileIndex, value) {
            value = Number(value);
            if (!Number.isInteger(fileIndex) || fileIndex < 0) return;
            if (!__nupValuesV4().includes(value)) value = __currentNupV4();
            window.__pdfEditorFileNupMapV4[fileIndex] = value;
          }
          function __applyFileNupsToPagesV4() {
            if (!Array.isArray(parsedPages)) return;
            __detectNewFilesV4();
            __lockMissingFilesV4(__currentNupV4());
            parsedPages.forEach(function(page) {
              if (!__isNormalPdfPageV4(page)) return;
              var fi = __fileIndexV4(page);
              if (fi === null) return;
              var mapped = Number(window.__pdfEditorFileNupMapV4[fi]);
              if (!__nupValuesV4().includes(mapped)) mapped = __currentNupV4();
              page.nupOverride = mapped;
              page.nup_override = mapped;
              page.nupDisabled = false;
              page.nup_disabled = false;
            });
          }
          function __patchGroupByNupV4() {
            if (typeof groupByNup !== 'function' || groupByNup.__perFileNupPatchedV4) return;
            var patched = function perFileNupGroupByNup(pages) {
              __applyFileNupsToPagesV4();
              if (!pages || !pages.length) return [];
              var groups = [];
              for (var i = 0; i < pages.length; i++) {
                var page = pages[i];
                if (page.nupDisabled) {
                  groups.push({ n: 1, pages: [page] });
                  continue;
                }
                var fi = __fileIndexV4(page);
                var mapped = fi === null ? null : Number(window.__pdfEditorFileNupMapV4[fi]);
                var pageNup = Number(page.nupOverride || page.nup_override || mapped || nup || 2);
                if (!__nupValuesV4().includes(pageNup)) pageNup = 2;
                var last = groups[groups.length - 1];
                if (last && !last.pages[0].nupDisabled && last.n === pageNup && !page.groupBreak && !page.group_break) {
                  last.pages.push(page);
                } else {
                  groups.push({ n: pageNup, pages: [page] });
                }
              }
              return groups;
            };
            patched.__perFileNupPatchedV4 = true;
            groupByNup = patched;
          }
          function __schedulePreviewV4(delay) {
            clearTimeout(window.__pdfEditorNupPreviewTimerV4);
            window.__pdfEditorNupPreviewTimerV4 = setTimeout(function() {
              try {
                __applyFileNupsToPagesV4();
                __renderFileNupPanelV4();
                if (typeof renderThumbs === 'function') renderThumbs();
                if (Array.isArray(previewCanvases) && previewCanvases.length > 0 && typeof triggerPreview === 'function') {
                  triggerPreview();
                }
              } catch (e) {
                console.warn('[pdf-nup-file] preview refresh failed', e);
              }
            }, delay == null ? 120 : delay);
          }
          function __installNupButtonHooksV4() {
            document.querySelectorAll('.nup-btn').forEach(function(btn) {
              if (btn.__perFileNupHookV4) return;
              btn.__perFileNupHookV4 = true;
              var rememberBefore = function() {
                window.__pdfEditorLastNupV4 = __currentNupV4();
                __detectNewFilesV4();
                __lockMissingFilesV4(window.__pdfEditorLastNupV4);
                __applyFileNupsToPagesV4();
              };
              btn.addEventListener('pointerdown', rememberBefore, true);
              btn.addEventListener('mousedown', rememberBefore, true);
              btn.addEventListener('click', function() {
                setTimeout(function() {
                  var latest = __fileCountV4() - 1;
                  if (latest >= 0) __setFileNupV4(latest, __currentNupV4());
                  window.__pdfEditorLastNupV4 = __currentNupV4();
                  __applyFileNupsToPagesV4();
                  __renderFileNupPanelV4();
                  if (typeof renderThumbs === 'function') renderThumbs();
                  __schedulePreviewV4(100);
                }, 0);
              }, true);
            });
          }
          function __installResetHookV4() {
            var resetBtn = $('resetBtn');
            if (!resetBtn || resetBtn.__perFileNupResetHookV4) return;
            resetBtn.__perFileNupResetHookV4 = true;
            resetBtn.addEventListener('click', function() {
              window.__pdfEditorFileNupMapV4 = {};
              window.__pdfEditorKnownFileCountV4 = 0;
              setTimeout(__renderFileNupPanelV4, 50);
            }, true);
          }
          function __installPanelV4() {
            if ($('fileNupOverridePanel')) return;
            var nupGrid = document.querySelector('.nup-grid');
            if (!nupGrid) return;
            var panel = document.createElement('div');
            panel.id = 'fileNupOverridePanel';
            panel.className = 'field';
            panel.style.cssText = 'margin-top:10px;padding:10px;border:1.5px dashed #c4b5fd;border-radius:10px;background:#faf5ff;';
            panel.innerHTML = '<label style="font-size:11px;font-weight:900;color:#5b21b6;margin-bottom:6px;display:block;">파일별 N-UP 배치</label>'
              + '<div style="font-size:10px;color:#6b7280;line-height:1.45;margin-bottom:8px;">비연속 추가 후 파일마다 배치 수를 따로 지정할 수 있습니다. 예: 파일 1은 2장, 파일 2는 4장.</div>'
              + '<div id="fileNupOverrideList"></div>'
              + '<button type="button" id="fileNupRefreshBtn" class="btn-sm purple" style="margin-top:8px;">파일별 배치 적용 / 미리보기 갱신</button>';
            nupGrid.insertAdjacentElement('afterend', panel);
            var refreshBtn = $('fileNupRefreshBtn');
            if (refreshBtn) refreshBtn.onclick = function() { __schedulePreviewV4(30); };
          }
          function __renderFileNupPanelV4() {
            __installPanelV4();
            var list = $('fileNupOverrideList');
            if (!list) return;
            __detectNewFilesV4();
            var count = __fileCountV4();
            if (!count) {
              list.innerHTML = '<div style="font-size:11px;color:#64748b;line-height:1.45;">PDF를 업로드하면 파일별 N-UP 선택칸이 표시됩니다.</div>';
              return;
            }
            var rows = [];
            for (var i = 0; i < count; i++) {
              var current = Number(window.__pdfEditorFileNupMapV4[i] || __currentNupV4());
              var name = __shortNameV4(uploadedFiles[i], i);
              rows.push('<div style="display:grid;grid-template-columns:1fr 105px;gap:6px;align-items:center;margin-bottom:6px;">'
                + '<div style="font-size:11px;font-weight:800;color:#374151;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">파일 ' + (i + 1) + ' · ' + name.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</div>'
                + '<select class="file-nup-select" data-file-index="' + i + '" style="width:100%;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;font-size:12px;font-family:inherit;background:#fff;">'
                + __nupValuesV4().map(function(v) { return '<option value="' + v + '" ' + (current === v ? 'selected' : '') + '>' + v + '장</option>'; }).join('')
                + '</select></div>');
            }
            list.innerHTML = rows.join('');
            list.querySelectorAll('.file-nup-select').forEach(function(sel) {
              sel.onchange = function() {
                __setFileNupV4(Number(sel.dataset.fileIndex), Number(sel.value));
                __applyFileNupsToPagesV4();
                if (typeof renderThumbs === 'function') renderThumbs();
                __schedulePreviewV4(80);
              };
            });
          }
          function __bootPerFileNupV4() {
            try {
              __patchGroupByNupV4();
              __detectNewFilesV4();
              __installNupButtonHooksV4();
              __installResetHookV4();
              __applyFileNupsToPagesV4();
              __renderFileNupPanelV4();
            } catch (e) {
              console.warn('[pdf-nup-file] boot failed', e);
            }
          }
          window.__pdfEditorBootPerFileNupV4 = __bootPerFileNupV4;
          window.__pdfEditorApplyPerFileNupV4 = __applyFileNupsToPagesV4;
          window.__pdfEditorSchedulePerFileNupPreviewV4 = __schedulePreviewV4;
          setInterval(__bootPerFileNupV4, 700);
          __bootPerFileNupV4();
        } else if (typeof window.__pdfEditorBootPerFileNupV4 === 'function') {
          window.__pdfEditorBootPerFileNupV4();
        }
      `);
      return true;
    } catch (e) {
      console.warn('[pdf-nup-file] install failed', e);
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', installInternalPatch);
  setTimeout(installInternalPatch, 500);
  setInterval(installInternalPatch, 1500);
})();
