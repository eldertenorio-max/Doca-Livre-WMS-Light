/**
 * Copia dados do projeto antigo (REST + chave publicável) → novo (Postgres).
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { connectPg, REF_NOVO, loadDotEnv } from './lib/supabase-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

loadDotEnv()

const OLD_URL = (process.env.SUPABASE_URL_OLD || 'https://zvazpqdvnlecqadxacgv.supabase.co').replace(/\/$/, '')
const OLD_KEY =
  process.env.SUPABASE_ANON_KEY_OLD || 'sb_publishable_q70XV5h5r4XnQHDQVJ5Ewg_ro4MSGgs'

const TABLES = [
  'conferentes',
  'Todos os Produtos',
  'enderecamento_listas',
  'produto_listas',
  'inventario_sessoes',
  'contagens_estoque',
  'contagens_inventario',
  'inventario_planilha_linhas',
  'contagem_diaria_sessoes',
  'contagem_diaria_presenca',
  'contagem_diaria_captura_presenca',
  'contagem_temperatura_camaras',
  'contagem_ocupacao_camaras',
  'contagem_ocupacao_avaria_camaras',
  'inventario_captura_presenca',
  'sheet_outbox',
  'usuarios',
  'sistema_protecao_dados',
]

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function getDestColumns(client, table) {
  const r = await client.query(
    `SELECT column_name, udt_name, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table],
  )
  return r.rows
}

function prepareValue(udtName, value) {
  if (value === undefined) return null
  if (value === null) return null
  if (udtName === 'json' || udtName === 'jsonb') {
    if (typeof value === 'string') return value
    return JSON.stringify(value)
  }
  return value
}

async function fetchAllRows(table) {
  const headers = { apikey: OLD_KEY, Authorization: `Bearer ${OLD_KEY}` }
  const out = []
  const pageSize = 500
  for (let from = 0; from < 500000; from += pageSize) {
    const to = from + pageSize - 1
    const url = `${OLD_URL}/rest/v1/${encodeURIComponent(table)}?select=*`
    const r = await fetch(url, { headers: { ...headers, Range: `${from}-${to}` } })
    if (!r.ok) {
      const t = await r.text()
      throw new Error(`${table}: HTTP ${r.status} ${t.slice(0, 120)}`)
    }
    const batch = await r.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    out.push(...batch)
    if (batch.length < pageSize) break
  }
  return out
}

async function insertRows(client, table, rows, destCols) {
  if (!rows.length) {
    console.log(`  ${table}: 0`)
    return 0
  }
  const colMap = new Map(destCols.map((c) => [c.column_name, c.udt_name]))
  const quoted = qIdent(table)
  await client.query(`DELETE FROM ${quoted}`)

  let inserted = 0
  for (const row of rows) {
    const cols = Object.keys(row).filter(
      (name) => colMap.has(name) && row[name] !== null && row[name] !== undefined,
    )
    if (!cols.length) continue
    const ph = `(${cols.map((_, ci) => `$${ci + 1}`).join(', ')})`
    const vals = cols.map((c) => prepareValue(colMap.get(c), row[c]))
    await client.query(
      `INSERT INTO ${quoted} (${cols.map(qIdent).join(', ')}) VALUES ${ph}`,
      vals,
    )
    inserted += 1
  }

  console.log(`  ${table}: ${inserted}`)
  return inserted
}

async function fixSerialSequences(client, table) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_default LIKE 'nextval%'`,
    [table],
  )
  for (const { column_name } of r.rows) {
    const q = qIdent(table)
    const cq = qIdent(column_name)
    await client.query(
      `SELECT setval(pg_get_serial_sequence('public.${q}', '${column_name}'),
        COALESCE((SELECT MAX(${cq}) FROM public.${q}), 1), true)`,
    ).catch(() => {})
  }
}

async function main() {
  console.log(`Origem REST: ${OLD_URL}`)
  console.log(`Destino Postgres: ${REF_NOVO}`)

  const client = await connectPg(REF_NOVO)
  await client.query('SET session_replication_role = replica').catch(() => {})

  let total = 0
  for (const table of TABLES) {
    if (table === 'Todos os Produtos') continue
    try {
      const destCols = await getDestColumns(client, table)
      if (!destCols.length) {
        console.log(`  ${table}: SKIP (tabela não existe no destino)`)
        continue
      }
      const rows = await fetchAllRows(table)
      total += await insertRows(client, table, rows, destCols)
      await fixSerialSequences(client, table)
    } catch (e) {
      console.error(`  ERRO ${table}:`, e.message?.split('\n')[0] || e)
    }
  }

  await client.query('SET session_replication_role = DEFAULT').catch(() => {})
  await client.end()

  console.log('\nProdutos (upsert)...')
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'copiar-produtos-rest.mjs')], {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..'),
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('copiar-produtos exit ' + code))))
  })

  console.log(`\nTotal inserido (sem produtos): ${total} linha(s)`)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
