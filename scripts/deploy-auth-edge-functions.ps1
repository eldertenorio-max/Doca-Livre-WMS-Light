# Publica login-username e register-username no Supabase (cadastro/login sem JWT no gateway).
#
# Pré-requisitos:
#   1) Token de acesso: https://supabase.com/dashboard/account/tokens
#   2) $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
#
# Uso (na raiz do repositório):
#   .\scripts\deploy-auth-edge-functions.ps1
#
# As funções já vêm com verify_jwt = false em supabase/config.toml.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

$projectRef = if ($env:SUPABASE_PROJECT_REF) { $env:SUPABASE_PROJECT_REF } else { "qvtnzyqdfhupfsqdqrel" }

if (-not $env:SUPABASE_ACCESS_TOKEN) {
  Write-Host "Defina SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens)." -ForegroundColor Yellow
  Write-Host "Ex.: `$env:SUPABASE_ACCESS_TOKEN = 'sbp_...'" -ForegroundColor Gray
  exit 1
}

Write-Host "Publicando register-username e login-username no projeto $projectRef ..." -ForegroundColor Cyan

npx.cmd --yes supabase@latest functions deploy register-username login-username `
  --project-ref $projectRef

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Concluído. Teste o cadastro no site." -ForegroundColor Green
Write-Host "Se ainda falhar com CORS/401: no painel Supabase → Edge Functions → cada função → desligue Verify JWT." -ForegroundColor Gray
