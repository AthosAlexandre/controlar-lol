# Sprint 2 — Primeira Ação

## O que foi entregue
App do celular/PC (React + antd, tema do launcher do LoL) que aceita a partida por um
botão **ACEITAR** e por um **toggle de auto-aceitar** (o servidor aceita sozinho via
polling). É a primeira ação de verdade pelo celular.

## Como funciona (fluxo)
1. O app (Vite, porta 5173) descobre o servidor por `window.location.hostname:3000`.
2. Botão ACEITAR → `POST /api/accept`: o servidor lê a fase (`gameflow-phase`); se for
   `ReadyCheck`, chama `POST /lol-matchmaking/v1/ready-check/accept`. Fora de partida
   responde `409 Nenhuma partida para aceitar`.
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
- `connectToLcu()` centraliza a montagem do cliente da LCU (DRY) — usado pelo summoner,
  pelas actions e pelo serviço de auto-aceitar.
- App e servidor em portas separadas com **CORS**; o app acha o IP sozinho pelo hostname
  (`window.location.hostname`), então funciona no PC e no celular sem configurar IP.
- Tema do LoL via tokens do antd (`ConfigProvider` + `theme.darkAlgorithm`); botão de
  aceitar estilizado como o do ready-check (trapézio dourado) e card com brackets hextech.
- **Verificação:** com o LoL aberto, o app renderiza `Conectado` + nick/nível reais
  (prova o caminho app→servidor→LCU); as rotas de auto-aceitar e o `409` fora de partida
  respondem como esperado. O aceitar dentro do ready-check é validado entrando na fila.
