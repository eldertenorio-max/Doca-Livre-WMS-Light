# Publica a Edge Function sso-entrar (entrada SSO do portal → Light).
#
# Pré-requisitos:
#   1) https://supabase.com/dashboard/account/tokens → crie um token sbp_...
#   2) Cole em frontend/.env:
#        SUPABASE_ACCESS_TOKEN=sbp_...
#      ou exporte: $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Uso (raiz do repo Light):
#   .\scripts\deploy-sso-entrar.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

function Import-DotEnvKey([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*#' -or $line -notmatch '=') { continue }
    $name, $val = $line -split '=', 2
    if ($name.Trim() -ne $key) { continue }
    return $val.Trim().Trim('"').Trim("'")
  }
  return $null
}

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  $fromEnv = Import-DotEnvKey (Join-Path $repoRoot 'frontend\.env') 'SUPABASE_ACCESS_TOKEN'
  if ($fromEnv) { $env:SUPABASE_ACCESS_TOKEN = $fromEnv }
}

if (-not $env:SUPABASE_PROJECT_REF) {
  $ref = Import-DotEnvKey (Join-Path $repoRoot 'frontend\.env') 'SUPABASE_PROJECT_REF'
  if ($ref) { $env:SUPABASE_PROJECT_REF = $ref }
}

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "qvtnzyqdfhupfsqdqrel" }

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "SUPABASE_ACCESS_TOKEN nao encontrado." -ForegroundColor Yellow
  Write-Host "Cole no arquivo frontend\.env:" -ForegroundColor Yellow
  Write-Host "  SUPABASE_ACCESS_TOKEN=sbp_seu_token" -ForegroundColor Gray
  Write-Host "Crie em: https://supabase.com/dashboard/account/tokens" -ForegroundColor Gray
  exit 1
}

Write-Host "Publicando sso-entrar no projeto $projectRef ..." -ForegroundColor Cyan

npx.cmd --yes supabase@latest functions deploy sso-entrar `
  --project-ref $projectRef `
  --no-verify-jwt

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Concluido." -ForegroundColor Green
Write-Host "Secrets recomendados (Edge Functions → Secrets):" -ForegroundColor Gray
Write-Host "  WMS_PRO_URL=https://doca-livre-wms-pro.onrender.com" -ForegroundColor Gray
Write-Host "  SSO_SECRET=<mesmo do Pro>  (opcional)" -ForegroundColor Gray
