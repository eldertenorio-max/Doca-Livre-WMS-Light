-- Sessões de contagem diária (hub) compartilhadas entre dispositivos.

create table if not exists public.contagem_diaria_sessoes (
  id uuid primary key,
  numero int not null,
  titulo text not null,
  local text not null default 'ULTRAPAO GUARULHOS DISTRI',
  data_contagem date not null,
  conferente_nome text,
  data_inicio timestamptz not null,
  data_fim timestamptz,
  status text not null check (status in ('aberto', 'fechado')),
  iniciada boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contagem_diaria_sessoes_status on public.contagem_diaria_sessoes (status);
create index if not exists idx_contagem_diaria_sessoes_numero on public.contagem_diaria_sessoes (numero desc);
create index if not exists idx_contagem_diaria_sessoes_updated on public.contagem_diaria_sessoes (updated_at desc);

comment on table public.contagem_diaria_sessoes is
  'Lista de contagens diárias sincronizada entre coletor, notebook e outros dispositivos.';

alter table public.contagem_diaria_sessoes enable row level security;

drop policy if exists "cd_sessoes_authenticated_select" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_authenticated_insert" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_authenticated_update" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_authenticated_delete" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_anon_select" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_anon_insert" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_anon_update" on public.contagem_diaria_sessoes;
drop policy if exists "cd_sessoes_anon_delete" on public.contagem_diaria_sessoes;

create policy "cd_sessoes_authenticated_select"
on public.contagem_diaria_sessoes for select to authenticated using (true);

create policy "cd_sessoes_authenticated_insert"
on public.contagem_diaria_sessoes for insert to authenticated with check (true);

create policy "cd_sessoes_authenticated_update"
on public.contagem_diaria_sessoes for update to authenticated using (true) with check (true);

create policy "cd_sessoes_authenticated_delete"
on public.contagem_diaria_sessoes for delete to authenticated using (true);

create policy "cd_sessoes_anon_select"
on public.contagem_diaria_sessoes for select to anon using (true);

create policy "cd_sessoes_anon_insert"
on public.contagem_diaria_sessoes for insert to anon with check (true);

create policy "cd_sessoes_anon_update"
on public.contagem_diaria_sessoes for update to anon using (true) with check (true);

create policy "cd_sessoes_anon_delete"
on public.contagem_diaria_sessoes for delete to anon using (true);
