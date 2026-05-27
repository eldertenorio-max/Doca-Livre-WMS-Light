-- Move inventário de contagens_estoque → contagens_inventario (mantém os mesmos UUIDs).
-- Pré-requisito: create_contagens_inventario.sql
-- Revise o SELECT de contagem antes do DELETE.

begin;

insert into public.contagens_inventario (
  id,
  data_hora_contagem,
  data_contagem,
  conferente_id,
  produto_id,
  codigo_interno,
  descricao,
  unidade_medida,
  quantidade_up,
  up_adicional,
  lote,
  observacao,
  data_fabricacao,
  data_validade,
  ean,
  dun,
  foto_base64,
  inventario_repeticao,
  inventario_numero_contagem,
  created_at
)
select
  c.id,
  c.data_hora_contagem,
  c.data_contagem,
  c.conferente_id,
  c.produto_id,
  c.codigo_interno,
  c.descricao,
  c.unidade_medida,
  c.quantidade_up,
  c.up_adicional,
  c.lote,
  c.observacao,
  c.data_fabricacao,
  c.data_validade,
  c.ean,
  c.dun,
  c.foto_base64,
  c.inventario_repeticao,
  c.inventario_numero_contagem,
  c.created_at
from public.contagens_estoque c
where
  c.origem = 'inventario'
  or c.inventario_repeticao is not null
  or c.inventario_numero_contagem is not null
on conflict (id) do nothing;

update public.inventario_planilha_linhas pl
set contagens_inventario_id = pl.contagens_estoque_id
where pl.contagens_estoque_id is not null
  and pl.contagens_inventario_id is null
  and exists (
    select 1 from public.contagens_inventario ci where ci.id = pl.contagens_estoque_id
  );

delete from public.contagens_estoque c
where
  c.origem = 'inventario'
  or c.inventario_repeticao is not null
  or c.inventario_numero_contagem is not null;

commit;

-- Conferência:
-- select count(*) from public.contagens_inventario;
-- select count(*) from public.contagens_estoque where origem = 'inventario';
