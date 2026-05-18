// PDF checker report download + issue page preview helper.
(function () {
  if (window.__pdfCheckerReportHelperV1) return;
  window.__pdfCheckerReportHelperV1 = true;

  let lastReport = null;
  let lastPdfDoc = null;
  let loadingPdf = null;

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value ?? '').replace(/[<>&"']/g, (ch) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function uniqueIssuePages(report) {
    const set = new Set();
    (report?.checks || []).forEach((check) => {
      if (check.severity === 'pass') return;
      (check.page_refs || []).forEach((p) => {
        const n = Number.parseInt(p, 10);
        if (Number.isFinite(n) && n > 0) set.add(n);
      });
    });
    return [...set].sort((a, b) => a - b);
  }
  function issueSummary(report) {
    const checks = Array.isArray(report?.checks) ? report.checks : [];
    return {
      pass: checks.filter((c) => c.severity === 'pass').length,
      warning: checks.filter((c) => c.severity === 'warning').length,
      fail: checks.filter((c) => c.severity === 'fail').length,
    };
  }
  function ensureActions() {
    if ($('checkerActionPanel')) return $('checkerActionPanel');
    const results = $('results');
    if (!results) return null;
    const panel = document.createElement('div');
    panel.id = 'checkerActionPanel';
    panel.style.cssText = 'display:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 18px;margin:-4px 0 16px;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <div style="font-size:14px;font-weight:900;color:#0f172a;">검수 후 작업</div>
          <div id="checkerActionSummary" style="font-size:12px;color:#64748b;line-height:1.5;margin-top:3px;"></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" id="checkerReportPdfBtn" class="run-btn" style="margin:0;padding:9px 14px;font-size:12px;">검수 리포트 PDF 저장</button>
          <button type="button" id="checkerPreviewFirstIssueBtn" class="run-btn" style="margin:0;padding:9px 14px;font-size:12px;background:#0f766e;">문제 페이지 보기</button>
        </div>
      </div>
      <div id="checkerIssuePages" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px;"></div>
      <div id="checkerPagePreview" style="display:none;margin-top:12px;border-top:1px dashed #cbd5e1;padding-top:12px;"></div>`;
    results.insertBefore(panel, results.firstChild ? results.children[1] || null : null);
    $('checkerReportPdfBtn').onclick = downloadReportPdf;
    $('checkerPreviewFirstIssueBtn').onclick = () => {
      const pages = uniqueIssuePages(lastReport);
      if (pages.length) showPagePreview(pages[0]);
      else alert('문제 페이지가 없습니다.');
    };
    return panel;
  }
  function renderActions(report) {
    lastReport = report;
    const panel = ensureActions();
    if (!panel || !report) return;
    const pages = uniqueIssuePages(report);
    const summary = issueSummary(report);
    $('checkerActionSummary').textContent = `점수 ${report.score}점 · 통과 ${summary.pass}개 · 경고 ${summary.warning}개 · 불량 ${summary.fail}개`;
    const pageBox = $('checkerIssuePages');
    if (pages.length) {
      pageBox.innerHTML = '<span style="font-size:12px;font-weight:900;color:#334155;margin-right:2px;">문제 페이지</span>'
        + pages.map((p) => `<button type="button" class="checker-page-btn" data-page="${p}" style="border:1px solid #cbd5e1;background:#f8fafc;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:800;color:#334155;cursor:pointer;">${p}p</button>`).join('');
      pageBox.querySelectorAll('.checker-page-btn').forEach((btn) => {
        btn.onclick = () => showPagePreview(Number(btn.dataset.page));
      });
    } else {
      pageBox.innerHTML = '<span style="font-size:12px;color:#16a34a;font-weight:800;">문제 페이지가 없습니다.</span>';
    }
    $('checkerPreviewFirstIssueBtn').style.display = pages.length ? 'inline-flex' : 'none';
    panel.style.display = 'block';
  }
  async function loadScript(src) {
    const clean = src.split('?')[0];
    if ([...document.scripts].some((s) => s.src && s.src.includes(clean))) return;
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  async function ensureJsPdf() {
    if (window.jspdf?.jsPDF) return window.jspdf.jsPDF;
    await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');
    return window.jspdf.jsPDF;
  }
  function reportLines(report) {
    const s = issueSummary(report);
    const lines = [
      ['파일명', report.filename || '-'],
      ['페이지 수', String(report.page_count || 0)],
      ['점수', String(report.score ?? '-')],
      ['요약', `통과 ${s.pass}개 / 경고 ${s.warning}개 / 불량 ${s.fail}개`],
      ['검수일시', new Date().toLocaleString('ko-KR')],
    ];
    return lines;
  }
  async function downloadReportPdf() {
    if (!lastReport) return alert('먼저 PDF 검수를 실행하세요.');
    try {
      const jsPDF = await ensureJsPdf();
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const margin = 14;
      let y = 18;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('PDF Checker Report', margin, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('PDF file quality inspection report', margin, y);
      y += 10;

      reportLines(lastReport).forEach(([k, v]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(String(k), margin, y);
        doc.setFont('helvetica', 'normal');
        doc.text(String(v).slice(0, 90), margin + 32, y);
        y += 6;
      });

      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Check details', margin, y);
      y += 8;
      doc.setFontSize(9);
      (lastReport.checks || []).forEach((check, idx) => {
        if (y > 275) { doc.addPage(); y = 18; }
        const severity = check.severity === 'pass' ? 'PASS' : check.severity === 'warning' ? 'WARNING' : 'FAIL';
        const pages = (check.page_refs || []).length ? ` / pages: ${(check.page_refs || []).join(', ')}` : '';
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}. [${severity}] ${String(check.label || '').slice(0, 48)}`, margin, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const wrapped = doc.splitTextToSize(String(check.detail || ''), 180);
        wrapped.slice(0, 4).forEach((line) => { doc.text(line, margin + 4, y); y += 4.5; });
        if (pages) { doc.text(pages.slice(0, 160), margin + 4, y); y += 4.5; }
        y += 2;
      });
      const base = String(lastReport.filename || 'pdf').replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9가-힣_-]+/g, '_');
      doc.save(`${base}_검수리포트.pdf`);
    } catch (e) {
      alert('리포트 PDF 저장 실패: ' + (e.message || e));
    }
  }
  async function ensurePdfJs() {
    if (!window.pdfjsLib) {
      await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    }
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
  }
  async function getPdfDoc() {
    if (lastPdfDoc) return lastPdfDoc;
    const file = window.selectedFile || $('fileInput')?.files?.[0];
    if (!file) throw new Error('PDF 파일을 다시 선택해 주세요.');
    if (loadingPdf) return loadingPdf;
    loadingPdf = (async () => {
      await ensurePdfJs();
      const buf = await file.arrayBuffer();
      lastPdfDoc = await window.pdfjsLib.getDocument({ data: buf }).promise;
      return lastPdfDoc;
    })();
    return loadingPdf;
  }
  async function showPagePreview(pageNo) {
    const box = $('checkerPagePreview');
    if (!box) return;
    box.style.display = 'block';
    box.innerHTML = '<div style="font-size:13px;font-weight:900;color:#334155;margin-bottom:8px;">문제 페이지 미리보기</div><div style="font-size:12px;color:#64748b;">렌더링 중...</div>';
    try {
      const doc = await getPdfDoc();
      const safePageNo = Math.max(1, Math.min(Number(pageNo) || 1, doc.numPages));
      const page = await doc.getPage(safePageNo);
      const viewport0 = page.getViewport({ scale: 1 });
      const maxW = Math.min(620, box.clientWidth || 620);
      const scale = Math.max(0.3, Math.min(1.8, maxW / viewport0.width));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      box.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap;"><div style="font-size:13px;font-weight:900;color:#334155;">${safePageNo}페이지 미리보기</div><div style="font-size:12px;color:#64748b;">문제 위치 확인용 미리보기입니다.</div></div>`;
      canvas.style.cssText = 'max-width:100%;height:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 22px rgba(15,23,42,.12);';
      box.appendChild(canvas);
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) {
      box.innerHTML = '<div style="font-size:13px;color:#dc2626;font-weight:800;">미리보기 실패: ' + esc(e.message || e) + '</div>';
    }
  }
  function wrapRenderResults() {
    if (window.__pdfCheckerRenderWrappedV1 || typeof window.renderResults !== 'function') return;
    const original = window.renderResults;
    window.renderResults = function wrappedCheckerRenderResults(report) {
      lastPdfDoc = null;
      loadingPdf = null;
      const result = original.apply(this, arguments);
      setTimeout(() => renderActions(report), 0);
      return result;
    };
    window.__pdfCheckerRenderWrappedV1 = true;
  }
  function boot() {
    wrapRenderResults();
    ensureActions();
  }
  document.addEventListener('DOMContentLoaded', boot);
  setInterval(boot, 1000);
})();
