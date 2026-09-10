(() => {
  'use strict';
  if (window.__programStudioManualContextLink) return;
  window.__programStudioManualContextLink = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  const programId = path.startsWith('/pdf-editor-advanced') ? 'pdf-editor-advanced'
    : path.startsWith('/pdf-editor') ? 'pdf-editor'
    : path.startsWith('/smart-print-layout') ? 'smart-print-layout'
    : path.startsWith('/print-checker') ? 'print-checker'
    : (path.startsWith('/pdf-suite') || path.startsWith('/pdf-preflight')) ? 'pdf-suite'
    : '';
  if (!programId) return;

  function install() {
    if (document.getElementById('programManualContextLink')) return;
    const style = document.createElement('style');
    style.id = 'programManualContextStyle';
    style.textContent = `
      #programManualContextLink{position:fixed;right:16px;bottom:16px;z-index:1800;display:flex;align-items:center;gap:7px;min-height:38px;padding:0 12px;border:1px solid #cbd7e3;border-radius:999px;background:rgba(255,255,255,.96);box-shadow:0 8px 26px rgba(15,23,42,.16);color:#173b63;text-decoration:none;font:850 11px Pretendard,"Noto Sans KR",sans-serif;backdrop-filter:blur(8px);transition:transform .14s ease,box-shadow .14s ease}
      #programManualContextLink:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(15,23,42,.2)}
      #programManualContextLink .manual-q{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:#1d4ed8;color:#fff;font-size:12px;font-weight:950}
      @media(max-width:720px){#programManualContextLink{right:10px;bottom:10px;padding:0 10px;min-height:36px}#programManualContextLink .manual-label{display:none}}
      @media(prefers-reduced-motion:reduce){#programManualContextLink{transition:none}}
      @media print{#programManualContextLink{display:none!important}}
    `;
    document.head.appendChild(style);

    const link = document.createElement('a');
    link.id = 'programManualContextLink';
    link.href = `/guide.html?program=${encodeURIComponent(programId)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', '현재 프로그램 상세 사용설명서 열기');
    const q = document.createElement('span');
    q.className = 'manual-q';
    q.textContent = '?';
    const label = document.createElement('span');
    label.className = 'manual-label';
    label.textContent = '사용설명서';
    link.append(q, label);
    document.body.appendChild(link);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
