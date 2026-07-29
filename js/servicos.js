const Servicos = {
  servicos: [],
  currentFilter: 'ativos',
  activeServicoId: null,

  init() {
    NAV.init('servicos');
    if (!Auth.isLoggedIn) { window.location.href = 'index.html'; return; }
    this.activeServicoId = localStorage.getItem('sgpo_active_servico_id') || null;
    this.loadServicos();
  },

  async loadServicos() {
    try {
      const result = await API.getServicosAtivos();
      this.servicos = Array.isArray(result) ? result : [];
      this.renderStats();
      this.renderList();
      this.updateSubtitle();
    } catch (e) {
      console.error('Erro ao carregar serviços:', e);
      Utils.showToast('Erro ao carregar serviços', 'error');
      document.getElementById('servicosList').innerHTML = '<div class="empty-state"><p>Erro ao carregar serviços</p></div>';
    }
  },

  updateSubtitle() {
    const el = document.getElementById('servicosSubtitle');
    const nivel = Auth.nivelPermissao;
    const labels = { GB: 'Visualizando todos os serviços (acesso GB)', SGB: 'Serviços da sua hierarquia', POSTO: 'Serviços dos seus postos' };
    el.textContent = labels[nivel] || 'Serviços ativos de hoje';
  },

  renderStats() {
    const el = document.getElementById('servicosStats');
    const total = this.servicos.length;
    const ativos = this.servicos.filter(s => s.Status === 'ativo').length;
    const concluidas = this.servicos.reduce((acc, s) => acc + (s.totalConcluidas || 0), 0);
    const totalAtiv = this.servicos.reduce((acc, s) => acc + (s.totalAtividades || 0), 0);

    el.innerHTML = `
      <div class="stat-mini"><div class="stat-mini-value">${total}</div><div class="stat-mini-label">Serviços</div></div>
      <div class="stat-mini"><div class="stat-mini-value">${ativos}</div><div class="stat-mini-label">Ativos</div></div>
      <div class="stat-mini"><div class="stat-mini-value">${totalAtiv}</div><div class="stat-mini-label">Atividades</div></div>
      <div class="stat-mini"><div class="stat-mini-value">${concluidas}</div><div class="stat-mini-label">Concluídas</div></div>
    `;
  },

  getFiltered() {
    let list = [...this.servicos];
    if (this.currentFilter === 'ativos') {
      list = list.filter(s => s.Status === 'ativo');
    }
    const q = (document.getElementById('servicosSearch')?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(s =>
        (s.postoNome || '').toLowerCase().includes(q) ||
        (s.comandanteNome || '').toLowerCase().includes(q) ||
        (s.prontidao || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  renderList() {
    const el = document.getElementById('servicosList');
    const list = this.getFiltered();

    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>Nenhum serviço encontrado</p></div>';
      return;
    }

    el.innerHTML = list.map(s => {
      const isActive = s.id === this.activeServicoId;
      const progress = s.totalAtividades > 0 ? Math.round((s.totalConcluidas / s.totalAtividades) * 100) : 0;
      const equipe = s.equipe || [];
      const avatars = equipe.slice(0, 4).map(m => `<div class="svc-equipe-avatar">${Utils.getInitials(m.nome || '')}</div>`).join('');
      const more = equipe.length > 4 ? `<div class="svc-equipe-avatar svc-equipe-more">+${equipe.length - 4}</div>` : '';

      return `
        <div class="svc-card ${isActive ? 'active-service' : ''}" onclick="Servicos.showDetail('${s.id}')">
          <div class="svc-card-header">
            <div class="svc-card-posto">
              <span class="svc-card-tipo ${s.postoTipo || 'POSTO'}">${s.postoTipo || 'POSTO'}</span>
              <span class="svc-card-nome">${Utils.escapeHtml(s.postoNome || 'Posto desconhecido')}</span>
            </div>
            <div class="svc-card-prontidao ${s.prontidao}">
              <span class="dot"></span>
              ${s.prontidao ? s.prontidao.charAt(0).toUpperCase() + s.prontidao.slice(1) : '-'}
            </div>
          </div>

          <div class="svc-card-info">
            <div class="svc-info-item">
              <span class="svc-info-label">Comandante</span>
              <span class="svc-info-value">${Utils.escapeHtml(s.comandanteNome || '-')}</span>
            </div>
            <div class="svc-info-item">
              <span class="svc-info-label">Início</span>
              <span class="svc-info-value">${s.horarioInicio || '--:--'}</span>
            </div>
            <div class="svc-info-item">
              <span class="svc-info-label">Equipe</span>
              <span class="svc-info-value">${equipe.length} ${equipe.length === 1 ? 'membro' : 'membros'}</span>
            </div>
            <div class="svc-info-item">
              <span class="svc-info-label">Atividades</span>
              <span class="svc-info-value">${s.totalConcluidas || 0}/${s.totalAtividades || 0}</span>
            </div>
          </div>

          ${s.totalAtividades > 0 ? `
            <div class="svc-card-progress">
              <div class="svc-progress-bar"><div class="svc-progress-fill" style="width:${progress}%"></div></div>
              <div class="svc-progress-text"><span>${s.totalConcluidas || 0} concluídas</span><span>${progress}%</span></div>
            </div>
          ` : ''}

          ${equipe.length > 0 ? `
            <div style="display:flex;align-items:center;margin-bottom:var(--spacing-md)">
              <span class="svc-info-label" style="margin-right:8px">Equipe:</span>
              <div class="svc-equipe-avatars">${avatars}${more}</div>
            </div>
          ` : ''}

          <div class="svc-card-actions" onclick="event.stopPropagation()">
            ${isActive
              ? `<span style="font-size:0.8rem;color:var(--prontidao-color);font-weight:600">✓ Serviço Atual</span>
                 <button class="btn btn-ghost btn-sm" onclick="Servicos.showDetail('${s.id}')">Detalhes</button>`
              : `<button class="btn btn-primary btn-sm" onclick="Servicos.switchTo('${s.id}')">Entrar</button>
                 <button class="btn btn-ghost btn-sm" onclick="Servicos.showDetail('${s.id}')">Detalhes</button>`
            }
          </div>
        </div>
      `;
    }).join('');
  },

  showDetail(servicoId) {
    const s = this.servicos.find(sv => sv.id === servicoId);
    if (!s) return;

    const modal = document.getElementById('servicoDetailModal');
    const body = document.getElementById('servicoDetailBody');
    const footer = document.getElementById('servicoDetailFooter');
    const title = document.getElementById('detailModalTitle');
    const isActive = s.id === this.activeServicoId;

    title.textContent = s.postoNome || 'Detalhes do Serviço';

    const progress = s.totalAtividades > 0 ? Math.round((s.totalConcluidas / s.totalAtividades) * 100) : 0;
    const equipe = s.equipe || [];

    body.innerHTML = `
      <div class="detail-section">
        <div class="detail-section-title">Informações Gerais</div>
        <div class="detail-grid">
          <div class="detail-field">
            <span class="detail-label">Posto</span>
            <span class="detail-value">${Utils.escapeHtml(s.postoNome || '-')}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Tipo</span>
            <span class="detail-value"><span class="svc-card-tipo ${s.postoTipo || 'POSTO'}">${s.postoTipo || 'POSTO'}</span></span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Comandante</span>
            <span class="detail-value">${Utils.escapeHtml(s.comandanteNome || '-')}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Prontidão</span>
            <span class="detail-value"><span class="svc-card-prontidao ${s.prontidao}"><span class="dot"></span>${s.prontidao ? s.prontidao.charAt(0).toUpperCase() + s.prontidao.slice(1) : '-'}</span></span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Horário Início</span>
            <span class="detail-value">${s.horarioInicio || '--:--'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Horário Fim</span>
            <span class="detail-value">${s.horarioFim || '--:--'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Data</span>
            <span class="detail-value">${s.data || '-'}</span>
          </div>
          <div class="detail-field">
            <span class="detail-label">Status</span>
            <span class="detail-value">${s.Status === 'ativo' ? '🟢 Ativo' : s.Status}</span>
          </div>
        </div>
      </div>

      ${s.observacoes ? `
        <div class="detail-section">
          <div class="detail-section-title">Observações</div>
          <p style="font-size:0.9rem;color:var(--text-secondary);line-height:1.5">${Utils.escapeHtml(s.observacoes)}</p>
        </div>
      ` : ''}

      <div class="detail-section">
        <div class="detail-section-title">Atividades (${s.totalConcluidas || 0}/${s.totalAtividades || 0} — ${progress}%)</div>
        <div class="svc-card-progress" style="margin:0">
          <div class="svc-progress-bar"><div class="svc-progress-fill" style="width:${progress}%"></div></div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-title">Equipe (${equipe.length})</div>
        ${equipe.length === 0 ? '<p style="color:var(--text-muted);font-size:0.85rem">Nenhum membro na equipe</p>' : `
          <div class="detail-equipe-list">
            ${equipe.map(m => `
              <div class="detail-equipe-item">
                <div class="avatar">${Utils.getInitials(m.nome || '')}</div>
                <div style="flex:1">
                  <div class="detail-equipe-name">${Utils.escapeHtml(m.nome || '-')}</div>
                  <div class="detail-equipe-posto">${Utils.escapeHtml(m.posto || '')} ${m.re ? '• RE: ' + Utils.escapeHtml(m.re) : ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    let footerHtml = '';
    if (isActive) {
      footerHtml = `
        <button class="btn btn-ghost" onclick="Servicos.closeDetail()">Fechar</button>
        <button class="btn btn-danger btn-sm" onclick="Servicos.encerrarServico('${s.id}')">Encerrar Serviço</button>
      `;
    } else {
      footerHtml = `
        <button class="btn btn-ghost" onclick="Servicos.closeDetail()">Fechar</button>
        ${s.Status === 'ativo' ? `<button class="btn btn-primary" onclick="Servicos.closeDetail();Servicos.switchTo('${s.id}')">Entrar Neste Serviço</button>` : ''}
        ${(Auth.userRole === 'admin' || Auth.userRole === 'superadmin' || Auth.userId === '_superuser_') ? `<button class="btn btn-danger btn-sm" onclick="Servicos.encerrarServico('${s.id}')">Encerrar</button>` : ''}
      `;
    }
    footer.innerHTML = footerHtml;

    modal.style.display = 'flex';
  },

  closeDetail() {
    document.getElementById('servicoDetailModal').style.display = 'none';
  },

  switchTo(servicoId) {
    const s = this.servicos.find(sv => sv.id === servicoId);
    if (!s) return;
    if (s.Status !== 'ativo') {
      Utils.showToast('Este serviço não está ativo', 'warning');
      return;
    }

    const modal = document.getElementById('confirmSwitchModal');
    const text = document.getElementById('confirmSwitchText');
    const btn = document.getElementById('confirmSwitchBtn');

    text.innerHTML = `Deseja entrar no serviço do <strong>${Utils.escapeHtml(s.postoNome || 'posto')}</strong>?<br><small style="color:var(--text-muted)">Comandante: ${Utils.escapeHtml(s.comandanteNome || '-')}</small>`;
    this._pendingSwitchId = servicoId;
    modal.style.display = 'flex';
  },

  confirmSwitch() {
    const id = this._pendingSwitchId;
    if (!id) return;

    localStorage.setItem('sgpo_active_servico_id', id);
    this.activeServicoId = id;
    this.closeConfirmSwitch();
    this.closeDetail();
    this.renderList();

    Utils.showToast('Serviço selecionado! Redirecionando...', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
  },

  closeConfirmSwitch() {
    document.getElementById('confirmSwitchModal').style.display = 'none';
    this._pendingSwitchId = null;
  },

  async encerrarServico(servicoId) {
    const s = this.servicos.find(sv => sv.id === servicoId);
    if (!s) return;

    if (!confirm(`Deseja encerrar o serviço do ${s.postoNome || 'posto'}?`)) return;

    try {
      const result = await API.encerrarServico(servicoId);
      if (result.success) {
        Utils.showToast('Serviço encerrado', 'success');
        if (servicoId === this.activeServicoId) {
          localStorage.removeItem('sgpo_active_servico_id');
          this.activeServicoId = null;
        }
        this.closeDetail();
        await this.loadServicos();
      } else {
        Utils.showToast(result.error || 'Erro ao encerrar', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  showNovoServico() {
    window.location.href = 'rotina.html?action=iniciar';
  },

  setFilter(filter, evt) {
    this.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (evt && evt.target) evt.target.classList.add('active');
    this.renderList();
  },

  filterList() {
    this.renderList();
  }
};
