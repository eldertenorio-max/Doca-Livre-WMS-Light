-- Sessões de inventário (hub local) compartilhadas entre coletor, notebook e outros dispositivos.
-- O app faz upsert ao criar/editar/coletar; na abertura sincroniza com o banco.

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

comment on table public.inventario_sessoes is
  'Lista de inventários (captura por validade/endereço) sincronizada entre dispositivos.';

comment on column public.inventario_sessoes.lista_enderecamento_id is
  'Lista de endereços (enderecamento_listas) usada neste inventário.';
comment on column public.inventario_sessoes.lista_produtos_id is
  'Lista de produtos (produto_listas) usada neste inventário.';

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
