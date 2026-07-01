-- Aprovação de novos cadastros pelo admin (diego / diego.isidoro).
-- Execute após alter_usuarios_permissoes_views.sql (ou create_usuarios.sql).
--
-- Novos usuários: acesso_autorizado = false, permissoes_views = [].
-- Admin autoriza na aba «Permissões de acesso» marcando telas e clicando em Autorizar.

begin;

alter table public.usuarios
  add column if not exists acesso_autorizado boolean not null default false;

comment on column public.usuarios.acesso_autorizado is
  'false = aguardando aprovação do admin; true = pode usar o app conforme permissoes_views.';

-- Usuários já existentes no momento da migração continuam liberados.
update public.usuarios
set acesso_autorizado = true;

-- Admin sempre autorizado
update public.usuarios
set acesso_autorizado = true
where lower(coalesce(username, '')) in ('diego', 'diego.isidoro');

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_nome text;
  uname text;
  admin_user boolean;
begin
  meta_nome := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  );

  uname := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));
  if uname is null or uname = '' then
    uname := lower(split_part(coalesce(new.email, ''), '@', 1));
  end if;

  admin_user := uname in ('diego', 'diego.isidoro');

  insert into public.usuarios (id, nome, username, acesso_autorizado, permissoes_views)
  values (
    new.id,
    coalesce(meta_nome, ''),
    nullif(uname, ''),
    admin_user,
    case when admin_user then null else '[]'::jsonb end
  )
  on conflict (id) do update
    set nome = coalesce(nullif(excluded.nome, ''), public.usuarios.nome),
        username = coalesce(nullif(excluded.username, ''), public.usuarios.username),
        updated_at = now();

  return new;
end;
$$;

commit;
