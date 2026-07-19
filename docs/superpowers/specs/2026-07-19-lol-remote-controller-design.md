# LoL Remote Controller — Design

**Data:** 2026-07-19
**Autor:** tech@multidrop.com (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Controlar o cliente do League of Legends pelo celular, na mesma rede Wi-Fi, para:
aceitar partida, ligar/desligar auto-aceitar, escolher campeão e aplicar páginas de
runas — o "Modo Banheiro". O celular nunca fala direto com o LoL; ele fala com um
servidor que roda no PC, e esse servidor traduz as ações para a **LCU API** (a API
local oficial que o próprio cliente do LoL expõe).

Não há hack nem alteração do jogo: usamos apenas caminhos oficiais (lockfile + LCU
REST/WebSocket), os mesmos que ferramentas como o Blitz usam.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Servidor no PC | Node.js + TypeScript |
| Frontend | React + Vite + TypeScript (Web/PWA, roda no navegador do celular) |
| Acesso no MVP | Somente Wi-Fi local (`http://IP-do-PC:porta`). Internet via ngrok fica para sprint futuro. |
| Aceitar partida | Botão manual **e** toggle de auto-aceitar (os dois juntos) |
| Instalação do LoL | `C:\Riot Games\League of Legends` (lockfile confirmado nesse caminho) |
| Estrutura | Monorepo: `server/` + `web/` |

## Arquitetura

```
┌─────────────────┐   Wi-Fi local    ┌──────────────────────┐   localhost    ┌─────────────┐
│  Celular        │ ───────────────► │  Servidor no PC       │ ─────────────► │  Cliente    │
│  (React Web/PWA)│ ◄─────────────── │  Node + TS + Express  │ ◄───────────── │  do LoL     │
│  navegador      │   Socket.IO      │  + Socket.IO          │   LCU REST/WS  │  (LCU API)  │
└─────────────────┘                  └──────────────────────┘                └─────────────┘
```

Três camadas, um único repositório:

```
lol-remote/  (raiz do projeto atual)
├── docs/superpowers/specs/     → este spec e futuros
├── server/                     → roda no PC (Node + TS)
│   ├── src/
│   │   ├── lcu/                → lockfile, autenticação, cliente HTTP para a LCU
│   │   ├── watchers/           → escuta o WebSocket do LoL (gameflow, champ-select)
│   │   ├── routes/             → API que o celular chama (accept, pick, runes…)
│   │   └── index.ts            → sobe Express + Socket.IO
│   ├── package.json
│   └── tsconfig.json
└── web/                        → app do celular (React + Vite + TS)
    ├── src/
    │   ├── hooks/              → useSocket, useGameState
    │   └── screens/           → Fila / Partida encontrada / Seleção / Runas
    ├── package.json
    └── vite.config.ts
```

## Fluxo de dados

1. O servidor lê o `lockfile` em `C:\Riot Games\League of Legends\lockfile` e extrai
   **porta** e **token** de autenticação.
2. O servidor abre um **cliente HTTP** para a LCU (HTTPS em `127.0.0.1`, ignorando o
   certificado autoassinado da Riot) e um **WebSocket** para receber eventos ao vivo.
3. O servidor **retransmite** o estado do jogo para o celular via **Socket.IO**, de
   modo que a tela do celular muda sozinha.
4. O celular envia ações (aceitar, escolher campeão, trocar runa); o servidor traduz
   cada uma em chamadas à LCU API.

### Endpoints LCU usados (referência)

| Ação | Método + endpoint LCU |
|---|---|
| Dados do invocador | `GET /lol-summoner/v1/current-summoner` |
| Aceitar partida | `POST /lol-matchmaking/v1/ready-check/accept` |
| Estado do fluxo de jogo | `GET /lol-gameflow/v1/gameflow-phase` |
| Sessão de seleção | `GET /lol-champ-select/v1/session` |
| Escolher/lock campeão | `PATCH /lol-champ-select/v1/session/actions/{id}` |
| Campeões disponíveis | `GET /lol-champions/v1/owned-champions-minimal` |
| Páginas de runas | `GET/POST/PUT /lol-perks/v1/pages`, `PUT /lol-perks/v1/currentpage` |

## Tratamento de erros

- **LoL fechado / lockfile ausente:** o servidor não quebra; entra em estado
  "aguardando LoL" e reconecta sozinho quando o cliente é aberto.
- **Token muda a cada reinício do cliente:** o servidor relê o lockfile em vez de
  guardar o valor permanentemente.
- **Certificado SSL autoassinado:** configurado uma vez no cliente HTTP.
- **Firewall do Windows:** o celular só acessa a porta na rede local após liberação;
  tratado no Sprint 2.

## Testes

- **Camada LCU isolada e testável:** parsing do lockfile e montagem do header de
  autenticação têm teste unitário (não dependem do jogo aberto).
- **Ações reais:** validadas manualmente com o cliente do LoL aberto — são o
  entregável de cada sprint.

## Sprints

| Sprint | Objetivo | Entregável |
|---|---|---|
| **1 — A Ponte** | Servidor acha o LoL, lê credenciais, fala com a LCU | Terminal mostra `LoL detectado! Porta / Token`; `GET /api/summoner` retorna o nick do jogador |
| **2 — Primeira Ação** | Aceitar partida do celular + toggle de auto-aceitar | Botão "ACEITAR" no celular funciona; toggle liga/desliga o auto-accept |
| **3 — Tempo Real** | WebSocket → a tela do celular muda sozinha | Celular vai de "Em Fila" → "Partida Encontrada" → "Seleção" automaticamente |
| **4 — Modo Banheiro** | Escolher campeão + aplicar runas | Aceita, escolhe o campeão e troca a runa direto do celular |

## Documentação (parte de toda entrega)

Documentar é requisito, não extra. Em cada sprint entregamos código **e** docs.
Estrutura de documentação do projeto:

```
README.md                       → visão geral, como instalar e rodar
docs/
├── como-funciona.md            → o mecanismo por baixo (lockfile, LCU REST/WS,
│                                 certificado autoassinado) — para entender, não só usar
├── superpowers/specs/          → specs de design (este arquivo e futuros)
└── sprints/
    ├── sprint-1.md             → o que foi feito, como testar, decisões, aprendizados
    ├── sprint-2.md
    └── ...
```

Regras:
- **README** sempre atualizado com o passo a passo de rodar (server + web).
- **`docs/como-funciona.md`** explica o "porquê" e o "como" técnico em português.
- Cada sprint ganha um `docs/sprints/sprint-N.md` ao ser concluído.
- Comentários no código apenas onde a lógica não é óbvia (ex.: ignorar SSL da Riot,
  parsing do lockfile), explicando o motivo.

## Fora de escopo (YAGNI por enquanto)

- Acesso pela internet / 4G (ngrok) — sprint futuro.
- App nativo React Native — só depois que o Web funcionar.
- Visão computacional / overlay na tela do jogo — projeto separado no futuro.
- Autenticação/login no app (rede local confiável no MVP).
