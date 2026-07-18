// Compatibility layer for staged Hosting/Functions deployments.
// New server endpoints are preferred. When Hosting is previewed before Functions
// are deployed, the client temporarily falls back to the existing Firestore model.
(function () {
  if (window.ProgramToolCompat) return;

  const PROGRAM_IDS = ['pdf-editor', 'preflight', 'perfect-binding-cover'];
  const DEFAULT_PUBLIC = {
    'pdf-editor': true,
    preflight: true,
    'perfect-binding-cover': true,
  };

  const normalizeEmail = value => String(value || '').trim().toLowerCase();
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitForFirebase() {
    for (let i = 0; i < 80; i += 1) {
      if (window.auth && window.db) return;
      await sleep(50);
    }
    throw new Error('Firebase 초기화가 완료되지 않았습니다.');
  }

  async function currentUser() {
    await waitForFirebase();
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    return user;
  }

  async function legacyAdminEmails() {
    await waitForFirebase();
    const snap = await db.collection('settings').doc('admin').get();
    if (!snap.exists) return [];
    return (snap.data().emails || []).map(normalizeEmail).filter(Boolean);
  }

  async function legacyIsAdmin(user) {
    const emails = await legacyAdminEmails();
    return emails.includes(normalizeEmail(user && user.email));
  }

  function shouldUseLegacy(response) {
    return response.status === 404 || response.status === 405 || response.status >= 500;
  }

  async function serverJson(path, options = {}) {
    const user = await currentUser();
    const token = await user.getIdToken();
    const headers = { Authorization: 'Bearer ' + token, ...(options.headers || {}) };
    if (options.body != null && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const response = await fetch(path, { cache: 'no-store', ...options, headers });
    const data = await response.json().catch(() => ({}));
    return { response, data, user };
  }

  async function adminStatus() {
    const result = await serverJson('/api/admin/me').catch(() => null);
    if (result && !shouldUseLegacy(result.response)) {
      if (!result.response.ok) throw new Error(result.data.detail || `서버 오류 (${result.response.status})`);
      return result.data;
    }
    const user = result ? result.user : await currentUser();
    return {
      isAdmin: await legacyIsAdmin(user),
      currentEmail: normalizeEmail(user.email),
      compatibilityMode: true,
    };
  }

  async function programAccess(programId) {
    if (!PROGRAM_IDS.includes(programId)) throw new Error('알 수 없는 프로그램입니다.');
    const result = await serverJson('/api/access/' + encodeURIComponent(programId)).catch(() => null);
    if (result && !shouldUseLegacy(result.response)) {
      if (!result.response.ok) throw new Error(result.data.detail || `서버 오류 (${result.response.status})`);
      return result.data;
    }

    const user = result ? result.user : await currentUser();
    let isAdmin = false;
    let isPublic = DEFAULT_PUBLIC[programId] === true;
    let isApproved = false;

    try { isAdmin = await legacyIsAdmin(user); } catch (_) {}
    try {
      const settings = await db.collection('settings').doc('programs').get();
      const publicMap = settings.exists && settings.data().public;
      if (publicMap && Object.prototype.hasOwnProperty.call(publicMap, programId)) {
        isPublic = publicMap[programId] === true;
      }
    } catch (_) {}
    try {
      const permission = await db.collection('user_permissions').doc(user.uid).get();
      isApproved = permission.exists && permission.data().programs?.[programId] === true;
    } catch (_) {}

    return {
      programId,
      allowed: Boolean(isAdmin || isPublic || isApproved),
      isAdmin,
      isPublic,
      isApproved,
      compatibilityMode: true,
    };
  }

  async function assertLegacyAdmin() {
    const user = await currentUser();
    if (!(await legacyIsAdmin(user))) throw new Error('관리자 권한이 필요합니다.');
    return user;
  }

  function timestampValue(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    return value;
  }

  async function legacyAdminRequest(path, options = {}) {
    const user = await assertLegacyAdmin();
    const url = new URL(path, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const adminRef = db.collection('settings').doc('admin');
    const programsRef = db.collection('settings').doc('programs');

    if (url.pathname === '/api/admin/me' && method === 'GET') {
      return { isAdmin: true, currentEmail: normalizeEmail(user.email), compatibilityMode: true };
    }

    if (url.pathname === '/api/admin/admins') {
      const snap = await adminRef.get();
      let emails = snap.exists ? (snap.data().emails || []).map(normalizeEmail).filter(Boolean) : [];
      if (method === 'POST') {
        const email = normalizeEmail(body.email);
        if (!email || !email.includes('@')) throw new Error('올바른 관리자 이메일을 입력하세요.');
        emails = [...new Set([...emails, email])].sort();
        await adminRef.set({ emails }, { merge: true });
      } else if (method === 'DELETE') {
        const email = normalizeEmail(body.email);
        if (email === normalizeEmail(user.email)) throw new Error('현재 로그인한 관리자는 삭제할 수 없습니다.');
        if (emails.length <= 1) throw new Error('마지막 관리자는 삭제할 수 없습니다.');
        emails = emails.filter(item => item !== email);
        await adminRef.set({ emails }, { merge: true });
      }
      return { emails, currentEmail: normalizeEmail(user.email), compatibilityMode: true };
    }

    if (url.pathname === '/api/admin/programs') {
      if (method === 'PUT') {
        const incoming = body.public || {};
        const publicMap = Object.fromEntries(PROGRAM_IDS.map(id => [id, incoming[id] === true]));
        await programsRef.set({ public: publicMap }, { merge: true });
        return { public: publicMap, compatibilityMode: true };
      }
      const snap = await programsRef.get();
      const saved = snap.exists && snap.data().public && typeof snap.data().public === 'object' ? snap.data().public : {};
      return { public: { ...DEFAULT_PUBLIC, ...saved }, compatibilityMode: true };
    }

    if (url.pathname === '/api/admin/users' && method === 'GET') {
      const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200));
      const snap = await db.collection('user_permissions').limit(limit).get();
      const users = snap.docs.map(doc => {
        const data = doc.data() || {};
        return {
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || '',
          programs: data.programs || {},
          createdAt: timestampValue(data.createdAt),
        };
      });
      const programSnap = await programsRef.get();
      const saved = programSnap.exists && programSnap.data().public ? programSnap.data().public : {};
      return { users, public: { ...DEFAULT_PUBLIC, ...saved }, compatibilityMode: true };
    }

    const userMatch = url.pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userMatch && method === 'PUT') {
      const uid = decodeURIComponent(userMatch[1]);
      const programs = body.programs || {};
      const updates = {};
      PROGRAM_IDS.forEach(id => {
        if (Object.prototype.hasOwnProperty.call(programs, id)) updates['programs.' + id] = programs[id] === true;
      });
      if (!Object.keys(updates).length) throw new Error('변경할 권한이 없습니다.');
      await db.collection('user_permissions').doc(uid).set(updates, { merge: true });
      return { ok: true, compatibilityMode: true };
    }

    throw new Error('이 관리자 기능은 Functions 배포 후 사용할 수 있습니다.');
  }

  async function adminRequest(path, options = {}) {
    const result = await serverJson(path, options).catch(() => null);
    if (result && !shouldUseLegacy(result.response)) {
      if (!result.response.ok) throw new Error(result.data.detail || `서버 오류 (${result.response.status})`);
      return result.data;
    }
    return legacyAdminRequest(path, options);
  }

  window.ProgramToolCompat = {
    adminStatus,
    programAccess,
    adminRequest,
    legacyIsAdmin,
  };
})();