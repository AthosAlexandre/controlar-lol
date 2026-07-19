# LoL Modo Banheiro — App de Desktop — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empacotar o monorepo `server/` + `web/` num programa de PC ("LoL Modo Banheiro") com telinha (toggle + link + QR code), gerando um instalador `.exe` para Windows.

**Architecture:** Um app Electron controla o ciclo de vida. O `server` Express é refatorado para `startServer()/stopServer()`, passa a servir o `web` buildado (tudo na porta 3000) e é empacotado num único JS via esbuild. A telinha (renderer) liga/desliga o server por IPC e mostra o link da LAN + QR code.

**Tech Stack:** Node + TypeScript, Express, ws, React (web existente), Electron, electron-builder, esbuild, qrcode, vitest.

## Global Constraints

- Nome do programa: **LoL Modo Banheiro** (exato, com essa capitalização).
- Telinha 100% em **português**.
- Acesso **somente rede local** — nunca expor na internet; o token da LCU nunca sai do PC.
- Alvo do instalador: **Windows** (NSIS `.exe`).
- Server em CommonJS (manter `module: commonjs` do `server/tsconfig.json`).
- Porta padrão do server: **3000**.
- Node 18+ (usa `fetch` global e `os.networkInterfaces`).
- Não quebrar `npm run dev` do server nem os testes vitest existentes.

---

### Task 1: Tornar o gameflow watcher "parável"

Hoje `startGameflowWatcher()` reconecta com `setTimeout` para sempre e não pode ser parado. Para o toggle "desligar" funcionar, ele precisa retornar uma função de parada.

**Files:**
- Modify: `server/src/lcu/events.ts`
- Test: `server/src/lcu/events.test.ts` (já existe — adicionar caso)

**Interfaces:**
- Produces: `startGameflowWatcher(): () => void` — a função retornada, ao ser chamada, para as reconexões e fecha o WebSocket.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `server/src/lcu/events.test.ts`:

```ts
import { startGameflowWatcher } from "./events";

test("startGameflowWatcher retorna um stopper que não relança reconexão", () => {
  vi.useFakeTimers();
  // Sem LoL aberto, connect() cai em scheduleReconnect (setTimeout).
  const stop = startGameflowWatcher();
  expect(typeof stop).toBe("function");
  stop();
  // Avança o tempo: nenhuma reconexão deve ser agendada depois do stop.
  const pending = vi.getTimerCount();
  vi.advanceTimersByTime(10000);
  expect(vi.getTimerCount()).toBeLessThanOrEqual(pending);
  vi.useRealTimers();
});
```

Garantir que os imports `vi`, `test`, `expect` do vitest existam no topo do arquivo (o arquivo já usa vitest; adicionar `vi` ao import se faltar).

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd server && npx vitest run src/lcu/events.test.ts`
Expected: FAIL — `startGameflowWatcher` retorna `void` (não é função).

- [ ] **Step 3: Implementar o stopper**

Substituir a função `startGameflowWatcher` em `server/src/lcu/events.ts` por:

```ts
export function startGameflowWatcher(): () => void {
  let ws: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function scheduleReconnect() {
    if (stopped) return;
    gameState.setPhase("Offline");
    gameState.setSummoner(null);
    timer = setTimeout(connect, RECONNECT_MS);
  }

  async function primeInitialState() {
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
    if (stopped) return;
    const lockfile = readLockfile();
    if (!lockfile) {
      scheduleReconnect();
      return;
    }
    const creds = buildCredentials(lockfile);
    ws = new WebSocket(creds.baseUrl.replace("https", "wss"), {
      agent: new Agent({ rejectUnauthorized: false }),
      headers: { Authorization: creds.authHeader },
    });

    ws.on("open", () => {
      ws?.send(JSON.stringify([5, GAMEFLOW_EVENT]));
      void primeInitialState();
    });
    ws.on("message", (raw: WebSocket.RawData) => {
      const phase = parsePhaseFromMessage(raw.toString());
      if (phase) gameState.setPhase(normalizePhase(phase));
    });
    ws.on("close", scheduleReconnect);
    ws.on("error", () => ws?.close());
  }

  connect();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (ws) ws.close();
  };
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd server && npx vitest run src/lcu/events.test.ts`
Expected: PASS (o novo teste e os que já existiam).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/events.ts server/src/lcu/events.test.ts
git commit -m "refactor(server): gameflow watcher retorna stopper"
```

---

### Task 2: `createApp` / `startServer` / `stopServer` + servir o web estático

Extrair a lógica do `index.ts` para um módulo controlável que também serve os arquivos do web buildado.

**Files:**
- Create: `server/src/server.ts`
- Create: `server/src/server.test.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `startGameflowWatcher(): () => void` (Task 1).
- Produces:
  - `createApp(opts?: { webDistPath?: string }): import("express").Express`
  - `startServer(opts?: { port?: number; webDistPath?: string }): Promise<import("http").Server>`
  - `stopServer(): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/src/server.test.ts`:

```ts
import { describe, test, expect, afterEach } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { startServer, stopServer } from "./server";

afterEach(async () => {
  await stopServer();
});

describe("servidor controlável", () => {
  test("serve o index.html do web e para de escutar depois do stop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "web-dist-"));
    writeFileSync(join(dir, "index.html"), "<h1>Modo Banheiro</h1>");

    const server = await startServer({ port: 0, webDistPath: dir });
    const port = (server.address() as AddressInfo).port;

    const res = await fetch(`http://127.0.0.1:${port}/`);
    const body = await res.text();
    expect(res.status).toBe(200);
    expect(body).toContain("Modo Banheiro");

    await stopServer();

    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd server && npx vitest run src/server.test.ts`
Expected: FAIL — módulo `./server` não existe.

- [ ] **Step 3: Implementar `server.ts`**

Criar `server/src/server.ts`:

```ts
import express from "express";
import cors from "cors";
import http from "node:http";
import path from "node:path";
import { summonerRouter } from "./routes/summoner";
import { actionsRouter } from "./routes/actions";
import { eventsRouter } from "./routes/events";
import { champSelectRouter } from "./routes/champ-select";
import { runesRouter } from "./routes/runes";
import { startGameflowWatcher } from "./lcu/events";

export function createApp(opts: { webDistPath?: string } = {}): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", summonerRouter);
  app.use("/api", actionsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", champSelectRouter);
  app.use("/api", runesRouter);

  // Serve o app do celular (web buildado). SPA: qualquer rota não-/api cai no index.html.
  if (opts.webDistPath) {
    const dist = opts.webDistPath;
    app.use(express.static(dist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(dist, "index.html"));
    });
  }
  return app;
}

let server: http.Server | null = null;
let stopWatcher: (() => void) | null = null;

export function startServer(
  opts: { port?: number; webDistPath?: string } = {}
): Promise<http.Server> {
  const port = opts.port ?? 3000;
  const app = createApp({ webDistPath: opts.webDistPath });
  return new Promise((resolve, reject) => {
    const s = http.createServer(app);
    s.once("error", reject);
    // 0.0.0.0 permite acesso pelo celular na rede local.
    s.listen(port, "0.0.0.0", () => {
      server = s;
      stopWatcher = startGameflowWatcher();
      resolve(s);
    });
  });
}

export function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (stopWatcher) {
      stopWatcher();
      stopWatcher = null;
    }
    if (!server) return resolve();
    server.close(() => {
      server = null;
      resolve();
    });
  });
}
```

- [ ] **Step 4: Reescrever `index.ts` para usar `startServer` (mantém `npm run dev`)**

Substituir todo o conteúdo de `server/src/index.ts` por:

```ts
import path from "node:path";
import { startServer } from "./server";
import { readLockfile } from "./lcu/lockfile-reader";

const PORT = 3000;
// Em dev, o web pode não estar buildado; se existir, é servido também.
const webDist = path.resolve(__dirname, "../../web/dist");

startServer({ port: PORT, webDistPath: webDist }).then(() => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
  const lockfile = readLockfile();
  if (lockfile) {
    console.log(
      `LoL detectado! Porta: ${lockfile.port} | Token: ${lockfile.token.slice(0, 6)}…`
    );
  } else {
    console.log("LoL ainda não detectado (abra o cliente).");
  }
});
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `cd server && npx vitest run`
Expected: PASS (todos, incluindo `server.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add server/src/server.ts server/src/server.test.ts server/src/index.ts
git commit -m "feat(server): startServer/stopServer + serve web estatico"
```

---

### Task 3: Helper de IP da LAN (`pickLanIp` / `getLanUrl`)

Descobrir o endereço `http://<ip-da-LAN>:3000` para mostrar na telinha.

**Files:**
- Create: `server/src/net/lan.ts`
- Create: `server/src/net/lan.test.ts`

**Interfaces:**
- Produces:
  - `pickLanIp(interfaces: NodeJS.Dict<import("os").NetworkInterfaceInfo[]>): string | null`
  - `getLanUrl(port: number): string` — usa `os.networkInterfaces()`; devolve `http://<ip>:<port>` ou `http://localhost:<port>` se não achar LAN.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/src/net/lan.test.ts`:

```ts
import { test, expect } from "vitest";
import type { NetworkInterfaceInfo } from "node:os";
import { pickLanIp } from "./lan";

const ipv4 = (address: string, internal: boolean): NetworkInterfaceInfo =>
  ({ address, internal, family: "IPv4", netmask: "", mac: "", cidr: null } as NetworkInterfaceInfo);

test("pega o IPv4 privado da LAN, ignorando loopback", () => {
  const ifaces = {
    Loopback: [ipv4("127.0.0.1", true)],
    "Wi-Fi": [ipv4("192.168.0.15", false)],
  };
  expect(pickLanIp(ifaces)).toBe("192.168.0.15");
});

test("retorna null quando só há loopback", () => {
  expect(pickLanIp({ Loopback: [ipv4("127.0.0.1", true)] })).toBeNull();
});

test("aceita faixas 10.x e 172.16-31.x", () => {
  expect(pickLanIp({ eth: [ipv4("10.0.0.5", false)] })).toBe("10.0.0.5");
  expect(pickLanIp({ eth: [ipv4("172.20.1.2", false)] })).toBe("172.20.1.2");
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd server && npx vitest run src/net/lan.test.ts`
Expected: FAIL — módulo `./lan` não existe.

- [ ] **Step 3: Implementar `lan.ts`**

Criar `server/src/net/lan.ts`:

```ts
import os from "node:os";

function isPrivateIpv4(ip: string): boolean {
  return (
    /^192\.168\./.test(ip) ||
    /^10\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export function pickLanIp(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>
): string | null {
  for (const infos of Object.values(interfaces)) {
    if (!infos) continue;
    for (const info of infos) {
      if (info.family === "IPv4" && !info.internal && isPrivateIpv4(info.address)) {
        return info.address;
      }
    }
  }
  return null;
}

export function getLanUrl(port: number): string {
  const ip = pickLanIp(os.networkInterfaces());
  return `http://${ip ?? "localhost"}:${port}`;
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

Run: `cd server && npx vitest run src/net/lan.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/net/lan.ts server/src/net/lan.test.ts
git commit -m "feat(server): helper de IP da LAN (getLanUrl)"
```

---

### Task 4: Status do LoL + barrel `desktop-api` + bundle esbuild

Expor uma API única que o Electron consome, e empacotá-la num JS só (sem `node_modules`).

**Files:**
- Create: `server/src/lcu/status.ts`
- Create: `server/src/desktop-api.ts`
- Modify: `server/package.json` (script de bundle + devDep esbuild)

**Interfaces:**
- Consumes: `startServer`, `stopServer` (Task 2), `getLanUrl` (Task 3).
- Produces:
  - `isLolRunning(): boolean` — `true` se o lockfile existir.
  - Bundle CJS em `server/dist/server.bundle.js` exportando `{ startServer, stopServer, getLanUrl, isLolRunning }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `server/src/lcu/status.test.ts`:

```ts
import { test, expect } from "vitest";
import { isLolRunning } from "./status";

test("isLolRunning é false quando o lockfile não existe", () => {
  // Em ambiente de teste o LoL não está aberto no caminho padrão.
  expect(isLolRunning()).toBe(false);
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `cd server && npx vitest run src/lcu/status.test.ts`
Expected: FAIL — módulo `./status` não existe.

- [ ] **Step 3: Implementar `status.ts` e o barrel `desktop-api.ts`**

Criar `server/src/lcu/status.ts`:

```ts
import { readLockfile } from "./lockfile-reader";

/** true se o cliente do LoL está aberto (lockfile presente). */
export function isLolRunning(): boolean {
  return readLockfile() !== null;
}
```

Criar `server/src/desktop-api.ts`:

```ts
// Superfície única consumida pelo app Electron.
export { startServer, stopServer } from "./server";
export { getLanUrl } from "./net/lan";
export { isLolRunning } from "./lcu/status";
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `cd server && npx vitest run src/lcu/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Adicionar esbuild e o script de bundle**

Em `server/package.json`, adicionar em `devDependencies`:

```json
"esbuild": "^0.24.0"
```

E em `scripts`:

```json
"build:bundle": "esbuild src/desktop-api.ts --bundle --platform=node --format=cjs --outfile=dist/server.bundle.js --external:electron"
```

Rodar:

```bash
cd server && npm install && npm run build:bundle
```

- [ ] **Step 6: Verificar o bundle**

Run: `cd server && node -e "const a=require('./dist/server.bundle.js'); console.log(Object.keys(a).sort().join(','))"`
Expected: imprime `getLanUrl,isLolRunning,startServer,stopServer`

- [ ] **Step 7: Commit**

```bash
git add server/src/lcu/status.ts server/src/lcu/status.test.ts server/src/desktop-api.ts server/package.json server/package-lock.json
git commit -m "feat(server): status do LoL + barrel desktop-api + bundle esbuild"
```

---

### Task 5: Web — chamadas na mesma origem

Como o web agora é servido pela porta 3000, o `baseUrl` deve ser a própria origem da página.

**Files:**
- Modify: `web/src/api.ts:1-2`

**Interfaces:**
- Produces: `web/dist/` (via `npm run build`) servível pelo server.

- [ ] **Step 1: Trocar o baseUrl**

Em `web/src/api.ts`, substituir as duas primeiras linhas:

```ts
// O app foi carregado pelo IP/host do PC; o servidor é o mesmo host na porta 3000.
const baseUrl = `http://${window.location.hostname}:3000`;
```

por:

```ts
// O app é servido pelo próprio servidor (porta 3000); use a mesma origem da página.
const baseUrl = window.location.origin;
```

- [ ] **Step 2: Buildar o web**

Run: `cd web && npm install && npm run build`
Expected: build OK; pasta `web/dist/` criada com `index.html`.

- [ ] **Step 3: Verificação manual rápida (fim-a-fim local)**

Com o LoL aberto:
```bash
cd server && npm run build:bundle   # garante server pronto
cd server && npm run dev            # serve web/dist na 3000
```
Abrir `http://localhost:3000` no navegador do PC → a UI do app deve carregar e as chamadas `/api/...` funcionarem (aba Network sem erros de CORS/origem).

- [ ] **Step 4: Commit**

```bash
git add web/src/api.ts web/package-lock.json
git commit -m "feat(web): chamadas na mesma origem (servido pelo server)"
```

---

### Task 6: Electron — scaffold, main process e preload (IPC)

Criar o pacote `desktop/` com o processo principal do Electron que controla o server.

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/src/main.ts`
- Create: `desktop/src/preload.ts`
- Create: `desktop/src/paths.ts`

**Interfaces:**
- Consumes: bundle `server/dist/server.bundle.js` → `{ startServer, stopServer, getLanUrl, isLolRunning }`.
- Produces (IPC, expostos em `window.banheiro` pelo preload):
  - `enable(): Promise<{ url: string; qr: string }>` — sobe o server, devolve URL da LAN e QR (data URL).
  - `disable(): Promise<void>` — para o server.
  - `lolStatus(): Promise<boolean>` — LoL detectado?

- [ ] **Step 1: Criar `desktop/package.json`**

```json
{
  "name": "lol-modo-banheiro-desktop",
  "version": "0.1.0",
  "private": true,
  "main": "build/main.js",
  "scripts": {
    "build:ts": "tsc -p tsconfig.json",
    "copy:renderer": "node -e \"const fs=require('fs');fs.mkdirSync('build/renderer',{recursive:true});fs.copyFileSync('src/renderer/index.html','build/renderer/index.html')\"",
    "build": "npm run build:ts && npm run copy:renderer",
    "start": "npm run build && electron .",
    "dist": "electron-builder"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.5.0"
  },
  "dependencies": {
    "qrcode": "^1.5.4"
  }
}
```

- [ ] **Step 2: Criar `desktop/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "build",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Criar `desktop/src/paths.ts` (resolve recursos em dev e empacotado)**

```ts
import path from "node:path";
import { app } from "electron";

/**
 * Em dev: recursos ficam nas pastas irmãs (../server, ../web).
 * Empacotado (electron-builder extraResources): ficam em process.resourcesPath.
 */
export function resourcePath(...parts: string[]): string {
  const base = app.isPackaged
    ? process.resourcesPath
    : path.resolve(__dirname, "..", "..");
  return path.join(base, ...parts);
}

export const SERVER_BUNDLE = () => resourcePath("server", "dist", "server.bundle.js");
export const WEB_DIST = () => resourcePath("web", "dist");
```

- [ ] **Step 4: Criar `desktop/src/main.ts`**

```ts
import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import QRCode from "qrcode";
import { SERVER_BUNDLE, WEB_DIST } from "./paths";

const PORT = 3000;

type Backend = {
  startServer(opts: { port?: number; webDistPath?: string }): Promise<unknown>;
  stopServer(): Promise<void>;
  getLanUrl(port: number): string;
  isLolRunning(): boolean;
};

function backend(): Backend {
  // require dinâmico: bundle CJS único, sem node_modules externos.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(SERVER_BUNDLE()) as Backend;
}

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 560,
    resizable: false,
    title: "LoL Modo Banheiro",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  void win.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("remote:enable", async () => {
  const b = backend();
  await b.startServer({ port: PORT, webDistPath: WEB_DIST() });
  const url = b.getLanUrl(PORT);
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  return { url, qr };
});

ipcMain.handle("remote:disable", async () => {
  await backend().stopServer();
});

ipcMain.handle("lol:status", async () => backend().isLolRunning());

app.whenReady().then(createWindow);

app.on("window-all-closed", async () => {
  // Sem system tray: fechar a janela para o server e encerra o app.
  try {
    await backend().stopServer();
  } catch {
    // se o server nunca subiu, ignora
  }
  app.quit();
});
```

- [ ] **Step 5: Criar `desktop/src/preload.ts`**

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("banheiro", {
  enable: (): Promise<{ url: string; qr: string }> =>
    ipcRenderer.invoke("remote:enable"),
  disable: (): Promise<void> => ipcRenderer.invoke("remote:disable"),
  lolStatus: (): Promise<boolean> => ipcRenderer.invoke("lol:status"),
});
```

- [ ] **Step 6: Instalar deps do desktop**

Run: `cd desktop && npm install`
Expected: instala electron, electron-builder, qrcode.

- [ ] **Step 7: Commit** (a telinha vem na Task 7; o `electron .` só roda depois dela)

```bash
git add desktop/package.json desktop/tsconfig.json desktop/src/paths.ts desktop/src/main.ts desktop/src/preload.ts desktop/package-lock.json
git commit -m "feat(desktop): main process + preload (IPC liga/desliga)"
```

---

### Task 7: Telinha (renderer) — toggle + link + copiar + QR

A UI local do programa. HTML + TS simples (sem framework — é um painel pequeno; YAGNI).

**Files:**
- Create: `desktop/src/renderer/index.html`
- Create: `desktop/src/renderer/renderer.ts`
- Modify: `desktop/tsconfig.json` (garantir que `src/renderer/*.ts` compila para `build/renderer/`)

**Interfaces:**
- Consumes: `window.banheiro.enable/disable/lolStatus` (Task 6).

- [ ] **Step 1: Ajustar o tsconfig para compilar o renderer no lugar certo**

O `outDir: build` + `rootDir: src` já faz `src/renderer/renderer.ts` → `build/renderer/renderer.js`. Confirmar que o `include` cobre `src/**/*.ts` (já está na Task 6). Nada a mudar se já estiver assim.

- [ ] **Step 2: Criar `desktop/src/renderer/index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LoL Modo Banheiro</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0; font-family: "Segoe UI", system-ui, sans-serif;
        background: #0f1420; color: #e8ecf3; padding: 20px;
        text-align: center;
      }
      h1 { font-size: 20px; margin: 4px 0 2px; }
      .sub { color: #9aa4b2; font-size: 13px; margin-bottom: 18px; }
      .status { font-size: 14px; margin-bottom: 16px; }
      .status.on { color: #3fb950; }
      .status.off { color: #d29922; }
      button.toggle {
        width: 100%; padding: 14px; font-size: 16px; font-weight: 600;
        border: none; border-radius: 10px; cursor: pointer; color: #fff;
        background: #2563eb;
      }
      button.toggle.ligado { background: #dc2626; }
      .painel { margin-top: 18px; display: none; }
      .painel.show { display: block; }
      .url {
        display: flex; gap: 8px; margin: 10px 0;
      }
      .url input {
        flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #2a3040;
        background: #161b26; color: #e8ecf3; font-size: 14px;
      }
      .url button {
        padding: 10px 12px; border: none; border-radius: 8px; cursor: pointer;
        background: #2a3040; color: #e8ecf3;
      }
      img.qr { width: 220px; height: 220px; border-radius: 10px; background: #fff; padding: 6px; }
      .dica { color: #9aa4b2; font-size: 12px; margin-top: 12px; line-height: 1.5; }
    </style>
  </head>
  <body>
    <h1>🚽 LoL Modo Banheiro</h1>
    <div class="sub">Controle o LoL pelo celular na mesma rede Wi-Fi</div>

    <div id="status" class="status off">Verificando o LoL…</div>

    <button id="toggle" class="toggle">Habilitar modo remoto</button>

    <div id="painel" class="painel">
      <div class="url">
        <input id="link" readonly />
        <button id="copiar">Copiar</button>
      </div>
      <img id="qr" class="qr" alt="QR code" />
      <div class="dica">
        No celular: abra a câmera e aponte no QR, ou digite o link no navegador.<br />
        Precisa do LoL aberto e do celular no mesmo Wi-Fi.
      </div>
    </div>

    <script src="./renderer.js"></script>
  </body>
</html>
```

- [ ] **Step 3: Criar `desktop/src/renderer/renderer.ts`**

```ts
declare global {
  interface Window {
    banheiro: {
      enable(): Promise<{ url: string; qr: string }>;
      disable(): Promise<void>;
      lolStatus(): Promise<boolean>;
    };
  }
}

const toggle = document.getElementById("toggle") as HTMLButtonElement;
const painel = document.getElementById("painel") as HTMLDivElement;
const linkInput = document.getElementById("link") as HTMLInputElement;
const copiarBtn = document.getElementById("copiar") as HTMLButtonElement;
const qrImg = document.getElementById("qr") as HTMLImageElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

let ligado = false;

async function atualizarStatus() {
  const on = await window.banheiro.lolStatus();
  statusEl.textContent = on ? "LoL detectado ✅" : "Abra o cliente do LoL";
  statusEl.className = "status " + (on ? "on" : "off");
}

toggle.addEventListener("click", async () => {
  if (!ligado) {
    const { url, qr } = await window.banheiro.enable();
    linkInput.value = url;
    qrImg.src = qr;
    painel.classList.add("show");
    toggle.textContent = "Desligar modo remoto";
    toggle.classList.add("ligado");
    ligado = true;
  } else {
    await window.banheiro.disable();
    painel.classList.remove("show");
    toggle.textContent = "Habilitar modo remoto";
    toggle.classList.remove("ligado");
    ligado = false;
  }
});

copiarBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(linkInput.value);
  copiarBtn.textContent = "Copiado!";
  setTimeout(() => (copiarBtn.textContent = "Copiar"), 1500);
});

void atualizarStatus();
setInterval(() => void atualizarStatus(), 4000);

export {};
```

- [ ] **Step 4: Rodar o app em dev e verificar a telinha**

Pré-requisitos: `web/dist` e `server/dist/server.bundle.js` já existem (Tasks 4 e 5).
Run: `cd desktop && npm run start`
Expected:
- Abre a janela "LoL Modo Banheiro".
- Status mostra "LoL detectado ✅" (com LoL aberto) ou "Abra o cliente do LoL".
- Clicar em "Habilitar modo remoto" → aparece link `http://<ip>:3000`, botão Copiar e QR.
- Abrir o link em outro dispositivo na mesma rede carrega o app do celular.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/renderer/index.html desktop/src/renderer/renderer.ts
git commit -m "feat(desktop): telinha (toggle + link + copiar + QR)"
```

---

### Task 8: Empacotamento — electron-builder + build orquestrado

Gerar o instalador `.exe`. Empacotar o bundle do server, o web buildado e a telinha.

**Files:**
- Create: `desktop/electron-builder.yml`
- Modify: `desktop/package.json` (script `dist` já existe; garantir pré-build)
- Create: `build-all.ps1` (script raiz que builda web + server + desktop e empacota)

**Interfaces:**
- Consome os artefatos: `web/dist`, `server/dist/server.bundle.js`, `desktop/build`.
- Produz: `desktop/release/LoL Modo Banheiro Setup <versão>.exe`.

- [ ] **Step 1: Criar `desktop/electron-builder.yml`**

```yaml
appId: com.multidrop.lolmodobanheiro
productName: LoL Modo Banheiro
directories:
  output: release
files:
  - build/**/*
  - package.json
extraResources:
  - from: ../server/dist/server.bundle.js
    to: server/dist/server.bundle.js
  - from: ../web/dist
    to: web/dist
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  shortcutName: LoL Modo Banheiro
```

- [ ] **Step 2: Criar `build-all.ps1` na raiz do repo**

```powershell
# Builda tudo e gera o instalador do "LoL Modo Banheiro".
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==> Build web" -ForegroundColor Cyan
Push-Location "$root/web"; npm install; npm run build; Pop-Location

Write-Host "==> Build server (bundle)" -ForegroundColor Cyan
Push-Location "$root/server"; npm install; npm run build:bundle; Pop-Location

Write-Host "==> Build desktop + instalador" -ForegroundColor Cyan
Push-Location "$root/desktop"; npm install; npm run build; npm run dist; Pop-Location

Write-Host "==> Pronto! Instalador em desktop/release" -ForegroundColor Green
```

- [ ] **Step 3: Ajustar `.gitignore`**

Adicionar (se ainda não houver) na raiz `.gitignore`:

```
web/dist/
server/dist/
desktop/build/
desktop/release/
```

- [ ] **Step 4: Gerar o instalador**

Run (na raiz do repo): `pwsh -File build-all.ps1`  (ou `powershell -File build-all.ps1`)
Expected: termina com "Pronto!" e cria `desktop/release/LoL Modo Banheiro Setup 0.1.0.exe`.

- [ ] **Step 5: Verificação — instalar e rodar**

- Rodar o `.exe` gerado → instala o programa.
- Abrir "LoL Modo Banheiro" pelo menu Iniciar.
- Com o LoL aberto: ligar o modo remoto, abrir o link no celular, **aceitar uma partida** pelo celular.

- [ ] **Step 6: Commit**

```bash
git add desktop/electron-builder.yml build-all.ps1 .gitignore
git commit -m "build(desktop): electron-builder + script build-all (instalador .exe)"
```

---

### Task 9: Documentação — README + guia do amigo

Documentar como gerar o instalador e como o amigo instala/usa.

**Files:**
- Modify: `README.md`
- Create: `docs/como-instalar-amigo.md`

- [ ] **Step 1: Criar `docs/como-instalar-amigo.md`**

```markdown
# LoL Modo Banheiro — Guia rápido (para os amigos)

1. Baixe o arquivo **LoL Modo Banheiro Setup.exe** e instale (dois cliques).
2. Abra o programa **LoL Modo Banheiro**.
3. Com o **League of Legends aberto**, clique em **"Habilitar modo remoto"**.
4. Aponte a câmera do celular no **QR code** (ou copie o link e cole no navegador).
5. Pronto! Pelo celular dá para acompanhar a fila, aceitar partida, escolher
   campeão e trocar runas.

## Requisitos
- **League of Legends aberto** no PC.
- **PC e celular na mesma rede Wi-Fi**.
- Na 1ª vez o **Windows pode pedir permissão de firewall** → clique em **Permitir**.

## É seguro?
Sim. Não é hack: usa só a API local e oficial do próprio cliente do LoL, e funciona
**apenas na sua rede local** — nada é exposto na internet.
```

- [ ] **Step 2: Atualizar o README**

Adicionar uma seção após "Como rodar" no `README.md`:

```markdown
## Programa de PC (LoL Modo Banheiro)

Para distribuir para amigos como um programa instalável (sem terminal):

```powershell
# na raiz do repo — gera o instalador em desktop/release/
pwsh -File build-all.ps1
```

O amigo instala o `.exe`, abre o programa, clica em **"Habilitar modo remoto"** e
usa o link/QR no celular. Guia do amigo: [`docs/como-instalar-amigo.md`](docs/como-instalar-amigo.md).

Design: [`docs/superpowers/specs/2026-07-19-lol-modo-banheiro-desktop-design.md`](docs/superpowers/specs/2026-07-19-lol-modo-banheiro-desktop-design.md)
```

- [ ] **Step 3: Commit**

```bash
git add README.md docs/como-instalar-amigo.md
git commit -m "docs: guia de instalação do LoL Modo Banheiro (amigos + build)"
```

---

## Notas de execução

- **Ordem obrigatória:** Task 4 (bundle) e Task 5 (web build) precisam estar prontas antes de rodar o desktop (Task 7 Step 4).
- **`app.get("*")` no Express 4:** funciona (o projeto usa express ^4.19). Não migrar para express 5 neste plano.
- **Firewall:** no primeiro `enable`, o Windows mostra o popup de permissão — é esperado.
- **Reconexão do watcher:** o `stopServer` para o watcher; sem isso, o toggle "desligar" deixaria timers rodando.
