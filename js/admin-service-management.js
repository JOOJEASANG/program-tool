// Expand the administrator console into service-oriented operations.
(function () {
  'use strict';
  if (window.__adminServiceManagementV1) return;
  window.__adminServiceManagementV1 = true;
  if (!/\/admin\.html$/.test(location.pathname)) return;

  const MAX_FILE_BYTES = 15 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const STORAGE_SCRIPT_ID = 'adminServiceFirebaseStorage';
  const NAV_ID = 'adminServiceManagementNav';
  const PANEL_ID = 'adminServiceManagementPanel';
  const STYLE_ID = 'adminServiceManagementStyles';
  const INSTALL_DELAYS = [350, 800, 1400, 2200];
  const KIND = 'library-image';

  let installed = false;
  let busy = false;
  let currentUser = null;
  let images = [];
  let selectedId = '';
  let selectedFile = null;

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
      .admin-service-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .admin-service-card{border:1px solid #dfe7ef;background:#fff;border-radius:15px;padding:16px;box-shadow:0 8px 24px #0f172a08}
      .admin-service-card.active{border-color:#6aa5eb;box-shadow:0 0 0 2px rgba(23,105,224,.08)}
      .admin-service-card-head{display:flex;gap:10px;align-items:flex-start}.admin-service-icon{width:38px;height:38px;border-radius:11px;background:#eef5ff;display:grid;place-items:center;font-size:19px;flex:none}
      .admin-service-name{font-size:13px;font-weight:950}.admin-service-desc{font-size:9px;color:#667085;line-height:1.55;margin-top:4px;min-height:28px}
      .admin-service-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.admin-service-actions a{text-decoration:none;display:inline-flex;align-items:center}
      .admin-image-layout{display:grid;grid-template-columns:minmax(300px,.78fr) minmax(0,1.35fr);gap:14px}.admin-image-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.admin-image-wide{grid-column:1/-1}
      .admin-image-field label{display:block;font-size:10px;font-weight:900;color:#475467;margin-bottom:5px}.admin-image-field input,.admin-image-field select{width:100%;border:1px solid #cfd8e3;border-radius:9px;padding:9px;background:#fff;font-size:11px}
      .admin-image-upload{margin-top:10px;padding:12px;border:1px dashed #bfd0e1;border-radius:12px;background:#f8fafc}.admin-image-upload input{width:100%;font-size:10px}.admin-image-preview{height:190px;margin-top:9px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;display:grid;place-items:center;overflow:hidden;color:#98a2b3;font-size:10px;text-align:center}.admin-image-preview img{width:100%;height:100%;object-fit:contain}
      .admin-image-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.admin-image-status{min-height:19px;margin-top:9px;font-size:10px;font-weight:850;line-height:1.5}.admin-image-status.ok{color:#166534}.admin-image-status.err{color:#dc2626}.admin-image-status.info{color:#1769e0}
      .admin-image-summary{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px}.admin-image-summary span{font-size:9px;font-weight:900;padding:5px 8px;border-radius:999px;background:#eef2f7;color:#475467}
      .admin-image-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.admin-image-item{border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;padding:8px;cursor:pointer;transition:.14s}.admin-image-item:hover,.admin-image-item.selected{border-color:#69a6ef;background:#f3f8ff;box-shadow:0 0 0 2px rgba(23,105,224,.07)}
      .admin-image-thumb{aspect-ratio:4/3;border:1px solid #e4eaf1;border-radius:8px;background:#fff;overflow:hidden;display:grid;place-items:center;color:#98a2b3;font-size:9px}.admin-image-thumb img{width:100%;height:100%;object-fit:cover}.admin-image-meta{margin-top:7px}.admin-image-name{font-size:10px;font-weight:950;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-image-sub{font-size:8px;color:#667085;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.admin-image-state{display:inline-block;margin-top:6px;font-size:8px;font-weight:900;padding:3px 6px;border-radius:999px}.admin-image-state.public{background:#dcfce7;color:#166534}.admin-image-state.private{background:#fff7ed;color:#9a3412}.admin-image-empty{grid-column:1/-1;padding:32px;text-align:center;border:1px dashed #cbd5e1;border-radius:12px;color:#98a2b3;font-size:10px}
      @media(max-width:1100px){.admin-service-cards{grid-template-columns:1fr 1fr}.admin-image-layout{grid-template-columns:1fr}.admin-image-list{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @media(max-width:760px){.side{grid-template-columns:auto repeat(5,minmax(0,1fr))!important}.admin-service-cards{grid-template-columns:1fr}.admin-image-form,.admin-image-list{grid-template-columns:1fr}.admin-image-wide{grid-column:auto}.admin-image-preview{height:150px}}
    `;
    document.head.appendChild(style);
  }

  function setStatus(message, type = 'info') {
    const el = q('adminImageStatus');
    if (!el) return;
    el.className = `admin-image-status ${type}`;
    el.textContent = message;
  }

  function setBusy(value) {
    busy = Boolean(value);
    ['adminImageSave','adminImageNew','adminImageDelete','adminImageRefresh'].forEach((id) => {
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
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.')), { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.id = STORAGE_SCRIPT_ID;
      script.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-storage-compat.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Firebase Storage 모듈을 불러오지 못했습니다.'));
      document.head.appendChild(script);
    });
  }

  function hideLegacyTemplateManager() {
    const oldNav = q('coverTemplatesAdminNav');
    const oldPanel = q('coverTemplatesAdminPanel');
    if (oldNav) oldNav.style.display = 'none';
    if (oldPanel) oldPanel.style.display = 'none';
  }

  function makeNav() {
    if (q(NAV_ID)) return q(NAV_ID);
    const side = document.querySelector('.side');
    if (!side) return null;
    const serviceLabel = document.createElement('div');
    serviceLabel.className = 'navlabel';
    serviceLabel.id = 'adminServicesNavLabel';
    serviceLabel.textContent = '서비스 운영';
    const button = document.createElement('button');
    button.id = NAV_ID;
    button.className = 'navbtn';
    button.type = 'button';
    button.dataset.tab = 'service-management';
    button.innerHTML = '<span>🧩</span>서비스 관리';
    const sidefoot = side.querySelector('.sidefoot');
    side.insertBefore(serviceLabel, sidefoot || null);
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
      <div class="hero"><h2>서비스 운영 관리</h2><p>회원에게 제공하는 프로그램을 한 곳에서 확인하고, 서비스별 제공 자료와 운영 항목을 관리합니다.</p></div>
      <div class="admin-service-cards">
        <div class="admin-service-card active" data-admin-service="cover"><div class="admin-service-card-head"><div class="admin-service-icon">📘</div><div><div class="admin-service-name">책표지 제작</div><div class="admin-service-desc">사용자가 표지에 적용할 관리자 제공 이미지와 서비스 화면을 관리합니다.</div></div></div><div class="admin-service-actions"><button class="btn primary" type="button" id="adminManageCoverService">제공 이미지 관리</button><a class="btn soft" href="tools/perfect-binding-cover.html" target="_blank" rel="noopener">서비스 열기</a></div></div>
        <div class="admin-service-card" data-admin-service="pdf"><div class="admin-service-card-head"><div class="admin-service-icon">📄</div><div><div class="admin-service-name">PDF 편집</div><div class="admin-service-desc">PDF 편집 서비스 운영 상태를 확인하고 실제 사용자 화면을 바로 엽니다.</div></div></div><div class="admin-service-actions"><a class="btn soft" href="tools/pdf-editor.html" target="_blank" rel="noopener">서비스 열기</a></div></div>
        <div class="admin-service-card" data-admin-service="preflight"><div class="admin-service-card-head"><div class="admin-service-icon">🔎</div><div><div class="admin-service-name">PDF 검사</div><div class="admin-service-desc">인쇄 전 PDF 검사 서비스 화면을 확인합니다. 향후 서비스별 설정을 같은 구조로 확장할 수 있습니다.</div></div></div><div class="admin-service-actions"><a class="btn soft" href="tools/preflight.html" target="_blank" rel="noopener">서비스 열기</a></div></div>
      </div>
      <div id="adminCoverServiceWorkspace">
        <div class="admin-image-layout">
          <div class="card">
            <div class="cardtitle">책표지 제공 이미지 등록</div>
            <div class="cardsub">이미지 한 장씩 등록합니다. 사용자는 같은 이미지를 앞표지 또는 뒤표지에 선택해서 적용할 수 있습니다.</div>
            <div class="admin-image-form">
              <div class="admin-image-field admin-image-wide"><label for="adminImageName">이미지 이름</label><input id="adminImageName" maxlength="80" placeholder="예: 학교 운영계획서 파란 배경 01"></div>
              <div class="admin-image-field"><label for="adminImageCategory">분류</label><input id="adminImageCategory" maxlength="50" placeholder="예: 교육·보고서"></div>
              <div class="admin-image-field"><label for="adminImagePublic">공개 상태</label><select id="adminImagePublic"><option value="true">회원 공개</option><option value="false">관리자 전용</option></select></div>
            </div>
            <div class="admin-image-upload"><div class="admin-image-field"><label for="adminImageFile">제공 이미지</label><input id="adminImageFile" type="file" accept="image/jpeg,image/png,image/webp"></div><div class="admin-image-preview" id="adminImagePreview">등록할 이미지를 선택하세요.</div></div>
            <div class="admin-image-actions"><button class="btn primary" id="adminImageSave" type="button">저장</button><button class="btn soft" id="adminImageNew" type="button">새 이미지</button><button class="btn badbtn" id="adminImageDelete" type="button">선택 삭제</button></div>
            <div class="admin-image-status" id="adminImageStatus"></div>
          </div>
          <div class="card">
            <div class="cardtitle">사용자에게 제공되는 이미지</div>
            <div class="cardsub">회원 공개 상태인 이미지만 책표지 제작기의 제공 이미지 목록에 나타납니다.</div>
            <div class="admin-image-summary"><span id="adminImageAllCount">전체 0</span><span id="adminImagePublicCount">회원 공개 0</span><span id="adminImagePrivateCount">관리자 전용 0</span></div>
            <div class="toolbar"><input id="adminImageSearch" placeholder="이미지 이름 또는 분류 검색"><select id="adminImageFilter"><option value="all">전체</option><option value="public">회원 공개</option><option value="private">관리자 전용</option></select><button class="btn soft" id="adminImageRefresh" type="button">새로고침</button></div>
            <div class="admin-image-list" id="adminImageList"></div>
          </div>
        </div>
      </div>`;
    content.appendChild(panel);
    return panel;
  }

  function openPanel() {
    hideLegacyTemplateManager();
    document.querySelectorAll('.navbtn[data-tab]').forEach((button) => button.classList.toggle('on', button.id === NAV_ID));
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('on', panel.id === PANEL_ID));
    if (q('pageTitle')) q('pageTitle').textContent = '서비스 관리';
    if (q('pageSub')) q('pageSub').textContent = '회원에게 제공되는 프로그램과 서비스별 자료를 관리합니다.';
    loadImages().catch((error) => setStatus(error?.message || '제공 이미지 목록을 불러오지 못했습니다.', 'err'));
  }

  function setPreview(url, fallback = '등록할 이미지를 선택하세요.') {
    const box = q('adminImagePreview');
    if (!box) return;
    box.replaceChildren();
    if (!url) {
      box.textContent = fallback;
      return;
    }
    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    img.addEventListener('error', () => { box.textContent = '미리보기를 불러오지 못했습니다.'; }, { once: true });
    box.appendChild(img);
  }

  function selectedImage() {
    return images.find((item) => item.id === selectedId) || null;
  }

  function resetForm() {
    selectedId = '';
    selectedFile = null;
    q('adminImageName').value = '';
    q('adminImageCategory').value = '';
    q('adminImagePublic').value = 'true';
    q('adminImageFile').value = '';
    setPreview('', '새 제공 이미지를 선택하세요.');
    renderImages();
    setStatus('새 이미지를 등록할 수 있습니다.', 'info');
  }

  function selectImage(id) {
    const item = images.find((entry) => entry.id === id);
    if (!item) return;
    selectedId = item.id;
    selectedFile = null;
    q('adminImageName').value = text(item.name);
    q('adminImageCategory').value = text(item.category);
    q('adminImagePublic').value = item.isPublic === false ? 'false' : 'true';
    q('adminImageFile').value = '';
    setPreview(item.imageUrl, '등록된 이미지가 없습니다.');
    renderImages();
    setStatus('선택한 이미지의 이름·분류·공개 여부를 수정하거나 이미지를 교체할 수 있습니다.', 'info');
  }

  function renderImages() {
    const list = q('adminImageList');
    if (!list) return;
    const query = text(q('adminImageSearch')?.value).trim().toLowerCase();
    const filter = q('adminImageFilter')?.value || 'all';
    const filtered = images.filter((item) => {
      if (filter === 'public' && item.isPublic === false) return false;
      if (filter === 'private' && item.isPublic !== false) return false;
      if (!query) return true;
      return `${text(item.name)} ${text(item.category)}`.toLowerCase().includes(query);
    });
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-image-empty';
      empty.textContent = images.length ? '조건에 맞는 제공 이미지가 없습니다.' : '아직 등록된 제공 이미지가 없습니다.';
      list.appendChild(empty);
    } else {
      for (const item of filtered) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `admin-image-item${item.id === selectedId ? ' selected' : ''}`;
        card.dataset.imageId = item.id;
        const thumb = document.createElement('div');
        thumb.className = 'admin-image-thumb';
        if (item.imageUrl) {
          const img = document.createElement('img');
          img.alt = '';
          img.loading = 'lazy';
          img.src = item.imageUrl;
          img.addEventListener('error', () => { thumb.textContent = '이미지 오류'; }, { once: true });
          thumb.appendChild(img);
        } else {
          thumb.textContent = '이미지 없음';
        }
        const meta = document.createElement('div');
        meta.className = 'admin-image-meta';
        const name = document.createElement('div');
        name.className = 'admin-image-name';
        name.textContent = item.name || '이름 없음';
        const sub = document.createElement('div');
        sub.className = 'admin-image-sub';
        sub.textContent = item.category || '분류 없음';
        const state = document.createElement('span');
        state.className = `admin-image-state ${item.isPublic === false ? 'private' : 'public'}`;
        state.textContent = item.isPublic === false ? '관리자 전용' : '회원 공개';
        meta.append(name, sub, state);
        card.append(thumb, meta);
        card.addEventListener('click', () => selectImage(item.id));
        list.appendChild(card);
      }
    }
    const publicCount = images.filter((item) => item.isPublic !== false).length;
    q('adminImageAllCount').textContent = `전체 ${images.length}`;
    q('adminImagePublicCount').textContent = `회원 공개 ${publicCount}`;
    q('adminImagePrivateCount').textContent = `관리자 전용 ${images.length - publicCount}`;
  }

  async function loadImages() {
    if (!window.db) throw new Error('Firestore 연결을 확인할 수 없습니다.');
    const snap = await db.collection('cover_templates').get();
    images = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.kind === KIND)
      .sort((a, b) => text(a.name).localeCompare(text(b.name), 'ko'));
    if (selectedId && !images.some((item) => item.id === selectedId)) selectedId = '';
    renderImages();
    return images;
  }

  async function uploadFile(file, id) {
    const validation = validateImageFile(file);
    if (!validation.ok) throw new Error(validation.message);
    if (!file) return null;
    await loadStorageSdk();
    const path = `cover_templates/${id}/library.${extensionFor(file)}`;
    const ref = firebase.storage().ref(path);
    await ref.put(file, { contentType: file.type });
    return { path, url: await ref.getDownloadURL() };
  }

  async function deleteStoragePath(path) {
    if (!path) return;
    await loadStorageSdk();
    try {
      await firebase.storage().ref(path).delete();
    } catch (error) {
      if (!isObjectNotFound(error)) throw error;
    }
  }

  async function saveImage() {
    if (busy) return;
    const name = text(q('adminImageName')?.value).trim();
    const category = text(q('adminImageCategory')?.value).trim();
    const isPublic = q('adminImagePublic')?.value !== 'false';
    if (!name) return setStatus('이미지 이름을 입력하세요.', 'err');
    if (name.length > 80) return setStatus('이미지 이름은 80자 이하로 입력하세요.', 'err');
    const validation = validateImageFile(selectedFile);
    if (!validation.ok) return setStatus(validation.message, 'err');
    const existing = selectedImage();
    if (!existing && !selectedFile) return setStatus('등록할 이미지를 선택하세요.', 'err');
    setBusy(true);
    setStatus(existing ? '제공 이미지를 수정하고 있습니다...' : '제공 이미지를 등록하고 있습니다...', 'info');
    const id = existing?.id || db.collection('cover_templates').doc().id;
    let uploaded = null;
    try {
      if (selectedFile) uploaded = await uploadFile(selectedFile, id);
      const data = {
        kind: KIND,
        name,
        category,
        isPublic,
        imageUrl: uploaded?.url || existing?.imageUrl || '',
        imagePath: uploaded?.path || existing?.imagePath || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (!existing) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.createdBy = currentUser.uid;
        data.createdByEmail = currentUser.email || '';
      }
      await db.collection('cover_templates').doc(id).set(data, { merge: true });
      if (uploaded && existing?.imagePath && existing.imagePath !== uploaded.path) {
        deleteStoragePath(existing.imagePath).catch((error) => console.warn('Old provided image cleanup failed', error));
      }
      selectedId = id;
      selectedFile = null;
      q('adminImageFile').value = '';
      await loadImages();
      selectImage(id);
      setStatus(existing ? '제공 이미지를 수정했습니다.' : '새 제공 이미지를 등록했습니다.', 'ok');
      document.dispatchEvent(new CustomEvent('cover-library-images-changed', { detail: { id, action: existing ? 'update' : 'create' } }));
    } catch (error) {
      if (uploaded?.path) await deleteStoragePath(uploaded.path).catch(() => {});
      setStatus(error?.message || '제공 이미지를 저장하지 못했습니다.', 'err');
    } finally {
      setBusy(false);
    }
  }

  async function deleteImage() {
    if (busy) return;
    const item = selectedImage();
    if (!item) return setStatus('삭제할 제공 이미지를 먼저 선택하세요.', 'err');
    if (!confirm(`“${item.name || '선택한 이미지'}”을 삭제할까요?\n사용자 제공 이미지 목록에서도 사라집니다.`)) return;
    setBusy(true);
    setStatus('제공 이미지를 삭제하고 있습니다...', 'info');
    try {
      await deleteStoragePath(item.imagePath);
      await db.collection('cover_templates').doc(item.id).delete();
      const deletedId = item.id;
      resetForm();
      await loadImages();
      setStatus('제공 이미지를 삭제했습니다.', 'ok');
      document.dispatchEvent(new CustomEvent('cover-library-images-changed', { detail: { id: deletedId, action: 'delete' } }));
    } catch (error) {
      setStatus(`삭제하지 못했습니다. ${error?.message || ''}`.trim(), 'err');
    } finally {
      setBusy(false);
    }
  }

  function bindEvents() {
    q('adminManageCoverService')?.addEventListener('click', () => q('adminCoverServiceWorkspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    q('adminImageSave')?.addEventListener('click', saveImage);
    q('adminImageNew')?.addEventListener('click', resetForm);
    q('adminImageDelete')?.addEventListener('click', deleteImage);
    q('adminImageRefresh')?.addEventListener('click', () => loadImages().catch((error) => setStatus(error.message, 'err')));
    q('adminImageSearch')?.addEventListener('input', renderImages);
    q('adminImageFilter')?.addEventListener('change', renderImages);
    q('adminImageFile')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0] || null;
      const validation = validateImageFile(file);
      if (!validation.ok) {
        event.target.value = '';
        selectedFile = null;
        return setStatus(validation.message, 'err');
      }
      selectedFile = file;
      if (!file) return;
      const url = URL.createObjectURL(file);
      setPreview(url);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setStatus('이미지를 선택했습니다. 저장 버튼을 눌러 반영하세요.', 'info');
    });
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
    hideLegacyTemplateManager();
    if (!makeNav() || !makePanel()) return false;
    bindEvents();
    installed = true;
    document.documentElement.dataset.adminServiceManagement = '1';
    loadImages().catch((error) => setStatus(error?.message || '제공 이미지 목록을 불러오지 못했습니다.', 'err'));
    return true;
  }

  window.AdminServiceManagement = {
    validateImageFile,
    loadImages,
    saveImage,
    deleteImage,
    resetForm,
    openPanel,
    install,
    kind: KIND,
    stage: 'service-console-cover-library',
  };

  auth?.onAuthStateChanged?.(() => { for (const delay of INSTALL_DELAYS) setTimeout(install, delay); });
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();