# Seleção — Times e Feitiços — Design

**Data:** 2026-07-19
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Enriquecer a tela de Seleção (Sprint 4) com duas coisas que o jogador quer do celular:
1. **Ver os campeões dos dois times** — o seu time e o time inimigo — durante a seleção.
2. **Trocar os feitiços de invocador** nos slots **D** e **F**.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Visibilidade do time inimigo | Mostrar só o que a LCU expõe. No **draft ranqueado**, os campeões do inimigo só aparecem **após travarem** (a Riot esconde o hover). No seu time, mostra o **hover/intent** ao vivo. |
| Troca de feitiços | **Dois slots (D e F)**, cada um abre a lista de feitiços com ícone; escolher troca via `PATCH .../my-selection`. |
| Fonte dos dados dos times | O mesmo `GET /api/champ-select` (já consultado a cada 1,5s) passa a devolver `myTeam`, `theirTeam` e `mySpells`. Sem endpoint/poll novo para o estado. |
| Ícones de feitiço | **Proxy no servidor** (como os ícones de campeão), para funcionar no Wi-Fi local. |

## Arquitetura / fluxo

Tudo acontece dentro da fase `ChampSelect`. O poll de `GET /api/champ-select` (1,5s) já
existe; ele passa a trazer os times e os feitiços atuais, então a UI atualiza sozinha. As
ações novas (trocar feitiço) são REST, como as demais.

```
Celular ──REST──► Servidor ──LCU REST──► LoL
  (poll champ-select: pick + times + feitiços)
  (POST trocar feitiços)
  ícones de feitiço ◄── proxy /api/spell-icon/:id ◄── LCU
```

## Servidor

### Helpers da LCU

- **`lcu/champ-select.ts`** ganha `summarizeChampSelect(session)` — **função pura** que
  extrai da sessão:
  ```ts
  interface TeamMember {
    cellId: number;
    championId: number;   // championId || championPickIntent (0 se nada)
    position: string;     // "top" | "jungle" | "middle" | "bottom" | "utility" | ""
  }
  interface MySpells { spell1Id: number; spell2Id: number }
  interface ChampSelectSummary {
    canPick: boolean;
    actionId: number;
    championId: number;
    completed: boolean;
    myTeam: TeamMember[];
    theirTeam: TeamMember[];
    mySpells: MySpells | null;   // do meu jogador (localPlayerCellId), ou null
  }
  summarizeChampSelect(session: unknown): ChampSelectSummary
  ```
  Para o **meu time**, `championId` usa `member.championId || member.championPickIntent`
  (mostra o hover). Para o **inimigo**, usa só `member.championId` (o que estiver visível).
  `mySpells` vem do membro cujo `cellId === localPlayerCellId`.

- **`lcu/summoner-spells.ts`**:
  - `getSummonerSpells(client)` → `GET /lol-game-data/v1/summoner-spells` → filtra os
    utilizáveis na Summoner's Rift (gameModes inclui `CLASSIC`) → `[{ id, name }]`.
  - `setSummonerSpells(client, spell1Id, spell2Id)` →
    `PATCH /lol-champ-select/v1/session/my-selection` com `{ spell1Id, spell2Id }`.

### Rotas

| Método | Rota | Muda/Faz |
|---|---|---|
| `GET` | `/api/champ-select` | Agora devolve também `myTeam`, `theirTeam`, `mySpells` |
| `GET` | `/api/summoner-spells` | Lista `[{ id, name }]` dos feitiços da SR |
| `GET` | `/api/spell-icon/:id` | Proxy do ícone do feitiço (busca `iconPath` na LCU e repassa o PNG) |
| `POST` | `/api/champ-select/spells` | Troca os feitiços: `{ spell1Id, spell2Id }` |

O `/api/spell-icon/:id` busca `GET /lol-game-data/v1/summoner-spells/{id}.json` para achar o
`iconPath`, depois faz `GET iconPath` (arraybuffer) e repassa como `image/png`, com cache.

## App — a tela de Seleção

A `ChampSelectScreen` ganha seções novas, empilhadas e roláveis, no tema do LoL:

1. **Times** (topo): duas fileiras — **Seu time** e **Inimigo** — com 5 slots cada; cada
   slot mostra o ícone do campeão (proxy já existente `/api/champion-icon/:id`) + a posição.
   Slot vazio quando não há campeão/inimigo visível.
2. **Seu pick** (já existe): busca + grid de campeões + botão **Confirmar**.
3. **Feitiços** (novo): dois slots marcados **D** e **F** com o ícone do feitiço atual;
   tocar abre a lista de feitiços (ícone via `/api/spell-icon/:id`) → escolher troca aquele
   slot (`POST /api/champ-select/spells` com os dois ids atualizados). Toast "Feitiço trocado".
4. **Runas** (já existe): chips das páginas.

Toda a leitura (times, feitiços atuais) vem do `GET /api/champ-select` do poll.

## Tratamento de erros

- **Inimigo escondido / sem pick:** slot vazio (placeholder), sem erro.
- **Feitiços indisponíveis:** se `getSummonerSpells` falhar, a seção de feitiços não aparece;
  o resto da tela segue funcionando.
- **Trocar feitiço fora da hora:** a LCU recusa → toast "Não foi possível trocar o feitiço"
  (com o motivo real via `lcuError`).
- **Ícone de feitiço ausente:** proxy responde 404 → o slot mostra a inicial/um fallback.

## Testes

- **Unitários (vitest, servidor):**
  - `summarizeChampSelect(session)` — extrai `myTeam`/`theirTeam` (com hover no meu time),
    `mySpells` do meu cell, e mantém o estado de pick; sessão vazia → times vazios e
    `canPick:false`.
  - `getSummonerSpells` (filtra por gameMode) e `setSummonerSpells` (PATCH no my-selection)
    com cliente falso.
- **Manual (entregável):** em jogo personalizado, ver o seu time preenchendo ao escolher, e
  **trocar um feitiço** (D ou F) vendo mudar no cliente.
- **Screenshots** com mock: times cheios (seu + inimigo) e os slots D/F com o seletor aberto.

## Estrutura de arquivos

```
server/src/
├── lcu/
│   ├── champ-select.ts          → + summarizeChampSelect (pura)
│   ├── champ-select.test.ts     → + testes do summarize
│   ├── summoner-spells.ts       → getSummonerSpells, setSummonerSpells
│   └── summoner-spells.test.ts
├── routes/
│   └── champ-select.ts          → /champ-select (enriquecido), /summoner-spells,
│                                   /spell-icon/:id, /champ-select/spells
web/src/
├── api.ts                       → + tipos de time/feitiço + getSummonerSpells/setSpells/spellIconUrl
├── champ-select.tsx             → + seções Times e Feitiços
└── App.css                      → classes das novas seções
```

## Fora de escopo (YAGNI)

- Ver o **hover** (intenção) do time inimigo → a Riot esconde no draft; não dá.
- Trocar **skin** / ver skins dos outros → futuro.
- Reordenar posições / trade de campeão → futuro.
- Chat da seleção → futuro.
