-- Inventário físico em tabela própria (separado de contagens_estoque = contagem diária).
-- Depois rode: migrate_inventario_de_contagens_estoque_para_contagens_inventario.sql

begin;

create extension if not exists pgcrypto;

create table if not exists public.contagens_inventario (
  id uuid primary key default gen_random_uuid(),
  data_hora_contagem timestamptz not null default now(),
  data_contagem date,
  conferente_id uuid not null references public.conferentes (id) on delete restrict,
  produto_id uuid references public.produtos (id) on delete set null,
  codigo_interno text not null,
  descricao text not null,
  unidade_medida text,
  quantidade_up numeric(18, 3) not null,
  up_adicional numeric(18, 3),
  lote text,
  observacao text,
  data_fabricacao date,
  data_validade date,
  ean text,
  dun text,
  foto_base64 text,
  inventario_repeticao smallint,
  inventario_numero_contagem smallint,
  created_at timestamptz not null default now(),
  constraint contagens_inventario_repeticao_chk
    check (inventario_repeticao is null or inventario_repeticao between 1 and 3),
  constraint contagens_inventario_numero_contagem_chk
    check (inventario_numero_contagem is null or inventario_numero_contagem between 1 and 4)
);

comment on table public.contagens_inventario is
  'Registros do inventário físico (lista armazém, 3 repetições por produto). Contagem diária fica em contagens_estoque.';

create or replace function public.set_contagens_inventario_data_contagem()
returns trigger
language plpgsql
as $$
begin
  new.data_contagem := timezone('America/Sao_Paulo', new.data_hora_contagem)::date;
  return new;
end;
$$;

drop trigger if exists trg_set_contagens_inventario_data_contagem on public.contagens_inventario;
create trigger trg_set_contagens_inventario_data_contagem
before insert or update on public.contagens_inventario
for each row
execute function public.set_contagens_inventario_data_contagem();

create index if not exists idx_contagens_inventario_data_contagem
  on public.contagens_inventario (data_contagem);

create index if not exists idx_contagens_inventario_conferente
  on public.contagens_inventario (conferente_id);

create index if not exists idx_contagens_inventario_codigo
  on public.contagens_inventario (codigo_interno);

alter table public.contagens_inventario enable row level security;

drop policy if exists "contagens_inventario_auth_select" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_insert" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_update" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_delete" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_select" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_insert" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_update" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_delete" on public.contagens_inventario;

create policy "contagens_inventario_auth_select" on public.contagens_inventario for select to authenticated using (true);
create policy "contagens_inventario_auth_insert" on public.contagens_inventario for insert to authenticated with check (true);
create policy "contagens_inventario_auth_update" on public.contagens_inventario for update to authenticated using (true) with check (true);
create policy "contagens_inventario_auth_delete" on public.contagens_inventario for delete to authenticated using (true);

create policy "contagens_inventario_anon_select" on public.contagens_inventario for select to anon using (true);
create policy "contagens_inventario_anon_insert" on public.contagens_inventario for insert to anon with check (true);
create policy "contagens_inventario_anon_update" on public.contagens_inventario for update to anon using (true) with check (true);
create policy "contagens_inventario_anon_delete" on public.contagens_inventario for delete to anon using (true);

-- FK opcional da planilha física → registro canônico do inventário
alter table public.inventario_planilha_linhas
  add column if not exists contagens_inventario_id uuid references public.contagens_inventario (id) on delete set null;

create index if not exists idx_inventario_planilha_contagens_inventario_fk
  on public.inventario_planilha_linhas (contagens_inventario_id)
  where contagens_inventario_id is not null;

commit;
