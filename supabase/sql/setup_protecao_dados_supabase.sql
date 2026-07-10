-- Proteção global: impede purge automático e exclusões em massa no banco.
-- Rode este arquivo no SQL Editor do Supabase (pode reaplicar com segurança).
--
-- Com proteção ativa (padrão):
--   • Jobs pg_cron de purge ficam DESAGENDADOS
--   • Funções purge_* retornam sem apagar nada
--   • O app bloqueia exclusão em massa (por data_contagem / dia inteiro)
--
-- Flag no banco (uso futuro / auditoria):
--   update public.sistema_protecao_dados set ativa = false where id = 1;

create table if not exists public.sistema_protecao_dados (
  id smallint primary key default 1 check (id = 1),
  ativa boolean not null default true,
  atualizado_em timestamptz not null default now()
);

insert into public.sistema_protecao_dados (id, ativa)
values (1, true)
on conflict (id) do nothing;

comment on table public.sistema_protecao_dados is
  'Flag global: quando ativa, bloqueia purge automático no banco.';

alter table public.sistema_protecao_dados enable row level security;

grant select on table public.sistema_protecao_dados to anon, authenticated;
grant all on table public.sistema_protecao_dados to service_role;

drop policy if exists "sistema_protecao_select_all" on public.sistema_protecao_dados;
create policy "sistema_protecao_select_all"
on public.sistema_protecao_dados
for select
to anon, authenticated
using (true);

drop policy if exists "sistema_protecao_service_role_all" on public.sistema_protecao_dados;
create policy "sistema_protecao_service_role_all"
on public.sistema_protecao_dados
for all
to service_role
using (true)
with check (true);

create or replace function public.protecao_dados_supabase_ativa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select ativa from public.sistema_protecao_dados where id = 1 limit 1),
    true
  );
$$;

comment on function public.protecao_dados_supabase_ativa() is
  'Retorna true quando a proteção contra exclusão/purge de dados está ativa.';

revoke all on function public.protecao_dados_supabase_ativa() from public;
grant execute on function public.protecao_dados_supabase_ativa() to anon, authenticated, service_role;

-- ——— Purge operacional (contagens, planilha, outbox, presença) ———
create or replace function public.purge_dados_operacionais_antigas(
  p_keep_calendar_days integer default 2,
  p_strip_foto_base64_antes_de_hoje boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.protecao_dados_supabase_ativa() then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'protecao_dados_supabase_ativa',
      'inventario_planilha_linhas', 0,
      'contagens_estoque', 0,
      'sheet_outbox', 0,
      'contagem_diaria_presenca', 0,
      'foto_base64_nulled_rows', 0
    );
  end if;

  return jsonb_build_object(
    'skipped', true,
    'reason', 'purge_desabilitado_no_projeto',
    'inventario_planilha_linhas', 0,
    'contagens_estoque', 0,
    'sheet_outbox', 0,
    'contagem_diaria_presenca', 0,
    'foto_base64_nulled_rows', 0
  );
end;
$$;

create or replace function public.purge_contagens_estoque_antigas(p_keep_calendar_days integer default 2)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (public.purge_dados_operacionais_antigas(p_keep_calendar_days, true)->>'contagens_estoque')::bigint,
    0
  );
$$;

-- ——— Purge painel contagem diária ———
create or replace function public.purge_contagem_diaria_painel_antigas(
  p_keep_calendar_days integer default 2
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.protecao_dados_supabase_ativa() then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'protecao_dados_supabase_ativa',
      'contagens_estoque_contagem_diaria', 0,
      'contagem_diaria_presenca', 0
    );
  end if;

  return jsonb_build_object(
    'skipped', true,
    'reason', 'purge_desabilitado_no_projeto',
    'contagens_estoque_contagem_diaria', 0,
    'contagem_diaria_presenca', 0
  );
end;
$$;

-- ——— Purge ambiental mensal ———
create or replace function public.purge_contagem_ambiental_temperatura_ocupacao_mensal()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.protecao_dados_supabase_ativa() then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'protecao_dados_supabase_ativa',
      'contagem_temperatura_camaras_deleted', 0,
      'contagem_ocupacao_camaras_deleted', 0,
      'contagem_ocupacao_avaria_camaras_legacy_deleted', 0
    );
  end if;

  return jsonb_build_object(
    'skipped', true,
    'reason', 'purge_desabilitado_no_projeto',
    'contagem_temperatura_camaras_deleted', 0,
    'contagem_ocupacao_camaras_deleted', 0,
    'contagem_ocupacao_avaria_camaras_legacy_deleted', 0
  );
end;
$$;

-- ——— Desagenda jobs de purge (se pg_cron existir) ———
do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname in (
      'purge_contagens_estoque_retencao_2d',
      'purge_contagem_diaria_painel_retencao_2d',
      'purge_contagem_ambiental_temp_ocup_mensal'
    );
  end if;
exception
  when undefined_table then null;
  when invalid_schema_name then null;
end;
$$;
