/**
 * Limpa na planilha Google os valores de um dia (via webhook clear_qty).
 *
 * Uso:
 *   SUPABASE_DB_PASSWORD='...' node scripts/limpar-coluna-planilha.mjs 2026-06-08
 *   SUPABASE_DB_PASSWORD='...' node scripts/limpar-coluna-planilha.mjs 2026-06-08 --from-db
 */
import pg from 'pg'

const WEBHOOK_URL =
  process.env.SHEET_WEBHOOK_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbwiKITgtnaFR9L3I7IzEZT95I3rtnSiSJEEahfIG_21FblWy_zdwrgs83bLyQ0nkFum_w/exec'

const BATCH = Number(process.env.OUTBOX_BATCH_SIZE ?? '80')
const pwd = process.env.SUPABASE_DB_PASSWORD
const day = process.argv[2]
const fromDb = process.argv.includes('--from-db')

if (!pwd || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error('Uso: SUPABASE_DB_PASSWORD=... node scripts/limpar-coluna-planilha.mjs yyyy-mm-dd [--from-db]')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})

async function checkColumnExists(ymd) {
  const url = `${WEBHOOK_URL}?action=check_date_column&ymd=${ymd}`
  const res = await fetch(url, { redirect: 'follow' })
  const text = await res.text()
  if (text.trim().startsWith('{')) {
    const j = JSON.parse(text)
    return j
  }
  return { ok: false, raw: text.slice(0, 200) }
}

async function postClear(records) {
  // Sem modo_planilha=contagem_diaria → clear_qty apaga a célula (não grava 0).
  const body = {
    aba: 'CONTAGEM DE ESTOQUE FISICA',
    data_contagem: day,
    records,
  }
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
  if (text.trim().startsWith('{')) {
    const j = JSON.parse(text)
    if (j.ok === false) throw new Error(j.error || text)
  }
  return text
}

await client.connect()

console.log('Verificando coluna', day, '...')
const colCheck = await checkColumnExists(day)
console.log('check_date_column:', colCheck)

let items = []
if (fromDb) {
  const r = await client.query(
    `
    select codigo_interno, descricao
    from public.contagens_estoque
    where timezone('America/Sao_Paulo', data_hora_contagem)::date = $1::date
      and coalesce(origem, '') <> 'inventario'
      and inventario_repeticao is null
      and inventario_numero_contagem is null
    group by codigo_interno, descricao
    order by codigo_interno
    `,
    [day],
  )
  items = r.rows
  console.log(`Itens no banco (${day}):`, items.length)
} else {
  console.error('Informe --from-db para montar a lista a partir de contagens_estoque.')
  await client.end()
  process.exit(1)
}

if (!items.length) {
  console.log('Nenhum item no banco para esse dia — nada a limpar na planilha.')
  await client.end()
  process.exit(0)
}

let cleared = 0
for (let i = 0; i < items.length; i += BATCH) {
  const chunk = items.slice(i, i + BATCH)
  const records = chunk.map((row) => ({
    tipo: 'clear_qty',
    data_contagem: day,
    codigo_interno: row.codigo_interno,
    descricao: row.descricao,
  }))
  await postClear(records)
  cleared += records.length
  console.log(`Lote OK: ${cleared}/${items.length}`)
}

console.log(`Concluído: ${cleared} células limpas para ${day}.`)
await client.end()
