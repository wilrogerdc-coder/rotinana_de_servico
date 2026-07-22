const Sync = {
  interval: null,
  listeners: new Map(),
  channel: null,
  servicoId: null,
  _lastData: null,
  _baseInterval: 5000,
  _activeInterval: 3000,
  _idleInterval: 30000,
  _isIdle: false,
  _pendingPull: false,
  _lastPullTime: 0,
  _lastConfigHash: null,
  _keepaliveTimer: null,
  _visibilityHandler: null,
  _focusPullTimeout: null,

  start(servicoId, intervalMs = 5000) {
    this.stop();
    this.servicoId = servicoId;
    this._baseInterval = intervalMs || 5000;
    this._isIdle = false;
    this._lastPullTime = 0;

    this._schedulePull();

    try {
      this.channel = new BroadcastChannel('sgpo_sync');
      this.channel.onmessage = (e) => {
        if (e.data && e.data.type === 'update') {
          this._processData(e.data.payload);
        } else if (e.data && e.data.type === 'config_changed') {
          this._onConfigChanged(e.data);
        } else if (e.data && e.data.type === 'force_refresh') {
          this.pull();
        }
      };
    } catch (err) {}

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._isIdle = true;
      } else {
        this._isIdle = false;
        this._clearPendingPull();
        this._lastPullTime = 0;
        this.pull();
        this._schedulePull();
      }
    });

    window.addEventListener('focus', () => {
      this._isIdle = false;
      this._clearPendingPull();
      this._lastPullTime = 0;
      this.pull();
      this._schedulePull();
    });

    window.addEventListener('online', () => {
      this.pull();
      this._schedulePull();
    });

    this._startKeepalive();
    this.pull();
  },

  stop() {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = null;
    }
    this._clearPendingPull();
  },

  _schedulePull() {
    if (this.interval) clearTimeout(this.interval);
    const delay = this._isIdle ? this._idleInterval : this._baseInterval;
    this.interval = setTimeout(() => {
      this.pull().then(() => {
        if (this.servicoId) this._schedulePull();
      });
    }, delay);
  },

  _clearPendingPull() {
    if (this._focusPullTimeout) {
      clearTimeout(this._focusPullTimeout);
      this._focusPullTimeout = null;
    }
    this._pendingPull = false;
  },

  _startKeepalive() {
    this._keepaliveTimer = setInterval(() => {
      if (!document.hidden && this.servicoId) {
        API.registrarHeartbeat().catch(() => {});
      }
    }, 30000);
  },

  requestImmediatePull() {
    this._clearPendingPull();
    this.pull();
  },

  broadcast(payload) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'update', payload });
      } catch (e) {}
    }
  },

  broadcastConfigChanged(config) {
    if (!this.channel) {
      try { this.channel = new BroadcastChannel('sgpo_sync'); } catch (e) { return; }
    }
    try {
      this.channel.postMessage({ type: 'config_changed', config });
    } catch (e) {}
  },

  broadcastForceRefresh() {
    if (this.channel) {
      try {
        this.channel.postMessage({ type: 'force_refresh' });
      } catch (e) {}
    }
  },

  _onConfigChanged(data) {
    if (data.config) {
      const existing = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
      const merged = { ...existing, ...data.config };
      localStorage.setItem('sgpo_config', JSON.stringify(merged));
      if (API._config) API._config = merged;
      this.emit('config_updated', merged);
    }
  },

  async pull() {
    if (!this.servicoId) return;
    const now = Date.now();
    const minInterval = this._isIdle ? 15000 : 2000;
    if (now - this._lastPullTime < minInterval) return;

    this._lastPullTime = now;
    try {
      const data = await API.getServicoAtual(Auth.userId);
      if (data && data.servico) {
        this._processData(data);
        this.broadcast(data);
        this._checkConfigChanges(data);
      }
    } catch (err) {
      console.warn('Sync pull failed:', err.message);
    }
  },

  _checkConfigChanges(data) {
    const config = data.config || null;
    if (config) {
      const configHash = JSON.stringify(config);
      if (this._lastConfigHash !== configHash) {
        localStorage.setItem('sgpo_config', JSON.stringify(config));
        if (API._config) API._config = config;
        this.emit('config_updated', config);
      }
      this._lastConfigHash = configHash;
    }
  },

  _processData(data) {
    if (!data) return;

    const changed = (key, newVal) => {
      const old = this._lastData ? this._lastData[key] : null;
      return JSON.stringify(old) !== JSON.stringify(newVal);
    };

    const prev = this._lastData;
    this._lastData = { ...data };

    this.emit('servico_updated', data);

    if (changed('rotina', data.rotina)) {
      this.emit('rotina_updated', data.rotina);
      if (!document.hidden) Utils.notify('Rotina atualizada', 'info');
    }
    if (changed('telegrafia', data.telegrafia)) {
      this.emit('telegrafia_updated', data.telegrafia, data.telegrafiaVazioDesde);
      if (data.telegrafia?.militarNome && prev?.telegrafia?.militarId !== data.telegrafia.militarId) {
        Utils.notify('Telegrafia: ' + data.telegrafia.militarNome, 'info');
        Utils.playSound('telegrafia');
      }
    }
    if (changed('telegrafiaVazioDesde', data.telegrafiaVazioDesde)) {
      this.emit('telegrafiavazio_updated', data.telegrafiaVazioDesde);
    }
    if (changed('oficiais', data.oficiais)) {
      this.emit('oficiais_updated', data.oficiais);
    }
    if (changed('notificacoes', data.notificacoes)) {
      this.emit('notificacoes_updated', data.notificacoes);
      if (data.notificacoes && data.notificacoes.length > 0) {
        const unread = data.notificacoes.find(n => !n.lida);
        if (unread) {
          Utils.notify(unread.mensagem, 'info');
          Utils.playSound('aviso');
        }
      }
    }
    if (changed('extras', data.extras)) {
      this.emit('extras_updated', data.extras);
    }
    if (changed('servicoViaturas', data.servicoViaturas)) {
      this.emit('viaturas_updated', data.servicoViaturas);
    }
    if (changed('ocorrencias', data.ocorrencias)) {
      this.emit('ocorrencias_updated', data.ocorrencias);
      if (data.ocorrencias && data.ocorrencias.length > 0) {
        const newOcorr = data.ocorrencias.find(o => o.status === 'em_andamento');
        if (newOcorr && (!prev?.ocorrencias || !prev.ocorrencias.find(p => p.id === newOcorr.id))) {
          Utils.notify('Nova ocorrência: ' + newOcorr.titulo, 'warning');
          Utils.playSound('nova-ocorrencia');
        }
      }
    }
    if (changed('equipe', data.servico?.equipe)) {
      this.emit('equipe_updated', data.servico?.equipe || []);
    }
    if (changed('config', data.config)) {
      this._checkConfigChanges(data);
    }
  },

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  },

  off(event, callback) {
    if (this.listeners.has(event)) {
      const cbs = this.listeners.get(event).filter(cb => cb !== callback);
      this.listeners.set(event, cbs);
    }
  },

  emit(event, data) {
    const cbs = this.listeners.get(event) || [];
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error('Sync listener error:', e); }
    });
  }
};
