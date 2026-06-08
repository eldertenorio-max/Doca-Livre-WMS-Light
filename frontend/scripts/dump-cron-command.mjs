import pg from 'pg'
const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.swnefuddaswgjvhiuxok.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const r = await c.query(`select jobname, schedule, command from cron.job where jobname='sheet-outbox-sync-every-minute'`)
console.log(r.rows[0]?.command)
await c.end()
