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
