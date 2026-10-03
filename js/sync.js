/**
 * Módulo de Sincronização em Tempo Real (Sync) do SGPO
 */
const Sync = {
  listeners: {},
  intervalId: null,
  servicoId: null,
  isSyncing: false,
  _lastData: null,
  _bc: null,
  _visibilityBound: false,

  init() {
    if (typeof BroadcastChannel !== 'undefined' && !this._bc) {
      try {
        this._bc = new BroadcastChannel('sgpo_sync');
        this._bc.onmessage = (e) => {
          if (!e.data) return;
          if (e.data.type === 'sync_data' && e.data.data) {
            this._processData(e.data.data);
          } else if (e.data.type === 'force_refresh') {
            this.syncNow(true);
          } else if (e.data.type === 'config_changed' && e.data.config) {
            this.emit('config_updated', e.data.config);
          }
        };
      } catch(e) {}
    }
  },

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  },

  emit(event, ...args) {
    const list = this.listeners[event] || [];
    list.forEach(cb => {
      try { cb(...args); } catch(e) { console.error('Erro no listener de sync:', e); }
    });
  },

  start(servicoId, intervalMs = 30000) {
    this.init();
    this.servicoId = servicoId;
    this.stop();

    this.intervalId = setInterval(() => {
      this.syncNow();
    }, intervalMs);

    // Sincroniza imediatamente ao retornar para a aba
    if (!this._visibilityBound) {
      this._visibilityBound = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.servicoId) {
          this.syncNow();
        }
      });

      window.addEventListener('focus', () => {
        if (this.servicoId) {
          this.syncNow();
        }
      });
    }
  },

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  },

  _processData(data) {
    if (!data) return;
    this._lastData = data;
    const activeSId = data.servico?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('sgpo_active_servico_id') : null);
    if (activeSId) {
      if (Array.isArray(data.ocorrencias)) {
        data.ocorrencias = data.ocorrencias.filter(o => o && o.servicoId === activeSId);
      }
      if (Array.isArray(data.rotina)) {
        data.rotina = data.rotina.filter(r => {
          if (!r) return false;
          if (r.servicoId && r.servicoId !== activeSId) return false;
          const isOc = r.id?.startsWith('r-oc-') || r.id?.startsWith('r-desp-') || r.id?.startsWith('r-ret-') || r.id?.startsWith('r-ocf-') || r.programa === 'Ocorrências' || r.programa === 'Ocorrência' || r.nome?.includes('🚨');
          if (isOc && (!r.servicoId || r.servicoId !== activeSId)) return false;
          return true;
        });
      }
    }
    if (typeof API !== 'undefined' && typeof API._reconciliarViaturasNaBase === 'function') {
      API._reconciliarViaturasNaBase(data);
    } else if (typeof API !== 'undefined' && typeof API._reconciliarViaturasBase === 'function') {
      API._reconciliarViaturasBase(data);
    }
    if (data.servico) this.emit('servico_updated', data.servico);
    if (data.rotina) this.emit('rotina_updated', data.rotina);
    if (data.ocorrencias) this.emit('ocorrencias_updated', data.ocorrencias);
    if (data.servicoViaturas) this.emit('viaturas_updated', data.servicoViaturas);
    if (data.telegrafia !== undefined) this.emit('telegrafia_updated', data.telegrafia, data.telegrafiaVazioDesde);
    if (data.telegrafiaVazioDesde) this.emit('telegrafiavazio_updated', data.telegrafiaVazioDesde);
    if (data.oficiais) this.emit('oficiais_updated', data.oficiais);
    if (data.notificacoes) this.emit('notificacoes_updated', data.notificacoes);
    if (data.extras) this.emit('extras_updated', data.extras);
  },

  async syncNow(forceNetwork = true) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      if (typeof API !== 'undefined' && API.getServicoAtual) {
        const uId = (typeof Auth !== 'undefined' && Auth.userId) ? Auth.userId : undefined;
        const data = await API.getServicoAtual(uId, forceNetwork);
        if (data) {
          this._processData(data);
        }
      }
    } catch(e) {
      console.warn('Sync falhou:', e);
    } finally {
      this.isSyncing = false;
    }
  },

  async pull(forceNetwork = true) {
    return this.syncNow(forceNetwork);
  },

  async requestImmediatePull(forceNetwork = true) {
    return this.syncNow(forceNetwork);
  },

  broadcast(data) {
    this.init();
    if (this._bc && data) {
      try {
        this._bc.postMessage({ type: 'sync_data', data });
      } catch(e) {}
    }
  },

  broadcastForceRefresh() {
    this.init();
    if (this._bc) {
      try {
        this._bc.postMessage({ type: 'force_refresh' });
      } catch(e) {}
    }
  },

  broadcastConfigChanged(config) {
    this.init();
    if (this._bc && config) {
      try {
        this._bc.postMessage({ type: 'config_changed', config });
      } catch(e) {}
    }
  }
};

Sync.init();

if (typeof window !== 'undefined') window.Sync = Sync;
if (typeof module !== 'undefined' && module.exports) module.exports = Sync;
