# Setup automático: schema + dados + auth no Supabase ogpiinpoclfjnvrbthrq
# Uso:
#   1) Coloque SUPABASE_DB_PASSWORD no frontend\.env (senha do banco no painel Supabase)
#   2) .\setup-novo-projeto.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path "frontend\.env")) {
    Copy-Item "frontend\.env.example" "frontend\.env"
    Write-Host "Criado frontend\.env — edite e coloque SUPABASE_DB_PASSWORD antes de rodar de novo." -ForegroundColor Yellow
    exit 1
}

$envContent = Get-Content "frontend\.env" -Raw
if ($envContent -notmatch "SUPABASE_DB_PASSWORD=\S+") {
    Write-Host "Falta SUPABASE_DB_PASSWORD em frontend\.env" -ForegroundColor Red
    Write-Host "Supabase → Settings → Database → copie a senha do Postgres"
    exit 1
}

Push-Location frontend
npm run setup:novo-projeto
$code = $LASTEXITCODE
Pop-Location
exit $code
