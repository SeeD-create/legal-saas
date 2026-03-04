// ===== 認証モジュール =====
const Auth = {
  user: null,
  token: null,

  init() {
    this.token = localStorage.getItem('auth_token');
    const saved = localStorage.getItem('auth_user');
    if (saved) {
      try { this.user = JSON.parse(saved); } catch(e) { this.user = null; }
    }

    // Bind auth form events
    document.getElementById('auth-loginForm').addEventListener('submit', e => { e.preventDefault(); this.login(); });
    document.getElementById('auth-signupForm').addEventListener('submit', e => { e.preventDefault(); this.signup(); });
    document.getElementById('auth-showSignup').addEventListener('click', e => { e.preventDefault(); this.showForm('signup'); });
    document.getElementById('auth-showLogin').addEventListener('click', e => { e.preventDefault(); this.showForm('login'); });
    document.getElementById('sidebar-logout').addEventListener('click', e => { e.preventDefault(); this.logout(); });

    // Check session
    if (this.token) {
      this.verify();
    } else {
      this.showAuth();
    }
  },

  showForm(type) {
    document.getElementById('auth-loginBox').style.display = type === 'login' ? '' : 'none';
    document.getElementById('auth-signupBox').style.display = type === 'signup' ? '' : 'none';
  },

  showAuth() {
    document.getElementById('auth-page').style.display = 'flex';
    document.getElementById('app-main').style.display = 'none';
    this.showForm('login');
  },

  showApp() {
    document.getElementById('auth-page').style.display = 'none';
    document.getElementById('app-main').style.display = '';
    document.getElementById('sidebar-userEmail').textContent = this.user?.email || '';
    document.getElementById('sidebar-userPlan').textContent = this.getPlanLabel(this.user?.plan);
    Router.init();
  },

  getPlanLabel(plan) {
    const labels = { free: '無料プラン', light: 'ライト', standard: 'スタンダード', pro: 'プロ' };
    return labels[plan] || '無料プラン';
  },

  async verify() {
    try {
      const resp = await fetch(WORKER_URL + '/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + this.token }
      });
      if (resp.ok) {
        const data = await resp.json();
        this.user = data.user;
        localStorage.setItem('auth_user', JSON.stringify(this.user));
        this.showApp();
      } else {
        this.clearSession();
        this.showAuth();
      }
    } catch (e) {
      // Network error - use cached user if available
      if (this.user) {
        this.showApp();
      } else {
        this.showAuth();
      }
    }
  },

  async login() {
    const email = document.getElementById('auth-loginEmail').value.trim();
    const password = document.getElementById('auth-loginPassword').value;
    const errEl = document.getElementById('auth-loginError');
    const btn = document.getElementById('auth-loginBtn');
    errEl.style.display = 'none';

    if (!email || !password) { errEl.textContent = 'メールアドレスとパスワードを入力してください'; errEl.style.display = ''; return; }

    btn.disabled = true; btn.textContent = 'ログイン中...';
    try {
      const resp = await fetch(WORKER_URL + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await resp.json();
      if (!resp.ok) { errEl.textContent = data.error; errEl.style.display = ''; return; }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('auth_token', this.token);
      localStorage.setItem('auth_user', JSON.stringify(this.user));
      this.showApp();
    } catch (e) {
      errEl.textContent = '通信エラーが発生しました'; errEl.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = 'ログイン';
    }
  },

  async signup() {
    const name = document.getElementById('auth-signupName').value.trim();
    const email = document.getElementById('auth-signupEmail').value.trim();
    const password = document.getElementById('auth-signupPassword').value;
    const errEl = document.getElementById('auth-signupError');
    const btn = document.getElementById('auth-signupBtn');
    errEl.style.display = 'none';

    if (!email || !password) { errEl.textContent = 'メールアドレスとパスワードを入力してください'; errEl.style.display = ''; return; }
    if (password.length < 8) { errEl.textContent = 'パスワードは8文字以上で入力してください'; errEl.style.display = ''; return; }

    btn.disabled = true; btn.textContent = '登録中...';
    try {
      const resp = await fetch(WORKER_URL + '/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const data = await resp.json();
      if (!resp.ok) { errEl.textContent = data.error; errEl.style.display = ''; return; }

      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('auth_token', this.token);
      localStorage.setItem('auth_user', JSON.stringify(this.user));
      this.showApp();
    } catch (e) {
      errEl.textContent = '通信エラーが発生しました'; errEl.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = '新規登録';
    }
  },

  async logout() {
    try {
      await fetch(WORKER_URL + '/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + this.token }
      });
    } catch (e) {}
    this.clearSession();
    this.showAuth();
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  },

  getToken() {
    return this.token;
  }
};
