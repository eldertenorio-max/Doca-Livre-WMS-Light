import pg from 'pg'
import fs from 'fs'
import path from 'path'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const sqlDir = path.join(process.cwd(), '..', 'supabase', 'sql')
const sqlPk = fs.readFileSync(path.join(sqlDir, 'enable_primary_keys_public.sql'), 'utf8')
const sqlFk = fs.readFileSync(path.join(sqlDir, 'enable_foreign_keys_public.sql'), 'utf8')

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
console.log('Aplicando primary keys...')
await client.query(sqlPk)
console.log('Aplicando foreign keys...')
await client.query(sqlFk)
const r = await client.query(`
  SELECT count(*)::int AS n FROM information_schema.table_constraints
  WHERE constraint_type='FOREIGN KEY' AND table_schema='public'`)
console.log('FKs em public:', r.rows[0].n)
await client.end()
console.log('Concluído.')
