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
      const [milResult, postosResult, viatResult, tiposResult] = await Promise.allSettled([
        API.getMilitares(),
        API.getPostosServico(),
        API.getViaturas(),
        API.getTiposViatura()
      ]);
      this.militares = milResult.status === 'fulfilled' && Array.isArray(milResult.value) ? milResult.value : [];
      this.postos = postosResult.status === 'fulfilled' && Array.isArray(postosResult.value) ? postosResult.value : [];
      const viatList = viatResult.status === 'fulfilled' && Array.isArray(viatResult.value) ? viatResult.value : [];
      const tiposList = tiposResult.status === 'fulfilled' && Array.isArray(tiposResult.value) ? tiposResult.value : [];
      this.viaturasDisponiveis = viatList.filter(v => v && v.ativo !== false && v.Status !== 'removido');
      this.tiposViatura = tiposList.filter(t => t && t.Status !== 'removido');

      if (this.militares.length === 0 && typeof DemoData !== 'undefined') {
        this.militares = DemoData.getState().militares || [];
      }
      if (this.postos.length === 0 && typeof DemoData !== 'undefined') {
        this.postos = DemoData.getState().postosServico || [];
      }
      if (this.viaturasDisponiveis.length === 0 && typeof DemoData !== 'undefined') {
        this.viaturasDisponiveis = (DemoData.getState().viaturas || []).filter(v => v && v.ativo !== false && v.Status !== 'removido');
      }
      if (this.tiposViatura.length === 0 && typeof DemoData !== 'undefined') {
        this.tiposViatura = (DemoData.getState().tiposViatura || []).filter(t => t && t.Status !== 'removido');
      }

      this.renderPostoSelect();
      this.renderMilitaresChecklist();
      this.renderEquipeSelecionados();
      this.updateComandanteSelect();
      this.renderViaturasChecklist();
    } catch (e) { console.warn('showIniciarPanel warn:', e); }
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

    // Mapeamento de componentes alocados em cada viatura: militarId -> { viaturaId, viaturaNome, funcao }
    const militarAlocadoEm = new Map();
    this.viaturasSelecionadas.forEach(vSelectedId => {
      const vObj = viaturas.find(x => x.id === vSelectedId);
      const vNome = vObj ? vObj.nome : 'outra viatura';
      const d = this.viaturasDetalhes[vSelectedId];
      if (!d) return;
      if (d.comandanteId) {
        militarAlocadoEm.set(d.comandanteId, { viaturaId: vSelectedId, viaturaNome: vNome, funcao: 'Comandante' });
      }
      if (d.motoristaId) {
        militarAlocadoEm.set(d.motoristaId, { viaturaId: vSelectedId, viaturaNome: vNome, funcao: 'Motorista' });
      }
      (d.tripulantesIds || []).forEach(tid => {
        if (tid && tid !== d.comandanteId && tid !== d.motoristaId) {
          militarAlocadoEm.set(tid, { viaturaId: vSelectedId, viaturaNome: vNome, funcao: 'Auxiliar' });
        }
      });
    });

    detEl.innerHTML = this.viaturasSelecionadas.map(vid => {
      const v = viaturas.find(x => x.id === vid);
      if (!v) return '';
      const det = this.viaturasDetalhes[vid] || { comandanteId: '', motoristaId: '', tripulantesIds: [] };
      return `
        <div class="card" style="padding:16px;border:1px solid var(--border-color);margin-bottom:12px">
          <div style="font-weight:700;font-size:0.95rem;margin-bottom:12px;color:var(--prontidao-color)">🚒 ${Utils.escapeHtml(v.nome)} (${v.tipo})</div>
          <div style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
            <div class="input-group" style="flex:1;min-width:200px;margin-bottom:0">
              <label class="input-label" style="font-weight:700">Comandante da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
              <select class="input select" onchange="Rotina.setViaturaComandante('${vid}', this.value)">
                <option value="">Selecione o Comandante</option>
                ${this.equipeSelecionada.map(m => {
                  const alocado = militarAlocadoEm.get(m.id);
                  const emOutra = alocado && alocado.viaturaId !== vid;
                  const isMotDesta = m.id === det.motoristaId;
                  const disabled = emOutra || isMotDesta;
                  let info = '';
                  if (emOutra) info = ` (em ${alocado.viaturaNome})`;
                  else if (isMotDesta) info = ' (Motorista desta vtr)';
                  return `<option value="${m.id}" ${det.comandanteId === m.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}${info}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="input-group" style="flex:1;min-width:200px;margin-bottom:0">
              <label class="input-label" style="font-weight:700">Motorista da Viatura <span style="color:#e53935">* (Obrigatório)</span></label>
              <select class="input select" onchange="Rotina.setViaturaMotorista('${vid}', this.value)">
                <option value="">Selecione o Motorista</option>
                ${this.equipeSelecionada.map(m => {
                  const alocado = militarAlocadoEm.get(m.id);
                  const emOutra = alocado && alocado.viaturaId !== vid;
                  const isComDesta = m.id === det.comandanteId;
                  const disabled = emOutra || isComDesta;
                  let info = '';
                  if (emOutra) info = ` (em ${alocado.viaturaNome})`;
                  else if (isComDesta) info = ' (Comandante desta vtr)';
                  return `<option value="${m.id}" ${det.motoristaId === m.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${Utils.escapeHtml(m.nome)} ${m.posto ? '— ' + m.posto : ''}${info}</option>`;
                }).join('')}
              </select>
            </div>
          </div>
          <div class="input-group" style="margin-bottom:0">
            <label class="input-label" style="font-weight:700">Auxiliares da Guarnição</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${this.equipeSelecionada.map(m => {
                const isCom = m.id === det.comandanteId;
                const isMot = m.id === det.motoristaId;
                const alocado = militarAlocadoEm.get(m.id);
                const emOutra = alocado && alocado.viaturaId !== vid;
                const checked = (det.tripulantesIds || []).includes(m.id) && !isCom && !isMot;
                const disabled = emOutra || isCom || isMot;

                let tag = '';
                if (isCom) tag = '<span style="color:#2979ff;font-size:0.7rem;font-weight:700">(Comandante)</span>';
                else if (isMot) tag = '<span style="color:var(--prontidao-color);font-size:0.7rem;font-weight:700">(Motorista)</span>';
                else if (emOutra) tag = `<span style="color:var(--text-muted);font-size:0.7rem">(em ${Utils.escapeHtml(alocado.viaturaNome)})</span>`;
                else tag = '<span style="color:var(--text-muted);font-size:0.7rem">[Auxiliar]</span>';

                return `
                <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;padding:4px 8px;border:1px solid ${isCom ? '#2979ff' : (isMot ? 'var(--prontidao-color)' : (emOutra ? 'var(--border-color,#333)' : 'var(--border-color)'))};border-radius:6px;cursor:${disabled ? 'not-allowed' : 'pointer'};opacity:${disabled ? '0.45' : '1'};background:${checked ? 'var(--prontidao-dim)' : 'transparent'}">
                  <input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} onchange="Rotina.toggleViaturaTripulante('${vid}', '${m.id}', this.checked)" style="width:14px;height:14px">
                  ${Utils.escapeHtml(m.nome)} ${tag}
                </label>`;
              }).join('')}
            </div>
          </div>
        </div>`;
    }).join('');
  },

  toggleViatura(viaturaId, checked) {
    if (checked) {
      if (!this.viaturasSelecionadas.includes(viaturaId)) {
        this.viaturasSelecionadas.push(viaturaId);
        this.viaturasDetalhes[viaturaId] = { comandanteId: '', motoristaId: '', tripulantesIds: [] };
      }
    } else {
      this.viaturasSelecionadas = this.viaturasSelecionadas.filter(id => id !== viaturaId);
      delete this.viaturasDetalhes[viaturaId];
    }
    this.renderViaturasChecklist();
  },

  setViaturaComandante(viaturaId, comandanteId) {
    if (!this.viaturasDetalhes[viaturaId]) this.viaturasDetalhes[viaturaId] = { comandanteId: '', motoristaId: '', tripulantesIds: [] };
    const det = this.viaturasDetalhes[viaturaId];
    det.comandanteId = comandanteId;
    det.tripulantesIds = (det.tripulantesIds || []).filter(id => id !== comandanteId);
    if (comandanteId && det.motoristaId === comandanteId) {
      det.motoristaId = '';
    }
    // Libera qualquer outra viatura que possa ter este militar
    if (comandanteId) {
      Object.entries(this.viaturasDetalhes).forEach(([vid, d]) => {
        if (vid !== viaturaId) {
          if (d.comandanteId === comandanteId) d.comandanteId = '';
          if (d.motoristaId === comandanteId) d.motoristaId = '';
          d.tripulantesIds = (d.tripulantesIds || []).filter(id => id !== comandanteId);
        }
      });
    }
    this.renderViaturasChecklist();
  },

  setViaturaMotorista(viaturaId, motoristaId) {
    if (!this.viaturasDetalhes[viaturaId]) this.viaturasDetalhes[viaturaId] = { comandanteId: '', motoristaId: '', tripulantesIds: [] };
    const det = this.viaturasDetalhes[viaturaId];
    det.motoristaId = motoristaId;
    det.tripulantesIds = (det.tripulantesIds || []).filter(id => id !== motoristaId);
    if (motoristaId && det.comandanteId === motoristaId) {
      det.comandanteId = '';
    }
    // Libera qualquer outra viatura que possa ter este militar
    if (motoristaId) {
      Object.entries(this.viaturasDetalhes).forEach(([vid, d]) => {
        if (vid !== viaturaId) {
          if (d.comandanteId === motoristaId) d.comandanteId = '';
          if (d.motoristaId === motoristaId) d.motoristaId = '';
          d.tripulantesIds = (d.tripulantesIds || []).filter(id => id !== motoristaId);
        }
      });
    }
    this.renderViaturasChecklist();
  },

  toggleViaturaTripulante(viaturaId, membroId, checked) {
    if (!this.viaturasDetalhes[viaturaId]) this.viaturasDetalhes[viaturaId] = { comandanteId: '', motoristaId: '', tripulantesIds: [] };
    const det = this.viaturasDetalhes[viaturaId];
    if (checked) {
      // Garante que não pertence a nenhuma outra viatura
      Object.entries(this.viaturasDetalhes).forEach(([vid, d]) => {
        if (vid !== viaturaId) {
          if (d.comandanteId === membroId) d.comandanteId = '';
          if (d.motoristaId === membroId) d.motoristaId = '';
          d.tripulantesIds = (d.tripulantesIds || []).filter(id => id !== membroId);
        }
      });
      if (!det.tripulantesIds.includes(membroId)) det.tripulantesIds.push(membroId);
    } else {
      det.tripulantesIds = (det.tripulantesIds || []).filter(id => id !== membroId);
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

    // Validação obrigatória de Comandante e Motorista em cada viatura selecionada
    for (const vid of this.viaturasSelecionadas) {
      const v = (this.viaturasDisponiveis || []).find(x => x.id === vid);
      const vNome = v?.nome || 'Viatura';
      const det = this.viaturasDetalhes[vid] || {};
      if (!det.comandanteId) {
        Utils.showToast(`Defina o Comandante para a viatura ${vNome}`, 'warning');
        return;
      }
      if (!det.motoristaId) {
        Utils.showToast(`Defina o Motorista para a viatura ${vNome}`, 'warning');
        return;
      }
      if (det.comandanteId === det.motoristaId) {
        Utils.showToast(`O Comandante e o Motorista da viatura ${vNome} devem ser militares diferentes`, 'warning');
        return;
      }
    }

    // Validação estrita: nenhum militar pode fazer parte de mais de uma viatura
    const militarAlocado = new Map();
    for (const vid of this.viaturasSelecionadas) {
      const v = (this.viaturasDisponiveis || []).find(x => x.id === vid);
      const vNome = v?.nome || 'Viatura';
      const det = this.viaturasDetalhes[vid] || {};
      const componentes = [
        det.comandanteId,
        det.motoristaId,
        ...(det.tripulantesIds || []).filter(id => id !== det.comandanteId && id !== det.motoristaId)
      ].filter(Boolean);

      for (const mId of componentes) {
        if (militarAlocado.has(mId)) {
          const mObj = this.equipeSelecionada.find(x => x.id === mId);
          Utils.showToast(`O integrante ${mObj?.nome || 'selecionado'} não pode fazer parte de mais de uma viatura (${militarAlocado.get(mId)} e ${vNome}).`, 'warning');
          return;
        }
        militarAlocado.set(mId, vNome);
      }
    }

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
          const cMilitar = this.equipeSelecionada.find(m => m.id === det.comandanteId);
          const mMilitar = this.equipeSelecionada.find(m => m.id === det.motoristaId);
          const auxs = (det.tripulantesIds || []).filter(id => id !== det.comandanteId && id !== det.motoristaId).map(tid => {
            const m = this.equipeSelecionada.find(x => x.id === tid);
            return m ? { id: m.id, nome: m.nome, funcao: 'Auxiliar' } : null;
          }).filter(Boolean);

          const tripulantes = [
            { id: det.comandanteId, nome: cMilitar?.nome || '', funcao: 'Comandante' },
            ...auxs
          ];

          await API.iniciarServicoViatura({
            servicoId, viaturaId: vid, viaturaNome: v?.nome || '',
            comandante: cMilitar?.nome || '', comandanteId: det.comandanteId || '',
            motorista: mMilitar?.nome || '', motoristaId: det.motoristaId || '',
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

    if (items.length === 0) { el.innerHTML = '<div class="empty-state"><p>Nenhuma atividade encontrada</p></div>'; return; }

    items.sort((a, b) => {
      const getMin = (t) => {
        if (!t) return 99999;
        const p = String(t).split(':');
        const mins = (parseInt(p[0]) || 0) * 60 + (parseInt(p[1]) || 0);
        return mins < 450 ? mins + 1440 : mins;
      };
      return getMin(a.horario) - getMin(b.horario);
    });

    const badge = (a) => {
      const s = a.status;
      if (s === 'concluida') {
        return `<span class="badge badge-green" title="Concluída às ${a.horaConclusao || a.horario}">Concluída${a.horaConclusao ? ' (' + a.horaConclusao + ')' : ''}</span>`;
      }
      if (s === 'em_andamento') return '<span class="badge badge-yellow">Andamento</span>';
      if (s === 'nao_realizada') return '<span class="badge badge-warning">Prejudicada</span>';
      if (s === 'cancelada') return '<span class="badge badge-danger">Cancelada</span>';
      return '<span class="badge badge-info">Pendente</span>';
    };

    const statusRowClass = (s) => {
      if (s === 'concluida') return 'done';
      if (s === 'em_andamento') return 'andamento';
      if (s === 'nao_realizada') return 'prejudicada';
      if (s === 'cancelada') return 'cancelada';
      return '';
    };

    el.innerHTML = items.map(a => `
      <div class="atividade-row ${statusRowClass(a.status)}" onclick="Rotina.openAtividade('${a.id}')" title="Clique para abrir ações e detalhes">
        <div class="atividade-h">${a.horario}</div>
        <div>
          <div style="font-weight:600;display:flex;align-items:center;gap:6px">
            ${Utils.escapeHtml(a.nome)}
            ${a.origem === 'extra' ? '<span style="font-size:0.7rem;color:var(--accent-yellow);font-weight:normal">(Avulsa)</span>' : ''}
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted)">${Utils.escapeHtml(a.programa || 'Rotina')}</div>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary)">${Utils.escapeHtml(a.responsavel || '-')}</div>
        <div>${badge(a)}</div>
        <div class="ativ-quick-btns" onclick="event.stopPropagation()">
          ${a.status !== 'concluida' ? `
            <button class="btn btn-primary btn-sm" onclick="Rotina.openAtividade('${a.id}','concluir')" title="Concluir no Horário Previsto ou Atual">✓ Concluir</button>
            ${a.status !== 'em_andamento' ? `
              <button class="btn btn-secondary btn-sm" onclick="Rotina.iniciarAtividade('${a.id}')" title="Iniciar Atividade">▶ Iniciar</button>
            ` : ''}
          ` : `
            <button class="btn btn-ghost btn-sm" onclick="Rotina.openAtividade('${a.id}','concluir')" style="font-size:0.8rem" title="Ajustar Horário de Conclusão">⏱️ Ajustar</button>
          `}
          <button class="btn btn-ghost btn-sm" onclick="Rotina.openAtividade('${a.id}')" title="Mais opções">⋮</button>
        </div>
      </div>
    `).join('');
  },

  openAtividade(id, modo) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    document.getElementById('modalTitle').textContent = a.nome;
    const now = Utils.formatTime(new Date());

    const badgeMap = {
      concluida: '<span class="badge badge-green">Concluída</span>',
      em_andamento: '<span class="badge badge-yellow">Em Andamento</span>',
      nao_iniciada: '<span class="badge badge-info">Pendente</span>',
      cancelada: '<span class="badge badge-danger">Cancelada</span>',
      nao_realizada: '<span class="badge badge-warning">Prejudicada</span>'
    };

    const isConcluida = a.status === 'concluida';
    const horaDefault = a.horaConclusao || a.horario;

    document.getElementById('modalContent').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px">
        <!-- Detalhes da Atividade -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg-tertiary);padding:12px;border-radius:10px">
          <div>
            <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Horário Previsto</span>
            <div style="font-family:var(--font-mono);font-size:1.25rem;font-weight:700;color:var(--prontidao-color)">${a.horario}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Status Atual</span>
            <div style="margin-top:2px">${badgeMap[a.status] || badgeMap.nao_iniciada}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Programa de Apoio</span>
            <div style="font-weight:500;font-size:0.9rem">${Utils.escapeHtml(a.programa || 'Rotina')}</div>
          </div>
          <div>
            <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Responsável</span>
            <div style="font-weight:500;font-size:0.9rem">${Utils.escapeHtml(a.responsavel || '-')}</div>
          </div>
          ${a.concluidoPor ? `
            <div>
              <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Concluído Por</span>
              <div style="font-weight:500;font-size:0.9rem">${Utils.escapeHtml(a.concluidoPor)}</div>
            </div>
          ` : ''}
          ${a.horaConclusao ? `
            <div>
              <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Hora Registrada</span>
              <div style="font-family:var(--font-mono);font-weight:600;font-size:1.05rem;color:var(--accent-green)">${a.horaConclusao}</div>
            </div>
          ` : ''}
          ${a.horaInicio ? `
            <div>
              <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Hora Início</span>
              <div style="font-family:var(--font-mono);font-size:0.9rem">${a.horaInicio}</div>
            </div>
          ` : ''}
          ${a.observacoes ? `
            <div style="grid-column:span 2">
              <span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase">Observações</span>
              <div style="font-size:0.85rem;white-space:pre-wrap;background:rgba(0,0,0,0.15);padding:6px 10px;border-radius:6px;margin-top:2px">${Utils.escapeHtml(a.observacoes)}</div>
            </div>
          ` : ''}
        </div>

        <!-- Bloco de Conclusão / Ajuste de Horário (Previsto ou Atual ou Personalizado) -->
        <div class="card" style="padding:14px;background:rgba(0,200,83,0.06);border:1px solid rgba(0,200,83,0.25);border-radius:10px">
          <div style="font-weight:600;font-size:0.95rem;color:var(--accent-green);margin-bottom:6px;display:flex;align-items:center;gap:6px">
            <span>✓</span> ${isConcluida ? 'Ajustar Horário de Conclusão (Retroativo)' : 'Marcar como Concluída'}
          </div>
          <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:12px;line-height:1.3">
            ${isConcluida
              ? 'Se o quartel estava sem efetivo no momento ou o horário precisa ser corrigido para a escala, selecione o horário correto:'
              : 'Caso não houvesse ninguém no quartel durante a rotina ou queira marcar retroativamente, escolha o horário previsto ou informe o real:'}
          </p>

          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;gap:14px;flex-wrap:wrap">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
                <input type="radio" name="tipoHorarioConclusao" value="previsto" checked onchange="Rotina.onTipoHoraChange('${id}')">
                <span>Horário Previsto (<strong>${a.horario}</strong>)</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
                <input type="radio" name="tipoHorarioConclusao" value="atual" onchange="Rotina.onTipoHoraChange('${id}')">
                <span>Horário Atual (<strong>${now}</strong>)</span>
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.88rem">
                <input type="radio" name="tipoHorarioConclusao" value="custom" onchange="Rotina.onTipoHoraChange('${id}')">
                <span>Outro Horário</span>
              </label>
            </div>

            <div id="conclusaoCustomGroup" style="display:none;margin-top:2px">
              <div style="display:flex;align-items:center;gap:8px">
                <label class="input-label" style="margin:0;font-size:0.85rem">Informe o Horário:</label>
                <input class="input" type="time" id="conclusaoHoraCustom" value="${horaDefault}" style="max-width:140px;height:36px">
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
              <div>
                <label class="input-label" style="font-size:0.8rem;margin-bottom:4px">Concluído Por</label>
                <input class="input" id="conclusaoPorInput" value="${(typeof Auth !== 'undefined' && Auth.userName) || a.responsavel || 'Operador'}" style="height:36px;font-size:0.85rem">
              </div>
              <div>
                <label class="input-label" style="font-size:0.8rem;margin-bottom:4px">Observação (opcional)</label>
                <input class="input" id="conclusaoObsInput" placeholder="Ex: Cumprido conforme escala" style="height:36px;font-size:0.85rem">
              </div>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
              <button class="btn btn-primary" onclick="Rotina.salvarConclusao('${id}')" style="flex:1;min-width:180px">
                ✓ ${isConcluida ? 'Salvar Horário Ajustado' : 'Confirmar Conclusão'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Rotina.concluirRapidoPrevisto('${id}')" title="Marcar concluída diretamente no horário previsto (${a.horario})">
                ⚡ Horário Previsto (${a.horario})
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Rotina.concluirRapidoAgora('${id}')" title="Marcar concluída diretamente no horário de agora (${now})">
                ⏱️ Horário Atual (${now})
              </button>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Botões de Ações Gerais -->
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="modalAcoesPadrao">
          ${a.status !== 'em_andamento' ? `
            <button class="btn btn-secondary" onclick="Rotina.iniciarAtividade('${id}')">▶ ${isConcluida ? 'Reabrir / Em Andamento' : 'Iniciar'}</button>
          ` : `
            <button class="btn btn-secondary" onclick="Rotina.iniciarAtividade('${id}')">🔄 Reiniciar</button>
          `}
          <button class="btn btn-warning" onclick="Rotina.mostrarFormPrejudicada('${id}')">⚠️ Prejudicada</button>
          <button class="btn btn-danger" onclick="Rotina.mostrarConfirmCancelar('${id}')">✕ Cancelar</button>
          <button class="btn btn-secondary" onclick="Rotina.editarAtividade('${id}')">✏️ Editar</button>
          <button class="btn btn-danger" onclick="Rotina.mostrarConfirmExcluir('${id}')">🗑️ Excluir</button>
          <button class="btn btn-ghost" onclick="Rotina.closeModal()">Fechar</button>
        </div>

        <!-- Painel Dinâmico para Formulários/Confirmações Inline (SEM confirm/prompt) -->
        <div id="modalAcaoDinamica" style="display:none;padding:12px;border-radius:10px;background:var(--bg-tertiary);border:1px solid var(--border-color)"></div>
      </div>
    `;
    document.getElementById('atividadeModal').style.display = 'flex';
  },

  closeModal() {
    document.getElementById('atividadeModal').style.display = 'none';
  },

  onTipoHoraChange(id) {
    const radios = document.querySelectorAll('input[name="tipoHorarioConclusao"]');
    let sel = 'previsto';
    radios.forEach(r => { if (r.checked) sel = r.value; });
    const customGroup = document.getElementById('conclusaoCustomGroup');
    if (customGroup) customGroup.style.display = sel === 'custom' ? 'block' : 'none';
  },

  async salvarConclusao(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());

    const radios = document.querySelectorAll('input[name="tipoHorarioConclusao"]');
    let tipo = 'previsto';
    radios.forEach(r => { if (r.checked) tipo = r.value; });

    let horaFinal = a.horario;
    if (tipo === 'atual') {
      horaFinal = now;
    } else if (tipo === 'custom') {
      const customEl = document.getElementById('conclusaoHoraCustom');
      horaFinal = customEl?.value ? customEl.value.trim() : a.horario;
    }

    const userName = document.getElementById('conclusaoPorInput')?.value?.trim() || (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const obsExtra = document.getElementById('conclusaoObsInput')?.value?.trim() || '';

    let observacoes = a.observacoes || '';
    if (obsExtra) {
      observacoes = observacoes ? (observacoes + '\n' + obsExtra) : obsExtra;
    }

    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
        Utils.showToast(`Rotina "${a.nome}" concluída às ${horaFinal}`, 'success');
        Utils.playSound('aviso');
      } else {
        Utils.showToast(result.error || 'Erro ao concluir atividade', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  async concluirRapidoPrevisto(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || a.responsavel || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
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
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
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
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
        Utils.showToast(`Atividade "${a.nome}" iniciada às ${now}`, 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao iniciar atividade', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  fecharAcaoDinamica() {
    const dyn = document.getElementById('modalAcaoDinamica');
    if (dyn) {
      dyn.style.display = 'none';
      dyn.innerHTML = '';
    }
  },

  mostrarFormPrejudicada(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const dyn = document.getElementById('modalAcaoDinamica');
    if (!dyn) return;
    dyn.style.display = 'block';
    dyn.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600;color:var(--accent-yellow);display:flex;align-items:center;gap:6px">
          <span>⚠️</span> Marcar Atividade como Prejudicada
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary)">Selecione um motivo rápido ou digite a justificativa:</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost btn-sm" onclick="Rotina.setPrejudicadaMotivo('Viaturas empenhadas em ocorrência')">🚒 Em ocorrência</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Rotina.setPrejudicadaMotivo('Atendimento emergencial externo')">🚨 Emergência externa</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Rotina.setPrejudicadaMotivo('Quartel desguarnecido durante atendimento')">👨‍🚒 Quartel desguarnecido</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="Rotina.setPrejudicadaMotivo('Condições meteorológicas desfavoráveis')">🌧️ Meteorologia</button>
        </div>
        <textarea class="input" id="prejudicadaMotivoInput" rows="2" placeholder="Digite o motivo da prejudicação..."></textarea>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn btn-warning" onclick="Rotina.salvarPrejudicada('${id}')">Confirmar Prejudicada</button>
          <button class="btn btn-ghost" onclick="Rotina.fecharAcaoDinamica()">Voltar</button>
        </div>
      </div>
    `;
    const textarea = document.getElementById('prejudicadaMotivoInput');
    if (textarea) textarea.focus();
  },

  setPrejudicadaMotivo(txt) {
    const el = document.getElementById('prejudicadaMotivoInput');
    if (el) el.value = txt;
  },

  async salvarPrejudicada(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const motivo = document.getElementById('prejudicadaMotivoInput')?.value?.trim();
    if (!motivo) {
      Utils.showToast('Informe o motivo da atividade prejudicada', 'warning');
      return;
    }
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
        Utils.showToast(`Atividade "${a.nome}" marcada como prejudicada`, 'warning');
      } else {
        Utils.showToast(result.error || 'Erro ao registrar', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  mostrarConfirmCancelar(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const dyn = document.getElementById('modalAcaoDinamica');
    if (!dyn) return;
    dyn.style.display = 'block';
    dyn.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600;color:var(--accent-red)">✕ Cancelar Atividade "${Utils.escapeHtml(a.nome)}"</div>
        <p style="font-size:0.85rem;color:var(--text-secondary)">Deseja marcar esta atividade como cancelada para o serviço de hoje?</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-danger" onclick="Rotina.salvarCancelamento('${id}')">Sim, Cancelar Atividade</button>
          <button class="btn btn-ghost" onclick="Rotina.fecharAcaoDinamica()">Voltar</button>
        </div>
      </div>
    `;
  },

  async salvarCancelamento(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const now = Utils.formatTime(new Date());
    const userName = (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário';
    const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
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
        this.renderRotina();
        this.closeModal();
        Utils.showToast(`Atividade "${a.nome}" cancelada`, 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao cancelar', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  mostrarConfirmExcluir(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    const dyn = document.getElementById('modalAcaoDinamica');
    if (!dyn) return;
    dyn.style.display = 'block';
    dyn.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="font-weight:600;color:var(--accent-red)">🗑️ Excluir Atividade "${Utils.escapeHtml(a.nome)}"</div>
        <p style="font-size:0.85rem;color:var(--text-secondary)">Esta ação removerá a atividade permanentemente da rotina de hoje e registrará a exclusão na linha do tempo.</p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-danger" onclick="Rotina.salvarExclusao('${id}')">Sim, Excluir Atividade</button>
          <button class="btn btn-ghost" onclick="Rotina.fecharAcaoDinamica()">Voltar</button>
        </div>
      </div>
    `;
  },

  async salvarExclusao(id) {
    const a = this.rotina.find(x => x.id === id);
    if (!a) return;
    try {
      const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
      const result = await API.excluirAtividadeRotina(servId, id);
      if (result.success) {
        this.rotina = this.rotina.filter(x => x.id !== id);
        this.renderRotina();
        this.closeModal();
        Utils.showToast(`Atividade "${a.nome}" excluída`, 'success');
      } else {
        Utils.showToast(result.error || 'Erro ao excluir atividade', 'error');
      }
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  },

  // Suporte a compatibilidade de chamadas legadas
  async updateStatus(id, status) {
    if (status === 'concluida') {
      this.salvarConclusao(id);
    } else if (status === 'em_andamento') {
      this.iniciarAtividade(id);
    } else if (status === 'cancelada') {
      this.mostrarConfirmCancelar(id);
    } else if (status === 'nao_realizada') {
      this.mostrarFormPrejudicada(id);
    }
  },

  async marcarPrejudicada(id) {
    this.mostrarFormPrejudicada(id);
  },

  async excluirAtividade(id) {
    this.mostrarConfirmExcluir(id);
  },

  toggleAddMenu() {
    const menu = document.getElementById('addMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  },

  hideAddMenu() {
    const menu = document.getElementById('addMenu');
    if (menu) menu.style.display = 'none';
  },

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

  showExtraModal() {
    document.getElementById('extraModalTitle').textContent = 'Atividade Avulsa';
    document.getElementById('extraEditId').value = '';
    document.getElementById('extraForm').reset();
    document.getElementById('extraSubmitBtn').textContent = 'Salvar';
    this.populateRespSelects();
    document.getElementById('extraModal').style.display = 'flex';
  },

  closeExtraModal() {
    document.getElementById('extraModal').style.display = 'none';
    document.getElementById('extraForm').reset();
    document.getElementById('extraEditId').value = '';
  },

  async saveExtra(e) {
    e.preventDefault();
    const editId = document.getElementById('extraEditId').value;
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
      criadoPor: (typeof Auth !== 'undefined' && Auth.userName) || 'Usuário'
    };

    try {
      const servId = (this.servico && this.servico.id) || localStorage.getItem('sgpo_active_servico_id') || 'demo-servico';
      if (editId) {
        const result = await API.editarAtividadeRotina(servId, editId, dados);
        if (result.success) {
          const a = this.rotina.find(x => x.id === editId);
          if (a) { Object.assign(a, dados); this.renderRotina(); }
          Utils.showToast('Atividade atualizada com sucesso', 'success');
        } else {
          Utils.showToast(result.error || 'Erro ao atualizar atividade', 'error');
        }
      } else {
        const result = await API.criarAtividadeExtra(servId, dados);
        if (result.success) {
          Utils.showToast('Atividade avulsa criada com sucesso', 'success');
          Utils.playSound('nova-atividade');
          await this.loadRotina();
        } else {
          Utils.showToast(result.error || 'Erro ao criar atividade', 'error');
        }
      }
      this.closeExtraModal();
    } catch (e) {
      Utils.showToast('Erro: ' + e.message, 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => Rotina.init());
