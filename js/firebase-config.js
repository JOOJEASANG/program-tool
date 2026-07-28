const firebaseConfig = {
  apiKey: "AIzaSyAfbBsZVWfUXyDxP-FrNdnO4r71dnmAd1U",
  authDomain: "program-tool.firebaseapp.com",
  projectId: "program-tool",
  storageBucket: "program-tool.firebasestorage.app",
  messagingSenderId: "660190959615",
  appId: "1:660190959615:web:86959be41774132c84b9ca",
  measurementId: "G-1Y1FC82J4X"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
const googleProvider = auth ? new firebase.auth.GoogleAuthProvider() : null;
const authPersistenceReady = auth
  ? auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
      console.warn('Firebase auth persistence could not be initialized.', error);
    })
  : Promise.resolve();
const db = firebase.firestore();

window.auth = auth;
window.authPersistenceReady = authPersistenceReady;
window.db = db;
window.googleProvider = googleProvider;
window.firebaseConfig = firebaseConfig;

(() => {
  if (document.getElementById('programStudioCacheBootstrap')) return;
  const script = document.createElement('script');
  script.id = 'programStudioCacheBootstrap';
  script.src = '/js/sw-register.js?v=2026.07.29.005';
  script.defer = true;
  document.head.appendChild(script);
})();

window.ProgramAccess = {
  _cache: new Map(),
  _cacheTtlMs: 30000,

  normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  },

  _cacheGet(key) {
    const item = this._cache.get(key);
    if (!item || Date.now() - item.time > this._cacheTtlMs) {
      this._cache.delete(key);
      return undefined;
    }
    return item.value;
  },

  _cacheSet(key, value) {
    this._cache.set(key, { value, time: Date.now() });
    return value;
  },

  clearCache(user) {
    const uid = typeof user === 'string' ? user : user?.uid;
    if (!uid) {
      this._cache.clear();
      return;
    }
    for (const key of this._cache.keys()) {
      if (key.includes(`:${uid}`)) this._cache.delete(key);
    }
  },

  async isAdmin(user) {
    if (!user) return false;
    const cacheKey = `admin:${user.uid}`;
    const cached = this._cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    try {
      const tokenResult = await user.getIdTokenResult(false);
      if (tokenResult?.claims?.admin === true) {
        return this._cacheSet(cacheKey, true);
      }
    } catch (error) {
      console.warn('Admin claim could not be read.', error);
    }

    const email = this.normalizeEmail(user.email);
    if (!email) return this._cacheSet(cacheKey, false);

    // Temporary migration fallback. Remove after every administrator has admin=true.
    try {
      const snapshot = await db.collection('settings').doc('admin').get();
      const emails = snapshot.exists && Array.isArray(snapshot.data().emails)
        ? snapshot.data().emails
        : [];
      return this._cacheSet(
        cacheKey,
        emails.map(value => this.normalizeEmail(value)).includes(email)
      );
    } catch (_) {
      return this._cacheSet(cacheKey, false);
    }
  },

  async ensureUserDocument(user) {
    if (!user) return null;
    const reference = db.collection('user_permissions').doc(user.uid);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      const data = {
        uid: user.uid,
        email: this.normalizeEmail(user.email),
        displayName: user.displayName || '',
        status: 'pending',
        plan: 'free',
        programs: {
          'pdf-editor': false,
          preflight: false,
          'design-studio': false
        },
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await reference.set(data);
      return data;
    }
    return snapshot.data();
  },

  async getPublicPrograms() {
    const cached = this._cacheGet('public-programs');
    if (cached !== undefined) return cached;
    const snapshot = await db.collection('settings').doc('programs').get().catch(() => null);
    const data = snapshot && snapshot.exists ? snapshot.data() : {};
    const publicPrograms = data && typeof data.public === 'object' && data.public
      ? data.public
      : {};
    return this._cacheSet('public-programs', publicPrograms);
  },

  async getAccess(user) {
    if (!user) {
      return {
        loggedIn: false,
        admin: false,
        approved: false,
        status: 'signed_out',
        profile: null
      };
    }

    const cacheKey = `access:${user.uid}`;
    const cached = this._cacheGet(cacheKey);
    if (cached !== undefined) return cached;

    const adminPromise = this.isAdmin(user).catch(() => false);
    const profilePromise = (async () => {
      try {
        return await this.ensureUserDocument(user);
      } catch (error) {
        console.warn('User profile could not be loaded or created.', error);
        try {
          const snapshot = await db.collection('user_permissions').doc(user.uid).get();
          return snapshot.exists ? snapshot.data() : null;
        } catch (_) {
          return null;
        }
      }
    })();

    const [admin, profile] = await Promise.all([adminPromise, profilePromise]);
    const status = admin ? 'approved' : String(profile?.status || 'pending');
    return this._cacheSet(cacheKey, {
      loggedIn: true,
      admin,
      approved: admin || status === 'approved',
      status,
      profile
    });
  },

  async canUseProgram(user, programId) {
    if (!user || !programId) {
      return {
        allowed: false,
        status: 'signed_out',
        admin: false,
        public: false,
        profile: null
      };
    }

    const [access, publicPrograms] = await Promise.all([
      this.getAccess(user),
      this.getPublicPrograms()
    ]);
    const publicAccess = publicPrograms?.[programId] === true;
    const assigned = access.status === 'approved';
    return {
      ...access,
      allowed: access.admin || publicAccess || assigned,
      public: publicAccess,
      assigned,
      programId
    };
  },

  async routeAfterLogin(user, options = {}) {
    if (!user) return false;
    const adminUrl = options.adminUrl || '/admin.html';
    const homeUrl = options.homeUrl || '/index.html';
    const admin = await this.isAdmin(user);
    window.location.replace(admin ? adminUrl : homeUrl);
    return true;
  },

  programForPath(pathname) {
    const path = String(pathname || '').replace(/\\/g, '/').replace(/\/+$/, '');
    if (['/tools/pdf-editor.html', '/pdf-editor', '/pdf-editor/index.html'].some(item => path.endsWith(item))) {
      return 'pdf-editor';
    }
    if (['/tools/preflight.html', '/tools/pdf-Checker.html', '/pdf-preflight', '/pdf-preflight/index.html'].some(item => path.endsWith(item))) {
      return 'preflight';
    }
    if (['/tools/perfect-binding-cover.html', '/perfect-binding-cover', '/perfect-binding-cover/index.html'].some(item => path.endsWith(item))) {
      return 'design-studio';
    }
    return '';
  },

  async guardTool(options = {}) {
    const loginUrl = options.loginUrl || '../login.html';
    const waitingUrl = options.waitingUrl || '../approval-waiting.html';
    const programId = options.programId || this.programForPath(location.pathname);
    const timeoutMs = Math.max(3000, Number(options.timeoutMs) || 8000);

    if (!auth) {
      document.documentElement.style.visibility = '';
      location.replace(loginUrl);
      return null;
    }

    return new Promise(resolve => {
      let settled = false;
      let unsubscribe = () => {};
      const root = document.documentElement;

      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { unsubscribe(); } catch (_) {}
        root.style.visibility = '';
        delete root.dataset.accessChecking;
        resolve(value);
      };

      const redirect = url => {
        finish(null);
        location.replace(url);
      };

      const timer = setTimeout(() => {
        console.warn('Program access check timed out.');
        redirect(`${waitingUrl}?status=timeout&program=${encodeURIComponent(programId || '')}`);
      }, timeoutMs);

      unsubscribe = auth.onAuthStateChanged(async user => {
        if (settled) return;
        if (!user) {
          redirect(loginUrl);
          return;
        }
        try {
          this.clearCache(user);
          const access = programId
            ? await this.canUseProgram(user, programId)
            : await this.getAccess(user);
          if (settled) return;
          const allowed = programId ? access.allowed : access.approved;
          if (!allowed) {
            const status = access.status === 'approved'
              ? 'forbidden'
              : (access.status || 'pending');
            redirect(`${waitingUrl}?status=${encodeURIComponent(status)}&program=${encodeURIComponent(programId || '')}`);
            return;
          }
          root.dataset.accessReady = 'true';
          root.dataset.programAccess = programId || 'approved';
          finish(access);
        } catch (error) {
          console.error(error);
          redirect(`${waitingUrl}?status=error&program=${encodeURIComponent(programId || '')}`);
        }
      }, error => {
        console.error('Authentication state could not be read.', error);
        redirect(`${waitingUrl}?status=error&program=${encodeURIComponent(programId || '')}`);
      });
    });
  }
};

(() => {
  const programId = ProgramAccess.programForPath(location.pathname);
  if (auth && programId) {
    const root = document.documentElement;
    root.style.visibility = 'hidden';
    root.dataset.accessChecking = 'true';
    const watchdog = setTimeout(() => {
      root.style.visibility = '';
      root.dataset.accessWatchdog = 'released';
    }, 8500);
    ProgramAccess.guardTool({ programId, timeoutMs: 8000 }).finally(() => {
      clearTimeout(watchdog);
      root.style.visibility = '';
      delete root.dataset.accessChecking;
    });
  }
})();

window.addEventListener('DOMContentLoaded', async () => {
  const year = new Date().getFullYear();
  document.querySelectorAll('[data-current-year],#copyrightYear').forEach(element => {
    element.textContent = year;
  });

  const footer = document.querySelector('footer');
  if (!footer) return;

  footer.querySelectorAll('span').forEach(element => {
    if (/©\s*\d{4}/.test(element.textContent || '')) {
      element.textContent = element.textContent.replace(/©\s*\d{4}/g, `© ${year}`);
    }
  });

  const shell = footer.querySelector('.footer-inner') || footer;
  const hasLegalUi = Boolean(footer.querySelector('.footer-links,.footer-legal,[data-legal]'));
  if (!hasLegalUi) {
    const style = document.createElement('style');
    style.textContent = '.footer-legal{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.footer-legal a{color:inherit;text-decoration:none}.footer-business-name{font-size:10px;line-height:1.5;opacity:.72}@media(max-width:650px){.footer-legal{margin-top:12px}}';
    document.head.appendChild(style);
    const legal = document.createElement('div');
    legal.className = 'footer-legal';
    legal.innerHTML = '<a href="/guide.html">이용안내</a><a href="/terms.html">이용약관</a><a href="/privacy.html">개인정보처리방침</a>';
    shell.appendChild(legal);
  }

  if (!footer.querySelector('.footer-business-name')) {
    try {
      let snapshot = await db.collection('settings').doc('business').get().catch(() => null);
      if (!snapshot || !snapshot.exists) {
        snapshot = await db.collection('site_settings').doc('business').get().catch(() => null);
      }
      const business = snapshot && snapshot.exists ? snapshot.data() : {};
      const name = String(business.bizName || '').trim();
      if (name) {
        const info = document.createElement('span');
        info.className = 'footer-business-name';
        info.textContent = name;
        const copyright = [...footer.querySelectorAll('span')]
          .find(element => (element.textContent || '').includes('©'));
        if (copyright) copyright.insertAdjacentElement('afterend', info);
        else shell.appendChild(info);
      }
    } catch (_) {}
  }
});
