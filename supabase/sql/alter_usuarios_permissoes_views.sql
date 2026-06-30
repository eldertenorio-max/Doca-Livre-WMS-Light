-- Permissões de acesso ao menu do app por usuário.
-- Execute no SQL Editor do Supabase após create_usuarios.sql.
--
-- `permissoes_views`: array JSON de ids de tela (ex.: ["painel","estoque"]).
-- NULL = acesso total (compatível com usuários já cadastrados).
-- Admin do app: username diego / diego.isidoro (função is_app_admin).

begin;

alter table public.usuarios
  add column if not exists permissoes_views jsonb;

comment on column public.usuarios.permissoes_views is
  'Ids das telas do menu permitidas. NULL = todas; array vazio = nenhuma.';

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = auth.uid()
      and lower(coalesce(u.username, '')) in ('diego.isidoro', 'diego')
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

drop policy if exists "usuarios_admin_select_all" on public.usuarios;
create policy "usuarios_admin_select_all"
on public.usuarios
for select
to authenticated
using (public.is_app_admin());

drop policy if exists "usuarios_admin_update_all" on public.usuarios;
create policy "usuarios_admin_update_all"
on public.usuarios
for update
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

commit;
