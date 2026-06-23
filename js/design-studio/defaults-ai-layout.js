// Design Studio startup defaults and exact-size AI background generation.
(function () {
  if (window.__designStudioDefaultsAiLayoutV1) return;
  window.__designStudioDefaultsAiLayoutV1 = true;

  function install() {
    try {
      window.eval(`
        if (!window.__designStudioDefaultsAiLayoutInstalledV1) {
          window.__designStudioDefaultsAiLayoutInstalledV1 = true;

          function __dsSavedProjectIsLoaded() {
            try {
              const raw = localStorage.getItem(autosaveKey());
              if (!raw) return false;
              const saved = JSON.parse(raw);
              if (!saved || saved.tplId !== state.tplId) return false;
              const currentFront = JSON.stringify(state.sides.front.items || []);
              const currentBack = JSON.stringify(state.sides.back.items || []);
              const savedFront = JSON.stringify(saved.sides?.front?.items || []);
              const savedBack = JSON.stringify(saved.sides?.back?.items || []);
              return currentFront === savedFront && currentBack === savedBack;
            } catch (_) {
              return false;
            }
          }

          function __dsEmptyCurrentTemplate() {
            state.sides.front.items = [];
            state.sides.back.items = [];
            state.selectedId = null;
            loadedImgs.clear();
            renderItemList();
            render();
            history = [];
            historyIndex = -1;
            pushHistory();
            scheduleSave();
          }

          const __dsOriginalLoadTemplate = loadTemplate;
          loadTemplate = function patchedBlankLoadTemplate(tplId) {
            __dsOriginalLoadTemplate.call(this, tplId);
            __dsEmptyCurrentTemplate();
          };

          // Fresh access starts on Cover. Explicit template links are still respected.
          // A project restored through autosave remains untouched.
          if (!__dsSavedProjectIsLoaded()) {
            const requested = new URLSearchParams(location.search).get('template');
            const startTemplate = requested && TEMPLATES[requested] ? requested : 'cover';
            loadTemplate(startTemplate);
          }

          async function __dsLoadAdminImageProvider() {
            try {
              const snap = await db.collection('settings').doc('config').get();
              const provider = snap.exists ? snap.data()?.aiProviders?.image : null;
              if (provider === 'google' || provider === 'openai') setAiProvider(provider);
            } catch (_) {}
          }
          __dsLoadAdminImageProvider();

          function __dsNum(value, fallback) {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? n : fallback;
          }

          function __dsMm(value) {
            return Math.round(value * 100) / 100;
          }

          function __dsPromptCommon(widthMm, heightMm, bleedMm, coverTypeEn, userDesc, itemTexts) {
            const ratio = widthMm / heightMm;
            return 'Create a flat, print-ready 2D background artwork for a ' + coverTypeEn + '. ' +
              'The final artwork canvas must have the exact physical proportion ' + widthMm + ' mm wide by ' + heightMm + ' mm high, aspect ratio ' + ratio.toFixed(6) + ':1. ' +
              'Compose specifically for this exact horizontal-to-vertical proportion; do not use a generic poster, square, or screen ratio. ' +
              'Fill every edge and corner continuously, including the ' + bleedMm + ' mm bleed area, with no empty margin. ' +
              (userDesc ? 'Requested visual mood and style: ' + userDesc + '. ' : '') +
              (itemTexts ? 'Visual theme reference only, never render these words: ' + itemTexts + '. ' : '') +
              'Generate background graphics only. Absolutely no text, letters, numbers, logos, watermarks, captions, labels, borders, crop marks, registration marks, frames, templates, or typographic elements. ';
          }

          generateAiBg = async function patchedGenerateAiBg() {
            const btn = $('generateBgBtn');
            const status = $('aiStatus');
            btn.disabled = true;
            status.className = 'ai-status loading';
            status.textContent = '⏳ 실제 용지 비율에 맞춰 AI 배경 생성 중...';

            try {
              const tpl = TEMPLATES[state.tplId];
              const userDesc = ($('aiDesc').value || '').trim();
              const coverType = $('coverType').value || '일반';
              const coverTypeEn = COVER_TYPE_PROMPT[coverType] || coverType;
              const itemTexts = curSide().items
                .filter(function(i) { return (i.type || 'text') === 'text' && (i.text || '').trim(); })
                .map(function(i) { return i.text; }).slice(0, 5).join(', ');

              const paperW = __dsNum($('paperW').value, 210);
              const paperH = __dsNum($('paperH').value, 297);
              const bleed = __dsNum($('bleedInput').value, 3);
              const spineW = tpl.hasSpine && !state.noSpine ? Math.max(0, Number(state.spineW) || 0) : 0;
              const contentW = tpl.isSpread ? paperW * 2 + spineW : paperW;
              const contentH = paperH;
              const outputW = __dsMm(contentW + bleed * 2);
              const outputH = __dsMm(contentH + bleed * 2);
              const targetRatio = outputW / outputH;

              let prompt = __dsPromptCommon(outputW, outputH, bleed, coverTypeEn, userDesc, itemTexts);

              if (tpl.isSpread) {
                const backPct = paperW / contentW * 100;
                const spinePct = spineW / contentW * 100;
                const frontStartPct = (paperW + spineW) / contentW * 100;
                prompt +=
                  'This is one single continuous full book-cover spread laid flat: back cover on the left, spine area in the middle, and front cover on the right. ' +
                  'Use the panel geometry only for composition planning: back cover approximately ' + backPct.toFixed(3) + '% of the trim width, spine approximately ' + spinePct.toFixed(3) + '%, and front cover begins at approximately ' + frontStartPct.toFixed(3) + '%. ' +
                  'The visual design must flow seamlessly across the entire spread as one uninterrupted image. ' +
                  'CRITICAL COVER RULES: do not draw, imply, shade, emboss, highlight, darken, outline, or separate the spine. ' +
                  'No vertical stripe, center band, seam, crease, gutter, fold, hinge, ridge, bevel, book edge, panel divider, guide line, shadow, glow, gradient edge, or tonal change at either spine boundary. ' +
                  'Do not create a 3D book mockup, perspective view, standing book, folded book, curved cover, page block, drop shadow, cast shadow, or studio product photograph. ' +
                  'Return only the perfectly flat rectangular print artwork viewed straight-on. ' +
                  'Keep the left back-cover zone calmer and reserve a clean readable area on the right front-cover zone, while maintaining completely continuous color and texture through the invisible spine region.';
              } else if (tpl.hasFold) {
                prompt +=
                  'This is a flat ' + state.foldCount + '-panel leaflet artwork. Design one continuous background over the full sheet. ' +
                  'Do not show fold lines, panel borders, seams, creases, shadows, gutters, mockup folds, paper edges, or panel-number indicators. ' +
                  'Use the panels only as invisible composition zones.';
              } else {
                prompt +=
                  'Create a straight-on flat rectangular print background with balanced composition and useful clean areas for later text placement. ' +
                  'Do not show paper edges, drop shadows, mockup surfaces, frames, or perspective distortion.';
              }

              const aspect = targetRatio > 1.08 ? 'wide' : (targetRatio < 0.92 ? 'tall' : 'square');
              const user = auth.currentUser;
              if (!user) throw new Error('로그인이 필요합니다.');
              const token = await user.getIdToken(true);
              const res = await fetch('/api/ai/generate-bg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                  prompt: prompt,
                  aspect: aspect,
                  provider: _aiProvider,
                  width_mm: outputW,
                  height_mm: outputH,
                  target_ratio: targetRatio,
                  template: state.tplId,
                  is_spread: !!tpl.isSpread,
                  paper_width_mm: paperW,
                  paper_height_mm: paperH,
                  spine_width_mm: spineW,
                  bleed_mm: bleed
                })
              });

              if (!res.ok) {
                const err = await res.json().catch(function() { return {}; });
                throw new Error(err.detail || ('HTTP ' + res.status));
              }

              const data = await res.json();
              const mime = data.mime_type || 'image/png';
              curSide().bgData = 'data:' + mime + ';base64,' + data.b64_json;
              loadBgImage(state.activeSide, curSide().bgData);
              $('clearBgBtn').style.display = '';
              pushHistory();
              scheduleSave();
              status.className = 'ai-status success';
              const providerLabel = data.provider === 'openai' ? 'OpenAI' : 'Google Imagen';
              const sizeLabel = data.output_width && data.output_height ? ' · ' + data.output_width + '×' + data.output_height + 'px' : '';
              status.textContent = '✓ ' + outputW + '×' + outputH + 'mm 비율 배경 생성 완료 (' + providerLabel + sizeLabel + ')';
              setTimeout(function() { status.className = 'ai-status'; }, 5000);
            } catch (e) {
              status.className = 'ai-status error';
              status.textContent = '오류: ' + (e.message || e);
            } finally {
              btn.disabled = false;
            }
          };
        }
      `);
      return true;
    } catch (e) {
      console.warn('[design-studio-defaults-ai] install failed', e);
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', install);
  setTimeout(install, 300);
  const timer = setInterval(function() {
    if (install()) clearInterval(timer);
  }, 500);
  setTimeout(function() { clearInterval(timer); }, 10000);
})();
