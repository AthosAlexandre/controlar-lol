# LoL Remote Controller 🎮📱

Controle o cliente do **League of Legends** pelo celular, na mesma rede Wi-Fi:
aceitar partida, auto-aceitar, escolher campeão e trocar runas — o "Modo Banheiro".

Não é hack: usa apenas a **LCU API**, a interface local e oficial que o próprio
cliente do LoL expõe (os mesmos caminhos que ferramentas como o Blitz usam).

> ⚠️ Nunca compartilhe o token da LCU nem exponha o servidor na internet aberta.
> No MVP tudo roda **só na rede local**.

## Como funciona (resumo)

```
Celular (React web) ──Wi-Fi──► Servidor no PC (Node+TS) ──localhost──► Cliente do LoL (LCU API)
```

O servidor lê o `lockfile` do LoL para descobrir a porta e o token, conversa com a
LCU e retransmite o estado do jogo para o celular em tempo real. Detalhes técnicos
em [`docs/como-funciona.md`](docs/como-funciona.md).

## Estrutura do projeto

```
server/   → roda no PC (Node + TypeScript + Express + Socket.IO)
web/      → app do celular (React + Vite + TypeScript)
docs/     → documentação (como funciona, specs, sprints)
```

## Como rodar

> Preenchido conforme os sprints avançam. (Sprint 1 em construção.)

### Pré-requisitos
- Node.js 18+ (testado com v24)
- Cliente do League of Legends instalado e **aberto**
- PC e celular na **mesma rede Wi-Fi**

### Passos
```bash
# (em breve) instalar dependências e subir o servidor
# cd server && npm install && npm run dev
```

## Roadmap (sprints)

| Sprint | Entrega |
|---|---|
| 1 — A Ponte | Servidor detecta o LoL e lê credenciais |
| 2 — Primeira Ação | Aceitar partida + auto-aceitar pelo celular |
| 3 — Tempo Real | Tela do celular muda sozinha (WebSocket) |
| 4 — Modo Banheiro | Escolher campeão + aplicar runas |

Design completo: [`docs/superpowers/specs/2026-07-19-lol-remote-controller-design.md`](docs/superpowers/specs/2026-07-19-lol-remote-controller-design.md)
