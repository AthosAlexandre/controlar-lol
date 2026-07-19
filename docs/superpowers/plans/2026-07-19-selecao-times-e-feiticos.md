# Seleção — Times e Feitiços (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela de Seleção, mostrar os campeões do seu time e do time inimigo, e permitir trocar os feitiços de invocador (slots D e F).

**Architecture:** Uma função pura `summarizeChampSelect` extrai times + feitiços + pick da sessão da LCU; o `GET /api/champ-select` (já consultado a cada 1,5s) passa a devolver isso. Helpers `getSummonerSpells`/`setSummonerSpells` e um proxy de ícone de feitiço completam o servidor. A tela de Seleção ganha as seções Times e Feitiços, alimentadas pelo mesmo poll.

**Tech Stack:** Servidor: Node, TypeScript, Express, axios, vitest (sem deps novas). Web: React, Vite, TypeScript, antd.

## Global Constraints

- Código do servidor em `server/`; app em `web/`. TS `strict: true` nos dois.
- Servidor CommonJS; web ESM. Nomes/código em inglês; comentários/docs em português.
- Reaproveitar o proxy de ícone (padrão do `/api/champion-icon/:id`) para feitiços.
- O time do jogador mostra `championId || championPickIntent` (hover); o inimigo mostra só `championId` (o que a Riot deixa visível).
- Feitiços da Summoner's Rift: filtrar `gameModes` incluindo `"CLASSIC"` e `id > 0`.
- Trocar feitiço: `PATCH /lol-champ-select/v1/session/my-selection` com `{ spell1Id, spell2Id }`.
- `GET /api/champ-select` fora da seleção / sem cliente responde `{ canPick:false, myTeam:[], theirTeam:[], mySpells:null }`.
- Poll do estado no app permanece **1500 ms**, só na fase `ChampSelect`.
- Visual no tema do LoL (ícones com borda dourada; slots D/F com a letra em dourado).

---

## File Structure

```
server/src/
├── lcu/
│   ├── champ-select.ts          → + summarizeChampSelect (pura) + tipos de time/spells
│   ├── champ-select.test.ts     → + testes do summarize
│   ├── summoner-spells.ts       → getSummonerSpells, setSummonerSpells
│   └── summoner-spells.test.ts
└── routes/
    └── champ-select.ts          → /champ-select enriquecido, /summoner-spells,
                                    /spell-icon/:id, /champ-select/spells

web/src/
├── api.ts                       → + TeamMember/PickState estendido, SummonerSpell,
│                                   spellIconUrl, getSummonerSpells, setSpells
├── champ-select.tsx             → + seções Times e Feitiços
└── App.css                      → classes das novas seções
```

---

### Task 1: `summarizeChampSelect` — extrai times + feitiços + pick (pura)

**Files:**
- Modify: `server/src/lcu/champ-select.ts`
- Modify: `server/src/lcu/champ-select.test.ts`

**Interfaces:**
- Consumes: `findMyPickAction` (já existe no arquivo).
- Produces:
  - `interface TeamMember { cellId: number; championId: number; position: string }`
  - `interface MySpells { spell1Id: number; spell2Id: number }`
  - `interface ChampSelectSummary { canPick: boolean; actionId: number; championId: number; completed: boolean; myTeam: TeamMember[]; theirTeam: TeamMember[]; mySpells: MySpells | null }`
  - `summarizeChampSelect(session: unknown): ChampSelectSummary`

- [ ] **Step 1: Adicionar o teste que falha em `server/src/lcu/champ-select.test.ts`**

Acrescentar ao fim do arquivo:

```ts
import { summarizeChampSelect } from "./champ-select";

const fullSession = {
  localPlayerCellId: 0,
  actions: [
    [{ id: 0, actorCellId: 0, championId: 0, completed: false, type: "pick" }],
  ],
  myTeam: [
    { cellId: 0, championId: 0, championPickIntent: 64, assignedPosition: "top", spell1Id: 4, spell2Id: 6 },
    { cellId: 1, championId: 103, championPickIntent: 0, assignedPosition: "jungle", spell1Id: 4, spell2Id: 11 },
  ],
  theirTeam: [
    { cellId: 5, championId: 157, championPickIntent: 99, assignedPosition: "middle" },
    { cellId: 6, championId: 0, championPickIntent: 0, assignedPosition: "" },
  ],
};

describe("summarizeChampSelect", () => {
  it("usa o hover (pickIntent) no meu time e só o champ visível no inimigo", () => {
    const s = summarizeChampSelect(fullSession);
    expect(s.myTeam[0]).toEqual({ cellId: 0, championId: 64, position: "top" });
    expect(s.myTeam[1]).toEqual({ cellId: 1, championId: 103, position: "jungle" });
    // inimigo: NÃO usa pickIntent (Riot esconde o hover)
    expect(s.theirTeam[0]).toEqual({ cellId: 5, championId: 157, position: "middle" });
    expect(s.theirTeam[1]).toEqual({ cellId: 6, championId: 0, position: "" });
  });

  it("pega meus feitiços pelo localPlayerCellId e mantém o estado de pick", () => {
    const s = summarizeChampSelect(fullSession);
    expect(s.mySpells).toEqual({ spell1Id: 4, spell2Id: 6 });
    expect(s.canPick).toBe(true);
    expect(s.actionId).toBe(0);
  });

  it("sessão vazia → times vazios, sem feitiços, canPick false", () => {
    const s = summarizeChampSelect(null);
    expect(s).toEqual({
      canPick: false,
      actionId: 0,
      championId: 0,
      completed: false,
      myTeam: [],
      theirTeam: [],
      mySpells: null,
    });
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (em `server/`): `npx vitest run src/lcu/champ-select.test.ts`
Expected: FAIL — `summarizeChampSelect` não existe.

- [ ] **Step 3: Implementar em `server/src/lcu/champ-select.ts`**

Acrescentar ao fim do arquivo:

```ts
export interface TeamMember {
  cellId: number;
  championId: number;
  position: string;
}

export interface MySpells {
  spell1Id: number;
  spell2Id: number;
}

export interface ChampSelectSummary {
  canPick: boolean;
  actionId: number;
  championId: number;
  completed: boolean;
  myTeam: TeamMember[];
  theirTeam: TeamMember[];
  mySpells: MySpells | null;
}

interface RawMember {
  cellId: number;
  championId: number;
  championPickIntent: number;
  assignedPosition: string;
  spell1Id: number;
  spell2Id: number;
}

/**
 * Resume a sessão de seleção para o app: estado do pick + os dois times + os
 * meus feitiços. No meu time mostra o hover (championPickIntent); no inimigo,
 * só o campeão visível (a Riot esconde o hover deles no draft).
 */
export function summarizeChampSelect(session: unknown): ChampSelectSummary {
  const pick = findMyPickAction(session);
  const s = session as {
    localPlayerCellId?: number;
    myTeam?: RawMember[];
    theirTeam?: RawMember[];
  };
  const localCell = typeof s?.localPlayerCellId === "number" ? s.localPlayerCellId : -1;

  const myTeam: TeamMember[] = Array.isArray(s?.myTeam)
    ? s.myTeam.map((m) => ({
        cellId: m.cellId,
        championId: m.championId || m.championPickIntent || 0,
        position: m.assignedPosition || "",
      }))
    : [];

  const theirTeam: TeamMember[] = Array.isArray(s?.theirTeam)
    ? s.theirTeam.map((m) => ({
        cellId: m.cellId,
        championId: m.championId || 0,
        position: m.assignedPosition || "",
      }))
    : [];

  const me = Array.isArray(s?.myTeam)
    ? s.myTeam.find((m) => m.cellId === localCell)
    : undefined;
  const mySpells: MySpells | null = me
    ? { spell1Id: me.spell1Id, spell2Id: me.spell2Id }
    : null;

  return {
    canPick: pick ? !pick.completed : false,
    actionId: pick?.actionId ?? 0,
    championId: pick?.championId ?? 0,
    completed: pick?.completed ?? false,
    myTeam,
    theirTeam,
    mySpells,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/champ-select.test.ts`
Expected: PASS (todos, incluindo os 3 novos).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/champ-select.ts server/src/lcu/champ-select.test.ts
git commit -m "feat(server): summarizeChampSelect (times + feiticos + pick)"
```

---

### Task 2: Helpers de feitiços de invocador (`summoner-spells`)

**Files:**
- Create: `server/src/lcu/summoner-spells.ts`
- Test: `server/src/lcu/summoner-spells.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance` (axios).
- Produces:
  - `interface SummonerSpell { id: number; name: string }`
  - `getSummonerSpells(client): Promise<SummonerSpell[]>`
  - `setSummonerSpells(client, spell1Id: number, spell2Id: number): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/summoner-spells.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getSummonerSpells, setSummonerSpells } from "./summoner-spells";

describe("getSummonerSpells", () => {
  it("filtra os feitiços da Summoner's Rift (CLASSIC, id>0) e mapeia {id,name}", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 4, name: "Flash", gameModes: ["CLASSIC", "ARAM"] },
          { id: 32, name: "Marcar", gameModes: ["ARAM"] },
          { id: 0, name: "", gameModes: ["CLASSIC"] },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getSummonerSpells(client)).toEqual([{ id: 4, name: "Flash" }]);
    expect(client.get).toHaveBeenCalledWith("/lol-game-data/v1/summoner-spells");
  });
});

describe("setSummonerSpells", () => {
  it("faz PATCH em my-selection com os dois feitiços", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await setSummonerSpells(client, 4, 14);
    expect(client.patch).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/my-selection",
      { spell1Id: 4, spell2Id: 14 }
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/summoner-spells.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/lcu/summoner-spells.ts`**

```ts
import { AxiosInstance } from "axios";

export interface SummonerSpell {
  id: number;
  name: string;
}

/** Feitiços utilizáveis na Summoner's Rift (mapa clássico). */
export async function getSummonerSpells(
  client: AxiosInstance
): Promise<SummonerSpell[]> {
  const { data } = await client.get("/lol-game-data/v1/summoner-spells");
  return (data as { id: number; name: string; gameModes?: string[] }[])
    .filter(
      (s) => s.id > 0 && Array.isArray(s.gameModes) && s.gameModes.includes("CLASSIC")
    )
    .map((s) => ({ id: s.id, name: s.name }));
}

/** Troca os feitiços de invocador do jogador (slots D e F). */
export async function setSummonerSpells(
  client: AxiosInstance,
  spell1Id: number,
  spell2Id: number
): Promise<void> {
  await client.patch("/lol-champ-select/v1/session/my-selection", {
    spell1Id,
    spell2Id,
  });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/summoner-spells.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/summoner-spells.ts server/src/lcu/summoner-spells.test.ts
git commit -m "feat(server): helpers de feiticos (listar SR + trocar)"
```

---

### Task 3: Rotas — champ-select enriquecido + feitiços + proxy de ícone

**Files:**
- Modify: `server/src/routes/champ-select.ts`

**Interfaces:**
- Consumes: `summarizeChampSelect` (Task 1); `getSummonerSpells`/`setSummonerSpells` (Task 2); `connectToLcu`, `getSession`, `lcuError` (já existem).
- Produces: `GET /champ-select` (enriquecido), `GET /summoner-spells`, `GET /spell-icon/:id`, `POST /champ-select/spells`.

- [ ] **Step 1: Ajustar imports e a rota `GET /champ-select` em `server/src/routes/champ-select.ts`**

No import do topo, trocar para incluir `summarizeChampSelect`:

```ts
import {
  getSession,
  findMyPickAction,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
  summarizeChampSelect,
} from "../lcu/champ-select";
import { getSummonerSpells, setSummonerSpells } from "../lcu/summoner-spells";
```

Substituir a rota `GET /champ-select` inteira por:

```ts
/** Estado da seleção: pick + times + feitiços (ou vazio fora dela). */
champSelectRouter.get("/champ-select", async (_req, res) => {
  const empty = { canPick: false, myTeam: [], theirTeam: [], mySpells: null };
  const client = connectToLcu();
  if (!client) return res.json(empty);
  try {
    res.json(summarizeChampSelect(await getSession(client)));
  } catch {
    res.json(empty);
  }
});
```

- [ ] **Step 2: Adicionar as rotas de feitiços em `server/src/routes/champ-select.ts`**

Acrescentar (depois da rota de lock, antes do fim do arquivo):

```ts
/** Feitiços de invocador disponíveis (Summoner's Rift). */
champSelectRouter.get("/summoner-spells", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getSummonerSpells(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar feitiços", detail: lcuError(err) });
  }
});

/** Proxy do ícone do feitiço (acha o iconPath e repassa o PNG). */
champSelectRouter.get("/spell-icon/:id", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).end();
  try {
    const { data: spell } = await client.get(
      `/lol-game-data/v1/summoner-spells/${req.params.id}.json`
    );
    const iconPath = (spell as { iconPath?: string }).iconPath;
    if (!iconPath) return res.status(404).end();
    const { data } = await client.get(iconPath, { responseType: "arraybuffer" });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(data as ArrayBuffer));
  } catch {
    res.status(404).end();
  }
});

/** Troca os feitiços de invocador (slots D e F). */
champSelectRouter.post("/champ-select/spells", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    await setSummonerSpells(
      client,
      Number(req.body?.spell1Id),
      Number(req.body?.spell2Id)
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível trocar o feitiço", detail: lcuError(err) });
  }
});
```

- [ ] **Step 3: Typecheck + suíte completa**

Run (em `server/`): `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes verdes.

- [ ] **Step 4: Verificar manualmente (com o LoL aberto)**

Run (em `server/`): `npm run dev`. Em outro terminal:
- `curl http://localhost:3000/api/summoner-spells | head -c 200` → JSON com `{"id":..,"name":".."}` (Flash, etc.).
- `curl -s -o /tmp/spell.png -w "%{content_type} %{size_download}\n" http://localhost:3000/api/spell-icon/4` → `image/png` e tamanho > 0.
- `curl http://localhost:3000/api/champ-select` → fora da seleção: `{"canPick":false,"myTeam":[],"theirTeam":[],"mySpells":null}`.

Expected: as respostas acima. (Times cheios e troca de feitiço reais são validados na Task 4, numa seleção.)

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/champ-select.ts
git commit -m "feat(server): champ-select com times + rotas de feiticos + proxy de icone"
```

---

### Task 4: App — seções Times e Feitiços na Seleção

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/champ-select.tsx`
- Modify: `web/src/App.css`

**Interfaces:**
- Consumes: as rotas da Task 3.
- Produces: tipos e funções novas em `api.ts`; seções Times e Feitiços em `champ-select.tsx`.

> **Nota de design:** aplicar a skill `frontend-design` para caprichar as seções novas no
> tema do LoL (ícones com borda dourada, slots D/F com a letra dourada). O código abaixo é a
> base funcional — refine a estética sem mudar comportamento nem contratos.

- [ ] **Step 1: Estender `web/src/api.ts`**

Trocar a interface `PickState` e acrescentar os tipos/funções de feitiço. Substituir a
`interface PickState` existente por:

```ts
export interface TeamMember {
  cellId: number;
  championId: number;
  position: string;
}

export interface PickState {
  actionId?: number;
  championId?: number;
  completed?: boolean;
  canPick: boolean;
  myTeam?: TeamMember[];
  theirTeam?: TeamMember[];
  mySpells?: { spell1Id: number; spell2Id: number } | null;
}

export interface SummonerSpell {
  id: number;
  name: string;
}
```

E acrescentar ao fim do arquivo:

```ts
/** URL do ícone do feitiço (proxy no servidor). */
export function spellIconUrl(id: number): string {
  return `${baseUrl}/api/spell-icon/${id}`;
}

export async function getSummonerSpells(): Promise<SummonerSpell[]> {
  const res = await fetch(`${baseUrl}/api/summoner-spells`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function setSpells(spell1Id: number, spell2Id: number): Promise<void> {
  return postJson("/api/champ-select/spells", { spell1Id, spell2Id });
}
```

- [ ] **Step 2: Adicionar as seções Times e Feitiços em `web/src/champ-select.tsx`**

Atualizar os imports do topo:

```tsx
import { useEffect, useMemo, useState } from "react";
import { App as AntApp, Input, Spin } from "antd";
import {
  getChampions,
  getChampSelect,
  hoverChampion,
  lockChampion,
  getRunePages,
  setRunePage,
  championIconUrl,
  getSummonerSpells,
  setSpells,
  spellIconUrl,
  type Champion,
  type RunePage,
  type TeamMember,
  type SummonerSpell,
} from "./api";
```

Dentro do componente `ChampSelectScreen`, acrescentar estado e efeitos (depois dos states existentes):

```tsx
  const [myTeam, setMyTeam] = useState<TeamMember[]>([]);
  const [theirTeam, setTheirTeam] = useState<TeamMember[]>([]);
  const [spells, setSpells2] = useState<{ spell1Id: number; spell2Id: number } | null>(null);
  const [spellList, setSpellList] = useState<SummonerSpell[]>([]);
  const [editingSlot, setEditingSlot] = useState<1 | 2 | null>(null);
```

No `useEffect` do poll (o que chama `getChampSelect`), dentro do `try`, depois do `setCompleted(...)`, acrescentar:

```tsx
        setMyTeam(st.myTeam ?? []);
        setTheirTeam(st.theirTeam ?? []);
        setSpells2(st.mySpells ?? null);
```

Acrescentar um `useEffect` que carrega a lista de feitiços uma vez (perto do que carrega campeões/runas):

```tsx
  useEffect(() => {
    getSummonerSpells()
      .then(setSpellList)
      .catch(() => {});
  }, []);
```

Adicionar o handler de troca de feitiço (perto dos outros handlers):

```tsx
  async function onPickSpell(spellId: number) {
    if (!spells || editingSlot == null) return;
    const next =
      editingSlot === 1
        ? { spell1Id: spellId, spell2Id: spells.spell2Id }
        : { spell1Id: spells.spell1Id, spell2Id: spellId };
    setSpells2(next); // otimista
    setEditingSlot(null);
    try {
      await setSpells(next.spell1Id, next.spell2Id);
      message.success("Feitiço trocado");
    } catch (err) {
      message.error((err as Error).message);
    }
  }
```

No JSX, logo **depois** do `<h1 className="headline">Seleção</h1>`, inserir a seção **Times**:

```tsx
      <div className="cs-teams">
        <TeamRow label="Seu time" members={myTeam} />
        <TeamRow label="Inimigo" members={theirTeam} />
      </div>
```

E logo **antes** do `<div className="divider" />` que precede as Runas, inserir a seção **Feitiços**:

```tsx
      {spells && spellList.length > 0 && (
        <div className="cs-spells">
          <p className="cs-runes-label">Feitiços</p>
          <div className="cs-spell-slots">
            <button type="button" className="cs-spell-slot" onClick={() => setEditingSlot(1)}>
              <span className="cs-key">D</span>
              <img className="cs-spell-icon" src={spellIconUrl(spells.spell1Id)} alt="" />
            </button>
            <button type="button" className="cs-spell-slot" onClick={() => setEditingSlot(2)}>
              <span className="cs-key">F</span>
              <img className="cs-spell-icon" src={spellIconUrl(spells.spell2Id)} alt="" />
            </button>
          </div>
          {editingSlot && (
            <div className="cs-spell-picker">
              {spellList.map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  className="cs-spell-opt"
                  title={sp.name}
                  onClick={() => onPickSpell(sp.id)}
                >
                  <img src={spellIconUrl(sp.id)} alt={sp.name} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
```

E, no fim do arquivo (fora do componente `ChampSelectScreen`), adicionar o componente `TeamRow`:

```tsx
function TeamRow({ label, members }: { label: string; members: TeamMember[] }) {
  return (
    <div className="cs-team">
      <span className="cs-team-label">{label}</span>
      <div className="cs-team-slots">
        {members.map((m) => (
          <div key={m.cellId} className="cs-slot" title={m.position}>
            {m.championId > 0 ? (
              <img className="cs-slot-icon" src={championIconUrl(m.championId)} alt="" />
            ) : (
              <div className="cs-slot-empty" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Acrescentar as classes em `web/src/App.css`**

Adicionar ao fim do arquivo:

```css
/* Times na Seleção. */
.cs-teams {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-team {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-team-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--muted);
}
.cs-team-slots {
  display: flex;
  gap: 6px;
}
.cs-slot {
  width: 40px;
  height: 40px;
}
.cs-slot-icon {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--gold-dark);
}
.cs-slot-empty {
  width: 40px;
  height: 40px;
  border: 1px dashed rgba(160, 155, 140, 0.3);
  border-radius: 3px;
}

/* Feitiços D/F. */
.cs-spells {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-spell-slots {
  display: flex;
  gap: 12px;
}
.cs-spell-slot {
  position: relative;
  width: 52px;
  height: 52px;
  background: rgba(10, 20, 40, 0.5);
  border: 1px solid var(--gold-dark);
  cursor: pointer;
  padding: 0;
}
.cs-spell-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.cs-key {
  position: absolute;
  top: -8px;
  left: -8px;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #05141c;
  background: var(--gold);
  border-radius: 3px;
}
.cs-spell-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--gold-dark);
  background: rgba(1, 10, 19, 0.6);
}
.cs-spell-opt {
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
}
.cs-spell-opt img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 3px;
}
.cs-spell-opt:hover {
  border-color: var(--gold);
}
```

- [ ] **Step 4: Typecheck + build do app**

Run (em `web/`): `npm run build`
Expected: `tsc -b` sem erros e o `vite build` conclui.

- [ ] **Step 5: Verificação visual (screenshots com mock)**

Apontar o app para um mock em `:3000` que responde, além do que já existe:
- `GET /api/champ-select` → `{"canPick":true,"championId":157,"completed":false,`
  `"myTeam":[{"cellId":0,"championId":64,"position":"top"},{"cellId":1,"championId":103,"position":"jungle"}],`
  `"theirTeam":[{"cellId":5,"championId":157,"position":"middle"},{"cellId":6,"championId":0,"position":""}],`
  `"mySpells":{"spell1Id":4,"spell2Id":6}}`
- `GET /api/summoner-spells` → `[{"id":4,"name":"Flash"},{"id":14,"name":"Ignição"},{"id":12,"name":"Teleporte"},{"id":7,"name":"Cura"}]`
- `GET /api/spell-icon/:id` → um PNG placeholder.

Buildar, servir o `dist/`, abrir e tirar print: as fileiras **Seu time / Inimigo** com ícones
(e slot vazio no inimigo sem champ) e os **slots D/F**; tocar num slot abre o seletor de
feitiços. Conferir layout e tema.

- [ ] **Step 6: Verificação ponta a ponta (com o LoL aberto)**

1. `server/`: `npm run dev`. `web/`: `npm run dev`. Entrar numa **seleção** (jogo personalizado).
2. Ver o **Seu time** preencher conforme você escolhe (hover aparece na hora).
3. Trocar um **feitiço** (tocar no slot D ou F, escolher outro) → ver mudar no cliente e o
   toast "Feitiço trocado".

Expected: times aparecem e a troca de feitiço funciona pelo celular.

- [ ] **Step 7: Commit**

```bash
git add web/src/api.ts web/src/champ-select.tsx web/src/App.css
git commit -m "feat(web): Selecao mostra os times e troca feiticos (D/F)"
```

---

## Self-Review (feita)

- **Cobertura do spec:**
  - Ver campeões do meu time (com hover) e do inimigo (visível) → Task 1 (`summarizeChampSelect`), Task 4 (Times). ✅
  - Trocar feitiços nos slots D/F → Task 2 (helpers), Task 3 (rotas), Task 4 (UI). ✅
  - Dados dos times pelo mesmo `GET /api/champ-select` (poll 1,5s) → Tasks 1, 3, 4. ✅
  - Proxy de ícone de feitiço → Task 3. ✅
  - Erros (inimigo escondido, feitiços indisponíveis, troca fora da hora) → Tasks 3, 4. ✅
  - Testes (`summarizeChampSelect`, helpers de feitiço) + manual/screenshots → Tasks 1, 2, 4. ✅
- **Placeholders:** nenhum "TBD/TODO"; todo passo com código/comando completo. ✅
- **Consistência de tipos:** `TeamMember`/`MySpells`/`ChampSelectSummary` (Task 1) alimentam a rota `/champ-select` (Task 3) e batem com `TeamMember`/`PickState` no app (Task 4); `SummonerSpell` (Task 2) bate com `/summoner-spells` (Task 3) e o app (Task 4); `setSummonerSpells` (Task 2) usado por `/champ-select/spells` (Task 3) e `setSpells` (Task 4). ✅
