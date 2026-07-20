# Extras da Seleção — Banir + Runas (recomendadas e fix)

**Data:** 2026-07-19

Três entregas em cima da tela de Seleção, todas verificadas ao vivo.

## 1. Fix: aplicar página de runas dava erro

**Sintoma:** tocar numa "Minhas runas" mostrava toast vermelho (erro).
**Causa raiz:** `setCurrentRunePage` fazia `PUT /lol-perks/v1/currentpage` mandando o id como
**número puro**. O axios recusa serializar um número solto no corpo
(`ERR_BAD_REQUEST: "Data after transformation must be a string, an ArrayBuffer, a Buffer, or a Stream"`)
— a requisição nem chegava na LCU.
**Fix:** enviar com header explícito `Content-Type: application/json`. Verificado ao vivo (`{"ok":true}`).

## 2. Banir campeão

Na **fase de ban**, a sua ação na sessão é `type: "ban"` (antes só olhávamos `"pick"`).

- Servidor: `findMyBanAction(session)` acha a sua ação de ban; `summarizeChampSelect` passa a
  devolver `ban` e `isBanPhase` (true quando a sua ação de ban está `isInProgress`).
- Rotas: `POST /api/champ-select/ban-hover` (seleciona) e `POST /api/champ-select/ban`
  (bane, via o mesmo PATCH atômico `{championId, completed:true}`).
- App: quando `isBanPhase`, a tela vira "Banir campeão" (título vermelho) e o botão fica
  **BANIR** (vermelho) no lugar de Confirmar; o grid de campeões é reaproveitado.

Verificado ao vivo: em jogo personalizado (Draft), banir Teemo pelo app funcionou no cliente.

## 3. Runas recomendadas do LoL

Durante a seleção, o LoL calcula páginas de runa recomendadas para o campeão/posição.

**Endpoint (descoberto por probe — só responde com um campeão selecionado):**
```
GET /lol-perks/v1/recommended-pages/champion/{championId}/position/{position}/map/11
```
Retorna um array; cada item tem `primaryPerkStyleId`, `secondaryPerkStyleId` e
`perks` (array de 9 `{id, name, …}`, do keystone aos fragmentos). O nome de exibição vem do
primeiro perk (a pedra angular).

**Aplicar:** não há "set recommended" direto — cria-se uma página com esses dados:
```
POST /lol-perks/v1/pages  { name, primaryStyleId, subStyleId, selectedPerkIds, current: true }
```
Para não acumular páginas, o servidor **apaga a página anterior criada pelo app**
(`Recomendada 🎯`) antes de criar a nova. `selectedPerkIds = perks.map(p => p.id)`.

- Rotas: `GET /api/recommended-runes` (deriva campeão + posição da sessão) e
  `POST /api/recommended-runes/apply` (com guarda contra dados vazios).
- App: seção **"Runas recomendadas"** na Seleção, carregada quando o campeão selecionado muda;
  cada opção é um chip (pelo nome do keystone) que aplica com um toque.

Verificado ao vivo: `GET` trouxe 3 recomendadas do campeão em hover; `apply` criou e ativou a
página `Recomendada 🎯`.

## Fora de escopo (por enquanto)

- Editor de runa completo (montar do zero entre as 5 árvores / 103 runas) — projeto à parte.
- Ver o hover do time inimigo — a Riot esconde no draft.
