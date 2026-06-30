-- Vínculo do inventário com lista de endereçamento e lista de produtos.
-- PRÉ-REQUISITO: rodar antes create_inventario_sessoes.sql (ou setup_inventario_listas_completo.sql).

alter table public.inventario_sessoes
  add column if not exists lista_enderecamento_id uuid,
  add column if not exists lista_enderecamento_nome text,
  add column if not exists lista_produtos_id uuid,
  add column if not exists lista_produtos_nome text;

comment on column public.inventario_sessoes.lista_enderecamento_id is 'Lista de endereços (enderecamento_listas) usada neste inventário.';
comment on column public.inventario_sessoes.lista_produtos_id is 'Lista de produtos (produto_listas) usada neste inventário.';
