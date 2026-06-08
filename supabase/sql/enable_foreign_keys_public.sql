-- Foreign keys em public.* (necessárias para PostgREST embed tipo conferentes(nome)).
-- A migração por colunas não copia FKs; rode no projeto novo após clonar dados.

begin;

-- contagens_estoque
alter table public.contagens_estoque
  drop constraint if exists contagens_estoque_conferente_id_fkey;
alter table public.contagens_estoque
  add constraint contagens_estoque_conferente_id_fkey
  foreign key (conferente_id) references public.conferentes (id) on delete restrict;

alter table public.contagens_estoque
  drop constraint if exists contagens_estoque_produto_id_fkey;
alter table public.contagens_estoque
  add constraint contagens_estoque_produto_id_fkey
  foreign key (produto_id) references public.produtos (id) on delete set null;

-- contagens_inventario
alter table public.contagens_inventario
  drop constraint if exists contagens_inventario_conferente_id_fkey;
alter table public.contagens_inventario
  add constraint contagens_inventario_conferente_id_fkey
  foreign key (conferente_id) references public.conferentes (id) on delete restrict;

alter table public.contagens_inventario
  drop constraint if exists contagens_inventario_produto_id_fkey;
alter table public.contagens_inventario
  add constraint contagens_inventario_produto_id_fkey
  foreign key (produto_id) references public.produtos (id) on delete set null;

-- contagem_diaria_presenca
alter table public.contagem_diaria_presenca
  drop constraint if exists contagem_diaria_presenca_conferente_id_fkey;
alter table public.contagem_diaria_presenca
  add constraint contagem_diaria_presenca_conferente_id_fkey
  foreign key (conferente_id) references public.conferentes (id) on delete cascade;

-- inventario_planilha_linhas
alter table public.inventario_planilha_linhas
  drop constraint if exists inventario_planilha_linhas_conferente_id_fkey;
alter table public.inventario_planilha_linhas
  add constraint inventario_planilha_linhas_conferente_id_fkey
  foreign key (conferente_id) references public.conferentes (id) on delete restrict;

alter table public.inventario_planilha_linhas
  drop constraint if exists inventario_planilha_linhas_produto_id_fkey;
alter table public.inventario_planilha_linhas
  add constraint inventario_planilha_linhas_produto_id_fkey
  foreign key (produto_id) references public.produtos (id) on delete set null;

alter table public.inventario_planilha_linhas
  drop constraint if exists inventario_planilha_linhas_contagens_estoque_id_fkey;
alter table public.inventario_planilha_linhas
  add constraint inventario_planilha_linhas_contagens_estoque_id_fkey
  foreign key (contagens_estoque_id) references public.contagens_estoque (id) on delete cascade;

alter table public.inventario_planilha_linhas
  drop constraint if exists inventario_planilha_linhas_contagens_inventario_id_fkey;
alter table public.inventario_planilha_linhas
  add constraint inventario_planilha_linhas_contagens_inventario_id_fkey
  foreign key (contagens_inventario_id) references public.contagens_inventario (id) on delete set null;

-- usuarios ↔ auth
alter table public.usuarios
  drop constraint if exists usuarios_id_fkey;
alter table public.usuarios
  add constraint usuarios_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

commit;

-- Recarrega schema cache do PostgREST (Supabase expõe automaticamente após DDL; se persistir, aguarde ~1 min).
