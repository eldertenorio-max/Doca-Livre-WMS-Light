/**
 * Copia apenas dados (public + auth) do projeto antigo → novo.
 * Requer SUPABASE_DB_PASSWORD_OLD no frontend/.env
 *
 * Uso:
 *   cd frontend
 *   npm run copiar:dados-antigo
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import {
  REF_ANTIGO,
  REF_NOVO,
  connectPg,
  loadDotEnv,
} from './lib/supabase-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function listPublicTables(client) {
  const r = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  return r.rows.map((x) => x.tablename)
}

async function copyPublicData(oldC, newC) {
  const oldTables = await listPublicTables(oldC)
  const newTables = new Set(await listPublicTables(newC))
  const tables = oldTables.filter((t) => newTables.has(t))
  console.log(`Copiando ${tables.length} tabelas: ${REF_ANTIGO} → ${REF_NOVO}`)

  await newC.query('SET session_replication_role = replica').catch(() => {})

  for (const table of tables) {
    const quoted = qIdent(table)
    const countR = await oldC.query(`SELECT count(*)::int AS n FROM ${quoted}`)
    const n = countR.rows[0]?.n ?? 0
    if (n === 0) {
      console.log(`  ${table}: 0`)
      continue
    }
    const colsR = await oldC.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table],
    )
    const cols = colsR.rows.map((r) => r.column_name)
    const colList = cols.map(qIdent).join(', ')
    const sel = await oldC.query(`SELECT ${colList} FROM ${quoted}`)
    await newC.query(`DELETE FROM ${quoted}`)
    const batch = 100
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
    console.log(`  ${table}: ${inserted}`)
  }

  await newC.query('SET session_replication_role = DEFAULT').catch(() => {})
}

function runScript(name) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, name)], {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..'),
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${name} exit ${code}`))))
  })
}

async function main() {
  loadDotEnv()
  const oldPwd = process.env.SUPABASE_DB_PASSWORD_OLD
  if (!oldPwd) {
    console.error('Defina SUPABASE_DB_PASSWORD_OLD em frontend/.env (senha do projeto zvazpqdvnlecqadxacgv).')
    process.exit(1)
  }

  console.log('Testando conexão com banco antigo...')
  let oldC
  try {
    oldC = await connectPg(REF_ANTIGO, oldPwd)
    const probe = await oldC.query('SELECT count(*)::int AS n FROM public."Todos os Produtos"')
    console.log(`Produtos no antigo: ${probe.rows[0].n}`)
  } catch (e) {
    console.warn('Postgres antigo indisponível:', e.message?.split('\n')[0] || e)
    console.warn('Tentando cópia via REST (chave publicável)...')
    await runScript('copiar-dados-via-rest.mjs')
    await runScript('auditar-projeto-atual.mjs')
    return
  }

  const newC = await connectPg(REF_NOVO)
  await copyPublicData(oldC, newC)
  await oldC.end()
  await newC.end()

  console.log('\nImportando auth.users...')
  await runScript('import-auth-users-postgres.mjs')
  console.log('\nSincronizando triggers e views...')
  await runScript('sincronizar-triggers-sheet-outbox.mjs').catch((e) => console.warn(e.message))
  await runScript('sincronizar-views-supabase.mjs').catch((e) => console.warn(e.message))

  console.log('\nAuditoria destino:')
  await runScript('auditar-projeto-atual.mjs')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
