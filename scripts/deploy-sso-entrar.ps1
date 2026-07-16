# Publica a Edge Function sso-entrar (entrada SSO do portal → Light).
#
# Pré-requisitos:
#   1) https://supabase.com/dashboard/account/tokens
#   2) $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Uso (raiz do repo Light):
#   .\scripts\deploy-sso-entrar.ps1
#
# Opcional: $env:SUPABASE_PROJECT_REF = "qvtnzyqdfhupfsqdqrel"
# Opcional: $env:WMS_PRO_URL = "https://doca-livre-wms-pro.onrender.com"

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "qvtnzyqdfhupfsqdqrel" }

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)." -ForegroundColor Yellow
  Write-Host "Ex.: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'" -ForegroundColor Gray
  exit 1
}

Write-Host "Publicando sso-entrar no projeto $projectRef ..." -ForegroundColor Cyan

npx.cmd --yes supabase@latest functions deploy sso-entrar `
  --project-ref $projectRef `
  --no-verify-jwt

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Concluído. Secrets recomendados no painel (Edge Functions → Secrets):" -ForegroundColor Green
Write-Host "  WMS_PRO_URL=https://doca-livre-wms-pro.onrender.com   (ou homologacao)" -ForegroundColor Gray
Write-Host "  SSO_SECRET=<mesmo do Pro>  (opcional, fallback HMAC)" -ForegroundColor Gray
