-- Gerado de swnefuddaswgjvhiuxok em 2026-06-08T13:31:02.734Z
drop view if exists public.v_contagem_diaria_painel cascade;
create view public.v_contagem_diaria_painel as
 WITH primeira_por_linha AS (
         SELECT DISTINCT ON (ce.data_contagem, ce.codigo_interno) ce.data_contagem,
            ce.codigo_interno,
            ce.conferente_id,
            COALESCE(ce.created_at, ce.data_hora_contagem) AS ts
           FROM contagens_estoque ce
          WHERE ce.origem = 'contagem_diaria'::text AND COALESCE(ce.contagem_rascunho, false) = false AND ce.codigo_interno IS NOT NULL
          ORDER BY ce.data_contagem, ce.codigo_interno, (COALESCE(ce.created_at, ce.data_hora_contagem)), ce.id
        )
 SELECT p.data_contagem,
    p.conferente_id,
    COALESCE(cf.nome, p.conferente_id::text) AS conferente_nome,
    count(*) AS itens_contados,
    min(p.ts) AS inicio,
    max(p.ts) AS fim
   FROM primeira_por_linha p
     LEFT JOIN conferentes cf ON cf.id = p.conferente_id
  GROUP BY p.data_contagem, p.conferente_id, (COALESCE(cf.nome, p.conferente_id::text));;
