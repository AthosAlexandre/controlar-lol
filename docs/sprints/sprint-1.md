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
- Validado com o cliente aberto: `GET /api/summoner` retornou nick, tagLine e
  nível reais (HTTP 200). O log de detecção mostra a porta e só os 6 primeiros
  caracteres do token.
