# Sprint 2 — Primeira Ação (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aceitar a partida do LoL pelo celular/PC com um botão **ACEITAR**, e um **toggle de auto-aceitar** que faz o servidor aceitar sozinho (via polling). Nasce o app `web/` (React + antd) com o tema do launcher do LoL.

**Architecture:** O servidor reaproveita a camada `lcu/` da Sprint 1: uma função `connectToLcu()` monta o cliente HTTP; helpers de `matchmaking` leem a fase do jogo e aceitam a partida; uma função pura `shouldAccept(phase)` decide; um serviço em memória faz o loop de polling (1s). Uma rota `actions` expõe `/accept` e `/auto-accept`. O app `web/` chama essas rotas via `fetch` (CORS liberado), descobrindo o endereço do servidor por `window.location.hostname`.

**Tech Stack:** Servidor: Node, TypeScript, Express, axios, cors, vitest. Web: React, Vite, TypeScript, antd 6 (tema LoL via `ConfigProvider`).

## Global Constraints

- Todo o código do servidor fica em `server/`; o app do celular em `web/`.
- TypeScript `strict: true` nos dois.
- Servidor em módulos CommonJS (imports sem extensão); web em ESM (padrão do Vite).
- Nomes de arquivos e código em inglês; comentários e docs em português.
- Nunca logar o token completo (no máximo os 6 primeiros caracteres).
- Intervalo do polling do auto-aceitar: **1000 ms**.
- CORS liberado para a rede local (MVP em rede confiável).
- O app descobre o servidor por `window.location.hostname` → `http://<hostname>:3000`.
- Tema antd com as cores do LoL (paleta do spec): primário `#C8AA6E`, fundo `#010A13`,
  texto `#F0E6D2`, sucesso `#0ACF83`, erro `#E84057`, info/teal `#0AC8B9`.
- Documentação faz parte da entrega: ao fim do sprint, `docs/sprints/sprint-2.md` e README atualizados.

---

## File Structure

```
server/src/
├── lcu/
│   ├── connect.ts              → connectToLcu(path?) — monta o cliente da LCU (DRY)
│   ├── connect.test.ts
│   ├── matchmaking.ts          → getGameflowPhase(client), acceptReadyCheck(client)
│   └── matchmaking.test.ts
├── auto-accept/
│   ├── should-accept.ts        → shouldAccept(phase) — função pura
│   ├── should-accept.test.ts
│   ├── auto-accept-service.ts  → pollAndAccept() + createAutoAcceptService() + singleton
│   └── auto-accept-service.test.ts
├── routes/
│   ├── summoner.ts             → (refatorado p/ usar connectToLcu)
│   └── actions.ts              → POST /accept, GET+POST /auto-accept
└── index.ts                    → + cors, + actionsRouter

web/  (novo — scaffold Vite)
├── vite.config.ts              → server.host = true (celular acessa pela LAN)
├── index.html
└── src/
    ├── main.tsx                → ConfigProvider (tema LoL) + AntApp + App
    ├── theme.ts                → tokens antd com as cores do LoL
    ├── index.css               → reset mínimo + fundo escuro
    ├── api.ts                  → baseUrl + getSummoner/accept/getAutoAccept/setAutoAccept
    └── App.tsx                 → tela (status + botão ACEITAR + toggle)
```

---

### Task 1: `connectToLcu()` — conexão reutilizável com a LCU

**Files:**
- Create: `server/src/lcu/connect.ts`
- Test: `server/src/lcu/connect.test.ts`
- Modify: `server/src/routes/summoner.ts` (usar o helper)

**Interfaces:**
- Consumes: `readLockfile` (Sprint 1), `buildCredentials` (Sprint 1), `createLcuClient` (Sprint 1).
- Produces: `connectToLcu(path?: string): AxiosInstance | null` — retorna um cliente axios pronto, ou `null` se o LoL estiver fechado.

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/connect.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { connectToLcu } from "./connect";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("connectToLcu", () => {
  it("retorna null quando o LoL está fechado (lockfile ausente)", () => {
    expect(connectToLcu(join(tmpdir(), "lockfile-inexistente-abc"))).toBeNull();
  });

  it("retorna um cliente axios com a baseURL da LCU quando há lockfile", () => {
    const caminho = join(tmpdir(), "lockfile-connect-teste");
    writeFileSync(caminho, "LeagueClient:1:54321:tok:https");
    try {
      const client = connectToLcu(caminho);
      expect(client?.defaults.baseURL).toBe("https://127.0.0.1:54321");
    } finally {
      rmSync(caminho, { force: true });
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run (em `server/`): `npx vitest run src/lcu/connect.test.ts`
Expected: FAIL — `connectToLcu` não existe.

- [ ] **Step 3: Implementar `server/src/lcu/connect.ts`**

```ts
import { AxiosInstance } from "axios";
import { readLockfile } from "./lockfile-reader";
import { buildCredentials } from "./credentials";
import { createLcuClient } from "./client";

/**
 * Monta um cliente HTTP pronto para falar com a LCU, a partir do lockfile.
 * Retorna null se o LoL estiver fechado (lockfile ausente).
 */
export function connectToLcu(path?: string): AxiosInstance | null {
  const lockfile = readLockfile(path);
  if (!lockfile) return null;
  return createLcuClient(buildCredentials(lockfile));
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/connect.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Refatorar `server/src/routes/summoner.ts` para usar `connectToLcu`**

Substituir o corpo do arquivo por:

```ts
import { Router } from "express";
import { connectToLcu } from "../lcu/connect";

export const summonerRouter = Router();

/** Retorna o invocador atual logado no cliente do LoL. */
summonerRouter.get("/summoner", async (_req, res) => {
  const client = connectToLcu();
  if (!client) {
    return res
      .status(503)
      .json({ error: "LoL não está aberto (lockfile não encontrado)" });
  }
  try {
    const { data } = await client.get("/lol-summoner/v1/current-summoner");
    res.json({
      name: data.gameName || data.displayName,
      tagLine: data.tagLine,
      level: data.summonerLevel,
    });
  } catch (err) {
    res
      .status(502)
      .json({ error: "Falha ao falar com a LCU", detail: String(err) });
  }
});
```

- [ ] **Step 6: Typecheck + suíte completa**

Run (em `server/`): `npx tsc --noEmit && npm test`
Expected: sem erros de tipo; todos os testes existentes + os 2 novos passam.

- [ ] **Step 7: Commit**

```bash
git add server/src/lcu/connect.ts server/src/lcu/connect.test.ts server/src/routes/summoner.ts
git commit -m "feat(server): connectToLcu reutilizavel + refactor do summoner"
```

---

### Task 2: Helpers de matchmaking (ler fase + aceitar)

**Files:**
- Create: `server/src/lcu/matchmaking.ts`
- Test: `server/src/lcu/matchmaking.test.ts`

**Interfaces:**
- Consumes: `AxiosInstance` (axios).
- Produces:
  - `getGameflowPhase(client: AxiosInstance): Promise<string>` — string da fase (ex.: `"ReadyCheck"`, `"Lobby"`).
  - `acceptReadyCheck(client: AxiosInstance): Promise<void>` — aceita a partida.

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/matchmaking.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import type { AxiosInstance } from "axios";
import { getGameflowPhase, acceptReadyCheck } from "./matchmaking";

describe("getGameflowPhase", () => {
  it("faz GET no endpoint de gameflow-phase e devolve a string da fase", async () => {
    const client = {
      get: vi.fn().mockResolvedValue({ data: "ReadyCheck" }),
    } as unknown as AxiosInstance;

    const phase = await getGameflowPhase(client);

    expect(client.get).toHaveBeenCalledWith("/lol-gameflow/v1/gameflow-phase");
    expect(phase).toBe("ReadyCheck");
  });
});

describe("acceptReadyCheck", () => {
  it("faz POST no endpoint de aceitar a partida", async () => {
    const client = {
      post: vi.fn().mockResolvedValue({ data: {} }),
    } as unknown as AxiosInstance;

    await acceptReadyCheck(client);

    expect(client.post).toHaveBeenCalledWith(
      "/lol-matchmaking/v1/ready-check/accept"
    );
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/matchmaking.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/lcu/matchmaking.ts`**

```ts
import { AxiosInstance } from "axios";

/**
 * Lê a fase atual do fluxo de jogo da LCU.
 * Retorna uma string como "None", "Lobby", "Matchmaking", "ReadyCheck",
 * "ChampSelect", "InProgress".
 */
export async function getGameflowPhase(client: AxiosInstance): Promise<string> {
  const { data } = await client.get("/lol-gameflow/v1/gameflow-phase");
  return data;
}

/** Aceita a partida encontrada (ready-check). */
export async function acceptReadyCheck(client: AxiosInstance): Promise<void> {
  await client.post("/lol-matchmaking/v1/ready-check/accept");
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/matchmaking.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/matchmaking.ts server/src/lcu/matchmaking.test.ts
git commit -m "feat(server): helpers de matchmaking (fase + aceitar)"
```

---

### Task 3: `shouldAccept(phase)` — decisão pura

**Files:**
- Create: `server/src/auto-accept/should-accept.ts`
- Test: `server/src/auto-accept/should-accept.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `shouldAccept(phase: string): boolean` — `true` só quando a fase é `"ReadyCheck"`.

- [ ] **Step 1: Escrever o teste que falha — `server/src/auto-accept/should-accept.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { shouldAccept } from "./should-accept";

describe("shouldAccept", () => {
  it("aceita quando a fase é ReadyCheck", () => {
    expect(shouldAccept("ReadyCheck")).toBe(true);
  });

  it("não aceita em outras fases", () => {
    for (const phase of ["None", "Lobby", "Matchmaking", "ChampSelect", "InProgress"]) {
      expect(shouldAccept(phase)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/auto-accept/should-accept.test.ts`
Expected: FAIL — `shouldAccept` não existe.

- [ ] **Step 3: Implementar `server/src/auto-accept/should-accept.ts`**

```ts
/**
 * Decide se o servidor deve aceitar a partida, dada a fase do jogo.
 * Só aceita quando há um ready-check pendente.
 */
export function shouldAccept(phase: string): boolean {
  return phase === "ReadyCheck";
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/auto-accept/should-accept.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/auto-accept/should-accept.ts server/src/auto-accept/should-accept.test.ts
git commit -m "feat(server): shouldAccept (decisao pura do auto-aceitar)"
```

---

### Task 4: Serviço de auto-aceitar (polling + estado)

**Files:**
- Create: `server/src/auto-accept/auto-accept-service.ts`
- Test: `server/src/auto-accept/auto-accept-service.test.ts`

**Interfaces:**
- Consumes: `connectToLcu` (Task 1), `getGameflowPhase`/`acceptReadyCheck` (Task 2), `shouldAccept` (Task 3), `AxiosInstance` (axios).
- Produces:
  - `pollAndAccept(connect?: () => AxiosInstance | null): Promise<void>` — um ciclo: conecta, lê a fase, aceita se for `ReadyCheck`. `connect` é injetável para teste (default `connectToLcu`).
  - `createAutoAcceptService(check: () => Promise<void>, intervalMs?: number)` → `{ isEnabled(): boolean; setEnabled(v: boolean): void }`.
  - `autoAcceptService` — singleton usado pela API (começa desligado).

- [ ] **Step 1: Escrever o teste que falha — `server/src/auto-accept/auto-accept-service.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AxiosInstance } from "axios";
import { pollAndAccept, createAutoAcceptService } from "./auto-accept-service";

describe("pollAndAccept", () => {
  it("aceita quando a fase é ReadyCheck", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    const client = {
      get: vi.fn().mockResolvedValue({ data: "ReadyCheck" }),
      post,
    } as unknown as AxiosInstance;

    await pollAndAccept(() => client);

    expect(post).toHaveBeenCalledWith("/lol-matchmaking/v1/ready-check/accept");
  });

  it("não aceita em outra fase", async () => {
    const post = vi.fn().mockResolvedValue({ data: {} });
    const client = {
      get: vi.fn().mockResolvedValue({ data: "Lobby" }),
      post,
    } as unknown as AxiosInstance;

    await pollAndAccept(() => client);

    expect(post).not.toHaveBeenCalled();
  });

  it("não quebra quando o LoL está fechado (connect retorna null)", async () => {
    await expect(pollAndAccept(() => null)).resolves.toBeUndefined();
  });
});

describe("createAutoAcceptService", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("começa desligado", () => {
    const service = createAutoAcceptService(vi.fn().mockResolvedValue(undefined));
    expect(service.isEnabled()).toBe(false);
  });

  it("quando ligado, chama o check a cada intervalo; quando desligado, para", () => {
    const check = vi.fn().mockResolvedValue(undefined);
    const service = createAutoAcceptService(check, 1000);

    service.setEnabled(true);
    expect(service.isEnabled()).toBe(true);

    vi.advanceTimersByTime(3000);
    expect(check).toHaveBeenCalledTimes(3);

    service.setEnabled(false);
    vi.advanceTimersByTime(5000);
    expect(check).toHaveBeenCalledTimes(3); // não chamou mais
    expect(service.isEnabled()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/auto-accept/auto-accept-service.test.ts`
Expected: FAIL — módulo/funções não existem.

- [ ] **Step 3: Implementar `server/src/auto-accept/auto-accept-service.ts`**

```ts
import { AxiosInstance } from "axios";
import { connectToLcu } from "../lcu/connect";
import { getGameflowPhase, acceptReadyCheck } from "../lcu/matchmaking";
import { shouldAccept } from "./should-accept";

/**
 * Um ciclo do auto-aceitar: conecta na LCU, lê a fase e aceita se for ReadyCheck.
 * `connect` é injetável para teste; em produção usa connectToLcu.
 */
export async function pollAndAccept(
  connect: () => AxiosInstance | null = connectToLcu
): Promise<void> {
  const client = connect();
  if (!client) return; // LoL fechado — tenta no próximo ciclo
  try {
    const phase = await getGameflowPhase(client);
    if (shouldAccept(phase)) {
      await acceptReadyCheck(client);
    }
  } catch {
    // O LoL pode ter fechado no meio do ciclo; ignora e tenta de novo depois.
  }
}

/**
 * Cria o serviço de auto-aceitar: guarda o estado ligado/desligado e roda um
 * loop que chama `check` a cada `intervalMs` enquanto estiver ligado.
 */
export function createAutoAcceptService(
  check: () => Promise<void>,
  intervalMs = 1000
) {
  let timer: ReturnType<typeof setInterval> | null = null;
  let enabled = false;

  return {
    isEnabled: () => enabled,
    setEnabled(value: boolean) {
      enabled = value;
      if (value && !timer) {
        timer = setInterval(check, intervalMs);
      } else if (!value && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

/** Singleton usado pela API. Começa desligado. */
export const autoAcceptService = createAutoAcceptService(() => pollAndAccept());
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/auto-accept/auto-accept-service.test.ts`
Expected: PASS (5 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/auto-accept/auto-accept-service.ts server/src/auto-accept/auto-accept-service.test.ts
git commit -m "feat(server): servico de auto-aceitar (polling + estado)"
```

---

### Task 5: Rota `actions` + CORS no servidor + verificação manual

**Files:**
- Create: `server/src/routes/actions.ts`
- Modify: `server/src/index.ts`
- Modify: `server/package.json` (dep `cors`)

**Interfaces:**
- Consumes: `connectToLcu` (Task 1), `getGameflowPhase`/`acceptReadyCheck` (Task 2), `shouldAccept` (Task 3), `autoAcceptService` (Task 4).
- Produces: `actionsRouter` (Express Router) com `POST /accept`, `GET /auto-accept`, `POST /auto-accept`.

- [ ] **Step 1: Instalar `cors`**

Run (em `server/`): `npm install cors && npm install -D @types/cors`
Expected: adiciona `cors` às deps sem erros.

- [ ] **Step 2: Implementar `server/src/routes/actions.ts`**

```ts
import { Router } from "express";
import { connectToLcu } from "../lcu/connect";
import { getGameflowPhase, acceptReadyCheck } from "../lcu/matchmaking";
import { shouldAccept } from "../auto-accept/should-accept";
import { autoAcceptService } from "../auto-accept/auto-accept-service";

export const actionsRouter = Router();

/** Aceita a partida agora (ação manual do botão ACEITAR). */
actionsRouter.post("/accept", async (_req, res) => {
  const client = connectToLcu();
  if (!client) {
    return res.status(503).json({ error: "LoL não está aberto" });
  }
  try {
    const phase = await getGameflowPhase(client);
    if (!shouldAccept(phase)) {
      return res.status(409).json({ error: "Nenhuma partida para aceitar" });
    }
    await acceptReadyCheck(client);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: "Falha ao aceitar", detail: String(err) });
  }
});

/** Estado atual do auto-aceitar. */
actionsRouter.get("/auto-accept", (_req, res) => {
  res.json({ enabled: autoAcceptService.isEnabled() });
});

/** Liga/desliga o auto-aceitar. */
actionsRouter.post("/auto-accept", (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  autoAcceptService.setEnabled(enabled);
  res.json({ enabled: autoAcceptService.isEnabled() });
});
```

- [ ] **Step 3: Atualizar `server/src/index.ts` (cors + actionsRouter)**

Substituir o conteúdo por:

```ts
import express from "express";
import cors from "cors";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";

const PORT = 3000;

const app = express();
app.use(cors()); // rede local confiável no MVP; libera o app (5173) a chamar a API
app.use(express.json());
app.use("/api", summonerRouter);
app.use("/api", actionsRouter);

// 0.0.0.0 permite acesso pelo celular na rede local (não só localhost).
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    // Nunca logar o token inteiro.
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
});
```

- [ ] **Step 4: Typecheck + suíte completa**

Run (em `server/`): `npx tsc --noEmit && npm test`
Expected: sem erros; todos os testes verdes.

- [ ] **Step 5: Subir o servidor e testar as rotas manualmente (com o LoL aberto)**

Run (em `server/`): `npm run dev`
Em outro terminal:
- `curl http://localhost:3000/api/auto-accept` → `{"enabled":false}`
- `curl -X POST http://localhost:3000/api/auto-accept -H "Content-Type: application/json" -d "{\"enabled\":true}"` → `{"enabled":true}`
- `curl -X POST http://localhost:3000/api/auto-accept -H "Content-Type: application/json" -d "{\"enabled\":false}"` → `{"enabled":false}`
- `curl -X POST http://localhost:3000/api/accept` (fora de partida) → `409 {"error":"Nenhuma partida para aceitar"}`

Expected: as respostas acima. (O accept "de verdade" será testado ponta a ponta na Task 7 entrando na fila.)

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/actions.ts server/src/index.ts server/package.json server/package-lock.json
git commit -m "feat(server): rota actions (accept + auto-accept) + CORS"
```

---

### Task 6: Scaffold do app `web/` (Vite + React + antd + tema LoL)

**Files:**
- Create: `web/` (scaffold do Vite)
- Modify: `web/vite.config.ts`
- Create: `web/src/theme.ts`
- Modify: `web/src/main.tsx`
- Modify: `web/src/index.css`

**Interfaces:**
- Consumes: nada (base do app).
- Produces: app React que sobe com `npm run dev` na porta 5173 ouvindo em `0.0.0.0`, com o tema do LoL aplicado via `ConfigProvider`.

- [ ] **Step 1: Scaffold do Vite (a partir da raiz do projeto)**

Run: `npm create vite@latest web -- --template react-ts`
Expected: cria a pasta `web/` com o template React + TypeScript.

- [ ] **Step 2: Instalar dependências + antd**

Run (em `web/`): `npm install && npm install antd`
Expected: instala sem erros; `antd` nas dependencies.

- [ ] **Step 3: Configurar o Vite para ouvir na LAN — `web/vite.config.ts`**

Substituir o conteúdo por:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// server.host = true faz o Vite ouvir em 0.0.0.0 (celular acessa por IP-do-PC:5173).
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
});
```

- [ ] **Step 4: Criar o tema do LoL — `web/src/theme.ts`**

```ts
import { theme, type ThemeConfig } from "antd";

/** Tema antd com as cores do launcher do LoL (dourado sobre fundo escuro hextech). */
export const lolTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: "#C8AA6E",
    colorBgBase: "#010A13",
    colorTextBase: "#F0E6D2",
    colorSuccess: "#0ACF83",
    colorError: "#E84057",
    colorInfo: "#0AC8B9",
    fontSize: 16,
    borderRadius: 4,
  },
};
```

- [ ] **Step 5: Aplicar o tema — `web/src/main.tsx`**

Substituir o conteúdo por:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider, App as AntApp } from "antd";
import { lolTheme } from "./theme";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider theme={lolTheme}>
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
```

- [ ] **Step 6: Reset de estilo — `web/src/index.css`**

Substituir o conteúdo por:

```css
:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100vh;
  background: #010a13;
}
```

- [ ] **Step 7: Verificar que o app sobe**

Run (em `web/`): `npm run dev`
Expected: Vite sobe e imprime as URLs `Local: http://localhost:5173/` e `Network: http://<IP>:5173/`. Abrir `http://localhost:5173` no PC deve mostrar a página (ainda o App padrão do Vite) com fundo escuro. Encerrar o dev server depois.

> Observação: nesta task o `App.tsx` ainda é o padrão do Vite — a tela real vem na Task 7.

- [ ] **Step 8: Commit**

```bash
git add web/
git commit -m "feat(web): scaffold Vite+React+antd com tema do LoL"
```

---

### Task 7: Tela do app (status + ACEITAR + toggle) + verificação ponta a ponta

**Files:**
- Create: `web/src/api.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: as rotas do servidor (`/api/summoner`, `/api/accept`, `/api/auto-accept`), o tema/AntApp (Task 6).
- Produces: `api.ts` (`getSummoner`, `accept`, `getAutoAccept`, `setAutoAccept`, tipo `Summoner`) e a tela `App.tsx`.

> **Nota de design:** durante a implementação desta task, invocar a skill `frontend-design`
> para caprichar o visual (identidade "Modo Banheiro" com o tema do LoL). O código abaixo é
> a **base funcional** — o botão ACEITAR deve ficar grande e destacado no celular; refine o
> layout/estética por cima desta base sem mudar o comportamento nem os contratos da API.

- [ ] **Step 1: Criar o cliente da API — `web/src/api.ts`**

```ts
// O app foi carregado pelo IP/host do PC; o servidor é o mesmo host na porta 3000.
const baseUrl = `http://${window.location.hostname}:3000`;

export interface Summoner {
  name: string;
  tagLine: string;
  level: number;
}

export async function getSummoner(): Promise<Summoner> {
  const res = await fetch(`${baseUrl}/api/summoner`);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
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

- [ ] **Step 2: Implementar a tela — `web/src/App.tsx`**

Substituir o conteúdo por:

```tsx
import { useEffect, useState } from "react";
import { App as AntApp, Badge, Button, Flex, Switch, Typography } from "antd";
import {
  getSummoner,
  accept,
  getAutoAccept,
  setAutoAccept,
  type Summoner,
} from "./api";

const { Title, Text } = Typography;

export default function App() {
  const { message } = AntApp.useApp();
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [online, setOnline] = useState(false);
  const [auto, setAuto] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Poll do status a cada 3s para refletir o LoL aberto/fechado.
  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const s = await getSummoner();
        if (alive) {
          setSummoner(s);
          setOnline(true);
        }
      } catch {
        if (alive) setOnline(false);
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      gap={32}
      style={{ minHeight: "100vh", padding: 24 }}
    >
      <Flex vertical align="center" gap={4}>
        <Badge
          status={online ? "success" : "default"}
          text={online ? "Conectado" : "LoL fechado"}
        />
        <Title level={2} style={{ margin: 0 }}>
          {summoner ? `${summoner.name}#${summoner.tagLine}` : "—"}
        </Title>
        {summoner && <Text type="secondary">Nível {summoner.level}</Text>}
      </Flex>

      <Button
        type="primary"
        size="large"
        block
        loading={accepting}
        disabled={!online}
        onClick={onAccept}
        style={{ height: 72, fontSize: 24, fontWeight: 700, maxWidth: 360 }}
      >
        ACEITAR
      </Button>

      <Flex align="center" gap={12}>
        <Text>Auto-aceitar</Text>
        <Switch checked={auto} onChange={onToggle} />
      </Flex>
    </Flex>
  );
}
```

- [ ] **Step 3: Typecheck do app**

Run (em `web/`): `npx tsc --noEmit`
Expected: sem erros de tipo.

- [ ] **Step 4: Verificação ponta a ponta (com o LoL aberto)**

1. Terminal A (em `server/`): `npm run dev` → confirmar `LoL detectado!`.
2. Terminal B (em `web/`): `npm run dev` → anotar a URL `Network: http://<IP>:5173/`.
3. No **PC**, abrir `http://localhost:5173`: deve mostrar **Conectado**, seu nick (ex.: `SOHTA#BR1`) e **Nível**.
4. No **celular** (mesmo Wi-Fi), abrir `http://<IP>:5173`: mesma tela. (Se não abrir, liberar a porta no Firewall do Windows — ver nota no README na Task 8.)
5. Ligar o **toggle Auto-aceitar** → toast "Auto-aceitar ligado".
6. Entrar numa fila no LoL e **esperar** a partida encontrada → deve ser aceita sozinha.
7. Repetir: desligar o toggle, entrar na fila, e apertar **ACEITAR** manualmente → partida aceita.

Expected: aceitar manual e automático funcionam do PC e do celular.

- [ ] **Step 5: Commit**

```bash
git add web/src/api.ts web/src/App.tsx
git commit -m "feat(web): tela de aceitar partida + toggle de auto-aceitar"
```

---

### Task 8: Documentação da sprint + README + suíte final

**Files:**
- Create: `docs/sprints/sprint-2.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: docs da entrega.

- [ ] **Step 1: Escrever `docs/sprints/sprint-2.md`**

```markdown
# Sprint 2 — Primeira Ação

## O que foi entregue
App do celular/PC (React + antd, tema do LoL) que aceita a partida por um botão
**ACEITAR** e por um **toggle de auto-aceitar** (o servidor aceita sozinho via polling).

## Como funciona (fluxo)
1. O app (Vite, porta 5173) descobre o servidor por `window.location.hostname:3000`.
2. Botão ACEITAR → `POST /api/accept`: o servidor lê a fase (`gameflow-phase`); se for
   `ReadyCheck`, chama `POST /lol-matchmaking/v1/ready-check/accept`.
3. Toggle → `POST /api/auto-accept {enabled}`: liga/desliga um serviço que, a cada 1s,
   repete a checagem acima e aceita sozinho quando a partida aparece.
4. O status (nick/conectado) vem de `GET /api/summoner`, consultado a cada 3s.

## Como testar
1. Abra o LoL e faça login.
2. `server/`: `npm install` e `npm run dev`.
3. `web/`: `npm install` e `npm run dev`.
4. No PC abra `http://localhost:5173`; no celular `http://IP-do-PC:5173` (mesmo Wi-Fi).
5. Entre na fila: teste o botão ACEITAR e o toggle de auto-aceitar.
6. Testes do servidor: em `server/`, `npm test`.

## Decisões e aprendizados
- Auto-aceitar por **polling** (1s) via REST; o WebSocket fica para a Sprint 3.
- `shouldAccept(phase)` isolada e testável; o loop e a conexão à LCU são finos.
- App e servidor em portas separadas com **CORS**; o app acha o IP sozinho pelo hostname.
- Tema do LoL via tokens do antd (`ConfigProvider`).
```

- [ ] **Step 2: Atualizar o `README.md` (rodar o `web/` + nota de Firewall)**

Na seção "Passos", logo depois do bloco do `server/`, acrescentar:

````markdown
Em outro terminal, subir o app do celular:
```bash
cd web
npm install
npm run dev
# PC:      http://localhost:5173
# Celular: http://IP-do-PC:5173  (mesmo Wi-Fi)
```

> **Firewall (Windows):** se o celular não abrir a página, libere as portas 5173 e 3000
> para a rede privada (Windows Defender Firewall → Regras de Entrada → Nova Regra → Porta).
````

- [ ] **Step 3: Rodar toda a suíte de testes do servidor**

Run (em `server/`): `npm test`
Expected: PASS — testes de `lockfile`, `credentials`, `connect`, `matchmaking`,
`should-accept` e `auto-accept-service` verdes.

- [ ] **Step 4: Commit**

```bash
git add docs/sprints/sprint-2.md README.md
git commit -m "docs: sprint 2 (primeira acao) + README com o app web"
```

---

## Self-Review (feita)

- **Cobertura do spec:**
  - Botão ACEITAR → Tasks 2, 5 (rota `/accept`), 7 (UI). ✅
  - Toggle auto-aceitar → Tasks 3, 4 (serviço), 5 (rotas), 7 (UI). ✅
  - Auto-aceitar por polling 1s → Task 4. ✅
  - App React+Vite+antd com tema LoL → Tasks 6, 7. ✅
  - CORS + descoberta por hostname → Tasks 5, 7. ✅
  - Tratamento de erros (LoL fechado 503, sem partida 409, servidor offline) → Tasks 5, 7. ✅
  - Testes unitários (shouldAccept, serviço) + manual → Tasks 3, 4, 5, 7. ✅
  - Docs (sprint-2.md + README) → Task 8. ✅
- **Placeholders:** nenhum "TBD/TODO"; todo passo tem código/comando completo. ✅
- **Consistência de tipos:** `connectToLcu(): AxiosInstance | null` (T1) usado por `pollAndAccept` (T4) e `actions` (T5); `getGameflowPhase`/`acceptReadyCheck` (T2) usados em T4/T5; `shouldAccept` (T3) em T4/T5; `autoAcceptService` (T4) em T5; contratos da API (`Summoner`, `/accept`, `/auto-accept`) batem entre T5 (servidor) e T7 (`api.ts`). ✅
