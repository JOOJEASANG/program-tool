// Print-production readiness layer for PDF Utility.
// Converts technical preflight findings into practical print-room decisions
// without changing the underlying preflight score or PDF processing contract.
(function () {
  'use strict';
  if (window.__pdfPrintReadinessV1) return;
  window.__pdfPrintReadinessV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(
    path === '/pdf-preflight' ||
    path.endsWith('/pdf-preflight/index.html') ||
    path.endsWith('/tools/pdf-Checker.html') ||
    path.endsWith('/tools/preflight.html')
  )) return;

  const CRITICAL_IDS = new Set(['dpi', 'font_embed', 'page_size', 'bleed', 'safe_margin']);
  const PRIORITY = ['font_embed', 'dpi', 'page_size', 'bleed', 'safe_margin', 'color_mode', 'transparency', 'file_weight'];
  const ACTIONS = {
    font_embed: '원본 프로그램에서 PDF를 다시 만들 때 폰트 포함(임베딩) 옵션을 확인하세요.',
    dpi: '저해상도 이미지는 원본 이미지 교체 또는 더 높은 품질로 다시 내보내는 것이 가장 안전합니다.',
    page_size: 'PDF 편집기에서 페이지 규격과 방향을 확인하고 출력 규격을 하나로 맞추세요.',
    bleed: '재단 인쇄물이라면 배경·이미지가 재단선 바깥 도련 영역까지 이어지는지 확인하세요.',
    safe_margin: '중요 글자와 로고는 재단선 안쪽 안전영역으로 이동하세요.',
    color_mode: '일반 디지털 출력은 샘플 확인, 오프셋 인쇄는 CMYK 변환 여부를 인쇄소와 확인하세요.',
    transparency: '투명도·그림자·블렌딩이 많은 페이지는 실제 출력 전 샘플 출력으로 확인하세요.',
    file_weight: '파일이 무거우면 PDF 정상화 또는 용량 줄이기를 먼저 실행한 뒤 다시 검사하세요.',
  };

  const fileKey = (file) => `${file?.name || ''}|${Number(file?.size || 0)}|${Number(file?.lastModified || 0)}`;
  const byId = (report) => new Map((Array.isArray(report?.checks) ? report.checks : []).map((item) => [item.id, item]));

  function installStyles() {
    if (document.getElementById('pdfPrintReadinessStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfPrintReadinessStyles';
    style.textContent = `
      .ppr-panel{display:none;margin-top:20px;background:linear-gradient(180deg,#fff,#f8fbfd);border:1px solid #cbdbe6;border-radius:18px;padding:18px;box-shadow:0 10px 26px rgba(15,23,42,.06)}
      .ppr-panel.show{display:block}.ppr-head{display:flex;align-items:flex-start;gap:11px;margin-bottom:14px}.ppr-icon{width:39px;height:39px;border-radius:11px;background:#e6f6f8;display:grid;place-items:center;font-size:20px;flex:0 0 auto}.ppr-title{font-size:16px;font-weight:950;color:#12396d}.ppr-sub{font-size:10px;color:#64748b;line-height:1.5;margin-top:3px;word-break:break-all}
      .ppr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.ppr-card{border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:12px}.ppr-card-title{font-size:10px;font-weight:900;color:#64748b;margin-bottom:6px}.ppr-card strong{display:block;font-size:12px;font-weight:950;line-height:1.4}.ppr-card small{display:block;font-size:9px;color:#64748b;line-height:1.55;margin-top:5px}.ppr-card.ready strong{color:#15803d}.ppr-card.warn strong{color:#a16207}.ppr-card.fail strong{color:#dc2626}.ppr-card.info strong{color:#1d4ed8}
      .ppr-priority{margin-top:12px;border-top:1px solid #e7edf3;padding-top:12px}.ppr-priority-title{font-size:11px;font-weight:950;color:#334155;margin-bottom:7px}.ppr-list{display:grid;gap:6px}.ppr-item{display:grid;grid-template-columns:7px minmax(0,1fr);gap:8px;align-items:start;border-radius:9px;background:#f8fafc;padding:8px 9px}.ppr-dot{width:7px;height:7px;border-radius:50%;margin-top:4px;background:#d97706}.ppr-item.fail .ppr-dot{background:#dc2626}.ppr-item strong{font-size:10px}.ppr-item p{font-size:9px;color:#64748b;line-height:1.5;margin-top:2px}.ppr-empty{font-size:10px;color:#15803d;font-weight:850;background:#f0fdf4;border:1px solid #dcfce7;border-radius:9px;padding:9px 10px}
      .ppr-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.ppr-btn{border-radius:9px;padding:8px 11px;font-size:10px;font-weight:900;text-decoration:none;cursor:pointer}.ppr-btn.main{border:0;background:#12396d;color:#fff}.ppr-btn.soft{border:1px solid #cbd5e1;background:#fff;color:#475569}
      @media(max-width:820px){.ppr-grid{grid-template-columns:1fr}.ppr-actions{flex-direction:column}.ppr-btn{text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function makePanel() {
    let panel = document.getElementById('pdfPrintReadiness');
    if (panel) return panel;
    const anchor = document.getElementById('results');
    if (!anchor) return null;
    panel = document.createElement('section');
    panel.id = 'pdfPrintReadiness';
    panel.className = 'ppr-panel';
    panel.innerHTML = `
      <div class="ppr-head"><div class="ppr-icon">🖨️</div><div><div class="ppr-title">인쇄 실무 판정</div><div class="ppr-sub" id="pprFileName"></div></div></div>
      <div class="ppr-grid" id="pprGrid"></div>
      <div class="ppr-priority"><div class="ppr-priority-title">출력 전 우선 확인</div><div class="ppr-list" id="pprPriorityList"></div></div>
      <div class="ppr-actions"><a class="ppr-btn main" href="/pdf-editor/">PDF 편집기에서 페이지 정리</a><button class="ppr-btn soft" id="pprDetailBtn" type="button">기술 검사 상세 보기</button></div>
    `;
    anchor.insertAdjacentElement('beforebegin', panel);
    panel.querySelector('#pprDetailBtn')?.addEventListener('click', () => {
      document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return panel;
  }

  function readiness(report) {
    const checks = Array.isArray(report?.checks) ? report.checks : [];
    const fails = checks.filter((item) => item.severity === 'fail');
    const warnings = checks.filter((item) => item.severity === 'warning');
    const criticalWarnings = warnings.filter((item) => CRITICAL_IDS.has(item.id));
    if (fails.length) return { cls: 'fail', title: '수정 후 출력 권장', detail: `불량 ${fails.length}건이 있습니다. 그대로 출력하기 전에 원본 또는 PDF를 수정하세요.` };
    if (criticalWarnings.length) return { cls: 'warn', title: '출력 전 확인 필요', detail: `규격·해상도·재단 관련 경고 ${criticalWarnings.length}건을 먼저 확인하세요.` };
    if (warnings.length) return { cls: 'warn', title: '샘플 출력 권장', detail: `치명적 오류는 없지만 경고 ${warnings.length}건이 있어 첫 장 또는 대표 페이지 샘플 출력을 권장합니다.` };
    return { cls: 'ready', title: '일반 출력 준비 양호', detail: '현재 자동검사 범위에서 즉시 수정이 필요한 문제는 발견되지 않았습니다.' };
  }

  function duplexAdvice(pageCount) {
    if (pageCount <= 0) return { cls: 'info', title: '페이지 수 확인 필요', detail: '페이지 수를 확인하지 못했습니다.' };
    if (pageCount % 2 === 0) return { cls: 'ready', title: `${pageCount}쪽 · 양면 짝수 구성`, detail: '앞·뒤 한 쌍으로 떨어지는 페이지 수입니다.' };
    return { cls: 'info', title: `${pageCount}쪽 · 마지막 뒷면 공백`, detail: '양면 출력하면 마지막 장의 뒷면은 비게 됩니다. 의도한 구성인지 확인하세요.' };
  }

  function bookletAdvice(pageCount) {
    if (pageCount <= 0) return { cls: 'info', title: '페이지 수 확인 필요', detail: '중철 계산을 위해 페이지 수가 필요합니다.' };
    const add = (4 - (pageCount % 4)) % 4;
    if (!add) return { cls: 'ready', title: `${pageCount}쪽 · 중철 4의 배수`, detail: '페이지 수 기준으로 중철 소책자 배열이 가능합니다.' };
    return { cls: 'warn', title: `중철 시 빈 페이지 ${add}쪽 필요`, detail: `${pageCount}쪽을 ${pageCount + add}쪽으로 맞추면 4의 배수가 됩니다. 빈 페이지 위치는 제본 구성에 맞춰 확인하세요.` };
  }

  function card(title, advice) {
    const node = document.createElement('div');
    node.className = `ppr-card ${advice.cls}`;
    const label = document.createElement('div');
    label.className = 'ppr-card-title';
    label.textContent = title;
    const strong = document.createElement('strong');
    strong.textContent = advice.title;
    const small = document.createElement('small');
    small.textContent = advice.detail;
    node.append(label, strong, small);
    return node;
  }

  function priorityItems(report) {
    const checks = Array.isArray(report?.checks) ? report.checks : [];
    return checks
      .filter((item) => item.severity === 'fail' || item.severity === 'warning')
      .sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'fail' ? -1 : 1;
        return PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id);
      })
      .slice(0, 6);
  }

  function render() {
    const utility = window.PdfUtility;
    const panel = makePanel();
    if (!utility || !panel) return;
    const files = Array.isArray(utility.state?.files) ? utility.state.files : [];
    const index = Math.max(0, Math.min(files.length - 1, Number(utility.state?.activeIndex || 0)));
    const file = files[index];
    const report = file ? utility.state?.reports?.get(fileKey(file)) : null;
    if (!file || !report) {
      panel.classList.remove('show');
      return;
    }

    panel.classList.add('show');
    const fileName = document.getElementById('pprFileName');
    if (fileName) fileName.textContent = `${file.name} · ${Number(report.page_count || 0)}페이지 기준`;

    const grid = document.getElementById('pprGrid');
    if (grid) {
      grid.replaceChildren(
        card('일반 인쇄', readiness(report)),
        card('양면 출력', duplexAdvice(Number(report.page_count || 0))),
        card('중철 · 소책자', bookletAdvice(Number(report.page_count || 0)))
      );
    }

    const list = document.getElementById('pprPriorityList');
    if (!list) return;
    list.replaceChildren();
    const items = priorityItems(report);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'ppr-empty';
      empty.textContent = '우선 수정이 필요한 항목이 없습니다. 최종 출력 전 실제 용지·프린터 설정만 확인하세요.';
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement('div');
      row.className = `ppr-item ${item.severity === 'fail' ? 'fail' : 'warn'}`;
      const dot = document.createElement('span');
      dot.className = 'ppr-dot';
      const body = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = `${item.severity === 'fail' ? '수정' : '확인'} · ${item.label}`;
      const detail = document.createElement('p');
      const action = ACTIONS[item.id] || item.detail || '검사 상세 내용을 확인하세요.';
      const refs = Array.isArray(item.page_refs) && item.page_refs.length ? ` 문제 페이지: ${item.page_refs.slice(0, 12).join(', ')}${item.page_refs.length > 12 ? '…' : ''}.` : '';
      detail.textContent = `${action}${refs}`;
      body.append(title, detail);
      row.append(dot, body);
      list.appendChild(row);
    }
  }

  function observeUtility() {
    const utility = window.PdfUtility;
    if (!utility) return false;
    installStyles();
    makePanel();
    render();

    const target = document.querySelector('.container') || document.body;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        render();
      });
    });
    observer.observe(target, { childList: true, subtree: true, characterData: true });
    document.addEventListener('click', (event) => {
      if (event.target.closest('.pdfu-file-row,.pdfu-detail-btn,#checkBtn')) setTimeout(render, 0);
    });
    window.PdfPrintReadiness = { render, readiness, duplexAdvice, bookletAdvice, stage: 'print-ops-stage1' };
    document.documentElement.dataset.pdfPrintReadiness = '1';
    return true;
  }

  let attempts = 0;
  function install() {
    attempts += 1;
    if (observeUtility()) return;
    if (attempts < 80) setTimeout(install, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
