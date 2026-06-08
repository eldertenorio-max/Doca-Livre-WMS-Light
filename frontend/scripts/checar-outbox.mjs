import pg from 'pg'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) process.exit(1)

const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const s = await c.query(`SELECT status, count(*)::int n FROM sheet_outbox GROUP BY status ORDER BY 1`)
console.log('sheet_outbox:', s.rows)
const e = await c.query(
  `SELECT status, left(coalesce(last_error,''),120) err, created_at FROM sheet_outbox WHERE status <> 'done' ORDER BY created_at DESC LIMIT 8`,
)
console.log('pendentes:', e.rows)
await c.end()
