const Dashboard = {
  servico: null,
  rotina: [],
  telegrafia: null,
  telegrafiaVazioDesde: null,
  servicoViaturas: [],
  ocorrencias: [],
  _naturezas: [],
  countdownInterval: null,
  teleInterval: null,

  async init() {
    if (!Auth.requireAuth()) return;
    NAV.init('dashboard');
    this._naturezas = await API.getNaturezas() || [];
    await this.loadServico();
  },

  _naturezaOptions(selected) {
    return '<option value="">Selecione...</option>' + this._naturezas.filter(n => n.Status !== 'removido').map(n => `<option value="${n.valor || n.nome}" ${selected === (n.valor || n.nome) ? 'selected' : ''}>${n.nome}</option>`).join('');
  },

  async loadServico() {
    try {
      const data = await API.getServicoAtual(Auth.userId);
      if (!data || !data.servico) {
        document.getElementById('noServiceModal').style.display = 'flex';
        return;
      }

      if (Auth.nivelPermissao !== 'GB' && Auth.userRole !== 'admin') {
        const access = await API.checkAcessoServico(data.servico.id);
        if (!access.permitido) {
          if (access.motivo === 'Solicitação pendente') {
            Utils.showToast('Solicitação de acesso pendente', 'warning');
          } else if (access.motivo === 'Sem acesso ao serviço') {
            document.getElementById('acessoModal').style.display = 'flex';
            this._pendenteServicoId = data.servico.id;
            this._pendenteData = data;
            return;
          }
        }
      }

      this.servico = data.servico;
      this.rotina = data.rotina || [];
      this.telegrafia = data.telegrafia || null;
      this.telegrafiaVazioDesde = data.telegrafiaVazioDesde || null;
      this.servicoViaturas = data.servicoViaturas || [];
      this.ocorrencias = data.ocorrencias || [];
      API.getTiposViatura();

      NAV.updateProntidao(this.servico.prontidao);
      this.updateCountdown();
      API.getPostosServico().then(postos => NAV.updateServiceInfo(this.servico, postos)).catch(() => {});
      API.registrarHeartbeat().catch(() => {});

      if (Auth.can('all') || Auth.can('encerrar_servico')) {
        const btn = document.getElementById('btnSolicitacoes');
        if (btn) btn.style.display = 'inline-block';
        const btnEdit = document.getElementById('btnEditarServico');
        if (btnEdit) btnEdit.style.display = 'inline-block';
      }

      this.updateAtividadeAtual();
      this.updateTelegrafia(data.telegrafia);
      this.updateOficiais(data.oficiais || []);
      this.updateNotificacoes(data.notificacoes || []);
      this.updateRotinaList();
      this.updateTimeline();
      this.renderViaturaPanel();

      this.countdownInterval = setInterval(() => this.updateCountdown(), 1000);

      Sync.on('rotina_updated', (r) => { this.rotina = r; this.updateRotinaList(); this.updateAtividadeAtual(); this.updateTimeline(); });
      Sync.on('telegrafia_updated', (t, vazioDesde) => { this.telegrafia = t; this.telegrafiaVazioDesde = vazioDesde || null; this.updateTelegrafia(t); });
      Sync.on('telegrafiavazio_updated', (v) => { this.telegrafiaVazioDesde = v; if (!this.telegrafia?.operador) this.updateTelegrafia(null); });
      Sync.on('oficiais_updated', (o) => this.updateOficiais(o));
      Sync.on('notificacoes_updated', (n) => this.updateNotificacoes(n));
      Sync.on('viaturas_updated', (v) => { this.servicoViaturas = v || []; this.renderViaturaPanel(); });
      Sync.on('ocorrencias_updated', (o) => { this.ocorrencias = o || []; this.renderViaturaPanel(); });

      const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
      const syncInterval = (parseInt(config.syncIntervalo) || 30) * 1000;
      Sync.start(this.servico.id, syncInterval);
      try {
        const bc = new BroadcastChannel('sgpo');
        bc.onmessage = (e) => { if (e.data?.type === 'service_started') window.location.reload(); };
      } catch (e) {}
    } catch (err) {
      console.error('Dashboard load error:', err);
      Utils.showToast('Erro ao carregar dados: ' + err.message, 'error');
    }
  },

  closeAcessoModal() {
    document.getElementById('acessoModal').style.display = 'none';
    this._pendenteServicoId = null;
    this._pendenteData = null;
  },

  async enviarSolicitacao() {
    const tipo = document.getElementById('acessoTipo').value;
    const motivo = document.getElementById('acessoMotivo').value.trim();
    if (!motivo) { Utils.showToast('Informe o motivo', 'warning'); return; }
    try {
      const result = await API.solicitarAcesso(this._pendenteServicoId, tipo, motivo);
      if (result.success) {
        Utils.showToast('Solicitação enviada ao comandante', 'success');
        this.closeAcessoModal();
      } else {
        Utils.showToast(result.error || 'Erro ao enviar', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async showSolicitacoes() {
    try {
      const perms = await API.getPermissoesServico(this.servico?.id);
      const pendentes = Array.isArray(perms) ? perms.filter(p => p.status === 'pendente') : [];
      const el = document.getElementById('solicitacoesList');
      if (pendentes.length === 0) {
        el.innerHTML = '<p style="color:var(--text-secondary);text-align:center;padding:16px">Nenhuma solicitação pendente</p>';
      } else {
        el.innerHTML = pendentes.map(p => `
          <div class="admin-list-item">
            <div>
              <div style="font-weight:500">${Utils.escapeHtml(p.usuarioNome || 'Usuário')}</div>
              <div style="font-size:0.8rem;color:var(--text-muted)">Tipo: ${p.tipo} | Motivo: ${Utils.escapeHtml(p.motivo || '-')}</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" onclick="Dashboard.responderSolicitacao('${p.id}', true, '${this.servico.id}')">Aprovar</button>
              <button class="btn btn-danger btn-sm" onclick="Dashboard.responderSolicitacao('${p.id}', false, '${this.servico.id}')">Recusar</button>
            </div>
          </div>
        `).join('');
      }
      document.getElementById('permissaoPendenteModal').style.display = 'flex';
    } catch (e) { Utils.showToast('Erro ao carregar solicitações', 'error'); }
  },

  async responderSolicitacao(permissaoId, aprovado, servicoId) {
    try {
      await API.responderAcesso(permissaoId, aprovado, servicoId);
      Utils.showToast(aprovado ? 'Acesso aprovado' : 'Acesso recusado', aprovado ? 'success' : 'info');
      this.showSolicitacoes();
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  showEquipePanel() {
    const el = document.getElementById('equipePanel');
    if (!el) return;
    this.renderEquipePanel();
    el.style.display = 'flex';
  },

  closeEquipePanel() {
    const el = document.getElementById('equipePanel');
    if (el) el.style.display = 'none';
  },

  renderEquipePanel() {
    const listEl = document.getElementById('equipePanelList');
    const equipe = this.servico?.equipe || [];
    if (equipe.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><p>Nenhum integrante na equipe</p></div>';
      return;
    }
    listEl.innerHTML = equipe.map(m => `
      <div class="admin-list-item">
        <div>
          <div style="font-weight:500">${Utils.escapeHtml(m.nome)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(m.posto || '')} ${m.avulso ? '(Avulso)' : ''}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="Dashboard.removerEquipeMembro('${m.id}', '${Utils.escapeHtml(m.nome)}')">Remover</button>
      </div>
    `).join('');
  },

  async showAddEquipeModal() {
    const el = document.getElementById('addEquipeModal');
    if (!el) return;
    try {
      const data = await API.get('militares');
      const militares = data || [];
      const equipe = this.servico?.equipe || [];
      const equipeIds = new Set(equipe.map(e => e.id));
      const listEl = document.getElementById('addEquipeList');
      listEl.innerHTML = Utils.sortByName(militares).filter(m => !equipeIds.has(m.id)).map(m => `
        <div class="admin-list-item">
          <div>
            <div style="font-weight:500">${Utils.escapeHtml(m.nome)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(m.posto || '')}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Dashboard.adicionarEquipeMembro('${m.id}')">Adicionar</button>
        </div>
      `).join('') || '<div class="empty-state"><p>Todos os militares já estão na equipe</p></div>';
      el.style.display = 'flex';
    } catch (e) { Utils.showToast('Erro ao carregar militares', 'error'); }
  },

  closeAddEquipeModal() {
    const el = document.getElementById('addEquipeModal');
    if (el) el.style.display = 'none';
  },

  async adicionarEquipeMembro(militarId) {
    try {
      const data = await API.get('militares');
      const militar = (data || []).find(m => m.id === militarId);
      if (!militar) return;
      const integrante = { id: militar.id, nome: militar.nome, posto: militar.posto || '', reCpf: militar.reCpf || '', avulso: false };
      const result = await API.adicionarEquipe(this.servico.id, integrante);
      if (result.success) {
        this.servico.equipe = result.equipe || [...(this.servico.equipe || []), integrante];
        Utils.showToast(`${militar.nome} adicionado à equipe`, 'success');
        this.renderEquipePanel();
        this.updateEquipeCount();
        this.showAddEquipeModal();
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async removerEquipeMembro(integranteId, nome) {
    const equipe = this.servico?.equipe || [];
    const membro = equipe.find(e => e.id === integranteId);

    const temAcoes = this.rotina.some(a =>
      a.concluidoPor && membro && a.concluidoPor === membro.nome
    ) || (this.telegrafia && this.telegrafia.militarId === integranteId);

    if (temAcoes) {
      Utils.showToast(`Não é possível remover ${nome}: já realizou ações no serviço`, 'error');
      return;
    }

    if (!confirm(`Deseja remover ${nome} da equipe?\n\nEsta ação será registrada no log.`)) return;

    try {
      const result = await API.removerEquipe(this.servico.id, integranteId);
      if (result.success) {
        this.servico.equipe = result.equipe || equipe.filter(e => e.id !== integranteId);
        Utils.showToast(`${nome} removido da equipe`, 'success');
        this.renderEquipePanel();
        this.updateEquipeCount();
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  updateEquipeCount() {
    const el = document.getElementById('equipeCount');
    if (el) el.textContent = (this.servico?.equipe || []).length;
  },

  async encerrarServico() {
    if (!this.servico) return;
    if (!confirm('Deseja encerrar o serviço atual?\n\nEsta ação irá finalizar o plantão do dia.')) return;
    try {
      const result = await API.encerrarServico(this.servico.id);
      if (result.success) {
        Utils.log('encerrar_servico', 'Serviço encerrado via dashboard', 'dashboard');
        Utils.showToast('Serviço encerrado', 'success');
        clearInterval(this.countdownInterval);
        Sync.stop();
        this.servico = null;
        this.rotina = [];
        this.telegrafia = null;
        document.getElementById('noServiceModal').style.display = 'flex';
      } else {
        Utils.showToast(result.error || 'Erro ao encerrar', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  _equipeEdicao: [],

  async showEditarServico() {
    if (!this.servico) return;
    const modal = document.getElementById('editarServicoModal');
    modal.style.display = 'flex';

    const sel = document.getElementById('editServicoComandante');
    sel.innerHTML = '<option value="">Selecionar comandante</option>';
    const equipe = this.servico.equipe || [];
    equipe.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.nome + (m.posto ? ' - ' + m.posto : '');
      if (m.id === this.servico.comandanteId) opt.selected = true;
      sel.appendChild(opt);
    });

    document.getElementById('editServicoProntidao').value = this.servico.prontidao || 'verde';
    document.getElementById('editServicoObs').value = this.servico.observacoes || '';

    this._equipeEdicao = JSON.parse(JSON.stringify(equipe));
    this._viaturasEdicao = JSON.parse(JSON.stringify(this.servicoViaturas || []));
    this._renderEquipeEdicao();
    this._renderViaturasEdicao();
  },

  _renderEquipeEdicao() {
    const el = document.getElementById('editServicoEquipeList');
    if (!this._equipeEdicao.length) { el.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhum integrante na equipe</p>'; return; }
    el.innerHTML = this._equipeEdicao.map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:4px">
        <span style="font-size:.88rem">${m.nome}${m.posto ? ' - ' + m.posto : ''}</span>
        <button class="btn btn-danger btn-sm" style="font-size:.75rem;padding:2px 8px" onclick="Dashboard.removeEquipeEdit('${m.id}')">✕</button>
      </div>
    `).join('');
  },

  removeEquipeEdit(id) {
    this._equipeEdicao = this._equipeEdicao.filter(m => m.id !== id);
    this._renderEquipeEdicao();
  },

  showAddEquipeEditModal() {
    const modal = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = 'Adicionar à Equipe';
    const body = document.getElementById('modalBody');
    const footer = document.getElementById('modalFooter');

    const state = JSON.parse(localStorage.getItem('sgpo_state') || '{}');
    const cadastrados = state.militares || [];
    const existingIds = this._equipeEdicao.map(m => m.id);

    body.innerHTML = cadastrados.filter(m => !existingIds.includes(m.id)).map(m => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:4px">
        <span style="font-size:.88rem">${m.nome}${m.posto ? ' - ' + m.posto : ''}</span>
        <button class="btn btn-primary btn-sm" style="font-size:.75rem;padding:2px 8px" onclick="Dashboard._addMembroEdicao('${m.id}','${m.nome.replace(/'/g, "\\'")}','${(m.posto||'').replace(/'/g, "\\'")}')">Adicionar</button>
      </div>
    `).join('') || '<p style="color:var(--text-secondary);font-size:.85rem">Nenhum cadastrado disponível</p>';

    footer.innerHTML = '<button class="btn btn-secondary" onclick="Dashboard.closeModal()">Fechar</button>';
    modal.style.display = 'flex';
  },

  _addMembroEdicao(id, nome, posto) {
    if (this._equipeEdicao.some(m => m.id === id)) return;
    this._equipeEdicao.push({ id, nome, posto: posto || '' });
    this._renderEquipeEdicao();
    this.closeModal();
  },

  _renderViaturasEdicao() {
    const el = document.getElementById('editServicoViaturasList');
    if (!el) return;
    const viaturas = this._viaturasEdicao || [];
    if (viaturas.length === 0) { el.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhuma viatura vinculada</p>'; return; }
    el.innerHTML = viaturas.map(sv => {
      const tc = API.getTipoCor(sv.viaturaTipo || sv.viaturaNome?.substring(0, 3) || '?');
      const tripStr = (sv.tripulantes || []).map(t => t.nome).join(', ');
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:4px;border-left:3px solid ${tc}">
          <div style="flex:1;min-width:0">
            <div style="font-size:.88rem;font-weight:600">${Utils.escapeHtml(sv.viaturaNome)}</div>
            <div style="font-size:.78rem;color:var(--text-secondary)">Motorista: ${Utils.escapeHtml(sv.motorista || '-')} | Trip: ${tripStr || '-'}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:2px 8px" onclick="Dashboard.editarServicoViatura('${sv.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" style="font-size:.72rem;padding:2px 8px" onclick="Dashboard.removerViaturaEdicao('${sv.id}')">✕</button>
          </div>
        </div>`;
    }).join('');
  },

  async showAddViaturaEditModal() {
    const existingIds = new Set((this._viaturasEdicao || []).map(sv => sv.viaturaId));
    const allViaturas = await API.get('viaturas') || [];
    const available = allViaturas.filter(v => v.ativo !== false && v.Status !== 'removido' && !existingIds.has(v.id));
    document.getElementById('modalTitle').textContent = 'Adicionar Viatura';
    document.getElementById('modalBody').innerHTML = available.length === 0
      ? '<p style="color:var(--text-secondary);font-size:.85rem">Nenhuma viatura disponível</p>'
      : available.map(v => {
        const tc = API.getTipoCor(v.tipo);
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:4px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:${tc}22;color:${tc};font-weight:700;font-size:.65rem">${v.tipo || '?'}</span>
              <span style="font-size:.88rem">${Utils.escapeHtml(v.nome)}</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="Dashboard._addViaturaEdicao('${v.id}','${v.nome.replace(/'/g, "\\'")}')">Adicionar</button>
          </div>`;
      }).join('');
    document.getElementById('modalFooter').innerHTML = '<button class="btn btn-secondary" onclick="Dashboard.closeModal()">Fechar</button>';
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async _addViaturaEdicao(viaturaId, viaturaNome) {
    if ((this._viaturasEdicao || []).some(sv => sv.viaturaId === viaturaId)) return;
    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tempId = 'sv-temp-' + Date.now();
    const novo = { id: tempId, servicoId: this.servico?.id || '', viaturaId, viaturaNome, motorista: '', motoristaId: '', tripulantes: [], horarioSaida: agora, horarioRetorno: '', status: 'ativa', Status: 'ativo' };
    this._viaturasEdicao = [...(this._viaturasEdicao || []), novo];
    this._renderViaturasEdicao();
    this.closeModal();
    Utils.showToast(`Viatura ${viaturaNome} adicionada`, 'success');
  },

  async removerViaturaEdicao(servicoViaturaId) {
    if (!confirm('Remover esta viatura do serviço?')) return;
    this._viaturasEdicao = (this._viaturasEdicao || []).filter(sv => sv.id !== servicoViaturaId);
    this._renderViaturasEdicao();
    Utils.showToast('Viatura removida do serviço', 'success');
  },

  async salvarEditarServico() {
    if (!this.servico) return;
    const comandanteId = document.getElementById('editServicoComandante').value;
    const comandanteNome = this.servico.equipe.find(m => m.id === comandanteId)?.nome || '';
    const prontidao = document.getElementById('editServicoProntidao').value;
    const observacoes = document.getElementById('editServicoObs').value;

    try {
      const result = await API.editarServico({
        servicoId: this.servico.id,
        comandanteId: comandanteId || undefined,
        comandanteNome: comandanteNome || undefined,
        prontidao: prontidao,
        equipe: this._equipeEdicao,
        observacoes: observacoes
      });
      if (result.success) {
        this.servico.comandanteId = comandanteId || this.servico.comandanteId;
        this.servico.comandanteNome = comandanteNome || this.servico.comandanteNome;
        this.servico.prontidao = prontidao;
        this.servico.equipe = this._equipeEdicao;
        this.servico.observacoes = observacoes;
        NAV.updateProntidao(prontidao);
        API.getPostosServico().then(postos => NAV.updateServiceInfo(this.servico, postos)).catch(() => {});
        this.updateEquipeCount();

        const origIds = new Set((this.servicoViaturas || []).map(sv => sv.viaturaId));
        const editIds = new Set((this._viaturasEdicao || []).map(sv => sv.viaturaId));
        const added = this._viaturasEdicao.filter(sv => !origIds.has(sv.viaturaId));
        const removed = this.servicoViaturas.filter(sv => !editIds.has(sv.viaturaId));

        for (const sv of removed) {
          await API.encerrarServicoViatura(this.servico.id, sv.id);
        }
        for (const sv of added) {
          await API.iniciarServicoViatura({
            servicoId: this.servico.id,
            viaturaId: sv.viaturaId,
            viaturaNome: sv.viaturaNome,
            motorista: sv.motorista || '',
            motoristaId: sv.motoristaId || '',
            tripulantes: sv.tripulantes || []
          });
        }

        const data = await API.getServicoAtual(Auth.userId);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.rotina = data.rotina || [];
        this.renderViaturaPanel();
        this.updateRotinaList();
        this.updateTimeline();

        this.closeEditarServico();
        Utils.log('editar_servico', `Comandante: ${comandanteNome || '-'}, Prontidão: ${prontidao}, Viaturas: +${added.length} -${removed.length}`, 'dashboard');
        Utils.showToast('Serviço atualizado com sucesso!', 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao salvar', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  closeEditarServico() {
    document.getElementById('editarServicoModal').style.display = 'none';
  },

  updateCountdown() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();

    let inicio = new Date(now);
    inicio.setHours(7, 30, 0, 0);

    if (h < 7 || (h === 7 && m < 30)) {
      inicio.setDate(inicio.getDate() - 1);
    }

    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 1);

    const diff = fim - now;

    if (diff <= 0) {
      document.getElementById('countdownTime').textContent = '00:00:00';
      document.getElementById('progressFill').style.width = '100%';
      document.getElementById('progressPercent').textContent = '100%';
      return;
    }

    document.getElementById('countdownTime').textContent = Utils.formatDuration(diff).display;
    const total = fim - inicio;
    const elapsed = now - inicio;
    const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));
    document.getElementById('progressFill').style.width = progress + '%';
    document.getElementById('progressPercent').textContent = Math.round(progress) + '%';
  },

  updateAtividadeAtual() {
    const now = new Date();
    const ct = now.getHours() * 60 + now.getMinutes();
    let atual = null;

    for (const a of this.rotina) {
      if (a.status === 'cancelada' || a.status === 'nao_realizada') continue;
      const [h, m] = a.horario.split(':').map(Number);
      const t = h * 60 + m;
      if (t <= ct && (!atual || t > atual._t)) atual = { ...a, _t: t };
    }

    if (atual) {
      document.getElementById('atividadeAtualNome').textContent = atual.nome;
      document.getElementById('atividadeAtualHorario').textContent = atual.horario;
      document.getElementById('atividadeAtualResp').textContent = 'Responsável: ' + (atual.responsavel || '-');
      const badgeMap = { concluida: ['Concluída', 'badge-green'], em_andamento: ['Em andamento', 'badge-yellow'], nao_iniciada: ['Pendente', 'badge-info'] };
      const b = badgeMap[atual.status] || badgeMap.nao_iniciada;
      const el = document.getElementById('atividadeStatus');
      el.textContent = b[0];
      el.className = 'badge ' + b[1];
    }
  },

  updateTelegrafia(t) {
    if (this.teleInterval) clearInterval(this.teleInterval);

    if (!t || !t.operador) {
      document.getElementById('telegrafiaNome').textContent = 'Sem operador';
      document.getElementById('telegrafiaAvatar').textContent = '--';
      document.getElementById('telegrafiaBadge').style.display = 'inline';
      if (this.telegrafiaVazioDesde) {
        document.getElementById('telegrafiaInicio').textContent = this.telegrafiaVazioDesde;
        const update = () => {
          const d = Date.now() - new Date(this.telegrafiaVazioDesde).getTime();
          if (d > 0) document.getElementById('telegrafiaTempo').textContent = Utils.formatDuration(d).display;
        };
        update();
        this.teleInterval = setInterval(update, 1000);
      } else {
        document.getElementById('telegrafiaTempo').textContent = '--:--:--';
        document.getElementById('telegrafiaInicio').textContent = '--:--';
      }
      return;
    }
    document.getElementById('telegrafiaBadge').style.display = 'none';
    document.getElementById('telegrafiaNome').textContent = t.operador;
    document.getElementById('telegrafiaAvatar').textContent = Utils.getInitials(t.operador);
    document.getElementById('telegrafiaInicio').textContent = t.horario || '--:--';

    if (t.horario) {
      const [h, m] = t.horario.split(':').map(Number);
      const start = new Date(); start.setHours(h, m, 0, 0);
      const update = () => {
        const d = Date.now() - start.getTime();
        if (d > 0) document.getElementById('telegrafiaTempo').textContent = Utils.formatDuration(d).display;
      };
      update();
      this.teleInterval = setInterval(update, 1000);
    }
  },

  updateOficiais(oficiais) {
    const el = document.getElementById('oficiaisList');
    const countEl = document.getElementById('oficiaisCount');
    if (countEl) countEl.textContent = oficiais.length;
    if (oficiais.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhum oficial presente</p></div>'; return; }

    const sorted = Utils.sortByAntiguidade(oficiais);
    el.innerHTML = sorted.map(o => `
      <div class="list-item">
        <div class="avatar">${Utils.getInitials(o.nome)}</div>
        <div style="flex:1">
          <div style="font-weight:500">${Utils.escapeHtml(o.nome)} ${o.anunciado ? '<span style="font-size:0.65rem;padding:1px 5px;border-radius:4px;background:var(--prontidao-dim);color:var(--prontidao-color)">📢</span>' : ''}</div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(o.posto || '')} ${o.unidade ? '- ' + Utils.escapeHtml(o.unidade) : ''}</div>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted)">${o.horarioEntrada || '--:--'}</div>
      </div>
    `).join('');
  },

  updateNotificacoes(notifs) {
    const el = document.getElementById('notificacoesList');
    if (notifs.length === 0) { el.innerHTML = '<div class="empty-state"><p>Sem notificações</p></div>'; return; }
    el.innerHTML = notifs.slice(0, 15).map(n => `
      <div class="list-item" style="opacity:${n.lida ? 0.5 : 1}">
        <div style="flex:1">
          <div style="font-size:0.85rem;${n.lida ? '' : 'font-weight:600'}">${Utils.escapeHtml(n.mensagem)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${n.horario || ''}</div>
        </div>
      </div>
    `).join('');
  },

  updateRotinaList() {
    const el = document.getElementById('rotinaList');
    document.getElementById('atividadesCount').textContent = this.rotina.length;
    document.getElementById('concluidasCount').textContent = this.rotina.filter(a => a.status === 'concluida').length;
    document.getElementById('equipeCount').textContent = (this.servico?.equipe || []).length;

    if (this.rotina.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhuma atividade registrada</p></div>'; return; }

    const badge = (s) => {
      const m = { concluida: '<span class="badge badge-green">Concluída</span>', em_andamento: '<span class="badge badge-yellow">Andamento</span>', nao_iniciada: '<span class="badge badge-info">Pendente</span>', cancelada: '<span class="badge badge-danger">Cancelada</span>', nao_realizada: '<span class="badge badge-warning">Prejudicada</span>' };
      return m[s] || m.nao_iniciada;
    };

    const sorted = [...this.rotina].sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
    el.innerHTML = sorted.map(a => `
      <div class="dash-atividade-item status-${a.status}">
        <div class="dash-atividade-item-horario">${a.horario}</div>
        <div class="dash-atividade-item-nome">${Utils.escapeHtml(a.nome)}</div>
        <div class="dash-atividade-item-responsavel">${Utils.escapeHtml(a.responsavel || '-')}</div>
        <div class="dash-atividade-item-status">${badge(a.status)}</div>
      </div>
    `).join('');
  },

  updateTimeline() {
    const el = document.getElementById('timeline');
    const opPrefixes = ['r-ofe-', 'r-ofs-', 'r-sva-', 'r-svr-', 'r-desp-', 'r-ret-', 'r-oc-', 'r-ocf-', 'r-tele-'];
    const items = this.rotina.filter(a => a.status === 'concluida' && (a.concluidoPor === 'Sistema' || opPrefixes.some(p => (a.id || '').startsWith(p)))).sort((a, b) => (a.horario || '').localeCompare(b.horario || '')).slice(-10).reverse();
    if (items.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhum evento</p></div>'; return; }
    const catColors = { 'Ocorrências': '#e53935', 'Ocorrência': '#e53935', 'Viaturas': '#ff6d00', 'Oficiais': '#1565c0', 'Telegrafia': '#6a1b9a', 'Passagem de serviço': '#2e7d32' };
    const catIcons = { 'Ocorrências': '🚨', 'Ocorrência': '🚨', 'Viaturas': '🚒', 'Oficiais': '🎖️', 'Telegrafia': '📡' };
    el.innerHTML = items.map(a => {
      const prog = a.programa || '';
      const color = catColors[prog] || '#546e7a';
      const icon = catIcons[prog] || (a.nome?.match(/^[^\w]*/)?.[0] || '📌');
      return `
        <div class="timeline-item" style="border-left:3px solid ${color}">
          <div class="timeline-time">${a.horaConclusao || a.horario}</div>
          <div class="timeline-content">
            <span style="display:inline-block;min-width:20px;text-align:center">${icon}</span>
            ${Utils.escapeHtml(a.nome?.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+\s*/u, '') || a.nome)}
            ${prog ? `<span style="display:inline-block;font-size:0.65rem;padding:1px 6px;border-radius:8px;background:${color}22;color:${color};font-weight:600;margin-left:4px;vertical-align:middle">${Utils.escapeHtml(prog)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  },

  renderViaturaPanel() {
    const container = document.getElementById('viaturasContainer');
    const badge = document.getElementById('viaturasBadge');
    if (!container) return;
    if (!this.servicoViaturas || this.servicoViaturas.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Nenhuma viatura em serviço</p></div>';
      if (badge) badge.style.display = 'none';
      return;
    }
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = this.servicoViaturas.length; }

    const statusCores = { ativa: '#00c853', em_ocorrencia: '#f44336', retornando: '#ff9100', encerrada: '#9e9e9e', indisponivel: '#e53935' };
    const statusLabels = { ativa: 'Disponível', em_ocorrencia: 'Em atendimento', retornando: 'Retornando', encerrada: 'Encerrada', indisponivel: 'Indisponível' };

    container.innerHTML = this.servicoViaturas.map(sv => {
      const st = sv.status || 'ativa';
      const tipo = sv.viaturaTipo || sv.viaturaNome?.substring(0, 3) || '?';
      const tripulantesStr = (sv.tripulantes || []).map(t => t.nome).join(', ');
      const ocAtiva = (this.ocorrencias || []).find(o =>
        (o.viaturaIds || []).includes(sv.viaturaId) && o.status !== 'finalizada'
      );
      const tc = API.getTipoCor(tipo);

      return `
        <div style="display:flex;align-items:stretch;gap:12px;padding:12px;border:1px solid ${ocAtiva ? '#e5393566' : 'var(--border-color)'};border-radius:12px;margin-bottom:8px;background:${ocAtiva ? '#e5393508' : 'var(--surface-color)'}">
          <div style="width:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:10px;background:${tc}18;color:${tc};font-weight:700;font-size:0.75rem;flex-shrink:0">
            <div style="font-size:1.4rem;line-height:1">${tipo}</div>
            <div style="font-size:0.55rem;text-transform:uppercase;margin-top:2px">${API.getTipoNome(tipo)}</div>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
              <span style="font-weight:600;font-size:0.95rem">${Utils.escapeHtml(sv.viaturaNome || '')}</span>
              <span style="display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;padding:2px 8px;border-radius:20px;background:${statusCores[st]}22;color:${statusCores[st]};font-weight:600"><span style="width:6px;height:6px;border-radius:50%;background:${statusCores[st]};display:inline-block"></span>${statusLabels[st] || st}</span>
              ${ocAtiva ? `<span style="font-size:0.65rem;padding:2px 6px;border-radius:12px;background:#e5393522;color:#e53935;font-weight:600">🚨 OCORRÊNCIA #${ocAtiva.numero || ''}</span>` : ''}
            </div>
            ${ocAtiva ? `<div style="font-size:0.82rem;color:#e53935;margin-bottom:2px;font-weight:500">${Utils.escapeHtml(ocAtiva.natureza || '')} — ${Utils.escapeHtml(ocAtiva.titulo || '')}</div>` : ''}
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:2px">
              <strong>Motorista:</strong> ${Utils.escapeHtml(sv.motorista || '-')}
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px">
              <strong>Tripulantes:</strong> ${tripulantesStr || '-'}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">
              ${sv.horarioSaida ? 'Saída: ' + Utils.escapeHtml(sv.horarioSaida) : ''}
              ${sv.horarioRetorno ? ' — Retorno: ' + Utils.escapeHtml(sv.horarioRetorno) : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;justify-content:center">
            ${st === 'ativa' ? `<button class="btn btn-sm" style="font-size:0.75rem" onclick="Dashboard.showOcorrenciaModal('${sv.viaturaId}', '${sv.id}')">Ocorrência</button>` : ''}
            ${st === 'ativa' ? `<button class="btn btn-sm btn-danger" style="font-size:0.75rem" onclick="Dashboard.editarServicoViatura('${sv.id}')">Editar</button>` : ''}
            ${st === 'em_ocorrencia' && ocAtiva ? `
              <button class="btn btn-sm" style="font-size:0.75rem;background:#00c85322;color:#00c853;border:1px solid #00c85344" onclick="Dashboard.finalizarOcorrencia('${ocAtiva.id}')">Finalizar Ocorrência</button>
            ` : ''}
          </div>
        </div>`;
    }).join('');
  },

  async retornarViatura(servicoViaturaId) {
    if (!confirm('Confirmar retorno da viatura ao quartel?')) return;
    try {
      const result = await API.retornarViatura(servicoViaturaId);
      if (result.success) {
        Utils.showToast('Viatura retornando ao quartel', 'success');
        const data = await API.getServicoAtual(Auth.userId);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async editarServicoViatura(servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => x.id === servicoViaturaId);
    if (!sv) return;
    const equipe = this.servico?.equipe || [];
    const outrasViaturas = (this.servicoViaturas || []).filter(x => x.id !== servicoViaturaId && x.Status !== 'encerrado');
    const ocupados = new Set();
    outrasViaturas.forEach(x => {
      if (x.motoristaId) ocupados.add(x.motoristaId);
      (x.tripulantes || []).forEach(t => { if (t.id) ocupados.add(t.id); });
    });
    const atuais = new Set((sv.tripulantes || []).map(t => t.id).filter(Boolean));
    const atualMotoristaId = sv.motoristaId;

    document.getElementById('modalTitle').textContent = `Editar Viatura - ${sv.viaturaNome}`;
    document.getElementById('modalBody').innerHTML = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Motorista</label>
        <select class="input select" id="editViaturaMotorista">
          <option value="">Selecione</option>
          ${equipe.map(m => {
            const disabled = ocupados.has(m.id) && m.id !== atualMotoristaId;
            return `<option value="${m.id}" ${sv.motoristaId === m.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${Utils.escapeHtml(m.nome)} — ${m.posto || ''}${disabled ? ' (em outra viatura)' : ''}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Tripulantes</label>
        <div id="editViaturaTripulantes" style="display:flex;flex-direction:column;gap:4px;max-height:260px;overflow-y:auto;padding:4px 0">
          ${equipe.filter(m => m.id !== atualMotoristaId).map(m => {
            const checked = atuais.has(m.id);
            const disabled = ocupados.has(m.id) && !checked;
            return `<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? 0.45 : 1}">
              <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="accent-color:var(--prontidao-color)">
              <span>${Utils.escapeHtml(m.nome)} — ${m.posto || ''}${disabled ? ' <span style="color:var(--text-muted);font-size:0.75rem">(em outra viatura)</span>' : ''}</span>
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input select" id="editViaturaStatus">
          <option value="ativa" ${sv.status === 'ativa' ? 'selected' : ''}>Em atendimento</option>
          <option value="retornando" ${sv.status === 'retornando' ? 'selected' : ''}>Retornando</option>
          <option value="encerrada" ${sv.status === 'encerrada' ? 'selected' : ''}>Encerrada</option>
        </select>
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.saveServicoViatura('${servicoViaturaId}')">Salvar</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async saveServicoViatura(servicoViaturaId) {
    const motoristaId = document.getElementById('editViaturaMotorista').value;
    const status = document.getElementById('editViaturaStatus').value;
    const equipe = this.servico?.equipe || [];

    let motorista = '';
    if (motoristaId) {
      const m = equipe.find(x => x.id === motoristaId);
      motorista = m?.nome || '';
    }
    const checked = document.querySelectorAll('#editViaturaTripulantes input[type=checkbox]:checked');
    const tripulantes = Array.from(checked).map(cb => {
      const m = equipe.find(x => x.id === cb.value);
      return m ? { id: m.id, nome: m.nome } : null;
    }).filter(Boolean);

    if (motoristaId && tripulantes.some(t => t.id === motoristaId)) {
      Utils.showToast('Motorista não pode ser também tripulante', 'error');
      return;
    }

    try {
      const result = await API.editarServicoViatura({
        servicoViaturaId, motorista, motoristaId, tripulantes, status
      });
      if (result.success) {
        Utils.showToast('Viatura atualizada', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async showOcorrenciaNova() {
    const ativas = (this.servicoViaturas || []).filter(sv => sv.status === 'ativa');
    if (!ativas.length) { Utils.showToast('Nenhuma viatura disponível para despacho', 'warning'); return; }
    const equipe = this.servico?.equipe || [];

    document.getElementById('modalTitle').textContent = '🚨 Nova Ocorrência — Despacho de Viatura';
    document.getElementById('modalBody').innerHTML = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:600">Selecionar Viatura</label>
        <div id="ocorrViaturasList" style="display:flex;flex-direction:column;gap:6px;margin-top:6px">
          ${ativas.map(sv => {
            const tc = API.getTipoCor(sv.viaturaTipo || sv.viaturaNome?.substring(0, 3));
            return `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:2px solid var(--border-color);border-radius:10px;cursor:pointer;transition:all 150ms" class="ocorr-viat-option" data-svid="${sv.id}" data-vid="${sv.viaturaId}">
              <input type="radio" name="ocorrViatura" value="${sv.id}" style="width:18px;height:18px" onchange="Dashboard._onOcorrViaturaSelect('${sv.id}')">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:${tc}22;color:${tc};font-weight:700;font-size:0.7rem;flex-shrink:0">${sv.viaturaTipo || '?'}</span>
              <div>
                <div style="font-size:0.88rem;font-weight:600;color:var(--text-primary)">${Utils.escapeHtml(sv.viaturaNome || '')}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">Motorista: ${Utils.escapeHtml(sv.motorista || '-')}</div>
              </div>
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Natureza</label>
        <select class="input select" id="ocorrNatureza">
          ${Dashboard._naturezaOptions()}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Título</label>
        <input type="text" class="input" id="ocorrTitulo" placeholder="Ex: Incêndio em residência na Rua X">
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Observações</label>
        <textarea class="input" id="ocorrDescricao" rows="3" placeholder="Detalhes da ocorrência, endereço, referências..."></textarea>
      </div>
      <div id="ocorrEfetivoDisplay" style="display:none;margin-bottom:12px">
        <label class="input-label">Efetivo da Viatura</label>
        <div style="font-size:0.85rem;color:var(--text-secondary);padding:8px 12px;border:1px solid var(--border-color);border-radius:8px" id="ocorrEfetivoContent"></div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted)">Prontidão do serviço: <strong>${this.servico?.prontidao || 'verde'}</strong> &mdash; Horário de acionamento: <strong>${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</strong></div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="btnDespacharOcorr" onclick="Dashboard.despacharECriarOcorrencia()" disabled>🚨 Despachar & Registrar</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  _onOcorrViaturaSelect(servicoViaturaId) {
    document.querySelectorAll('.ocorr-viat-option').forEach(el => {
      el.style.borderColor = el.dataset.svid === servicoViaturaId ? 'var(--prontidao-color, #00c853)' : 'var(--border-color)';
      el.style.background = el.dataset.svid === servicoViaturaId ? 'var(--prontidao-dim, rgba(0,200,83,0.08))' : 'transparent';
    });
    const sv = (this.servicoViaturas || []).find(x => x.id === servicoViaturaId);
    if (sv) {
      const efetivo = [sv.motorista, ...(sv.tripulantes || []).map(t => t.nome)].filter(Boolean);
      document.getElementById('ocorrEfetivoDisplay').style.display = 'block';
      document.getElementById('ocorrEfetivoContent').textContent = efetivo.join(', ') || '-';
    }
    document.getElementById('btnDespacharOcorr').disabled = false;
    this._selectedOcorrServicoViaturaId = servicoViaturaId;
  },

  async despacharECriarOcorrencia() {
    const svId = this._selectedOcorrServicoViaturaId;
    if (!svId) { Utils.showToast('Selecione uma viatura', 'warning'); return; }
    const titulo = document.getElementById('ocorrTitulo').value.trim();
    if (!titulo) { Utils.showToast('Título é obrigatório', 'warning'); return; }
    const natureza = document.getElementById('ocorrNatureza').value;
    const descricao = document.getElementById('ocorrDescricao').value.trim();
    const sv = (this.servicoViaturas || []).find(x => x.id === svId);
    const efetivo = [sv?.motorista, ...(sv?.tripulantes || []).map(t => t.nome)].filter(Boolean);

    try {
      const dataOcorrencia = document.getElementById('ocorrData')?.value || '';
      const horaOcorrencia = document.getElementById('ocorrHora')?.value || '';
      const ocorrResult = await API.criarOcorrencia({
        titulo, natureza, descricao,
        viaturaIds: [sv?.viaturaId],
        servicoViaturaIds: [svId],
        efetivo: efetivo,
        prontidaoCor: this.servico?.prontidao || 'verde',
        servicoId: this.servico?.id,
        dataOcorrencia: dataOcorrencia || undefined,
        horaOcorrencia: horaOcorrencia || undefined
      });
      if (!ocorrResult.success) { Utils.showToast(ocorrResult.error || 'Erro ao criar ocorrência', 'error'); return; }
      const despResult = await API.despacharViatura(svId, ocorrResult.numero, titulo);
      if (despResult.success) {
        Utils.log('despacho_ocorrencia', `Viatura ${sv?.viaturaNome} despachada — Ocorrência #${ocorrResult.numero}: ${titulo} (${natureza || 's/natureza'})`, 'dashboard');
        Utils.showToast(`Viatura despachada — Ocorrência #${ocorrResult.numero} registrada`, 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        if (data.telegrafia) this.telegrafia = data.telegrafia;
        this.renderViaturaPanel();
        this.updateTelegrafia(data.telegrafia);
        this.updateTimeline();
      } else {
        Utils.showToast(despResult.error || 'Erro ao despachar', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  showOcorrenciaModal(viaturaId, servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => x.id === servicoViaturaId);
    const efetivo = [sv?.motorista, ...(sv?.tripulantes || []).map(t => t.nome)].filter(Boolean);

    document.getElementById('modalTitle').textContent = 'Nova Ocorrência';
    document.getElementById('modalBody').innerHTML = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Viatura</label>
        <input type="text" class="input" value="${Utils.escapeHtml(sv?.viaturaNome || '')}" disabled>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Efetivo</label>
        <div style="font-size:0.85rem;color:var(--text-secondary);padding:8px 12px;border:1px solid var(--border-color);border-radius:8px">${efetivo.join(', ') || '-'}</div>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Natureza</label>
        <select class="input select" id="ocorrNatureza">
          ${Dashboard._naturezaOptions()}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Título</label>
        <input type="text" class="input" id="ocorrTitulo" placeholder="Ex: Incêndio em residência">
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Observações</label>
        <textarea class="input" id="ocorrDescricao" rows="3" placeholder="Detalhes da ocorrência"></textarea>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div class="input-group" style="flex:1">
          <label class="input-label">Data (deixe vazio para agora)</label>
          <input type="date" class="input" id="ocorrData" value="">
        </div>
        <div class="input-group" style="flex:1">
          <label class="input-label">Hora (deixe vazio para agora)</label>
          <input type="time" class="input" id="ocorrHora" value="">
        </div>
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted)">Prontidão do serviço: <strong>${this.servico?.prontidao || 'verde'}</strong> &mdash; Hora de acionamento: ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.criarOcorrencia('${viaturaId}', '${servicoViaturaId}')">Criar Ocorrência</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async criarOcorrencia(viaturaId, servicoViaturaId) {
    const titulo = document.getElementById('ocorrTitulo').value.trim();
    if (!titulo) { Utils.showToast('Título é obrigatório', 'warning'); return; }
    const natureza = document.getElementById('ocorrNatureza')?.value || '';
    const descricao = document.getElementById('ocorrDescricao').value;
    const dataOcorrencia = document.getElementById('ocorrData')?.value || '';
    const horaOcorrencia = document.getElementById('ocorrHora')?.value || '';
    const sv = (this.servicoViaturas || []).find(x => x.id === servicoViaturaId);
    const efetivo = [sv?.motorista, ...(sv?.tripulantes || []).map(t => t.nome)].filter(Boolean);

    try {
      const result = await API.criarOcorrencia({
        titulo, natureza, descricao,
        viaturaIds: [viaturaId],
        servicoViaturaIds: [servicoViaturaId],
        efetivo: efetivo,
        prontidaoCor: this.servico?.prontidao || 'verde',
        servicoId: this.servico?.id,
        dataOcorrencia: dataOcorrencia || undefined,
        horaOcorrencia: horaOcorrencia || undefined
      });
      if (result.success) {
        Utils.log('criar_ocorrencia', `Ocorrência #${result.numero}: ${titulo} (${natureza || 's/natureza'})`, 'dashboard');
        Utils.showToast('Ocorrência registrada', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  showEditarOcorrencia(ocorrId) {
    const oc = (this.ocorrencias || []).find(x => x.id === ocorrId);
    if (!oc) return;
    document.getElementById('modalTitle').textContent = `Editar Ocorrência #${oc.numero}`;
    document.getElementById('modalBody').innerHTML = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Natureza</label>
        <select class="input select" id="editOcorrNatureza">
          ${Dashboard._naturezaOptions(oc.natureza)}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Título</label>
        <input type="text" class="input" id="editOcorrTitulo" value="${Utils.escapeHtml(oc.titulo || '')}">
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Observações</label>
        <textarea class="input" id="editOcorrDescricao" rows="3">${Utils.escapeHtml(oc.descricao || '')}</textarea>
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.salvarEditarOcorrencia('${oc.id}')">Salvar</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async salvarEditarOcorrencia(ocorrId) {
    const titulo = document.getElementById('editOcorrTitulo').value.trim();
    const natureza = document.getElementById('editOcorrNatureza').value;
    const descricao = document.getElementById('editOcorrDescricao').value.trim();
    if (!titulo) { Utils.showToast('Título é obrigatório', 'warning'); return; }
    try {
      const result = await API.editarOcorrencia({ id: ocorrId, titulo, natureza, descricao });
      if (result.success) {
        Utils.showToast('Ocorrência atualizada', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async finalizarOcorrencia(ocorrId) {
    if (!confirm('Finalizar esta ocorrência? A viatura retornará automaticamente à base.')) return;
    try {
      const result = await API.finalizarOcorrencia(ocorrId);
      if (result.success) {
        Utils.log('finalizar_ocorrencia', `Ocorrência #${ocorrId} finalizada`, 'dashboard');
        Utils.showToast('Ocorrência finalizada. Viatura retornou à base e está disponível', 'success');
        const data = await API.getServicoAtual(Auth.userId);
        this.ocorrencias = data.ocorrencias || [];
        this.servicoViaturas = data.servicoViaturas || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  mostrarSelecaoTelegrafia() {
    const equipe = this.servico?.equipe || [];
    const idsEmOcorrencia = new Set();
    (this.servicoViaturas || []).filter(sv => sv.status === 'em_ocorrencia').forEach(sv => {
      if (sv.motoristaId) idsEmOcorrencia.add(sv.motoristaId);
      (sv.tripulantes || []).forEach(t => { if (t.id) idsEmOcorrencia.add(t.id); });
    });
    const atualId = this.telegrafia?.militarId;
    const disponiveis = equipe.filter(m => !idsEmOcorrencia.has(m.id));

    document.getElementById('modalTitle').textContent = 'Selecionar Operador de Telegrafia';
    document.getElementById('modalBody').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px">
        ${disponiveis.length === 0 ? '<div class="empty-state"><p>Todos os militares estão em ocorrência</p><p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Nenhum operador disponível no quartel</p></div>' :
          disponiveis.map(m => {
            const selecionado = m.id === atualId;
            return `
            <label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:2px solid ${selecionado ? 'var(--prontidao-color)' : 'var(--border-color)'};border-radius:10px;cursor:pointer;transition:all 150ms" onclick="${selecionado ? `Dashboard.limparTelegrafia()` : `Dashboard.assumirTelegrafia('${m.id}')`}">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${selecionado ? 'var(--prontidao-color)' : 'var(--surface-color)'};color:${selecionado ? 'var(--surface-color)' : 'var(--text-secondary)'};font-weight:600;font-size:0.8rem;flex-shrink:0">${Utils.getInitials(m.nome)}</span>
              <div>
                <div style="font-size:0.88rem;font-weight:600;color:var(--text-primary)">${Utils.escapeHtml(m.nome)}</div>
                <div style="font-size:0.75rem;color:var(--text-secondary)">${m.posto || ''}${selecionado ? ' — Atual operador' : ''}</div>
              </div>
            </label>`;
          }).join('')}
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Fechar</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async assumirTelegrafia(militarId) {
    if (!this.servico?.id) return;
    try {
      const result = await API.registrarTelegrafia(this.servico.id, militarId);
      if (result.success) {
        Utils.showToast('Telegrafia assumida', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.telegrafia = data.telegrafia || null;
        this.telegrafiaVazioDesde = data.telegrafiaVazioDesde || null;
        this.updateTelegrafia(data.telegrafia);
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async limparTelegrafia() {
    if (!this.servico?.id) return;
    if (!confirm('Remover operador de telegrafia?')) return;
    try {
      const result = await API.registrarTelegrafia(this.servico.id, '');
      if (result.success) {
        Utils.showToast('Telegrafia liberada', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.telegrafia = data.telegrafia || null;
        this.telegrafiaVazioDesde = data.telegrafiaVazioDesde || null;
        this.updateTelegrafia(data.telegrafia);
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
