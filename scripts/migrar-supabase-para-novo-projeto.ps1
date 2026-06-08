# Migração Postgres: projeto Supabase ANTIGO → NOVO (conta pessoal).
# Pré-requisitos: pg_dump e psql no PATH (PostgreSQL client tools).
#
# 1) No Supabase NOVO: defina a senha do postgres (Settings → Database).
# 2) No Supabase ANTIGO: copie a senha do postgres (ou resete e anote).
# 3) Rode o schema no projeto NOVO antes (supabase_schema_contagem.sql + supabase/sql/*.sql).
#
# Uso:
#   $env:SUPABASE_SENHA_ANTIGA = "senha_do_projeto_antigo"
#   $env:SUPABASE_SENHA_NOVA   = "senha_do_projeto_novo"
#   .\scripts\migrar-supabase-para-novo-projeto.ps1

$ErrorActionPreference = "Stop"

$refAntigo = "swnefuddaswgjvhiuxok"
$refNovo   = "zvazpqdvnlecqadxacgv"

$senhaAntiga = $env:SUPABASE_SENHA_ANTIGA
$senhaNova   = $env:SUPABASE_SENHA_NOVA

if (-not $senhaAntiga -or -not $senhaNova) {
  Write-Host "Defina SUPABASE_SENHA_ANTIGA e SUPABASE_SENHA_NOVA antes de rodar." -ForegroundColor Yellow
  exit 1
}

$uriAntigo = "postgresql://postgres:$([uri]::EscapeDataString($senhaAntiga))@db.$refAntigo.supabase.co:5432/postgres"
$uriNovo   = "postgresql://postgres:$([uri]::EscapeDataString($senhaNova))@db.$refNovo.supabase.co:5432/postgres"

$dumpFile = Join-Path $PSScriptRoot "..\backups\supabase-dados-$refAntigo-$(Get-Date -Format 'yyyyMMdd-HHmm').sql"
New-Item -ItemType Directory -Force -Path (Split-Path $dumpFile) | Out-Null

Write-Host "Exportando DADOS (public) do projeto antigo..." -ForegroundColor Cyan
pg_dump $uriAntigo `
  --data-only `
  --schema=public `
  --no-owner `
  --no-privileges `
  -f $dumpFile

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Importando no projeto novo: $dumpFile" -ForegroundColor Cyan
psql $uriNovo -f $dumpFile

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Concluído. Confira contagens no SQL Editor do projeto novo." -ForegroundColor Green
