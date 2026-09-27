const TimelineStore = {
  _getKey(servicoId) {
    const sId = servicoId || (typeof localStorage !== 'undefined' ? (localStorage.getItem('sgpo_active_servico_id') || 'current') : 'current');
    return `sgpo_persistent_timeline_${sId}`;
  },

  getAll(servicoId) {
    try {
      const raw = localStorage.getItem(this._getKey(servicoId));
      if (!raw) return [];
      const list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch(e) {
      return [];
    }
  },

  add(event, servicoId) {
    if (!event || !event.id) return;
    try {
      if (typeof Utils !== 'undefined' && Utils.formatDateTime) {
        if (event.horario) event.horario = Utils.formatDateTime(event.horario);
        if (event.horaConclusao) event.horaConclusao = Utils.formatDateTime(event.horaConclusao);
        if (event.horaInicio) event.horaInicio = Utils.formatDateTime(event.horaInicio);
      }
      const sId = servicoId || event.servicoId || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null) || 'current';
      const key = this._getKey(sId);
      const list = this.getAll(sId);
      const idx = list.findIndex(x => x.id === event.id);
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...event };
      } else {
        list.push({ ...event, servicoId: sId });
      }
      localStorage.setItem(key, JSON.stringify(list));
    } catch(e) {}
  },

  saveAll(events, servicoId) {
    try {
      const sId = servicoId || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null) || 'current';
      localStorage.setItem(this._getKey(sId), JSON.stringify(events));
    } catch(e) {}
  },

  mergeInto(rotinaArray, servicoId) {
    if (!Array.isArray(rotinaArray)) rotinaArray = [];
    const persistent = this.getAll(servicoId);
    const opPrefixes = ['r-ofe-', 'r-ofs-', 'r-sva-', 'r-svr-', 'r-desp-', 'r-ret-', 'r-oc-', 'r-ocf-', 'r-tele-', 'r-act-'];
    const activeStatuses = ['concluida', 'em_andamento', 'nao_realizada', 'cancelada'];

    const map = new Map();

    persistent.forEach(item => {
      if (item && item.id) map.set(item.id, item);
    });

    rotinaArray.forEach(item => {
      if (!item || !item.id) return;
      const existing = map.get(item.id);
      if (existing) {
        const statusFinal = (existing.status && existing.status !== 'nao_iniciada') ? existing.status : item.status;
        const merged = {
          ...item,
          ...existing,
          status: statusFinal,
          horaConclusao: existing.horaConclusao || item.horaConclusao,
          horaInicio: existing.horaInicio || item.horaInicio,
          horaAtualizacao: existing.horaAtualizacao || item.horaAtualizacao,
          concluidoPor: existing.concluidoPor || item.concluidoPor,
          observacoes: existing.observacoes || item.observacoes
        };
        map.set(item.id, merged);
      } else {
        map.set(item.id, item);
      }
    });

    rotinaArray.forEach(item => {
      if (!item || !item.id) return;
      if (opPrefixes.some(p => (item.id || '').startsWith(p)) || activeStatuses.includes(item.status)) {
        this.add(item, servicoId);
      }
    });

    return Array.from(map.values());
  }
};
if (typeof window !== 'undefined') window.TimelineStore = TimelineStore;

const API_Local = {
  applyToState(s, action, data) {
    const now = () => (typeof Utils !== 'undefined' && Utils.formatDateTime) ? Utils.formatDateTime(new Date()) : (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; })();
    let id = '';
    if (!s) return '';
    if (!s.rotina) s.rotina = [];
    if (!s.notificacoes) s.notificacoes = [];

    const servicoId = s.servico?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null);

    switch (action) {
      case 'updateAtividade': {
        const a = (s.rotina || []).find(x => x.id === data.atividadeId);
        if (a) {
          a.status = data.status;
          if (data.concluidoPor) a.concluidoPor = data.concluidoPor;
          if (data.horaConclusao !== undefined) a.horaConclusao = data.horaConclusao;
          if (data.horaInicio !== undefined) a.horaInicio = data.horaInicio;
          if (data.horaAtualizacao) a.horaAtualizacao = data.horaAtualizacao;
          if (data.observacoes !== undefined) a.observacoes = data.observacoes;
          const msgStatus = {
            concluida: `Rotina cumprida: ${a.nome}${a.horaConclusao ? ' às ' + a.horaConclusao : ''}`,
            em_andamento: `Rotina iniciada: ${a.nome}`,
            nao_realizada: `Rotina prejudicada: ${a.nome}`,
            cancelada: `Rotina cancelada: ${a.nome}`
          }[data.status];
          if (msgStatus) {
            s.notificacoes.unshift({
              id: 'n-' + Date.now(),
              mensagem: msgStatus,
              tipo: data.status === 'concluida' ? 'sucesso' : (data.status === 'nao_realizada' ? 'warning' : (data.status === 'cancelada' ? 'danger' : 'info')),
              horario: a.horaConclusao || a.horaAtualizacao || now(),
              lida: false
            });
          }
          TimelineStore.add(a, servicoId);
        }
        break;
      }
      case 'criarAtividadeExtra': {
        id = 'ext-' + Date.now();
        if (!s.extras) s.extras = [];
        const ext = { id, nome: data.nome, horario: data.horario, responsavel: data.responsavel, observacoes: data.observacoes, criadoPor: data.criadoPor, status: 'nao_iniciada' };
        s.extras.push(ext);
        const itemRot = { id, horario: data.horario, nome: data.nome, programa: data.programa || '', responsavel: data.responsavel, responsavelId: data.responsavelId || '', status: 'nao_iniciada', observacoes: data.observacoes, criadoPor: data.criadoPor, origem: 'extra' };
        s.rotina.push(itemRot);
        s.rotina.sort((x, y) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(x.horario) - getMin(y.horario); });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Nova atividade extra: ' + data.nome, tipo: 'info', horario: now(), lida: false });
        TimelineStore.add(itemRot, servicoId);
        break;
      }
      case 'adicionarAtividadeFixa': {
        const padrao = (s.atividadesPadrao || []).find(a => a.id === data.atividadeFixaId);
        id = 'rot-' + Date.now();
        const nova = {
          id,
          horario: data.horario || (padrao ? padrao.horario : now()),
          nome: data.nome || (padrao ? padrao.nome : 'Atividade'),
          programa: data.programa || (padrao ? padrao.programa : ''),
          responsavel: data.responsavel || (padrao ? padrao.responsavel_padrao : ''),
          responsavelId: data.responsavelId || '',
          status: 'nao_iniciada',
          observacoes: data.observacoes || (padrao ? padrao.observacoes : '') || '',
          origem: 'padrao',
          atividadePadraoId: data.atividadeFixaId || ''
        };
        s.rotina.push(nova);
        s.rotina.sort((x, y) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(x.horario) - getMin(y.horario); });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Atividade fixa adicionada: ' + nova.nome, tipo: 'info', horario: now(), lida: false });
        TimelineStore.add(nova, servicoId);
        break;
      }
      case 'editarAtividadeRotina': {
        const ar = (s.rotina || []).find(x => x.id === data.atividadeId);
        if (ar) {
          Object.assign(ar, data);
          const agoraEd = now();
          const evtEd = {
            id: 'r-act-' + Date.now(),
            horario: agoraEd,
            nome: `✏️ Atividade editada: ${ar.nome}`,
            programa: 'Rotina',
            responsavel: (typeof Auth !== 'undefined' && Auth.userName) || 'Sistema',
            status: 'concluida',
            concluidoPor: 'Sistema',
            horaConclusao: agoraEd
          };
          s.rotina.push(evtEd);
          TimelineStore.add(evtEd, servicoId);
          TimelineStore.add(ar, servicoId);
        }
        s.rotina.sort((x, y) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(x.horario) - getMin(y.horario); });
        break;
      }
      case 'excluirAtividadeRotina': {
        if (s.rotina) {
          const alvo = s.rotina.find(x => x.id === data.atividadeId);
          s.rotina = s.rotina.filter(x => x.id !== data.atividadeId);
          if (alvo) {
            const agoraEx = now();
            const evtEx = {
              id: 'r-act-' + Date.now(),
              horario: agoraEx,
              nome: `🗑️ Atividade excluída: ${alvo.nome}`,
              programa: 'Rotina',
              responsavel: (typeof Auth !== 'undefined' && Auth.userName) || 'Sistema',
              status: 'concluida',
              concluidoPor: 'Sistema',
              horaConclusao: agoraEx
            };
            s.rotina.push(evtEx);
            TimelineStore.add(evtEx, servicoId);
          }
        }
        break;
      }
      case 'registrarTelegrafia': {
        const agoraT = now();
        if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
        if (s.telegrafia) {
          s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: agoraT });
        }
        if (!data.militarId || data.militarId === '__VAZIA__' || data.vazia) {
          s.telegrafia = null;
          if (!s.telegrafiaVazioDesde) s.telegrafiaVazioDesde = agoraT;
          const evtTele = { id: 'r-tele-' + Date.now(), horario: agoraT, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraT };
          s.rotina.push(evtTele);
          TimelineStore.add(evtTele, servicoId);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Telegrafia vazia — sem operador disponível no quartel', tipo: 'alerta', horario: agoraT, lida: false });
        } else {
          let duracaoStr = data.tempoVazia || '';
          if (s.telegrafiaVazioDesde) {
            if (!duracaoStr) {
              try {
                const pI = String(s.telegrafiaVazioDesde).split(':');
                const pF = String(agoraT).split(':');
                let diff = ((parseInt(pF[0])||0)*60 + (parseInt(pF[1])||0)) - ((parseInt(pI[0])||0)*60 + (parseInt(pI[1])||0));
                if (diff < 0) diff += 1440;
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                duracaoStr = h > 0 ? `${h}h ${m}min` : (diff === 0 ? 'menos de 1 min' : `${m} min`);
              } catch(e) { duracaoStr = '1 min'; }
            }
            s.telegrafiaHistorico.push({ operador: '---', inicio: s.telegrafiaVazioDesde, fim: agoraT, duracao: duracaoStr });
            s.telegrafiaVazioDesde = null;
          }
          const m = (s.militares || []).find(x => x.id === data.militarId);
          const nomeOp = m ? m.nome : (data.militarNome || 'Desconhecido');
          s.telegrafia = { operador: nomeOp, militarId: data.militarId, horario: agoraT };
          const durTexto = duracaoStr ? ` (telegrafia esteve vazia por ${duracaoStr})` : '';
          const vTexto = data.viaturaNome ? ` após retorno da viatura ${data.viaturaNome}` : '';
          const evtTele = { id: 'r-tele-' + Date.now(), horario: agoraT, nome: `📡 ${nomeOp} assumiu a telegrafia${vTexto}${durTexto}`, programa: 'Telegrafia', responsavel: nomeOp, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraT };
          s.rotina.push(evtTele);
          TimelineStore.add(evtTele, servicoId);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `${nomeOp} assumiu a telegrafia${vTexto}${durTexto}`, tipo: 'telegrafia', horario: agoraT, lida: false });
        }
        break;
      }
      case 'registrarEntradaOficial': {
        const agoraO = now();
        if (!s.oficiais) s.oficiais = [];
        if (!s.oficiaisPresentes) s.oficiaisPresentes = [];
        if (!s.oficiaisHistorico) s.oficiaisHistorico = [];
        let o = s.oficiais.find(x => x.id === data.oficialId);
        if (data.nome && !o) {
          o = { id: 'of-' + Date.now(), nome: data.nome, posto: 'Anunciado', antiguidade: 999, unidade: '', Status: 'ativo' };
          s.oficiais.push(o);
        }
        if (o && !s.oficiaisPresentes.find(x => x.id === o.id)) {
          const anunciado = !!data.anunciado || !!data.nome;
          s.oficiaisPresentes.push({ ...o, horarioEntrada: agoraO, anunciado });
          s.oficiaisHistorico.push({ oficialId: o.id, nome: o.nome, horarioEntrada: agoraO, anunciado });
          const evtOf = { id: 'r-ofe-' + Date.now(), horario: agoraO, nome: `${anunciado ? '📢' : '🚪'} ${o.nome}${anunciado ? ' anunciado' : ' entrou no quartel'}`, programa: 'Oficiais', responsavel: o.nome, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraO };
          s.rotina.push(evtOf);
          TimelineStore.add(evtOf, servicoId);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: (o.nome || 'Oficial') + ' ' + (anunciado ? 'anunciado' : 'entrou no quartel'), tipo: 'oficial', horario: agoraO, lida: false });
        }
        break;
      }
      case 'registrarSaidaOficial': {
        const agoraS = now();
        if (!s.oficiaisPresentes) s.oficiaisPresentes = [];
        if (!s.oficiaisHistorico) s.oficiaisHistorico = [];
        const oS = (s.oficiais || []).find(x => x.id === data.oficialId);
        s.oficiaisPresentes = s.oficiaisPresentes.filter(x => x.id !== data.oficialId);
        const histEntry = s.oficiaisHistorico.find(x => x.oficialId === data.oficialId && !x.horarioSaida);
        if (histEntry) histEntry.horarioSaida = agoraS;
        const evtOfS = { id: 'r-ofs-' + Date.now(), horario: agoraS, nome: `🚪 ${oS?.nome || 'Oficial'} saiu do quartel`, programa: 'Oficiais', responsavel: oS?.nome || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraS };
        s.rotina.push(evtOfS);
        TimelineStore.add(evtOfS, servicoId);
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Oficial ' + (oS?.nome || '-') + ' saiu do quartel', tipo: 'oficial', horario: agoraS, lida: false });
        break;
      }
      case 'despacharViatura': {
        const sv = (s.servicoViaturas || []).find(x => x.id === (data.servicoViaturaId || data.id));
        if (sv) {
          const nowD = now();
          sv.horarioSaida = nowD;
          sv.status = 'em_ocorrencia';
          const tripIds = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
          if (s.telegrafia && tripIds.includes(s.telegrafia.militarId)) {
            if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
            s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: nowD });
            s.telegrafia = null;
            s.telegrafiaVazioDesde = nowD;
            const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: nowD, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowD };
            s.rotina.push(evtTeleVazia);
            TimelineStore.add(evtTeleVazia, servicoId);
            s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Telegrafista despachado — telegrafia operando vazia`, tipo: 'telegrafia', horario: nowD, lida: false });
          }
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${sv.viaturaNome} despachada para ocorrência`, tipo: 'alerta', horario: nowD, lida: false });
          const num = data.ocorrenciaNumero || '';
          const titulo = data.ocorrenciaTitulo || '';
          const evtDesp = {
            id: 'r-desp-' + Date.now(),
            horario: nowD,
            nome: `🚨 Despacho: ${sv.viaturaNome}${num ? ' — #' + num + ' ' + titulo : ''}`,
            programa: 'Ocorrência',
            responsavel: sv.motorista || sv.comandante || '-',
            status: 'concluida',
            concluidoPor: 'Sistema',
            horaConclusao: nowD
          };
          s.rotina.push(evtDesp);
          TimelineStore.add(evtDesp, servicoId);
        }
        break;
      }
      case 'retornarViatura': {
        const svr = (s.servicoViaturas || []).find(x => x.id === (data.servicoViaturaId || data.id));
        if (svr) {
          const agoraR = data.horarioRetorno || now();
          svr.horarioRetorno = agoraR;
          svr.status = data.destinoStatus || data.status || 'ativa';
          const ocFinalizar = (s.ocorrencias || []).find(oc => oc.servicoId === svr.servicoId && (oc.viaturaIds || []).includes(svr.viaturaId) && oc.status !== 'finalizada' && oc.status !== 'cancelada');
          if (ocFinalizar) {
            const outrasViaturas = (s.servicoViaturas || []).filter(v => v.id !== svr.id && (ocFinalizar.viaturaIds || []).includes(v.viaturaId) && v.status === 'em_ocorrencia');
            if (outrasViaturas.length === 0) {
              ocFinalizar.horaRetorno = agoraR;
              ocFinalizar.status = 'finalizada';
              const evtOcf = { id: 'r-ocf-' + Date.now(), horario: agoraR, nome: '✅ Ocorrência #' + (ocFinalizar.numero || '') + ' finalizada — viatura(s) retornou à base', programa: 'Ocorrências', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraR };
              s.rotina.push(evtOcf);
              TimelineStore.add(evtOcf, servicoId);
            }
          }
          const evtRet = { id: 'r-ret-' + Date.now(), horario: agoraR, nome: `🏠 Retorno à base: ${svr.viaturaNome}`, programa: 'Ocorrências', responsavel: svr.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraR };
          s.rotina.push(evtRet);
          TimelineStore.add(evtRet, servicoId);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${svr.viaturaNome} retornou à base`, tipo: 'info', horario: agoraR, lida: false });

          // Se a telegrafia estava desocupada (vazia), alguém da composição da viatura assume a telegrafia
          const isVazia = !s.telegrafia || !s.telegrafia.militarId || s.telegrafia.militarId === '__VAZIA__' || !s.telegrafia.operador || s.telegrafia.operador === '---';
          if (isVazia) {
            let militarIdTele = data.novoTelegrafistaId;
            let militarNomeTele = data.novoTelegrafistaNome;
            if (!militarIdTele) {
              if (svr.tripulantes && svr.tripulantes.length > 0 && svr.tripulantes[0]?.id) {
                militarIdTele = svr.tripulantes[0].id;
                militarNomeTele = svr.tripulantes[0].nome;
              } else if (svr.motoristaId) {
                militarIdTele = svr.motoristaId;
                militarNomeTele = svr.motorista;
              } else if (svr.comandanteId) {
                militarIdTele = svr.comandanteId;
                militarNomeTele = svr.comandante;
              }
            }
            if (militarIdTele) {
              if (!militarNomeTele) {
                const milObj = (s.militares || []).find(m => m.id === militarIdTele);
                militarNomeTele = milObj ? milObj.nome : 'Militar';
              }
              const iniVazia = s.telegrafiaVazioDesde || agoraR;
              let duracaoStr = data.tempoVazia || '';
              if (!duracaoStr) {
                try {
                  const pI = String(iniVazia).split(':');
                  const pF = String(agoraR).split(':');
                  let diff = ((parseInt(pF[0])||0)*60 + (parseInt(pF[1])||0)) - ((parseInt(pI[0])||0)*60 + (parseInt(pI[1])||0));
                  if (diff < 0) diff += 1440;
                  const h = Math.floor(diff / 60);
                  const m = diff % 60;
                  duracaoStr = h > 0 ? `${h}h ${m}min` : (diff === 0 ? 'menos de 1 min' : `${m} min`);
                } catch(e) { duracaoStr = '1 min'; }
              }
              if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
              s.telegrafiaHistorico.push({ operador: '---', inicio: iniVazia, fim: agoraR, duracao: duracaoStr });
              s.telegrafia = { operador: militarNomeTele, militarId: militarIdTele, horario: agoraR };
              s.telegrafiaVazioDesde = null;

              const evtTeleAuto = {
                id: 'r-tele-' + Date.now(),
                horario: agoraR,
                nome: `📡 ${militarNomeTele} assumiu a telegrafia após retorno da viatura ${svr.viaturaNome} (telegrafia esteve vazia por ${duracaoStr})`,
                programa: 'Telegrafia',
                responsavel: militarNomeTele,
                status: 'concluida',
                concluidoPor: 'Sistema',
                horaConclusao: agoraR
              };
              s.rotina.push(evtTeleAuto);
              TimelineStore.add(evtTeleAuto, servicoId);
            }
          }
        }
        break;
      }
      case 'criarOcorrencia': {
        id = 'oc-' + Date.now();
        const existentes = (s.ocorrencias || []).filter(o => o.servicoId === data.servicoId && o.Status !== 'removido');
        const num = data.numero || String(existentes.length + 1).padStart(3, '0');
        const nowOc = data.horaAcionamento || data.horaOcorrencia || now();
        if (!s.ocorrencias) s.ocorrencias = [];
        s.ocorrencias.push({
          id, numero: num, servicoId: data.servicoId, titulo: data.titulo || '',
          natureza: data.natureza || '', endereco: data.endereco || '', descricao: data.descricao || '',
          viaturaIds: data.viaturaIds || [], efetivo: data.efetivo || [],
          horaAcionamento: nowOc, horaRetorno: '', prontidaoCor: data.prontidaoCor || '',
          status: 'em_atendimento', Status: 'ativo'
        });
        if (data.servicoViaturaIds && data.servicoViaturaIds.length > 0) {
          data.servicoViaturaIds.forEach(svId => {
            const sv = (s.servicoViaturas || []).find(x => x.id === svId);
            if (sv) {
              sv.horarioSaida = nowOc;
              sv.status = 'em_ocorrencia';
              const tripIds = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
              if (s.telegrafia && tripIds.includes(s.telegrafia.militarId)) {
                if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
                s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: nowOc });
                s.telegrafia = null;
                s.telegrafiaVazioDesde = nowOc;
              }
              const evtDesp = { id: 'r-desp-' + Date.now() + Math.random(), horario: nowOc, nome: `🚨 Despacho/Empenho: ${sv.viaturaNome} — #${num} ${data.titulo}`, programa: 'Ocorrência', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowOc };
              s.rotina.push(evtDesp);
              TimelineStore.add(evtDesp, servicoId);
            }
          });
        }
        if (data.telegrafiaVazia || data.novoTelegrafistaId === '__VAZIA__') {
          s.telegrafia = null;
          s.telegrafiaVazioDesde = nowOc;
          const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: nowOc, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowOc };
          s.rotina.push(evtTeleVazia);
          TimelineStore.add(evtTeleVazia, servicoId);
        } else if (data.novoTelegrafistaId && data.novoTelegrafistaId !== '__VAZIA__') {
          const mNovo = (s.militares || []).find(x => x.id === data.novoTelegrafistaId);
          const nomeNovo = mNovo ? mNovo.nome : 'Novo militar';
          s.telegrafia = { operador: nomeNovo, militarId: data.novoTelegrafistaId, horario: nowOc };
          const evtTeleNovo = { id: 'r-tele-' + Date.now(), horario: nowOc, nome: `📡 ${nomeNovo} assumiu a telegrafia`, programa: 'Telegrafia', responsavel: nomeNovo, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowOc };
          s.rotina.push(evtTeleNovo);
          TimelineStore.add(evtTeleNovo, servicoId);
        }

        const evtOc = { id: 'r-oc-' + Date.now(), horario: nowOc, nome: `🚨 Ocorrência #${num}: ${data.titulo}${data.endereco ? ' (' + data.endereco + ')' : ''}`, programa: 'Ocorrências', responsavel: data.efetivo?.[0] || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowOc };
        s.rotina.push(evtOc);
        TimelineStore.add(evtOc, servicoId);
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Nova ocorrência #${num}: ${data.titulo}`, tipo: 'urgente', horario: nowOc, lida: false });
        break;
      }
      case 'editarOcorrencia': {
        const oce = (s.ocorrencias || []).find(x => x.id === data.id);
        if (oce) Object.assign(oce, data);
        break;
      }
      case 'finalizarOcorrencia': {
        const ocf = (s.ocorrencias || []).find(x => x.id === (data.id || data.ocorrenciaId));
        if (ocf) {
          const nowF = data.horaRetorno || now();
          if (data.liberarApenasServicoViaturaId) {
            const sv = (s.servicoViaturas || []).find(x => x.id === data.liberarApenasServicoViaturaId);
            if (sv) {
              sv.horarioRetorno = nowF;
              sv.status = data.destinoStatus || 'ativa';
              ocf.viaturaIds = (ocf.viaturaIds || []).filter(vid => vid !== sv.viaturaId);
              const evtDesemp = { id: 'r-ret-' + Date.now(), horario: nowF, nome: `🏠 Desempenho: ${sv.viaturaNome} liberada da Ocorrência #${ocf.numero} (${sv.status === 'retornando' ? 'retornando' : 'disponível na base'})`, programa: 'Ocorrências', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowF };
              s.rotina.push(evtDesemp);
              TimelineStore.add(evtDesemp, servicoId);
            }
          } else {
            ocf.horaRetorno = nowF;
            ocf.status = data.status || 'finalizada';
            if (data.desfecho) ocf.desfecho = data.desfecho;
            const viaturasDaOcorr = (s.servicoViaturas || []).filter(sv => (ocf.viaturaIds || []).includes(sv.viaturaId) && sv.servicoId === ocf.servicoId);
            viaturasDaOcorr.forEach(sv => {
              sv.horarioRetorno = nowF;
              sv.status = data.destinoStatus || 'ativa';
              const evtRetV = { id: 'r-ret-' + Date.now() + Math.random(), horario: nowF, nome: `🏠 Retorno à base: ${sv.viaturaNome}`, programa: 'Ocorrências', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowF };
              s.rotina.push(evtRetV);
              TimelineStore.add(evtRetV, servicoId);
            });
            const statusTexto = ocf.status === 'cancelada' ? 'cancelada' : (ocf.status === 'trote' ? 'trote confirmado' : 'finalizada');
            const evtOcf = { id: 'r-ocf-' + Date.now(), horario: nowF, nome: `✅ Ocorrência #${ocf.numero || ''} ${statusTexto}${data.desfecho ? ' — ' + data.desfecho : ''}`, programa: 'Ocorrências', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowF };
            s.rotina.push(evtOcf);
            TimelineStore.add(evtOcf, servicoId);
            s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Ocorrência #${ocf.numero || ''} ${statusTexto}`, tipo: 'info', horario: nowF, lida: false });
          }
        }
        break;
      }
      case 'empenharReforcoOcorrencia': {
        const ocr = (s.ocorrencias || []).find(x => x.id === data.ocorrenciaId);
        if (ocr && data.servicoViaturaIds) {
          const nowR = data.horario || now();
          data.servicoViaturaIds.forEach(svId => {
            const sv = (s.servicoViaturas || []).find(x => x.id === svId);
            if (sv) {
              if (!ocr.viaturaIds.includes(sv.viaturaId)) ocr.viaturaIds.push(sv.viaturaId);
              sv.status = 'em_ocorrencia';
              sv.horarioSaida = nowR;
              const evtApoio = { id: 'r-desp-' + Date.now() + Math.random(), horario: nowR, nome: `🚨 Apoio/Empenho: ${sv.viaturaNome} despachada para Ocorrência #${ocr.numero}${data.motivoApoio ? ' (' + data.motivoApoio + ')' : ''}`, programa: 'Ocorrência', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowR };
              s.rotina.push(evtApoio);
              TimelineStore.add(evtApoio, servicoId);
            }
          });
          if (data.telegrafiaVazia || data.novoTelegrafistaId === '__VAZIA__') {
            s.telegrafia = null;
            s.telegrafiaVazioDesde = nowR;
            const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: nowR, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowR };
            s.rotina.push(evtTeleVazia);
            TimelineStore.add(evtTeleVazia, servicoId);
          } else if (data.novoTelegrafistaId && data.novoTelegrafistaId !== '__VAZIA__') {
            const mNovo = (s.militares || []).find(x => x.id === data.novoTelegrafistaId);
            const nomeNovo = mNovo ? mNovo.nome : 'Novo militar';
            s.telegrafia = { operador: nomeNovo, militarId: data.novoTelegrafistaId, horario: nowR };
            const evtTeleNovo = { id: 'r-tele-' + Date.now(), horario: nowR, nome: `📡 ${nomeNovo} assumiu a telegrafia`, programa: 'Telegrafia', responsavel: nomeNovo, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowR };
            s.rotina.push(evtTeleNovo);
            TimelineStore.add(evtTeleNovo, servicoId);
          }
        }
        break;
      }
      case 'iniciarServicoViatura': {
        if (!s.servicoViaturas) s.servicoViaturas = [];
        const idSv = 'sv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
        const agoraSv = now();
        const svNova = {
          id: idSv,
          servicoId: data.servicoId,
          viaturaId: data.viaturaId,
          viaturaNome: data.viaturaNome,
          comandante: data.comandante || '',
          comandanteId: data.comandanteId || '',
          motorista: data.motorista || '',
          motoristaId: data.motoristaId || '',
          tripulantes: data.tripulantes || [],
          horarioSaida: '',
          horarioRetorno: '',
          status: 'ativa',
          Status: 'ativo'
        };
        s.servicoViaturas.push(svNova);
        const evtSvA = { id: 'r-sva-' + Date.now(), horario: agoraSv, nome: `🚒 Viatura ativada: ${data.viaturaNome}`, programa: 'Viaturas', responsavel: data.comandante || data.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraSv };
        s.rotina.push(evtSvA);
        TimelineStore.add(evtSvA, servicoId);
        id = idSv;
        break;
      }
      case 'encerrarServicoViatura': {
        const svEnc = (s.servicoViaturas || []).find(x => x.id === (data.id || data.servicoViaturaId));
        if (svEnc) {
          const agoraEnc = now();
          svEnc.Status = 'encerrado';
          svEnc.status = 'encerrada';
          svEnc.horarioRetorno = agoraEnc;
          const evtSvR = { id: 'r-svr-' + Date.now(), horario: agoraEnc, nome: `🚒 Viatura colocada na Reserva: ${svEnc.viaturaNome}`, programa: 'Viaturas', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraEnc };
          s.rotina.push(evtSvR);
          TimelineStore.add(evtSvR, servicoId);
        }
        break;
      }
      case 'editarServicoViatura': {
        const svd = (s.servicoViaturas || []).find(x => x.id === (data.id || data.servicoViaturaId));
        if (svd) {
          Object.assign(svd, data);
          const meusIds = new Set([
            svd.comandanteId,
            svd.motoristaId,
            ...(svd.tripulantes || []).map(t => t.id)
          ].filter(Boolean));

          (s.servicoViaturas || []).forEach(outra => {
            if (outra.id === svd.id || outra.Status === 'encerrado') return;
            if (outra.comandanteId && meusIds.has(outra.comandanteId)) {
              outra.comandanteId = '';
              outra.comandante = '';
            }
            if (outra.motoristaId && meusIds.has(outra.motoristaId)) {
              outra.motoristaId = '';
              outra.motorista = '';
            }
            if (outra.tripulantes && Array.isArray(outra.tripulantes)) {
              outra.tripulantes = outra.tripulantes.filter(t => !meusIds.has(t.id));
            }
          });

          if (data.movimentacoes && Array.isArray(data.movimentacoes)) {
            data.movimentacoes.forEach(mov => {
              const evtMov = { id: 'r-act-' + Date.now() + Math.random(), horario: now(), nome: `🔄 Movimentação: ${mov.militarNome || 'Componente'} transferido para ${mov.paraViatura || svd.viaturaNome}`, programa: 'Viaturas', responsavel: mov.militarNome || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now() };
              s.rotina.push(evtMov);
              TimelineStore.add(evtMov, servicoId);
            });
          }
        }
        break;
      }
      case 'marcarLida': {
        const n = (s.notificacoes || []).find(x => x.id === data.notificacaoId);
        if (n) n.lida = true;
        break;
      }
      case 'adicionarEquipe': {
        if (s.servico && s.servico.equipe) {
           const eq = Array.isArray(s.servico.equipe) ? s.servico.equipe : [];
           eq.push(data.integrante);
           s.servico.equipe = eq;
        }
        break;
      }
      case 'removerEquipe': {
        if (s.servico && Array.isArray(s.servico.equipe)) {
           s.servico.equipe = s.servico.equipe.filter(e => e.id !== data.integranteId);
        }
        break;
      }
    }
    return id || (data ? data.atividadeId : undefined);
  },

  handleWrite(action, data) {
    let s = (typeof Sync !== 'undefined' && Sync._lastData) ? Sync._lastData : null;
    if (!s) {
      try {
        const raw = localStorage.getItem('sgpo_cached_servico');
        if (raw) s = JSON.parse(raw);
      } catch (e) {}
    }
    if (!s && typeof DemoData !== 'undefined') {
      s = DemoData.getState();
    }
    if (!s) return { success: true };

    let id = '';
    try {
      id = this.applyToState(s, action, data);
      const sId = s.servico?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null);
      if (s.rotina) {
        s.rotina = TimelineStore.mergeInto(s.rotina, sId);
      }
      if (typeof Sync !== 'undefined') {
        Sync._processData(s);
      }
      try {
        localStorage.setItem('sgpo_cached_servico', JSON.stringify(s));
      } catch(e) {}
      if (typeof DemoData !== 'undefined') {
        const ds = DemoData.getState();
        if (ds && ds !== s) {
          this.applyToState(ds, action, data);
          if (ds.rotina) ds.rotina = TimelineStore.mergeInto(ds.rotina, sId);
        }
        DemoData.save();
      }
    } catch(e) {
       console.error('API_Local error:', e);
    }
    
    return { success: true, id: id };
  }
};

const SyncQueue = {
  queue: [],
  isSyncing: false,
  _interval: null,
  
  init() {
    try {
      this.queue = JSON.parse(localStorage.getItem('sgpo_sync_queue') || '[]');
      if (!Array.isArray(this.queue)) this.queue = [];
    } catch(e) {
      this.queue = [];
    }
    this._sanitizeQueue();
    this.updateUI();
    if (!this._interval) this._interval = setInterval(() => this.sync(), 25000);
    window.addEventListener('online', () => {
      console.log('[SyncQueue] Conexão restabelecida, enviando pendências...');
      this.sync();
    });
  },

  _sanitizeQueue() {
    let changed = false;
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(item => {
      if (!item || typeof item !== 'object' || !item.action) {
        changed = true;
        return false;
      }
      if (['editarServicoViatura', 'finalizarOcorrencia', 'editarOcorrencia'].includes(item.action)) {
        if (!item.id && (item.servicoViaturaId || item.ocorrenciaId)) {
          item.id = item.servicoViaturaId || item.ocorrenciaId;
          changed = true;
        }
        if (!item.id) {
          console.warn('[SyncQueue] Descartando requisição sem ID obrigatório da fila:', item);
          changed = true;
          return false;
        }
      }
      if (['retornarViatura', 'despacharViatura'].includes(item.action)) {
        if (!item.servicoViaturaId && item.id) {
          item.servicoViaturaId = item.id;
          changed = true;
        }
        if (!item.servicoViaturaId) {
          console.warn('[SyncQueue] Descartando requisição sem servicoViaturaId da fila:', item);
          changed = true;
          return false;
        }
      }
      return true;
    });

    if (changed || this.queue.length !== initialLen) {
      try {
        localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue));
      } catch(e) {}
    }
  },
  
  add(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (['editarServicoViatura', 'finalizarOcorrencia', 'editarOcorrencia'].includes(payload.action)) {
      if (!payload.id && (payload.servicoViaturaId || payload.ocorrenciaId)) {
        payload.id = payload.servicoViaturaId || payload.ocorrenciaId;
      }
      if (!payload.id) {
        console.warn('[SyncQueue] Não é possível enfileirar sem ID obrigatório:', payload);
        return;
      }
    }
    if (['retornarViatura', 'despacharViatura'].includes(payload.action)) {
      if (!payload.servicoViaturaId && payload.id) {
        payload.servicoViaturaId = payload.id;
      }
      if (!payload.servicoViaturaId) {
        console.warn('[SyncQueue] Não é possível enfileirar sem servicoViaturaId:', payload);
        return;
      }
    }
    this.queue.push(payload);
    try {
      localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue));
    } catch(e) {}
    this.updateUI();
    if (navigator.onLine && !this.isSyncing) {
      setTimeout(() => this.sync(), 50);
    }
  },
  
  updateUI() {
    let bar = document.getElementById('syncQueueBar');
    if (this.queue.length > 0) {
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'syncQueueBar';
        bar.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--bg-secondary, #181829);border:1.5px solid var(--warning, #f59e0b);color:var(--text-primary, #fff);padding:8px 14px;font-size:0.82rem;border-radius:10px;z-index:999999;box-shadow:0 6px 20px rgba(0,0,0,0.45);display:flex;align-items:center;gap:10px;animation:fadeIn 0.2s ease;';
        document.body.appendChild(bar);
      }
      const count = this.queue.length;
      const isOnline = navigator.onLine;
      const labelText = !isOnline 
        ? `${count} ${count === 1 ? 'atualização pendente (offline)' : 'atualizações pendentes (offline)'}` 
        : (this.isSyncing ? 'Sincronizando atualizações...' : `${count} ${count === 1 ? 'atualização pendente' : 'atualizações pendentes'}`);
      
      bar.innerHTML = `
        <span style="display:flex;align-items:center;gap:6px;font-weight:600;color:var(--warning, #f59e0b)">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--warning, #f59e0b);box-shadow:0 0 8px var(--warning, #f59e0b)"></span>
          ${labelText}
        </span>
        <button onclick="SyncQueue.sync()" class="btn btn-primary btn-sm" style="font-size:0.75rem;padding:3px 10px;background:var(--warning, #f59e0b);color:#000;border:none;font-weight:700;${this.isSyncing ? 'opacity:0.6;pointer-events:none' : ''}">
          ${this.isSyncing ? 'Enviando...' : 'Sincronizar agora'}
        </button>
      `;
    } else {
      if (bar) bar.remove();
    }
  },
  
  async sync() {
    if (this.queue.length === 0 || this.isSyncing) return;
    this.isSyncing = true;
    this.updateUI();
    
    const batch = [...this.queue];
    let anySuccess = false;
    
    for (const req of batch) {
      if (['editarServicoViatura', 'finalizarOcorrencia', 'editarOcorrencia'].includes(req.action)) {
        if (!req.id && (req.servicoViaturaId || req.ocorrenciaId)) {
          req.id = req.servicoViaturaId || req.ocorrenciaId;
        }
        if (!req.id) {
          console.warn('[SyncQueue] Item descartado por ausência de ID obrigatório:', req);
          this.queue = this.queue.filter(q => q !== req);
          try { localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue)); } catch(e) {}
          this.updateUI();
          continue;
        }
      }
      if (['retornarViatura', 'despacharViatura'].includes(req.action)) {
        if (!req.servicoViaturaId && req.id) {
          req.servicoViaturaId = req.id;
        }
        if (!req.servicoViaturaId) {
          console.warn('[SyncQueue] Item descartado por ausência de servicoViaturaId:', req);
          this.queue = this.queue.filter(q => q !== req);
          try { localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue)); } catch(e) {}
          this.updateUI();
          continue;
        }
      }

      try {
        await API._gasFetch(req);
        anySuccess = true;
        this.queue = this.queue.filter(q => q !== req);
        try {
          localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue));
        } catch(e) {}
        this.updateUI();
      } catch (e) {
        const msg = (e && e.message) ? e.message : String(e);
        const isPermanentError = msg.includes('ID obrigatório') ||
                                 msg.includes('obrigatório') ||
                                 msg.includes('não encontrada') ||
                                 msg.includes('não encontrado') ||
                                 msg.includes('Registro não encontrado');

        if (isPermanentError) {
          console.warn('[SyncQueue] Item com erro de validação permanente removido da fila:', msg, req);
          this.queue = this.queue.filter(q => q !== req);
          try {
            localStorage.setItem('sgpo_sync_queue', JSON.stringify(this.queue));
          } catch(err) {}
          this.updateUI();
          continue;
        }

        console.warn('[SyncQueue] Envio pendente aguardando reconexão:', msg);
        break;
      }
    }
    
    this.isSyncing = false;
    this.updateUI();
    
    if (this.queue.length === 0) {
      if (anySuccess && typeof Utils !== 'undefined' && typeof Utils.showToast === 'function') {
        Utils.showToast('Todas as alterações foram sincronizadas!', 'success');
      }
      if (typeof Sync !== 'undefined' && Sync.servicoId) {
        Sync.requestImmediatePull ? Sync.requestImmediatePull(true) : Sync.pull(true);
        if (typeof Sync.broadcastForceRefresh === 'function') {
          Sync.broadcastForceRefresh();
        }
      }
    } else if (anySuccess) {
      if (typeof Utils !== 'undefined' && typeof Utils.showToast === 'function') {
        Utils.showToast('Sincronização parcial realizada.', 'info');
      }
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => SyncQueue.init());
} else {
  SyncQueue.init();
}

const API = {
  BASE_URL: '',
  DEFAULT_URL: 'https://script.google.com/macros/s/AKfycbxC5bb81uTq_XBgGNx0HISBExULW1a1pDg8sqXnvp1CE-TsTGJlmrm510-mcmxM-xuRcg/exec',
  _config: null,
  _demo: false,
  _tiposCache: [],

  getConfig() {
    if (!this._config) {
      const saved = localStorage.getItem('sgpo_config');
      this._config = saved ? JSON.parse(saved) : {};
    }
    if (!this._config.apiUrl) {
      this._config.apiUrl = this.DEFAULT_URL;
      localStorage.setItem('sgpo_config', JSON.stringify(this._config));
    }
    this.BASE_URL = this._config.apiUrl;
    return this._config;
  },

  _triggerSync() {
    if (typeof Sync !== 'undefined' && Sync.servicoId) {
      if (typeof Sync.requestImmediatePull === 'function') {
        Sync.requestImmediatePull(true);
      } else {
        setTimeout(() => Sync.pull(true), 50);
      }
      if (typeof Sync.broadcastForceRefresh === 'function') {
        Sync.broadcastForceRefresh();
      }
    }
  },

  init(baseUrl) {
    this.BASE_URL = baseUrl;
    this._config = { ...this.getConfig(), apiUrl: baseUrl };
    localStorage.setItem('sgpo_config', JSON.stringify(this._config));
  },

  enableDemo() {
    this._demo = true;
    localStorage.setItem('sgpo_demo', 'true');
  },

  disableDemo() {
    this._demo = false;
    localStorage.removeItem('sgpo_demo');
    this._config = null;
    this.getConfig();
  },

  get isDemo() {
    return this._demo || localStorage.getItem('sgpo_demo') === 'true';
  },

  _showProgress(action) {
    const labels = {
      'iniciarServico': 'Iniciando serviço...',
      'encerrarServico': 'Encerrando serviço...',
      'updateAtividade': 'Salvando atividade...',
      'criarAtividadeExtra': 'Criando atividade extra...',
      'adicionarAtividadeFixa': 'Adicionando atividade...',
      'editarAtividadeRotina': 'Editando atividade...',
      'excluirAtividadeRotina': 'Excluindo atividade...',
      'salvarRotinaPersonalizada': 'Salvando rotina personalizada...',
      'resetarRotinaPersonalizada': 'Resetando rotina personalizada...',
      'registrarTelegrafia': 'Registrando telegrafia...',
      'registrarEntradaOficial': 'Registrando entrada...',
      'registrarSaidaOficial': 'Registrando saída...',
      'despacharViatura': 'Despachando viatura...',
      'retornarViatura': 'Registrando retorno...',
      'finalizarOcorrencia': 'Finalizando ocorrência...',
      'editarServicoViatura': 'Editando viatura...',
      'updateConfig': 'Salvando configurações...',
      'create': 'Salvando...',
      'update': 'Atualizando...',
      'delete': 'Excluindo...'
    };

    const existing = document.querySelector('.progress-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'progress-overlay';
    overlay.innerHTML = `
      <div class="progress-box">
        <div class="progress-spinner"></div>
        <div class="progress-text">${labels[action] || 'Salvando...'}</div>
        <div class="progress-detail">Aguarde, comunicando com a planilha</div>
        <div class="progress-bar-track"><div class="progress-bar-fill" id="progressBarFill"></div></div>
      </div>
    `;
    document.body.appendChild(overlay);

    let progress = 0;
    const fill = document.getElementById('progressBarFill');
    this._progressInterval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 90) progress = 90;
      if (fill) fill.style.width = progress + '%';
    }, 300);
  },

  _hideProgress(success) {
    clearInterval(this._progressInterval);
    const fill = document.getElementById('progressBarFill');
    const overlay = document.querySelector('.progress-overlay');
    if (fill) fill.style.width = '100%';
    setTimeout(() => {
      if (overlay) overlay.remove();
    }, success ? 400 : 1500);
  },

  _readLabels: {
    'getServicoAtual': 'Carregando dashboard...',
    'getServicosAtivos': 'Carregando serviços...',
    'getRotina': 'Carregando rotina...',
    'getRotinaPersonalizada': 'Carregando rotina personalizada...',
    'getRotinaParaServico': 'Carregando atividades...',
    'getPostosServico': 'Carregando postos...',
    'getUsuariosPostos': 'Carregando vínculos...',
    'getServicoPorPosto': 'Verificando serviço...',
    'login': 'Autenticando...',
    'read': 'Carregando dados...',
    'getNotificacoes': 'Carregando notificações...',
    'getHistorico': 'Carregando histórico...',
    'getRelatorio': 'Gerando relatório...',
    'getServicoViaturas': 'Carregando viaturas...',
    'getPermissoesServico': 'Carregando permissões...',
    'checkAcessoServico': 'Verificando acesso...',
    'getUsuariosEditaveis': 'Carregando usuários...'
  },

  _showStatusBar(action) {
    const existing = document.querySelector('.status-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.className = 'status-bar';
    const msg = this._readLabels[action] || (action ? `Executando ${action}...` : 'Carregando...');
    bar.innerHTML = `<span class="status-bar-text">${msg}</span><span class="status-bar-spinner"></span>`;
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add('active'));
  },

  _hideStatusBar() {
    const bar = document.querySelector('.status-bar');
    if (bar) {
      bar.classList.add('done');
      setTimeout(() => bar.remove(), 400);
    }
  },

  _inFlight: {},
  _lastServicoFetchTime: 0,
  _lastPostosFetchTime: 0,

  async request(action, data = {}, options = {}) {
    if (this.isDemo) return DemoData.handle(action, data);

    this.getConfig();
    if (!this.BASE_URL) {
      throw new Error('API não configurada. Clique em "Modo Demo" ou configure a API.');
    }

    const isWrite = ['create', 'update', 'delete', 'iniciarServico', 'encerrarServico',
      'updateAtividade', 'criarAtividadeExtra', 'adicionarAtividadeFixa',
      'editarAtividadeRotina', 'excluirAtividadeRotina', 'registrarTelegrafia',
      'registrarEntradaOficial', 'registrarSaidaOficial', 'despacharViatura',
      'retornarViatura', 'finalizarOcorrencia', 'editarServicoViatura',
      'salvarRotinaPersonalizada', 'resetarRotinaPersonalizada',
      'updateConfig', 'criarOcorrencia', 'editarOcorrencia', 'empenharReforcoOcorrencia', 'adicionarEquipe', 'removerEquipe', 'marcarLida', 'editarServico', 'redefinirSenha', 'alterarMinhaSenha', 'criarCivis', 'importarAtividadesPadrao'].includes(action);

    if (isWrite) this._showProgress(action);

    const payload = { action, ...data };
    
    // Normalização defensiva de identificadores chave
    if (action === 'editarServicoViatura') {
      if (!payload.id && payload.servicoViaturaId) payload.id = payload.servicoViaturaId;
      if (!payload.servicoViaturaId && payload.id) payload.servicoViaturaId = payload.id;
    } else if (action === 'finalizarOcorrencia' || action === 'editarOcorrencia') {
      if (!payload.id && payload.ocorrenciaId) payload.id = payload.ocorrenciaId;
      if (!payload.ocorrenciaId && payload.id) payload.ocorrenciaId = payload.id;
    } else if (action === 'retornarViatura' || action === 'despacharViatura') {
      if (!payload.servicoViaturaId && payload.id) payload.servicoViaturaId = payload.id;
      if (!payload.id && payload.servicoViaturaId) payload.id = payload.servicoViaturaId;
    }
    
    // Injeta credenciais para backend stateless
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn && Auth.user) {
      if (!Auth.user.token && !this.isDemo) {
        Auth.logout();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      payload.auth = {
        id: Auth.user.id,
        token: Auth.user.token || 'demo-token'
      };
    }
    
    const canQueueOffline = !['iniciarServico', 'encerrarServico', 'create', 'update', 'delete', 'updateConfig', 'salvarRotinaPersonalizada', 'resetarRotinaPersonalizada', 'editarServico', 'redefinirSenha', 'alterarMinhaSenha', 'criarCivis', 'importarAtividadesPadrao'].includes(action);
    
    if (isWrite && canQueueOffline && typeof SyncQueue !== 'undefined') {
       const localResult = API_Local.handleWrite(action, data);
       SyncQueue.add(payload);
       this._hideProgress(true);
       return localResult;
    }

    const isRead = !isWrite && action !== 'ping';

    // Deduplicação em voo para consultas idênticas concorrentes
    const dedupKey = isRead ? (action + ':' + JSON.stringify(data)) : null;
    if (dedupKey && this._inFlight[dedupKey]) {
      return this._inFlight[dedupKey];
    }

    const silentReads = [
      'getServicoAtual', 'getPostosServico', 'getPostosComServico', 'checkAcessoServico',
      'getViaturas', 'getMilitares', 'getTiposViatura', 'getNaturezas',
      'registrarHeartbeat', 'ping', 'getServicosAtivos', 'getUsuariosPostos', 'getNotificacoes'
    ];
    const shouldShowStatus = isRead && !options.silent && !silentReads.includes(action);
    let statusTimer = null;
    if (shouldShowStatus) {
      statusTimer = setTimeout(() => this._showStatusBar(action), 500);
    }

    const fetchPromise = (async () => {
      try {
        const result = await this._gasFetch(payload);
        if (isWrite) this._hideProgress(true);
        if (statusTimer) clearTimeout(statusTimer);
        if (shouldShowStatus) this._hideStatusBar();
        return result;
      } catch (err) {
        if (isWrite) this._hideProgress(false);
        if (statusTimer) clearTimeout(statusTimer);
        if (shouldShowStatus) this._hideStatusBar();
        const isNetworkErr = err.message === 'Failed to fetch' || 
                             (err.message && err.message.includes('NetworkError')) || 
                             (err.message && err.message.includes('fetch')) ||
                             (err.message && err.message.includes('HTML em vez de JSON')) ||
                             (err.message && err.message.includes('invalida do servidor')) ||
                             err.name === 'TypeError';
        if (isNetworkErr) {
          throw new Error('Erro de conexão. Verifique a URL da API ou sua rede.');
        }
        throw err;
      } finally {
        if (dedupKey) delete this._inFlight[dedupKey];
      }
    })();

    if (dedupKey) this._inFlight[dedupKey] = fetchPromise;
    return fetchPromise;
  },

  async _gasFetch(payload, _retrying, _echoUrl) {
    const url = _echoUrl || this.BASE_URL;
    const response = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    if (response.status === 405) {
      if (!_retrying) {
        console.warn('[SGPO] POST retornou 405 (Method Not Allowed). Tentando extrair echo URL...');
        const histUrl = response.url || url;
        if (histUrl && histUrl.includes('echo') && histUrl !== this.BASE_URL) {
          await new Promise(r => setTimeout(r, 500));
          return this._gasFetch(payload, true, histUrl);
        }
      }
      throw new Error('GAS Web App retornou 405. Redeploy o Web App: Apps Script > Implantar > Nova implantacao > "Executar como: Eu" > "Quem pode acessar: Qualquer pessoa"');
    }

    const text = await response.text();
    let result;
    try { result = JSON.parse(text); } catch (e) {
      console.error('[SGPO] Resposta nao-JSON recebida do GAS:', text.substring(0, 300));
      throw new Error('Resposta invalida do servidor (HTML em vez de JSON). Verifique o deploy do GAS Web App.');
    }

    if (result.error) throw new Error(result.error);

    if (result.status === 'SGPO API Online' && !result.success && !_retrying) {
      console.warn('[SGPO] GAS retornou doGet em vez de doPost (redirect). Retry em 1s...');
      await new Promise(r => setTimeout(r, 1000));
      return this._gasFetch(payload, true, _echoUrl);
    }

    if (result.status === 'SGPO API Online' && !result.success && _retrying) {
      console.error('[SGPO] GAS Web App em modo redirect. Payload:', payload.action);
      throw new Error('GAS Web App retornou status em vez de dados. Redeploy o Web App: Apps Script > Implantar > Nova implantacao > "Executar como: Eu" > "Quem pode acessar: Qualquer pessoa"');
    }

    return result;
  },

  async get(sheetName, filters = {}) {
    if (sheetName === 'viaturas') return this.getViaturas();
    if (sheetName === 'militares') return this.getMilitares();
    if (sheetName === 'naturezas') return this.getNaturezas();
    try {
      return await this.request('read', { sheet: sheetName, filters });
    } catch (e) {
      console.warn(`[SGPO] Falha ao buscar planilha "${sheetName}" online, verificando fallback:`, e.message);
      if (typeof DemoData !== 'undefined') {
        const demoState = DemoData.getState();
        const map = {
          'usuarios': demoState.usuarios,
          'oficiais': demoState.oficiais,
          'atividades_padrao': demoState.atividadesPadrao,
          'sons': demoState.sons,
          'logos': demoState.logos,
          'permissoes_tela': demoState.permissoesTela,
          'postos': demoState.postosServico,
          'postos_servico': demoState.postosServico,
          'configuracoes': demoState.config ? [demoState.config] : []
        };
        if (map[sheetName]) return map[sheetName];
      }
      return [];
    }
  },
  async create(sheetName, row) {
    try {
      const r = await this.request('create', { sheet: sheetName, row });
      if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
      return r;
    } catch (e) {
      console.warn(`[SGPO] Falha ao criar em "${sheetName}" online, aplicando localmente:`, e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('create', { sheet: sheetName, row });
        if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
        return r;
      }
      throw e;
    }
  },
  async update(sheetName, id, row) {
    try {
      const r = await this.request('update', { sheet: sheetName, id, row });
      if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
      return r;
    } catch (e) {
      console.warn(`[SGPO] Falha ao atualizar em "${sheetName}" online, aplicando localmente:`, e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('update', { sheet: sheetName, id, row });
        if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
        return r;
      }
      throw e;
    }
  },
  async delete(sheetName, id) {
    try {
      const r = await this.request('delete', { sheet: sheetName, id });
      if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
      return r;
    } catch (e) {
      console.warn(`[SGPO] Falha ao excluir em "${sheetName}" online, aplicando localmente:`, e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('delete', { sheet: sheetName, id });
        if (sheetName === 'viaturas') localStorage.removeItem('sgpo_cached_viaturas');
        return r;
      }
      throw e;
    }
  },
  async login(usuario, senha) {
    try {
      return await this.request('login', { usuario, senha });
    } catch (e) {
      console.warn('[SGPO] Login online falhou (' + e.message + '), tentando autenticação local/demo...');
      if (typeof DemoData !== 'undefined') {
        const localResult = DemoData.handle('login', { usuario, senha });
        if (localResult && localResult.success) {
          this.enableDemo();
          return localResult;
        }
      }
      throw e;
    }
  },
  
  async getServicoAtual(usuarioId, forceNetwork = false) {
    const activeServicoId = localStorage.getItem('sgpo_active_servico_id');

    // 1. Instant Cache-First Return
    if (!forceNetwork) {
      let cached = null;
      try {
        const raw = localStorage.getItem('sgpo_cached_servico');
        if (raw) cached = JSON.parse(raw);
      } catch (e) {}

      // Auto-encerramento se o serviço cacheado for de data anterior ao dia atual
      const hojeStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      if (cached && cached.servico && cached.servico.data && cached.servico.data < hojeStr) {
        localStorage.removeItem('sgpo_cached_servico');
        localStorage.removeItem('sgpo_active_servico_id');
        localStorage.removeItem('sgpo_cached_postos_com_servico');
        cached = null;
      }

      if (cached && cached.servico && (!activeServicoId || cached.servico.id === activeServicoId)) {
        const clone = JSON.parse(JSON.stringify(cached));
        const sId = clone.servico?.id || activeServicoId;
        clone.rotina = TimelineStore.mergeInto(clone.rotina, sId);

        // Normalização: viaturas na base que não estão em nenhuma ocorrência ativa devem estar como 'ativa' (Disponível)
        if (clone.servicoViaturas && Array.isArray(clone.servicoViaturas)) {
          const ocsAtivas = (clone.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
          const vidsEmOcorr = new Set();
          ocsAtivas.forEach(oc => (oc.viaturaIds || []).forEach(vid => vidsEmOcorr.add(String(vid))));

          clone.servicoViaturas.forEach(sv => {
            if (sv && sv.status === 'retornando' && !vidsEmOcorr.has(String(sv.viaturaId))) {
              sv.status = 'ativa';
            }
          });
        }

        if (typeof SyncQueue !== 'undefined' && SyncQueue.queue.length > 0) {
          for (const payload of SyncQueue.queue) {
            API_Local.applyToState(clone, payload.action, payload);
          }
          clone.rotina = TimelineStore.mergeInto(clone.rotina, sId);
        }
        if (typeof Sync !== 'undefined') Sync._lastData = clone;

        // Background silent revalidation if older than 4 seconds
        const now = Date.now();
        if (!this._lastServicoFetchTime || (now - this._lastServicoFetchTime > 4000)) {
          this._revalidateServicoAtual(usuarioId, activeServicoId);
        }

        return clone;
      }
    }

    // 2. Network Fetch
    return this._fetchServicoAtualNetwork(usuarioId, activeServicoId);
  },

  async _fetchServicoAtualNetwork(usuarioId, servicoId) {
    this._lastServicoFetchTime = Date.now();
    try {
      const response = await this.request('getServicoAtual', {
        ...(usuarioId ? { usuarioId } : {}),
        ...(servicoId ? { servicoId } : {})
      }, { silent: true });

      if (response && response.servico) {
        const sId = response.servico.id;
        response.rotina = TimelineStore.mergeInto(response.rotina, sId);

        // Normalização: viaturas na base que não estão em nenhuma ocorrência ativa devem estar como 'ativa' (Disponível)
        if (response.servicoViaturas && Array.isArray(response.servicoViaturas)) {
          const ocsAtivas = (response.ocorrencias || []).filter(o => o.status !== 'finalizada' && o.status !== 'cancelada');
          const vidsEmOcorr = new Set();
          ocsAtivas.forEach(oc => (oc.viaturaIds || []).forEach(vid => vidsEmOcorr.add(String(vid))));

          response.servicoViaturas.forEach(sv => {
            if (sv && sv.status === 'retornando' && !vidsEmOcorr.has(String(sv.viaturaId))) {
              sv.status = 'ativa';
            }
          });
        }

        try {
          localStorage.setItem('sgpo_cached_servico', JSON.stringify(response));
          localStorage.setItem('sgpo_active_servico_id', response.servico.id);
        } catch (e) {}

        if (typeof SyncQueue !== 'undefined' && SyncQueue.queue.length > 0) {
          const clone = JSON.parse(JSON.stringify(response));
          for (const payload of SyncQueue.queue) {
            API_Local.applyToState(clone, payload.action, payload);
          }
          clone.rotina = TimelineStore.mergeInto(clone.rotina, sId);
          if (typeof Sync !== 'undefined') Sync._lastData = clone;
          return clone;
        }

        if (typeof Sync !== 'undefined') Sync._lastData = response;
      }
      return response;
    } catch (err) {
      const raw = localStorage.getItem('sgpo_cached_servico');
      if (raw) {
        try {
          const cached = JSON.parse(raw);
          const sId = cached.servico?.id || servicoId;
          cached.rotina = TimelineStore.mergeInto(cached.rotina, sId);
          if (typeof SyncQueue !== 'undefined' && SyncQueue.queue.length > 0) {
            for (const payload of SyncQueue.queue) {
              API_Local.applyToState(cached, payload.action, payload);
            }
            cached.rotina = TimelineStore.mergeInto(cached.rotina, sId);
          }
          if (typeof Sync !== 'undefined') Sync._lastData = cached;
          return cached;
        } catch(e) {}
      }
      if (typeof DemoData !== 'undefined') {
        const demoState = DemoData.getState();
        if (demoState && demoState.servico) {
          const sId = demoState.servico.id;
          demoState.rotina = TimelineStore.mergeInto(demoState.rotina, sId);
          return {
            servico: demoState.servico,
            rotina: demoState.rotina || [],
            militares: demoState.militares || [],
            servicoViaturas: demoState.servicoViaturas || [],
            ocorrencias: demoState.ocorrencias || [],
            oficiais: demoState.oficiais || [],
            oficiaisPresentes: demoState.oficiaisPresentes || [],
            oficiaisTodos: demoState.oficiais || [],
            telegrafia: demoState.telegrafia,
            extras: demoState.extras || [],
            notificacoes: demoState.notificacoes || []
          };
        }
      }
      return { servico: null, rotina: [], militares: [], servicoViaturas: [], ocorrencias: [] };
    }
  },

  _revalidateServicoAtual(usuarioId, servicoId) {
    this._fetchServicoAtualNetwork(usuarioId, servicoId).then(fresh => {
      if (fresh && fresh.servico && fresh.rotina) {
        const sId = fresh.servico.id || servicoId;
        fresh.rotina = TimelineStore.mergeInto(fresh.rotina, sId);
      }
      if (fresh && typeof Sync !== 'undefined' && typeof Sync._processData === 'function') {
        Sync._processData(fresh);
        if (typeof Sync.broadcast === 'function') {
          Sync.broadcast(fresh);
        }
      }
    }).catch(() => {});
  },

  async iniciarServico(dados) {
    try {
      const r = await this.request('iniciarServico', dados);
      if (r.success) {
        localStorage.removeItem('sgpo_cached_postos_com_servico');
        localStorage.removeItem('sgpo_cached_servico');
        if (r.servicoId) localStorage.setItem('sgpo_active_servico_id', r.servicoId);
        this._triggerSync();
      }
      return r;
    } catch (e) {
      console.warn('[SGPO] Iniciar serviço online falhou, aplicando localmente:', e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('iniciarServico', dados);
        if (r.success) {
          localStorage.removeItem('sgpo_cached_postos_com_servico');
          localStorage.removeItem('sgpo_cached_servico');
          if (r.servicoId) localStorage.setItem('sgpo_active_servico_id', r.servicoId);
          this._triggerSync();
        }
        return r;
      }
      throw e;
    }
  },
  async encerrarServico(servicoIdOrPostoId) {
    const payload = {
      servicoId: servicoIdOrPostoId,
      postoId: servicoIdOrPostoId
    };
    try {
      const r = await this.request('encerrarServico', payload);
      if (r.success) {
        localStorage.removeItem('sgpo_cached_postos_com_servico');
        localStorage.removeItem('sgpo_cached_servico');
        localStorage.removeItem('sgpo_active_servico_id');
        this._triggerSync();
      }
      return r;
    } catch (e) {
      console.warn('[SGPO] Encerrar serviço online falhou, aplicando localmente:', e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('encerrarServico', payload);
        if (r.success) {
          localStorage.removeItem('sgpo_cached_postos_com_servico');
          localStorage.removeItem('sgpo_cached_servico');
          localStorage.removeItem('sgpo_active_servico_id');
          this._triggerSync();
        }
        return r;
      }
      throw e;
    }
  },
  async getRotinaPersonalizada(postoId) { return this.request('getRotinaPersonalizada', { postoId }); },
  async salvarRotinaPersonalizada(postoId, postoNome, itens) { const r = await this.request('salvarRotinaPersonalizada', { postoId, postoNome, itens }); if (r.success) this._triggerSync(); return r; },
  async resetarRotinaPersonalizada(postoId) { const r = await this.request('resetarRotinaPersonalizada', { postoId }); if (r.success) this._triggerSync(); return r; },
  async getRotinaParaServico(postoId) { return this.request('getRotinaParaServico', { postoId }); },
  async getRotina(servicoId) { return this.request('getRotina', { servicoId }); },
  async updateAtividade(servicoId, atividadeId, dados) { const r = await this.request('updateAtividade', { servicoId, atividadeId, ...dados }); if (r.success) this._triggerSync(); return r; },
  async criarAtividadeExtra(servicoId, dados) { const r = await this.request('criarAtividadeExtra', { servicoId, ...dados }); if (r.success) this._triggerSync(); return r; },
  async adicionarAtividadeFixa(servicoId, atividadeFixaId, overrides = {}) { const r = await this.request('adicionarAtividadeFixa', { servicoId, atividadeFixaId, ...overrides }); if (r.success) this._triggerSync(); return r; },
  async editarAtividadeRotina(servicoId, atividadeId, dados) { const r = await this.request('editarAtividadeRotina', { servicoId, atividadeId, ...dados }); if (r.success) this._triggerSync(); return r; },
  async excluirAtividadeRotina(servicoId, atividadeId) { const r = await this.request('excluirAtividadeRotina', { servicoId, atividadeId }); if (r.success) this._triggerSync(); return r; },
  async registrarTelegrafia(servicoId, militarId) { const r = await this.request('registrarTelegrafia', { servicoId, militarId }); if (r.success) this._triggerSync(); return r; },
  async registrarEntradaOficial(oficialId, anunciado, nome) { const r = await this.request('registrarEntradaOficial', { oficialId, anunciado, nome }); if (r.success) this._triggerSync(); return r; },
  async registrarSaidaOficial(oficialId) { const r = await this.request('registrarSaidaOficial', { oficialId }); if (r.success) this._triggerSync(); return r; },
  async getNotificacoes(servicoId) { return this.request('getNotificacoes', { servicoId }); },
  async marcarLida(notificacaoId) { const r = await this.request('marcarLida', { notificacaoId }); if (r.success) this._triggerSync(); return r; },
  async getHistorico(data) { return this.request('getHistorico', { data }); },
  async getRelatorio(tipo, params) { return this.request('getRelatorio', { tipo, ...params }); },
  async adicionarEquipe(servicoId, integrante) { const r = await this.request('adicionarEquipe', { servicoId, integrante }); if (r.success) this._triggerSync(); return r; },
  async removerEquipe(servicoId, integranteId) { const r = await this.request('removerEquipe', { servicoId, integranteId }); if (r.success) this._triggerSync(); return r; },
  async testConnection() {
    const start = performance.now();
    try {
      const result = await this.request('ping');
      const latency = Math.round(performance.now() - start);
      return { success: true, latency, version: result.version || '??', sheets: result.sheets || 0, user: Auth.user };
    } catch (e) {
      const latency = Math.round(performance.now() - start);
      return { success: false, latency, error: e.message || 'Falha na conexão' };
    }
  },
  async getUsuariosAtivos() { return this.request('getUsuariosAtivos'); },
  async registrarHeartbeat() { return this.request('registrarHeartbeat', { userId: Auth.userId, nome: Auth.userName, perfil: Auth.userRole }, { silent: true }); },
  async solicitarAcesso(servicoId, tipo, motivo) { return this.request('solicitarAcesso', { servicoId, usuarioId: Auth.userId, usuarioNome: Auth.userName, tipo, motivo }); },
  async responderAcesso(permissaoId, aprovado, servicoId) { return this.request('responderAcesso', { permissaoId, aprovado, aprovadoPor: Auth.userName, servicoId, usuarioId: Auth.userId }); },
  async checkAcessoServico(servicoId) { return this.request('checkAcessoServico', { servicoId, usuarioId: Auth.userId, nivelPermissao: Auth.nivelPermissao, postos: Auth.postos }); },
  async getPermissoesServico(servicoId) { return this.request('getPermissoesServico', { servicoId }); },
  async getPostosServico() {
    let cached = null;
    try {
      const raw = localStorage.getItem('sgpo_cached_postos');
      if (raw) cached = JSON.parse(raw);
    } catch(e) {}

    if (cached && Array.isArray(cached) && cached.length > 0) {
      const now = Date.now();
      if (!this._lastPostosFetchTime || (now - this._lastPostosFetchTime > 60000)) {
        this._lastPostosFetchTime = now;
        this.request('getPostosServico', {}, { silent: true }).then(fresh => {
          if (Array.isArray(fresh) && fresh.length > 0) {
            try { localStorage.setItem('sgpo_cached_postos', JSON.stringify(fresh)); } catch(e) {}
          }
        }).catch(() => {});
      }
      return cached;
    }

    try {
      const fresh = await this.request('getPostosServico', {}, { silent: true });
      if (Array.isArray(fresh) && fresh.length > 0) {
        try { localStorage.setItem('sgpo_cached_postos', JSON.stringify(fresh)); } catch(e) {}
        return fresh;
      }
    } catch (e) {
      console.warn('[SGPO] getPostosServico rede indisponível, usando fallback:', e.message);
    }
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    const demoP = (typeof DemoData !== 'undefined' ? DemoData.getState().postosServico : []) || [];
    try { localStorage.setItem('sgpo_cached_postos', JSON.stringify(demoP)); } catch(e) {}
    return demoP;
  },
  async getUsuariosPostos(filtros) { return this.request('getUsuariosPostos', filtros || {}); },
  async vincularUsuarioPosto(usuarioId, postoId, papel) { return this.request('vincularUsuarioPosto', { usuarioId, postoId, papel }); },
  async desvincularUsuarioPosto(usuarioId, postoId) { return this.request('desvincularUsuarioPosto', { usuarioId, postoId }); },
  async getUsuariosEditaveis(editorId) { return this.request('getUsuariosEditaveis', { editorId }); },
  async getServicoPorPosto(postoId) { return this.request('getServicoPorPosto', { postoId }); },
  async getServicosAtivos() { return this.request('getServicosAtivos', { usuarioId: Auth.userId }); },
  async getServicoViaturas(servicoId) { return this.request('getServicoViaturas', { servicoId }); },
  async iniciarServicoViatura(dados) {
    try {
      const r = await this.request('iniciarServicoViatura', dados);
      if (r.success) this._triggerSync();
      return r;
    } catch (e) {
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('iniciarServicoViatura', dados);
        if (r.success) this._triggerSync();
        return r;
      }
      throw e;
    }
  },
  async editarServicoViatura(dados) {
    const payload = typeof dados === 'object' ? {
      ...dados,
      id: dados.id || dados.servicoViaturaId,
      servicoViaturaId: dados.servicoViaturaId || dados.id
    } : { id: dados, servicoViaturaId: dados };
    try {
      const r = await this.request('editarServicoViatura', payload);
      if (r.success) this._triggerSync();
      return r;
    } catch (e) {
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('editarServicoViatura', payload);
        if (r.success) this._triggerSync();
        return r;
      }
      throw e;
    }
  },
  async encerrarServicoViatura(servicoId, servicoViaturaId) {
    try {
      const r = await this.request('encerrarServicoViatura', { servicoId, servicoViaturaId });
      if (r.success) this._triggerSync();
      return r;
    } catch (e) {
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('encerrarServicoViatura', { servicoId, servicoViaturaId });
        if (r.success) this._triggerSync();
        return r;
      }
      throw e;
    }
  },
  async despacharViatura(servicoViaturaId, ocorrenciaNumero, ocorrenciaTitulo) {
    const id = typeof servicoViaturaId === 'object' ? (servicoViaturaId.servicoViaturaId || servicoViaturaId.id) : servicoViaturaId;
    const r = await this.request('despacharViatura', { servicoViaturaId: id, id, ocorrenciaNumero, ocorrenciaTitulo });
    if (r.success) this._triggerSync();
    return r;
  },
  async retornarViatura(servicoViaturaId) {
    const id = typeof servicoViaturaId === 'object' ? (servicoViaturaId.servicoViaturaId || servicoViaturaId.id) : servicoViaturaId;
    const extra = typeof servicoViaturaId === 'object' ? servicoViaturaId : {};
    const destinoStatus = extra.destinoStatus || extra.status || 'ativa';
    const agoraRet = extra.horarioRetorno || (typeof Utils !== 'undefined' ? Utils.formatDateTime(new Date()) : new Date().toISOString());
    const r = await this.request('retornarViatura', {
      destinoStatus,
      status: destinoStatus,
      horarioRetorno: agoraRet,
      ...extra,
      servicoViaturaId: id,
      id
    });
    if (r.success) this._triggerSync();
    return r;
  },
  async criarOcorrencia(dados) { const r = await this.request('criarOcorrencia', dados); if (r.success) this._triggerSync(); return r; },
  async editarOcorrencia(dados) {
    const payload = typeof dados === 'string' ? { id: dados, ocorrenciaId: dados } : {
      ...dados,
      id: dados?.id || dados?.ocorrenciaId,
      ocorrenciaId: dados?.ocorrenciaId || dados?.id
    };
    const r = await this.request('editarOcorrencia', payload);
    if (r.success) this._triggerSync();
    return r;
  },
  async finalizarOcorrencia(dados) {
    const agoraFinal = typeof Utils !== 'undefined' ? Utils.formatDateTime(new Date()) : new Date().toISOString();
    const payload = typeof dados === 'string' ? { id: dados, ocorrenciaId: dados, destinoStatus: 'ativa', horaRetorno: agoraFinal } : {
      destinoStatus: 'ativa',
      horaRetorno: dados?.horaRetorno || agoraFinal,
      ...dados,
      id: dados?.id || dados?.ocorrenciaId,
      ocorrenciaId: dados?.ocorrenciaId || dados?.id
    };
    const r = await this.request('finalizarOcorrencia', payload);
    if (r.success) this._triggerSync();
    return r;
  },
  async empenharReforcoOcorrencia(dados) { const r = await this.request('empenharReforcoOcorrencia', dados || {}); if (r.success) this._triggerSync(); return r; },
  async editarServico(dados) {
    try {
      const r = await this.request('editarServico', dados);
      if (r.success) {
        localStorage.removeItem('sgpo_cached_postos_com_servico');
        this._triggerSync();
      }
      return r;
    } catch (e) {
      console.warn('[SGPO] Editar serviço online falhou, aplicando localmente:', e.message);
      if (typeof DemoData !== 'undefined') {
        const r = DemoData.handle('editarServico', dados);
        if (r.success) {
          localStorage.removeItem('sgpo_cached_postos_com_servico');
          this._triggerSync();
        }
        return r;
      }
      throw e;
    }
  },
  async redefinirSenha(usuarioId) { const r = await this.request('redefinirSenha', { usuarioId }); if (r.success) this._triggerSync(); return r; },
  async alterarMinhaSenha(usuarioId, novaSenha) { const r = await this.request('alterarMinhaSenha', { usuarioId, novaSenha }); if (r.success) this._triggerSync(); return r; },
  async criarCivis(dados) { const r = await this.request('criarCivis', dados); if (r.success) this._triggerSync(); return r; },
  async getPostosComServico(forceNetwork = false) {
    if (!forceNetwork) {
      let cached = null;
      try {
        const raw = localStorage.getItem('sgpo_cached_postos_com_servico');
        if (raw) cached = JSON.parse(raw);
      } catch(e) {}
      if (cached && Array.isArray(cached.postos) && cached.postos.length > 0) {
        const now = Date.now();
        if (!this._lastPostosComServicoFetchTime || (now - this._lastPostosComServicoFetchTime > 15000)) {
          this._lastPostosComServicoFetchTime = now;
          this.request('getPostosComServico', {}, { silent: true }).then(fresh => {
            if (fresh && Array.isArray(fresh.postos) && fresh.postos.length > 0) {
              try { localStorage.setItem('sgpo_cached_postos_com_servico', JSON.stringify(fresh)); } catch(e) {}
            }
          }).catch(() => {});
        }
        return cached;
      }
    }
    try {
      const r = await this.request('getPostosComServico', {}, { silent: true });
      if (r && Array.isArray(r.postos) && r.postos.length > 0) {
        try { localStorage.setItem('sgpo_cached_postos_com_servico', JSON.stringify(r)); } catch(e) {}
        return r;
      }
    } catch (e) {
      console.warn('[SGPO] getPostosComServico rede indisponível, usando dados locais/demo:', e.message);
    }
    try {
      const raw = localStorage.getItem('sgpo_cached_postos_com_servico');
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached && Array.isArray(cached.postos) && cached.postos.length > 0) return cached;
      }
    } catch(e) {}
    if (typeof DemoData !== 'undefined') {
      const demoResult = DemoData.handle('getPostosComServico', {});
      if (demoResult && Array.isArray(demoResult.postos)) {
        try { localStorage.setItem('sgpo_cached_postos_com_servico', JSON.stringify(demoResult)); } catch(e) {}
        return demoResult;
      }
    }
    return { postos: [] };
  },
  async getTiposViatura() {
    let cached = null;
    try {
      const raw = localStorage.getItem('sgpo_cached_tipos_viatura');
      if (raw) cached = JSON.parse(raw);
    } catch(e) {}
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this._tiposCache = cached;
      this.request('getTiposViatura', {}, { silent: true }).then(fresh => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          this._tiposCache = fresh;
          try { localStorage.setItem('sgpo_cached_tipos_viatura', JSON.stringify(fresh)); } catch(e) {}
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const r = await this.request('getTiposViatura', {}, { silent: true });
      if (Array.isArray(r) && r.length > 0) {
        this._tiposCache = r;
        try { localStorage.setItem('sgpo_cached_tipos_viatura', JSON.stringify(this._tiposCache)); } catch(e) {}
        return r;
      }
    } catch (e) {
      console.warn('[SGPO] getTiposViatura rede indisponível, usando fallback:', e.message);
    }
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this._tiposCache = cached;
      return cached;
    }
    const demoTipos = (typeof DemoData !== 'undefined' ? DemoData.getState().tiposViatura : []) || [];
    this._tiposCache = demoTipos;
    try { localStorage.setItem('sgpo_cached_tipos_viatura', JSON.stringify(demoTipos)); } catch(e) {}
    return demoTipos;
  },
  async getViaturas() {
    let cached = null;
    try {
      const raw = localStorage.getItem('sgpo_cached_viaturas');
      if (raw) cached = JSON.parse(raw);
    } catch(e) {}
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this.request('getViaturas', {}, { silent: true }).then(fresh => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          try { localStorage.setItem('sgpo_cached_viaturas', JSON.stringify(fresh)); } catch(e) {}
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const fresh = await this.request('getViaturas', {}, { silent: true });
      if (Array.isArray(fresh) && fresh.length > 0) {
        try { localStorage.setItem('sgpo_cached_viaturas', JSON.stringify(fresh)); } catch(e) {}
        return fresh;
      }
    } catch (e) {
      console.warn('[SGPO] getViaturas rede indisponível, usando fallback:', e.message);
    }
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    const demoV = (typeof DemoData !== 'undefined' ? DemoData.getState().viaturas : []) || [];
    try { localStorage.setItem('sgpo_cached_viaturas', JSON.stringify(demoV)); } catch(e) {}
    return demoV;
  },
  async getMilitares() {
    let cached = null;
    try {
      const raw = localStorage.getItem('sgpo_cached_militares');
      if (raw) cached = JSON.parse(raw);
    } catch(e) {}
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this.request('read', { sheet: 'militares' }, { silent: true }).then(fresh => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          try { localStorage.setItem('sgpo_cached_militares', JSON.stringify(fresh)); } catch(e) {}
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const fresh = await this.request('read', { sheet: 'militares' }, { silent: true });
      if (Array.isArray(fresh) && fresh.length > 0) {
        try { localStorage.setItem('sgpo_cached_militares', JSON.stringify(fresh)); } catch(e) {}
        return fresh;
      }
    } catch (e) {
      console.warn('[SGPO] getMilitares rede indisponível, usando fallback:', e.message);
    }
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    const demoM = (typeof DemoData !== 'undefined' ? DemoData.getState().militares : []) || [];
    try { localStorage.setItem('sgpo_cached_militares', JSON.stringify(demoM)); } catch(e) {}
    return demoM;
  },
  async getNaturezas() {
    let cached = null;
    try {
      const raw = localStorage.getItem('sgpo_cached_naturezas');
      if (raw) cached = JSON.parse(raw);
    } catch(e) {}
    if (cached && Array.isArray(cached) && cached.length > 0) {
      this.request('getNaturezas', {}, { silent: true }).then(fresh => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          try { localStorage.setItem('sgpo_cached_naturezas', JSON.stringify(fresh)); } catch(e) {}
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const r = await this.request('getNaturezas', {}, { silent: true });
      if (Array.isArray(r) && r.length > 0) {
        try { localStorage.setItem('sgpo_cached_naturezas', JSON.stringify(r)); } catch(e) {}
        return r;
      }
    } catch (e) {
      console.warn('[SGPO] getNaturezas rede indisponível, usando fallback:', e.message);
    }
    if (cached && Array.isArray(cached) && cached.length > 0) return cached;
    const demoN = (typeof DemoData !== 'undefined' ? DemoData.getState().naturezas : []) || [];
    try { localStorage.setItem('sgpo_cached_naturezas', JSON.stringify(demoN)); } catch(e) {}
    return demoN;
  },
  async importarAtividadesPadrao(atividades) { return this.request('importarAtividadesPadrao', { atividades }); },
  getTipoCor(sigla) { const t = this._tiposCache.find(x => x.sigla === sigla); return t ? t.cor : '#9e9e9e'; },
  getTipoNome(sigla) { const t = this._tiposCache.find(x => x.sigla === sigla); return t ? t.nome : sigla; },
  async registrarLog(acao, detalhes, modulo) { return this.request('registrarLog', { acao, detalhes, modulo }); },
  async diagnosticar() { return this.request('diagnosticar', {}); },
  async repararAbas() { return this.request('repararAbas', {}); }
};

window.SGPOdiagnosticar = async function() {
  console.log('[SGPO] Iniciando diagnóstico...');
  try {
    const result = await API.diagnosticar();
    console.log('[SGPO] Resultado do diagnóstico:', JSON.stringify(result, null, 2));
    return result;
  } catch (e) {
    console.error('[SGPO] Erro no diagnóstico:', e.message);
    return { error: e.message };
  }
};

const DemoData = {
  _state: null,
  _version: 6,

  _now() {
    return (typeof Utils !== 'undefined' && Utils.formatDateTime) ? Utils.formatDateTime(new Date()) : (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; })();
  },

  getState() {
    if (this._state) return this._state;
    const saved = localStorage.getItem('sgpo_demo_state');
    const savedVer = parseInt(localStorage.getItem('sgpo_demo_version') || '0');
    if (saved && savedVer >= this._version) {
      try { this._state = JSON.parse(saved); return this._state; } catch(e) {}
    }
    this._state = this.freshState();
    localStorage.setItem('sgpo_demo_version', this._version);
    this.save();
    return this._state;
  },

  save() { localStorage.setItem('sgpo_demo_state', JSON.stringify(this._state)); },

  freshState() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    return {
      servico: null,
      servicos: [],
      militares: [
        { id: 'm-001', nome: 'Ten Cel Silva', posto: '1º Tenente', reCpf: '4444444' },
        { id: 'm-002', nome: 'Sgt Oliveira', posto: 'Sargento', reCpf: '5555555' },
        { id: 'm-003', nome: 'Cb Santos', posto: 'Cabo', reCpf: '6666666' },
        { id: 'm-004', nome: 'Sd Ferreira', posto: 'Soldado', reCpf: '7777777' },
        { id: 'm-005', nome: '2º Ten Costa', posto: '2º Tenente', reCpf: '8888888' },
        { id: 'm-006', nome: '1º Sgt Lima', posto: '1º Sargento', reCpf: '9999999' },
        { id: 'm-007', nome: 'Cb Souza', posto: 'Cabo', reCpf: '1010101' },
        { id: 'm-008', nome: 'Sd Pereira', posto: 'Soldado', reCpf: '1212121' },
      ],
      oficiais: [
        { id: 'o-001', nome: 'Cel Rodrigues', posto: 'Coronel', antiguidade: 1, unidade: '1º CB' },
        { id: 'o-002', nome: 'Maj Almeida', posto: 'Major', antiguidade: 2, unidade: '1º CB' },
        { id: 'o-003', nome: 'Cap Ferreira', posto: 'Capitão', antiguidade: 3, unidade: '2º CB' },
        { id: 'o-004', nome: '1º Ten Santos', posto: '1º Tenente', antiguidade: 4, unidade: '1º CB' },
      ],
      oficiaisPresentes: [],
      oficiaisHistorico: [],
      rotina: [
        { id: 'r-001', horario: '07:30', nome: 'Revista Matinal', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'concluida', concluidoPor: 'Cmt Prontidão', horaConclusao: '07:32' },
        { id: 'r-002', horario: '07:45', nome: 'Ordem do Dia', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'em_andamento' },
        { id: 'r-003', horario: '08:30', nome: 'Nós do Dia', programa: 'Instrução', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-004', horario: '08:35', nome: 'Conferência das instalações', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-005', horario: '08:45', nome: 'Conferência de viaturas, equipamentos e materiais', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-006', horario: '09:00', nome: 'Registro do mapa força operacional', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-007', horario: '08:30', nome: 'Check-up de viaturas', programa: 'Passagem de serviço', responsavel: 'Cmt USv', status: 'nao_iniciada' },
        { id: 'r-008', horario: '09:00', nome: 'Armar Geral', programa: 'Instrução', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-009', horario: '09:40', nome: 'Lanche (se possível)', programa: 'Refeição', responsavel: 'Aux Rancho', status: 'nao_iniciada' },
        { id: 'r-010', horario: '10:30', nome: 'Condicionamento físico individual', programa: 'Treinamento físico', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-011', horario: '11:30', nome: 'Atividade recreativa', programa: 'Treinamento físico', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-012', horario: '12:00', nome: 'Almoço', programa: 'Refeição', responsavel: 'Refeição', status: 'nao_iniciada' },
        { id: 'r-013', horario: '14:00', nome: 'Instrução Regular Coletiva', programa: 'Instrução', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-014', horario: '15:30', nome: 'Lanche (se possível)', programa: 'Refeição', responsavel: 'Aux Rancho', status: 'nao_iniciada' },
        { id: 'r-015', horario: '15:50', nome: 'Hora da estação', programa: 'Manutenção do quartel', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-016', horario: '17:30', nome: 'Atividade recreativa', programa: 'Treinamento físico', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-017', horario: '19:00', nome: 'Jantar', programa: 'Refeição', responsavel: 'Aux Rancho', status: 'nao_iniciada' },
        { id: 'r-018', horario: '20:30', nome: 'Revista noturna', programa: 'Aquartelamento', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-019', horario: '20:40', nome: 'Aquecimento de viaturas', programa: 'Manutenção preventiva', responsavel: 'Chefe dos Motoristas', status: 'nao_iniciada' },
        { id: 'r-020', horario: '22:00', nome: 'Silêncio', programa: 'Aquartelamento', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-021', horario: '06:00', nome: 'Alvorada', programa: 'Aquartelamento', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
        { id: 'r-022', horario: '06:20', nome: 'Faxina Geral', programa: 'Manutenção do quartel', responsavel: 'Cb Dia', status: 'nao_iniciada' },
        { id: 'r-023', horario: '07:00', nome: 'Café da Manhã', programa: 'Refeição', responsavel: 'Aux Rancho', status: 'nao_iniciada' },
        { id: 'r-024', horario: '07:30', nome: 'Revista Matinal (encerramento)', programa: 'Passagem de serviço', responsavel: 'Cmt Prontidão', status: 'nao_iniciada' },
      ],
      telegrafia: null,
      telegrafiaHistorico: [],
      telegrafiaVazioDesde: null,
      extras: [],
      tiposViatura: [
        { id: 'tv-001', tipo: 'ABT', descricao: 'Auto Bomba Tanque', capacidade: 6 },
        { id: 'tv-002', tipo: 'URG', descricao: 'Unidade de Resgate', capacidade: 3 },
        { id: 'tv-003', tipo: 'CV', descricao: 'Caminhão de Vistoria', capacidade: 2 },
        { id: 'tv-004', tipo: 'APA', descricao: 'Auto Plataforma Aérea', capacidade: 4 },
        { id: 'tv-005', tipo: 'SOC', descricao: 'Socorro', capacidade: 8 }
      ],
      naturezas: [
        { id: 'nat-001', nome: 'Incêndio', valor: 'Incêndio' },
        { id: 'nat-002', nome: 'Salvamento', valor: 'Salvamento' },
        { id: 'nat-003', nome: 'Resgate', valor: 'Resgate' },
        { id: 'nat-004', nome: 'Socorro (SOC)', valor: 'SOC' },
        { id: 'nat-005', nome: 'Autotanque (ABT)', valor: 'ABT' },
        { id: 'nat-006', nome: 'Desabamento', valor: 'Desabamento' },
        { id: 'nat-007', nome: 'Inundação', valor: 'Inundação' },
        { id: 'nat-008', nome: 'Busca e Salvamento', valor: 'Busca e Salvamento' },
        { id: 'nat-009', nome: 'APH', valor: 'Atendimento Pré-Hospitalar' },
        { id: 'nat-010', nome: 'Operação Especial', valor: 'Operação Especial' },
        { id: 'nat-011', nome: 'Outros', valor: 'Outros' }
      ],
      sons: [
        { name: 'aviso', file: 'aviso.mp3', enabled: true, volume: 0.7 },
        { name: 'nova-ocorrencia', file: 'nova-ocorrencia.mp3', enabled: true, volume: 0.7 },
        { name: 'oficial-quartel', file: 'oficial-quartel.mp3', enabled: true, volume: 0.7 },
        { name: 'telegrafia', file: 'telegrafia.mp3', enabled: true, volume: 0.7 },
        { name: 'nova-atividade', file: 'nova-atividade.mp3', enabled: true, volume: 0.7 }
      ],
      logos: [],
      atividadesPadrao: [
        { id: 'ap-001', ordem: 1, horario: '07:30', nome: 'Revista Matinal', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
        { id: 'ap-002', ordem: 2, horario: '07:45', nome: 'Ordem do Dia', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 45, obrigatoria: true, postoId: '' },
        { id: 'ap-003', ordem: 3, horario: '08:30', nome: 'Nós do Dia', programa: 'Instrução', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 5, obrigatoria: true, postoId: '' },
        { id: 'ap-004', ordem: 4, horario: '08:35', nome: 'Conferência das instalações', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
        { id: 'ap-005', ordem: 5, horario: '08:45', nome: 'Conferência de viaturas, equipamentos e materiais', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 15, obrigatoria: true, postoId: '' },
        { id: 'ap-006', ordem: 6, horario: '09:00', nome: 'Registro do mapa força operacional', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
        { id: 'ap-007', ordem: 7, horario: '08:30', nome: 'Check-up de viaturas', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt USv', duracaoMinutos: 30, obrigatoria: true, postoId: '' },
        { id: 'ap-008', ordem: 8, horario: '09:00', nome: 'Armar Geral', programa: 'Instrução', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 40, obrigatoria: true, postoId: '' },
        { id: 'ap-009', ordem: 9, horario: '09:40', nome: 'Lanche (se possível)', programa: 'Refeição', responsavel_padrao: 'Aux Rancho', duracaoMinutos: 20, obrigatoria: false, postoId: '' },
        { id: 'ap-010', ordem: 10, horario: '10:30', nome: 'Condicionamento físico individual', programa: 'Treinamento físico', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 60, obrigatoria: false, postoId: '' },
        { id: 'ap-011', ordem: 11, horario: '11:30', nome: 'Atividade recreativa', programa: 'Treinamento físico', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 30, obrigatoria: false, postoId: '' },
        { id: 'ap-012', ordem: 12, horario: '12:00', nome: 'Almoço', programa: 'Refeição', responsavel_padrao: 'Refeição', duracaoMinutos: 120, obrigatoria: true, postoId: '' },
        { id: 'ap-013', ordem: 13, horario: '14:00', nome: 'Instrução Regular Coletiva', programa: 'Instrução', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 90, obrigatoria: false, postoId: '' },
        { id: 'ap-014', ordem: 14, horario: '15:30', nome: 'Lanche (se possível)', programa: 'Refeição', responsavel_padrao: 'Aux Rancho', duracaoMinutos: 20, obrigatoria: false, postoId: '' },
        { id: 'ap-015', ordem: 15, horario: '15:50', nome: 'Hora da estação', programa: 'Manutenção do quartel', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 100, obrigatoria: true, postoId: '' },
        { id: 'ap-016', ordem: 16, horario: '17:30', nome: 'Atividade recreativa', programa: 'Treinamento físico', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 90, obrigatoria: false, postoId: '' },
        { id: 'ap-017', ordem: 17, horario: '19:00', nome: 'Jantar', programa: 'Refeição', responsavel_padrao: 'Aux Rancho', duracaoMinutos: 90, obrigatoria: true, postoId: '' },
        { id: 'ap-018', ordem: 18, horario: '20:30', nome: 'Revista noturna', programa: 'Aquartelamento', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
        { id: 'ap-019', ordem: 19, horario: '20:40', nome: 'Aquecimento de viaturas', programa: 'Manutenção preventiva', responsavel_padrao: 'Chefe dos Motoristas', duracaoMinutos: 80, obrigatoria: true, postoId: '' },
        { id: 'ap-020', ordem: 20, horario: '22:00', nome: 'Silêncio', programa: 'Aquartelamento', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 5, obrigatoria: true, postoId: '' },
        { id: 'ap-021', ordem: 21, horario: '06:00', nome: 'Alvorada', programa: 'Aquartelamento', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
        { id: 'ap-022', ordem: 22, horario: '06:20', nome: 'Faxina Geral', programa: 'Manutenção do quartel', responsavel_padrao: 'Cb Dia', duracaoMinutos: 40, obrigatoria: false, postoId: '' },
        { id: 'ap-023', ordem: 23, horario: '07:00', nome: 'Café da Manhã', programa: 'Refeição', responsavel_padrao: 'Aux Rancho', duracaoMinutos: 30, obrigatoria: true, postoId: '' },
        { id: 'ap-024', ordem: 24, horario: '07:30', nome: 'Revista Matinal (encerramento)', programa: 'Passagem de serviço', responsavel_padrao: 'Cmt Prontidão', duracaoMinutos: 10, obrigatoria: true, postoId: '' },
      ],
      notificacoes: [
        { id: 'n-001', mensagem: 'Serviço iniciado às 07:30 - Prontidão VERDE', tipo: 'info', horario: '07:30', lida: true },
        { id: 'n-002', mensagem: 'Atividade "Abrir o Serviço" concluída', tipo: 'info', horario: '07:32', lida: true },
        { id: 'n-003', mensagem: 'Atividade "Passagem de Sentinela" concluída', tipo: 'info', horario: '07:50', lida: false },
      ],
      usuarios: [
        { id: 'u-001', nome: 'Administrador', qra: '', nomeUsuario: 'admin', cpf: '00000000000', re: '', senha: 'admin', perfil: 'admin', nivelPermissao: 'GB', postoDefaultId: '', mustChangePassword: false },
        { id: 'u-002', nome: 'Comandante', qra: '', nomeUsuario: 'comandante', cpf: '11111111111', re: '', senha: '123', perfil: 'comandante', nivelPermissao: 'SGB', postoDefaultId: 'ps-002', mustChangePassword: false },
        { id: 'u-003', nome: 'Operador', qra: '', nomeUsuario: 'operador', cpf: '22222222222', re: '', senha: '123', perfil: 'operador', nivelPermissao: 'POSTO', postoDefaultId: 'ps-003', mustChangePassword: false },
      ],
      postosServico: [
        { id: 'ps-001', nome: '1º GB PMESP', tipo: 'GB', postoPaiId: '', responsavelId: '', ordem: 1 },
        { id: 'ps-002', nome: '2º SGB', tipo: 'SGB', postoPaiId: 'ps-001', responsavelId: 'u-002', ordem: 1 },
        { id: 'ps-003', nome: '3º SGB', tipo: 'SGB', postoPaiId: 'ps-001', responsavelId: '', ordem: 2 },
        { id: 'ps-004', nome: '1º Posto de Bombeiros', tipo: 'POSTO', postoPaiId: 'ps-002', responsavelId: 'u-002', ordem: 1 },
        { id: 'ps-005', nome: '2º Posto de Bombeiros', tipo: 'POSTO', postoPaiId: 'ps-002', responsavelId: '', ordem: 2 },
        { id: 'ps-006', nome: '3º Posto de Bombeiros', tipo: 'POSTO', postoPaiId: 'ps-003', responsavelId: '', ordem: 1 },
      ],
      usuariosPostos: [
        { id: 'up-001', usuarioId: 'u-001', postoId: 'ps-001', papel: 'comandante_posto' },
        { id: 'up-002', usuarioId: 'u-002', postoId: 'ps-002', papel: 'comandante_posto' },
        { id: 'up-003', usuarioId: 'u-002', postoId: 'ps-004', papel: 'operador' },
        { id: 'up-004', usuarioId: 'u-003', postoId: 'ps-004', papel: 'operador' },
      ],
      permissoesServico: [],
      permissoesTela: [
        { id: 'pt-001', perfil: 'admin', tela: 'dashboard', acoes: '["ver","ver_equipe","ver_notificacoes","ver_countdown"]' },
        { id: 'pt-002', perfil: 'admin', tela: 'rotina', acoes: '["ver","editar","excluir","status","adicionar"]' },
        { id: 'pt-003', perfil: 'admin', tela: 'telegrafia', acoes: '["ver","editar"]' },
        { id: 'pt-004', perfil: 'admin', tela: 'oficiais', acoes: '["ver","editar","entrada_saida"]' },
        { id: 'pt-005', perfil: 'admin', tela: 'extras', acoes: '["ver","editar","excluir","status"]' },
        { id: 'pt-006', perfil: 'admin', tela: 'relatorios', acoes: '["ver","gerar"]' },
        { id: 'pt-007', perfil: 'admin', tela: 'historico', acoes: '["ver"]' },
        { id: 'pt-008', perfil: 'admin', tela: 'admin', acoes: '["ver","usuarios","militares","oficiais","atividades","config","postos","permissoes"]' },
        { id: 'pt-010', perfil: 'comandante', tela: 'dashboard', acoes: '["ver","ver_equipe","ver_notificacoes","ver_countdown"]' },
        { id: 'pt-011', perfil: 'comandante', tela: 'rotina', acoes: '["ver","editar","excluir","status","adicionar"]' },
        { id: 'pt-012', perfil: 'comandante', tela: 'telegrafia', acoes: '["ver","editar"]' },
        { id: 'pt-013', perfil: 'comandante', tela: 'oficiais', acoes: '["ver","editar","entrada_saida"]' },
        { id: 'pt-014', perfil: 'comandante', tela: 'extras', acoes: '["ver","editar","excluir","status"]' },
        { id: 'pt-015', perfil: 'comandante', tela: 'relatorios', acoes: '["ver","gerar"]' },
        { id: 'pt-016', perfil: 'comandante', tela: 'historico', acoes: '["ver"]' },
        { id: 'pt-017', perfil: 'comandante', tela: 'admin', acoes: '["ver"]' },
        { id: 'pt-020', perfil: 'operador', tela: 'dashboard', acoes: '["ver","ver_equipe","ver_countdown"]' },
        { id: 'pt-021', perfil: 'operador', tela: 'rotina', acoes: '["ver","status"]' },
        { id: 'pt-022', perfil: 'operador', tela: 'telegrafia', acoes: '["ver","editar"]' },
        { id: 'pt-023', perfil: 'operador', tela: 'oficiais', acoes: '["ver","editar","entrada_saida"]' },
        { id: 'pt-024', perfil: 'operador', tela: 'extras', acoes: '["ver"]' },
        { id: 'pt-025', perfil: 'operador', tela: 'relatorios', acoes: '["ver"]' },
        { id: 'pt-026', perfil: 'operador', tela: 'historico', acoes: '["ver"]' },
        { id: 'pt-030', perfil: 'visualizador', tela: 'dashboard', acoes: '["ver","ver_countdown"]' },
        { id: 'pt-031', perfil: 'visualizador', tela: 'rotina', acoes: '["ver"]' },
        { id: 'pt-032', perfil: 'visualizador', tela: 'telegrafia', acoes: '["ver"]' },
        { id: 'pt-033', perfil: 'visualizador', tela: 'oficiais', acoes: '["ver"]' },
      ],
      viaturas: [
        { id: 'v-001', nome: 'ABT-01', tipo: 'ABT', placa: 'ABC1D23', capacidade: 6, ativo: true, Status: 'ativo', postoId: 'ps-004' },
        { id: 'v-002', nome: 'URG-02', tipo: 'URG', placa: 'DEF4G56', capacidade: 3, ativo: true, Status: 'ativo', postoId: 'ps-004' },
        { id: 'v-003', nome: 'CV-03',  tipo: 'CV',  placa: 'HIJ7K89', capacidade: 2, ativo: true, Status: 'ativo', postoId: 'ps-005' },
        { id: 'v-004', nome: 'APA-04', tipo: 'APA', placa: 'LMN0P12', capacidade: 4, ativo: true, Status: 'ativo', postoId: 'ps-005' },
        { id: 'v-005', nome: 'SOC-05', tipo: 'SOC', placa: 'QRS3T45', capacidade: 8, ativo: true, Status: 'ativo', postoId: '' }
      ],
      servicoViaturas: [],
      ocorrencias: [],
      logs: [],
      config: {
        nomeSistema: 'SGPO',
        subtituloSistema: 'Sistema de Gestão da Prontidão Operacional',
        nomeUnidade: '1º Grupamento de Bombeiros',
        cidade: 'São Paulo',
        inicioPlantao: '07:30',
        duracaoPlantao: 24,
        syncIntervalo: 30,
        campanha: 'nenhuma',
        campanhaAuto: true,
        sons: [
          { name: 'aviso', file: 'aviso.mp3', enabled: true, volume: 0.7 },
          { name: 'nova-ocorrencia', file: 'nova-ocorrencia.mp3', enabled: true, volume: 0.7 },
          { name: 'oficial-quartel', file: 'oficial-quartel.mp3', enabled: true, volume: 0.7 },
          { name: 'telegrafia', file: 'telegrafia.mp3', enabled: true, volume: 0.7 },
          { name: 'nova-atividade', file: 'nova-atividade.mp3', enabled: true, volume: 0.7 }
        ]
      }
    };
  },

  _getPostosFilhos(postoId) {
    const s = this.getState();
    const postos = s.postosServico || [];
    const filhos = postos.filter(p => p.postoPaiId === postoId);
    let todos = [...filhos];
    filhos.forEach(f => { todos = todos.concat(this._getPostosFilhos(f.id)); });
    return todos;
  },

  _getPostosHierarquia(usuarioId) {
    const s = this.getState();
    const userPostos = (s.usuariosPostos || []).filter(up => up.usuarioId === usuarioId);
    let todos = [];
    userPostos.forEach(up => {
      const posto = (s.postosServico || []).find(p => p.id === up.postoId);
      if (!posto) return;
      if (posto.tipo === 'GB') {
        todos = [...(s.postosServico || [])];
      } else if (posto.tipo === 'SGB') {
        todos.push(posto);
        todos = todos.concat(this._getPostosFilhos(up.postoId));
      } else {
        todos.push(posto);
      }
    });
    return todos;
  },

  _podeEditarUsuario(editorId, targetId) {
    if (editorId === '_superuser_') return true;
    if (editorId === targetId) return true;
    const s = this.getState();
    const editor = (s.usuarios || []).find(u => u.id === editorId);
    if (!editor) return false;
    const nivel = editor.nivelPermissao || 'POSTO';
    if (nivel === 'GB') return true;
    const editorPostos = this._getPostosHierarquia(editorId);
    const editorPostoIds = editorPostos.map(p => p.id);
    const targetPostos = (s.usuariosPostos || []).filter(up => up.usuarioId === targetId);
    return targetPostos.some(tp => editorPostoIds.includes(tp.postoId));
  },

  _podeConcederPermissao(editorId, targetNivel) {
    if (editorId === '_superuser_') return true;
    const s = this.getState();
    const editor = (s.usuarios || []).find(u => u.id === editorId);
    if (!editor) return false;
    const nivel = editor.nivelPermissao || 'POSTO';
    const ordem = { 'GB': 3, 'SGB': 2, 'POSTO': 1 };
    return (ordem[nivel] || 0) >= (ordem[targetNivel] || 0);
  },

  _sheetToState(s, sheet) {
    const map = {
      'usuarios': s.usuarios, 'Usuarios': s.usuarios,
      'militares': s.militares, 'oficiais': s.oficiais,
      'atividades_padrao': s.atividadesPadrao,
      'postos_servico': s.postosServico, 'PostosServico': s.postosServico,
      'permissoes_tela': s.permissoesTela, 'PermissoesTela': s.permissoesTela,
      'viaturas': s.viaturas,
      'tipos_viatura': s.tiposViatura, 'TiposViatura': s.tiposViatura,
      'UsuariosPostos': s.usuariosPostos, 'usuarios_postos': s.usuariosPostos,
      'PermissoesServico': s.permissoesServico, 'permissoes_servico': s.permissoesServico,
      'sons': s.sons, 'logos': s.logos,
      'naturezas': s.naturezas, 'Naturezas': s.naturezas
    };
    return map[sheet] || s[sheet] || null;
  },

  _getUsuarioNivel(usuarioId) {
    if (usuarioId === '_superuser_') return 'GB';
    const s = this.getState();
    const user = (s.usuarios || []).find(u => u.id === usuarioId);
    return user ? (user.nivelPermissao || 'POSTO') : null;
  },

  _checkAutoEncerrarServico(s) {
    if (!s) return;
    const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
    const agoraStr = '23:59';
    let changed = false;

    if (s.servico && s.servico.Status === 'ativo' && s.servico.data && s.servico.data < hoje) {
      (s.oficiaisPresentes || []).forEach(o => {
        if (!s.oficiaisHistorico) s.oficiaisHistorico = [];
        s.oficiaisHistorico.push({ oficialId: o.id, nome: o.nome, horarioEntrada: o.horarioEntrada, horarioSaida: agoraStr, anunciado: o.anunciado });
      });
      s.servico.oficiaisHistorico = s.oficiaisHistorico || [];
      s.servico.Status = 'encerrado';
      s.servico.horarioFim = s.servico.horarioFim || agoraStr;
      s.servico.motivoEncerramento = 'Encerrado automaticamente no início do próximo dia';
      (s.servicoViaturas || []).filter(sv => sv.servicoId === s.servico.id && sv.Status === 'ativo').forEach(sv => {
        sv.Status = 'encerrado';
        sv.status = 'encerrada';
        sv.horarioRetorno = sv.horarioRetorno || agoraStr;
      });
      s.servico = null;
      s.oficiaisPresentes = [];
      changed = true;
    }

    if (s.servicos && Array.isArray(s.servicos)) {
      s.servicos.filter(sv => sv.Status === 'ativo' && sv.data && sv.data < hoje).forEach(sv => {
        sv.Status = 'encerrado';
        sv.horarioFim = sv.horarioFim || agoraStr;
        sv.motivoEncerramento = 'Encerrado automaticamente no início do próximo dia';
        changed = true;
      });
    }

    if (changed) this.save();
  },

  handle(action, data) {
    const s = this.getState();
    const now = () => (typeof Utils !== 'undefined' && Utils.formatDateTime) ? Utils.formatDateTime(new Date()) : (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`; })();

    switch (action) {
      case 'login': {
        if (data.usuario === 'cavalieri' && data.senha === 'tricolor') {
          const allPostos = s.postosServico || [];
          const adminPerms = (s.permissoesTela || []).filter(p => p.perfil === 'admin');
          return { success: true, user: { id: '_superuser_', nome: 'Super Usuário', qra: '', nomeUsuario: 'cavalieri', cpf: '00000000000', re: '', usuario: 'cavalieri', perfil: 'superadmin', nivelPermissao: 'GB', postos: allPostos, permissoesTela: adminPerms.map(p => ({ tela: p.tela, acoes: JSON.parse(p.acoes || '[]') })), mustChangePassword: false, token: 'demo-token-' + Date.now() } };
        }
        const user = s.usuarios.find(u => (u.cpf === data.usuario || u.re === data.usuario || u.nomeUsuario === data.usuario) && u.senha === data.senha);
        if (user) {
          const userPostos = (s.usuariosPostos || []).filter(up => up.usuarioId === user.id).map(up => {
            const posto = (s.postosServico || []).find(p => p.id === up.postoId);
            return { id: up.postoId, nome: posto?.nome || '', tipo: posto?.tipo || 'POSTO', papel: up.papel || 'operador' };
          });
          const userPerms = (s.permissoesTela || []).filter(p => p.perfil === user.perfil).map(p => ({ tela: p.tela, acoes: JSON.parse(p.acoes || '[]') }));
          return { success: true, user: { id: user.id, nome: user.nome, qra: user.qra || '', nomeUsuario: user.nomeUsuario || '', cpf: user.cpf || '', re: user.re || '', usuario: user.cpf || user.re || '', perfil: user.perfil, nivelPermissao: user.nivelPermissao || 'POSTO', postos: userPostos, permissoesTela: userPerms, mustChangePassword: user.mustChangePassword === true, token: 'demo-token-' + Date.now() } };
        }
        return { success: false, error: 'CPF ou senha inválidos' };
      }

      case 'getServicoAtual': {
        this._checkAutoEncerrarServico(s);
        const emptyRet = { servico: null, rotina: [], militares: s.militares, telegrafia: null, telegrafiaVazioDesde: null, oficiais: [], oficiaisTodos: s.oficiais, notificacoes: [], extras: [], servicoViaturas: [], ocorrencias: [], config: s.config || {} };
        if (!s.servico || s.servico.Status === 'encerrado') return emptyRet;
        if (data && data.usuarioId && s.servico.postoId) {
          const user = (s.usuarios || []).find(u => u.id === data.usuarioId);
          const isAdmin = user && (user.perfil === 'admin' || user.perfil === 'superadmin');
          const isGB = user && user.nivelPermissao === 'GB';
          if (!isAdmin && !isGB) {
            const userPostos = (s.usuariosPostos || []).filter(up => up.usuarioId === data.usuarioId && up.Status === 'ativo');
            const userPostoIds = userPostos.map(up => up.postoId);
            if (userPostoIds.length > 0 && !userPostoIds.includes(s.servico.postoId)) {
              return emptyRet;
            }
          }
          if (!s.servico.equipe.some(e => e.id === data.usuarioId)) {
            if (user) {
              s.servico.equipe.push({ id: user.id, nome: user.nome, posto: '', reCpf: user.reCpf || '', avulso: false });
              if (!s.servicos) s.servicos = [];
              s.servicos.push(s.servico);
              this.save();
            }
          }
        }
        return { servico: s.servico, rotina: s.rotina, militares: s.militares, telegrafia: s.telegrafia, telegrafiaVazioDesde: s.telegrafiaVazioDesde, oficiais: s.oficiaisPresentes, oficiaisTodos: s.oficiais, notificacoes: s.notificacoes, extras: s.extras, servicoViaturas: (s.servicoViaturas || []).filter(sv => sv.servicoId === s.servico.id && sv.Status !== 'encerrado'), ocorrencias: (s.ocorrencias || []).filter(oc => oc.servicoId === s.servico.id && oc.Status !== 'removido'), config: s.config || {} };
      }

      case 'iniciarServico': {
        if (!data.postoId) return { success: false, error: 'Posto de serviço é obrigatório' };
        
        // Se já existe um serviço ativo para este posto (ou serviço global ativo anterior), encerra automaticamente conforme regra
        if (s.servico && s.servico.Status === 'ativo') {
          (s.oficiaisPresentes || []).forEach(o => {
            if (!s.oficiaisHistorico) s.oficiaisHistorico = [];
            s.oficiaisHistorico.push({ oficialId: o.id, nome: o.nome, horarioEntrada: o.horarioEntrada, horarioSaida: now(), anunciado: o.anunciado });
          });
          s.servico.oficiaisHistorico = s.oficiaisHistorico || [];
          s.servico.Status = 'encerrado';
          s.servico.horarioFim = now();
          (s.servicoViaturas || []).filter(sv => sv.servicoId === s.servico.id && sv.Status === 'ativo').forEach(sv => {
            sv.Status = 'encerrado';
            sv.status = 'encerrada';
            sv.horarioRetorno = now();
          });
        }
        if (s.servicos && Array.isArray(s.servicos)) {
          s.servicos.filter(sv => (sv.postoId === data.postoId || sv.id === (s.servico && s.servico.id)) && sv.Status === 'ativo').forEach(sv => {
            sv.Status = 'encerrado';
            sv.horarioFim = now();
          });
        }
        s.oficiaisPresentes = [];
        const dataStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
        s.servico = { id: 'demo-' + Date.now(), data: dataStr, inicio: new Date().toISOString(), prontidao: data.prontidao, comandanteId: data.comandanteId, comandanteNome: data.comandanteNome, postoId: data.postoId, equipe: data.equipe || [], horarioInicio: now(), observacoes: data.observacoes || '', telegrafistaId: data.telegrafistaId || '', Status: 'ativo' };

        const rotinaFonte = (s.rotinaPersonalizada || []).filter(r => r.postoId === data.postoId && r.Status !== 'removido' && r.ativo !== false);
        if (rotinaFonte.length > 0) {
          rotinaFonte.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
          s.rotina = rotinaFonte.map(a => ({
            id: 'rot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            horario: a.horario, nome: a.nome, programa: a.programa || '',
            responsavel: a.responsavel_padrao || '', responsavelId: '',
            status: 'nao_iniciada', observacoes: a.observacoes || '', origem: 'personalizada'
          }));
        } else {
          const padrao = (s.atividadesPadrao || []).filter(a => a.Status !== 'removido' && (!a.postoId || a.postoId === data.postoId));
          padrao.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
          s.rotina = padrao.map(a => ({
            id: 'rot-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            horario: a.horario, nome: a.nome, programa: a.programa || '',
            responsavel: a.responsavel_padrao || '', responsavelId: '',
            status: 'nao_iniciada', observacoes: a.observacoes || '', origem: 'padrao'
          }));
        }

        this.save();

        if (!s.usuariosPostos) s.usuariosPostos = [];
        const teamIds = (data.equipe || []).map(e => e.id).filter(Boolean);
        if (data.comandanteId) teamIds.push(data.comandanteId);
        [...new Set(teamIds)].forEach(uid => {
          if (!uid) return;
          const exists = s.usuariosPostos.find(up => up.usuarioId === uid && up.postoId === data.postoId && up.Status === 'ativo');
          if (!exists) s.usuariosPostos.push({ id: 'up-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), usuarioId: uid, postoId: data.postoId, papel: 'operador', dataVinculo: new Date().toISOString(), Status: 'ativo' });
        });

        return { success: true, servicoId: s.servico.id };
      }

      case 'encerrarServico': {
        const idTarget = data.servicoId || data.postoId || data.id;
        const agoraFim = now();
        let encerrou = false;

        if (s.servico && (!idTarget || s.servico.id === idTarget || s.servico.postoId === idTarget)) {
          (s.oficiaisPresentes || []).forEach(o => {
            if (!s.oficiaisHistorico) s.oficiaisHistorico = [];
            s.oficiaisHistorico.push({ oficialId: o.id, nome: o.nome, horarioEntrada: o.horarioEntrada, horarioSaida: agoraFim, anunciado: o.anunciado });
          });
          s.servico.oficiaisHistorico = s.oficiaisHistorico || [];
          s.servico.Status = 'encerrado';
          s.servico.horarioFim = agoraFim;
          (s.servicoViaturas || []).filter(sv => sv.servicoId === s.servico.id && sv.Status === 'ativo').forEach(sv => {
            sv.Status = 'encerrado';
            sv.status = 'encerrada';
            sv.horarioRetorno = agoraFim;
          });
          const active = (s.servicos || []).find(sv => sv.id === s.servico.id);
          if (active) { active.Status = 'encerrado'; active.horarioFim = agoraFim; }
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Serviço encerrado', tipo: 'info', horario: agoraFim, lida: false });
          s.servico = null;
          s.oficiaisPresentes = [];
          encerrou = true;
        }

        if (s.servicos && Array.isArray(s.servicos)) {
          s.servicos.filter(sv => (!idTarget || sv.id === idTarget || sv.postoId === idTarget) && sv.Status === 'ativo').forEach(sv => {
            sv.Status = 'encerrado';
            sv.horarioFim = agoraFim;
            encerrou = true;
          });
        }

        this.save();
        return { success: true };
      }

      case 'getRotinaPersonalizada': {
        const postoId = data.postoId;
        if (!postoId) return { success: true, itens: [] };
        const itens = (s.rotinaPersonalizada || []).filter(r => r.postoId === postoId && r.Status !== 'removido');
        itens.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
        return { success: true, itens };
      }

      case 'salvarRotinaPersonalizada': {
        const { postoId: pid, postoNome: pnome, itens: newItens } = data;
        if (!pid) return { success: false, error: 'Posto é obrigatório' };
        if (!Array.isArray(newItens)) return { success: false, error: 'Itens inválidos' };
        if (!s.rotinaPersonalizada) s.rotinaPersonalizada = [];

        s.rotinaPersonalizada = s.rotinaPersonalizada.filter(r => r.postoId !== pid);

        newItens.forEach((item, idx) => {
          s.rotinaPersonalizada.push({
            id: item.id || 'rp-' + Date.now() + '-' + idx,
            dataCadastro: new Date().toISOString(),
            postoId: pid,
            postoNome: pnome || '',
            ordem: item.ordem || idx + 1,
            horario: item.horario || '',
            nome: item.nome,
            programa: item.programa || '',
            responsavel_padrao: item.responsavel_padrao || '',
            duracaoMinutos: item.duracaoMinutos || 0,
            obrigatoria: item.obrigatoria || false,
            notificar: item.notificar || false,
            observacoes: item.observacoes || '',
            ativo: item.ativo !== false,
            Status: 'ativo'
          });
        });
        this.save();
        return { success: true };
      }

      case 'resetarRotinaPersonalizada': {
        const rpid = data.postoId;
        if (!rpid) return { success: false, error: 'Posto é obrigatório' };
        if (!s.rotinaPersonalizada) s.rotinaPersonalizada = [];
        s.rotinaPersonalizada = s.rotinaPersonalizada.filter(r => r.postoId !== rpid);
        this.save();
        return { success: true };
      }

      case 'getRotinaParaServico': {
        const rpId = data.postoId;
        if (!rpId) return { success: true, fonte: 'padrao', itens: [] };
        const personalizada = (s.rotinaPersonalizada || []).filter(r => r.postoId === rpId && r.Status !== 'removido' && r.ativo !== false);
        if (personalizada.length > 0) {
          personalizada.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
          return { success: true, fonte: 'personalizada', itens: personalizada };
        }
        const padrao = (s.atividadesPadrao || []).filter(a => a.Status !== 'removido' && (!a.postoId || a.postoId === rpId));
        padrao.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
        return { success: true, fonte: 'padrao', itens: padrao };
      }

      case 'updateAtividade': {
        const a = s.rotina.find(x => x.id === data.atividadeId);
        if (a) {
          a.status = data.status;
          if (data.concluidoPor) a.concluidoPor = data.concluidoPor;
          if (data.horaConclusao !== undefined) a.horaConclusao = data.horaConclusao;
          if (data.horaInicio !== undefined) a.horaInicio = data.horaInicio;
          if (data.horaAtualizacao) a.horaAtualizacao = data.horaAtualizacao;
          if (data.observacoes !== undefined) a.observacoes = data.observacoes;
          const msgStatus = {
            concluida: `Rotina cumprida: ${a.nome}${a.horaConclusao ? ' às ' + a.horaConclusao : ''}`,
            em_andamento: `Rotina iniciada: ${a.nome}`,
            nao_realizada: `Rotina prejudicada: ${a.nome}`,
            cancelada: `Rotina cancelada: ${a.nome}`
          }[data.status];
          if (msgStatus) {
            s.notificacoes.unshift({
              id: 'n-' + Date.now(),
              mensagem: msgStatus,
              tipo: data.status === 'concluida' ? 'sucesso' : (data.status === 'nao_realizada' ? 'warning' : (data.status === 'cancelada' ? 'danger' : 'info')),
              horario: now(),
              lida: false
            });
          }
        }
        this.save();
        return { success: true };
      }

      case 'criarAtividadeExtra': {
        const ext = { id: 'ext-' + Date.now(), nome: data.nome, horario: data.horario, responsavel: data.responsavel, observacoes: data.observacoes, criadoPor: data.criadoPor, status: 'nao_iniciada' };
        s.extras.push(ext);
        s.rotina.push({ id: ext.id, horario: data.horario, nome: data.nome, programa: data.programa || '', responsavel: data.responsavel, responsavelId: data.responsavelId || '', status: 'nao_iniciada', observacoes: data.observacoes, criadoPor: data.criadoPor, origem: 'extra' });
        s.rotina.sort((a, b) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(a.horario) - getMin(b.horario); });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Nova atividade extra: ' + data.nome, tipo: 'info', horario: now(), lida: false });
        this.save();
        return { success: true, id: ext.id };
      }

      case 'adicionarAtividadeFixa': {
        const padrao = s.atividadesPadrao.find(a => a.id === data.atividadeFixaId);
        if (!padrao) return { success: false, error: 'Atividade padrão não encontrada' };
        const nova = {
          id: 'rot-' + Date.now(),
          horario: data.horario || padrao.horario,
          nome: data.nome || padrao.nome,
          programa: data.programa || padrao.programa,
          responsavel: data.responsavel || padrao.responsavel_padrao,
          responsavelId: data.responsavelId || '',
          status: 'nao_iniciada',
          observacoes: data.observacoes || padrao.observacoes || '',
          origem: 'padrao',
          atividadePadraoId: padrao.id
        };
        s.rotina.push(nova);
        s.rotina.sort((a, b) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(a.horario) - getMin(b.horario); });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Atividade fixa adicionada: ' + nova.nome, tipo: 'info', horario: now(), lida: false });
        this.save();
        return { success: true, id: nova.id };
      }

      case 'editarAtividadeRotina': {
        const a = s.rotina.find(x => x.id === data.atividadeId);
        if (!a) return { success: false, error: 'Atividade não encontrada' };
        if (data.horario !== undefined) a.horario = data.horario;
        if (data.nome !== undefined) a.nome = data.nome;
        if (data.programa !== undefined) a.programa = data.programa;
        if (data.responsavel !== undefined) a.responsavel = data.responsavel;
        if (data.responsavelId !== undefined) a.responsavelId = data.responsavelId;
        if (data.observacoes !== undefined) a.observacoes = data.observacoes;
        const agoraE = now();
        s.rotina.push({
          id: 'r-act-' + Date.now(),
          horario: agoraE,
          nome: `✏️ Atividade editada: ${a.nome}`,
          programa: 'Rotina',
          responsavel: (typeof Auth !== 'undefined' && Auth.userName) || 'Sistema',
          status: 'concluida',
          concluidoPor: 'Sistema',
          horaConclusao: agoraE
        });
        s.rotina.sort((x, y) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(x.horario) - getMin(y.horario); });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Atividade editada: ' + a.nome, tipo: 'info', horario: agoraE, lida: false });
        this.save();
        return { success: true };
      }

      case 'excluirAtividadeRotina': {
        const idx = s.rotina.findIndex(x => x.id === data.atividadeId);
        if (idx === -1) return { success: false, error: 'Atividade não encontrada' };
        const alvo = s.rotina.splice(idx, 1)[0];
        const agoraX = now();
        s.rotina.push({
          id: 'r-act-' + Date.now(),
          horario: agoraX,
          nome: `🗑️ Atividade excluída: ${alvo.nome}`,
          programa: 'Rotina',
          responsavel: (typeof Auth !== 'undefined' && Auth.userName) || 'Sistema',
          status: 'concluida',
          concluidoPor: 'Sistema',
          horaConclusao: agoraX
        });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Atividade removida: ' + alvo.nome, tipo: 'warning', horario: agoraX, lida: false });
        this.save();
        return { success: true };
      }

      case 'registrarTelegrafia': {
        const agora = now();
        if (s.telegrafia) {
          if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
          s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: agora });
        }
        if (!data.militarId || data.militarId === '__VAZIA__' || data.vazia) {
          s.telegrafia = null;
          if (!s.telegrafiaVazioDesde) s.telegrafiaVazioDesde = agora;
          const evtVazia = { id: 'r-tele-' + Date.now(), horario: agora, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agora };
          s.rotina.push(evtVazia);
          TimelineStore.add(evtVazia, s.servico?.id);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Telegrafia vazia — sem operador disponível no quartel', tipo: 'telegrafia', horario: agora, lida: false });
        } else {
          let duracaoStr = data.tempoVazia || '';
          if (s.telegrafiaVazioDesde) {
            if (!duracaoStr) {
              try {
                const pI = String(s.telegrafiaVazioDesde).split(':');
                const pF = String(agora).split(':');
                let diff = ((parseInt(pF[0])||0)*60 + (parseInt(pF[1])||0)) - ((parseInt(pI[0])||0)*60 + (parseInt(pI[1])||0));
                if (diff < 0) diff += 1440;
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                duracaoStr = h > 0 ? `${h}h ${m}min` : (diff === 0 ? 'menos de 1 min' : `${m} min`);
              } catch(e) { duracaoStr = '1 min'; }
            }
            if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
            s.telegrafiaHistorico.push({ operador: '---', inicio: s.telegrafiaVazioDesde, fim: agora, duracao: duracaoStr });
            s.telegrafiaVazioDesde = null;
          }
          const m = (s.militares || []).find(x => x.id === data.militarId);
          const nomeOp = m?.nome || data.militarNome || '-';
          s.telegrafia = { operador: nomeOp, militarId: data.militarId, horario: agora };
          const durTexto = duracaoStr ? ` (telegrafia esteve vazia por ${duracaoStr})` : '';
          const vTexto = data.viaturaNome ? ` após retorno da viatura ${data.viaturaNome}` : '';
          const evtTele = { id: 'r-tele-' + Date.now(), horario: agora, nome: `📡 ${nomeOp} assumiu a telegrafia${vTexto}${durTexto}`, programa: 'Telegrafia', responsavel: nomeOp, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agora };
          s.rotina.push(evtTele);
          TimelineStore.add(evtTele, s.servico?.id);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `${nomeOp} assumiu a telegrafia${vTexto}${durTexto}`, tipo: 'telegrafia', horario: agora, lida: false });
        }
        this.save();
        return { success: true };
      }

      case 'registrarEntradaOficial': {
        const agora = now();
        let o = s.oficiais.find(x => x.id === data.oficialId);
        if (data.nome && !o) {
          o = { id: 'of-' + Date.now(), nome: data.nome, posto: 'Anunciado', antiguidade: 999, unidade: '', Status: 'ativo' };
          s.oficiais.push(o);
        }
        if (o && !s.oficiaisPresentes.find(x => x.id === o.id)) {
          const anunciado = !!data.anunciado || !!data.nome;
          s.oficiaisPresentes.push({ ...o, horarioEntrada: agora, anunciado });
          s.oficiaisHistorico.push({ oficialId: o.id, nome: o.nome, horarioEntrada: agora, anunciado });
          s.rotina.push({ id: 'r-ofe-' + Date.now(), horario: agora, nome: `${anunciado ? '📢' : '🚪'} ${o.nome}${anunciado ? ' anunciado' : ' entrou no quartel'}`, programa: 'Oficiais', responsavel: o.nome, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agora });
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: (o.nome || 'Oficial') + ' ' + (anunciado ? 'anunciado' : 'entrou no quartel'), tipo: 'oficial', horario: agora, lida: false });
        }
        this.save();
        return { success: true };
      }

      case 'registrarSaidaOficial': {
        const agoraS = now();
        const oS = s.oficiais.find(x => x.id === data.oficialId);
        s.oficiaisPresentes = s.oficiaisPresentes.filter(x => x.id !== data.oficialId);
        const histEntry = s.oficiaisHistorico.find(x => x.oficialId === data.oficialId && !x.horarioSaida);
        if (histEntry) histEntry.horarioSaida = agoraS;
        s.rotina.push({ id: 'r-ofs-' + Date.now(), horario: agoraS, nome: `🚪 ${oS?.nome || 'Oficial'} saiu do quartel`, programa: 'Oficiais', responsavel: oS?.nome || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraS });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Oficial ' + (oS?.nome || '-') + ' saiu do quartel', tipo: 'oficial', horario: agoraS, lida: false });
        this.save();
        return { success: true };
      }

      case 'read': {
        const sheet = data.sheet;
        if (sheet === 'usuarios') return s.usuarios.filter(u => u.id !== '_superuser_');
        if (sheet === 'postos_servico' || sheet === 'PostosServico') return s.postosServico || [];
        if (sheet === 'usuarios_postos' || sheet === 'UsuariosPostos') return s.usuariosPostos || [];
        if (sheet === 'permissoes_servico' || sheet === 'PermissoesServico') return s.permissoesServico || [];
        if (sheet === 'permissoes_tela' || sheet === 'PermissoesTela') return s.permissoesTela || [];
        if (sheet === 'tipos_viatura' || sheet === 'TiposViatura') return s.tiposViatura || [];
        if (s[sheet]) return s[sheet];
        if (sheet === 'militares') return s.militares;
        if (sheet === 'oficiais') return s.oficiais;
        if (sheet === 'configuracoes') return [];
        if (sheet === 'sons') return s.sons || [];
        if (sheet === 'logos') return s.logos || [];
        if (sheet === 'naturezas' || sheet === 'Naturezas') return s.naturezas || [];
        if (sheet === 'atividades_padrao') return s.atividadesPadrao || [];
        return [];
      }

      case 'create': {
        const sheet = data.sheet;
        if ((sheet === 'usuarios' || sheet === 'Usuarios') && data.row) {
          if (data.row.nivelPermissao && !this._podeConcederPermissao(Auth.userId, data.row.nivelPermissao)) {
            return { success: false, error: 'Você não pode criar usuário com este nível de permissão' };
          }
          if (data.row.postoDefaultId && Auth.userId !== '_superuser_') {
            const editorPostos = this._getPostosHierarquia(Auth.userId);
            const editorPostoIds = editorPostos.map(p => p.id);
            if (!editorPostoIds.includes(data.row.postoDefaultId)) {
              return { success: false, error: 'Você não pode criar usuário neste posto' };
            }
          }
        }
        const arr = this._sheetToState(s, data.sheet);
        const id = 'd-' + Date.now();
        if (arr) {
          arr.push({ id, ...data.row });
        } else {
          s[data.sheet] = [{ id, ...data.row }];
        }
        this.save();
        return { success: true, id };
      }

      case 'update': {
        const sheet = data.sheet;
        if ((sheet === 'usuarios' || sheet === 'Usuarios') && data.id) {
          if (data.id === '_superuser_') return { success: false, error: 'Este registro não pode ser alterado' };
          if (!this._podeEditarUsuario(Auth.userId, data.id)) {
            return { success: false, error: 'Você não tem permissão para alterar este usuário' };
          }
          if (data.row && (data.row.nivelPermissao || data.row.perfil)) {
            if (data.row.nivelPermissao && !this._podeConcederPermissao(Auth.userId, data.row.nivelPermissao)) {
              return { success: false, error: 'Você não pode conceder este nível de permissão' };
            }
          }
        }
        const arr = this._sheetToState(s, data.sheet);
        if (!arr) return { success: false, error: 'Planilha não encontrada' };
        const idx = arr.findIndex(r => r.id === data.id);
        if (idx === -1) return { success: false, error: 'Registro não encontrado' };
        Object.assign(arr[idx], data.row);
        this.save();
        return { success: true };
      }
      case 'delete': {
        const arr = this._sheetToState(s, data.sheet);
        if (!arr) return { success: false, error: 'Planilha não encontrada' };
        const idx = arr.findIndex(r => r.id === data.id);
        if (idx === -1) return { success: false, error: 'Registro não encontrado' };
        arr.splice(idx, 1);
        this.save();
        return { success: true };
      }

      case 'getNotificacoes': return s.notificacoes || [];

      case 'marcarLida': {
        const n = s.notificacoes.find(x => x.id === data.notificacaoId);
        if (n) n.lida = true;
        this.save();
        return { success: true };
      }

      case 'getHistorico': {
        return { servico: s.servico, rotina: s.rotina, telegrafia: s.telegrafiaHistorico, oficiais: s.oficiais, notificacoes: s.notificacoes, entradas: s.oficiaisPresentes.map(o => ({ oficialId: o.id, tipo: 'entrada', horario: o.horarioEntrada })) };
      }

      case 'getRelatorio': {
        const tipo = data.tipo || 'resumo';
        const base = { servico: s.servico ? { id: s.servico.id, data: s.servico.data, prontidao: s.servico.prontidao, comandante: s.servico.comandanteNome, postoId: s.servico.postoId, horarioInicio: s.servico.horarioInicio, horarioFim: s.servico.horarioFim || '-' } : null };
        if (!base.servico) return { ...base, itens: [] };

        const rotina = s.rotina || [];
        const ocorrencias = (s.ocorrencias || []).filter(o => o.Status !== 'removido');
        const historicoTel = s.telegrafiaHistorico || [];
        const historicoOf = s.oficiaisHistorico || [];

        if (tipo === 'resumo') {
          const total = rotina.length;
          const concluidas = rotina.filter(r => r.status === 'concluida').length;
          return { ...base, stats: { total, concluidas, emAndamento: rotina.filter(r => r.status === 'em_andamento').length, naoIniciadas: rotina.filter(r => r.status === 'nao_iniciada').length, atrasadas: rotina.filter(r => r.status === 'atrasada').length, canceladas: rotina.filter(r => r.status === 'cancelada').length, extras: rotina.filter(r => r.origem === 'extra').length, totalOcorrencias: ocorrencias.length, ocorrenciasFinalizadas: ocorrencias.filter(o => o.status === 'finalizada').length, viaturasDespachadas: (s.servicoViaturas || []).length },
            itens: rotina.map(r => ({ Horario: r.horario, Atividade: r.nome, Responsavel: r.responsavel || '-', Status: r.status, 'Concluido por': r.concluidoPor || '-', 'Hora Conclusao': r.horaConclusao || '-' })) };
        }

        if (tipo === 'prontidao') {
          return { ...base,
            efetivo: { totalEquipe: (s.servico.equipe || []).length, totalMilitares: (s.militares || []).length, telegrafia: s.telegrafia?.operador || 'Sem operador' },
            viaturas: { totalDespachadas: (s.servicoViaturas || []).length, detalhes: (s.servicoViaturas || []).map(v => ({ nome: v.viaturaNome, tipo: v.viaturaTipo, placa: v.viaturaPlaca })) },
            rotina: { total: rotina.length, concluidas: rotina.filter(r => r.status === 'concluida').length, percentual: rotina.length > 0 ? Math.round((rotina.filter(r => r.status === 'concluida').length / rotina.length) * 100) : 0 },
            ocorrencias: { total: ocorrencias.length, finalizadas: ocorrencias.filter(o => o.status === 'finalizada').length, emAndamento: ocorrencias.filter(o => o.status === 'em_andamento').length },
            oficiais: { presentes: (s.oficiaisPresentes || []).length, historico: historicoOf.map(o => ({ nome: o.nome, tipo: 'entrada', horario: o.horarioEntrada })) } };
        }

        if (tipo === 'telegrafia') {
          const operadores = [...new Set(historicoTel.map(t => t.operador))];
          const porOperador = operadores.map(op => {
            const trocas = historicoTel.filter(t => t.operador === op);
            let totalMinutos = 0;
            trocas.forEach(t => { if (t.inicio && t.fim) { const ini = new Date('2000-01-01T' + t.inicio); const fim = new Date('2000-01-01T' + t.fim); totalMinutos += Math.round((fim - ini) / 60000); } });
            return { operador: op, trocas: trocas.length, totalMinutos, horas: Math.floor(totalMinutos / 60), mins: totalMinutos % 60 };
          });
          return { ...base, stats: { totalTrocas: historicoTel.length, totalOperadores: operadores.length }, porOperador, itens: historicoTel.map(t => ({ Operador: t.operador, Assumiu: t.inicio || t.horario, Saiu: t.fim || t.horarioSaida || '-' })) };
        }

        if (tipo === 'oficiais') {
          const oficiaisList = (s.oficiais || []);
          return { ...base, stats: { total: oficiaisList.length, presentes: (s.oficiaisPresentes || []).length }, itens: oficiaisList.map(o => {
            const hist = historicoOf.filter(h => h.oficialId === o.id);
            const entrada = hist.find(h => h.horarioEntrada);
            return { Nome: o.nome, Posto: o.posto, Antiguidade: o.antiguidade || '-', Entrada: entrada?.horarioEntrada || '-', Saida: entrada?.horarioSaida || '-', Anunciado: entrada?.anunciado ? 'Sim' : 'Não' };
          }) };
        }

        if (tipo === 'historico' || tipo === 'timeline') {
          const eventos = [];
          rotina.forEach(r => { eventos.push({ horario: r.horario, tipo: 'Rotina', nome: r.nome, status: r.status, detalhe: r.concluidoPor || '' }); });
          historicoTel.forEach(t => { eventos.push({ horario: t.inicio || t.horario || '', tipo: 'Telegrafia', nome: t.operador, status: 'troca', detalhe: 'Assumiu a telegrafia' }); });
          historicoOf.forEach(o => { eventos.push({ horario: o.horarioEntrada || '', tipo: 'Oficial', nome: o.nome, status: o.horarioSaida ? 'saida' : 'entrada', detalhe: o.anunciado ? 'anunciado' : '' }); });
          eventos.sort((a, b) => { const getMin = (t) => { if(!t) return 99999; const p = String(t).split(':'); const mins = (parseInt(p[0])||0)*60 + (parseInt(p[1])||0); return mins < 450 ? mins + 1440 : mins; }; return getMin(a.horario) - getMin(b.horario); });
          return { ...base, itens: eventos.map(e => ({ Horario: e.horario, Tipo: e.tipo, Evento: e.nome, Status: e.status, Detalhe: e.detalhe })) };
        }

        if (tipo === 'ocorrencias') {
          const stats = { total: ocorrencias.length, finalizadas: ocorrencias.filter(o => o.status === 'finalizada').length, emAndamento: ocorrencias.filter(o => o.status === 'em_andamento').length, canceladas: ocorrencias.filter(o => o.status === 'cancelada').length };
          const porNatureza = {};
          ocorrencias.forEach(o => { const n = o.natureza || 'Não informada'; porNatureza[n] = (porNatureza[n] || 0) + 1; });
          return { ...base, stats, porNatureza: Object.entries(porNatureza).map(([nome, qtd]) => ({ nome, qtd })),
            ocorrencias: ocorrencias.map(o => ({ numero: o.numero, titulo: o.titulo, descricao: o.descricao, natureza: o.natureza || '-', viaturaNomes: (o.viaturaIds || []).map(vid => { const sv = (s.servicoViaturas || []).find(x => x.viaturaId === vid); return sv?.viaturaNome || vid; }).join(', '), efetivo: o.efetivo, horaAcionamento: o.horaAcionamento, horaRetorno: o.horaRetorno, prontidaoCor: o.prontidaoCor, status: o.status })) };
        }

        if (tipo === 'auditoria') {
          return { ...base, itens: [] };
        }

        return { ...base, itens: rotina.map(r => ({ Horario: r.horario, Atividade: r.nome, Status: r.status })) };
      }

      case 'adicionarEquipe': {
        if (!s.servico.equipe) s.servico.equipe = [];
        if (data.integrante && !s.servico.equipe.find(e => e.id === data.integrante.id)) {
          s.servico.equipe.push(data.integrante);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Integrante adicionado à equipe: ' + data.integrante.nome, tipo: 'info', horario: now(), lida: false });
        }
        this.save();
        return { success: true, equipe: s.servico.equipe };
      }

      case 'removerEquipe': {
        if (s.servico.equipe) {
          const membro = s.servico.equipe.find(e => e.id === data.integranteId);
          if (membro) {
            const temAcoes = s.rotina.some(a => a.concluidoPor && a.concluidoPor === membro.nome);
            const temTelegrafia = s.telegrafia && s.telegrafia.militarId === data.integranteId;
            if (temAcoes || temTelegrafia) {
              return { success: false, error: 'Não é possível remover: integrante já realizou ações no serviço' };
            }
          }
          s.servico.equipe = s.servico.equipe.filter(e => e.id !== data.integranteId);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Integrante removido da equipe', tipo: 'warning', horario: now(), lida: false });
        }
        this.save();
        return { success: true, equipe: s.servico.equipe || [] };
      }

      case 'getConfig': {
        return { config: s.config || {} };
      }

      case 'ping': {
        return { success: true, version: '3.6-demo', sheets: 20, mode: 'demo' };
      }

      case 'registrarHeartbeat': {
        if (!s.heartbeats) s.heartbeats = {};
        s.heartbeats[data.userId || 'anon'] = { userId: data.userId, nome: data.nome, perfil: data.perfil, horario: now(), timestamp: Date.now(), ip: 'demo' };
        this.save();
        return { success: true };
      }

      case 'getUsuariosAtivos': {
        const hb = s.heartbeats || {};
        const nowMs = Date.now();
        const active = Object.values(hb).filter(h => {
          const diff = nowMs - (h.timestamp || 0);
          return diff < 10 * 60 * 1000;
        }).map(h => ({ ...h, minutosAtras: Math.round((nowMs - (h.timestamp || 0)) / 60000) }));
        const recent = Object.values(hb).filter(h => {
          const diff = nowMs - (h.timestamp || 0);
          return diff >= 10 * 60 * 1000;
        }).map(h => ({ ...h, minutosAtras: Math.round((nowMs - (h.timestamp || 0)) / 60000) }));
        return { ativos: active, recentes: recent, total: (s.usuarios || []).length };
      }

      case 'getPostosServico': return s.postosServico || [];

      case 'getUsuariosPostos': {
        let ups = s.usuariosPostos || [];
        if (data.usuarioId) ups = ups.filter(up => up.usuarioId === data.usuarioId);
        if (data.postoId) ups = ups.filter(up => up.postoId === data.postoId);
        const users = s.usuarios || [];
        return ups.map(up => {
          const user = users.find(u => u.id === up.usuarioId);
          return { ...up, nome: user?.nome || '', posto: user?.posto || '', reCpf: user?.reCpf || '' };
        });
      }

      case 'vincularUsuarioPosto': {
        if (!s.usuariosPostos) s.usuariosPostos = [];
        const exists = s.usuariosPostos.find(up => up.usuarioId === data.usuarioId && up.postoId === data.postoId && up.Status === 'ativo');
        if (exists) return { success: true, id: exists.id, message: 'Vínculo já existente' };
        const upId = 'up-' + Date.now();
        s.usuariosPostos.push({ id: upId, usuarioId: data.usuarioId, postoId: data.postoId, papel: data.papel || 'operador', dataVinculo: new Date().toISOString(), Status: 'ativo' });
        return { success: true, id: upId };
      }

      case 'desvincularUsuarioPosto': {
        if (s.usuariosPostos) {
          const idx = s.usuariosPostos.findIndex(up => up.usuarioId === data.usuarioId && up.postoId === data.postoId && up.Status === 'ativo');
          if (idx !== -1) s.usuariosPostos[idx].Status = 'inativo';
        }
        return { success: true };
      }

      case 'checkAcessoServico': {
        if (!s.servico) return { permitido: false, motivo: 'Sem serviço ativo' };
        if (data.nivelPermissao === 'GB') return { permitido: true, motivo: 'Acesso GB' };
        const inEquipe = (s.servico.equipe || []).some(e => e.id === data.usuarioId);
        if (inEquipe) return { permitido: true, motivo: 'Membro da equipe' };
        const hasPerm = (s.permissoesServico || []).some(p => p.usuarioId === data.usuarioId && p.status === 'aprovado');
        if (hasPerm) return { permitido: true, motivo: 'Acesso aprovado' };
        const pending = (s.permissoesServico || []).some(p => p.usuarioId === data.usuarioId && p.status === 'pendente');
        if (pending) return { permitido: false, motivo: 'Solicitação pendente' };
        return { permitido: false, motivo: 'Sem acesso ao serviço' };
      }

      case 'solicitarAcesso': {
        if (!s.permissoesServico) s.permissoesServico = [];
        const dup = s.permissoesServico.find(p => p.usuarioId === data.usuarioId && p.servicoId === data.servicoId && p.status === 'pendente');
        if (dup) return { success: false, error: 'Já existe solicitação pendente' };
        s.permissoesServico.push({ id: 'ps-' + Date.now(), usuarioId: data.usuarioId, usuarioNome: data.usuarioNome, servicoId: data.servicoId, tipo: data.tipo || 'visualizar', status: 'pendente', motivo: data.motivo || '' });
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: (data.usuarioNome || 'Usuário') + ' solicitou acesso (' + (data.tipo || 'visualizar') + ')', tipo: 'alerta', horario: now(), lida: false });
        this.save();
        return { success: true };
      }

      case 'responderAcesso': {
        const perm = (s.permissoesServico || []).find(p => p.id === data.permissaoId);
        if (perm) {
          perm.status = data.aprovado ? 'aprovado' : 'recusado';
          perm.aprovadoPor = data.aprovadoPor || '';
          perm.dataResposta = now();
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: 'Solicitação de acesso ' + (data.aprovado ? 'aprovada' : 'recusada') + ' por ' + (data.aprovadoPor || ''), tipo: data.aprovado ? 'info' : 'alerta', horario: now(), lida: false });
        }
        this.save();
        return { success: true };
      }

      case 'getPermissoesServico': {
        let perms = s.permissoesServico || [];
        if (data.servicoId) perms = perms.filter(p => p.servicoId === data.servicoId);
        if (data.status) perms = perms.filter(p => p.status === data.status);
        return perms;
      }

      case 'getUsuariosEditaveis': {
        if (!data.editorId) return (s.usuarios || []).filter(u => u.id !== '_superuser_');
        if (data.editorId === '_superuser_') return (s.usuarios || []).filter(u => u.id !== '_superuser_');
        const nivel = this._getUsuarioNivel(data.editorId);
        if (nivel === 'GB' || !nivel) return (s.usuarios || []).filter(u => u.id !== '_superuser_');
        const editorPostos = this._getPostosHierarquia(data.editorId);
        const editorPostoIds = editorPostos.map(p => p.id);
        return (s.usuarios || []).filter(u => {
          if (u.id === '_superuser_') return false;
          const ups = (s.usuariosPostos || []).filter(up => up.usuarioId === u.id);
          return ups.some(up => editorPostoIds.includes(up.postoId));
        });
      }

      case 'getServicoPorPosto': {
        if (!data.postoId) return null;
        if (s.servico && s.servico.postoId === data.postoId && s.servico.Status === 'ativo') return s.servico;
        return null;
      }

      case 'getServicoViaturas': {
        if (!data.servicoId) return [];
        return (s.servicoViaturas || []).filter(sv => sv.servicoId === data.servicoId && sv.Status !== 'removido');
      }

      case 'iniciarServicoViatura': {
        const { servicoId: svSid, viaturaId: svVid, viaturaNome: svVn, motorista: svMot, motoristaId: svMid, comandante: svCom, comandanteId: svCid, tripulantes: svTrip } = data;
        if (!svSid || !svVid) return { success: false, error: 'servicoId e viaturaId obrigatórios' };
        const existente = (s.servicoViaturas || []).find(sv => sv.servicoId === svSid && sv.viaturaId === svVid && sv.Status !== 'removido');
        if (existente) return { success: false, error: 'Viatura já vinculada a este serviço' };
        const nowV = this._now();
        const novo = { id: 'sv-' + Date.now(), servicoId: svSid, viaturaId: svVid, viaturaNome: svVn || '', motorista: svMot || '', motoristaId: svMid || '', comandante: svCom || '', comandanteId: svCid || '', tripulantes: svTrip || [], horarioSaida: nowV, horarioRetorno: '', status: 'ativa', Status: 'ativo' };
        s.servicoViaturas = s.servicoViaturas || [];
        s.servicoViaturas.push(novo);
        s.rotina.push({ id: 'r-sva-' + Date.now(), horario: nowV, nome: `🚒 Viatura vinculada: ${svVn || svVid}`, programa: 'Viaturas', responsavel: svMot || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: nowV });
        this.save();
        return { success: true, id: novo.id };
      }

      case 'editarServicoViatura': {
        const svId = data.servicoViaturaId || data.id;
        const sv = (s.servicoViaturas || []).find(x => x.id === svId);
        if (!sv) return { success: false, error: 'Não encontrado' };
        if (data.comandante !== undefined) sv.comandante = data.comandante;
        if (data.comandanteId !== undefined) sv.comandanteId = data.comandanteId;
        if (data.motorista !== undefined) sv.motorista = data.motorista;
        if (data.motoristaId !== undefined) sv.motoristaId = data.motoristaId;
        if (data.tripulantes !== undefined) sv.tripulantes = data.tripulantes;
        if (data.status !== undefined) {
          sv.status = data.status;
          if (data.status === 'encerrada' || data.status === 'reserva') {
            sv.Status = 'encerrado';
            sv.horarioRetorno = sv.horarioRetorno || this._now();
          } else if (data.status === 'ativa' || data.status === 'retornando' || data.status === 'em_ocorrencia') {
            sv.Status = 'ativo';
          }
        }
        // Deslocar militares de outras viaturas para garantir que pertençam a apenas uma
        const meusMembros = new Set([
          sv.comandanteId,
          sv.motoristaId,
          ...(sv.tripulantes || []).map(t => t.id)
        ].filter(Boolean));

        (s.servicoViaturas || []).forEach(outra => {
          if (outra.id === sv.id || outra.Status === 'encerrado') return;
          if (outra.comandanteId && meusMembros.has(outra.comandanteId)) {
            outra.comandanteId = '';
            outra.comandante = '';
          }
          if (outra.motoristaId && meusMembros.has(outra.motoristaId)) {
            outra.motoristaId = '';
            outra.motorista = '';
          }
          if (outra.tripulantes && Array.isArray(outra.tripulantes)) {
            outra.tripulantes = outra.tripulantes.filter(t => !meusMembros.has(t.id));
          }
        });
        this.save();
        return { success: true };
      }

      case 'encerrarServicoViatura': {
        const agoraEnc = this._now();
        const alvos = data.servicoViaturaId
          ? (s.servicoViaturas || []).filter(sv => sv.id === data.servicoViaturaId && sv.Status !== 'removido')
          : (s.servicoViaturas || []).filter(sv => sv.servicoId === data.servicoId && sv.Status === 'ativo');
        alvos.forEach(sv => {
          sv.Status = 'encerrado';
          sv.status = 'encerrada';
          sv.horarioRetorno = agoraEnc;
          s.rotina.push({ id: 'r-svr-' + Date.now(), horario: agoraEnc, nome: `🚒 Viatura colocada na Reserva: ${sv.viaturaNome}`, programa: 'Viaturas', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agoraEnc });
        });
        this.save();
        return { success: true };
      }

      case 'despacharViatura': {
        const sv = (s.servicoViaturas || []).find(x => x.id === data.servicoViaturaId);
        if (!sv) return { success: false, error: 'Viatura não encontrada' };
        const now2 = this._now();
        sv.horarioSaida = now2;
        sv.status = 'em_ocorrencia';
        const tripIds = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
        if (s.telegrafia && tripIds.includes(s.telegrafia.militarId)) {
          s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: now2 });
          s.telegrafia = null;
          s.telegrafiaVazioDesde = now2;
          const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: now2, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now2 };
          s.rotina.push(evtTeleVazia);
          TimelineStore.add(evtTeleVazia, s.servico?.id);
          s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Telegrafista despachado — telegrafia operando vazia`, tipo: 'telegrafia', horario: now2, lida: false });
        }
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${sv.viaturaNome} despachada para ocorrência`, tipo: 'alerta', horario: now2, lida: false });
        const num = data.ocorrenciaNumero || '';
        const titulo = data.ocorrenciaTitulo || '';
        const evtDesp = { id: 'r-desp-' + Date.now(), horario: now2, nome: `🚨 Despacho: ${sv.viaturaNome}${num ? ' — #'+num+' '+titulo : ''}`, programa: 'Ocorrência', responsavel: sv.motorista || sv.comandante || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now2 };
        s.rotina.push(evtDesp);
        TimelineStore.add(evtDesp, s.servico?.id);
        this.save();
        return { success: true };
      }

      case 'retornarViatura': {
        const svr = (s.servicoViaturas || []).find(x => x.id === (data.servicoViaturaId || data.id));
        if (!svr) return { success: false, error: 'Viatura não encontrada' };
        const agora = data.horarioRetorno || this._now();
        svr.horarioRetorno = agora;
        svr.status = data.destinoStatus || data.status || 'ativa';
        const ocFinalizar = (s.ocorrencias || []).find(oc => oc.servicoId === svr.servicoId && (oc.viaturaIds || []).includes(svr.viaturaId) && oc.status !== 'finalizada' && oc.status !== 'cancelada');
        if (ocFinalizar) {
          const outrasViaturas = (s.servicoViaturas || []).filter(v => v.id !== svr.id && (ocFinalizar.viaturaIds || []).includes(v.viaturaId) && v.status === 'em_ocorrencia');
          if (outrasViaturas.length === 0) {
            ocFinalizar.horaRetorno = agora;
            ocFinalizar.status = 'finalizada';
            const evtOcf = { id: 'r-ocf-' + Date.now(), horario: agora, nome: '✅ Ocorrência #' + (ocFinalizar.numero || '') + ' finalizada — viatura(s) retornou à base', programa: 'Ocorrências', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agora };
            s.rotina.push(evtOcf);
            TimelineStore.add(evtOcf, s.servico?.id);
          }
        }
        const evtRet = { id: 'r-ret-' + Date.now(), horario: agora, nome: `🏠 Retorno à base: ${svr.viaturaNome}`, programa: 'Ocorrências', responsavel: svr.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: agora };
        s.rotina.push(evtRet);
        TimelineStore.add(evtRet, s.servico?.id);
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${svr.viaturaNome} retornou à base`, tipo: 'info', horario: agora, lida: false });

        // Se a telegrafia estava desocupada (vazia), alguém da composição da viatura assume a telegrafia
        const isVazia = !s.telegrafia || !s.telegrafia.militarId || s.telegrafia.militarId === '__VAZIA__' || !s.telegrafia.operador || s.telegrafia.operador === '---';
        if (isVazia) {
          let militarIdTele = data.novoTelegrafistaId;
          let militarNomeTele = data.novoTelegrafistaNome;
          if (!militarIdTele) {
            if (svr.tripulantes && svr.tripulantes.length > 0 && svr.tripulantes[0]?.id) {
              militarIdTele = svr.tripulantes[0].id;
              militarNomeTele = svr.tripulantes[0].nome;
            } else if (svr.motoristaId) {
              militarIdTele = svr.motoristaId;
              militarNomeTele = svr.motorista;
            } else if (svr.comandanteId) {
              militarIdTele = svr.comandanteId;
              militarNomeTele = svr.comandante;
            }
          }
          if (militarIdTele) {
            if (!militarNomeTele) {
              const milObj = (s.militares || []).find(m => m.id === militarIdTele);
              militarNomeTele = milObj ? milObj.nome : 'Militar';
            }
            const iniVazia = s.telegrafiaVazioDesde || agora;
            let duracaoStr = data.tempoVazia || '';
            if (!duracaoStr) {
              try {
                const pI = String(iniVazia).split(':');
                const pF = String(agora).split(':');
                let diff = ((parseInt(pF[0])||0)*60 + (parseInt(pF[1])||0)) - ((parseInt(pI[0])||0)*60 + (parseInt(pI[1])||0));
                if (diff < 0) diff += 1440;
                const h = Math.floor(diff / 60);
                const m = diff % 60;
                duracaoStr = h > 0 ? `${h}h ${m}min` : (diff === 0 ? 'menos de 1 min' : `${m} min`);
              } catch(e) { duracaoStr = '1 min'; }
            }
            if (!s.telegrafiaHistorico) s.telegrafiaHistorico = [];
            s.telegrafiaHistorico.push({ operador: '---', inicio: iniVazia, fim: agora, duracao: duracaoStr });
            s.telegrafia = { operador: militarNomeTele, militarId: militarIdTele, horario: agora };
            s.telegrafiaVazioDesde = null;

            const evtTeleAuto = {
              id: 'r-tele-' + Date.now(),
              horario: agora,
              nome: `📡 ${militarNomeTele} assumiu a telegrafia após retorno da viatura ${svr.viaturaNome} (telegrafia esteve vazia por ${duracaoStr})`,
              programa: 'Telegrafia',
              responsavel: militarNomeTele,
              status: 'concluida',
              concluidoPor: 'Sistema',
              horaConclusao: agora
            };
            s.rotina.push(evtTeleAuto);
            TimelineStore.add(evtTeleAuto, s.servico?.id);
          }
        }
        this.save();
        return { success: true };
      }

      case 'criarOcorrencia': {
        const existentes = (s.ocorrencias || []).filter(o => o.servicoId === data.servicoId && o.Status !== 'removido');
        const num = String(existentes.length + 1).padStart(3, '0');
        const now3 = data.horaAcionamento || data.horaOcorrencia || this._now();
        const oc = {
          id: 'oc-' + Date.now(),
          numero: num,
          servicoId: data.servicoId,
          titulo: data.titulo,
          natureza: data.natureza || '',
          endereco: data.endereco || '',
          descricao: data.descricao || '',
          viaturaIds: data.viaturaIds || [],
          efetivo: data.efetivo || [],
          horaAcionamento: now3,
          horaRetorno: '',
          prontidaoCor: data.prontidaoCor || '',
          status: 'em_atendimento',
          Status: 'ativo'
        };
        s.ocorrencias = s.ocorrencias || [];
        s.ocorrencias.push(oc);

        if (data.servicoViaturaIds && data.servicoViaturaIds.length > 0) {
          data.servicoViaturaIds.forEach(svId => {
            const sv = (s.servicoViaturas || []).find(x => x.id === svId);
            if (sv) {
              sv.horarioSaida = now3;
              sv.status = 'em_ocorrencia';
              const tripIds = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
              if (s.telegrafia && tripIds.includes(s.telegrafia.militarId)) {
                s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: now3 });
                s.telegrafia = null;
                s.telegrafiaVazioDesde = now3;
              }
              const evtDesp = { id: 'r-desp-' + Date.now() + Math.random(), horario: now3, nome: `🚨 Despacho/Empenho: ${sv.viaturaNome} — #${num} ${data.titulo}`, programa: 'Ocorrência', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now3 };
              s.rotina.push(evtDesp);
              TimelineStore.add(evtDesp, s.servico?.id);
            }
          });
        }

        if (data.telegrafiaVazia || data.novoTelegrafistaId === '__VAZIA__') {
          s.telegrafia = null;
          s.telegrafiaVazioDesde = now3;
          const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: now3, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now3 };
          s.rotina.push(evtTeleVazia);
          TimelineStore.add(evtTeleVazia, s.servico?.id);
        } else if (data.novoTelegrafistaId && data.novoTelegrafistaId !== '__VAZIA__') {
          const mNovo = (s.militares || []).find(x => x.id === data.novoTelegrafistaId);
          const nomeNovo = mNovo ? mNovo.nome : 'Novo militar';
          s.telegrafia = { operador: nomeNovo, militarId: data.novoTelegrafistaId, horario: now3 };
          const evtTeleNovo = { id: 'r-tele-' + Date.now(), horario: now3, nome: `📡 ${nomeNovo} assumiu a telegrafia`, programa: 'Telegrafia', responsavel: nomeNovo, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now3 };
          s.rotina.push(evtTeleNovo);
          TimelineStore.add(evtTeleNovo, s.servico?.id);
        }

        const evtOc = { id: 'r-oc-' + Date.now(), horario: now3, nome: `🚨 Ocorrência #${num}: ${data.titulo}${data.endereco ? ' (' + data.endereco + ')' : ''}`, programa: 'Ocorrências', responsavel: data.efetivo?.[0] || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now3 };
        s.rotina.push(evtOc);
        TimelineStore.add(evtOc, s.servico?.id);
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Nova ocorrência #${num}: ${data.titulo}`, tipo: 'urgente', horario: now3, lida: false });
        this.save();
        return { success: true, id: oc.id, numero: num };
      }

      case 'editarOcorrencia': {
        const oce = (s.ocorrencias || []).find(x => x.id === data.id);
        if (!oce) return { success: false, error: 'Ocorrência não encontrada' };
        if (data.titulo !== undefined) oce.titulo = data.titulo;
        if (data.natureza !== undefined) oce.natureza = data.natureza;
        if (data.endereco !== undefined) oce.endereco = data.endereco;
        if (data.descricao !== undefined) oce.descricao = data.descricao;
        this.save();
        return { success: true };
      }

      case 'empenharReforcoOcorrencia': {
        const ocr = (s.ocorrencias || []).find(x => x.id === data.ocorrenciaId);
        if (!ocr) return { success: false, error: 'Ocorrência não encontrada' };
        const now = data.horario || this._now();
        const svIds = data.servicoViaturaIds || [];
        if (!svIds.length) return { success: false, error: 'Nenhuma viatura informada' };

        ocr.viaturaIds = ocr.viaturaIds || [];
        ocr.efetivo = ocr.efetivo || [];

        svIds.forEach(svId => {
          const sv = (s.servicoViaturas || []).find(x => x.id === svId);
          if (sv) {
            if (!ocr.viaturaIds.includes(sv.viaturaId)) ocr.viaturaIds.push(sv.viaturaId);
            const membros = [sv.motorista, ...(sv.tripulantes || []).map(t => t.nome)].filter(Boolean);
            membros.forEach(m => { if (!ocr.efetivo.includes(m)) ocr.efetivo.push(m); });
            sv.horarioSaida = now;
            sv.status = 'em_ocorrencia';

            const tripIds = [sv.comandanteId, sv.motoristaId, ...(sv.tripulantes || []).map(t => t.id)].filter(Boolean);
            if (s.telegrafia && tripIds.includes(s.telegrafia.militarId)) {
              s.telegrafiaHistorico.push({ ...s.telegrafia, horarioSaida: now });
              s.telegrafia = null;
              s.telegrafiaVazioDesde = now;
            }

            const evtApoio = { id: 'r-desp-' + Date.now() + Math.random(), horario: now, nome: `🚨 Apoio/Empenho: ${sv.viaturaNome} despachada para Ocorrência #${ocr.numero}${data.motivoApoio ? ' (' + data.motivoApoio + ')' : ''}`, programa: 'Ocorrência', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
            s.rotina.push(evtApoio);
            TimelineStore.add(evtApoio, s.servico?.id);
            s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${sv.viaturaNome} despachada em apoio à ocorrência #${ocr.numero}`, tipo: 'alerta', horario: now, lida: false });
          }
        });

        if (data.telegrafiaVazia || data.novoTelegrafistaId === '__VAZIA__') {
          s.telegrafia = null;
          s.telegrafiaVazioDesde = now;
          const evtTeleVazia = { id: 'r-tele-' + Date.now(), horario: now, nome: '📡 Telegrafia vazia — sem operador disponível no quartel', programa: 'Telegrafia', responsavel: 'Telegrafia', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
          s.rotina.push(evtTeleVazia);
          TimelineStore.add(evtTeleVazia, s.servico?.id);
        } else if (data.novoTelegrafistaId && data.novoTelegrafistaId !== '__VAZIA__') {
          const mNovo = (s.militares || []).find(x => x.id === data.novoTelegrafistaId);
          const nomeNovo = mNovo ? mNovo.nome : 'Novo militar';
          s.telegrafia = { operador: nomeNovo, militarId: data.novoTelegrafistaId, horario: now };
          const evtTeleNovo = { id: 'r-tele-' + Date.now(), horario: now, nome: `📡 ${nomeNovo} assumiu a telegrafia`, programa: 'Telegrafia', responsavel: nomeNovo, status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
          s.rotina.push(evtTeleNovo);
          TimelineStore.add(evtTeleNovo, s.servico?.id);
        }

        this.save();
        return { success: true };
      }

      case 'finalizarOcorrencia': {
        const ocf = (s.ocorrencias || []).find(x => x.id === (data.id || data.ocorrenciaId));
        if (!ocf) return { success: false, error: 'Ocorrência não encontrada' };
        const now = data.horaRetorno || this._now();

        // Caso seja liberação parcial de apenas uma viatura
        if (data.liberarApenasServicoViaturaId) {
          const sv = (s.servicoViaturas || []).find(x => x.id === data.liberarApenasServicoViaturaId);
          if (sv) {
            sv.horarioRetorno = now;
            sv.status = data.destinoStatus || 'ativa';
            ocf.viaturaIds = (ocf.viaturaIds || []).filter(vid => vid !== sv.viaturaId);
            if (!ocf.viaturasLiberadas) ocf.viaturasLiberadas = [];
            ocf.viaturasLiberadas.push({ viaturaId: sv.viaturaId, viaturaNome: sv.viaturaNome, horaRetorno: now, status: sv.status });
            const evtDesemp = { id: 'r-ret-' + Date.now(), horario: now, nome: `🏠 Desempenho: ${sv.viaturaNome} liberada da Ocorrência #${ocf.numero} (${sv.status === 'retornando' ? 'retornando' : 'disponível na base'})`, programa: 'Ocorrências', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
            s.rotina.push(evtDesemp);
            TimelineStore.add(evtDesemp, s.servico?.id);
            s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Viatura ${sv.viaturaNome} liberada da ocorrência #${ocf.numero}`, tipo: 'info', horario: now, lida: false });
          }
          this.save();
          return { success: true };
        }

        // Encerramento completo da ocorrência
        ocf.horaRetorno = now;
        ocf.status = data.status || 'finalizada';
        if (data.desfecho) ocf.desfecho = data.desfecho;
        if (data.duracao) ocf.duracao = data.duracao;

        const viaturasDaOcorr = (s.servicoViaturas || []).filter(sv => (ocf.viaturaIds || []).includes(sv.viaturaId) && sv.servicoId === ocf.servicoId);
        viaturasDaOcorr.forEach(sv => {
          sv.horarioRetorno = now;
          sv.status = data.destinoStatus || 'ativa';
          const msgStatus = sv.status === 'retornando' ? 'em trânsito para o quartel' : 'disponível na base';
          const evtRetV = { id: 'r-ret-' + Date.now() + Math.random(), horario: now, nome: `🏠 ${sv.status === 'retornando' ? 'Em retorno' : 'Retorno à base'}: ${sv.viaturaNome} (${msgStatus})`, programa: 'Ocorrências', responsavel: sv.motorista || '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
          s.rotina.push(evtRetV);
          TimelineStore.add(evtRetV, s.servico?.id);
        });

        const statusTexto = ocf.status === 'cancelada' ? 'cancelada' : (ocf.status === 'trote' ? 'trote confirmado' : 'finalizada');
        const evtOcf = { id: 'r-ocf-' + Date.now(), horario: now, nome: `✅ Ocorrência #${ocf.numero || ''} ${statusTexto}${data.desfecho ? ' — ' + data.desfecho : ''}`, programa: 'Ocorrências', responsavel: '-', status: 'concluida', concluidoPor: 'Sistema', horaConclusao: now };
        s.rotina.push(evtOcf);
        TimelineStore.add(evtOcf, s.servico?.id);
        s.notificacoes.unshift({ id: 'n-' + Date.now(), mensagem: `Ocorrência #${ocf.numero || ''} ${statusTexto}${viaturasDaOcorr.length ? ' — viatura(s) liberada(s)' : ''}`, tipo: 'info', horario: now, lida: false });
        this.save();
        return { success: true };
      }

      case 'editarServico': {
        const srv = s.servico;
        if (!srv) return { success: false, error: 'Nenhum serviço ativo' };
        if (data.comandanteId !== undefined) { srv.comandanteId = data.comandanteId; srv.comandanteNome = data.comandanteNome || ''; }
        if (data.prontidao !== undefined) srv.prontidao = data.prontidao;
        if (data.equipe !== undefined) srv.equipe = data.equipe;
        if (data.observacoes !== undefined) srv.observacoes = data.observacoes;
        this.save();
        return { success: true };
      }

      case 'redefinirSenha': {
        const usu = (s.usuarios || []).find(u => u.id === data.usuarioId);
        if (!usu) return { success: false, error: 'Usuário não encontrado' };
        usu.senha = '123456';
        usu.mustChangePassword = true;
        this.save();
        return { success: true, mustChangePassword: true };
      }

      case 'alterarMinhaSenha': {
        const usua = (s.usuarios || []).find(u => u.id === data.usuarioId);
        if (!usua) return { success: false, error: 'Usuário não encontrado' };
        usua.senha = data.novaSenha;
        usua.mustChangePassword = false;
        this.save();
        return { success: true };
      }

      case 'criarCivis': {
        if (!data.nome || !data.reCpf) return { success: false, error: 'Nome e RE/CPF obrigatórios' };
        if (!s.usuarios) s.usuarios = [];
        if (s.usuarios.some(u => u.reCpf === data.reCpf)) return { success: false, error: 'Já existe usuário com este RE/CPF' };
        const cid = 'u-' + Date.now();
        s.usuarios.push({ id: cid, nome: data.nome, reCpf: data.reCpf, senha: '123456', perfil: 'operador', email: data.email || '', telefone: data.telefone || '', ativo: true, mustChangePassword: true, nivelPermissao: 'POSTO', postos: [] });
        this.save();
        return { success: true, userId: cid, mustChangePassword: true, login: data.reCpf, senhaPadrao: '123456' };
      }

      case 'getPostosComServico': {
        this._checkAutoEncerrarServico(s);
        const postos = s.postosServico || [];
        const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
        const servicosAtivos = (s.servicos || []).filter(sv => sv.data === hoje && sv.Status === 'ativo');
        const svMap = {};
        servicosAtivos.forEach(sv => { svMap[sv.postoId] = sv; });
        if (s.servico && s.servico.Status === 'ativo' && s.servico.postoId) {
          svMap[s.servico.postoId] = s.servico;
        }
        return {
          postos: postos.map(p => {
            const srv = svMap[p.id] || null;
            const equipe = srv ? (Array.isArray(srv.equipe) ? srv.equipe : []) : [];
            return {
              id: p.id, nome: p.nome, tipo: p.tipo || 'POSTO',
              servico: srv ? { id: srv.id, prontidao: srv.prontidao || 'verde', comandanteNome: srv.comandanteNome || '-', comandanteId: srv.comandanteId || '', horarioInicio: srv.horarioInicio || '', equipe: equipe, viaturas: srv.viaturas || [], observacoes: srv.observacoes || '' } : null
            };
          })
        };
      }

      case 'getServicosAtivos': {
        this._checkAutoEncerrarServico(s);
        const user = (s.usuarios || []).find(u => u.id === data.usuarioId);
        const isAdmin = user && (user.perfil === 'admin' || user.perfil === 'superadmin');
        const isGB = user && user.nivelPermissao === 'GB';
        const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
        let servicos = (s.servicos || []).filter(sv => sv.data === hoje && sv.Status !== 'encerrado');
        if (s.servico && s.servico.Status === 'ativo') {
          const exists = servicos.find(sv => sv.id === s.servico.id);
          if (!exists) servicos.push(s.servico);
        }
        if (!isAdmin && !isGB && user) {
          const userPostos = (s.usuariosPostos || []).filter(up => up.usuarioId === user.id && up.Status === 'ativo');
          const userPostoIds = userPostos.map(up => up.postoId);
          if (userPostoIds.length > 0) {
            servicos = servicos.filter(sv => userPostoIds.includes(sv.postoId));
          }
        }
        const postosAll = s.postosServico || [];
        const postosMap = {};
        postosAll.forEach(p => { postosMap[p.id] = p; });
        return servicos.map(sv => {
          const posto = postosMap[sv.postoId];
          const rotina = s.rotina || [];
          const atividades = rotina.filter(a => a.servicoId === sv.id);
          const concluidas = atividades.filter(a => a.status === 'concluida').length;
          let equipe = [];
          try { equipe = Array.isArray(sv.equipe) ? sv.equipe : JSON.parse(sv.equipe || '[]'); } catch(e) {}
          return {
            id: sv.id, data: sv.data, horarioInicio: sv.horarioInicio || sv.inicio || '',
            horarioFim: sv.horarioFim || '', prontidao: sv.prontidao || 'verde',
            comandanteId: sv.comandanteId || '', comandanteNome: sv.comandanteNome || '',
            postoId: sv.postoId, postoNome: posto ? posto.nome : '',
            postoTipo: posto ? posto.tipo : '', equipe: equipe,
            totalAtividades: atividades.length || sv.totalAtividades || 0,
            totalConcluidas: concluidas || sv.totalConcluidas || 0,
            Status: sv.Status || 'ativo', observacoes: sv.observacoes || ''
          };
        });
      }

      case 'getTiposViatura': {
        return s.tiposViatura || [
          { id: 'tv-1', nome: 'Incêndio', sigla: 'ABT', cor: '#e53935', descricao: 'Autotanque de Bombeiros Táticos', Status: 'ativo' },
          { id: 'tv-2', nome: 'Urgência', sigla: 'URG', cor: '#ff9100', descricao: 'Unidade de Resgate e Socorro', Status: 'ativo' },
          { id: 'tv-3', nome: 'Capacidade Volante', sigla: 'CV', cor: '#ffd600', descricao: 'Capacidade Volante', Status: 'ativo' },
          { id: 'tv-4', nome: 'Apoio de Água', sigla: 'APA', cor: '#2979ff', descricao: 'Apoio de Água', Status: 'ativo' },
          { id: 'tv-5', nome: 'Socorro', sigla: 'SOC', cor: '#00c853', descricao: 'Socorro Geral', Status: 'ativo' },
          { id: 'tv-6', nome: 'Alarme', sigla: 'ALO', cor: '#ab47bc', descricao: 'Alarme', Status: 'ativo' },
          { id: 'tv-7', nome: 'Motocicleta', sigla: 'MOT', cor: '#78909c', descricao: 'Motocicleta', Status: 'ativo' }
        ];
      }

      case 'getNaturezas': {
        return s.naturezas || [];
      }

      case 'registrarLog': {
        if (!s.logs) s.logs = [];
        s.logs.unshift({ id: 'log-' + Date.now(), dataHora: new Date().toISOString(), acao: data.acao || 'acao', usuario: Auth.userName || 'sistema', detalhes: data.detalhes || '', modulo: data.modulo || '' });
        if (s.logs.length > 500) s.logs = s.logs.slice(0, 500);
        this.save();
        return { success: true };
      }

      case 'updateConfig': {
        if (data.config && typeof data.config === 'object') {
          if (!s.config) s.config = {};
          Object.assign(s.config, data.config);
          this.save();
        }
        return { success: true };
      }

      case 'importarAtividadesPadrao': {
        const atvs = data.atividades || [];
        const existentes = new Set((s.atividadesPadrao || []).map(a => a.nome));
        let importadas = 0, ignoradas = 0;
        atvs.forEach(a => {
          if (existentes.has(a.nome)) { ignoradas++; return; }
          s.atividadesPadrao.push({ id: 'd-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), ...a, Status: 'ativo' });
          importadas++;
        });
        this.save();
        return { success: true, importadas, ignoradas };
      }

      default: return { success: true };
    }
  }
};
