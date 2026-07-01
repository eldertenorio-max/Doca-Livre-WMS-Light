/**
 * Aplica proteção de dados no Supabase (desativa purge automático).
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/aplicar-cron-supabase.mjs
 *
 * Não reinstala jobs de purge — os dados operacionais são mantidos indefinidamente.
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

const { Client } = pg
const REF_NOVO = 'zvazpqdvnlecqadxacgv'

const pwd = process.env.SUPABASE_DB_PASSWORD
if (!pwd) {
  console.error('Defina SUPABASE_DB_PASSWORD')
  process.exit(1)
}

const SQL_FILES = ['setup_protecao_dados_supabase.sql']

async function main() {
  const client = new Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(pwd)}@db.${REF_NOVO}.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()

  const sqlDir = path.join(process.cwd(), '..', 'supabase', 'sql')
  for (const file of SQL_FILES) {
    const full = path.join(sqlDir, file)
    const sql = fs.readFileSync(full, 'utf8')
    console.log(`Aplicando ${file}...`)
    await client.query(sql)
    console.log(`  OK`)
  }

  const jobs = await client.query(
    `SELECT jobname, schedule, active FROM cron.job ORDER BY jobname`,
  )
  console.log('\nJobs no projeto novo:')
  for (const j of jobs.rows) {
    console.log(`  ${j.jobname} | ${j.schedule} | ativo=${j.active}`)
  }

  await client.end()
  console.log('\nConcluído.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
