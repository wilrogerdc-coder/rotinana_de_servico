/**
 * Módulo de Autenticação do SGPO
 */
const Auth = {
  get user() {
    try {
      if (sessionStorage.getItem('sgpo_logged_out') === 'true' || localStorage.getItem('sgpo_logged_out') === 'true') return null;
      if (!sessionStorage.getItem('sgpo_session_active')) return null;
      const stored = sessionStorage.getItem('sgpo_user') || localStorage.getItem('sgpo_user');
      if (stored) return JSON.parse(stored);
    } catch(e) {}
    return null;
  },

  get isLoggedIn() {
    try {
      if (sessionStorage.getItem('sgpo_logged_out') === 'true' || localStorage.getItem('sgpo_logged_out') === 'true') return false;
      if (!sessionStorage.getItem('sgpo_session_active')) return false;
      const stored = sessionStorage.getItem('sgpo_user') || localStorage.getItem('sgpo_user');
      return !!stored;
    } catch(e) {
      return false;
    }
  },

  get userId() {
    return this.user?.id || '';
  },

  get userName() {
    return this.user?.nome || this.user?.guerra || 'Usuário';
  },

  get userRole() {
    return this.user?.role || this.user?.perfil || 'operador';
  },

  get nivelPermissao() {
    return this.user?.nivelPermissao || 'POSTO';
  },

  get postos() {
    return this.user?.postos || [];
  },

  get postosAbrir() {
    const list = this.user?.postosAbrir;
    if (Array.isArray(list)) return list.map(String);
    if (typeof list === 'string') {
      try { return JSON.parse(list).map(String); } catch(e) { return list.split(',').map(s => s.trim()).filter(Boolean); }
    }
    return [];
  },

  get postosVisualizar() {
    const list = this.user?.postosVisualizar;
    if (Array.isArray(list)) return list.map(String);
    if (typeof list === 'string') {
      try { return JSON.parse(list).map(String); } catch(e) { return list.split(',').map(s => s.trim()).filter(Boolean); }
    }
    return [];
  },

  canAbrirPosto(postoId) {
    if (!postoId) return false;
    const role = (this.userRole || '').toLowerCase();
    const nivel = (this.nivelPermissao || '').toUpperCase();
    if (role === 'admin' || role === 'superadmin' || nivel === 'GB' || this.userId === '_superuser_') return true;
    const list = this.postosAbrir;
    if (list.length > 0) return list.includes(String(postoId));
    // Fallback: se não houver postosAbrir parametrizado, verifica postos gerais
    return (this.postos || []).some(p => (typeof p === 'object' && p ? String(p.id || p.postoId) : String(p)) === String(postoId));
  },

  canVisualizarPosto(postoId) {
    if (!postoId) return false;
    const role = (this.userRole || '').toLowerCase();
    const nivel = (this.nivelPermissao || '').toUpperCase();
    if (role === 'admin' || role === 'superadmin' || nivel === 'GB' || this.userId === '_superuser_') return true;
    const visList = this.postosVisualizar;
    if (visList.length > 0 && visList.includes(String(postoId))) return true;
    const abrirList = this.postosAbrir;
    if (abrirList.length > 0 && abrirList.includes(String(postoId))) return true;
    return (this.postos || []).some(p => (typeof p === 'object' && p ? String(p.id || p.postoId) : String(p)) === String(postoId));
  },

  get postoDefaultId() {
    return this.user?.postoDefaultId || '';
  },

  async login(usuario, senha) {
    try {
      if (typeof API !== 'undefined' && API.login) {
        const res = await API.login(usuario, senha);
        if (res && res.success && res.user) {
          try {
            sessionStorage.removeItem('sgpo_logged_out');
            localStorage.removeItem('sgpo_logged_out');
            sessionStorage.setItem('sgpo_session_active', 'true');
            sessionStorage.setItem('sgpo_user', JSON.stringify(res.user));
            localStorage.setItem('sgpo_user', JSON.stringify(res.user));
          } catch(e) {}
          if (typeof SyncQueue !== 'undefined') {
            SyncQueue._authError = false;
            if (SyncQueue.queue.length > 0) {
              setTimeout(() => SyncQueue.sync(), 200);
            }
          }
          return { success: true, user: res.user };
        }
        return { success: false, error: res?.error || 'Usuário ou senha incorretos' };
      }
      return { success: false, error: 'Módulo de API indisponível' };
    } catch (e) {
      return { success: false, error: e.message || 'Erro durante login' };
    }
  },

  can(permission) {
    if (!permission) return true;
    const role = (this.userRole || '').toLowerCase();
    const nivel = (this.nivelPermissao || '').toUpperCase();
    if (role === 'admin' || role === 'superadmin' || nivel === 'GB' || this.userId === '_superuser_') return true;
    const perms = this.user?.permissions || [];
    return perms.includes('all') || perms.includes('*') || perms.includes(permission);
  },

  canTela(tela, acao = 'ver') {
    if (!tela) return true;
    const user = this.user;
    if (!user) return false;

    // Administradores e nível GB têm acesso irrestrito
    const role = (user.role || user.perfil || this.userRole || '').toLowerCase();
    const nivel = (user.nivelPermissao || this.nivelPermissao || '').toUpperCase();
    if (role === 'admin' || role === 'superadmin' || nivel === 'GB' || user.id === '_superuser_' || this.userId === '_superuser_') {
      return true;
    }

    const perms = user.permissions || [];
    if (perms.includes('all') || perms.includes('*')) {
      return true;
    }

    const permissoesTela = user.permissoesTela;
    if (Array.isArray(permissoesTela) && permissoesTela.length > 0) {
      const telaClean = tela.toLowerCase();
      const permItem = permissoesTela.find(p => (p.tela || '').toLowerCase() === telaClean);
      if (!permItem) {
        if (telaClean === 'dashboard' || telaClean === 'ajuda') return true;
        return false;
      }

      let acoes = permItem.acoes;
      if (typeof acoes === 'string') {
        try {
          acoes = JSON.parse(acoes);
        } catch (e) {
          acoes = acoes.split(',').map(s => s.trim());
        }
      }
      if (!Array.isArray(acoes)) acoes = [acoes];

      const acaoClean = (acao || 'ver').toLowerCase();
      if (acoes.includes('all') || acoes.includes('*') || acoes.includes(acaoClean)) {
        return true;
      }
      // Equivalência para aba de oficiais no painel admin
      if (acaoClean === 'oficiais_a' && acoes.includes('oficiais')) {
        return true;
      }
      return false;
    }

    // Telas padrão permitidas se não houver restrição configurada
    const telasPadrao = ['dashboard', 'rotina', 'telegrafia', 'oficiais', 'extras', 'relatorios', 'historico', 'servicos', 'postos', 'ajuda'];
    if (telasPadrao.includes(tela.toLowerCase()) && acao === 'ver') {
      return true;
    }

    return this.can(acao);
  },

  requireAuth() {
    if (!this.isLoggedIn) {
      if (typeof window !== 'undefined' && !window.location.pathname.endsWith('login.html')) {
        window.location.href = 'login.html';
        return false;
      }
    }
    return true;
  },

  logout() {
    try {
      sessionStorage.removeItem('sgpo_session_active');
      sessionStorage.removeItem('sgpo_user');
      sessionStorage.setItem('sgpo_logged_out', 'true');
      localStorage.removeItem('sgpo_user');
      localStorage.removeItem('sgpo_demo');
      localStorage.removeItem('sgpo_cached_servico');
      localStorage.removeItem('sgpo_active_servico_id');
      localStorage.removeItem('sgpo_cached_postos_com_servico');
      localStorage.setItem('sgpo_logged_out', 'true');
    } catch(e) {}
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        new BroadcastChannel('sgpo').postMessage({ type: 'logout' });
      }
    } catch(e) {}
    try {
      window.location.href = 'login.html';
    } catch(e) {
      window.location.replace('login.html');
    }
  }
};

if (typeof window !== 'undefined') window.Auth = Auth;
if (typeof module !== 'undefined' && module.exports) module.exports = Auth;
