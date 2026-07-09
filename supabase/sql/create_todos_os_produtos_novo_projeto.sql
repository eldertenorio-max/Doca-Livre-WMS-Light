-- Cadastro principal de produtos (tabela com espaço no nome).
-- Rode no SQL Editor do projeto NOVO antes dos scripts de RLS/sync.

begin;

create extension if not exists pgcrypto;

create table if not exists public."Todos os Produtos" (
  id serial primary key,
  codigo_interno text not null,
  descricao text not null,
  unidade text,
  unidade_medida text,
  ean text,
  dun text,
  foto_base64 text,
  ean_dun_alterado_em date,
  ean_alterado_em date,
  dun_alterado_em date,
  ean_alterado_em_hora timestamptz,
  ean_alterado_conferente text,
  dun_alterado_em_hora timestamptz,
  dun_alterado_conferente text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_todos_os_produtos_codigo_trim
  on public."Todos os Produtos" (trim(both from codigo_interno));

create unique index if not exists idx_todos_os_produtos_ean_unique
  on public."Todos os Produtos" (ean)
  where ean is not null and trim(ean) <> '';

create unique index if not exists idx_todos_os_produtos_dun_unique
  on public."Todos os Produtos" (dun)
  where dun is not null and trim(dun) <> '';

commit;
