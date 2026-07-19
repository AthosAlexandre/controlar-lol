# Sprint 2 — Primeira Ação — Design

**Data:** 2026-07-19
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Entregar a primeira ação de verdade pelo celular: um botão **ACEITAR** que aceita a
partida encontrada, e um **toggle de auto-aceitar** que faz o servidor aceitar sozinho.
Nesta sprint nasce o app do celular (`web/`) com o tema visual do launcher do LoL.

Continua sem hack: o servidor apenas traduz as ações para a **LCU API** (os mesmos
caminhos oficiais da Sprint 1).

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Mecanismo do auto-aceitar | **Polling no servidor** via REST (a cada 1s). O WebSocket da LCU fica para a Sprint 3. |
| Como o app fala com o servidor em dev | **Vite dev server (`0.0.0.0:5173`) + CORS** no Express. Funciona no PC (`localhost:5173`) e no celular (`IP-do-PC:5173`). |
| Descoberta do endereço do servidor | App deriva de `window.location.hostname` → `http://<hostname>:3000`. Sem configurar IP na mão. |
| Capricho visual | **Caprichado desde já** (opção C), aplicado com a skill `frontend-design` na implementação. |
| Biblioteca de UI | **antd** (Ant Design), com `ConfigProvider` aplicando o tema do LoL. Atende PC + celular no mesmo layout e tem theming por tokens. |

## Paleta (tema do launcher do LoL)

| Uso | Cor |
|---|---|
| Fundo (mais escuro) | `#010A13` / `#0A1428` |
| Dourado principal (botões, bordas, destaque) | `#C8AA6E` / `#C89B3C` |
| Dourado escuro (contorno) | `#785A28` |
| Teal hextech (acento secundário) | `#0AC8B9` / `#0397AB` |
| Texto creme | `#F0E6D2` |
| Texto apagado | `#A09B8C` |
| Verde "conectado" / Vermelho "erro" | `#0ACF83` / `#E84057` |

## Arquitetura

```
┌──────────────────────┐   Wi-Fi/LAN     ┌──────────────────────┐   localhost    ┌───────────┐
│  Celular / PC        │ ──────────────► │  Servidor (Express)   │ ─────────────► │  LoL      │
│  React+Vite+antd     │  fetch (CORS)   │  + rota accept        │   LCU REST     │  (LCU)    │
│  tema LoL dourado    │ ◄────────────── │  + auto-accept (poll) │ ◄───────────── │           │
└──────────────────────┘   JSON          └──────────────────────┘                └───────────┘
```

Duas partes: o **servidor** ganha a ação de aceitar, o serviço de auto-aceitar (polling)
e CORS; nasce o **`web/`** (app React) com o tema do LoL.

## Servidor

### Endpoints (o que o celular chama)

| Método | Rota | Faz |
|---|---|---|
| `POST` | `/api/accept` | Aceita a partida agora (LCU `POST /lol-matchmaking/v1/ready-check/accept`) |
| `GET` | `/api/auto-accept` | Retorna `{ enabled: boolean }` |
| `POST` | `/api/auto-accept` | Liga/desliga: recebe `{ enabled: boolean }`, retorna `{ enabled }` |

### Auto-aceitar (polling)

Serviço em memória com um estado `enabled`. Quando ligado, roda um loop a cada **1s**:

1. Lê o lockfile → monta o cliente da LCU (reaproveita a camada `lcu/` da Sprint 1).
2. `GET /lol-gameflow/v1/gameflow-phase` (retorna uma string: `None`, `Lobby`,
   `Matchmaking`, `ReadyCheck`, `ChampSelect`, `InProgress`…).
3. Se a fase for `"ReadyCheck"`, dá `POST /lol-matchmaking/v1/ready-check/accept`.

Quando `enabled=false`, o loop para (`clearInterval`). A **decisão** é uma função pura
`shouldAccept(phase)` (só `"ReadyCheck"` → `true`), testável sem o jogo aberto. Aceitar
de novo enquanto ainda está em `ReadyCheck` é inofensivo (idempotente na prática).

### CORS

Middleware `cors` liberando as origens da rede local (o app carregado em `IP:5173` ou
`localhost:5173` chamando o servidor em `:3000`). Rede local confiável no MVP.

## App do celular (`web/`)

**Stack:** React + Vite + TypeScript + **antd**. `ConfigProvider` aplica o tema do LoL
(tokens de cor da paleta acima). Vite ouvindo em `0.0.0.0` para abrir no PC e no celular.

**Uma tela só (`App.tsx`):**
- **Status no topo:** nick do jogador + indicador verde "Conectado" / cinza "LoL fechado".
  Busca `GET /api/summoner` periodicamente para refletir o LoL aberto/fechado.
- **Botão grande dourado "ACEITAR"** → `POST /api/accept`, com toast antd de sucesso/erro.
- **Toggle "Auto-aceitar"** (Switch antd) → `POST /api/auto-accept`; ao montar, lê o
  estado atual com `GET /api/auto-accept`.
- **Endereço do servidor** derivado de `window.location.hostname`.

O visual caprichado (fundo escuro hextech, bordas douradas, botão de destaque, identidade
"Modo Banheiro") é aplicado com a skill `frontend-design` na fase de implementação.

## Tratamento de erros

- **LoL fechado:** `GET /api/summoner` responde 503 → UI mostra estado cinza "LoL fechado"
  e desabilita o botão ACEITAR.
- **Aceitar sem partida:** servidor responde com mensagem clara → toast "Nenhuma partida
  pra aceitar".
- **Servidor offline:** o `fetch` falha → UI mostra "Servidor offline".
- **Loop resiliente:** se um poll do auto-aceitar falhar (LoL fechou no meio), o serviço
  não quebra — apenas ignora e tenta de novo no próximo ciclo.

## Testes

- **Unitários (vitest, servidor):**
  - `shouldAccept(phase)` — `"ReadyCheck"` → `true`; qualquer outra fase → `false`.
  - Serviço de auto-aceitar — ligar/desligar altera o estado e inicia/para o loop
    (usando fake timers do vitest, sem jogo aberto).
- **Manual (entregável da sprint):** com o LoL aberto, entrar na fila →
  1. apertar **ACEITAR** pelo celular/PC aceita a partida;
  2. ligar o **toggle** e a próxima partida é aceita sozinha.
- **Web:** verificação manual nesta sprint (mantém o escopo enxuto; testes de componente
  ficam para quando a UI estabilizar).

## Estrutura de arquivos

```
server/src/
├── lcu/
│   └── matchmaking.ts            → acceptReadyCheck(client), getGameflowPhase(client)
├── auto-accept/
│   ├── should-accept.ts          → shouldAccept(phase): boolean (pura)
│   ├── should-accept.test.ts
│   ├── auto-accept-service.ts    → setEnabled/isEnabled + loop de polling
│   └── auto-accept-service.test.ts
├── routes/
│   └── actions.ts                → POST /accept, GET+POST /auto-accept
└── index.ts                      → + cors, + monta actions router, + inicia serviço

web/  (novo)
├── package.json, vite.config.ts, tsconfig.json, index.html
└── src/
    ├── main.tsx                  → ConfigProvider (tema LoL) + App
    ├── theme.ts                  → tokens antd com as cores do LoL
    ├── api.ts                    → baseUrl + getSummoner/accept/getAutoAccept/setAutoAccept
    └── App.tsx                   → tela (status + botão + toggle)
```

## Documentação (parte da entrega)

Como em toda sprint: ao concluir, escrever `docs/sprints/sprint-2.md` (o que foi feito,
como testar, decisões, aprendizados) e atualizar o `README.md` com o passo a passo de
subir o `web/` (além do `server/`).

## Fora de escopo (YAGNI nesta sprint)

- WebSocket / tela que muda sozinha em tempo real → Sprint 3.
- Escolher campeão e runas → Sprint 4.
- Servir o app buildado pelo Express (modo "produção", origem única) → sprint futuro.
- Autenticação no app / acesso pela internet → sprint futuro.
