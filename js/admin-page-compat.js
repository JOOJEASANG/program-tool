// Restores the administrator console on Hosting preview channels where the
// matching Cloud Functions have not been deployed yet.
(function () {
  if (window.__programToolAdminPageCompatV2) return;
  window.__programToolAdminPageCompatV2 = true;

  const originalFetch = window.fetch.bind(window);
  const PROGRAM_IDS = ['pdf-editor', 'preflight', 'perfect-binding-cover'];
  const DEFAULT_PUBLIC = {
    'pdf-editor': true,
    preflight: true,
    'perfect-binding-cover': true,
  };
  const normalizeEmail = value => String(value || '').trim().toLowerCase();

  function shouldFallback(response) {
    return response.status === 404 || response.status === 405 || response.status >= 500;
  }

  function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  async function currentAdmin() {
    const user = auth.currentUser;
    if (!user) throw new Error('로그인이 필요합니다.');
    const snap = await db.collection('settings').doc('admin').get();
    const emails = snap.exists ? (snap.data().emails || []).map(normalizeEmail).filter(Boolean) : [];
    if (!emails.includes(normalizeEmail(user.email))) throw new Error('관리자 권한이 필요합니다.');
    return { user, emails };
  }

  function timestampValue(value) {
    if (!value) return null;
    return typeof value.toDate === 'function' ? value.toDate().toISOString() : value;
  }

  async function legacyAdminRequest(path, options = {}) {
    const { user, emails: currentEmails } = await currentAdmin();
    const url = new URL(path, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : {};
    const adminRef = db.collection('settings').doc('admin');
    const programsRef = db.collection('settings').doc('programs');

    if (url.pathname === '/api/admin/me' && method === 'GET') {
      return { isAdmin: true, currentEmail: normalizeEmail(user.email), compatibilityMode: true };
    }

    if (url.pathname === '/api/admin/admins') {
      let emails = [...currentEmails];
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
      const saved = snap.exists && snap.data().public && typeof snap.data().public === 'object'
        ? snap.data().public
        : {};
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
      const incoming = body.programs || {};
      const programs = {};
      PROGRAM_IDS.forEach(id => {
        if (Object.prototype.hasOwnProperty.call(incoming, id)) programs[id] = incoming[id] === true;
      });
      if (!Object.keys(programs).length) throw new Error('변경할 권한이 없습니다.');
      await db.collection('user_permissions').doc(uid).set({ programs }, { merge: true });
      return { ok: true, compatibilityMode: true };
    }

    throw new Error('이 관리자 기능은 Functions 배포 후 사용할 수 있습니다.');
  }

  window.fetch = async function adminPreviewFetch(input, options = {}) {
    const rawUrl = typeof input === 'string' ? input : input?.url || '';
    const url = new URL(rawUrl, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/admin/')) {
      return originalFetch(input, options);
    }

    try {
      const response = await originalFetch(input, options);
      if (!shouldFallback(response)) return response;
    } catch (_) {}

    try {
      return jsonResponse(await legacyAdminRequest(url.pathname + url.search, options));
    } catch (error) {
      const status = /로그인/.test(error.message || '') ? 401 : 403;
      return jsonResponse({ detail: error.message || '관리자 기능을 사용할 수 없습니다.' }, status);
    }
  };

  async function recover() {
    try {
      for (let i = 0; i < 100; i += 1) {
        if (auth.currentUser && typeof window.loadAdminData === 'function') break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      const { user } = await currentAdmin();
      document.getElementById('authLoading')?.style.setProperty('display', 'none');
      document.getElementById('noAccess')?.classList.add('hidden');
      document.getElementById('adminContent')?.classList.remove('hidden');
      const email = document.getElementById('diagEmail');
      if (email) email.textContent = normalizeEmail(user.email) || '-';
      await Promise.allSettled([window.loadAdminData?.(), window.checkHealth?.()]);
    } catch (error) {
      console.warn('[admin-page-compat] recovery failed', error);
    }
  }

  recover();
  setTimeout(recover, 1200);
})();