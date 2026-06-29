-- Presença em tempo quase real na coleta de inventário (hub local + heartbeat).
-- O app envia upsert periódico; outros clientes no mesmo inventário veem quem está contando.

create table if not exists public.inventario_captura_presenca (
  inventario_id text not null,
  usuario_nome text not null,
  atualizado_em timestamptz not null default now(),
  primary key (inventario_id, usuario_nome)
);

create index if not exists idx_inventario_captura_presenca_inv
  on public.inventario_captura_presenca (inventario_id);

comment on table public.inventario_captura_presenca is
  'Heartbeat por inventário e usuário na tela de captura. Exibe quem está online contando.';

alter table public.inventario_captura_presenca enable row level security;

drop policy if exists "inv_captura_presenca_authenticated_select" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_authenticated_insert" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_authenticated_update" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_authenticated_delete" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_anon_select" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_anon_insert" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_anon_update" on public.inventario_captura_presenca;
drop policy if exists "inv_captura_presenca_anon_delete" on public.inventario_captura_presenca;

create policy "inv_captura_presenca_authenticated_select"
on public.inventario_captura_presenca for select to authenticated using (true);

create policy "inv_captura_presenca_authenticated_insert"
on public.inventario_captura_presenca for insert to authenticated with check (true);

create policy "inv_captura_presenca_authenticated_update"
on public.inventario_captura_presenca for update to authenticated using (true) with check (true);

create policy "inv_captura_presenca_authenticated_delete"
on public.inventario_captura_presenca for delete to authenticated using (true);

create policy "inv_captura_presenca_anon_select"
on public.inventario_captura_presenca for select to anon using (true);

create policy "inv_captura_presenca_anon_insert"
on public.inventario_captura_presenca for insert to anon with check (true);

create policy "inv_captura_presenca_anon_update"
on public.inventario_captura_presenca for update to anon using (true) with check (true);

create policy "inv_captura_presenca_anon_delete"
on public.inventario_captura_presenca for delete to anon using (true);
