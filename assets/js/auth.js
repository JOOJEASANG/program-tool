/**
 * WebApp Studio - 공통 인증 모듈 (localStorage 기반 테스트용)
 * 실제 서비스 시 Firebase Auth / 서버 인증으로 교체
 */
const Auth = {
    USERS_KEY: 'was_platform_users',
    SESSION_KEY: 'was_platform_session',

    // ── 사용자 목록 ──
    getUsers() {
        try { return JSON.parse(localStorage.getItem(this.USERS_KEY) || '[]'); }
        catch { return []; }
    },
    saveUsers(users) {
        localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
    },

    // ── 세션 ──
    getSession() {
        try { return JSON.parse(localStorage.getItem(this.SESSION_KEY) || 'null'); }
        catch { return null; }
    },
    saveSession(session) {
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    },
    isLoggedIn() {
        const s = this.getSession();
        return !!(s && s.loggedIn);
    },

    // ── 회원가입 ──
    register(name, email, password) {
        const users = this.getUsers();
        if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
            return { success: false, message: '이미 사용 중인 이메일입니다.' };
        }
        const now = new Date();
        const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const user = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            name: name.trim(),
            email: email.toLowerCase().trim(),
            password,          // ※ 실서비스에서는 절대 평문 저장 금지
            createdAt: now.toISOString(),
            trialExpiry: trialEnd.toISOString(),
            // 테스트: 가입 즉시 전 프로그램 체험 권한 부여
            purchasedPrograms: ['all'],
            role: 'user'
        };
        users.push(user);
        this.saveUsers(users);
        const session = { userId: user.id, name: user.name, email: user.email, loggedIn: true, role: 'user' };
        this.saveSession(session);
        return { success: true, user };
    },

    // ── 로그인 ──
    login(email, password) {
        const users = this.getUsers();
        const user = users.find(u =>
            u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
        );
        if (!user) return { success: false, message: '이메일 또는 비밀번호가 올바르지 않습니다.' };
        if (user.remainingUses == null) user.remainingUses = 1000;
        const session = { userId: user.id, name: user.name, email: user.email, loggedIn: true, role: user.role || 'user' };
        this.saveSession(session);
        this.saveUsers(users);
        return { success: true, user };
    },

    // ── 무료 사용 횟수 관리 ──
    consumeUses(count = 1) {
        const session = this.getSession();
        if (!session) return false;
        const users = this.getUsers();
        const user = users.find(u => u.id === session.userId);
        if (!user) return false;
        if (user.remainingUses == null) user.remainingUses = 1000;
        if (user.remainingUses < count) return false;
        user.remainingUses -= count;
        this.saveUsers(users);
        return true;
    },

    getRemainingUses() {
        const users = this.getUsers();
        const session = this.getSession();
        if (!session) return 0;
        const user = users.find(u => u.id === session.userId);
        if (!user) return 0;
        if (user.remainingUses == null) {
            user.remainingUses = 1000;
            this.saveUsers(users);
        }
        return user.remainingUses;
    },

    // ── 로그아웃 ──
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    // ── 현재 사용자 정보 ──
    getCurrentUser() {
        const session = this.getSession();
        if (!session) return null;
        const users = this.getUsers();
        return users.find(u => u.id === session.userId) || null;
    },

    // ── 인증 필요 페이지 보호 ──
    requireAuth(redirectTo = '../index.html') {
        if (!this.isLoggedIn()) {
            // 현재 URL을 returnUrl로 저장
            sessionStorage.setItem('was_return_url', window.location.href);
            window.location.href = redirectTo;
            return false;
        }
        return true;
    },

    // ── 프로그램 접근 권한 확인 ──
    hasAccess(programId) {
        const user = this.getCurrentUser();
        if (!user) return false;
        return user.purchasedPrograms.includes('all') || user.purchasedPrograms.includes(programId);
    }
};
