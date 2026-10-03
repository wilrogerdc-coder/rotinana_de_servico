const Utils = {
  formatTime(date) {
    if (!date) return '--:--';
    if (typeof date === 'string' && /^\d{2}:\d{2}/.test(date)) return date.substring(0, 5);
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  formatDateTime(date) {
    if (!date) return '-';
    if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/.test(date)) return date;
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(date)) {
      const parts = date.split(/[T ]/);
      const dParts = parts[0].split('-');
      const tParts = parts[1].substring(0, 5);
      return `${dParts[2]}/${dParts[1]}/${dParts[0]} ${tParts}`;
    }
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  },

  formatDate(date) {
    if (!date) return '-';
    if (typeof date === 'string') {
      const trimmed = date.trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
        const datePart = trimmed.split(/[T ]/)[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      if (/^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
        return trimmed.substring(0, 10);
      }
    }
    const d = typeof date === 'string' ? new Date(date.includes('T') ? date : (date + 'T12:00:00')) : (date instanceof Date ? date : new Date(date));
    if (isNaN(d.getTime())) return String(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  },

  normalizeDate(val) {
    if (!val) return '';
    if (typeof val === 'string') {
      const s = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
      if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(s)) {
        const parts = s.substring(0, 10).split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
      }
    }
    const d = val instanceof Date ? val : new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return String(val || '').trim();
  },

  datesMatch(d1, d2) {
    if (!d1 || !d2) return false;
    const n1 = this.normalizeDate(d1);
    const n2 = this.normalizeDate(d2);
    return Boolean(n1 && n2 && n1 === n2);
  },

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
      display: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  },

  countdown(targetDate) {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) return { hours: '00', minutes: '00', seconds: '00', display: '00:00:00', progress: 100 };
    return { ...this.formatDuration(diff), progress: 0 };
  },

  progressPercent(startDate, endDate) {
    const now = new Date();
    const total = endDate - startDate;
    const elapsed = now - startDate;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideInRight 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  async playSound(soundName) {
    try {
      const config = await this.loadSoundConfig();
      const sound = config.find(s => s.name === soundName);
      if (sound && sound.enabled) {
        const cached = this._soundCache?.[sound.file];
        if (cached) {
          cached.currentTime = 0;
          cached.volume = sound.volume || 0.7;
          cached.play().catch(() => {});
        } else {
          const audio = new Audio(`assets/sounds/${sound.file}`);
          audio.volume = sound.volume || 0.7;
          audio.play().catch(() => {});
          if (!this._soundCache) this._soundCache = {};
          this._soundCache[sound.file] = audio;
        }
      }
    } catch (e) {}
  },

  preloadSounds() {
    this._soundCache = {};
    const sounds = this.defaultSounds();
    sounds.forEach(s => {
      const audio = new Audio(`assets/sounds/${s.file}`);
      audio.preload = 'auto';
      audio.volume = 0;
      audio.load().catch(() => {});
      this._soundCache[s.file] = audio;
    });
  },

  async loadSoundConfig() {
    try {
      const data = await API.get('configuracoes', { tipo: 'sons' });
      return (data && data.length > 0) ? data : this.defaultSounds();
    } catch {
      return this.defaultSounds();
    }
  },

  defaultSounds() {
    return [
      { name: 'nova-ocorrencia', file: 'nova-ocorrencia.mp3', enabled: true, volume: 0.7 },
      { name: 'oficial-quartel', file: 'oficial-quartel.mp3', enabled: true, volume: 0.7 },
      { name: 'comando-area', file: 'comando-area.mp3', enabled: true, volume: 0.7 },
      { name: 'abs', file: 'abs.mp3', enabled: true, volume: 0.7 },
      { name: 'ur', file: 'ur.mp3', enabled: true, volume: 0.7 },
      { name: 'at', file: 'at.mp3', enabled: true, volume: 0.7 },
      { name: 'trem-socorro', file: 'trem-socorro.mp3', enabled: true, volume: 0.7 },
      { name: 'nova-atividade', file: 'nova-atividade.mp3', enabled: true, volume: 0.7 },
      { name: 'telegrafia', file: 'telegrafia.mp3', enabled: true, volume: 0.7 },
      { name: 'aviso', file: 'aviso.mp3', enabled: true, volume: 0.7 },
    ];
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  notify(title, type = 'info') {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const iconMap = { info: 'ℹ️', warning: '⚠️', error: '❌', success: '✅' };
        const notif = new Notification('SGPO - ' + title, {
          icon: 'assets/logos/bombeiros.svg',
          badge: 'assets/logos/bombeiros.svg',
          tag: 'sgpo-' + type,
          requireInteraction: false,
          silent: true
        });
        setTimeout(() => notif.close(), 5000);
      } catch (e) {}
    }
  },

  getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  },

  sortByName(arr, key = 'nome') {
    return [...arr].sort((a, b) => a[key].localeCompare(b[key], 'pt-BR'));
  },

  sortByAntiguidade(arr) {
    return [...arr].sort((a, b) => (a.antiguidade || 0) - (b.antiguidade || 0));
  },

  CAMPANHAS: [
    { id: 'nenhuma', nome: 'Nenhuma', icone: '', cor: '' },
    { id: 'sangue_bom', nome: 'Bombeiro Sangue Bom', icone: '🩸', cor: '#e53935', meses: [] },
    { id: 'maio_amarelo', nome: 'Maio Amarelo', icone: '🚗', cor: '#f9a825', meses: [5] },
    { id: 'novembro_azul', nome: 'Novembro Azul', icone: '🎗️', cor: '#1565c0', meses: [11] },
    { id: 'dezembro_vermelho', nome: 'Dezembro Vermelho', icone: '❤️', cor: '#c62828', meses: [12] },
    { id: 'natal', nome: 'Natal', icone: '🎄', cor: '#c62828', meses: [12], dias: [15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31] },
    { id: 'ano_novo', nome: 'Ano Novo', icone: '🎆', cor: '#ffd600', meses: [1,12], dias: [28,29,30,31,1,2,3] },
    { id: 'mae', nome: 'Dia das Mães', icone: '💐', cor: '#e91e63', meses: [5] },
    { id: 'pai', nome: 'Dia dos Pais', icone: '👔', cor: '#1565c0', meses: [8] },
    { id: 'criancas', nome: 'Dia das Crianças', icone: '🎈', cor: '#ff6d00', meses: [10], dias: [12] },
    { id: 'pascoa', nome: 'Páscoa', icone: '🐰', cor: '#ab47bc', meses: [] },
    { id: 'consciencia_negra', nome: 'Consciência Negra', icone: '✊', cor: '#2e7d32', meses: [11], dias: [20] },
    { id: 'civico', nome: 'Dia Cívico', icone: '🇧🇷', cor: '#009c3b', meses: [9], dias: [7] },
    { id: 'trabalho', nome: 'Dia do Trabalho', icone: '⚒️', cor: '#d32f2f', meses: [5], dias: [1] }
  ],

  getCampanhaById(id) {
    return this.CAMPANHAS.find(c => c.id === id) || this.CAMPANHAS[0];
  },

  applyCampanha(campanhaId) {
    const id = campanhaId || 'nenhuma';
    document.documentElement.setAttribute('data-campanha', id === 'nenhuma' ? '' : id);
    const banner = document.querySelector('.campanha-banner');
    const campanha = this.getCampanhaById(id);
    if (id !== 'nenhuma' && campanha.icone) {
      if (!banner) {
        const b = document.createElement('div');
        b.className = 'campanha-banner';
        b.innerHTML = `<span class="campanha-icon">${campanha.icone}</span><span class="campanha-text">${campanha.nome}</span>`;
        const topbar = document.querySelector('.topbar');
        if (topbar) topbar.insertAdjacentElement('beforebegin', b);
        else document.body.insertAdjacentElement('afterbegin', b);
      } else {
        banner.innerHTML = `<span class="campanha-icon">${campanha.icone}</span><span class="campanha-text">${campanha.nome}</span>`;
        banner.style.display = '';
      }
    } else if (banner) {
      banner.style.display = 'none';
    }
  },

  autoDetectCampanha() {
    const config = JSON.parse(localStorage.getItem('sgpo_config') || '{}');
    if (config.campanhaAuto === false && config.campanha) return config.campanha;
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const detected = this.CAMPANHAS.find(c => {
      if (!c.meses || c.meses.length === 0) return false;
      if (!c.meses.includes(month)) return false;
      if (c.dias && c.dias.length > 0) return c.dias.includes(day);
      return true;
    });
    return detected ? detected.id : 'nenhuma';
  },

  log(acao, detalhes, modulo) {
    if (typeof API !== 'undefined' && API.registrarLog) {
      API.registrarLog(acao, detalhes, modulo).catch(() => {});
    }
  },

  isOcorrenciaAtiva(o) {
    if (!o || !o.id) return false;
    if (o.Status === 'removido' || o.status === 'removido' || o.status === 'removida') return false;
    const st = String(o.status || '').toLowerCase().trim();
    if (!st) return false;
    const encerrados = [
      'finalizada', 'finalizado', 'cancelada', 'cancelado',
      'trote', 'apoio_desnecessario', 'encerrada', 'encerrado',
      'concluida', 'concluido', 'concluída', 'concluído',
      'arquivada', 'arquivado', 'retornou', 'retornando', 'em_retorno'
    ];
    if (encerrados.includes(st)) return false;
    if (o.horaRetorno && String(o.horaRetorno).trim() !== '' && String(o.horaRetorno).trim() !== '--:--') {
      return false;
    }
    return st === 'em_andamento' || st === 'em_atendimento' || st === 'despachada' || st === 'aberta' || st === 'ativa';
  },

  viaturaPertenceAOcorrencia(o, sv) {
    if (!o || !sv) return false;
    if (!this.isOcorrenciaAtiva(o)) return false;

    let vids = [];
    if (Array.isArray(o.viaturaIds)) {
      vids = o.viaturaIds;
    } else if (typeof o.viaturaIds === 'string' && o.viaturaIds.trim()) {
      try {
        const parsed = JSON.parse(o.viaturaIds);
        if (Array.isArray(parsed)) vids = parsed;
        else if (parsed) vids = [String(parsed).trim()];
      } catch(e) {
        vids = o.viaturaIds.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    if (!vids || vids.length === 0) return false;

    const svVid = String(sv.viaturaId || '').trim();
    const svId = String(sv.id || '').trim();
    if (!svVid && !svId) return false;

    return vids.some(vid => {
      if (vid && typeof vid === 'object') {
        const vidId = String(vid.viaturaId || vid.id || '').trim();
        return vidId && (vidId === svVid || vidId === svId);
      }
      const sVid = String(vid || '').trim();
      return sVid && (sVid === svVid || sVid === svId);
    });
  },

  initModalListeners() {
    if (this._modalListenersBound) return;
    this._modalListenersBound = true;

    // Fechar ao clicar no backdrop do modal (fora da caixa de diálogo)
    document.addEventListener('click', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'noServiceModal' || e.target.id === 'acessoModal') return;
        const closeBtn = e.target.querySelector('.btn-ghost.btn-icon, .modal-header .btn-icon, .btn-secondary');
        if (closeBtn && typeof closeBtn.click === 'function') {
          closeBtn.click();
        } else {
          e.target.style.display = 'none';
        }
      }
    });

    // Fechar com tecla Escape o modal do topo
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const visibleModals = Array.from(document.querySelectorAll('.modal-overlay')).filter(m => {
          return m.style.display !== 'none' && getComputedStyle(m).display !== 'none' && m.id !== 'noServiceModal' && m.id !== 'acessoModal';
        });
        if (visibleModals.length > 0) {
          visibleModals.sort((a, b) => {
            const zA = parseInt(getComputedStyle(a).zIndex, 10) || 0;
            const zB = parseInt(getComputedStyle(b).zIndex, 10) || 0;
            return zB - zA;
          });
          const topModal = visibleModals[0];
          const closeBtn = topModal.querySelector('.btn-ghost.btn-icon, .modal-header .btn-icon, .btn-secondary');
          if (closeBtn && typeof closeBtn.click === 'function') {
            closeBtn.click();
          } else {
            topModal.style.display = 'none';
          }
        }
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Utils.initModalListeners());
} else {
  Utils.initModalListeners();
}

