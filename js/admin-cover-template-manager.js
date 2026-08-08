// Dedicated administrator UI for cover image templates.
(function () {
  'use strict';
  if (window.__adminCoverTemplateManagerV1) return;
  window.__adminCoverTemplateManagerV1 = true;
  if (!/\/admin\.html$/.test(location.pathname)) return;

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const STORAGE_SCRIPT_ID = 'adminCoverTemplateFirebaseStorage';
  const PANEL_ID = 'coverTemplatesAdminPanel';
  const NAV_ID = 'coverTemplatesAdminNav';
  const STYLE_ID = 'adminCoverTemplateManagerStyles';
  const INSTALL_DELAYS = [400, 900, 1500, 2300];

  let installed = false;
  let currentUser = null;
  let templates = [];
  let selectedId = '';
  let frontFile = null;
  let backFile = null;
  let busy = false;

  const q = (id) => document.getElementById(id);
  const text = (value) => String(value == null ? '' : value);

  function validateImageFile(file) {
    if (!file) return { ok: true, message: '' };
    if (!ALLOWED_TYPES.has(file.type)) return { ok: false, message: 'JPG·PNG·WEBP 이미지만 사용할 수 있습니다.' };
    if (Number(file.size || 0) > MAX_FILE_BYTES) return { ok: false, message: '이미지는 한 장당 15MB 이하만 등록할 수 있습니다.' };
    return { ok: true, message: '' };
  }

  function extensionFor(file) {
    if (file?.type === 'image/jpeg') return 'jpg';
    if (file?.type === 'image/webp') return 'webp';
    return 'png';
  }

  function isObjectNotFound(error) {
    const code = text(error?.code).toLowerCase();
    return code.includes('object-not-found') || code.includes('storage/object-not-found');
  }

  function installStyles() {
    if (q(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .admin-cover-grid{display:grid;grid-template-columns:minmax(320px,.85fr) minmax(0,1.4fr);gap:14px}
      .admin-cover-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .admin-cover-form .admin-cover-wide{grid-column:1/-1}
      .admin-cover-field label{display:block;font-size:10px;font-weight:900;color:#475467;margin-bottom:5px}
      .admin-cover-field input,.admin-cover-field select{width:100%;border:1px solid #cfd8e3;border-radius:9px;padding:9px;background:#fff;font-size:11px}
      .admin-cover-upload{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
      .admin-cover-file{border:1px dashed #bfd0e1;border-radius:12px;padding:12px;background:#f8fafc;min-width:0}
      .admin-cover-file strong{display:block;font-size:11px;margin-bottom:6px}.admin-cover-file input{width:100%;font-size:10px}
      .admin-cover-preview{height:140px;margin-top:8px;border:1px solid #e2e8f0;border-radius:9px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#94a3b8;font-size:10px;text-align:center;padding:8px}
      .admin-cover-preview img{width:100%;height:100%;object-fit:contain}
      .admin-cover-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
      .admin-cover-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .admin-cover-item{border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc;padding:10px;cursor:pointer;transition:.15s}
      .admin-cover-item:hover,.admin-cover-item.selected{border-color:#69a6ef;background:#f3f8ff;box-shadow:0 0 0 2px rgba(23,105,224,.08)}
      .admin-cover-thumbs{display:grid;grid-template-columns:1fr 1fr;gap:6px;height:118px;margin-bottom:8px}.admin-cover-thumb{border-radius:8px;background:#fff;border:1px solid #e4eaf1;display:grid;place-items:center;overflow:hidden;color:#a0aec0;font-size:9px}.admin-cover-thumb img{width:100%;height:100%;object-fit:cover}
      .admin-cover-item-head{display:flex;align-items:flex-start;gap:8px}.admin-cover-item-head .grow{flex:1;min-width:0}.admin-cover-item-name{font-size:11px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-cover-item-sub{font-size:9px;color:#667085;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .admin-cover-state{font-size:9px;font-weight:900;border-radius:999px;padding:4px 7px;white-space:nowrap}.admin-cover-state.public{background:#dcfce7;color:#166534}.admin-cover-state.private{background:#fff7ed;color:#9a3412}
      .admin-cover-empty{grid-column:1/-1;padding:36px;text-align:center;color:#98a2b3;font-size:11px;border:1px dashed #cbd5e1;border-radius:12px}
      .admin-cover-status{min-height:18px;margin-top:9px;font-size:10px;font-weight:850;line-height:1.5}.admin-cover-status.ok{color:#166534}.admin-cover-status.err{color:#dc2626}.admin-cover-status.info{color:#1769e0}
      @media(max-width:980px){.admin-cover-grid{grid-template-columns:1fr}.admin-cover-list{grid-template-columns:1fr 1fr}}
      @media(max-width:760px){.side{grid-template-columns:auto repeat(5,minmax(0,1fr))!important}.admin-cover-form,.admin-cover-upload,.admin-cover-list{grid-template-columns:1fr}.admin-cover-form .admin-cover-wide{grid-column:auto}.admin-cover-preview{height:110px}}
    `;
    document.head.appendChild(style);
  }

  function status(message, type = 'info') {
    const el = q('adminCoverStatus');
    if (!el) return;
    el.className = `admin-cover-status ${type}`;
    el.textContent = message;
  }

  function setBusy(value) {
    busy = Boolean(value);
    ['adminCoverSave', 'adminCoverNew', 'adminCoverDelete', 'adminCoverRefresh'].forEach((id) => {
      const el = q(id);
      if (el) el.disabled = busy;
    });
  }

  function loadStorageSdk() {
    if (firebase?.storage) return Promise.resolve();
    const existing = q(STORAGE_SCRIPT_ID);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (firebase?.storage) return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.')), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = STORAGE_SCRIPT_ID;
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  function makeNav() {
    if (q(NAV_ID)) return q(NAV_ID);
    const side = document.querySelector('.side');
    if (!side) return null;
    const button = document.createElement('button');
    button.id = NAV_ID;
    button.className = 'navbtn';
    button.type = 'button';
    button.dataset.tab = 'cover-templates';
    button.innerHTML = '<span>🖼</span>표지 템플릿';
    const sidefoot = side.querySelector('.sidefoot');
    side.insertBefore(button, sidefoot || null);
    button.addEventListener('click', openPanel);
    return button;
  }

  function makePanel() {
    if (q(PANEL_ID)) return q(PANEL_ID);
    const content = document.querySelector('.main .content');
    if (!content) return null;
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="hero"><h2>표지 제공 이미지 관리</h2><p>책표지 제작기에 제공할 앞표지·뒤표지 이미지를 관리자만 등록하고 공개 상태를 관리합니다.</p></div>
      <div class="admin-cover-grid">
        <div class="card">
          <div class="cardtitle">템플릿 등록·수정</div>
          <div class="cardsub">이미지는 한 장당 15MB 이하 JPG·PNG·WEBP만 등록할 수 있습니다.</div>
          <div class="admin-cover-form">
            <div class="admin-cover-field admin-cover-wide"><label for="adminCoverName">템플릿 이름</label><input id="adminCoverName" maxlength="80" placeholder="예: 교육 운영계획서 01"></div>
            <div class="admin-cover-field"><label for="adminCoverCategory">분류</label><input id="adminCoverCategory" maxlength="50" placeholder="예: 교육·보고서"></div>
            <div class="admin-cover-field"><label for="adminCoverPublic">공개 상태</label><select id="adminCoverPublic"><option value="true">회원 공개</option><option value="false">관리자 전용</option></select></div>
          </div>
          <div class="admin-cover-upload">
            <div class="admin-cover-file"><strong>앞표지 이미지</strong><input id="adminCoverFrontFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="admin-cover-preview" id="adminCoverFrontPreview">등록된 앞표지 없음</div></div>
            <div class="admin-cover-file"><strong>뒤표지 이미지</strong><input id="adminCoverBackFile" type="file" accept="image/jpeg,image/png,image/webp"><div class="admin-cover-preview" id="adminCoverBackPreview">등록된 뒤표지 없음</div></div>
          </div>
          <div class="admin-cover-actions"><button class="btn primary" id="adminCoverSave" type="button">저장</button><button class="btn soft" id="adminCoverNew" type="button">새 템플릿</button><button class="btn badbtn" id="adminCoverDelete" type="button">선택 삭제</button></div>
          <div class="admin-cover-status" id="adminCoverStatus"></div>
        </div>
        <div class="card">
          <div class="cardtitle">등록된 제공 이미지</div>
          <div class="cardsub">항목을 선택하면 이름·분류·공개 여부를 수정하거나 이미지를 교체할 수 있습니다.</div>
          <div class="toolbar"><input id="adminCoverSearch" placeholder="템플릿 이름 또는 분류 검색"><select id="adminCoverFilter"><option value="all">전체</option><option value="public">회원 공개</option><option value="private">관리자 전용</option></select><button class="btn soft" id="adminCoverRefresh" type="button">새로고침</button></div>
          <div class="admin-cover-list" id="adminCoverList"></div>
        </div>
      </div>`;
    content.appendChild(panel);
    return panel;
  }

  function openPanel() {
    document.querySelectorAll('.navbtn[data-tab]').forEach((button) => button.classList.toggle('on', button.id === NAV_ID));
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('on', panel.id === PANEL_ID));
    const title = q('pageTitle');
    const sub = q('pageSub');
    if (title) title.textContent = '표지 템플릿 관리';
    if (sub) sub.textContent = '책표지 제작기에 제공할 이미지를 등록하고 공개 상태를 관리합니다.';
    loadTemplates().catch((error) => status(error.message || '템플릿 목록을 불러오지 못했습니다.', 'err'));
  }

  function clearPreview(id, emptyText) {
    const box = q(id);
    if (!box) return;
    box.replaceChildren(document.createTextNode(emptyText));
  }

  function setPreview(id, url, emptyText) {
    const box = q(id);
    if (!box) return;
    box.replaceChildren();
    if (!url) {
      box.textContent = emptyText;
      return;
    }
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    img.addEventListener('error', () => { box.textContent = '미리보기를 불러오지 못했습니다.'; }, { once: true });
    box.appendChild(img);
  }

  function selectedTemplate() {
    return templates.find((item) => item.id === selectedId) || null;
  }

  function resetForm() {
    selectedId = '';
    frontFile = null;
    backFile = null;
    if (q('adminCoverName')) q('adminCoverName').value = '';
    if (q('adminCoverCategory')) q('adminCoverCategory').value = '';
    if (q('adminCoverPublic')) q('adminCoverPublic').value = 'true';
    if (q('adminCoverFrontFile')) q('adminCoverFrontFile').value = '';
    if (q('adminCoverBackFile')) q('adminCoverBackFile').value = '';
    clearPreview('adminCoverFrontPreview', '등록된 앞표지 없음');
    clearPreview('adminCoverBackPreview', '등록된 뒤표지 없음');
    renderList();
    status('새 템플릿을 등록할 수 있습니다.', 'info');
  }

  function selectTemplate(id) {
    const item = templates.find((template) => template.id === id);
    if (!item) return;
    selectedId = item.id;
    frontFile = null;
    backFile = null;
    q('adminCoverName').value = text(item.name);
    q('adminCoverCategory').value = text(item.category);
    q('adminCoverPublic').value = item.isPublic === false ? 'false' : 'true';
    q('adminCoverFrontFile').value = '';
    q('adminCoverBackFile').value = '';
    setPreview('adminCoverFrontPreview', item.frontUrl, '등록된 앞표지 없음');
    setPreview('adminCoverBackPreview', item.backUrl, '등록된 뒤표지 없음');
    renderList();
    status('선택한 템플릿을 수정할 수 있습니다.', 'info');
  }

  function thumbnail(url, label) {
    const box = document.createElement('div');
    box.className = 'admin-cover-thumb';
    if (!url) {
      box.textContent = label;
      return box;
    }
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = url;
    img.addEventListener('error', () => { box.textContent = label; }, { once: true });
    box.appendChild(img);
    return box;
  }

  function renderList() {
    const list = q('adminCoverList');
    if (!list) return;
    const query = text(q('adminCoverSearch')?.value).trim().toLowerCase();
    const filter = q('adminCoverFilter')?.value || 'all';
    const filtered = templates.filter((item) => {
      const visible = item.isPublic === false ? 'private' : 'public';
      if (filter !== 'all' && filter !== visible) return false;
      if (!query) return true;
      return `${text(item.name)} ${text(item.category)}`.toLowerCase().includes(query);
    });
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-cover-empty';
      empty.textContent = templates.length ? '검색 조건에 맞는 템플릿이 없습니다.' : '등록된 제공 이미지가 없습니다.';
      list.appendChild(empty);
      return;
    }
    filtered.forEach((item) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `admin-cover-item${item.id === selectedId ? ' selected' : ''}`;
      card.dataset.templateId = item.id;
      card.setAttribute('aria-pressed', item.id === selectedId ? 'true' : 'false');
      const thumbs = document.createElement('div');
      thumbs.className = 'admin-cover-thumbs';
      thumbs.append(thumbnail(item.frontUrl, '앞표지 없음'), thumbnail(item.backUrl, '뒤표지 없음'));
      const head = document.createElement('div');
      head.className = 'admin-cover-item-head';
      const grow = document.createElement('div');
      grow.className = 'grow';
      const name = document.createElement('div');
      name.className = 'admin-cover-item-name';
      name.textContent = item.name || '이름 없는 템플릿';
      const sub = document.createElement('div');
      sub.className = 'admin-cover-item-sub';
      sub.textContent = item.category || '분류 없음';
      grow.append(name, sub);
      const state = document.createElement('span');
      state.className = `admin-cover-state ${item.isPublic === false ? 'private' : 'public'}`;
      state.textContent = item.isPublic === false ? '관리자 전용' : '회원 공개';
      head.append(grow, state);
      card.append(thumbs, head);
      card.addEventListener('click', () => selectTemplate(item.id));
      list.appendChild(card);
    });
  }

  async function loadTemplates() {
    if (!window.db) throw new Error('Firestore 연결을 확인할 수 없습니다.');
    status('템플릿 목록을 불러오는 중입니다...', 'info');
    const snap = await db.collection('cover_templates').orderBy('createdAt', 'desc').limit(100).get();
    templates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (selectedId && !templates.some((item) => item.id === selectedId)) selectedId = '';
    renderList();
    status(`등록된 템플릿 ${templates.length}개`, 'ok');
    return templates;
  }

  async function uploadFile(file, templateId, side) {
    const validation = validateImageFile(file);
    if (!validation.ok) throw new Error(validation.message);
    if (!file) return null;
    await loadStorageSdk();
    const path = `cover_templates/${templateId}/${side}-${Date.now()}.${extensionFor(file)}`;
    const ref = firebase.storage().ref(path);
    await ref.put(file, { contentType: file.type });
    return { path, url: await ref.getDownloadURL() };
  }

  async function deleteStoragePath(path) {
    if (!path) return true;
    await loadStorageSdk();
    try {
      await firebase.storage().ref(path).delete();
      return true;
    } catch (error) {
      if (isObjectNotFound(error)) return true;
      throw error;
    }
  }

  async function saveTemplate() {
    if (busy) return;
    const name = text(q('adminCoverName')?.value).trim();
    const category = text(q('adminCoverCategory')?.value).trim();
    const isPublic = q('adminCoverPublic')?.value !== 'false';
    if (!name) return status('템플릿 이름을 입력하세요.', 'err');
    const frontCheck = validateImageFile(frontFile);
    const backCheck = validateImageFile(backFile);
    if (!frontCheck.ok) return status(`앞표지: ${frontCheck.message}`, 'err');
    if (!backCheck.ok) return status(`뒤표지: ${backCheck.message}`, 'err');

    const existing = selectedTemplate();
    if (!existing && !frontFile && !backFile) return status('앞표지 또는 뒤표지 이미지를 한 장 이상 선택하세요.', 'err');
    const id = existing?.id || db.collection('cover_templates').doc().id;
    const uploaded = [];
    setBusy(true);
    status(existing ? '템플릿을 수정하는 중입니다...' : '템플릿을 등록하는 중입니다...', 'info');
    try {
      const front = frontFile ? await uploadFile(frontFile, id, 'front') : null;
      if (front) uploaded.push(front.path);
      const back = backFile ? await uploadFile(backFile, id, 'back') : null;
      if (back) uploaded.push(back.path);
      const data = {
        name: name.slice(0, 80),
        category: category.slice(0, 50),
        isPublic,
        frontUrl: front?.url || existing?.frontUrl || '',
        backUrl: back?.url || existing?.backUrl || '',
        frontPath: front?.path || existing?.frontPath || '',
        backPath: back?.path || existing?.backPath || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!existing) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = currentUser?.uid || '';
        data.createdByEmail = currentUser?.email || '';
      }
      await db.collection('cover_templates').doc(id).set(data, { merge: true });
      for (const oldPath of [
        front && existing?.frontPath && existing.frontPath !== front.path ? existing.frontPath : '',
        back && existing?.backPath && existing.backPath !== back.path ? existing.backPath : '',
      ]) {
        if (oldPath) deleteStoragePath(oldPath).catch((error) => console.warn('Old template image cleanup failed', error));
      }
      selectedId = id;
      frontFile = null;
      backFile = null;
      q('adminCoverFrontFile').value = '';
      q('adminCoverBackFile').value = '';
      await loadTemplates();
      selectTemplate(id);
      status(existing ? '템플릿을 수정했습니다.' : '새 템플릿을 등록했습니다.', 'ok');
      document.dispatchEvent(new CustomEvent('cover-admin-templates-changed', { detail: { id, action: existing ? 'update' : 'create' } }));
    } catch (error) {
      await Promise.allSettled(uploaded.map((path) => deleteStoragePath(path)));
      status(error?.message || '템플릿을 저장하지 못했습니다.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate() {
    if (busy) return;
    const item = selectedTemplate();
    if (!item) return status('삭제할 템플릿을 먼저 선택하세요.', 'err');
    if (!confirm(`“${item.name || '선택한 템플릿'}”을 삭제할까요?\n등록된 앞·뒤표지 이미지도 함께 삭제됩니다.`)) return;
    setBusy(true);
    status('템플릿 원본 이미지를 정리하는 중입니다...', 'info');
    try {
      await deleteStoragePath(item.frontPath);
      await deleteStoragePath(item.backPath);
      await db.collection('cover_templates').doc(item.id).delete();
      const deletedId = item.id;
      resetForm();
      await loadTemplates();
      status('템플릿과 원본 이미지를 삭제했습니다.', 'ok');
      document.dispatchEvent(new CustomEvent('cover-admin-templates-changed', { detail: { id: deletedId, action: 'delete' } }));
    } catch (error) {
      status(`삭제를 완료하지 못했습니다. 원본 연결을 보존했습니다. ${error?.message || ''}`.trim(), 'err');
    } finally {
      setBusy(false);
    }
  }

  function bindFilePreview(inputId, side) {
    q(inputId)?.addEventListener('change', (event) => {
      const file = event.target.files?.[0] || null;
      const validation = validateImageFile(file);
      if (!validation.ok) {
        event.target.value = '';
        if (side === 'front') frontFile = null; else backFile = null;
        return status(validation.message, 'err');
      }
      if (side === 'front') frontFile = file; else backFile = file;
      if (!file) return;
      const url = URL.createObjectURL(file);
      setPreview(side === 'front' ? 'adminCoverFrontPreview' : 'adminCoverBackPreview', url, '이미지 없음');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      status('새 이미지를 선택했습니다. 저장 버튼을 눌러 반영하세요.', 'info');
    });
  }

  function bindEvents() {
    q('adminCoverSave')?.addEventListener('click', saveTemplate);
    q('adminCoverNew')?.addEventListener('click', resetForm);
    q('adminCoverDelete')?.addEventListener('click', deleteTemplate);
    q('adminCoverRefresh')?.addEventListener('click', () => loadTemplates().catch((error) => status(error.message, 'err')));
    q('adminCoverSearch')?.addEventListener('input', renderList);
    q('adminCoverFilter')?.addEventListener('change', renderList);
    bindFilePreview('adminCoverFrontFile', 'front');
    bindFilePreview('adminCoverBackFile', 'back');
  }

  async function verifyAdmin() {
    const user = auth?.currentUser;
    if (!user || !window.ProgramAccess?.isAdmin) return false;
    const allowed = await ProgramAccess.isAdmin(user).catch(() => false);
    if (!allowed) return false;
    currentUser = user;
    return true;
  }

  async function install() {
    if (installed) return true;
    if (!document.querySelector('.side') || !document.querySelector('.main .content') || !window.auth || !window.db) return false;
    if (!await verifyAdmin()) return false;
    installStyles();
    if (!makeNav() || !makePanel()) return false;
    bindEvents();
    installed = true;
    loadTemplates().catch((error) => status(error.message || '템플릿 목록을 불러오지 못했습니다.', 'err'));
    return true;
  }

  window.AdminCoverTemplateManager = {
    validateImageFile,
    extensionFor,
    isObjectNotFound,
    loadTemplates,
    saveTemplate,
    deleteTemplate,
    resetForm,
    install,
    get selectedId() { return selectedId; },
    get count() { return templates.length; },
    stage: 'dedicated-admin-cover-template-management',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(() => install().catch(() => {}), delay);
  auth?.onAuthStateChanged?.(() => setTimeout(() => install().catch(() => {}), 120));
})();