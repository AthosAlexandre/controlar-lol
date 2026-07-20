# Builda tudo e gera o INSTALADOR (.exe) do "LoL Modo Banheiro".
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

# --- Contorno do winCodeSign -------------------------------------------------
# O electron-builder baixa o winCodeSign (assinatura) e tenta extrair uns .dylib
# de macOS como symlinks; no Windows isso falha sem privilégio. Como só buildamos
# para Windows, pré-populamos o cache extraindo o .7z e ignorando os 2 symlinks.
$cache = Join-Path $env:LOCALAPPDATA "electron-builder\Cache\winCodeSign"
$wcsDir = Join-Path $cache "winCodeSign-2.6.0"
$sevenZip = Join-Path $root "desktop\node_modules\7zip-bin\win\x64\7za.exe"

if (-not (Test-Path (Join-Path $wcsDir "windows-10"))) {
  Write-Host "==> Preparando winCodeSign (contorno de symlink)" -ForegroundColor Cyan
  New-Item -ItemType Directory -Force -Path $cache | Out-Null
  $archive = Get-ChildItem -Path $cache -Filter *.7z -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $archive) {
    $url = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z"
    $archive = Join-Path $cache "winCodeSign-2.6.0.7z"
    Write-Host "    baixando winCodeSign-2.6.0.7z..." -ForegroundColor DarkGray
    Invoke-WebRequest -Uri $url -OutFile $archive
    $archive = Get-Item $archive
  }
  if (-not (Test-Path $sevenZip)) {
    # 7za vem com o electron-builder; garante deps do desktop antes.
    Push-Location "$root/desktop"; npm install; Pop-Location
  }
  # 7za escreve nos symlinks de macOS um erro esperado; isolamos o EAP para não
  # tratar o stderr do exe nativo como erro terminante.
  $prevEAP = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $sevenZip x "$($archive.FullName)" "-o$wcsDir" -y | Out-Null
  $ErrorActionPreference = $prevEAP
  if (-not (Test-Path (Join-Path $wcsDir "windows-10"))) {
    throw "Falha ao preparar o winCodeSign em $wcsDir"
  }
}

# --- Build -------------------------------------------------------------------
Write-Host "==> Build web" -ForegroundColor Cyan
Push-Location "$root/web"; npm install; npm run build; Pop-Location

Write-Host "==> Build server (bundle)" -ForegroundColor Cyan
Push-Location "$root/server"; npm install; npm run build:bundle; Pop-Location

Write-Host "==> Build desktop + instalador" -ForegroundColor Cyan
Push-Location "$root/desktop"; npm install; npm run dist; Pop-Location

# --- Resultado ---------------------------------------------------------------
$setup = Get-ChildItem "$root/desktop/release" -Filter "*Setup*.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 1
if (-not $setup) { throw "Instalador não foi gerado em desktop/release." }

$mb = [math]::Round($setup.Length / 1MB, 1)
Write-Host "==> Pronto! Instalador: $($setup.FullName) ($mb MB)" -ForegroundColor Green
Write-Host "    Envie esse .exe pros amigos: dois cliques para instalar." -ForegroundColor Green

# --- Auto-update: arquivos para a GitHub Release --------------------------------
# Para o auto-update funcionar, publique estes 3 arquivos na Release (tag = versao):
Write-Host ""
Write-Host "==> Auto-update: suba estes arquivos na GitHub Release:" -ForegroundColor Cyan
$rel = Join-Path $root "desktop\release"
foreach ($name in @($setup.Name, "latest.yml", ($setup.Name + ".blockmap"))) {
  $f = Join-Path $rel $name
  if (Test-Path $f) {
    Write-Host ("    - {0}" -f $f) -ForegroundColor Gray
  } else {
    Write-Host ("    - (faltando) {0}" -f $name) -ForegroundColor Yellow
  }
}
Write-Host "    Bump a versao em desktop/package.json antes de buildar (ex.: 0.1.0 -> 0.1.1)." -ForegroundColor DarkGray
