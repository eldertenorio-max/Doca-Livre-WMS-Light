-- Permite admin excluir usuários e conferentes órfãos.
-- Execute após alter_usuarios_permissoes_views.sql (função is_app_admin).

begin;

drop policy if exists "usuarios_admin_delete" on public.usuarios;
create policy "usuarios_admin_delete"
on public.usuarios
for delete
to authenticated
using (public.is_app_admin() and id <> auth.uid());

grant delete on table public.conferentes to authenticated;

drop policy if exists "conferentes_admin_delete" on public.conferentes;
create policy "conferentes_admin_delete"
on public.conferentes
for delete
to authenticated
using (public.is_app_admin());

commit;
