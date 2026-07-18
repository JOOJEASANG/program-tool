// Local project preset manager for the perfect-binding cover maker.
// Image files are intentionally excluded; browsers cannot safely persist local files.
(function () {
  if (window.__perfectBindingProjectsV1) return;
  window.__perfectBindingProjectsV1 = true;

  const STORAGE_KEY = 'programToolPerfectBindingProjectsV1';
  const MAX_PROJECTS = 10;

  function readProjects() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(data) ? data.slice(0, MAX_PROJECTS) : [];
    } catch (_) {
      return [];
    }
  }

  function writeProjects(projects) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
  }

  function collectSettings() {
    const values = {};
    document.querySelectorAll('.settings input[id],.settings select[id],.settings textarea[id]').forEach(el => {
      if (el.type === 'file' || el.type === 'button' || el.type === 'submit') return;
      values[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    let layout = null;
    try { if (typeof state !== 'undefined' && state?.layout) layout = JSON.parse(JSON.stringify(state.layout)); } catch (_) {}
    return { values, layout, savedAt: new Date().toISOString(), version: 1 };
  }

  function applySettings(project) {
    const values = project?.values || {};
    Object.entries(values).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el || el.type === 'file') return;
      if (el.type === 'checkbox') el.checked = !!value;
      else el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    try {
      if (project.layout && typeof state !== 'undefined' && state?.layout) {
        Object.entries(project.layout).forEach(([key, value]) => {
          if (state.layout[key] && value && typeof value === 'object') state.layout[key] = { ...state.layout[key], ...value };
        });
        if (typeof syncControls === 'function') syncControls();
        if (typeof requestRender === 'function') requestRender();
      }
    } catch (_) {}
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function boot() {
    const settings = document.querySelector('.settings');
    if (!settings || document.getElementById('coverProjectCard')) return;

    const card = document.createElement('section');
    card.className = 'card';
    card.id = 'coverProjectCard';
    card.innerHTML = `
      <div class="card-head"><span class="step">★</span><div class="card-title">프로젝트 설정 저장</div></div>
      <div class="field"><label for="coverProjectSelect">저장된 설정</label><select id="coverProjectSelect"><option value="">저장된 설정 선택</option></select></div>
      <div class="layout-actions">
        <button class="mini-btn" id="coverProjectSave" type="button">현재 설정 저장</button>
        <button class="mini-btn" id="coverProjectLoad" type="button">불러오기</button>
        <button class="mini-btn" id="coverProjectDelete" type="button">삭제</button>
        <button class="mini-btn" id="coverProjectExport" type="button">JSON 내보내기</button>
      </div>
      <input id="coverProjectImportInput" type="file" accept="application/json,.json" style="display:none">
      <button class="mini-btn" id="coverProjectImport" type="button" style="width:100%;margin-top:7px">JSON 가져오기</button>
      <div class="card-note">규격·책등 계산·문구·색상·배치값을 최대 10개까지 이 브라우저에 저장합니다. 앞·뒤표지 이미지 파일은 개인정보 보호와 브라우저 제한 때문에 저장되지 않습니다.</div>
      <div class="status" id="coverProjectStatus"></div>`;

    const reference = settings.querySelector('.card:nth-last-child(1)');
    if (reference) settings.insertBefore(card, reference);
    else settings.appendChild(card);

    const select = document.getElementById('coverProjectSelect');
    const status = document.getElementById('coverProjectStatus');
    const setStatus = (message, type = 'ok') => {
      status.textContent = message;
      status.className = 'status ' + type;
      setTimeout(() => { if (status.textContent === message) status.textContent = ''; }, 3500);
    };

    function refresh(selectedId) {
      const projects = readProjects();
      select.replaceChildren(new Option('저장된 설정 선택', ''));
      projects.forEach(project => select.appendChild(new Option(project.name, project.id)));
      if (selectedId) select.value = selectedId;
      return projects;
    }

    document.getElementById('coverProjectSave').addEventListener('click', () => {
      const suggested = '표지 설정 ' + new Date().toLocaleDateString('ko-KR');
      const name = (prompt('저장할 설정 이름을 입력하세요.', suggested) || '').trim();
      if (!name) return;
      const projects = readProjects();
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      projects.unshift({ id, name: name.slice(0, 40), ...collectSettings() });
      writeProjects(projects);
      refresh(id);
      setStatus('현재 표지 설정을 저장했습니다.');
    });

    document.getElementById('coverProjectLoad').addEventListener('click', () => {
      const project = readProjects().find(item => item.id === select.value);
      if (!project) return setStatus('불러올 설정을 선택하세요.', 'err');
      applySettings(project);
      setStatus('설정을 불러왔습니다. 표지 이미지는 다시 선택해 주세요.');
    });

    document.getElementById('coverProjectDelete').addEventListener('click', () => {
      const project = readProjects().find(item => item.id === select.value);
      if (!project) return setStatus('삭제할 설정을 선택하세요.', 'err');
      if (!confirm('"' + project.name + '" 설정을 삭제할까요?')) return;
      writeProjects(readProjects().filter(item => item.id !== project.id));
      refresh();
      setStatus('저장된 설정을 삭제했습니다.');
    });

    document.getElementById('coverProjectExport').addEventListener('click', () => {
      const project = readProjects().find(item => item.id === select.value) || { id: 'export', name: '현재 표지 설정', ...collectSettings() };
      downloadJson(project, '표지설정_' + String(project.name || 'project').replace(/[\\/:*?"<>|]+/g, '_') + '.json');
      setStatus('설정 JSON 파일을 만들었습니다.');
    });

    const importInput = document.getElementById('coverProjectImportInput');
    document.getElementById('coverProjectImport').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      importInput.value = '';
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        if (!imported || typeof imported !== 'object' || !imported.values) throw new Error('올바른 표지 설정 파일이 아닙니다.');
        const projects = readProjects();
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        projects.unshift({ ...imported, id, name: String(imported.name || file.name.replace(/\.json$/i, '')).slice(0, 40) });
        writeProjects(projects);
        refresh(id);
        setStatus('설정 파일을 가져왔습니다.');
      } catch (error) {
        setStatus(error.message || '설정 파일을 읽지 못했습니다.', 'err');
      }
    });

    refresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
