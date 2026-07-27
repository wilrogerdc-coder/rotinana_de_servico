/**
 * ════════════════════════════════════════════════════════════════════
 *  SGPO - Sistema de Gestão da Prontidão Operacional
 *  Arquivo Único do Google Apps Script
 * ════════════════════════════════════════════════════════════════════
 *
 *  Versão: 3.6
 *  Arquivo único — cole TODO este código no Apps Script
 *
 *  COMO USAR:
 *    1. Crie uma nova planilha no Google Sheets
 *    2. Vá em Extensões > Apps Script
 *    3. DELETE todo código existente no editor
 *    4. Cole TODO este código (Ctrl+A, Ctrl+V)
 *    5. Salve (Ctrl+S)
 *    6. Execute "setupCompletoSGPO" no menu 🔥 SGPO
 *    7. Autorize as permissões
 *    8. Faça deploy como Web App
 *
 *  ATUALIZAÇÕES:
 *    - Execute "atualizarSchema" para adicionar novas colunas/abas
 *      sem perder dados existentes
 *    - O versionamento automático rastreia mudanças
 *
 *  MENU DISPONÍVEL:
 *    🔥 SGPO
 *    ├── 🔄 Setup Completo (recria estrutura)
 *    ├── ⬆️ Atualizar Schema (adiciona colunas novas)
 *    ├── 👤 Popular Dados de Exemplo
 *    ├── 🗑️ Limpar Dados Demo
 *    ├── 📊 Status da Planilha
 *    └── 🧪 Testar API
 * ════════════════════════════════════════════════════════════════════
 */


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 1 — CONSTANTES E ENUMERAÇÕES
   ═══════════════════════════════════════════════════════════════════ */

const SGPO_VERSION = '3.6';

function _hashPassword(str) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var hash = '';
  for (var i = 0; i < raw.length; i++) {
    var byte = raw[i];
    if (byte < 0) byte += 256;
    var hex = byte.toString(16);
    hash += (hex.length < 2 ? '0' : '') + hex;
  }
  return hash;
}

const SUPER_USER = {
  id: '_superuser_',
  nome: 'Super Usuário',
  usuario: 'cavalieri',
  senha: 'tricolor',
  senhaHash: _hashPassword('tricolor'),
  perfil: 'superadmin',
  email: '',
  telefone: '',
  ativo: true,
  _hidden: true
};

const CORES = {
  bgEscuro:       '#0a0a0f',
  bgMedio:        '#12121a',
  bgCard:         '#1a1a25',
  bgHover:        '#22222f',
  borda:          '#2a2a3a',
  textoPrincipal: '#f0f0f5',
  textoSecund:    '#a0a0b0',
  textoMudo:      '#606070',
  verde:          '#00c853',
  amarela:        '#ffd600',
  azul:           '#2979ff',
  branca:         '#e0e0e0',
  vermelho:       '#ff1744',
  laranja:        '#ff9100',
  fundoVerde:     '#0d2818',
  fundoAmarelo:   '#2d2a0d',
  fundoAzul:      '#0d1a2d',
  fundoBranco:    '#1a1a1a',
  fundoVermelho:  '#2d0d0d',
};

const PERFIS = ['admin', 'comandante', 'operador', 'visualizador'];

const POSTOS_MILITAR = [
  'Soldado', 'Cabo', '3º Sargento', '2º Sargento', '1º Sargento',
  'Subtenente', '2º Tenente', '1º Tenente', 'Capitão',
  'Major', 'Tenente Coronel', 'Coronel'
];

const POSTOS_OFICIAL = [
  '2º Tenente', '1º Tenente', 'Capitão',
  'Major', 'Tenente Coronel', 'Coronel', 'General de Brigada'
];

const PRONTIDOES = ['verde', 'amarela', 'azul', 'branca'];

const PROGRAMAS = ['Passagem de serviço', 'Instrução', 'Treinamento físico', 'Refeição', 'Aquartelamento', 'Manutenção do quartel', 'Manutenção preventiva'];

const STATUS_ATIVIDADE = ['nao_iniciada', 'em_andamento', 'concluida', 'cancelada', 'nao_realizada'];

const STATUS_GERAL = ['ativo', 'inativo', 'removido'];

const TIPOS_NOTIF = ['info', 'alerta', 'urgente', 'telegrafia', 'oficial', 'atividade'];

const TIPOS_EVENTO = [
  'iniciar_servico', 'encerrar_servico', 'iniciar_atividade',
  'concluir_atividade', 'cancelar_atividade', 'telegrafia',
  'entrada_oficial', 'saida_oficial', 'notificacao', 'login',
  'logout', 'criar_atividade', 'update_atividade', 'create', 'update', 'delete',
  'solicitar_acesso', 'responder_acesso', 'gerenciar_posto'
];

const NIVEL_PERMISSAO = ['GB', 'SGB', 'POSTO'];

const SHEET_NAMES = {
  usuarios: 'Usuarios',
  militares: 'Militares',
  oficiais: 'Oficiais',
  servicos: 'Servicos',
  rotina: 'Rotina',
  atividades_padrao: 'AtividadesPadrao',
  atividades_extras: 'AtividadesExtras',
  telegrafia: 'Telegrafia',
  telegrafia_historico: 'TelegrafiaHistorico',
  oficiais_entrada: 'OficiaisEntrada',
  notificacoes: 'Notificacoes',
  auditoria: 'Auditoria',
  historico: 'Historico',
  configuracoes: 'Configuracoes',
  sons: 'Sons',
  logos: 'Logos',
  relatorios: 'Relatorios',
  postos_servico: 'PostosServico',
  usuarios_postos: 'UsuariosPostos',
  permissoes_servico: 'PermissoesServico',
  permissoes_tela: 'PermissoesTela',
  viaturas: 'Viaturas',
  servico_viatura: 'ServicoViatura',
  ocorrencias: 'Ocorrencias',
  rotinaPersonalizada: 'RotinaPersonalizada',
  tipos_viatura: 'TiposViatura',
  naturezas: 'Naturezas'
};


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 2 — DEFINIÇÃO DAS ABAS (SCHEMA)
   ═══════════════════════════════════════════════════════════════════ */

function getDefinicaoAbas() {
  const now = new Date().toISOString();

  return [
    {
      nome: 'Usuarios',
      cor: '#1a73e8',
      descricao: 'Usuários do sistema com credenciais e perfis de acesso',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 220, tipo: 'texto',     obrigatoria: true },
        { nome: 'qra',          largura: 120, tipo: 'texto',     descricao: 'QRA do usuário' },
        { nome: 'nomeUsuario',  largura: 160, tipo: 'texto',     descricao: 'Nome de usuário (exibição)' },
        { nome: 'cpf',          largura: 140, tipo: 'texto',     obrigatoria: true, descricao: 'CPF (login)' },
        { nome: 're',           largura: 120, tipo: 'texto',     descricao: 'Registro Estatístico' },
        { nome: 'senha',        largura: 140, tipo: 'texto',     obrigatoria: true },
        { nome: 'senhaHash',    largura: 140, tipo: 'texto',     descricao: 'SHA-256 da senha (preenchido automaticamente)' },
        { nome: 'mustChangePassword', largura: 80, tipo: 'booleano', descricao: 'Forçar troca de senha no próximo login' },
        { nome: 'perfil',       largura: 130, tipo: 'dropdown',  opcoes: PERFIS },
        { nome: 'email',        largura: 220, tipo: 'texto' },
        { nome: 'telefone',     largura: 140, tipo: 'texto' },
        { nome: 'foto',         largura: 200, tipo: 'texto',     descricao: 'URL da foto' },
        { nome: 'nivelPermissao', largura: 130, tipo: 'dropdown',  opcoes: NIVEL_PERMISSAO, descricao: 'Nível máximo de acesso (GB/SGB/POSTO)' },
        { nome: 'postoDefaultId', largura: 160, tipo: 'texto',     descricao: 'Posto padrão vinculado' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'ultimoAcesso', largura: 160, tipo: 'data' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 'Administrador do Sistema', '', 'admin', '00000000000', '', 'admin', _hashPassword('admin'), false, 'admin', 'admin@sgpo.gov.br', '', '', '', '', true, now, 'ativo'],
        [gerarId(), now, 'Comandante do Serviço', '', 'comandante', '11111111111', '', '123', _hashPassword('123'), false, 'comandante', 'comandante@sgpo.gov.br', '', '', '', '', true, now, 'ativo'],
        [gerarId(), now, 'Operador do Sistema', '', 'operador', '22222222222', '', '123', _hashPassword('123'), false, 'operador', 'operador@sgpo.gov.br', '', '', '', '', true, now, 'ativo'],
        [gerarId(), now, 'Visualizador', '', 'visualizador', '33333333333', '', '123', _hashPassword('123'), false, 'visualizador', '', '', '', '', '', true, now, 'ativo']
      ]
    },
    {
      nome: 'Militares',
      cor: '#0d652d',
      descricao: 'Cadastro de todos os militares da unidade',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'nome',            largura: 240, tipo: 'texto',     obrigatoria: true },
        { nome: 'posto',           largura: 160, tipo: 'dropdown',  opcoes: POSTOS_MILITAR },
        { nome: 'reCpf',           largura: 130, tipo: 'texto',     descricao: 'RE ou CPF' },
        { nome: 'dataNascimento',  largura: 130, tipo: 'data' },
        { nome: 'email',           largura: 220, tipo: 'texto' },
        { nome: 'telefone',        largura: 140, tipo: 'texto' },
        { nome: 'funcao',          largura: 180, tipo: 'texto',     descricao: 'Função principal' },
        { nome: 'especialidade',   largura: 180, tipo: 'texto' },
        { nome: 'ativo',           largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 'Carlos Eduardo da Silva',     '1º Tenente', '', '', '', '', 'Comandante de Esquadra', '', true, 'ativo'],
        [gerarId(), now, 'André Felipe de Oliveira',    'Sargento',   '', '', '', '', 'Comandante de Pelotão', '', true, 'ativo'],
        [gerarId(), now, 'Lucas Gabriel dos Santos',    'Cabo',       '', '', '', '', 'Operador de Viatura', '', true, 'ativo'],
        [gerarId(), now, 'Pedro Henrique Ferreira',     'Soldado',    '', '', '', '', 'Sentinela', '', true, 'ativo'],
        [gerarId(), now, 'Marcos Vinícius Costa',       '2º Tenente', '', '', '', '', 'Adjunto', '', true, 'ativo'],
        [gerarId(), now, 'Roberto Carlos Lima',         '1º Sargento','', '', '', '', 'Subcomandante', '', true, 'ativo'],
        [gerarId(), now, 'Fernando Augusto Souza',      'Cabo',       '', '', '', '', 'Operador de Rádio', '', true, 'ativo'],
        [gerarId(), now, 'Ricardo Mendes Pereira',      'Soldado',    '', '', '', '', 'Sentinela', '', true, 'ativo'],
        [gerarId(), now, 'Thiago Almeida Ribeiro',      '3º Sargento','', '', '', '', 'Inspetor', '', true, 'ativo'],
        [gerarId(), now, 'Bruno Nascimento Reis',       'Soldado',    '', '', '', '', 'Auxiliar', '', true, 'ativo']
      ]
    },
    {
      nome: 'Oficiais',
      cor: '#c5221f',
      descricao: 'Cadastro de oficiais para controle de presença',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 240, tipo: 'texto',     obrigatoria: true },
        { nome: 'posto',        largura: 160, tipo: 'dropdown',  opcoes: POSTOS_OFICIAL },
        { nome: 'antiguidade',  largura: 110, tipo: 'numero',    descricao: 'Ordem de antiguidade' },
        { nome: 'unidade',      largura: 180, tipo: 'texto' },
        { nome: 'nomeGuerra',   largura: 180, tipo: 'texto' },
        { nome: 'email',        largura: 220, tipo: 'texto' },
        { nome: 'telefone',     largura: 140, tipo: 'texto' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 'Cel Roberto Martins',        'Coronel',         1, '1º CBPM', 'Martins', '', '', true, 'ativo'],
        [gerarId(), now, 'Maj João Pedro Almeida',     'Major',           2, '1º CBPM', 'Almeida', '', '', true, 'ativo'],
        [gerarId(), now, 'Cap André Luis Ferreira',    'Capitão',         3, '2º CBPM', 'Ferreira','', '', true, 'ativo'],
        [gerarId(), now, '1º Ten Ricardo Souza',       '1º Tenente',      4, '1º CBPM', 'Souza',   '', '', true, 'ativo'],
        [gerarId(), now, '2º Ten Gabriel Santos',      '2º Tenente',      5, '3º CBPM', 'Santos',  '', '', true, 'ativo'],
        [gerarId(), now, 'Ten Cel Paulo Mendes',       'Tenente Coronel', 6, '1º CBPM', 'Mendes',  '', '', true, 'ativo']
      ]
    },
    {
      nome: 'Servicos',
      cor: '#e37400',
      descricao: 'Registro de todos os serviços (plantões) iniciados',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'data',            largura: 120, tipo: 'texto',     descricao: 'YYYY-MM-DD' },
        { nome: 'horarioInicio',   largura: 110, tipo: 'texto',     descricao: 'HH:MM' },
        { nome: 'horarioFim',      largura: 110, tipo: 'texto',     descricao: 'HH:MM' },
        { nome: 'prontidao',       largura: 120, tipo: 'dropdown',  opcoes: PRONTIDOES },
        { nome: 'comandanteId',    largura: 120, tipo: 'texto' },
        { nome: 'comandanteNome',  largura: 200, tipo: 'texto' },
        { nome: 'postoId',         largura: 160, tipo: 'texto',     descricao: 'Posto de serviço vinculado', obrigatoria: true },
        { nome: 'equipe',          largura: 500, tipo: 'texto',     descricao: 'JSON array de integrantes do servico' },
        { nome: 'observacoes',     largura: 300, tipo: 'texto' },
        { nome: 'totalAtividades', largura: 120, tipo: 'numero' },
        { nome: 'totalConcluidas', largura: 120, tipo: 'numero' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: ['ativo', 'encerrado', 'cancelado'] },
        { nome: 'telegrafistaId',  largura: 120, tipo: 'texto',     descricao: 'ID do operador de telegrafia designado' }
      ],
      dados: []
    },
    {
      nome: 'Rotina',
      cor: '#185abc',
      descricao: 'Atividades da rotina diária de cada serviço',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto',     obrigatoria: true },
        { nome: 'ordem',           largura: 70,  tipo: 'numero',    descricao: 'Ordem de execução' },
        { nome: 'horario',         largura: 100, tipo: 'texto',     descricao: 'HH:MM', obrigatoria: true },
        { nome: 'nome',            largura: 280, tipo: 'texto',     obrigatoria: true },
        { nome: 'programa',        largura: 160, tipo: 'dropdown',  opcoes: PROGRAMAS },
        { nome: 'responsavelId',   largura: 120, tipo: 'texto' },
        { nome: 'responsavel',     largura: 200, tipo: 'texto' },
        { nome: 'status',          largura: 130, tipo: 'dropdown',  opcoes: STATUS_ATIVIDADE },
        { nome: 'concluidoPor',    largura: 200, tipo: 'texto' },
        { nome: 'horaConclusao',   largura: 110, tipo: 'texto' },
        { nome: 'observacoes',     largura: 300, tipo: 'texto' },
        { nome: 'notificar',       largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'AtividadesPadrao',
      cor: '#0d652d',
      descricao: 'Modelo padrão da rotina (copiado para cada novo serviço)',
      colunas: [
        { nome: 'id',                 largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',       largura: 160, tipo: 'data' },
        { nome: 'ordem',              largura: 70,  tipo: 'numero',    descricao: 'Ordem de execução' },
        { nome: 'horario',            largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'nome',               largura: 280, tipo: 'texto',     obrigatoria: true },
        { nome: 'programa',           largura: 160, tipo: 'dropdown',  opcoes: PROGRAMAS },
        { nome: 'responsavel_padrao', largura: 200, tipo: 'texto' },
        { nome: 'duracaoMinutos',     largura: 110, tipo: 'numero',    descricao: 'Duração estimada em minutos' },
        { nome: 'obrigatoria',        largura: 100, tipo: 'booleano',  descricao: 'Se true, não pode ser pulada' },
        { nome: 'notificar',          largura: 80,  tipo: 'booleano' },
        { nome: 'observacoes',        largura: 300, tipo: 'texto' },
        { nome: 'postoId',           largura: 160, tipo: 'texto',     descricao: 'ID do posto (vazio = todos)' },
        { nome: 'Status',             largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 1,  '07:30', 'Revista Matinal',                                              'Passagem de serviço',   'Cmt Prontidão', 10, true,  true,  '', '', 'ativo'],
        [gerarId(), now, 2,  '07:45', 'Ordem do Dia',                                                 'Passagem de serviço',   'Cmt Prontidão', 45, true,  false, '', '', 'ativo'],
        [gerarId(), now, 3,  '08:30', 'Nós do Dia',                                                   'Instrução',             'Cmt Prontidão', 5,  true,  false, '', '', 'ativo'],
        [gerarId(), now, 4,  '08:35', 'Conferência das instalações',                                  'Passagem de serviço',   'Cmt Prontidão', 10, true,  false, '', '', 'ativo'],
        [gerarId(), now, 5,  '08:45', 'Conferência de viaturas, equipamentos e materiais',            'Passagem de serviço',   'Cmt Prontidão', 15, true,  false, '', '', 'ativo'],
        [gerarId(), now, 6,  '09:00', 'Registro do mapa força operacional no sistema de gerenciamento e despacho de viaturas', 'Passagem de serviço', 'Cmt Prontidão', 10, true, false, '', '', 'ativo'],
        [gerarId(), now, 7,  '08:30', 'Check-up de viaturas',                                         'Passagem de serviço',   'Cmt USv',       30, true,  false, '', '', 'ativo'],
        [gerarId(), now, 8,  '09:00', 'Armar Geral',                                                  'Instrução',             'Cmt Prontidão', 40, true,  false, '', '', 'ativo'],
        [gerarId(), now, 9,  '09:40', 'Lanche (se possível)',                                         'Refeição',              'Aux Rancho',     20, false, false, '', '', 'ativo'],
        [gerarId(), now, 10, '10:30', 'Condicionamento físico individual',                            'Treinamento físico',    'Cmt Prontidão', 60, false, false, '', '', 'ativo'],
        [gerarId(), now, 11, '11:30', 'Atividade recreativa',                                         'Treinamento físico',    'Cmt Prontidão', 30, false, false, '', '', 'ativo'],
        [gerarId(), now, 12, '12:00', 'Almoço',                                                       'Refeição',              'Refeição',       120,true,  false, '', '', 'ativo'],
        [gerarId(), now, 13, '14:00', 'Instrução Regular Coletiva',                                   'Instrução',             'Cmt Prontidão', 90, false, false, '', '', 'ativo'],
        [gerarId(), now, 14, '15:30', 'Lanche (se possível)',                                         'Refeição',              'Aux Rancho',     20, false, false, '', '', 'ativo'],
        [gerarId(), now, 15, '15:50', 'Hora da estação',                                              'Manutenção do quartel', 'Cmt Prontidão', 100,true,  false, '', '', 'ativo'],
        [gerarId(), now, 16, '17:30', 'Atividade recreativa',                                         'Treinamento físico',    'Cmt Prontidão', 90, false, false, '', '', 'ativo'],
        [gerarId(), now, 17, '19:00', 'Jantar',                                                       'Refeição',              'Aux Rancho',     90, true,  false, '', '', 'ativo'],
        [gerarId(), now, 18, '20:30', 'Revista noturna',                                              'Aquartelamento',        'Cmt Prontidão', 10, true,  true,  '', '', 'ativo'],
        [gerarId(), now, 19, '20:40', 'Aquecimento de viaturas',                                      'Manutenção preventiva', 'Chefe dos Motoristas', 80, true, false, '', '', 'ativo'],
        [gerarId(), now, 20, '22:00', 'Silêncio',                                                     'Aquartelamento',        'Cmt Prontidão', 5,  true,  true,  '', '', 'ativo'],
        [gerarId(), now, 21, '06:00', 'Alvorada',                                                     'Aquartelamento',        'Cmt Prontidão', 10, true,  true,  '', '', 'ativo'],
        [gerarId(), now, 22, '06:20', 'Faxina Geral',                                                 'Manutenção do quartel', 'Cb Dia',         40, false, false, '', '', 'ativo'],
        [gerarId(), now, 23, '07:00', 'Café da Manhã',                                                'Refeição',              'Aux Rancho',     30, true,  false, '', '', 'ativo'],
        [gerarId(), now, 24, '07:30', 'Revista Matinal (encerramento)',                               'Passagem de serviço',   'Cmt Prontidão', 10, true,  true, '', '', 'ativo']
      ]
    },
    {
      nome: 'AtividadesExtras',
      cor: '#e37400',
      descricao: 'Atividades inseridas durante o plantão',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'horario',         largura: 100, tipo: 'texto' },
        { nome: 'nome',            largura: 280, tipo: 'texto',     obrigatoria: true },
        { nome: 'programa',        largura: 160, tipo: 'dropdown',  opcoes: PROGRAMAS },
        { nome: 'responsavelId',   largura: 120, tipo: 'texto' },
        { nome: 'responsavel',     largura: 200, tipo: 'texto' },
        { nome: 'observacoes',     largura: 300, tipo: 'texto' },
        { nome: 'status',          largura: 130, tipo: 'dropdown',  opcoes: STATUS_ATIVIDADE },
        { nome: 'concluidoPor',    largura: 200, tipo: 'texto' },
        { nome: 'horaConclusao',   largura: 110, tipo: 'texto' },
        { nome: 'criadoPor',       largura: 200, tipo: 'texto' },
        { nome: 'notificar',       largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Telegrafia',
      cor: '#7b1fa2',
      descricao: 'Operador atual da telegrafia (registro ativo)',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto',     obrigatoria: true },
        { nome: 'militarId',       largura: 120, tipo: 'texto' },
        { nome: 'operador',        largura: 220, tipo: 'texto' },
        { nome: 'horario',         largura: 110, tipo: 'texto',     descricao: 'HH:MM de assume' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: ['ativo', 'inativo'] }
      ],
      dados: []
    },
    {
      nome: 'TelegrafiaHistorico',
      cor: '#7b1fa2',
      descricao: 'Histórico completo de todas as trocas de telegrafia',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'militarId',       largura: 120, tipo: 'texto' },
        { nome: 'operador',        largura: 220, tipo: 'texto' },
        { nome: 'horario',         largura: 110, tipo: 'texto' },
        { nome: 'horarioSaida',    largura: 110, tipo: 'texto' },
        { nome: 'duracao',         largura: 100, tipo: 'texto',     descricao: 'HH:MM:SS' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'OficiaisEntrada',
      cor: '#c5221f',
      descricao: 'Registro de entrada e saída de oficiais no quartel',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'oficialId',       largura: 120, tipo: 'texto' },
        { nome: 'nome',            largura: 220, tipo: 'texto' },
        { nome: 'posto',           largura: 160, tipo: 'texto' },
        { nome: 'tipo',            largura: 100, tipo: 'dropdown',  opcoes: ['entrada', 'saida'] },
        { nome: 'horario',         largura: 110, tipo: 'texto' },
        { nome: 'observacao',      largura: 300, tipo: 'texto' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Notificacoes',
      cor: '#e37400',
      descricao: 'Notificações internas do sistema',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'mensagem',        largura: 400, tipo: 'texto',     obrigatoria: true },
        { nome: 'tipo',            largura: 120, tipo: 'dropdown',  opcoes: TIPOS_NOTIF },
        { nome: 'horario',         largura: 110, tipo: 'texto' },
        { nome: 'destinatarioId',  largura: 120, tipo: 'texto',     descricao: 'vazio = todos' },
        { nome: 'lida',            largura: 80,  tipo: 'booleano' },
        { nome: 'arquivada',       largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Auditoria',
      cor: '#5f6368',
      descricao: 'Log completo de todas as ações realizadas no sistema',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataHora',        largura: 200, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'acao',            largura: 180, tipo: 'dropdown',  opcoes: TIPOS_EVENTO },
        { nome: 'usuarioId',       largura: 120, tipo: 'texto' },
        { nome: 'usuarioNome',     largura: 220, tipo: 'texto' },
        { nome: 'entidade',        largura: 140, tipo: 'texto',     descricao: 'Tabela afetada' },
        { nome: 'entidadeId',      largura: 120, tipo: 'texto' },
        { nome: 'detalhes',        largura: 400, tipo: 'texto' },
        { nome: 'ip',              largura: 130, tipo: 'texto' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Historico',
      cor: '#5f6368',
      descricao: 'Snapshot dos serviços encerrados (backup dos dados)',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataSnapshot',    largura: 200, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'data',            largura: 120, tipo: 'texto' },
        { nome: 'prontidao',       largura: 120, tipo: 'texto' },
        { nome: 'comandante',      largura: 220, tipo: 'texto' },
        { nome: 'totalAtividades', largura: 120, tipo: 'numero' },
        { nome: 'totalConcluidas', largura: 120, tipo: 'numero' },
        { nome: 'totalExtras',     largura: 120, tipo: 'numero' },
        { nome: 'totalTelegrafia', largura: 120, tipo: 'numero' },
        { nome: 'totalOficiais',   largura: 120, tipo: 'numero' },
        { nome: 'jsonDados',       largura: 400, tipo: 'texto',     descricao: 'JSON com todos os dados do serviço' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Configuracoes',
      cor: '#5f6368',
      descricao: 'Configurações gerais do sistema',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'categoria',       largura: 140, tipo: 'dropdown',  opcoes: ['geral', 'sons', 'logos', 'notificacoes', 'api', 'aparencia'] },
        { nome: 'chave',           largura: 200, tipo: 'texto',     obrigatoria: true },
        { nome: 'valor',           largura: 300, tipo: 'texto' },
        { nome: 'descricao',       largura: 300, tipo: 'texto' },
        { nome: 'editavel',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), 'geral',       'nome_unidade',     '1º CBPM - Grupo de Apoio',  'Nome da unidade',                    true,  'ativo'],
        [gerarId(), 'geral',       'nome_sistema',     'SGPO',                       'Nome exibido na tela de login',      true,  'ativo'],
        [gerarId(), 'geral',       'subtitulo_sistema','Sistema de Gestão da Prontidão Operacional', 'Subtítulo na tela de login', true, 'ativo'],
        [gerarId(), 'geral',       'cidade',           'São Paulo',                  'Cidade da unidade',                  true,  'ativo'],
        [gerarId(), 'geral',       'horario_inicio',   '07:30',                      'Horário padrão de início',          true,  'ativo'],
        [gerarId(), 'geral',       'duracao_plantao',  '24',                         'Duração do plantão em horas',        true,  'ativo'],
        [gerarId(), 'geral',       'cor_padrao',       'verde',                      'Cor padrão da prontidão',           true,  'ativo'],
        [gerarId(), 'sons',        'sons_habilitados', 'true',                       'Habilitar sons no sistema',         true,  'ativo'],
        [gerarId(), 'sons',        'volume_geral',     '0.7',                        'Volume geral dos sons (0 a 1)',      true,  'ativo'],
        [gerarId(), 'notificacoes','notif_sons',       'true',                       'Tocar som nas notificações',         true,  'ativo'],
        [gerarId(), 'notificacoes','notif_duracao',    '5000',                       'Duração do toast em ms',            true,  'ativo'],
        [gerarId(), 'aparencia',   'tema',             'escuro',                     'Tema da interface',                  true,  'ativo'],
        [gerarId(), 'aparencia',   'sync_intervalo',   '30',                         'Intervalo de sincronização em seg', true,  'ativo'],
        [gerarId(), 'api',         'versao',           SGPO_VERSION,                 'Versão do schema do banco',         false, 'ativo']
      ]
    },
    {
      nome: 'Sons',
      cor: '#7b1fa2',
      descricao: 'Configuração dos sons do sistema',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'evento',          largura: 200, tipo: 'texto',     descricao: 'Nome do evento' },
        { nome: 'arquivo',         largura: 250, tipo: 'texto',     descricao: 'Nome do arquivo MP3' },
        { nome: 'habilitado',      largura: 100, tipo: 'booleano' },
        { nome: 'volume',          largura: 80,  tipo: 'numero',    descricao: '0.0 a 1.0' },
        { nome: 'descricao',       largura: 300, tipo: 'texto' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), 'nova-ocorrencia',    'nova-ocorrencia.mp3',    true, 0.7, 'Nova ocorrência registrada',          'ativo'],
        [gerarId(), 'oficial-quartel',    'oficial-quartel.mp3',    true, 0.7, 'Oficial entrou no quartel',           'ativo'],
        [gerarId(), 'comando-area',       'comando-area.mp3',       true, 0.8, 'Comando de Área recebido',            'ativo'],
        [gerarId(), 'abs',                'abs.mp3',                true, 0.9, 'ABS - Aviso de Baixa Severidade',     'ativo'],
        [gerarId(), 'ur',                 'ur.mp3',                 true, 0.9, 'UR - Urgência',                       'ativo'],
        [gerarId(), 'at',                 'at.mp3',                 true, 1.0, 'AT - Alarme Total',                   'ativo'],
        [gerarId(), 'trem-socorro',       'trem-socorro.mp3',       true, 1.0, 'Trem de Socorro acionado',            'ativo'],
        [gerarId(), 'nova-atividade',     'nova-atividade.mp3',     true, 0.7, 'Nova atividade criada',               'ativo'],
        [gerarId(), 'atividade-atrasada', 'atividade-atrasada.mp3', true, 0.8, 'Atividade com atraso',                'ativo'],
        [gerarId(), 'proxima-atividade',  'proxima-atividade.mp3',  true, 0.6, 'Alerta da próxima atividade',         'ativo'],
        [gerarId(), 'telegrafia',         'telegrafia.mp3',         true, 0.7, 'Troca de operador da telegrafia',     'ativo'],
        [gerarId(), 'aviso',              'aviso.mp3',              true, 0.7, 'Aviso geral do sistema',              'ativo'],
        [gerarId(), 'inicio-servico',     'inicio-servico.mp3',     true, 0.8, 'Serviço iniciado',                    'ativo'],
        [gerarId(), 'fim-servico',        'fim-servico.mp3',        true, 0.8, 'Serviço encerrado',                   'ativo']
      ]
    },
    {
      nome: 'Logos',
      cor: '#1a73e8',
      descricao: 'URLs dos logotipos do sistema',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'nome',            largura: 200, tipo: 'texto' },
        { nome: 'url',             largura: 500, tipo: 'texto',     descricao: 'URL ou caminho da imagem' },
        { nome: 'tipo',            largura: 140, tipo: 'dropdown',  opcoes: ['principal', 'prontidao-verde', 'prontidao-amarela', 'prontidao-azul', 'prontidao-branca', 'favicon'] },
        { nome: 'ativo',           largura: 80,  tipo: 'booleano' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), 'Logo Principal CBPMESP', 'assets/logos/bombeiros.png',        'principal',        true, 'ativo'],
        [gerarId(), 'Prontidão Verde',        'assets/logos/prontidao-verde.png',   'prontidao-verde',  true, 'ativo'],
        [gerarId(), 'Prontidão Amarela',      'assets/logos/prontidao-amarela.png', 'prontidao-amarela',true, 'ativo'],
        [gerarId(), 'Prontidão Azul',         'assets/logos/prontidao-azul.png',    'prontidao-azul',   true, 'ativo'],
        [gerarId(), 'Prontidão Branca',       'assets/logos/prontidao-branca.png',  'prontidao-branca', true, 'ativo']
      ]
    },
    {
      nome: 'Relatorios',
      cor: '#5f6368',
      descricao: 'Cache de relatórios gerados em PDF',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataGeracao',     largura: 200, tipo: 'data' },
        { nome: 'tipo',            largura: 160, tipo: 'dropdown',  opcoes: ['resumo', 'prontidao', 'historico', 'timeline', 'telegrafia', 'oficiais', 'auditoria', 'completo'] },
        { nome: 'dataReferencia',  largura: 120, tipo: 'texto' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto' },
        { nome: 'geradoPor',       largura: 200, tipo: 'texto' },
        { nome: 'urlPdf',          largura: 500, tipo: 'texto' },
        { nome: 'tamanhoBytes',    largura: 120, tipo: 'numero' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },

    /* ── Postos de Serviço ── */
    {
      nome: 'PostosServico',
      cor: '#7b1fa2',
      descricao: 'Hierarquia de postos de serviço (GB > SGB > Postos)',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 240, tipo: 'texto',     obrigatoria: true },
        { nome: 'tipo',         largura: 120, tipo: 'dropdown',  opcoes: ['GB', 'SGB', 'POSTO'], obrigatoria: true },
        { nome: 'postoPaiId',   largura: 160, tipo: 'texto',     descricao: 'ID do posto pai (GB não tem)' },
        { nome: 'responsavelId', largura: 160, tipo: 'texto',    descricao: 'Comandante do posto' },
        { nome: 'ordem',        largura: 80,  tipo: 'numero' },
        { nome: 'logo',         largura: 240, tipo: 'texto',     descricao: 'URL ou dados Base64 do logo do posto' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },

    /* ── Vínculo Usuário ↔ Posto ── */
    {
      nome: 'UsuariosPostos',
      cor: '#1565c0',
      descricao: 'Vínculo dos usuários aos postos de serviço',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'usuarioId',    largura: 160, tipo: 'texto',     obrigatoria: true },
        { nome: 'postoId',      largura: 160, tipo: 'texto',     obrigatoria: true },
        { nome: 'papel',        largura: 140, tipo: 'dropdown',  opcoes: ['comandante_posto', 'operador', 'viewer'] },
        { nome: 'dataVinculo',  largura: 160, tipo: 'data' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },

    /* ── Permissões de Acesso ao Serviço ── */
    {
      nome: 'PermissoesServico',
      cor: '#e65100',
      descricao: 'Solicitações e aprovações de acesso ao serviço do dia',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'usuarioId',    largura: 160, tipo: 'texto',     obrigatoria: true, descricao: 'Quem solicitou' },
        { nome: 'usuarioNome',  largura: 200, tipo: 'texto' },
        { nome: 'servicoId',    largura: 160, tipo: 'texto',     obrigatoria: true },
        { nome: 'tipo',         largura: 120, tipo: 'dropdown',  opcoes: ['visualizar', 'entrar_equipe'] },
        { nome: 'status',       largura: 120, tipo: 'dropdown',  opcoes: ['pendente', 'aprovado', 'recusado'] },
        { nome: 'motivo',       largura: 300, tipo: 'texto' },
        { nome: 'aprovadoPor',  largura: 200, tipo: 'texto',     descricao: 'Nome de quem aprovou/recusou' },
        { nome: 'dataResposta', largura: 160, tipo: 'data' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },

    /* ── Permissões por Tela/Funcionalidade ── */
    {
      nome: 'PermissoesTela',
      cor: '#283593',
      descricao: 'Parâmetros de permissão por tela e funcionalidade',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'perfil',       largura: 130, tipo: 'dropdown',  opcoes: ['admin', 'comandante', 'operador', 'visualizador', 'custom'] },
        { nome: 'usuarioId',    largura: 160, tipo: 'texto',     descricao: 'Para perfil=custom, FK ao usuário' },
        { nome: 'tela',         largura: 160, tipo: 'texto',     obrigatoria: true, descricao: 'Nome da página' },
        { nome: 'acoes',        largura: 400, tipo: 'texto',     descricao: 'JSON array: ver,editar,excluir,status,admin,config' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Viaturas',
      cor: '#e37400',
      descricao: 'Cadastro de viaturas (veículos) da unidade',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 160, tipo: 'texto',     obrigatoria: true, descricao: 'Ex: ABT-01' },
        { nome: 'tipo',         largura: 120, tipo: 'dropdown',  opcoes: ['ABT', 'URG', 'CV', 'APA', 'SOC', 'ALO', 'MOT', 'OUTRO'], descricao: 'Tipo da viatura' },
        { nome: 'placa',        largura: 120, tipo: 'texto',     descricao: 'Placa do veículo' },
        { nome: 'capacidade',   largura: 100, tipo: 'numero',    descricao: 'Capacidade máxima de tripulantes' },
        { nome: 'ativo',        largura: 80,  tipo: 'booleano' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'ServicoViatura',
      cor: '#e37400',
      descricao: 'Viaturas vinculadas a cada serviço com tripulação e controle de tempo',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto',     obrigatoria: true },
        { nome: 'viaturaId',       largura: 120, tipo: 'texto',     obrigatoria: true },
        { nome: 'viaturaNome',     largura: 140, tipo: 'texto' },
        { nome: 'motorista',       largura: 200, tipo: 'texto',     descricao: 'Nome do motorista' },
        { nome: 'motoristaId',     largura: 120, tipo: 'texto',     descricao: 'ID do motorista na equipe' },
        { nome: 'tripulantes',     largura: 500, tipo: 'texto',     descricao: 'JSON array de {id, nome}' },
        { nome: 'horarioSaida',    largura: 110, tipo: 'texto',     descricao: 'HH:MM — auto no dispatch' },
        { nome: 'horarioRetorno',  largura: 110, tipo: 'texto',     descricao: 'HH:MM — auto no retorno' },
        { nome: 'status',          largura: 130, tipo: 'dropdown',  opcoes: ['ativa', 'em_ocorrencia', 'retornando'], descricao: 'Status operacional da viatura' },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'Ocorrencias',
      cor: '#c5221f',
      descricao: 'Registro de ocorrências atendidas pelo serviço',
      colunas: [
        { nome: 'id',              largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',    largura: 160, tipo: 'data' },
        { nome: 'numero',          largura: 100, tipo: 'texto',     descricao: 'Nº sequencial da ocorrência' },
        { nome: 'servicoId',       largura: 120, tipo: 'texto',     obrigatoria: true },
        { nome: 'titulo',          largura: 300, tipo: 'texto',     obrigatoria: true, descricao: 'Descrição resumida' },
        { nome: 'natureza',        largura: 160, tipo: 'texto',     descricao: 'Natureza da ocorrência' },
        { nome: 'descricao',       largura: 600, tipo: 'texto',     descricao: 'Descrição detalhada' },
        { nome: 'viaturaIds',      largura: 400, tipo: 'texto',     descricao: 'JSON array de IDs das viaturas' },
        { nome: 'efetivo',         largura: 500, tipo: 'texto',     descricao: 'JSON array de {id, nome, viaturaId}' },
        { nome: 'horaAcionamento', largura: 110, tipo: 'texto',     descricao: 'HH:MM — auto no dispatch' },
        { nome: 'horaRetorno',     largura: 110, tipo: 'texto',     descricao: 'HH:MM — auto no retorno' },
        { nome: 'prontidaoCor',    largura: 120, tipo: 'texto',     descricao: 'Cor da prontidão no momento' },
        { nome: 'status',          largura: 130, tipo: 'dropdown',  opcoes: ['em_atendimento', 'finalizada'] },
        { nome: 'Status',          largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },
    {
      nome: 'TiposViatura',
      cor: '#ab47bc',
      descricao: 'Tipos de atuação de viaturas',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 200, tipo: 'texto',     obrigatoria: true },
        { nome: 'sigla',        largura: 80,  tipo: 'texto',     obrigatoria: true, descricao: 'Sigla da viatura (ABT, URG, etc.)' },
        { nome: 'cor',          largura: 100, tipo: 'texto',     descricao: 'Cor hex para identificação visual' },
        { nome: 'descricao',    largura: 300, tipo: 'texto' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 'Incêndio',           'ABT', '#e53935', 'Autotanque de Bombeiros Táticos', 'ativo'],
        [gerarId(), now, 'Urgência',            'URG', '#ff9100', 'Unidade de Resgate e Socorro', 'ativo'],
        [gerarId(), now, 'Capacidade Volante',  'CV',  '#ffd600', 'Capacidade Volante', 'ativo'],
        [gerarId(), now, 'Apio de Água',        'APA', '#2979ff', 'Apoio de Água', 'ativo'],
        [gerarId(), now, 'Socorro',             'SOC', '#00c853', 'Socorro Geral', 'ativo'],
        [gerarId(), now, 'Alarme',              'ALO', '#ab47bc', 'Alarme', 'ativo'],
        [gerarId(), now, 'Motocicleta',         'MOT', '#78909c', 'Motocicleta', 'ativo']
      ]
    },

    /* ── Rotina Personalizada por Posto ── */
    {
      nome: 'RotinaPersonalizada',
      cor: '#0d652d',
      descricao: 'Rotina personalizada por posto (sobrepõe a rotina padrão ao iniciar serviço)',
      colunas: [
        { nome: 'id',                 largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro',       largura: 160, tipo: 'data' },
        { nome: 'postoId',            largura: 160, tipo: 'texto',     obrigatoria: true },
        { nome: 'postoNome',          largura: 200, tipo: 'texto' },
        { nome: 'ordem',              largura: 70,  tipo: 'numero' },
        { nome: 'horario',            largura: 100, tipo: 'texto' },
        { nome: 'nome',               largura: 280, tipo: 'texto',     obrigatoria: true },
        { nome: 'programa',           largura: 160, tipo: 'dropdown',  opcoes: PROGRAMAS },
        { nome: 'responsavel_padrao', largura: 200, tipo: 'texto' },
        { nome: 'duracaoMinutos',     largura: 110, tipo: 'numero' },
        { nome: 'obrigatoria',        largura: 100, tipo: 'booleano' },
        { nome: 'notificar',          largura: 80,  tipo: 'booleano' },
        { nome: 'observacoes',        largura: 300, tipo: 'texto' },
        { nome: 'ativo',              largura: 80,  tipo: 'booleano' },
        { nome: 'Status',             largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: []
    },

    /* ── Naturezas de Ocorrência ── */
    {
      nome: 'Naturezas',
      cor: '#ff6f00',
      descricao: 'Naturezas/Tipos de ocorrência',
      colunas: [
        { nome: 'id',           largura: 100, tipo: 'texto',     obrigatoria: true },
        { nome: 'dataCadastro', largura: 160, tipo: 'data' },
        { nome: 'nome',         largura: 200, tipo: 'texto',     obrigatoria: true },
        { nome: 'valor',        largura: 200, tipo: 'texto' },
        { nome: 'Status',       largura: 100, tipo: 'dropdown',  opcoes: STATUS_GERAL }
      ],
      dados: [
        [gerarId(), now, 'Incêndio', 'incendio', 'ativo'],
        [gerarId(), now, 'Resgate', 'resgate', 'ativo'],
        [gerarId(), now, 'Salvamento', 'salvamento', 'ativo'],
        [gerarId(), now, 'Prevenção', 'prevencao', 'ativo'],
        [gerarId(), now, 'Emergência Médica', 'emergencia_medica', 'ativo'],
        [gerarId(), now, 'Desabamento', 'desabamento', 'ativo'],
        [gerarId(), now, 'Enchente', 'enchente', 'ativo'],
        [gerarId(), now, 'Busca e Salvamento', 'busca_salvamento', 'ativo']
      ]
    }
  ];
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 3 — UTILITÁRIOS BASE
   ═══════════════════════════════════════════════════════════════════ */

function gerarId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const Utils = {
  formatTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  formatDateTime(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const d = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${mo}/${y} ${this.formatTime(date)}`;
  },

  formatDate(date) {
    if (!(date instanceof Date)) date = new Date(date);
    const d = String(date.getDate()).padStart(2, '0');
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${mo}/${y}`;
  },

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return {
      hours: pad(hours),
      minutes: pad(minutes),
      seconds: pad(seconds),
      display: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    };
  },

  hashSenha(senha) {
    var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, senha, Utilities.Charset.UTF_8);
    var hash = '';
    for (var i = 0; i < raw.length; i++) {
      var byte = raw[i];
      if (byte < 0) byte += 256;
      var hex = byte.toString(16);
      hash += (hex.length < 2 ? '0' : '') + hex;
    }
    return hash;
  },

  compararSenhas(senhaDigitada, senhaArmazenada) {
    if (!senhaArmazenada) return false;
    if (/^[a-f0-9]{64}$/i.test(senhaArmazenada)) {
      return this.hashSenha(senhaDigitada) === senhaArmazenada;
    }
    return senhaDigitada === senhaArmazenada;
  }
};


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 4 — ACESSO ÀS ABAS (SHEETS)
   ═══════════════════════════════════════════════════════════════════ */

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = SHEET_NAMES[name] || name;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function ensureSheetHeaders(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  var headers = data.length > 0 ? data[0] : [];
  if (headers && headers.length > 0 && headers[0]) return headers;

  var fixDef = getDefinicaoAbas().find(function(d) {
    return d.nome === sheetName || d.nome.toLowerCase() === String(sheetName).toLowerCase();
  });
  if (!fixDef) {
    var mapped = SHEET_NAMES[sheetName];
    if (mapped) {
      fixDef = getDefinicaoAbas().find(function(d) { return d.nome === mapped; });
    }
  }
  if (fixDef) {
    _repararAba(SpreadsheetApp.getActiveSpreadsheet(), sheet, fixDef);
    var newData = sheet.getDataRange().getValues();
    headers = newData.length > 0 ? newData[0] : [];
  }
  return headers || [];
}

function findRowById(sheetName, id) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;
  const headers = data[0];
  if (!headers || headers.length === 0 || !headers[0]) return null;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) return { row: i + 1, data: data[i], headers: data[0] };
  }
  return null;
}

function findRows(sheetName, filterFn, _repaired) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    if (!_repaired && (data.length === 0 || (data.length === 1 && (!data[0] || data[0].length === 0 || !data[0][0])))) {
      ensureSheetHeaders(sheetName);
      return findRows(sheetName, filterFn, true);
    }
    return [];
  }
  const headers = data[0];
  if (!headers || headers.length === 0 || !headers[0]) {
    if (!_repaired) {
      ensureSheetHeaders(sheetName);
      return findRows(sheetName, filterFn, true);
    }
    return [];
  }
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, idx) => row[h] = data[i][idx]);
    if (!row.id && row.id !== 0) continue;
    if (typeof row.id === 'string' && row.id.length > 30) continue;
    if (filterFn(row)) results.push(row);
  }
  return results;
}

function updateRow(sheetName, id, updates) {
  const found = findRowById(sheetName, id);
  if (!found) return { success: false, error: 'Linha não encontrada' };
  const sheet = getSheet(sheetName);
  const headers = found.headers;
  Object.keys(updates).forEach(key => {
    const colIdx = headers.indexOf(key);
    if (colIdx >= 0) {
      sheet.getRange(found.row, colIdx + 1).setValue(updates[key]);
    }
  });
  return { success: true };
}



function generateId() {
  return Utilities.getUuid().substring(0, 12);
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 5 — SETUP DA PLANILHA
   ═══════════════════════════════════════════════════════════════════ */

function setupCompletoSGPO() {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abas = getDefinicaoAbas();

  const defaultSheet = ss.getSheetByName('Sheet1');
  let criadas = 0;
  let atualizadas = 0;
  let erros = [];

  abas.forEach((def) => {
    try {
      let sheet = ss.getSheetByName(def.nome);
      if (!sheet) {
        sheet = ss.insertSheet(def.nome);
        criadas++;
      } else {
        atualizadas++;
      }
      configurarAba(ss, sheet, def);
    } catch (e) {
      erros.push(def.nome + ': ' + e.message);
    }
  });

  try {
    if (defaultSheet && defaultSheet.getLastRow() === 0) {
      ss.deleteSheet(defaultSheet);
    }
  } catch (e) {}

  const nomeAtual = ss.getName();
  if (nomeAtual === 'Planilha sem título' || nomeAtual === 'Untitled spreadsheet') {
    ss.rename('SGPO - Banco de Dados v' + SGPO_VERSION);
  }

  try { criarMenuSGPO(); } catch (e) {}

  try {
    ss.setActiveSheet(ss.getSheetByName('Configuracoes'));
  } catch (e) {}

  SpreadsheetApp.flush();

  const elapsed = ((new Date().getTime() - startTime) / 1000).toFixed(1);

  const ui = SpreadsheetApp.getUi();
  let msg = '✅ SETUP COMPLETO!\n\n';
  msg += '📋 Abas criadas: ' + criadas + '\n';
  msg += '🔄 Abas atualizadas: ' + atualizadas + '\n';
  msg += '⏱️ Tempo: ' + elapsed + 's\n';
  msg += '📊 Total de abas: ' + abas.length + '\n';
  msg += '🔧 Versão: ' + SGPO_VERSION + '\n\n';

  if (erros.length > 0) {
    msg += '⚠️ Erros:\n' + erros.join('\n') + '\n\n';
  }

  msg += 'PRÓXIMOS PASSOS:\n';
  msg += '1. Verifique os dados nas abas\n';
  msg += '2. Deploy → Nova implementação → Web App\n';
  msg += '3. Execute como: "Eu" | Quem acessa: "Qualquer pessoa"\n';
  msg += '4. Copie a URL e configure no SGPO';

  ui.alert('SGPO - Setup v' + SGPO_VERSION, msg, ui.ButtonSet.OK);
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 6 — ATUALIZAÇÃO INCREMENTAL DE SCHEMA
   ═══════════════════════════════════════════════════════════════════ */

function _sheetHasValidHeaders(existingHeaders, expectedHeaders) {
  if (!existingHeaders || existingHeaders.length === 0) return false;
  let matches = 0;
  for (var i = 0; i < expectedHeaders.length; i++) {
    if (existingHeaders.indexOf(expectedHeaders[i]) !== -1) matches++;
  }
  return matches >= Math.ceil(expectedHeaders.length * 0.5);
}

function _repararAba(ss, sheet, def) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow > 0 && lastCol > 0) {
    sheet.clearContents();
    sheet.clearFormats();
    sheet.clearDataValidations();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }
    if (lastCol > 1) {
      sheet.deleteColumns(2, lastCol - 1);
    }
    const firstColValues = sheet.getRange(1, 1, 1, 1).getValues()[0];
    if (firstColValues[0]) {
      sheet.getRange(1, 1).setValue('');
    }
  }
  configurarAba(ss, sheet, def);
}

function atualizarSchema() {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abas = getDefinicaoAbas();
  let adicionadas = 0;
  let abasNovas = 0;
  let reparadas = 0;
  let erros = [];

  abas.forEach((def) => {
    try {
      let sheet = ss.getSheetByName(def.nome);

      if (!sheet) {
        sheet = ss.insertSheet(def.nome);
        abasNovas++;
        configurarAba(ss, sheet, def);
        return;
      }

      var existingHeaders = sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : [];

      var expectedHeaders = def.colunas.map(function(c) { return c.nome; });
      var needsRepair = false;

      if (sheet.getLastColumn() === 0 && sheet.getLastRow() === 0) {
        needsRepair = true;
      } else if (!_sheetHasValidHeaders(existingHeaders, expectedHeaders)) {
        needsRepair = true;
      }

      if (needsRepair) {
        _repararAba(ss, sheet, def);
        reparadas++;
        return;
      }

      var newHeaders = def.colunas.map(function(c) { return c.nome; });

      newHeaders.forEach(function(h, i) {
        if (existingHeaders.indexOf(h) === -1) {
          var posicao = i + 1;
          if (posicao <= sheet.getLastColumn() + 1) {
            sheet.insertColumnBefore(posicao);
            var cell = sheet.getRange(1, posicao);
            cell.setValue(h);
            cell.setFontWeight('bold');
            cell.setFontSize(10);
            cell.setFontFamily('Arial');
            cell.setBackground(def.cor || '#1a1a25');
            cell.setFontColor('#ffffff');
            cell.setHorizontalAlignment('center');
            cell.setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THIN);
            sheet.setColumnWidth(posicao, def.colunas[i].largura || 150);

            if (def.colunas[i].tipo === 'dropdown' && def.colunas[i].opcoes) {
              var rule = SpreadsheetApp.newDataValidation()
                .requireValueInList(def.colunas[i].opcoes, true)
                .setAllowInvalid(false)
                .build();
              sheet.getRange(2, posicao, 500, 1).setDataValidation(rule);
            }

            adicionadas++;
          }
        }
      });

      var lastDataRow = sheet.getLastRow();
      def.colunas.forEach(function(col, i) {
        if (col.tipo === 'dropdown' && col.opcoes) {
          var existingRule = sheet.getRange(2, i + 1).getDataValidation();
          if (!existingRule) {
            var rule = SpreadsheetApp.newDataValidation()
              .requireValueInList(col.opcoes, true)
              .setAllowInvalid(false)
              .build();
            sheet.getRange(2, i + 1, Math.max(500, lastDataRow), 1).setDataValidation(rule);
          }
        }
      });

    } catch (e) {
      erros.push(def.nome + ': ' + e.message);
    }
  });

  try { criarMenuSGPO(); } catch (e) {}

  SpreadsheetApp.flush();
  var elapsed = ((new Date().getTime() - startTime) / 1000).toFixed(1);

  var ui = SpreadsheetApp.getUi();
  var msg = 'ATUALIZACAO DE SCHEMA CONCLUIDA!\n\n';
  msg += 'Abas novas criadas: ' + abasNovas + '\n';
  msg += 'Abas reparadas (headers corrigidos): ' + reparadas + '\n';
  msg += 'Colunas novas adicionadas: ' + adicionadas + '\n';
  msg += 'Tempo: ' + elapsed + 's\n';
  msg += 'Versao: ' + SGPO_VERSION + '\n\n';

  if (erros.length > 0) {
    msg += 'ERROS:\n' + erros.join('\n') + '\n\n';
  }

  msg += 'Dados existentes foram PRESERVADOS quando possivel.';

  ui.alert('SGPO - Atualizar Schema', msg, ui.ButtonSet.OK);
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 6.25 — REPARO COMPLETO DE ABAS
   ═══════════════════════════════════════════════════════════════════ */

function repararAbas() {
  var result = repararAbasSilencioso();
  var ui = SpreadsheetApp.getUi();
  var msg = 'REPARO COMPLETO CONCLUIDO!\n\n';
  msg += 'Abas reparadas: ' + result.reparadas + '\n';
  msg += 'Tempo: ' + result.elapsed + 's\n';
  msg += 'Versao: ' + SGPO_VERSION + '\n\n';
  msg += 'ATENCAO: Dados em abas com headers incorretos foram limpos.\n';
  msg += 'Apenas os dados padroes foram inseridos.\n\n';
  if (result.erros.length > 0) {
    msg += 'ERROS:\n' + result.erros.join('\n') + '\n\n';
  }
  msg += 'PROXIMO PASSO:\n';
  msg += 'Deploy -> Nova implantacao -> Web App\n';
  msg += 'Executar como: "Eu" | Quem acessa: "Qualquer pessoa"';
  ui.alert('SGPO - Reparar Abas', msg, ui.ButtonSet.OK);
}

function repararAbasSilencioso() {
  var startTime = new Date().getTime();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var abas = getDefinicaoAbas();
  var reparadas = 0;
  var erros = [];

  abas.forEach(function(def) {
    try {
      var sheet = ss.getSheetByName(def.nome);
      if (!sheet) {
        sheet = ss.insertSheet(def.nome);
      }
      _repararAba(ss, sheet, def);
      reparadas++;
    } catch (e) {
      erros.push(def.nome + ': ' + e.message);
    }
  });

  try { criarMenuSGPO(); } catch (e) {}

  SpreadsheetApp.flush();
  var elapsed = ((new Date().getTime() - startTime) / 1000).toFixed(1);
  return { reparadas: reparadas, elapsed: elapsed, erros: erros };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 6.5 — MIGRAÇÃO DE SENHAS (HASH)
   ═══════════════════════════════════════════════════════════════════ */

function migrarSenhasParaHash() {
  const sheet = getSheet('Usuarios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const senhaCol = headers.indexOf('senha');
  const hashCol = headers.indexOf('senhaHash');
  if (senhaCol === -1 || hashCol === -1) {
    SpreadsheetApp.getUi().alert('Colunas senha/senhaHash não encontradas. Execute "Atualizar Schema" primeiro.');
    return;
  }
  let migradas = 0;
  for (let i = 1; i < data.length; i++) {
    const senhaAtual = data[i][senhaCol];
    const hashAtual = data[i][hashCol];
    if (senhaAtual && !hashAtual) {
      sheet.getRange(i + 1, hashCol + 1).setValue(_hashPassword(String(senhaAtual)));
      migradas++;
    }
  }
  SpreadsheetApp.getUi().alert('Migração concluída!\n\nSenhas migradas para SHA-256: ' + migradas);
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 7 — CONFIGURAR UMA ABA (HELPERS DE FORMATAÇÃO)
   ═══════════════════════════════════════════════════════════════════ */

function configurarAba(ss, sheet, def) {
  const numColunas = def.colunas.length;

  const headerRange = sheet.getRange(1, 1, 1, numColunas);
  headerRange.setValues([def.colunas.map(c => c.nome)]);
  headerRange.setFontWeight('bold');
  headerRange.setFontSize(10);
  headerRange.setFontFamily('Arial');
  headerRange.setBackground(def.cor || CORES.bgCard);
  headerRange.setFontColor('#ffffff');
  headerRange.setVerticalAlignment('middle');
  headerRange.setHorizontalAlignment('center');
  headerRange.setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THIN);

  if (def.descricao) {
    const descRange = sheet.getRange(2, 1, 1, numColunas);
    descRange.merge();
    descRange.setValue('📋 ' + def.descricao);
    descRange.setFontSize(9);
    descRange.setFontStyle('italic');
    descRange.setFontColor(CORES.textoMudo);
    descRange.setBackground(CORES.bgMedio);
    descRange.setVerticalAlignment('middle');
    descRange.setFormula(' ');
  }

  def.colunas.forEach((col, i) => {
    sheet.setColumnWidth(i + 1, col.largura || 150);
  });

  sheet.setRowHeight(1, 36);
  if (def.descricao) sheet.setRowHeight(2, 24);

  if (def.dados && def.dados.length > 0) {
    const startRow = def.descricao ? 3 : 2;
    const existingDataRows = sheet.getLastRow();

    if (existingDataRows < startRow) {
      const dataRange = sheet.getRange(startRow, 1, def.dados.length, numColunas);
      dataRange.setValues(def.dados);
      dataRange.setFontSize(10);
      dataRange.setFontFamily('Arial');
      dataRange.setVerticalAlignment('middle');

      for (let r = 0; r < def.dados.length; r++) {
        const rowRange = sheet.getRange(startRow + r, 1, 1, numColunas);
        rowRange.setBackground(r % 2 === 0 ? '#ffffff' : '#f8f9fa');

        def.colunas.forEach((col, c) => {
          const cell = sheet.getRange(startRow + r, c + 1);
          const val = def.dados[r][c];

          if (col.tipo === 'booleano') {
            cell.setValue(val === true ? '✓' : '✗');
            cell.setFontColor(val === true ? '#0d652d' : '#c5221f');
            cell.setHorizontalAlignment('center');
          }
          if (col.tipo === 'data' && val && typeof val === 'string' && val.includes('T')) {
            cell.setNumberFormat('dd/MM/yyyy HH:mm');
          }
          if (col.tipo === 'numero') {
            cell.setHorizontalAlignment('center');
          }
          if (col.nome === 'Status') {
            cell.setFontColor(val === 'ativo' ? '#0d652d' : '#c5221f');
            if (val === 'ativo') cell.setFontWeight('bold');
          }
          if (col.nome === 'prontidao') {
            const cores = { verde: '#0d652d', amarela: '#7a6800', azul: '#185abc', branca: '#5f6368' };
            cell.setFontColor(cores[val] || '#000000');
            cell.setFontWeight('bold');
          }
          if (col.nome === 'status') {
            const cores = {
              concluida: '#0d652d', em_andamento: '#7a6800',
              nao_iniciada: '#185abc', cancelada: '#c5221f', nao_realizada: '#e37400'
            };
            cell.setFontColor(cores[val] || '#000000');
          }
        });
      }
    }
  }

  const startRow = def.descricao ? 3 : 2;
  def.colunas.forEach((col, i) => {
    if (col.tipo === 'dropdown' && col.opcoes) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(col.opcoes, true)
        .setAllowInvalid(false)
        .build();
      sheet.getRange(startRow, i + 1, 500, 1).setDataValidation(rule);
    }
  });

  sheet.setFrozenRows(def.descricao ? 2 : 1);
  sheet.setFrozenColumns(0);

  try {
    SpreadsheetApp.newProtectRange()
      .setDescription('Cabeçalho protegido - ' + def.nome)
      .setWarningOnly(true)
      .setRange(headerRange)
      .add();
    if (def.descricao) {
      SpreadsheetApp.newProtectRange()
        .setDescription('Descrição protegida - ' + def.nome)
        .setWarningOnly(true)
        .setRange(sheet.getRange(2, 1, 1, numColunas))
        .add();
    }
  } catch (e) {}
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 8 — MENU PERSONALIZADO
   ═══════════════════════════════════════════════════════════════════ */

function onOpen() {
  criarMenuSGPO();
}

function criarMenuSGPO() {
  SpreadsheetApp.getUi()
    .createMenu('🔥 SGPO')
    .addItem('🔄 Setup Completo', 'setupCompletoSGPO')
    .addItem('⬆️ Atualizar Schema', 'atualizarSchema')
    .addItem('🔧 Reparar Abas (corrigir headers)', 'repararAbas')
    .addSeparator()
    .addItem('👤 Popular Dados de Exemplo', 'popularDadosExemplo')
    .addItem('🗑️ Limpar Dados Demo', 'limparDadosDemo')
    .addSeparator()
    .addItem('🔐 Migrar Senhas p/ SHA-256', 'migrarSenhasParaHash')
    .addSeparator()
    .addItem('📊 Status da Planilha', 'mostrarStatus')
    .addItem('🧪 Testar API', 'testarAPI')
    .addToUi();
}

function gerarIdUI() {
  SpreadsheetApp.getUi().alert('ID Gerado: ' + gerarId(), 'Copie e use onde necessário.', SpreadsheetApp.getUi().ButtonSet.OK);
}

function popularDadosExemplo() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Popular Dados de Exemplo',
    'Dados de exemplo já são inseridos automaticamente no Setup Completo.\n\n' +
    'Execute "🔄 Setup Completo" para recriar com dados padrão.',
    ui.ButtonSet.OK);
}

function limparDadosDemo() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('⚠️ Limpar Dados Demo',
    'Isso remove TODOS os dados de:\n• Usuarios\n• Militares\n• Oficiais\n• Configuracoes\n\nDados de serviços NÃO serão afetados.\n\nContinuar?',
    ui.ButtonSet.YES_NO);

  if (r !== ui.Button.YES) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Usuarios', 'Militares', 'Oficiais', 'Configuracoes'].forEach(nome => {
    const sheet = ss.getSheetByName(nome);
    if (sheet && sheet.getLastRow() > 2) {
      sheet.getRange(3, 1, sheet.getLastRow() - 2, sheet.getLastColumn()).clear();
    }
  });

  ui.alert('✅ Dados demo removidos!');
}

function mostrarStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();

  let msg = '📊 STATUS DA PLANILHA SGPO\n';
  msg += '═══════════════════════════\n\n';
  msg += 'Nome: ' + ss.getName() + '\n';
  msg += 'Versão: ' + SGPO_VERSION + '\n';
  msg += 'URL: ' + ss.getUrl() + '\n';
  msg += 'Total de abas: ' + sheets.length + '\n\n';
  msg += 'ABAS:\n';

  sheets.forEach(sheet => {
    const rows = Math.max(0, sheet.getLastRow() - 2);
    const cols = sheet.getLastColumn();
    msg += '  • ' + sheet.getName() + ' → ' + rows + ' registros, ' + cols + ' colunas\n';
  });

  ui.alert('SGPO - Status', msg, ui.ButtonSet.OK);
}

function testarAPI() {
  const ui = SpreadsheetApp.getUi();
  try {
    const resultado = handleRead({ sheet: 'Usuarios', filters: {} });
    ui.alert('🧪 Teste da API',
      '✅ API funcionando!\n\n' +
      'Tabela: Usuarios\n' +
      'Registros encontrados: ' + resultado.length + '\n' +
      'Versão: ' + SGPO_VERSION,
      ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('❌ Erro na API', e.message, ui.ButtonSet.OK);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 8B — POSTOS DE SERVIÇO E PERMISSÕES
   ═══════════════════════════════════════════════════════════════════ */

function getPostosServico() {
  const postos = findRows('PostosServico', r => r.Status === 'ativo');
  return postos.map(p => ({
    id: p.id,
    nome: p.nome,
    tipo: p.tipo,
    postoPaiId: p.postoPaiId || '',
    responsavelId: p.responsavelId || '',
    ordem: p.ordem || 0,
    logo: p.logo || '',
    ativo: p.ativo
  }));
}

function getUsuariosPostos(data) {
  const { usuarioId, postoId } = data || {};
  return findRows('UsuariosPostos', r => {
    if (r.Status !== 'ativo') return false;
    if (usuarioId && r.usuarioId !== usuarioId) return false;
    if (postoId && r.postoId !== postoId) return false;
    return true;
  }).map(up => ({
    id: up.id,
    usuarioId: up.usuarioId,
    postoId: up.postoId,
    papel: up.papel || 'operador',
    dataVinculo: up.dataVinculo || ''
  }));
}

function checkAcessoServico(data) {
  const { servicoId, usuarioId, nivelPermissao, postos } = data;

  if (nivelPermissao === 'GB') return { permitido: true, motivo: 'Acesso GB' };

  const permPendente = findRows('PermissoesServico', r =>
    r.servicoId === servicoId && r.usuarioId === usuarioId && r.status === 'pendente' && r.Status === 'ativo'
  );
  if (permPendente.length > 0) return { permitido: false, motivo: 'Solicitação pendente' };

  const permAprovada = findRows('PermissoesServico', r =>
    r.servicoId === servicoId && r.usuarioId === usuarioId && r.status === 'aprovado' && r.Status === 'ativo'
  );
  if (permAprovada.length > 0) return { permitido: true, motivo: 'Acesso aprovado' };

  const servico = findRowById('Servicos', servicoId);
  if (!servico) return { permitido: false, motivo: 'Serviço não encontrado' };

  const equipeCol = servico.headers.indexOf('equipe');
  try {
    const equipe = JSON.parse(servico.data[equipeCol] || '[]');
    const isEquipe = equipe.some(e => e.id === usuarioId);
    if (isEquipe) return { permitido: true, motivo: 'Membro da equipe' };
  } catch (e) {}

  const servicoPostoId = servico.data[servico.headers.indexOf('postoId')];
  if (servicoPostoId && postos && postos.length > 0) {
    const userPostoIds = postos.map(p => p.id);
    if (userPostoIds.includes(servicoPostoId)) return { permitido: true, motivo: 'Mesmo posto do serviço' };
  }

  return { permitido: false, motivo: 'Sem acesso ao serviço' };
}

function solicitarAcessoServico(data) {
  const { usuarioId, usuarioNome, servicoId, tipo, motivo } = data;

  const existente = findRows('PermissoesServico', r =>
    r.usuarioId === usuarioId && r.servicoId === servicoId && r.status === 'pendente' && r.Status === 'ativo'
  );
  if (existente.length > 0) return { success: false, error: 'Já existe solicitação pendente' };

  const sheet = getSheet('PermissoesServico');
  sheet.appendRow([
    generateId(),
    new Date().toISOString(),
    usuarioId,
    usuarioNome || '',
    servicoId,
    tipo || 'visualizar',
    'pendente',
    motivo || '',
    '',
    '',
    'ativo',
    'ativo'
  ]);

  const servico = findRowById('Servicos', servicoId);
  if (servico) {
    const comandanteNome = servico.data[7] || 'Comandante';
    logNotificacao(servicoId, `${usuarioNome} solicitou acesso (${tipo}) ao serviço`, 'alerta');
  }

  logAuditoria('solicitar_acesso', usuarioNome, `Solicitação de acesso ao serviço ${servicoId}`);

  return { success: true };
}

function responderAcessoServico(data) {
  const { permissaoId, aprovado, aprovadoPor, servicoId, usuarioId, motivo } = data;

  const found = findRowById('PermissoesServico', permissaoId);
  if (!found) return { success: false, error: 'Solicitação não encontrada' };

  const s = getSheet('PermissoesServico');
  const headers = found.headers;

  const statusCol = headers.indexOf('status');
  const aprovadoPorCol = headers.indexOf('aprovadoPor');
  const dataRespostaCol = headers.indexOf('dataResposta');

  if (statusCol !== -1) s.getRange(found.row, statusCol + 1).setValue(aprovado ? 'aprovado' : 'recusado');
  if (aprovadoPorCol !== -1) s.getRange(found.row, aprovadoPorCol + 1).setValue(aprovadoPor || '');
  if (dataRespostaCol !== -1) s.getRange(found.row, dataRespostaCol + 1).setValue(new Date().toISOString());

  logNotificacao(servicoId,
    `Solicitação de acesso ${aprovado ? 'aprovada' : 'recusada'} por ${aprovadoPor}`,
    aprovado ? 'info' : 'alerta'
  );

  logAuditoria('responder_acesso', aprovadoPor, `${aprovado ? 'Aprovou' : 'Recusou'} acesso ao serviço ${servicoId}`);

  return { success: true };
}

function getPermissoesServico(data) {
  const { servicoId, status } = data || {};
  return findRows('PermissoesServico', r => {
    if (r.Status !== 'ativo') return false;
    if (servicoId && r.servicoId !== servicoId) return false;
    if (status && r.status !== status) return false;
    return true;
  });
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 8C — HIERARQUIA E PERMISSÕES DE USUÁRIOS
   ═══════════════════════════════════════════════════════════════════ */

function getPostosFilhos(postoId) {
  const filhos = findRows('PostosServico', r => r.postoPaiId === postoId && r.Status === 'ativo');
  let todos = [...filhos];
  filhos.forEach(f => { todos = todos.concat(getPostosFilhos(f.id)); });
  return todos;
}

function getPostosHierarquia(usuarioId) {
  const userPostos = findRows('UsuariosPostos', r => r.usuarioId === usuarioId && r.Status === 'ativo');
  let todosPostos = [];
  userPostos.forEach(up => {
    const posto = findRowById('PostosServico', up.postoId);
    if (!posto) return;
    const tipo = posto.data[posto.headers.indexOf('tipo')];
    if (tipo === 'GB') {
      const gbs = findRows('PostosServico', r => r.Status === 'ativo');
      todosPostos = gbs;
    } else if (tipo === 'SGB') {
      todosPostos.push(posto.data);
      const filhos = getPostosFilhos(up.postoId);
      filhos.forEach(f => todosPostos.push(f));
    } else {
      todosPostos.push(posto.data);
    }
  });
  return todosPostos;
}

function getUsuarioNivel(usuarioId) {
  const found = findRowById('Usuarios', usuarioId);
  if (!found) return null;
  return found.data[found.headers.indexOf('nivelPermissao')] || 'POSTO';
}

function podeEditarUsuario(editorId, targetId) {
  if (editorId === targetId) return true;

  const editorNivel = getUsuarioNivel(editorId);
  if (!editorNivel) return false;

  if (editorNivel === 'GB') return true;

  const editorPostos = getPostosHierarquia(editorId);
  const editorPostoIds = editorPostos.map(p => p.id || p[0]);

  const targetPostos = findRows('UsuariosPostos', r => r.usuarioId === targetId && r.Status === 'ativo');

  for (const tp of targetPostos) {
    if (editorPostoIds.includes(tp.postoId)) return true;
  }

  return false;
}

function podeConcederPermissao(editorId, targetPerfil, targetNivel) {
  const editorNivel = getUsuarioNivel(editorId);
  if (!editorNivel) return false;

  const ordem = { 'GB': 3, 'SGB': 2, 'POSTO': 1 };
  return (ordem[editorNivel] || 0) >= (ordem[targetNivel] || 0);
}

function handleUpdateComPermissao(data) {
  const { sheet, id, row } = data;

  if (sheet === 'usuarios' || sheet === 'Usuarios') {
    if (id === SUPER_USER.id) return { success: false, error: 'Este registro não pode ser alterado' };
    if (row.senha) {
      row.senhaHash = _hashPassword(row.senha);
    }
    if (_authUser && _authUser.id !== SUPER_USER.id && _authUser.usuario !== SUPER_USER.usuario) {
      if (!podeEditarUsuario(_authUser.id, id)) {
        return { success: false, error: 'Você não tem permissão para alterar este usuário' };
      }
      if (row.perfil || row.nivelPermissao) {
        const editorNivel = getUsuarioNivel(_authUser.id);
        if (editorNivel !== 'GB' && _authUser.id !== id) {
          if (row.nivelPermissao && !podeConcederPermissao(_authUser.id, row.perfil, row.nivelPermissao)) {
            return { success: false, error: 'Você não pode conceder este nível de permissão' };
          }
        }
      }
    }
  }

  const found = findRowById(sheet, id);
  if (!found) return { success: false, error: 'Registro não encontrado' };

  const s = getSheet(sheet);
  const headers = found.headers;
  Object.entries(row).forEach(([key, val]) => {
    const colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      s.getRange(found.row, colIdx + 1).setValue(val);
    }
  });

  logAuditoria('update', (_authUser && _authUser.nome) || 'sistema', `Atualizou ${id} em ${sheet}`);
  return { success: true };
}

function handleCreateComPermissao(data) {
  const { sheet, row } = data;

  if (sheet === 'usuarios' || sheet === 'Usuarios') {
    if (_authUser && _authUser.id !== SUPER_USER.id && _authUser.usuario !== SUPER_USER.usuario) {
      if (row.nivelPermissao && !podeConcederPermissao(_authUser.id, row.perfil, row.nivelPermissao)) {
        return { success: false, error: 'Você não pode criar usuário com este nível de permissão' };
      }
      if (row.postoDefaultId) {
        const editorPostos = getPostosHierarquia(_authUser.id);
        const editorPostoIds = editorPostos.map(p => p.id || p[0]);
        if (!editorPostoIds.includes(row.postoDefaultId)) {
          return { success: false, error: 'Você não pode criar usuário neste posto' };
        }
      }
    }
    if (row.senha) {
      row.senhaHash = _hashPassword(row.senha);
    }
  }

  const s = getSheet(sheet);
  var headers = ensureSheetHeaders(sheet);
  if (!headers || headers.length === 0 || !headers[0]) {
    return { success: false, error: 'A aba "' + sheet + '" nao pôde ser reparada automaticamente.' };
  }
  const id = generateId();
  const now = new Date().toISOString();
  const newRow = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'dataCadastro') return now;
    if (h === 'Status') return 'ativo';
    if (h === 'ativo') return true;
    if (h === 'senhaHash') return row.senhaHash || '';
    if (h === 'mustChangePassword') return true;
    if (h === 'ultimoAcesso') return now;
    return (row[h] !== undefined && row[h] !== null) ? row[h] : '';
  });
  s.appendRow(newRow);
  logAuditoria('create', (_authUser && _authUser.nome) || 'sistema', `Criou registro em ${sheet}`);

  if (sheet === 'militares' || sheet === 'Militares') {
    try {
      if (row && row.reCpf) {
        const userSheet = getSheet('Usuarios');
        const userRows = userSheet.getDataRange().getValues();
        const userHeaders = userRows[0];
        const cpfCol = userHeaders.indexOf('cpf');
        const reColLegacy = userHeaders.indexOf('reCpf');
        const exists = (cpfCol !== -1 && userRows.slice(1).some(r => String(r[cpfCol]) === String(row.reCpf))) ||
                       (reColLegacy !== -1 && userRows.slice(1).some(r => String(r[reColLegacy]) === String(row.reCpf)));
        if (!exists) {
          const DEFAULT_PASSWORD = '123456';
          const userId = generateId();
          const userNow = new Date().toISOString();
          const userRow = userHeaders.map(h => {
            if (h === 'id') return userId;
            if (h === 'dataCadastro') return userNow;
            if (h === 'nome') return row.nome || '';
            if (h === 're') return row.reCpf || '';
            if (h === 'senha') return DEFAULT_PASSWORD;
            if (h === 'senhaHash') return _hashPassword(DEFAULT_PASSWORD);
            if (h === 'mustChangePassword') return true;
            if (h === 'perfil') return 'operador';
            if (h === 'email') return row.email || '';
            if (h === 'telefone') return row.telefone || '';
            if (h === 'foto') return '';
            if (h === 'nivelPermissao') return '';
            if (h === 'postoDefaultId') return '';
            if (h === 'ativo') return true;
            if (h === 'ultimoAcesso') return userNow;
            if (h === 'Status') return 'ativo';
            return '';
          });
          userSheet.appendRow(userRow);
          logAuditoria('auto_criar_usuario', (_authUser && _authUser.nome) || 'sistema',
            `Usuário automático criado para militar ${row.nome} (RE: ${row.reCpf})`);
        }
      }
    } catch (e) {
      console.error('Erro ao criar usuário automático:', e.message);
    }
  }

  if (sheet === 'usuarios' || sheet === 'Usuarios') {
    try {
      if (row && row.re) {
        const milSheet = getSheet('Militares');
        const milData = milSheet.getDataRange().getValues();
        const milHeaders = milData[0];
        const reCol = milHeaders.indexOf('reCpf');
        const exists = reCol !== -1 && milData.slice(1).some(r => String(r[reCol]) === String(row.re));
        if (!exists) {
          const milId = generateId();
          const milNow = new Date().toISOString();
          const milRow = milHeaders.map(h => {
            if (h === 'id') return milId;
            if (h === 'dataCadastro') return milNow;
            if (h === 'nome') return row.nome || '';
            if (h === 'reCpf') return row.re || '';
            if (h === 'ativo') return true;
            if (h === 'Status') return 'ativo';
            return '';
          });
          milSheet.appendRow(milRow);
          logAuditoria('auto_criar_militar', (_authUser && _authUser.nome) || 'sistema',
            `Militar automático criado para usuário ${row.nome} (RE: ${row.re})`);
        }
      }
    } catch (e) {
      console.error('Erro ao criar militar automático:', e.message);
    }
  }

  return { success: true, id };
}

function getUsuariosEditaveis(data) {
  const { editorId } = data;
  if (!editorId) return findRows('Usuarios', r => r.Status !== 'removido').filter(u => u.usuario !== SUPER_USER.usuario);

  if (editorId === SUPER_USER.id) {
    return findRows('Usuarios', r => r.Status !== 'removido').filter(u => u.usuario !== SUPER_USER.usuario);
  }

  const editorNivel = getUsuarioNivel(editorId);
  if (!editorNivel) {
    return findRows('Usuarios', r => r.Status !== 'removido').filter(u => u.usuario !== SUPER_USER.usuario);
  }

  if (editorNivel === 'GB') {
    const todos = findRows('Usuarios', r => r.Status !== 'removido');
    return todos.filter(u => u.usuario !== SUPER_USER.usuario);
  }

  const editorPostos = getPostosHierarquia(editorId);
  const editorPostoIds = editorPostos.map(p => p.id || p[0]);

  const todosUsuarios = findRows('Usuarios', r => r.Status !== 'removido');
  return todosUsuarios.filter(u => {
    if (u.usuario === SUPER_USER.usuario) return false;
    const userPostos = findRows('UsuariosPostos', r => r.usuarioId === u.id && r.Status === 'ativo');
    return userPostos.some(up => editorPostoIds.includes(up.postoId));
  });
}

function getServicoPorPosto(data) {
  const { postoId } = data;
  if (!postoId) return { error: 'postoId obrigatório' };
  const today = new Date().toISOString().split('T')[0];
  const servicos = findRows('servicos', r => r.data === today && r.Status !== 'encerrado' && r.postoId === postoId);
  return servicos.length > 0 ? servicos[0] : null;
}

/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 8B — VIATURAS, SERVIÇO-VIATURA E OCORRÊNCIAS
   ═══════════════════════════════════════════════════════════════════ */

function getServicoViaturas(data) {
  const { servicoId } = data;
  if (!servicoId) return [];
  return findRows('servico_viatura', r => r.servicoId === servicoId && r.Status !== 'removido');
}

function iniciarServicoViatura(data) {
  const { servicoId, viaturaId, viaturaNome, motorista, motoristaId, tripulantes } = data;
  if (!servicoId || !viaturaId) return { success: false, error: 'servicoId e viaturaId obrigatórios' };
  const existing = findRows('servico_viatura', r => r.servicoId === servicoId && r.viaturaId === viaturaId && r.Status !== 'removido');
  if (existing.length > 0) return { success: false, error: 'Viatura já vinculada a este serviço' };
  const now = Utils.formatTime(new Date());
  const id = gerarId();
  const s = getSheet('ServicoViatura');
  s.appendRow([id, new Date().toISOString(), servicoId, viaturaId, viaturaNome || '', motorista || '', motoristaId || '', JSON.stringify(tripulantes || []), now, '', 'ativa', 'ativo']);
  logAuditoria('viatura', (_authUser && _authUser.nome) || 'sistema', `Viatura ${viaturaNome} vinculada ao serviço ${servicoId}`);
  return { success: true, id };
}

function editarServicoViatura(data) {
  const { id, motorista, motoristaId, tripulantes } = data;
  if (!id) return { success: false, error: 'ID obrigatório' };
  const found = findRowById('servico_viatura', id);
  if (!found) return { success: false, error: 'Registro não encontrado' };
  const s = getSheet('ServicoViatura');
  if (motorista !== undefined) {
    const col = found.headers.indexOf('motorista');
    if (col !== -1) s.getRange(found.row, col + 1).setValue(motorista);
  }
  if (motoristaId !== undefined) {
    const col = found.headers.indexOf('motoristaId');
    if (col !== -1) s.getRange(found.row, col + 1).setValue(motoristaId);
  }
  if (tripulantes !== undefined) {
    const col = found.headers.indexOf('tripulantes');
    if (col !== -1) s.getRange(found.row, col + 1).setValue(JSON.stringify(tripulantes));
  }
  return { success: true };
}

function encerrarServicoViatura(data) {
  const { servicoId } = data;
  if (!servicoId) return { success: false, error: 'servicoId obrigatório' };
  const rows = findRows('servico_viatura', r => r.servicoId === servicoId && r.Status === 'ativo');
  const s = getSheet('ServicoViatura');
  rows.forEach(r => {
    const found = findRowById('servico_viatura', r.id);
    if (found) {
      const statusCol = found.headers.indexOf('Status');
      if (statusCol !== -1) s.getRange(found.row, statusCol + 1).setValue('encerrado');
    }
  });
  return { success: true };
}

function despacharViatura(data) {
  const { servicoViaturaId } = data;
  if (!servicoViaturaId) return { success: false, error: 'servicoViaturaId obrigatório' };
  const found = findRowById('servico_viatura', servicoViaturaId);
  if (!found) return { success: false, error: 'Viatura não encontrada' };
  const now = Utils.formatTime(new Date());
  const s = getSheet('ServicoViatura');
  const saidaCol = found.headers.indexOf('horarioSaida');
  if (saidaCol !== -1) s.getRange(found.row, saidaCol + 1).setValue(now);
  const statusCol = found.headers.indexOf('status');
  if (statusCol !== -1) s.getRange(found.row, statusCol + 1).setValue('em_ocorrencia');

  const tripulantesRaw = found.data[found.headers.indexOf('tripulantes')] || '[]';
  let tripulantes = [];
  try { tripulantes = JSON.parse(tripulantesRaw); } catch(e) {}
  const motoristaId = found.data[found.headers.indexOf('motoristaId')] || '';
  const todosIds = [motoristaId, ...tripulantes.map(t => t.id)].filter(Boolean);

  const servicoId = found.data[found.headers.indexOf('servicoId')];
  const telegrafiaRows = findRows('telegrafia', r => r.servicoId === servicoId && r.Status === 'ativo');
  telegrafiaRows.forEach(t => {
    if (todosIds.includes(t.militarId)) {
      const tFound = findRowById('telegrafia', t.id);
      if (tFound) {
        const ts = getSheet('Telegrafia');
        const stCol = tFound.headers.indexOf('Status');
        if (stCol !== -1) ts.getRange(tFound.row, stCol + 1).setValue('inativo');
        const inicio = t.horario || '00:00';
        const duracao = Utils.formatDuration(Date.now() - (new Date().setHours(parseInt(inicio.split(':')[0]), parseInt(inicio.split(':')[1]), 0, 0)));
        const histSheet = getSheet('TelegrafiaHistorico');
        histSheet.appendRow([gerarId(), new Date().toISOString(), servicoId, t.militarId, t.operador || '', t.horario || '', now, duracao.display || '-', 'ativo']);
        logAuditoria('telegrafia_eject', (_authUser && _authUser.nome) || 'sistema', `${t.operador} removido da telegrafia por ocorrência`);
        logNotificacao(servicoId, `${t.operador} removido da telegrafia (despacho de viatura)`, 'telegrafia');

        const equipe = findRows('servicos', r => r.id === servicoId);
        if (equipe.length > 0) {
          let eq = [];
          try { eq = JSON.parse(equipe[0].equipe || '[]'); } catch(e) {}
          const disponiveis = eq.filter(e => !todosIds.includes(e.id) && e.id !== t.militarId);
          if (disponiveis.length > 0) {
            const proximo = disponiveis[0];
            const proxMilitar = findRows('militares', r => r.id === proximo.id);
            if (proxMilitar.length > 0) {
              const ns = getSheet('Telegrafia');
              ns.appendRow([gerarId(), new Date().toISOString(), servicoId, proximo.id, proximo.nome, now, 'ativo']);
              logNotificacao(servicoId, `${proximo.nome} assumiu a telegrafia (substituído automaticamente)`, 'telegrafia');
            }
          } else {
            logNotificacao(servicoId, `Telegrafia ficou sem operador (todos despachados)`, 'telegrafia');
          }
        }
      }
    }
  });

  logAuditoria('viatura_despacho', (_authUser && _authUser.nome) || 'sistema', `Viatura ${found.data[found.headers.indexOf('viaturaNome')]} despachada`);
  return { success: true };
}

function retornarViatura(data) {
  const { servicoViaturaId } = data;
  if (!servicoViaturaId) return { success: false, error: 'servicoViaturaId obrigatório' };
  const found = findRowById('servico_viatura', servicoViaturaId);
  if (!found) return { success: false, error: 'Viatura não encontrada' };
  const now = Utils.formatTime(new Date());
  const s = getSheet('ServicoViatura');
  const retCol = found.headers.indexOf('horarioRetorno');
  if (retCol !== -1) s.getRange(found.row, retCol + 1).setValue(now);
  const statusCol = found.headers.indexOf('status');
  if (statusCol !== -1) s.getRange(found.row, statusCol + 1).setValue('retornando');
  logAuditoria('viatura_retorno', (_authUser && _authUser.nome) || 'sistema', `Viatura ${found.data[found.headers.indexOf('viaturaNome')]} retornou`);
  return { success: true };
}

function criarOcorrencia(data) {
  const { servicoId, titulo, natureza, descricao, viaturaIds, efetivo, prontidaoCor, dataOcorrencia, horaOcorrencia } = data;
  if (!servicoId || !titulo) return { success: false, error: 'servicoId e titulo obrigatórios' };
  const existentes = findRows('ocorrencias', r => r.servicoId === servicoId && r.Status !== 'removido');
  const numero = String(existentes.length + 1).padStart(3, '0');
  const now = horaOcorrencia || Utils.formatTime(new Date());
  const id = gerarId();
  const dataRef = dataOcorrencia || new Date().toISOString().split('T')[0];
  const s = getSheet('Ocorrencias');
  s.appendRow([id, new Date().toISOString(), numero, servicoId, titulo, natureza || '', descricao || '', JSON.stringify(viaturaIds || []), JSON.stringify(efetivo || []), now, '', prontidaoCor || '', 'em_atendimento', 'ativo']);
  logAuditoria('ocorrencia', (_authUser && _authUser.nome) || 'sistema', `Ocorrência #${numero} criada: ${titulo}${dataOcorrencia ? ' (ref: ' + dataOcorrencia + ' ' + now + ')' : ''}`);
  logNotificacao(servicoId, `Nova ocorrência #${numero}: ${titulo}`, 'urgente');
  return { success: true, id, numero };
}

function editarOcorrencia(data) {
  const { id, titulo, natureza, descricao, numero } = data;
  if (!id) return { success: false, error: 'ID obrigatório' };
  const found = findRowById('ocorrencias', id);
  if (!found) return { success: false, error: 'Ocorrência não encontrada' };
  const s = getSheet('Ocorrencias');
  if (titulo !== undefined) { const c = found.headers.indexOf('titulo'); if (c !== -1) s.getRange(found.row, c + 1).setValue(titulo); }
  if (natureza !== undefined) { const c = found.headers.indexOf('natureza'); if (c !== -1) s.getRange(found.row, c + 1).setValue(natureza); }
  if (descricao !== undefined) { const c = found.headers.indexOf('descricao'); if (c !== -1) s.getRange(found.row, c + 1).setValue(descricao); }
  if (numero !== undefined) { const c = found.headers.indexOf('numero'); if (c !== -1) s.getRange(found.row, c + 1).setValue(numero); }
  return { success: true };
}

function finalizarOcorrencia(data) {
  const { id } = data;
  if (!id) return { success: false, error: 'ID obrigatório' };
  const found = findRowById('ocorrencias', id);
  if (!found) return { success: false, error: 'Ocorrência não encontrada' };
  const now = Utils.formatTime(new Date());
  const s = getSheet('Ocorrencias');
  const retCol = found.headers.indexOf('horaRetorno');
  if (retCol !== -1) s.getRange(found.row, retCol + 1).setValue(now);
  const statusCol = found.headers.indexOf('status');
  if (statusCol !== -1) s.getRange(found.row, statusCol + 1).setValue('finalizada');
  logAuditoria('ocorrencia_finalizar', (_authUser && _authUser.nome) || 'sistema', `Ocorrência #${found.data[found.headers.indexOf('numero')]} finalizada`);
  return { success: true };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 9 — ENTRADAS HTTP (doPost / doGet)
   ═══════════════════════════════════════════════════════════════════ */

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    const handlers = {
      login:                    () => handleLogin(data),
      read:                     () => handleRead(data),
      create:                   () => handleCreateComPermissao(data),
      update:                   () => handleUpdateComPermissao(data),
      delete:                   () => handleDelete(data),
      getServicoAtual:          () => getServicoAtual(data),
      getConfig:                () => handleGetConfig(),
      iniciarServico:           () => iniciarServico(data),
      encerrarServico:          () => encerrarServico(data),
      getRotinaPersonalizada:   () => getRotinaPersonalizada(data),
      salvarRotinaPersonalizada:() => salvarRotinaPersonalizada(data),
      resetarRotinaPersonalizada:() => resetarRotinaPersonalizada(data),
      getRotinaParaServico:     () => getRotinaParaServico(data),
      getRotina:                () => getRotina(data),
      updateAtividade:          () => updateAtividade(data),
      criarAtividadeExtra:      () => criarAtividadeExtra(data),
      adicionarAtividadeFixa:   () => adicionarAtividadeFixa(data),
      editarAtividadeRotina:    () => editarAtividadeRotina(data),
      excluirAtividadeRotina:   () => excluirAtividadeRotina(data),
      registrarTelegrafia:      () => registrarTelegrafia(data),
      registrarEntradaOficial:  () => registrarEntradaOficial(data),
      registrarSaidaOficial:    () => registrarSaidaOficial(data),
      getNotificacoes:          () => getNotificacoes(data),
      marcarLida:               () => marcarLida(data),
      getHistorico:             () => getHistorico(data),
      getRelatorio:             () => getRelatorio(data),
      ping:                     () => handlePing(),
      registrarHeartbeat:       () => registrarHeartbeat(data),
      getUsuariosAtivos:        () => getUsuariosAtivos(data),
      adicionarEquipe:          () => adicionarEquipe(data),
      removerEquipe:            () => removerEquipe(data),
      solicitarAcesso:          () => solicitarAcessoServico(data),
      responderAcesso:          () => responderAcessoServico(data),
      getPermissoesServico:     () => getPermissoesServico(data),
      checkAcessoServico:       () => checkAcessoServico(data),
      getPostosServico:         () => getPostosServico(data),
      getUsuariosPostos:        () => getUsuariosPostos(data),
      getUsuariosEditaveis:     () => getUsuariosEditaveis(data),
      getServicoPorPosto:       () => getServicoPorPosto(data),
      getViaturas:              () => handleRead({ ...data, sheet: 'viaturas' }),
      getServicoViaturas:       () => getServicoViaturas(data),
      iniciarServicoViatura:    () => iniciarServicoViatura(data),
      editarServicoViatura:     () => editarServicoViatura(data),
      encerrarServicoViatura:   () => encerrarServicoViatura(data),
      despacharViatura:         () => despacharViatura(data),
      retornarViatura:          () => retornarViatura(data),
      criarOcorrencia:          () => criarOcorrencia(data),
      editarOcorrencia:         () => editarOcorrencia(data),
      finalizarOcorrencia:      () => finalizarOcorrencia(data),
      editarServico:            () => editarServico(data),
      redefinirSenha:           () => redefinirSenha(data),
      alterarMinhaSenha:        () => alterarMinhaSenha(data),
      criarCivis:               () => criarCivis(data),
      getPostosComServico:      () => getPostosComServico(data),
      getTiposViatura:          () => handleRead({ ...data, sheet: 'tipos_viatura' }),
      getNaturezas:             () => handleRead({ ...data, sheet: 'naturezas' }),
      registrarLog:             () => registrarLogCustom(data),
      updateConfig:             () => handleUpdateConfig(data),
      importarAtividadesPadrao: () => importarAtividadesPadrao(data),
      diagnosticar:             () => diagnosticar(),
      repararAbas:              () => { repararAbasSilencioso(); return { success: true, message: 'Abas reparadas' }; }
    };

    const handler = handlers[action];
    if (!handler) throw new Error('Ação não encontrada: ' + action);

    const result = handler();
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'SGPO API Online',
    version: SGPO_VERSION,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 10 — AUTENTICAÇÃO E AUDITORIA
   ═══════════════════════════════════════════════════════════════════ */

let _authUser = null;

function handleLogin(data) {
  const { usuario, senha } = data;

  if (usuario === SUPER_USER.usuario && Utils.compararSenhas(senha, SUPER_USER.senhaHash)) {
    _authUser = SUPER_USER;
    logAuditoria('login', SUPER_USER.nome, 'Login realizado (superusuário)');

    const postos = findRows('PostosServico', r => r.Status === 'ativo').map(r => ({ id: r.id, nome: r.nome, tipo: r.tipo }));
    const permissoesTela = findRows('PermissoesTela', r => r.Status === 'ativo' && (r.perfil === 'admin' || r.perfil === 'comandante'));

    return {
      success: true,
      user: {
        id: SUPER_USER.id,
        nome: SUPER_USER.nome,
        qra: '',
        nomeUsuario: SUPER_USER.usuario,
        cpf: '00000000000',
        re: '',
        usuario: SUPER_USER.usuario,
        perfil: SUPER_USER.perfil,
        nivelPermissao: 'GB',
        postos: postos,
        permissoesTela: permissoesTela.map(p => ({ tela: p.tela, acoes: JSON.parse(p.acoes || '[]') })),
        mustChangePassword: false
      }
    };
  }

  const sheet = getSheet('Usuarios');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const user = {};
    headers.forEach((h, idx) => user[h] = row[idx]);

    const loginField = user.cpf || user.reCpf || user.usuario || '';
    const senhaOk = user.senhaHash ? Utils.compararSenhas(senha, user.senhaHash) : (user.senha === senha);
    if (loginField === usuario && senhaOk && user.ativo !== false) {
      _authUser = user;
      logAuditoria('login', user.nome, 'Login realizado');

      try {
        const lastAccessCol = headers.indexOf('ultimoAcesso');
        if (lastAccessCol !== -1) {
          sheet.getRange(i + 1, lastAccessCol + 1).setValue(new Date().toISOString());
        }
      } catch (e) {}

      const nivel = user.nivelPermissao || 'POSTO';
      const postoDefaultId = user.postoDefaultId || '';
      const userPostos = findRows('UsuariosPostos', r => r.usuarioId === user.id && r.Status === 'ativo');
      const postosCompletos = userPostos.map(up => {
        const posto = findRowById('PostosServico', up.postoId);
        return {
          id: up.postoId,
          nome: posto ? posto.data[headers.indexOf('nome') !== -1 ? 2 : 2] : '',
          tipo: posto ? (posto.data[3] || 'POSTO') : 'POSTO',
          papel: up.papel || 'operador'
        };
      });

      const permissoesTela = findRows('PermissoesTela', r => r.Status === 'ativo' && (r.perfil === user.perfil || (r.perfil === 'custom' && r.usuarioId === user.id)));

      return {
        success: true,
        user: {
          id: user.id,
          nome: user.nome,
          qra: user.qra || '',
          nomeUsuario: user.nomeUsuario || user.nome || '',
          cpf: user.cpf || loginField,
          re: user.re || '',
          usuario: loginField,
          perfil: user.perfil || 'operador',
          nivelPermissao: nivel,
          postoDefaultId: postoDefaultId,
          postos: postosCompletos,
          permissoesTela: permissoesTela.map(p => ({ tela: p.tela, acoes: JSON.parse(p.acoes || '[]') })),
          mustChangePassword: user.mustChangePassword === true || user.mustChangePassword === 'true'
        }
      };
    }
  }

  return { success: false, error: 'CPF ou senha inválidos' };
}

function logAuditoria(acao, usuario, detalhes) {
  try {
    const sheet = getSheet('Auditoria');
    sheet.appendRow([
      generateId(),
      new Date().toISOString(),
      '',
      acao,
      '',
      usuario || 'sistema',
      '',
      '',
      detalhes || '',
      '',
      'ativo'
    ]);
  } catch (e) {
    console.error('Erro ao registrar auditoria:', e);
  }
}

function logNotificacao(servicoId, mensagem, tipo) {
  try {
    const sheet = getSheet('Notificacoes');
    sheet.appendRow([
      generateId(),
      servicoId,
      mensagem,
      tipo || 'info',
      Utils.formatTime(new Date()),
      '',
      false,
      false,
      'ativo'
    ]);
  } catch (e) {
    console.error('Erro ao registrar notificação:', e);
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 11 — CRUD GENÉRICO
   ═══════════════════════════════════════════════════════════════════ */

function handleRead(data) {
  const { sheet, filters } = data;
  let rows = findRows(sheet, (row) => {
    if (!filters || Object.keys(filters).length === 0) return row.Status !== 'removido';
    return Object.entries(filters).every(([key, val]) => row[key] === val) && row.Status !== 'removido';
  });

  if (sheet === 'usuarios' || sheet === 'Usuarios') {
    rows = rows.filter(r => r.usuario !== SUPER_USER.usuario);
  }

  return rows;
}

function handleCreate(data) {
  const { sheet, row } = data;
  const s = getSheet(sheet);
  var headers = ensureSheetHeaders(sheet);
  if (!headers || headers.length === 0 || !headers[0]) {
    return { success: false, error: 'A aba "' + sheet + '" nao pôde ser reparada automaticamente.' };
  }
  const id = generateId();
  const now = new Date().toISOString();

  if ((sheet === 'usuarios' || sheet === 'Usuarios') && row.senha) {
    row.senhaHash = _hashPassword(row.senha);
  }

  const newRow = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'dataCadastro') return now;
    if (h === 'Status') return 'ativo';
    if (h === 'ativo') return true;
    if (h === 'senhaHash') return row.senhaHash || '';
    return (row[h] !== undefined && row[h] !== null) ? row[h] : '';
  });

  s.appendRow(newRow);
  logAuditoria('create', (_authUser && _authUser.nome) || 'sistema', `Criou registro em ${sheet}`);
  return { success: true, id };
}

function handleUpdate(data) {
  const { sheet, id, row } = data;
  const found = findRowById(sheet, id);
  if (!found) return { success: false, error: 'Registro não encontrado' };

  if ((sheet === 'usuarios' || sheet === 'Usuarios') && row.senha) {
    row.senhaHash = _hashPassword(row.senha);
  }

  const s = getSheet(sheet);
  const headers = found.headers;
  Object.entries(row).forEach(([key, val]) => {
    const colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      s.getRange(found.row, colIdx + 1).setValue(val);
    }
  });

  logAuditoria('update', (_authUser && _authUser.nome) || 'sistema', `Atualizou ${id} em ${sheet}`);
  return { success: true };
}

function handleDelete(data) {
  const { sheet, id } = data;

  if (id === SUPER_USER.id) {
    return { success: false, error: 'Este usuário não pode ser removido' };
  }

  if ((sheet === 'usuarios' || sheet === 'Usuarios') && _authUser && _authUser.usuario === SUPER_USER.usuario) {
    return { success: false, error: 'Super usuário não pode ser removido' };
  }

  const found = findRowById(sheet, id);
  if (!found) return { success: false, error: 'Registro não encontrado' };

  const s = getSheet(sheet);
  const statusCol = found.headers.indexOf('Status');
  if (statusCol !== -1) {
    s.getRange(found.row, statusCol + 1).setValue('removido');
  }

  logAuditoria('delete', (_authUser && _authUser.nome) || 'sistema', `Removeu ${id} de ${sheet}`);
  return { success: true };
}


function importarAtividadesPadrao(data) {
  const { atividades } = data;
  if (!Array.isArray(atividades) || atividades.length === 0) {
    return { success: false, error: 'Nenhuma atividade para importar' };
  }

  const s = getSheet('AtividadesPadrao');
  var headers = ensureSheetHeaders('AtividadesPadrao');
  if (!headers || headers.length === 0 || !headers[0]) {
    return { success: false, error: 'A aba AtividadesPadrao nao pôde ser reparada automaticamente.' };
  }
  const existingRows = findRows('atividades_padrao', r => r.Status !== 'removido');
  const existingNames = new Set(existingRows.map(r => r.nome));

  let importadas = 0;
  let ignoradas = 0;

  atividades.forEach(a => {
    if (existingNames.has(a.nome)) {
      ignoradas++;
      return;
    }
    const newRow = headers.map(h => {
      if (h === 'id') return generateId();
      if (h === 'dataCadastro') return new Date().toISOString();
      if (h === 'Status') return 'ativo';
      return (a[h] !== undefined && a[h] !== null) ? a[h] : '';
    });
    s.appendRow(newRow);
    importadas++;
  });

  logAuditoria('importar_atividades_padrao', (_authUser && _authUser.nome) || 'sistema',
    `Importadas ${importadas} atividades padrão (${ignoradas} ignoradas - duplicadas)`);

  return { success: true, importadas, ignoradas };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 12 — SERVIÇO ATUAL E SINCRONIZAÇÃO
   ═══════════════════════════════════════════════════════════════════ */

function getServicoAtual(data) {
  const today = new Date().toISOString().split('T')[0];
  const usuarioId = data ? data.usuarioId : null;

  let servicos;
  if (usuarioId) {
    const userRow = findRowById('Usuarios', usuarioId);
    const userNivel = userRow ? userRow.data[userRow.headers.indexOf('nivelPermissao')] : '';
    const userProfile = userRow ? userRow.data[userRow.headers.indexOf('perfil')] : '';
    const isAdmin = userNivel === 'GB' || userProfile === 'admin' || userProfile === 'superadmin' || usuarioId === '_superuser_';

    if (isAdmin) {
      servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
    } else {
      const userPostos = findRows('UsuariosPostos', r => r.usuarioId === usuarioId && r.Status === 'ativo');
      const userPostoIds = userPostos.map(up => up.postoId);
      if (userPostoIds.length > 0) {
        servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado' && userPostoIds.includes(r.postoId));
      } else {
        servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
      }
    }
  } else {
    servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
  }

  if (servicos.length === 0) {
    return { servico: null, rotina: [], militares: [], telegrafia: null, oficiais: [], oficiaisTodos: [], notificacoes: [], extras: [] };
  }

  const servico = servicos[0];
  try { servico.equipe = JSON.parse(servico.equipe || '[]'); } catch(e) { servico.equipe = []; }

  if (usuarioId && !servico.equipe.some(e => e.id === usuarioId)) {
    const userSheet = findRowById('Usuarios', usuarioId);
    if (userSheet) {
      const nome = userSheet.data[userSheet.headers.indexOf('nome')] || '';
      const integrante = { id: usuarioId, nome: nome, posto: '', re: '', cpf: '', avulso: false };
      servico.equipe.push(integrante);
      const s = getSheet('Servicos');
      const equipeCol = servico._headers ? servico._headers.indexOf('equipe') : servico.headers ? servico.headers.indexOf('equipe') : -1;
      if (equipeCol !== -1) {
        const sheet = getSheet('Servicos');
        const found = findRowById('Servicos', servico.id);
        if (found) {
          sheet.getRange(found.row, found.headers.indexOf('equipe') + 1).setValue(JSON.stringify(servico.equipe));
        }
      }
      logAuditoria('auto_link', nome, `Vinculado automaticamente ao serviço ${servico.id}`);
    }
  }

  const rotina = findRows('rotina', (r) => r.servicoId === servico.id && r.Status !== 'removido');
  rotina.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

  const militares = findRows('militares', (r) => r.Status !== 'removido');
  const telegrafia = findRows('telegrafia', (r) => r.servicoId === servico.id && r.Status === 'ativo');
  const telegrafiaAtual = telegrafia.length > 0 ? telegrafia[telegrafia.length - 1] : null;

  const entradas = findRows('oficiais_entrada', (r) => r.servicoId === servico.id && r.tipo === 'entrada');
  const saidas = findRows('oficiais_entrada', (r) => r.servicoId === servico.id && r.tipo === 'saida');
  const saidasIds = new Set(saidas.map(s => s.oficialId));

  const oficiaisTodos = findRows('oficiais', (r) => r.Status !== 'removido');
  const oficiaisPresentes = oficiaisTodos.filter(o => {
    const temEntrada = entradas.some(e => e.oficialId === o.id);
    return temEntrada && !saidasIds.has(o.id);
  });

  const oficiaisComDetalhes = oficiaisPresentes.map(o => {
    const entrada = entradas.filter(e => e.oficialId === o.id).pop();
    return { ...o, horarioEntrada: entrada ? entrada.horario : '--:--' };
  });

  const notificacoes = findRows('notificacoes', (r) => r.servicoId === servico.id);
  notificacoes.sort((a, b) => (b.horario || '').localeCompare(a.horario || ''));

  const extras = findRows('atividades_extras', (r) => r.servicoId === servico.id && r.Status !== 'removido');

  const servicoViaturas = findRows('servico_viatura', (r) => r.servicoId === servico.id && r.Status !== 'removido');
  servicoViaturas.forEach(sv => { try { sv.tripulantes = JSON.parse(sv.tripulantes || '[]'); } catch(e) { sv.tripulantes = []; } });

  const ocorrencias = findRows('ocorrencias', (r) => r.servicoId === servico.id && r.Status !== 'removido');
  ocorrencias.forEach(oc => { try { oc.viaturaIds = JSON.parse(oc.viaturaIds || '[]'); } catch(e) { oc.viaturaIds = []; } try { oc.efetivo = JSON.parse(oc.efetivo || '[]'); } catch(e) { oc.efetivo = []; } });

  let config = null;
  try {
    const configRows = findRows('Configuracoes', (r) => true);
    if (configRows.length > 0) {
      config = {};
      const keyMap = {
        'nome_unidade': 'nomeUnidade',
        'nome_sistema': 'nomeSistema',
        'subtitulo_sistema': 'subtituloSistema',
        'cidade': 'cidade',
        'horario_inicio': 'inicioPlantao',
        'duracao_plantao': 'duracaoPlantao',
        'cor_padrao': 'corPadrao',
        'sons_habilitados': 'sonsHabilitados',
        'volume_geral': 'volumeGeral',
        'notif_sons': 'notifSons',
        'notif_duracao': 'notifDuracao',
        'tema': 'tema',
        'sync_intervalo': 'syncIntervalo'
      };
      configRows.forEach(c => {
        try {
          const rawKey = c.chave || c.key || c.nome || '';
          const frontendKey = keyMap[rawKey] || rawKey;
          const val = c.valor || c.value || '';
          config[frontendKey] = JSON.parse(val);
        } catch(e) {
          const rawKey = c.chave || c.key || c.nome || '';
          const frontendKey = keyMap[rawKey] || rawKey;
          config[frontendKey] = c.valor || c.value || '';
        }
      });
    }
  } catch(e) {}

  return {
    servico,
    rotina,
    militares,
    telegrafia: telegrafiaAtual,
    oficiais: oficiaisComDetalhes,
    oficiaisTodos,
    notificacoes,
    extras,
    servicoViaturas,
    ocorrencias,
    config
  };
}

function iniciarServico(data) {
  const { prontidao, comandanteId, comandanteNome, equipe, postoId, observacoes, telegrafistaId } = data;
  if (!postoId) return { success: false, error: 'Posto de serviço é obrigatório' };
  const today = new Date().toISOString().split('T')[0];
  const now = Utils.formatTime(new Date());

  const existing = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado' && r.postoId === postoId);
  if (existing.length > 0) {
    return { success: false, error: 'Já existe um serviço ativo para este posto hoje' };
  }

  const id = generateId();
  const sheet = getSheet('Servicos');
  const equipeJson = JSON.stringify(equipe || []);
  const servicoRow = [id, new Date().toISOString(), today, now, '07:30',
    prontidao, comandanteId, comandanteNome,
    postoId, equipeJson, observacoes || '', 0, 0, 'ativo', telegrafistaId || ''];
  sheet.appendRow(servicoRow);

  if (telegrafistaId) {
    const telMilitar = findRows('militares', r => r.id === telegrafistaId);
    const telNome = telMilitar.length > 0 ? telMilitar[0].nome : '';
    const teleSheet = getSheet('Telegrafia');
    teleSheet.appendRow([gerarId(), new Date().toISOString(), id, telegrafistaId, telNome, now, 'ativo']);
    logNotificacao(id, `${telNome} assumiu a telegrafia (designado no início do serviço)`, 'telegrafia');
  }

  const padrao = getRotinaParaServico({ postoId }).itens;
  const rotinaSheet = getSheet('Rotina');
  padrao.forEach(a => {
    rotinaSheet.appendRow([
      generateId(), new Date().toISOString(), id,
      a.ordem || '', a.horario, a.nome, a.programa || '',
      a.responsavel_padrao || '', a.responsavel_padrao || '',
      'nao_iniciada', '', '', '', a.notificar || false, 'ativo'
    ]);
  });

  logAuditoria('iniciar_servico', comandanteNome, `Serviço iniciado - Posto: ${postoId} - Prontidão ${prontidao}`);
  logNotificacao(id, `Serviço iniciado às ${now} - Prontidão ${prontidao.toUpperCase()}`, 'info');

  return { success: true, servicoId: id };
}

function encerrarServico(data) {
  const { servicoId, postoId } = data;
  let found = servicoId ? findRowById('Servicos', servicoId) : null;
  if (!found && postoId) {
    const today = new Date().toISOString().split('T')[0];
    const rows = findRows('Servicos', r => r.data === today && r.Status === 'ativo' && r.postoId === postoId);
    if (rows.length > 0) {
      const sheet = getSheet('Servicos');
      const dataRows = sheet.getDataRange().getValues();
      const headers = dataRows[0];
      const idCol = headers.indexOf('id');
      for (let i = 1; i < dataRows.length; i++) {
        if (dataRows[i][idCol] === rows[0].id) {
          found = { row: i + 1, headers, data: dataRows[i] };
          break;
        }
      }
    }
  }
  if (!found) return { success: false, error: 'Serviço não encontrado' };

  const s = getSheet('Servicos');
  const statusCol = found.headers.indexOf('Status');
  if (statusCol !== -1) {
    s.getRange(found.row, statusCol + 1).setValue('encerrado');
  }

  const horarioFimCol = found.headers.indexOf('horarioFim');
  if (horarioFimCol !== -1) {
    s.getRange(found.row, horarioFimCol + 1).setValue(Utils.formatTime(new Date()));
  }

  logAuditoria('encerrar_servico', (_authUser && _authUser.nome) || 'sistema', `Serviço ${found.data[found.headers.indexOf('id')]} encerrado`);
  logNotificacao(found.data[found.headers.indexOf('id')], 'Serviço encerrado', 'info');

  return { success: true };
}

/* ═══════ ROTINA PERSONALIZADA POR POSTO ═══════ */

function getRotinaPersonalizada(data) {
  const { postoId } = data;
  if (!postoId) return { success: true, itens: [] };
  const rows = findRows('rotinaPersonalizada', (r) => r.postoId === postoId && r.Status !== 'removido');
  rows.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  return { success: true, itens: rows };
}

function salvarRotinaPersonalizada(data) {
  const { postoId, postoNome, itens } = data;
  if (!postoId) return { success: false, error: 'Posto é obrigatório' };
  if (!Array.isArray(itens)) return { success: false, error: 'Itens inválidos' };

  const sheet = getSheet('RotinaPersonalizada');

  const existing = findRows('rotinaPersonalizada', (r) => r.postoId === postoId && r.Status !== 'removido');
  const existingIds = new Set(existing.map(r => r.id));

  itens.forEach((item, idx) => {
    if (item.id && existingIds.has(item.id)) {
      updateRow('RotinaPersonalizada', item.id, {
        ordem: item.ordem || idx + 1,
        horario: item.horario,
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
    } else {
      const itemId = item.id || generateId();
      sheet.appendRow([
        itemId, new Date().toISOString(), postoId, postoNome || '',
        item.ordem || idx + 1, item.horario || '', item.nome, item.programa || '',
        item.responsavel_padrao || '', item.duracaoMinutos || 0,
        item.obrigatoria || false, item.notificar || false, item.observacoes || '',
        item.ativo !== false, 'ativo'
      ]);
    }
  });

  const newIds = new Set(itens.filter(i => i.id).map(i => i.id));
  existing.forEach(row => {
    if (!newIds.has(row.id)) {
      updateRow('RotinaPersonalizada', row.id, { Status: 'removido' });
    }
  });

  logAuditoria('salvar_rotina_personalizada', (_authUser && _authUser.nome) || 'sistema', `Rotina personalizada salva para posto: ${postoNome || postoId}`);
  return { success: true };
}

function resetarRotinaPersonalizada(data) {
  const { postoId } = data;
  if (!postoId) return { success: false, error: 'Posto é obrigatório' };

  const existing = findRows('rotinaPersonalizada', (r) => r.postoId === postoId && r.Status !== 'removido');
  existing.forEach(row => {
    updateRow('RotinaPersonalizada', row.id, { Status: 'removido' });
  });

  logAuditoria('resetar_rotina_personalizada', (_authUser && _authUser.nome) || 'sistema', `Rotina personalizada resetada para posto: ${postoId}`);
  return { success: true };
}

function getRotinaParaServico(data) {
  const { postoId } = data;
  if (!postoId) return { success: true, fonte: 'padrao', itens: [] };

  const personalizada = findRows('rotinaPersonalizada', (r) => r.postoId === postoId && r.Status !== 'removido' && r.ativo !== false);
  if (personalizada.length > 0) {
    personalizada.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
    return { success: true, fonte: 'personalizada', itens: personalizada };
  }

  const padrao = findRows('atividades_padrao', (r) => r.Status !== 'removido' && (!r.postoId || r.postoId === postoId));
  padrao.sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0));
  return { success: true, fonte: 'padrao', itens: padrao };
}

function adicionarEquipe(data) {
  const { servicoId, integrante } = data;
  const found = findRowById('Servicos', servicoId);
  if (!found) return { success: false, error: 'Serviço não encontrado' };

  const s = getSheet('Servicos');
  let equipe = [];
  try { equipe = JSON.parse(found.row[found.headers.indexOf('equipe')] || '[]'); } catch(e) { equipe = []; }

  if (!integrante || !integrante.id) return { success: false, error: 'Integrante inválido' };
  if (equipe.some(e => e.id === integrante.id)) return { success: false, error: 'Integrante já está na equipe' };

  equipe.push(integrante);
  const equipeCol = found.headers.indexOf('equipe') + 1;
  s.getRange(found.row, equipeCol).setValue(JSON.stringify(equipe));

  logAuditoria('adicionar_equipe', (_authUser && _authUser.nome) || 'sistema', `Integrante adicionado: ${integrante.nome}`);
  logNotificacao(servicoId, `Integrante adicionado à equipe: ${integrante.nome}`, 'info');

  return { success: true, equipe };
}

function removerEquipe(data) {
  const { servicoId, integranteId } = data;
  const found = findRowById('Servicos', servicoId);
  if (!found) return { success: false, error: 'Serviço não encontrado' };

  const s = getSheet('Servicos');
  let equipe = [];
  try { equipe = JSON.parse(found.row[found.headers.indexOf('equipe')] || '[]'); } catch(e) { equipe = []; }

  const membro = equipe.find(e => e.id === integranteId);
  if (!membro) return { success: false, error: 'Integrante não encontrado na equipe' };

  const rotina = findRows('rotina', r => r.servicoId === servicoId && r.Status !== 'removido');
  const temAcoes = rotina.some(r => r.concluidoPor && r.concluidoPor === membro.nome);

  const teleRows = findRows('telegrafia', r => r.servicoId === servicoId && r.Status === 'ativo');
  const temTelegrafia = teleRows.some(t => t.militarId === integranteId);

  if (temAcoes || temTelegrafia) {
    return { success: false, error: 'Não é possível remover: integrante já realizou ações no serviço' };
  }

  equipe = equipe.filter(e => e.id !== integranteId);

  const equipeCol = found.headers.indexOf('equipe') + 1;
  s.getRange(found.row, equipeCol).setValue(JSON.stringify(equipe));

  if (membro) {
    logAuditoria('remover_equipe', (_authUser && _authUser.nome) || 'sistema', `Integrante removido: ${membro.nome}`);
  }

  return { success: true, equipe };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 13 — ATIVIDADES (ROTINA + EXTRAS + FIXAS + EDIÇÃO)
   ═══════════════════════════════════════════════════════════════════ */

function getRotina(data) {
  const { servicoId } = data;
  const rotina = findRows('rotina', (r) => r.servicoId === servicoId && r.Status !== 'removido');
  rotina.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
  return rotina;
}

function updateAtividade(data) {
  const { servicoId, atividadeId, status, concluidoPor, horaConclusao, observacoes } = data;
  const found = findRowById('rotina', atividadeId);

  if (!found) {
    const extra = findRowById('atividades_extras', atividadeId);
    if (extra) {
      const s = getSheet('AtividadesExtras');
      if (status) s.getRange(extra.row, extra.headers.indexOf('status') + 1).setValue(status);
      if (concluidoPor) s.getRange(extra.row, extra.headers.indexOf('concluidoPor') + 1).setValue(concluidoPor);
      if (horaConclusao) s.getRange(extra.row, extra.headers.indexOf('horaConclusao') + 1).setValue(horaConclusao);
      if (observacoes) s.getRange(extra.row, extra.headers.indexOf('observacoes') + 1).setValue(observacoes);
      return { success: true };
    }
    return { success: false, error: 'Atividade não encontrada' };
  }

  const s = getSheet('Rotina');
  if (status) s.getRange(found.row, found.headers.indexOf('status') + 1).setValue(status);
  if (concluidoPor) s.getRange(found.row, found.headers.indexOf('concluidoPor') + 1).setValue(concluidoPor);
  if (horaConclusao) s.getRange(found.row, found.headers.indexOf('horaConclusao') + 1).setValue(horaConclusao);
  if (observacoes) s.getRange(found.row, found.headers.indexOf('observacoes') + 1).setValue(observacoes);

  const nome = found.data[found.headers.indexOf('nome')];
  logAuditoria('update_atividade', concluidoPor || 'sistema', `${nome} - ${status}`);

  if (status === 'concluida') {
    logNotificacao(servicoId, `Atividade "${nome}" concluída por ${concluidoPor || '-'}`, 'info');
  }

  return { success: true };
}

function criarAtividadeExtra(data) {
  const { servicoId, nome, horario, responsavel, responsavelId, observacoes, notificar, criadoPor } = data;

  const id = generateId();
  const sheet = getSheet('AtividadesExtras');
  sheet.appendRow([
    id, new Date().toISOString(), servicoId,
    horario, nome, '', responsavelId || '',
    responsavel || '', observacoes || '', 'nao_iniciada', '', '',
    criadoPor || '', notificar || false, 'ativo'
  ]);

  logAuditoria('criar_atividade_extra', criadoPor || 'sistema', `Atividade extra: ${nome}`);

  if (notificar) {
    logNotificacao(servicoId, `Nova atividade extra: ${nome} às ${horario}`, 'info');
  }

  return { success: true, id };
}

function adicionarAtividadeFixa(data) {
  const { servicoId, atividadeFixaId, horario, nome, programa, responsavel, responsavelId, observacoes } = data;

  const padraoRows = findRows('atividades_padrao', (r) => r.id === atividadeFixaId);
  if (padraoRows.length === 0) return { success: false, error: 'Atividade padrão não encontrada' };
  const padrao = padraoRows[0];

  const id = generateId();
  const sheet = getSheet('Rotina');
  sheet.appendRow([
    id, new Date().toISOString(), servicoId,
    padrao.ordem || 999,
    horario || padrao.horario,
    nome || padrao.nome,
    programa || padrao.programa || '',
    responsavelId || '',
    responsavel || padrao.responsavel_padrao || '',
    'nao_iniciada', '', '',
    observacoes || padrao.observacoes || '',
    false, 'ativo'
  ]);

  logAuditoria('adicionar_atividade_fixa', 'sistema', `Atividade fixa adicionada: ${nome || padrao.nome}`);
  logNotificacao(servicoId, `Atividade fixa adicionada: ${nome || padrao.nome}`, 'info');

  return { success: true, id };
}

function editarAtividadeRotina(data) {
  const { servicoId, atividadeId, horario, nome, programa, responsavel, responsavelId, observacoes } = data;

  const found = findRowById('rotina', atividadeId);
  if (!found) return { success: false, error: 'Atividade não encontrada' };

  const sheet = getSheet('Rotina');
  const headers = found.headers;

  if (horario !== undefined) {
    const col = headers.indexOf('horario');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(horario);
  }
  if (nome !== undefined) {
    const col = headers.indexOf('nome');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(nome);
  }
  if (programa !== undefined) {
    const col = headers.indexOf('programa');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(programa);
  }
  if (responsavel !== undefined) {
    const col = headers.indexOf('responsavel');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(responsavel);
  }
  if (responsavelId !== undefined) {
    const col = headers.indexOf('responsavelId');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(responsavelId);
  }
  if (observacoes !== undefined) {
    const col = headers.indexOf('observacoes');
    if (col !== -1) sheet.getRange(found.row, col + 1).setValue(observacoes);
  }

  logAuditoria('editar_atividade_rotina', 'sistema', `Atividade editada: ${nome || atividadeId}`);

  return { success: true };
}

function excluirAtividadeRotina(data) {
  const { servicoId, atividadeId } = data;

  const found = findRowById('rotina', atividadeId);
  if (!found) return { success: false, error: 'Atividade não encontrada' };

  const sheet = getSheet('Rotina');
  const statusCol = found.headers.indexOf('Status');
  if (statusCol !== -1) sheet.getRange(found.row, statusCol + 1).setValue('inativo');

  logAuditoria('excluir_atividade_rotina', 'sistema', `Atividade removida: ${atividadeId}`);
  logNotificacao(servicoId, `Atividade removida da rotina`, 'warning');

  return { success: true };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 14 — TELEGRAFIA
   ═══════════════════════════════════════════════════════════════════ */

function registrarTelegrafia(data) {
  const { servicoId, militarId } = data;
  const militares = findRows('militares', (r) => r.id === militarId);
  if (militares.length === 0) return { success: false, error: 'Militar não encontrado' };

  const militar = militares[0];
  const now = Utils.formatTime(new Date());

  const atuais = findRows('telegrafia', (r) => r.servicoId === servicoId && r.Status === 'ativo');
  atuais.forEach(t => {
    const s = getSheet('Telegrafia');
    const found = findRowById('telegrafia', t.id);
    if (found) {
      const statusCol = found.headers.indexOf('Status');
      s.getRange(found.row, statusCol + 1).setValue('inativo');
    }

    const inicioParts = (t.horario || '00:00').split(':');
    const inicio = new Date();
    inicio.setHours(parseInt(inicioParts[0]), parseInt(inicioParts[1]), 0, 0);
    const duracao = Utils.formatDuration(Date.now() - inicio.getTime());

    const histSheet = getSheet('TelegrafiaHistorico');
    histSheet.appendRow([
      generateId(), new Date().toISOString(), servicoId,
      t.militarId, t.operador || '', t.horario || '',
      now, duracao.display || '-', 'ativo'
    ]);
  });

  const id = generateId();
  const sheet = getSheet('Telegrafia');
  sheet.appendRow([
    id, new Date().toISOString(), servicoId,
    militarId, militar.nome, now, 'ativo'
  ]);

  logAuditoria('telegrafia', (_authUser && _authUser.nome) || 'sistema', `${militar.nome} assumiu telegrafia`);
  logNotificacao(servicoId, `${militar.nome} assumiu a telegrafia às ${now}`, 'telegrafia');

  return { success: true };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 15 — CONTROLE DE OFICIAIS
   ═══════════════════════════════════════════════════════════════════ */

function registrarEntradaOficial(data) {
  const { oficialId, anunciado, nome, observacao } = data;

  if (nome && !oficialId) {
    const sheet = getSheet('OficiaisEntrada');
    const today = new Date().toISOString().split('T')[0];
    const servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
    const servicoId = servicos.length > 0 ? servicos[0].id : 'sem_servico';
    const now = Utils.formatTime(new Date());
    sheet.appendRow([
      generateId(), new Date().toISOString(), servicoId,
      'avulso_' + Date.now(), nome, '', 'entrada', now, (anunciado ? 'anunciado' : '') + (observacao ? ' ' + observacao : ''), 'ativo'
    ]);
    logAuditoria('entrada_oficial', (_authUser && _authUser.nome) || 'sistema', `${nome} (avulso) entrou no quartel`);
    return { success: true };
  }

  const oficiais = findRows('oficiais', (r) => r.id === oficialId);
  if (oficiais.length === 0) return { success: false, error: 'Oficial não encontrado' };

  const oficial = oficiais[0];
  const today = new Date().toISOString().split('T')[0];
  const now = Utils.formatTime(new Date());

  const servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
  const servicoId = servicos.length > 0 ? servicos[0].id : 'sem_servico';

  const obs = (anunciado ? 'anunciado' : '') + (observacao ? ' ' + observacao : '');

  const sheet = getSheet('OficiaisEntrada');
  sheet.appendRow([
    generateId(), new Date().toISOString(), servicoId,
    oficialId, oficial.nome, oficial.posto || '', 'entrada', now, obs, 'ativo'
  ]);

  logAuditoria('entrada_oficial', (_authUser && _authUser.nome) || 'sistema', `${oficial.nome} entrou no quartel`);
  logNotificacao(servicoId, `Oficial ${oficial.nome} (${oficial.posto}) entrou no quartel`, 'oficial');

  const jaAnunciado = findRows('oficiais_entrada', r => r.oficialId === oficialId && r.servicoId === servicoId && r.observacao && r.observacao.includes('anunciado'));

  return { success: true, jaAnunciado: jaAnunciado.length > 0, ultimoAnuncio: jaAnunciado.length > 0 ? jaAnunciado[jaAnunciado.length - 1] : null };
}

function registrarSaidaOficial(data) {
  const { oficialId } = data;
  const oficiais = findRows('oficiais', (r) => r.id === oficialId);
  if (oficiais.length === 0) return { success: false, error: 'Oficial não encontrado' };

  const oficial = oficiais[0];
  const today = new Date().toISOString().split('T')[0];
  const now = Utils.formatTime(new Date());

  const servicos = findRows('servicos', (r) => r.data === today && r.Status !== 'encerrado');
  const servicoId = servicos.length > 0 ? servicos[0].id : 'sem_servico';

  const sheet = getSheet('OficiaisEntrada');
  sheet.appendRow([
    generateId(), new Date().toISOString(), servicoId,
    oficialId, oficial.nome, oficial.posto || '', 'saida', now, '', 'ativo'
  ]);

  logAuditoria('saida_oficial', (_authUser && _authUser.nome) || 'sistema', `${oficial.nome} saiu do quartel`);
  logNotificacao(servicoId, `Oficial ${oficial.nome} saiu do quartel`, 'oficial');

  return { success: true };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 16 — NOTIFICAÇÕES
   ═══════════════════════════════════════════════════════════════════ */

function getNotificacoes(data) {
  const { servicoId } = data;
  const notifs = findRows('notificacoes', (r) => r.servicoId === servicoId);
  notifs.sort((a, b) => (b.horario || '').localeCompare(a.horario || ''));
  return notifs;
}

function marcarLida(data) {
  const { notificacaoId } = data;
  const found = findRowById('notificacoes', notificacaoId);
  if (!found) return { success: false };

  const s = getSheet('Notificacoes');
  const lidaCol = found.headers.indexOf('lida');
  if (lidaCol !== -1) {
    s.getRange(found.row, lidaCol + 1).setValue(true);
  }
  return { success: true };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 17 — HISTÓRICO E RELATÓRIOS
   ═══════════════════════════════════════════════════════════════════ */

function getHistorico(data) {
  const { data: date } = data;
  const servicos = findRows('servicos', (r) => r.data === date);

  if (servicos.length === 0) {
    return { servico: null, rotina: [], telegrafia: [], oficiais: [], notificacoes: [] };
  }

  const servico = servicos[0];
  const rotina = findRows('rotina', (r) => r.servicoId === servico.id);
  rotina.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

  const telegrafia = findRows('telegrafia_historico', (r) => r.servicoId === servico.id);

  const entradas = findRows('oficiais_entrada', (r) => r.servicoId === servico.id);
  const oficiais = findRows('oficiais', (r) => r.Status !== 'removido');

  const notificacoes = findRows('notificacoes', (r) => r.servicoId === servico.id);

  return { servico, rotina, telegrafia, oficiais, notificacoes, entradas };
}

function getRelatorio(data) {
  const { tipo, data: date } = data;
  const historico = getHistorico({ data: date });

  if (!historico.servico) {
    return { servico: null, itens: [] };
  }

  const servicoId = historico.servico.id;
  const base = {
    servico: {
      id: servicoId,
      data: historico.servico.data,
      prontidao: historico.servico.prontidao,
      comandante: historico.servico.comandanteNome,
      postoId: historico.servico.postoId,
      horarioInicio: historico.servico.horarioInicio,
      horarioFim: historico.servico.horarioFim || '-'
    }
  };

  switch (tipo) {
    case 'resumo': {
      const rotina = historico.rotina || [];
      const total = rotina.length;
      const concluidas = rotina.filter(r => r.status === 'concluida').length;
      const emAndamento = rotina.filter(r => r.status === 'em_andamento').length;
      const naoIniciadas = rotina.filter(r => r.status === 'nao_iniciada').length;
      const atrasadas = rotina.filter(r => r.status === 'atrasada').length;
      const canceladas = rotina.filter(r => r.status === 'cancelada').length;
      const extras = rotina.filter(r => r.origem === 'extra').length;
      const ocorrencias = findRows('ocorrencias', (r) => r.servicoId === servicoId);
      const sv = findRows('servico_viatura', (r) => r.servicoId === servicoId);
      return {
        ...base,
        stats: { total, concluidas, emAndamento, naoIniciadas, atrasadas, canceladas, extras,
          totalOcorrencias: ocorrencias.length,
          ocorrenciasFinalizadas: ocorrencias.filter(o => o.status === 'finalizada').length,
          viaturasDespachadas: sv.length },
        itens: rotina.map(r => ({
          Horario: r.horario,
          Atividade: r.nome,
          Responsavel: r.responsavel,
          Status: r.status,
          'Concluido por': r.concluidoPor || '-',
          'Hora Conclusao': r.horaConclusao || '-'
        }))
      };
    }

    case 'prontidao': {
      const rotina = historico.rotina || [];
      const telegrafia = historico.telegrafia || [];
      const entradas = historico.entradas || [];
      const ocorrencias = findRows('ocorrencias', (r) => r.servicoId === servicoId);
      const sv = findRows('servico_viatura', (r) => r.servicoId === servicoId);
      const militares = findRows('militares', (r) => r.Status !== 'removido');

      let equipe = [];
      try { equipe = JSON.parse(historico.servico.equipe || '[]'); } catch(e) { equipe = []; }

      return {
        ...base,
        efetivo: {
          totalEquipe: equipe.length,
          totalMilitares: militares.length,
          telegrafia: telegrafia.length > 0 ? telegrafia[telegrafia.length - 1]?.operador : 'Sem operador'
        },
        viaturas: {
          totalDespachadas: sv.length,
          detalhes: sv.map(v => ({ nome: v.viaturaNome, tipo: v.viaturaTipo, placa: v.viaturaPlaca, tripulantes: v.tripulantes || '-' }))
        },
        rotina: {
          total: rotina.length,
          concluidas: rotina.filter(r => r.status === 'concluida').length,
          percentual: rotina.length > 0 ? Math.round((rotina.filter(r => r.status === 'concluida').length / rotina.length) * 100) : 0
        },
        ocorrencias: {
          total: ocorrencias.length,
          finalizadas: ocorrencias.filter(o => o.status === 'finalizada').length,
          emAndamento: ocorrencias.filter(o => o.status === 'em_andamento').length
        },
        oficiais: {
          presentes: entradas.filter(e => e.tipo === 'entrada').length,
          historico: entradas.map(e => ({ nome: e.nome, tipo: e.tipo, horario: e.horario }))
        }
      };
    }

    case 'telegrafia': {
      const hist = findRows('telegrafia_historico', (r) => r.servicoId === servicoId);
      const ativa = historico.telegrafia || [];
      const totalTrocas = hist.length;
      const operadores = [...new Set(hist.map(t => t.operador))];
      const porOperador = operadores.map(op => {
        const trocas = hist.filter(t => t.operador === op);
        let totalMinutos = 0;
        trocas.forEach(t => {
          if (t.inicio && t.fim) {
            const ini = new Date('2000-01-01T' + t.inicio);
            const fim = new Date('2000-01-01T' + t.fim);
            totalMinutos += Math.round((fim - ini) / 60000);
          }
        });
        return { operador: op, trocas: trocas.length, totalMinutos, horas: Math.floor(totalMinutos / 60), mins: totalMinutos % 60 };
      });
      return {
        ...base,
        stats: { totalTrocas, totalOperadores: operadores.length },
        porOperador,
        itens: hist.map(t => ({
          Operador: t.operador,
          Assumiu: t.inicio || t.horario,
          Saiu: t.fim || t.horarioSaida || '-'
        }))
      };
    }

    case 'oficiais': {
      const oficiaisList = findRows('oficiais', (r) => r.Status !== 'removido');
      const entradas = (historico.entradas || []);
      const entradasOk = entradas.filter(e => e.tipo === 'entrada');
      const saidasOk = entradas.filter(e => e.tipo === 'saida');
      return {
        ...base,
        stats: { total: oficiaisList.length, presentes: entradasOk.length - saidasOk.length },
        itens: oficiaisList.map(o => {
          const entrada = entradasOk.filter(e => e.oficialId === o.id || e.nome === o.nome).pop();
          const saida = saidasOk.filter(s => s.oficialId === o.id || s.nome === o.nome).pop();
          return {
            Nome: o.nome,
            Posto: o.posto,
            Antiguidade: o.antiguidade,
            Entrada: entrada ? entrada.horario : '-',
            Saida: saida ? saida.horario : '-',
            Anunciado: (entrada && entrada.observacao && entrada.observacao.includes('anunciado')) ? 'Sim' : 'Não'
          };
        })
      };
    }

    case 'historico':
    case 'timeline': {
      const rotina = historico.rotina || [];
      const eventos = [];
      rotina.forEach(r => {
        eventos.push({ horario: r.horario, tipo: 'rotina', nome: r.nome, status: r.status, detalhe: r.concluidoPor || '' });
      });
      const telegrafia = findRows('telegrafia_historico', (r) => r.servicoId === servicoId);
      telegrafia.forEach(t => {
        eventos.push({ horario: t.inicio || t.horario || '', tipo: 'telegrafia', nome: t.operador, status: 'troca', detalhe: 'Assumiu a telegrafia' });
      });
      (historico.entradas || []).forEach(e => {
        eventos.push({ horario: e.horario || '', tipo: 'oficial', nome: e.nome, status: e.tipo, detalhe: (e.observacao && e.observacao.includes('anunciado')) ? 'anunciado' : '' });
      });
      eventos.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));
      return {
        ...base,
        itens: eventos.map(e => ({
          Horario: e.horario,
          Tipo: e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1),
          Evento: e.nome,
          Status: e.status,
          Detalhe: e.detalhe
        }))
      };
    }

    case 'auditoria': {
      const logs = findRows('auditoria', (r) => true);
      logs.sort((a, b) => (b.dataHora || '').localeCompare(a.dataHora || ''));
      const dateFilter = logs.filter(l => l.dataHora && l.dataHora.startsWith(date));
      const alvo = dateFilter.length > 0 ? dateFilter : logs;
      return {
        ...base,
        itens: alvo.slice(0, 200).map(l => ({
          Data: l.dataHora,
          Acao: l.acao,
          Usuario: l.usuarioNome,
          Detalhes: l.detalhes
        }))
      };
    }

    case 'ocorrencias': {
      const ocorrencias = servicoId ? findRows('ocorrencias', (r) => r.servicoId === servicoId) : [];
      const servicoViaturas = servicoId ? findRows('servico_viatura', (r) => r.servicoId === servicoId) : [];
      const stats = {
        total: ocorrencias.length,
        finalizadas: ocorrencias.filter(o => o.status === 'finalizada').length,
        emAndamento: ocorrencias.filter(o => o.status === 'em_andamento').length,
        canceladas: ocorrencias.filter(o => o.status === 'cancelada').length
      };
      const porNatureza = {};
      ocorrencias.forEach(o => {
        const n = o.natureza || 'Não informada';
        porNatureza[n] = (porNatureza[n] || 0) + 1;
      });
      return {
        ...base,
        stats,
        porNatureza: Object.entries(porNatureza).map(([nome, qtd]) => ({ nome, qtd })),
        ocorrencias: ocorrencias.map(o => ({
          numero: o.numero,
          titulo: o.titulo,
          descricao: o.descricao,
          natureza: o.natureza || '-',
          viaturaNomes: (() => { try { return JSON.parse(o.viaturaIds || '[]').map(vid => { const sv2 = servicoViaturas.find(x => x.viaturaId === vid); return sv2 ? sv2.viaturaNome : vid; }).join(', '); } catch(e) { return '-'; } })(),
          efetivo: o.efetivo,
          horaAcionamento: o.horaAcionamento,
          horaRetorno: o.horaRetorno,
          prontidaoCor: o.prontidaoCor,
          status: o.status
        }))
      };
    }

    case 'pdf':
      return { ...base, url: null, message: 'PDF será gerado no cliente' };

    default:
      return base;
  }
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 19.5 — CONFIGURAÇÃO GLOBAL
   ═══════════════════════════════════════════════════════════════════ */

function handleGetConfig() {
  const config = {};
  try {
    const rows = findRows('Configuracoes', (r) => true);
    const keyMap = {
      'nome_unidade': 'nomeUnidade',
      'nome_sistema': 'nomeSistema',
      'subtitulo_sistema': 'subtituloSistema',
      'cidade': 'cidade',
      'horario_inicio': 'inicioPlantao',
      'duracao_plantao': 'duracaoPlantao',
      'cor_padrao': 'corPadrao',
      'sons_habilitados': 'sonsHabilitados',
      'volume_geral': 'volumeGeral',
      'notif_sons': 'notifSons',
      'notif_duracao': 'notifDuracao',
      'tema': 'tema',
      'sync_intervalo': 'syncIntervalo'
    };
    rows.forEach(c => {
      try {
        const rawKey = c.chave || c.key || c.nome || '';
        const frontendKey = keyMap[rawKey] || rawKey;
        const val = c.valor || c.value || '';
        config[frontendKey] = JSON.parse(val);
      } catch(e) {
        const rawKey = c.chave || c.key || c.nome || '';
        const frontendKey = keyMap[rawKey] || rawKey;
        config[frontendKey] = c.valor || c.value || '';
      }
    });
  } catch(e) {}
  return { config };
}

function handleUpdateConfig(data) {
  const { config } = data;
  if (!config || typeof config !== 'object') return { success: false, error: 'Dados inválidos' };
  const gsToFe = {
    nomeSistema: 'nome_sistema',
    subtituloSistema: 'subtitulo_sistema',
    nomeUnidade: 'nome_unidade',
    cidade: 'cidade',
    inicioPlantao: 'horario_inicio',
    duracaoPlantao: 'duracao_plantao',
    syncIntervalo: 'sync_intervalo',
    campanha: 'campanha',
    campanhaAuto: 'campanha_auto'
  };
  const sheet = getSheet('Configuracoes');
  var headers = ensureSheetHeaders('Configuracoes');
  if (!headers || headers.length === 0 || !headers[0]) {
    return { success: false, error: 'A aba Configuracoes nao pôde ser reparada automaticamente.' };
  }
  const rows = sheet.getDataRange().getValues();
  const chaveIdx = headers.indexOf('chave');
  const valorIdx = headers.indexOf('valor');
  let updated = 0, created = 0;
  Object.entries(config).forEach(([feKey, val]) => {
    const gsKey = gsToFe[feKey] || feKey;
    const strVal = String(val);
    let found = false;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][chaveIdx] === gsKey) {
        sheet.getRange(i + 1, valorIdx + 1).setValue(strVal);
        found = true;
        updated++;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([generateId(), new Date().toISOString(), gsKey, strVal, 'geral', true]);
      created++;
    }
  });
  logAuditoria('updateConfig', (_authUser && _authUser.nome) || 'sistema', `Atualizou ${updated} + criou ${created} configs`);
  return { success: true, updated, created };
}


/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 20 — CONEXÃO, HEARTBEAT E USUÁRIOS ATIVOS
   ═══════════════════════════════════════════════════════════════════ */

function handlePing() {
  const sheets = Object.keys(SHEET_NAMES).length;
  return { success: true, version: SGPO_VERSION, sheets: sheets, mode: 'live', timestamp: new Date().toISOString() };
}

function registrarHeartbeat(data) {
  const { userId, nome, perfil } = data;
  if (!userId) return { success: false, error: 'userId obrigatório' };

  const sheet = getSheet('Usuarios');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const idCol = headers.indexOf('id');
    if (idCol !== -1 && row[idCol] === userId) {
      const ultimoAcessoCol = headers.indexOf('ultimoAcesso');
      if (ultimoAcessoCol !== -1) {
        sheet.getRange(i + 1, ultimoAcessoCol + 1).setValue(new Date().toISOString());
      }
      break;
    }
  }

  logAuditoria('heartbeat', nome || 'sistema', 'Heartbeat registrado');
  return { success: true };
}

function getUsuariosAtivos(data) {
  const now = new Date();
  const limitMs = (data.minutos || 10) * 60 * 1000;

  const usuarios = findRows('usuarios', (r) => r.Status === 'ativo' && r.id !== '_superuser_');
  const ativos = [];
  const recentes = [];

  usuarios.forEach(u => {
    if (!u.ultimoAcesso) return;
    const acesso = new Date(u.ultimoAcesso);
    const diff = now.getTime() - acesso.getTime();

    const item = {
      id: u.id,
      nome: u.nome,
      cpf: u.cpf || u.reCpf || '',
      re: u.re || '',
      perfil: u.perfil || '',
      ultimoAcesso: u.ultimoAcesso,
      acessoFormatado: Utils.formatDateTime(acesso),
      minutosAtras: Math.round(diff / 60000)
    };

    if (diff < limitMs) {
      ativos.push(item);
    } else if (diff < limitMs * 6) {
      recentes.push(item);
    }
  });

  ativos.sort((a, b) => a.minutosAtras - b.minutosAtras);
  recentes.sort((a, b) => a.minutosAtras - b.minutosAtras);

  return { ativos, recentes, total: usuarios.length };
}

/* ═══════════════════════════════════════════════════════════════════
   SEÇÃO 12 — EDITAR SERVIÇO, REDEFINIR SENHA, CIVIS COM USUÁRIO
   ═══════════════════════════════════════════════════════════════════ */

function editarServico(data) {
  const { servicoId, comandanteId, comandanteNome, prontidao, equipe, observacoes } = data;
  if (!servicoId) return { success: false, error: 'servicoId obrigatório' };

  const found = findRowById('Servicos', servicoId);
  if (!found) return { success: false, error: 'Serviço não encontrado' };
  if (found.row[found.headers.indexOf('Status')] === 'encerrado') {
    return { success: false, error: 'Não é possível editar serviço encerrado' };
  }

  const s = getSheet('Servicos');
  const changes = [];

  if (comandanteId !== undefined) {
    const col = found.headers.indexOf('comandanteId');
    if (col !== -1) { s.getRange(found.row, col + 1).setValue(comandanteId); changes.push('comandanteId'); }
    const colN = found.headers.indexOf('comandanteNome');
    if (colN !== -1) { s.getRange(found.row, colN + 1).setValue(comandanteNome || ''); changes.push('comandanteNome'); }
  }

  if (prontidao !== undefined) {
    const col = found.headers.indexOf('prontidao');
    if (col !== -1) { s.getRange(found.row, col + 1).setValue(prontidao); changes.push('prontidao: ' + prontidao); }
  }

  if (equipe !== undefined) {
    const col = found.headers.indexOf('equipe');
    if (col !== -1) { s.getRange(found.row, col + 1).setValue(JSON.stringify(equipe)); changes.push('equipe'); }
  }

  if (observacoes !== undefined) {
    const col = found.headers.indexOf('observacoes');
    if (col !== -1) { s.getRange(found.row, col + 1).setValue(observacoes); changes.push('observacoes'); }
  }

  logAuditoria('editar_servico', (_authUser && _authUser.nome) || 'sistema', `Serviço ${servicoId} alterado: ${changes.join(', ')}`);
  return { success: true };
}

function redefinirSenha(data) {
  const { usuarioId } = data;
  if (!usuarioId) return { success: false, error: 'usuarioId obrigatório' };

  const DEFAULT_PASSWORD = '123456';
  const sheet = getSheet('Usuarios');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol] === usuarioId) {
      const senhaCol = headers.indexOf('senha');
      const hashCol = headers.indexOf('senhaHash');
      const mcpCol = headers.indexOf('mustChangePassword');

      if (senhaCol !== -1) sheet.getRange(i + 1, senhaCol + 1).setValue(DEFAULT_PASSWORD);
      if (hashCol !== -1) sheet.getRange(i + 1, hashCol + 1).setValue(_hashPassword(DEFAULT_PASSWORD));
      if (mcpCol !== -1) sheet.getRange(i + 1, mcpCol + 1).setValue(true);

      logAuditoria('redefinir_senha', (_authUser && _authUser.nome) || 'sistema', `Senha redefinida para usuário ${usuarioId}`);
      return { success: true, mustChangePassword: true };
    }
  }
  return { success: false, error: 'Usuário não encontrado' };
}

function alterarMinhaSenha(data) {
  const { usuarioId, novaSenha } = data;
  if (!usuarioId || !novaSenha) return { success: false, error: 'usuarioId e novaSenha obrigatórios' };
  if (novaSenha.length < 4) return { success: false, error: 'Senha deve ter pelo menos 4 caracteres' };

  const sheet = getSheet('Usuarios');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idCol = headers.indexOf('id');

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][idCol] === usuarioId) {
      const senhaCol = headers.indexOf('senha');
      const hashCol = headers.indexOf('senhaHash');
      const mcpCol = headers.indexOf('mustChangePassword');

      if (senhaCol !== -1) sheet.getRange(i + 1, senhaCol + 1).setValue(novaSenha);
      if (hashCol !== -1) sheet.getRange(i + 1, hashCol + 1).setValue(_hashPassword(novaSenha));
      if (mcpCol !== -1) sheet.getRange(i + 1, mcpCol + 1).setValue(false);

      logAuditoria('alterar_senha', (_authUser && _authUser.nome) || 'sistema', `Senha alterada pelo próprio usuário`);
      return { success: true };
    }
  }
  return { success: false, error: 'Usuário não encontrado' };
}

function criarCivis(data) {
  const { nome, cpf, re, email, telefone, funcao } = data;
  if (!nome || !cpf) return { success: false, error: 'Nome e CPF são obrigatórios' };

  const DEFAULT_PASSWORD = '123456';
  const userSheet = getSheet('Usuarios');
  const userRows = userSheet.getDataRange().getValues();
  const userHeaders = userRows[0];
  const cpfCol = userHeaders.indexOf('cpf');
  const reColLegacy = userHeaders.indexOf('reCpf');
  for (let i = 1; i < userRows.length; i++) {
    if ((cpfCol !== -1 && String(userRows[i][cpfCol]) === String(cpf)) ||
        (reColLegacy !== -1 && String(userRows[i][reColLegacy]) === String(cpf))) {
      return { success: false, error: 'Já existe usuário com este CPF' };
    }
  }

  const userId = generateId();
  userSheet.appendRow([
    userId, new Date().toISOString(), nome, '', '', cpf, re || '', DEFAULT_PASSWORD,
    _hashPassword(DEFAULT_PASSWORD), true, 'operador',
    email || '', telefone || '', '', '', '', true, new Date().toISOString(), 'ativo'
  ]);

  logAuditoria('criar_civil_usuario', (_authUser && _authUser.nome) || 'sistema', `Civil ${nome} criado com usuário (CPF: ${cpf})`);
  return { success: true, userId, mustChangePassword: true, login: cpf, senhaPadrao: DEFAULT_PASSWORD };
}

function getPostosComServico(data) {
  const postos = findRows('PostosServico', r => r.Status === 'ativo');
  const today = new Date().toISOString().split('T')[0];
  const servicosAtivos = findRows('servicos', r => r.data === today && r.Status === 'ativo');
  const servicosMap = {};
  servicosAtivos.forEach(s => { servicosMap[s.postoId] = s; });

  const result = postos.map(p => {
    const servico = servicosMap[p.id] || null;
    let equipe = [];
    if (servico && servico.equipe) {
      try { equipe = JSON.parse(servico.equipe); } catch(e) { equipe = []; }
    }
    return {
      id: p.id,
      nome: p.nome,
      tipo: p.tipo || 'POSTO',
      servico: servico ? {
        id: servico.id,
        prontidao: servico.prontidao || 'verde',
        comandanteNome: servico.comandanteNome || '-',
        comandanteId: servico.comandanteId || '',
        horarioInicio: servico.horarioInicio || '',
        equipe: equipe,
        observacoes: servico.observacoes || ''
      } : null
    };
  });

  return { postos: result };
}

function registrarLogCustom(data) {
  const { acao, detalhes, modulo } = data;
  const nome = (_authUser && _authUser.nome) || data.usuarioNome || 'sistema';
  logAuditoria(acao || 'acao_usuario', nome, detalhes || '', modulo || '');
  return { success: true };
}

function diagnosticar() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ssId = ss.getId();
  const ssUrl = ss.getUrl();
  const allSheets = ss.getSheets().map(s => ({
    nome: s.getName(),
    linhas: s.getLastRow(),
    colunas: s.getLastColumn(),
    headers: s.getLastRow() > 0 ? s.getRange(1, 1, 1, Math.min(s.getLastColumn(), 20)).getValues()[0] : []
  }));

  const testResult = { escrita: false, leitura: false, erro: null, dados: null };
  try {
    const testId = 'TEST_' + new Date().getTime();
    const testSheet = getSheet('usuarios');
    const testHeaders = testSheet.getDataRange().getValues()[0] || [];
    const testRow = testHeaders.map(h => {
      if (h === 'id') return testId;
      if (h === 'nome') return 'TESTE_DIAGNOSTICO';
      if (h === 'dataCadastro') return new Date().toISOString();
      if (h === 'Status') return 'removido';
      if (h === 'usuario') return 'test_diag_' + testId;
      if (h === 'senhaHash') return 'test';
      if (h === 'ativo') return false;
      return '';
    });
    testSheet.appendRow(testRow);
    testResult.escrita = true;

    const readBack = findRowById('usuarios', testId);
    testResult.leitura = !!readBack;
    testResult.dados = readBack ? readBack.data : null;

    if (readBack) {
      const s = getSheet('usuarios');
      s.deleteRow(readBack.row);
      testResult.limpeza = true;
    }
  } catch (e) {
    testResult.erro = e.message;
  }

  return {
    success: true,
    spreadsheet: { id: ssId, url: ssUrl },
    totalAbas: allSheets.length,
    abas: allSheets,
    teste: testResult,
    timestamp: new Date().toISOString()
  };
}
