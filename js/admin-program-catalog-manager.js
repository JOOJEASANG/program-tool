// Administrator manager for home categories, program cards, visibility, and ordering.
(function () {
  'use strict';
  if (window.__adminProgramCatalogManagerV1) return;
  window.__adminProgramCatalogManagerV1 = true;
  const path = location.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/admin' && path !== '/admin.html' && !path.endsWith('/admin.html')) return;

  const DOC_ID = 'public_program_catalog';
  const NAV_ID = 'adminProgramCatalogNav';
  const PANEL_ID = 'adminProgramCatalogPanel';
  const STYLE_ID = 'adminProgramCatalogStyles';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const text = (value) => String(value == null ? '' : value);
  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  let installed = false;
  let currentUser = null;
  let catalog = null;
  let selectedCategoryId = '';
  let selectedProgramId = '';
  let dirty = false;
  let busy = false;

  function core() { return window.ProgramCatalogCore; }
  function categoryById(id) { return catalog?.categories.find((item) => item.id === id) || null; }
  function selectedCategory() { return categoryById(selectedCategoryId) || catalog?.categories[0] || null; }
  function selectedProgram() { return selectedCategory()?.programs.find((item) => item.id === selectedProgramId) || null; }
  function markDirty() { dirty = true; renderSaveState(); }

  function installStyles() {
    if ($(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pcat-actions{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:14px}.pcat-layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:14px}.pcat-side,.pcat-main{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;box-shadow:0 8px 26px #0f172a0b}.pcat-title{font-size:14px;font-weight:950}.pcat-sub{font-size:10px;color:var(--muted);line-height:1.5;margin:4px 0 12px}.pcat-list{display:flex;flex-direction:column;gap:7px}.pcat-cat{border:1px solid #e1e8ef;border-radius:11px;background:#f8fafc;padding:9px;cursor:pointer}.pcat-cat.on{border-color:#6fa7e8;background:#f3f8ff;box-shadow:0 0 0 2px #1769e012}.pcat-cat.dragover{border-color:#18a7bd;background:#ecfeff}.pcat-row{display:flex;align-items:center;gap:7px}.pcat-handle{cursor:grab;color:#98a2b3;font-size:15px;user-select:none}.pcat-name{font-size:11px;font-weight:950;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pcat-mini{border:1px solid #d7e0e9;background:#fff;border-radius:7px;padding:4px 7px;font-size:9px;font-weight:900;cursor:pointer}.pcat-badge{font-size:8px;font-weight:900;border-radius:999px;padding:3px 6px;background:#dcfce7;color:#166534}.pcat-badge.off{background:#e5e7eb;color:#64748b}.pcat-count{font-size:8px;color:#667085;margin-top:4px}.pcat-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.pcat-field.wide{grid-column:1/-1}.pcat-field label{display:block;font-size:9px;font-weight:900;color:#475467;margin-bottom:5px}.pcat-field input,.pcat-field select,.pcat-field textarea{width:100%;border:1px solid #cfd8e3;border-radius:9px;padding:8px 9px;background:#fff;font-size:10px}.pcat-field textarea{min-height:72px;resize:vertical;line-height:1.45}.pcat-section{border-top:1px solid #edf1f5;margin-top:16px;padding-top:15px}.pcat-section-head{display:flex;align-items:center;gap:8px;margin-bottom:9px}.pcat-section-head strong{font-size:12px}.pcat-section-head button{margin-left:auto}.pcat-programs{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.pcat-program{display:flex;align-items:center;gap:7px;border:1px solid #e3e9ef;border-radius:10px;padding:8px;background:#fbfcfe;cursor:pointer}.pcat-program.on{border-color:#7aa8e2;background:#f4f8ff}.pcat-program.dragover{border-color:#18a7bd;background:#ecfeff}.pcat-program-name{flex:1;font-size:10px;font-weight:900;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pcat-program-meta{font-size:8px;color:#667085;white-space:nowrap}.pcat-status{min-height:18px;margin-top:9px;font-size:10px;font-weight:850;line-height:1.45}.pcat-status.ok{color:#166534}.pcat-status.err{color:#dc2626}.pcat-status.info{color:#1769e0}.pcat-unsaved{font-size:9px;font-weight:900;border-radius:999px;padding:5px 8px;background:#fff7ed;color:#9a3412}.pcat-empty{padding:20px 10px;text-align:center;border:1px dashed #cbd5e1;border-radius:10px;color:#98a2b3;font-size:10px}.pcat-drop-hint{font-size:9px;color:#667085;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:9px;padding:8px;margin-bottom:9px;line-height:1.45}
      @media(max-width:1050px){.pcat-layout{grid-template-columns:250px minmax(0,1fr)}}@media(max-width:760px){.side{grid-template-columns:auto repeat(6,minmax(0,1fr))!important}.pcat-layout{grid-template-columns:1fr}.pcat-form{grid-template-columns:1fr}.pcat-field.wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function note(message, type = 'info') {
    const el = $('pcatStatus');
    if (!el) return;
    el.className = `pcat-status ${type}`;
    el.textContent = message;
  }
  function setBusy(value) {
    busy = Boolean(value);
    ['pcatSave','pcatReload','pcatDefaults','pcatAddCategory','pcatAddProgram','pcatDeleteCategory','pcatDeleteProgram'].forEach((id) => { if ($(id)) $(id).disabled = busy; });
  }
  function renderSaveState() {
    const el = $('pcatDirty');
    if (!el) return;
    el.textContent = dirty ? '저장되지 않은 변경 있음' : '저장됨';
    el.style.background = dirty ? '#fff7ed' : '#dcfce7';
    el.style.color = dirty ? '#9a3412' : '#166534';
  }

  function makeNav() {
    if ($(NAV_ID)) return $(NAV_ID);
    const side = document.querySelector('.side');
    if (!side) return null;
    const foot = side.querySelector('.sidefoot');
    const label = document.createElement('div');
    label.className = 'navlabel'; label.id = 'adminProgramCatalogLabel'; label.textContent = '홈 구성';
    const button = document.createElement('button');
    button.id = NAV_ID; button.className = 'navbtn'; button.type = 'button'; button.dataset.tab = 'program-catalog';
    button.innerHTML = '<span>🧭</span>카테고리·프로그램';
    side.insertBefore(label, foot || null);
    side.insertBefore(button, foot || null);
    button.addEventListener('click', openPanel);
    return button;
  }

  function makePanel() {
    if ($(PANEL_ID)) return $(PANEL_ID);
    const content = document.querySelector('.main .content');
    if (!content) return null;
    const panel = document.createElement('section');
    panel.id = PANEL_ID; panel.className = 'panel';
    panel.innerHTML = `
      <div class="hero"><h2>홈 카테고리·프로그램 관리</h2><p>홈 상단 카테고리와 프로그램 카드의 이름, 순서, 위치, 공개 상태를 관리자에서 직접 관리합니다.</p></div>
      <div class="pcat-actions"><button class="btn primary" id="pcatSave" type="button">저장하고 홈에 반영</button><button class="btn soft" id="pcatReload" type="button">서버 내용 다시 불러오기</button><button class="btn soft" id="pcatDefaults" type="button">기본 구성 불러오기</button><button class="btn soft" id="pcatOpenHome" type="button">홈 새 창으로 확인 ↗</button><span class="pcat-unsaved" id="pcatDirty">저장됨</span></div>
      <div class="pcat-layout">
        <div class="pcat-side"><div class="pcat-title">상단 카테고리</div><div class="pcat-sub">드래그하거나 ↑ ↓ 버튼으로 순서를 바꿉니다. 프로그램을 카테고리 위에 놓으면 해당 카테고리로 이동합니다.</div><div id="pcatCategoryList" class="pcat-list"></div><div style="margin-top:10px"><button class="btn soft" id="pcatAddCategory" type="button">＋ 카테고리 추가</button></div></div>
        <div class="pcat-main"><div id="pcatEditor"></div><div id="pcatStatus" class="pcat-status"></div></div>
      </div>`;
    content.appendChild(panel);
    return panel;
  }

  function openPanel() {
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('on'));
    document.querySelectorAll('.navbtn[data-tab]').forEach((button) => button.classList.remove('on'));
    $(PANEL_ID)?.classList.add('on');
    $(NAV_ID)?.classList.add('on');
    if ($('pageTitle')) $('pageTitle').textContent = '홈 카테고리·프로그램';
    if ($('pageSub')) $('pageSub').textContent = '카테고리와 프로그램의 이름·순서·위치를 관리합니다.';
    renderAll();
  }

  function moveArrayItem(array, from, to) {
    if (from < 0 || from >= array.length || to < 0 || to >= array.length || from === to) return false;
    const [item] = array.splice(from, 1);
    array.splice(to, 0, item);
    return true;
  }

  function renderCategoryList() {
    const list = $('pcatCategoryList');
    if (!list || !catalog) return;
    list.replaceChildren();
    catalog.categories.forEach((category, index) => {
      const item = document.createElement('div');
      item.className = `pcat-cat${category.id === selectedCategoryId ? ' on' : ''}`;
      item.draggable = true;
      item.dataset.categoryId = category.id;
      item.innerHTML = `<div class="pcat-row"><span class="pcat-handle" title="드래그해서 이동">⋮⋮</span><span class="pcat-name">${esc(category.name)}</span><span class="pcat-badge${category.visible ? '' : ' off'}">${category.visible ? '공개' : '숨김'}</span><button class="pcat-mini" data-cat-up="${esc(category.id)}" type="button" ${index === 0 ? 'disabled' : ''}>↑</button><button class="pcat-mini" data-cat-down="${esc(category.id)}" type="button" ${index === catalog.categories.length - 1 ? 'disabled' : ''}>↓</button></div><div class="pcat-count">프로그램 ${category.programs.length}개 · 프로그램을 이 영역에 놓으면 이동</div>`;
      item.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        selectedCategoryId = category.id;
        selectedProgramId = category.programs[0]?.id || '';
        renderAll();
      });
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-pcat-category', category.id);
      });
      item.addEventListener('dragover', (event) => { event.preventDefault(); item.classList.add('dragover'); });
      item.addEventListener('dragleave', () => item.classList.remove('dragover'));
      item.addEventListener('drop', (event) => {
        event.preventDefault(); item.classList.remove('dragover');
        const programPayload = event.dataTransfer.getData('application/x-pcat-program');
        if (programPayload) {
          try {
            const payload = JSON.parse(programPayload);
            moveProgramToCategory(payload.programId, payload.categoryId, category.id);
          } catch (_) {}
          return;
        }
        const fromId = event.dataTransfer.getData('application/x-pcat-category');
        if (!fromId || fromId === category.id) return;
        const from = catalog.categories.findIndex((entry) => entry.id === fromId);
        const to = catalog.categories.findIndex((entry) => entry.id === category.id);
        if (moveArrayItem(catalog.categories, from, to)) { markDirty(); renderAll(); }
      });
      list.appendChild(item);
    });
    if (!catalog.categories.length) {
      const empty = document.createElement('div'); empty.className = 'pcat-empty'; empty.textContent = '카테고리가 없습니다.'; list.appendChild(empty);
    }
  }

  function categoryOptions(selectedId) {
    return catalog.categories.map((category) => `<option value="${esc(category.id)}"${category.id === selectedId ? ' selected' : ''}>${esc(category.name)}</option>`).join('');
  }

  function renderEditor() {
    const editor = $('pcatEditor');
    const category = selectedCategory();
    if (!editor) return;
    if (!category) { editor.innerHTML = '<div class="pcat-empty">왼쪽에서 카테고리를 추가하세요.</div>'; return; }
    if (!selectedCategoryId) selectedCategoryId = category.id;
    if (selectedProgramId && !category.programs.some((program) => program.id === selectedProgramId)) selectedProgramId = '';
    const program = selectedProgram();
    editor.innerHTML = `
      <div class="pcat-title">카테고리 설정</div><div class="pcat-sub">카테고리명은 홈 화면 상단 메뉴에 그대로 표시됩니다.</div>
      <div class="pcat-form">
        <div class="pcat-field"><label>카테고리명</label><input data-cat-field="name" maxlength="60" value="${esc(category.name)}"></div>
        <div class="pcat-field"><label>공개 상태</label><select data-cat-field="visible"><option value="true"${category.visible ? ' selected' : ''}>홈에 공개</option><option value="false"${!category.visible ? ' selected' : ''}>숨김</option></select></div>
        <div class="pcat-field"><label>카테고리 색상</label><input data-cat-field="accent" type="color" value="${esc(category.accent)}"></div>
        <div class="pcat-field"><label>프로그램 영역 제목</label><input data-cat-field="sectionTitle" maxlength="100" value="${esc(category.sectionTitle)}"></div>
        <div class="pcat-field wide"><label>상단 배지 문구</label><input data-cat-field="badge" maxlength="140" value="${esc(category.badge)}"></div>
        <div class="pcat-field"><label>메인 제목</label><input data-cat-field="heroTitle" maxlength="70" value="${esc(category.heroTitle)}"></div>
        <div class="pcat-field"><label>강조 제목</label><input data-cat-field="heroAccent" maxlength="70" value="${esc(category.heroAccent)}"></div>
        <div class="pcat-field wide"><label>한 줄 소개</label><input data-cat-field="lead" maxlength="180" value="${esc(category.lead)}"></div>
        <div class="pcat-field wide"><label>상세 소개</label><textarea data-cat-field="copy" maxlength="700">${esc(category.copy)}</textarea></div>
        <div class="pcat-field"><label>대표 아이콘</label><input data-cat-field="visualIcon" maxlength="12" value="${esc(category.visualIcon)}"></div>
        <div class="pcat-field"><label>대표 카드 제목</label><input data-cat-field="visualTitle" maxlength="100" value="${esc(category.visualTitle)}"></div>
        <div class="pcat-field wide"><label>대표 카드 설명</label><input data-cat-field="visualText" maxlength="240" value="${esc(category.visualText)}"></div>
      </div>
      <div style="margin-top:9px"><button class="btn badbtn" id="pcatDeleteCategory" type="button">카테고리 삭제</button></div>
      <div class="pcat-section"><div class="pcat-section-head"><strong>프로그램 순서와 이동</strong><button class="btn soft" id="pcatAddProgram" type="button">＋ 프로그램 추가</button></div><div class="pcat-drop-hint">프로그램 행을 드래그해 순서를 바꾸거나, 왼쪽의 다른 카테고리 위에 놓아 이동할 수 있습니다.</div><div id="pcatPrograms" class="pcat-programs"></div></div>
      <div id="pcatProgramEditor" class="pcat-section"></div>`;
    renderPrograms();
    renderProgramEditor(program);
    bindEditorFields();
  }

  function renderPrograms() {
    const list = $('pcatPrograms');
    const category = selectedCategory();
    if (!list || !category) return;
    list.replaceChildren();
    category.programs.forEach((program, index) => {
      const row = document.createElement('div');
      row.className = `pcat-program${program.id === selectedProgramId ? ' on' : ''}`;
      row.draggable = true;
      row.dataset.programId = program.id;
      row.innerHTML = `<span class="pcat-handle">⋮⋮</span><span>${esc(program.icon || '🧰')}</span><span class="pcat-program-name">${esc(program.name)}</span><span class="pcat-program-meta">${program.visible ? (program.status === 'active' ? '공개 · 사용 가능' : '공개 · 준비 중') : '숨김'}</span><button class="pcat-mini" data-prog-up="${esc(program.id)}" type="button" ${index === 0 ? 'disabled' : ''}>↑</button><button class="pcat-mini" data-prog-down="${esc(program.id)}" type="button" ${index === category.programs.length - 1 ? 'disabled' : ''}>↓</button>`;
      row.addEventListener('click', (event) => { if (event.target.closest('button')) return; selectedProgramId = program.id; renderEditor(); });
      row.addEventListener('dragstart', (event) => {
        event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('application/x-pcat-program', JSON.stringify({ categoryId: category.id, programId: program.id }));
      });
      row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('dragover'); });
      row.addEventListener('dragleave', () => row.classList.remove('dragover'));
      row.addEventListener('drop', (event) => {
        event.preventDefault(); event.stopPropagation(); row.classList.remove('dragover');
        const payloadText = event.dataTransfer.getData('application/x-pcat-program');
        if (!payloadText) return;
        try {
          const payload = JSON.parse(payloadText);
          if (payload.categoryId !== category.id) { moveProgramToCategory(payload.programId, payload.categoryId, category.id, index); return; }
          const from = category.programs.findIndex((entry) => entry.id === payload.programId);
          if (moveArrayItem(category.programs, from, index)) { markDirty(); renderAll(); }
        } catch (_) {}
      });
      list.appendChild(row);
    });
    if (!category.programs.length) { const empty = document.createElement('div'); empty.className = 'pcat-empty'; empty.textContent = '이 카테고리에 프로그램이 없습니다.'; list.appendChild(empty); }
  }

  function renderProgramEditor(program) {
    const box = $('pcatProgramEditor');
    if (!box) return;
    if (!program) { box.innerHTML = '<div class="pcat-sub">프로그램을 선택하거나 새 프로그램을 추가하세요.</div>'; return; }
    box.innerHTML = `<div class="pcat-section-head"><strong>선택 프로그램 설정</strong></div><div class="pcat-form">
      <div class="pcat-field"><label>프로그램명</label><input data-prog-field="name" maxlength="80" value="${esc(program.name)}"></div>
      <div class="pcat-field"><label>아이콘</label><input data-prog-field="icon" maxlength="12" value="${esc(program.icon)}"></div>
      <div class="pcat-field"><label>소속 카테고리</label><select id="pcatProgramCategory">${categoryOptions(selectedCategoryId)}</select></div>
      <div class="pcat-field"><label>상태</label><select data-prog-field="status"><option value="active"${program.status === 'active' ? ' selected' : ''}>사용 가능</option><option value="coming"${program.status !== 'active' ? ' selected' : ''}>준비 중</option></select></div>
      <div class="pcat-field"><label>공개 상태</label><select data-prog-field="visible"><option value="true"${program.visible ? ' selected' : ''}>홈에 공개</option><option value="false"${!program.visible ? ' selected' : ''}>숨김</option></select></div>
      <div class="pcat-field"><label>프로그램 주소</label><input data-prog-field="url" maxlength="300" value="${esc(program.url)}" placeholder="예: pdf-editor/"></div>
      <div class="pcat-field"><label>강조 색상</label><input data-prog-field="accent" type="color" value="${esc(program.accent)}"></div>
      <div class="pcat-field"><label>아이콘 배경색</label><input data-prog-field="bg" type="color" value="${esc(program.bg)}"></div>
      <div class="pcat-field wide"><label>설명</label><textarea data-prog-field="desc" maxlength="500">${esc(program.desc)}</textarea></div>
      <div class="pcat-field wide"><label>태그 · 쉼표로 구분</label><input id="pcatProgramTags" maxlength="240" value="${esc(program.tags.join(', '))}"></div>
    </div><div style="margin-top:9px"><button class="btn badbtn" id="pcatDeleteProgram" type="button">프로그램 삭제</button></div>`;
  }

  function bindEditorFields() {
    const editor = $('pcatEditor');
    if (!editor) return;
    editor.querySelectorAll('[data-cat-field]').forEach((control) => {
      control.addEventListener('input', () => {
        const category = selectedCategory(); if (!category) return;
        const field = control.dataset.catField;
        category[field] = field === 'visible' ? control.value === 'true' : control.value;
        markDirty();
      });
      control.addEventListener('change', () => { markDirty(); renderCategoryList(); });
    });
    editor.querySelectorAll('[data-prog-field]').forEach((control) => {
      control.addEventListener('input', () => {
        const program = selectedProgram(); if (!program) return;
        const field = control.dataset.progField;
        program[field] = field === 'visible' ? control.value === 'true' : control.value;
        markDirty();
      });
      control.addEventListener('change', () => { markDirty(); renderPrograms(); });
    });
    $('pcatProgramTags')?.addEventListener('input', (event) => { const program = selectedProgram(); if (!program) return; program.tags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 8); markDirty(); });
    $('pcatProgramCategory')?.addEventListener('change', (event) => { const program = selectedProgram(); if (program) moveProgramToCategory(program.id, selectedCategoryId, event.target.value); });
    $('pcatDeleteCategory')?.addEventListener('click', deleteCategory);
    $('pcatDeleteProgram')?.addEventListener('click', deleteProgram);
    $('pcatAddProgram')?.addEventListener('click', addProgram);
  }

  function moveProgramToCategory(programId, fromCategoryId, toCategoryId, targetIndex = null) {
    if (!programId || !fromCategoryId || !toCategoryId) return;
    const from = categoryById(fromCategoryId), to = categoryById(toCategoryId);
    if (!from || !to) return;
    const index = from.programs.findIndex((program) => program.id === programId);
    if (index < 0) return;
    const [program] = from.programs.splice(index, 1);
    const insertAt = Number.isInteger(targetIndex) ? Math.max(0, Math.min(targetIndex, to.programs.length)) : to.programs.length;
    to.programs.splice(insertAt, 0, program);
    selectedCategoryId = to.id; selectedProgramId = program.id; markDirty(); renderAll();
  }

  function addCategory() {
    if (!catalog || catalog.categories.length >= core().MAX_CATEGORIES) return note(`카테고리는 최대 ${core().MAX_CATEGORIES}개까지 관리할 수 있습니다.`, 'err');
    const id = uid('category');
    catalog.categories.push({ id, name: '새 카테고리', visible: true, accent: '#1769e0', sectionTitle: '새 카테고리', badge: '', heroTitle: '새', heroAccent: '카테고리', lead: '', copy: '', visualIcon: '🧰', visualTitle: '새 카테고리', visualText: '', programs: [] });
    selectedCategoryId = id; selectedProgramId = ''; markDirty(); renderAll();
  }

  function deleteCategory() {
    const category = selectedCategory(); if (!category) return;
    if (catalog.categories.length <= 1) return note('최소 한 개의 카테고리는 남겨야 합니다.', 'err');
    if (!confirm(`“${category.name}” 카테고리와 안의 프로그램 ${category.programs.length}개를 삭제할까요?`)) return;
    const index = catalog.categories.findIndex((item) => item.id === category.id);
    catalog.categories.splice(index, 1);
    selectedCategoryId = catalog.categories[Math.max(0, index - 1)]?.id || catalog.categories[0]?.id || '';
    selectedProgramId = selectedCategory()?.programs[0]?.id || '';
    markDirty(); renderAll();
  }

  function addProgram() {
    const category = selectedCategory(); if (!category) return;
    if (category.programs.length >= core().MAX_PROGRAMS_PER_CATEGORY) return note(`한 카테고리에는 최대 ${core().MAX_PROGRAMS_PER_CATEGORY}개 프로그램을 둘 수 있습니다.`, 'err');
    const id = uid('program');
    category.programs.push({ id, name: '새 프로그램', icon: '🧰', accent: '#1769e0', bg: '#eef7ff', desc: '', url: '', tags: [], status: 'coming', visible: true });
    selectedProgramId = id; markDirty(); renderAll();
  }

  function deleteProgram() {
    const category = selectedCategory(), program = selectedProgram(); if (!category || !program) return;
    if (!confirm(`“${program.name}” 프로그램을 삭제할까요?`)) return;
    const index = category.programs.findIndex((item) => item.id === program.id);
    category.programs.splice(index, 1);
    selectedProgramId = category.programs[Math.max(0, index - 1)]?.id || category.programs[0]?.id || '';
    markDirty(); renderAll();
  }

  function renderAll() { renderCategoryList(); renderEditor(); renderSaveState(); }

  function normalizeState() {
    catalog = core().normalizeCatalog(catalog || core().defaultCatalog());
    if (!catalog.categories.length) catalog = core().defaultCatalog();
    if (!selectedCategoryId || !categoryById(selectedCategoryId)) selectedCategoryId = catalog.categories[0]?.id || '';
    const category = selectedCategory();
    if (!selectedProgramId || !category?.programs.some((program) => program.id === selectedProgramId)) selectedProgramId = category?.programs[0]?.id || '';
  }

  async function loadCatalog() {
    if (!window.db || !core()) throw new Error('카탈로그 서버가 준비되지 않았습니다.');
    setBusy(true); note('홈 카탈로그를 불러오는 중입니다.');
    try {
      const snapshot = await db.collection('settings').doc(DOC_ID).get();
      catalog = snapshot.exists ? core().normalizeCatalog(snapshot.data() || {}) : core().defaultCatalog();
      selectedCategoryId = catalog.categories[0]?.id || '';
      selectedProgramId = selectedCategory()?.programs[0]?.id || '';
      dirty = false; normalizeState(); renderAll();
      note(snapshot.exists ? '저장된 홈 카탈로그를 불러왔습니다.' : '현재 고정 홈 구성을 기본값으로 불러왔습니다. 저장하면 관리자 관리가 시작됩니다.', 'ok');
    } finally { setBusy(false); }
  }

  async function saveCatalog() {
    if (busy) return;
    normalizeState();
    const normalized = core().normalizeCatalog(catalog);
    const visibleCategories = normalized.categories.filter((category) => category.visible);
    if (!visibleCategories.length) return note('홈에는 최소 한 개의 공개 카테고리가 필요합니다.', 'err');
    setBusy(true); note('홈 카테고리를 저장하는 중입니다.');
    try {
      const payload = { ...normalized, updatedBy: currentUser?.uid || '', updatedByEmail: currentUser?.email || '', updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      await db.collection('settings').doc(DOC_ID).set(payload);
      catalog = normalized; dirty = false; renderAll(); note('저장했습니다. 홈을 새로 열면 변경한 이름·순서·프로그램 구성이 반영됩니다.', 'ok');
      window.dispatchEvent(new CustomEvent('program-catalog-admin-saved'));
    } catch (error) { note(error?.message || '홈 카탈로그를 저장하지 못했습니다.', 'err'); }
    finally { setBusy(false); }
  }

  function restoreDefaults() {
    if (dirty && !confirm('저장하지 않은 변경을 버리고 기본 구성을 불러올까요?')) return;
    catalog = core().defaultCatalog(); selectedCategoryId = catalog.categories[0]?.id || ''; selectedProgramId = selectedCategory()?.programs[0]?.id || ''; dirty = true; renderAll(); note('기본 구성을 불러왔습니다. 아직 서버에는 저장하지 않았습니다.');
  }

  function bindPanelActions() {
    $('pcatSave')?.addEventListener('click', saveCatalog);
    $('pcatReload')?.addEventListener('click', () => { if (!dirty || confirm('저장하지 않은 변경을 버리고 서버 내용을 다시 불러올까요?')) loadCatalog().catch((error) => note(error.message, 'err')); });
    $('pcatDefaults')?.addEventListener('click', restoreDefaults);
    $('pcatOpenHome')?.addEventListener('click', () => window.open('/', '_blank', 'noopener'));
    $('pcatAddCategory')?.addEventListener('click', addCategory);
    $('pcatCategoryList')?.addEventListener('click', (event) => {
      const up = event.target.closest('[data-cat-up]'), down = event.target.closest('[data-cat-down]');
      const id = up?.dataset.catUp || down?.dataset.catDown; if (!id) return;
      const from = catalog.categories.findIndex((category) => category.id === id), to = from + (up ? -1 : 1);
      if (moveArrayItem(catalog.categories, from, to)) { markDirty(); renderAll(); }
    });
    $('pcatEditor')?.addEventListener('click', (event) => {
      const up = event.target.closest('[data-prog-up]'), down = event.target.closest('[data-prog-down]');
      const id = up?.dataset.progUp || down?.dataset.progDown; if (!id) return;
      const category = selectedCategory(); if (!category) return;
      const from = category.programs.findIndex((program) => program.id === id), to = from + (up ? -1 : 1);
      if (moveArrayItem(category.programs, from, to)) { markDirty(); renderAll(); }
    });
  }

  async function verifyAndInstall() {
    if (installed || !window.auth || !window.db || !window.ProgramAccess || !core()) return false;
    const user = auth.currentUser;
    if (!user) return false;
    let admin = false;
    try { admin = await ProgramAccess.isAdmin(user); } catch (_) { return false; }
    if (!admin) return false;
    currentUser = user;
    installStyles();
    if (!makeNav() || !makePanel()) return false;
    bindPanelActions(); installed = true;
    await loadCatalog();
    document.documentElement.dataset.adminProgramCatalog = '1';
    return true;
  }

  async function install() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if (await verifyAndInstall()) return true;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return false;
  }

  window.AdminProgramCatalogManager = { install, loadCatalog, saveCatalog, stage: 'drag-reorder-editable-home-catalog' };
  if (window.auth) auth.onAuthStateChanged(() => install());
  install();
})();
