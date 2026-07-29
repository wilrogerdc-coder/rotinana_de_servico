const Auth = {
  SESSION_KEY: 'sgpo_session',

  get currentUser() {
    const session = sessionStorage.getItem(this.SESSION_KEY);
    return session ? JSON.parse(session) : null;
  },

  get user() {
    return this.currentUser;
  },

  set user(userData) {
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(userData));
  },

  get isLoggedIn() {
    return !!this.currentUser;
  },

  get userRole() {
    return this.currentUser?.perfil || 'operador';
  },

  get userName() {
    return this.currentUser?.nome || '';
  },

  get userId() {
    return this.currentUser?.id || '';
  },

  get nivelPermissao() {
    return this.currentUser?.nivelPermissao || 'POSTO';
  },

  get postos() {
    return this.currentUser?.postos || [];
  },

  get permissoesTela() {
    return this.currentUser?.permissoesTela || [];
  },

  can(action) {
    const permissions = {
      superadmin: ['all'],
      admin: ['all'],
      comandante: ['all', 'iniciar_servico', 'encerrar_servico', 'equipe', 'telegrafia', 'oficiais', 'extras', 'update_atividade', 'editar_atividade', 'excluir_atividade', 'adicionar_fixa'],
      operador: ['view', 'update_atividade', 'telegrafia', 'oficiais', 'extras', 'editar_atividade', 'excluir_atividade', 'adicionar_fixa'],
      visualizador: ['view']
    };
    const role = this.userRole;
    if (permissions[role]?.includes('all')) return true;
    return permissions[role]?.includes(action) || false;
  },

  canTela(tela, acao) {
    if (this.userRole === 'superadmin' || this.userRole === 'admin') return true;
    const perm = this.permissoesTela.find(p => p.tela === tela);
    if (!perm) return false;
    if (perm.acoes.includes('all')) return true;
    return perm.acoes.includes(acao);
  },

  hasNivel(nivelRequerido) {
    const ordem = { 'GB': 3, 'SGB': 2, 'POSTO': 1 };
    return (ordem[this.nivelPermissao] || 0) >= (ordem[nivelRequerido] || 0);
  },

  get userPostoIds() {
    return (this.postos || []).map(p => p.id);
  },

  get isGB() { return this.nivelPermissao === 'GB'; },
  get isSGB() { return this.nivelPermissao === 'SGB'; },
  get isPOSTO() { return this.nivelPermissao === 'POSTO'; },
  get postoDefaultId() { return this.currentUser?.postoDefaultId || ''; },
  get mustChangePassword() { return this.currentUser?.mustChangePassword === true; },

  requireAuth() {
    if (!this.isLoggedIn) {
      const path = window.location.pathname;
      if (!path.endsWith('index.html') && path !== '/' && path !== '') {
        window.location.href = 'index.html';
      }
      return false;
    }
    return true;
  },

  requireRole(roles) {
    if (!this.can(roles)) {
      Utils.showToast('Acesso negado', 'error');
      return false;
    }
    return true;
  },

  logout() {
    Utils.log('logout', `${Auth.userName} saiu do sistema`, 'auth');
    Sync.stop();
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = 'index.html';
  },

  async requestNotificationPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const result = await Notification.requestPermission();
      return result;
    } catch (e) {
      return 'denied';
    }
  },

  async login(usuario, senha) {
    try {
      API.getConfig();
      if (!API.BASE_URL) {
        return { success: false, error: 'API não configurada. Configure a API primeiro.' };
      }
      const result = await API.login(usuario, senha);
      if (result.success && result.user) {
        this.user = result.user;
        this._postLogin();
        Utils.log('login', `${result.user.nome} fez login (${result.user.perfil})`, 'auth');
        return { success: true, user: result.user };
      }
      return { success: false, error: result.error || 'Credenciais inválidas' };
    } catch (err) {
      return { success: false, error: err.message || 'Erro de conexão com o servidor' };
    }
  },

  _postLogin() {
    setTimeout(() => {
      this.requestNotificationPermission();
      Utils.preloadSounds();
      if (this.mustChangePassword) {
        this._showPasswordChangeModal();
      }
    }, 500);
  },

  _showPasswordChangeModal() {
    const existing = document.getElementById('forcePasswordModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'forcePasswordModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div class="modal" style="max-width:420px;width:90%;background:var(--surface,#1e1e2e);border-radius:16px;padding:28px;color:var(--text,#e0e0e0);box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <h2 style="margin:0 0 8px;font-size:1.2rem;color:var(--text,#e0e0e0);">Alterar Senha Obrigatória</h2>
        <p style="margin:0 0 20px;font-size:.88rem;color:var(--text-secondary,#999);">Sua senha padrão deve ser alterada para continuar.</p>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:.8rem;color:var(--text-secondary,#999);margin-bottom:4px;">Nova Senha</label>
          <input type="password" id="fpc_senha1" placeholder="Mínimo 4 caracteres" style="width:100%;padding:10px 12px;border:1px solid var(--border,#333);border-radius:8px;background:var(--bg,#12121e);color:var(--text,#e0e0e0);font-size:.9rem;box-sizing:border-box;" />
        </div>
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:.8rem;color:var(--text-secondary,#999);margin-bottom:4px;">Confirmar Senha</label>
          <input type="password" id="fpc_senha2" placeholder="Repita a nova senha" style="width:100%;padding:10px 12px;border:1px solid var(--border,#333);border-radius:8px;background:var(--bg,#12121e);color:var(--text,#e0e0e0);font-size:.9rem;box-sizing:border-box;" />
        </div>
        <div id="fpc_error" style="color:#e53935;font-size:.82rem;margin-bottom:12px;display:none;"></div>
        <button id="fpc_confirm" style="width:100%;padding:10px;background:var(--primary,#7c5cfc);color:#fff;border:none;border-radius:8px;font-size:.9rem;cursor:pointer;font-weight:600;">Alterar Senha</button>
      </div>`;

    document.body.appendChild(modal);
    document.getElementById('fpc_senha1').focus();

    document.getElementById('fpc_confirm').onclick = async () => {
      const s1 = document.getElementById('fpc_senha1').value.trim();
      const s2 = document.getElementById('fpc_senha2').value.trim();
      const errEl = document.getElementById('fpc_error');
      if (s1.length < 4) { errEl.textContent = 'Senha deve ter pelo menos 4 caracteres'; errEl.style.display = 'block'; return; }
      if (s1 !== s2) { errEl.textContent = 'As senhas não coincidem'; errEl.style.display = 'block'; return; }
      const r = await API.alterarMinhaSenha(this.userId, s1);
      if (r.success) {
        const u = this.user;
        u.mustChangePassword = false;
        this.user = u;
        modal.remove();
        Utils.showToast('Senha alterada com sucesso!', 'success');
      } else {
        errEl.textContent = r.error || 'Erro ao alterar senha';
        errEl.style.display = 'block';
      }
    };
  }
};
