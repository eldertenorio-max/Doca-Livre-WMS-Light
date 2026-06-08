import pg from 'pg'
import fs from 'fs'
import path from 'path'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const sql = fs.readFileSync(
  path.join(process.cwd(), '..', 'supabase', 'sql', 'cron_sheet_outbox_sync_every_minute.sql'),
  'utf8',
)

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
await client.query(sql)
const jobs = await client.query(
  `SELECT jobname, schedule, active FROM cron.job WHERE jobname='sheet-outbox-sync-every-minute'`,
)
console.log('Cron:', jobs.rows[0] ?? 'nao encontrado')
await client.end()
