-- Listas nomeadas de endereçamento (CDs, filiais, etc.).

create table if not exists public.enderecamento_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  enderecos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_enderecamento_listas_nome on public.enderecamento_listas (lower(trim(nome)));

comment on table public.enderecamento_listas is
  'Conjuntos de endereços (posições) usados em inventários por local/CD.';

alter table public.enderecamento_listas enable row level security;

drop policy if exists "end_listas_authenticated_all" on public.enderecamento_listas;
drop policy if exists "end_listas_anon_all" on public.enderecamento_listas;

create policy "end_listas_authenticated_all"
on public.enderecamento_listas for all to authenticated using (true) with check (true);

create policy "end_listas_anon_all"
on public.enderecamento_listas for all to anon using (true) with check (true);
