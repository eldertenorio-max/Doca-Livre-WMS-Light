# Passos após rodar triggers + cron no banco (scripts locais).
# Edge Function exige deploy no painel do projeto diegosistemas803 (CLI deu 403 sem login da conta certa).
#
# 1) Supabase novo → Edge Functions → Deploy via Editor
#    Nome: dynamic-endpoint
#    Cole: supabase/functions/dynamic-endpoint/index.ts
#    verify_jwt = false (já em supabase/functions/dynamic-endpoint/config.toml)
#
# 2) Edge Functions → Secrets (projeto zvazpqdvnlecqadxacgv):
#    SUPABASE_URL = https://zvazpqdvnlecqadxacgv.supabase.co
#    SUPABASE_SERVICE_ROLE_KEY = (Settings → API → service_role)
#    SUPABASE_ANON_KEY = (Settings → API → anon / publishable)
#    SHEET_WEBHOOK_URL = https://script.google.com/macros/s/AKfycbwiKITgtnaFR9L3I7IzEZT95I3rtnSiSJEEahfIG_21FblWy_zdwrgs83bLyQ0nkFum_w/exec
#
# 3) Teste manual (PowerShell):
#    Invoke-RestMethod -Method POST `
#      -Uri "https://zvazpqdvnlecqadxacgv.supabase.co/functions/v1/dynamic-endpoint" `
#      -ContentType "application/json" `
#      -Body "{}"
#
# 4) Conferir fila:
#    select status, count(*) from public.sheet_outbox group by status;

Write-Host "Veja os comentarios neste arquivo para deploy no painel Supabase."
