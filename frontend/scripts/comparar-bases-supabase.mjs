/**
 * Compara contagens public.* e auth.users entre projeto antigo e novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/comparar-bases-supabase.mjs
 */
import pg from 'pg'

const { Client } = pg

const REF_ANTIGO = 'swnefuddaswgjvhiuxok'
const REF_NOVO = 'zvazpqdvnlecqadxacgv'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

function conn(ref) {
  return new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${ref}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
}

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function listPublicTables(client) {
  const r = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  return r.rows.map((x) => x.tablename)
}

async function listPublicViews(client) {
  const r = await client.query(
    `SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname`,
  )
  return r.rows.map((x) => x.viewname)
}

async function countTable(client, table) {
  const r = await client.query(`SELECT count(*)::int AS n FROM ${qIdent(table)}`)
  return r.rows[0].n
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const oldTables = await listPublicTables(oldC)
  const newTables = await listPublicTables(newC)
  const oldViews = await listPublicViews(oldC)
  const newViews = await listPublicViews(newC)
  const all = [...new Set([...oldTables, ...newTables])].sort()

  console.log('TABELA | ANTIGO | NOVO | IGUAL?')
  let publicOk = true
  for (const t of all) {
    const o = oldTables.includes(t) ? await countTable(oldC, t) : null
    const n = newTables.includes(t) ? await countTable(newC, t) : null
    const ok = o === n
    if (!ok) publicOk = false
    console.log(`${t} | ${o ?? '-'} | ${n ?? '-'} | ${ok ? 'sim' : 'NAO'}`)
  }

  const authOld = await oldC.query('SELECT count(*)::int AS n FROM auth.users')
  const authNew = await newC.query('SELECT count(*)::int AS n FROM auth.users')
  const authOk = authOld.rows[0].n === authNew.rows[0].n
  console.log('---')
  console.log(
    `auth.users | ${authOld.rows[0].n} | ${authNew.rows[0].n} | ${authOk ? 'sim' : 'NAO'}`,
  )
  console.log('---')
  console.log('Views public (antigo):', oldViews.length ? oldViews.join(', ') : '(nenhuma)')
  console.log('Views public (novo):  ', newViews.length ? newViews.join(', ') : '(nenhuma)')
  console.log('---')
  console.log(
    publicOk && authOk
      ? 'Tudo igual entre antigo e novo.'
      : publicOk
        ? 'Tabelas public.* OK. auth.users ainda diferente.'
        : 'Ha diferencas em public.* e/ou auth.users.',
  )

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
