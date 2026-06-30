-- =============================================================================
-- Setup completo: inventário no Supabase + listas de endereço e produtos
-- Cole e execute TUDO no Supabase SQL Editor (uma vez).
-- =============================================================================

-- 1) Sessões de inventário
create table if not exists public.inventario_sessoes (
  id uuid primary key,
  numero int not null,
  titulo text not null,
  local text not null default 'ULTRAPAO GUARULHOS DISTRI',
  posicoes_nome text,
  posicoes_codigos jsonb,
  catalogo_produtos text default 'ultrapao',
  lista_enderecamento_id uuid,
  lista_enderecamento_nome text,
  lista_produtos_id uuid,
  lista_produtos_nome text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  status text not null check (status in ('aberto', 'fechado')),
  linhas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inventario_sessoes_status on public.inventario_sessoes (status);
create index if not exists idx_inventario_sessoes_numero on public.inventario_sessoes (numero desc);
create index if not exists idx_inventario_sessoes_updated on public.inventario_sessoes (updated_at desc);

alter table public.inventario_sessoes enable row level security;

drop policy if exists "inv_sessoes_authenticated_select" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_authenticated_insert" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_authenticated_update" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_authenticated_delete" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_anon_select" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_anon_insert" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_anon_update" on public.inventario_sessoes;
drop policy if exists "inv_sessoes_anon_delete" on public.inventario_sessoes;

create policy "inv_sessoes_authenticated_select"
on public.inventario_sessoes for select to authenticated using (true);
create policy "inv_sessoes_authenticated_insert"
on public.inventario_sessoes for insert to authenticated with check (true);
create policy "inv_sessoes_authenticated_update"
on public.inventario_sessoes for update to authenticated using (true) with check (true);
create policy "inv_sessoes_authenticated_delete"
on public.inventario_sessoes for delete to authenticated using (true);
create policy "inv_sessoes_anon_select"
on public.inventario_sessoes for select to anon using (true);
create policy "inv_sessoes_anon_insert"
on public.inventario_sessoes for insert to anon with check (true);
create policy "inv_sessoes_anon_update"
on public.inventario_sessoes for update to anon using (true) with check (true);
create policy "inv_sessoes_anon_delete"
on public.inventario_sessoes for delete to anon using (true);

-- 2) Listas de endereçamento
create table if not exists public.enderecamento_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  enderecos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_enderecamento_listas_nome on public.enderecamento_listas (lower(trim(nome)));

alter table public.enderecamento_listas enable row level security;

drop policy if exists "end_listas_authenticated_all" on public.enderecamento_listas;
drop policy if exists "end_listas_anon_all" on public.enderecamento_listas;

create policy "end_listas_authenticated_all"
on public.enderecamento_listas for all to authenticated using (true) with check (true);
create policy "end_listas_anon_all"
on public.enderecamento_listas for all to anon using (true) with check (true);

-- 3) Listas de produtos
create table if not exists public.produto_listas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  produtos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_produto_listas_nome on public.produto_listas (lower(trim(nome)));

alter table public.produto_listas enable row level security;

drop policy if exists "prod_listas_authenticated_all" on public.produto_listas;
drop policy if exists "prod_listas_anon_all" on public.produto_listas;

create policy "prod_listas_authenticated_all"
on public.produto_listas for all to authenticated using (true) with check (true);
create policy "prod_listas_anon_all"
on public.produto_listas for all to anon using (true) with check (true);

-- 4) Colunas de vínculo (se a tabela inventario_sessoes já existia sem elas)
alter table public.inventario_sessoes
  add column if not exists lista_enderecamento_id uuid,
  add column if not exists lista_enderecamento_nome text,
  add column if not exists lista_produtos_id uuid,
  add column if not exists lista_produtos_nome text;
