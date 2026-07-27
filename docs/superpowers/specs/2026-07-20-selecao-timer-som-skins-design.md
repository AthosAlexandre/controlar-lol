# Seleção — Timer + Som + Skins — Design

**Data:** 2026-07-20
**Autor:** athos-iury (com Claude Code)
**Status:** Aprovado — pronto para plano de implementação

## Objetivo

Deixar a tela de Seleção mais completa e "viva":
1. **Timer** da fase (tempo para escolher/banir), destacando os **10s finais**.
2. **Som** quando **fica a sua vez** e nos **10s finais** (sintético, sem depender de arquivo).
3. **Trocar a skin** do campeão escolhido (só as que você possui).

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Som | **Sintético via Web Audio** (gerado no navegador, sem arquivo externo). Não usar o áudio original do LoL (direitos autorais da Riot). Um "ding" na sua vez + bips urgentes nos 10s finais. |
| Suavidade do timer | O poll é a cada 1,5s; o app **conta pra baixo localmente** entre os polls a partir do valor recebido. |
| Skins | **Só as que o jogador possui**, do campeão escolhido, com **miniatura**; aplicar via `selectedSkinId`. |
| Fonte do timer | Vem no **mesmo** `GET /api/champ-select` (o `summarizeChampSelect` passa a incluir `timer`). Sem endpoint/poll novo para o estado. |
| Imagens de skin | **Proxy no servidor** (como os ícones de campeão/feitiço), para funcionar no Wi-Fi local. |

## Arquitetura / fluxo

Tudo dentro da fase `ChampSelect`. O timer chega no poll existente; skins carregam quando o
campeão é escolhido; o som é 100% no app, disparado pelas transições que já vêm no poll.

```
Celular ──REST──► Servidor ──LCU REST──► LoL
  (poll champ-select: pick + times + feitiços + TIMER)
  (GET skins / POST trocar skin)
  miniaturas de skin ◄── proxy /api/skin-icon/:id ◄── LCU
Som: 100% no app (Web Audio), a partir das transições do estado.
```

## Servidor

### Timer (no `summarizeChampSelect`)

`session.timer` tem `{ adjustedTimeLeftInPhase, totalTimeInPhase, phase, isInfinite }`.
`summarizeChampSelect` passa a devolver:
```ts
interface ChampTimer {
  timeLeftMs: number;   // adjustedTimeLeftInPhase
  totalMs: number;      // totalTimeInPhase
  phase: string;        // ex.: "BAN_PICK", "FINALIZATION"
}
// no ChampSelectSummary: timer: ChampTimer | null   (null se isInfinite ou sem timer)
```
Função pura (testável) — extrai o timer da sessão; `null` quando `isInfinite` é true.

### Skins (novo `lcu/skins.ts`)

- `getOwnedSkins(client)` → `GET /lol-champ-select/v1/skin-carousel-skins` → filtra as que o
  jogador possui → `[{ id, name }]`.
  - **Nota:** os nomes exatos dos campos (id da skin, flag "possuo", caminho da imagem) serão
    **confirmados por um probe** numa seleção real no 1º passo da implementação (como foi
    feito com feitiços e runas recomendadas). O mapeamento abaixo é o esperado; o probe ajusta.
- `getSkinTilePath(client, skinId)` → acha o caminho da miniatura (tile/splash) do carrossel
  para o proxy repassar.
- `selectSkin(client, skinId)` → `PATCH /lol-champ-select/v1/session/my-selection` com
  `{ selectedSkinId: skinId }`.

### Rotas

| Método | Rota | Faz |
|---|---|---|
| `GET` | `/api/champ-select` | Passa a devolver também `timer` |
| `GET` | `/api/skins` | Skins que você tem do campeão escolhido `[{ id, name, selected }]` |
| `GET` | `/api/skin-icon/:id` | Proxy da miniatura da skin |
| `POST` | `/api/skins/select` | Troca a skin: `{ skinId }` |

`GET /api/skins` fora da seleção / sem campeão → lista vazia (sem erro).

## App — a tela de Seleção

Três adições, no tema do LoL:

1. **Timer** (topo da tela, abaixo de "Seleção"): número grande com o tempo restante da fase.
   O app recebe `timeLeftMs` + o instante de recebimento e **conta pra baixo localmente**
   (recalcula por segundo/`requestAnimationFrame`), reiniciando a cada poll novo. Nos **≤10s**
   fica **vermelho e pulsando**. Some se `timer` é `null` (modo sem timer).

2. **Som** (`web/src/sound.ts`, Web Audio):
   - `playTurn()` — "ding" (duas notas curtas) quando `canPick` **ou** `isBanPhase` passa de
     false→true (fica a sua vez).
   - `playTick()` — bip curto a cada segundo enquanto o timer está em `≤10s` (mais agudo/rápido
     nos últimos 3s).
   - O `AudioContext` é criado/religado no **primeiro toque** do usuário no app (política de
     autoplay). Se bloqueado, silencioso — nunca quebra.

3. **Skins** (seção "Skins", depois das runas): as suas skins do campeão escolhido como
   miniaturas (via `/api/skin-icon/:id`); tocar aplica (`POST /api/skins/select`, toast "Skin
   trocada"); a skin atual (`selected`) fica com borda dourada. Carrega quando o campeão
   selecionado muda (igual às runas recomendadas).

## Tratamento de erros

- **Timer infinito/ausente:** `timer: null` → o app não mostra o timer.
- **Sem skins / fora da seleção:** `/api/skins` responde `[]`; a seção não aparece.
- **Áudio bloqueado pelo navegador:** sem som, o resto funciona.
- **Trocar skin fora da hora:** a LCU recusa → toast "Não foi possível trocar a skin"
  (motivo real via `lcuError`).
- **Miniatura ausente:** proxy responde 404 → o card mostra só o nome (fallback).

## Testes

- **Unitários (vitest, servidor):**
  - `summarizeChampSelect` — extrai `timer` (`timeLeftMs`/`totalMs`/`phase`); `null` quando
    `isInfinite`. (Mantém o resto do summary intacto.)
  - Helpers de skin (`getOwnedSkins` filtrando as possuídas, `selectSkin` fazendo o PATCH em
    `my-selection`) com cliente falso.
- **Manual (entregável):** numa seleção real — ver o timer contando e ficando vermelho nos
  10s; ouvir o "ding" na sua vez e os bips finais; trocar uma skin e ver mudar no cliente.
- **Screenshots** com mock: timer destacado (≤10s) e a seção de Skins com as miniaturas.

## Estrutura de arquivos

```
server/src/
├── lcu/
│   ├── champ-select.ts    → summarizeChampSelect ganha `timer` (+ tipo ChampTimer)
│   ├── champ-select.test.ts
│   ├── skins.ts           → getOwnedSkins, getSkinTilePath, selectSkin
│   └── skins.test.ts
└── routes/
    └── champ-select.ts    → /champ-select (com timer), /skins, /skin-icon/:id, /skins/select

web/src/
├── api.ts                 → + tipos/funcs de timer e skin (getSkins/selectSkin/skinIconUrl)
├── sound.ts               → Web Audio: playTurn(), playTick(), unlockAudio()
├── champ-select.tsx       → + timer (contagem local) + seção Skins + disparo do som
└── App.css                → classes do timer destacado e da seção Skins
```

## Fora de escopo (YAGNI)

- Reproduzir o **áudio original** do LoL (direitos autorais) — usamos som sintético parecido.
- Skins que você **não possui** — a LCU só deixa usar as suas.
- Chromas / bordas de skin — futuro.
- Escolher feitiços de invocador do inimigo / trocar posição — fora.
