# Sprint 1 — A Ponte (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um servidor Node+TypeScript que roda no PC, encontra o cliente do LoL aberto, lê o `lockfile`, autentica na LCU API e expõe `GET /api/summoner` retornando o nick do jogador.

**Architecture:** Camada `lcu/` isolada e testável (parsing do lockfile → credenciais → cliente HTTP), consumida por uma rota Express fina. Funções puras têm teste unitário; a chamada real à LCU é validada manualmente com o cliente aberto.

**Tech Stack:** Node.js, TypeScript, Express, axios, vitest (testes), tsx (executar TS em dev).

## Global Constraints

- Todo o código do servidor fica em `server/`.
- TypeScript `strict: true`.
- Módulos CommonJS (`module: commonjs`) — imports sem extensão de arquivo.
- Nomes de arquivos e código em inglês; comentários e docs em português.
- Certificado autoassinado da LCU é aceito **apenas** em conexões para `127.0.0.1`.
- Nunca logar o token completo (logar no máximo os primeiros 6 caracteres).
- Documentação faz parte da entrega: ao fim do sprint, `docs/sprints/sprint-1.md` e o README atualizados.

---

## File Structure

```
server/
├── package.json                → deps e scripts (dev, test)
├── tsconfig.json               → config TS (commonjs, strict)
└── src/
    ├── lcu/
    │   ├── lockfile.ts         → parseLockfile(content) — função pura
    │   ├── lockfile.test.ts    → testes do parser
    │   ├── lockfile-reader.ts  → readLockfile(path) — lê o arquivo do disco
    │   ├── credentials.ts      → buildCredentials(data) — baseUrl + header auth
    │   ├── credentials.test.ts → testes das credenciais
    │   └── client.ts           → createLcuClient(creds) — axios + https agent
    ├── routes/
    │   └── summoner.ts         → GET /summoner
    └── index.ts                → Express + log de detecção
```

---

### Task 1: Scaffold do servidor + parser do lockfile

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/src/lcu/lockfile.ts`
- Test: `server/src/lcu/lockfile.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `interface LockfileData { process: string; pid: number; port: number; token: string; protocol: string }` e `parseLockfile(content: string): LockfileData`.

- [ ] **Step 1: Criar `server/package.json`**

```json
{
  "name": "lol-remote-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "axios": "^1.7.0",
    "express": "^4.19.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Criar `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Instalar dependências**

Run (a partir de `server/`): `npm install`
Expected: cria `node_modules/` e `package-lock.json` sem erros.

- [ ] **Step 4: Escrever o teste que falha — `server/src/lcu/lockfile.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { parseLockfile } from "./lockfile";

describe("parseLockfile", () => {
  it("extrai os 5 campos do lockfile", () => {
    const result = parseLockfile("LeagueClient:12345:54321:AbCdEf123456:https");
    expect(result).toEqual({
      process: "LeagueClient",
      pid: 12345,
      port: 54321,
      token: "AbCdEf123456",
      protocol: "https",
    });
  });

  it("ignora espaços/quebras de linha nas pontas", () => {
    const result = parseLockfile("LeagueClient:1:2:tok:https\n");
    expect(result.port).toBe(2);
    expect(result.protocol).toBe("https");
  });

  it("lança erro se o número de campos for diferente de 5", () => {
    expect(() => parseLockfile("so:tres:campos")).toThrow();
  });
});
```

- [ ] **Step 5: Rodar o teste e confirmar que falha**

Run (em `server/`): `npx vitest run src/lcu/lockfile.test.ts`
Expected: FAIL — `parseLockfile` não existe / módulo não encontrado.

- [ ] **Step 6: Implementar `server/src/lcu/lockfile.ts`**

```ts
/** Dados extraídos do lockfile do cliente do LoL. */
export interface LockfileData {
  process: string;
  pid: number;
  port: number;
  token: string;
  protocol: string;
}

/**
 * Faz o parse do conteúdo do lockfile.
 * Formato: "NomeProcesso:PID:PORTA:TOKEN:PROTOCOLO" (separado por ':').
 */
export function parseLockfile(content: string): LockfileData {
  const parts = content.trim().split(":");
  if (parts.length !== 5) {
    throw new Error(`Lockfile inválido: esperava 5 campos, recebi ${parts.length}`);
  }
  const [process, pid, port, token, protocol] = parts;
  return {
    process,
    pid: Number(pid),
    port: Number(port),
    token,
    protocol,
  };
}
```

- [ ] **Step 7: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lcu/lockfile.test.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/tsconfig.json server/package-lock.json server/src/lcu/lockfile.ts server/src/lcu/lockfile.test.ts
git commit -m "feat(server): scaffold + parser do lockfile"
```

---

### Task 2: Ler o lockfile do disco

**Files:**
- Create: `server/src/lcu/lockfile-reader.ts`

**Interfaces:**
- Consumes: `parseLockfile`, `LockfileData` (Task 1).
- Produces: `DEFAULT_LOCKFILE_PATH: string` e `readLockfile(path?: string): LockfileData | null` (retorna `null` quando o LoL está fechado / arquivo ausente).

- [ ] **Step 1: Escrever o teste que falha — adicionar em `server/src/lcu/lockfile.test.ts`**

```ts
import { readLockfile } from "./lockfile-reader";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("readLockfile", () => {
  it("retorna null quando o arquivo não existe", () => {
    const caminhoInexistente = join(tmpdir(), "lockfile-que-nao-existe-xyz");
    expect(readLockfile(caminhoInexistente)).toBeNull();
  });

  it("lê e faz o parse de um lockfile real no disco", () => {
    const caminho = join(tmpdir(), "lockfile-teste");
    writeFileSync(caminho, "LeagueClient:1:2:tok:https");
    try {
      expect(readLockfile(caminho)).toMatchObject({ port: 2, token: "tok" });
    } finally {
      rmSync(caminho, { force: true });
    }
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/lockfile.test.ts`
Expected: FAIL — `readLockfile` não existe.

- [ ] **Step 3: Implementar `server/src/lcu/lockfile-reader.ts`**

```ts
import { readFileSync } from "node:fs";
import { parseLockfile, LockfileData } from "./lockfile";

/** Caminho padrão do lockfile numa instalação em C:\Riot Games. */
export const DEFAULT_LOCKFILE_PATH =
  "C:\\Riot Games\\League of Legends\\lockfile";

/**
 * Lê o lockfile do disco e faz o parse.
 * Retorna null se o arquivo não existir (LoL fechado); relança outros erros.
 */
export function readLockfile(
  path: string = DEFAULT_LOCKFILE_PATH
): LockfileData | null {
  try {
    const content = readFileSync(path, "utf8");
    return parseLockfile(content);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null; // LoL fechado — não é erro
    }
    throw err;
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/lockfile.test.ts`
Expected: PASS (5 testes verdes no total).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/lockfile-reader.ts server/src/lcu/lockfile.test.ts
git commit -m "feat(server): leitura do lockfile do disco"
```

---

### Task 3: Montar as credenciais da LCU

**Files:**
- Create: `server/src/lcu/credentials.ts`
- Test: `server/src/lcu/credentials.test.ts`

**Interfaces:**
- Consumes: `LockfileData` (Task 1).
- Produces: `interface LcuCredentials { baseUrl: string; authHeader: string }` e `buildCredentials(data: LockfileData): LcuCredentials`.

- [ ] **Step 1: Escrever o teste que falha — `server/src/lcu/credentials.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildCredentials } from "./credentials";

describe("buildCredentials", () => {
  const data = {
    process: "LeagueClient",
    pid: 1,
    port: 54321,
    token: "segredo",
    protocol: "https",
  };

  it("monta a baseUrl com protocolo, 127.0.0.1 e porta", () => {
    expect(buildCredentials(data).baseUrl).toBe("https://127.0.0.1:54321");
  });

  it("monta o header Basic com base64 de 'riot:TOKEN'", () => {
    const esperado = "Basic " + Buffer.from("riot:segredo").toString("base64");
    expect(buildCredentials(data).authHeader).toBe(esperado);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/credentials.test.ts`
Expected: FAIL — `buildCredentials` não existe.

- [ ] **Step 3: Implementar `server/src/lcu/credentials.ts`**

```ts
import { LockfileData } from "./lockfile";

/** Credenciais prontas para falar com a LCU API local. */
export interface LcuCredentials {
  baseUrl: string;
  authHeader: string;
}

/**
 * Constrói baseUrl e header de autenticação a partir dos dados do lockfile.
 * A LCU usa HTTP Basic com usuário fixo "riot" e o token como senha.
 */
export function buildCredentials(data: LockfileData): LcuCredentials {
  const token = Buffer.from(`riot:${data.token}`).toString("base64");
  return {
    baseUrl: `${data.protocol}://127.0.0.1:${data.port}`,
    authHeader: `Basic ${token}`,
  };
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/credentials.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/credentials.ts server/src/lcu/credentials.test.ts
git commit -m "feat(server): montagem das credenciais da LCU"
```

---

### Task 4: Cliente HTTP da LCU (axios + certificado autoassinado)

**Files:**
- Create: `server/src/lcu/client.ts`

**Interfaces:**
- Consumes: `LcuCredentials` (Task 3).
- Produces: `createLcuClient(creds: LcuCredentials): AxiosInstance` — instância axios com `baseURL`, header de auth e agente HTTPS que aceita o certificado autoassinado.

- [ ] **Step 1: Escrever o teste que falha — adicionar em `server/src/lcu/credentials.test.ts`**

```ts
import { createLcuClient } from "./client";

describe("createLcuClient", () => {
  it("cria uma instância axios com baseURL e header de auth", () => {
    const creds = { baseUrl: "https://127.0.0.1:1234", authHeader: "Basic xyz" };
    const client = createLcuClient(creds);
    expect(client.defaults.baseURL).toBe("https://127.0.0.1:1234");
    expect(client.defaults.headers.Authorization).toBe("Basic xyz");
    expect(client.defaults.httpsAgent).toBeDefined();
  });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx vitest run src/lcu/credentials.test.ts`
Expected: FAIL — `createLcuClient` não existe.

- [ ] **Step 3: Implementar `server/src/lcu/client.ts`**

```ts
import axios, { AxiosInstance } from "axios";
import { Agent } from "node:https";
import { LcuCredentials } from "./credentials";

/**
 * Cria um cliente axios pronto para falar com a LCU.
 * A LCU usa um certificado autoassinado da Riot; como só falamos com
 * 127.0.0.1 (a própria máquina), aceitamos esse certificado.
 */
export function createLcuClient(creds: LcuCredentials): AxiosInstance {
  return axios.create({
    baseURL: creds.baseUrl,
    headers: { Authorization: creds.authHeader },
    httpsAgent: new Agent({ rejectUnauthorized: false }),
  });
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lcu/credentials.test.ts`
Expected: PASS (3 testes verdes no arquivo).

- [ ] **Step 5: Commit**

```bash
git add server/src/lcu/client.ts server/src/lcu/credentials.test.ts
git commit -m "feat(server): cliente HTTP da LCU com certificado autoassinado"
```

---

### Task 5: Rota `GET /api/summoner` + servidor Express + doc do sprint

**Files:**
- Create: `server/src/routes/summoner.ts`
- Create: `server/src/index.ts`
- Create: `docs/sprints/sprint-1.md`
- Modify: `README.md` (seção "Como rodar")

**Interfaces:**
- Consumes: `readLockfile` (Task 2), `buildCredentials` (Task 3), `createLcuClient` (Task 4).
- Produces: `summonerRouter` (Express Router montado em `/api`); servidor escutando na porta 3000 em `0.0.0.0`.

- [ ] **Step 1: Implementar `server/src/routes/summoner.ts`**

```ts
import { Router } from "express";
import { readLockfile } from "../lcu/lockfile-reader";
import { buildCredentials } from "../lcu/credentials";
import { createLcuClient } from "../lcu/client";

export const summonerRouter = Router();

/** Retorna o invocador atual logado no cliente do LoL. */
summonerRouter.get("/summoner", async (_req, res) => {
  const lockfile = readLockfile();
  if (!lockfile) {
    return res
      .status(503)
      .json({ error: "LoL não está aberto (lockfile não encontrado)" });
  }
  try {
    const client = createLcuClient(buildCredentials(lockfile));
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

- [ ] **Step 2: Implementar `server/src/index.ts`**

```ts
import express from "express";
import { readLockfile } from "./lcu/lockfile-reader";
import { summonerRouter } from "./routes/summoner";

const PORT = 3000;

const app = express();
app.use(express.json());
app.use("/api", summonerRouter);

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

- [ ] **Step 3: Subir o servidor e testar manualmente (com o cliente do LoL aberto)**

Run (em `server/`): `npm run dev`
Expected no terminal: `Servidor rodando em http://0.0.0.0:3000` e `LoL detectado! Porta: … | Token: …`.

Em outro terminal, testar a rota:
Run: `curl http://localhost:3000/api/summoner`
Expected: JSON com `name` (seu nick), `tagLine` e `level`.

- [ ] **Step 4: Escrever `docs/sprints/sprint-1.md`**

```markdown
# Sprint 1 — A Ponte

## O que foi entregue
Servidor Node+TypeScript que detecta o cliente do LoL aberto, lê o lockfile,
autentica na LCU API e expõe `GET /api/summoner` retornando o nick do jogador.

## Como funciona (fluxo)
1. `readLockfile()` lê `C:\Riot Games\League of Legends\lockfile`.
2. `parseLockfile()` extrai porta e token.
3. `buildCredentials()` monta baseUrl (`https://127.0.0.1:PORTA`) e header Basic.
4. `createLcuClient()` cria um axios que aceita o certificado autoassinado.
5. A rota chama `GET /lol-summoner/v1/current-summoner` e devolve o nick.

## Como testar
1. Abra o cliente do LoL e faça login.
2. Em `server/`: `npm install` e depois `npm run dev`.
3. Confira no terminal a linha `LoL detectado!`.
4. `curl http://localhost:3000/api/summoner` → deve retornar seu nick.
5. Testes unitários: `npm test`.

## Decisões e aprendizados
- Camada `lcu/` separada em funções puras (parse, credenciais) testáveis sem o
  jogo aberto; só a chamada real depende do cliente.
- Certificado autoassinado aceito apenas para 127.0.0.1.
- `readLockfile` retorna `null` (em vez de quebrar) quando o LoL está fechado.
```

- [ ] **Step 5: Atualizar a seção "Como rodar" do `README.md`**

Substituir o bloco de código placeholder da seção "Passos" por:

```bash
cd server
npm install
npm run dev
# Servidor em http://0.0.0.0:3000
# Teste: curl http://localhost:3000/api/summoner
```

- [ ] **Step 6: Rodar toda a suíte de testes**

Run (em `server/`): `npm test`
Expected: PASS — todos os testes de `lockfile.test.ts` e `credentials.test.ts` verdes.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/summoner.ts server/src/index.ts docs/sprints/sprint-1.md README.md
git commit -m "feat(server): rota /api/summoner + servidor Express + doc do sprint 1"
```

---

## Self-Review (feita)

- **Cobertura do spec:** o entregável do Sprint 1 ("terminal mostra Porta/Token; `GET /api/summoner` retorna o nick") está coberto pelas Tasks 1–5. ✅
- **Placeholders:** nenhum "TBD"/"TODO"; todo passo tem código completo. ✅
- **Consistência de tipos:** `LockfileData` (Task 1) → `readLockfile` (Task 2) / `buildCredentials` (Task 3) → `LcuCredentials` → `createLcuClient` (Task 4) → rota (Task 5). Nomes batem em todas as tasks. ✅
- **Documentação:** incluída como parte da entrega (Task 5 gera `docs/sprints/sprint-1.md` e atualiza o README). ✅
