import pg from 'pg'

const pwd = process.env.SUPABASE_DB_PASSWORD
const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

const cron = await c.query(`SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobname`)
console.log('Crons:', cron.rows)

const net = await c.query(`
  SELECT id, status_code, left(content::text, 200) content, created
  FROM net._http_response
  ORDER BY created DESC
  LIMIT 15
`).catch(async (e) => {
  console.log('net._http_response:', e.message)
  return { rows: [] }
})
console.log('Últimas respostas pg_net:', net.rows)

const pending = await c.query(`
  SELECT id, status, attempts, left(coalesce(last_error,''),80) err, locked_at, updated_at
  FROM sheet_outbox ORDER BY updated_at DESC LIMIT 8
`)
console.log('Outbox recente:', pending.rows)

await c.end()
