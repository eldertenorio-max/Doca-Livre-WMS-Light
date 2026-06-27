-- Contexto do inventário físico no heartbeat de presença (câmara/rua onde o conferente está).
-- Execute após alter_contagem_diaria_presenca_progresso.sql

alter table public.contagem_diaria_presenca
  add column if not exists camara integer;

alter table public.contagem_diaria_presenca
  add column if not exists rua text;

comment on column public.contagem_diaria_presenca.camara is
  'Câmara da aba em que o conferente está contando (inventário planilha; snapshot no heartbeat).';

comment on column public.contagem_diaria_presenca.rua is
  'Rua selecionada na planilha do inventário (snapshot no heartbeat).';
