// PDF editor N-UP helper: stable guidance, booklet print guide, and output-source labels.
(function () {
  'use strict';
  if (window.__pdfEditorNupHelperV8) return;
  window.__pdfEditorNupHelperV8 = true;

  const STORAGE_KEY = 'programToolPdfBookletFlipV2';
  const byId = (id) => document.getElementById(id);
  window.__pdfEditorFileNupMapV5 = window.__pdfEditorFileNupMapV5 || {};

  let thumbObserver = null;
  let previewObserver = null;
  let annotationFrame = 0;
  let annotationRunning = false;
  let sessionBridgeInstalled = false;
  let bootAttempts = 0;

  function editorReady() {
    try {
      return Array.isArray(parsedPages)
        && Array.isArray(uploadedFiles)
        && typeof groupByNup === 'function'
        && typeof getLayout === 'function';
    } catch (_) {
      return false;
    }
  }

  function currentNup() {
    try {
      return Number(nup);
    } catch (_) {
      return Number(document.querySelector('.nup-btn.active')?.dataset.nup || 1);
    }
  }

  function bookletEnabled() {
    return Boolean(byId('bookletCheck')?.checked);
  }

  function paperIsLandscape() {
    try {
      const settings = getSettings();
      return Number(settings.pw) > Number(settings.ph);
    } catch (_) {
      try {
        return Boolean(landscape);
      } catch (_) {
        return false;
      }
    }
  }

  function recommendedFlip() {
    return paperIsLandscape() ? 'short' : 'long';
  }

  function validFlip(value) {
    return value === 'short' || value === 'long';
  }

  function flipLabel(value) {
    return value === 'short' ? '짧은쪽 넘김' : '긴쪽 넘김';
  }

  function readSavedFlip() {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return validFlip(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeSavedFlip(value) {
    if (!validFlip(value)) return;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (_) {}
  }

  function cleanupLegacyRows() {
    document.querySelectorAll('.file-nup-row-v5,#fileNupOverridePanel').forEach((element) => element.remove());
  }

  function updateThumbnailHint() {
    const hint = document.querySelector('#sb-pages .thumb-hint');
    if (hint) hint.textContent = '클릭=미리보기 이동 · 우클릭=페이지 메뉴 · 드래그=순서 변경 · 배지=개별 설정';
  }

  function renderQuickGuide() {
    const nupGrid = document.querySelector('.nup-grid');
    if (!nupGrid) return;
    let guide = byId('nupQuickGuide');
    if (!guide) {
      guide = document.createElement('div');
      guide.id = 'nupQuickGuide';
      guide.style.cssText = 'margin-top:8px;padding:8px 10px;border-radius:9px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e3a8a;font-size:10px;font-weight:800;line-height:1.55;';
      nupGrid.insertAdjacentElement('afterend', guide);
    }
    guide.textContent = 'N-up 안내: 선택한 기본 배치는 전체 활성 페이지에 적용됩니다. 페이지 배지를 누르면 해당 페이지만 별도 배치할 수 있습니다.';
  }

  function installStyles() {
    if (byId('pdfBookletPrintGuideStylesV2')) return;
    const style = document.createElement('style');
    style.id = 'pdfBookletPrintGuideStylesV2';
    style.textContent = `
      .booklet-print-guide-v2{display:none;margin-top:8px;padding:10px;border:1px solid #bfdbfe;border-radius:10px;background:linear-gradient(180deg,#eff6ff,#f8fbff);color:#1e3a8a}
      .booklet-print-guide-v2.open{display:block}
      .booklet-guide-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;font-size:10px;font-weight:900}
      .booklet-guide-count{flex:0 0 auto;padding:2px 7px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:9px;white-space:nowrap}
      .booklet-guide-flip{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px;margin-bottom:8px}
      .booklet-guide-flip label{margin:0;font-size:10px;color:#475569;white-space:nowrap}
      .booklet-guide-flip select{min-width:0;padding:6px 8px!important;font-size:10px!important;font-weight:800!important;border-radius:7px!important}
      .booklet-guide-steps{display:grid;gap:5px;color:#334155;font-size:9px;font-weight:700;line-height:1.5}
      .booklet-guide-step{display:flex;align-items:flex-start;gap:6px}
      .booklet-guide-step b{display:flex;flex:0 0 18px;align-items:center;justify-content:center;height:18px;border-radius:999px;background:#2563eb;color:#fff;font-size:8px}
      .booklet-guide-note{margin-top:8px;padding-top:7px;border-top:1px solid #bfdbfe;color:#64748b;font-size:8px;font-weight:750;line-height:1.55}
      #previewScroll .pdf-output-source-label{max-width:100%;padding:5px 6px 7px;border-top:1px solid #e2e8f0;background:#f8fafc;color:#334155;font-size:9px;font-weight:800;line-height:1.45;text-align:center;word-break:keep-all}
      #previewScroll .pdf-output-source-label strong{color:#1d4ed8}
      #previewScroll .pdf-output-source-label strong.back{color:#7c3aed}
    `;
    document.head.appendChild(style);
  }

  function ensureBookletGuide() {
    const row = byId('bookletRow');
    if (!row) return null;
    let guide = byId('bookletPrintGuideV2');
    if (guide) return guide;

    guide = document.createElement('div');
    guide.id = 'bookletPrintGuideV2';
    guide.className = 'booklet-print-guide-v2';

    const head = document.createElement('div');
    head.className = 'booklet-guide-head';
    const title = document.createElement('span');
    title.textContent = '소책자 양면 인쇄 안내';
    const count = document.createElement('span');
    count.id = 'bookletSheetCountV2';
    count.className = 'booklet-guide-count';
    count.textContent = '출력면 계산 중';
    head.append(title, count);

    const flipRow = document.createElement('div');
    flipRow.className = 'booklet-guide-flip';
    const flipLabelElement = document.createElement('label');
    flipLabelElement.htmlFor = 'bookletFlipSelectV2';
    flipLabelElement.textContent = '양면 넘김';
    const select = document.createElement('select');
    select.id = 'bookletFlipSelectV2';
    select.setAttribute('aria-label', '소책자 양면 인쇄 넘김 방향');
    const shortOption = document.createElement('option');
    shortOption.value = 'short';
    shortOption.textContent = '짧은쪽 넘김';
    const longOption = document.createElement('option');
    longOption.value = 'long';
    longOption.textContent = '긴쪽 넘김';
    select.append(shortOption, longOption);
    select.value = readSavedFlip() || recommendedFlip();
    select.addEventListener('change', () => {
      select.dataset.userSelected = 'true';
      writeSavedFlip(select.value);
      updateBookletGuide();
    });
    flipRow.append(flipLabelElement, select);

    const steps = document.createElement('div');
    steps.className = 'booklet-guide-steps';
    const stepTexts = [
      '인쇄 배율은 실제 크기 또는 100%로 설정합니다.',
      '양면 인쇄 넘김 방향을 확인합니다.',
      '같은 용지 번호의 앞면·뒷면을 한 장으로 출력한 뒤 절단하고 접습니다.',
    ];
    stepTexts.forEach((text, index) => {
      const step = document.createElement('div');
      step.className = 'booklet-guide-step';
      const number = document.createElement('b');
      number.textContent = String(index + 1);
      const copy = document.createElement('span');
      copy.id = index === 1 ? 'bookletFlipAdviceV2' : '';
      copy.textContent = text;
      step.append(number, copy);
      steps.appendChild(step);
    });

    const note = document.createElement('div');
    note.className = 'booklet-guide-note';
    note.textContent = '프린터 드라이버마다 긴쪽·짧은쪽 기준이 다를 수 있으므로 첫 용지 한 장을 먼저 테스트 출력하는 것이 안전합니다.';

    guide.append(head, flipRow, steps, note);
    row.appendChild(guide);
    return guide;
  }

  function imposedPages() {
    if (!editorReady()) return [];
    const active = parsedPages.filter((page) => !page.excluded);
    if (bookletEnabled() && typeof bookletReorderPreview === 'function') {
      try {
        return bookletReorderPreview(active, currentNup()) || active;
      } catch (error) {
        console.warn('[pdf-nup] booklet order could not be read', error);
      }
    }
    return active;
  }

  function outputPageGroups() {
    if (!editorReady()) return [];
    const pages = imposedPages();
    const outputs = [];
    for (const group of groupByNup(pages)) {
      const layout = getLayout(group.n);
      const size = Math.max(1, Number(layout?.cols || 1) * Number(layout?.rows || 1));
      for (let index = 0; index < group.pages.length; index += size) {
        outputs.push(group.pages.slice(index, index + size));
      }
    }
    return outputs;
  }

  function pageListLabel(page) {
    if (!page || page._bookletBlank || page.pageType === 'blank') return '빈면';
    if (page.pageType === 'divider') return '간지';
    const listIndex = parsedPages.indexOf(page);
    return listIndex >= 0 ? String(listIndex + 1) : String(Number(page.page_index || 0) + 1);
  }

  function pageDetail(page) {
    if (!page || page._bookletBlank || page.pageType === 'blank') return '자동 추가 빈 페이지';
    if (page.pageType === 'divider') return `간지: ${page.dividerContent?.title || '제목 없음'}`;
    const fileIndex = Number(page.file_index || 0);
    const filename = page.sourceFile || uploadedFiles[fileIndex]?.name || '원본 PDF';
    return `${filename} · 파일 내 ${Number(page.page_index || 0) + 1}페이지`;
  }

  function observePreviewArea() {
    const area = byId('previewScroll');
    if (!area || !previewObserver) return;
    previewObserver.observe(area, { childList: true, subtree: true });
  }

  function annotatePreview() {
    annotationFrame = 0;
    if (annotationRunning || !editorReady()) return;
    annotationRunning = true;
    if (previewObserver) previewObserver.disconnect();

    try {
      const groups = outputPageGroups();
      const previews = document.querySelectorAll('#previewScroll .page-preview');
      previews.forEach((wrap, index) => {
        wrap.querySelectorAll('.page-label,.booklet-output-label,.pdf-output-source-label').forEach((node) => node.remove());
        const pages = groups[index] || [];
        const sourceText = pages.map(pageListLabel).join(' · ') || '빈면';
        const label = document.createElement('div');
        label.className = 'pdf-output-source-label';

        if (bookletEnabled()) {
          const sheet = Math.floor(index / 2) + 1;
          const isBack = index % 2 === 1;
          const strong = document.createElement('strong');
          strong.className = isBack ? 'back' : '';
          strong.textContent = `${sheet}번 용지 ${isBack ? '뒷면' : '앞면'}`;
          label.append(strong, document.createElement('br'), document.createTextNode(`원본 ${sourceText}`));
        } else {
          label.textContent = `출력 ${index + 1}쪽 · 원본 ${sourceText}`;
        }

        label.title = pages.map(pageDetail).join('\n');
        wrap.appendChild(label);
      });
      updateBookletGuide();
    } finally {
      annotationRunning = false;
      observePreviewArea();
    }
  }

  function queuePreviewAnnotation() {
    if (annotationFrame) return;
    annotationFrame = requestAnimationFrame(annotatePreview);
  }

  function updateBookletGuide() {
    const guide = ensureBookletGuide();
    if (!guide) return;
    const enabled = bookletEnabled();
    guide.classList.toggle('open', enabled);
    if (!enabled) return;

    const select = byId('bookletFlipSelectV2');
    const recommended = recommendedFlip();
    const saved = readSavedFlip();
    if (select && select.dataset.userSelected !== 'true' && !saved) select.value = recommended;
    const selected = validFlip(select?.value) ? select.value : recommended;
    const outputCount = outputPageGroups().length;
    const physicalSheets = Math.ceil(outputCount / 2);
    const count = byId('bookletSheetCountV2');
    if (count) count.textContent = `${outputCount}면 · 용지 ${physicalSheets}장`;
    const advice = byId('bookletFlipAdviceV2');
    if (advice) {
      const orientation = paperIsLandscape() ? '가로 용지' : '세로 용지';
      advice.textContent = `${orientation} 권장: ${flipLabel(recommended)} · 현재 선택: ${flipLabel(selected)}`;
    }
  }

  function installSessionBridge() {
    if (sessionBridgeInstalled) return true;
    if (typeof collectEditorState !== 'function' || typeof loadEditorSession !== 'function') return false;
    if (collectEditorState.__bookletGuideStateV2 && loadEditorSession.__bookletGuideStateV2) {
      sessionBridgeInstalled = true;
      return true;
    }

    const originalCollect = collectEditorState;
    const originalLoad = loadEditorSession;

    const collectWithBookletGuide = function collectWithBookletGuide() {
      const state = originalCollect.apply(this, arguments);
      state.bookletFlip = byId('bookletFlipSelectV2')?.value || readSavedFlip() || recommendedFlip();
      return state;
    };
    collectWithBookletGuide.__bookletGuideStateV2 = true;

    const loadWithBookletGuide = async function loadWithBookletGuide(data, documentId) {
      const result = await originalLoad.apply(this, arguments);
      try {
        const state = typeof data?.state === 'string' ? JSON.parse(data.state) : (data?.state || {});
        const select = byId('bookletFlipSelectV2');
        if (select && validFlip(state.bookletFlip)) {
          select.value = state.bookletFlip;
          select.dataset.userSelected = 'true';
          writeSavedFlip(state.bookletFlip);
        }
      } catch (error) {
        console.warn('[pdf-nup] booklet print setting could not be restored', error);
      }
      updateBookletGuide();
      queuePreviewAnnotation();
      return result;
    };
    loadWithBookletGuide.__bookletGuideStateV2 = true;

    collectEditorState = collectWithBookletGuide;
    loadEditorSession = loadWithBookletGuide;
    window.collectEditorState = collectWithBookletGuide;
    window.loadEditorSession = loadWithBookletGuide;
    sessionBridgeInstalled = true;
    return true;
  }

  function installObservers() {
    const thumbArea = byId('thumbArea');
    if (thumbArea && !thumbObserver) {
      thumbObserver = new MutationObserver(() => {
        cleanupLegacyRows();
        updateThumbnailHint();
      });
      thumbObserver.observe(thumbArea, { childList: true, subtree: true });
    }

    const previewArea = byId('previewScroll');
    if (previewArea && !previewObserver) {
      previewObserver = new MutationObserver((mutations) => {
        const changed = mutations.some((mutation) => mutation.addedNodes.length || mutation.removedNodes.length);
        if (changed) queuePreviewAnnotation();
      });
      observePreviewArea();
    }
  }

  function installEvents() {
    if (window.__pdfEditorNupHelperEventsV8) return;
    window.__pdfEditorNupHelperEventsV8 = true;

    document.addEventListener('change', (event) => {
      if (event.target?.matches('#bookletCheck,#paperSize,#customW,#customH,#bookletFlipSelectV2')) {
        setTimeout(() => {
          updateBookletGuide();
          queuePreviewAnnotation();
        }, 0);
      }
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target?.closest('.nup-btn,.orient-btn')) {
        setTimeout(() => {
          updateBookletGuide();
          queuePreviewAnnotation();
        }, 0);
      }
    }, true);
  }

  function boot() {
    installStyles();
    cleanupLegacyRows();
    updateThumbnailHint();
    renderQuickGuide();
    ensureBookletGuide();
    installEvents();
    installObservers();

    const ready = editorReady();
    const sessionReady = ready && installSessionBridge();
    if (ready) {
      updateBookletGuide();
      queuePreviewAnnotation();
    }

    if ((!ready || !sessionReady || !byId('previewScroll') || !byId('bookletRow')) && bootAttempts < 12) {
      bootAttempts += 1;
      setTimeout(boot, 160 + bootAttempts * 50);
    }
  }

  window.PdfBookletPrintGuide = {
    outputPageGroups,
    annotatePreview,
    updateGuide: updateBookletGuide,
    selectedFlip: () => byId('bookletFlipSelectV2')?.value || readSavedFlip() || recommendedFlip(),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
