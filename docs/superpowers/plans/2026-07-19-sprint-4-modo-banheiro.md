# Sprint 4 — Modo Banheiro (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na seleção de campeões, escolher e travar um campeão e aplicar uma página de runas direto do celular — fechando o MVP.

**Architecture:** Helpers da LCU (`champ-select.ts`, `perks.ts`) com uma função pura `findMyPickAction` no centro; rotas REST finas (`champ-select`, `runes`) que o servidor traduz para a LCU, mais um proxy de ícone. O app troca o placeholder da Sprint 3 por uma tela real de Seleção (grid de campeões com foto, busca, TRAVAR e chips de runas), dirigida por REST com um poll leve.

**Tech Stack:** Servidor: Node, TypeScript, Express, axios, vitest (sem deps novas). Web: React, Vite, TypeScript, antd.

## Global Constraints

- Código do servidor em `server/`; app em `web/`. TS `strict: true` nos dois.
- Servidor CommonJS (imports sem extensão); web ESM.
- Nomes/código em inglês; comentários e docs em português.
- Nunca logar o token completo.
- Escolher campeão é **dois passos**: hover (`PATCH .../actions/{id}` com `{championId}`) e travar (`POST .../actions/{id}/complete`).
- Runas: só **aplicar** páginas salvas (`GET /lol-perks/v1/pages`, `PUT /lol-perks/v1/currentpage`). Sem editor.
- Ícone de campeão via **proxy** (`GET /api/champion-icon/:id`, `Content-Type: image/png`).
- `GET /api/champ-select` fora da seleção responde `{ canPick: false }` (sem erro).
- Poll do estado de pick no app: **1500 ms**, só enquanto a fase é `ChampSelect`.
- Documentação faz parte da entrega: `docs/sprints/sprint-4.md` e README ao fim (MVP completo).

---

## File Structure

```
server/src/
├── lcu/
│   ├── champ-select.ts          → findMyPickAction (pura), getSession, hover, lock, campeões
│   ├── champ-select.test.ts
│   ├── perks.ts                 → getRunePages, setCurrentRunePage
│   └── perks.test.ts
├── routes/
│   ├── champ-select.ts          → /champions, /champion-icon/:id, /champ-select, /hover, /lock
│   └── runes.ts                 → /rune-pages, /rune-pages/current
└── index.ts                     → monta as rotas novas

web/src/
├── api.ts                       → + champions/icon/champSelect/hover/lock/runePages/setRune
├── champ-select.tsx             → tela de Seleção (grid + busca + TRAVAR + runas)
├── screens.tsx                  → usa ChampSelectScreen na fase ChampSelect
└── App.css                      → classes da tela de Seleção
```

---

### Task 1: Helpers de champ-select na LCU (`findMyPickAction` + wrappers)

**Files:**
- Create: `server/src/lcu/champ-select.ts`
- Test: `server/src/lcu/champ-select.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance` (axios).
- Produces:
  - `interface PickInfo { actionId: number; championId: number; completed: boolean }`
  - `interface Champion { id: number; name: string }`
  - `findMyPickAction(session: unknown): PickInfo | null` (pura)
  - `getSession(client): Promise<unknown>`
  - `hoverChampion(client, actionId: number, championId: number): Promise<void>`
  - `lockChampion(client, actionId: number): Promise<void>`
  - `getOwnedChampions(client): Promise<Champion[]>`

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/champ-select.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import {
  findMyPickAction,
  getSession,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
} from "./champ-select";

const session = {
  localPlayerCellId: 2,
  actions: [
    [{ id: 10, actorCellId: 1, championId: 0, completed: false, type: "pick" }],
    [{ id: 11, actorCellId: 2, championId: 64, completed: false, type: "pick" }],
  ],
};

describe("findMyPickAction", () => {
  it("acha a ação de pick do meu cell", () => {
    expect(findMyPickAction(session)).toEqual({
      actionId: 11,
      championId: 64,
      completed: false,
    });
  });

  it("retorna null quando não há sessão válida", () => {
    expect(findMyPickAction(null)).toBeNull();
    expect(findMyPickAction({})).toBeNull();
    expect(findMyPickAction({ localPlayerCellId: 9, actions: [] })).toBeNull();
  });
});

describe("wrappers da LCU", () => {
  it("getSession faz GET na sessão de champ-select", async () => {
    const client = { get: vi.fn().mockResolvedValue({ data: session }) } as unknown as AxiosInstance;
    expect(await getSession(client)).toEqual(session);
    expect(client.get).toHaveBeenCalledWith("/lol-champ-select/v1/session");
  });

  it("hoverChampion faz PATCH na ação com o championId", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await hoverChampion(client, 11, 64);
    expect(client.patch).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/actions/11",
      { championId: 64 }
    );
  });

  it("lockChampion faz POST no complete da ação", async () => {
    const client = { post: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await lockChampion(client, 11);
    expect(client.post).toHaveBeenCalledWith(
      "/lol-champ-select/v1/session/actions/11/complete"
    );
  });

  it("getOwnedChampions devolve {id,name}", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [{ id: 64, name: "Lee Sin", alias: "LeeSin" }],
      }),
    } as unknown as AxiosInstance;
    expect(await getOwnedChampions(client)).toEqual([{ id: 64, name: "Lee Sin" }]);
    expect(client.get).toHaveBeenCalledWith("/lol-champions/v1/owned-champions-minimal");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (em `server/`): `npx vitest run src/lcu/champ-select.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/lcu/champ-select.ts`**

```ts
import { AxiosInstance } from "axios";

interface ChampSelectAction {
  id: number;
  actorCellId: number;
  championId: number;
  completed: boolean;
  type: string;
}

export interface PickInfo {
  actionId: number;
  championId: number;
  completed: boolean;
}

export interface Champion {
  id: number;
  name: string;
}

/**
 * Acha a sua ação de pick na sessão de seleção, pelo localPlayerCellId.
 * Retorna null se não houver sessão válida ou ação de pick sua.
 */
export function findMyPickAction(session: unknown): PickInfo | null {
  const s = session as {
    localPlayerCellId?: number;
    actions?: ChampSelectAction[][];
  };
  if (!s || typeof s.localPlayerCellId !== "number" || !Array.isArray(s.actions)) {
    return null;
  }
  for (const group of s.actions) {
    for (const action of group) {
      if (action.actorCellId === s.localPlayerCellId && action.type === "pick") {
        return {
          actionId: action.id,
          championId: action.championId,
          completed: action.completed,
        };
      }
    }
  }
  return null;
}

export async function getSession(client: AxiosInstance): Promise<unknown> {
  const { data } = await client.get("/lol-champ-select/v1/session");
  return data;
}

/** Seleciona (hover) um campeão na sua ação de pick. */
export async function hoverChampion(
  client: AxiosInstance,
  actionId: number,
  championId: number
): Promise<void> {
  await client.patch(`/lol-champ-select/v1/session/actions/${actionId}`, {
    championId,
  });
}

/** Trava (lock in) o campeão selecionado na sua ação de pick. */
export async function lockChampion(
  client: AxiosInstance,
  actionId: number
): Promise<void> {
  await client.post(`/lol-champ-select/v1/session/actions/${actionId}/complete`);
}

export async function getOwnedChampions(
  client: AxiosInstance
): Promise<Champion[]> {
  const { data } = await client.get("/lol-champions/v1/owned-champions-minimal");
  return (data as { id: number; name: string }[]).map((c) => ({
    id: c.id,
    name: c.name,
  }));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/champ-select.test.ts`
Expected: PASS (6 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/champ-select.ts server/src/lcu/champ-select.test.ts
git commit -m "feat(server): helpers de champ-select (findMyPickAction + hover/lock/campeoes)"
```

---

### Task 2: Helpers de runas na LCU (`perks`)

**Files:**
- Create: `server/src/lcu/perks.ts`
- Test: `server/src/lcu/perks.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance` (axios).
- Produces:
  - `interface RunePage { id: number; name: string; current: boolean }`
  - `getRunePages(client): Promise<RunePage[]>`
  - `setCurrentRunePage(client, id: number): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/perks.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getRunePages, setCurrentRunePage } from "./perks";

describe("getRunePages", () => {
  it("devolve {id,name,current} das páginas", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 1, name: "Eletrocutar", current: true, isEditable: true },
          { id: 2, name: "Conqueror", current: false, isEditable: true },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getRunePages(client)).toEqual([
      { id: 1, name: "Eletrocutar", current: true },
      { id: 2, name: "Conqueror", current: false },
    ]);
    expect(client.get).toHaveBeenCalledWith("/lol-perks/v1/pages");
  });
});

describe("setCurrentRunePage", () => {
  it("faz PUT na currentpage com o id", async () => {
    const client = { put: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await setCurrentRunePage(client, 2);
    expect(client.put).toHaveBeenCalledWith("/lol-perks/v1/currentpage", 2);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/perks.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/lcu/perks.ts`**

```ts
import { AxiosInstance } from "axios";

export interface RunePage {
  id: number;
  name: string;
  current: boolean;
}

export async function getRunePages(client: AxiosInstance): Promise<RunePage[]> {
  const { data } = await client.get("/lol-perks/v1/pages");
  return (data as { id: number; name: string; current: boolean }[]).map((p) => ({
    id: p.id,
    name: p.name,
    current: p.current,
  }));
}

/** Deixa a página de runas com esse id como a página ativa. */
export async function setCurrentRunePage(
  client: AxiosInstance,
  id: number
): Promise<void> {
  await client.put("/lol-perks/v1/currentpage", id);
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/perks.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/perks.ts server/src/lcu/perks.test.ts
git commit -m "feat(server): helpers de runas (listar paginas + aplicar)"
```

---

### Task 3: Rotas de champ-select e runas + proxy de ícone + wire

**Files:**
- Create: `server/src/routes/champ-select.ts`
- Create: `server/src/routes/runes.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `connectToLcu` (Sprint 2), helpers das Tasks 1 e 2.
- Produces: `champSelectRouter`, `runesRouter` montados em `/api`.

- [ ] **Step 1: Implementar `server/src/routes/champ-select.ts`**

```ts
import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import {
  getSession,
  findMyPickAction,
  hoverChampion,
  lockChampion,
  getOwnedChampions,
} from "../lcu/champ-select";

export const champSelectRouter = Router();

/** Campeões que o jogador possui. */
champSelectRouter.get("/champions", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getOwnedChampions(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar campeões", detail: String(err) });
  }
});

/** Proxy do ícone do campeão (busca na LCU, repassa o PNG). */
champSelectRouter.get("/champion-icon/:id", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).end();
  try {
    const { data } = await client.get(
      `/lol-game-data/assets/v1/champion-icons/${req.params.id}.png`,
      { responseType: "arraybuffer" }
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(data as ArrayBuffer));
  } catch {
    res.status(404).end();
  }
});

/** Estado do seu pick na seleção (ou canPick:false fora dela). */
champSelectRouter.get("/champ-select", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.json({ canPick: false });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.json({ canPick: false });
    res.json({ ...pick, canPick: !pick.completed });
  } catch {
    res.json({ canPick: false });
  }
});

/** Seleciona (hover) um campeão. */
champSelectRouter.post("/champ-select/hover", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.status(409).json({ error: "Você não está escolhendo agora" });
    await hoverChampion(client, pick.actionId, Number(req.body?.championId));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao selecionar", detail: String(err) });
  }
});

/** Trava o campeão selecionado. */
champSelectRouter.post("/champ-select/lock", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    const pick = findMyPickAction(await getSession(client));
    if (!pick) return res.status(409).json({ error: "Você não está escolhendo agora" });
    await lockChampion(client, pick.actionId);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Ainda não é sua vez de escolher", detail: String(err) });
  }
});
```

- [ ] **Step 2: Implementar `server/src/routes/runes.ts`**

```ts
import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import { getRunePages, setCurrentRunePage } from "../lcu/perks";

export const runesRouter = Router();

/** Páginas de runas salvas do jogador. */
runesRouter.get("/rune-pages", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    res.json(await getRunePages(client));
  } catch (err) {
    res.status(502).json({ error: "Falha ao listar runas", detail: String(err) });
  }
});

/** Aplica (deixa ativa) uma página de runas. */
runesRouter.post("/rune-pages/current", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    await setCurrentRunePage(client, Number(req.body?.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao aplicar runa", detail: String(err) });
  }
});
```

- [ ] **Step 3: Montar as rotas no `server/src/index.ts`**

Adicionar os imports e os `app.use`. O arquivo fica:

```ts
import express from "express";
import cors from "cors";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";
import { eventsRouter } from "./routes/events";
import { champSelectRouter } from "./routes/champ-select";
import { runesRouter } from "./routes/runes";
import { startGameflowWatcher } from "./lcu/events";

const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", summonerRouter);
app.use("/api", actionsRouter);
app.use("/api", eventsRouter);
app.use("/api", champSelectRouter);
app.use("/api", runesRouter);

// 0.0.0.0 permite acesso pelo celular na rede local (não só localhost).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
  startGameflowWatcher();
});
```

- [ ] **Step 4: Typecheck + suíte completa**

Run (em `server/`): `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes verdes.

- [ ] **Step 5: Verificar as rotas manualmente (com o LoL aberto, fora da seleção)**

Run (em `server/`): `npm run dev`. Em outro terminal:
- `curl http://localhost:3000/api/champions | head -c 200` → JSON com vários `{"id":..,"name":".."}`.
- `curl http://localhost:3000/api/rune-pages` → JSON com suas páginas `{"id","name","current"}`.
- `curl http://localhost:3000/api/champ-select` → `{"canPick":false}` (fora da seleção).
- `curl -s -o /tmp/icon.png -w "%{content_type} %{size_download}\n" http://localhost:3000/api/champion-icon/64` → `image/png` e um tamanho > 0.

Expected: as respostas acima. (O hover/lock reais são testados na Task 4, numa seleção.)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/champ-select.ts server/src/routes/runes.ts server/src/index.ts
git commit -m "feat(server): rotas de champ-select e runas + proxy de icone"
```

---

### Task 4: Tela de Seleção real no app (grid + busca + TRAVAR + runas)

**Files:**
- Modify: `web/src/api.ts`
- Create: `web/src/champ-select.tsx`
- Modify: `web/src/screens.tsx`
- Modify: `web/src/App.css`

**Interfaces:**
- Consumes: as rotas da Task 3.
- Produces: funções de API novas; `ChampSelectScreen`; `screens.tsx` usa a tela na fase `ChampSelect`.

> **Nota de design:** usar a skill `frontend-design` para caprichar o visual (tema do LoL:
> grid escuro, borda dourada no selecionado, botão TRAVAR dourado, chips de runa). O código
> abaixo é a base funcional — refine a estética sem mudar o comportamento nem os contratos.

- [ ] **Step 1: Acrescentar as funções em `web/src/api.ts`**

Adicionar ao fim do arquivo:

```ts
export interface Champion {
  id: number;
  name: string;
}

export interface RunePage {
  id: number;
  name: string;
  current: boolean;
}

export interface PickState {
  actionId?: number;
  championId?: number;
  completed?: boolean;
  canPick: boolean;
}

/** URL do ícone do campeão (proxy no servidor). */
export function championIconUrl(id: number): string {
  return `${baseUrl}/api/champion-icon/${id}`;
}

export async function getChampions(): Promise<Champion[]> {
  const res = await fetch(`${baseUrl}/api/champions`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export async function getChampSelect(): Promise<PickState> {
  const res = await fetch(`${baseUrl}/api/champ-select`);
  return res.json();
}

async function postJson(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Erro ${res.status}`);
  }
}

export function hoverChampion(championId: number): Promise<void> {
  return postJson("/api/champ-select/hover", { championId });
}

export function lockChampion(): Promise<void> {
  return postJson("/api/champ-select/lock");
}

export async function getRunePages(): Promise<RunePage[]> {
  const res = await fetch(`${baseUrl}/api/rune-pages`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export function setRunePage(id: number): Promise<void> {
  return postJson("/api/rune-pages/current", { id });
}
```

- [ ] **Step 2: Criar `web/src/champ-select.tsx`**

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
  type Champion,
  type RunePage,
} from "./api";

export function ChampSelectScreen() {
  const { message } = AntApp.useApp();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [pages, setPages] = useState<RunePage[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [locking, setLocking] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carrega campeões + páginas de runas uma vez.
  useEffect(() => {
    Promise.all([getChampions(), getRunePages()])
      .then(([c, p]) => {
        setChampions(c);
        setPages(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll leve do estado de pick (mantém o TRAVAR correto).
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const st = await getChampSelect();
        if (!alive) return;
        setCompleted(Boolean(st.completed));
        if (st.championId) setSelected((prev) => prev ?? st.championId!);
      } catch {
        /* ignora */
      }
    }
    poll();
    const id = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? champions.filter((c) => c.name.toLowerCase().includes(q))
      : champions;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [champions, query]);

  async function onPick(champ: Champion) {
    setSelected(champ.id);
    try {
      await hoverChampion(champ.id);
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  async function onLock() {
    setLocking(true);
    try {
      await lockChampion();
      message.success("Campeão travado!");
    } catch (err) {
      message.error((err as Error).message);
    } finally {
      setLocking(false);
    }
  }

  async function onRune(page: RunePage) {
    try {
      await setRunePage(page.id);
      setPages((ps) => ps.map((p) => ({ ...p, current: p.id === page.id })));
      message.success("Runa aplicada");
    } catch (err) {
      message.error((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="cs-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="cs">
      <h1 className="headline">Seleção</h1>

      <Input
        className="cs-search"
        placeholder="Buscar campeão…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        allowClear
      />

      <div className="cs-grid">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`cs-champ ${selected === c.id ? "sel" : ""}`}
            onClick={() => onPick(c)}
            disabled={completed}
            title={c.name}
          >
            <img
              className="cs-icon"
              src={championIconUrl(c.id)}
              alt=""
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <span className="cs-name">{c.name}</span>
          </button>
        ))}
      </div>

      <button
        className="accept cs-lock"
        type="button"
        onClick={onLock}
        disabled={selected == null || completed || locking}
      >
        {completed ? "Travado" : locking ? "Travando…" : "Travar"}
      </button>

      <div className="divider" />

      <p className="cs-runes-label">Runas</p>
      {pages.length === 0 ? (
        <p className="sub">Crie páginas de runas no PC</p>
      ) : (
        <div className="cs-runes">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`cs-page ${p.current ? "cur" : ""}`}
              onClick={() => onRune(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Usar a tela na fase `ChampSelect` — `web/src/screens.tsx`**

Trocar o import e o `case "ChampSelect"`. No topo, acrescentar:

```tsx
import { ChampSelectScreen } from "./champ-select";
```

E no `switch` do `CardBody`, trocar o `case "ChampSelect"` para:

```tsx
    case "ChampSelect":
      return <ChampSelectScreen />;
```

Remover a função `SelectBody` (não é mais usada).

- [ ] **Step 4: Acrescentar as classes da Seleção em `web/src/App.css`**

Adicionar ao fim do arquivo:

```css
/* Tela de Seleção (Sprint 4). */
.cs {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}
.cs-loading {
  display: flex;
  justify-content: center;
  padding: 24px;
}
.cs-search {
  width: 100%;
}
.cs-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  max-height: 42vh;
  overflow-y: auto;
  padding: 2px;
}
.cs-champ {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 2px;
  background: rgba(10, 20, 40, 0.5);
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--muted);
}
.cs-champ.sel {
  border-color: var(--gold);
  color: var(--cream);
  box-shadow: 0 0 12px -2px rgba(200, 170, 110, 0.6);
}
.cs-champ:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.cs-icon {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 3px;
}
.cs-name {
  font-size: 10px;
  line-height: 1.1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.cs-lock {
  margin-top: 4px;
}
.cs-runes-label {
  margin: 0;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--gold);
}
.cs-runes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cs-page {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid var(--gold-dark);
  color: var(--cream);
  cursor: pointer;
  font-size: 13px;
}
.cs-page.cur {
  border-color: var(--gold);
  background: rgba(200, 170, 110, 0.14);
  color: var(--gold);
}
```

- [ ] **Step 5: Typecheck + build do app**

Run (em `web/`): `npm run build`
Expected: `tsc -b` sem erros e o `vite build` conclui.

- [ ] **Step 6: Verificação visual (screenshots com dados de mentira)**

Apontar o app para um servidor de mentira em `:3000` que responde:
- `GET /api/events` → `data: {"phase":"ChampSelect","summoner":{...}}\n\n`
- `GET /api/champions` → alguns `{id,name}`
- `GET /api/champion-icon/:id` → um PNG placeholder (qualquer PNG válido)
- `GET /api/champ-select` → `{"canPick":true,"championId":0,"completed":false}`
- `GET /api/rune-pages` → algumas páginas `{id,name,current}`
- `GET /api/auto-accept` → `{"enabled":false}`

Buildar (`web/`: `npm run build`), servir o `dist/` (`npx vite preview --port 4173 --host`),
subir o mock, abrir `http://localhost:4173` e tirar um print da tela de Seleção (grid com
ícones, um campeão selecionado com borda dourada, o botão TRAVAR e os chips de runas).
Conferir que o layout e o tema estão certos.

- [ ] **Step 7: Verificação ponta a ponta (com o LoL aberto)**

1. `server/`: `npm run dev`. 2. `web/`: `npm run dev`.
2. Entrar numa fila e chegar na **seleção de campeões**. No celular/PC, a tela deve mostrar o
   grid; **buscar** um campeão, **tocar** (seleciona) e **TRAVAR** (trava na partida);
   **tocar numa página de runas** e ver "Runa aplicada" (a página vira a ativa no cliente).

Expected: escolher, travar e aplicar runa funcionam pelo celular.

- [ ] **Step 8: Commit**

```bash
git add web/src/api.ts web/src/champ-select.tsx web/src/screens.tsx web/src/App.css
git commit -m "feat(web): tela de Selecao (escolher campeao + aplicar runas)"
```

---

### Task 5: Documentação da sprint + README + suíte final

**Files:**
- Create: `docs/sprints/sprint-4.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: docs da entrega; MVP marcado como completo.

- [ ] **Step 1: Escrever `docs/sprints/sprint-4.md`**

```markdown
# Sprint 4 — Modo Banheiro

## O que foi entregue
Na seleção de campeões, dá para **escolher e travar um campeão** e **aplicar uma página de
runas** direto do celular. Fecha o MVP do "Modo Banheiro".

## Como funciona (fluxo)
1. Na fase `ChampSelect` (que chega por SSE), a tela de Seleção carrega os campeões
   (`/api/champions`) e as páginas de runas (`/api/rune-pages`), com um poll leve (1,5s) de
   `/api/champ-select` para o estado do pick.
2. Tocar num campeão → `POST /api/champ-select/hover` (seleciona); **TRAVAR** →
   `POST /api/champ-select/lock` (`.../actions/{id}/complete` na LCU).
3. Tocar numa página de runas → `POST /api/rune-pages/current` (`PUT /lol-perks/v1/currentpage`).
4. As fotos vêm por proxy (`/api/champion-icon/:id`), então funcionam no Wi-Fi local.

## Como testar
1. Abra o LoL e entre numa fila até a seleção de campeões.
2. `server/`: `npm run dev`. `web/`: `npm run dev`.
3. No celular/PC: busque, selecione e TRAVE um campeão; aplique uma página de runas.
4. Testes do servidor: em `server/`, `npm test`.

## Decisões e aprendizados
- Escolher campeão em dois passos (hover → travar), espelhando o cliente.
- Runas: só aplicar páginas já salvas (sem editor).
- `findMyPickAction` (pura) isola a parte delicada de achar a sua ação na sessão.
- Ícones por proxy no servidor: bonito e offline (Wi-Fi local).
```

- [ ] **Step 2: Atualizar o `README.md`**

Na tabela do Roadmap, marcar a Sprint 4 como entregue:

```markdown
| 4 — Modo Banheiro | Escolher campeão + aplicar runas | ✅ |
```

E logo abaixo da tabela, acrescentar:

```markdown
**MVP completo:** as 4 sprints estão prontas — do celular dá para acompanhar a fila,
aceitar a partida, escolher o campeão e aplicar runas, tudo na rede local.
```

- [ ] **Step 3: Rodar toda a suíte de testes do servidor**

Run (em `server/`): `npm test`
Expected: PASS — inclui `champ-select` e `perks`.

- [ ] **Step 4: Commit**

```bash
git add docs/sprints/sprint-4.md README.md
git commit -m "docs: sprint 4 (modo banheiro) + README (MVP completo)"
```

---

## Self-Review (feita)

- **Cobertura do spec:**
  - Escolher + travar campeão (hover/lock) → Tasks 1, 3 (rotas), 4 (UI). ✅
  - Aplicar página de runas salva → Tasks 2, 3 (rotas), 4 (UI). ✅
  - `findMyPickAction` (pura) → Task 1. ✅
  - Proxy de ícone → Task 3. ✅
  - Grid com foto + busca + TRAVAR + chips de runa → Task 4. ✅
  - Poll leve (1,5s) só na seleção → Task 4. ✅
  - Tratamento de erros (fora da vez, sem runas, ícone ausente, fora da seleção) → Tasks 3, 4. ✅
  - Docs (sprint-4.md + README, MVP completo) → Task 5. ✅
- **Placeholders:** nenhum "TBD/TODO"; todo passo com código/comando completo. ✅
- **Consistência de tipos:** `PickInfo`/`Champion` (Task 1) e `RunePage` (Task 2) alimentam as rotas (Task 3); os contratos (`/champions`, `/champ-select`, `/rune-pages`, hover/lock) batem entre Task 3 (servidor) e Task 4 (`api.ts`: `Champion`, `RunePage`, `PickState`). `findMyPickAction` usada em `/champ-select`, `/hover` e `/lock`. ✅
