// PDF editor N-UP compatibility helper.
// Resolution order is always: page override -> file override -> global default.
(function () {
  if (window.__pdfEditorNupHelperV6) return;
  window.__pdfEditorNupHelperV6 = true;
  window.__pdfEditorNupHelperV5 = true;

  const NUP_VALUES = [1, 2, 4, 6, 8, 9];

  function $(id) { return document.getElementById(id); }
  function validNup(value) {
    const number = Number(value);
    return NUP_VALUES.includes(number) ? number : null;
  }
  function ready() {
    try {
      return Array.isArray(parsedPages) && typeof fileNupMap === 'object';
    } catch (_) {
      return false;
    }
  }
  function currentNup() {
    try { return validNup(nup) || 2; }
    catch (_) { return 2; }
  }
  function fileIndexOf(page) {
    const value = Number(page && (page.file_index ?? page.fileIndex));
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  function fileMap() {
    try {
      if (fileNupMap && typeof fileNupMap === 'object') {
        window.__pdfEditorFileNupMapV5 = fileNupMap;
        return fileNupMap;
      }
    } catch (_) {}
    return window.__pdfEditorFileNupMapV5 || (window.__pdfEditorFileNupMapV5 = {});
  }
  function pageOverride(page) {
    if (!page) return null;
    const camel = validNup(page.nupOverride);
    if (camel) return camel;
    return validNup(page.nup_override);
  }
  function isNupDisabled(page) {
    return !!(page && (page.nupDisabled || page.nup_disabled));
  }
  function effectiveNup(page) {
    if (isNupDisabled(page)) return 1;
    const explicit = pageOverride(page);
    if (explicit) return explicit;
    const fileIndex = fileIndexOf(page);
    const mapped = fileIndex === null ? null : validNup(fileMap()[fileIndex]);
    return mapped || currentNup();
  }

  function patchGroupByNup() {
    if (typeof groupByNup !== 'function' || groupByNup.__stableNupPriorityV6) return;
    const stable = function stableGroupByNup(pages) {
      if (!Array.isArray(pages) || !pages.length) return [];
      const groups = [];
      for (const page of pages) {
        const disabled = isNupDisabled(page);
        const value = effectiveNup(page);
        const hasBreak = !!(page && (page.groupBreak || page.group_break));
        if (disabled) {
          groups.push({ n: 1, pages: [page] });
          continue;
        }
        const last = groups[groups.length - 1];
        if (last && !isNupDisabled(last.pages[0]) && last.n === value && !hasBreak) {
          last.pages.push(page);
        } else {
          groups.push({ n: value, pages: [page] });
        }
      }
      return groups;
    };
    stable.__stableNupPriorityV6 = true;
    groupByNup = stable;
  }

  function removeLegacyRows() {
    document.querySelectorAll('.file-nup-row-v5,#fileNupOverridePanel').forEach((node) => node.remove());
  }

  function renderQuickGuide() {
    const grid = document.querySelector('.nup-grid');
    if (!grid) return;
    let guide = $('nupQuickGuide');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'nupQuickGuide';
      guide.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:10px;font-weight:800;line-height:1.55;';
      grid.insertAdjacentElement('afterend', guide);
    }
    guide.innerHTML = 'N-UP 우선순위: <b>페이지별 설정 → 파일별 설정 → 전체 기본값</b>. 파일별 배치는 페이지 목록의 파일 구분선에서 변경합니다.';
  }

  function renderPreviewPageLabels() {
    document.querySelectorAll('#previewScroll .page-preview').forEach((wrap, index) => {
      let label = wrap.querySelector('.page-label');
      if (!label) {
        label = document.createElement('div');
        label.className = 'page-label';
        label.style.cssText = 'font-size:11px;color:#475569;font-weight:900;text-align:center;padding:5px 2px 7px;background:#fff;border-top:1px solid #e5e7eb;';
        wrap.appendChild(label);
      }
      label.textContent = `${index + 1}p`;
    });
  }

  function patchDisplayPreview() {
    if (typeof displayPreview !== 'function' || displayPreview.__stableNupLabelsV6) return;
    const original = displayPreview;
    const wrapped = function displayPreviewWithLabels() {
      const result = original.apply(this, arguments);
      setTimeout(renderPreviewPageLabels, 0);
      return result;
    };
    wrapped.__stableNupLabelsV6 = true;
    displayPreview = wrapped;
  }

  function installResetHook() {
    const reset = $('resetBtn');
    if (!reset || reset.__stableNupResetV6) return;
    reset.__stableNupResetV6 = true;
    reset.addEventListener('click', () => {
      const map = fileMap();
      Object.keys(map).forEach((key) => delete map[key]);
    }, true);
  }

  function boot() {
    try {
      if (!ready()) return;
      fileMap();
      patchGroupByNup();
      patchDisplayPreview();
      installResetHook();
      removeLegacyRows();
      renderQuickGuide();
      renderPreviewPageLabels();
      window.PdfEditorNupResolver = { effectiveNup, pageOverride, fileIndexOf };
    } catch (error) {
      console.warn('[pdf-nup] compatibility helper failed', error);
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 400);
  setInterval(boot, 1500);
})();
