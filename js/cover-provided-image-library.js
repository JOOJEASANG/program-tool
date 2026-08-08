// User-facing administrator-provided image library for the cover maker.
(function () {
  'use strict';
  if (window.__coverProvidedImageLibraryV1) return;
  window.__coverProvidedImageLibraryV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const KIND = 'library-image';
  const STYLE_ID = 'coverProvidedImageLibraryStyles';
  const PANEL_ID = 'coverProvidedImageLibraryPanel';
  const INSTALL_DELAYS = [1100, 1700, 2400, 3100];
  let installed = false;
  let images = [];

  const q = (id) => document.getElementById(id);
  const text = (value) => String(value == null ? '' : value);

  function installStyles() {
    if (q(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .cover-provided-library{margin-top:10px;padding-top:10px;border-top:1px solid #e2e8f0}
      .cover-provided-head{display:flex;align-items:center;gap:7px;margin-bottom:8px}.cover-provided-head strong{font-size:11px}.cover-provided-head button{margin-left:auto}
      .cover-provided-filter{display:grid;grid-template-columns:1fr 120px;gap:6px;margin-bottom:8px}.cover-provided-filter input,.cover-provided-filter select{width:100%;border:1px solid #d5dee8;border-radius:8px;padding:7px 8px;background:#fff;font-size:10px}
      .cover-provided-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;max-height:370px;overflow:auto;padding-right:2px}.cover-provided-item{border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;padding:7px;min-width:0}.cover-provided-thumb{aspect-ratio:4/3;border:1px solid #e4eaf1;border-radius:7px;background:#fff;overflow:hidden;display:grid;place-items:center;color:#94a3b8;font-size:9px}.cover-provided-thumb img{width:100%;height:100%;object-fit:cover}.cover-provided-name{font-size:9px;font-weight:950;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cover-provided-category{font-size:8px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cover-provided-actions{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}.cover-provided-actions button{border:1px solid #cfdbe7;border-radius:7px;background:#fff;color:#334155;padding:6px 4px;font-size:8px;font-weight:900;cursor:pointer}.cover-provided-actions button:first-child{background:#12396d;color:#fff;border-color:#12396d}.cover-provided-empty{grid-column:1/-1;padding:22px 10px;text-align:center;color:#94a3b8;font-size:9px;border:1px dashed #cbd5e1;border-radius:9px}.cover-provided-status{font-size:9px;color:#64748b;line-height:1.45;margin-top:6px}
      @media(max-width:720px){.cover-provided-list{grid-template-columns:1fr}.cover-provided-filter{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function hideLegacyProvidedTemplateUi() {
    const select = q('coverTemplateSelect');
    if (select) select.closest('.field')?.style.setProperty('display', 'none', 'important');
    const apply = q('applyCoverTemplate');
    const refresh = q('refreshCoverTemplates');
    if (apply?.parentElement) apply.parentElement.style.display = 'none';
    if (refresh?.parentElement) refresh.parentElement.style.display = 'none';
    if (q('coverTemplateInfo')) q('coverTemplateInfo').style.display = 'none';
    const adminArea = q('adminTemplateArea');
    if (adminArea) {
      adminArea.hidden = true;
      adminArea.style.display = 'none';
      adminArea.setAttribute('aria-hidden', 'true');
      adminArea.querySelectorAll('input,select,button').forEach((control) => { control.disabled = true; });
    }
  }

  function makePanel() {
    if (q(PANEL_ID)) return q(PANEL_ID);
    const card = q('templateCard');
    if (!card) return null;
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'cover-provided-library';
    panel.innerHTML = `
      <div class="cover-provided-head"><strong>관리자 제공 이미지</strong><button type="button" class="mini-btn" id="coverProvidedRefresh">새로고침</button></div>
      <div class="card-note" style="margin-bottom:7px">관리자가 등록한 이미지를 골라 앞표지 또는 뒤표지에 적용할 수 있습니다.</div>
      <div class="cover-provided-filter"><input id="coverProvidedSearch" placeholder="이미지 이름·분류 검색"><select id="coverProvidedCategory"><option value="all">전체 분류</option></select></div>
      <div class="cover-provided-list" id="coverProvidedList"></div>
      <div class="cover-provided-status" id="coverProvidedStatus"></div>`;
    const adminArea = q('adminTemplateArea');
    (adminArea?.parentElement || card).appendChild(panel);
    return panel;
  }

  function status(message) {
    const el = q('coverProvidedStatus');
    if (el) el.textContent = message;
  }

  function categories() {
    return [...new Set(images.map((item) => text(item.category).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  }

  function renderCategories() {
    const select = q('coverProvidedCategory');
    if (!select) return;
    const current = select.value || 'all';
    select.replaceChildren(new Option('전체 분류', 'all'));
    for (const category of categories()) select.appendChild(new Option(category, category));
    select.value = [...select.options].some((option) => option.value === current) ? current : 'all';
  }

  function filteredImages() {
    const search = text(q('coverProvidedSearch')?.value).trim().toLowerCase();
    const category = q('coverProvidedCategory')?.value || 'all';
    return images.filter((item) => {
      if (category !== 'all' && text(item.category) !== category) return false;
      if (!search) return true;
      return `${text(item.name)} ${text(item.category)}`.toLowerCase().includes(search);
    });
  }

  function makeImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('제공 이미지를 불러오지 못했습니다.'));
      image.src = url;
    });
  }

  async function applyImage(item, side) {
    if (!item?.imageUrl) return status('선택한 이미지의 원본 주소가 없습니다.');
    try {
      status(`${side === 'front' ? '앞표지' : '뒤표지'}에 이미지를 적용하는 중입니다...`);
      const image = await makeImage(item.imageUrl);
      if (typeof state === 'undefined') throw new Error('표지 편집 상태를 찾을 수 없습니다.');
      const layoutKey = side === 'front' ? 'frontImage' : 'backImage';
      if (side === 'front') state.frontImage = image;
      else state.backImage = image;
      if (typeof DEFAULT_LAYOUT !== 'undefined' && DEFAULT_LAYOUT?.[layoutKey]) {
        state.layout[layoutKey] = { ...DEFAULT_LAYOUT[layoutKey] };
      }
      state.active = layoutKey;
      q(`${side}UploadBox`)?.classList.add('has-file');
      const name = q(`${side}Name`);
      if (name) name.textContent = `제공 이미지 · ${item.name || '관리자 이미지'}`;
      try { window.syncControls?.(); } catch (_) {}
      try { window.requestRender?.(); } catch (_) {}
      document.dispatchEvent(new CustomEvent('cover-template-applied', { detail: { source: 'provided-image-library', imageId: item.id, side } }));
      try { window.CoverRecoveryCheckpoints?.queueSave?.({ force: true }); } catch (_) {}
      status(`“${item.name || '제공 이미지'}”를 ${side === 'front' ? '앞표지' : '뒤표지'}에 적용했습니다.`);
    } catch (error) {
      status(error?.message || '제공 이미지를 적용하지 못했습니다.');
    }
  }

  function render() {
    const list = q('coverProvidedList');
    if (!list) return;
    const filtered = filteredImages();
    list.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'cover-provided-empty';
      empty.textContent = images.length ? '검색 조건에 맞는 제공 이미지가 없습니다.' : '현재 관리자가 공개한 제공 이미지가 없습니다.';
      list.appendChild(empty);
    } else {
      for (const item of filtered) {
        const card = document.createElement('div');
        card.className = 'cover-provided-item';
        const thumb = document.createElement('div');
        thumb.className = 'cover-provided-thumb';
        if (item.imageUrl) {
          const img = document.createElement('img');
          img.alt = item.name || '관리자 제공 이미지';
          img.loading = 'lazy';
          img.src = item.imageUrl;
          img.addEventListener('error', () => { thumb.textContent = '미리보기 오류'; }, { once: true });
          thumb.appendChild(img);
        } else {
          thumb.textContent = '이미지 없음';
        }
        const name = document.createElement('div');
        name.className = 'cover-provided-name';
        name.textContent = item.name || '제공 이미지';
        const category = document.createElement('div');
        category.className = 'cover-provided-category';
        category.textContent = item.category || '기타';
        const actions = document.createElement('div');
        actions.className = 'cover-provided-actions';
        const front = document.createElement('button');
        front.type = 'button';
        front.textContent = '앞표지에 적용';
        front.addEventListener('click', () => applyImage(item, 'front'));
        const back = document.createElement('button');
        back.type = 'button';
        back.textContent = '뒤표지에 적용';
        back.addEventListener('click', () => applyImage(item, 'back'));
        actions.append(front, back);
        card.append(thumb, name, category, actions);
        list.appendChild(card);
      }
    }
    status(`관리자가 공개한 제공 이미지 ${images.length}개`);
  }

  async function loadImages() {
    if (!window.db) throw new Error('제공 이미지 서버에 연결할 수 없습니다.');
    const snap = await db.collection('cover_templates').where('isPublic', '==', true).get();
    images = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.kind === KIND && item.imageUrl)
      .sort((a, b) => text(a.name).localeCompare(text(b.name), 'ko'));
    renderCategories();
    render();
    return images;
  }

  function bindEvents() {
    q('coverProvidedRefresh')?.addEventListener('click', () => loadImages().catch((error) => status(error.message)));
    q('coverProvidedSearch')?.addEventListener('input', render);
    q('coverProvidedCategory')?.addEventListener('change', render);
  }

  function install() {
    if (installed) return true;
    if (!q('templateCard') || !window.db) return false;
    installStyles();
    hideLegacyProvidedTemplateUi();
    if (!makePanel()) return false;
    bindEvents();
    installed = true;
    document.documentElement.dataset.coverProvidedImageLibrary = '1';
    loadImages().catch((error) => status(error?.message || '제공 이미지 목록을 불러오지 못했습니다.'));
    return true;
  }

  window.CoverProvidedImageLibrary = {
    install,
    loadImages,
    applyImage,
    get images() { return [...images]; },
    kind: KIND,
    stage: 'user-selectable-admin-image-library',
  };

  document.addEventListener('cover-library-images-changed', () => loadImages().catch(() => {}));
  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();