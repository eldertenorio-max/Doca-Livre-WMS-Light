import pg from 'pg'
const pwd = process.env.SUPABASE_DB_PASSWORD
const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const r = await c.query(`
  SELECT tc.table_name, tc.constraint_type, kcu.column_name
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
  ORDER BY tc.table_name, tc.constraint_type`)
for (const row of r.rows) console.log(row.table_name, row.constraint_type, row.column_name || '')
const tables = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1`)
const withPk = new Set(r.rows.filter(x => x.constraint_type === 'PRIMARY KEY').map(x => x.table_name))
console.log('--- sem PK ---')
for (const t of tables.rows) if (!withPk.has(t.tablename)) console.log(t.tablename)
await c.end()
