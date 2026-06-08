-- RLS: conferentes, produtos, contagens_estoque, sheet_outbox, inventário, ambiental, usuarios
-- (Todos os Produtos → rls_todos_os_produtos_crud.sql)

-- conferentes
alter table public.conferentes enable row level security;
grant select, insert on table public.conferentes to anon, authenticated;
drop policy if exists "conferentes_authenticated_select" on public.conferentes;
drop policy if exists "conferentes_authenticated_insert" on public.conferentes;
drop policy if exists "conferentes_anon_select" on public.conferentes;
drop policy if exists "conferentes_anon_insert" on public.conferentes;
create policy "conferentes_authenticated_select" on public.conferentes for select to authenticated using (true);
create policy "conferentes_authenticated_insert" on public.conferentes for insert to authenticated with check (true);
create policy "conferentes_anon_select" on public.conferentes for select to anon using (true);
create policy "conferentes_anon_insert" on public.conferentes for insert to anon with check (true);

-- produtos
alter table public.produtos enable row level security;
grant select, insert on table public.produtos to anon, authenticated;
drop policy if exists "produtos_authenticated_select" on public.produtos;
drop policy if exists "produtos_authenticated_insert" on public.produtos;
drop policy if exists "produtos_anon_select" on public.produtos;
drop policy if exists "produtos_anon_insert" on public.produtos;
create policy "produtos_authenticated_select" on public.produtos for select to authenticated using (true);
create policy "produtos_authenticated_insert" on public.produtos for insert to authenticated with check (true);
create policy "produtos_anon_select" on public.produtos for select to anon using (true);
create policy "produtos_anon_insert" on public.produtos for insert to anon with check (true);

-- contagens_estoque
alter table public.contagens_estoque enable row level security;
grant select, insert, update, delete on table public.contagens_estoque to anon, authenticated;
drop policy if exists "contagens_authenticated_select" on public.contagens_estoque;
drop policy if exists "contagens_authenticated_insert" on public.contagens_estoque;
drop policy if exists "contagens_authenticated_update" on public.contagens_estoque;
drop policy if exists "contagens_authenticated_delete" on public.contagens_estoque;
drop policy if exists "contagens_anon_select" on public.contagens_estoque;
drop policy if exists "contagens_anon_insert" on public.contagens_estoque;
drop policy if exists "contagens_anon_update" on public.contagens_estoque;
drop policy if exists "contagens_anon_delete" on public.contagens_estoque;
create policy "contagens_authenticated_select" on public.contagens_estoque for select to authenticated using (true);
create policy "contagens_authenticated_insert" on public.contagens_estoque for insert to authenticated with check (true);
create policy "contagens_authenticated_update" on public.contagens_estoque for update to authenticated using (true) with check (true);
create policy "contagens_authenticated_delete" on public.contagens_estoque for delete to authenticated using (true);
create policy "contagens_anon_select" on public.contagens_estoque for select to anon using (true);
create policy "contagens_anon_insert" on public.contagens_estoque for insert to anon with check (true);
create policy "contagens_anon_update" on public.contagens_estoque for update to anon using (true) with check (true);
create policy "contagens_anon_delete" on public.contagens_estoque for delete to anon using (true);

-- contagens_inventario
alter table public.contagens_inventario enable row level security;
grant select, insert, update, delete on table public.contagens_inventario to anon, authenticated;
drop policy if exists "contagens_inventario_auth_select" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_insert" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_update" on public.contagens_inventario;
drop policy if exists "contagens_inventario_auth_delete" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_select" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_insert" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_update" on public.contagens_inventario;
drop policy if exists "contagens_inventario_anon_delete" on public.contagens_inventario;
create policy "contagens_inventario_auth_select" on public.contagens_inventario for select to authenticated using (true);
create policy "contagens_inventario_auth_insert" on public.contagens_inventario for insert to authenticated with check (true);
create policy "contagens_inventario_auth_update" on public.contagens_inventario for update to authenticated using (true) with check (true);
create policy "contagens_inventario_auth_delete" on public.contagens_inventario for delete to authenticated using (true);
create policy "contagens_inventario_anon_select" on public.contagens_inventario for select to anon using (true);
create policy "contagens_inventario_anon_insert" on public.contagens_inventario for insert to anon with check (true);
create policy "contagens_inventario_anon_update" on public.contagens_inventario for update to anon using (true) with check (true);
create policy "contagens_inventario_anon_delete" on public.contagens_inventario for delete to anon using (true);

-- inventario_planilha_linhas
alter table public.inventario_planilha_linhas enable row level security;
grant select, insert, update, delete on table public.inventario_planilha_linhas to anon, authenticated;
drop policy if exists "inventario_planilha_auth_select" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_auth_insert" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_auth_update" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_auth_delete" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_anon_select" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_anon_insert" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_anon_update" on public.inventario_planilha_linhas;
drop policy if exists "inventario_planilha_anon_delete" on public.inventario_planilha_linhas;
create policy "inventario_planilha_auth_select" on public.inventario_planilha_linhas for select to authenticated using (true);
create policy "inventario_planilha_auth_insert" on public.inventario_planilha_linhas for insert to authenticated with check (true);
create policy "inventario_planilha_auth_update" on public.inventario_planilha_linhas for update to authenticated using (true) with check (true);
create policy "inventario_planilha_auth_delete" on public.inventario_planilha_linhas for delete to authenticated using (true);
create policy "inventario_planilha_anon_select" on public.inventario_planilha_linhas for select to anon using (true);
create policy "inventario_planilha_anon_insert" on public.inventario_planilha_linhas for insert to anon with check (true);
create policy "inventario_planilha_anon_update" on public.inventario_planilha_linhas for update to anon using (true) with check (true);
create policy "inventario_planilha_anon_delete" on public.inventario_planilha_linhas for delete to anon using (true);

-- contagem_diaria_presenca
alter table public.contagem_diaria_presenca enable row level security;
grant select, insert, update, delete on table public.contagem_diaria_presenca to anon, authenticated;
drop policy if exists "contagem_presenca_authenticated_select" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_authenticated_insert" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_authenticated_update" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_authenticated_delete" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_anon_select" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_anon_insert" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_anon_update" on public.contagem_diaria_presenca;
drop policy if exists "contagem_presenca_anon_delete" on public.contagem_diaria_presenca;
create policy "contagem_presenca_authenticated_select" on public.contagem_diaria_presenca for select to authenticated using (true);
create policy "contagem_presenca_authenticated_insert" on public.contagem_diaria_presenca for insert to authenticated with check (true);
create policy "contagem_presenca_authenticated_update" on public.contagem_diaria_presenca for update to authenticated using (true) with check (true);
create policy "contagem_presenca_authenticated_delete" on public.contagem_diaria_presenca for delete to authenticated using (true);
create policy "contagem_presenca_anon_select" on public.contagem_diaria_presenca for select to anon using (true);
create policy "contagem_presenca_anon_insert" on public.contagem_diaria_presenca for insert to anon with check (true);
create policy "contagem_presenca_anon_update" on public.contagem_diaria_presenca for update to anon using (true) with check (true);
create policy "contagem_presenca_anon_delete" on public.contagem_diaria_presenca for delete to anon using (true);

-- temperatura / ocupação câmaras
alter table public.contagem_temperatura_camaras enable row level security;
alter table public.contagem_ocupacao_camaras enable row level security;
grant select, insert, update, delete on table public.contagem_temperatura_camaras to anon, authenticated;
grant select, insert, update, delete on table public.contagem_ocupacao_camaras to anon, authenticated;
drop policy if exists "temp_cam_auth_all" on public.contagem_temperatura_camaras;
drop policy if exists "temp_cam_anon_all" on public.contagem_temperatura_camaras;
drop policy if exists "ocup_cam_auth_all" on public.contagem_ocupacao_camaras;
drop policy if exists "ocup_cam_anon_all" on public.contagem_ocupacao_camaras;
create policy "temp_cam_auth_all" on public.contagem_temperatura_camaras for all to authenticated using (true) with check (true);
create policy "temp_cam_anon_all" on public.contagem_temperatura_camaras for all to anon using (true) with check (true);
create policy "ocup_cam_auth_all" on public.contagem_ocupacao_camaras for all to authenticated using (true) with check (true);
create policy "ocup_cam_anon_all" on public.contagem_ocupacao_camaras for all to anon using (true) with check (true);

-- ocupacao avaria
alter table public.contagem_ocupacao_avaria_camaras enable row level security;
grant select, insert, update, delete on table public.contagem_ocupacao_avaria_camaras to anon, authenticated;
drop policy if exists "ocup_avaria_auth_all" on public.contagem_ocupacao_avaria_camaras;
drop policy if exists "ocup_avaria_anon_all" on public.contagem_ocupacao_avaria_camaras;
create policy "ocup_avaria_auth_all" on public.contagem_ocupacao_avaria_camaras for all to authenticated using (true) with check (true);
create policy "ocup_avaria_anon_all" on public.contagem_ocupacao_avaria_camaras for all to anon using (true) with check (true);

-- sheet_outbox
alter table public.sheet_outbox enable row level security;
drop policy if exists "sheet_outbox_auth_select_none" on public.sheet_outbox;
drop policy if exists "sheet_outbox_auth_insert_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_auth_update_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_auth_delete_none" on public.sheet_outbox;
drop policy if exists "sheet_outbox_anon_select_none" on public.sheet_outbox;
drop policy if exists "sheet_outbox_anon_insert_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_anon_update_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_anon_delete_none" on public.sheet_outbox;
drop policy if exists "sheet_outbox_public_insert_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_public_update_allow" on public.sheet_outbox;
drop policy if exists "sheet_outbox_service_role_select_all" on public.sheet_outbox;
drop policy if exists "sheet_outbox_service_role_insert_all" on public.sheet_outbox;
drop policy if exists "sheet_outbox_service_role_update_all" on public.sheet_outbox;
drop policy if exists "sheet_outbox_service_role_delete_all" on public.sheet_outbox;
create policy "sheet_outbox_auth_select_none" on public.sheet_outbox for select to authenticated using (false);
create policy "sheet_outbox_auth_insert_allow" on public.sheet_outbox for insert to authenticated with check (true);
create policy "sheet_outbox_auth_update_allow" on public.sheet_outbox for update to authenticated using (true) with check (true);
create policy "sheet_outbox_auth_delete_none" on public.sheet_outbox for delete to authenticated using (false);
create policy "sheet_outbox_anon_select_none" on public.sheet_outbox for select to anon using (false);
create policy "sheet_outbox_anon_insert_allow" on public.sheet_outbox for insert to anon with check (true);
create policy "sheet_outbox_anon_update_allow" on public.sheet_outbox for update to anon using (true) with check (true);
create policy "sheet_outbox_anon_delete_none" on public.sheet_outbox for delete to anon using (false);
create policy "sheet_outbox_public_insert_allow" on public.sheet_outbox for insert to public with check (true);
create policy "sheet_outbox_public_update_allow" on public.sheet_outbox for update to public using (true) with check (true);
create policy "sheet_outbox_service_role_select_all" on public.sheet_outbox for select to service_role using (true);
create policy "sheet_outbox_service_role_insert_all" on public.sheet_outbox for insert to service_role with check (true);
create policy "sheet_outbox_service_role_update_all" on public.sheet_outbox for update to service_role using (true) with check (true);
create policy "sheet_outbox_service_role_delete_all" on public.sheet_outbox for delete to service_role using (true);

-- usuarios
alter table public.usuarios enable row level security;
grant select, insert, update, delete on table public.usuarios to authenticated;
grant all on table public.usuarios to service_role;
drop policy if exists "usuarios_select_own" on public.usuarios;
drop policy if exists "usuarios_insert_own" on public.usuarios;
drop policy if exists "usuarios_update_own" on public.usuarios;
drop policy if exists "usuarios_delete_own" on public.usuarios;
drop policy if exists "usuarios_service_role_all" on public.usuarios;
create policy "usuarios_select_own" on public.usuarios for select to authenticated using (auth.uid() = id);
create policy "usuarios_insert_own" on public.usuarios for insert to authenticated with check (auth.uid() = id);
create policy "usuarios_update_own" on public.usuarios for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "usuarios_delete_own" on public.usuarios for delete to authenticated using (auth.uid() = id);
create policy "usuarios_service_role_all" on public.usuarios for all to service_role using (true) with check (true);
