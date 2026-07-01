/**
 * Clona schema + dados do Supabase antigo → novo (estrutura lida do banco antigo).
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/migrar-banco-supabase.mjs
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

async function getColumnDefs(client, table) {
  const r = await client.query(
    `SELECT column_name, udt_name, data_type, character_maximum_length,
            numeric_precision, numeric_scale, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1
     ORDER BY ordinal_position`,
    [table],
  )
  return r.rows
}

function colSql(c) {
  let type = c.udt_name
  if (type === 'varchar' || type === 'bpchar') {
    type = c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'text'
  } else if (type === 'numeric' && c.numeric_precision) {
    type = `numeric(${c.numeric_precision},${c.numeric_scale ?? 0})`
  } else if (type === 'timestamptz') {
    type = 'timestamptz'
  } else if (type === 'uuid') {
    type = 'uuid'
  } else if (type === 'int4') {
    type = 'integer'
  } else if (type === 'int8') {
    type = 'bigint'
  } else if (type === 'bool') {
    type = 'boolean'
  } else if (type === 'jsonb') {
    type = 'jsonb'
  } else if (type === 'text') {
    type = 'text'
  } else if (type === 'date') {
    type = 'date'
  } else {
    type = c.data_type || type
  }
  let def = `${qIdent(c.column_name)} ${type}`
  if (c.column_default != null) def += ` DEFAULT ${c.column_default}`
  if (c.is_nullable === 'NO') def += ' NOT NULL'
  return def
}

async function createTableLikeOld(oldC, newC, table) {
  const cols = await getColumnDefs(oldC, table)
  if (!cols.length) return
  const body = cols.map(colSql).join(',\n  ')
  const sql = `CREATE TABLE IF NOT EXISTS ${qIdent(table)} (\n  ${body}\n)`
  if (process.env.ALLOW_DESTRUCTIVE_MIGRATION !== '1') {
    throw new Error(
      `DROP TABLE bloqueado em "${table}". Defina ALLOW_DESTRUCTIVE_MIGRATION=1 apenas se souber que vai recriar a tabela.`,
    )
  }
  await newC.query(`DROP TABLE IF EXISTS ${qIdent(table)} CASCADE`)
  await newC.query(sql)
  console.log('  schema:', table)
}

async function copyTableData(oldC, newC, table) {
  const quoted = qIdent(table)
  const countR = await oldC.query(`SELECT count(*)::int AS n FROM ${quoted}`)
  const n = countR.rows[0]?.n ?? 0
  if (n === 0) {
    console.log(`  dados ${table}: 0`)
    return
  }
  const cols = (await getColumnDefs(oldC, table)).map((c) => c.column_name)
  const colList = cols.map(qIdent).join(', ')
  const sel = await oldC.query(`SELECT ${colList} FROM ${quoted}`)
  const batch = 50
  let inserted = 0
  for (let i = 0; i < sel.rows.length; i += batch) {
    const chunk = sel.rows.slice(i, i + batch)
    const placeholders = chunk
      .map((_, ri) => `(${cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`)
      .join(', ')
    const values = chunk.flatMap((row) => cols.map((c) => row[c]))
    await newC.query(`INSERT INTO ${quoted} (${colList}) VALUES ${placeholders}`, values)
    inserted += chunk.length
  }
  console.log(`  dados ${table}: ${inserted}`)
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  await newC.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  const tables = await listPublicTables(oldC)
  console.log('Tabelas a migrar:', tables.join(', '))

  console.log('1) Criando tabelas no projeto novo...')
  for (const table of tables) {
    await createTableLikeOld(oldC, newC, table)
  }

  console.log('2) Copiando dados...')
  await newC.query('SET session_replication_role = replica').catch(() => {})
  for (const table of tables) {
    try {
      await copyTableData(oldC, newC, table)
    } catch (e) {
      console.error(`  ERRO dados ${table}:`, e.message)
    }
  }
  await newC.query('SET session_replication_role = DEFAULT').catch(() => {})

  console.log('3) Totais no projeto novo:')
  for (const t of tables) {
    const r = await newC.query(`SELECT count(*)::int AS n FROM ${qIdent(t)}`)
    console.log(`  ${t}:`, r.rows[0].n)
  }

  await oldC.end()
  await newC.end()
  console.log('Concluído.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
