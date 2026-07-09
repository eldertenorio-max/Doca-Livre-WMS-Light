/**
 * Copia do antigo → novo: funções/triggers de sheet_outbox + data_contagem.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/sincronizar-triggers-sheet-outbox.mjs
 */
import pg from 'pg'

const { Client } = pg
const REF_ANTIGO = process.env.SUPABASE_PROJECT_REF_OLD || 'swnefuddaswgjvhiuxok'
const REF_NOVO = process.env.SUPABASE_PROJECT_REF || 'ogpiinpoclfjnvrbthrq'

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

const FN_NAMES = [
  'set_contagens_data_contagem',
  'enqueue_sheet_outbox_from_contagem',
]

async function getFunctionDef(client, name) {
  const r = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = $1
     ORDER BY p.oid
     LIMIT 1`,
    [name],
  )
  return r.rows[0]?.def ?? null
}

async function getTriggers(client) {
  const r = await client.query(`
    SELECT pg_get_triggerdef(t.oid, true) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND (
        t.tgname LIKE 'trg_sheet_outbox%'
        OR t.tgname = 'trg_set_contagens_data_contagem'
      )
    ORDER BY 1
  `)
  return r.rows.map((x) => x.def)
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  for (const fn of FN_NAMES) {
    const def = await getFunctionDef(oldC, fn)
    if (!def) {
      console.warn(`Função ${fn} não encontrada no antigo`)
      continue
    }
    await newC.query(def)
    console.log(`Função OK: ${fn}`)
  }

  const triggers = await getTriggers(oldC)
  for (const def of triggers) {
    const name = def.match(/CREATE TRIGGER\s+(\S+)/i)?.[1]
    const table = def.match(/ON\s+(\S+)/i)?.[1]
    if (name && table) {
      await newC.query(`DROP TRIGGER IF EXISTS ${name} ON ${table}`)
    }
    await newC.query(def)
    console.log(`Trigger OK: ${name}`)
  }

  await oldC.end()
  await newC.end()
  console.log('Concluído.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
