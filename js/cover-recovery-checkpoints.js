// IndexedDB recovery checkpoints with deduplicated front/back source images.
(function () {
  'use strict';
  if (window.__coverRecoveryCheckpointsV1) return;
  window.__coverRecoveryCheckpointsV1 = true;
  if (!location.pathname.includes('perfect-binding-cover')) return;

  const DB_NAME = 'programToolCoverRecovery';
  const DB_VERSION = 1;
  const CHECKPOINT_STORE = 'checkpoints';
  const ASSET_STORE = 'assets';
  const WORKING_ID = 'working';
  const MAX_ROLLING = 5;
  const MIN_ROLLING_INTERVAL_MS = 3 * 60 * 1000;
  const SAVE_DELAY_MS = 1600;
  const INSTALL_DELAYS = [0, 300, 700, 1200, 2000, 3200];
  const FIELD_IDS = [
    'trimW', 'trimH', 'bleed', 'safeMargin', 'pageCount', 'paperCaliper',
    'bindingAdjust', 'manualSpine', 'spineManual', 'frontColor', 'backColor',
    'spineColor', 'textColor', 'titleSize', 'spineTextSize', 'spineDirection',
    'frontTitle', 'frontSubtitle', 'publisher', 'publishYear', 'backText',
    'spineTitle', 'imageFit', 'institutionName', 'issuerName', 'publishYearLine',
    'backTitleExtra', 'backBodyExtra', 'spineTop', 'spineCenter', 'spineBottom',
    'editTarget', 'posX', 'posY', 'itemScale',
  ];

  let dbPromise = null;
  let saveTimer = 0;
  let saveChain = Promise.resolve();
  let lastSignature = '';
  let lastRollingAt = 0;
  let dirty = false;
  let installed = false;
  let activeRestore = false;

  const byId = (id) => document.getElementById(id);
  const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
  const plainObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  function requestPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('브라우저 저장소 작업에 실패했습니다.'));
    });
  }

  function transactionPromise(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('브라우저 저장소 작업에 실패했습니다.'));
      transaction.onabort = () => reject(transaction.error || new Error('브라우저 저장소 작업이 중단됐습니다.'));
    });
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    if (!window.indexedDB) return Promise.reject(new Error('이 브라우저에서는 최근 작업 복구를 사용할 수 없습니다.'));
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(CHECKPOINT_STORE)) {
          const checkpoints = db.createObjectStore(CHECKPOINT_STORE, { keyPath: 'id' });
          checkpoints.createIndex('savedAt', 'savedAt');
        }
        if (!db.objectStoreNames.contains(ASSET_STORE)) {
          db.createObjectStore(ASSET_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('최근 작업 저장소를 열지 못했습니다.'));
      };
      request.onblocked = () => reject(new Error('다른 창에서 사용 중인 작업 저장소를 닫아 주세요.'));
    });
    return dbPromise;
  }

  async function putRecord(storeName, value) {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).put(value);
    await transactionPromise(transaction);
    return value;
  }

  async function getRecord(storeName, id) {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readonly');
    const result = await requestPromise(transaction.objectStore(storeName).get(id));
    await transactionPromise(transaction);
    return result || null;
  }

  async function getAllRecords(storeName) {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readonly');
    const result = await requestPromise(transaction.objectStore(storeName).getAll());
    await transactionPromise(transaction);
    return Array.isArray(result) ? result : [];
  }

  async function deleteRecord(storeName, id) {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).delete(id);
    await transactionPromise(transaction);
  }

  async function clearStore(storeName) {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, 'readwrite');
    transaction.objectStore(storeName).clear();
    await transactionPromise(transaction);
  }

  function recoverableImageSource(image) {
    const source = String(image?.src || '').trim();
    return /^(data:image\/(?:jpeg|png|webp);base64,|https?:\/\/)/i.test(source) ? source : '';
  }

  function sourceFingerprint(source) {
    const text = String(source || '');
    const length = text.length;
    const chunk = 4096;
    const middle = Math.max(0, Math.floor(length / 2) - Math.floor(chunk / 2));
    const sample = `${length}|${text.slice(0, chunk)}|${text.slice(middle, middle + chunk)}|${text.slice(-chunk)}`;
    let first = 2166136261;
    let second = 2246822507;
    for (let index = 0; index < sample.length; index += 1) {
      const code = sample.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 16777619) >>> 0;
      second ^= code + index;
      second = Math.imul(second, 3266489917) >>> 0;
    }
    return `${length.toString(36)}_${first.toString(36)}_${second.toString(36)}`;
  }

  function assetIdentity(source) {
    const text = String(source || '');
    return {
      id: `asset_${sourceFingerprint(text)}`,
      fingerprint: `${text.length}:${text.slice(0, 96)}:${text.slice(-96)}`,
    };
  }

  async function ensureImageAsset(image, name) {
    const source = recoverableImageSource(image);
    if (!source) return null;
    const identity = assetIdentity(source);
    const existing = await getRecord(ASSET_STORE, identity.id).catch(() => null);
    let id = identity.id;
    if (existing && existing.fingerprint !== identity.fingerprint) {
      id = `${identity.id}_${Date.now().toString(36)}`;
    }
    if (!existing || id !== identity.id) {
      await putRecord(ASSET_STORE, {
        id,
        fingerprint: identity.fingerprint,
        source,
        sourceLength: source.length,
        savedAt: Date.now(),
      });
    }
    return { assetId: id, name: String(name || '').slice(0, 180) };
  }

  function currentStateImage(side) {
    try {
      if (typeof state === 'undefined') return null;
      return side === 'front' ? state.frontImage : state.backImage;
    } catch (_) {
      return null;
    }
  }

  function currentLayout() {
    try {
      return typeof state !== 'undefined' && state.layout ? clone(state.layout) : {};
    } catch (_) {
      return {};
    }
  }

  function currentFields() {
    const fields = {};
    for (const id of FIELD_IDS) {
      const element = byId(id);
      if (!element) continue;
      fields[id] = element.type === 'checkbox' ? element.checked : element.value;
    }
    return fields;
  }

  function currentTitle() {
    try {
      const title = window.CoverProjectStateBridge?.primaryText?.('front');
      if (String(title || '').trim()) return String(title).trim().slice(0, 80);
    } catch (_) {}
    return String(byId('frontTitle')?.value || '').trim().slice(0, 80) || '제목 없는 표지 작업';
  }

  async function captureSnapshot() {
    const front = await ensureImageAsset(currentStateImage('front'), byId('frontName')?.textContent || '앞표지 이미지');
    const back = await ensureImageAsset(currentStateImage('back'), byId('backName')?.textContent || '뒤표지 이미지');
    let extended = null;
    try { extended = clone(window.CoverProjectStateBridge?.snapshot?.() || null); }
    catch (_) {}
    let showGuides = true;
    try { if (typeof state !== 'undefined') showGuides = state.showGuides !== false; }
    catch (_) {}
    return {
      version: 1,
      title: currentTitle(),
      fields: currentFields(),
      layout: currentLayout(),
      extended,
      images: { front, back },
      showGuides,
      savedAt: Date.now(),
    };
  }

  function snapshotSignature(snapshot) {
    const source = clone(snapshot) || {};
    delete source.savedAt;
    return JSON.stringify(source);
  }

  function rollingRecords(records) {
    return (Array.isArray(records) ? records : [])
      .filter((record) => String(record?.id || '').startsWith('checkpoint_'))
      .sort((left, right) => Number(right.savedAt || 0) - Number(left.savedAt || 0));
  }

  function trimRollingRecords(records, max = MAX_ROLLING) {
    const rolling = rollingRecords(records);
    return {
      keep: rolling.slice(0, Math.max(0, max)),
      remove: rolling.slice(Math.max(0, max)),
    };
  }

  async function trimOldCheckpoints() {
    const records = await getAllRecords(CHECKPOINT_STORE);
    const { remove } = trimRollingRecords(records);
    for (const record of remove) await deleteRecord(CHECKPOINT_STORE, record.id);
  }

  async function cleanupUnusedAssets() {
    const records = await getAllRecords(CHECKPOINT_STORE);
    const referenced = new Set();
    for (const record of records) {
      for (const side of ['front', 'back']) {
        const assetId = record?.snapshot?.images?.[side]?.assetId;
        if (assetId) referenced.add(assetId);
      }
    }
    const assets = await getAllRecords(ASSET_STORE);
    for (const asset of assets) {
      if (!referenced.has(asset.id)) await deleteRecord(ASSET_STORE, asset.id);
    }
  }

  function checkpointRecord(snapshot, kind, savedAt = Date.now()) {
    const automatic = kind !== 'manual';
    return {
      id: automatic && kind === 'working' ? WORKING_ID : `checkpoint_${savedAt}_${Math.random().toString(36).slice(2, 7)}`,
      kind: automatic ? kind : 'manual',
      savedAt,
      title: String(snapshot?.title || '제목 없는 표지 작업').slice(0, 80),
      snapshot: { ...clone(snapshot), savedAt },
    };
  }

  async function performSave(options = {}) {
    if (activeRestore) return false;
    const manual = Boolean(options.manual);
    const force = Boolean(options.force || manual);
    const snapshot = await captureSnapshot();
    const signature = snapshotSignature(snapshot);
    if (!force && signature === lastSignature) return false;

    const now = Date.now();
    await putRecord(CHECKPOINT_STORE, checkpointRecord(snapshot, 'working', now));
    const createRolling = manual || now - lastRollingAt >= MIN_ROLLING_INTERVAL_MS;
    if (createRolling) {
      await putRecord(CHECKPOINT_STORE, checkpointRecord(snapshot, manual ? 'manual' : 'automatic', now));
      lastRollingAt = now;
    }
    lastSignature = signature;
    dirty = false;
    await trimOldCheckpoints();
    await cleanupUnusedAssets();
    await updateRecoveryBar();
    if (byId('coverRecoveryDialog') && !byId('coverRecoveryDialog').hidden) await renderRecoveryList();
    return true;
  }

  function queueSave(options = {}) {
    saveChain = saveChain
      .then(() => performSave(options))
      .catch((error) => {
        setRecoveryStatus(error?.name === 'QuotaExceededError'
          ? '복구본 저장공간이 부족합니다. 오래된 복구본을 삭제하세요.'
          : (error?.message || '최근 작업 복구본을 저장하지 못했습니다.'), 'error');
        return false;
      });
    return saveChain;
  }

  function scheduleSave() {
    if (activeRestore) return;
    dirty = true;
    clearTimeout(saveTimer);
    setRecoveryStatus('변경 내용 저장 대기 중', 'saving');
    saveTimer = setTimeout(() => queueSave(), SAVE_DELAY_MS);
  }

  function formatSavedAt(value) {
    const date = new Date(Number(value || 0));
    if (!Number.isFinite(date.getTime())) return '시간 확인 불가';
    return new Intl.DateTimeFormat('ko-KR', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(date);
  }

  function recordSummary(record) {
    const images = ['front', 'back'].filter((side) => record?.snapshot?.images?.[side]?.assetId).length;
    const kind = record?.id === WORKING_ID
      ? '최신 자동 저장'
      : record?.kind === 'manual' ? '직접 저장' : '자동 복구 지점';
    return {
      id: String(record?.id || ''),
      title: String(record?.title || '제목 없는 표지 작업'),
      kind,
      images,
      savedAt: Number(record?.savedAt || 0),
      timeLabel: formatSavedAt(record?.savedAt),
    };
  }

  function setRecoveryStatus(message, level = 'normal') {
    const element = byId('coverRecoveryStatus');
    if (!element) return;
    element.textContent = message;
    element.dataset.level = level;
  }

  async function updateRecoveryBar() {
    const records = await getAllRecords(CHECKPOINT_STORE).catch(() => []);
    const rollingCount = rollingRecords(records).length;
    const working = records.find((record) => record.id === WORKING_ID);
    if (working) setRecoveryStatus(`최근 자동 저장 · ${formatSavedAt(working.savedAt)}`, 'saved');
    else setRecoveryStatus('복구본 준비', 'normal');
    const button = byId('coverRecoveryOpen');
    if (button) {
      button.textContent = rollingCount ? `복구본 ${rollingCount}` : '복구본';
      button.title = `최근 복구 지점 ${rollingCount}개와 최신 자동 저장을 확인합니다.`;
    }
  }

  function ensureRecoveryBar() {
    let bar = byId('coverRecoveryBar');
    if (bar) return bar;
    const saveStatus = byId('coverSaveStatus');
    const panel = byId('coverLayerPanel');
    if (!saveStatus || !panel) return null;
    bar = document.createElement('div');
    bar.id = 'coverRecoveryBar';
    bar.className = 'cover-recovery-bar';
    bar.innerHTML = '<span id="coverRecoveryStatus" data-level="normal">복구본 준비</span><button type="button" class="mini-btn" id="coverRecoveryOpen">복구본</button>';
    saveStatus.insertAdjacentElement('afterend', bar);
    byId('coverRecoveryOpen')?.addEventListener('click', openRecoveryDialog);
    return bar;
  }

  function installStyles() {
    if (byId('coverRecoveryStyles')) return;
    const style = document.createElement('style');
    style.id = 'coverRecoveryStyles';
    style.textContent = `
      .cover-recovery-bar{display:flex;align-items:center;gap:7px;margin:-3px 0 8px;padding:6px 7px;border:1px solid #dbe5ee;border-radius:8px;background:#f8fafc}
      .cover-recovery-bar>span{min-width:0;flex:1;font-size:8px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cover-recovery-bar>span[data-level="saved"]{color:#166534}.cover-recovery-bar>span[data-level="saving"]{color:#2563eb}.cover-recovery-bar>span[data-level="error"]{color:#b91c1c}
      .cover-recovery-dialog[hidden]{display:none!important}
      .cover-recovery-dialog{position:fixed;inset:0;z-index:1220;display:grid;place-items:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
      .cover-recovery-panel{width:min(560px,100%);max-height:min(720px,calc(100vh - 36px));display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(148,163,184,.5);border-radius:17px;background:#fff;box-shadow:0 26px 70px rgba(15,23,42,.32)}
      .cover-recovery-head{display:flex;align-items:flex-start;gap:10px;padding:15px 16px 12px;border-bottom:1px solid #e2e8f0;background:linear-gradient(135deg,#f8fbff,#ecfeff)}
      .cover-recovery-title{font-size:15px;font-weight:950;color:#0f172a}.cover-recovery-note{margin-top:4px;font-size:9px;line-height:1.45;color:#64748b}
      .cover-recovery-close{margin-left:auto;width:30px;height:30px;border:0;border-radius:8px;background:#fff;color:#64748b;font-size:18px;cursor:pointer}
      .cover-recovery-tools{display:grid;grid-template-columns:1.3fr 1fr;gap:7px;padding:10px 16px;border-bottom:1px solid #e2e8f0;background:#fff}
      .cover-recovery-tool{min-height:35px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#475569;font-size:9px;font-weight:900;cursor:pointer}
      .cover-recovery-tool.primary{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-recovery-list{display:grid;gap:7px;padding:12px 16px 16px;overflow:auto}
      .cover-recovery-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid #dbe5ee;border-radius:10px;background:#fff}
      .cover-recovery-item-title{font-size:10px;font-weight:900;color:#172033;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .cover-recovery-item-meta{margin-top:4px;font-size:8px;line-height:1.45;color:#64748b}
      .cover-recovery-actions{display:flex;gap:5px}.cover-recovery-actions button{border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#475569;padding:7px 8px;font-size:8px;font-weight:900;cursor:pointer}.cover-recovery-actions button.primary{border-color:#67c7d8;background:#ecfeff;color:#0e7490}
      .cover-recovery-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:10px;background:#f8fafc;text-align:center;font-size:9px;line-height:1.5;color:#64748b}
      @media(max-width:520px){.cover-recovery-dialog{padding:8px;align-items:end}.cover-recovery-panel{max-height:calc(100vh - 16px);border-radius:16px 16px 0 0}.cover-recovery-tools{grid-template-columns:1fr}.cover-recovery-item{grid-template-columns:1fr}.cover-recovery-actions{justify-content:flex-end}}
    `;
    document.head.appendChild(style);
  }

  function ensureRecoveryDialog() {
    let dialog = byId('coverRecoveryDialog');
    if (dialog) return dialog;
    dialog = document.createElement('div');
    dialog.id = 'coverRecoveryDialog';
    dialog.className = 'cover-recovery-dialog';
    dialog.hidden = true;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'coverRecoveryTitle');
    dialog.innerHTML = `
      <section class="cover-recovery-panel" tabindex="-1">
        <header class="cover-recovery-head"><div><h2 class="cover-recovery-title" id="coverRecoveryTitle">최근 작업 복구</h2><p class="cover-recovery-note">규격·문구·전체 배치·글자 레이어·이미지 효과와 원본 앞·뒤표지 이미지를 이 브라우저에 보관합니다.</p></div><button type="button" class="cover-recovery-close" id="coverRecoveryClose" aria-label="최근 작업 복구 닫기">×</button></header>
        <div class="cover-recovery-tools"><button type="button" class="cover-recovery-tool primary" id="coverRecoverySaveNow">현재 상태를 복구 지점으로 저장</button><button type="button" class="cover-recovery-tool" id="coverRecoveryClearAll">복구본 모두 삭제</button></div>
        <div class="cover-recovery-list" id="coverRecoveryList"></div>
      </section>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) closeRecoveryDialog(); });
    byId('coverRecoveryClose')?.addEventListener('click', closeRecoveryDialog);
    byId('coverRecoverySaveNow')?.addEventListener('click', saveManualCheckpoint);
    byId('coverRecoveryClearAll')?.addEventListener('click', clearAllRecovery);
    return dialog;
  }

  async function renderRecoveryList() {
    const list = byId('coverRecoveryList');
    if (!list) return;
    const records = (await getAllRecords(CHECKPOINT_STORE))
      .sort((left, right) => Number(right.savedAt || 0) - Number(left.savedAt || 0));
    list.replaceChildren();
    if (!records.length) {
      const empty = document.createElement('div');
      empty.className = 'cover-recovery-empty';
      empty.textContent = '아직 저장된 복구본이 없습니다. 작업을 수정하면 자동으로 저장됩니다.';
      list.appendChild(empty);
      return;
    }
    for (const record of records) {
      const summary = recordSummary(record);
      const row = document.createElement('article');
      row.className = 'cover-recovery-item';
      const text = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'cover-recovery-item-title';
      title.textContent = summary.title;
      const meta = document.createElement('div');
      meta.className = 'cover-recovery-item-meta';
      meta.textContent = `${summary.kind} · ${summary.timeLabel} · 원본 이미지 ${summary.images}개 포함`;
      text.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'cover-recovery-actions';
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'primary';
      restore.textContent = '복원';
      restore.addEventListener('click', () => restoreCheckpoint(record.id, restore));
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '삭제';
      remove.addEventListener('click', () => removeCheckpoint(record.id));
      actions.append(restore, remove);
      row.append(text, actions);
      list.appendChild(row);
    }
  }

  async function openRecoveryDialog() {
    installStyles();
    const dialog = ensureRecoveryDialog();
    dialog.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    await renderRecoveryList().catch((error) => setRecoveryStatus(error.message, 'error'));
    dialog.querySelector('.cover-recovery-panel')?.focus();
  }

  function closeRecoveryDialog() {
    const dialog = byId('coverRecoveryDialog');
    if (!dialog || dialog.hidden) return;
    dialog.hidden = true;
    document.documentElement.style.removeProperty('overflow');
    byId('coverRecoveryOpen')?.focus();
  }

  async function saveManualCheckpoint() {
    const button = byId('coverRecoverySaveNow');
    if (button) button.disabled = true;
    try {
      const saved = await queueSave({ manual: true, force: true });
      if (saved) setRecoveryStatus('현재 상태를 복구 지점으로 저장했습니다.', 'saved');
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function loadAssetImage(reference) {
    if (!reference?.assetId) return { image: null, missing: false };
    const asset = await getRecord(ASSET_STORE, reference.assetId);
    if (!asset?.source) return { image: null, missing: true };
    return new Promise((resolve) => {
      const image = new Image();
      if (/^https?:\/\//i.test(asset.source)) image.crossOrigin = 'anonymous';
      image.onload = () => resolve({ image, missing: false });
      image.onerror = () => resolve({ image: null, missing: true });
      image.src = asset.source;
    });
  }

  function fire(element) {
    if (!element) return;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function applyFields(fields) {
    for (const [id, value] of Object.entries(plainObject(fields) ? fields : {})) {
      const element = byId(id);
      if (!element) continue;
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = value ?? '';
      fire(element);
    }
  }

  function applyLayout(layout) {
    try {
      if (typeof state === 'undefined' || !state.layout || !plainObject(layout)) return;
      for (const key of Object.keys(state.layout)) delete state.layout[key];
      Object.assign(state.layout, clone(layout));
    } catch (_) {}
  }

  function applyImage(side, loaded, reference) {
    const key = side === 'front' ? 'frontImage' : 'backImage';
    const box = byId(side === 'front' ? 'frontUploadBox' : 'backUploadBox');
    const name = byId(side === 'front' ? 'frontName' : 'backName');
    try { if (typeof state !== 'undefined') state[key] = loaded.image; }
    catch (_) {}
    box?.classList.toggle('has-file', Boolean(loaded.image));
    if (name) name.textContent = loaded.image
      ? String(reference?.name || (side === 'front' ? '복구한 앞표지 이미지' : '복구한 뒤표지 이미지'))
      : (side === 'front' ? '앞표지 이미지' : '뒤표지 이미지');
  }

  async function restoreCheckpoint(id, button) {
    const record = await getRecord(CHECKPOINT_STORE, id);
    if (!record?.snapshot) return;
    if (!window.confirm(`“${record.title || '표지 작업'}” 상태로 복원할까요? 현재 작업은 최근 자동 저장에 남습니다.`)) return;
    if (button) button.disabled = true;
    activeRestore = true;
    clearTimeout(saveTimer);
    try {
      await queueSave({ force: true });
      const [front, back] = await Promise.all([
        loadAssetImage(record.snapshot.images?.front),
        loadAssetImage(record.snapshot.images?.back),
      ]);
      applyFields(record.snapshot.fields);
      applyLayout(record.snapshot.layout);
      try { window.CoverProjectStateBridge?.restore?.(clone(record.snapshot.extended)); }
      catch (_) {}
      applyImage('front', front, record.snapshot.images?.front);
      applyImage('back', back, record.snapshot.images?.back);
      try {
        if (typeof state !== 'undefined') state.showGuides = record.snapshot.showGuides !== false;
        window.syncControls?.();
        window.updateCalculation?.();
        window.requestRender?.();
      } catch (_) {}
      activeRestore = false;
      dirty = true;
      lastSignature = '';
      await queueSave({ force: true });
      await renderRecoveryList();
      closeRecoveryDialog();
      const missing = front.missing || back.missing;
      setRecoveryStatus(missing ? '작업을 복원했지만 일부 원본 이미지를 불러오지 못했습니다.' : '선택한 작업을 복원했습니다.', missing ? 'error' : 'saved');
      document.dispatchEvent(new CustomEvent('cover-recovery-restored', { detail: { id, missingImages: missing } }));
    } catch (error) {
      setRecoveryStatus(error?.message || '작업을 복원하지 못했습니다.', 'error');
    } finally {
      activeRestore = false;
      if (button) button.disabled = false;
    }
  }

  async function removeCheckpoint(id) {
    if (!window.confirm('이 복구본을 삭제할까요?')) return;
    await deleteRecord(CHECKPOINT_STORE, id);
    await cleanupUnusedAssets();
    await updateRecoveryBar();
    await renderRecoveryList();
  }

  async function clearAllRecovery() {
    if (!window.confirm('저장된 자동 복구본과 원본 이미지 사본을 모두 삭제할까요? 현재 화면의 작업은 유지됩니다.')) return;
    await clearStore(CHECKPOINT_STORE);
    await clearStore(ASSET_STORE);
    lastSignature = '';
    lastRollingAt = 0;
    await updateRecoveryBar();
    await renderRecoveryList();
    setRecoveryStatus('저장된 복구본을 모두 삭제했습니다.', 'normal');
  }

  function relevantEvent(event) {
    const target = event.target;
    if (!target) return false;
    if (target.closest?.('#coverRecoveryDialog')) return false;
    if (target.closest?.('.settings')) return true;
    return target.id === 'previewCanvas';
  }

  function bindChanges() {
    document.addEventListener('input', (event) => { if (relevantEvent(event)) scheduleSave(); }, true);
    document.addEventListener('change', (event) => { if (relevantEvent(event)) scheduleSave(); }, true);
    for (const name of ['cover-image-effects-change', 'cover-layout-lock-change', 'cover-spine-selected']) {
      document.addEventListener(name, scheduleSave);
    }
    const canvas = byId('previewCanvas');
    canvas?.addEventListener('pointerup', scheduleSave, true);
    canvas?.addEventListener('wheel', scheduleSave, { capture: true, passive: true });
    canvas?.addEventListener('dblclick', scheduleSave, true);
    window.addEventListener('beforeunload', () => {
      if (dirty) queueSave({ force: true });
    });
  }

  function handleKeydown(event) {
    const dialog = byId('coverRecoveryDialog');
    if (!dialog || dialog.hidden || event.key !== 'Escape') return;
    event.preventDefault();
    closeRecoveryDialog();
  }

  async function initializeStorage() {
    await openDatabase();
    const records = await getAllRecords(CHECKPOINT_STORE);
    lastRollingAt = rollingRecords(records)[0]?.savedAt || 0;
    lastSignature = records.find((record) => record.id === WORKING_ID)?.snapshot
      ? snapshotSignature(records.find((record) => record.id === WORKING_ID).snapshot)
      : '';
    await updateRecoveryBar();
  }

  function install() {
    installStyles();
    ensureRecoveryBar();
    ensureRecoveryDialog();
    if (installed || !byId('coverRecoveryBar')) return;
    installed = true;
    bindChanges();
    document.addEventListener('keydown', handleKeydown, true);
    initializeStorage()
      .then(() => setTimeout(() => queueSave({ force: false }), 2200))
      .catch((error) => {
        setRecoveryStatus(error?.message || '최근 작업 복구를 사용할 수 없습니다.', 'error');
        const button = byId('coverRecoveryOpen');
        if (button) button.disabled = true;
      });
  }

  window.CoverRecoveryCheckpoints = {
    sourceFingerprint,
    assetIdentity,
    recoverableImageSource,
    trimRollingRecords,
    checkpointRecord,
    recordSummary,
    formatSavedAt,
    queueSave,
    openRecoveryDialog,
    restoreCheckpoint,
    clearAllRecovery,
    stage: 'indexeddb-image-inclusive-recovery',
  };

  for (const delay of INSTALL_DELAYS) setTimeout(install, delay);
})();
