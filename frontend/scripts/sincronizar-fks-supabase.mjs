/**
 * Copia foreign keys do Supabase antigo → novo (schema public).
 * Corrige erro PostgREST: "Could not find a relationship between ..."
 *
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/sincronizar-fks-supabase.mjs
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

async function listFks(client) {
  const r = await client.query(`
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_name
  `)
  return r.rows
}

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

function fkKey(row) {
  return `${row.table_name}.${row.column_name}->${row.foreign_table_name}.${row.foreign_column_name}`
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const oldFks = await listFks(oldC)
  const newFks = await listFks(newC)
  const newSet = new Set(newFks.map(fkKey))

  console.log(`FKs antigo: ${oldFks.length} | novo: ${newFks.length}`)

  let applied = 0
  for (const fk of oldFks) {
    const key = fkKey(fk)
    if (newSet.has(key)) {
      console.log(`  já existe: ${key}`)
      continue
    }
    const onDelete = fk.delete_rule === 'NO ACTION' ? 'NO ACTION' : fk.delete_rule
    const sql = `
      ALTER TABLE ${qIdent(fk.table_schema)}.${qIdent(fk.table_name)}
      ADD CONSTRAINT ${qIdent(fk.constraint_name)}
      FOREIGN KEY (${qIdent(fk.column_name)})
      REFERENCES ${qIdent(fk.foreign_table_schema)}.${qIdent(fk.foreign_table_name)} (${qIdent(fk.foreign_column_name)})
      ON DELETE ${onDelete}
      ON UPDATE ${fk.update_rule}
    `
    try {
      await newC.query(sql)
      console.log(`  OK: ${key} (${fk.constraint_name})`)
      applied++
    } catch (e) {
      console.error(`  ERRO ${key}:`, e.message)
    }
  }

  const after = await listFks(newC)
  console.log(`\nAplicadas: ${applied} | FKs no novo agora: ${after.length}`)

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
