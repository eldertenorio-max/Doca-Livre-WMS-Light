# Setup SQL — projeto novo `ogpiinpoclfjnvrbthrq`

Abra o **SQL Editor**:  
https://supabase.com/dashboard/project/ogpiinpoclfjnvrbthrq/sql/new

Para cada passo: abra o arquivo no seu PC → copie **todo** o conteúdo → cole no editor → **Run**.

Se aparecer erro de “já existe”, na maioria dos scripts é seguro rodar de novo (`if not exists`).

---

## Fase 1 — Tabelas base (obrigatório)

| # | Arquivo | O que cria |
|---|---------|------------|
| 1 | `supabase/sql/create_todos_os_produtos_novo_projeto.sql` | Cadastro **Todos os Produtos** |
| 2 | `supabase_schema_contagem.sql` | conferentes, produtos, contagens_estoque, sheet_outbox + RLS inicial |
| 3 | `supabase/sql/create_usuarios.sql` | usuarios + trigger com Auth |
| 4 | `supabase/sql/create_contagens_inventario.sql` | contagens_inventario |
| 5 | `supabase/sql/create_inventario_planilha_linhas.sql` | inventario_planilha_linhas |
| 6 | `supabase/sql/create_contagem_diaria_temperatura_ocupacao.sql` | temperatura e ocupação câmaras |
| 7 | `supabase/sql/create_contagem_ocupacao_avaria_camaras.sql` | ocupação avaria |
| 8 | `supabase/sql/create_contagem_diaria_presenca.sql` | presença contagem diária |
| 9 | `supabase/sql/create_contagem_diaria_captura_presenca.sql` | presença captura |
| 10 | `supabase/sql/create_inventario_captura_presenca.sql` | presença inventário |
| 11 | `supabase/sql/create_enderecamento_listas.sql` | listas de endereço |
| 12 | `supabase/sql/create_produto_listas.sql` | listas de produtos |
| 13 | `supabase/sql/setup_inventario_listas_completo.sql` | sessões inventário + contagem diária |

**Conferir** (cole no SQL Editor):

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
order by 1;
```

Deve listar, entre outras: `Todos os Produtos`, `conferentes`, `contagens_estoque`, `usuarios`, `inventario_sessoes`, `enderecamento_listas`.

---

## Fase 2 — Colunas e ajustes (`alter_*`)

Rode **nesta ordem** (um arquivo por Run):

1. `alter_contagens_estoque_finalizacao_sessao.sql`
2. `alter_contagens_estoque_contagem_rascunho.sql`
3. `alter_contagens_estoque_origem_inventario.sql`
4. `alter_contagens_estoque_add_up_adicional.sql`
5. `alter_contagens_estoque_add_foto_base64.sql`
6. `alter_contagens_estoque_inventario_numero_contagem.sql`
7. `alter_contagens_inventario_rascunho_sessao.sql`
8. `alter_inventario_sessoes_listas_vinculo.sql`
9. `alter_inventario_planilha_linhas_fk_cascade.sql`
10. `alter_inventario_planilha_linhas_grupo_1_8.sql`
11. `alter_contagem_diaria_sessoes_linhas.sql`
12. `alter_contagem_diaria_presenca_progresso.sql`
13. `alter_contagem_diaria_presenca_inventario_contexto.sql`
14. `alter_contagem_ocupacao_camaras_add_avaria_acrescimo.sql`
15. `alter_contagem_ocupacao_camaras_rename_vazias_678_para_111213.sql`
16. `alter_todos_os_produtos_ean_dun_alterado_em.sql`
17. `alter_todos_os_produtos_ean_dun_alterado_meta.sql`
18. `alter_todos_os_produtos_add_foto_base64.sql`
19. `alter_todos_os_produtos_primary_key.sql`
20. `alter_usuarios_username.sql`
21. `alter_usuarios_remove_email_add_senha.sql`
22. `alter_usuarios_acesso_pendente.sql`
23. `alter_usuarios_permissoes_views.sql`
24. `alter_usuarios_admin_delete.sql`
25. `alter_sheet_outbox_only_contagem_diaria.sql`
26. `alter_v_contagem_diaria_painel_security_invoker.sql`

---

## Fase 3 — Views do painel

1. `supabase/sql/view_v_contagem_diaria_painel.sql`
2. `supabase/sql/view_v_contagem_diaria_itens_painel.sql`

---

## Fase 4 — Permissões e proteção

1. `supabase/sql/enable_rls_core_tabelas.sql`
2. `supabase/sql/rls_todos_os_produtos_crud.sql`
3. `supabase/sql/setup_protecao_dados_supabase.sql`

---

## Fase 5 — Opcional (recomendado)

| Arquivo | Uso |
|---------|-----|
| `enable_realtime_contagens_estoque.sql` | Atualização ao vivo na contagem |
| `enable_realtime_contagens_inventario.sql` | Inventário em tempo real |
| `trigger_usuarios_delete_remove_auth_user.sql` | Apagar usuário remove Auth |

**Não rode agora** (só dados de exemplo): `insert_todos_os_produtos_*.sql`, `import_*.sql`, `sync_*.sql`.

---

## Fase 6 — Primeiro usuário e login

1. No app ou Supabase **Authentication → Users**, crie o primeiro usuário.
2. Rode `supabase/sql/auth_immediate_login.sql` **ou** publique a Edge Function `login-username` (ver abaixo).

---

## Edge Functions (terminal)

```powershell
cd "c:\Users\Diego Isidoro\Desktop\PROJETOS\CONTAGEM DE ESTOQUE"
npx supabase login
npx supabase link --project-ref ogpiinpoclfjnvrbthrq
npx supabase functions deploy login-username
npx supabase functions deploy register-username
npx supabase functions deploy auth-login-ensure
npx supabase functions deploy auth-register-confirmed
```

---

## Copiar dados do sistema antigo

Se quiser **produtos e contagens** do projeto anterior:

1. Supabase antigo → **Database → Backups** (ou `pg_dump`).
2. Restaure no novo usando a connection string com a senha do banco novo.

Só estrutura vazia: pule esta etapa e importe produtos depois pela aba **Importação de Planilha** no app.

---

## Teste final

```sql
select count(*) as produtos from public."Todos os Produtos";
select count(*) as conferentes from public.conferentes;
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;
```

No frontend (`frontend/.env` com URL e chave do projeto novo): `npm run dev` → login → abrir **Endereçamento** e **Produtos**.
