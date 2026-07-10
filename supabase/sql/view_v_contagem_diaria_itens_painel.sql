-- Gerado de zvazpqdvnlecqadxacgv em 2026-07-10T00:51:04.333Z
drop view if exists public.v_contagem_diaria_itens_painel cascade;
create view public.v_contagem_diaria_itens_painel as
 WITH primeira_por_codigo AS (
         SELECT DISTINCT ON (ce.data_contagem, ce.codigo_interno) ce.data_contagem,
            ce.codigo_interno,
            ce.descricao,
            ce.quantidade_up AS quantidade_contada,
            ce.conferente_id,
            COALESCE(ce.created_at, ce.data_hora_contagem) AS ts
           FROM contagens_estoque ce
          WHERE ce.origem = 'contagem_diaria'::text AND COALESCE(ce.contagem_rascunho, false) = false AND ce.codigo_interno IS NOT NULL
          ORDER BY ce.data_contagem, ce.codigo_interno, (COALESCE(ce.created_at, ce.data_hora_contagem)), ce.id
        )
 SELECT p.data_contagem,
    COALESCE(cf.nome, p.conferente_id::text) AS conferente_nome,
    p.codigo_interno,
    p.descricao,
    p.quantidade_contada
   FROM primeira_por_codigo p
     LEFT JOIN conferentes cf ON cf.id = p.conferente_id;;
