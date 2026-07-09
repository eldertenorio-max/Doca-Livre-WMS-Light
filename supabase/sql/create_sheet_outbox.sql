-- Cria sheet_outbox antes de supabase_schema_contagem.sql (RLS no início do arquivo exige a tabela).
begin;

create table if not exists public.sheet_outbox (
  id uuid primary key default gen_random_uuid(),
  aba text not null default 'CONTAGEM DE ESTOQUE FISICA',
  codigo_interno text not null,
  descricao text not null,
  data_contagem date not null,
  event_type text not null check (event_type in ('upsert', 'clear_qty')),
  quantidade_contada numeric(18,3),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (aba, codigo_interno, descricao, data_contagem)
);

create index if not exists idx_sheet_outbox_pending
  on public.sheet_outbox(status, created_at);

commit;
