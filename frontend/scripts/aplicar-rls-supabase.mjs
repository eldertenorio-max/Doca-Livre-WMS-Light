/**
 * Aplica RLS em todas as tabelas do projeto Supabase (remove UNRESTRICTED).
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/aplicar-rls-supabase.mjs
 * Opcional: SUPABASE_PROJECT_REF=zvazpqdvnlecqadxacgv
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

const ref = process.env.SUPABASE_PROJECT_REF || 'zvazpqdvnlecqadxacgv'
const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const rlsFiles = [
  'supabase/sql/rls_todos_os_produtos_crud.sql',
  'supabase/sql/enable_rls_core_tabelas.sql',
]

async function runFile(filePath) {
  const name = path.relative(repoRoot, filePath)
  const sql = fs.readFileSync(filePath, 'utf8')
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  try {
    await client.connect()
    await client.query(sql)
    console.log('OK', name)
  } catch (e) {
    console.error('ERRO', name, '—', String(e.message || e).split('\n')[0])
    process.exitCode = 1
  } finally {
    await client.end().catch(() => {})
  }
}

async function verify() {
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const r = await client.query(`
    SELECT c.relname AS tabela, c.relrowsecurity AS rls_ativo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `)
  console.log('\nRLS por tabela:')
  for (const row of r.rows) {
    console.log(`  ${row.tabela}: ${row.rls_ativo ? 'ATIVO' : 'UNRESTRICTED'}`)
  }
  await client.end()
}

for (const rel of rlsFiles) {
  const full = path.join(repoRoot, rel)
  if (!fs.existsSync(full)) {
    console.error('Arquivo não encontrado:', full)
    process.exit(1)
  }
  await runFile(full)
}
await verify()
