/**
 * Diagnóstico temperatura/ocupação no Supabase novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/diagnosticar-ambiental.mjs
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

const TABLES = [
  'contagem_temperatura_camaras',
  'contagem_ocupacao_camaras',
  'contagem_ocupacao_avaria_camaras',
]

await client.connect()

const today = new Date().toISOString().slice(0, 10)
console.log('Hoje (UTC):', today)

for (const table of TABLES) {
  const reg = await client.query(`SELECT to_regclass($1) AS reg`, [`public.${table}`])
  if (!reg.rows[0]?.reg) {
    console.log(`\n=== ${table} === NÃO EXISTE`)
    continue
  }

  const cols = await client.query(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  )
  const cnt = await client.query(`SELECT count(*)::int AS n FROM public."${table}"`)
  const hoje = await client.query(
    `SELECT count(*)::int AS n FROM public."${table}" WHERE data_registro::date = $1::date`,
    [today],
  )
  const ult = await client.query(
    `SELECT * FROM public."${table}" ORDER BY data_registro DESC, created_at DESC LIMIT 5`,
  )

  console.log(`\n=== ${table} ===`)
  console.log('Colunas:', cols.rows.map((r) => r.column_name).join(', '))
  console.log('Total registros:', cnt.rows[0].n, '| Hoje:', hoje.rows[0].n)
  console.log('Últimos 5:', JSON.stringify(ult.rows, null, 2))
}

const rls = await client.query(`
  SELECT c.relname, c.relrowsecurity,
    (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.relname AND p.schemaname = 'public') AS policies
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('contagem_temperatura_camaras', 'contagem_ocupacao_camaras')
`)

console.log('\n=== RLS ===')
console.log(rls.rows)

const cron = await client.query(`
  SELECT jobname, schedule, active, command
  FROM cron.job
  WHERE jobname ILIKE '%ambiental%' OR jobname ILIKE '%temp%' OR jobname ILIKE '%ocup%'
  ORDER BY jobname
`)
console.log('\n=== CRONs ambiental ===')
console.log(cron.rows)

// Comparar últimos 7 dias
const dias = await client.query(`
  SELECT d::date AS dia,
    (SELECT count(*) FROM contagem_temperatura_camaras t WHERE t.data_registro::date = d::date) AS temp,
    (SELECT count(*) FROM contagem_ocupacao_camaras o WHERE o.data_registro::date = d::date) AS ocup
  FROM generate_series(current_date - 6, current_date, '1 day') d
  ORDER BY d DESC
`)
console.log('\n=== Últimos 7 dias (DB current_date) ===')
console.table(dias.rows)

await client.end()
