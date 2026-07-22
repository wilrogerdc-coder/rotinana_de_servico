# Google Apps Script — SGPO

## Instalação (1 arquivo único)

1. Crie uma nova planilha no **Google Sheets**
2. Vá em **Extensões > Apps Script**
3. DELETE todo código existente no editor
4. Abra o arquivo `SGPO.gs` nesta pasta
5. Copie **TODO** o conteúdo (Ctrl+A, Ctrl+C)
6. Cole no editor do Apps Script (Ctrl+V)
7. Salve (Ctrl+S) — nomeie como "SGPO"
8. Execute `setupCompletoSGPO` (menu ou barra de funções)
9. Autorize as permissões quando solicitado

## Comando Único de Setup

O script `setupCompletoSGPO()` cria automaticamente:
- 17 abas com cabeçalhos, formatação, validações e proteções
- Dados iniciais (usuários, militares, oficiais, atividades padrão, configurações)
- Menu personalizado 🔥 SGPO na planilha

**Para atualizar** em versões futuras, execute `atualizarSchema()` — ele adiciona novas colunas/abas sem perder dados existentes.

## Deploy

1. **Implantar > Nova implantação**
2. Tipo: **Web app**
3. Execute como: **Eu**
4. Quem tem acesso: **Qualquer pessoa**
5. Copie a URL → cole no SGPO (tela de login → ⚙️ Configurar API)

## Abas Criadas Automaticamente

| # | Aba | Função |
|---|-----|--------|
| 1 | Usuarios | Credenciais e perfis de acesso |
| 2 | Militares | Cadastro de militares |
| 3 | Oficiais | Cadastro de oficiais |
| 4 | Servicos | Registro de plantões |
| 5 | Rotina | Atividades do serviço atual |
| 6 | AtividadesPadrao | Modelo padrão (copiado para cada serviço) |
| 7 | AtividadesExtras | Atividades inseridas durante o plantão |
| 8 | Telegrafia | Operador atual |
| 9 | TelegrografiaHistorico | Histórico de trocas |
| 10 | OficiaisEntrada | Registro entrada/saída |
| 11 | Notificacoes | Notificações internas |
| 12 | Auditoria | Log de ações |
| 13 | Historico | Backup de serviços encerrados |
| 14 | Configuracoes | Configurações do sistema |
| 15 | Sons | Configuração de sons |
| 16 | Logos | URLs dos logotipos |
| 17 | Relatorios | Cache de PDFs |

## Usuários Padrão

| Usuário | Senha | Perfil |
|---------|-------|--------|
| admin | admin | admin |
| comandante | 123 | comandante |
| operador | 123 | operador |
| visualizar | 123 | visualizador |
