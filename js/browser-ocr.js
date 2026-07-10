(() => {
  if (window.__browserPdfOcrV1) return;
  window.__browserPdfOcrV1 = true;

  const MAX_PAGES = 30;
  const MAX_BYTES = 100 * 1024 * 1024;

  function loadScript(id, src) {
    return new Promise((resolve, reject) => {
      const existing = document.getElementById(id);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('OCR 라이브러리를 불러오지 못했습니다.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error('OCR 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));
      document.head.appendChild(script);
    });
  }

  async function ensureLibraries() {
    await Promise.all([
      loadScript('pdfJsOcrScript', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'),
      loadScript('pdfLibOcrScript', 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'),
      loadScript('tesseractOcrScript', 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'),
    ]);

    if (!window.pdfjsLib || !window.PDFLib || !window.Tesseract) {
      throw new Error('브라우저 OCR 라이브러리 초기화에 실패했습니다.');
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  function normalizePdfBytes(value) {
    if (!value) throw new Error('OCR PDF 생성 결과가 없습니다.');
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    throw new Error('OCR PDF 결과 형식을 처리할 수 없습니다.');
  }

  function progressText(message, pageNumber, totalPages) {
    const status = String(message?.status || 'recognizing text');
    const pct = Math.max(0, Math.min(100, Math.round((Number(message?.progress || 0)) * 100)));
    const labels = {
      'loading tesseract core': 'OCR 엔진 준비 중',
      'initializing tesseract': 'OCR 엔진 초기화 중',
      'loading language traineddata': '한국어·영어 언어 데이터 불러오는 중',
      'initializing api': 'OCR 분석 준비 중',
      'recognizing text': '문자 인식 중',
    };
    return `${pageNumber}/${totalPages}페이지 · ${labels[status] || status}${pct ? ` ${pct}%` : ''}`;
  }

  window.runBrowserPdfOcr = async function runBrowserPdfOcr(file, onStatus = () => {}) {
    if (!file) throw new Error('먼저 PDF 파일을 업로드하세요.');
    if (file.size > MAX_BYTES) throw new Error('OCR은 최대 100MB PDF까지 처리할 수 있습니다.');

    onStatus('브라우저 OCR 라이브러리를 준비하고 있습니다...');
    await ensureLibraries();

    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const sourcePdf = await window.pdfjsLib.getDocument({ data: sourceBytes }).promise;
    if (sourcePdf.numPages > MAX_PAGES) {
      throw new Error(`OCR은 최대 ${MAX_PAGES}페이지까지 처리할 수 있습니다.`);
    }

    const outputPdf = await window.PDFLib.PDFDocument.create();
    outputPdf.setTitle((file.name || 'document.pdf').replace(/\.pdf$/i, '') + ' OCR');
    outputPdf.setProducer('Program Tool Browser OCR');

    let currentPage = 1;
    let worker;
    try {
      worker = await window.Tesseract.createWorker(['kor', 'eng'], 1, {
        logger: (message) => onStatus(progressText(message, currentPage, sourcePdf.numPages)),
      });

      for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
        currentPage = pageNumber;
        onStatus(`${pageNumber}/${sourcePdf.numPages}페이지를 이미지로 변환하는 중...`);

        const page = await sourcePdf.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const longest = Math.max(base.width, base.height);
        const scale = Math.max(1.35, Math.min(2, 2200 / Math.max(1, longest)));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;

        onStatus(`${pageNumber}/${sourcePdf.numPages}페이지 OCR을 시작합니다...`);
        const result = await worker.recognize(canvas, {
          pdfTitle: file.name || 'document.pdf',
          user_defined_dpi: '150',
        }, { pdf: true });

        const pagePdfBytes = normalizePdfBytes(result?.data?.pdf);
        const recognizedPdf = await window.PDFLib.PDFDocument.load(pagePdfBytes);
        const copiedPages = await outputPdf.copyPages(recognizedPdf, recognizedPdf.getPageIndices());
        copiedPages.forEach((copiedPage) => outputPdf.addPage(copiedPage));

        canvas.width = 1;
        canvas.height = 1;
        page.cleanup();
        onStatus(`${pageNumber}/${sourcePdf.numPages}페이지 OCR 완료`);
      }

      onStatus('검색 가능한 PDF를 저장하는 중...');
      const outputBytes = await outputPdf.save({ useObjectStreams: true });
      return new Blob([outputBytes], { type: 'application/pdf' });
    } finally {
      if (worker) await worker.terminate().catch(() => {});
      await sourcePdf.destroy().catch(() => {});
    }
  };
})();
