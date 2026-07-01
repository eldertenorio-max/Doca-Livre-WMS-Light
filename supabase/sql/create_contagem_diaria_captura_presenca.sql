-- Presença em tempo quase real na coleta de contagem diária (heartbeat por sessão).
-- O app envia upsert periódico; a lista de gerenciamento mostra quem está contando.

create table if not exists public.contagem_diaria_captura_presenca (
  contagem_id text not null,
  usuario_nome text not null,
  atualizado_em timestamptz not null default now(),
  primary key (contagem_id, usuario_nome)
);

create index if not exists idx_contagem_diaria_captura_presenca_contagem
  on public.contagem_diaria_captura_presenca (contagem_id);

comment on table public.contagem_diaria_captura_presenca is
  'Heartbeat por contagem diária e usuário na tela de captura. Exibe quem está online contando.';

alter table public.contagem_diaria_captura_presenca enable row level security;

drop policy if exists "cd_captura_presenca_authenticated_select" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_authenticated_insert" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_authenticated_update" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_authenticated_delete" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_anon_select" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_anon_insert" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_anon_update" on public.contagem_diaria_captura_presenca;
drop policy if exists "cd_captura_presenca_anon_delete" on public.contagem_diaria_captura_presenca;

create policy "cd_captura_presenca_authenticated_select"
on public.contagem_diaria_captura_presenca for select to authenticated using (true);

create policy "cd_captura_presenca_authenticated_insert"
on public.contagem_diaria_captura_presenca for insert to authenticated with check (true);

create policy "cd_captura_presenca_authenticated_update"
on public.contagem_diaria_captura_presenca for update to authenticated using (true) with check (true);

create policy "cd_captura_presenca_authenticated_delete"
on public.contagem_diaria_captura_presenca for delete to authenticated using (true);

create policy "cd_captura_presenca_anon_select"
on public.contagem_diaria_captura_presenca for select to anon using (true);

create policy "cd_captura_presenca_anon_insert"
on public.contagem_diaria_captura_presenca for insert to anon with check (true);

create policy "cd_captura_presenca_anon_update"
on public.contagem_diaria_captura_presenca for update to anon using (true) with check (true);

create policy "cd_captura_presenca_anon_delete"
on public.contagem_diaria_captura_presenca for delete to anon using (true);
