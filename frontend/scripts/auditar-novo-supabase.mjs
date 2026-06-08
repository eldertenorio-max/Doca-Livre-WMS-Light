/**
 * Auditoria completa só no Supabase novo.
 */
import pg from 'pg'

const REF = 'zvazpqdvnlecqadxacgv'
const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${REF}.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const tables = (
  await client.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)
).rows.map((r) => r.tablename)

console.log('=== Tabelas public (' + tables.length + ') ===')
for (const t of tables) {
  const n = (await client.query(`SELECT count(*)::int AS n FROM public."${t}"`)).rows[0].n
  console.log(`${t}: ${n}`)
}

const pks = await client.query(`
  SELECT c.relname, count(*)::int AS pks
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND con.contype = 'p'
  GROUP BY c.relname ORDER BY 1
`)
console.log('\n=== PKs por tabela ===')
console.table(pks.rows)

const fks = await client.query(`
  SELECT count(*)::int AS n FROM pg_constraint con
  JOIN pg_namespace n ON n.oid = con.connamespace
  WHERE n.nspname = 'public' AND con.contype = 'f'
`)
console.log('FKs total:', fks.rows[0].n)

const views = await client.query(`
  SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY 1
`)
console.log('\n=== Views ===', views.rows.map((r) => r.table_name))

const cron = await client.query(`SELECT jobname, schedule, active FROM cron.job ORDER BY 1`)
console.log('\n=== Crons ===')
console.table(cron.rows)

const rlsMissing = await client.query(`
  SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
  ORDER BY 1
`)
console.log('\n=== Tabelas SEM RLS ===', rlsMissing.rows.map((r) => r.relname))

const noPolicy = await client.query(`
  SELECT c.relname
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname
    )
  ORDER BY 1
`)
console.log('=== RLS ativo mas SEM policy ===', noPolicy.rows.map((r) => r.relname))

await client.end()
