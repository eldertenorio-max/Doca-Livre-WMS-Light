# Copiar dados do Supabase de produção → projeto novo (cópia exata)

Projeto **fonte** (dados reais): `zvazpqdvnlecqadxacgv`  
Projeto **destino** (cópia): `ogpiinpoclfjnvrbthrq`

## 1. Senha do banco antigo

A senha `contagemestoque2026` vale só no projeto **novo**. O antigo tem outra senha.

1. Abra [zvazpqdvnlecqadxacgv → Database](https://supabase.com/dashboard/project/zvazpqdvnlecqadxacgv/settings/database)
2. Se não lembrar: **Reset database password** → anote a nova senha
3. Em `frontend/.env` (não commitar):

```env
SUPABASE_DB_PASSWORD=contagemestoque2026
SUPABASE_DB_PASSWORD_OLD=SENHA_DO_PROJETO_ANTIGO
SUPABASE_PROJECT_REF=ogpiinpoclfjnvrbthrq
SUPABASE_PROJECT_REF_OLD=zvazpqdvnlecqadxacgv
SUPABASE_DB_POOLER_HOST=aws-0-ca-central-1.pooler.supabase.com
SUPABASE_DB_POOLER_HOST_OLD=aws-1-us-east-1.pooler.supabase.com
```

## 2. Copiar tudo (um comando)

Na pasta `frontend`:

```powershell
$env:SUPABASE_MIGRATE_FROM_OLD = "1"
npm run setup:novo-projeto
```

Isso reaplica o schema (ignora o que já existe), copia **todas** as tabelas `public`, usuários `auth`, triggers e views.

## 3. Edge Functions (login/cadastro)

Token em [Account → Access Tokens](https://supabase.com/dashboard/account/tokens):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
.\scripts\deploy-auth-edge-functions.ps1
```

Ou no painel: deploy de `supabase/functions/login-username`, `register-username`, etc. no projeto `ogpiinpoclfjnvrbthrq`.

## 4. Render

1. [render.com](https://render.com) → **New** → **Blueprint** ou Static Site
2. Repo: `diegoisidoro-byte/Contagem-de-Estoque`
3. Variáveis de build:
   - `VITE_SUPABASE_URL` = `https://ogpiinpoclfjnvrbthrq.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = chave publicável do painel novo
4. Root: `frontend` | Build: `npm ci && npm run build` | Publish: `frontend/dist`

O `render.yaml` na raiz já traz o modelo.

## 5. Conferir

```powershell
cd frontend
node scripts/auditar-projeto-atual.mjs
```

Produtos, conferentes, contagens e `auth.users` devem ter os mesmos totais do projeto antigo.
