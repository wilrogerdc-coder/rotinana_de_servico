const NAV = {
  currentPage: '',

  init(page) {
    this.currentPage = page;
    this.renderSidebar();
    this.renderTopbar();
    this.startClock();
    this.setupLogout();
    this.applySavedCampanha();
    this.loadPostoLogo();
  },

  pages: [
    { id: 'dashboard', title: 'Dashboard', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
    { id: 'rotina', title: 'Rotina', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    { id: 'telegrafia', title: 'Telegrafia', icon: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>' },
    { id: 'oficiais', title: 'Oficiais', icon: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>' },
    { id: 'extras', title: 'Extras', icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>' },
    { id: 'postos', title: 'Postos', icon: '<path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4M5 21V10.87M19 21V10.87"/>' },
    { id: 'relatorios', title: 'Relatórios', icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    { id: 'historico', title: 'Histórico', icon: '<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
  ],

  bottomPages: [
    { id: 'admin', title: 'Admin', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>' },
  ],

  svgIcon(paths) {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  },

  renderSidebar() {
    const existing = document.querySelector('.sidebar');
    if (existing) return;

    const visiblePages = this.pages.filter(p => Auth.canTela(p.id, 'ver'));
    const visibleBottom = this.bottomPages.filter(p => Auth.canTela(p.id, 'ver'));

    const sidebar = document.createElement('nav');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <div class="sidebar-logo" id="sidebarLogo" style="cursor:pointer" onclick="NAV.openLogoLightbox()"><img src="assets/logos/bombeiros.svg" alt="SGPO" onerror="this.parentElement.innerHTML='<span style=font-weight:700;font-size:1.2rem;color:var(--prontidao-color)>SGPO</span>'"></div>
      <div class="sidebar-nav">
        ${visiblePages.map(p => `
          <button class="sidebar-item ${p.id === this.currentPage ? 'active' : ''}" data-page="${p.id}" title="${p.title}">
            ${this.svgIcon(p.icon)}
          </button>
        `).join('')}
      </div>
      <div class="sidebar-bottom">
        ${visibleBottom.map(p => `
          <button class="sidebar-item ${p.id === this.currentPage ? 'active' : ''}" data-page="${p.id}" title="${p.title}">
            ${this.svgIcon(p.icon)}
          </button>
        `).join('')}
        <button class="sidebar-item" id="logoutBtn" title="Sair">
          ${this.svgIcon('<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>')}
        </button>
      </div>
    `;

    const layout = document.createElement('div');
    layout.className = 'app-layout';
    layout.id = 'appLayout';

    const mainContent = document.querySelector('.main-content');
    if (mainContent && mainContent.parentElement === document.body) {
      document.body.insertBefore(layout, mainContent);
      layout.appendChild(sidebar);
      layout.appendChild(mainContent);
    } else {
      document.body.insertBefore(layout, document.body.firstChild);
      layout.appendChild(sidebar);
    }

    sidebar.querySelectorAll('.sidebar-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        if (page !== this.currentPage) {
          window.location.href = page + '.html';
        }
      });
    });
  },

  renderTopbar() {
    const existing = document.querySelector('.topbar');
    if (existing) return;

    const topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <div class="topbar-left">
        <button class="hamburger" id="menuToggle">☰</button>
        <div class="prontidao-indicator" id="prontidaoIndicator" style="display:none;cursor:pointer" onclick="NAV.openProntidaoLogo()">
          <span class="prontidao-dot"></span>
          <span id="prontidaoText"></span>
        </div>
        <div class="service-info-bar" id="serviceInfoBar" style="display:none;margin-left:12px;font-size:0.78rem;color:var(--text-secondary)">
          <span id="serviceInfoPosto" style="font-weight:600;color:var(--text-primary)"></span>
          <span style="margin:0 4px;opacity:0.4">|</span>
          <span id="serviceInfoComandante"></span>
        </div>
      </div>
      <div class="topbar-right">
        <span id="horaAtual" style="font-family:var(--font-mono);font-weight:600"></span>
        <span id="userNameTop" style="color:var(--text-secondary);font-size:0.85rem"></span>
      </div>
    `;

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertAdjacentElement('afterbegin', topbar);
    }

    document.getElementById('userNameTop').textContent = Auth.userName;

    document.getElementById('menuToggle')?.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('sidebar-open');
    });

  },

  startClock() {
    const update = () => {
      const el = document.getElementById('horaAtual');
      if (el) el.textContent = Utils.formatTime(new Date());
    };
    update();
    setInterval(update, 1000);
  },

  setupLogout() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      if (confirm('Deseja realmente sair do sistema?')) {
        Auth.logout();
      }
    });
  },

  setupGlobalSearch() {
    const input = document.getElementById('globalSearch');
    const results = document.getElementById('globalSearchResults');
    if (!input || !results) return;
    let debounce = null;

    input.addEventListener('input', () => {
      clearTimeout(debounce);
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { results.style.display = 'none'; results.innerHTML = ''; return; }
      debounce = setTimeout(() => this.performSearch(q, results), 200);
    });

    input.addEventListener('focus', () => {
      if (results.children.length > 0) results.style.display = '';
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !results.contains(e.target)) {
        results.style.display = 'none';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { results.style.display = 'none'; input.blur(); }
    });
  },

  async performSearch(query, resultsEl) {
    const items = [];

    try {
      if (typeof API !== 'undefined') {
        const servico = API.getServicoAtual ? await API.getServicoAtual(Auth.userId).catch(() => null) : null;

        if (servico?.rotina) {
          servico.rotina.forEach(a => {
            const texto = `${a.titulo || ''} ${a.programa || ''} ${a.responsavel || ''} ${a.descricao || ''}`.toLowerCase();
            if (texto.includes(query)) {
              items.push({ tipo: 'Atividade', icone: '📋', texto: a.titulo || a.programa, detalhe: `${a.horario || ''} · ${a.responsavel || ''}`, acao: () => { window.location.href = 'rotina.html'; }});
            }
          });
        }

        if (servico?.ocorrencias) {
          servico.ocorrencias.forEach(o => {
            const texto = `${o.titulo || ''} ${o.numero || ''} ${o.descricao || ''}`.toLowerCase();
            if (texto.includes(query)) {
              items.push({ tipo: 'Ocorrência', icone: '🚨', texto: `#${o.numero || '?'} ${o.titulo || ''}`, detalhe: o.descricao || '', acao: () => { window.location.href = 'dashboard.html'; }});
            }
          });
        }

        try {
          const viaturas = await API.getViaturas().catch(() => []);
          viaturas.forEach(v => {
            const texto = `${v.nome || ''} ${v.prefixo || ''} ${v.tipo || ''}`.toLowerCase();
            if (texto.includes(query)) {
              items.push({ tipo: 'Viatura', icone: '🚒', texto: `${v.prefixo || ''} ${v.nome || ''}`, detalhe: v.tipo || v.status || '', acao: () => { window.location.href = 'dashboard.html'; }});
            }
          });
        } catch(e) {}

        try {
          const militares = await API.getMilitares().catch(() => []);
          militares.forEach(m => {
            const texto = `${m.nome || ''} ${m.postoGraduacao || ''} ${m.apelido || ''}`.toLowerCase();
            if (texto.includes(query)) {
              items.push({ tipo: 'Militar', icone: '👤', texto: `${m.postoGraduacao || ''} ${m.nome || ''}`, detalhe: m.apelido || '', acao: () => { window.location.href = 'admin.html'; }});
            }
          });
        } catch(e) {}
      }
    } catch(e) {}

    if (items.length === 0) {
      resultsEl.innerHTML = '<div class="topbar-search-empty">Nenhum resultado encontrado</div>';
      resultsEl.style.display = '';
      return;
    }

    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.tipo]) grouped[item.tipo] = [];
      grouped[item.tipo].push(item);
    });

    let html = '';
    Object.entries(grouped).forEach(([tipo, grupo]) => {
      html += `<div class="topbar-search-group"><div class="topbar-search-group-title">${grupo[0].icone} ${tipo}</div>`;
      grupo.slice(0, 5).forEach((item, i) => {
        html += `<div class="topbar-search-item" data-idx="${items.indexOf(item)}"><span class="topbar-search-item-text">${item.texto}</span><span class="topbar-search-item-detail">${item.detalhe}</span></div>`;
      });
      html += '</div>';
    });

    resultsEl.innerHTML = html;
    resultsEl.style.display = '';

    resultsEl.querySelectorAll('.topbar-search-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        if (items[idx]?.acao) items[idx].acao();
        resultsEl.style.display = 'none';
        input.value = '';
      });
    });
  },

  updateProntidao(cor) {
    const colorMap = { verde: 'verde', amarela: 'amarela', azul: 'azul', branca: 'branca' };
    const c = colorMap[cor] || 'verde';
    document.documentElement.setAttribute('data-prontidao', c);
    const textMap = { verde: 'Prontidão Verde', amarela: 'Prontidão Amarela', azul: 'Prontidão Azul', branca: 'Prontidão Branca' };
    const el = document.getElementById('prontidaoText');
    const indicator = document.getElementById('prontidaoIndicator');
    if (cor && textMap[c]) {
      if (el) el.textContent = textMap[c];
      if (indicator) indicator.style.display = '';
    } else {
      if (el) el.textContent = '';
      if (indicator) indicator.style.display = 'none';
    }
  },

  updateServiceInfo(servico, postos) {
    const bar = document.getElementById('serviceInfoBar');
    if (!bar) return;
    if (!servico) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    const postoEl = document.getElementById('serviceInfoPosto');
    const cmdEl = document.getElementById('serviceInfoComandante');
    if (postoEl) {
      const posto = (postos || []).find(p => p.id === servico.postoId);
      postoEl.textContent = posto ? posto.nome : (servico.postoId || '');
    }
    if (cmdEl) {
      cmdEl.textContent = servico.comandanteNome ? 'Cmt: ' + servico.comandanteNome : '';
    }
  },

  applySavedCampanha() {
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    if (config.campanha && config.campanha !== 'nenhuma' && config.campanhaAuto === false) {
      Utils.applyCampanha(config.campanha);
    } else if (config.campanhaAuto !== false) {
      Utils.applyCampanha(Utils.autoDetectCampanha());
    } else {
      Utils.applyCampanha('nenhuma');
    }
  },

  async loadPostoLogo() {
    try {
      const data = await API.getServicoAtual(Auth.userId);
      if (!data?.servico?.postoId) return;
      const postos = await API.getPostosServico();
      const posto = postos.find(p => p.id === data.servico.postoId);
      if (posto?.logo) {
        this._currentLogoUrl = posto.logo;
        const logoEl = document.getElementById('sidebarLogo');
        if (logoEl) logoEl.innerHTML = `<img src="${Utils.escapeHtml(posto.logo)}" alt="${Utils.escapeHtml(posto.nome)}" style="max-height:40px;max-width:100%;object-fit:contain" onerror="this.parentElement.innerHTML='<span style=font-weight:700;font-size:1.2rem;color:var(--prontidao-color)>SGPO</span>'">`;
      }
    } catch (e) { /* ignore */ }
  },

  openLogoLightbox(url) {
    const src = url || this._currentLogoUrl || 'assets/logos/bombeiros.svg';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer';
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `<img src="${Utils.escapeHtml(src)}" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.5)">`;
    document.body.appendChild(overlay);
  },

  openProntidaoLogo() {
    const color = document.documentElement.style.getPropertyValue('--prontidao-color') || '#4caf50';
    const colorName = {'#4caf50':'verde','#f59e0b':'amarela','#3b82f6':'azul','#f8fafc':'branca'}[color] || 'verde';
    const logoUrl = `assets/logos/prontidao-${colorName}.svg`;
    this.openLogoLightbox(logoUrl);
  },

  updateCampanhaButton(campanhaId) {
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    const active = config.campanhaAuto !== false ? Utils.autoDetectCampanha() : (campanhaId || config.campanha || 'nenhuma');
    const c = Utils.getCampanhaById(active);
    const icon = document.getElementById('campanhaIcon');
    if (icon) icon.textContent = c.icone || '🎨';
    const autoToggle = document.getElementById('campanhaAutoToggle');
    if (autoToggle) autoToggle.checked = config.campanhaAuto !== false;
  },

  initCampanhaDropdown() {
    if (Auth.userId !== '_superuser_') return;
    const wrapper = document.getElementById('campanhaWrapper');
    if (!wrapper) return;
    wrapper.style.display = '';
    const list = document.getElementById('campanhaDropdownList');
    if (!list) return;
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    const current = config.campanhaAuto !== false ? Utils.autoDetectCampanha() : (config.campanha || 'nenhuma');
    list.innerHTML = Utils.CAMPANHAS.map(c => `
      <div class="campanha-item ${c.id === current ? 'active' : ''}" data-id="${c.id}">
        <span class="campanha-item-icon">${c.icone || '—'}</span>
        <span class="campanha-item-name">${c.nome}</span>
        ${c.id === current ? '<span class="campanha-item-check">✓</span>' : ''}
      </div>
    `).join('');
    list.querySelectorAll('.campanha-item').forEach(item => {
      item.addEventListener('click', () => {
        this.setCampanha(item.dataset.id);
      });
    });
    const autoToggle = document.getElementById('campanhaAutoToggle');
    if (autoToggle) {
      autoToggle.checked = config.campanhaAuto !== false;
      autoToggle.addEventListener('change', () => {
        this.toggleCampanhaAuto(autoToggle.checked);
      });
    }
    document.getElementById('campanhaToggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('campanhaDropdown');
      if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', (e) => {
      const dd = document.getElementById('campanhaDropdown');
      if (dd && !wrapper.contains(e.target)) dd.style.display = 'none';
    });
    this.updateCampanhaButton();
  },

  setCampanha(campanhaId) {
    if (Auth.userId !== '_superuser_') {
      Utils.showToast('Apenas o super usuário pode alterar o tema', 'error');
      return;
    }
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    config.campanha = campanhaId;
    config.campanhaAuto = false;
    localStorage.setItem('sgpo_config', JSON.stringify(config));
    Utils.applyCampanha(campanhaId);
    const dd = document.getElementById('campanhaDropdown');
    if (dd) dd.style.display = 'none';
    Utils.showToast(`Campanha: ${Utils.getCampanhaById(campanhaId).nome}`, 'success');
    this.updateCampanhaButton(campanhaId);
    this.initCampanhaDropdown();
    if (API.BASE_URL && !API.isDemo) {
      API.request('updateConfig', { config: { campanha: campanhaId, campanhaAuto: false } }).catch(() => {});
    }
    if (typeof Sync !== 'undefined') Sync.broadcastConfigChanged(config);
  },

  toggleCampanhaAuto(enabled) {
    if (Auth.userId !== '_superuser_') {
      Utils.showToast('Apenas o super usuário pode alterar o tema', 'error');
      return;
    }
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    config.campanhaAuto = enabled;
    if (enabled) config.campanha = Utils.autoDetectCampanha();
    localStorage.setItem('sgpo_config', JSON.stringify(config));
    const id = enabled ? Utils.autoDetectCampanha() : (config.campanha || 'nenhuma');
    Utils.applyCampanha(id);
    this.updateCampanhaButton();
    this.initCampanhaDropdown();
    if (API.BASE_URL && !API.isDemo) {
      API.request('updateConfig', { config: { campanhaAuto: enabled, campanha: id } }).catch(() => {});
    }
    if (typeof Sync !== 'undefined') Sync.broadcastConfigChanged(config);
  }
};
