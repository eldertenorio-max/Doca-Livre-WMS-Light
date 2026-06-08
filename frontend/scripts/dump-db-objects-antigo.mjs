import pg from 'pg'
const pwd = process.env.SUPABASE_DB_PASSWORD
const refs = ['swnefuddaswgjvhiuxok', 'zvazpqdvnlecqadxacgv']
for (const ref of refs) {
  const c = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()
  const authTrig = await c.query(`
    select t.tgname from pg_trigger t
    join pg_class cl on cl.oid=t.tgrelid join pg_namespace n on n.oid=cl.relnamespace
    where n.nspname='auth' and cl.relname='users' and not t.tgisinternal order by 1`)
  console.log('\n' + ref + ' auth.users triggers:', authTrig.rows.map(r=>r.tgname).join(', ')||'(nenhum)')
  await c.end()
}
