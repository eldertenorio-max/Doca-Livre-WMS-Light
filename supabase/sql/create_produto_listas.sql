-- Listas nomeadas de produtos para inventário por local/CD.

create table if not exists public.produto_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  produtos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_produto_listas_nome on public.produto_listas (lower(trim(nome)));

comment on table public.produto_listas is
  'Catálogos de produtos (snapshot) vinculados a inventários por local/CD.';

alter table public.produto_listas enable row level security;

drop policy if exists "prod_listas_authenticated_all" on public.produto_listas;
drop policy if exists "prod_listas_anon_all" on public.produto_listas;

create policy "prod_listas_authenticated_all"
on public.produto_listas for all to authenticated using (true) with check (true);

create policy "prod_listas_anon_all"
on public.produto_listas for all to anon using (true) with check (true);
