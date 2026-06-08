/**
 * Compara tabelas/views/colunas entre Supabase antigo e novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/comparar-schema-supabase.mjs
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

async function listObjects(client) {
  const tables = await client.query(
    `SELECT tablename AS name, 'table' AS kind FROM pg_tables WHERE schemaname='public'
     UNION ALL
     SELECT viewname AS name, 'view' AS kind FROM pg_views WHERE schemaname='public'
     ORDER BY 1`,
  )
  return tables.rows
}

async function listColumns(client, name, kind) {
  const r = await client.query(
    `SELECT column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [name],
  )
  return r.rows
}

function colKey(c) {
  return `${c.column_name}|${c.data_type}|${c.udt_name}|${c.is_nullable}`
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const oldObjs = await listObjects(oldC)
  const newObjs = await listObjects(newC)
  const oldNames = new Set(oldObjs.map((o) => o.name))
  const newNames = new Set(newObjs.map((o) => o.name))
  const all = [...new Set([...oldNames, ...newNames])].sort()

  let ok = true
  console.log('OBJETO | TIPO | ANTIGO | NOVO | COLUNAS IGUAIS?')
  for (const name of all) {
    const o = oldObjs.find((x) => x.name === name)
    const n = newObjs.find((x) => x.name === name)
    if (!o || !n) {
      ok = false
      console.log(`${name} | - | ${o ? 'sim' : 'nao'} | ${n ? 'sim' : 'nao'} | FALTA OBJETO`)
      continue
    }
    const oc = await listColumns(oldC, name, o.kind)
    const nc = await listColumns(newC, name, n.kind)
    const oSet = new Set(oc.map(colKey))
    const nSet = new Set(nc.map(colKey))
    const colsOk =
      oSet.size === nSet.size && [...oSet].every((k) => nSet.has(k))
    if (!colsOk) ok = false
    console.log(`${name} | ${o.kind} | sim | sim | ${colsOk ? 'sim' : 'NAO'}`)
    if (!colsOk) {
      const onlyOld = [...oSet].filter((k) => !nSet.has(k))
      const onlyNew = [...nSet].filter((k) => !oSet.has(k))
      if (onlyOld.length) console.log('    só antigo:', onlyOld.join('; '))
      if (onlyNew.length) console.log('    só novo:', onlyNew.join('; '))
    }
  }

  console.log('---')
  console.log(ok ? 'Schema public idêntico (tabelas + views + colunas).' : 'Há diferenças de schema.')

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
