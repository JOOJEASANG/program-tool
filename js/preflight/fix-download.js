// Preflight fix download helper.
// Adds a free rule-based corrected PDF download button after inspection.
(function () {
  if (window.__preflightFixDownloadV1) return;
  window.__preflightFixDownloadV1 = true;

  function $(id) { return document.getElementById(id); }
  function hasIssues(report) {
    return !!(report && Array.isArray(report.checks) && report.checks.some((c) => c.severity === 'warning' || c.severity === 'fail'));
  }
  function ensureButton() {
    if ($('preflightFixBtn')) return $('preflightFixBtn');
    const resultsHeader = document.querySelector('.results-header');
    if (!resultsHeader) return null;
    const btn = document.createElement('button');
    btn.id = 'preflightFixBtn';
    btn.type = 'button';
    btn.className = 'run-btn';
    btn.style.marginLeft = '0';
    btn.style.marginTop = '10px';
    btn.style.display = 'none';
    btn.textContent = '보정 PDF 다운로드';
    const note = document.createElement('div');
    note.id = 'preflightFixNote';
    note.style.cssText = 'font-size:12px;color:#64748b;line-height:1.5;margin-top:6px;display:none;';
    note.textContent = '자동 보정은 페이지 규격 통일/파일 재정리 등 안전한 항목만 처리합니다. 저해상도 이미지나 없는 폰트는 원본 교체가 필요합니다.';
    resultsHeader.parentElement.insertBefore(btn, resultsHeader.nextSibling);
    btn.insertAdjacentElement('afterend', note);
    btn.onclick = runFix;
    return btn;
  }
  async function runFix() {
    try {
      if (!window.selectedFile) {
        const input = $('fileInput');
        if (!input || !input.files || !input.files[0]) return alert('먼저 PDF 파일을 업로드하세요.');
        window.selectedFile = input.files[0];
      }
      const btn = $('preflightFixBtn');
      if (btn) { btn.disabled = true; btn.textContent = '보정 중...'; }
      const blob = await apiPreflightFix(window.selectedFile);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const base = (window.selectedFile.name || 'document.pdf').replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${base}_fixed.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (btn) btn.textContent = '보정 PDF 다운로드';
      alert('보정 PDF를 다운로드했습니다. 다시 검수해서 남은 항목을 확인하세요.');
    } catch (e) {
      alert('보정 실패: ' + (e.message || e));
    } finally {
      const btn = $('preflightFixBtn');
      if (btn) { btn.disabled = false; btn.textContent = '보정 PDF 다운로드'; }
    }
  }
  function wrapRenderResults() {
    if (window.__preflightRenderWrapped || typeof window.renderResults !== 'function') return;
    const original = window.renderResults;
    window.renderResults = function wrappedRenderResults(report) {
      const result = original.apply(this, arguments);
      setTimeout(() => {
        const btn = ensureButton();
        const note = $('preflightFixNote');
        const show = hasIssues(report);
        if (btn) btn.style.display = show ? 'inline-flex' : 'none';
        if (note) note.style.display = show ? 'block' : 'none';
      }, 0);
      return result;
    };
    window.__preflightRenderWrapped = true;
  }
  function boot() { wrapRenderResults(); ensureButton(); }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
