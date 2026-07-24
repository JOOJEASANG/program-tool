// Booklet duplex-print guide and output-side source page labels.
(function () {
  'use strict';
  if (window.__pdfBookletPrintGuideV1) return;
  window.__pdfBookletPrintGuideV1 = true;

  const STORAGE_KEY = 'programToolPdfBookletFlipV1';
  const byId = (id) => document.getElementById(id);
  let displayPatched = false;
  let sessionPatched = false;
  let attempts = 0;
  let summaryObserver = null;

  function editorReady() {
    try {
      return Array.isArray(parsedPages) && typeof groupByNup === 'function' && typeof getLayout === 'function';
    } catch (_) {
      return false;
    }
  }

  function currentNup() {
    try { return Number(nup); } catch (_) { return Number(document.querySelector('.nup-btn.active')?.dataset.nup || 1); }
  }

  function bookletEnabled() {
    return !!byId('bookletCheck')?.checked;
  }

  function paperIsLandscape() {
    try {
      const settings = getSettings();
      return Number(settings.pw) > Number(settings.ph);
    } catch (_) {
      try { return !!landscape; } catch (_) { return false; }
    }
  }

  function recommendedFlip() {
    return paperIsLandscape() ? 'short' : 'long';
  }

  function flipLabel(value) {
    return value === 'short' ? '짧은쪽 넘김' : '긴쪽 넘김';
  }

  function savedFlip() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value === 'short' || value === 'long' ? value : null;
    } catch (_) { return null; }
  }

  function installStyles() {
    if (byId('pdfBookletPrintGuideStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfBookletPrintGuideStyles';
    style.textContent = `
      .booklet-print-guide{display:none;margin-top:7px;padding:9px 10px;border:1px solid #bfdbfe;border-radius:10px;background:linear-gradient(180deg,#eff6ff,#f8fbff);color:#1e3a8a}
      .booklet-print-guide.open{display:block}
      .booklet-print-guide-title{display:flex;align-items:center;justify-content:space-between;gap:7px;font-size:10px;font-weight:900;margin-bottom:7px}
      .booklet-print-guide-badge{font-size:8px;font-weight:900;padding:2px 6px;border-radius:999px;background:#dbeafe;color:#1d4ed8;white-space:nowrap}
      .booklet-flip-row{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:7px;margin-bottom:7px}
      .booklet-flip-row label{margin:0;font-size:9px;color:#475569;white-space:nowrap}
      .booklet-flip-row select{padding:6px 8px!important;font-size:10px!important;font-weight:800!important;border-radius:7px!important}
      .booklet-print-guide-steps{display:grid;gap:4px;font-size:9px;font-weight:700;line-height:1.45;color:#334155}
      .booklet-print-guide-step{display:flex;gap:6px;align-items:flex-start}
      .booklet-print-guide-step b{flex:0 0 17px;height:17px;border-radius:999px;background:#2563eb;color:#fff;display:flex;align-items:center;justify-content:center;font-size:8px}
      .booklet-print-guide-note{margin-top:7px;padding-top:7px;border-top:1px solid #bfdbfe;font-size:8px;font-weight:750;line-height:1.5;color:#64748b}
      #previewScroll .booklet-output-label{font-size:9px;line-height:1.45;color:#334155;font-weight:800;text-align:center;padding:5px 6px 7px;background:#f8fafc;border-top:1px solid #e2e8f0;max-width:100%;word-break:keep-all}
      #previewScroll .booklet-output-label strong{color:#1d4ed8}
      #previewScroll .booklet-output-label .back{color:#7c3aed}
    `;
    document.head.appendChild(style);
  }

  function ensureGuide() {
    const row = byId('bookletRow');
    if (!row) return null;
    let guide = byId('bookletPrintGuide');
    if (guide) return guide;
    guide = document.createElement('div');
    guide.id = 'bookletPrintGuide';
    guide.className = 'booklet-print-guide';
    guide.innerHTML = `
      <div class="booklet-print-guide-title"><span>소책자 양면 인쇄 안내</span><span class="booklet-print-guide-badge" id="bookletSheetCount">출력면 계산 중</span></div>
      <div class="booklet-flip-row">
        <label for="bookletFlipSelect">양면 넘김</label>
        <select id="bookletFlipSelect"><option value="short">짧은쪽 넘김</option><option value="long">긴쪽 넘김</option></select>
      </div>
      <div class="booklet-print-guide-steps">
        <div class="booklet-print-guide-step"><b>1</b><span>인쇄 배율은 <strong>실제 크기 또는 100%</strong>로 설정합니다.</span></div>
        <div class="booklet-print-guide-step"><b>2</b><span id="bookletFlipAdvice">양면 인쇄 넘김 방향을 확인합니다.</span></div>
        <div class="booklet-print-guide-step"><b>3</b><span>미리보기의 같은 용지 번호 앞면·뒷면을 한 장으로 인쇄한 뒤 절단하고 접습니다.</span></div>
      </div>
      <div class="booklet-print-guide-note">프린터 드라이버마다 긴쪽·짧은쪽 기준이 반대로 보일 수 있으므로 첫 용지 한 장을 먼저 테스트 출력하는 것이 안전합니다.</div>`;
    row.appendChild(guide);
    const select = byId('bookletFlipSelect');
    select.value = savedFlip() || recommendedFlip();
    select.addEventListener('change', () => {
      select.dataset.userSelected = '1';
      try { localStorage.setItem(STORAGE_KEY, select.value); } catch (_) {}
      updateGuide();
    });
    return guide;
  }

  function imposedPages() {
    if (!editorReady()) return [];
    const active = parsedPages.filter((page) => !page.excluded);
    if (bookletEnabled() && typeof bookletReorderPreview === 'function') {
      try { return bookletReorderPreview(active, currentNup()); } catch (_) {}
    }
    return active;
  }

  function outputPageGroups() {
    const pages = imposedPages();
    const outputs = [];
    for (const group of groupByNup(pages)) {
      const { cols, rows } = getLayout(group.n);
      const size = Math.max(1, cols * rows);
      for (let index = 0; index < group.pages.length; index += size) {
        outputs.push(group.pages.slice(index, index + size));
      }
    }
    return outputs;
  }

  function pageLabel(page) {
    if (!page || page._bookletBlank || page.pageType === 'blank') return '빈면';
    if (page.pageType === 'divider') return '간지';
    const listIndex = parsedPages.indexOf(page);
    return listIndex >= 0 ? String(listIndex + 1) : String(Number(page.page_index || 0) + 1);
  }

  function pageTitle(page) {
    if (!page || page._bookletBlank || page.pageType === 'blank') return '자동 추가 빈 페이지';
    if (page.pageType === 'divider') return `간지: ${page.dividerContent?.title || '제목 없음'}`;
    return `${page.sourceFile || '원본 PDF'} · 원본 ${Number(page.page_index || 0) + 1}페이지`;
  }

  function annotatePreview() {
    const groups = outputPageGroups();
    document.querySelectorAll('#previewScroll .page-preview').forEach((wrap, index) => {
      wrap.querySelector('.booklet-output-label')?.remove();
      const pages = groups[index] || [];
      const label = document.createElement('div');
      label.className = 'booklet-output-label';
      const sourceText = pages.map(pageLabel).join(' · ') || '빈면';
      if (bookletEnabled()) {
        const sheet = Math.floor(index / 2) + 1;
        const side = index % 2 === 0 ? '앞면' : '뒷면';
        label.innerHTML = `<strong class="${index % 2 ? 'back' : ''}">${sheet}번 용지 ${side}</strong><br>원본 ${sourceText}`;
      } else {
        label.textContent = `출력 ${index + 1}쪽 · 원본 ${sourceText}`;
      }
      label.title = pages.map(pageTitle).join('\n');
      wrap.appendChild(label);
    });
    updateGuide();
  }

  function updateGuide() {
    const guide = ensureGuide();
    if (!guide) return;
    const enabled = bookletEnabled();
    guide.classList.toggle('open', enabled);
    if (!enabled) return;

    const select = byId('bookletFlipSelect');
    const recommended = recommendedFlip();
    if (select && select.dataset.userSelected !== '1' && !savedFlip()) select.value = recommended;
    const selected = select?.value || recommended;
    const outputs = outputPageGroups().length;
    const sheets = Math.ceil(outputs / 2);
    byId('bookletSheetCount').textContent = `${outputs}면 · 용지 ${sheets}장`;
    const orientation = paperIsLandscape() ? '가로 용지' : '세로 용지';
    const recommendation = flipLabel(recommended);
    const selectedCopy = flipLabel(selected);
    byId('bookletFlipAdvice').innerHTML = `${orientation} 기준 권장은 <strong>${recommendation}</strong>입니다. 현재 선택: <strong>${selectedCopy}</strong>.`;
    updateSummaryWarning();
  }

  function patchDisplayPreview() {
    if (displayPatched) return true;
    if (typeof displayPreview !== 'function') return false;
    if (displayPreview.__bookletPrintGuidePatchedV1) {
      displayPatched = true;
      return true;
    }
    const original = displayPreview;
    const wrapped = function displayPreviewWithBookletLabels() {
      const result = original.apply(this, arguments);
      requestAnimationFrame(annotatePreview);
      return result;
    };
    wrapped.__bookletPrintGuidePatchedV1 = true;
    displayPreview = wrapped;
    window.displayPreview = wrapped;
    displayPatched = true;
    return true;
  }

  function patchSessionState() {
    if (sessionPatched) return true;
    if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
    const originalCollect = collectEditorState;
    const originalLoad = loadEditorSession;
    collectEditorState = function collectStateWithBookletPrintGuide() {
      const state = originalCollect();
      state.bookletFlip = byId('bookletFlipSelect')?.value || recommendedFlip();
      return state;
    };
    loadEditorSession = async function loadStateWithBookletPrintGuide(data, documentId) {
      const result = await originalLoad(data, documentId);
      try {
        const state = JSON.parse(data.state || '{}');
        const value = state.bookletFlip;
        const select = byId('bookletFlipSelect');
        if (select && (value === 'short' || value === 'long')) {
          select.value = value;
          select.dataset.userSelected = '1';
        }
      } catch (_) {}
      updateGuide();
      return result;
    };
    window.collectEditorState = collectEditorState;
    window.loadEditorSession = loadEditorSession;
    sessionPatched = true;
    return true;
  }

  function updateSummaryWarning() {
    const overlay = byId('pdfSaveSummaryOverlay');
    const warning = byId('pdfSummaryWarning');
    if (!overlay?.classList.contains('open') || !warning || !bookletEnabled()) return;
    const flip = flipLabel(byId('bookletFlipSelect')?.value || recommendedFlip());
    const extra = ` 양면 인쇄는 ${flip}으로 설정하고 첫 용지 한 장을 테스트 출력하세요.`;
    if (!warning.textContent.includes('첫 용지 한 장')) warning.textContent += extra;
  }

  function observeSummary() {
    const overlay = byId('pdfSaveSummaryOverlay');
    if (!overlay || summaryObserver) return;
    summaryObserver = new MutationObserver(updateSummaryWarning);
    summaryObserver.observe(overlay, { attributes: true, attributeFilter: ['class'] });
  }

  function installEvents() {
    if (window.__pdfBookletPrintGuideEventsV1) return;
    window.__pdfBookletPrintGuideEventsV1 = true;
    document.addEventListener('change', (event) => {
      if (event.target?.matches('#bookletCheck,#paperSize,#customW,#customH')) {
        setTimeout(() => { updateGuide(); annotatePreview(); }, 0);
      }
    }, true);
    document.addEventListener('click', (event) => {
      if (event.target?.closest('.nup-btn,.orient-btn')) setTimeout(() => { updateGuide(); annotatePreview(); }, 0);
    }, true);
  }

  function boot() {
    installStyles();
    ensureGuide();
    installEvents();
    observeSummary();
    const ready = editorReady();
    const displayReady = ready && patchDisplayPreview();
    const sessionReady = ready && patchSessionState();
    updateGuide();
    annotatePreview();
    if ((!ready || !displayReady || !sessionReady || !byId('pdfSaveSummaryOverlay')) && attempts < 14) {
      attempts += 1;
      setTimeout(boot, 170 + attempts * 60);
    }
  }

  window.PdfBookletPrintGuide = {
    annotatePreview,
    updateGuide,
    outputPageGroups,
    selectedFlip: () => byId('bookletFlipSelect')?.value || recommendedFlip(),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
