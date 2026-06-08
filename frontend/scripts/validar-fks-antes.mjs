import pg from 'pg'
const pwd = process.env.SUPABASE_DB_PASSWORD
const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const checks = [
  ['contagens_estoque.conferente_id', `SELECT count(*)::int n FROM contagens_estoque ce LEFT JOIN conferentes c ON c.id=ce.conferente_id WHERE c.id IS NULL`],
  ['contagens_estoque.produto_id', `SELECT count(*)::int n FROM contagens_estoque ce LEFT JOIN produtos p ON p.id=ce.produto_id WHERE ce.produto_id IS NOT NULL AND p.id IS NULL`],
  ['contagens_inventario.conferente_id', `SELECT count(*)::int n FROM contagens_inventario t LEFT JOIN conferentes c ON c.id=t.conferente_id WHERE c.id IS NULL`],
  ['usuarios.id vs auth', `SELECT count(*)::int n FROM usuarios u LEFT JOIN auth.users a ON a.id=u.id WHERE a.id IS NULL`],
]
for (const [label, sql] of checks) {
  const r = await c.query(sql)
  console.log(label, 'órfãos:', r.rows[0].n)
}
await c.end()
