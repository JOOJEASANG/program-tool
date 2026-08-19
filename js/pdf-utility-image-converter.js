// PDF Utility: client-side PDF <-> image conversion with target-size auto-fit.
(function () {
  'use strict';
  if (window.__pdfUtilityImageConverterV1) return;
  window.__pdfUtilityImageConverterV1 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  const MAX_FILES = 10;
  const MAX_BYTES = 500 * 1024 * 1024;
  const MAX_PAGES = 100;
  const SIZES = {
    A5: [148, 210], A4: [210, 297], A3: [297, 420], A2: [420, 594],
    B5: [182, 257], B4: [257, 364], Letter: [215.9, 279.4], Legal: [215.9, 355.6]
  };
  const $ = (id) => document.getElementById(id);
  const mmToPt = (mm) => mm * 72 / 25.4;
  const safeName = (name, fallback) => String(name || fallback).replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9가-힣._-]+/g, '_').slice(0, 80) || fallback;
  let libsPromise = null;

  function loadScript(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-pdf-converter-src="${src}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(window[globalName]), { once: true });
        existing.addEventListener('error', () => reject(new Error('변환 라이브러리를 불러오지 못했습니다.')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.pdfConverterSrc = src;
      script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error('변환 라이브러리 초기화에 실패했습니다.'));
      script.onerror = () => reject(new Error('변환 라이브러리를 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  async function loadLibraries() {
    if (libsPromise) return libsPromise;
    libsPromise = Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', 'pdfjsLib'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', 'PDFLib'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', 'JSZip')
    ]).then(([pdfjs, pdfLib, jszip]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      return { pdfjs, pdfLib, jszip };
    });
    return libsPromise;
  }

  function installStyles() {
    if ($('pdfUtilityImageConverterStyles')) return;
    const style = document.createElement('style');
    style.id = 'pdfUtilityImageConverterStyles';
    style.textContent = `
      #pdfUtilityImageConverterCard{grid-column:1/-1;min-height:0;display:flex;align-items:center;gap:15px;padding:15px 17px}
      #pdfUtilityImageConverterCard .action-icon{margin:0;flex:0 0 43px}
      .pdfic-overlay{display:none;position:fixed;inset:0;z-index:1450;background:rgba(15,23,42,.62);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:18px}
      .pdfic-overlay.open{display:flex}.pdfic-box{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:20px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.3)}
      .pdfic-head{display:flex;align-items:center;gap:10px}.pdfic-title{flex:1;font-size:19px;font-weight:950}.pdfic-close{border:0;background:#f1f5f9;border-radius:9px;width:34px;height:34px;font-size:20px;cursor:pointer}
      .pdfic-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:15px 0}.pdfic-tab{border:1px solid #dbe4ee;background:#f8fafc;border-radius:10px;padding:10px;font-size:11px;font-weight:900;cursor:pointer}.pdfic-tab.active{background:#ecfeff;border-color:#67c7d8;color:#0e7490}
      .pdfic-pane{display:none}.pdfic-pane.active{display:block}.pdfic-desc{font-size:11px;color:#64748b;line-height:1.55;margin-bottom:12px}.pdfic-label{display:block;font-size:10px;font-weight:900;color:#475569;margin:11px 0 6px}.pdfic-input{width:100%;border:1.5px solid #d9e2ec;border-radius:10px;padding:10px;font-size:12px;background:#fff}
      .pdfic-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pdfic-file{border:2px dashed #bfd0df;border-radius:12px;padding:18px;text-align:center;cursor:pointer;background:#f8fbff}.pdfic-file:hover{border-color:#1d9bb2}.pdfic-file input{display:none}.pdfic-note{margin-top:10px;padding:9px 10px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:9px;color:#64748b;font-size:9px;line-height:1.5}.pdfic-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}.pdfic-btn{border-radius:10px;padding:10px 16px;font-size:11px;font-weight:900;cursor:pointer}.pdfic-cancel{border:1px solid #dbe4ee;background:#f8fafc;color:#475569}.pdfic-run{border:0;background:linear-gradient(135deg,#12396d,#1d9bb2);color:#fff}.pdfic-status{margin-top:10px;font-size:11px;font-weight:800;line-height:1.5;color:#2563eb}.pdfic-preview{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pdfic-chip{padding:5px 8px;border-radius:8px;background:#f1f5f9;color:#475569;font-size:9px;font-weight:800}
      @media(max-width:520px){.pdfic-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function installCard() {
    const grid = document.querySelector('.action-grid');
    if (!grid || $('pdfUtilityImageConverterCard')) return false;
    const card = document.createElement('button');
    card.type = 'button';
    card.id = 'pdfUtilityImageConverterCard';
    card.className = 'action-btn';
    card.innerHTML = '<span class="action-icon" style="background:#fef3c7">🖼️</span><span><span class="action-name">PDF ↔ 이미지 변환</span><span class="action-desc">PDF를 JPG/PNG로, 여러 이미지를 하나의 PDF로 변환합니다. A5~A2 등 크기를 정하면 비율을 자동으로 유지합니다.</span></span><span class="action-chip chip-blue">브라우저 처리</span>';
    card.addEventListener('click', openModal);
    grid.appendChild(card);
    return true;
  }

  function makeModal() {
    if ($('pdfUtilityImageConverterOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pdfUtilityImageConverterOverlay';
    overlay.className = 'pdfic-overlay';
    overlay.innerHTML = `
      <div class="pdfic-box">
        <div class="pdfic-head"><div class="pdfic-title">PDF ↔ 이미지 변환</div><button class="pdfic-close" id="pdficClose" type="button">×</button></div>
        <div class="pdfic-tabs"><button class="pdfic-tab active" data-pane="pdfToImage" type="button">PDF → 이미지</button><button class="pdfic-tab" data-pane="imageToPdf" type="button">이미지 → PDF</button></div>
        <section class="pdfic-pane active" id="pdficPdfToImage">
          <div class="pdfic-desc">PDF 페이지를 JPG 또는 PNG 이미지로 변환합니다. 페이지 비율은 유지하고 선택한 용지 크기에 맞춰 자동으로 배치합니다.</div>
          <label class="pdfic-label">PDF 파일</label><label class="pdfic-file">📄 PDF 선택<input id="pdficPdfInput" type="file" accept="application/pdf"></label>
          <div class="pdfic-grid"><div><label class="pdfic-label">출력 크기</label><select id="pdficPdfSize" class="pdfic-input">${Object.keys(SIZES).map(k => `<option value="${k}"${k==='A4'?' selected':''}>${k}</option>`).join('')}</select></div><div><label class="pdfic-label">방향</label><select id="pdficPdfOrientation" class="pdfic-input"><option value="auto" selected>자동</option><option value="portrait">세로</option><option value="landscape">가로</option></select></div><div><label class="pdfic-label">이미지 형식</label><select id="pdficImageFormat" class="pdfic-input"><option value="jpeg" selected>JPG</option><option value="png">PNG</option></select></div><div><label class="pdfic-label">해상도</label><select id="pdficDpi" class="pdfic-input"><option value="96">96 DPI</option><option value="150" selected>150 DPI</option><option value="200">200 DPI</option></select></div></div>
          <div class="pdfic-note">최대 500MB · 최대 100페이지. 변환은 사용자의 PC 브라우저에서 처리되어 서버 처리비용을 발생시키지 않습니다. 여러 페이지 결과는 ZIP으로 묶어 저장합니다.</div>
          <div class="pdfic-preview" id="pdficPdfPreview"></div>
        </section>
        <section class="pdfic-pane" id="pdficImageToPdf">
          <div class="pdfic-desc">JPG·PNG·WEBP 이미지를 최대 10개까지 하나의 PDF로 만들 수 있습니다. 선택한 페이지 크기 안에 이미지를 자동 비율로 맞춰 가운데 배치합니다.</div>
          <label class="pdfic-label">이미지 파일</label><label class="pdfic-file">🖼️ 이미지 여러 장 선택<input id="pdficImageInput" type="file" accept="image/jpeg,image/png,image/webp" multiple></label>
          <div class="pdfic-grid"><div><label class="pdfic-label">PDF 페이지 크기</label><select id="pdficImageSize" class="pdfic-input">${Object.keys(SIZES).map(k => `<option value="${k}"${k==='A4'?' selected':''}>${k}</option>`).join('')}</select></div><div><label class="pdfic-label">방향</label><select id="pdficImageOrientation" class="pdfic-input"><option value="auto" selected>이미지에 맞춤</option><option value="portrait">세로</option><option value="landscape">가로</option></select></div></div>
          <div class="pdfic-note">최대 10개 · 전체 500MB. 이미지는 잘리지 않고 페이지 안에 자동 비율로 맞춰집니다. 변환은 브라우저에서 처리합니다.</div>
          <div class="pdfic-preview" id="pdficImagePreview"></div>
        </section>
        <div class="pdfic-status" id="pdficStatus"></div>
        <div class="pdfic-actions"><button class="pdfic-btn pdfic-cancel" id="pdficCancel" type="button">닫기</button><button class="pdfic-btn pdfic-run" id="pdficRun" type="button">변환하기</button></div>
      </div>`;
    document.body.appendChild(overlay);
    $('pdficClose').onclick = closeModal;
    $('pdficCancel').onclick = closeModal;
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
    overlay.querySelectorAll('.pdfic-tab').forEach(tab => tab.addEventListener('click', () => switchPane(tab.dataset.pane)));
    $('pdficPdfInput').addEventListener('change', previewPdfFile);
    $('pdficImageInput').addEventListener('change', previewImages);
    $('pdficRun').onclick = runConversion;
  }

  function switchPane(pane) {
    document.querySelectorAll('.pdfic-tab').forEach(t => t.classList.toggle('active', t.dataset.pane === pane));
    $('pdficPdfToImage').classList.toggle('active', pane === 'pdfToImage');
    $('pdficImageToPdf').classList.toggle('active', pane === 'imageToPdf');
    $('pdficStatus').textContent = '';
  }

  function validatePdf(file) {
    if (!file) throw new Error('PDF 파일을 선택하세요.');
    if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) throw new Error('PDF 파일만 선택할 수 있습니다.');
    if (file.size > MAX_BYTES) throw new Error('PDF 한 파일은 최대 500MB까지 가능합니다.');
  }
  function validateImages(files) {
    if (!files.length) throw new Error('이미지를 선택하세요.');
    if (files.length > MAX_FILES) throw new Error(`이미지는 최대 ${MAX_FILES}개까지 가능합니다.`);
    const total = files.reduce((s, f) => s + Number(f.size || 0), 0);
    if (total > MAX_BYTES) throw new Error('이미지 전체 용량은 최대 500MB까지 가능합니다.');
    for (const file of files) if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('JPG·PNG·WEBP 이미지만 선택할 수 있습니다.');
  }
  function previewPdfFile(e) { const f = e.target.files?.[0]; $('pdficPdfPreview').innerHTML = f ? `<span class="pdfic-chip">${f.name} · ${(f.size/1048576).toFixed(1)}MB</span>` : ''; }
  function previewImages(e) { const files = Array.from(e.target.files || []); $('pdficImagePreview').innerHTML = files.map(f => `<span class="pdfic-chip">${f.name}</span>`).join(''); }
  function setBusy(busy, text) {
    const run = $('pdficRun'); if (run) { run.disabled = busy; run.textContent = busy ? text : '변환하기'; }
    ['pdficClose','pdficCancel'].forEach(id => { const el = $(id); if (el) el.disabled = busy; });
  }
  function status(text, error = false) { const el = $('pdficStatus'); if (el) { el.textContent = text; el.style.color = error ? '#dc2626' : '#2563eb'; } }
  function targetMm(size, orientation, sourceW, sourceH) {
    let [w,h] = SIZES[size] || SIZES.A4;
    if (orientation === 'landscape' || (orientation === 'auto' && sourceW > sourceH)) [w,h] = [h,w];
    return [w,h];
  }
  function contain(sourceW, sourceH, boxW, boxH) {
    const scale = Math.min(boxW / sourceW, boxH / sourceH);
    return { w: sourceW * scale, h: sourceH * scale, x: (boxW - sourceW * scale) / 2, y: (boxH - sourceH * scale) / 2 };
  }
  function canvasFromImage(file, maxPixels = 20_000_000) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file); const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); const pixels = img.naturalWidth * img.naturalHeight; if (pixels > 80_000_000) return reject(new Error('이미지 해상도가 너무 큽니다. 8천만 픽셀 이하를 사용하세요.')); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); }; img.src = url;
    });
  }
  async function convertImagesToPdf(files, pdfLib) {
    const { PDFDocument } = pdfLib;
    const pdf = await PDFDocument.create();
    for (let i = 0; i < files.length; i += 1) {
      status(`${i+1}/${files.length} 이미지 → PDF 변환 중...`);
      const img = await canvasFromImage(files[i]);
      const [mw,mh] = targetMm($('pdficImageSize').value, $('pdficImageOrientation').value, img.naturalWidth, img.naturalHeight);
      const pageW = mmToPt(mw), pageH = mmToPt(mh);
      const box = contain(img.naturalWidth, img.naturalHeight, pageW - 28.35, pageH - 28.35);
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(box.w)); canvas.height = Math.max(1, Math.round(box.h));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const jpg = await new Promise(r => canvas.toBlob(r,'image/jpeg',.9));
      const embedded = await pdf.embedJpg(await jpg.arrayBuffer());
      const page = pdf.addPage([pageW,pageH]); page.drawImage(embedded,{x:(pageW-box.w)/2,y:(pageH-box.h)/2,width:box.w,height:box.h});
      canvas.width = 1; canvas.height = 1;
    }
    return pdf.save({ useObjectStreams: true });
  }
  async function convertPdfToImages(file, pdfjs, jszip) {
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    if (pdf.numPages > MAX_PAGES) throw new Error(`최대 ${MAX_PAGES}페이지까지 변환할 수 있습니다.`);
    const zip = new jszip(); const size = $('pdficPdfSize').value; const orientation = $('pdficPdfOrientation').value; const dpi = Number($('pdficDpi').value || 150); const format = $('pdficImageFormat').value;
    for (let i = 1; i <= pdf.numPages; i += 1) {
      status(`${i}/${pdf.numPages} 페이지 → 이미지 변환 중...`);
      const page = await pdf.getPage(i); const base = page.getViewport({ scale: 1 });
      const [mw,mh] = targetMm(size, orientation, base.width, base.height); const outW = Math.round(mw / 25.4 * dpi); const outH = Math.round(mh / 25.4 * dpi);
      const scale = Math.min(outW / base.width, outH / base.height); const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = outH; const ctx = canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,outW,outH);
      await page.render({ canvasContext: ctx, viewport, transform:[1,0,0,1,(outW-viewport.width)/2,(outH-viewport.height)/2] }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, format === 'png' ? 'image/png' : 'image/jpeg', .92));
      zip.file(`${safeName(file.name,'document')}_${String(i).padStart(3,'0')}.${format === 'png' ? 'png' : 'jpg'}`, blob);
      canvas.width = 1; canvas.height = 1;
    }
    return zip.generateAsync({ type:'blob', compression:'STORE' });
  }
  function download(blob, name) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
  async function runConversion() {
    setBusy(true,'변환 준비 중...');
    try {
      const libs = await loadLibraries();
      const pdfPane = $('pdficPdfToImage').classList.contains('active');
      if (pdfPane) {
        const file = $('pdficPdfInput').files?.[0]; validatePdf(file); const blob = await convertPdfToImages(file, libs.pdfjs, libs.jszip); download(blob, `${safeName(file.name,'document')}_이미지.zip`);
      } else {
        const files = Array.from($('pdficImageInput').files || []); validateImages(files); const bytes = await convertImagesToPdf(files, libs.pdfLib); download(new Blob([bytes],{type:'application/pdf'}), '이미지_변환.pdf');
      }
      status('변환이 완료되었습니다.');
    } catch (error) { console.error('[pdf utility image converter]', error); status(error?.message || '변환에 실패했습니다.', true); }
    finally { setBusy(false); }
  }
  function openModal() { makeModal(); $('pdfUtilityImageConverterOverlay').classList.add('open'); }
  function closeModal() { const o=$('pdfUtilityImageConverterOverlay'); if (o) o.classList.remove('open'); }
  function install() { installStyles(); return installCard(); }
  const retry = (n=0) => { if (install() || n>=60) return; setTimeout(()=>retry(n+1),250); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',()=>retry(),{once:true}); else retry();
  window.PdfUtilityImageConverter = { install, validatePdf, validateImages, targetMm, contain, stage:'client-side-pdf-image-converter' };
})();
