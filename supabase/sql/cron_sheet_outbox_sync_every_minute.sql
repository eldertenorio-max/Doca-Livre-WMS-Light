-- Drena public.sheet_outbox a cada minuto via Edge Function (pg_net).
-- Ajuste a URL se o slug da função for outro (ex.: sheet-outbox-sync).
--
-- Pré-requisitos no projeto novo:
-- 1) Extensão pg_net ativa
-- 2) Edge Function publicada (dynamic-endpoint ou sheet-outbox-sync)
-- 3) Secret SHEET_WEBHOOK_URL na Edge Function

create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid)
from cron.job
where jobname = 'sheet-outbox-sync-every-minute';

select cron.schedule(
  'sheet-outbox-sync-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://zvazpqdvnlecqadxacgv.supabase.co/functions/v1/dynamic-endpoint',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
