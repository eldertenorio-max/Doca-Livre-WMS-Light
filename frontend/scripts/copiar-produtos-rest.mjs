/**
 * Copia só public."Todos os Produtos" via REST (upsert por id ou codigo_interno).
 */
import { connectPg, REF_NOVO, loadDotEnv } from './lib/supabase-env.mjs'

loadDotEnv()
const OLD_URL = (process.env.SUPABASE_URL_OLD || 'https://zvazpqdvnlecqadxacgv.supabase.co').replace(/\/$/, '')
const OLD_KEY =
  process.env.SUPABASE_ANON_KEY_OLD || 'sb_publishable_q70XV5h5r4XnQHDQVJ5Ewg_ro4MSGgs'
const TABLE = 'Todos os Produtos'

const DATA_COLS = [
  'codigo_interno',
  'descricao',
  'unidade',
  'unidade_medida',
  'ean',
  'dun',
  'foto_base64',
  'ean_dun_alterado_em',
  'ean_alterado_em',
  'dun_alterado_em',
  'ean_alterado_em_hora',
  'ean_alterado_conferente',
  'dun_alterado_em_hora',
  'dun_alterado_conferente',
]

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function fetchAll() {
  const headers = { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` }
  const out = []
  for (let from = 0; from < 50000; from += 500) {
    const r = await fetch(`${OLD_URL}/rest/v1/${encodeURIComponent(TABLE)}?select=*`, {
      headers: { ...headers, Range: `${from}-${from + 499}` },
    })
    const batch = await r.json()
    if (!batch?.length) break
    out.push(...batch)
    if (batch.length < 500) break
  }
  return out
}

function pickCols(row, includeId) {
  const cols = DATA_COLS.filter((n) => row[n] !== null && row[n] !== undefined)
  if (includeId && row.id != null) cols.unshift('id')
  return cols
}

async function main() {
  const rows = await fetchAll()
  console.log(`Lidos: ${rows.length}`)

  const c = await connectPg(REF_NOVO)
  const q = qIdent(TABLE)
  await c.query(`DELETE FROM public.${q}`)

  let ok = 0
  let skip = 0
  for (const row of rows) {
    const includeId = row.id != null
    const cols = pickCols(row, includeId)
    if (!cols.includes('codigo_interno')) {
      skip += 1
      continue
    }
    const vals = cols.map((name) => row[name])
    const setCols = cols.filter((n) => n !== 'id' && n !== 'codigo_interno')
    const setSql = setCols.map((n) => `${qIdent(n)} = EXCLUDED.${qIdent(n)}`).join(', ')
    const conflict = includeId
      ? 'ON CONFLICT (id) DO UPDATE SET ' + setSql
      : `ON CONFLICT ((trim(both from codigo_interno))) DO UPDATE SET ${setSql}`

    try {
      await c.query(
        `INSERT INTO public.${q} (${cols.map(qIdent).join(', ')})
         VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
         ${conflict}`,
        vals,
      )
      ok += 1
    } catch (e) {
      const msg = String(e.message || e)
      if (/duplicate key|unique constraint/i.test(msg)) {
        skip += 1
        console.warn('SKIP', row.codigo_interno, msg.split('\n')[0])
      } else {
        throw e
      }
    }
  }

  await c.query(
    `SELECT setval(pg_get_serial_sequence('public.${q}', 'id'),
      COALESCE((SELECT MAX(id) FROM public.${q}), 1), true)`,
  )

  const n = (await c.query(`SELECT count(*)::int AS n FROM public.${q}`)).rows[0].n
  console.log(`OK: ${ok}, pulados: ${skip}, total destino: ${n}`)
  await c.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
