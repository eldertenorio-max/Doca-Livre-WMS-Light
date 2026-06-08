import pg from 'pg'
const pwd = process.env.SUPABASE_DB_PASSWORD
const missing = [
  'auth_login_ensure',
  'delete_auth_user_when_usuario_deleted',
  'enqueue_sheet_outbox_from_contagem',
  'handle_new_auth_user',
  'set_contagens_inventario_data_contagem',
  'touch_usuarios_updated_at',
  'set_contagens_data_contagem',
]
const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.swnefuddaswgjvhiuxok.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
for (const fn of missing) {
  const r = await c.query(
    `select pg_get_functiondef(p.oid) as def
     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname=$1 limit 1`,
    [fn],
  )
  console.log('\n====', fn, '====')
  console.log(r.rows[0]?.def ? r.rows[0].def.slice(0, 120) + '...' : 'NAO ENCONTRADA')
}
await c.end()
