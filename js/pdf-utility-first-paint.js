// PDF Utility first-paint guard + polished image converter presentation.
(function () {
  'use strict';
  if (window.__pdfUtilityFirstPaintV1) return;
  window.__pdfUtilityFirstPaintV1 = true;

  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (!(path === '/pdf-preflight' || path.endsWith('/pdf-preflight/index.html') || path.endsWith('/tools/pdf-Checker.html') || path.endsWith('/tools/preflight.html'))) return;

  // Hide the pre-finalization DOM so the legacy layout cannot flash before the
  // wide workspace is ready. A timeout prevents a permanently hidden page.
  const rootStyle = document.createElement('style');
  rootStyle.id = 'pdfUtilityFirstPaintStyle';
  rootStyle.textContent = `
    html.pdfu-first-paint-pending body{visibility:hidden!important}
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished{
      grid-column:1/-1!important;
      min-height:150px!important;
      display:grid!important;
      grid-template-columns:auto minmax(0,1fr) auto!important;
      align-items:center!important;
      gap:16px!important;
      padding:18px 19px!important;
      border:1px solid #dbe7f0!important;
      border-radius:18px!important;
      background:linear-gradient(135deg,#ffffff 0%,#f7fbff 100%)!important;
      box-shadow:0 10px 26px rgba(18,57,109,.07)!important;
      overflow:hidden!important;
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished:hover:not(:disabled){
      transform:translateY(-2px)!important;
      border-color:#8bd5df!important;
      box-shadow:0 15px 32px rgba(18,57,109,.11)!important;
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-icon{
      width:54px;height:54px;border-radius:15px;display:flex;align-items:center;justify-content:center;
      background:linear-gradient(135deg,#e0f2fe,#cffafe);font-size:27px;box-shadow:inset 0 0 0 1px rgba(29,155,178,.08);
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-copy{min-width:0}
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-kicker{
      font-size:9px;font-weight:950;letter-spacing:.08em;color:#0e7490;margin-bottom:4px;
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .action-name{font-size:15px!important;display:block!important;color:#10213d!important;letter-spacing:-.25px}
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .action-desc{font-size:10px!important;line-height:1.55!important;margin-top:5px!important;color:#64748b!important;max-width:720px}
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-arrow{
      display:inline-flex;align-items:center;gap:5px;margin-top:9px;font-size:9px;font-weight:900;color:#475569;
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-arrow span{
      padding:4px 7px;border-radius:7px;background:#eef6ff;color:#1d4ed8;
    }
    #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-cta{
      display:inline-flex;align-items:center;gap:5px;padding:8px 11px;border-radius:9px;background:#12396d;color:#fff;font-size:9px;font-weight:950;white-space:nowrap;
    }
    @media(max-width:680px){
      #pdfUtilityImageConverterCard.pdfu-image-converter-polished{grid-template-columns:auto minmax(0,1fr)!important}
      #pdfUtilityImageConverterCard.pdfu-image-converter-polished .pdfu-image-cta{grid-column:1/-1;justify-content:center;width:100%}
    }
  `;
  document.head.appendChild(rootStyle);
  document.documentElement.classList.add('pdfu-first-paint-pending');

  function polishCard() {
    const card = document.getElementById('pdfUtilityImageConverterCard');
    if (!card) return false;
    card.classList.add('pdfu-image-converter-polished');
    if (!card.dataset.pdfuPolished) {
      card.innerHTML = `
        <span class="pdfu-image-icon" aria-hidden="true">↔️</span>
        <span class="pdfu-image-copy">
          <span class="pdfu-image-kicker">PDF UTILITY · CONVERTER</span>
          <span class="action-name">PDF ↔ 이미지 변환</span>
          <span class="action-desc">PDF를 고해상도 JPG/PNG로 변환하거나 여러 이미지를 하나의 PDF로 만들 수 있습니다. 용지 크기에 맞춰 원본 비율을 자동으로 유지합니다.</span>
          <span class="pdfu-image-arrow"><span>PDF → JPG / PNG</span><b>또는</b><span>JPG / PNG → PDF</span></span>
        </span>
        <span class="pdfu-image-cta">변환 설정 열기 →</span>
      `;
      card.dataset.pdfuPolished = 'true';
    }
    return true;
  }

  function revealWhenReady() {
    const card = polishCard();
    const wideReady = document.documentElement.dataset.pdfUtilityWideLayout === '1';
    const cardInFinalGrid = card && card.parentElement && !card.parentElement.classList.contains('action-grid');
    if (wideReady && cardInFinalGrid) {
      document.documentElement.classList.remove('pdfu-first-paint-pending');
      return true;
    }
    return false;
  }

  let attempts = 0;
  function check() {
    attempts += 1;
    if (revealWhenReady()) return;
    if (attempts < 120) setTimeout(check, 50);
    else document.documentElement.classList.remove('pdfu-first-paint-pending');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
})();
