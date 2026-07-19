# Sprint 4 — Modo Banheiro — Design

**Data:** 2026-07-19
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Fechar o MVP: durante a seleção de campeões, **escolher e travar um campeão** e **aplicar
uma página de runas** direto do celular. A tela de Seleção (hoje um placeholder da Sprint 3)
vira a tela real. O celular chama o servidor por REST; o servidor traduz para a LCU.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Runas | **Aplicar uma página já salva** (listar `/lol-perks/v1/pages`, ativar com `PUT /lol-perks/v1/currentpage`). Sem editor de runas. |
| Escolher campeão | **Dois passos: selecionar (hover) e depois TRAVAR.** Espelha o cliente e evita travar por engano. |
| Campeões | **Com foto**, via **proxy** no servidor (`GET /api/champion-icon/:id` busca o ícone na LCU e repassa) — funciona no Wi-Fi local sem internet. |
| Atualização na seleção | A fase `ChampSelect` chega por SSE (Sprint 3); dentro dela, um **poll leve (~1,5s)** de `/api/champ-select` mantém o estado do botão TRAVAR. |

## Arquitetura / fluxo

```
Celular ──REST──► Servidor ──LCU REST──► LoL
  (grid de campeões, TRAVAR, aplicar runa)   (champ-select / perks)
  fotos dos campeões ◄── proxy /api/champion-icon/:id ◄── LCU
```

Quando a fase é `ChampSelect`, a tela de Seleção carrega os campeões e as páginas de runas
(REST, uma vez) e faz o poll leve do estado de pick. Escolher/travar/aplicar-runa são ações
REST que o servidor traduz para a LCU.

## Servidor

### Helpers da LCU

- **`lcu/champ-select.ts`**
  - `getSession(client)` → `GET /lol-champ-select/v1/session`.
  - `findMyPickAction(session)` — **função pura**: acha a sua ação de pick pelo
    `localPlayerCellId` (varre `session.actions`, pega a ação `type: "pick"` do seu cell).
    Retorna `{ actionId, championId, completed } | null`.
  - `hoverChampion(client, actionId, championId)` → `PATCH /lol-champ-select/v1/session/actions/{id}` com `{ championId }`.
  - `lockChampion(client, actionId)` → `POST /lol-champ-select/v1/session/actions/{id}/complete`.
  - `getOwnedChampions(client)` → `GET /lol-champions/v1/owned-champions-minimal` → `[{ id, name }]`.
- **`lcu/perks.ts`**
  - `getRunePages(client)` → `GET /lol-perks/v1/pages` → `[{ id, name, current }]`.
  - `setCurrentRunePage(client, id)` → `PUT /lol-perks/v1/currentpage` (corpo = id).

### Rotas novas

| Método | Rota | Faz |
|---|---|---|
| `GET` | `/api/champions` | Campeões que você tem `[{ id, name }]` |
| `GET` | `/api/champion-icon/:id` | Proxy do ícone (busca na LCU, repassa PNG) |
| `GET` | `/api/champ-select` | Seu estado de pick `{ actionId, championId, completed, canPick }` |
| `POST` | `/api/champ-select/hover` | Seleciona (hover) `{ championId }` |
| `POST` | `/api/champ-select/lock` | Trava o campeão selecionado |
| `GET` | `/api/rune-pages` | Suas páginas de runas `[{ id, name, current }]` |
| `POST` | `/api/rune-pages/current` | Ativa uma página `{ id }` |

`GET /api/champ-select` fora da seleção (sem sessão / sem ação de pick) responde
`{ canPick: false }` — estado neutro, sem erro.

## App — a tela de Seleção real

Substitui o placeholder da Sprint 3; mantém o tema do LoL. Ao entrar em `ChampSelect`,
carrega campeões e páginas de runas (uma vez) e começa o poll leve.

- **Busca** (filtra por nome) + **grid de campeões** (foto via `/api/champion-icon/:id` +
  nome). Tocar num campeão → **seleciona** (hover, `POST /champ-select/hover`); o escolhido
  ganha **borda dourada**.
- **Botão TRAVAR** dourado (reusa o estilo do ACEITAR) → `POST /champ-select/lock`.
  Desabilitado se nada selecionado ou já travado.
- **Runas:** rótulo "Runas" + as suas páginas como **chips dourados**; tocar aplica
  (`POST /rune-pages/current`, toast "Runa aplicada"). A página ativa fica destacada.

As outras telas (Início / Em Fila / Partida Encontrada / Em Jogo / LoL fechado) seguem iguais.

## Tratamento de erros

- **Fora da sua vez / não pode travar:** a LCU recusa → toast "Ainda não é sua vez de escolher".
- **Sem páginas de runas:** lista vazia com aviso "Crie páginas de runas no PC".
- **Ícone ausente:** o proxy responde 404 → o card mostra a inicial do campeão (fallback).
- **Fora da seleção:** `/api/champ-select` responde `{ canPick: false }`; a tela só aparece
  na fase `ChampSelect` mesmo.

## Testes

- **Unitários (vitest, servidor):**
  - `findMyPickAction(session)` — a lógica mais delicada: acha a ação certa pelo cell;
    retorna `null` quando não há sessão/ação; pega `championId`/`completed` corretos.
  - Wrappers da LCU (`hoverChampion`, `lockChampion`, `getRunePages`, `setCurrentRunePage`,
    `getOwnedChampions`) com cliente falso conferindo método + endpoint.
- **Manual (entregável):** numa seleção real, **escolher + TRAVAR** um campeão e **aplicar**
  uma página de runas pelo celular.
- **Screenshots** da tela de Seleção com dados de mentira (grid, seleção, chips de runa).

## Estrutura de arquivos

```
server/src/
├── lcu/
│   ├── champ-select.ts          → getSession, findMyPickAction (pura), hover, lock, campeões
│   ├── champ-select.test.ts
│   ├── perks.ts                 → getRunePages, setCurrentRunePage
│   └── perks.test.ts
├── routes/
│   ├── champ-select.ts          → /champions, /champion-icon, /champ-select, /hover, /lock
│   └── runes.ts                 → /rune-pages, /rune-pages/current
└── index.ts                     → monta as rotas novas

web/src/
├── api.ts                       → + champions/icon/champSelect/hover/lock/runePages/setRune
├── champ-select.tsx             → tela de Seleção: grid + busca + TRAVAR + runas
└── screens.tsx                  → usa a nova tela na fase ChampSelect
```

## Fora de escopo (YAGNI)

- **Banir** campeão → o foco é escolher + runas.
- **Editor** de runas do zero → só aplicamos páginas já salvas.
- Escolher feitiços de invocador / skins → futuro.
- Ver picks/bans dos outros jogadores ao vivo → o MVP foca na sua ação.
- Servir o app buildado pelo Express / acesso pela internet → sprints futuros.
