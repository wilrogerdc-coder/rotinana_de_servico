# Diagramas do SGPO

## 1. Arquitetura Geral

```mermaid
graph TB
    subgraph Navegador["Navegador (Cliente)"]
        HTML["Páginas HTML<br/>index · dashboard · admin<br/>tv · relatorios · etc"]
        JS["Módulos JS<br/>auth · nav · api · utils<br/>sync · dashboard · rotina"]
        CSS["Tema escuro<br/>Apple HIG + Material 3"]
    end

    subgraph API["Camada de API"]
        ApiJS["api.js<br/>API class · DemoData<br/>fetchToGAS · cache"]
        LS["localStorage<br/>demo_state · demo_version<br/>auth · config"]
        BC["BroadcastChannel<br/>sincronização entre abas"]
    end

    subgraph Backend["Backend Externo"]
        GAS["Google Apps Script<br/>Web App (doPost/doGet)"]
        GS["Google Sheets<br/>~20 abas (usuarios,<br/>viaturas, servicos, ...)"]
    end

    Navegador --> ApiJS
    ApiJS -->|fetch| GAS
    ApiJS --> LS
    ApiJS --> BC
    GAS --> GS
```

## 2. Fluxo de Dados

```mermaid
sequenceDiagram
    participant U as Usuário
    participant P as Página HTML
    participant A as api.js
    participant LS as localStorage
    participant BC as BroadcastChannel
    participant GAS as Google Apps Script
    participant GS as Google Sheets

    Note over U,GS: Inicialização
    P->>A: API.loadAll()
    A->>GAS: fetch(url, { action: 'read', sheet: 'all' })
    alt Online
        GAS->>GS: SpreadsheetApp.getActive()
        GS-->>GAS: dados estruturados
        GAS-->>A: JSON response
        A->>A: _sheetToState(data)
        A->>LS: save() backup em cache
    else Offline / Demo
        A->>A: DemoData.load()
        A->>LS: localStorage.getItem('sgpo_demo_state')
        LS-->>A: state JSON
    end
    A-->>P: this.data = { usuarios, viaturas, ... }
    P->>P: render() cada seção

    Note over U,GS: Mutação
    U->>P: clica "Salvar"
    P->>A: API.update(sheet, id, dados)
    A->>GAS: fetch(url, { action: 'update', ... })
    GAS->>GS: sheet.getRange().setValues()
    GS-->>GAS: ok
    GAS-->>A: { success: true }
    A->>BC: postMessage({ type: 'update', sheet })
    A->>LS: save() atualiza cache
    A-->>P: resultado

    Note over P,BC: Sincronização entre abas
    BC-->>P: onmessage: 'update'
    P->>P: loadAll() recarrega dados
```

## 3. Estrutura de Módulos

```mermaid
graph LR
    subgraph Pages["Páginas HTML"]
        index["index.html<br/>Login + Redirect"]
        dashboard["dashboard.html<br/>Prontidão Principal"]
        admin["admin.html<br/>Painel Administrativo"]
        rotina["rotina.html<br/>Rotina Diária"]
        postos["postos.html<br/>Postos de Serviço"]
        oficiais["oficiais.html<br/>Oficiais"]
        tv["tv.html<br/>Exibição TV"]
        relatorios["relatorios.html<br/>Relatórios"]
        historico["historico.html<br/>Histórico"]
        extras["extras.html<br/>Extras"]
        telegrafia["telegrafia.html<br/>Telegrafia"]
    end

    subgraph JS["Módulos JS Compartilhados"]
        auth["auth.js<br/>· canTela()<br/>· nivelPermissao<br/>· login/logout"]
        nav["nav.js<br/>· Sidebar<br/>· Topbar<br/>· Navegação"]
        api["api.js<br/>· API class (CRUD)<br/>· DemoData (fallback)<br/>· cache + save<br/>· BroadcastChannel"]
        utils["utils.js<br/>· Utils class<br/>· loadSoundConfig()<br/>· defaultSounds()"]
        sync["sync.js<br/>· Sincronização<br/>· Adaptive polling"]
    end

    subgraph Features["Módulos de Cada Página"]
        dash_logic["dashboard.js<br/>· Serviço Ativo<br/>· Ocorrências<br/>· Efetivo<br/>· Despacho"]
        rotina_logic["rotina.js<br/>· Rotina diária<br/>· Checklist"]
    end

    dashboard --- dash_logic
    admin --- api
    Pages --- nav
    Pages --- auth
    Pages --- utils
    Pages --- sync
    dash_logic --- api
    rotina_logic --- api
```

## 4. Modelo de Dados

```mermaid
erDiagram
    usuarios ||--o{ permissoesTela : "tem permissões"
    usuarios {
        string id PK
        string usuario
        string nome
        string senha
        string perfil "operador | admin | superadmin"
        string nivelPermissao "POSTO | SGB | GB"
        string Status "ativo | removido"
    }

    militares {
        string id PK
        string nome
        string reCpf
        string posto
        string Status
    }

    oficiais {
        string id PK
        string nome
        string posto
        int antiguidade
        string unidade
        string Status
    }

    postos {
        string id PK
        string nome
        string ordem
        string Status
    }

    permissoesTela {
        string id PK
        string tela
        string perfil
        string nivelMinimo
        string Status
    }

    viaturas ||--o{ ocorrencias : "despachada em"
    viaturas {
        string id PK
        string nome
        string tipo "UR | ABT | etc"
        string placa
        string capacidade
        string Status
    }

    tiposViatura {
        string id PK
        string nome
        string sigla
        string Status
    }

    naturezas {
        string id PK
        string nome
        string valor
        string Status
    }

    servicos ||--o{ ocorrencias : "contém"
    servicos ||--o{ efetivo_escala : "escala"
    servicos {
        string id PK
        string data
        string horaInicio "07:30"
        string horaFim "07:30+1"
        string corProntidao "verde | amarela | azul | branca"
        string status "ativo | encerrado"
        string Status
    }

    ocorrencias {
        string id PK
        string servicoId FK
        int numero
        string titulo
        string natureza FK "ref. naturezas"
        string descricao
        string viaturaIds "array de IDs"
        string efetivo "array de nomes"
        time horaAcionamento
        time horaRetorno
        string prontidaoCor
        string status "em_atendimento | concluida"
        string Status
    }

    atividades {
        string id PK
        string nome
        string descricao
        string Status
    }

    configuracoes {
        string id PK
        string chave
        string valor
        string Status
    }

    sons {
        string id PK
        string nome
        string url
        string tipo "alerta | notificacao | etc"
        string Status
    }

    logos {
        string id PK
        string nome
        string url
        string Status
    }
```

## Legenda

| Cor | Nível de Prontidão |
|-----|-------------------|
| 🟢 Verde | Normal |
| 🟡 Amarela | Atenção |
| 🔵 Azul | Reforço |
| ⚪ Branca | Máxima |

- **Superuser**: `cavalieri` / `tricolor` (id `_superuser_`, perfil `superadmin`)
- **Turno**: 24h (07:30 às 07:30)
- **Fallback offline**: DemoData com localStorage
- **Host**: Vercel (frontend estático)
- **Backend**: Google Apps Script + Google Sheets (~20 abas)
