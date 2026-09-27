# SGPO - Análise do Sistema e Melhorias

Este documento detalha o funcionamento, as regras de negócio e os pontos de atenção da arquitetura atual do **Sistema de Gestão da Prontidão Operacional (SGPO)**.

## 1. Arquitetura Atual

- **Frontend**: Aplicação SPA (Single Page Application) estática em HTML, CSS e Vanilla JS, agora rodando sobre um servidor Node.js (Express).
  - Controle de estado via `sessionStorage` (autenticação) e `localStorage` (cache local e configurações).
  - `BroadcastChannel` para sincronização de estado entre abas (ex: ao salvar numa aba, atualiza a outra).
- **Backend / Banco de Dados**: Google Apps Script (GAS) atuando como API RESTful, e Google Sheets atuando como banco de dados tabular com cerca de 20 abas (usuarios, viaturas, relatórios, etc.).
- **Comunicação**: O arquivo `js/api.js` centraliza o CRUD e faz chamadas POST com JSON para a URL do GAS publicada ("Executar como: Eu", "Acesso: Qualquer pessoa").

## 2. Regras de Negócio e Funcionalidades

1. **Gestão de Prontidão (Cores)**: Baseia-se no sistema de prontidão (Verde, Amarela, Azul, Branca).
2. **Ciclo de Serviço**: Turnos de 24h (das 07:30 às 07:30 do dia seguinte). O sistema controla o status do serviço (iniciarServico / encerrarServico).
3. **Módulos Principais**:
   - **Dashboard**: Acompanhamento em tempo real de efetivo, viaturas despachadas, entrada/saída de oficiais.
   - **Rotina**: Controle de checklists, atividades fixas e personalizadas.
   - **Despacho e Ocorrências**: Lógica para despachar, relatar status (em_atendimento) e concluir.
   - **Telegrafia, Oficiais e Postos**: Cadastro do efetivo militar, postos hierárquicos e logs.
4. **Perfis de Usuário**: `superadmin`, `admin`, `comandante`, `operador`, `visualizador`.
5. **Níveis de Permissão**: GB, SGB, POSTO. Limitam a visualização e gestão de usuários/atividades conforme a hierarquia.

## 3. Vulnerabilidades Críticas Identificadas

Ao analisar os arquivos (especialmente `gas/SGPO.gs` e `js/auth.js`), foram identificados pontos sensíveis na estrutura atual:

### 3.1. Segurança e Falha "Aberta" (Stateless GAS)
O Google Apps Script não mantém estado de variáveis globais entre requisições separadas de clientes. 
- O código GAS define `let _authUser = null;`. 
- No endpoint de `login`, essa variável é preenchida, mas ao final da requisição o processo morre.
- Quando o frontend faz um request de `update` ou `delete` logo em seguida, o script roda do zero e `_authUser` volta a ser `null`.
- O código em `handleUpdateComPermissao` faz a seguinte verificação: `if (_authUser && _authUser.id !== SUPER_USER.id) {... bloqueia ...}`. Como `_authUser` é `null`, o `if` avalia como falso e **pula a validação de segurança**, permitindo a edição livre!
- **Resumo**: A API atual permite que qualquer pessoa com a URL (via cURL/Postman) modifique ou apague o banco de dados sem precisar de login, basta enviar `{ action: "update", ... }`.

### 3.2. Senha em Plain-Text e Token Inexistente
O login transmite a senha em plain-text para a API e, se aprovado, confia unicamente no `sessionStorage` do navegador para assumir que o usuário está logado. Nenhuma validação em requisições subsequentes do backend exige que o usuário comprove a identidade (nenhum bearer token ou cookie de sessão).

### 3.3. Concorrência e Race Conditions (Google Sheets)
Aplicações multi-usuário que realizam updates concorrentes via `.getDataRange().getValues()` e salvam índices logo a seguir estão sujeitas à sobreposição de dados. Se dois operadores atualizarem o banco simultaneamente, um apagará a edição do outro.

## 4. Recomendações e Roadmap de Evolução

Para fazer o sistema "fluir" melhor, com velocidade, escalabilidade e segurança de nível corporativo (Militar), sugere-se a seguinte progressão:

### Fase 1: Correção de Segurança Imediata (Tapa-buraco)
1. **Passar Credencial nas Requisições**: O frontend (`api.js`) deve enviar em **todo** payload (junto ao `action`) o ID do usuário (ou username/senha criptografada de autenticação básica) para o GAS.
2. **Validar no Backend (GAS)**: Em toda chamada do `doPost`, o GAS deve buscar o ID no payload, validar no banco e definir o `_authUser`, impedindo assim que requisições anônimas consigam modificar o banco.

### Fase 2: Backend Definitivo e Relacional (Melhoria de Arquitetura)
Como o sistema já foi importado para o AI Studio, temos a infraestrutura para abandonar o Apps Script.
1. **Banco de Dados (Cloud SQL)**: Provisionar um Cloud SQL (PostgreSQL). Estruturar as abas do Sheets como tabelas reais. O Node.js/Express fará a ponte direta com o banco.
   - *Por quê?* Resolve o problema de limite do Google Sheets, lentidão e sobreposição (race conditions) nativamente.
2. **Migrar Funções (Server.js)**: Pegar toda lógica descrita em `SGPO.gs` e recriar como rotas express em `server.js` (`/api/login`, `/api/update`).
3. **Autenticação JWT**: Utilizar JSON Web Tokens (JWT) para autenticação robusta e gerenciar permissões no backend (Node.js).

### Fase 3: Modernização de UI e Performance
- Transformar o frontend em módulos ES6 ou migrá-lo gradativamente (se desejado) para React ou Vue para melhor gerência do estado, embora o JavaScript atual esteja organizado de forma satisfatória e bem componentizado.

---
*Gerado por AI Studio - Revisão Estrutural do SGPO*
