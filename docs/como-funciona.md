# Como funciona (o mecanismo por baixo)

Este documento explica **como** um programa de terceiros consegue "controlar" o
cliente do League of Legends sem hackear nada — o objetivo é você entender o
mecanismo, não só rodar o código.

## 1. A LCU API

Quando o cliente do LoL (a telinha de saguão, feita em Electron/Chromium) está
aberto, ele sobe um **servidor web local** na sua máquina. Esse servidor é a
**LCU API** (League Client Update API). É por ele que o próprio cliente faz tudo:
mostrar seu nick, aceitar partida, trocar runas, etc.

Como é um servidor HTTP local, **qualquer programa na sua máquina** pode conversar
com ele — desde que saiba a **porta** e o **token** de acesso.

- Endereço: `https://127.0.0.1:{porta}`
- Autenticação: HTTP Basic, usuário fixo `riot` + o token do dia.

## 2. O lockfile (onde estão a porta e o token)

A cada vez que o cliente abre, ele gera um arquivo chamado `lockfile`:

```
C:\Riot Games\League of Legends\lockfile
```

O conteúdo é uma linha só, separada por `:` —

```
LeagueClient:12345:54321:AbCdEf123456:https
                 └─ PID    └─ PORTA   └─ TOKEN     └─ protocolo
```

Campos (em ordem): `nome_do_processo : PID : PORTA : TOKEN : protocolo`.

O que o servidor faz:
1. Lê esse arquivo.
2. Pega o campo 3 (**porta**) e o campo 4 (**token**).
3. Monta o header de autenticação: `Authorization: Basic base64("riot:" + TOKEN)`.

> ⚠️ Porta e token **mudam toda vez** que você reinicia o cliente. Por isso o
> servidor relê o lockfile em vez de decorar o valor.

## 3. O certificado autoassinado (SSL)

A LCU usa HTTPS, mas com um certificado **autoassinado** da Riot (não reconhecido
pelas autoridades públicas). Um cliente HTTP normal recusaria a conexão. Então
configuramos o cliente para **aceitar** esse certificado específico (em Node,
`rejectUnauthorized: false` no agente HTTPS). Isso é seguro aqui porque é uma
conexão para `127.0.0.1` — a sua própria máquina.

## 4. REST vs WebSocket

A LCU oferece duas formas de conversa:

- **REST (pedir/mandar):** você faz `GET`, `POST`, `PATCH`… quando quer uma
  informação ou quer executar uma ação. Ex.: `POST .../ready-check/accept` aceita
  a partida.
- **WebSocket (ouvir eventos):** você se inscreve e o cliente te **avisa** quando
  algo muda (partida encontrada, entrou na seleção, etc.), sem você ficar
  perguntando toda hora. É isso que deixa a tela do celular mudar sozinha.

## 5. Por que precisamos de um servidor no PC?

O celular **não** consegue ler o lockfile do seu PC nem falar com `127.0.0.1` da
sua máquina. Então o servidor Node atua como **ponte**:

```
Celular ──(Wi-Fi, HTTP/Socket.IO)──► Servidor no PC ──(localhost, LCU)──► Cliente do LoL
```

O celular manda uma ordem simples ("aceitar"), o servidor traduz para a chamada
correta da LCU. E o servidor escuta os eventos do LoL e repassa para o celular.

## 6. Isto é permitido?

Sim. A Riot expõe a LCU API oficialmente e a comunidade a usa há anos (Blitz,
Porofessor, etc.). Não alteramos arquivos do jogo, não injetamos código no
processo, não damos vantagem mecânica dentro da partida — apenas automatizamos o
**cliente/saguão**, que é o mesmo que você faria clicando com o mouse.
