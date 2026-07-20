# Como lançar uma versão nova (com auto-update)

O app instalado se atualiza sozinho: ao abrir, ele checa as **Releases do GitHub**
(repo público), baixa a versão nova em segundo plano e notifica o usuário para reiniciar.
Isso funciona graças ao `electron-updater` (no `desktop/src/main.ts`) + o bloco `publish`
no `electron-builder.yml`.

## Passo a passo para lançar

1. **Suba a versão** em `desktop/package.json` (é ela que o updater compara):
   ```json
   "version": "0.1.1"
   ```
   (Sempre maior que a anterior — ex.: `0.1.0` → `0.1.1`.)

2. **Builde**:
   ```powershell
   pwsh -File build-all.ps1
   ```
   No fim, o script lista os **3 arquivos** gerados em `desktop/release/` que vão para a Release.

3. **Crie a Release no GitHub** (pela web, já que o push é pelo GitHub Desktop):
   - Repo → **Releases** → **Draft a new release**.
   - **Tag**: `v0.1.1` (bate com a versão).
   - Anexe os **3 arquivos** de `desktop/release/`:
     - `LoL Modo Banheiro Setup 0.1.1.exe` (o instalador)
     - `latest.yml` (o manifesto que o updater lê — **essencial**)
     - `LoL Modo Banheiro Setup 0.1.1.exe.blockmap` (permite baixar só o diff)
   - **Publish**.

4. Pronto. Quem já tem o app instalado vai atualizar sozinho no próximo boot.
   Quem é novo baixa o `.exe` da página de Releases (link "Latest").

## Detalhes / cuidados

- **`latest.yml` é obrigatório.** Sem ele, o updater não sabe que há versão nova.
- **A versão da tag e do `package.json` têm que bater** e ser maior que a instalada.
- **App não assinado:** o SmartScreen pode avisar ao instalar/atualizar — normal (é só
  "Executar mesmo assim").
- O build **nunca publica sozinho** (`electron-builder --publish never`); o upload é sempre
  manual, então não precisa de token do GitHub.
- O auto-update **só roda no app empacotado** — no `npm run dev` não há o que checar.

## Não commitar o instalador no repo

O `.exe`, o `latest.yml` e o `.blockmap` ficam em `desktop/release/`, que está no
`.gitignore`. Eles vão **só para a Release**, nunca para o histórico do git (senão o repo
incha com cada build).
