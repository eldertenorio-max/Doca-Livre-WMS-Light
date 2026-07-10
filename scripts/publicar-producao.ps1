# Promove homologacao → master e dispara deploy de PRODUÇÃO no Render.
#
# Uso (na raiz do repositório):
#   .\scripts\publicar-producao.ps1
#
# Pré-requisito no Render (uma vez):
#   Site Doca-Livre-WMS-Light (produção) → Settings → Auto-Deploy = On
#   Branch = master
#
# Fluxo:
#   homologacao (push) → homolog atualiza sozinha
#   este script (push master) → produção atualiza sozinha

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$remote = if ($env:GIT_REMOTE_PRODUCAO) { $env:GIT_REMOTE_PRODUCAO } else { "doca" }
$branchHomolog = if ($env:GIT_BRANCH_HOMOLOG) { $env:GIT_BRANCH_HOMOLOG } else { "homologacao" }
$branchProd = if ($env:GIT_BRANCH_PRODUCAO) { $env:GIT_BRANCH_PRODUCAO } else { "master" }

function Invoke-Git {
  param([string[]]$GitArgs)
  & git @GitArgs
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$status = git status --porcelain | Where-Object { $_ -notmatch '^\?\?' }
if ($status) {
  Write-Host "Há alterações não commitadas. Commit na branch homologacao antes de publicar produção." -ForegroundColor Yellow
  git status -sb
  exit 1
}

$current = (git branch --show-current).Trim()
if ($current -ne $branchHomolog) {
  Write-Host "Aviso: branch atual é '$current' (esperado '$branchHomolog'). Continuando mesmo assim..." -ForegroundColor Yellow
}

Write-Host "Buscando $remote..." -ForegroundColor Cyan
Invoke-Git @("fetch", $remote)

Write-Host "Mesclando $branchHomolog → $branchProd e enviando para $remote..." -ForegroundColor Cyan
Invoke-Git @("checkout", $branchProd)
Invoke-Git @("pull", $remote, $branchProd)
Invoke-Git @("merge", $branchHomolog, "-m", "Promove homologacao para producao")
Invoke-Git @("push", $remote, $branchProd)

Invoke-Git @("checkout", $branchHomolog)

$sha = (git rev-parse --short $branchProd).Trim()
Write-Host ""
Write-Host "Produção publicada: $remote/$branchProd @ $sha" -ForegroundColor Green
Write-Host "O Render (branch master) deve iniciar o deploy automaticamente em ~1 min." -ForegroundColor Green
Write-Host "Produção: https://doca-livre-wms-light.onrender.com" -ForegroundColor Gray
Write-Host "Homolog:  https://doca-livre-wms-light-homolog.onrender.com" -ForegroundColor Gray
Write-Host ""
Write-Host "Se produção não atualizar: Render → Doca-Livre-WMS-Light → Settings → Auto-Deploy = On (branch master)" -ForegroundColor Yellow
