// Size-aware service image library for the perfect-binding cover maker.
(function () {
  'use strict';
  if (window.__coverServiceImageLibraryV2) return;
  window.__coverServiceImageLibraryV2 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const KIND = 'service-image-v2';
  const PANEL_ID = 'coverServiceImagePanel';
  const STYLE_ID = 'coverServiceImageStyles';
  const INSTALL_DELAYS = [1200, 1900, 2700];
  let installed = false;
  let images = [];
  let renderPatchCount = 0;
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v == null ? '' : v);

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .cover-svc-lib{margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0}.cover-svc-head{display:flex;align-items:center;gap:7px;margin-bottom:7px}.cover-svc-head strong{font-size:11px}.cover-svc-head button{margin-left:auto}.cover-svc-filter{display:grid;grid-template-columns:1fr 105px;gap:6px;margin-bottom:7px}.cover-svc-filter input,.cover-svc-filter select{width:100%;border:1px solid #d5dee8;border-radius:8px;padding:7px 8px;background:#fff;font-size:10px}.cover-svc-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:410px;overflow:auto}.cover-svc-item{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:7px}.cover-svc-thumb{aspect-ratio:4/3;border:1px solid #e4eaf1;border-radius:7px;background:#fff;overflow:hidden;display:grid;place-items:center;color:#94a3b8;font-size:9px}.cover-svc-thumb img{width:100%;height:100%;object-fit:cover}.cover-svc-name{font-size:9px;font-weight:950;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cover-svc-meta{font-size:8px;color:#64748b;margin-top:2px;line-height:1.45}.cover-svc-actions{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}.cover-svc-actions.one{grid-template-columns:1fr}.cover-svc-actions button{border:1px solid #cfdbe7;border-radius:7px;background:#fff;color:#334155;padding:6px 4px;font-size:8px;font-weight:900;cursor:pointer}.cover-svc-actions button.primary{background:#12396d;color:#fff;border-color:#12396d}.cover-svc-empty{grid-column:1/-1;padding:22px 10px;text-align:center;color:#94a3b8;border:1px dashed #cbd5e1;border-radius:9px;font-size:9px}.cover-svc-status{font-size:9px;color:#64748b;line-height:1.45;margin-top:6px}.cover-spread-local{margin-top:8px;border:1px dashed #67c7d8;border-radius:9px;background:#ecfeff;padding:8px}.cover-spread-row{display:flex;gap:7px;align-items:center}.cover-spread-row label{flex:1;cursor:pointer;font-size:9px;font-weight:900;color:#0e7490}.cover-spread-note{font-size:8px;color:#64748b;line-height:1.4;margin-top:4px}.cover-spread-active{font-size:8px;font-weight:900;color:#166534;margin-top:5px}
      @media(max-width:720px){.cover-svc-list,.cover-svc-filter{grid-template-columns:1fr}}`;
    document.head.appendChild(el);
  }

  function currentTrim() {
    try { const s = getSpec(); return { w: Number(s.trimW), h: Number(s.trimH), totalW: Number(s.totalW), totalH: Number(s.totalH) }; }
    catch (_) { return { w: 210, h: 297, totalW: 420, totalH: 303 }; }
  }
  function itemTargets(item) { return Array.isArray(item.targets) ? item.targets : []; }
  function isSpread(item) { return item.coverMode === 'spread' || item.sizeCode === 'spread'; }
  function sizeMatches(item) {
    if (isSpread(item)) return true;
    const s = currentTrim(); const w = Number(item.widthMm || 0), h = Number(item.heightMm || 0);
    if (!(w > 0 && h > 0)) return true;
    return (Math.abs(w - s.w) <= 3 && Math.abs(h - s.h) <= 3) || (Math.abs(h - s.w) <= 3 && Math.abs(w - s.h) <= 3);
  }
  function sizeLabel(item) {
    const labels = { a5:'A5', b5iso:'B5 ISO', b5jis:'B5 JIS', a4:'A4', a3:'A3', b4:'B4', spread:'A3 이상 펼침', custom:'직접 규격' };
    return labels[item.sizeCode] || `${Number(item.widthMm || 0)}×${Number(item.heightMm || 0)}mm`;
  }
  function makeImage(url) {
    return new Promise((resolve, reject) => { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => resolve(img); img.onerror = () => reject(new Error('제공 이미지를 불러오지 못했습니다.')); img.src = url; });
  }
  function status(message) { const el = $('coverServiceStatus'); if (el) el.textContent = message; }

  function hideOld() {
    const old = $('coverProvidedImageLibraryPanel'); if (old) old.style.display = 'none';
    const select = $('coverTemplateSelect'); if (select) select.closest('.field')?.style.setProperty('display','none','important');
    const admin = $('adminTemplateArea'); if (admin) { admin.hidden = true; admin.style.display = 'none'; }
  }
  function makePanel() {
    if ($(PANEL_ID)) return $(PANEL_ID);
    const card = $('templateCard'); if (!card) return null;
    const panel = document.createElement('div'); panel.id = PANEL_ID; panel.className = 'cover-svc-lib';
    panel.innerHTML = `<div class="cover-svc-head"><strong>규격별 제공 이미지</strong><button type="button" class="mini-btn" id="coverServiceRefresh">새로고침</button></div><div class="card-note" style="margin-bottom:7px">현재 표지 규격에 맞는 이미지만 우선 표시합니다. 개별 이미지는 앞·뒤에 따로 배치하고, 펼침 이미지는 앞+책등+뒤에 한 장으로 이어집니다.</div><div class="cover-svc-filter"><input id="coverServiceSearch" placeholder="이미지 이름·분류 검색"><select id="coverServiceMode"><option value="all">전체 방식</option><option value="single">앞/뒤 개별</option><option value="spread">펼침</option></select></div><div id="coverServiceList" class="cover-svc-list"></div><div id="coverServiceStatus" class="cover-svc-status"></div>`;
    card.appendChild(panel); return panel;
  }

  function makeLocalSpreadUpload() {
    if ($('coverSpreadLocal')) return;
    const front = $('frontInput'); if (!front) return;
    const section = front.closest('section.card'); if (!section) return;
    const box = document.createElement('div'); box.id = 'coverSpreadLocal'; box.className = 'cover-spread-local';
    box.innerHTML = `<div class="cover-spread-row"><label for="coverSpreadInput">🖼️ 펼침 이미지 직접 넣기 · A3 이상/가로형 권장</label><button type="button" class="mini-btn" id="coverSpreadClear">펼침 삭제</button></div><input id="coverSpreadInput" class="upload-input" type="file" accept="image/jpeg,image/png,image/webp"><div class="cover-spread-note">한 장의 이미지를 뒤표지 → 책등 → 앞표지까지 끊김 없이 채웁니다. 앞·뒤 개별 이미지를 추가하면 해당 면만 위에 덮어쓸 수 있습니다.</div><div id="coverSpreadActive" class="cover-spread-active"></div>`;
    const imageFitField = $('imageFit')?.closest('.field'); section.insertBefore(box, imageFitField || null);
    $('coverSpreadInput').addEventListener('change', async (event) => {
      const file = event.target.files?.[0] || null; event.target.value = ''; if (!file) return;
      try { const img = await loadImageFile(file); state.__serviceSpreadImage = img; state.__serviceSpreadName = file.name; $('coverSpreadActive').textContent = `펼침 적용: ${file.name}`; requestRender(); try { window.CoverRecoveryCheckpoints?.queueSave?.({force:true}); } catch (_) {} }
      catch (e) { if (typeof setStatus === 'function') setStatus(e.message,'err'); }
    });
    $('coverSpreadClear').addEventListener('click', clearSpread);
    $('clearImagesBtn')?.addEventListener('click', clearSpread);
  }
  function clearSpread() { if (typeof state !== 'undefined') { state.__serviceSpreadImage = null; state.__serviceSpreadName = ''; } if ($('coverSpreadActive')) $('coverSpreadActive').textContent = ''; try { requestRender(); } catch (_) {} }

  async function applySingle(item, side) {
    try { status(`${side === 'front' ? '앞표지' : '뒤표지'}에 적용하는 중입니다...`); const image = await makeImage(item.imageUrl); const key = side === 'front' ? 'frontImage' : 'backImage'; if (side === 'front') state.frontImage = image; else state.backImage = image; if (typeof DEFAULT_LAYOUT !== 'undefined' && DEFAULT_LAYOUT[key]) state.layout[key] = { ...DEFAULT_LAYOUT[key] }; state.active = key; $(`${side}UploadBox`)?.classList.add('has-file'); if ($(`${side}Name`)) $(`${side}Name`).textContent = `제공 이미지 · ${item.name || ''}`; try { syncControls(); } catch (_) {} requestRender(); document.dispatchEvent(new CustomEvent('cover-template-applied',{detail:{source:'service-image-library',imageId:item.id,side}})); try { window.CoverRecoveryCheckpoints?.queueSave?.({force:true}); } catch (_) {} status(`“${item.name || '제공 이미지'}”를 적용했습니다.`); }
    catch (e) { status(e.message || '이미지를 적용하지 못했습니다.'); }
  }
  async function applySpread(item) {
    try { status('펼침 이미지를 적용하는 중입니다...'); const image = await makeImage(item.imageUrl); state.__serviceSpreadImage = image; state.__serviceSpreadName = item.name || '관리자 제공 펼침 이미지'; if ($('coverSpreadActive')) $('coverSpreadActive').textContent = `펼침 적용: ${state.__serviceSpreadName}`; requestRender(); document.dispatchEvent(new CustomEvent('cover-template-applied',{detail:{source:'service-image-library',imageId:item.id,side:'spread'}})); try { window.CoverRecoveryCheckpoints?.queueSave?.({force:true}); } catch (_) {} status(`“${item.name || '펼침 이미지'}”를 앞+책등+뒤에 연결했습니다.`); }
    catch (e) { status(e.message || '펼침 이미지를 적용하지 못했습니다.'); }
  }

  function filtered() {
    const q = text($('coverServiceSearch')?.value).trim().toLowerCase(); const mode = $('coverServiceMode')?.value || 'all';
    return images.filter((item) => sizeMatches(item) && (mode === 'all' || (mode === 'spread') === isSpread(item)) && (!q || `${text(item.name)} ${text(item.category)}`.toLowerCase().includes(q)));
  }
  function render() {
    const list = $('coverServiceList'); if (!list) return; const shown = filtered(); list.replaceChildren();
    if (!shown.length) { const e = document.createElement('div'); e.className = 'cover-svc-empty'; e.textContent = images.length ? '현재 표지 규격에 맞는 제공 이미지가 없습니다.' : '관리자가 공개한 책표지 이미지가 없습니다.'; list.appendChild(e); }
    else shown.forEach((item) => { const card = document.createElement('div'); card.className = 'cover-svc-item'; const th = document.createElement('div'); th.className = 'cover-svc-thumb'; const im = document.createElement('img'); im.alt = item.name || '제공 이미지'; im.loading = 'lazy'; im.src = item.imageUrl; th.appendChild(im); const n = document.createElement('div'); n.className = 'cover-svc-name'; n.textContent = item.name || '제공 이미지'; const meta = document.createElement('div'); meta.className = 'cover-svc-meta'; meta.textContent = `${sizeLabel(item)} · ${isSpread(item) ? '펼침형' : '앞/뒤 개별'}${item.category ? ` · ${item.category}` : ''}`; const actions = document.createElement('div'); actions.className = `cover-svc-actions${isSpread(item) ? ' one' : ''}`; if (isSpread(item)) { const b = document.createElement('button'); b.type='button'; b.className='primary'; b.textContent='앞+책등+뒤 펼침 적용'; b.addEventListener('click',()=>applySpread(item)); actions.appendChild(b); } else { const f=document.createElement('button'); f.type='button'; f.className='primary'; f.textContent='앞표지에 적용'; f.addEventListener('click',()=>applySingle(item,'front')); const b=document.createElement('button'); b.type='button'; b.textContent='뒤표지에 적용'; b.addEventListener('click',()=>applySingle(item,'back')); actions.append(f,b); } card.append(th,n,meta,actions); list.appendChild(card); });
    const s = currentTrim(); status(`현재 표지 ${Math.round(s.w)}×${Math.round(s.h)}mm · 맞는 이미지 ${shown.length}개 / 전체 ${images.length}개`);
  }
  async function loadImages() {
    const snap = await db.collection('cover_templates').where('isPublic','==',true).get();
    images = snap.docs.map((d)=>({id:d.id,...d.data()})).filter((x)=>x.kind===KIND && x.imageUrl && itemTargets(x).includes('cover')).sort((a,b)=>text(a.name).localeCompare(text(b.name),'ko')); render(); return images;
  }

  function patchRenderCover() {
    if (typeof window.renderCover !== 'function' || typeof state === 'undefined') return false;
    if (window.renderCover.__serviceSpreadRendererV2) return true;
    const delegate = window.renderCover;
    const patched = function serviceSpreadRenderCover(canvas, dpi=110, withGuides=state.showGuides, interactive=canvas.id==='previewCanvas') {
      if (!state.__serviceSpreadImage) return Reflect.apply(delegate, this, arguments);
      const s=getSpec(),pxPerMm=dpi/25.4,w=Math.max(1,Math.round(s.totalW*pxPerMm)),h=Math.max(1,Math.round(s.totalH*pxPerMm));canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';state.hitBoxes={};state.selectionBox=null;const mm=v=>v*pxPerMm,bleed=mm(s.bleed),trimW=mm(s.trimW),trimH=mm(s.trimH),spine=mm(s.spine),totalH=mm(s.totalH),backX=0,spineX=bleed+trimW,frontX=spineX+spine,backImageRect={x:backX,y:0,w:bleed+trimW,h:totalH},frontImageRect={x:frontX,y:0,w:trimW+bleed,h:totalH},backPanel={x:bleed,y:bleed,w:trimW,h:trimH},frontPanel={x:frontX,y:bleed,w:trimW,h:trimH};ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);drawImage(ctx,state.__serviceSpreadImage,{x:0,y:0,w,h:totalH},'cover','#fff',{x:0,y:0,scale:100});if(state.backImage)drawImage(ctx,state.backImage,backImageRect,$('imageFit').value,$('backColor').value,state.layout.backImage);if(state.frontImage)drawImage(ctx,state.frontImage,frontImageRect,$('imageFit').value,$('frontColor').value,state.layout.frontImage);state.hitBoxes.backImage=backImageRect;state.hitBoxes.frontImage=frontImageRect;const color=$('textColor').value,titlePx=clamp(num('titleSize',28),10,80)*dpi/72,maxTextW=trimW*.78;drawText(ctx,'frontTitle',$('frontTitle').value,frontPanel,maxTextW,titlePx,color,1.25,true);drawText(ctx,'frontSubtitle',$('frontSubtitle').value,frontPanel,maxTextW,titlePx*.52,color,1.2,false);drawText(ctx,'publisher',[$('publisher').value.trim(),$('publishYear').value.trim()].filter(Boolean).join(' · '),frontPanel,maxTextW,titlePx*.42,color,1.15,true);drawText(ctx,'backText',$('backText').value,backPanel,trimW*.72,titlePx*.42,color,1.35,false);drawSpine(ctx,s,pxPerMm,spineX,bleed,trimH);if(withGuides){ctx.save();ctx.lineWidth=Math.max(1,dpi/100);ctx.setLineDash([mm(2),mm(1.2)]);ctx.strokeStyle='rgba(220,38,38,.92)';ctx.strokeRect(bleed,bleed,trimW,trimH);ctx.strokeRect(frontX,bleed,trimW,trimH);ctx.strokeStyle='rgba(37,99,235,.92)';ctx.beginPath();ctx.moveTo(spineX,bleed);ctx.lineTo(spineX,bleed+trimH);ctx.moveTo(frontX,bleed);ctx.lineTo(frontX,bleed+trimH);ctx.stroke();const safe=mm(s.safe);ctx.strokeStyle='rgba(21,128,61,.85)';ctx.strokeRect(bleed+safe,bleed+safe,trimW-safe*2,trimH-safe*2);ctx.strokeRect(frontX+safe,bleed+safe,trimW-safe*2,trimH-safe*2);ctx.restore()}if(interactive)drawSelection(ctx,state.hitBoxes[state.active],dpi);return s;
    };
    patched.__serviceSpreadRendererV2 = true; patched.__serviceSpreadDelegate = delegate; window.renderCover = patched; renderPatchCount += 1; return true;
  }

  function bind() {
    $('coverServiceRefresh')?.addEventListener('click',()=>loadImages().catch((e)=>status(e.message))); $('coverServiceSearch')?.addEventListener('input',render); $('coverServiceMode')?.addEventListener('change',render); $('sizePreset')?.addEventListener('change',()=>setTimeout(render,0)); ['trimW','trimH'].forEach((id)=>$(id)?.addEventListener('input',()=>setTimeout(render,0))); document.addEventListener('service-images-changed',()=>loadImages().catch(()=>{}));
  }
  function install() {
    patchRenderCover(); if (installed) return true; if (!$('templateCard') || !window.db || typeof state === 'undefined') return false; styles(); hideOld(); if (!makePanel()) return false; makeLocalSpreadUpload(); bind(); installed = true; document.documentElement.dataset.coverServiceImages='1'; loadImages().catch((e)=>status(e.message)); return true;
  }
  window.CoverServiceImageLibrary = { install, loadImages, applySingle, applySpread, clearSpread, patchRenderCover, get images(){return [...images];}, kind:KIND, stage:'size-aware-cover-service-images', get renderPatchCount(){return renderPatchCount;} };
  for (const delay of INSTALL_DELAYS) setTimeout(install,delay); setTimeout(patchRenderCover,3000);
})();