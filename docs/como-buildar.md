# Como buildar e atualizar o instalador (LoL Modo Banheiro)

Guia para **gerar o instalador `.exe`** e para **atualizá-lo** quando você mudar
o código. Só o dono do projeto precisa disso — os amigos só recebem o `.exe`.

> Pré-requisitos (só na sua máquina de build): **Node.js 18+** e **PowerShell**.
> Quem recebe o instalador **não** precisa de nada disso — o app já leva o Node
> do Electron e o servidor empacotados dentro dele.

---

## 1. Build completo (o caminho fácil)

Na raiz do repositório, rode **um comando**:

```powershell
pwsh -File build-all.ps1
```

No fim ele imprime o caminho do instalador:

```
==> Pronto! Instalador: ...\desktop\release\LoL Modo Banheiro Setup 0.1.0.exe (78.5 MB)
```

Esse `.exe` é o que você manda pros amigos. É só isso. As seções abaixo explicam
o que esse comando faz e como **atualizar** quando você mexer no código.

---

## 2. O que o `build-all.ps1` faz (passo a passo)

1. **Prepara o `winCodeSign`** (contorno) — o electron-builder baixa uma
   ferramenta de assinatura que contém arquivos de macOS como *symlinks*; criar
   symlink no Windows exige privilégio e a extração falha. O script pré-extrai
   essa ferramenta no cache, ignorando os 2 arquivos de macOS que não usamos.
   (Roda só na 1ª vez; depois o cache já existe.)
2. **Build do web** (`web/`) → gera `web/dist/` (o app do celular, estático).
3. **Bundle do servidor** (`server/`) → junta o servidor e todas as dependências
   num único arquivo `server/dist/server.bundle.js` (via esbuild). É isso que
   dispensa `node_modules` no app final.
4. **Build do desktop** (`desktop/`) → compila o Electron (main + telinha) e
   roda o `electron-builder`, que empacota tudo e gera o instalador NSIS.
5. **Resultado** → `desktop/release/LoL Modo Banheiro Setup <versão>.exe`.

---

## 3. Atualizar o instalador depois de mudar o código

Sempre que você mexer em **qualquer parte** (servidor, app do celular ou a
telinha), o fluxo é o mesmo:

### 3.1. Suba a versão (recomendado)

Antes de rebuildar, aumente a versão em **`desktop/package.json`**:

```json
{
  "version": "0.2.0",
  ...
}
```

Por quê: o nome do instalador inclui a versão
(`LoL Modo Banheiro Setup 0.2.0.exe`). Subir a versão deixa claro pra você e pros
amigos que é uma versão nova, e evita confundir com o `.exe` antigo.

> Regra simples: correção pequena → `0.1.0` vira `0.1.1`; mudança maior →
> `0.2.0`. (Se você não subir a versão, o build funciona igual, só sai com o
> mesmo nome de arquivo.)

### 3.2. Rebuild

```powershell
pwsh -File build-all.ps1
```

Sai o novo `.exe` em `desktop/release/`.

### 3.3. Reenvie pros amigos

**Não há atualização automática.** O amigo precisa:
1. Baixar o novo `.exe`.
2. Instalar por cima (pode desinstalar o antigo antes, ou só instalar em cima —
   o NSIS substitui).
3. Abrir o programa de novo.

---

## 4. Rodar em desenvolvimento (sem gerar instalador)

Enquanto você está mexendo, não precisa gerar o `.exe` a cada mudança. Duas
formas de testar rápido:

### 4.1. Só a telinha do desktop (Electron)

```powershell
# 1) gere os artefatos que a telinha consome (uma vez, ou após mudar server/web)
cd server;  npm install; npm run build:bundle; cd ..
cd web;     npm install; npm run build;        cd ..
# 2) rode o app Electron apontando pro código atual
cd desktop; npm install; npm start
```

### 4.2. Só o app do celular (web) com recarga automática

```powershell
# servidor na 3000
cd server; npm run dev
# em outro terminal: web com hot-reload na 5173
cd web;    npm run dev
```

No celular abra `http://IP-DO-PC:5173` (o Vite tem um proxy que manda o `/api`
pro servidor na 3000). No app empacotado, tudo vem da porta 3000.

---

## 5. Armadilhas / troubleshooting

| Sintoma | Causa | Solução |
|---|---|---|
| `EADDRINUSE: ...:3000` ao clicar "Habilitar" | A porta 3000 já está ocupada (ex.: um `npm run dev` aberto) | Feche o outro servidor/terminal que está na 3000 |
| Erro de `symbolic link` no `winCodeSign` ao buildar | Windows sem privilégio de symlink | O `build-all.ps1` já contorna; se rodar o electron-builder na mão, rode o script antes |
| `electron --version` mostra versão do Node | A variável `ELECTRON_RUN_AS_NODE` está setada no ambiente | Rode removendo-a: `env -u ELECTRON_RUN_AS_NODE ...` (o build-all já roda certo) |
| Telinha trava em "Verificando o LoL..." | `renderer.ts` virou módulo (não pode ter `import`/`export` — roda no navegador) | Manter o renderer como script puro |
| Celular mostra "LoL fechado" no `:5173` | App aberto pela URL do Vite sem o proxy | Reinicie o Vite (pega o proxy) ou use o link `:3000` do app |
| Windows mostra "Windows protegeu o seu PC" | App não é assinado digitalmente | Normal. "Mais informações → Executar assim mesmo" |

---

## 6. Por que não tem assinatura digital?

O app não é assinado, então o SmartScreen do Windows avisa na 1ª execução.
Assinar de verdade exige um certificado de código pago (~US$200/ano) — não vale
a pena para uso entre amigos. Por isso deixamos sem assinatura e documentamos o
aviso no [guia do amigo](como-instalar-amigo.md).
