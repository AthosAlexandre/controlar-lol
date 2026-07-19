# LoL Modo Banheiro — App de Desktop (distribuição) — Design

**Data:** 2026-07-19
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Transformar o projeto (hoje um monorepo `server/` + `web/` que roda via `npm run dev`)
em um **programa de PC** fácil de instalar e usar, para que amigos leigos consigam usar
o "Modo Banheiro" sem tocar em terminal, Node ou `npm`.

O amigo baixa **um instalador**, abre o programa, vê uma **telinha** com um botão
"Habilitar modo remoto", e ao ligar aparece um **link (URL)** e um **QR code** para
abrir no celular. A partir daí ele usa exatamente a mesma experiência de hoje.

**Nome do programa:** `LoL Modo Banheiro`.
**Idioma da telinha:** somente português.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Formato de distribuição | App **Electron** (janela nativa própria) empacotado como instalador Windows |
| Empacotador | `electron-builder` → instalador NSIS (`.exe`) |
| Onde o app do celular é servido | O **próprio server** passa a servir o `web` buildado (estático), tudo na porta **3000** |
| Descoberta do link | O main process detecta o IPv4 da LAN via `os.networkInterfaces()` |
| QR code | Gerado no app (lib `qrcode`) a partir da URL `http://<ip>:3000` |
| Acesso | Continua **somente rede local** (nada exposto na internet) |
| Idioma | Telinha 100% em português |

## O que o amigo vive (fluxo de uso)

1. Baixa `LoL Modo Banheiro Setup.exe` e instala (igual qualquer programa).
2. Abre o programa → janela ("telinha") com:
   - **Status do LoL:** "LoL detectado ✅" ou "Abra o cliente do LoL".
   - Toggle grande: **"Habilitar modo remoto"**.
3. Ao ligar o toggle → o server sobe e a telinha mostra:
   - O **link** (ex.: `http://192.168.0.15:3000`)
   - Botão **"Copiar link"**
   - **QR code** da URL
4. No celular: copia o link (ou aponta a câmera no QR) → abre a mesma web de hoje →
   acompanha fila, aceita partida, escolhe campeão e aplica runas.
5. Ao desligar o toggle → o server para e o link some.

## Arquitetura

```
┌──────────────────────────────────────────────────┐
│  Programa "LoL Modo Banheiro" (Electron)          │
│                                                    │
│  ┌─────────────┐   IPC liga/desliga   ┌─────────┐ │
│  │  Telinha     │ ───────────────────► │ Server   │ │──localhost──► Cliente LoL (LCU API)
│  │ (renderer)   │ ◄─────────────────── │ Express  │ │
│  │ toggle+link  │   status/IP/detecção │ :3000    │ │
│  │ +QR          │                      │ +estáticos│ │
│  └─────────────┘                       └────┬─────┘ │
│         (main process, Node)                │        │
└─────────────────────────────────────────────┼────────┘
                                              │ Wi-Fi (mesma rede)
                                        Celular → http://IP:3000 (web de hoje)
```

Três peças, cada uma com um propósito claro:

- **Server (existente, refatorado)** — fala com a LCU e agora também serve o app do
  celular. Passa a expor `startServer()` / `stopServer()` em vez de dar `listen` sozinho.
- **Main process (Electron, novo)** — dono do ciclo de vida: abre a janela, liga/desliga
  o server, detecta o IP local e o status do LoL, gera o QR.
- **Telinha / renderer (novo)** — a UI local com toggle, link, copiar e QR. Conversa
  com o main via IPC.

## Mudanças no código

### 1. `server/` — virar controlável e servir o web
- **`src/index.ts`** deixa de dar `app.listen(...)` no import. Extrair:
  - `createApp()` → monta o Express (rotas + estáticos do web).
  - `startServer(port = 3000)` → sobe o `http.Server` e inicia o `startGameflowWatcher()`; retorna o server.
  - `stopServer()` → fecha o `http.Server` e para o watcher.
- Servir estáticos: `app.use(express.static(<pasta do web buildado>))` + fallback
  para `index.html` (SPA). O caminho do web precisa funcionar **empacotado** (usar
  caminho relativo ao app / `process.resourcesPath` no Electron).
- **Detecção de status do LoL** já existe (`readLockfile()`); expor de forma que o main
  consiga perguntar "LoL detectado?" para a telinha.

### 2. `web/` — mesma origem
- **`src/api.ts`**: trocar
  `const baseUrl = \`http://${window.location.hostname}:3000\`` por origem própria
  (`const baseUrl = window.location.origin`), já que agora a página vem da porta 3000.
- Build de produção (`npm run build`) gera `web/dist/`, que o server serve.

### 3. `desktop/` — pasta nova (Electron)
- **`main.ts`** (main process, Node):
  - Cria a `BrowserWindow` (tamanho pequeno, tipo painel) carregando a telinha.
  - IPC handlers: `remote:enable` (chama `startServer` + devolve URL/QR), `remote:disable`
    (chama `stopServer`), `lol:status` (LoL detectado?).
  - `getLanUrl()` → varre `os.networkInterfaces()`, acha o IPv4 privado (192.168.x /
    10.x / 172.16–31.x), monta `http://<ip>:3000`.
  - Gera QR (data URL) da URL com `qrcode`.
- **`preload.ts`** — expõe uma API segura (`window.banheiro`) via `contextBridge`.
- **Telinha (renderer)** — HTML + React (reaproveitando o stack). Componentes:
  status do LoL, toggle "Habilitar modo remoto", link + botão copiar, QR. Só PT-BR.

### 4. Empacotamento
- `electron-builder` com target **NSIS** (instalador `.exe` para Windows).
- Config: nome `LoL Modo Banheiro`, ícone próprio, incluir `server` (compilado) e
  `web/dist` como recursos empacotados.
- Script de build encadeia: build do `web` → build do `server` → build da telinha →
  `electron-builder`.

## Fluxo de dados (ligar o modo remoto)

1. Amigo clica no toggle → renderer chama `window.banheiro.enable()`.
2. Main recebe IPC `remote:enable` → `startServer(3000)` → calcula `getLanUrl()` →
   gera QR → responde `{ url, qrDataUrl }`.
3. Renderer mostra link + copiar + QR.
4. Celular abre `http://<ip>:3000` → server responde o `index.html` do web → app roda
   e faz as chamadas `/api/...` na **mesma origem**.

## Tratamento de erros / casos de borda

| Caso | Comportamento |
|---|---|
| Porta 3000 ocupada | Avisar na telinha ("porta em uso"); (futuro: tentar porta alternativa) |
| Nenhum IPv4 de LAN encontrado | Mostrar `localhost` + aviso "conecte o PC ao Wi-Fi" |
| LoL fechado ao ligar o modo | Modo liga normal; telinha mostra "LoL não detectado — abra o cliente" (polling do status) |
| Firewall do Windows bloqueia | Popup nativo do Windows na 1ª vez → instruir "clicar em Permitir" (documentar) |
| Fechar a janela (X) | Encerra o app e para o server (sem system tray no MVP). |

## Fora de escopo (YAGNI por agora)

- Instaladores para macOS/Linux (foco Windows, onde o LoL roda).
- Acesso pela internet (ngrok/túnel) — continua só LAN.
- Auto-update do app.
- Porta configurável / múltiplas portas.
- Bandeja do sistema (system tray) — a janela basta no MVP.

## Testes

- **Server:** manter os testes atuais (vitest). Adicionar teste de `getLanUrl()` (mock
  de `os.networkInterfaces`) e de que `startServer/stopServer` sobem/derrubam a porta.
- **Web:** garantir que `baseUrl = window.location.origin` não quebra as chamadas.
- **Manual (aceite):** rodar o instalador numa máquina limpa, ligar o modo, abrir no
  celular, aceitar uma partida — checklist no final.

## Continua valendo (avisar os amigos no README/telinha)

- Precisa do **cliente do LoL aberto**.
- **PC e celular na mesma rede Wi-Fi**.
- Na 1ª vez o **firewall** pode pedir permissão → "Permitir".
- **Só rede local** — nada na internet aberta; o token da LCU nunca sai do PC.
