const Rotina = {
  servico: null, rotina: [], militares: [], atividadesPadrao: [], selectedProntidao: 'verde', currentFilter: 'todos',
  equipeSelecionada: [],

  async init() {
    if (!Auth.requireAuth()) return;
    if (!Auth.canTela('rotina', 'ver')) { Utils.showToast('Acesso negado', 'error'); location.href = 'dashboard.html'; return; }
    NAV.init('rotina');
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'iniciar') {
      await this.showIniciarPanel();
    } else {
      await this.loadRotina();
    }
  },

  async showIniciarPanel() {
    document.getElementById('iniciarPanel').style.display = 'block';
    document.getElementById('rotinaView').style.display = 'none';
    this.equipeSelecionada = [];
    this.selectedProntidao = 'verde';
    this.selectedPostoId = '';
    this.viaturasSelecionadas = [];
    this.viaturasDetalhes = {};
    try {
      const [militares, postos, viaturas, tipos] = await Promise.all([
        API.get('militares'),
        API.getPostosServico(),
        API.get('viaturas'),
        API.getTiposViatura()
      ]);
      this.militares = militares || [];
      this.postos = postos || [];
      this.viaturasDisponiveis = (viaturas || []).filter(v => v.ativo !== false && v.Status !== 'removido');
      this.tiposViatura = (tipos || []).filter(t => t.Status !== 'removido');
      this.renderPostoSelect();
      this.renderMilitaresChecklist();
      this.renderEquipeSelecionados();
      this.updateComandanteSelect();
      this.renderViaturasChecklist();
    } catch (e) { console.error(e); }
  },

  renderPostoSelect() {
    const sel = document.getElementById('postoServicoSelect');
    if (!sel) return;
    const postos = this.postos.filter(p => p.tipo === 'POSTO');
    sel.innerHTML = '<option value="">Selecione o posto de serviço</option>';
    postos.forEach(p => {
      const sgb = this.postos.find(s => s.id === p.postoPaiId);
      const label = sgb ? `${sgb.nome} — ${p.nome}` : p.nome;
      sel.innerHTML += `<option value="${p.id}">${Utils.escapeHtml(label)}</option>`;
    });
  },

  async selectPostoServico(postoId) {
    this.selectedPostoId = postoId;
    if (!postoId) return;
    try {
      const vinculados = await API.getUsuariosPostos({ postoId });
      const existingIds = new Set(this.equipeSelecionada.filter(e => !e.avulso).map(e => e.id));
      vinculados.forEach(v => {
        if (!existingIds.has(v.usuarioId) && v.nome) {
          this.equipeSelecionada.push({ id: v.usuarioId, nome: v.nome, posto: v.posto || '', reCpf: v.reCpf || '', avulso: false });
        }
      });
    } catch (e) { console.error('Erro ao carregar vinculados:', e); }
    this.renderEquipeSelecionados();
    this.updateComandanteSelect();
    const search = document.getElementById('equipeSearch')?.value?.trim() || '';
    this.renderMilitaresChecklist(search);
  },

  renderMilitaresChecklist(filter = '') {
    const el = document.getElementById('militaresChecklist');
    const selectedIds = new Set(this.equipeSelecionada.filter(e => !e.avulso).map(e => e.id));
    let items = Utils.sortByName(this.militares);
    if (filter) {
      const f = filter.toLowerCase();
      items = items.filter(m => (m.nome || '').toLowerCase().includes(f) || (m.posto || '').toLowerCase().includes(f) || (m.reCpf || '').includes(f));
    }

    if (items.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">Nenhum militar encontrado</div>';
      return;
    }

    el.innerHTML = items.map(m => {
      const checked = selectedIds.has(m.id);
      return `
        <label class="militar-check ${checked ? 'selected' : ''}" data-id="${m.id}">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="Rotina.toggleMilitar('${m.id}', this.checked)">
          <div class="militar-check-info">
            <div class="militar-check-name">${Utils.escapeHtml(m.nome)}</div>
            <div class="militar-check-detail">${Utils.escapeHtml(m.posto || '')}${m.reCpf ? ' — RE ' + Utils.escapeHtml(m.reCpf) : ''}</div>
          </div>
        </label>
      `;
    }).join('');
  },

  filterMilitares() {
    const search = document.getElementById('equipeSearch').value.trim();
    this.renderMilitaresChecklist(search);
  },

  toggleMilitar(id, checked) {
    if (checked) {
      const m = this.militares.find(x => x.id === id);
      if (m && !this.equipeSelecionada.find(e => e.id === id)) {
        this.equipeSelecionada.push({ id: m.id, nome: m.nome, posto: m.posto || '', reCpf: m.reCpf || '', avulso: false });
      }
    } else {
      this.equipeSelecionada = this.equipeSelecionada.filter(e => e.id !== id);
    }
    this.renderEquipeSelecionados();
    this.updateComandanteSelect();
    const search = document.getElementById('equipeSearch')?.value?.trim() || '';
    this.renderMilitaresChecklist(search);
  },

  selectAllMilitares() {
    const selectedIds = new Set(this.equipeSelecionada.filter(e => !e.avulso).map(e => e.id));
    const allSelected = this.militares.every(m => selectedIds.has(m.id));

    if (allSelected) {
      this.equipeSelecionada = this.equipeSelecionada.filter(e => e.avulso);
    } else {
      this.militares.forEach(m => {
        if (!selectedIds.has(m.id)) {
          this.equipeSelecionada.push({ id: m.id, nome: m.nome, posto: m.posto || '', reCpf: m.reCpf || '', avulso: false });
        }
      });
    }
    this.renderEquipeSelecionados();
    this.updateComandanteSelect();
    const search = document.getElementById('equipeSearch')?.value?.trim() || '';
    this.renderMilitaresChecklist(search);
    document.getElementById('selectAllBtn').textContent = allSelected ? 'Selecionar Todos' : 'Desmarcar Todos';
  },

  addAvulso() {
    const nome = document.getElementById('avulsoNome').value.trim();
    if (!nome) { Utils.showToast('Digite o nome do integrante', 'warning'); return; }
    const posto = document.getElementById('avulsoPosto').value.trim();
    const re = document.getElementById('avulsoRe').value.trim();
    const id = 'avulso-' + Date.now();

    this.equipeSelecionada.push({ id, nome, posto, reCpf: re, avulso: true });
    document.getElementById('avulsoNome').value = '';
    document.getElementById('avulsoPosto').value = '';
    document.getElementById('avulsoRe').value = '';

    this.renderEquipeSelecionados();
    this.updateComandanteSelect();
    Utils.showToast(`${nome} adicionado(a) à equipe`, 'success');
  },

  removeEquipeMember(id) {
    this.equipeSelecionada = this.equipeSelecionada.filter(e => e.id !== id);
    this.renderEquipeSelecionados();
    this.updateComandanteSelect();
    const search = document.getElementById('equipeSearch')?.value?.trim() || '';
    this.renderMilitaresChecklist(search);
  },

  renderEquipeSelecionados() {
    const el = document.getElementById('equipeSelecionados');
    const countEl = document.getElementById('equipeCount');
    countEl.textContent = this.equipeSelecionada.length;

    if (this.equipeSelecionada.length === 0) {
      el.innerHTML = '<div style="font-size:0.82rem;color:var(--text-muted);padding:8px 0">Nenhum integrante selecionado</div>';
      return;
    }

    el.innerHTML = this.equipeSelecionada.map(m => `
      <span class="equipe-tag ${m.avulso ? 'avulso' : ''}">
        ${m.avulso ? '(Avulso) ' : ''}${Utils.escapeHtml(m.nome)}${m.posto ? ' — ' + Utils.escapeHtml(m.posto) : ''}
        <button onclick="Rotina.removeEquipeMember('${m.id}')" title="Remover">&times;</button>
      </span>
    `).join(' ');
  },

  updateComandanteSelect() {
    const sel = document.getElementById('comandanteSelect');
    const current = sel.value;
    const equipe = this.equipeSelecionada;

    if (equipe.length === 0) {
      sel.innerHTML = '<option value="">Selecione integrantes primeiro</option>';
      sel.disabled = true;
      const telSel = document.getElementById('telegrafistaSelect');
      if (telSel) { telSel.innerHTML = '<option value="">Nenhum</option>'; telSel.disabled = true; }
      return;
    }

    sel.disabled = false;
    sel.innerHTML = '<option value="">Selecione o comandante</option>';
    Utils.sortByName(equipe).forEach(m => {
      sel.innerHTML += `<option value="${m.id}" ${m.id === current ? 'selected' : ''}>${m.nome} — ${m.posto || ''}</option>`;
    });

    const telSel = document.getElementById('telegrafistaSelect');
    if (telSel) {
      const telCurrent = telSel.value;
      telSel.disabled = false;
      telSel.innerHTML = '<option value="">Nenhum</option>';
      Utils.sortByName(equipe).forEach(m => {
        telSel.innerHTML += `<option value="${m.id}" ${m.id === telCurrent ? 'selected' : ''}>${m.nome} — ${m.posto || ''}</option>`;
      });
    }
  },

  populateRespSelects() {
    const sel = document.getElementById('extraResp');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione</option>';
    Utils.sortByName(this.militares).forEach(m => {
      sel.innerHTML += `<option value="${m.id}">${m.nome} - ${m.posto || ''}</option>`;
    });
    sel.innerHTML += '<option value="__outro__">Outro (digitar)</option>';
    const progSel = document.getElementById('extraPrograma');
    if (progSel && progSel.options.length <= 1) {
      const programas = ['Passagem de serviço','Instrução','Treinamento físico','Refeição','Aquartelamento','Manutenção do quartel','Manutenção preventiva','Outros'];
      progSel.innerHTML = '<option value="">Selecione</option>' + programas.map(p => `<option value="${p}">${p}</option>`).join('');
    }
  },

  toggleProgramaManual() {
    const sel = document.getElementById('extraPrograma');
    const input = document.getElementById('extraProgramaManual');
    if (sel && input) input.style.display = sel.value === 'Outros' ? 'block' : 'none';
  },

  toggleRespManual() {
    const sel = document.getElementById('extraResp');
    const input = document.getElementById('extraRespManual');
    if (sel && input) input.style.display = sel.value === '__outro__' ? 'block' : 'none';
  },

  selectProntidao(cor) {
    this.selectedProntidao = cor;
    document.querySelectorAll('.prontidao-opt').forEach(el => el.classList.toggle('selected', el.dataset.c === cor));
  },

  renderViaturasChecklist() {
    const el = document.getElementById('viaturasChecklist');
    const detEl = document.getElementById('viaturasDetalhes');
    if (!el) return;
    const viaturas = (this.viaturasDisponiveis || []).filter(v => !v.postoId || v.postoId === this.selectedPostoId);
    if (viaturas.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">Nenhuma viatura disponível para este posto</div>';
      return;
    }
    const ocupados = new Set();
    Object.entries(this.viaturasDetalhes).forEach(([vid, det]) => {
      (det.tripulantesIds || []).forEach(tid => ocupados.add(tid));
    });

    el.innerHTML = viaturas.map(v => {
      const tc = API.getTipoCor(v.tipo);
      return `
      <label class="militar-check ${this.viaturasSelecionadas.includes(v.id) ? 'selected' : ''}" data-id="${v.id}">
        <input type="checkbox" ${this.viaturasSelecionadas.includes(v.id) ? 'checked' : ''} onchange="Rotina.toggleViatura('${v.id}', this.checked)">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:${tc}22;color:${tc};font-weight:700;font-size:0.7rem;flex-shrink:0">${v.tipo}</span>
        <div class="militar-check-info">
          <div class="militar-check-name">${Utils.escapeHtml(v.nome)}</div>
          <div class="militar-check-detail">${Utils.escapeHtml(v.placa || '')} — Capacidade: ${v.capacidade || '-'}</div>
        </div>
      </label>`;
    }).join('');

    detEl.innerHTML = this.viaturasSelecionadas.map(vid => {
      const v = viaturas.find(x => x.id === vid);
      if (!v) return '';
      const det = this.viaturasDetalhes[vid] || { motoristaId: '', tripulantesIds: [] };
      const tripCount = (det.tripulantesIds || []).length;
      const motoristaLabel = det.motoristaId ? (this.equipeSelecionada.find(m => m.id === det.motoristaId)?.nome || '') : '';
      return `
        <div class="card" style="padding:16px;border:1px solid var(--border-color)">
          <div style="font-weight:600;font-size:0.9rem;margin-bottom:8px;color:var(--prontidao-color)">${Utils.escapeHtml(v.nome)} (${v.tipo})</div>
          ${motoristaLabel ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:8px">Motorista: <strong style="color:var(--prontidao-color)">${Utils.escapeHtml(motoristaLabel)}</strong> <span style="font-size:0.7rem;color:var(--prontidao-color);font-weight:600">/dir</span> (1º tripulante)</div>` : ''}
          <div class="input-group"><label class="input-label">Tripulantes (${tripCount})</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">${this.equipeSelecionada.map(m => {
              const isMotorista = m.id === det.motoristaId;
              const checked = det.tripulantesIds.includes(m.id);
              const ocupado = ocupados.has(m.id) && !isMotorista && !checked;
              if (isMotorista) return `
              <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;padding:4px 8px;border:1px solid var(--prontidao-color);border-radius:6px;cursor:not-allowed;opacity:1;background:var(--prontidao-dim)">
                <input type="checkbox" checked disabled style="width:14px;height:14px">
                ${Utils.escapeHtml(m.nome)} <span style="font-size:0.7rem;color:var(--prontidao-color);font-weight:600">/dir</span>
              </label>`;
              return `
              <label style="display:flex;align-items:center;gap:4px;font-size:0.82rem;padding:4px 8px;border:1px solid var(--border-color);border-radius:6px;cursor:${ocupado ? 'not-allowed' : 'pointer'};opacity:${ocupado ? '0.4' : '1'};background:${checked ? 'var(--prontidao-dim)' : 'transparent'}">
                <input type="checkbox" ${checked ? 'checked' : ''} ${ocupado ? 'disabled' : ''} onchange="Rotina.toggleViaturaTripulante('${vid}', '${m.id}', this.checked)" style="width:14px;height:14px">
                ${Utils.escapeHtml(m.nome)}
              </label>`;
            }).join('')}</div>
          </div>
        </div>`;
    }).join('');
  },

  toggleViatura(viaturaId, checked) {
    if (checked) {
      if (!this.viaturasSelecionadas.includes(viaturaId)) {
        this.viaturasSelecionadas.push(viaturaId);
        this.viaturasDetalhes[viaturaId] = { motoristaId: '', tripulantesIds: [] };
      }
    } else {
      this.viaturasSelecionadas = this.viaturasSelecionadas.filter(id => id !== viaturaId);
      delete this.viaturasDetalhes[viaturaId];
    }
    this.renderViaturasChecklist();
  },

  setViaturaMotorista(viaturaId, motoristaId) {
    if (!this.viaturasDetalhes[viaturaId]) this.viaturasDetalhes[viaturaId] = { motoristaId: '', tripulantesIds: [] };
    const det = this.viaturasDetalhes[viaturaId];
    const antigoMotorista = det.motoristaId;
    det.motoristaId = motoristaId;
    if (antigoMotorista && antigoMotorista !== motoristaId) {
      det.tripulantesIds = (det.tripulantesIds || []).filter(id => id !== antigoMotorista);
    }
    if (motoristaId) {
      if (!det.tripulantesIds.includes(motoristaId)) det.tripulantesIds.push(motoristaId);
      Object.entries(this.viaturasDetalhes).forEach(([vid, d]) => {
        if (vid !== viaturaId) {
          d.tripulantesIds = (d.tripulantesIds || []).filter(id => id !== motoristaId);
          if (d.motoristaId === motoristaId) d.motoristaId = '';
        }
      });
    }
    this.renderViaturasChecklist();
  },

  toggleViaturaTripulante(viaturaId, membroId, checked) {
    if (!this.viaturasDetalhes[viaturaId]) this.viaturasDetalhes[viaturaId] = { motoristaId: '', tripulantesIds: [] };
    const det = this.viaturasDetalhes[viaturaId];
    if (checked) {
      Object.entries(this.viaturasDetalhes).forEach(([vid, d]) => {
        if (vid !== viaturaId) {
          d.tripulantesIds = (d.tripulantesIds || []).filter(id => id !== membroId);
          if (d.motoristaId === membroId) d.motoristaId = '';
        }
      });
      if (!det.tripulantesIds.includes(membroId)) det.tripulantesIds.push(membroId);
      if (!det.motoristaId && det.tripulantesIds.length > 0) {
        det.motoristaId = det.tripulantesIds[0];
      }
    } else {
      if (membroId === det.motoristaId) {
        det.motoristaId = '';
        det.tripulantesIds = det.tripulantesIds.filter(id => id !== membroId);
        if (det.tripulantesIds.length > 0) {
          det.motoristaId = det.tripulantesIds[0];
        }
      } else {
        det.tripulantesIds = det.tripulantesIds.filter(id => id !== membroId);
      }
    }
    this.renderViaturasChecklist();
  },

  async confirmarInicio() {
    if (!this.selectedPostoId) { Utils.showToast('Selecione o posto de serviço', 'warning'); return; }
    if (this.equipeSelecionada.length === 0) { Utils.showToast('Selecione pelo menos um integrante', 'warning'); return; }
    const comandanteId = document.getElementById('comandanteSelect').value;
    if (!comandanteId) { Utils.showToast('Selecione o comandante', 'warning'); return; }
    const comandante = this.equipeSelecionada.find(m => m.id === comandanteId);
    const telegrafistaId = document.getElementById('telegrafistaSelect')?.value || '';
    try {
      const result = await API.iniciarServico({
        prontidao: this.selectedProntidao,
        comandanteId,
        comandanteNome: comandante?.nome || '',
        equipe: this.equipeSelecionada,
        postoId: this.selectedPostoId,
        telegrafistaId: telegrafistaId || undefined
      });
      if (result.success) {
        const servicoId = result.servicoId || 'demo-001';
        for (const vid of this.viaturasSelecionadas) {
          const v = (this.viaturasDisponiveis || []).find(x => x.id === vid);
          const det = this.viaturasDetalhes[vid] || {};
          const motorista = this.equipeSelecionada.find(m => m.id === det.motoristaId);
          let tripIds = [...new Set([det.motoristaId, ...(det.tripulantesIds || [])].filter(Boolean))];
          const tripulantes = tripIds.map(tid => {
            const m = this.equipeSelecionada.find(x => x.id === tid);
            return m ? { id: m.id, nome: m.nome } : null;
          }).filter(Boolean);
          await API.iniciarServicoViatura({
            servicoId, viaturaId: vid, viaturaNome: v?.nome || '',
            motorista: motorista?.nome || '', motoristaId: det.motoristaId || '',
            tripulantes
          });
        }
        if (telegrafistaId) {
          await API.registrarTelegrafia(servicoId, telegrafistaId);
        }
        Utils.showToast('Serviço iniciado!', 'success');
        Utils.playSound('aviso');
        localStorage.setItem('sgpo_service_version', Date.now());
        localStorage.setItem('sgpo_active_servico_id', servicoId);
        try { BroadcastChannel && new BroadcastChannel('sgpo').postMessage({ type: 'service_started' }); } catch (e) {}
        window.location.href = 'dashboard.html';
      } else {
        Utils.showToast(result.error || 'Erro', 'error');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async loadRotina() {
    try {
      const data = await API.getServicoAtual(Auth.userId);
      if (!data?.servico) { await this.showIniciarPanel(); return; }
      this.servico = data.servico;
      this.rotina = data.rotina || [];
      this.militares = data.militares || [];
      this.equipeSelecionada = data.servico.equipe || [];
      NAV.updateProntidao(data.servico.prontidao);
      const postos = await API.getPostosServico();
      NAV.updateServiceInfo(data.servico, postos);
      document.getElementById('iniciarPanel').style.display = 'none';
      document.getElementById('rotinaView').style.display = 'block';
      document.getElementById('rotinaDate').textContent = Utils.formatDate(new Date());

      this.populateRespSelects();
      this.loadAtividadesPadrao();

      this.renderRotina();
      API.registrarHeartbeat().catch(() => {});
      Sync.on('rotina_updated', (r) => { this.rotina = r; this.renderRotina(); });
      const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
      const syncInterval = (parseInt(config.syncIntervalo) || 30) * 1000;
      Sync.start(this.servico.id, syncInterval);
      try {
        const bc = new BroadcastChannel('sgpo');
        bc.onmessage = (e) => { if (e.data?.type === 'service_started') window.location.reload(); };
      } catch (e) {}
    } catch (e) { Utils.showToast('Erro ao carregar: ' + e.message, 'error'); }
  },

  async loadAtividadesPadrao() {
    try {
      const data = await API.get('atividades_padrao');
      this.atividadesPadrao = data || [];
    } catch (e) { this.atividadesPadrao = []; }
  },

  filter(f) {
    this.currentFilter = f;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.f === f));
    this.renderRotina();
  },

  renderRotina() {
    const el = document.getElementById('rotinaList');
    let items = [...this.rotina];
    if (this.currentFilter === 'pendente') items = items.filter(a => a.status !== 'concluida' && a.status !== 'cancelada');
    if (this.currentFilter === 'concluida') items = items.filter(a => a.status === 'concluida');
    if (this.currentFilter === 'prejudicada') items = items.filter(a => a.status === 'nao_realizada');

    if (items.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhuma atividade</p></div>'; return; }

    items.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

    const badge = (s) => {
      const m = { concluida: '<span class="badge badge-green">Concluída</span>', em_andamento: '<span class="badge badge-yellow">Andamento</span>', nao_iniciada: '<span class="badge badge-info">Pendente</span>', cancelada: '<span class="badge badge-danger">Cancelada</span>', nao_realizada: '<span class="badge badge-warning">Prejudicada</span>' };
      return m[s] || m.nao_iniciada;
    };

    el.innerHTML = items.map(a => `
      <div class="atividade-row ${a.status === 'concluida' ? 'done' : ''}" onclick="Rotina.openAtividade('${a.id}')">
        <div class="atividade-h">${a.horario}</div>
        <div><div style="font-weight:600">${Utils.escapeHtml(a.nome)}</div><div style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(a.programa || '')}${a.origem === 'extra' ? ' <span style="color:var(--accent-yellow)">(Avulsa)</span>' : ''}</div></div>
        <div style="font-size:0.85rem;color:var(--text-secondary)">${Utils.escapeHtml(a.responsavel || '-')}</div>
        <div>${badge(a.status)}</div>
      </div>
    `).join('');
  },

  openAtividade(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    document.getElementById('modalTitle').textContent = a.nome;
    const badge = (s) => {
      const m = { concluida: '<span class="badge badge-green">Concluída</span>', em_andamento: '<span class="badge badge-yellow">Andamento</span>', nao_iniciada: '<span class="badge badge-info">Pendente</span>', cancelada: '<span class="badge badge-danger">Cancelada</span>', nao_realizada: '<span class="badge badge-warning">Prejudicada</span>' };
      return m[s] || m.nao_iniciada;
    };

    document.getElementById('modalContent').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><span style="color:var(--text-muted);font-size:0.8rem">Horário</span><div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:600;color:var(--prontidao-color)">${a.horario}</div></div>
          <div><span style="color:var(--text-muted);font-size:0.8rem">Status</span><div>${badge(a.status)}</div></div>
        </div>
        <div><span style="color:var(--text-muted);font-size:0.8rem">Responsável</span><div style="font-weight:500">${Utils.escapeHtml(a.responsavel || '-')}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.8rem">Programa de Apoio</span><div>${Utils.escapeHtml(a.programa || '-')}</div></div>
        ${a.concluidoPor ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Concluído por</span><div>${Utils.escapeHtml(a.concluidoPor)}</div></div>` : ''}
        ${a.horaConclusao ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Hora conclusão</span><div style="font-family:var(--font-mono)">${a.horaConclusao}</div></div>` : ''}
        ${a.observacoes ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Observações</span><div>${Utils.escapeHtml(a.observacoes)}</div></div>` : ''}
        <div class="divider"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${a.status !== 'concluida' && a.status !== 'cancelada' && a.status !== 'nao_realizada' ? `
            <button class="btn btn-secondary" onclick="Rotina.updateStatus('${id}','em_andamento')">Iniciar</button>
            <button class="btn btn-primary" onclick="Rotina.updateStatus('${id}','concluida')">Concluir</button>
            <button class="btn btn-danger" onclick="Rotina.updateStatus('${id}','cancelada')">Cancelar</button>
            <button class="btn btn-warning" onclick="Rotina.marcarPrejudicada('${id}')">Prejudicada</button>
          ` : ''}
          <button class="btn btn-secondary" onclick="Rotina.editarAtividade('${id}')">Editar</button>
          ${a.origem !== 'padrao' ? `<button class="btn btn-danger" onclick="Rotina.excluirAtividade('${id}')">Excluir</button>` : ''}
          <button class="btn btn-ghost" onclick="Rotina.closeModal()">Fechar</button>
        </div>
      </div>
    `;
    document.getElementById('atividadeModal').style.display = 'flex';
  },

  closeModal() { document.getElementById('atividadeModal').style.display = 'none'; },

  async updateStatus(id, status) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const labels = { concluida: 'concluir', em_andamento: 'iniciar', cancelada: 'cancelar' };
    const msg = `Deseja ${labels[status] || 'alterar'} a atividade "${a.nome}"?`;
    if (!confirm(msg)) return;
    try {
      const now = Utils.formatTime(new Date());
      const dados = { status, concluidoPor: status === 'concluida' ? Auth.userName : undefined, horaConclusao: status === 'concluida' ? now : undefined };
      const result = await API.updateAtividade(this.servico.id, id, dados);
      if (result.success) {
        const a = this.rotina.find(x => x.id === id);
        if (a) { a.status = status; if (status === 'concluida') { a.concluidoPor = Auth.userName; a.horaConclusao = now; } }
        this.renderRotina();
        this.closeModal();
        Utils.showToast({ concluida: 'Atividade concluída', em_andamento: 'Atividade iniciada', cancelada: 'Cancelada' }[status] || 'Atualizado', 'success');
        if (status === 'concluida') Utils.playSound('aviso');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  async marcarPrejudicada(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const obs = prompt(`Atividade "${a.nome}"\n\nMotivo da atividade prejudicada (obrigatório):`);
    if (obs === null) return;
    if (!obs.trim()) { Utils.showToast('Informe o motivo da prejudicação', 'warning'); return; }
    try {
      const now = Utils.formatTime(new Date());
      const dados = { status: 'nao_realizada', concluidoPor: Auth.userName, horaConclusao: now, observacoes: (a.observacoes ? a.observacoes + '\n' : '') + '[Prejudicada] ' + obs.trim() };
      const result = await API.updateAtividade(this.servico.id, id, dados);
      if (result.success) {
        Object.assign(a, dados);
        this.renderRotina();
        this.closeModal();
        Utils.showToast('Atividade marcada como prejudicada', 'warning');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  toggleAddMenu() {
    const menu = document.getElementById('addMenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  hideAddMenu() { document.getElementById('addMenu').style.display = 'none'; },

  editarAtividade(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    this.closeModal();
    document.getElementById('extraModalTitle').textContent = 'Editar Atividade';
    document.getElementById('extraEditId').value = id;
    document.getElementById('extraNome').value = a.nome || '';
    document.getElementById('extraHorario').value = a.horario || '';
    const programas = ['Passagem de serviço','Instrução','Treinamento físico','Refeição','Aquartelamento','Manutenção do quartel','Manutenção preventiva','Outros'];
    const isProgCustom = a.programa && !programas.includes(a.programa);
    document.getElementById('extraPrograma').value = isProgCustom ? 'Outros' : (a.programa || '');
    this.toggleProgramaManual();
    if (isProgCustom) document.getElementById('extraProgramaManual').value = a.programa;
    const isRespCustom = a.responsavelId && !this.militares.find(m => m.id === a.responsavelId);
    document.getElementById('extraResp').value = isRespCustom ? '__outro__' : (a.responsavelId || '');
    this.toggleRespManual();
    if (isRespCustom) document.getElementById('extraRespManual').value = a.responsavel || '';
    document.getElementById('extraObs').value = a.observacoes || '';
    document.getElementById('extraNotificar').checked = false;
    document.getElementById('extraSubmitBtn').textContent = 'Salvar Alterações';
    this.populateRespSelects();
    document.getElementById('extraPrograma').value = isProgCustom ? 'Outros' : (a.programa || '');
    document.getElementById('extraResp').value = isRespCustom ? '__outro__' : (a.responsavelId || '');
    this.toggleProgramaManual();
    this.toggleRespManual();
    if (isProgCustom) document.getElementById('extraProgramaManual').value = a.programa;
    if (isRespCustom) document.getElementById('extraRespManual').value = a.responsavel || '';
    document.getElementById('extraModal').style.display = 'flex';
  },

  async excluirAtividade(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    if (!confirm(`Deseja excluir "${a.nome}"?\n\nEsta ação não pode ser desfeita.`)) return;
    try {
      const result = await API.excluirAtividadeRotina(this.servico.id, id);
      if (result.success) {
        this.rotina = this.rotina.filter(x => x.id !== id);
        this.renderRotina();
        this.closeModal();
        Utils.showToast('Atividade excluída', 'success');
      }
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  },

  showExtraModal() {
    document.getElementById('extraModalTitle').textContent = 'Atividade Avulsa';
    document.getElementById('extraEditId').value = '';
    document.getElementById('extraForm').reset();
    document.getElementById('extraSubmitBtn').textContent = 'Salvar';
    this.populateRespSelects();
    document.getElementById('extraModal').style.display = 'flex';
  },

  closeExtraModal() { document.getElementById('extraModal').style.display = 'none'; document.getElementById('extraForm').reset(); document.getElementById('extraEditId').value = ''; },

  async saveExtra(e) {
    e.preventDefault();
    const editId = document.getElementById('extraEditId').value;
    if (editId && !confirm('Salvar alterações nesta atividade?')) return;
    const progSel = document.getElementById('extraPrograma');
    const programa = progSel.value === 'Outros' ? (document.getElementById('extraProgramaManual').value.trim() || 'Outros') : progSel.value;
    const respSel = document.getElementById('extraResp');
    let responsavelId = respSel.value;
    let responsavel = '';
    if (responsavelId === '__outro__') {
      responsavel = document.getElementById('extraRespManual').value.trim();
      responsavelId = '';
    } else {
      responsavel = this.militares.find(m => m.id === responsavelId)?.nome || '';
    }
    const dados = {
      nome: document.getElementById('extraNome').value.trim(),
      horario: document.getElementById('extraHorario').value,
      programa,
      responsavelId,
      responsavel,
      observacoes: document.getElementById('extraObs').value.trim(),
      notificar: document.getElementById('extraNotificar').checked,
      criadoPor: Auth.userName
    };

    try {
      if (editId) {
        const result = await API.editarAtividadeRotina(this.servico.id, editId, dados);
        if (result.success) {
          const a = this.rotina.find(x => x.id === editId);
          if (a) { Object.assign(a, dados); this.renderRotina(); }
          Utils.showToast('Atividade atualizada', 'success');
        }
      } else {
        const result = await API.criarAtividadeExtra(this.servico.id, dados);
        if (result.success) { Utils.showToast('Atividade avulsa criada', 'success'); Utils.playSound('nova-atividade'); await this.loadRotina(); }
      }
      this.closeExtraModal();
    } catch (e) { Utils.showToast('Erro: ' + e.message, 'error'); }
  }
};

document.addEventListener('DOMContentLoaded', () => Rotina.init());
