# Sprint 3 — Tempo Real (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tela do celular muda sozinha conforme a fase do jogo (Início → Em Fila → Partida Encontrada → Seleção → Em Jogo). O servidor escuta o WebSocket da LCU, guarda o estado do jogo e faz stream via SSE; o celular reage com `EventSource`.

**Architecture:** Uma função pura `normalizePhase` mapeia a fase crua da LCU para um tipo fechado. Um `game-state` em memória guarda `{phase, summoner}` e emite só quando muda. Um watcher (`lcu/events.ts`) abre o WebSocket da LCU e alimenta o `game-state`; a rota `GET /api/events` (SSE) faz stream do estado. O app assina os eventos e troca a tela por fase, reaproveitando a casca visual da Sprint 2.

**Tech Stack:** Servidor: Node, TypeScript, Express, axios, ws (novo), vitest. Web: React, Vite, TypeScript, antd, `EventSource` (nativo).

## Global Constraints

- Código do servidor em `server/`; app em `web/`. TS `strict: true` nos dois.
- Servidor CommonJS (imports sem extensão); web ESM.
- Nomes/código em inglês; comentários e docs em português.
- Nunca logar o token completo (máx. 6 primeiros caracteres).
- Fase normalizada no tipo fechado: `Offline | None | Lobby | Matchmaking | ReadyCheck | ChampSelect | InProgress | Other`. `Offline` é sintético (definido pelo watcher), nunca sai de `normalizePhase`.
- SSE: `Content-Type: text/event-stream`, cada evento no formato `data: <json>\n\n`.
- Watcher reconecta em loop **relendo o lockfile** (o token muda no restart do LoL); intervalo de reconexão **3000 ms**.
- App: o poll de summoner (3s) da Sprint 2 **sai**, substituído pelo estado que chega por SSE. O endereço do servidor continua vindo de `window.location.hostname:3000`.
- O **auto-aceitar da Sprint 2 fica intacto** (polling próprio) — não refatorar.
- Documentação faz parte da entrega: `docs/sprints/sprint-3.md` e README ao fim.

---

## File Structure

```
server/src/
├── state/
│   ├── normalize-phase.ts       → normalizePhase(raw): Phase (pura) + type Phase
│   ├── normalize-phase.test.ts
│   ├── game-state.ts            → createGameState() + singleton gameState
│   └── game-state.test.ts
├── lcu/
│   ├── events.ts               → parsePhaseFromMessage() + startGameflowWatcher()
│   └── events.test.ts          → testa parsePhaseFromMessage (watcher é manual)
├── routes/
│   ├── events.ts               → sseData() + eventsHandler() + eventsRouter
│   └── events.test.ts          → testa sseData + eventsHandler (req/res fakes)
└── index.ts                    → + eventsRouter, + startGameflowWatcher()

web/src/
├── api.ts                      → + type Phase/GameState + subscribeEvents(); remove getSummoner
├── screens.tsx                 → CardBody + telas por fase (Idle/Queue/Found/Select/InGame/Offline)
└── App.tsx                     → assina eventos e troca a tela por fase
```

---

### Task 1: `normalizePhase` — fase crua da LCU → tipo fechado

**Files:**
- Create: `server/src/state/normalize-phase.ts`
- Test: `server/src/state/normalize-phase.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `type Phase = "Offline" | "None" | "Lobby" | "Matchmaking" | "ReadyCheck" | "ChampSelect" | "InProgress" | "Other"` e `normalizePhase(raw: string): Phase`.

- [ ] **Step 1: Escrever o teste que falha — `server/src/state/normalize-phase.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { normalizePhase } from "./normalize-phase";

describe("normalizePhase", () => {
  it("mantém as fases conhecidas", () => {
    for (const p of ["None", "Lobby", "Matchmaking", "ReadyCheck", "ChampSelect"]) {
      expect(normalizePhase(p)).toBe(p);
    }
  });

  it("agrupa as fases de jogo em InProgress", () => {
    for (const p of ["GameStart", "InProgress", "Reconnect", "WaitingForStats", "PreEndOfGame"]) {
      expect(normalizePhase(p)).toBe("InProgress");
    }
  });

  it("manda fases desconhecidas para Other", () => {
    expect(normalizePhase("EndOfGame")).toBe("Other");
    expect(normalizePhase("TerminatedInError")).toBe("Other");
    expect(normalizePhase("")).toBe("Other");
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (em `server/`): `npx vitest run src/state/normalize-phase.test.ts`
Expected: FAIL — `normalizePhase` não existe.

- [ ] **Step 3: Implementar `server/src/state/normalize-phase.ts`**

```ts
/** Fase do jogo já normalizada para um conjunto fechado. */
export type Phase =
  | "Offline"
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "InProgress"
  | "Other";

const DIRECT = ["None", "Lobby", "Matchmaking", "ReadyCheck", "ChampSelect"];
const IN_PROGRESS = new Set([
  "GameStart",
  "InProgress",
  "Reconnect",
  "WaitingForStats",
  "PreEndOfGame",
]);

/**
 * Mapeia a string crua de gameflow-phase da LCU para o tipo Phase.
 * "Offline" é sintético (definido pelo watcher) e nunca sai daqui.
 */
export function normalizePhase(raw: string): Phase {
  if (DIRECT.includes(raw)) return raw as Phase;
  if (IN_PROGRESS.has(raw)) return "InProgress";
  return "Other";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/state/normalize-phase.test.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/state/normalize-phase.ts server/src/state/normalize-phase.test.ts
git commit -m "feat(server): normalizePhase (fase da LCU -> tipo fechado)"
```

---

### Task 2: `game-state` — estado em memória que emite ao mudar

**Files:**
- Create: `server/src/state/game-state.ts`
- Test: `server/src/state/game-state.test.ts`

**Interfaces:**
- Consumes: `Phase` (Task 1).
- Produces:
  - `interface Summoner { name: string; tagLine: string; level: number }`
  - `interface GameState { phase: Phase; summoner: Summoner | null }`
  - `createGameState()` → `{ getState(): GameState; setPhase(p: Phase): void; setSummoner(s: Summoner | null): void; subscribe(cb: (s: GameState) => void): () => void }`
  - `gameState` — singleton (instância de `createGameState()`), estado inicial `{ phase: "Offline", summoner: null }`.

- [ ] **Step 1: Escrever o teste que falha — `server/src/state/game-state.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { createGameState } from "./game-state";

describe("createGameState", () => {
  it("começa Offline sem summoner", () => {
    const gs = createGameState();
    expect(gs.getState()).toEqual({ phase: "Offline", summoner: null });
  });

  it("emite quando a fase muda, mas não quando repete", () => {
    const gs = createGameState();
    const cb = vi.fn();
    gs.subscribe(cb);

    gs.setPhase("Matchmaking");
    gs.setPhase("Matchmaking"); // repetida — não emite
    gs.setPhase("ReadyCheck");

    expect(cb).toHaveBeenCalledTimes(2);
    expect(gs.getState().phase).toBe("ReadyCheck");
  });

  it("emite quando o summoner muda, e não quando é igual", () => {
    const gs = createGameState();
    const cb = vi.fn();
    gs.subscribe(cb);

    gs.setSummoner({ name: "SOHTA", tagLine: "BR1", level: 664 });
    gs.setSummoner({ name: "SOHTA", tagLine: "BR1", level: 664 }); // igual — não emite

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("subscribe retorna uma função que desinscreve", () => {
    const gs = createGameState();
    const cb = vi.fn();
    const unsub = gs.subscribe(cb);

    gs.setPhase("Lobby");
    unsub();
    gs.setPhase("Matchmaking");

    expect(cb).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/state/game-state.test.ts`
Expected: FAIL — `createGameState` não existe.

- [ ] **Step 3: Implementar `server/src/state/game-state.ts`**

```ts
import { Phase } from "./normalize-phase";

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export interface GameState {
  phase: Phase;
  summoner: Summoner | null;
}

type Listener = (state: GameState) => void;

function sameSummoner(a: Summoner | null, b: Summoner | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.name === b.name && a.tagLine === b.tagLine && a.level === b.level;
}

/** Cria um estado de jogo que notifica os inscritos só quando algo muda. */
export function createGameState() {
  let state: GameState = { phase: "Offline", summoner: null };
  const listeners = new Set<Listener>();

  const emit = () => {
    for (const l of listeners) l(state);
  };

  return {
    getState: (): GameState => state,
    setPhase(phase: Phase) {
      if (state.phase === phase) return;
      state = { ...state, phase };
      emit();
    },
    setSummoner(summoner: Summoner | null) {
      if (sameSummoner(state.summoner, summoner)) return;
      state = { ...state, summoner };
      emit();
    },
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Singleton usado pelo watcher e pela rota SSE. */
export const gameState = createGameState();
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/state/game-state.test.ts`
Expected: PASS (4 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/state/game-state.ts server/src/state/game-state.test.ts
git commit -m "feat(server): game-state em memoria (emite ao mudar)"
```

---

### Task 3: Rota SSE `GET /api/events`

**Files:**
- Create: `server/src/routes/events.ts`
- Test: `server/src/routes/events.test.ts`

**Interfaces:**
- Consumes: `gameState`, `GameState` (Task 2).
- Produces:
  - `sseData(state: GameState): string` — formata `data: <json>\n\n`.
  - `eventsHandler(req, res)` — handler SSE (exportado para teste).
  - `eventsRouter` — Express Router com `GET /events`.

- [ ] **Step 1: Escrever o teste que falha — `server/src/routes/events.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { sseData, eventsHandler } from "./events";
import { gameState } from "../state/game-state";

describe("sseData", () => {
  it("formata o estado como evento SSE", () => {
    const out = sseData({ phase: "Matchmaking", summoner: null });
    expect(out).toBe('data: {"phase":"Matchmaking","summoner":null}\n\n');
  });
});

describe("eventsHandler", () => {
  it("manda o estado atual, empurra mudanças e para ao fechar", () => {
    // req falso (EventEmitter para o evento 'close'); res falso captura writes
    const req = new EventEmitter() as any;
    const writes: string[] = [];
    const res: any = {
      setHeader: vi.fn(),
      flushHeaders: vi.fn(),
      write: (chunk: string) => writes.push(chunk),
    };

    gameState.setPhase("None");
    eventsHandler(req, res);
    expect(writes[0]).toContain('"phase":"None"');

    gameState.setPhase("Matchmaking");
    expect(writes[1]).toContain('"phase":"Matchmaking"');

    req.emit("close"); // celular desconectou
    gameState.setPhase("ChampSelect");
    expect(writes).toHaveLength(2); // não escreveu mais após o close
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/routes/events.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/routes/events.ts`**

```ts
import { Router, Request, Response } from "express";
import { gameState, GameState } from "../state/game-state";

/** Formata um estado de jogo como um evento SSE. */
export function sseData(state: GameState): string {
  return `data: ${JSON.stringify(state)}\n\n`;
}

/** Handler SSE: manda o estado atual e depois cada mudança. */
export function eventsHandler(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // estado atual imediatamente
  res.write(sseData(gameState.getState()));

  const unsubscribe = gameState.subscribe((state) => {
    res.write(sseData(state));
  });

  req.on("close", unsubscribe);
}

export const eventsRouter = Router();
eventsRouter.get("/events", eventsHandler);
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/routes/events.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/events.ts server/src/routes/events.test.ts
git commit -m "feat(server): rota SSE /api/events (stream do estado)"
```

---

### Task 4: Watcher do WebSocket da LCU

**Files:**
- Create: `server/src/lcu/events.ts`
- Test: `server/src/lcu/events.test.ts`
- Modify: `server/package.json` (dep `ws`)

**Interfaces:**
- Consumes: `readLockfile` (Sprint 1), `buildCredentials` (Sprint 1), `connectToLcu` (Sprint 2), `getGameflowPhase` (Sprint 2), `gameState` (Task 2), `normalizePhase` (Task 1).
- Produces:
  - `parsePhaseFromMessage(raw: string): string | null` — extrai a fase de uma mensagem do WS da LCU.
  - `startGameflowWatcher(): void` — abre o WS, alimenta o `game-state`, reconecta sozinho.

- [ ] **Step 1: Instalar `ws`**

Run (em `server/`): `npm install ws && npm install -D @types/ws`
Expected: adiciona `ws` às deps sem erros.

- [ ] **Step 2: Escrever o teste que falha — `server/src/lcu/events.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parsePhaseFromMessage } from "./events";

describe("parsePhaseFromMessage", () => {
  it("extrai a fase de um evento gameflow-phase da LCU", () => {
    const msg = JSON.stringify([
      8,
      "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase",
      { data: "Matchmaking", eventType: "Update", uri: "/lol-gameflow/v1/gameflow-phase" },
    ]);
    expect(parsePhaseFromMessage(msg)).toBe("Matchmaking");
  });

  it("retorna null para mensagens sem data de fase", () => {
    expect(parsePhaseFromMessage(JSON.stringify([8, "Outro", {}]))).toBeNull();
  });

  it("retorna null para mensagens que não são JSON", () => {
    expect(parsePhaseFromMessage("nao-e-json")).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/events.test.ts`
Expected: FAIL — `parsePhaseFromMessage` não existe.

- [ ] **Step 4: Implementar `server/src/lcu/events.ts`**

```ts
import WebSocket from "ws";
import { Agent } from "node:https";
import { readLockfile } from "./lockfile-reader";
import { buildCredentials } from "./credentials";
import { connectToLcu } from "./connect";
import { getGameflowPhase } from "./matchmaking";
import { gameState } from "../state/game-state";
import { normalizePhase } from "../state/normalize-phase";

const RECONNECT_MS = 3000;
const GAMEFLOW_EVENT = "OnJsonApiEvent_lol-gameflow_v1_gameflow-phase";

/**
 * Extrai a fase de uma mensagem do WebSocket da LCU.
 * As mensagens de evento têm o formato [8, topic, { data, eventType, uri }].
 */
export function parsePhaseFromMessage(raw: string): string | null {
  try {
    const msg = JSON.parse(raw);
    if (Array.isArray(msg) && msg[2] && typeof msg[2].data === "string") {
      return msg[2].data;
    }
  } catch {
    // heartbeats e mensagens não-JSON são ignorados
  }
  return null;
}

/**
 * Abre o WebSocket da LCU e mantém o game-state atualizado com a fase do jogo.
 * Reconecta sozinho (relendo o lockfile) quando o LoL fecha ou o WS cai.
 */
export function startGameflowWatcher(): void {
  function scheduleReconnect() {
    gameState.setPhase("Offline");
    gameState.setSummoner(null);
    setTimeout(connect, RECONNECT_MS);
  }

  async function primeInitialState() {
    // Estado inicial via REST: a fase atual e o nick, para não esperar a próxima mudança.
    try {
      const client = connectToLcu();
      if (!client) return;
      const phase = await getGameflowPhase(client);
      gameState.setPhase(normalizePhase(phase));
      const { data } = await client.get("/lol-summoner/v1/current-summoner");
      gameState.setSummoner({
        name: data.gameName || data.displayName,
        tagLine: data.tagLine,
        level: data.summonerLevel,
      });
    } catch {
      // se falhar, o estado vem pelos eventos do WS
    }
  }

  function connect() {
    const lockfile = readLockfile();
    if (!lockfile) {
      scheduleReconnect();
      return;
    }
    const creds = buildCredentials(lockfile);
    const ws = new WebSocket(creds.baseUrl.replace("https", "wss"), {
      agent: new Agent({ rejectUnauthorized: false }),
      headers: { Authorization: creds.authHeader },
    });

    ws.on("open", () => {
      // Assina só o evento de mudança de fase (não o firehose inteiro).
      ws.send(JSON.stringify([5, GAMEFLOW_EVENT]));
      void primeInitialState();
    });
    ws.on("message", (raw: WebSocket.RawData) => {
      const phase = parsePhaseFromMessage(raw.toString());
      if (phase) gameState.setPhase(normalizePhase(phase));
    });
    ws.on("close", scheduleReconnect);
    ws.on("error", () => ws.close()); // 'close' agenda a reconexão
  }

  connect();
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/events.test.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 6: Commit**

```bash
git add server/src/lcu/events.ts server/src/lcu/events.test.ts server/package.json server/package-lock.json
git commit -m "feat(server): watcher do WebSocket da LCU (fase em tempo real)"
```

---

### Task 5: Ligar tudo no `index.ts` + verificação manual do SSE

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `eventsRouter` (Task 3), `startGameflowWatcher` (Task 4).
- Produces: servidor com a rota SSE montada e o watcher rodando.

- [ ] **Step 1: Atualizar `server/src/index.ts`**

Substituir o conteúdo por:

```ts
import express from "express";
import cors from "cors";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";
import { eventsRouter } from "./routes/events";
import { startGameflowWatcher } from "./lcu/events";

const PORT = 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", summonerRouter);
app.use("/api", actionsRouter);
app.use("/api", eventsRouter);

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
  // Começa a ouvir os eventos de fase da LCU e a alimentar o game-state.
  startGameflowWatcher();
});
```

- [ ] **Step 2: Typecheck + suíte completa**

Run (em `server/`): `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes verdes.

- [ ] **Step 3: Verificar o SSE manualmente (com o LoL aberto)**

Run (em `server/`): `npm run dev`
Em outro terminal: `curl -N http://localhost:3000/api/events`
Expected: imprime **na hora** uma linha `data: {"phase":"...","summoner":{"name":"...","tagLine":"...","level":...}}` com a fase atual (ex.: `None` ou `Lobby`) e o seu nick. Ao entrar/sair da fila no LoL, novas linhas `data:` aparecem com a fase nova. (Encerrar com Ctrl+C.)

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): monta SSE e inicia o watcher de fase no index"
```

---

### Task 6: App reage em tempo real (SSE → troca de tela)

**Files:**
- Modify: `web/src/api.ts`
- Create: `web/src/screens.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.css` (classes das novas telas)

**Interfaces:**
- Consumes: `GET /api/events` (Task 3/5), `accept`/`getAutoAccept`/`setAutoAccept` (Sprint 2).
- Produces: `subscribeEvents`, `type Phase`, `type GameState` em `api.ts`; `CardBody` em `screens.tsx`; `App` que troca a tela por fase.

- [ ] **Step 1: Atualizar `web/src/api.ts`**

Substituir o conteúdo por (mantém accept/auto-accept; troca `getSummoner` por `subscribeEvents`):

```ts
// O app foi carregado pelo IP/host do PC; o servidor é o mesmo host na porta 3000.
const baseUrl = `http://${window.location.hostname}:3000`;

export type Phase =
  | "Offline"
  | "None"
  | "Lobby"
  | "Matchmaking"
  | "ReadyCheck"
  | "ChampSelect"
  | "InProgress"
  | "Other";

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export interface GameState {
  phase: Phase;
  summoner: Summoner | null;
}

/** Assina o stream de estado (SSE). Retorna uma função que encerra a conexão. */
export function subscribeEvents(onState: (state: GameState) => void): () => void {
  const es = new EventSource(`${baseUrl}/api/events`);
  es.onmessage = (e) => {
    try {
      onState(JSON.parse(e.data));
    } catch {
      // ignora payloads malformados
    }
  };
  return () => es.close();
}

export async function accept(): Promise<void> {
  const res = await fetch(`${baseUrl}/api/accept`, { method: "POST" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
}

export async function getAutoAccept(): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`);
  const body = await res.json();
  return Boolean(body.enabled);
}

export async function setAutoAccept(enabled: boolean): Promise<boolean> {
  const res = await fetch(`${baseUrl}/api/auto-accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const body = await res.json();
  return Boolean(body.enabled);
}
```

- [ ] **Step 2: Criar `web/src/screens.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Switch } from "antd";
import type { GameState } from "./api";

interface BodyProps {
  state: GameState;
  auto: boolean;
  accepting: boolean;
  onAccept: () => void;
  onToggle: (value: boolean) => void;
}

/** Escolhe o miolo do card conforme a fase. */
export function CardBody(p: BodyProps) {
  switch (p.state.phase) {
    case "Matchmaking":
      return <QueueBody />;
    case "ReadyCheck":
      return <FoundBody accepting={p.accepting} onAccept={p.onAccept} />;
    case "ChampSelect":
      return <SelectBody />;
    case "InProgress":
      return <InGameBody />;
    case "Offline":
      return <OfflineBody />;
    default:
      return <IdleBody state={p.state} auto={p.auto} onToggle={p.onToggle} />;
  }
}

function IdleBody({
  state,
  auto,
  onToggle,
}: Pick<BodyProps, "state" | "auto" | "onToggle">) {
  const s = state.summoner;
  return (
    <>
      <h1 className="nick">
        {s ? s.name : "—"}
        {s && <span className="tag">#{s.tagLine}</span>}
      </h1>
      <p className="level">{s ? `Nível ${s.level}` : "Fora de fila"}</p>
      <div className="divider" />
      <label className="auto">
        <span className="auto-text">
          <span className="auto-title">Auto-aceitar</span>
          <span className="auto-sub">Aceita a partida sozinho</span>
        </span>
        <Switch checked={auto} onChange={onToggle} />
      </label>
    </>
  );
}

function QueueBody() {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return (
    <>
      <h1 className="headline">Em Fila</h1>
      <p className="sub">Procurando partida…</p>
      <div className="timer">
        {mm}:{ss}
      </div>
    </>
  );
}

function FoundBody({
  accepting,
  onAccept,
}: Pick<BodyProps, "accepting" | "onAccept">) {
  return (
    <>
      <h1 className="headline gold">Partida Encontrada!</h1>
      <button className="accept" type="button" onClick={onAccept} disabled={accepting}>
        {accepting ? "Aceitando…" : "Aceitar"}
      </button>
    </>
  );
}

function SelectBody() {
  return (
    <>
      <h1 className="headline">Seleção</h1>
      <p className="sub">Na seleção de campeões</p>
    </>
  );
}

function InGameBody() {
  return (
    <>
      <h1 className="headline">Em Jogo</h1>
      <p className="sub">Partida em andamento</p>
    </>
  );
}

function OfflineBody() {
  return (
    <>
      <h1 className="headline muted">LoL fechado</h1>
      <p className="sub">Abra o cliente do LoL</p>
    </>
  );
}
```

- [ ] **Step 3: Atualizar `web/src/App.tsx`**

Substituir o conteúdo por:

```tsx
import { useEffect, useState } from "react";
import { App as AntApp } from "antd";
import {
  subscribeEvents,
  accept,
  getAutoAccept,
  setAutoAccept,
  type GameState,
} from "./api";
import { CardBody } from "./screens";
import "./App.css";

const OFFLINE: GameState = { phase: "Offline", summoner: null };

export default function App() {
  const { message } = AntApp.useApp();
  const [state, setState] = useState<GameState>(OFFLINE);
  const [connected, setConnected] = useState(false);
  const [auto, setAuto] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Assina o stream de estado; a tela passa a reagir sozinha.
  useEffect(() => {
    return subscribeEvents((s) => {
      setConnected(true);
      setState(s);
    });
  }, []);

  // Lê o estado do auto-aceitar ao montar.
  useEffect(() => {
    getAutoAccept()
      .then(setAuto)
      .catch(() => {});
  }, []);

  async function onAccept() {
    setAccepting(true);
    try {
      await accept();
      message.success("Partida aceita!");
    } catch (err) {
      message.error((err as Error).message || "Falha ao aceitar");
    } finally {
      setAccepting(false);
    }
  }

  async function onToggle(value: boolean) {
    try {
      const now = await setAutoAccept(value);
      setAuto(now);
      message.info(now ? "Auto-aceitar ligado" : "Auto-aceitar desligado");
    } catch {
      message.error("Não foi possível mudar o auto-aceitar");
    }
  }

  const online = connected && state.phase !== "Offline";

  return (
    <main className="stage">
      <p className="eyebrow">Modo Banheiro</p>

      <section className="panel" aria-live="polite">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />

        <div className={`status ${online ? "on" : "off"}`}>
          <span className="dot" />
          {online ? "Conectado" : "LoL fechado"}
        </div>

        <CardBody
          state={state}
          auto={auto}
          accepting={accepting}
          onAccept={onAccept}
          onToggle={onToggle}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Acrescentar as classes das novas telas em `web/src/App.css`**

Adicionar ao fim do arquivo:

```css
/* Telas de fase (Em Fila / Seleção / Em Jogo / Offline / Encontrada). */
.headline {
  margin: 6px 0 0;
  font-family: var(--serif);
  font-weight: 700;
  font-size: 28px;
  letter-spacing: 0.02em;
  text-align: center;
  color: var(--cream);
}
.headline.gold {
  color: var(--gold);
}
.headline.muted {
  color: var(--muted);
}
.sub {
  margin: 0;
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--muted);
}
.timer {
  margin-top: 8px;
  font-family: var(--serif);
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--gold);
}
```

- [ ] **Step 5: Typecheck + build do app**

Run (em `web/`): `npm run build`
Expected: `tsc -b` sem erros e o `vite build` conclui.

- [ ] **Step 6: Verificação visual das telas (screenshots com um SSE de mentira)**

Como as fases `Matchmaking`/`ReadyCheck`/`ChampSelect`/`InProgress` dependem de estar numa
fila real, dá para conferir cada tela apontando o app para um **servidor SSE de mentira**
que emite a fase escolhida na porta 3000. Roteiro (scratch, nada commitado):

1. Buildar o app (`web/`: `npm run build`) e servir o `dist/` (`npx vite preview --port 4173 --host`).
2. Subir um servidorzinho SSE em `:3000` que responde `GET /api/events` com
   `data: {"phase":"Matchmaking","summoner":{"name":"SOHTA","tagLine":"BR1","level":664}}\n\n`
   (e `GET /api/auto-accept` com `{"enabled":false}`), trocando a fase para tirar um print de
   cada tela: `Matchmaking`, `ReadyCheck`, `ChampSelect`, `InProgress`, `Offline`, `None`.
3. Abrir `http://localhost:4173` e conferir que cada fase mostra a tela certa e com o visual
   do LoL. (Este passo é uma conferência local; o teste de ponta a ponta real é o Step 7.)

- [ ] **Step 7: Verificação ponta a ponta (com o LoL aberto)**

1. `server/`: `npm run dev`.
2. `web/`: `npm run dev`.
3. Abrir `http://localhost:5173` (PC) e `http://IP-do-PC:5173` (celular).
4. Fora de fila → tela **Início** com o nick. Entrar na fila → vira **Em Fila** (com
   cronômetro) sozinho. Partida encontrada → **Partida Encontrada!** (botão ACEITAR).
   Aceitar → **Seleção**. Começar a partida → **Em Jogo**. Fechar o LoL → **LoL fechado**.

Expected: a tela acompanha as fases sem o usuário atualizar nada.

- [ ] **Step 8: Commit**

```bash
git add web/src/api.ts web/src/screens.tsx web/src/App.tsx web/src/App.css
git commit -m "feat(web): telas em tempo real via SSE (fila/encontrada/selecao/jogo)"
```

---

### Task 7: Documentação da sprint + README + suíte final

**Files:**
- Create: `docs/sprints/sprint-3.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: docs da entrega.

- [ ] **Step 1: Escrever `docs/sprints/sprint-3.md`**

```markdown
# Sprint 3 — Tempo Real

## O que foi entregue
A tela do celular muda sozinha conforme a fase do jogo (Início → Em Fila → Partida
Encontrada → Seleção → Em Jogo), sem o usuário atualizar nada.

## Como funciona (fluxo)
1. `startGameflowWatcher()` abre o WebSocket da LCU e assina o evento de mudança de fase.
2. Cada evento vira `normalizePhase(...)` e atualiza o `game-state` (que emite só quando muda).
3. `GET /api/events` (SSE) faz stream do estado para o celular.
4. O app assina com `EventSource` e troca a tela conforme `phase`.
5. Se o LoL fecha ou o WebSocket cai, o estado vira `Offline` e o servidor reconecta sozinho.

## Como testar
1. Abra o LoL e faça login.
2. `server/`: `npm install` e `npm run dev`.
3. `web/`: `npm install` e `npm run dev`.
4. No PC/celular, entre na fila e veja a tela acompanhar as fases sozinha.
5. Testes do servidor: em `server/`, `npm test`.

## Decisões e aprendizados
- **SSE** (não Socket.IO): só precisamos de servidor→celular; as ações continuam REST.
- WebSocket da LCU assinando só `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase`.
- `game-state` emite só quando muda; `normalizePhase` é pura e testável.
- O auto-aceitar da Sprint 2 seguiu intacto (polling próprio).
- O poll de summoner (3s) saiu; o estado agora chega por push.
```

- [ ] **Step 2: Atualizar o `README.md`**

No bloco do Roadmap, marcar a Sprint 3 como entregue e, na seção "Como funciona (resumo)",
garantir que o texto menciona que a tela muda em tempo real. Acrescentar ao fim da seção
"Passos" a observação:

```markdown
> A partir da Sprint 3, a tela do celular muda sozinha conforme a fila/partida (via SSE);
> não precisa atualizar a página.
```

- [ ] **Step 3: Rodar toda a suíte de testes do servidor**

Run (em `server/`): `npm test`
Expected: PASS — inclusive `normalize-phase`, `game-state`, `events` (rota) e `events` (lcu).

- [ ] **Step 4: Commit**

```bash
git add docs/sprints/sprint-3.md README.md
git commit -m "docs: sprint 3 (tempo real) + README"
```

---

## Self-Review (feita)

- **Cobertura do spec:**
  - WebSocket da LCU → fase em tempo real → Task 4. ✅
  - `game-state` que emite ao mudar + `normalizePhase` → Tasks 1, 2. ✅
  - SSE `GET /api/events` → Task 3, montado na Task 5. ✅
  - App troca de tela por fase (Início/Fila/Encontrada/Seleção/Jogo/Offline) → Task 6. ✅
  - Cronômetro no cliente → Task 6 (`QueueBody`). ✅
  - Seleção como placeholder (Sprint 4 faz o pick) → Task 6 (`SelectBody`). ✅
  - Auto-aceitar intacto → não tocado (só `index.ts` ganha o watcher). ✅
  - Reconexão/Offline + token relido → Task 4 (`scheduleReconnect`/`connect`). ✅
  - Docs (sprint-3.md + README) → Task 7. ✅
- **Placeholders:** nenhum "TBD/TODO"; todo passo com código/comando completo. ✅
- **Consistência de tipos:** `Phase` (Task 1) usado por `game-state` (Task 2), `normalizePhase` (Task 4) e o app (Task 6, mesma união literal); `GameState`/`Summoner` (Task 2) batem com `sseData`/`eventsHandler` (Task 3) e com `subscribeEvents` (Task 6); `parsePhaseFromMessage` (Task 4) alimenta `normalizePhase`. ✅
