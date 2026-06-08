/**
 * Investiga sheet_outbox + webhook Google Sheets.
 */
import pg from 'pg'

const WEBHOOK =
  'https://script.google.com/macros/s/AKfycbxSwlCVIs28ZMk6QX9reii_zww7LZ8S1YVxLllwCO6LUIRV2YaTvuEMbEOEAlNni7+aMbKA/exec'
const EDGE = 'https://zvazpqdvnlecqadxacgv.supabase.co/functions/v1/dynamic-endpoint'
const ANON = 'sb_publishable_q70XV5h5r4XnQHDQVJ5Ewg_ro4MSGgs'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const c = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.zvazpqdvnlecqadxacgv.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()

console.log('=== sheet_outbox amostra ===')
const sample = await c.query(`
  SELECT aba, data_contagem, codigo_interno, left(descricao,40) descricao,
         status, attempts, left(coalesce(last_error,''),100) err, created_at
  FROM sheet_outbox
  ORDER BY created_at DESC
  LIMIT 5
`)
console.table(sample.rows)

const abas = await c.query(`SELECT aba, count(*)::int n FROM sheet_outbox GROUP BY aba`)
console.log('Abas na fila:', abas.rows)

const dates = await c.query(`
  SELECT data_contagem::text d, count(*)::int n
  FROM sheet_outbox GROUP BY data_contagem ORDER BY d DESC LIMIT 10
`)
console.log('Datas na fila:', dates.rows)

await c.end()

async function fetchText(label, url, init) {
  console.log(`\n=== ${label} ===`)
  console.log(url)
  try {
    const res = await fetch(url, init)
    const text = await res.text()
    console.log('HTTP', res.status)
    console.log(text.slice(0, 800))
    return { res, text }
  } catch (e) {
    console.log('ERRO:', e.message)
    return null
  }
}

await fetchText('Webhook GET ping', WEBHOOK)
await fetchText('Webhook list_items', `${WEBHOOK}?action=list_items`)
await fetchText(
  'Webhook check_date_column hoje',
  `${WEBHOOK}?action=check_date_column&ymd=2026-06-08`,
)

const testBody = {
  aba: 'CONTAGEM DE ESTOQUE FISICA',
  data_contagem: '2026-06-08',
  modo_planilha: 'contagem_diaria',
  records: [
    {
      tipo: 'upsert',
      data_contagem: '2026-06-08',
      codigo_interno: 'TESTE_DIAG',
      descricao: 'TESTE DIAGNOSTICO',
      quantidade_contada: 1,
      quantidade_contada_text: '1',
    },
  ],
}

await fetchText('Webhook POST teste 1 registro', WEBHOOK, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(testBody),
})

await fetchText('Edge dynamic-endpoint GET ping', EDGE)
await fetchText('Edge dynamic-endpoint POST drain', EDGE, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ANON}`,
    apikey: ANON,
  },
  body: '{}',
})
