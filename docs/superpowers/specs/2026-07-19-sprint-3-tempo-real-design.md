# Sprint 3 — Tempo Real — Design

**Data:** 2026-07-19
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

A tela do celular muda **sozinha** conforme o jogo avança: Início → Em Fila → Partida
Encontrada → Seleção → Em Jogo. O servidor escuta o **WebSocket da LCU** (evento de
mudança de fase), guarda o estado do jogo e faz **stream** desse estado pro celular via
**SSE**. O celular só reage; as ações (aceitar, toggle) continuam REST, como na Sprint 2.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Transporte servidor→celular | **SSE** (Server-Sent Events): um `GET /api/events` que streama o estado. Nativo no navegador (`EventSource`), sem biblioteca nova, reconecta sozinho. Refina a menção a Socket.IO do design original — só precisamos de um sentido. |
| Evento da LCU | WebSocket assinando só `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` (a mudança de fase). Ao conectar, busca a fase e o nick atuais via REST. |
| Escopo da "Seleção" | Apenas **estado/placeholder** ("Na seleção de campeões"). Escolher campeão e runas fica para a **Sprint 4**. |
| Auto-aceitar da Sprint 2 | **Fica como está** (polling próprio). Não mexer em código testado que já funciona. |
| Cronômetro da fila | Contado **no cliente**, desde que a fase `Matchmaking` chega. Simples; sem depender de dado extra da Riot. |

## Arquitetura

```
   LoL (LCU)  ──WebSocket (wss, evento gameflow-phase)──►  Servidor
   LoL (LCU)  ◄──REST (fase inicial, nick)──────────────►  Servidor
                                                              │
                                              SSE (GET /api/events, stream)
                                                              ▼
                                                        Celular / PC
                                              (EventSource → troca de tela)
```

## Servidor

### Peças novas

- **`lcu/events.ts`** — abre o WebSocket da LCU (`wss://127.0.0.1:porta`, mesmo Basic auth
  da Sprint 1 + certificado autoassinado aceito), assina o evento
  `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase`. Ao conectar, busca a fase atual e o nick
  via REST (para já ter estado, não só na próxima mudança). Reconecta sozinho em loop,
  **relendo o lockfile** a cada tentativa (o token muda quando o cliente reinicia).
- **`state/game-state.ts`** — guarda `{ phase, summoner }` em memória e **emite pros
  inscritos só quando muda**. Expõe `getState()`, `setPhase()`, `setSummoner()`,
  `subscribe(cb): () => void`.
- **`state/normalize-phase.ts`** — `normalizePhase(raw: string): Phase`, função pura que
  mapeia a string crua da LCU para um tipo fechado.
- **`routes/events.ts`** — `GET /api/events` (SSE): manda o estado atual ao conectar,
  depois empurra cada mudança; remove a inscrição quando o celular desconecta.
- **`index.ts`** — inicia o watcher da LCU (alimentando o `game-state`) e monta a rota de
  eventos.

### Modelo de estado

```ts
type Phase =
  | "Offline"      // LoL fechado ou WS caído
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "InProgress"
  | "Other";       // qualquer outra fase da LCU

interface Summoner { name: string; tagLine: string; level: number }
interface GameState { phase: Phase; summoner: Summoner | null }
```

`normalizePhase` mapeia: `None`/`Lobby`/`Matchmaking`/`ReadyCheck`/`ChampSelect` direto;
`GameStart`/`InProgress`/`Reconnect`/`WaitingForStats`/`PreEndOfGame` → `InProgress`;
qualquer outra string → `Other`. `Offline` é sintético (definido pelo watcher quando o LoL
está fechado / o WS cai), não vem da LCU.

## App do celular

Um `EventSource` para `/api/events` mantém o estado; a tela troca conforme `phase` (o
**poll de 3s da Sprint 2 sai**, substituído pelo push). Mantém a **casca visual** (card
hextech dourado, brackets, cabeçalho "MODO BANHEIRO") e troca o **miolo** do card:

| Fase | Miolo do card |
|---|---|
| `Offline` | "LoL fechado" (cinza) |
| `None` / `Lobby` / `Other` | **Início**: nick + toggle de auto-aceitar |
| `Matchmaking` | **Em Fila**: "Procurando partida…" + cronômetro |
| `ReadyCheck` | **Partida Encontrada!**: botão **ACEITAR** dourado |
| `ChampSelect` | **Seleção**: "Na seleção de campeões" (placeholder) |
| `InProgress` | **Em Jogo**: "Partida em andamento" |

O toggle de auto-aceitar vive na tela de **Início**; quando a partida aparece e o
auto-aceitar está ligado, o servidor aceita e a tela vira **Seleção** sozinha.

## Tratamento de erros

- **LoL fechado / WS caiu:** estado vai para `Offline`; o servidor tenta reconectar em loop
  (relendo o lockfile). A tela mostra "LoL fechado".
- **SSE cai:** o `EventSource` reconecta sozinho (comportamento nativo do navegador).
- **Token muda no restart do LoL:** o watcher relê o lockfile ao reconectar.

## Testes

- **Unitários (vitest, servidor):**
  - `normalizePhase(raw)` — mapa LCU → tipo fechado (casos conhecidos + fase desconhecida → `Other`).
  - `game-state` — estado inicial; emite só quando a fase/summoner muda (não emite em valor
    igual); `subscribe` recebe mudanças e o retorno desinscreve.
- **Manual (entregável):** com o LoL aberto, entrar na fila e ver o celular ir sozinho
  **Início → Em Fila → Partida Encontrada → (aceitar) → Seleção → Em Jogo**.
- O cliente WebSocket da LCU (`lcu/events.ts`) é validado manualmente (depende do jogo).

## Estrutura de arquivos

```
server/src/
├── lcu/
│   └── events.ts               → watcher do WebSocket da LCU (fase + reconexão)
├── state/
│   ├── normalize-phase.ts      → normalizePhase(raw): Phase (pura)
│   ├── normalize-phase.test.ts
│   ├── game-state.ts           → estado {phase,summoner} + emit on change
│   └── game-state.test.ts
├── routes/
│   └── events.ts               → GET /api/events (SSE)
└── index.ts                    → inicia watcher + monta a rota

web/src/
├── api.ts                      → + subscribeEvents(onState) via EventSource
├── screens/                    → Offline / Idle / Queue / Found / Select / InGame
└── App.tsx                     → assina eventos e troca a tela por fase
```

## Fora de escopo (YAGNI)

- Escolher campeão e aplicar runas (a Seleção de verdade) → Sprint 4.
- Migrar o auto-aceitar para usar o WebSocket → cleanup futuro (hoje o polling funciona).
- Detalhes da fila vindos da Riot (posição, tempo estimado) → o cronômetro no cliente basta.
- Servir o app buildado pelo Express / acesso pela internet → sprints futuros.
