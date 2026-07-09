# Contagem de Estoque — novo Supabase + GitHub

Projeto Supabase: **ogpiinpoclfjnvrbthrq**  
URL: https://ogpiinpoclfjnvrbthrq.supabase.co  
Repositório: https://github.com/diegoisidoro-byte/Contagem-de-Estoque.git

## 1. Git (código)

```powershell
cd "c:\Users\Diego Isidoro\Desktop\PROJETOS\CONTAGEM DE ESTOQUE"
git remote add byte https://github.com/diegoisidoro-byte/Contagem-de-Estoque.git
git push -u byte master
```

## 2. Supabase CLI

Instale o CLI: https://supabase.com/docs/guides/cli/getting-started

```powershell
cd "c:\Users\Diego Isidoro\Desktop\PROJETOS\CONTAGEM DE ESTOQUE"
supabase login
supabase link --project-ref ogpiinpoclfjnvrbthrq
```

## 3. Banco (SQL Editor — ordem)

Execute **um arquivo por vez**, na ordem:

1. `supabase/sql/create_todos_os_produtos_novo_projeto.sql`
2. `supabase_schema_contagem.sql` (raiz do repo)
3. `supabase/sql/create_usuarios.sql`
4. `supabase/sql/create_contagens_inventario.sql`
5. `supabase/sql/create_inventario_planilha_linhas.sql`
6. `supabase/sql/create_contagem_diaria_temperatura_ocupacao.sql`
7. `supabase/sql/create_contagem_diaria_presenca.sql`
8. `supabase/sql/create_contagem_diaria_captura_presenca.sql`
9. `supabase/sql/create_inventario_captura_presenca.sql`
10. `supabase/sql/create_enderecamento_listas.sql`
11. `supabase/sql/create_produto_listas.sql`
12. `supabase/sql/setup_inventario_listas_completo.sql`
13. `supabase/sql/alter_*.sql` (conforme necessário — podem ser reaplicados com `if not exists`)
14. `supabase/sql/enable_rls_core_tabelas.sql`
15. `supabase/sql/rls_todos_os_produtos_crud.sql`
16. `supabase/sql/setup_protecao_dados_supabase.sql`
17. `supabase/sql/auth_immediate_login.sql`

**Copiar dados do projeto antigo:** veja `COPIA_EXATA_PASSO_A_PASSO.md` (fonte: `zvazpqdvnlecqadxacgv` → destino: `ogpiinpoclfjnvrbthrq`).  
Ou no painel do Supabase antigo: *Database → Backups* / `pg_dump`.

## 4. Edge Functions

```powershell
supabase functions deploy login-username
supabase functions deploy register-username
supabase functions deploy auth-login-ensure
supabase functions deploy auth-register-confirmed
supabase functions deploy sheet-outbox-sync
supabase functions deploy dynamic-endpoint
```

## 5. Frontend local

```powershell
cd frontend
copy .env.example .env
# Edite .env com a chave publicável (Settings → API no Supabase)
npm ci
npm run dev
```

## 6. Render (deploy)

Conecte o repo [Contagem-de-Estoque](https://github.com/diegoisidoro-byte/Contagem-de-Estoque.git) e defina:

| Variável | Valor |
|----------|--------|
| `VITE_SUPABASE_URL` | `https://ogpiinpoclfjnvrbthrq.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | chave **publicável** ou **anon** do painel |

Use o `render.yaml` na raiz (static site, `rootDir: frontend`).

## 7. Segurança

- Nunca commite `.env`, senha do Postgres nem `service_role` no Git.
- A senha do banco fica só no painel Supabase e em ferramentas locais (migrations).
