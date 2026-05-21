-- Metadados da última alteração de EAN/DUN: horário exato e conferente.
-- Rode no Supabase SQL Editor após alter_todos_os_produtos_ean_dun_alterado_em.sql.

alter table public."Todos os Produtos"
  add column if not exists ean_alterado_em_hora timestamptz;

alter table public."Todos os Produtos"
  add column if not exists ean_alterado_conferente text;

alter table public."Todos os Produtos"
  add column if not exists dun_alterado_em_hora timestamptz;

alter table public."Todos os Produtos"
  add column if not exists dun_alterado_conferente text;

comment on column public."Todos os Produtos".ean_alterado_em_hora is
  'Data e hora (UTC) da última alteração do EAN no cadastro.';

comment on column public."Todos os Produtos".ean_alterado_conferente is
  'Nome do conferente (ou origem) da última alteração do EAN.';

comment on column public."Todos os Produtos".dun_alterado_em_hora is
  'Data e hora (UTC) da última alteração do DUN no cadastro.';

comment on column public."Todos os Produtos".dun_alterado_conferente is
  'Nome do conferente (ou origem) da última alteração do DUN.';
