// Current-state templates, validated project import, and Firebase template cleanup.
(function () {
  'use strict';
  if (window.__coverTemplateProjectSafetyV2) return;
  window.__coverTemplateProjectSafetyV2 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const TEMPLATE_KEY = 'programTool.coverEditor.userTemplates.v1';
  const PROJECT_TYPE = 'program-tool-cover-project';
  const PROJECT_VERSION = 2;
  const MAX_TEMPLATES = 30;
  const MAX_PROJECT_BYTES = 2 * 1024 * 1024;
  const MAX_LAYOUT_ITEMS = 300;
  const MAX_TEXT_ITEMS = 60;
  const MAX_TEXT_LENGTH = 2000;
  const INSTALL_DELAYS = [0, 220, 520, 900, 1500, 2400];
  const SIDES = ['front', 'spine', 'back'];
  const ZONES = ['top', 'center', 'bottom'];
  const IMAGE_MIMES = new Map([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ]);
  const FIELD_IDS = [
    'trimW', 'trimH', 'bleed', 'safeMargin', 'pageCount', 'paperCaliper',
    'bindingAdjust', 'manualSpine', 'spineManual', 'frontColor', 'backColor',
    'spineColor', 'textColor', 'titleSize', 'spineTextSize', 'spineDirection',
    'frontTitle', 'frontSubtitle', 'publisher', 'publishYear', 'backText',
    'spineTitle', 'imageFit', 'institutionName', 'issuerName', 'publishYearLine',
    'backTitleExtra', 'backBodyExtra', 'spineTop', 'spineCenter', 'spineBottom',
    'editTarget', 'posX', 'posY', 'itemScale',
  ];

  let adminFrontFile = null;
  let adminBackFile = null;
  let adminBusy = false;

  const byId = (id) => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  function bridge() {
    return window.CoverProjectStateBridge || null;
  }

  function fire(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function currentValues() {
    const values = {};
    for (const id of FIELD_IDS) {
      const element = byId(id);
      if (!element) continue;
      values[id] = element.type === 'checkbox' ? element.checked : element.value;
    }
    return values;
  }

  function currentLayout() {
    try {
      return typeof state !== 'undefined' && state.layout ? clone(state.layout) : {};
    } catch (_) {
      return {};
    }
  }

  function snapshotTemplate(name) {
    return {
      id: `tpl_${Date.now()}`,
      name: String(name || '').trim().slice(0, 80),
      templateVersion: 2,
      values: currentValues(),
      layout: currentLayout(),
      extended: clone(bridge()?.snapshot?.() || null),
      savedAt: Date.now(),
    };
  }

  function readTemplates() {
    try {
      const parsed = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(plainObject).slice(0, MAX_TEMPLATES) : [];
    } catch (_) {
      return [];
    }
  }

  function writeTemplates(items) {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(items.slice(0, MAX_TEMPLATES)));
  }

  function renderTemplateOptions(selectedId) {
    const select = byId('userCoverTemplate');
    if (!select) return;
    const items = readTemplates();
    select.replaceChildren(new Option(items.length ? '템플릿 선택' : '저장된 템플릿 없음', ''));
    for (const item of items) {
      const option = new Option(String(item.name || '이름 없는 템플릿').slice(0, 80), String(item.id || ''));
      select.appendChild(option);
    }
    if (selectedId && items.some((item) => item.id === selectedId)) select.value = selectedId;
  }

  function applyValues(values) {
    if (!plainObject(values)) return;
    for (const id of FIELD_IDS) {
      if (!(id in values)) continue;
      const element = byId(id);
      if (!element) continue;
      if (element.type === 'checkbox') element.checked = Boolean(values[id]);
      else element.value = String(values[id] ?? '').slice(0, 5000);
      fire(element);
    }
  }

  function sanitizeLayout(source) {
    if (!plainObject(source)) return {};
    const entries = Object.entries(source);
    if (entries.length > MAX_LAYOUT_ITEMS) throw new Error(`배치 요소는 ${MAX_LAYOUT_ITEMS}개 이하만 불러올 수 있습니다.`);
    const output = {};
    for (const [rawKey, rawValue] of entries) {
      if (!plainObject(rawValue)) continue;
      const key = String(rawKey).slice(0, 120);
      if (!key) continue;
      output[key] = {
        x: clamp(finite(rawValue.x, 50), -100, 100),
        y: clamp(finite(rawValue.y, 50), -100, 100),
        scale: clamp(finite(rawValue.scale, 100), 25, 500),
      };
    }
    return output;
  }

  function applyLayout(layout) {
    const normalized = sanitizeLayout(layout);
    try {
      if (typeof state === 'undefined' || !state.layout) return;
      for (const [key, value] of Object.entries(normalized)) {
        if (!state.layout[key]) state.layout[key] = {};
        Object.assign(state.layout[key], value);
      }
    } catch (_) {}
  }

  function sanitizeColor(value, fallback) {
    const color = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function sanitizeTextZones(source) {
    const output = Object.fromEntries(SIDES.map((side) => [
      side,
      Object.fromEntries(ZONES.map((zone) => [zone, []])),
    ]));
    if (!plainObject(source)) return output;
    let count = 0;
    for (const side of SIDES) {
      for (const zone of ZONES) {
        const entries = Array.isArray(source?.[side]?.[zone]) ? source[side][zone] : [];
        for (const raw of entries) {
          if (!plainObject(raw)) continue;
          count += 1;
          if (count > MAX_TEXT_ITEMS) throw new Error(`글자 레이어는 ${MAX_TEXT_ITEMS}개 이하만 불러올 수 있습니다.`);
          output[side][zone].push({
            id: String(raw.id || `import_${side}_${zone}_${count}`).slice(0, 120),
            side,
            zone,
            text: String(raw.text || '').slice(0, MAX_TEXT_LENGTH),
            size: clamp(finite(raw.size, side === 'spine' ? 10 : 18), 5, 100),
            color: sanitizeColor(raw.color, side === 'spine' ? '#ffffff' : '#12396d'),
            weight: clamp(Math.round(finite(raw.weight, 700) / 100) * 100, 100, 900),
            x: clamp(finite(raw.x, 50), 0, 100),
            y: clamp(finite(raw.y, 50), 0, 100),
            scale: clamp(finite(raw.scale, 100), 50, 200),
          });
        }
      }
    }
    return output;
  }

  function sanitizeImageEffects(source) {
    const defaults = { rotation: 0, flipX: false, flipY: false, brightness: 100, contrast: 100, saturation: 100 };
    const output = {};
    for (const key of ['frontImage', 'backImage']) {
      const raw = plainObject(source?.[key]) ? source[key] : {};
      output[key] = {
        rotation: clamp(finite(raw.rotation, defaults.rotation), -360, 360),
        flipX: Boolean(raw.flipX),
        flipY: Boolean(raw.flipY),
        brightness: clamp(finite(raw.brightness, defaults.brightness), 20, 200),
        contrast: clamp(finite(raw.contrast, defaults.contrast), 20, 250),
        saturation: clamp(finite(raw.saturation, defaults.saturation), 0, 250),
      };
    }
    return output;
  }

  function sanitizeExtended(source) {
    const raw = plainObject(source) ? source : {};
    return {
      textZones: sanitizeTextZones(raw.textZones),
      imageEffects: sanitizeImageEffects(raw.imageEffects),
    };
  }

  function sanitizeValues(source) {
    if (!plainObject(source)) throw new Error('프로젝트 설정이 손상되었습니다.');
    const output = {};
    for (const id of FIELD_IDS) {
      if (!(id in source)) continue;
      const value = source[id];
      output[id] = typeof value === 'boolean' ? value : String(value ?? '').slice(0, 5000);
    }
    return output;
  }

  function normalizeProject(source) {
    if (!plainObject(source) || source.type !== PROJECT_TYPE) {
      throw new Error('Program Tool 표지 프로젝트 파일이 아닙니다.');
    }
    const version = Math.trunc(finite(source.version, 0));
    if (version < 1 || version > PROJECT_VERSION) {
      throw new Error(`지원하지 않는 프로젝트 버전입니다. 현재 지원 버전은 ${PROJECT_VERSION}입니다.`);
    }
    return {
      type: PROJECT_TYPE,
      version,
      values: sanitizeValues(source.values),
      layout: sanitizeLayout(source.layout),
      extended: sanitizeExtended(source.extended || source.projectState),
    };
  }

  function finishRestore() {
    try { window.syncControls?.(); } catch (_) {}
    try { window.updateCalculation?.(); } catch (_) {}
    try { window.requestRender?.(); } catch (_) {}
    setTimeout(() => byId('runCoverPreflight')?.click(), 120);
  }

  function restoreTemplate(item) {
    if (!plainObject(item)) throw new Error('불러올 템플릿이 손상되었습니다.');
    applyValues(item.values || {});
    applyLayout(item.layout || {});
    if (item.extended) bridge()?.restore?.(sanitizeExtended(item.extended));
    finishRestore();
  }

  function stopHandledEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  }

  function saveUserTemplate(event) {
    stopHandledEvent(event);
    const input = byId('userCoverTemplateName');
    const name = String(input?.value || '').trim();
    if (!name) return window.alert('템플릿 이름을 입력하세요.');
    const items = readTemplates();
    const item = snapshotTemplate(name);
    items.unshift(item);
    writeTemplates(items);
    if (input) input.value = '';
    renderTemplateOptions(item.id);
    window.alert('현재 글자 레이어와 이미지 효과를 포함해 템플릿으로 저장했습니다.');
  }

  function applyUserTemplate(event) {
    stopHandledEvent(event);
    const id = byId('userCoverTemplate')?.value;
    const item = readTemplates().find((candidate) => candidate.id === id);
    if (!item) return window.alert('불러올 템플릿을 선택하세요.');
    try {
      restoreTemplate(item);
      window.alert('템플릿을 불러왔습니다.');
    } catch (error) {
      window.alert(error?.message || '템플릿을 불러오지 못했습니다.');
    }
  }

  function deleteUserTemplate(event) {
    stopHandledEvent(event);
    const id = byId('userCoverTemplate')?.value;
    const items = readTemplates();
    const item = items.find((candidate) => candidate.id === id);
    if (!item) return;
    if (!window.confirm(`“${item.name}” 템플릿을 삭제할까요?`)) return;
    writeTemplates(items.filter((candidate) => candidate.id !== id));
    renderTemplateOptions();
  }

  async function importProjectFile(file) {
    if (!file) return false;
    if (file.size > MAX_PROJECT_BYTES) throw new Error('프로젝트 파일은 2MB 이하만 불러올 수 있습니다.');
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (_) {
      throw new Error('JSON 형식이 올바르지 않습니다.');
    }
    const project = normalizeProject(parsed);
    applyValues(project.values);
    applyLayout(project.layout);
    bridge()?.restore?.(project.extended);
    finishRestore();
    return true;
  }

  function setTemplateInfo(message) {
    const element = byId('coverTemplateInfo');
    if (element) element.textContent = message;
  }

  function captureAdminFile(event, side) {
    const file = event.target?.files?.[0] || null;
    if (side === 'front') adminFrontFile = file;
    else adminBackFile = file;
  }

  function validateAdminImage(file) {
    if (!file) return null;
    if (!IMAGE_MIMES.has(file.type)) throw new Error('관리자 템플릿은 JPG·PNG·WEBP 이미지만 저장할 수 있습니다.');
    if (file.size > 15 * 1024 * 1024) throw new Error('이미지 파일은 15MB 이하만 저장할 수 있습니다.');
    return IMAGE_MIMES.get(file.type);
  }

  async function deleteStoragePath(path) {
    if (!path) return true;
    try {
      await firebase.storage().ref(path).delete();
      return true;
    } catch (error) {
      if (error?.code === 'storage/object-not-found') return true;
      throw error;
    }
  }

  async function uploadAdminPart(file, templateId, side, cleanupPaths) {
    if (!file) return null;
    const extension = validateAdminImage(file);
    const path = `cover_templates/${templateId}/${side}.${extension}`;
    cleanupPaths.push(path);
    const reference = firebase.storage().ref(path);
    await reference.put(file, { contentType: file.type });
    return { url: await reference.getDownloadURL(), path };
  }

  async function saveAdminTemplate(event) {
    stopHandledEvent(event);
    if (adminBusy) return;
    const name = String(byId('coverTemplateName')?.value || '').trim();
    if (!name) return setTemplateInfo('템플릿 이름을 입력하세요.');
    if (!adminFrontFile && !adminBackFile) return setTemplateInfo('앞표지 또는 뒤표지 이미지를 새로 선택하세요.');
    const user = window.auth?.currentUser;
    if (!user || !window.db || !window.firebase?.storage) return setTemplateInfo('관리자 인증 또는 Firebase 연결을 확인하세요.');

    adminBusy = true;
    const button = byId('saveCoverTemplate');
    if (button) button.disabled = true;
    const cleanupPaths = [];
    const documentRef = db.collection('cover_templates').doc();
    try {
      setTemplateInfo('관리자 템플릿을 저장하는 중입니다...');
      const front = await uploadAdminPart(adminFrontFile, documentRef.id, 'front', cleanupPaths);
      const back = await uploadAdminPart(adminBackFile, documentRef.id, 'back', cleanupPaths);
      await documentRef.set({
        name: name.slice(0, 120),
        category: String(byId('coverTemplateCategory')?.value || '').trim().slice(0, 80),
        isPublic: byId('coverTemplatePublic')?.value === 'true',
        frontUrl: front?.url || '',
        backUrl: back?.url || '',
        frontPath: front?.path || '',
        backPath: back?.path || '',
        createdBy: user.uid,
        createdByEmail: user.email || '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      adminFrontFile = null;
      adminBackFile = null;
      setTemplateInfo('관리자 템플릿으로 저장했습니다.');
      byId('refreshCoverTemplates')?.click();
    } catch (error) {
      const cleanup = await Promise.allSettled(cleanupPaths.map(deleteStoragePath));
      const cleanupFailed = cleanup.some((result) => result.status === 'rejected');
      setTemplateInfo(cleanupFailed
        ? `저장 실패 · 업로드 파일 정리도 확인이 필요합니다: ${error?.message || error}`
        : `저장 실패 · 업로드된 임시 파일을 정리했습니다: ${error?.message || error}`);
    } finally {
      adminBusy = false;
      if (button) button.disabled = false;
    }
  }

  async function deleteAdminTemplate(event) {
    stopHandledEvent(event);
    if (adminBusy) return;
    const select = byId('coverTemplateSelect');
    const option = select?.selectedOptions?.[0];
    if (!option?.value) return setTemplateInfo('삭제할 템플릿을 선택하세요.');
    if (!window.confirm(`“${option.textContent}” 템플릿을 삭제할까요?`)) return;
    if (!window.db || !window.firebase?.storage) return setTemplateInfo('Firebase 연결을 확인하세요.');

    adminBusy = true;
    const button = byId('deleteCoverTemplate');
    if (button) button.disabled = true;
    try {
      setTemplateInfo('템플릿 원본 이미지를 정리하는 중입니다...');
      await deleteStoragePath(option.dataset.frontPath || '');
      await deleteStoragePath(option.dataset.backPath || '');
      await db.collection('cover_templates').doc(option.value).delete();
      setTemplateInfo('관리자 템플릿과 원본 이미지를 삭제했습니다.');
      byId('refreshCoverTemplates')?.click();
    } catch (error) {
      setTemplateInfo(`삭제 중단 · 원본 파일 또는 권한을 확인하세요: ${error?.message || error}`);
    } finally {
      adminBusy = false;
      if (button) button.disabled = false;
    }
  }

  function bindCapture(id, handler) {
    const element = byId(id);
    if (!element || element.dataset.coverTemplateSafetyV2 === '1') return;
    element.dataset.coverTemplateSafetyV2 = '1';
    element.addEventListener('click', handler, { capture: true });
  }

  function install() {
    bindCapture('saveUserCoverTemplate', saveUserTemplate);
    bindCapture('applyUserCoverTemplate', applyUserTemplate);
    bindCapture('deleteUserCoverTemplate', deleteUserTemplate);
    bindCapture('saveCoverTemplate', saveAdminTemplate);
    bindCapture('deleteCoverTemplate', deleteAdminTemplate);

    const front = byId('frontInput');
    if (front && front.dataset.coverAdminCaptureV2 !== '1') {
      front.dataset.coverAdminCaptureV2 = '1';
      front.addEventListener('change', (event) => captureAdminFile(event, 'front'), { capture: true });
    }
    const back = byId('backInput');
    if (back && back.dataset.coverAdminCaptureV2 !== '1') {
      back.dataset.coverAdminCaptureV2 = '1';
      back.addEventListener('change', (event) => captureAdminFile(event, 'back'), { capture: true });
    }

    const input = byId('importCoverProjectInput');
    if (input && input.dataset.coverProjectValidationV2 !== '1') {
      input.dataset.coverProjectValidationV2 = '1';
      input.onchange = async (event) => {
        try {
          if (await importProjectFile(event.target.files?.[0])) window.alert('프로젝트 파일을 안전하게 불러왔습니다.');
        } catch (error) {
          window.alert(error?.message || '프로젝트 파일을 불러오지 못했습니다.');
        } finally {
          event.target.value = '';
        }
      };
    }
  }

  window.CoverTemplateProjectSafety = {
    snapshotTemplate,
    restoreTemplate,
    normalizeProject,
    sanitizeLayout,
    sanitizeExtended,
    importProjectFile,
    deleteStoragePath,
    stage: 'template-project-storage-validation',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
