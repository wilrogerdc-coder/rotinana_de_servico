const Sync = {
  interval: null,
  listeners: new Map(),
  channel: null,
  servicoId: null,
  _lastData: null,
  _baseInterval: 10000,
  _activeInterval: 10000,
  _idleInterval: 30000,
  _burstInterval: 5000,
  _burstUntil: 0,
  _isIdle: false,
  _isPulling: false,
  _hasPendingPull: false,
  _pendingPullTimer: null,
  _debounceTimer: null,
  _lastPullTime: 0,
  _lastConfigHash: null,
  _keepaliveTimer: null,
  _visibilityHandler: null,
  _focusHandler: null,
  _onlineHandler: null,
  _activityHandler: null,

  start(servicoId, intervalMs) {
    this.stop();
    this.servicoId = servicoId;
    
    // Intervalo configurado: padrão ágil de 10s quando ativo (máx 15s)
    const configured = parseInt(intervalMs) || 10000;
    this._activeInterval = Math.max(3000, Math.min(configured, 15000));
    this._baseInterval = this._activeInterval;
    this._idleInterval = Math.max(20000, this._activeInterval * 2);
    this._isIdle = false;
    this._isPulling = false;
    this._hasPendingPull = false;
    this._lastPullTime = 0;

    try {
      this.channel = new BroadcastChannel('sgpo_sync');
      this.channel.onmessage = (e) => {
        if (!e.data) return;
        if (e.data.type === 'update') {
          this._processData(e.data.payload);
        } else if (e.data.type === 'config_changed') {
          this._onConfigChanged(e.data);
        } else if (e.data.type === 'force_refresh') {
          this.requestImmediatePull(true);
        }
      };
    } catch (err) {}

    this._visibilityHandler = () => {
      if (document.hidden) {
        this._isIdle = true;
      } else {
        this._isIdle = false;
        this.triggerBurst(15000);
        this.requestImmediatePull(true);
        this._schedulePull();
      }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);

    this._focusHandler = () => {
      this._isIdle = false;
      this.triggerBurst(15000);
      this.requestImmediatePull(true);
      this._schedulePull();
    };
    window.addEventListener('focus', this._focusHandler);

    this._onlineHandler = () => {
      this._isIdle = false;
      if (typeof SyncQueue !== 'undefined') SyncQueue.sync();
      this.requestImmediatePull(true);
      this._schedulePull();
    };
    window.addEventListener('online', this._onlineHandler);

    // Detecção leve de atividade do usuário para agilizar sincronização
    let lastActivityLog = 0;
    this._activityHandler = () => {
      const now = Date.now();
      if (now - lastActivityLog > 8000) {
        lastActivityLog = now;
        if (this._isIdle) {
          this._isIdle = false;
          this._schedulePull();
        }
      }
    };
    window.addEventListener('pointerdown', this._activityHandler, { passive: true });
    window.addEventListener('keydown', this._activityHandler, { passive: true });

    this._startKeepalive();
    this.pull(true);
    this._schedulePull();
  },

  stop() {
    if (this.interval) {
      clearTimeout(this.interval);
      this.interval = null;
    }
    if (this.channel) {
      try { this.channel.close(); } catch (e) {}
      this.channel = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._focusHandler) {
      window.removeEventListener('focus', this._focusHandler);
      this._focusHandler = null;
    }
    if (this._onlineHandler) {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    }
    if (this._activityHandler) {
      window.removeEventListener('pointerdown', this._activityHandler);
      window.removeEventListener('keydown', this._activityHandler);
      this._activityHandler = null;
    }
    if (this._keepaliveTimer) {
      clearInterval(this._keepaliveTimer);
      this._keepaliveTimer = null;
    }
    this._clearTimers();
  },

  _clearTimers() {
    if (this._pendingPullTimer) {
      clearTimeout(this._pendingPullTimer);
      this._pendingPullTimer = null;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  },

  triggerBurst(durationMs = 20000) {
    this._burstUntil = Date.now() + durationMs;
  },

  _schedulePull() {
    if (this.interval) clearTimeout(this.interval);
    let delay = this._baseInterval;
    const now = Date.now();

    if (this._isIdle || document.hidden) {
      delay = this._idleInterval;
    } else if (now < this._burstUntil) {
      delay = this._burstInterval;
    } else {
      delay = this._activeInterval;
    }

    this.interval = setTimeout(() => {
      this.pull().then(() => {
        if (this.servicoId) this._schedulePull();
      });
    }, delay);
  },

  _startKeepalive() {
    this._keepaliveTimer = setInterval(() => {
      if (!document.hidden && this.servicoId) {
        API.registrarHeartbeat().catch(() => {});
      }
    }, 30000);
  },

  requestImmediatePull(force = true) {
    this._clearTimers();
    this.triggerBurst(15000);
    if (this._isPulling) {
      this._hasPendingPull = true;
      return;
    }
    this.pull(force);
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

  async pull(force = false) {
    if (!this.servicoId) return;

    if (this._isPulling) {
      this._hasPendingPull = true;
      return;
    }

    const now = Date.now();
    const minInterval = force ? 150 : (this._isIdle ? 8000 : 1000);
    const elapsed = now - this._lastPullTime;

    if (elapsed < minInterval) {
      if (force) {
        if (!this._debounceTimer) {
          this._debounceTimer = setTimeout(() => {
            this._debounceTimer = null;
            this.pull(true);
          }, minInterval - elapsed + 10);
        }
      } else {
        if (!this._pendingPullTimer) {
          this._pendingPullTimer = setTimeout(() => {
            this._pendingPullTimer = null;
            this.pull();
          }, minInterval - elapsed + 20);
        }
      }
      return;
    }

    if (typeof SyncQueue !== 'undefined' && SyncQueue.queue.length > 0) {
      console.log('[Sync] Pull ignorado pois há atualizações locais pendentes.');
      return;
    }

    this._isPulling = true;
    this._lastPullTime = Date.now();

    try {
      const data = await API.getServicoAtual(Auth.userId, true);
      if (data && data.servico) {
        this._processData(data);
        this.broadcast(data);
        this._checkConfigChanges(data);
      }
    } catch (err) {
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        console.log('[Sync] Pull offline (tentaremos novamente):', err.message);
      } else {
        console.log('[Sync] Pull error:', err.message);
      }
    } finally {
      this._isPulling = false;
      if (this._hasPendingPull) {
        this._hasPendingPull = false;
        setTimeout(() => this.pull(true), 100);
      }
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

    const prev = this._lastData;
    this._lastData = { ...data };

    const changed = (key, newVal) => {
      const old = prev ? prev[key] : null;
      return JSON.stringify(old) !== JSON.stringify(newVal);
    };

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
