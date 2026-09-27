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
    this._initDragAndDrop();
    await this.loadServico();
  },

  _DRAG_KEY: 'sgpo_dashboard_block_order',

  _initDragAndDrop() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    this._restoreBlockOrder();
    const cards = grid.querySelectorAll('.dash-card[data-block]');
    cards.forEach(card => {
      card.addEventListener('dragstart', (e) => {
        if (!card._handleActive) { e.preventDefault(); return; }
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.block);
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card._handleActive = false;
        card.setAttribute('draggable', 'false');
        grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dragging = grid.querySelector('.dragging');
        if (dragging && dragging !== card) {
          card.classList.add('drag-over');
        }
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const dragging = grid.querySelector('.dragging');
        if (!dragging || dragging === card) return;
        const allCards = [...grid.children];
        const dragIdx = allCards.indexOf(dragging);
        const dropIdx = allCards.indexOf(card);
        if (dragIdx < dropIdx) {
          grid.insertBefore(dragging, card.nextSibling);
        } else {
          grid.insertBefore(dragging, card);
        }
        this._saveBlockOrder();
      });
    });

    grid.querySelectorAll('.drag-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const card = handle.closest('[data-block]');
        if (card) {
          card._handleActive = true;
          card.setAttribute('draggable', 'true');
        }
      });
    });
  },

  _saveBlockOrder() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
    const order = [...grid.children].map(el => el.dataset.block || el.className.split(' ')[0]);
    try { localStorage.setItem(this._DRAG_KEY, JSON.stringify(order)); } catch(e) {}
  },

  _restoreBlockOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(this._DRAG_KEY));
      if (!Array.isArray(saved) || saved.length < 3) return;
      const grid = document.querySelector('.dashboard-grid');
      if (!grid) return;
      const children = [...grid.children];
      saved.forEach(key => {
        const el = children.find(c => (c.dataset.block || c.className.split(' ')[0]) === key);
        if (el) grid.appendChild(el);
      });
    } catch(e) {}
  },

  _naturezaOptions(selected) {
    return '<option value="">Selecione...</option>' + this._naturezas.filter(n => n.Status !== 'removido').map(n => `<option value="${n.valor || n.nome}" ${selected === (n.valor || n.nome) ? 'selected' : ''}>${n.nome}</option>`).join('');
  },

  async loadServico() {
    try {
      const data = await API.getServicoAtual(Auth.userId);
      if (!data || !data.servico) {
        const storedId = localStorage.getItem('sgpo_active_servico_id');
        if (storedId) {
          localStorage.removeItem('sgpo_active_servico_id');
          const retry = await API.getServicoAtual(Auth.userId);
          if (retry && retry.servico) {
            const hojeCheck = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
            if (retry.servico.data && retry.servico.data < hojeCheck) {
              await API.encerrarServico(retry.servico.id);
              Utils.showToast('O plantão anterior foi encerrado automaticamente no início do novo dia.', 'info');
              document.getElementById('noServiceModal').style.display = 'flex';
              return;
            }
            this.servicoData = retry.servico;
            this.rotinaItens = retry.rotina || [];
            this.militares = retry.militares || [];
            this.telegrafiaData = retry.telegrafia;
            this.oficiaisData = retry.oficiais || [];
            this.oficiaisTodos = retry.oficiaisTodos || [];
            this.notificacoes = retry.notificacoes || [];
            this.extrasData = retry.extras || [];
            this.inicioServicoTime = this.servicoData.inicioServico ? new Date(this.servicoData.inicioServico) : null;
            this._servicoActive = true;
            this.carregarPainel();
            this.iniciarRelogio();
            this.atualizarFotos();
            document.getElementById('noServiceModal').style.display = 'none';
            return;
          }
        }
        document.getElementById('noServiceModal').style.display = 'flex';
        return;
      }

      // Se a data do serviço for anterior a hoje, encerra automaticamente no início do próximo dia
      const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      if (data.servico.data && data.servico.data < hoje) {
        await API.encerrarServico(data.servico.id);
        Utils.showToast('O plantão anterior foi encerrado automaticamente no início do novo dia.', 'info');
        document.getElementById('noServiceModal').style.display = 'flex';
        return;
      }

      if (Auth.nivelPermissao !== 'GB' && Auth.userRole !== 'admin') {
        const isMembro = (data.servico.equipe || []).some(m => m.id === Auth.userId) || data.servico.comandanteId === Auth.userId;
        if (!isMembro) {
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
      }

      this.servico = data.servico;
      this.rotina = data.rotina || [];
      this.telegrafia = data.telegrafia || null;
      this.telegrafiaVazioDesde = data.telegrafiaVazioDesde || null;
      this.ocorrencias = data.ocorrencias || [];

      // Normalizar viaturas na base que não estão em nenhuma ocorrência ativa:
      const ocsAtivasInit = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
      const vidsEmOcorrInit = new Set();
      ocsAtivasInit.forEach(oc => (oc.viaturaIds || []).forEach(vid => vidsEmOcorrInit.add(String(vid))));
      this.servicoViaturas = (data.servicoViaturas || []).map(sv => {
        if (sv && sv.status === 'retornando' && !vidsEmOcorrInit.has(String(sv.viaturaId))) {
          return { ...sv, status: 'ativa' };
        }
        return sv;
      });
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

      Sync.on('rotina_updated', (r) => { this.rotina = r; this.updateRotinaList(); this.updateAtividadeAtual(); this.updateTimeline(); this._refreshAtividadesModalIfOpen(); });
      Sync.on('telegrafia_updated', (t, vazioDesde) => { this.telegrafia = t; this.telegrafiaVazioDesde = vazioDesde || null; this.updateTelegrafia(t); });
      Sync.on('telegrafiavazio_updated', (v) => { this.telegrafiaVazioDesde = v; if (!this.telegrafia?.operador) this.updateTelegrafia(null); });
      Sync.on('oficiais_updated', (o) => { this.updateOficiais(o); this.updateTimeline(); });
      Sync.on('notificacoes_updated', (n) => this.updateNotificacoes(n));
      Sync.on('viaturas_updated', (v) => { this.servicoViaturas = v || []; this.renderViaturaPanel(); this.updateTimeline(); });
      Sync.on('ocorrencias_updated', (o) => { this.ocorrencias = o || []; this.renderViaturaPanel(); this.updateTimeline(); });
      Sync.on('servico_updated', (s) => {
        if (s && s.rotina) { this.rotina = s.rotina; this.updateRotinaList(); this.updateTimeline(); }
      });

      const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
      const syncInterval = (parseInt(config.syncIntervalo) || 30) * 1000;
      Sync.start(this.servico.id, syncInterval);

      if (this.rotina.length > 0) {
        setTimeout(() => this.showAtividadesModal(), 600);
      }

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

  encerrarServico() {
    if (!this.servico) return;
    document.getElementById('modalTitle').textContent = '⚠️ Encerrar Serviço Ativo';
    document.getElementById('modalBody').innerHTML = `
      <div style="padding:16px 0;text-align:center">
        <div style="font-size:2.4rem;margin-bottom:8px">🏁</div>
        <p style="font-weight:700;font-size:1.05rem;color:var(--text-primary);margin-bottom:8px">Deseja realmente encerrar o serviço atual?</p>
        <p style="font-size:0.85rem;color:var(--text-secondary)">Esta ação irá finalizar o plantão e desconectar o serviço ativo.</p>
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-danger" onclick="Dashboard.confirmarEncerrarServico()">Confirmar Encerramento</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async confirmarEncerrarServico() {
    this.closeModal();
    try {
      const result = await API.encerrarServico(this.servico.id);
      if (result.success) {
        Utils.log('encerrar_servico', 'Serviço encerrado via dashboard', 'dashboard');
        Utils.showToast('Serviço encerrado com sucesso', 'success');
        clearInterval(this.countdownInterval);
        Sync.stop();
        this.servico = null;
        this.rotina = [];
        this.telegrafia = null;
        document.getElementById('noServiceModal').style.display = 'flex';
      } else {
        Utils.showToast(result.error || 'Erro ao encerrar serviço', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
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

  openEditSubModal(title, bodyHtml, footerHtml) {
    const modal = document.getElementById('editSubModal');
    if (!modal) return;
    document.getElementById('editSubModalTitle').textContent = title;
    document.getElementById('editSubModalBody').innerHTML = bodyHtml;
    document.getElementById('editSubModalFooter').innerHTML = footerHtml || '<button class="btn btn-secondary" onclick="Dashboard.closeEditSubModal()">Fechar</button>';
    modal.style.display = 'flex';
    modal.style.zIndex = '10000';
  },

  closeEditSubModal() {
    const modal = document.getElementById('editSubModal');
    if (modal) modal.style.display = 'none';
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

    // Atualiza opções do select de comandante com a equipe atual
    const sel = document.getElementById('editServicoComandante');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">Selecionar comandante</option>' + this._equipeEdicao.map(m => 
        `<option value="${m.id}" ${m.id === cur ? 'selected' : ''}>${m.nome}${m.posto ? ' - ' + m.posto : ''}</option>`
      ).join('');
    }
  },

  removeEquipeEdit(id) {
    this._equipeEdicao = this._equipeEdicao.filter(m => m.id !== id);
    this._renderEquipeEdicao();
  },

  async showAddEquipeEditModal() {
    const militares = await API.getMilitares() || [];
    const existingIds = new Set(this._equipeEdicao.map(m => m.id));
    const disponiveis = militares.filter(m => !existingIds.has(m.id) && m.ativo !== false && m.Status !== 'removido');

    const body = disponiveis.length === 0
      ? '<p style="color:var(--text-secondary);font-size:.85rem;padding:12px;text-align:center">Nenhum militar disponível</p>'
      : disponiveis.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:6px">
          <div>
            <div style="font-size:.88rem;font-weight:500">${Utils.escapeHtml(m.nome)}</div>
            <div style="font-size:.75rem;color:var(--text-secondary)">${Utils.escapeHtml(m.posto || m.graduacao || '')}</div>
          </div>
          <button class="btn btn-primary btn-sm" style="font-size:.75rem;padding:4px 10px" onclick="Dashboard._addMembroEdicao('${m.id}','${m.nome.replace(/'/g, "\\'")}','${(m.posto || m.graduacao || '').replace(/'/g, "\\'")}')">+ Adicionar</button>
        </div>
      `).join('');

    this.openEditSubModal('Adicionar Integrante à Equipe', body);
  },

  _addMembroEdicao(id, nome, posto) {
    if (this._equipeEdicao.some(m => m.id === id)) return;
    this._equipeEdicao.push({ id, nome, posto: posto || '' });
    this._renderEquipeEdicao();
    this.closeEditSubModal();
    Utils.showToast(`${nome} adicionado(a) à equipe`, 'success');
  },

  _renderViaturasEdicao() {
    const el = document.getElementById('editServicoViaturasList');
    if (!el) return;
    const viaturas = this._viaturasEdicao || [];
    if (viaturas.length === 0) { el.innerHTML = '<p style="color:var(--text-secondary);font-size:.85rem">Nenhuma viatura vinculada</p>'; return; }
    el.innerHTML = viaturas.map(sv => {
      const tc = API.getTipoCor(sv.viaturaTipo || sv.viaturaNome?.substring(0, 3) || '?');
      const comNome = sv.comandante || (sv.tripulantes || []).find(t => t.funcao === 'Comandante')?.nome || '-';
      const motNome = sv.motorista || '-';
      const auxs = (sv.tripulantes || []).filter(t => t.funcao === 'Auxiliar' || (!t.funcao && t.id !== sv.motoristaId && t.id !== sv.comandanteId));
      const auxStr = auxs.map(t => t.nome).join(', ');
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:6px;border-left:3px solid ${tc}">
          <div style="flex:1;min-width:0">
            <div style="font-size:.88rem;font-weight:600">${Utils.escapeHtml(sv.viaturaNome)}</div>
            <div style="font-size:.78rem;color:var(--text-secondary)">Cmdt: <strong>${Utils.escapeHtml(comNome)}</strong> | Mot: <strong>${Utils.escapeHtml(motNome)}</strong> | Aux: ${auxStr || 'Nenhum'}</div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn btn-secondary btn-sm" style="font-size:.72rem;padding:3px 8px" onclick="Dashboard.editarViaturaEmEdicao('${sv.id}')">Editar</button>
            <button class="btn btn-danger btn-sm" style="font-size:.72rem;padding:3px 8px" onclick="Dashboard.removerViaturaEdicao('${sv.id}')">✕</button>
          </div>
        </div>`;
    }).join('');
  },

  async showAddViaturaEditModal() {
    const existingIds = new Set((this._viaturasEdicao || []).map(sv => sv.viaturaId));
    const allViaturas = await API.getViaturas() || [];
    const available = allViaturas.filter(v => v.ativo !== false && v.Status !== 'removido' && !existingIds.has(v.id));

    const body = available.length === 0
      ? '<p style="color:var(--text-secondary);font-size:.85rem;padding:12px;text-align:center">Nenhuma viatura disponível</p>'
      : available.map(v => {
        const tc = API.getTipoCor(v.tipo);
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--surface,#1a1a2e);border-radius:8px;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:${tc}22;color:${tc};font-weight:700;font-size:.65rem">${v.tipo || '?'}</span>
              <div>
                <span style="font-size:.88rem;font-weight:500">${Utils.escapeHtml(v.nome)}</span>
                ${v.placa ? `<span style="font-size:.75rem;color:var(--text-secondary);margin-left:6px">${v.placa}</span>` : ''}
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="font-size:.75rem;padding:4px 10px" onclick="Dashboard._addViaturaEdicao('${v.id}','${v.nome.replace(/'/g, "\\'")}')">+ Adicionar</button>
          </div>`;
      }).join('');

    this.openEditSubModal('Adicionar Viatura ao Serviço', body);
  },

  async _addViaturaEdicao(viaturaId, viaturaNome) {
    if ((this._viaturasEdicao || []).some(sv => sv.viaturaId === viaturaId)) return;
    const agora = Utils.formatDateTime(new Date());
    const tempId = 'sv-temp-' + Date.now();
    const novo = { id: tempId, servicoId: this.servico?.id || '', viaturaId, viaturaNome, comandante: '', comandanteId: '', motorista: '', motoristaId: '', tripulantes: [], horarioSaida: agora, horarioRetorno: '', status: 'ativa', Status: 'ativo' };
    this._viaturasEdicao = [...(this._viaturasEdicao || []), novo];
    this._renderViaturasEdicao();
    this.closeEditSubModal();
    Utils.showToast(`Viatura ${viaturaNome} adicionada`, 'success');
  },

  editarViaturaEmEdicao(servicoViaturaId) {
    const sv = (this._viaturasEdicao || []).find(x => x.id === servicoViaturaId);
    if (!sv) return;
    const equipe = this._equipeEdicao || [];
    const comandanteTrip = (sv.tripulantes || []).find(t => t.funcao === 'Comandante');
    const comandanteId = sv.comandanteId || comandanteTrip?.id || '';
    const motoristaId = sv.motoristaId || '';
    const atuaisAux = new Set((sv.tripulantes || []).filter(t => t.funcao === 'Auxiliar' || (!t.funcao && t.id !== motoristaId && t.id !== comandanteId)).map(t => t.id));

    const bodyHtml = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:700">Comandante da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
        <select class="input select" id="subEditViaturaComandante" onchange="Dashboard.onSubFuncoesChange()">
          <option value="">Selecione o Comandante</option>
          ${equipe.map(m => `<option value="${m.id}" ${comandanteId === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:700">Motorista da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
        <select class="input select" id="subEditViaturaMotorista" onchange="Dashboard.onSubFuncoesChange()">
          <option value="">Selecione o Motorista</option>
          ${equipe.map(m => `<option value="${m.id}" ${motoristaId === m.id ? 'selected' : ''}>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}</option>`).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <label class="input-label" style="font-weight:700;margin:0">Auxiliares da Guarnição</label>
          <span style="font-size:0.75rem;color:var(--text-muted)">Os demais selecionados serão Auxiliares</span>
        </div>
        <div id="subEditViaturaTripulantes" style="display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto;padding:4px 0">
          ${equipe.length === 0 ? '<p style="font-size:.8rem;color:var(--text-secondary)">Adicione integrantes à equipe primeiro</p>' : equipe.map(m => {
            const isCom = comandanteId === m.id;
            const isMot = motoristaId === m.id;
            const checked = atuaisAux.has(m.id) && !isCom && !isMot;
            const disabled = isCom || isMot;
            return `<label id="labelSubTrip_${m.id}" style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? 0.45 : 1}">
              <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="accent-color:var(--prontidao-color)">
              <span>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''} ${isCom ? '<span class="badge-sub-role" style="color:#2979ff;font-size:0.75rem">(Comandante)</span>' : (isMot ? '<span class="badge-sub-role" style="color:var(--text-muted);font-size:0.75rem">(Motorista)</span>' : '<span style="color:var(--prontidao-color);font-size:0.72rem;font-weight:600">[Auxiliar]</span>')}</span>
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Situação / Status da Viatura</label>
        <select class="input select" id="subEditViaturaStatus">
          <option value="ativa" ${(!sv.status || sv.status === 'ativa') ? 'selected' : ''}>Disponível na base (Ativa)</option>
          <option value="retornando" ${sv.status === 'retornando' ? 'selected' : ''}>Retornando</option>
          <option value="encerrada" ${(sv.status === 'encerrada' || sv.status === 'reserva') ? 'selected' : ''}>Encerrada (Reserva)</option>
        </select>
      </div>
    `;

    const footerHtml = `
      <button class="btn btn-secondary" onclick="Dashboard.closeEditSubModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.salvarViaturaEmEdicao('${servicoViaturaId}')">Salvar Viatura</button>
    `;

    this.openEditSubModal(`Configurar Viatura — ${sv.viaturaNome}`, bodyHtml, footerHtml);
  },

  onSubFuncoesChange() {
    const comId = document.getElementById('subEditViaturaComandante')?.value || '';
    const motId = document.getElementById('subEditViaturaMotorista')?.value || '';
    const tripContainer = document.getElementById('subEditViaturaTripulantes');
    if (!tripContainer) return;

    const inputs = tripContainer.querySelectorAll('input[type=checkbox]');
    inputs.forEach(cb => {
      const parentLabel = cb.closest('label');
      const isCom = cb.value === comId;
      const isMot = cb.value === motId;
      if (isCom || isMot) {
        cb.checked = false;
        cb.disabled = true;
        if (parentLabel) {
          parentLabel.style.cursor = 'not-allowed';
          parentLabel.style.opacity = '0.45';
          const oldBadge = parentLabel.querySelector('.badge-sub-role');
          if (oldBadge) oldBadge.remove();
          const span = document.createElement('span');
          span.className = 'badge-sub-role';
          span.style.cssText = `font-size:0.75rem;margin-left:4px;color:${isCom ? '#2979ff' : 'var(--text-muted)'};font-weight:600`;
          span.textContent = isCom ? '(Comandante)' : '(Motorista)';
          parentLabel.appendChild(span);
        }
      } else {
        cb.disabled = false;
        if (parentLabel) {
          parentLabel.style.cursor = 'pointer';
          parentLabel.style.opacity = '1';
          const badge = parentLabel.querySelector('.badge-sub-role');
          if (badge) badge.remove();
        }
      }
    });
  },

  onSubMotoristaChange(newMotoristaId) {
    this.onSubFuncoesChange();
  },

  salvarViaturaEmEdicao(servicoViaturaId) {
    const sv = (this._viaturasEdicao || []).find(x => x.id === servicoViaturaId);
    if (!sv) return;

    const comandanteId = document.getElementById('subEditViaturaComandante')?.value || '';
    const motoristaId = document.getElementById('subEditViaturaMotorista')?.value || '';
    const status = document.getElementById('subEditViaturaStatus')?.value || 'ativa';
    const equipe = this._equipeEdicao || [];

    if (!comandanteId) {
      Utils.showToast('É obrigatório definir o Comandante da viatura', 'warning');
      document.getElementById('subEditViaturaComandante')?.focus();
      return;
    }
    if (!motoristaId) {
      Utils.showToast('É obrigatório definir o Motorista da viatura', 'warning');
      document.getElementById('subEditViaturaMotorista')?.focus();
      return;
    }
    if (comandanteId === motoristaId) {
      Utils.showToast('O Comandante e o Motorista devem ser militares diferentes', 'warning');
      return;
    }

    const cMilitar = equipe.find(x => x.id === comandanteId);
    const mMilitar = equipe.find(x => x.id === motoristaId);

    const checked = document.querySelectorAll('#subEditViaturaTripulantes input[type=checkbox]:checked');
    const auxiliares = Array.from(checked).map(cb => {
      const m = equipe.find(x => x.id === cb.value);
      return m ? { id: m.id, nome: m.nome, funcao: 'Auxiliar' } : null;
    }).filter(Boolean);

    // Tripulantes contém o Comandante com sua função e os demais auxiliares
    const tripulantes = [
      { id: comandanteId, nome: cMilitar?.nome || '', funcao: 'Comandante' },
      ...auxiliares
    ];

    sv.comandanteId = comandanteId;
    sv.comandante = cMilitar?.nome || '';
    sv.motoristaId = motoristaId;
    sv.motorista = mMilitar?.nome || '';
    sv.tripulantes = tripulantes;
    sv.status = status;
    if (status === 'encerrada' || status === 'reserva') {
      sv.Status = 'encerrado';
      if (!sv.horarioRetorno) {
        sv.horarioRetorno = Utils.formatDateTime(new Date());
      }
    } else {
      sv.Status = 'ativo';
    }

    // Regra de exclusividade: desvincula militares desta viatura das demais em edição
    const membrosNovos = new Set([comandanteId, motoristaId, ...auxiliares.map(a => a.id)]);
    (this._viaturasEdicao || []).forEach(outra => {
      if (outra.id === servicoViaturaId) return;
      if (outra.comandanteId && membrosNovos.has(outra.comandanteId)) {
        outra.comandanteId = '';
        outra.comandante = '';
      }
      if (outra.motoristaId && membrosNovos.has(outra.motoristaId)) {
        outra.motoristaId = '';
        outra.motorista = '';
      }
      if (outra.tripulantes && Array.isArray(outra.tripulantes)) {
        outra.tripulantes = outra.tripulantes.filter(t => !membrosNovos.has(t.id));
      }
    });

    this._renderViaturasEdicao();
    this.closeEditSubModal();
    Utils.showToast('Viatura configurada e componentes movimentados exclusivamente', 'success');
  },

  async removerViaturaEdicao(servicoViaturaId) {
    this._viaturasEdicao = (this._viaturasEdicao || []).filter(sv => sv.id !== servicoViaturaId);
    this._renderViaturasEdicao();
    Utils.showToast('Viatura removida do serviço', 'success');
  },

  async salvarEditarServico() {
    if (!this.servico) return;
    const comandanteId = document.getElementById('editServicoComandante').value;
    const comandanteNome = (this._equipeEdicao.find(m => m.id === comandanteId) || (this.servico.equipe || []).find(m => m.id === comandanteId))?.nome || '';
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

        // Atualiza cache local imediatamente para consistência entre abas
        try {
          const raw = localStorage.getItem('sgpo_cached_servico');
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.servico) {
              cached.servico.comandanteId = this.servico.comandanteId;
              cached.servico.comandanteNome = this.servico.comandanteNome;
              cached.servico.prontidao = this.servico.prontidao;
              cached.servico.equipe = this._equipeEdicao;
              cached.servico.observacoes = this.servico.observacoes;
              localStorage.setItem('sgpo_cached_servico', JSON.stringify(cached));
            }
          }
        } catch(e) {}

        NAV.updateProntidao(prontidao);
        API.getPostosServico().then(postos => NAV.updateServiceInfo(this.servico, postos)).catch(() => {});
        this.updateEquipeCount();

        const origIds = new Set((this.servicoViaturas || []).map(sv => sv.viaturaId));
        const editIds = new Set((this._viaturasEdicao || []).map(sv => sv.viaturaId));
        const added = this._viaturasEdicao.filter(sv => !origIds.has(sv.viaturaId));
        const removed = this.servicoViaturas.filter(sv => !editIds.has(sv.viaturaId));

        for (const sv of removed) {
          if (!sv.id?.startsWith('sv-temp-')) {
            await API.encerrarServicoViatura(this.servico.id, sv.id);
          }
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
        const kept = this._viaturasEdicao.filter(sv => origIds.has(sv.viaturaId) && !sv.id?.startsWith('sv-temp-'));
        for (const sv of kept) {
          if (sv.status === 'encerrada' || sv.status === 'reserva') {
            await API.encerrarServicoViatura(this.servico.id, sv.id);
          } else {
            await API.editarServicoViatura({
              id: sv.id,
              servicoViaturaId: sv.id,
              motorista: sv.motorista || '',
              motoristaId: sv.motoristaId || '',
              tripulantes: sv.tripulantes || [],
              status: sv.status || 'ativa'
            });
          }
        }

        const data = await API.getServicoAtual(Auth.userId, true);
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

  async autoEncerrarViradaDia() {
    if (this._autoEncerrando) return;
    this._autoEncerrando = true;
    try {
      if (this.servico && this.servico.id) {
        await API.encerrarServico(this.servico.id);
        Utils.showToast('Serviço do plantão encerrado automaticamente com a virada do dia.', 'info');
        this.servico = null;
        this.servicoData = null;
        this._servicoActive = false;
        clearInterval(this.countdownInterval);
        document.getElementById('noServiceModal').style.display = 'flex';
      }
    } catch(e) {
      console.warn('Erro ao auto-encerrar serviço:', e);
    } finally {
      this._autoEncerrando = false;
    }
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
      if (this.servico && this.servico.Status === 'ativo' && !this._autoEncerrando) {
        this.autoEncerrarViradaDia();
      }
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
      const [h, m] = (a.horario || '').split(':').map(Number);
      const t = (h || 0) * 60 + (m || 0);
      if (t <= ct && (!atual || t > atual._t)) atual = { ...a, _t: t };
    }

    const card = document.getElementById('atividadeAtualCard');
    if (card && !card._hasClick) {
      card._hasClick = true;
      card.style.cursor = 'pointer';
      card.title = 'Clique para ver detalhes e ações da rotina';
      card.onclick = () => {
        if (this._lastAtualAtivId) {
          this.showAtividadeDetail(this._lastAtualAtivId);
        } else {
          this.showAtividadesModal();
        }
      };
    }

    if (atual) {
      this._lastAtualAtivId = atual.id;
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
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px">${Utils.formatRegistroDateTime(n.horario) || n.horario || ''}</div>
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

    const sorted = [...this.rotina].sort((a, b) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(a.horario) - getMin(b.horario); });
    el.innerHTML = sorted.map(a => `
      <div class="dash-atividade-item status-${a.status}" style="cursor:pointer" onclick="Dashboard.showAtividadeDetail('${a.id}')" title="Clique para ver detalhes e ações">
        <div class="dash-atividade-item-horario">${a.horario}</div>
        <div class="dash-atividade-item-nome">${Utils.escapeHtml(a.nome)}</div>
        <div class="dash-atividade-item-responsavel">${Utils.escapeHtml(a.responsavel || '-')}</div>
        <div class="dash-atividade-item-status">${badge(a.status)}</div>
      </div>
    `).join('');
  },

  updateTimeline() {
    const el = document.getElementById('timeline');
    if (!el) return;
    if (typeof TimelineStore !== 'undefined') {
      const sId = this.servico?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null);
      this.rotina = TimelineStore.mergeInto(this.rotina || [], sId);
    }
    const opPrefixes = ['r-ofe-', 'r-ofs-', 'r-sva-', 'r-svr-', 'r-desp-', 'r-ret-', 'r-oc-', 'r-ocf-', 'r-tele-', 'r-act-'];
    const activeStatuses = ['concluida', 'em_andamento', 'nao_realizada', 'cancelada'];
    const items = (this.rotina || []).filter(a => activeStatuses.includes(a.status) || opPrefixes.some(p => (a.id || '').startsWith(p))).sort((a, b) => {
      const getMin = (t) => {
        if (!t) return 99999;
        const str = String(t);
        const timePart = str.includes(' ') ? str.split(' ')[1] : str;
        const p = timePart.split(':');
        const mins = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
        return mins < 450 ? mins + 1440 : mins;
      };
      const tA = a.horaConclusao || a.horaInicio || a.horaAtualizacao || a.horario;
      const tB = b.horaConclusao || b.horaInicio || b.horaAtualizacao || b.horario;
      return getMin(tA) - getMin(tB);
    }).slice(-25).reverse();

    if (items.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhum evento registrado</p></div>'; return; }
    const catColors = { 'Ocorrências': '#e53935', 'Ocorrência': '#e53935', 'Viaturas': '#ff6d00', 'Oficiais': '#1565c0', 'Telegrafia': '#6a1b9a', 'Passagem de serviço': '#2e7d32', 'Rotina': '#0288d1' };
    const catIcons = { 'Ocorrências': '🚨', 'Ocorrência': '🚨', 'Viaturas': '🚒', 'Oficiais': '🎖️', 'Telegrafia': '📡', 'Passagem de serviço': '📋', 'Rotina': '📌' };

    const statusBadge = (s) => {
      if (s === 'concluida') return '<span class="badge badge-green" style="font-size:0.65rem;padding:1px 5px;margin-left:4px">Concluída</span>';
      if (s === 'em_andamento') return '<span class="badge badge-yellow" style="font-size:0.65rem;padding:1px 5px;margin-left:4px">Em Andamento</span>';
      if (s === 'nao_realizada') return '<span class="badge badge-warning" style="font-size:0.65rem;padding:1px 5px;margin-left:4px">Prejudicada</span>';
      if (s === 'cancelada') return '<span class="badge badge-danger" style="font-size:0.65rem;padding:1px 5px;margin-left:4px">Cancelada</span>';
      return '';
    };

    el.innerHTML = items.map(a => {
      const prog = a.programa || '';
      const explicitEmoji = a.nome?.match(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+/u)?.[0];
      
      let color = catColors[prog] || '#546e7a';
      if (explicitEmoji === '📢') color = '#1e88e5'; // Oficial anunciado
      else if (explicitEmoji === '🚪') color = '#1565c0'; // Entrada / Saída de oficial
      else if (explicitEmoji === '🏠') color = '#ff6d00'; // Retorno à base
      else if (explicitEmoji === '🚨') color = '#e53935'; // Saída de ocorrência / despacho
      else if (explicitEmoji === '✅') color = '#2e7d32'; // Cumprimento / finalização
      else if (explicitEmoji === '🔄') color = '#0288d1'; // Movimentação de componentes
      else if (a.status === 'cancelada') color = '#e53935';
      else if (a.status === 'nao_realizada') color = '#ff9800';
      else if (a.status === 'em_andamento') color = '#fbc02d';
      else if (a.status === 'concluida' && !catColors[prog]) color = '#43a047';

      const isOp = opPrefixes.some(p => (a.id || '').startsWith(p));
      const icon = explicitEmoji || (isOp ? (catIcons[prog] || '📌') : (a.status === 'concluida' ? '✅' : (a.status === 'em_andamento' ? '⏳' : (a.status === 'nao_realizada' ? '⚠️' : (a.status === 'cancelada' ? '❌' : '📌')))));
      const rawTime = a.horaConclusao || a.horaInicio || a.horaAtualizacao || a.horario;
      const displayTime = (typeof Utils !== 'undefined' && Utils.formatDateTime) ? Utils.formatDateTime(rawTime) : rawTime;
      const badge = !isOp ? statusBadge(a.status) : '';
      const cleanName = a.nome?.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u200d\uFE0F]+\s*/u, '') || a.nome;

      return `
        <div class="timeline-item" style="border-left:3px solid ${color}">
          <div class="timeline-time">${displayTime}</div>
          <div class="timeline-content">
            <span style="display:inline-block;min-width:20px;text-align:center">${icon}</span>
            ${Utils.escapeHtml(cleanName)}
            ${badge}
            ${prog ? `<span style="display:inline-block;font-size:0.65rem;padding:1px 6px;border-radius:8px;background:${color}22;color:${color};font-weight:600;margin-left:4px;vertical-align:middle">${Utils.escapeHtml(prog)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  },

  renderViaturaPanel() {
    const container = document.getElementById('viaturasContainer');
    const badge = document.getElementById('viaturasBadge');
    if (!container) return;

    const ocAtivas = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
    const vidsEmOcorr = new Set();
    ocAtivas.forEach(o => (o.viaturaIds || []).forEach(vid => vidsEmOcorr.add(String(vid))));

    // Normalização: viaturas na base que não estão em nenhuma ocorrência ativa devem estar como 'ativa' (Disponível)
    (this.servicoViaturas || []).forEach(sv => {
      if (sv && sv.status === 'retornando' && !vidsEmOcorr.has(String(sv.viaturaId))) {
        sv.status = 'ativa';
      }
    });

    if (!this.servicoViaturas || this.servicoViaturas.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Nenhuma viatura em serviço</p></div>';
      if (badge) badge.style.display = 'none';
      return;
    }
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = this.servicoViaturas.length; }

    const ocAtivas = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
    if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) NAV.checkOcorrenciasAtivas();
    const btnOcorr = document.getElementById('btnNovaOcorrencia');
    if (btnOcorr) {
      if (ocAtivas.length > 0) {
        btnOcorr.innerHTML = `🚨 Ocorrências <span style="background:#fff;color:#e53935;border-radius:10px;padding:1px 6px;font-size:0.68rem;margin-left:4px;font-weight:700">${ocAtivas.length}</span>`;
        btnOcorr.onclick = () => Dashboard.showGerenciarOcorrenciasModal('ativas');
        btnOcorr.title = `${ocAtivas.length} ocorrência(s) em atendimento no plantão`;
      } else {
        btnOcorr.innerHTML = '🚨 Ocorrência';
        btnOcorr.onclick = () => Dashboard.showEmpenharModal();
        btnOcorr.title = 'Registrar nova ocorrência e empenhar viaturas';
      }
    }

    const bannerHtml = ocAtivas.length > 0 ? `
      <div class="ocorr-live-banner">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="ocorr-live-dot"></span>
          <div>
            <div style="font-weight:700;color:#e53935;font-size:0.85rem">🚨 ${ocAtivas.length} Ocorrência(s) em Andamento</div>
            <div style="font-size:0.75rem;color:var(--text-secondary)">${ocAtivas.map(o => `<strong>#${o.numero}</strong>: ${Utils.escapeHtml(o.titulo || o.natureza || '')} (${this._getTempoDecorrido(o.horaAcionamento)})`).join(' &bull; ')}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-danger" style="font-size:0.72rem;padding:4px 10px" onclick="Dashboard.showGerenciarOcorrenciasModal('ativas')">📋 Painel de Ocorrências</button>
        </div>
      </div>
    ` : '';

    const statusCores = { ativa: '#00c853', em_ocorrencia: '#f44336', retornando: '#ff9100', encerrada: '#9e9e9e', indisponivel: '#e53935' };
    const statusLabels = { ativa: 'Disponível', em_ocorrencia: 'Em atendimento', retornando: 'Retornando', encerrada: 'Encerrada', indisponivel: 'Indisponível' };

    container.innerHTML = bannerHtml + this.servicoViaturas.map(sv => {
      const st = sv.status || 'ativa';
      const tipo = sv.viaturaTipo || sv.viaturaNome?.substring(0, 3) || '?';
      const comandanteTrip = (sv.tripulantes || []).find(t => t.funcao === 'Comandante');
      const comandanteNome = sv.comandante || comandanteTrip?.nome || '';
      const auxTripulantes = (sv.tripulantes || []).filter(t => t.funcao === 'Auxiliar' || (!t.funcao && t.id !== sv.motoristaId && t.id !== sv.comandanteId));
      const auxiliaresStr = auxTripulantes.map(t => t.nome).join(', ');
      const ocAtiva = (this.ocorrencias || []).find(o =>
        (o.viaturaIds || []).includes(sv.viaturaId) && o.status !== 'finalizada' && o.status !== 'cancelada'
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
              ${ocAtiva ? `<span style="font-size:0.65rem;padding:2px 6px;border-radius:12px;background:#e5393522;color:#e53935;font-weight:600">🚨 OCORRÊNCIA #${ocAtiva.numero || ''} (${this._getTempoDecorrido(ocAtiva.horaAcionamento || sv.horarioSaida)})</span>` : ''}
            </div>
            ${ocAtiva ? `<div style="font-size:0.82rem;color:#e53935;margin-bottom:2px;font-weight:500">${Utils.escapeHtml(ocAtiva.natureza || '')} — ${Utils.escapeHtml(ocAtiva.titulo || '')}</div>` : ''}
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:2px">
              <strong>Comandante:</strong> ${Utils.escapeHtml(comandanteNome || '-')}
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:2px">
              <strong>Motorista:</strong> ${Utils.escapeHtml(sv.motorista || '-')}
            </div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-bottom:4px">
              <strong>Auxiliares:</strong> ${auxiliaresStr || 'Nenhum'}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted)">
              ${sv.horarioSaida ? 'Saída: ' + Utils.escapeHtml(sv.horarioSaida) : ''}
              ${sv.horarioRetorno ? ' — Retorno: ' + Utils.escapeHtml(sv.horarioRetorno) : ''}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0;justify-content:center">
            ${st === 'ativa' ? `<button class="btn btn-sm" style="font-size:0.75rem;background:#e5393518;color:#e53935;border:1px solid #e5393544;font-weight:600" onclick="Dashboard.showEmpenharModal('${sv.id}')">🚨 Empenhar</button>` : ''}
            ${st === 'ativa' ? `<button class="btn btn-sm" style="font-size:0.75rem" onclick="Dashboard.editarServicoViatura('${sv.id}')">Compor / Editar</button>` : ''}
            ${st === 'ativa' ? `<button class="btn btn-sm btn-danger" style="font-size:0.75rem" onclick="Dashboard.encerrarViatura('${sv.id}')">Encerrar (Reserva)</button>` : ''}
            ${st === 'em_ocorrencia' ? `
              <button class="btn btn-sm" style="font-size:0.75rem;background:#00c853;color:#fff;border:1px solid #00c853;font-weight:700" onclick="Dashboard.encerrarOcorrenciaRapida('${ocAtiva ? ocAtiva.id : ''}', '${sv.id}')" title="Encerrar ocorrência e retornar viatura imediatamente para status DISPONÍVEL">🏁 Encerrar Ocorrência (Disponível)</button>
              <button class="btn btn-sm btn-secondary" style="font-size:0.72rem" onclick="Dashboard.showEncerrarOcorrenciaModal('${ocAtiva ? ocAtiva.id : ''}', '${sv.id}')">⚙️ Opções</button>
              <button class="btn btn-sm btn-secondary" style="font-size:0.72rem" onclick="Dashboard.showGerenciarOcorrenciasModal('ativas')">📋 Detalhes</button>
            ` : ''}
            ${st === 'retornando' ? `
              <button class="btn btn-sm" style="font-size:0.75rem;background:#ff910022;color:#ff9100;border:1px solid #ff910055;font-weight:600" onclick="Dashboard.confirmarRetornoViatura('${sv.id}')">🏠 Chegada ao Quartel</button>
            ` : ''}
          </div>
        </div>`;
    }).join('');
  },

  async confirmarRetornoViatura(servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => String(x.id) === String(servicoViaturaId));
    if (!sv) return;
    try {
      const isVazia = this.isTelegrafiaVazia();
      let novoTelegrafista = null;
      let duracaoVazia = '';
      if (isVazia) {
        const membros = this.getComposicaoViaturas([sv]);
        const infoVazia = this.getTelegrafiaVaziaInfo();
        duracaoVazia = infoVazia.duracao;
        if (membros.length > 0) {
          novoTelegrafista = await this.mostrarModalAssumirTelegrafia(membros, infoVazia, sv.viaturaNome);
        }
      }

      const result = await API.retornarViatura({
        id: servicoViaturaId,
        servicoViaturaId,
        status: 'ativa',
        destinoStatus: 'ativa',
        novoTelegrafistaId: novoTelegrafista?.militarId,
        novoTelegrafistaNome: novoTelegrafista?.militarNome,
        tempoVazia: duracaoVazia
      });
      if (result.success) {
        Utils.showToast(`Viatura ${sv.viaturaNome} retornou ao quartel e está disponível`, 'success');

        if (novoTelegrafista && novoTelegrafista.militarId) {
          await this.registrarAssuncaoTelegrafia(novoTelegrafista.militarId, novoTelegrafista.militarNome, duracaoVazia, sv.viaturaNome);
        }

        const data = await API.getServicoAtual(Auth.userId, true);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        if (data.telegrafia !== undefined) this.telegrafia = data.telegrafia;
        this.renderViaturaPanel();
        this.updateTimeline();
        this.updateTelegrafia(this.telegrafia);
        if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) await NAV.checkOcorrenciasAtivas();
      } else {
        Utils.showToast(result.error || 'Erro ao registrar retorno', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async encerrarViatura(servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => String(x.id) === String(servicoViaturaId));
    const vNome = sv ? sv.viaturaNome : 'Viatura';
    try {
      const result = await API.encerrarServicoViatura(this.servico.id, servicoViaturaId);
      if (result.success) {
        Utils.showToast(`${vNome} encerrada e enviada para reserva`, 'success');
        const data = await API.getServicoAtual(Auth.userId, true);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
        this.updateTimeline();
        if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) await NAV.checkOcorrenciasAtivas();
      } else {
        Utils.showToast(result.error || 'Erro ao encerrar viatura', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async retornarViatura(servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => String(x.id) === String(servicoViaturaId));
    const vNome = sv ? sv.viaturaNome : 'Viatura';
    try {
      const isVazia = this.isTelegrafiaVazia();
      let novoTelegrafista = null;
      let duracaoVazia = '';
      if (isVazia && sv) {
        const membros = this.getComposicaoViaturas([sv]);
        const infoVazia = this.getTelegrafiaVaziaInfo();
        duracaoVazia = infoVazia.duracao;
        if (membros.length > 0) {
          novoTelegrafista = await this.mostrarModalAssumirTelegrafia(membros, infoVazia, sv.viaturaNome);
        }
      }

      const result = await API.retornarViatura({
        id: servicoViaturaId,
        servicoViaturaId,
        status: 'ativa',
        destinoStatus: 'ativa',
        novoTelegrafistaId: novoTelegrafista?.militarId,
        novoTelegrafistaNome: novoTelegrafista?.militarNome,
        tempoVazia: duracaoVazia
      });
      if (result.success) {
        Utils.showToast(`${vNome} retornando ao quartel`, 'success');

        if (novoTelegrafista && novoTelegrafista.militarId) {
          await this.registrarAssuncaoTelegrafia(novoTelegrafista.militarId, novoTelegrafista.militarNome, duracaoVazia, vNome);
        }

        const data = await API.getServicoAtual(Auth.userId, true);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        if (data.telegrafia !== undefined) this.telegrafia = data.telegrafia;
        this.renderViaturaPanel();
        this.updateTimeline();
        this.updateTelegrafia(this.telegrafia);
        if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) await NAV.checkOcorrenciasAtivas();
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
    const militarOutraVtr = new Map();
    outrasViaturas.forEach(x => {
      const vNome = x.viaturaNome || 'outra viatura';
      if (x.comandanteId) militarOutraVtr.set(x.comandanteId, { viatura: x, viaturaNome: vNome, funcao: 'Comandante' });
      if (x.motoristaId) militarOutraVtr.set(x.motoristaId, { viatura: x, viaturaNome: vNome, funcao: 'Motorista' });
      (x.tripulantes || []).forEach(t => {
        if (t.id && t.id !== x.comandanteId && t.id !== x.motoristaId) {
          militarOutraVtr.set(t.id, { viatura: x, viaturaNome: vNome, funcao: 'Auxiliar' });
        }
      });
    });

    const comandanteTrip = (sv.tripulantes || []).find(t => t.funcao === 'Comandante');
    const comandanteId = sv.comandanteId || comandanteTrip?.id || '';
    const motoristaId = sv.motoristaId || '';
    const atuaisAux = new Set((sv.tripulantes || []).filter(t => t.funcao === 'Auxiliar' || (!t.funcao && t.id !== motoristaId && t.id !== comandanteId)).map(t => t.id).filter(Boolean));

    document.getElementById('modalTitle').textContent = `Compor Viatura - ${sv.viaturaNome}`;
    document.getElementById('modalBody').innerHTML = `
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:700">Comandante da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
        <select class="input select" id="editViaturaComandante" onchange="Dashboard.onEditViaturaFuncoesChange()">
          <option value="">Selecione o Comandante</option>
          ${equipe.map(m => {
            const outra = militarOutraVtr.get(m.id);
            const isSelected = comandanteId === m.id;
            const extra = outra ? ` (em ${outra.viaturaNome} — movimentar)` : '';
            return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${Utils.escapeHtml(m.nome)} — ${m.posto || ''}${extra}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:700">Motorista da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
        <select class="input select" id="editViaturaMotorista" onchange="Dashboard.onEditViaturaFuncoesChange()">
          <option value="">Selecione o Motorista</option>
          ${equipe.map(m => {
            const outra = militarOutraVtr.get(m.id);
            const isSelected = motoristaId === m.id;
            const extra = outra ? ` (em ${outra.viaturaNome} — movimentar)` : '';
            return `<option value="${m.id}" ${isSelected ? 'selected' : ''}>${Utils.escapeHtml(m.nome)} — ${m.posto || ''}${extra}</option>`;
          }).join('')}
        </select>
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <label class="input-label" style="font-weight:700;margin:0">Auxiliares da Guarnição</label>
          <span style="font-size:0.75rem;color:var(--text-muted)">Os demais selecionados serão Auxiliares</span>
        </div>
        <div id="editViaturaTripulantes" style="display:flex;flex-direction:column;gap:4px;max-height:220px;overflow-y:auto;padding:4px 0">
          ${equipe.map(m => {
            const isCom = m.id === comandanteId;
            const isMot = m.id === motoristaId;
            const checked = atuaisAux.has(m.id) && !isCom && !isMot;
            const outra = militarOutraVtr.get(m.id);
            const disabled = isCom || isMot;
            return `<label id="labelEditTrip_${m.id}" style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.85rem;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? 0.45 : 1}">
              <input type="checkbox" value="${m.id}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} style="accent-color:var(--prontidao-color)">
              <span>${Utils.escapeHtml(m.nome)} — ${m.posto || ''}${isCom ? ' <span class="badge-edit-role" style="color:#2979ff;font-size:0.75rem;font-weight:600">(Comandante)</span>' : (isMot ? ' <span class="badge-edit-role" style="color:var(--text-muted);font-size:0.75rem;font-weight:600">(Motorista)</span>' : (outra ? ` <span class="badge-edit-role" style="color:#ff9800;font-size:0.75rem;font-weight:600">(em ${Utils.escapeHtml(outra.viaturaNome)} — movimentar)</span>` : ' <span style="color:var(--prontidao-color);font-size:0.72rem;font-weight:600">[Auxiliar]</span>'))}</span>
            </label>`;
          }).join('')}
        </div>
      </div>
      <div class="input-group">
        <label class="input-label">Status</label>
        <select class="input select" id="editViaturaStatus">
          <option value="ativa" ${(!sv.status || sv.status === 'ativa') ? 'selected' : ''}>Disponível na base (Ativa)</option>
          <option value="retornando" ${sv.status === 'retornando' ? 'selected' : ''}>Retornando</option>
          <option value="encerrada" ${(sv.status === 'encerrada' || sv.status === 'reserva') ? 'selected' : ''}>Encerrada (Colocar na Reserva)</option>
        </select>
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.saveServicoViatura('${servicoViaturaId}')">Salvar Composição</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  onEditViaturaFuncoesChange() {
    const comId = document.getElementById('editViaturaComandante')?.value || '';
    const motId = document.getElementById('editViaturaMotorista')?.value || '';
    const tripContainer = document.getElementById('editViaturaTripulantes');
    if (!tripContainer) return;

    const inputs = tripContainer.querySelectorAll('input[type=checkbox]');
    inputs.forEach(cb => {
      const parentLabel = cb.closest('label');
      const isCom = cb.value === comId;
      const isMot = cb.value === motId;
      if (isCom || isMot) {
        cb.checked = false;
        cb.disabled = true;
        if (parentLabel) {
          parentLabel.style.cursor = 'not-allowed';
          parentLabel.style.opacity = '0.45';
          const badge = parentLabel.querySelector('.badge-edit-role');
          if (badge) badge.remove();
          const span = document.createElement('span');
          span.className = 'badge-edit-role';
          span.style.cssText = `font-size:0.75rem;margin-left:4px;color:${isCom ? '#2979ff' : 'var(--text-muted)'};font-weight:600`;
          span.textContent = isCom ? '(Comandante)' : '(Motorista)';
          parentLabel.appendChild(span);
        }
      } else {
        const badge = parentLabel?.querySelector('.badge-edit-role');
        if (badge && (badge.textContent.includes('Comandante') || badge.textContent.includes('Motorista'))) {
          badge.remove();
        }
        cb.disabled = false;
        if (parentLabel) {
          parentLabel.style.cursor = 'pointer';
          parentLabel.style.opacity = '1';
        }
      }
    });
  },

  onEditViaturaMotoristaChange(newMotoristaId) {
    this.onEditViaturaFuncoesChange();
  },

  async saveServicoViatura(servicoViaturaId) {
    const sv = (this.servicoViaturas || []).find(x => x.id === servicoViaturaId);
    if (!sv) return;
    const comandanteId = document.getElementById('editViaturaComandante')?.value || '';
    const motoristaId = document.getElementById('editViaturaMotorista')?.value || '';
    const status = document.getElementById('editViaturaStatus')?.value || 'ativa';
    const equipe = this.servico?.equipe || [];

    if (!comandanteId) {
      Utils.showToast('É obrigatório definir o Comandante da viatura', 'warning');
      document.getElementById('editViaturaComandante')?.focus();
      return;
    }
    if (!motoristaId) {
      Utils.showToast('É obrigatório definir o Motorista da viatura', 'warning');
      document.getElementById('editViaturaMotorista')?.focus();
      return;
    }
    if (comandanteId === motoristaId) {
      Utils.showToast('O Comandante e o Motorista devem ser militares diferentes', 'warning');
      return;
    }

    const cMilitar = equipe.find(x => x.id === comandanteId);
    const mMilitar = equipe.find(x => x.id === motoristaId);
    const checked = document.querySelectorAll('#editViaturaTripulantes input[type=checkbox]:checked');
    const auxiliares = Array.from(checked).map(cb => {
      const m = equipe.find(x => x.id === cb.value);
      return m ? { id: m.id, nome: m.nome, funcao: 'Auxiliar' } : null;
    }).filter(Boolean);

    // Tripulantes contém o Comandante com sua função e os demais auxiliares
    const tripulantes = [
      { id: comandanteId, nome: cMilitar?.nome || '', funcao: 'Comandante' },
      ...auxiliares
    ];

    // Movimentação de militares: se algum militar atribuído estava em outra viatura, remove da anterior
    const novosMembrosIds = new Set([comandanteId, motoristaId, ...auxiliares.map(a => a.id)]);
    const outrasViaturas = (this.servicoViaturas || []).filter(x => x.id !== servicoViaturaId && x.Status !== 'encerrado');
    const movimentados = [];
    const agoraMov = Utils.formatTime(new Date());

    try {
      for (const outra of outrasViaturas) {
        let alterada = false;
        const outraNome = outra.viaturaNome || 'outra viatura';
        if (outra.comandanteId && novosMembrosIds.has(outra.comandanteId)) {
          const m = equipe.find(x => x.id === outra.comandanteId);
          movimentados.push({ nome: m?.nome || 'Militar', de: outraNome, para: sv.viaturaNome, funcao: 'Comandante' });
          outra.comandanteId = '';
          outra.comandante = '';
          alterada = true;
        }
        if (outra.motoristaId && novosMembrosIds.has(outra.motoristaId)) {
          const m = equipe.find(x => x.id === outra.motoristaId);
          movimentados.push({ nome: m?.nome || 'Militar', de: outraNome, para: sv.viaturaNome, funcao: 'Motorista' });
          outra.motoristaId = '';
          outra.motorista = '';
          alterada = true;
        }
        if (outra.tripulantes && Array.isArray(outra.tripulantes)) {
          const antes = outra.tripulantes.length;
          const removidos = outra.tripulantes.filter(t => novosMembrosIds.has(t.id));
          removidos.forEach(r => {
            if (!movimentados.some(mv => mv.nome === r.nome)) {
              movimentados.push({ nome: r.nome, de: outraNome, para: sv.viaturaNome, funcao: 'Auxiliar' });
            }
          });
          outra.tripulantes = outra.tripulantes.filter(t => !novosMembrosIds.has(t.id));
          if (outra.tripulantes.length !== antes) alterada = true;
        }
        if (alterada) {
          await API.editarServicoViatura({
            id: outra.id,
            servicoViaturaId: outra.id,
            comandante: outra.comandante,
            comandanteId: outra.comandanteId,
            motorista: outra.motorista,
            motoristaId: outra.motoristaId,
            tripulantes: outra.tripulantes,
            status: outra.status || 'ativa'
          }).catch(() => {});
        }
      }

      // Registra eventos na timeline e notificações para militares movimentados
      movimentados.forEach(mv => {
        this.rotina.push({
          id: 'r-act-' + Date.now() + Math.random(),
          horario: agoraMov,
          nome: `🔄 ${mv.nome} movimentado(a) de ${mv.de} para ${sv.viaturaNome}`,
          programa: 'Viaturas',
          responsavel: mv.nome,
          status: 'concluida',
          concluidoPor: 'Sistema',
          horaConclusao: agoraMov
        });
        this.notificacoes.unshift({
          id: 'n-' + Date.now() + Math.random(),
          mensagem: `${mv.nome} movimentado(a) de ${mv.de} para ${sv.viaturaNome}`,
          tipo: 'info',
          horario: agoraMov,
          lida: false
        });
      });

      let result;
      if (status === 'encerrada') {
        result = await API.encerrarServicoViatura(this.servico.id, servicoViaturaId);
      } else {
        result = await API.editarServicoViatura({
          id: servicoViaturaId,
          servicoViaturaId,
          comandante: cMilitar?.nome || '',
          comandanteId,
          motorista: mMilitar?.nome || '',
          motoristaId,
          tripulantes,
          status
        });
      }
      if (result.success) {
        const msg = movimentados.length > 0
          ? `Viatura atualizada! ${movimentados.length} militar(es) movimentado(s) respeitando a exclusividade.`
          : (status === 'encerrada' ? 'Viatura colocada na reserva' : 'Viatura composta com sucesso');
        Utils.showToast(msg, 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId, true);
        this.servicoViaturas = data.servicoViaturas || [];
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
        this.updateTimeline();
      } else {
        Utils.showToast(result.error || 'Erro ao atualizar viatura', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  _getTempoDecorrido(horaStr) {
    if (!horaStr) return '-';
    try {
      const timePart = horaStr.includes(' ') ? horaStr.split(' ')[1] : horaStr;
      const parts = timePart.split(':');
      if (parts.length < 2) return '-';
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const s = parseInt(parts[2], 10) || 0;
      const now = new Date();
      const acionamento = new Date();
      acionamento.setHours(h, m, s, 0);
      let diffMs = now.getTime() - acionamento.getTime();
      if (diffMs < 0) diffMs += 24 * 3600 * 1000;
      const totalMin = Math.floor(diffMs / 60000);
      const horas = Math.floor(totalMin / 60);
      const minutos = totalMin % 60;
      if (horas > 0) return `${horas}h ${minutos}min`;
      return `${minutos} min`;
    } catch(e) {
      return '-';
    }
  },

  showGerenciarOcorrenciasModal(activeTab = 'ativas') {
    const modalEl = document.querySelector('#modalOverlay .modal');
    if (modalEl) modalEl.style.maxWidth = '660px';

    const ativas = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
    const encerradas = (this.ocorrencias || []).filter(o => o.status === 'finalizada' || o.status === 'cancelada' || o.status === 'trote');

    if (activeTab === 'empenhar' || (ativas.length === 0 && activeTab !== 'historico')) {
      this.showEmpenharModal();
      return;
    }

    document.getElementById('modalTitle').textContent = '🚨 Central de Ocorrências do Plantão';
    document.getElementById('modalBody').innerHTML = `
      <div class="ocorr-tabs-nav">
        <button class="ocorr-tab-btn" onclick="Dashboard.showEmpenharModal()">🚨 + Empenhar Ocorrência</button>
        <button class="ocorr-tab-btn ${activeTab === 'ativas' ? 'active' : ''}" onclick="Dashboard.showGerenciarOcorrenciasModal('ativas')">📋 Em Atendimento (${ativas.length})</button>
        <button class="ocorr-tab-btn ${activeTab === 'historico' ? 'active' : ''}" onclick="Dashboard.showGerenciarOcorrenciasModal('historico')">📜 Encerradas (${encerradas.length})</button>
      </div>

      ${activeTab === 'ativas' ? `
        <div style="display:flex;flex-direction:column;gap:12px;max-height:60vh;overflow-y:auto;padding-right:4px">
          ${ativas.length === 0 ? `
            <div class="empty-state" style="padding:28px 12px;text-align:center">
              <div style="font-size:2rem;margin-bottom:8px">✅</div>
              <p style="font-weight:600;color:var(--text-primary)">Nenhuma ocorrência em andamento no momento</p>
              <p style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">Todas as viaturas estão no quartel ou disponíveis.</p>
              <button class="btn btn-primary btn-sm" style="margin-top:14px;background:#e53935;border-color:#e53935" onclick="Dashboard.showEmpenharModal()">🚨 Empenhar Nova Ocorrência</button>
            </div>
          ` : ativas.map(oc => {
            const viats = (this.servicoViaturas || []).filter(sv => (oc.viaturaIds || []).includes(sv.viaturaId));
            const viatNomes = viats.map(v => v.viaturaNome).join(', ') || 'Nenhuma viatura';
            const tempoDec = this._getTempoDecorrido(oc.horaAcionamento);
            const efetivoStr = (oc.efetivo || []).join(', ') || '-';

            return `
              <div class="ocorr-card-item ativa">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;flex-wrap:wrap">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span style="font-size:0.75rem;padding:3px 8px;border-radius:6px;background:#e5393522;color:#e53935;font-weight:700">OCORRÊNCIA #${oc.numero}</span>
                      <span style="font-size:0.75rem;padding:2px 8px;border-radius:12px;background:var(--border-color);color:var(--text-secondary)">${Utils.escapeHtml(oc.natureza || 'Geral')}</span>
                    </div>
                    <div style="font-size:1.05rem;font-weight:700;color:var(--text-primary);margin-top:6px">${Utils.escapeHtml(oc.titulo || '')}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:0.75rem;color:var(--text-muted)">Acionada às <strong>${oc.horaAcionamento || '--:--'}</strong></div>
                    <div style="font-size:0.78rem;color:#e53935;font-weight:600;margin-top:2px">⏱ ${tempoDec} em atendimento</div>
                  </div>
                </div>

                ${oc.endereco ? `
                  <div style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:6px;display:flex;align-items:center;gap:4px">
                    <span>📍</span> <span>${Utils.escapeHtml(oc.endereco)}</span>
                  </div>
                ` : ''}

                ${oc.descricao ? `
                  <div style="font-size:0.82rem;color:var(--text-secondary);background:var(--bg-card, rgba(255,255,255,0.03));padding:8px 10px;border-radius:6px;margin-bottom:8px;border-left:3px solid #e53935">
                    ${Utils.escapeHtml(oc.descricao)}
                  </div>
                ` : ''}

                <div style="display:flex;flex-direction:column;gap:6px;font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;background:rgba(0,0,0,0.1);padding:8px 10px;border-radius:8px">
                  <div>
                    <strong>🚒 Viaturas Empenhadas:</strong>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
                      ${viats.map(v => `
                        <span style="display:inline-flex;align-items:center;padding:3px 8px;background:rgba(229,57,53,0.15);color:#e53935;border-radius:6px;font-weight:600;font-size:0.75rem;border:1px solid rgba(229,57,53,0.3)">
                          ${Utils.escapeHtml(v.viaturaNome)}
                          <button class="btn btn-sm" style="font-size:0.68rem;padding:2px 6px;margin-left:6px;background:#00c853;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:700" onclick="Dashboard.encerrarOcorrenciaRapida('${oc.id}', '${v.id}')" title="Encerrar ocorrência e liberar esta viatura diretamente para Disponível na Base">🏁 Liberar Viatura</button>
                        </span>
                      `).join('') || '<span style="color:var(--text-muted)">Nenhuma</span>'}
                    </div>
                  </div>
                  <div><strong>👨‍🚒 Efetivo Empenhado:</strong> ${Utils.escapeHtml(efetivoStr)}</div>
                </div>

                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;border-top:1px solid var(--border-color);padding-top:10px">
                  <button class="btn btn-sm btn-secondary" style="font-size:0.75rem" onclick="Dashboard.showEditarOcorrencia('${oc.id}')">✏️ Editar Detalhes</button>
                  <button class="btn btn-sm btn-secondary" style="font-size:0.75rem;color:#ff9100;border-color:rgba(255,145,0,0.4)" onclick="Dashboard.showEmpenharModal(null, '${oc.id}')">🚑 + Adicionar Apoio</button>
                  <button class="btn btn-sm btn-primary" style="font-size:0.75rem;background:#00c853;border-color:#00c853;color:#fff;font-weight:700" onclick="Dashboard.encerrarOcorrenciaRapida('${oc.id}')" title="Encerrar ocorrência e retornar todas as viaturas para o status Disponível">🏁 Encerrar Ocorrência (Disponível)</button>
                  <button class="btn btn-sm btn-secondary" style="font-size:0.72rem" onclick="Dashboard.showEncerrarOcorrenciaModal('${oc.id}')">⚙️ Opções</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow-y:auto;padding-right:4px">
          ${encerradas.length === 0 ? `
            <div class="empty-state" style="padding:28px 12px;text-align:center">
              <p style="color:var(--text-muted)">Nenhuma ocorrência encerrada neste plantão até o momento.</p>
            </div>
          ` : encerradas.map(oc => {
            const statusLabel = oc.status === 'cancelada' ? 'Cancelada' : (oc.status === 'trote' ? 'Trote' : 'Finalizada');
            const statusCor = oc.status === 'cancelada' ? '#ff9100' : (oc.status === 'trote' ? '#e53935' : '#00c853');
            return `
              <div class="ocorr-card-item" style="border-left:4px solid ${statusCor}">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;flex-wrap:wrap">
                  <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:700;font-size:0.85rem">#${oc.numero} — ${Utils.escapeHtml(oc.titulo || '')}</span>
                    <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:${statusCor}22;color:${statusCor};font-weight:600">${statusLabel}</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-muted)">
                    Saída: <strong>${oc.horaAcionamento || '-'}</strong> &bull; Retorno: <strong>${oc.horaRetorno || '-'}</strong>
                  </div>
                </div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:4px">
                  <strong>Natureza:</strong> ${Utils.escapeHtml(oc.natureza || '-')} ${oc.endereco ? `&bull; <strong>Local:</strong> ${Utils.escapeHtml(oc.endereco)}` : ''}
                </div>
                ${oc.desfecho ? `
                  <div style="font-size:0.8rem;color:var(--text-primary);background:rgba(0,0,0,0.1);padding:6px 10px;border-radius:6px;margin-top:6px">
                    <strong>Desfecho:</strong> ${Utils.escapeHtml(oc.desfecho)}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;

    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="Dashboard.closeModal()">Fechar</button>
      <button class="btn btn-primary" style="background:#e53935;border-color:#e53935" onclick="Dashboard.showEmpenharModal()">🚨 + Novo Empenho</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  showEmpenharModal(preselectedServicoViaturaId = null, preselectedOcorrenciaId = null) {
    const modalEl = document.querySelector('#modalOverlay .modal');
    if (modalEl) modalEl.style.maxWidth = '660px';

    const ocorrenciasAtivas = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
    const vidsEmOcorr = new Set();
    ocorrenciasAtivas.forEach(o => (o.viaturaIds || []).forEach(vid => vidsEmOcorr.add(String(vid))));

    // Garante que todas as viaturas na base (sem ocorrência ativa) estejam disponíveis para empenho
    (this.servicoViaturas || []).forEach(sv => {
      if (sv && sv.status === 'retornando' && !vidsEmOcorr.has(String(sv.viaturaId))) {
        sv.status = 'ativa';
      }
    });

    const ativas = (this.servicoViaturas || []).filter(sv => sv.status === 'ativa');
    const equipe = this.servico?.equipe || [];

    this._empenhoModo = preselectedOcorrenciaId ? 'apoio' : 'nova';
    this._preselectedSvId = preselectedServicoViaturaId;
    this._preselectedOcId = preselectedOcorrenciaId;

    document.getElementById('modalTitle').textContent = '🚨 Empenhar Ocorrência — Despacho Operacional';
    
    if (ativas.length === 0) {
      document.getElementById('modalBody').innerHTML = `
        <div class="empty-state" style="padding:28px 12px;text-align:center">
          <div style="font-size:2.2rem;margin-bottom:10px">🚒⚠️</div>
          <h4 style="font-weight:700;color:#e53935;margin-bottom:6px">Nenhuma viatura disponível no quartel</h4>
          <p style="font-size:0.88rem;color:var(--text-secondary);max-width:420px;margin:0 auto">
            Todas as viaturas vinculadas ao serviço ativo estão atualmente empenhadas em ocorrências ou na reserva.
          </p>
          ${ocorrenciasAtivas.length > 0 ? `
            <div style="margin-top:16px">
              <button class="btn btn-secondary btn-sm" onclick="Dashboard.showGerenciarOcorrenciasModal('ativas')">Ver Ocorrências em Andamento (${ocorrenciasAtivas.length})</button>
            </div>
          ` : ''}
        </div>
      `;
      document.getElementById('modalFooter').innerHTML = `
        <button class="btn" onclick="Dashboard.closeModal()">Fechar</button>
      `;
      document.getElementById('modalOverlay').style.display = 'flex';
      return;
    }

    const agora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    document.getElementById('modalBody').innerHTML = `
      ${ocorrenciasAtivas.length > 0 ? `
        <div style="display:flex;gap:8px;margin-bottom:14px;border-bottom:1px solid var(--border-color);padding-bottom:10px">
          <button class="ocorr-tab-btn ${this._empenhoModo === 'nova' ? 'active' : ''}" id="btnAbaEmpenhoNova" onclick="Dashboard.toggleEmpenharModo('nova')">
            🚨 Nova Ocorrência (Despacho Inicial)
          </button>
          <button class="ocorr-tab-btn ${this._empenhoModo === 'apoio' ? 'active' : ''}" id="btnAbaEmpenhoApoio" onclick="Dashboard.toggleEmpenharModo('apoio')">
            🚑 Apoio em Ocorrência Ativa (${ocorrenciasAtivas.length})
          </button>
        </div>
      ` : ''}

      <!-- CONTAINER: MODO NOVA OCORRÊNCIA -->
      <div id="empenhoContainerNova" style="display:${this._empenhoModo === 'nova' ? 'block' : 'none'}">
        <div class="input-group" style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="input-label" style="font-weight:700;margin:0">Viaturas Disponíveis para Empenho <span style="color:#e53935">*</span></label>
            <span id="empenhoViatCount" style="font-size:0.75rem;color:var(--text-muted);font-weight:600">0 selecionada(s)</span>
          </div>
          <div id="empenhoViaturasList" style="display:flex;flex-direction:column;gap:6px;max-height:200px;overflow-y:auto;padding:2px">
            ${ativas.map(sv => {
              const tc = API.getTipoCor(sv.viaturaTipo || sv.viaturaNome?.substring(0, 3));
              const isPreselected = preselectedServicoViaturaId && sv.id === preselectedServicoViaturaId;
              const tripulantesNomes = (sv.tripulantes || []).map(t => t.nome).join(', ');
              return `
              <label class="ocorr-viat-box ${isPreselected ? 'selected' : ''}" data-svid="${sv.id}" id="labelEmpenho_${sv.id}">
                <input type="checkbox" name="empenhoViatura" value="${sv.id}" ${isPreselected ? 'checked' : ''} onchange="Dashboard.onEmpenhoViaturaToggle()">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:${tc}22;color:${tc};font-weight:700;font-size:0.72rem;flex-shrink:0">${sv.viaturaTipo || '?'}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.88rem;font-weight:700;color:var(--text-primary)">${Utils.escapeHtml(sv.viaturaNome || '')}</div>
                  <div style="font-size:0.75rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    Motorista: <strong>${Utils.escapeHtml(sv.motorista || '-')}</strong>${tripulantesNomes ? ` &bull; Guarnição: ${Utils.escapeHtml(tripulantesNomes)}` : ''}
                  </div>
                </div>
              </label>`;
            }).join('')}
          </div>
          <div id="empenhoEfetivoPreview" style="font-size:0.76rem;color:var(--text-muted);margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.08);border-radius:6px;display:none"></div>
          <div id="empenhoTelegrafiaAlerta" style="display:none;margin-top:6px;padding:8px 10px;background:#ff910022;border:1px solid #ff910055;border-radius:6px;font-size:0.78rem;color:#ff9100;font-weight:600">
            ⚠️ O operador atual da telegrafia está na guarnição selecionada e será desocupado automaticamente com o despacho!
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div class="input-group" style="flex:1">
            <label class="input-label" style="font-weight:600">Natureza da Ocorrência <span style="color:#e53935">*</span></label>
            <select class="input select" id="empenhoNatureza">
              ${Dashboard._naturezaOptions()}
            </select>
          </div>
          <div class="input-group" style="width:130px">
            <label class="input-label" style="font-weight:600">Hora Saída</label>
            <input type="time" class="input" id="empenhoHora" value="${agora}">
          </div>
        </div>

        <div class="input-group" style="margin-bottom:12px">
          <label class="input-label" style="font-weight:600">Título / Motivo do Chamado <span style="color:#e53935">*</span></label>
          <input type="text" class="input" id="empenhoTitulo" placeholder="Ex: Incêndio em residência na Rua Goiás, 120">
        </div>

        <div class="input-group" style="margin-bottom:12px">
          <label class="input-label" style="font-weight:600">Endereço / Ponto de Referência</label>
          <input type="text" class="input" id="empenhoEndereco" placeholder="Ex: Av. Principal, 1500 - Bairro Centro (próx. ao Supermercado)">
        </div>

        <div class="input-group" style="margin-bottom:12px">
          <label class="input-label">Observações / Relato Inicial do Solicitante</label>
          <textarea class="input" id="empenhoDescricao" rows="2" placeholder="Detalhes adicionais, vítimas no local, informações da triagem..."></textarea>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.75rem;color:var(--text-muted);border-top:1px solid var(--border-color);padding-top:10px">
          <span>Prontidão: <strong style="text-transform:uppercase;color:var(--prontidao-color)">${this.servico?.prontidao || 'verde'}</strong></span>
          <span>Status inicial: <strong style="color:#e53935">Em Atendimento</strong></span>
        </div>
      </div>

      <!-- CONTAINER: MODO APOIO EM OCORRÊNCIA ATIVA -->
      <div id="empenhoContainerApoio" style="display:${this._empenhoModo === 'apoio' ? 'block' : 'none'}">
        <div class="input-group" style="margin-bottom:14px">
          <label class="input-label" style="font-weight:700">Selecione a Ocorrência em Andamento <span style="color:#e53935">*</span></label>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;padding:2px">
            ${ocorrenciasAtivas.map(oc => {
              const isSelected = preselectedOcorrenciaId ? oc.id === preselectedOcorrenciaId : false;
              return `
              <label class="ocorr-viat-box ${isSelected ? 'selected' : ''}" style="padding:8px 12px" id="labelOcApoio_${oc.id}">
                <input type="radio" name="empenhoApoioOcorrencia" value="${oc.id}" ${isSelected ? 'checked' : ''} onchange="Dashboard._onApoioOcorrRadioChange('${oc.id}')">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-weight:700;color:#e53935;font-size:0.85rem">#${oc.numero}</span>
                    <span style="font-weight:600;font-size:0.85rem;color:var(--text-primary)">${Utils.escapeHtml(oc.titulo || '')}</span>
                  </div>
                  <div style="font-size:0.75rem;color:var(--text-secondary)">
                    ${Utils.escapeHtml(oc.natureza || '')} &bull; Acionamento: ${oc.horaAcionamento || '-'} (${this._getTempoDecorrido(oc.horaAcionamento)})
                  </div>
                </div>
              </label>`;
            }).join('')}
          </div>
        </div>

        <div class="input-group" style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <label class="input-label" style="font-weight:700;margin:0">Viaturas a Despachar em Apoio <span style="color:#e53935">*</span></label>
            <span id="empenhoApoioViatCount" style="font-size:0.75rem;color:var(--text-muted);font-weight:600">0 selecionada(s)</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:160px;overflow-y:auto;padding:2px">
            ${ativas.map(sv => {
              const tc = API.getTipoCor(sv.viaturaTipo || sv.viaturaNome?.substring(0, 3));
              const isPreselected = preselectedServicoViaturaId && sv.id === preselectedServicoViaturaId;
              return `
              <label class="ocorr-viat-box ${isPreselected ? 'selected' : ''}" id="labelEmpenhoApoio_${sv.id}">
                <input type="checkbox" name="empenhoApoioViatura" value="${sv.id}" ${isPreselected ? 'checked' : ''} onchange="Dashboard.onEmpenhoViaturaToggle()">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:${tc}22;color:${tc};font-weight:700;font-size:0.7rem;flex-shrink:0">${sv.viaturaTipo || '?'}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:0.85rem;font-weight:700;color:var(--text-primary)">${Utils.escapeHtml(sv.viaturaNome || '')}</div>
                  <div style="font-size:0.74rem;color:var(--text-secondary)">Motorista: ${Utils.escapeHtml(sv.motorista || '-')}</div>
                </div>
              </label>`;
            }).join('')}
          </div>
          <div id="empenhoApoioEfetivoPreview" style="font-size:0.76rem;color:var(--text-muted);margin-top:6px;padding:6px 8px;background:rgba(0,0,0,0.08);border-radius:6px;display:none"></div>
          <div id="empenhoApoioTelegrafiaAlerta" style="display:none;margin-top:6px;padding:8px 10px;background:#ff910022;border:1px solid #ff910055;border-radius:6px;font-size:0.78rem;color:#ff9100;font-weight:600"></div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div class="input-group" style="flex:1">
            <label class="input-label" style="font-weight:600">Motivo do Apoio / Missão</label>
            <input type="text" class="input" id="empenhoApoioMotivo" placeholder="Ex: Apoio de água, rescaldo, transporte de vítimas adicionais...">
          </div>
          <div class="input-group" style="width:130px">
            <label class="input-label" style="font-weight:600">Hora Saída</label>
            <input type="time" class="input" id="empenhoApoioHora" value="${agora}">
          </div>
        </div>
      </div>
    `;

    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="btnConfirmarEmpenho" onclick="Dashboard.confirmarEmpenho()" style="background:#e53935;border-color:#e53935;font-weight:700">
        🚨 Confirmar Empenho & Despachar
      </button>
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
    this.onEmpenhoViaturaToggle();
  },

  toggleEmpenharModo(modo) {
    this._empenhoModo = modo;
    const btnNova = document.getElementById('btnAbaEmpenhoNova');
    const btnApoio = document.getElementById('btnAbaEmpenhoApoio');
    const contNova = document.getElementById('empenhoContainerNova');
    const contApoio = document.getElementById('empenhoContainerApoio');
    const btnConfirmar = document.getElementById('btnConfirmarEmpenho');

    if (modo === 'nova') {
      if (btnNova) btnNova.classList.add('active');
      if (btnApoio) btnApoio.classList.remove('active');
      if (contNova) contNova.style.display = 'block';
      if (contApoio) contApoio.style.display = 'none';
      if (btnConfirmar) btnConfirmar.innerHTML = '🚨 Confirmar Empenho & Despachar';
    } else {
      if (btnNova) btnNova.classList.remove('active');
      if (btnApoio) btnApoio.classList.add('active');
      if (contNova) contNova.style.display = 'none';
      if (contApoio) contApoio.style.display = 'block';
      if (btnConfirmar) btnConfirmar.innerHTML = '🚑 Despachar Viaturas em Apoio';
    }
    this.onEmpenhoViaturaToggle();
  },

  _onApoioOcorrRadioChange(ocId) {
    document.querySelectorAll('input[name="empenhoApoioOcorrencia"]').forEach(r => {
      const label = document.getElementById('labelOcApoio_' + r.value);
      if (label) {
        if (r.checked) label.classList.add('selected');
        else label.classList.remove('selected');
      }
    });
  },

  onEmpenhoViaturaToggle() {
    const isModoApoio = this._empenhoModo === 'apoio';
    const selector = isModoApoio ? 'input[name="empenhoApoioViatura"]:checked' : 'input[name="empenhoViatura"]:checked';
    const checked = Array.from(document.querySelectorAll(selector));
    const countEl = document.getElementById(isModoApoio ? 'empenhoApoioViatCount' : 'empenhoViatCount');
    if (countEl) countEl.textContent = `${checked.length} viatura(s) selecionada(s)`;

    // Atualiza visual das caixas
    const allCheckboxes = document.querySelectorAll(isModoApoio ? 'input[name="empenhoApoioViatura"]' : 'input[name="empenhoViatura"]');
    allCheckboxes.forEach(cb => {
      const parent = cb.closest('label');
      if (parent) {
        if (cb.checked) parent.classList.add('selected');
        else parent.classList.remove('selected');
      }
    });

    const previewEl = document.getElementById(isModoApoio ? 'empenhoApoioEfetivoPreview' : 'empenhoEfetivoPreview');
    const alertaTeleEl = document.getElementById(isModoApoio ? 'empenhoApoioTelegrafiaAlerta' : 'empenhoTelegrafiaAlerta');
    const teleMilId = this.telegrafia?.militarId;
    let temTelegrafista = false;
    const todosIntegrantes = [];
    const idsDespachados = new Set();

    checked.forEach(cb => {
      const sv = (this.servicoViaturas || []).find(x => x.id === cb.value);
      if (sv) {
        if (sv.comandante) {
          todosIntegrantes.push(sv.comandante + ' (Comandante - ' + sv.viaturaNome + ')');
          if (sv.comandanteId) {
            idsDespachados.add(sv.comandanteId);
            if (sv.comandanteId === teleMilId) temTelegrafista = true;
          }
        }
        if (sv.motorista) {
          todosIntegrantes.push(sv.motorista + ' (Motorista - ' + sv.viaturaNome + ')');
          if (sv.motoristaId) {
            idsDespachados.add(sv.motoristaId);
            if (sv.motoristaId === teleMilId) temTelegrafista = true;
          }
        }
        (sv.tripulantes || []).forEach(t => {
          todosIntegrantes.push(t.nome + ' (' + (t.funcao || 'Auxiliar') + ' - ' + sv.viaturaNome + ')');
          if (t.id) {
            idsDespachados.add(t.id);
            if (t.id === teleMilId) temTelegrafista = true;
          }
        });
      }
    });

    if (previewEl) {
      if (todosIntegrantes.length > 0) {
        previewEl.style.display = 'block';
        previewEl.innerHTML = `<strong>👨‍🚒 Efetivo Total (${todosIntegrantes.length}):</strong> ${Utils.escapeHtml(todosIntegrantes.join(', '))}`;
      } else {
        previewEl.style.display = 'none';
      }
    }

    if (alertaTeleEl) {
      // Encontra militares disponíveis que NÃO estão em ocorrência nem no novo despacho
      const idsOcupados = new Set(idsDespachados);
      (this.servicoViaturas || []).filter(sv => sv.status === 'em_ocorrencia').forEach(sv => {
        if (sv.comandanteId) idsOcupados.add(sv.comandanteId);
        if (sv.motoristaId) idsOcupados.add(sv.motoristaId);
        (sv.tripulantes || []).forEach(t => { if (t.id) idsOcupados.add(t.id); });
      });
      const equipe = this.servico?.equipe || [];
      const disponiveis = equipe.filter(m => !idsOcupados.has(m.id));
      const operadorAtualNome = this.telegrafia?.operador || this.telegrafia?.militarNome || null;

      if (temTelegrafista) {
        alertaTeleEl.style.display = 'block';
        alertaTeleEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#ff9100;margin-bottom:4px">
            <span>⚠️</span> <span>Substituição na Telegrafia</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">
            O operador atual da telegrafia (<strong>${Utils.escapeHtml(operadorAtualNome || 'Operador atual')}</strong>) está na guarnição despachada e <strong>sairá da telegrafia</strong>. Defina quem assumirá ou opte por deixar vazia:
          </div>
          ${disponiveis.length === 0 ? `
            <div style="padding:6px 8px;background:rgba(229,57,53,0.15);border:1px solid rgba(229,57,53,0.3);border-radius:6px;font-size:0.78rem;color:#e53935;font-weight:600;margin-bottom:6px">
              ⚠️ Não há outros militares disponíveis no quartel no momento. A telegrafia será registrada na Linha do Tempo como VAZIA.
            </div>
          ` : ''}
          <div class="input-group" style="margin:0">
            <label class="input-label" style="font-weight:600;font-size:0.78rem">Situação da Telegrafia <span style="color:#e53935">*</span></label>
            <select class="input select" id="${isModoApoio ? 'empenhoApoioNovoTelegrafista' : 'empenhoNovoTelegrafista'}" style="background:var(--surface,#1a1a2e)">
              ${disponiveis.length === 0 
                ? '<option value="__VAZIA__" selected>⚠️ Deixar telegrafia vazia (sem operador disponível no quartel)</option>' 
                : `
                  <option value="__VAZIA__">⚠️ Deixar telegrafia vazia (sem operador)</option>
                  ${disponiveis.map((m, idx) => `<option value="${m.id}" ${idx === 0 ? 'selected' : ''}>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}</option>`).join('')}
                `}
            </select>
          </div>
        `;
      } else if (!operadorAtualNome && checked.length > 0) {
        alertaTeleEl.style.display = 'block';
        alertaTeleEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#0288d1;margin-bottom:4px">
            <span>📡</span> <span>Telegrafia do Quartel</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:8px">
            A telegrafia está atualmente sem operador. Você pode designar um militar disponível ou mantê-la vazia:
          </div>
          <div class="input-group" style="margin:0">
            <label class="input-label" style="font-weight:600;font-size:0.78rem">Operador da Telegrafia</label>
            <select class="input select" id="${isModoApoio ? 'empenhoApoioNovoTelegrafista' : 'empenhoNovoTelegrafista'}" style="background:var(--surface,#1a1a2e)">
              <option value="__VAZIA__" selected>⚠️ Manter telegrafia vazia</option>
              ${disponiveis.map(m => `<option value="${m.id}">${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}</option>`).join('')}
            </select>
          </div>
        `;
      } else {
        alertaTeleEl.style.display = 'none';
        alertaTeleEl.innerHTML = '';
      }
    }
  },

  async confirmarEmpenho() {
    if (this._empenhoModo === 'apoio') {
      await this.confirmarEmpenhoApoio();
    } else {
      await this.confirmarEmpenhoNovaOcorrencia();
    }
  },

  async confirmarEmpenhoNovaOcorrencia() {
    const checked = Array.from(document.querySelectorAll('input[name="empenhoViatura"]:checked'));
    if (!checked.length) {
      Utils.showToast('Selecione pelo menos uma viatura para o empenho', 'warning');
      return;
    }
    const titulo = document.getElementById('empenhoTitulo')?.value.trim();
    if (!titulo) {
      Utils.showToast('Informe o título / motivo da ocorrência', 'warning');
      document.getElementById('empenhoTitulo')?.focus();
      return;
    }
    const natureza = document.getElementById('empenhoNatureza')?.value || 'Ocorrência Geral';
    const endereco = document.getElementById('empenhoEndereco')?.value.trim() || '';
    const descricao = document.getElementById('empenhoDescricao')?.value.trim() || '';
    const horaAcionamento = document.getElementById('empenhoHora')?.value || Utils.formatTime(new Date());

    const svIds = checked.map(c => c.value);
    const selectedViats = (this.servicoViaturas || []).filter(sv => svIds.includes(sv.id));
    const viaturaIds = selectedViats.map(sv => sv.viaturaId);
    
    // Consolida efetivo de todas as viaturas
    const efetivoSet = new Set();
    selectedViats.forEach(sv => {
      if (sv.comandante) efetivoSet.add(sv.comandante);
      if (sv.motorista) efetivoSet.add(sv.motorista);
      (sv.tripulantes || []).forEach(t => { if (t.nome) efetivoSet.add(t.nome); });
    });
    const efetivo = Array.from(efetivoSet);

    // Identifica se o operador da telegrafia está sendo despachado e quem assume
    const teleMilId = this.telegrafia?.militarId;
    const temTelegrafista = teleMilId && selectedViats.some(sv => {
      const ids = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
      return ids.includes(teleMilId);
    });
    const novoTeleId = document.getElementById('empenhoNovoTelegrafista')?.value || '';

    const btn = document.getElementById('btnConfirmarEmpenho');
    if (btn) { btn.disabled = true; btn.textContent = 'Despachando viaturas...'; }

    try {
      const isTeleVazia = novoTeleId === '__VAZIA__' || (!novoTeleId && temTelegrafista);
      const result = await API.criarOcorrencia({
        titulo,
        natureza,
        endereco,
        descricao,
        viaturaIds,
        servicoViaturaIds: svIds,
        efetivo,
        horaAcionamento,
        horaOcorrencia: horaAcionamento,
        prontidaoCor: this.servico?.prontidao || 'verde',
        servicoId: this.servico?.id,
        telegrafiaVazia: isTeleVazia,
        novoTelegrafistaId: novoTeleId
      });

      if (!result.success) {
        Utils.showToast(result.error || 'Erro ao criar ocorrência', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '🚨 Confirmar Empenho & Despachar'; }
        return;
      }

      // Garante despacho de cada viatura para manter integridade com o backend GAS
      for (const sv of selectedViats) {
        await API.despacharViatura(sv.id, result.numero, titulo);
      }

      // Se o telegrafista estava na guarnição despachada ou foi solicitado telegrafista
      if (temTelegrafista || (novoTeleId && novoTeleId !== '')) {
        if (novoTeleId && novoTeleId !== '__VAZIA__') {
          const novoMilitar = (this.servico?.equipe || []).find(m => m.id === novoTeleId);
          await API.registrarTelegrafia(this.servico.id, novoTeleId);
          Utils.log('troca_telegrafia', `Novo telegrafista: ${novoMilitar?.nome || novoTeleId}`, 'dashboard');
          Utils.showToast(`📡 ${novoMilitar?.nome || 'Novo militar'} assumiu a telegrafia.`, 'info');
        } else {
          // Telegrafia vazia registrada na linha do tempo
          await API.registrarTelegrafia(this.servico.id, '__VAZIA__');
          Utils.log('telegrafia_vazia', 'Telegrafia registrada como vazia — sem operador disponível', 'dashboard');
          Utils.showToast('📡 Telegrafia registrada como VAZIA na Linha do Tempo.', 'warning');
        }
      }

      const viatNomes = selectedViats.map(v => v.viaturaNome).join(', ');
      Utils.log('empenho_ocorrencia', `Ocorrência #${result.numero} empenhada: ${titulo} — Viaturas: ${viatNomes}`, 'dashboard');
      Utils.playSound('nova-ocorrencia');
      Utils.showToast(`🚨 Ocorrência #${result.numero} registrada e ${selectedViats.length} viatura(s) empenhada(s)!`, 'success');
      
      this.closeModal();

      const fresh = await API.getServicoAtual(Auth.userId);
      this.servicoViaturas = fresh.servicoViaturas || [];
      this.ocorrencias = fresh.ocorrencias || [];
      if (fresh.telegrafia !== undefined) this.telegrafia = fresh.telegrafia;
      this.renderViaturaPanel();
      this.updateTelegrafia(fresh.telegrafia);
      this.updateTimeline();
      if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) await NAV.checkOcorrenciasAtivas();
    } catch(e) {
      Utils.showToast('Erro no empenho: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🚨 Confirmar Empenho & Despachar'; }
    }
  },

  async confirmarEmpenhoApoio() {
    const radioSelected = document.querySelector('input[name="empenhoApoioOcorrencia"]:checked');
    if (!radioSelected) {
      Utils.showToast('Selecione a ocorrência que receberá o apoio', 'warning');
      return;
    }
    const checked = Array.from(document.querySelectorAll('input[name="empenhoApoioViatura"]:checked'));
    if (!checked.length) {
      Utils.showToast('Selecione pelo menos uma viatura para despacho em apoio', 'warning');
      return;
    }
    const ocorrId = radioSelected.value;
    const oc = (this.ocorrencias || []).find(x => x.id === ocorrId);
    const motivoApoio = document.getElementById('empenhoApoioMotivo')?.value.trim() || '';
    const horario = document.getElementById('empenhoApoioHora')?.value || Utils.formatTime(new Date());
    const svIds = checked.map(c => c.value);
    const selectedViats = (this.servicoViaturas || []).filter(sv => svIds.includes(sv.id));

    // Identifica se o operador da telegrafia está sendo despachado e quem assume
    const teleMilId = this.telegrafia?.militarId;
    const temTelegrafista = teleMilId && selectedViats.some(sv => {
      const ids = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
      return ids.includes(teleMilId);
    });
    const novoTeleId = document.getElementById('empenhoApoioNovoTelegrafista')?.value || '';

    const btn = document.getElementById('btnConfirmarEmpenho');
    if (btn) { btn.disabled = true; btn.textContent = 'Despachando apoio...'; }

    try {
      const isTeleVazia = novoTeleId === '__VAZIA__' || (!novoTeleId && temTelegrafista);
      const result = await API.empenharReforcoOcorrencia({
        ocorrenciaId: ocorrId,
        servicoViaturaIds: svIds,
        motivoApoio,
        horario,
        telegrafiaVazia: isTeleVazia,
        novoTelegrafistaId: novoTeleId
      });

      if (!result.success) {
        Utils.showToast(result.error || 'Erro ao registrar apoio', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '🚑 Despachar Viaturas em Apoio'; }
        return;
      }

      for (const sv of selectedViats) {
        await API.despacharViatura(sv.id, oc?.numero || '', (oc?.titulo || '') + (motivoApoio ? ' (Apoio)' : ''));
      }

      // Se o telegrafista estava na guarnição despachada ou foi definido telegrafista
      if (temTelegrafista || (novoTeleId && novoTeleId !== '')) {
        if (novoTeleId && novoTeleId !== '__VAZIA__') {
          const novoMilitar = (this.servico?.equipe || []).find(m => m.id === novoTeleId);
          await API.registrarTelegrafia(this.servico.id, novoTeleId);
          Utils.log('troca_telegrafia', `Novo telegrafista: ${novoMilitar?.nome || novoTeleId}`, 'dashboard');
          Utils.showToast(`📡 ${novoMilitar?.nome || 'Novo militar'} assumiu a telegrafia.`, 'info');
        } else {
          await API.registrarTelegrafia(this.servico.id, '__VAZIA__');
          Utils.log('telegrafia_vazia', 'Telegrafia registrada como vazia — sem operador disponível', 'dashboard');
          Utils.showToast('📡 Telegrafia registrada como VAZIA na Linha do Tempo.', 'warning');
        }
      }

      const viatNomes = selectedViats.map(v => v.viaturaNome).join(', ');
      Utils.log('empenho_apoio', `Apoio despachado para Ocorrência #${oc?.numero}: ${viatNomes}${motivoApoio ? ' — ' + motivoApoio : ''}`, 'dashboard');
      Utils.showToast(`🚑 Viatura(s) ${viatNomes} despachada(s) em apoio à Ocorrência #${oc?.numero || ''}!`, 'success');

      this.closeModal();

      const fresh = await API.getServicoAtual(Auth.userId);
      this.servicoViaturas = fresh.servicoViaturas || [];
      this.ocorrencias = fresh.ocorrencias || [];
      if (fresh.telegrafia !== undefined) this.telegrafia = fresh.telegrafia;
      this.renderViaturaPanel();
      this.updateTelegrafia(fresh.telegrafia);
      this.updateTimeline();
      if (typeof NAV !== 'undefined' && NAV.checkOcorrenciasAtivas) await NAV.checkOcorrenciasAtivas();
    } catch(e) {
      Utils.showToast('Erro ao enviar apoio: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🚑 Despachar Viaturas em Apoio'; }
    }
  },

  isTelegrafiaVazia() {
    if (!this.servico) return false;
    const t = this.telegrafia;
    if (!t) return true;
    if (!t.militarId || t.militarId === '__VAZIA__' || t.militarId === '') return true;
    if (!t.operador || t.operador === '---') return true;
    return false;
  },

  getTelegrafiaVaziaInfo() {
    let inicio = this.telegrafiaVazioDesde || null;
    if (!inicio) {
      const allEvents = (this.rotina || []).concat(TimelineStore.getAll(this.servico?.id));
      const vaziaEvt = [...allEvents].reverse().find(e => (e.id || '').startsWith('r-tele-') && (
        (e.nome || '').toLowerCase().includes('vazia') ||
        (e.nome || '').toLowerCase().includes('sem operador') ||
        (e.nome || '').toLowerCase().includes('liberada')
      ));
      if (vaziaEvt) {
        inicio = vaziaEvt.horario || vaziaEvt.horaConclusao;
      }
    }
    const agora = Utils.formatDateTime(new Date());
    const duracao = this._calcularTempoVazia(inicio, agora);
    return { inicio: inicio || agora, duracao };
  },

  _calcularTempoVazia(inicio, fim) {
    if (!inicio) return 'alguns minutos';
    try {
      const parseMins = (t) => {
        if (typeof t === 'string' && t.includes(':')) {
          const parts = t.split(':');
          return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
        }
        if (t instanceof Date) {
          return t.getHours() * 60 + t.getMinutes();
        }
        return null;
      };
      const fimMins = fim ? parseMins(fim) : parseMins(new Date());
      const iniMins = parseMins(inicio);
      if (iniMins !== null && fimMins !== null) {
        let diff = fimMins - iniMins;
        if (diff < 0) diff += 1440;
        if (diff === 0) return 'menos de 1 min';
        const h = Math.floor(diff / 60);
        const m = diff % 60;
        if (h > 0) return `${h}h ${m}min`;
        return `${m} min`;
      }
      return 'alguns minutos';
    } catch(e) {
      return 'alguns minutos';
    }
  },

  getComposicaoViaturas(viaturas) {
    if (!Array.isArray(viaturas)) viaturas = [viaturas].filter(Boolean);
    const equipe = this.servico?.equipe || [];
    const mapMil = new Map(equipe.map(m => [m.id, m]));
    const membros = [];

    const addMembro = (id, nome, funcao) => {
      if (!id && !nome) return;
      if (id && membros.some(m => m.id === id)) return;
      if (nome && membros.some(m => m.nome === nome)) return;
      const mil = id ? mapMil.get(id) : null;
      membros.push({
        id: id || ('mil-' + Math.random().toString(36).substr(2, 6)),
        nome: mil?.nome || nome || 'Militar',
        posto: mil?.posto || '',
        funcao: funcao || 'Guarnição'
      });
    };

    viaturas.forEach(sv => {
      if (!sv) return;
      (sv.tripulantes || []).forEach(t => {
        if (t) addMembro(t.id, t.nome, t.funcao || 'Tripulante');
      });
      if (sv.motoristaId || sv.motorista) {
        addMembro(sv.motoristaId, sv.motorista, 'Motorista');
      }
      if (sv.comandanteId || sv.comandante) {
        addMembro(sv.comandanteId, sv.comandante, 'Comandante');
      }
    });

    if (membros.length === 0) {
      const idsOcupados = new Set();
      (this.servicoViaturas || []).filter(v => v.status === 'em_ocorrencia').forEach(v => {
        if (v.comandanteId) idsOcupados.add(v.comandanteId);
        if (v.motoristaId) idsOcupados.add(v.motoristaId);
        (v.tripulantes || []).forEach(t => { if (t.id) idsOcupados.add(t.id); });
      });
      equipe.filter(m => !idsOcupados.has(m.id)).forEach(m => {
        addMembro(m.id, m.nome, 'Efetivo Quartel');
      });
    }

    return membros;
  },

  mostrarModalAssumirTelegrafia(membros, infoVazia, viaturaNome) {
    return new Promise((resolve) => {
      let modal = document.getElementById('modalAssumirTelegrafia');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modalAssumirTelegrafia';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
        document.body.appendChild(modal);
      }

      const duracaoTexto = infoVazia.duracao || 'alguns minutos';
      const inicioTexto = infoVazia.inicio ? ` (vazia desde as ${infoVazia.inicio})` : '';

      modal.innerHTML = `
        <div class="modal" style="max-width:520px;width:100%;background:var(--bg-card, #1e293b);border:1px solid var(--border-color, #334155);border-radius:12px;padding:24px;box-shadow:0 12px 30px rgba(0,0,0,0.5)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;border-bottom:1px solid var(--border-color, #334155);padding-bottom:12px">
            <h3 style="margin:0;font-size:1.15rem;font-weight:700;display:flex;align-items:center;gap:8px;color:var(--text-primary)">
              <span>📡</span> Assumir Telegrafia — Retorno de Viatura
            </h3>
          </div>

          <div style="background:#ff910018;border:1px solid #ff910055;border-radius:8px;padding:12px 14px;margin-bottom:16px;color:#ff9100">
            <div style="font-weight:700;font-size:0.92rem;margin-bottom:4px">⚠️ Telegrafia estava sem operador</div>
            <div style="font-size:0.84rem;color:var(--text-secondary)">
              A telegrafia esteve <strong>vazia por ${duracaoTexto}</strong>${inicioTexto}.
              Com o retorno da viatura <strong>${Utils.escapeHtml(viaturaNome || 'retornada')}</strong>, alguém da composição deve assumir o posto de Telegrafista:
            </div>
          </div>

          <div style="margin-bottom:18px">
            <label style="display:block;font-size:0.85rem;font-weight:700;color:var(--text-primary);margin-bottom:8px">
              Selecione o militar da guarnição que assumirá a telegrafia:
            </label>
            <div style="display:flex;flex-direction:column;gap:8px;max-height:220px;overflow-y:auto;padding:2px" id="listaMembrosAssumirTele">
              ${membros.map((m, idx) => `
                <label style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--bg-surface, rgba(255,255,255,0.04));border:1.5px solid ${idx === 0 ? '#00c853' : 'var(--border-color, #334155)'};border-radius:8px;cursor:pointer;transition:all 0.15s" id="lblMembroTele_${m.id}">
                  <input type="radio" name="membroAssumirTele" value="${m.id}" data-nome="${Utils.escapeHtml(m.nome)}" ${idx === 0 ? 'checked' : ''} onchange="Dashboard._onMembroTeleRadioChange('${m.id}')">
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:0.9rem;color:var(--text-primary)">${Utils.escapeHtml(m.nome)}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted)">
                      Função na viatura: <strong style="color:var(--text-secondary)">${Utils.escapeHtml(m.funcao)}</strong>${m.posto ? ` &bull; ${Utils.escapeHtml(m.posto)}` : ''}
                    </div>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button class="btn btn-primary" id="btnAssumirTelegrafiaRetorno" style="background:#00c853;border:none;color:#fff;font-weight:700;padding:10px 18px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px">
              <span>📡</span> Confirmar e Assumir Telegrafia
            </button>
          </div>
        </div>
      `;
      modal.style.display = 'flex';

      const btnConfirmar = document.getElementById('btnAssumirTelegrafiaRetorno');
      if (btnConfirmar) {
        btnConfirmar.onclick = () => {
          const checked = modal.querySelector('input[name="membroAssumirTele"]:checked');
          const mId = checked ? checked.value : (membros[0]?.id || null);
          const mNome = checked ? checked.getAttribute('data-nome') : (membros[0]?.nome || 'Militar');
          modal.style.display = 'none';
          resolve({ militarId: mId, militarNome: mNome });
        };
      }
    });
  },

  _onMembroTeleRadioChange(selectedId) {
    const modal = document.getElementById('modalAssumirTelegrafia');
    if (!modal) return;
    modal.querySelectorAll('label[id^="lblMembroTele_"]').forEach(lbl => {
      lbl.style.borderColor = 'var(--border-color, #334155)';
    });
    const selectedLbl = document.getElementById(`lblMembroTele_${selectedId}`);
    if (selectedLbl) selectedLbl.style.borderColor = '#00c853';
  },

  async registrarAssuncaoTelegrafia(militarId, militarNome, duracaoVazia, viaturaNome) {
    if (!this.servico || !militarId) return;
    const agora = Utils.formatDateTime(new Date());
    const duracaoStr = duracaoVazia || 'alguns minutos';
    const vNomeStr = viaturaNome ? ` após retorno da viatura ${viaturaNome}` : '';

    try {
      await API.registrarTelegrafia(this.servico.id, militarId, {
        tempoVazia: duracaoStr,
        viaturaNome: viaturaNome || '',
        assumiuPorRetorno: true
      });

      this.telegrafia = { operador: militarNome, militarId, horario: agora };
      this.telegrafiaVazioDesde = null;

      const evtTele = {
        id: 'r-tele-' + Date.now(),
        horario: agora,
        nome: `📡 ${militarNome} assumiu a telegrafia${vNomeStr} (telegrafia esteve vazia por ${duracaoStr})`,
        programa: 'Telegrafia',
        responsavel: militarNome,
        status: 'concluida',
        concluidoPor: 'Sistema',
        horaConclusao: agora
      };

      this.rotina.push(evtTele);
      TimelineStore.add(evtTele, this.servico.id);

      Utils.log('retorno_telegrafia', `${militarNome} assumiu a telegrafia${vNomeStr} (telegrafia esteve vazia por ${duracaoStr})`, 'dashboard');
      Utils.showToast(`📡 ${militarNome} assumiu a telegrafia${vNomeStr} (esteve vazia por ${duracaoStr})`, 'success');

      this.updateTelegrafia(this.telegrafia);
      this.updateTimeline();
    } catch(e) {
      console.error('Erro ao registrar assunção de telegrafia:', e);
    }
  },

  async encerrarOcorrenciaRapida(ocorrId, servicoViaturaId = null) {
    let oc = (this.ocorrencias || []).find(x => String(x.id) === String(ocorrId));
    let sv = servicoViaturaId ? (this.servicoViaturas || []).find(x => String(x.id) === String(servicoViaturaId)) : null;
    if (!oc && sv) {
      oc = (this.ocorrencias || []).find(o => (o.viaturaIds || []).some(vid => String(vid) === String(sv.viaturaId)) && o.status !== 'finalizada' && o.status !== 'cancelada');
    }
    if (!oc && !sv && (!ocorrId || ocorrId === '')) {
      const ativas = (this.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
      if (ativas.length === 1) oc = ativas[0];
      const svsAtivas = (this.servicoViaturas || []).filter(v => v.status === 'em_ocorrencia');
      if (!oc && svsAtivas.length === 1) sv = svsAtivas[0];
    }

    if (!oc && !sv) {
      Utils.showToast('Nenhuma ocorrência ou viatura encontrada para encerrar.', 'warning');
      this.closeModal();
      if (typeof NAV !== 'undefined') {
        NAV.fecharModalEncerrar();
        await NAV.checkOcorrenciasAtivas();
      }
      return;
    }

    const ocNumero = oc ? `#${oc.numero}` : '';
    const viatNome = sv ? sv.viaturaNome : (oc ? (this.servicoViaturas || []).filter(v => (oc.viaturaIds || []).some(vid => String(vid) === String(v.viaturaId))).map(v => v.viaturaNome).join(', ') : 'viatura');

    let viatsRetornando = [];
    if (oc) {
      if (servicoViaturaId && (oc.viaturaIds || []).length > 1) {
        viatsRetornando = sv ? [sv] : [];
      } else {
        viatsRetornando = (this.servicoViaturas || []).filter(v => (oc.viaturaIds || []).some(vid => String(vid) === String(v.viaturaId)));
      }
    } else if (sv) {
      viatsRetornando = [sv];
    }

    const isVazia = this.isTelegrafiaVazia();
    let novoTelegrafista = null;
    let duracaoVazia = '';
    if (isVazia && viatsRetornando.length > 0) {
      const membros = this.getComposicaoViaturas(viatsRetornando);
      const infoVazia = this.getTelegrafiaVaziaInfo();
      duracaoVazia = infoVazia.duracao;
      const vNome = viatsRetornando.map(v => v.viaturaNome).join(', ') || viatNome;
      if (membros.length > 0) {
        novoTelegrafista = await this.mostrarModalAssumirTelegrafia(membros, infoVazia, vNome);
      }
    }

    try {
      const agora = Utils.formatDateTime(new Date());
      const tempoDecorrido = oc ? this._getTempoDecorrido(oc.horaAcionamento) : '-';
      const desfechoPadrao = 'Ocorrência atendida e finalizada. Viatura retornou disponível à base.';

      if (oc) {
        if (servicoViaturaId && (oc.viaturaIds || []).length > 1) {
          // Desempenho parcial: libera apenas esta viatura e a ocorrência continua com as outras
          await API.finalizarOcorrencia({
            id: oc.id,
            ocorrenciaId: oc.id,
            liberarApenasServicoViaturaId: servicoViaturaId,
            horaRetorno: agora,
            destinoStatus: 'ativa'
          });
          await API.retornarViatura({
            id: servicoViaturaId,
            servicoViaturaId,
            status: 'ativa',
            destinoStatus: 'ativa',
            horarioRetorno: agora,
            novoTelegrafistaId: novoTelegrafista?.militarId,
            novoTelegrafistaNome: novoTelegrafista?.militarNome,
            tempoVazia: duracaoVazia
          });
          Utils.log('desempenho_viatura', `Viatura ${viatNome} liberada da Ocorrência ${ocNumero} e retornou DISPONÍVEL`, 'dashboard');
          Utils.showToast(`🏁 Viatura ${viatNome} liberada da ocorrência ${ocNumero} e agora está DISPONÍVEL!`, 'success');
        } else {
          // Encerramento total da ocorrência
          await API.finalizarOcorrencia({
            id: oc.id,
            ocorrenciaId: oc.id,
            horaRetorno: agora,
            desfecho: desfechoPadrao,
            status: 'finalizada',
            destinoStatus: 'ativa',
            duracao: tempoDecorrido
          });
          const viats = (this.servicoViaturas || []).filter(v => (oc.viaturaIds || []).some(vid => String(vid) === String(v.viaturaId)));
          for (const v of viats) {
            await API.retornarViatura({
              id: v.id,
              servicoViaturaId: v.id,
              status: 'ativa',
              destinoStatus: 'ativa',
              horarioRetorno: agora,
              novoTelegrafistaId: novoTelegrafista?.militarId,
              novoTelegrafistaNome: novoTelegrafista?.militarNome,
              tempoVazia: duracaoVazia
            });
          }
          Utils.log('finalizar_ocorrencia', `Ocorrência ${ocNumero} finalizada — Viatura(s) ${viatNome} retornada(s) para DISPONÍVEL`, 'dashboard');
          Utils.showToast(`🏁 Ocorrência ${ocNumero} encerrada com sucesso! Viatura(s) retornou ao status DISPONÍVEL.`, 'success');
        }
      } else if (sv) {
        await API.retornarViatura({
          id: sv.id,
          servicoViaturaId: sv.id,
          status: 'ativa',
          destinoStatus: 'ativa',
          horarioRetorno: agora,
          novoTelegrafistaId: novoTelegrafista?.militarId,
          novoTelegrafistaNome: novoTelegrafista?.militarNome,
          tempoVazia: duracaoVazia
        });
        Utils.showToast(`🏁 Viatura ${sv.viaturaNome} retornou ao status DISPONÍVEL na base!`, 'success');
      }

      if (novoTelegrafista && novoTelegrafista.militarId) {
        const vNome = viatsRetornando.map(v => v.viaturaNome).join(', ') || viatNome;
        await this.registrarAssuncaoTelegrafia(novoTelegrafista.militarId, novoTelegrafista.militarNome, duracaoVazia, vNome);
      }

      this.closeModal();
      if (typeof NAV !== 'undefined') {
        NAV.fecharModalEncerrar();
        await NAV.checkOcorrenciasAtivas();
      }

      const fresh = await API.getServicoAtual(Auth.userId, true);
      this.servicoViaturas = fresh.servicoViaturas || [];
      this.ocorrencias = fresh.ocorrencias || [];
      if (fresh.telegrafia !== undefined) this.telegrafia = fresh.telegrafia;
      this.renderViaturaPanel();
      this.updateTimeline();
      this.updateTelegrafia(this.telegrafia);
      if (typeof NAV !== 'undefined') await NAV.checkOcorrenciasAtivas();
    } catch (e) {
      Utils.showToast('Erro ao encerrar: ' + e.message, 'error');
    }
  },

  showEncerrarOcorrenciaModal(ocorrId, servicoViaturaId = null) {
    const oc = (this.ocorrencias || []).find(x => x.id === ocorrId);
    if (!oc) {
      Utils.showToast('Ocorrência não encontrada', 'error');
      return;
    }

    const modalEl = document.querySelector('#modalOverlay .modal');
    if (modalEl) modalEl.style.maxWidth = '640px';

    const viaturasDaOcorr = (this.servicoViaturas || []).filter(sv => (oc.viaturaIds || []).includes(sv.viaturaId));
    const svAlvo = servicoViaturaId ? (this.servicoViaturas || []).find(x => x.id === servicoViaturaId) : null;
    const tempoDecorrido = this._getTempoDecorrido(oc.horaAcionamento);
    const agoraHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    document.getElementById('modalTitle').textContent = `🏁 Encerrar Ocorrência #${oc.numero}`;
    document.getElementById('modalBody').innerHTML = `
      <!-- RESUMO OPERACIONAL -->
      <div style="background:var(--bg-card, rgba(255,255,255,0.03));border:1px solid var(--border-color);border-radius:10px;padding:12px 14px;margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-wrap:wrap;gap:6px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:#e5393522;color:#e53935;font-weight:700;padding:2px 8px;border-radius:6px;font-size:0.75rem">#${oc.numero}</span>
            <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary)">${Utils.escapeHtml(oc.titulo || '')}</span>
          </div>
          <span style="font-size:0.75rem;padding:2px 8px;border-radius:12px;background:var(--border-color);color:var(--text-secondary)">${Utils.escapeHtml(oc.natureza || 'Geral')}</span>
        </div>

        ${oc.endereco ? `
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px">
            📍 <strong>Local:</strong> ${Utils.escapeHtml(oc.endereco)}
          </div>
        ` : ''}

        <div style="display:flex;align-items:center;gap:14px;font-size:0.78rem;color:var(--text-secondary);flex-wrap:wrap">
          <div>⏰ Acionamento: <strong>${oc.horaAcionamento || '--:--'}</strong></div>
          <div>⏱ Duração: <strong style="color:#e53935">${tempoDecorrido}</strong></div>
          <div>🚒 Viaturas: <strong>${viaturasDaOcorr.map(v => v.viaturaNome).join(', ') || '-'}</strong></div>
        </div>
      </div>

      <!-- OPÇÃO DE DESEMPENHO PARCIAL (se houver mais de uma viatura e tiver viatura alvo) -->
      ${viaturasDaOcorr.length > 1 && svAlvo ? `
        <div class="input-group" style="margin-bottom:14px;background:rgba(255,145,0,0.08);border:1px solid rgba(255,145,0,0.3);border-radius:8px;padding:10px">
          <label class="input-label" style="font-weight:700;color:#ff9100;margin-bottom:6px">Tipo de Liberação</label>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer">
              <input type="radio" name="encerrarEscopo" value="total" checked onchange="Dashboard._onEscopoEncerramentoChange()">
              <span><strong>Encerrar Ocorrência Completa:</strong> Finalizar o chamado e liberar todas as ${viaturasDaOcorr.length} viaturas</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:0.85rem;cursor:pointer">
              <input type="radio" name="encerrarEscopo" value="parcial" onchange="Dashboard._onEscopoEncerramentoChange()">
              <span><strong>Liberar Apenas esta Viatura (${Utils.escapeHtml(svAlvo.viaturaNome)}):</strong> A ocorrência continuará em andamento com as demais viaturas</span>
            </label>
          </div>
        </div>
      ` : `<input type="hidden" name="encerrarEscopo" value="total">`}

      <div style="display:flex;gap:12px;margin-bottom:12px">
        <div class="input-group" style="flex:1">
          <label class="input-label" style="font-weight:600">Status de Encerramento</label>
          <select class="input select" id="encerrarStatus">
            <option value="finalizada">Concluída com Êxito (Atendida)</option>
            <option value="cancelada">Cancelada no Deslocamento</option>
            <option value="trote">Trote / Falso Chamado</option>
            <option value="apoio_desnecessario">Apoio Dispensado no Local</option>
          </select>
        </div>
        <div class="input-group" style="width:140px">
          <label class="input-label" style="font-weight:600">Hora Término</label>
          <input type="time" step="1" class="input" id="encerrarHora" value="${agoraHora}">
        </div>
      </div>

      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:600">Destino / Situação Pós-Atendimento da(s) Viatura(s)</label>
        <select class="input select" id="encerrarDestinoViatura">
          <option value="ativa">Disponível na Base (Pronta no quartel)</option>
          <option value="retornando">Em Retorno ao Quartel (Em trânsito)</option>
        </select>
      </div>

      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label" style="font-weight:600">Desfecho / Histórico Final do Atendimento</label>
        <textarea class="input" id="encerrarDesfecho" rows="3" placeholder="Descreva sucintamente as providências adotadas, estado das vítimas ou situação do local... Ex: Incêndio extinto pela guarnição com uso de mangotinho. Rescaldo efetuado. Sem vítimas. Local entregue ao responsável."></textarea>
      </div>

      <div style="font-size:0.75rem;color:var(--text-muted)">
        Ao confirmar, os horários e histórico de atendimento serão registrados na Linha do Tempo e Rotina do plantão.
      </div>
    `;

    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btnConfirmarEncerramento" style="background:#00c853;border-color:#00c853;color:#fff;font-weight:700" onclick="Dashboard.confirmarEncerramentoOcorrencia('${oc.id}', '${servicoViaturaId || ''}')">
        🏁 Confirmar Encerramento
      </button>
    `;

    document.getElementById('modalOverlay').style.display = 'flex';
  },

  _onEscopoEncerramentoChange() {
    const escopo = document.querySelector('input[name="encerrarEscopo"]:checked')?.value;
    const btn = document.getElementById('btnConfirmarEncerramento');
    if (btn) {
      if (escopo === 'parcial') {
        btn.innerHTML = '🏠 Liberar Apenas Viatura';
        btn.style.background = '#ff9100';
        btn.style.borderColor = '#ff9100';
      } else {
        btn.innerHTML = '🏁 Confirmar Encerramento da Ocorrência';
        btn.style.background = '#00c853';
        btn.style.borderColor = '#00c853';
      }
    }
  },

  async confirmarEncerramentoOcorrencia(ocorrId, servicoViaturaId = '') {
    const oc = (this.ocorrencias || []).find(x => x.id === ocorrId);
    if (!oc) return;

    const horaInput = document.getElementById('encerrarHora')?.value;
    const horaRetorno = horaInput ? Utils.formatDateTime(horaInput) : Utils.formatDateTime(new Date());
    const status = document.getElementById('encerrarStatus')?.value || 'finalizada';
    const destinoStatus = document.getElementById('encerrarDestinoViatura')?.value || 'ativa';
    const desfecho = document.getElementById('encerrarDesfecho')?.value.trim() || '';
    const escopo = document.querySelector('input[name="encerrarEscopo"]:checked')?.value || 'total';

    const btn = document.getElementById('btnConfirmarEncerramento');
    if (btn) { btn.disabled = true; btn.textContent = 'Processando...'; }

    try {
      const isVazia = this.isTelegrafiaVazia();
      let novoTelegrafista = null;
      let duracaoVazia = '';
      const viatsRetornando = (escopo === 'parcial' && servicoViaturaId)
        ? [sv].filter(Boolean)
        : (this.servicoViaturas || []).filter(v => (oc.viaturaIds || []).some(vid => String(vid) === String(v.viaturaId)));

      if (isVazia && viatsRetornando.length > 0) {
        const membros = this.getComposicaoViaturas(viatsRetornando);
        const infoVazia = this.getTelegrafiaVaziaInfo();
        duracaoVazia = infoVazia.duracao;
        const vNome = viatsRetornando.map(v => v.viaturaNome).join(', ');
        if (membros.length > 0) {
          novoTelegrafista = await this.mostrarModalAssumirTelegrafia(membros, infoVazia, vNome);
        }
      }

      if (escopo === 'parcial' && servicoViaturaId) {
        // Liberação de viatura específica (desempenho parcial)
        const sv = (this.servicoViaturas || []).find(x => String(x.id) === String(servicoViaturaId));
        const result = await API.finalizarOcorrencia({
          id: ocorrId,
          liberarApenasServicoViaturaId: servicoViaturaId,
          horaRetorno,
          destinoStatus
        });
        if (result.success) {
          await API.retornarViatura({
            id: servicoViaturaId,
            servicoViaturaId,
            status: destinoStatus,
            destinoStatus,
            novoTelegrafistaId: novoTelegrafista?.militarId,
            novoTelegrafistaNome: novoTelegrafista?.militarNome,
            tempoVazia: duracaoVazia
          });
          Utils.log('desempenho_viatura', `Viatura ${sv?.viaturaNome} liberada da Ocorrência #${oc.numero}`, 'dashboard');
          Utils.showToast(`Viatura ${sv?.viaturaNome} liberada da ocorrência (${destinoStatus === 'retornando' ? 'em retorno' : 'disponível na base'})`, 'success');
        } else {
          Utils.showToast(result.error || 'Erro ao liberar viatura', 'error');
        }
      } else {
        // Encerramento completo da ocorrência
        const tempoDecorrido = this._getTempoDecorrido(oc.horaAcionamento);
        const result = await API.finalizarOcorrencia({
          id: ocorrId,
          horaRetorno,
          desfecho,
          status,
          destinoStatus,
          duracao: tempoDecorrido
        });

        if (result.success) {
          // Atualiza viaturas no backend GAS para sincronismo total
          const viats = (this.servicoViaturas || []).filter(sv => (oc.viaturaIds || []).some(vid => String(vid) === String(sv.viaturaId)));
          for (const sv of viats) {
            await API.retornarViatura({
              id: sv.id,
              servicoViaturaId: sv.id,
              status: destinoStatus,
              destinoStatus,
              novoTelegrafistaId: novoTelegrafista?.militarId,
              novoTelegrafistaNome: novoTelegrafista?.militarNome,
              tempoVazia: duracaoVazia
            });
          }

          Utils.log('finalizar_ocorrencia', `Ocorrência #${oc.numero} finalizada [${status}] — ${desfecho || 'Sem desfecho'}`, 'dashboard');
          Utils.showToast(`🏁 Ocorrência #${oc.numero} encerrada com sucesso! Viatura(s) ${destinoStatus === 'retornando' ? 'retornando ao quartel' : 'disponíveis na base'}.`, 'success');
        } else {
          Utils.showToast(result.error || 'Erro ao encerrar ocorrência', 'error');
          if (btn) { btn.disabled = false; btn.textContent = '🏁 Confirmar Encerramento'; }
          return;
        }
      }

      if (novoTelegrafista && novoTelegrafista.militarId) {
        const vNome = viatsRetornando.map(v => v.viaturaNome).join(', ');
        await this.registrarAssuncaoTelegrafia(novoTelegrafista.militarId, novoTelegrafista.militarNome, duracaoVazia, vNome);
      }

      this.closeModal();
      if (typeof NAV !== 'undefined') {
        NAV.fecharModalEncerrar();
        await NAV.checkOcorrenciasAtivas();
      }

      const fresh = await API.getServicoAtual(Auth.userId, true);
      this.servicoViaturas = fresh.servicoViaturas || [];
      this.ocorrencias = fresh.ocorrencias || [];
      if (fresh.telegrafia !== undefined) this.telegrafia = fresh.telegrafia;
      this.renderViaturaPanel();
      this.updateTimeline();
      this.updateTelegrafia(this.telegrafia);
      if (typeof NAV !== 'undefined') await NAV.checkOcorrenciasAtivas();
    } catch(e) {
      Utils.showToast('Erro ao encerrar: ' + e.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🏁 Confirmar Encerramento'; }
    }
  },

  showEditarOcorrencia(ocorrId) {
    const oc = (this.ocorrencias || []).find(x => x.id === ocorrId);
    if (!oc) return;
    const modalEl = document.querySelector('#modalOverlay .modal');
    if (modalEl) modalEl.style.maxWidth = '540px';

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
        <label class="input-label">Endereço / Local</label>
        <input type="text" class="input" id="editOcorrEndereco" value="${Utils.escapeHtml(oc.endereco || '')}">
      </div>
      <div class="input-group" style="margin-bottom:12px">
        <label class="input-label">Observações / Relato</label>
        <textarea class="input" id="editOcorrDescricao" rows="3">${Utils.escapeHtml(oc.descricao || '')}</textarea>
      </div>
    `;
    document.getElementById('modalFooter').innerHTML = `
      <button class="btn btn-secondary" onclick="Dashboard.closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="Dashboard.salvarEditarOcorrencia('${oc.id}')">Salvar Alterações</button>
    `;
    document.getElementById('modalOverlay').style.display = 'flex';
  },

  async salvarEditarOcorrencia(ocorrId) {
    const titulo = document.getElementById('editOcorrTitulo').value.trim();
    const natureza = document.getElementById('editOcorrNatureza').value;
    const endereco = document.getElementById('editOcorrEndereco')?.value.trim() || '';
    const descricao = document.getElementById('editOcorrDescricao').value.trim();
    if (!titulo) { Utils.showToast('Título é obrigatório', 'warning'); return; }
    try {
      const result = await API.editarOcorrencia({ id: ocorrId, titulo, natureza, endereco, descricao });
      if (result.success) {
        Utils.showToast('Ocorrência atualizada com sucesso', 'success');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.ocorrencias = data.ocorrencias || [];
        this.renderViaturaPanel();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  // Atalhos compatíveis para manter 100% da integridade com qualquer chamada existente
  async showOcorrenciaNova() {
    this.showEmpenharModal();
  },

  showOcorrenciaModal(viaturaId, servicoViaturaId) {
    this.showEmpenharModal(servicoViaturaId);
  },

  async criarOcorrencia(viaturaId, servicoViaturaId) {
    this.showEmpenharModal(servicoViaturaId);
  },

  async despacharECriarOcorrencia() {
    await this.confirmarEmpenhoNovaOcorrencia();
  },

  async finalizarOcorrencia(ocorrId, servicoViaturaId = null) {
    this.showEncerrarOcorrenciaModal(ocorrId, servicoViaturaId);
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
        this.updateTimeline();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async limparTelegrafia() {
    if (!this.servico?.id) return;
    try {
      const result = await API.registrarTelegrafia(this.servico.id, '__VAZIA__');
      if (result.success) {
        Utils.showToast('Telegrafia registrada como vazia', 'warning');
        this.closeModal();
        const data = await API.getServicoAtual(Auth.userId);
        this.telegrafia = data.telegrafia || null;
        this.telegrafiaVazioDesde = data.telegrafiaVazioDesde || null;
        this.updateTelegrafia(data.telegrafia);
        this.updateTimeline();
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    const modalEl = document.querySelector('#modalOverlay .modal');
    if (modalEl) modalEl.style.maxWidth = '520px';
  },

  _getAtividadesIniciadas() {
    const now = new Date();
    const ct = now.getHours() * 60 + now.getMinutes();
    const aktiv = [];

    const emAndamento = this.rotina.filter(a => a.status === 'em_andamento');
    const naoIniciadas = this.rotina.filter(a => a.status === 'nao_iniciada');
    const pendentesAtrasadas = naoIniciadas.filter(a => {
      if (!a.horario) return false;
      const [h, m] = a.horario.split(':').map(Number);
      return (h * 60 + m) <= ct;
    });
    const pendentesFuturas = naoIniciadas.filter(a => {
      if (!a.horario) return true;
      const [h, m] = a.horario.split(':').map(Number);
      return (h * 60 + m) > ct;
    });

    return [...emAndamento, ...pendentesAtrasadas, ...pendentesFuturas];
  },

  showAtividadesModal() {
    const modal = document.getElementById('atividadesIniciadasModal');
    const listPanel = document.getElementById('atividadesListPanel');
    const detailPanel = document.getElementById('atividadesDetailPanel');
    const title = document.getElementById('atividadesModalTitle');

    title.textContent = 'Atividades do Dia';
    detailPanel.style.display = 'none';
    listPanel.style.display = '';

    const atividades = this._getAtividadesIniciadas();
    this._renderAtividadesList(atividades);
    modal.style.display = 'flex';

    if (atividades.length > 0) {
      this._autoShowAtividadeModal();
    }
  },

  _autoShowAtividadeModal() {
    const emAndamento = this.rotina.filter(a => a.status === 'em_andamento');
    if (emAndamento.length > 0) {
      const now = new Date();
      const ct = now.getHours() * 60 + now.getMinutes();
      let closest = emAndamento[0];
      let closestDiff = Infinity;
      emAndamento.forEach(a => {
        if (!a.horario) return;
        const [h, m] = a.horario.split(':').map(Number);
        const diff = Math.abs((h * 60 + m) - ct);
        if (diff < closestDiff) { closestDiff = diff; closest = a; }
      });
      setTimeout(() => this.showAtividadeDetail(closest.id), 100);
    }
  },

  _renderAtividadesList(atividades) {
    const listPanel = document.getElementById('atividadesListPanel');

    if (atividades.length === 0) {
      listPanel.innerHTML = '<div class="empty-state" style="padding:32px"><p>Nenhuma atividade registrada para este turno</p></div>';
      listPanel.classList.add('empty');
      return;
    }

    listPanel.classList.remove('empty');
    const badge = (s) => {
      const m = { concluida: '<span class="badge badge-green">Concluída</span>', em_andamento: '<span class="badge badge-yellow">Andamento</span>', nao_iniciada: '<span class="badge badge-info">Pendente</span>', cancelada: '<span class="badge badge-danger">Cancelada</span>', nao_realizada: '<span class="badge badge-warning">Prejudicada</span>' };
      return m[s] || m.nao_iniciada;
    };

    const sorted = [...atividades].sort((a, b) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(a.horario) - getMin(b.horario); });
    listPanel.innerHTML = sorted.map(a => `
      <div class="ativ-item" data-id="${a.id}" onclick="Dashboard.showAtividadeDetail('${a.id}')">
        <div class="ativ-item-time">${a.horario || '--:--'}</div>
        <div class="ativ-item-info">
          <div class="ativ-item-name">${Utils.escapeHtml(a.nome)}</div>
          <div class="ativ-item-resp">${Utils.escapeHtml(a.responsavel || 'Sem responsável')}</div>
        </div>
        <div class="ativ-item-badge">${badge(a.status)}</div>
      </div>
    `).join('');
  },

  showAtividadeDetail(id) {
    const atividade = this.rotina.find(a => a.id === id);
    if (!atividade) return;

    const modal = document.getElementById('atividadesIniciadasModal');
    const listPanel = document.getElementById('atividadesListPanel');
    const detailPanel = document.getElementById('atividadesDetailPanel');
    const title = document.getElementById('atividadesModalTitle');

    title.textContent = atividade.nome;
    if (listPanel) listPanel.style.display = 'none';
    if (detailPanel) detailPanel.style.display = '';
    if (modal) modal.style.display = 'flex';

    const badgeMap = { concluida: ['Concluída', 'badge-green'], em_andamento: ['Em Andamento', 'badge-yellow'], nao_iniciada: ['Pendente', 'badge-info'], cancelada: ['Cancelada', 'badge-danger'], nao_realizada: ['Prejudicada', 'badge-warning'] };
    const b = badgeMap[atividade.status] || badgeMap.nao_iniciada;
    const now = Utils.formatTime(new Date());
    const isConcluida = atividade.status === 'concluida';
    const horaDefault = atividade.horaConclusao || atividade.horario;

    detailPanel.innerHTML = `
      <button class="ativ-detail-back" onclick="Dashboard.backToAtividadesList()">← Voltar à lista</button>
      <div class="ativ-detail-header">
        <div class="ativ-detail-title">${Utils.escapeHtml(atividade.nome)}</div>
        <span class="badge ${b[1]}">${b[0]}</span>
      </div>
      <div class="ativ-detail-grid">
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Horário Previsto</span>
          <span class="ativ-detail-value" style="font-family:var(--font-mono);font-size:1.15rem;font-weight:700;color:var(--prontidao-color)">${atividade.horario || '--:--'}</span>
        </div>
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Programa</span>
          <span class="ativ-detail-value">${Utils.escapeHtml(atividade.programa || '-')}</span>
        </div>
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Responsável</span>
          <span class="ativ-detail-value">${Utils.escapeHtml(atividade.responsavel || '-')}</span>
        </div>
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Concluído Por</span>
          <span class="ativ-detail-value">${Utils.escapeHtml(atividade.concluidoPor || '-')}</span>
        </div>
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Hora Conclusão</span>
          <span class="ativ-detail-value" style="font-family:var(--font-mono);font-weight:600;color:var(--accent-green)">${atividade.horaConclusao || '-'}</span>
        </div>
        <div class="ativ-detail-field">
          <span class="ativ-detail-label">Origem</span>
          <span class="ativ-detail-value">${Utils.escapeHtml(atividade.origem || 'padrao')}</span>
        </div>
        ${atividade.observacoes ? `<div class="ativ-detail-field ativ-detail-full"><span class="ativ-detail-label">Observações</span><div class="ativ-detail-obs">${Utils.escapeHtml(atividade.observacoes)}</div></div>` : ''}
      </div>

      <!-- Bloco de Conclusão / Ajuste de Horário (Previsto ou Atual ou Personalizado) -->
      <div class="card" style="padding:14px;background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.25);border-radius:10px;margin-top:14px">
        <div style="font-weight:600;font-size:0.95rem;color:var(--accent-green);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span>✓</span> ${isConcluida ? 'Ajustar Horário de Conclusão (Retroativo)' : 'Marcar como Concluída'}
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.3">
          ${isConcluida
            ? 'Ajuste o horário caso o quartel estivesse sem efetivo durante a rotina ou necessite corrigir para o horário previsto:'
            : 'Se a atividade foi cumprida mas não havia ninguém no quartel para registrar no momento, marque no horário previsto:'}
        </p>

        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:14px;flex-wrap:wrap">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
              <input type="radio" name="dashTipoHoraConclusao" value="previsto" checked onchange="Dashboard.onDashTipoHoraChange()">
              <span>Horário Previsto (<strong>${atividade.horario}</strong>)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
              <input type="radio" name="dashTipoHoraConclusao" value="atual" onchange="Dashboard.onDashTipoHoraChange()">
              <span>Horário Atual (<strong>${now}</strong>)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
              <input type="radio" name="dashTipoHoraConclusao" value="custom" onchange="Dashboard.onDashTipoHoraChange()">
              <span>Outro Horário</span>
            </label>
          </div>

          <div id="dashConclusaoCustomGroup" style="display:none;margin-top:2px">
            <div style="display:flex;align-items:center;gap:8px">
              <label class="input-label" style="margin:0;font-size:0.85rem">Informe o Horário:</label>
              <input class="input" type="time" id="dashConclusaoHoraCustom" value="${horaDefault}" style="max-width:140px;height:36px">
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label class="input-label" style="font-size:0.8rem;margin-bottom:4px">Concluído Por</label>
              <input class="input" id="dashConclusaoPorInput" value="${(typeof Auth !== 'undefined' && Auth.userName) || atividade.responsavel || 'Operador'}" style="height:36px;font-size:0.85rem">
            </div>
            <div>
              <label class="input-label" style="font-size:0.8rem;margin-bottom:4px">Obs (opcional)</label>
              <input class="input" id="dashConclusaoObsInput" placeholder="Ex: Cumprido conforme escala" style="height:36px;font-size:0.85rem">
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
            <button class="btn btn-primary btn-sm" onclick="Dashboard.salvarConclusaoAtividade('${atividade.id}')" style="flex:1;min-width:180px">
              ✓ ${isConcluida ? 'Salvar Horário Ajustado' : 'Confirmar Conclusão'}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Dashboard.concluirRapidoPrevisto('${atividade.id}')" title="Marcar concluída diretamente no horário previsto (${atividade.horario})">
              ⚡ Horário Previsto (${atividade.horario})
            </button>
            <button class="btn btn-secondary btn-sm" onclick="Dashboard.concluirRapidoAgora('${atividade.id}')" title="Marcar concluída diretamente no horário atual (${now})">
              ⏱️ Horário Atual (${now})
            </button>
          </div>
        </div>
      </div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color)">
        ${atividade.status !== 'em_andamento' ? `
          <button class="btn btn-secondary btn-sm" onclick="Dashboard.iniciarAtividade('${atividade.id}')">▶ ${isConcluida ? 'Reabrir / Em Andamento' : 'Iniciar'}</button>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="Dashboard.iniciarAtividade('${atividade.id}')">🔄 Reiniciar</button>
        `}
        <button class="btn btn-warning btn-sm" onclick="Dashboard.mostrarFormPrejudicada('${atividade.id}')">⚠️ Prejudicada</button>
        <button class="btn btn-danger btn-sm" onclick="Dashboard.mostrarConfirmCancelar('${atividade.id}')">✕ Cancelar</button>
      </div>

      <!-- Container dinâmico para ações inline (SEM confirm/prompt) -->
      <div id="dashModalAcaoDinamica" style="display:none;margin-top:12px;padding:12px;border-radius:8px;background:var(--bg-tertiary);border:1px solid var(--border-color)"></div>
    `;

    document.querySelectorAll('.ativ-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });
  },

  onDashTipoHoraChange() {
    const radios = document.querySelectorAll('input[name="dashTipoHoraConclusao"]');
    let sel = 'previsto';
    radios.forEach(r => { if (r.checked) sel = r.value; });
    const customGroup = document.getElementById('dashConclusaoCustomGroup');
    if (customGroup) customGroup.style.display = sel === 'custom' ? 'block' : 'none';
  },

  async salvarConclusaoAtividade(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());

    const radios = document.querySelectorAll('input[name="dashTipoHoraConclusao"]');
    let tipo = 'previsto';
    radios.forEach(r => { if (r.checked) tipo = r.value; });

    let horaFinal = a.horario;
    if (tipo === 'atual') {
      horaFinal = now;
    } else if (tipo === 'custom') {
      const customEl = document.getElementById('dashConclusaoHoraCustom');
      horaFinal = customEl?.value ? customEl.value.trim() : a.horario;
    }

    const userName = document.getElementById('dashConclusaoPorInput')?.value?.trim() || (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const obsExtra = document.getElementById('dashConclusaoObsInput')?.value?.trim() || '';

    let observacoes = a.observacoes || '';
    if (obsExtra) {
      observacoes = observacoes ? (observacoes + '\n' + obsExtra) : obsExtra;
    }

    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const dados = {
      status: 'concluida',
      concluidoPor: userName,
      horaConclusao: horaFinal,
      horaAtualizacao: now,
      observacoes
    };

    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Rotina "${a.nome}" concluída às ${horaFinal}`, 'success');
        Utils.playSound('aviso');
      } else {
        Utils.showToast(result.error || 'Erro ao concluir', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async concluirRapidoPrevisto(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || a.responsavel || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const dados = {
      status: 'concluida',
      concluidoPor: userName,
      horaConclusao: a.horario,
      horaAtualizacao: now
    };
    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Concluída no horário previsto (${a.horario})`, 'success');
        Utils.playSound('aviso');
      } else {
        Utils.showToast(result.error || 'Erro ao atualizar', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async concluirRapidoAgora(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || a.responsavel || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const dados = {
      status: 'concluida',
      concluidoPor: userName,
      horaConclusao: now,
      horaAtualizacao: now
    };
    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Concluída às ${now}`, 'success');
        Utils.playSound('aviso');
      } else {
        Utils.showToast(result.error || 'Erro ao atualizar', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async iniciarAtividade(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const dados = {
      status: 'em_andamento',
      horaInicio: now,
      horaAtualizacao: now,
      concluidoPor: userName
    };
    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Atividade "${a.nome}" iniciada`, 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao iniciar atividade', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  mostrarFormPrejudicada(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const dyn = document.getElementById('dashModalAcaoDinamica');
    if (!dyn) return;
    dyn.style.display = 'block';
    dyn.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600;color:var(--accent-yellow);display:flex;align-items:center;gap:6px">
          <span>⚠️</span> Marcar Atividade como Prejudicada
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary)">Selecione um motivo rápido ou digite a justificativa:</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" onclick="Dashboard.setDashPrejudicadaMotivo('Viaturas empenhadas em ocorrência')">🚒 Em ocorrência</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Dashboard.setDashPrejudicadaMotivo('Atendimento emergencial externo')">🚨 Emergência externa</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Dashboard.setDashPrejudicadaMotivo('Quartel desguarnecido durante atendimento')">👨‍🚒 Quartel desguarnecido</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Dashboard.setDashPrejudicadaMotivo('Condições meteorológicas desfavoráveis')">🌧️ Meteorologia</button>
        </div>
        <textarea class="input" id="dashPrejudicadaMotivoInput" rows="2" placeholder="Digite o motivo da prejudicação..."></textarea>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-warning btn-sm" onclick="Dashboard.salvarPrejudicada('${id}')">Confirmar Prejudicada</button>
          <button class="btn btn-ghost btn-sm" onclick="Dashboard.fecharDashAcaoDinamica()">Voltar</button>
        </div>
      </div>
    `;
    const textarea = document.getElementById('dashPrejudicadaMotivoInput');
    if (textarea) textarea.focus();
  },

  setDashPrejudicadaMotivo(txt) {
    const el = document.getElementById('dashPrejudicadaMotivoInput');
    if (el) el.value = txt;
  },

  fecharDashAcaoDinamica() {
    const dyn = document.getElementById('dashModalAcaoDinamica');
    if (dyn) {
      dyn.style.display = 'none';
      dyn.innerHTML = '';
    }
  },

  async salvarPrejudicada(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const motivo = document.getElementById('dashPrejudicadaMotivoInput')?.value?.trim();
    if (!motivo) {
      Utils.showToast('Informe o motivo da atividade prejudicada', 'warning');
      return;
    }
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const novosObs = (a.observacoes ? a.observacoes + '\n' : '') + '[Prejudicada] ' + motivo;
    const dados = {
      status: 'nao_realizada',
      concluidoPor: userName,
      horaConclusao: now,
      horaAtualizacao: now,
      observacoes: novosObs
    };
    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Atividade "${a.nome}" marcada como prejudicada`, 'warning');
      } else {
        Utils.showToast(result.error || 'Erro ao registrar', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  mostrarConfirmCancelar(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const dyn = document.getElementById('dashModalAcaoDinamica');
    if (!dyn) return;
    dyn.style.display = 'block';
    dyn.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600;color:var(--accent-red)">✕ Cancelar Atividade "${Utils.escapeHtml(a.nome)}"</div>
        <p style="font-size:0.85rem;color:var(--text-secondary)">Deseja marcar esta atividade como cancelada para o serviço de hoje?</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-danger btn-sm" onclick="Dashboard.salvarCancelamento('${id}')">Sim, Cancelar Atividade</button>
          <button class="btn btn-ghost btn-sm" onclick="Dashboard.fecharDashAcaoDinamica()">Voltar</button>
        </div>
      </div>
    `;
  },

  async salvarCancelamento(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || '';
    const dados = {
      status: 'cancelada',
      concluidoPor: userName,
      horaConclusao: now,
      horaAtualizacao: now
    };
    try {
      const result = await API.updateAtividade(servId, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.updateRotinaList();
        this.updateTimeline();
        this.updateAtividadeAtual();
        this.showAtividadeDetail(id);
        Utils.showToast(`Atividade "${a.nome}" cancelada`, 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao cancelar', 'error');
      }
    } catch(e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  // Suporte a compatibilidade de chamadas legadas
  async updateAtividadeStatus(id, status) {
    if (status === 'concluida') {
      this.salvarConclusaoAtividade(id);
    } else if (status === 'em_andamento') {
      this.iniciarAtividade(id);
    } else if (status === 'cancelada') {
      this.mostrarConfirmCancelar(id);
    } else if (status === 'nao_realizada') {
      this.mostrarFormPrejudicada(id);
    }
  },

  async marcarAtividadePrejudicada(id) {
    this.mostrarFormPrejudicada(id);
  },

  backToAtividadesList() {
    const listPanel = document.getElementById('atividadesListPanel');
    const detailPanel = document.getElementById('atividadesDetailPanel');
    const title = document.getElementById('atividadesModalTitle');

    title.textContent = 'Atividades do Dia';
    detailPanel.style.display = 'none';
    listPanel.style.display = '';
  },

  closeAtividadesModal() {
    document.getElementById('atividadesIniciadasModal').style.display = 'none';
  },

  _refreshAtividadesModalIfOpen() {
    const modal = document.getElementById('atividadesIniciadasModal');
    if (!modal || modal.style.display === 'none') return;
    const detailPanel = document.getElementById('atividadesDetailPanel');
    const listPanel = document.getElementById('atividadesListPanel');
    if (detailPanel.style.display !== 'none') {
      const id = detailPanel.querySelector('[data-id]')?.dataset?.id;
      const atividade = this.rotina.find(a => a.id === id);
      if (atividade) this.showAtividadeDetail(id);
      else this.backToAtividadesList();
    } else {
      this._renderAtividadesList(this._getAtividadesIniciadas());
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Dashboard.init());
