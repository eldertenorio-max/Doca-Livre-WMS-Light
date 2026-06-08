/**
 * Drena sheet_outbox → Google Sheets (mesma lógica da Edge Function dynamic-endpoint).
 * Use quando a Edge Function ainda não estiver publicada no Supabase novo.
 *
 * Uso:
 *   SUPABASE_DB_PASSWORD='...' node scripts/drenar-sheet-outbox.mjs
 *   SUPABASE_DB_PASSWORD='...' node scripts/drenar-sheet-outbox.mjs --reset-failed
 */
import pg from 'pg'

const WEBHOOK_URL =
  process.env.SHEET_WEBHOOK_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbwiKITgtnaFR9L3I7IzEZT95I3rtnSiSJEEahfIG_21FblWy_zdwrgs83bLyQ0nkFum_w/exec'

const BATCH = Number(process.env.OUTBOX_BATCH_SIZE ?? '80')
const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const resetFailed = process.argv.includes('--reset-failed')

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})

function quantidadeAsText(v) {
  if (v == null || !Number.isFinite(Number(v))) return '0'
  return String(Number(v))
}

function normalizeYmd(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getUTCFullYear()
    const mo = String(v.getUTCMonth() + 1).padStart(2, '0')
    const da = String(v.getUTCDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

await client.connect()

if (resetFailed) {
  const r = await client.query(`
    update public.sheet_outbox
    set status = 'pending', attempts = 0, last_error = null, locked_at = null, processed_at = null
    where status = 'failed'
    returning id
  `)
  console.log(`Reenfileirados (failed→pending): ${r.rowCount}`)
}

const { rows: pending } = await client.query(
  `select * from public.sheet_outbox where status = 'pending' order by created_at asc limit $1`,
  [BATCH],
)

if (!pending.length) {
  console.log('Nada pendente na fila.')
  await client.end()
  process.exit(0)
}

console.log(`Processando ${pending.length} itens → ${WEBHOOK_URL}`)

const byAba = new Map()
for (const row of pending) {
  const aba = row.aba ?? 'CONTAGEM DE ESTOQUE FISICA'
  const arr = byAba.get(aba) ?? []
  arr.push(row)
  byAba.set(aba, arr)
}

let ok = 0
let fail = 0

for (const [, abaRows] of byAba) {
  const records = abaRows.map((r) => ({
    tipo: r.event_type,
    data_contagem: normalizeYmd(r.data_contagem),
    codigo_interno: r.codigo_interno,
    descricao: r.descricao,
    quantidade_contada: r.event_type === 'upsert' ? (r.quantidade_contada ?? 0) : undefined,
    quantidade_contada_text: r.event_type === 'upsert' ? quantidadeAsText(r.quantidade_contada) : undefined,
  }))

  const body = {
    aba: abaRows[0]?.aba ?? 'CONTAGEM DE ESTOQUE FISICA',
    data_contagem: normalizeYmd(abaRows[0]?.data_contagem) || records[0]?.data_contagem || '',
    modo_planilha: 'contagem_diaria',
    records,
  }

  const ids = abaRows.map((r) => r.id)
  const now = new Date().toISOString()

  await client.query(
    `update public.sheet_outbox set status='processing', locked_at=$2, attempts=attempts+1 where id = any($1::uuid[])`,
    [ids, now],
  )

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`)
    if (text.trim().startsWith('{')) {
      const parsed = JSON.parse(text)
      if (parsed?.ok === false) throw new Error(parsed.error || text.slice(0, 300))
    } else if (text.includes('<!DOCTYPE')) {
      throw new Error(`Resposta HTML (URL inválida?): ${text.slice(0, 200)}`)
    }

    await client.query(`delete from public.sheet_outbox where id = any($1::uuid[])`, [ids])
    ok += ids.length
    console.log(`OK: ${ids.length} registros (${body.data_contagem})`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    fail += ids.length
    console.error(`FALHA (${ids.length}):`, msg)
    await client.query(
      `update public.sheet_outbox set status='failed', last_error=$2, locked_at=null where id = any($1::uuid[])`,
      [ids, msg.slice(0, 500)],
    )
  }
}

const rest = await client.query(`select status, count(*)::int n from sheet_outbox group by status`)
console.log('Fila após dreno:', rest.rows)
console.log(`Resumo: ok=${ok}, fail=${fail}`)
await client.end()
