import { connectPg, REF_NOVO, loadDotEnv } from './lib/supabase-env.mjs'

loadDotEnv()
const c = await connectPg(REF_NOVO)
const tables = await c.query(
  `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
)
console.log('Projeto:', REF_NOVO, '| tabelas:', tables.rows.length)
let totalRows = 0
for (const { tablename } of tables.rows) {
  const q = `"${tablename.replace(/"/g, '""')}"`
  const n = (await c.query(`SELECT count(*)::int AS n FROM public.${q}`)).rows[0].n
  totalRows += n
  if (n > 0) console.log(`  ${tablename}: ${n}`)
}
console.log('Total linhas (public):', totalRows)
const auth = await c.query(`SELECT count(*)::int AS n FROM auth.users WHERE deleted_at IS NULL`)
console.log('auth.users:', auth.rows[0].n)
await c.end()
