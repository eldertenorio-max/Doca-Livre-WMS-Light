/** Atualiza public.usuarios no destino com dados do antigo (auth já importado). */
import { connectPg, REF_ANTIGO, REF_NOVO, loadDotEnv } from './lib/supabase-env.mjs'

loadDotEnv()

async function getColTypes(client) {
  const r = await client.query(
    `SELECT column_name, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'usuarios'`,
  )
  return new Map(r.rows.map((x) => [x.column_name, x.udt_name]))
}

function prep(udt, val) {
  if (val === undefined) return null
  if (val === null) return null
  if (udt === 'json' || udt === 'jsonb') {
    return typeof val === 'string' ? val : JSON.stringify(val)
  }
  return val
}

async function main() {
  const oldC = await connectPg(REF_ANTIGO)
  const newC = await connectPg(REF_NOVO)
  const types = await getColTypes(newC)
  const rows = (await oldC.query('SELECT * FROM public.usuarios ORDER BY created_at')).rows
  console.log(`Sincronizando ${rows.length} usuarios...`)

  let ok = 0
  for (const row of rows) {
    const cols = Object.keys(row).filter((c) => c !== 'id' && types.has(c))
    const sets = cols.map((c, i) => `"${c.replace(/"/g, '""')}" = $${i + 2}`).join(', ')
    const vals = [row.id, ...cols.map((c) => prep(types.get(c), row[c]))]
    const r = await newC.query(`UPDATE public.usuarios SET ${sets} WHERE id = $1`, vals)
    if (r.rowCount > 0) ok += 1
  }

  const n = (await newC.query('SELECT count(*)::int AS n FROM public.usuarios')).rows[0].n
  console.log(`usuarios no destino: ${n} (${ok} atualizados do antigo)`)
  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
