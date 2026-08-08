// Administrator service image library for PDF dividers and book covers.
(function () {
  'use strict';
  if (window.__adminServiceImageLibraryV2) return;
  window.__adminServiceImageLibraryV2 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/admin' && path !== '/admin.html' && !path.endsWith('/admin.html')) return;

  const KIND = 'service-image-v2';
  const MAX_BYTES = 15 * 1024 * 1024;
  const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const NAV_ID = 'adminServiceImageNav';
  const PANEL_ID = 'adminServiceImagePanel';
  const STYLE_ID = 'adminServiceImageStyles';
  const STORAGE_ID = 'adminServiceImageStorageSdk';
  const PRESETS = {
    a5: { label: 'A5 · 148 × 210mm', w: 148, h: 210 },
    b5iso: { label: 'B5(ISO) · 176 × 250mm', w: 176, h: 250 },
    b5jis: { label: 'B5(JIS) · 182 × 257mm', w: 182, h: 257 },
    a4: { label: 'A4 · 210 × 297mm', w: 210, h: 297 },
    a3: { label: 'A3 · 297 × 420mm', w: 297, h: 420 },
    b4: { label: 'B4 · 250 × 354mm', w: 250, h: 354 },
    spread: { label: 'A3 이상 · 펼침 표지용', w: 420, h: 297 },
    custom: { label: '직접 입력', w: 210, h: 297 },
  };

  let installed = false;
  let busy = false;
  let currentUser = null;
  let items = [];
  let selectedId = '';
  let selectedFile = null;
  const $ = (id) => document.getElementById(id);
  const text = (v) => String(v == null ? '' : v);

  function styles() {
    if ($(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = `
      .svc2-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}.svc2-card{border:1px solid #dfe7ef;border-radius:14px;background:#fff;padding:16px}.svc2-head{display:flex;gap:10px;align-items:flex-start}.svc2-icon{width:40px;height:40px;border-radius:11px;background:#eef5ff;display:grid;place-items:center;font-size:19px}.svc2-name{font-size:13px;font-weight:950}.svc2-desc{font-size:9px;color:#667085;line-height:1.55;margin-top:4px}.svc2-layout{display:grid;grid-template-columns:minmax(320px,.82fr) minmax(0,1.3fr);gap:14px}.svc2-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.svc2-wide{grid-column:1/-1}.svc2-field label{display:block;font-size:10px;font-weight:900;color:#475467;margin-bottom:5px}.svc2-field input,.svc2-field select{width:100%;border:1px solid #cfd8e3;border-radius:9px;padding:9px;background:#fff;font-size:11px}.svc2-upload{border:1px dashed #bfd0e1;background:#f8fafc;border-radius:11px;padding:11px;margin-top:10px}.svc2-preview{height:185px;border:1px solid #e2e8f0;background:#fff;border-radius:9px;margin-top:8px;display:grid;place-items:center;overflow:hidden;color:#98a2b3;font-size:10px}.svc2-preview img{width:100%;height:100%;object-fit:contain}.svc2-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:11px}.svc2-status{min-height:18px;margin-top:8px;font-size:10px;font-weight:850;line-height:1.45}.svc2-status.ok{color:#166534}.svc2-status.err{color:#dc2626}.svc2-status.info{color:#1769e0}.svc2-summary{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}.svc2-summary span{font-size:9px;font-weight:900;background:#eef2f7;color:#475467;border-radius:999px;padding:5px 8px}.svc2-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.svc2-item{border:1px solid #e2e8f0;background:#f8fafc;border-radius:11px;padding:8px;cursor:pointer;text-align:left}.svc2-item.on{border-color:#69a6ef;background:#f3f8ff;box-shadow:0 0 0 2px #1769e012}.svc2-thumb{aspect-ratio:4/3;border:1px solid #e5eaf0;border-radius:8px;background:#fff;overflow:hidden;display:grid;place-items:center;color:#98a2b3;font-size:9px}.svc2-thumb img{width:100%;height:100%;object-fit:cover}.svc2-title{font-size:10px;font-weight:950;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.svc2-meta{font-size:8px;color:#667085;margin-top:3px;line-height:1.45}.svc2-badge{display:inline-block;margin-top:5px;border-radius:999px;padding:3px 6px;font-size:8px;font-weight:900;background:#dcfce7;color:#166534}.svc2-empty{grid-column:1/-1;padding:30px;text-align:center;border:1px dashed #cbd5e1;border-radius:11px;color:#98a2b3;font-size:10px}
      @media(max-width:1100px){.svc2-layout{grid-template-columns:1fr}.svc2-list{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.side{grid-template-columns:auto repeat(5,minmax(0,1fr))!important}.svc2-cards,.svc2-form,.svc2-list{grid-template-columns:1fr}.svc2-wide{grid-column:auto}}`;
    document.head.appendChild(el);
  }

  function note(message, type = 'info') {
    const el = $('svc2Status');
    if (!el) return;
    el.className = `svc2-status ${type}`;
    el.textContent = message;
  }
  function lock(value) {
    busy = Boolean(value);
    ['svc2Save','svc2New','svc2Delete','svc2Refresh'].forEach((id) => { if ($(id)) $(id).disabled = busy; });
  }
  function validateFile(file) {
    if (!file) return { ok: true, message: '' };
    if (!TYPES.has(file.type)) return { ok: false, message: 'JPG·PNG·WEBP 이미지만 등록할 수 있습니다.' };
    if (Number(file.size || 0) > MAX_BYTES) return { ok: false, message: '이미지는 한 장당 15MB 이하만 등록할 수 있습니다.' };
    return { ok: true, message: '' };
  }
  function ext(file) { return file?.type === 'image/jpeg' ? 'jpg' : file?.type === 'image/webp' ? 'webp' : 'png'; }
  function isMissing(error) { return text(error?.code).toLowerCase().includes('object-not-found'); }
  function uniquePath(id, file) {
    const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `cover_templates/${id}/service-${nonce}.${ext(file)}`;
  }
  function storageReady() {
    if (firebase?.storage) return Promise.resolve();
    const existing = $(STORAGE_ID);
    if (existing) return new Promise((resolve, reject) => {
      if (firebase?.storage) return resolve();
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.')), { once: true });
    });
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.id = STORAGE_ID;
      s.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.'));
      document.head.appendChild(s);
    });
  }
  async function removeStorage(path) {
    if (!path) return;
    await storageReady();
    try { await firebase.storage().ref(path).delete(); }
    catch (error) { if (!isMissing(error)) throw error; }
  }
  async function upload(file, id) {
    const v = validateFile(file);
    if (!v.ok) throw new Error(v.message);
    await storageReady();
    const path = uniquePath(id, file);
    const ref = firebase.storage().ref(path);
    await ref.put(file, { contentType: file.type });
    return { path, url: await ref.getDownloadURL() };
  }

  function hideOldConsole() {
    ['adminServiceConsoleNav','adminServicesNavLabel','adminServiceConsolePanel','coverTemplatesAdminNav','coverTemplatesAdminPanel'].forEach((id) => {
      const el = $(id); if (el) el.style.display = 'none';
    });
  }
  function makeNav() {
    if ($(NAV_ID)) return $(NAV_ID);
    const side = document.querySelector('.side');
    if (!side) return null;
    const foot = side.querySelector('.sidefoot');
    const label = document.createElement('div');
    label.className = 'navlabel'; label.id = 'adminServiceImageLabel'; label.textContent = '서비스 운영';
    const btn = document.createElement('button');
    btn.id = NAV_ID; btn.className = 'navbtn'; btn.type = 'button'; btn.dataset.tab = 'service-images'; btn.innerHTML = '<span>🖼️</span>서비스 관리';
    side.insertBefore(label, foot || null); side.insertBefore(btn, foot || null);
    btn.addEventListener('click', openPanel);
    return btn;
  }
  function makePanel() {
    if ($(PANEL_ID)) return $(PANEL_ID);
    const content = document.querySelector('.main .content');
    if (!content) return null;
    const panel = document.createElement('section');
    panel.id = PANEL_ID; panel.className = 'panel';
    panel.innerHTML = `
      <div class="hero"><h2>서비스 이미지 관리</h2><p>PDF 편집기의 간지와 책표지 제작에 제공할 이미지를 규격별로 관리합니다.</p></div>
      <div class="svc2-cards">
        <div class="svc2-card"><div class="svc2-head"><div class="svc2-icon">📄</div><div><div class="svc2-name">PDF 편집 · 간지 이미지</div><div class="svc2-desc">A5·B5·A4·A3·B4 등 출력 용지 규격에 맞는 간지 배경 이미지를 제공합니다.</div></div></div></div>
        <div class="svc2-card"><div class="svc2-head"><div class="svc2-icon">📘</div><div><div class="svc2-name">책표지 제작 · 표지 이미지</div><div class="svc2-desc">앞·뒤 개별 이미지 또는 A3 이상 펼침형 이미지를 제공해 앞+책등+뒤를 한 장으로 연결할 수 있습니다.</div></div></div></div>
      </div>
      <div class="svc2-layout">
        <div class="card"><div class="cardtitle">규격별 이미지 등록</div><div class="cardsub">이미지 한 장에 사용처와 규격을 지정합니다.</div>
          <div class="svc2-form">
            <div class="svc2-field svc2-wide"><label>이미지 이름</label><input id="svc2Name" maxlength="80" placeholder="예: A4 교육 보고서 파란 배경"></div>
            <div class="svc2-field"><label>사용처</label><select id="svc2Target"><option value="cover">책표지 제작</option><option value="pdf-divider">PDF 편집 · 간지</option><option value="both">둘 다 사용</option></select></div>
            <div class="svc2-field"><label>규격</label><select id="svc2Size">${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select></div>
            <div class="svc2-field"><label>가로(mm)</label><input id="svc2Width" type="number" min="50" max="2000" step="0.1" value="148"></div>
            <div class="svc2-field"><label>세로(mm)</label><input id="svc2Height" type="number" min="50" max="2000" step="0.1" value="210"></div>
            <div class="svc2-field"><label>책표지 적용 방식</label><select id="svc2CoverMode"><option value="single">앞/뒤 개별 적용</option><option value="spread">펼침 · 앞+책등+뒤 연결</option></select></div>
            <div class="svc2-field"><label>공개 상태</label><select id="svc2Public"><option value="true">회원 공개</option><option value="false">관리자 전용</option></select></div>
            <div class="svc2-field svc2-wide"><label>분류</label><input id="svc2Category" maxlength="50" placeholder="예: 교육·보고서"></div>
          </div>
          <div class="svc2-upload"><div class="svc2-field"><label>제공 이미지</label><input id="svc2File" type="file" accept="image/jpeg,image/png,image/webp"></div><div id="svc2Preview" class="svc2-preview">등록할 이미지를 선택하세요.</div></div>
          <div class="svc2-actions"><button class="btn primary" id="svc2Save" type="button">저장</button><button class="btn soft" id="svc2New" type="button">새 이미지</button><button class="btn badbtn" id="svc2Delete" type="button">선택 삭제</button></div><div id="svc2Status" class="svc2-status"></div>
        </div>
        <div class="card"><div class="cardtitle">서비스 제공 이미지</div><div class="cardsub">사용처와 규격으로 검색할 수 있습니다.</div><div class="svc2-summary"><span id="svc2All">전체 0</span><span id="svc2Cover">책표지 0</span><span id="svc2Pdf">PDF 간지 0</span></div><div class="toolbar"><input id="svc2Search" placeholder="이름·분류 검색"><select id="svc2TargetFilter"><option value="all">전체 사용처</option><option value="cover">책표지</option><option value="pdf-divider">PDF 간지</option></select><select id="svc2SizeFilter"><option value="all">전체 규격</option>${Object.entries(PRESETS).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('')}</select><button class="btn soft" id="svc2Refresh" type="button">새로고침</button></div><div id="svc2List" class="svc2-list"></div></div>
      </div>`;
    content.appendChild(panel);
    return panel;
  }
  function openPanel() {
    hideOldConsole();
    document.querySelectorAll('.navbtn[data-tab]').forEach((b) => b.classList.toggle('on', b.id === NAV_ID));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.id === PANEL_ID));
    if ($('pageTitle')) $('pageTitle').textContent = '서비스 관리';
    if ($('pageSub')) $('pageSub').textContent = 'PDF 간지와 책표지 제공 이미지를 규격별로 관리합니다.';
    loadItems().catch((e) => note(e.message, 'err'));
  }

  function targets(item) {
    if (Array.isArray(item.targets)) return item.targets;
    if (item.target === 'both') return ['cover','pdf-divider'];
    return item.target ? [item.target] : [];
  }
  function presetLabel(code) { return PRESETS[code]?.label || code || '규격 미지정'; }
  function currentItem() { return items.find((x) => x.id === selectedId) || null; }
  function preview(url, label = '등록할 이미지를 선택하세요.') {
    const box = $('svc2Preview'); if (!box) return; box.replaceChildren();
    if (!url) { box.textContent = label; return; }
    const img = document.createElement('img'); img.alt = ''; img.src = url; img.onerror = () => { box.textContent = '미리보기 오류'; }; box.appendChild(img);
  }
  function applyPreset() {
    const p = PRESETS[$('svc2Size').value] || PRESETS.custom;
    if ($('svc2Size').value !== 'custom') { $('svc2Width').value = p.w; $('svc2Height').value = p.h; }
    if ($('svc2Size').value === 'spread') $('svc2CoverMode').value = 'spread';
    updateCoverModeState();
  }
  function updateCoverModeState() {
    const target = $('svc2Target').value;
    $('svc2CoverMode').disabled = target === 'pdf-divider';
    if (target === 'pdf-divider') $('svc2CoverMode').value = 'single';
  }
  function reset() {
    selectedId = ''; selectedFile = null;
    $('svc2Name').value = ''; $('svc2Target').value = 'cover'; $('svc2Size').value = 'a5'; $('svc2Width').value = 148; $('svc2Height').value = 210; $('svc2CoverMode').value = 'single'; $('svc2Public').value = 'true'; $('svc2Category').value = ''; $('svc2File').value = '';
    preview('', '새 제공 이미지를 선택하세요.'); updateCoverModeState(); render(); note('새 이미지를 등록할 수 있습니다.');
  }
  function choose(id) {
    const item = items.find((x) => x.id === id); if (!item) return;
    selectedId = id; selectedFile = null;
    const t = targets(item); $('svc2Name').value = item.name || ''; $('svc2Target').value = t.length > 1 ? 'both' : (t[0] || 'cover'); $('svc2Size').value = PRESETS[item.sizeCode] ? item.sizeCode : 'custom'; $('svc2Width').value = Number(item.widthMm || PRESETS[$('svc2Size').value]?.w || 210); $('svc2Height').value = Number(item.heightMm || PRESETS[$('svc2Size').value]?.h || 297); $('svc2CoverMode').value = item.coverMode === 'spread' ? 'spread' : 'single'; $('svc2Public').value = item.isPublic === false ? 'false' : 'true'; $('svc2Category').value = item.category || ''; $('svc2File').value = ''; preview(item.imageUrl, '등록된 이미지가 없습니다.'); updateCoverModeState(); render(); note('선택한 이미지의 정보 또는 원본을 수정할 수 있습니다.');
  }
  function filtered() {
    const q = text($('svc2Search')?.value).trim().toLowerCase();
    const tf = $('svc2TargetFilter')?.value || 'all'; const sf = $('svc2SizeFilter')?.value || 'all';
    return items.filter((item) => {
      const ts = targets(item); if (tf !== 'all' && !ts.includes(tf)) return false; if (sf !== 'all' && item.sizeCode !== sf) return false;
      return !q || `${text(item.name)} ${text(item.category)}`.toLowerCase().includes(q);
    });
  }
  function render() {
    const list = $('svc2List'); if (!list) return; const shown = filtered(); list.replaceChildren();
    if (!shown.length) { const e = document.createElement('div'); e.className = 'svc2-empty'; e.textContent = items.length ? '조건에 맞는 이미지가 없습니다.' : '아직 등록된 서비스 이미지가 없습니다.'; list.appendChild(e); }
    else shown.forEach((item) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = `svc2-item${item.id === selectedId ? ' on' : ''}`;
      const th = document.createElement('div'); th.className = 'svc2-thumb'; if (item.imageUrl) { const im = document.createElement('img'); im.alt = ''; im.loading = 'lazy'; im.src = item.imageUrl; th.appendChild(im); } else th.textContent = '이미지 없음';
      const n = document.createElement('div'); n.className = 'svc2-title'; n.textContent = item.name || '이름 없음';
      const m = document.createElement('div'); m.className = 'svc2-meta'; const ts = targets(item).map((x) => x === 'cover' ? '책표지' : 'PDF 간지').join('·'); m.textContent = `${ts || '사용처 미지정'} · ${presetLabel(item.sizeCode)}${item.coverMode === 'spread' ? ' · 펼침' : ''}`;
      const badge = document.createElement('span'); badge.className = 'svc2-badge'; badge.textContent = item.isPublic === false ? '관리자 전용' : '회원 공개';
      b.append(th,n,m,badge); b.addEventListener('click', () => choose(item.id)); list.appendChild(b);
    });
    const cover = items.filter((x) => targets(x).includes('cover')).length; const pdf = items.filter((x) => targets(x).includes('pdf-divider')).length;
    $('svc2All').textContent = `전체 ${items.length}`; $('svc2Cover').textContent = `책표지 ${cover}`; $('svc2Pdf').textContent = `PDF 간지 ${pdf}`;
  }
  async function loadItems() {
    const snap = await db.collection('cover_templates').get();
    items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((x) => x.kind === KIND).sort((a,b) => text(a.name).localeCompare(text(b.name),'ko'));
    if (selectedId && !items.some((x) => x.id === selectedId)) selectedId = ''; render(); return items;
  }
  async function save() {
    if (busy) return; const name = text($('svc2Name').value).trim(); if (!name) return note('이미지 이름을 입력하세요.','err');
    const v = validateFile(selectedFile); if (!v.ok) return note(v.message,'err'); const old = currentItem(); if (!old && !selectedFile) return note('등록할 이미지를 선택하세요.','err');
    const target = $('svc2Target').value; const targetList = target === 'both' ? ['cover','pdf-divider'] : [target]; const widthMm = Number($('svc2Width').value); const heightMm = Number($('svc2Height').value); if (!(widthMm > 0 && heightMm > 0)) return note('가로·세로 규격을 확인하세요.','err');
    lock(true); note(old ? '서비스 이미지를 수정하고 있습니다...' : '서비스 이미지를 등록하고 있습니다...');
    const id = old?.id || db.collection('cover_templates').doc().id; let fresh = null;
    try {
      if (selectedFile) fresh = await upload(selectedFile, id);
      const data = { kind: KIND, name, category: text($('svc2Category').value).trim(), targets: targetList, sizeCode: $('svc2Size').value, widthMm, heightMm, coverMode: $('svc2CoverMode').value === 'spread' ? 'spread' : 'single', isPublic: $('svc2Public').value !== 'false', imageUrl: fresh?.url || old?.imageUrl || '', imagePath: fresh?.path || old?.imagePath || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      if (!old) { data.createdAt = firebase.firestore.FieldValue.serverTimestamp(); data.createdBy = currentUser.uid; data.createdByEmail = currentUser.email || ''; }
      await db.collection('cover_templates').doc(id).set(data, { merge: true });
      if (fresh && old?.imagePath && old.imagePath !== fresh.path) removeStorage(old.imagePath).catch((e) => console.warn('Old service image cleanup failed', e));
      selectedId = id; selectedFile = null; $('svc2File').value = ''; await loadItems(); choose(id); note(old ? '서비스 이미지를 수정했습니다.' : '서비스 이미지를 등록했습니다.','ok'); document.dispatchEvent(new CustomEvent('service-images-changed', { detail: { id } }));
    } catch (error) { if (fresh?.path) await removeStorage(fresh.path).catch(() => {}); note(error?.message || '서비스 이미지를 저장하지 못했습니다.','err'); }
    finally { lock(false); }
  }
  async function remove() {
    if (busy) return; const old = currentItem(); if (!old) return note('삭제할 이미지를 먼저 선택하세요.','err'); if (!confirm(`“${old.name || '선택한 이미지'}”을 삭제할까요?`)) return;
    lock(true); note('서비스 이미지를 삭제하고 있습니다...'); const path = old.imagePath; const id = old.id;
    try { await db.collection('cover_templates').doc(id).delete(); selectedId = ''; selectedFile = null; await loadItems(); reset(); let cleanupFailed = false; try { await removeStorage(path); } catch (e) { cleanupFailed = true; console.warn('Service image storage cleanup failed', e); } note(cleanupFailed ? '목록에서는 삭제했습니다. 저장소 원본 정리는 다시 시도할 수 있습니다.' : '서비스 이미지를 삭제했습니다.', cleanupFailed ? 'info' : 'ok'); document.dispatchEvent(new CustomEvent('service-images-changed',{detail:{id,action:'delete'}})); }
    catch (error) { note(error?.message || '서비스 이미지를 삭제하지 못했습니다.','err'); }
    finally { lock(false); }
  }
  function bind() {
    $('svc2Size').addEventListener('change', applyPreset); $('svc2Target').addEventListener('change', updateCoverModeState); $('svc2Save').addEventListener('click', save); $('svc2New').addEventListener('click', reset); $('svc2Delete').addEventListener('click', remove); $('svc2Refresh').addEventListener('click', () => loadItems().catch((e) => note(e.message,'err'))); $('svc2Search').addEventListener('input', render); $('svc2TargetFilter').addEventListener('change', render); $('svc2SizeFilter').addEventListener('change', render);
    $('svc2File').addEventListener('change', (event) => { const f = event.target.files?.[0] || null; const v = validateFile(f); if (!v.ok) { event.target.value = ''; selectedFile = null; return note(v.message,'err'); } selectedFile = f; if (!f) return; const url = URL.createObjectURL(f); preview(url); setTimeout(() => URL.revokeObjectURL(url), 5000); note('이미지를 선택했습니다. 저장 버튼을 눌러 반영하세요.'); });
  }
  async function install() {
    if (installed) return true; if (!document.querySelector('.side') || !document.querySelector('.main .content') || !window.auth || !window.db || !window.ProgramAccess?.isAdmin) return false;
    const user = auth.currentUser; if (!user || !await ProgramAccess.isAdmin(user).catch(() => false)) return false; currentUser = user; styles(); hideOldConsole(); if (!makeNav() || !makePanel()) return false; bind(); installed = true; document.documentElement.dataset.adminServiceImages = '1'; loadItems().catch((e) => note(e.message,'err')); return true;
  }
  window.AdminServiceImageLibrary = { install, loadItems, validateFile, presets: PRESETS, kind: KIND, stage: 'size-aware-service-image-library' };
  auth?.onAuthStateChanged?.(() => [250,600,1100].forEach((d) => setTimeout(install,d))); [250,600,1100].forEach((d) => setTimeout(install,d));
})();