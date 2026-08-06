// Final confirmation dialog for the primary 300DPI cover PDF output.
(function () {
  'use strict';
  if (window.__coverFinalOutputConfirmV1) return;
  window.__coverFinalOutputConfirmV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const INSTALL_DELAYS = [0, 180, 420, 800, 1400, 2200, 3200];
  const BYPASS_ATTRIBUTE = 'data-cover-output-confirmed-once';
  let activeTrigger = null;
  let previousFocus = null;
  let installed = false;

  const byId = (id) => document.getElementById(id);
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const positive = (value, fallback) => {
    const number = finite(value, fallback);
    return number > 0 ? number : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function safeText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
  }

  function fallbackSpec() {
    const trimW = clamp(positive(byId('trimW')?.value, 210), 80, 300);
    const trimH = clamp(positive(byId('trimH')?.value, 297), 100, 450);
    const bleed = clamp(finite(byId('bleed')?.value, 3), 0, 10);
    const pageCount = Math.max(2, Math.round(finite(byId('pageCount')?.value, 160)));
    const manual = Boolean(byId('manualSpine')?.checked);
    const spine = manual
      ? Math.max(0, finite(byId('spineManual')?.value, 0))
      : Math.max(
        0,
        Math.ceil(pageCount / 2) * finite(byId('paperCaliper')?.value, 0.1)
          + finite(byId('bindingAdjust')?.value, 0.5),
      );
    return {
      trimW,
      trimH,
      bleed,
      spine,
      totalW: trimW * 2 + spine + bleed * 2,
      totalH: trimH + bleed * 2,
    };
  }

  function currentSpec() {
    try {
      if (typeof getSpec === 'function') return { ...fallbackSpec(), ...getSpec() };
    } catch (_) {}
    return fallbackSpec();
  }

  function outputFileName() {
    let stem = '';
    try {
      if (typeof window.safeName === 'function') stem = window.safeName();
    } catch (_) {}
    if (!stem) {
      try {
        stem = window.CoverProjectStateBridge?.primaryText?.('front') || '';
      } catch (_) {}
    }
    if (!stem) stem = byId('frontTitle')?.value || '';
    stem = safeText(stem, '책표지_작업')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 60) || '책표지_작업';
    return `${stem}_300DPI_RGB.pdf`;
  }

  function runCurrentPreflight() {
    const button = byId('runCoverPreflight') || byId('refreshCoverPreflight');
    try {
      const result = typeof button?.onclick === 'function' ? button.onclick() : null;
      if (Array.isArray(result)) return result;
    } catch (_) {}
    button?.click?.();
    return readRenderedPreflight();
  }

  function readRenderedPreflight() {
    const items = [];
    const list = byId('coverPreflightList');
    for (const row of list?.children || []) {
      const title = safeText(row.querySelector?.('strong')?.textContent);
      const detail = safeText(row.querySelector?.('div')?.textContent);
      const level = title.startsWith('✕') ? 'error' : title.startsWith('!') ? 'warn' : 'ok';
      items.push({ level, title: title.replace(/^[✕!✓]\s*/, ''), detail });
    }
    if (!items.length) {
      const summary = safeText(byId('coverPreflightSummary')?.textContent);
      if (summary.startsWith('출력 전 수정 필요')) {
        items.push({ level: 'error', title: '인쇄 전 점검 오류', detail: summary });
      } else if (summary) {
        items.push({ level: 'ok', title: '인쇄 전 점검', detail: summary });
      }
    }
    return items;
  }

  function summarizePreflight(items) {
    const source = Array.isArray(items) ? items : [];
    const errors = source.filter((item) => item?.level === 'error').length;
    const warnings = source.filter((item) => item?.level === 'warn').length;
    const normal = source.filter((item) => item?.level === 'ok').length;
    return {
      errors,
      warnings,
      normal,
      blocked: errors > 0,
      label: errors
        ? `오류 ${errors}개 · 주의 ${warnings}개`
        : warnings
          ? `출력 가능 · 주의 ${warnings}개`
          : `점검 완료 · 정상 ${normal}개`,
    };
  }

  function currentQuality() {
    try {
      const result = window.CoverImagePrintQuality?.update?.();
      if (result && typeof result === 'object') return result;
    } catch (_) {}
    return { front: null, back: null };
  }

  function qualityItem(result, label) {
    if (!result?.available) {
      return {
        label,
        level: 'empty',
        value: '이미지 없음',
        detail: '배경색만 출력',
      };
    }
    const dpi = Math.max(1, Math.round(finite(result.dpi, 0)));
    const grade = result.grade || {};
    return {
      label,
      level: safeText(grade.level, dpi >= 250 ? 'good' : dpi >= 180 ? 'caution' : 'low'),
      value: `${dpi}DPI`,
      detail: safeText(grade.label, dpi >= 250 ? '양호' : '확인 필요'),
    };
  }

  function outputSummary() {
    const spec = currentSpec();
    const preflightItems = runCurrentPreflight();
    const preflight = summarizePreflight(preflightItems);
    const quality = currentQuality();
    return {
      spec,
      preflight,
      preflightItems,
      quality: [
        qualityItem(quality.back, '뒤표지'),
        qualityItem(quality.front, '앞표지'),
      ],
      fileName: outputFileName(),
      pageCount: Math.max(2, Math.round(finite(byId('pageCount')?.value, 160))),
      imageFit: byId('imageFit')?.value === 'contain' ? '전체 보이기' : '자동 채우기',
    };
  }

  function installStyles() {
    if (byId('coverFinalOutputConfirmStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverFinalOutputConfirmStyles';
    style.textContent = `
      .cover-output-confirm[hidden]{display:none!important}
      .cover-output-confirm{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
      .cover-output-confirm-panel{width:min(520px,100%);max-height:min(720px,calc(100vh - 36px));overflow:auto;border:1px solid rgba(148,163,184,.5);border-radius:17px;background:#fff;box-shadow:0 26px 70px rgba(15,23,42,.32)}
      .cover-output-confirm-head{display:flex;align-items:flex-start;gap:12px;padding:16px 17px 13px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f8fbff,#ecfeff)}
      .cover-output-confirm-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff;font-size:15px;font-weight:900}
      .cover-output-confirm-title{font-size:15px;font-weight:950;color:#0f172a}
      .cover-output-confirm-sub{margin-top:4px;font-size:9px;line-height:1.5;color:#64748b}
      .cover-output-confirm-close{margin-left:auto;width:30px;height:30px;border:0;border-radius:8px;background:#fff;color:#64748b;font-size:18px;cursor:pointer}
      .cover-output-confirm-body{padding:14px 17px 4px}
      .cover-output-confirm-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
      .cover-output-confirm-stat{min-width:0;padding:9px;border:1px solid #dbe5ee;border-radius:10px;background:#f8fafc}
      .cover-output-confirm-stat span{display:block;font-size:8px;font-weight:850;color:#64748b}
      .cover-output-confirm-stat strong{display:block;margin-top:3px;font-size:12px;color:#172033;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cover-output-confirm-file{margin-top:8px;padding:9px 10px;border:1px solid #dbe5ee;border-radius:10px;background:#fff;font-size:9px;color:#475569;word-break:break-all}
      .cover-output-confirm-file strong{color:#12396d}
      .cover-output-confirm-section{margin-top:12px}
      .cover-output-confirm-section-title{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:10px;font-weight:900;color:#334155}
      .cover-output-confirm-status{border-radius:999px;padding:3px 7px;font-size:8px;font-weight:900}
      .cover-output-confirm-status[data-level="ok"]{background:#dcfce7;color:#166534}
      .cover-output-confirm-status[data-level="warn"]{background:#fef3c7;color:#92400e}
      .cover-output-confirm-status[data-level="error"]{background:#fee2e2;color:#b91c1c}
      .cover-output-confirm-quality{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .cover-output-confirm-quality-item{display:flex;align-items:center;gap:7px;padding:8px 9px;border:1px solid #e2e8f0;border-radius:9px;background:#fff}
      .cover-output-confirm-quality-item span{font-size:8px;font-weight:900;color:#64748b}
      .cover-output-confirm-quality-item strong{margin-left:auto;font-size:10px;color:#172033}
      .cover-output-confirm-quality-item em{font-style:normal;font-size:8px;color:#64748b}
      .cover-output-confirm-quality-item[data-level="danger"],.cover-output-confirm-quality-item[data-level="low"]{border-color:#fecaca;background:#fef2f2}
      .cover-output-confirm-quality-item[data-level="caution"]{border-color:#fde68a;background:#fffbeb}
      .cover-output-confirm-issues{display:grid;gap:5px;max-height:180px;overflow:auto}
      .cover-output-confirm-issue{padding:7px 8px;border-radius:8px;font-size:8px;line-height:1.45}
      .cover-output-confirm-issue[data-level="error"]{background:#fef2f2;color:#b91c1c}
      .cover-output-confirm-issue[data-level="warn"]{background:#fffbeb;color:#92400e}
      .cover-output-confirm-issue[data-level="ok"]{background:#f0fdf4;color:#166534}
      .cover-output-confirm-empty{padding:9px;border-radius:8px;background:#f0fdf4;color:#166534;font-size:9px;font-weight:850}
      .cover-output-confirm-actions{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1.4fr;gap:8px;padding:13px 17px 16px;border-top:1px solid #e2e8f0;background:rgba(255,255,255,.97)}
      .cover-output-confirm-button{min-height:41px;border-radius:10px;padding:9px 12px;font-size:11px;font-weight:900;cursor:pointer}
      .cover-output-confirm-cancel{border:1px solid #cbd5e1;background:#fff;color:#475569}
      .cover-output-confirm-create{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}
      .cover-output-confirm-create:disabled{background:#cbd5e1;color:#64748b;cursor:not-allowed}
      @media(max-width:520px){.cover-output-confirm{padding:8px;align-items:end}.cover-output-confirm-panel{max-height:calc(100vh - 16px);border-radius:16px 16px 0 0}.cover-output-confirm-summary{grid-template-columns:1fr 1fr}.cover-output-confirm-summary .cover-output-confirm-stat:last-child{grid-column:1/-1}.cover-output-confirm-quality{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    let dialog = byId('coverFinalOutputConfirm');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'coverFinalOutputConfirm';
    dialog.className = 'cover-output-confirm';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'coverFinalOutputConfirmTitle');
    dialog.innerHTML = `
      <section class="cover-output-confirm-panel" tabindex="-1">
        <header class="cover-output-confirm-head">
          <span class="cover-output-confirm-icon">PDF</span>
          <div><h2 class="cover-output-confirm-title" id="coverFinalOutputConfirmTitle">최종 출력 확인</h2><p class="cover-output-confirm-sub">인쇄소 제출용 300DPI RGB PDF를 만들기 전 마지막으로 확인합니다.</p></div>
          <button class="cover-output-confirm-close" id="coverFinalOutputConfirmClose" type="button" aria-label="최종 출력 확인 닫기">×</button>
        </header>
        <div class="cover-output-confirm-body">
          <div class="cover-output-confirm-summary" id="coverFinalOutputConfirmStats"></div>
          <div class="cover-output-confirm-file" id="coverFinalOutputConfirmFile"></div>
          <section class="cover-output-confirm-section">
            <div class="cover-output-confirm-section-title"><span>이미지 인쇄 품질</span><span>현재 확대율 기준</span></div>
            <div class="cover-output-confirm-quality" id="coverFinalOutputConfirmQuality"></div>
          </section>
          <section class="cover-output-confirm-section">
            <div class="cover-output-confirm-section-title"><span>인쇄 전 점검</span><span class="cover-output-confirm-status" id="coverFinalOutputConfirmStatus"></span></div>
            <div class="cover-output-confirm-issues" id="coverFinalOutputConfirmIssues"></div>
          </section>
        </div>
        <footer class="cover-output-confirm-actions">
          <button class="cover-output-confirm-button cover-output-confirm-cancel" id="coverFinalOutputConfirmCancel" type="button">계속 편집</button>
          <button class="cover-output-confirm-button cover-output-confirm-create" id="coverFinalOutputConfirmCreate" type="button">PDF 생성</button>
        </footer>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) closeDialog();
    });
    byId('coverFinalOutputConfirmClose')?.addEventListener('click', closeDialog);
    byId('coverFinalOutputConfirmCancel')?.addEventListener('click', closeDialog);
    byId('coverFinalOutputConfirmCreate')?.addEventListener('click', confirmOutput);
    return dialog;
  }

  function stat(label, value) {
    const item = document.createElement('div');
    item.className = 'cover-output-confirm-stat';
    const title = document.createElement('span');
    title.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(title, strong);
    return item;
  }

  function renderSummary(summary) {
    const stats = byId('coverFinalOutputConfirmStats');
    if (stats) {
      const spec = summary.spec;
      stats.replaceChildren(
        stat('완성 규격', `${finite(spec.trimW, 0).toFixed(1)} × ${finite(spec.trimH, 0).toFixed(1)}mm`),
        stat('책등 폭', `${finite(spec.spine, 0).toFixed(1)}mm`),
        stat('전체 펼침', `${finite(spec.totalW, 0).toFixed(1)} × ${finite(spec.totalH, 0).toFixed(1)}mm`),
        stat('재단 여백', `${finite(spec.bleed, 0).toFixed(1)}mm`),
        stat('본문 페이지', `${summary.pageCount.toLocaleString()}p`),
        stat('이미지 맞춤', summary.imageFit),
      );
    }

    const file = byId('coverFinalOutputConfirmFile');
    if (file) {
      file.replaceChildren();
      const strong = document.createElement('strong');
      strong.textContent = '저장 파일 · ';
      file.append(strong, document.createTextNode(summary.fileName));
    }

    const quality = byId('coverFinalOutputConfirmQuality');
    if (quality) {
      quality.replaceChildren();
      for (const item of summary.quality) {
        const row = document.createElement('div');
        row.className = 'cover-output-confirm-quality-item';
        row.dataset.level = item.level;
        const label = document.createElement('span');
        label.textContent = item.label;
        const value = document.createElement('strong');
        value.textContent = item.value;
        const detail = document.createElement('em');
        detail.textContent = item.detail;
        row.append(label, value, detail);
        quality.appendChild(row);
      }
    }

    const status = byId('coverFinalOutputConfirmStatus');
    if (status) {
      status.dataset.level = summary.preflight.blocked ? 'error' : summary.preflight.warnings ? 'warn' : 'ok';
      status.textContent = summary.preflight.label;
    }

    const issues = byId('coverFinalOutputConfirmIssues');
    if (issues) {
      issues.replaceChildren();
      const important = summary.preflightItems.filter((item) => item.level !== 'ok').slice(0, 8);
      if (!important.length) {
        const empty = document.createElement('div');
        empty.className = 'cover-output-confirm-empty';
        empty.textContent = '오류나 주의사항 없이 출력할 수 있습니다.';
        issues.appendChild(empty);
      } else {
        for (const item of important) {
          const row = document.createElement('div');
          row.className = 'cover-output-confirm-issue';
          row.dataset.level = item.level;
          row.textContent = `${item.level === 'error' ? '✕' : '!'} ${safeText(item.title, '확인 필요')}${item.detail ? ` · ${item.detail}` : ''}`;
          issues.appendChild(row);
        }
      }
    }

    const create = byId('coverFinalOutputConfirmCreate');
    if (create) {
      create.disabled = summary.preflight.blocked;
      create.textContent = summary.preflight.blocked ? '오류 수정 필요' : '300DPI PDF 생성';
    }
  }

  function openDialog(trigger) {
    installStyles();
    const dialog = ensureDialog();
    activeTrigger = trigger;
    previousFocus = document.activeElement;
    renderSummary(outputSummary());
    dialog.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    dialog.querySelector('.cover-output-confirm-panel')?.focus();
  }

  function closeDialog() {
    const dialog = byId('coverFinalOutputConfirm');
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.documentElement.style.removeProperty('overflow');
    activeTrigger = null;
    const focus = previousFocus;
    previousFocus = null;
    focus?.focus?.();
  }

  function confirmOutput() {
    const trigger = activeTrigger;
    if (!trigger || byId('coverFinalOutputConfirmCreate')?.disabled) return;
    trigger.setAttribute(BYPASS_ATTRIBUTE, '1');
    closeDialog();
    trigger.click();
  }

  function stopInitialOutput(event) {
    const trigger = event.currentTarget;
    if (trigger?.getAttribute(BYPASS_ATTRIBUTE) === '1') {
      trigger.removeAttribute(BYPASS_ATTRIBUTE);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    openDialog(trigger);
  }

  function handleKeydown(event) {
    const dialog = byId('coverFinalOutputConfirm');
    if (!dialog || dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDialog();
    }
  }

  function install() {
    installStyles();
    ensureDialog();
    const button = byId('pdfBtn');
    if (!button || button.dataset.coverFinalOutputConfirmV1 === '1') return false;
    button.dataset.coverFinalOutputConfirmV1 = '1';
    button.addEventListener('click', stopInitialOutput, { capture: true });
    if (!installed) {
      installed = true;
      document.addEventListener('keydown', handleKeydown, true);
    }
    return true;
  }

  window.CoverFinalOutputConfirm = {
    currentSpec,
    outputFileName,
    readRenderedPreflight,
    summarizePreflight,
    qualityItem,
    outputSummary,
    openDialog,
    closeDialog,
    install,
    stage: 'primary-pdf-final-confirmation',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
