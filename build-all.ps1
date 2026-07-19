# Builda tudo e gera o pacote portátil do "LoL Modo Banheiro".
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "==> Build web" -ForegroundColor Cyan
Push-Location "$root/web"; npm install; npm run build; Pop-Location

Write-Host "==> Build server (bundle)" -ForegroundColor Cyan
Push-Location "$root/server"; npm install; npm run build:bundle; Pop-Location

Write-Host "==> Build desktop (pasta desempacotada)" -ForegroundColor Cyan
Push-Location "$root/desktop"; npm install; npm run dist; Pop-Location

$unpacked = "$root/desktop/release/win-unpacked"
$exe = "$unpacked/LoL Modo Banheiro.exe"
if (-not (Test-Path $exe)) {
  throw "Build falhou: $exe não foi gerado."
}

Write-Host "==> Compactando pacote portátil (.zip)" -ForegroundColor Cyan
$zip = "$root/desktop/release/LoL-Modo-Banheiro-portatil.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$unpacked/*" -DestinationPath $zip -CompressionLevel Optimal

$mb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "==> Pronto! Pacote portátil: $zip ($mb MB)" -ForegroundColor Green
Write-Host "    Envie esse .zip pros amigos: extrair e abrir 'LoL Modo Banheiro.exe'." -ForegroundColor Green
