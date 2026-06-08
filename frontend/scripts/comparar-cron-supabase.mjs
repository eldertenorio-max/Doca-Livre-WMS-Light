/**
 * Compara jobs pg_cron e funções de purge entre Supabase antigo e novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/comparar-cron-supabase.mjs
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

async function snapshot(client, label) {
  const ext = await client.query(
    `SELECT extname FROM pg_extension WHERE extname IN ('pg_cron')`,
  )
  const jobs = await client
    .query(`SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobname`)
    .catch(() => ({ rows: [] }))
  const fns = await client.query(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname LIKE 'purge%'
    ORDER BY 1
  `)
  return { label, pg_cron: ext.rows.length > 0, jobs: jobs.rows, fns: fns.rows.map((r) => r.proname) }
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()
  const old = await snapshot(oldC, 'antigo')
  const newS = await snapshot(newC, 'novo')

  console.log('=== AUTO-LIMPEZA (pg_cron) ===\n')
  console.log(`pg_cron ativo | antigo: ${old.pg_cron ? 'sim' : 'nao'} | novo: ${newS.pg_cron ? 'sim' : 'nao'}`)
  console.log('\nFunções purge:')
  const allFns = [...new Set([...old.fns, ...newS.fns])].sort()
  for (const f of allFns) {
    console.log(`  ${f} | antigo: ${old.fns.includes(f) ? 'sim' : 'nao'} | novo: ${newS.fns.includes(f) ? 'sim' : 'nao'}`)
  }
  console.log('\nJobs agendados:')
  const allJobs = [...new Set([...old.jobs.map((j) => j.jobname), ...newS.jobs.map((j) => j.jobname)])].sort()
  for (const name of allJobs) {
    const o = old.jobs.find((j) => j.jobname === name)
    const n = newS.jobs.find((j) => j.jobname === name)
    console.log(`  ${name}`)
    console.log(`    antigo: ${o ? `${o.schedule} | ativo=${o.active}` : 'ausente'}`)
    console.log(`    novo:   ${n ? `${n.schedule} | ativo=${n.active}` : 'ausente'}`)
  }
  if (!allJobs.length) console.log('  (nenhum job em ambos)')

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
