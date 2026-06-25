-- Produto auxiliar do inventário: código 0, descrição "vazio".
-- Use ao bipar/digitar "0" em uma posição SEM produto (marca o slot como vazio).
--
-- Rode no Supabase: SQL Editor → Run.

begin;

insert into public."Todos os Produtos" (codigo_interno, descricao, unidade)
select
  '0',
  'vazio',
  ''
where not exists (
  select 1
  from public."Todos os Produtos" t
  where trim(both from t.codigo_interno) = '0'
);

-- Se o código 0 já existir com descrição em branco, atualiza para "vazio":
update public."Todos os Produtos"
set descricao = 'vazio'
where trim(both from codigo_interno) = '0'
  and coalesce(trim(both from descricao), '') = '';

-- Se a tabela usar unidade_medida em vez de unidade, descomente e rode só este bloco
-- (comente o insert acima se já inseriu sem unidade):
/*
insert into public."Todos os Produtos" (codigo_interno, descricao, unidade_medida)
select '0', 'vazio', null
where not exists (
  select 1 from public."Todos os Produtos" t
  where trim(both from t.codigo_interno) = '0'
);
update public."Todos os Produtos"
set descricao = 'vazio'
where trim(both from codigo_interno) = '0';
*/

commit;
