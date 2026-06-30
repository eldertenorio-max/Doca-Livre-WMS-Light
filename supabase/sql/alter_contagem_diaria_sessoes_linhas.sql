-- Linhas de captura e lista de produtos na sessão de contagem diária.

alter table public.contagem_diaria_sessoes
  add column if not exists lista_produtos_id uuid,
  add column if not exists lista_produtos_nome text,
  add column if not exists linhas jsonb not null default '[]'::jsonb;

comment on column public.contagem_diaria_sessoes.linhas is
  'Linhas capturadas (código, quantidade, validade, etc.) nesta contagem diária.';
