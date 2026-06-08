-- Primary keys e uniques em public.* (migração por colunas não copia constraints).
-- Rode antes de enable_foreign_keys_public.sql no projeto novo.

begin;

alter table public.conferentes
  drop constraint if exists conferentes_pkey;
alter table public.conferentes
  add primary key (id);

alter table public.produtos
  drop constraint if exists produtos_pkey;
alter table public.produtos
  add primary key (id);

alter table public.contagens_estoque
  drop constraint if exists contagens_estoque_pkey;
alter table public.contagens_estoque
  add primary key (id);

alter table public.contagens_inventario
  drop constraint if exists contagens_inventario_pkey;
alter table public.contagens_inventario
  add primary key (id);

alter table public.usuarios
  drop constraint if exists usuarios_pkey;
alter table public.usuarios
  add primary key (id);

alter table public.sheet_outbox
  drop constraint if exists sheet_outbox_pkey;
alter table public.sheet_outbox
  add primary key (id);

-- "Todos os Produtos": PK em id só se não houver nulls (ver alter_todos_os_produtos_primary_key.sql).
-- alter table public."Todos os Produtos" add primary key (id);

alter table public.inventario_planilha_linhas
  drop constraint if exists inventario_planilha_linhas_pkey;
alter table public.inventario_planilha_linhas
  add primary key (id);

alter table public.contagem_ocupacao_avaria_camaras
  drop constraint if exists contagem_ocupacao_avaria_camaras_pkey;
alter table public.contagem_ocupacao_avaria_camaras
  add primary key (id);

alter table public.contagem_ocupacao_camaras
  drop constraint if exists contagem_ocupacao_camaras_pkey;
alter table public.contagem_ocupacao_camaras
  add primary key (id);

alter table public.contagem_temperatura_camaras
  drop constraint if exists contagem_temperatura_camaras_pkey;
alter table public.contagem_temperatura_camaras
  add primary key (id);

alter table public.contagem_diaria_presenca
  drop constraint if exists contagem_diaria_presenca_pkey;
alter table public.contagem_diaria_presenca
  add primary key (conferente_id, data_contagem);

-- Uniques usados pelo app / outbox
alter table public.produtos
  drop constraint if exists produtos_codigo_interno_key;
alter table public.produtos
  add constraint produtos_codigo_interno_key unique (codigo_interno);

alter table public.sheet_outbox
  drop constraint if exists sheet_outbox_aba_codigo_interno_descricao_data_contagem_key;
alter table public.sheet_outbox
  add constraint sheet_outbox_aba_codigo_interno_descricao_data_contagem_key
  unique (aba, codigo_interno, descricao, data_contagem);

commit;
