const HELP = {
  STORAGE_KEY: 'sgpo_help_content',
  isEditing: false,

  defaultContent: {
    title: 'Manual de Utilização do SGPO',
    sections: [
      {
        id: 'visao-geral',
        title: 'Visão Geral do Sistema',
        content: `
          <p>O <strong>SGPO - Sistema de Gerenciamento da Prontidão Operacional</strong> é a ferramenta digital do Corpo de Bombeiros Militar de São Paulo para gerenciar a rotina operacional diária das guarnições.</p>
          <p>O sistema é organizado em turnos de 24 horas (07:30 a 07:30 do dia seguinte) e permite acompanhar em tempo real a prontidão, atividades, viaturas, militares e muito mais.</p>
          <h4>Cores de Prontidão</h4>
          <div class="help-table-wrapper">
            <table class="help-table">
              <thead>
                <tr><th>Cor</th><th>Significado</th><th>Descrição</th></tr>
              </thead>
              <tbody>
                <tr><td style="color:#00c853">Verde</td><td>Prontidão Normal</td><td>Guarnição completa e operacional</td></tr>
                <tr><td style="color:#ffd600">Amarela</td><td>Prontidão Reduzida</td><td>Algumas vagas ou recursos limitados</td></tr>
                <tr><td style="color:#2979ff">Azul</td><td>Prontidão Especial</td><td>Situação de prontidão reforçada</td></tr>
                <tr><td style="color:#e0e0e0">Branca</td><td>Prontidão Máxima</td><td>Todos os recursos disponíveis</td></tr>
              </tbody>
            </table>
          </div>
        `
      },
      {
        id: 'acesso-login',
        title: 'Acesso ao Sistema',
        content: `
          <p>Para acessar o SGPO, utilize seu <strong>CPF</strong> e senha fornecidos pelo administrador.</p>
          <div class="help-step">
            <span class="help-step-num">1</span>
            <span class="help-step-text">Acesse a página de login do sistema</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">2</span>
            <span class="help-step-text">Digite seu <strong>CPF</strong> (somente números) no campo de login</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">3</span>
            <span class="help-step-text">Digite sua senha no campo de senha</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">4</span>
            <span class="help-step-text">Clique em <strong>"Entrar"</strong> ou pressione Enter</span>
          </div>
          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span class="help-tip-text">Se esta é sua primeira vez acessando o sistema, você será solicitado a redefinir sua senha. Escolha uma senha segura e memorize-a.</span>
          </div>
          <h4>Recuperação de Senha</h4>
          <p>Em caso de esquecimento da senha, entre em contato com o administrador do sistema para solicitar uma redefinição.</p>
        `
      },
      {
        id: 'sidebar-navegacao',
        title: 'Barra Lateral (Sidebar)',
        content: `
          <p>A barra lateral fixa à esquerda da tela contém os ícones de navegação para todas as telas do sistema.</p>
          <h4>Ícones Disponíveis</h4>
          <div class="help-table-wrapper">
            <table class="help-table">
              <thead>
                <tr><th>Ícone</th><th>Tela</th><th>Função</th></tr>
              </thead>
              <tbody>
                <tr><td>⬜</td><td>Dashboard</td><td>Painel principal com visão geral do turno</td></tr>
                <tr><td>🕐</td><td>Rotina</td><td>Gerenciamento da rotina do dia</td></tr>
                <tr><td>📞</td><td>Telegrafia</td><td>Registro e acompanhamento de telegramas</td></tr>
                <tr><td>👥</td><td>Oficiais</td><td>Informações sobre oficiais de serviço</td></tr>
                <tr><td>➕</td><td>Extras</td><td>Atividades extras e demandas especiais</td></tr>
                <tr><td>🏛️</td><td>Postos</td><td>Gerenciamento dos postos de serviço</td></tr>
                <tr><td>📄</td><td>Relatórios</td><td>Geração e visualização de relatórios</td></tr>
                <tr><td>🕐</td><td>Histórico</td><td>Consulta ao histórico de atividades</td></tr>
                <tr><td>❓</td><td>Ajuda</td><td>Manual e informações do sistema</td></tr>
                <tr><td>⚙️</td><td>Admin</td><td>Painel administrativo (apenas administradores)</td></tr>
                <tr><td>🚪</td><td>Sair</td><td>Encerrar sessão</td></tr>
              </tbody>
            </table>
          </div>
          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span class="help-tip-text">Os itens visíveis na barra lateral dependem do seu nível de permissão. nem todas as telas estão disponíveis para todos os perfis.</span>
          </div>
        `
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        content: `
          <p>O Dashboard é a tela principal do sistema, exibida imediatamente após o login. Ele oferece uma visão completa do estado atual do turno.</p>
          <h4>Componentes do Dashboard</h4>
          <ul>
            <li><strong>Countdown do Turno</strong> — Mostra o tempo restante até o final do turno atual</li>
            <li><strong>Indicador de Prontidão</strong> — Exibe a cor e o nível de prontidão atual</li>
            <li><strong>Timeline</strong> — Cronograma visual das atividades programadas</li>
            <li><strong>Oficiais de Serviço</strong> — Lista dos oficiais escalados</li>
            <li><strong>Notificações</strong> — Alertas e avisos importantes</li>
            <li><strong>Resumo da Rotina</strong> — Visão geral das atividades do dia</li>
          </ul>
          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span class="help-tip-text">Os blocos do dashboard podem ser reordenados arrastando pelo ícone ⠿ no canto superior esquerdo de cada card. A ordem é salva automaticamente.</span>
          </div>
          <h4>Atualização em Tempo Real</h4>
          <p>O Dashboard atualiza automaticamente a cada poucos segundos, refletindo mudanças feitas por outros usuários no sistema. Um indicador verde no topo da sidebar confirma que a conexão está ativa.</p>
        `
      },
      {
        id: 'rotina',
        title: 'Rotina do Dia',
        content: `
          <p>A tela de Rotina permite gerenciar todas as atividades programadas para o turno atual.</p>
          <h4>Visualização das Atividades</h4>
          <p>As atividades são exibidas em ordem cronológica, cada uma com:</p>
          <ul>
            <li><strong>Horário</strong> — Hora prevista para execução</li>
            <li><strong>Título/Programa</strong> — Nome da atividade</li>
            <li><strong>Responsável</strong> — Militar ou equipe responsável</li>
            <li><strong>Status</strong> — Situação atual (pendente, em andamento, concluída, prejudicada)</li>
          </ul>
          <h4>Alterando o Status de uma Atividade</h4>
          <div class="help-step">
            <span class="help-step-num">1</span>
            <span class="help-step-text">Localize a atividade desejada na lista</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">2</span>
            <span class="help-step-text">Clique no botão de status ao lado da atividade</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">3</span>
            <span class="help-step-text">Selecione o novo status: <strong>Concluída</strong>, <strong>Em Andamento</strong> ou <strong>Prejudicada</strong></span>
          </div>
          <div class="help-step">
            <span class="help-step-num">4</span>
            <span class="help-step-text">Se necessário, adicione uma observação sobre a mudança</span>
          </div>
          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span class="help-tip-text">Ao marcar como "Prejudicada", o sistema pedirá uma justificativa. Essa justificativa ficará registrada no histórico.</span>
          </div>
          <h4>Adicionando Atividades</h4>
          <p>Administradores podem adicionar novas atividades ao clicar no botão "Nova Atividade" e preenchendo os campos: horário, título, programa, responsável e descrição.</p>
        `
      },
      {
        id: 'telegrafia',
        title: 'Telegrafia',
        content: `
          <p>A tela de Telegrafia é responsável pelo registro e acompanhamento de telegramas e comunicações oficiais.</p>
          <h4>Registrando um Telegrama</h4>
          <div class="help-step">
            <span class="help-step-num">1</span>
            <span class="help-step-text">Clique em "Novo Telegrama"</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">2</span>
            <span class="help-step-text">Preencha o número do telegrama, destino,origem e conteúdo</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">3</span>
            <span class="help-step-text">Selecione a categoria (ordinário, urgente, reservado)</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">4</span>
            <span class="help-step-text">Confirme o registro</span>
          </div>
          <p>Os telegramas são organizados por status: recebidos, em processamento e enviados.</p>
        `
      },
      {
        id: 'oficiais',
        title: 'Oficiais de Serviço',
        content: `
          <p>Esta tela exibe e permite gerenciar os oficiais escalados para o serviço do dia.</p>
          <h4>Informações Exibidas</h4>
          <ul>
            <li><strong>Nome do Oficial</strong> — Nome completo e posto</li>
            <li><strong>Função</strong> — Cargo exercido no serviço (Comandante, Subcomandante, etc.)</li>
            <li><strong>Horário de Entrada/Saída</strong> — Período de serviço</li>
            <li><strong>Posto</strong> — Localização do posto de serviço</li>
          </ul>
          <h4>Gerenciando Escalas</h4>
          <p>Apenas administradores podem alterar as escalas dos oficiais. Utilize o botão "Editar Escala" para fazer modificações.</p>
        `
      },
      {
        id: 'extras',
        title: 'Atividades Extras',
        content: `
          <p>A tela de Extras gerencia atividades e demandas que fogem da rotina padrão do turno.</p>
          <h4>Tipos de Atividade Extra</h4>
          <ul>
            <li><strong>Atividades Comunitárias</strong> — Ações em parceria com a comunidade</li>
            <li><strong>Treinamentos</strong> — Exercícios e simulados</li>
            <li><strong>Eventos Especiais</strong> — Cobertura de eventos</li>
            <li><strong>Demandas Administrativas</strong> — Tarefas burocráticas e administrativas</li>
          </ul>
          <p>Registre todas as atividades extras para manter o histórico completo do turno.</p>
        `
      },
      {
        id: 'postos',
        title: 'Postos de Serviço',
        content: `
          <p>Esta tela permite visualizar e gerenciar os postos de serviço do Corpo de Bombeiros.</p>
          <h4>Informações dos Postos</h4>
          <ul>
            <li><strong>Nome</strong> — Identificação do posto</li>
            <li><strong>Endereço</strong> — Localização física</li>
            <li><strong>Capacidade</strong> — Número máximo de militares</li>
            <li><strong>Logo</strong> — Imagem institucional do posto (aparece na sidebar)</li>
            <li><strong>Comandante</strong> — Oficial responsável</li>
          </ul>
          <div class="help-tip">
            <span class="help-tip-icon">💡</span>
            <span class="help-tip-text">Quando um posto é selecionado para o serviço do dia, seu logo aparece automaticamente no topo da barra lateral.</span>
          </div>
        `
      },
      {
        id: 'relatorios',
        title: 'Relatórios',
        content: `
          <p>A tela de Relatórios permite gerar documentos oficiais com dados do turno.</p>
          <h4>Tipos de Relatório Disponíveis</h4>
          <ul>
            <li><strong>Relatório do Turno</strong> — Resumo completo das 24 horas de serviço</li>
            <li><strong>Relatório de Atividades</strong> — Detalhamento de todas as atividades realizadas</li>
            <li><strong>Relatório de Ocorrências</strong> — Registro de ocorrências atendidas</li>
            <li><strong>Relatório de Viaturas</strong> — Uso e deslocamento de viaturas</li>
          </ul>
          <h4>Gerando um Relatório</h4>
          <div class="help-step">
            <span class="help-step-num">1</span>
            <span class="help-step-text">Selecione o tipo de relatório desejado</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">2</span>
            <span class="help-step-text">Escolha o período (dia atual ou data específica)</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">3</span>
            <span class="help-step-text">Clique em "Gerar Relatório"</span>
          </div>
          <div class="help-step">
            <span class="help-step-num">4</span>
            <span class="help-step-text">Visualize, imprima ou exporte em PDF</span>
          </div>
        `
      },
      {
        id: 'historico',
        title: 'Histórico',
        content: `
          <p>O Histórico permite consultar registros passados de atividades, ocorrências e movimentações.</p>
          <h4>Funcionalidades</h4>
          <ul>
            <li><strong>Busca por Data</strong> — Filtre registros por período específico</li>
            <li><strong>Busca por Texto</strong> — Pesquise por palavras-chave nos registros</li>
            <li><strong>Filtros por Tipo</strong> — Atividades, ocorrências, telegramas, etc.</li>
            <li><strong>Exportação</strong> — Exporte os resultados encontrados</li>
          </ul>
          <p>O histórico é mantido automaticamente pelo sistema e serve como base para auditorias e consultas futuras.</p>
        `
      },
      {
        id: 'admin',
        title: 'Painel Administrativo',
        content: `
          <p>O Painel Administrativo é acessível apenas para usuários com perfil de <strong>Administrador</strong> ou <strong>Super Administrador</strong>.</p>
          <h4>Gerenciamento de Usuários</h4>
          <ul>
            <li><strong>Criar Usuário</strong> — Cadastre novos usuários com CPF, RE, nome, QRA e perfil</li>
            <li><strong>Editar Usuário</strong> — Altere dados, permissões e status de usuários</li>
            <li><strong>Desativar Usuário</strong> — Desative contas sem excluí-las</li>
            <li><strong>Redefinir Senha</strong> — Gere nova senha para usuários</li>
          </ul>
          <h4>Gerenciamento de Militares</h4>
          <ul>
            <li>Cadastro de militares com RE, posto, função e dados pessoais</li>
            <li>Vinculação automática com contas de usuário</li>
          </ul>
          <h4>Gerenciamento de Viaturas</h4>
          <ul>
            <li>Cadastro e edição de viaturas com prefixo, tipo e status</li>
            <li>Controle de disponibilidade</li>
          </ul>
          <h4>Configurações</h4>
          <ul>
            <li><strong>Campanha Visual</strong> — Temas sazonais (apenas super administrador)</li>
            <li><strong>URL da API</strong> — Configuração da conexão com o backend</li>
          </ul>
          <div class="help-tip">
            <span class="help-tip-icon">⚠️</span>
            <span class="help-tip-text">As alterações no painel administrativo afetam todo o sistema. Tenha cuidado ao modificar permissões e dados de usuários.</span>
          </div>
        `
      },
      {
        id: 'dicas-seguranca',
        title: 'Dicas de Segurança',
        content: `
          <ul>
            <li>Nunca compartilhe sua senha com outras pessoas</li>
            <li>Use senhas fortes com letras, números e caracteres especiais</li>
            <li>Sempre faça logout ao encerrar sua sessão</li>
            <li>Navegue apenas pelo site oficial do SGPO</li>
            <li>Em caso de suspeita de acesso não autorizado, altere sua senha imediatamente e comunique o administrador</li>
            <li>Mantenha seu navegador atualizado para garantir segurança</li>
          </ul>
        `
      },
      {
        id: 'faq',
        title: 'Perguntas Frequentes',
        content: `
          <h4>Esqueci minha senha, o que fazer?</h4>
          <p>Entre em contato com o administrador do sistema para solicitar uma redefinição de senha. Você receberá uma nova senha temporária.</p>

          <h4>Não consigo acessar uma tela, o que pode ser?</h4>
          <p>Verifique se seu perfil de usuário tem permissão para acessar aquela tela. Se necessário, solicite ao administrador que verifique suas permissões.</p>

          <h4>Os dados são atualizados em tempo real?</h4>
          <p>Sim. O sistema utiliza sincronização automática. As alterações feitas por qualquer usuário são refletidas nas telas dos demais em poucos segundos.</p>

          <h4>Posso acessar o sistema pelo celular?</h4>
          <p>Sim. O SGPO é responsivo e funciona em dispositivos móveis. A barra lateral se adapta automaticamente ao tamanho da tela.</p>

          <h4>Como alterar a senha?</h4>
          <p>Acesse o menu do perfil (canto superior direito) e selecione "Alterar Senha". Você precisará informar sua senha atual e a nova senha.</p>

          <h4>O que significam as cores na sidebar?</h4>
          <p>As cores representam o nível de prontidão atual: Verde (normal), Amarela (reduzida), Azul (especial) e Branca (máxima). A cor é alterada automaticamente conforme a situação operacional.</p>
        `
      }
    ],
    credits: {
      developer: 'Desenvolvido para o Corpo de Bombeiros Militar de São Paulo',
      version: 'SGPO v2.0',
      year: '2025-2026',
      technology: 'HTML5 • CSS3 • JavaScript • Google Apps Script • Google Sheets',
      acknowledgments: 'A todos os bombeiros militares de São Paulo que servem com dedicação e coragem.'
    }
  },

  init() {
    NAV.init('ajuda');
    if (!Auth.isLoggedIn) { window.location.href = 'index.html'; return; }
    this.renderContent();
    this.setupEditButton();
  },

  getContent() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return this.defaultContent;
  },

  renderContent() {
    const content = this.getContent();
    document.getElementById('helpTitle').textContent = content.title || this.defaultContent.title;

    const toc = document.getElementById('helpToc');
    const contentEl = document.getElementById('helpContent');
    const footer = document.getElementById('helpFooter');

    let tocHtml = '<div class="help-toc-title">Índice</div><ul class="help-toc-list">';
    let sectionsHtml = '';

    (content.sections || this.defaultContent.sections).forEach((section, i) => {
      tocHtml += `<li><a href="#${section.id}" onclick="HELP.scrollToSection('${section.id}')">${section.title}</a></li>`;
      sectionsHtml += `
        <div class="help-section" id="section-${section.id}" data-section-id="${section.id}">
          <h3>${section.title}</h3>
          ${section.content}
        </div>
      `;
    });

    tocHtml += '</ul>';
    toc.innerHTML = tocHtml;
    contentEl.innerHTML = sectionsHtml;

    const credits = content.credits || this.defaultContent.credits;
    footer.innerHTML = `
      <div class="help-footer-title">${credits.developer || this.defaultContent.credits.developer}</div>
      <div class="help-footer-text">${credits.acknowledgments || this.defaultContent.credits.acknowledgments}</div>
      <div class="help-footer-version">${credits.version || ''} · ${credits.year || ''} · ${credits.technology || ''}</div>
    `;
  },

  scrollToSection(id) {
    const el = document.getElementById('section-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  setupEditButton() {
    const btn = document.getElementById('editHelpBtn');
    if (btn && Auth.userId === '_superuser_') {
      btn.style.display = '';
    }
  },

  openEditor() {
    const content = this.getContent();
    const modal = document.getElementById('helpEditorModal');
    const tabsEl = document.getElementById('editorTabs');
    const fieldsEl = document.getElementById('editorFields');

    this._editData = JSON.parse(JSON.stringify(content));

    const allTabs = [
      { id: '_title', label: 'Título' },
      ...this._editData.sections.map((s, i) => ({ id: 'section_' + i, label: s.title })),
      { id: '_credits', label: 'Créditos' }
    ];

    tabsEl.innerHTML = allTabs.map((t, i) =>
      `<button class="help-editor-tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}" onclick="HELP.switchTab('${t.id}')">${t.label}</button>`
    ).join('');

    this._allTabs = allTabs;
    this.switchTab('_title');
    modal.style.display = '';
  },

  switchTab(tabId) {
    const fieldsEl = document.getElementById('editorFields');
    const tabs = document.querySelectorAll('.help-editor-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));

    if (tabId === '_title') {
      fieldsEl.innerHTML = `
        <div class="help-editor-field">
          <label>Título da Página</label>
          <input type="text" id="editHelpTitle" value="${Utils.escapeHtml(this._editData.title)}">
        </div>
      `;
    } else if (tabId === '_credits') {
      const c = this._editData.credits || this.defaultContent.credits;
      fieldsEl.innerHTML = `
        <div class="help-editor-field">
          <label>Desenvolvedor / Instituição</label>
          <input type="text" id="editCreditsDeveloper" value="${Utils.escapeHtml(c.developer)}">
        </div>
        <div class="help-editor-field">
          <label>Versão</label>
          <input type="text" id="editCreditsVersion" value="${Utils.escapeHtml(c.version)}">
        </div>
        <div class="help-editor-field">
          <label>Ano</label>
          <input type="text" id="editCreditsYear" value="${Utils.escapeHtml(c.year)}">
        </div>
        <div class="help-editor-field">
          <label>Tecnologias</label>
          <input type="text" id="editCreditsTech" value="${Utils.escapeHtml(c.technology)}">
        </div>
        <div class="help-editor-field">
          <label>Agradecimentos</label>
          <textarea id="editCreditsAck">${Utils.escapeHtml(c.acknowledgments)}</textarea>
        </div>
      `;
    } else {
      const idx = parseInt(tabId.replace('section_', ''));
      const section = this._editData.sections[idx];
      if (!section) return;
      fieldsEl.innerHTML = `
        <div class="help-editor-field">
          <label>Título da Seção</label>
          <input type="text" id="editSectionTitle" value="${Utils.escapeHtml(section.title)}">
        </div>
        <div class="help-editor-field">
          <label>Conteúdo (HTML)</label>
          <textarea id="editSectionContent" style="min-height:300px;font-family:var(--font-mono);font-size:0.82rem">${Utils.escapeHtml(section.content)}</textarea>
        </div>
      `;
    }

    this._currentTab = tabId;
  },

  collectFormData() {
    if (this._currentTab === '_title') {
      this._editData.title = document.getElementById('editHelpTitle').value.trim() || this.defaultContent.title;
    } else if (this._currentTab === '_credits') {
      this._editData.credits = {
        developer: document.getElementById('editCreditsDeveloper').value.trim() || this.defaultContent.credits.developer,
        version: document.getElementById('editCreditsVersion').value.trim() || this.defaultContent.credits.version,
        year: document.getElementById('editCreditsYear').value.trim() || this.defaultContent.credits.year,
        technology: document.getElementById('editCreditsTech').value.trim() || this.defaultContent.credits.technology,
        acknowledgments: document.getElementById('editCreditsAck').value.trim() || this.defaultContent.credits.acknowledgments
      };
    } else {
      const idx = parseInt(this._currentTab.replace('section_', ''));
      const titleInput = document.getElementById('editSectionTitle');
      const contentInput = document.getElementById('editSectionContent');
      if (titleInput) this._editData.sections[idx].title = titleInput.value.trim() || this._editData.sections[idx].title;
      if (contentInput) this._editData.sections[idx].content = contentInput.value;
    }
  },

  saveHelpContent() {
    this.collectFormData();
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._editData));
    this.renderContent();
    this.closeEditor();
    Utils.showToast('Conteúdo da ajuda salvo com sucesso', 'success');
  },

  closeEditor() {
    this.collectFormData();
    document.getElementById('helpEditorModal').style.display = 'none';
  }
};
