-- Rascunho colaborativo e sessão de finalização no inventário (espelha contagens_estoque).
begin;

alter table public.contagens_inventario
  add column if not exists contagem_rascunho boolean not null default false;

alter table public.contagens_inventario
  add column if not exists finalizacao_sessao_id uuid;

alter table public.contagens_inventario
  add column if not exists planilha_grupo_armazem smallint;

alter table public.contagens_inventario
  add column if not exists planilha_ordem_na_aba integer;

comment on column public.contagens_inventario.contagem_rascunho is
  'true = prévia colaborativa em tempo real; false = linha da finalização do conferente.';

comment on column public.contagens_inventario.finalizacao_sessao_id is
  'Agrupa rascunhos da mesma sessão aberta no navegador (UUID).';

create index if not exists idx_contagens_inventario_finalizacao_sessao
  on public.contagens_inventario (finalizacao_sessao_id)
  where finalizacao_sessao_id is not null;

create index if not exists idx_contagens_inventario_rascunho
  on public.contagens_inventario (data_contagem, contagem_rascunho);

commit;
