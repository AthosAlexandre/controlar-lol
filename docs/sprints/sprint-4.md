# Sprint 4 — Modo Banheiro

## O que foi entregue
Na seleção de campeões, dá para **escolher e travar um campeão** e **aplicar uma página de
runas** direto do celular. Fecha o MVP do "Modo Banheiro".

## Como funciona (fluxo)
1. Na fase `ChampSelect` (que chega por SSE), a tela de Seleção carrega os campeões
   (`/api/champions`) e as páginas de runas (`/api/rune-pages`), com um poll leve (1,5s) de
   `/api/champ-select` para o estado do pick.
2. Tocar num campeão → `POST /api/champ-select/hover` (seleciona); **TRAVAR** →
   `POST /api/champ-select/lock` (`.../actions/{id}/complete` na LCU).
3. Tocar numa página de runas → `POST /api/rune-pages/current` (`PUT /lol-perks/v1/currentpage`).
4. As fotos vêm por proxy (`/api/champion-icon/:id`), então funcionam no Wi-Fi local.

## Como testar
1. Abra o LoL e entre numa fila até a seleção de campeões.
2. `server/`: `npm run dev`. `web/`: `npm run dev`.
3. No celular/PC: busque, selecione e TRAVE um campeão; aplique uma página de runas.
4. Testes do servidor: em `server/`, `npm test`.

## Decisões e aprendizados
- Escolher campeão em dois passos (hover → travar), espelhando o cliente.
- Runas: só aplicar páginas já salvas (sem editor).
- `findMyPickAction` (pura) isola a parte delicada de achar a sua ação na sessão.
- Ícones por proxy no servidor: bonito e offline (Wi-Fi local).
