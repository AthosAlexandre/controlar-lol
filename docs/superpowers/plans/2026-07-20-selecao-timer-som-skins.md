# Seleção — Timer + Som + Skins (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na tela de Seleção, mostrar o timer da fase (destacando os 10s finais), tocar um som quando fica a sua vez e nos segundos finais, e permitir trocar a skin do campeão.

**Architecture:** O `summarizeChampSelect` passa a incluir `timer` e `isPickPhase` (já vêm no poll de 1,5s). O app conta o timer localmente entre polls e toca sons sintéticos (Web Audio) nas transições. Skins usam novos helpers/rotas na LCU; um probe confirma o formato antes de codar.

**Tech Stack:** Servidor: Node, TypeScript, Express, axios, vitest. Web: React, Vite, TypeScript, antd, Web Audio API (nativo).

## Global Constraints

- Código do servidor em `server/`; app em `web/`. TS `strict: true` nos dois.
- Nomes/código em inglês; comentários/docs em português.
- **Som:** sintético via Web Audio (osciladores) — **não** usar áudio original do LoL.
- Timer suave: o app conta pra baixo localmente a partir de `timeLeftMs` recebido no poll.
- Skins: só as que o jogador **possui**; trocar via `PATCH .../my-selection { selectedSkinId }`.
- Miniatura de skin via **proxy** (padrão dos ícones); a tile é `champion-tiles/{championId}/{skinId}.jpg` com `championId = floor(skinId/1000)`.
- `GET /api/champ-select` fora da seleção responde com `timer: null` e `isPickPhase: false`.
- Poll do estado no app permanece **1500 ms**.
- Visual no tema do LoL (timer destacado, seção de skins) — aplicar `frontend-design` na UI.

---

## File Structure

```
server/src/
├── lcu/
│   ├── champ-select.ts    → summarizeChampSelect ganha `timer` + `isPickPhase`
│   ├── champ-select.test.ts
│   ├── skins.ts           → getOwnedSkins, selectSkin
│   └── skins.test.ts
└── routes/
    └── champ-select.ts    → /champ-select (com timer), /skins, /skin-icon/:id, /skins/select

web/src/
├── api.ts                 → + tipos de timer/skin + getSkins/selectSkin/skinIconUrl
├── sound.ts               → Web Audio: unlockAudio(), playTurn(), playTick()
├── champ-select.tsx       → + timer (contagem local + 10s) + som + seção Skins
└── App.css                → classes do timer e da seção Skins
```

---

### Task 1: `timer` + `isPickPhase` no `summarizeChampSelect`

**Files:**
- Modify: `server/src/lcu/champ-select.ts`
- Modify: `server/src/lcu/champ-select.test.ts`
- Modify: `server/src/routes/champ-select.ts` (objeto `empty`)

**Interfaces:**
- Consumes: `findMyActionByType` (interno, já existe), `session.timer`.
- Produces: `interface ChampTimer { timeLeftMs: number; totalMs: number; phase: string }`;
  `ChampSelectSummary` ganha `timer: ChampTimer | null` e `isPickPhase: boolean`.

- [ ] **Step 1: Adicionar os testes que falham em `server/src/lcu/champ-select.test.ts`**

No topo do `banSession` já existente, garanta um timer no `fullSession`. Adicione um campo
`timer` ao `fullSession` (logo após `theirTeam`):

```ts
// dentro do objeto fullSession, adicionar:
  timer: { adjustedTimeLeftInPhase: 27000, totalTimeInPhase: 30000, phase: "BAN_PICK", isInfinite: false },
```

E acrescente ao fim do arquivo:

```ts
describe("summarizeChampSelect — timer e isPickPhase", () => {
  it("extrai o timer da sessão", () => {
    const s = summarizeChampSelect(fullSession);
    expect(s.timer).toEqual({ timeLeftMs: 27000, totalMs: 30000, phase: "BAN_PICK" });
  });

  it("timer null quando isInfinite", () => {
    const s = summarizeChampSelect({ ...fullSession, timer: { isInfinite: true } });
    expect(s.timer).toBeNull();
  });

  it("isPickPhase true quando a minha ação de pick está em progresso", () => {
    const withActivePick = {
      ...fullSession,
      actions: [[{ id: 0, actorCellId: 0, championId: 0, completed: false, type: "pick", isInProgress: true }]],
    };
    expect(summarizeChampSelect(withActivePick).isPickPhase).toBe(true);
    expect(summarizeChampSelect(fullSession).isPickPhase).toBe(false);
  });
});
```

Atualize também o teste "sessão vazia" para incluir os campos novos: no `toEqual({...})`
acrescente `timer: null,` e `isPickPhase: false,`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run (em `server/`): `npx vitest run src/lcu/champ-select.test.ts`
Expected: FAIL — `timer`/`isPickPhase` não existem no summary.

- [ ] **Step 3: Implementar em `server/src/lcu/champ-select.ts`**

Acrescente a interface (perto de `MySpells`):

```ts
export interface ChampTimer {
  timeLeftMs: number;
  totalMs: number;
  phase: string;
}
```

No `ChampSelectSummary`, acrescente os campos:

```ts
  timer: ChampTimer | null;
  isPickPhase: boolean;
```

Dentro de `summarizeChampSelect`, antes do `return`, calcule:

```ts
  const rawTimer = (session as {
    timer?: { adjustedTimeLeftInPhase?: number; totalTimeInPhase?: number; phase?: string; isInfinite?: boolean };
  }).timer;
  const timer: ChampTimer | null =
    rawTimer && !rawTimer.isInfinite && typeof rawTimer.adjustedTimeLeftInPhase === "number"
      ? {
          timeLeftMs: rawTimer.adjustedTimeLeftInPhase,
          totalMs: rawTimer.totalTimeInPhase ?? 0,
          phase: rawTimer.phase ?? "",
        }
      : null;

  const pickActive = findMyActionByType(session, "pick");
  const isPickPhase = Boolean(pickActive?.isInProgress && !pickActive.completed);
```

E no objeto retornado, acrescente `timer,` e `isPickPhase,`.

- [ ] **Step 4: Atualizar o `empty` em `server/src/routes/champ-select.ts`**

No handler `GET /champ-select`, o objeto `empty` passa a ser:

```ts
  const empty = {
    canPick: false,
    myTeam: [],
    theirTeam: [],
    mySpells: null,
    ban: null,
    isBanPhase: false,
    timer: null,
    isPickPhase: false,
  };
```

- [ ] **Step 5: Rodar testes + typecheck**

Run (em `server/`): `npx vitest run src/lcu/champ-select.test.ts && npx tsc --noEmit`
Expected: PASS + sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add server/src/lcu/champ-select.ts server/src/lcu/champ-select.test.ts server/src/routes/champ-select.ts
git commit -m "feat(server): timer + isPickPhase no summarizeChampSelect"
```

---

### Task 2: App — timer (contagem local + 10s) + som

**Files:**
- Create: `web/src/sound.ts`
- Modify: `web/src/api.ts` (tipos do estado)
- Modify: `web/src/champ-select.tsx`
- Modify: `web/src/App.css`

**Interfaces:**
- Consumes: `GET /api/champ-select` agora com `timer` e `isPickPhase`.
- Produces: `unlockAudio()`, `playTurn()`, `playTick(secondsLeft)`; timer visível + som.

- [ ] **Step 1: Estender os tipos em `web/src/api.ts`**

No `interface PickState`, acrescente:

```ts
  timer?: { timeLeftMs: number; totalMs: number; phase: string } | null;
  isPickPhase?: boolean;
```

- [ ] **Step 2: Criar `web/src/sound.ts` (Web Audio sintético)**

```ts
let ctx: AudioContext | null = null;

/** Cria/religa o áudio no primeiro gesto do usuário (política de autoplay). */
export function unlockAudio(): void {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null; // sem áudio disponível — segue sem som
  }
}

function beep(freq: number, durationMs: number, when = 0, gain = 0.14): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000);
}

/** "Ding" de duas notas quando fica a sua vez. */
export function playTurn(): void {
  beep(880, 120, 0);
  beep(1320, 170, 0.12);
}

/** Bip do timer nos segundos finais (mais agudo nos últimos 3s). */
export function playTick(secondsLeft: number): void {
  beep(secondsLeft <= 3 ? 1245 : 700, 90);
}
```

- [ ] **Step 3: Ligar o timer + som em `web/src/champ-select.tsx`**

No topo, importar:

```tsx
import { unlockAudio, playTurn, playTick } from "./sound";
```

Adicionar estado/refs (junto aos outros states) — note o uso de `useRef`:

```tsx
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<{ timeLeftMs: number; receivedAt: number } | null>(null);
  const prevSecRef = useRef<number | null>(null);
  const prevTurnRef = useRef(false);
```

Garanta que `useRef` está importado do react:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
```

No `useEffect` do poll, dentro do `try` (depois de `setIsBanPhase(...)`), acrescentar:

```tsx
        if (st.timer) {
          timerRef.current = { timeLeftMs: st.timer.timeLeftMs, receivedAt: Date.now() };
        } else {
          timerRef.current = null;
        }
        // som "sua vez": pick OU ban entrou em progresso agora
        const myTurn = Boolean(st.isPickPhase) || Boolean(st.isBanPhase);
        if (myTurn && !prevTurnRef.current) playTurn();
        prevTurnRef.current = myTurn;
```

Adicionar um `useEffect` que roda a contagem local + o tick do som:

```tsx
  // Conta o timer localmente (suave) entre os polls e toca o tick nos 10s finais.
  useEffect(() => {
    const id = setInterval(() => {
      const r = timerRef.current;
      if (!r) {
        setSecondsLeft(null);
        prevSecRef.current = null;
        return;
      }
      const left = Math.max(0, Math.ceil((r.timeLeftMs - (Date.now() - r.receivedAt)) / 1000));
      setSecondsLeft(left);
      if (left <= 10 && left > 0 && left !== prevSecRef.current) playTick(left);
      prevSecRef.current = left;
    }, 250);
    return () => clearInterval(id);
  }, []);

  // Religa o áudio no primeiro toque do usuário (autoplay policy).
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
```

No JSX, logo abaixo do `<h1 ...>Seleção/Banir campeão</h1>`, inserir o timer:

```tsx
      {secondsLeft != null && (
        <div className={`cs-timer ${secondsLeft <= 10 ? "urgent" : ""}`}>{secondsLeft}s</div>
      )}
```

- [ ] **Step 4: Classes do timer em `web/src/App.css`**

Adicionar ao fim:

```css
/* Timer da seleção. */
.cs-timer {
  align-self: center;
  font-family: var(--serif);
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--gold);
}
.cs-timer.urgent {
  color: #e84057;
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.14); opacity: 0.75; }
}
```

- [ ] **Step 5: Typecheck + build do app**

Run (em `web/`): `npm run build`
Expected: `tsc -b` sem erros e o `vite build` conclui.

- [ ] **Step 6: Verificação visual (screenshot com mock) + som (manual)**

Servir o `dist/` com um mock que devolve `timer: { timeLeftMs: 8000, totalMs: 30000, phase: "BAN_PICK" }`
em `/api/champ-select`; tirar um print mostrando o **timer em vermelho/pulsando** (≤10s). O som
é conferido ouvindo na verificação ponta a ponta (Task 6/end).

- [ ] **Step 7: Commit**

```bash
git add web/src/sound.ts web/src/api.ts web/src/champ-select.tsx web/src/App.css
git commit -m "feat(web): timer da selecao (contagem local + 10s) + som sintetico"
```

---

### Task 3: Probe do endpoint de skins + helpers (`lcu/skins.ts`)

**Files:**
- Create: `server/src/lcu/skins.ts`
- Test: `server/src/lcu/skins.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance`.
- Produces: `interface Skin { id: number; name: string }`; `getOwnedSkins(client): Promise<Skin[]>`; `selectSkin(client, skinId: number): Promise<void>`.

- [ ] **Step 1: Probe ao vivo (numa seleção real, com um campeão escolhido)**

Rodar (em `server/`, com o server já iniciado por `npm run dev` e você na seleção com um campeão em hover) um script temporário que dumpa o `skin-carousel-skins`:

```ts
// server/probe.ts (temporário — apague depois)
import { connectToLcu } from "./src/lcu/connect";
(async () => {
  const c = connectToLcu();
  if (!c) return console.log("LoL fechado");
  const skins = (await c.get("/lol-champ-select/v1/skin-carousel-skins")).data as any[];
  console.log("qtd:", skins.length);
  const s = skins[0];
  console.log("keys:", Object.keys(s).join(","));
  console.log("ex:", JSON.stringify({ id: s.id, name: s.name, ownership: s.ownership, disabled: s.disabled }));
  // testa a tile: champion-tiles/{championId}/{skinId}.jpg com championId = floor(skinId/1000)
  const skinId = skins.find((x) => x.ownership?.owned)?.id ?? s.id;
  const champId = Math.floor(skinId / 1000);
  try {
    const img = await c.get(`/lol-game-data/assets/v1/champion-tiles/${champId}/${skinId}.jpg`, { responseType: "arraybuffer" });
    console.log("tile OK", img.status, (img.data as ArrayBuffer).byteLength, "bytes p/ skinId", skinId);
  } catch (e: any) { console.log("tile ERR", e?.response?.status); }
})();
```
Run: `npx tsx probe.ts` (depois `rm -f probe.ts`).
Expected: confere o campo do "possuo" (`ownership.owned`) e que a tile responde 200. Se os
nomes diferirem, ajuste o filtro/caminho no Step 3 conforme o que apareceu.

- [ ] **Step 2: Escrever o teste que falha — `server/src/lcu/skins.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getOwnedSkins, selectSkin } from "./skins";

describe("getOwnedSkins", () => {
  it("devolve só as skins que o jogador possui e não estão desabilitadas", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({
        data: [
          { id: 64000, name: "Lee Sin", ownership: { owned: true }, disabled: false },
          { id: 64001, name: "Lee Sin Aço", ownership: { owned: false }, disabled: false },
          { id: 64002, name: "Lee Sin Dragão", ownership: { owned: true }, disabled: true },
          { id: 64010, name: "Lee Sin God Fist", ownership: { owned: true }, disabled: false },
        ],
      }),
    } as unknown as AxiosInstance;

    expect(await getOwnedSkins(client)).toEqual([
      { id: 64000, name: "Lee Sin" },
      { id: 64010, name: "Lee Sin God Fist" },
    ]);
    expect(client.get).toHaveBeenCalledWith("/lol-champ-select/v1/skin-carousel-skins");
  });
});

describe("selectSkin", () => {
  it("faz PATCH em my-selection com o selectedSkinId", async () => {
    const client = { patch: vi.fn().mockResolvedValue({ data: {} }) } as unknown as AxiosInstance;
    await selectSkin(client, 64010);
    expect(client.patch).toHaveBeenCalledWith("/lol-champ-select/v1/session/my-selection", {
      selectedSkinId: 64010,
    });
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha, depois implementar `server/src/lcu/skins.ts`**

Run: `npx vitest run src/lcu/skins.test.ts` → FAIL. Depois:

```ts
import { AxiosInstance } from "axios";

export interface Skin {
  id: number;
  name: string;
}

interface RawSkin {
  id: number;
  name: string;
  ownership?: { owned?: boolean };
  disabled?: boolean;
}

/** Skins que o jogador possui do campeão escolhido (carrossel da seleção). */
export async function getOwnedSkins(client: AxiosInstance): Promise<Skin[]> {
  const { data } = await client.get("/lol-champ-select/v1/skin-carousel-skins");
  return (data as RawSkin[])
    .filter((s) => s.ownership?.owned && !s.disabled)
    .map((s) => ({ id: s.id, name: s.name }));
}

/** Troca a skin selecionada do campeão. */
export async function selectSkin(client: AxiosInstance, skinId: number): Promise<void> {
  await client.patch("/lol-champ-select/v1/session/my-selection", { selectedSkinId: skinId });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/skins.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/skins.ts server/src/lcu/skins.test.ts
git commit -m "feat(server): helpers de skin (listar as que possuo + trocar)"
```

---

### Task 4: Rotas de skin + proxy da miniatura

**Files:**
- Modify: `server/src/routes/champ-select.ts`

**Interfaces:**
- Consumes: `getOwnedSkins`, `selectSkin` (Task 3); `getSession`, `connectToLcu`, `lcuError`.
- Produces: `GET /skins` (`{ skins, selectedId }`), `GET /skin-icon/:id`, `POST /skins/select`.

- [ ] **Step 1: Import + rotas em `server/src/routes/champ-select.ts`**

Acrescentar o import:

```ts
import { getOwnedSkins, selectSkin } from "../lcu/skins";
```

Acrescentar as rotas (depois das de runas recomendadas):

```ts
/** Skins que você possui do campeão + a skin atual. */
champSelectRouter.get("/skins", async (_req, res) => {
  const client = connectToLcu();
  if (!client) return res.json({ skins: [], selectedId: 0 });
  try {
    const session = await getSession(client);
    const s = session as { localPlayerCellId?: number; myTeam?: { cellId: number; selectedSkinId?: number }[] };
    const me = s.myTeam?.find((m) => m.cellId === s.localPlayerCellId);
    res.json({ skins: await getOwnedSkins(client), selectedId: me?.selectedSkinId ?? 0 });
  } catch {
    res.json({ skins: [], selectedId: 0 });
  }
});

/** Proxy da miniatura da skin (tile). championId = floor(skinId/1000). */
champSelectRouter.get("/skin-icon/:id", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).end();
  try {
    const skinId = Number(req.params.id);
    const championId = Math.floor(skinId / 1000);
    const { data } = await client.get(
      `/lol-game-data/assets/v1/champion-tiles/${championId}/${skinId}.jpg`,
      { responseType: "arraybuffer" }
    );
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.end(Buffer.from(data as ArrayBuffer));
  } catch {
    res.status(404).end();
  }
});

/** Troca a skin do campeão. */
champSelectRouter.post("/skins/select", async (req, res) => {
  const client = connectToLcu();
  if (!client) return res.status(503).json({ error: "LoL não está aberto" });
  try {
    await selectSkin(client, Number(req.body?.skinId));
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Não foi possível trocar a skin", detail: lcuError(err) });
  }
});
```

- [ ] **Step 2: Typecheck + suíte + verificação ao vivo (na seleção, com campeão escolhido)**

Run (em `server/`): `npx tsc --noEmit && npm test` → sem erros, tudo verde.
Com o server rodando e você na seleção:
- `curl http://localhost:3000/api/skins` → `{"skins":[{"id":..,"name":".."}...],"selectedId":..}`
- `curl -s -o /tmp/skin.jpg -w "%{content_type} %{size_download}\n" http://localhost:3000/api/skin-icon/<um-id>` → `image/jpeg` e tamanho > 0.

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/champ-select.ts
git commit -m "feat(server): rotas de skin (listar + trocar + proxy da miniatura)"
```

---

### Task 5: App — seção Skins (com frontend-design)

**Files:**
- Modify: `web/src/api.ts`
- Modify: `web/src/champ-select.tsx`
- Modify: `web/src/App.css`

**Interfaces:**
- Consumes: `GET /api/skins`, `GET /api/skin-icon/:id`, `POST /api/skins/select` (Task 4).
- Produces: seção "Skins" na tela de Seleção.

> **Nota de design:** aplicar `frontend-design` — as skins são visuais (miniatura), então a
> seção deve ficar bonita no tema do LoL (miniaturas com borda; a atual em dourado).

- [ ] **Step 1: Funções/tipos em `web/src/api.ts`**

Acrescentar ao fim:

```ts
export interface Skin {
  id: number;
  name: string;
}

export function skinIconUrl(id: number): string {
  return `${baseUrl}/api/skin-icon/${id}`;
}

export async function getSkins(): Promise<{ skins: Skin[]; selectedId: number }> {
  const res = await fetch(`${baseUrl}/api/skins`);
  if (!res.ok) return { skins: [], selectedId: 0 };
  return res.json();
}

export function selectSkin(skinId: number): Promise<void> {
  return postJson("/api/skins/select", { skinId });
}
```

- [ ] **Step 2: Seção Skins em `web/src/champ-select.tsx`**

Import:

```tsx
import { getSkins, selectSkin, skinIconUrl, type Skin } from "./api";
```

Estado (junto aos outros):

```tsx
  const [skins, setSkins] = useState<Skin[]>([]);
  const [selectedSkin, setSelectedSkin] = useState<number>(0);
```

Carregar as skins quando o campeão selecionado muda (perto do efeito das runas recomendadas):

```tsx
  useEffect(() => {
    if (selected != null && !isBanPhase) {
      getSkins()
        .then((r) => { setSkins(r.skins); setSelectedSkin(r.selectedId); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isBanPhase]);
```

Handler:

```tsx
  async function onSkin(skin: Skin) {
    setSelectedSkin(skin.id); // otimista
    try {
      await selectSkin(skin.id);
      message.success("Skin trocada");
    } catch (err) {
      message.error((err as Error).message);
    }
  }
```

JSX — inserir a seção logo **antes** da seção "Runas recomendadas":

```tsx
      {!isBanPhase && skins.length > 1 && (
        <div className="cs-skins">
          <p className="cs-runes-label">Skins</p>
          <div className="cs-skin-grid">
            {skins.map((sk) => (
              <button
                key={sk.id}
                type="button"
                className={`cs-skin ${selectedSkin === sk.id ? "sel" : ""}`}
                onClick={() => onSkin(sk)}
                title={sk.name}
              >
                <img
                  className="cs-skin-img"
                  src={skinIconUrl(sk.id)}
                  alt=""
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
                <span className="cs-skin-name">{sk.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Classes da seção Skins em `web/src/App.css`**

Adicionar ao fim:

```css
/* Skins na Seleção. */
.cs-skins {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-skin-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-height: 34vh;
  overflow-y: auto;
}
.cs-skin {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0;
  background: rgba(10, 20, 40, 0.5);
  border: 1px solid transparent;
  cursor: pointer;
  color: var(--muted);
  overflow: hidden;
}
.cs-skin.sel {
  border-color: var(--gold);
  color: var(--cream);
  box-shadow: 0 0 12px -2px rgba(200, 170, 110, 0.6);
}
.cs-skin-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
.cs-skin-name {
  font-size: 10px;
  line-height: 1.1;
  padding: 2px 4px 5px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 4: Typecheck + build**

Run (em `web/`): `npm run build`
Expected: sem erros; bundle gerado.

- [ ] **Step 5: Verificação visual (screenshot com mock) + ponta a ponta**

Screenshot com mock que devolve `/api/skins` com algumas skins (e `/api/skin-icon/:id` com um
JPG placeholder), mostrando a seção **Skins** com miniaturas e a atual destacada. E, ao vivo
numa seleção: escolher um campeão → ver as skins → trocar uma e ver mudar no cliente.

- [ ] **Step 6: Commit**

```bash
git add web/src/api.ts web/src/champ-select.tsx web/src/App.css
git commit -m "feat(web): trocar skin na Selecao (miniaturas)"
```

---

### Task 6: Documentação + suíte final

**Files:**
- Create: `docs/features/2026-07-20-selecao-timer-som-skins.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: doc da entrega.

- [ ] **Step 1: Escrever `docs/features/2026-07-20-selecao-timer-som-skins.md`**

```markdown
# Seleção — Timer + Som + Skins

## O que foi entregue
- **Timer** da fase, contando suave (local) entre os polls, vermelho/pulsando nos 10s finais.
- **Som** sintético (Web Audio): "ding" quando fica a sua vez (pick ou ban) e bips nos 10s finais.
- **Trocar skin** do campeão (só as que você possui), com miniatura.

## Como funciona
- `summarizeChampSelect` passa a devolver `timer` e `isPickPhase`; o app conta o timer
  localmente e dispara os sons nas transições (`web/src/sound.ts`, osciladores — nada de
  áudio original do LoL).
- Skins: `GET /api/skins` (as que possuo, do carrossel `skin-carousel-skins`) +
  `POST /api/skins/select` (`PATCH .../my-selection { selectedSkinId }`); miniatura por proxy
  `/api/skin-icon/:id` (tile `champion-tiles/{championId}/{skinId}.jpg`).

## Como testar
Numa seleção: ver o timer contando e ficando vermelho; ouvir o ding na sua vez e os bips
finais; escolher um campeão e trocar a skin, vendo mudar no cliente.
```

- [ ] **Step 2: Rodar toda a suíte do servidor**

Run (em `server/`): `npm test`
Expected: PASS — inclui `skins` e os testes de timer/isPickPhase.

- [ ] **Step 3: Commit**

```bash
git add docs/features/2026-07-20-selecao-timer-som-skins.md
git commit -m "docs: timer + som + skins na Selecao"
```

---

## Self-Review (feita)

- **Cobertura do spec:**
  - Timer com destaque nos 10s → Tasks 1 (server), 2 (UI). ✅
  - Som na sua vez + nos 10s finais (sintético) → Task 2 (`sound.ts` + disparo). ✅
  - Trocar skin (só as que possuo, com miniatura) → Tasks 3 (helpers), 4 (rotas), 5 (UI). ✅
  - Timer vem no mesmo poll; skins carregam ao escolher campeão → Tasks 1, 5. ✅
  - Erros (timer null, sem skins, áudio bloqueado, trocar fora da hora, miniatura ausente) → Tasks 1, 2, 4, 5. ✅
  - Probe do formato de skins antes de codar → Task 3 Step 1. ✅
  - Testes (timer/isPickPhase puros, helpers de skin) + screenshots → Tasks 1, 3, 2, 5. ✅
  - Docs → Task 6. ✅
- **Placeholders:** nenhum "TBD/TODO"; todo passo com código/comando (o probe tem script completo). ✅
- **Consistência de tipos:** `ChampTimer` (T1) bate com o `timer` em `PickState` (T2); `Skin` (T3) igual em `skins.ts`, rotas (T4) e `api.ts` (T5); `selectSkin(client, skinId)` (T3) usado por `/skins/select` (T4) e `selectSkin(skinId)` no app (T5); `isPickPhase` (T1) consumido no disparo do som (T2). ✅
```
