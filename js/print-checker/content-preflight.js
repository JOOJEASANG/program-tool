/* content-preflight.js — 업로드 파일 내용·인쇄 자동 점검 v20260910-1 */
'use strict';

(() => {
  const PDFJS_VERSION = '3.11.174';
  const PDFJS_SRC = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.js`;
  const PDFJS_WORKER = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;
  const MAX_DEEP_PDF_BYTES = 80 * 1024 * 1024;
  const MAX_ANALYSIS_PAGES = 24;
  const PDF_MM_TOLERANCE = 0.8;
  const FOLD_TEXT_TOLERANCE_MM = 1.5;

  let serial = 0;
  let lastFile = null;
  let raw = null;
  let pdfLoaderPromise = null;
  let refreshTimer = 0;

  const $ = (id) => document.getElementById(id);
  const n = (id) => Number.parseFloat($(id)?.value || '0') || 0;
  const mm = (points) => Number(points || 0) * 25.4 / 72;
  const core = () => {
    try { return typeof PrintChecker !== 'undefined' ? PrintChecker : null; } catch (_) { return null; }
  };

  function boot() {
    const input = $('fileInput');
    const zone = $('uploadZone');
    if (!input || !$('contentPreflightSection')) return;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) void analyzeFile(file);
      else reset();
    });
    zone?.addEventListener('drop', (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) void analyzeFile(file);
    });

    document.addEventListener('input', onConfigChange, true);
    document.addEventListener('change', onConfigChange, true);
    $('resetBtn')?.addEventListener('click', () => setTimeout(reset, 0));
    $('productGrid')?.addEventListener('click', () => scheduleRefresh(80));
  }

  function onConfigChange(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('#specForm') || ['fileHasBleed', 'invitationFoldType'].includes(target.id)) scheduleRefresh(100);
  }

  function scheduleRefresh(delay = 80) {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      if (raw) renderEvaluation(evaluate(raw));
    }, delay);
  }

  async function analyzeFile(file) {
    const current = ++serial;
    lastFile = file;
    raw = null;
    renderLoading(file);
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      const isImage = /^image\/(png|jpeg|webp)$/i.test(file.type || '') || /\.(png|jpe?g|webp)$/i.test(file.name || '');
      if (!isPdf && !isImage) return reset();
      const result = isPdf ? await analyzePdf(file, current) : await analyzeImage(file, current);
      if (current !== serial || file !== lastFile) return;
      raw = result;
      renderEvaluation(evaluate(result));
    } catch (error) {
      if (current !== serial) return;
      console.warn('[print-checker content-preflight] analysis failed', error);
      renderEvaluation({
        title: '자동 내용·인쇄 검사',
        items: [{ status: 'info', label: '내용 심층 분석', detail: '파일 미리보기와 기본 규격 검사는 계속 사용할 수 있습니다.', guide: '이 파일에서는 문자·색상 심층 분석을 완료하지 못했습니다.' }],
      });
    }
  }

  async function analyzeImage(file, current) {
    const url = URL.createObjectURL(file);
    try {
      const image = await imageFromUrl(url);
      if (current !== serial) throw new Error('stale image analysis');
      return {
        kind: 'image',
        name: file.name || '이미지',
        widthPx: image.naturalWidth,
        heightPx: image.naturalHeight,
        color: await detectImageColor(file),
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function analyzePdf(file, current) {
    if (file.size > MAX_DEEP_PDF_BYTES) {
      return {
        kind: 'pdf', name: file.name || 'PDF', skippedLarge: true,
        pageCount: core()?.getState?.().pdfPageCount || 0, pages: [],
      };
    }
    const lib = await requirePdfJs();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (current !== serial) throw new Error('stale PDF analysis');
    const task = lib.getDocument({ data: bytes, disableAutoFetch: true });
    const doc = await task.promise;
    const pages = [];
    const fonts = new Set();
    const colorCounts = { rgb: 0, cmyk: 0, gray: 0, other: 0 };
    const count = Math.min(doc.numPages, MAX_ANALYSIS_PAGES);
    try {
      for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
        if (current !== serial) throw new Error('stale PDF analysis');
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const text = await page.getTextContent({ disableNormalization: false });
        const boxes = [];
        Object.entries(text.styles || {}).forEach(([fontName, style]) => {
          const family = String(style?.fontFamily || '').trim();
          if (family) fonts.add(family);
          else if (fontName) fonts.add(fontName);
        });
        for (const item of text.items || []) {
          if (!item || !String(item.str || '').trim() || !Array.isArray(item.transform)) continue;
          if (item.fontName) fonts.add(String(item.fontName));
          const box = textItemBox(lib, viewport, item);
          if (box && box.w > 0.15 && box.h > 0.15) boxes.push(box);
        }
        try {
          const opList = await page.getOperatorList();
          countColorOperators(lib, opList, colorCounts);
        } catch (_) {}
        pages.push({
          pageNumber,
          widthMm: mm(viewport.width),
          heightMm: mm(viewport.height),
          textBoxes: boxes,
          textCount: boxes.length,
        });
        try { page.cleanup?.(); } catch (_) {}
      }
      return {
        kind: 'pdf', name: file.name || 'PDF', pageCount: doc.numPages, pages,
        analyzedPages: count, truncated: doc.numPages > count,
        fonts: Array.from(fonts).sort((a, b) => a.localeCompare(b, 'ko')),
        colors: colorCounts,
      };
    } finally {
      try { await doc.destroy?.(); } catch (_) {}
    }
  }

  function textItemBox(lib, viewport, item) {
    try {
      const tx = lib.Util?.transform ? lib.Util.transform(viewport.transform, item.transform) : item.transform;
      const fontHeight = Math.max(0.5, Math.hypot(Number(tx[2]) || 0, Number(tx[3]) || 0));
      const width = Math.max(0, Math.abs(Number(item.width || 0) * Number(viewport.scale || 1)));
      const x = Number(tx[4]) || 0;
      const y = (Number(tx[5]) || 0) - fontHeight;
      return { x: mm(x), y: mm(y), w: mm(width), h: mm(fontHeight), text: String(item.str || '').trim().slice(0, 80) };
    } catch (_) {
      return null;
    }
  }

  function countColorOperators(lib, opList, counts) {
    const ops = lib.OPS || {};
    const rgb = new Set([ops.setFillRGBColor, ops.setStrokeRGBColor].filter(Number.isFinite));
    const cmyk = new Set([ops.setFillCMYKColor, ops.setStrokeCMYKColor].filter(Number.isFinite));
    const gray = new Set([ops.setFillGray, ops.setStrokeGray].filter(Number.isFinite));
    const other = new Set([ops.setFillColorN, ops.setStrokeColorN].filter(Number.isFinite));
    for (const fn of opList?.fnArray || []) {
      if (rgb.has(fn)) counts.rgb += 1;
      else if (cmyk.has(fn)) counts.cmyk += 1;
      else if (gray.has(fn)) counts.gray += 1;
      else if (other.has(fn)) counts.other += 1;
    }
  }

  async function requirePdfJs() {
    if (window.pdfjsLib?.getDocument) return configurePdfJs(window.pdfjsLib);
    if (!pdfLoaderPromise) {
      pdfLoaderPromise = new Promise((resolve, reject) => {
        const finish = () => window.pdfjsLib?.getDocument ? resolve(configurePdfJs(window.pdfjsLib)) : reject(new Error('PDF.js unavailable'));
        const existing = $('printCheckerPdfJs');
        if (existing) {
          const started = Date.now();
          const timer = setInterval(() => {
            if (window.pdfjsLib?.getDocument) {
              clearInterval(timer); finish();
            } else if (Date.now() - started > 7000) {
              clearInterval(timer); reject(new Error('PDF.js timeout'));
            }
          }, 50);
          existing.addEventListener('load', finish, { once: true });
          existing.addEventListener('error', () => reject(new Error('PDF.js load failed')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.id = 'printCheckerPdfJs';
        script.src = PDFJS_SRC;
        script.addEventListener('load', finish, { once: true });
        script.addEventListener('error', () => reject(new Error('PDF.js load failed')), { once: true });
        document.head.appendChild(script);
      }).catch((error) => { pdfLoaderPromise = null; throw error; });
    }
    return pdfLoaderPromise;
  }

  function configurePdfJs(lib) {
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    return lib;
  }

  function imageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('image decode failed'));
      image.src = url;
    });
  }

  async function detectImageColor(file) {
    const type = String(file.type || '').toLowerCase();
    if (type === 'image/png' || /\.png$/i.test(file.name || '')) {
      const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
      const colorType = bytes.length > 25 ? bytes[25] : -1;
      if ([2, 3, 6].includes(colorType)) return { family: 'rgb', label: 'RGB 계열 PNG' };
      if ([0, 4].includes(colorType)) return { family: 'gray', label: '그레이스케일 PNG' };
      return { family: 'unknown', label: 'PNG 색상 정보 확인 제한' };
    }
    if (type === 'image/webp' || /\.webp$/i.test(file.name || '')) return { family: 'rgb', label: 'RGB 계열 WEBP' };
    if (type === 'image/jpeg' || /\.jpe?g$/i.test(file.name || '')) {
      const bytes = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
      const components = jpegComponentCount(bytes);
      if (components === 4) return { family: 'cmyk-possible', label: '4채널 JPEG · CMYK/YCCK 가능' };
      if (components === 3) return { family: 'rgb', label: '3채널 JPEG · RGB/YCbCr 계열' };
      if (components === 1) return { family: 'gray', label: '그레이스케일 JPEG' };
      return { family: 'unknown', label: 'JPEG 색상 정보 확인 제한' };
    }
    return { family: 'unknown', label: '색상 정보 확인 제한' };
  }

  function jpegComponentCount(bytes) {
    if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0;
    const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
    let i = 2;
    while (i + 10 < bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      while (i < bytes.length && bytes[i] === 0xff) i += 1;
      const marker = bytes[i];
      i += 1;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker >= 0xd0 && marker <= 0xd7) continue;
      if (i + 1 >= bytes.length) break;
      const length = (bytes[i] << 8) | bytes[i + 1];
      if (length < 2 || i + length > bytes.length) break;
      if (sof.has(marker) && i + 7 < bytes.length) return bytes[i + 7];
      i += length;
    }
    return 0;
  }

  function config() {
    const state = core()?.getState?.() || {};
    const product = state.product || document.querySelector('.product-card.selected')?.dataset.product || '';
    const bleed = n('bleed');
    const safe = n('safeZone');
    const hasBleed = Boolean($('fileHasBleed')?.checked);
    const trimW = n('trimW');
    const trimH = n('trimH');
    const spine = n('spine');
    const wing = $('hasWing')?.checked ? n('wingW') : 0;
    const fileW = product === 'cover' ? (trimW * 2 + spine + wing * 2 + (hasBleed ? bleed * 2 : 0)) : trimW + (hasBleed ? bleed * 2 : 0);
    const fileH = trimH + (hasBleed ? bleed * 2 : 0);
    return { product, bleed, safe, hasBleed, trimW, trimH, spine, wing, fileW, fileH };
  }

  function evaluate(result) {
    const cfg = config();
    const items = [];
    if (result.kind === 'image') evaluateImage(result, cfg, items);
    else evaluatePdf(result, cfg, items);
    return { title: '자동 내용·인쇄 검사', items };
  }

  function evaluateImage(result, cfg, items) {
    items.push({ status: 'pass', label: '이미지 내용 로드', detail: `${result.widthPx} × ${result.heightPx}px`, guide: '업로드 이미지를 실제 캔버스에 표시해 안내선과 대조합니다.' });
    if (cfg.fileW > 0 && cfg.fileH > 0) {
      const dpiX = result.widthPx / (cfg.fileW / 25.4);
      const dpiY = result.heightPx / (cfg.fileH / 25.4);
      const effective = Math.min(dpiX, dpiY);
      const status = effective >= 300 ? 'pass' : effective >= 200 ? 'warn' : 'fail';
      items.push({
        status,
        label: '이미지 유효 해상도',
        detail: `선택한 작업크기 ${cfg.fileW.toFixed(1)} × ${cfg.fileH.toFixed(1)}mm 기준 약 ${Math.round(effective)}dpi`,
        guide: effective >= 300 ? '일반적인 고품질 인쇄 권장 수준입니다.' : effective >= 200 ? '대형 출력이나 관람거리에 따라 사용할 수 있으나 작은 글자·세부 이미지는 확인하세요.' : '확대 인쇄 시 픽셀 깨짐이 보일 가능성이 높습니다.',
      });
    } else {
      items.push({ status: 'info', label: '이미지 유효 해상도', detail: '제품 규격을 입력하면 최종 인쇄크기 기준 DPI를 계산합니다.', guide: '픽셀 수만으로는 실제 인쇄 DPI를 확정할 수 없습니다.' });
    }
    const color = result.color || { family: 'unknown', label: '확인 제한' };
    const colorStatus = color.family === 'rgb' ? 'warn' : color.family === 'gray' ? 'info' : 'info';
    items.push({ status: colorStatus, label: '이미지 색상 계열', detail: color.label, guide: color.family === 'rgb' ? '상업 인쇄가 CMYK 공정이면 변환 후 색상 차이를 확인하세요.' : color.family === 'cmyk-possible' ? '4채널 JPEG는 CMYK 또는 YCCK일 수 있어 최종 출력 프로파일 확인이 필요합니다.' : '색상 프로파일은 인쇄소 출력 조건에서 최종 확인하세요.' });
    items.push({ status: 'info', label: '이미지 문자 위치 인식', detail: '이미지 파일은 현재 픽셀 전체를 하나의 인쇄물로 취급합니다.', guide: 'OCR 없이 이미지 안의 개별 글자·로고 위치까지 자동 판정하지는 않습니다. 안내선을 겹쳐 육안 점검할 수 있습니다.' });
  }

  function evaluatePdf(result, cfg, items) {
    if (result.skippedLarge) {
      items.push({ status: 'info', label: 'PDF 심층 분석 범위', detail: '80MB를 초과해 문자·색상 심층 분석을 생략했습니다.', guide: '대용량 파일은 메모리 안정성을 위해 기본 PDF 규격·미리보기 점검만 수행합니다.' });
      return;
    }
    const totalText = result.pages.reduce((sum, page) => sum + page.textCount, 0);
    items.push({
      status: totalText ? 'pass' : 'info',
      label: 'PDF 문자 내용 인식',
      detail: totalText ? `${result.analyzedPages}개 페이지에서 텍스트 객체 ${totalText}개를 인식했습니다.` : '인식 가능한 PDF 텍스트 객체가 없습니다.',
      guide: totalText ? '문자 위치를 이용해 안쪽 여백과 접는선 침범을 자동 점검합니다.' : '스캔 PDF 또는 글자를 윤곽선으로 변환한 PDF는 OCR 없이는 개별 문자 위치를 판정할 수 없습니다.',
    });
    if (result.truncated) items.push({ status: 'info', label: '분석 페이지 범위', detail: `전체 ${result.pageCount}p 중 앞 ${result.analyzedPages}p를 심층 분석했습니다.`, guide: '대용량 문서의 브라우저 성능을 위해 심층 분석은 최대 24페이지입니다.' });

    const fonts = result.fonts || [];
    items.push({ status: 'info', label: '사용 글꼴', detail: fonts.length ? `${fonts.length}종 감지 · ${fonts.slice(0, 6).join(', ')}${fonts.length > 6 ? ' 외' : ''}` : '텍스트 글꼴 정보를 찾지 못했습니다.', guide: '글꼴 이름은 확인하지만 PDF.js만으로 모든 폰트의 임베딩 상태를 확정하지는 않습니다.' });

    const colors = result.colors || {};
    const rgb = colors.rgb || 0;
    const cmyk = colors.cmyk || 0;
    const other = colors.other || 0;
    let colorStatus = 'info';
    let colorDetail = '명시적인 RGB/CMYK 색상 명령을 찾지 못했습니다.';
    let colorGuide = 'ICC·별색·이미지 내부 프로파일은 별도 전문 프리플라이트가 필요할 수 있습니다.';
    if (rgb > 0) {
      colorStatus = 'warn';
      colorDetail = `RGB 색상 명령 ${rgb}회${cmyk ? ` · CMYK ${cmyk}회` : ''} 감지`;
      colorGuide = 'CMYK 인쇄라면 RGB 객체의 변환 결과를 확인하세요. PDF 내부 이미지 색상은 이 수치에 모두 포함되지 않을 수 있습니다.';
    } else if (cmyk > 0) {
      colorStatus = other > 0 ? 'info' : 'pass';
      colorDetail = `CMYK 색상 명령 ${cmyk}회${other ? ` · 기타 색상 명령 ${other}회` : ''} 감지`;
      colorGuide = '감지된 벡터·문자 색상은 CMYK 계열입니다. 이미지 ICC 프로파일은 별도 확인 대상입니다.';
    }
    items.push({ status: colorStatus, label: 'PDF 색상 공간', detail: colorDetail, guide: colorGuide });

    if (!totalText || !cfg.product || cfg.fileW <= 0 || cfg.fileH <= 0) return;
    const comparable = result.pages.filter((page) => dimensionsMatch(page, cfg));
    if (!comparable.length) {
      items.push({ status: 'info', label: '문자 배치 자동 판정', detail: '현재 입력한 작업규격과 PDF 실제 크기가 달라 위치 판정을 보류했습니다.', guide: '먼저 재단크기·도련 포함 여부·표지 책등 값을 실제 PDF에 맞추면 정확한 여백 점검이 가능합니다.' });
      return;
    }

    const safe = checkSafeText(comparable, cfg);
    if (safe.checked > 0) {
      items.push({
        status: safe.violations ? 'warn' : 'pass',
        label: cfg.product === 'cover' ? '앞·뒤 표지 안쪽 여백' : '안쪽 여백 문자 점검',
        detail: safe.violations ? `${safe.checked}개 문자 객체 중 ${safe.violations}개가 안쪽 여백에 걸리거나 바깥에 있습니다.` : `${safe.checked}개 문자 객체가 설정한 안쪽 여백 안에 배치되어 있습니다.`,
        guide: safe.violations ? '캔버스의 초록 안내선을 기준으로 해당 문자를 안쪽으로 이동하는 것을 권장합니다.' : '텍스트 객체 기준 자동 점검 결과입니다.',
      });
    }

    const folds = foldLines(cfg);
    if (folds.length) {
      const overlap = countFoldTextOverlaps(comparable, cfg, folds);
      items.push({
        status: overlap ? 'warn' : 'pass',
        label: '접는선 문자 겹침',
        detail: overlap ? `${overlap}개 문자 객체가 접는선 ±${FOLD_TEXT_TOLERANCE_MM}mm 범위와 겹칩니다.` : '인식된 문자가 접는선 주변에 걸리지 않습니다.',
        guide: overlap ? '접히는 위치의 작은 글자·연락처·로고는 접는선에서 더 떨어뜨려 주세요.' : '주황 접는선과 인식된 PDF 문자 위치를 대조했습니다.',
      });
    }
  }

  function dimensionsMatch(page, cfg) {
    return Math.abs(page.widthMm - cfg.fileW) <= PDF_MM_TOLERANCE && Math.abs(page.heightMm - cfg.fileH) <= PDF_MM_TOLERANCE;
  }

  function checkSafeText(pages, cfg) {
    let checked = 0;
    let violations = 0;
    for (const page of pages) {
      const trimL = cfg.hasBleed ? cfg.bleed : 0;
      const trimT = cfg.hasBleed ? cfg.bleed : 0;
      const trimR = page.widthMm - trimL;
      const trimB = page.heightMm - trimT;
      if (cfg.product === 'cover') {
        const backL = trimL + cfg.wing;
        const backR = backL + cfg.trimW;
        const spineL = backR;
        const spineR = spineL + cfg.spine;
        const frontL = spineR;
        const frontR = frontL + cfg.trimW;
        const backSafe = { l: backL + cfg.safe, t: trimT + cfg.safe, r: backR - cfg.safe, b: trimB - cfg.safe };
        const frontSafe = { l: frontL + cfg.safe, t: trimT + cfg.safe, r: frontR - cfg.safe, b: trimB - cfg.safe };
        for (const box of page.textBoxes) {
          const cx = box.x + box.w / 2;
          if (cx >= backL && cx <= backR) { checked += 1; if (!contains(backSafe, box)) violations += 1; }
          else if (cx >= frontL && cx <= frontR) { checked += 1; if (!contains(frontSafe, box)) violations += 1; }
        }
      } else {
        const safeRect = { l: trimL + cfg.safe, t: trimT + cfg.safe, r: trimR - cfg.safe, b: trimB - cfg.safe };
        for (const box of page.textBoxes) {
          const cx = box.x + box.w / 2;
          const cy = box.y + box.h / 2;
          if (cx < trimL || cx > trimR || cy < trimT || cy > trimB) continue;
          checked += 1;
          if (!contains(safeRect, box)) violations += 1;
        }
      }
    }
    return { checked, violations };
  }

  function contains(rect, box) {
    return box.x >= rect.l && box.y >= rect.t && box.x + box.w <= rect.r && box.y + box.h <= rect.b;
  }

  function foldLines(cfg) {
    let panels = 0;
    if (cfg.product === 'leaflet') {
      const fold = $('foldType')?.value || '3roll';
      panels = fold === '2fold' ? 2 : fold === '4fold' ? 4 : 3;
    } else if (cfg.product === 'invitation') {
      const fold = $('invitationFoldType')?.value || 'half';
      if (fold === 'none') panels = 0;
      else panels = fold === 'half' ? 2 : 3;
    }
    if (panels < 2) return [];
    const trimL = cfg.hasBleed ? cfg.bleed : 0;
    return Array.from({ length: panels - 1 }, (_, index) => trimL + cfg.trimW * ((index + 1) / panels));
  }

  function countFoldTextOverlaps(pages, cfg, lines) {
    let count = 0;
    for (const page of pages) {
      for (const box of page.textBoxes) {
        const right = box.x + box.w;
        if (lines.some((line) => box.x <= line + FOLD_TEXT_TOLERANCE_MM && right >= line - FOLD_TEXT_TOLERANCE_MM)) count += 1;
      }
    }
    return count;
  }

  function renderLoading(file) {
    const section = $('contentPreflightSection');
    const summary = $('contentPreflightSummary');
    const grid = $('contentPreflightGrid');
    if (!section || !summary || !grid) return;
    section.hidden = false;
    section.dataset.state = 'loading';
    summary.className = 'content-preflight-summary is-loading';
    summary.textContent = `${file.name || '파일'} 내용 분석 중…`;
    grid.replaceChildren();
  }

  function renderEvaluation(evaluation) {
    const section = $('contentPreflightSection');
    const summary = $('contentPreflightSummary');
    const grid = $('contentPreflightGrid');
    if (!section || !summary || !grid) return;
    const items = evaluation.items || [];
    const counts = { pass: 0, warn: 0, fail: 0, info: 0 };
    grid.replaceChildren();
    items.forEach((item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      const card = document.createElement('article');
      card.className = `content-preflight-card status-${item.status}`;
      const icon = { pass: '✓', warn: '!', fail: '×', info: 'i' }[item.status] || 'i';
      const head = document.createElement('div');
      head.className = 'content-preflight-card-head';
      const badge = document.createElement('span'); badge.className = 'content-preflight-icon'; badge.textContent = icon;
      const label = document.createElement('strong'); label.textContent = item.label;
      head.append(badge, label);
      const detail = document.createElement('div'); detail.className = 'content-preflight-detail'; detail.textContent = item.detail;
      const guide = document.createElement('div'); guide.className = 'content-preflight-guide'; guide.textContent = item.guide;
      card.append(head, detail, guide);
      grid.appendChild(card);
    });
    const overall = counts.fail ? 'fail' : counts.warn ? 'warn' : 'pass';
    summary.className = `content-preflight-summary status-${overall}`;
    summary.textContent = `${overall === 'fail' ? '수정 필요' : overall === 'warn' ? '확인 필요' : '자동 검사 완료'} · 정상 ${counts.pass} · 확인 ${counts.warn} · 정보 ${counts.info}${counts.fail ? ` · 오류 ${counts.fail}` : ''}`;
    section.hidden = false;
    section.dataset.state = 'ready';
  }

  function reset() {
    serial += 1;
    lastFile = null;
    raw = null;
    clearTimeout(refreshTimer);
    const section = $('contentPreflightSection');
    if (section) section.hidden = true;
    $('contentPreflightGrid')?.replaceChildren();
    if ($('contentPreflightSummary')) $('contentPreflightSummary').textContent = '';
  }

  window.PrintCheckerContentPreflight = Object.freeze({
    analyzeFile,
    reset,
    stage: 'print-checker-content-preflight-v1',
    __test: { jpegComponentCount, foldLines, dimensionsMatch },
  });

  document.addEventListener('DOMContentLoaded', boot);
})();
