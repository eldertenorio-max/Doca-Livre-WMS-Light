/**
 * Auditoria: o que ainda difere entre Supabase antigo e novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/auditar-migracao-supabase.mjs
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

async function countTable(client, table) {
  const r = await client.query(`SELECT count(*)::int AS n FROM ${qIdent(table)}`)
  return r.rows[0].n
}

async function snapshot(client) {
  const extensions = await client.query(
    `SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') ORDER BY 1`,
  )

  const cronJobs = await client
    .query(`SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname`)
    .catch(() => ({ rows: [] }))

  const publicFns = await client.query(`
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
    ORDER BY 1
  `)

  const triggers = await client.query(`
    SELECT c.relname AS table_name, t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
    ORDER BY 1, 2
  `)

  const rls = await client.query(`
    SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY 1
  `)

  const policies = await client.query(`
    SELECT tablename, count(*)::int AS n
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
    ORDER BY 1
  `)

  const realtime = await client.query(`
    SELECT schemaname, tablename
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    ORDER BY 1, 2
  `)

  const views = await client.query(
    `SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY 1`,
  )

  const authUsers = await client.query(
    `SELECT count(*)::int AS n FROM auth.users WHERE deleted_at IS NULL`,
  )

  const buckets = await client
    .query(`SELECT id, name, public FROM storage.buckets ORDER BY name`)
    .catch(() => ({ rows: [] }))

  const vault = await client
    .query(`SELECT name FROM vault.secrets ORDER BY name`)
    .catch(() => ({ rows: [] }))

  return {
    extensions: extensions.rows.map((r) => r.extname),
    cronJobs: cronJobs.rows,
    publicFns: publicFns.rows.map((r) => r.proname),
    triggers: triggers.rows.map((r) => `${r.table_name}.${r.trigger_name}`),
    rls: rls.rows.map((r) => ({
      table: r.relname,
      enabled: r.relrowsecurity,
      forced: r.relforcerowsecurity,
    })),
    policies: policies.rows,
    realtime: realtime.rows.map((r) => `${r.schemaname}.${r.tablename}`),
    views: views.rows.map((r) => r.viewname),
    authUsers: authUsers.rows[0].n,
    buckets: buckets.rows,
    vault: vault.rows.map((r) => r.name),
  }
}

function diffList(label, oldList, newList) {
  const onlyOld = oldList.filter((x) => !newList.includes(x))
  const onlyNew = newList.filter((x) => !oldList.includes(x))
  if (!onlyOld.length && !onlyNew.length) {
    console.log(`  ${label}: OK (${oldList.length})`)
    return false
  }
  console.log(`  ${label}: DIFERENTE`)
  if (onlyOld.length) console.log(`    só antigo (${onlyOld.length}):`, onlyOld.join(', '))
  if (onlyNew.length) console.log(`    só novo (${onlyNew.length}):`, onlyNew.join(', '))
  return true
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const old = await snapshot(oldC)
  const neu = await snapshot(newC)

  console.log('=== AUDITORIA MIGRAÇÃO SUPABASE ===\n')
  console.log(`Antigo: ${REF_ANTIGO}`)
  console.log(`Novo:   ${REF_NOVO}\n`)

  let issues = 0

  // Dados
  console.log('1) DADOS (public.* + auth)')
  const tables = await listPublicTables(oldC)
  for (const t of tables) {
    const o = await countTable(oldC, t)
    const n = await countTable(newC, t)
    if (o !== n) {
      issues++
      console.log(`  ${t}: antigo=${o} novo=${n} NAO`)
    }
  }
  console.log(`  tabelas public: ${tables.length} comparadas — contagens ${issues ? 'com diferença' : 'iguais'}`)
  if (old.authUsers !== neu.authUsers) {
    issues++
    console.log(`  auth.users: antigo=${old.authUsers} novo=${neu.authUsers} NAO`)
  } else {
    console.log(`  auth.users: ${old.authUsers} OK`)
  }

  console.log('\n2) VIEWS')
  if (diffList('views', old.views, neu.views)) issues++

  console.log('\n3) EXTENSÕES')
  if (diffList('extensions', old.extensions, neu.extensions)) issues++

  console.log('\n4) FUNÇÕES public (purge, triggers, etc.)')
  if (diffList('funções', old.publicFns, neu.publicFns)) issues++

  console.log('\n5) TRIGGERS')
  if (diffList('triggers', old.triggers, neu.triggers)) issues++

  console.log('\n6) RLS (tabelas com row security)')
  const oldRlsOn = old.rls.filter((r) => r.enabled).map((r) => r.table).sort()
  const newRlsOn = neu.rls.filter((r) => r.enabled).map((r) => r.table).sort()
  if (diffList('RLS ativo', oldRlsOn, newRlsOn)) issues++

  console.log('\n7) POLICIES (contagem por tabela)')
  const oldPol = Object.fromEntries(old.policies.map((p) => [p.tablename, p.n]))
  const newPol = Object.fromEntries(neu.policies.map((p) => [p.tablename, p.n]))
  const polTables = [...new Set([...Object.keys(oldPol), ...Object.keys(newPol)])].sort()
  let polDiff = false
  for (const t of polTables) {
    if ((oldPol[t] ?? 0) !== (newPol[t] ?? 0)) {
      polDiff = true
      console.log(`  ${t}: antigo=${oldPol[t] ?? 0} novo=${newPol[t] ?? 0}`)
    }
  }
  if (!polDiff) console.log('  policies: OK')
  else issues++

  console.log('\n8) REALTIME (publication supabase_realtime)')
  if (diffList('tabelas realtime', old.realtime, neu.realtime)) issues++

  console.log('\n9) PG_CRON')
  const oldCron = old.cronJobs.map((j) => j.jobname)
  const newCron = neu.cronJobs.map((j) => j.jobname)
  if (diffList('jobs', oldCron, newCron)) issues++
  for (const name of [...new Set([...oldCron, ...newCron])].sort()) {
    const o = old.cronJobs.find((j) => j.jobname === name)
    const n = neu.cronJobs.find((j) => j.jobname === name)
    if (o && n && o.schedule === n.schedule) continue
    if (o && !n) {
      issues++
      console.log(`  job ausente no novo: ${name} (${o.schedule})`)
      if (name === 'sheet-outbox-sync-every-minute') {
        console.log(`    comando antigo: ${o.command?.slice(0, 200)}...`)
      }
    }
  }

  console.log('\n10) STORAGE')
  if (diffList('buckets', old.buckets.map((b) => b.name), neu.buckets.map((b) => b.name))) issues++

  console.log('\n11) VAULT SECRETS (nomes apenas)')
  if (diffList('secrets', old.vault, neu.vault)) issues++

  console.log('\n12) FORA DO BANCO (verificar manualmente)')
  console.log('  - Edge Functions deploy no projeto novo:')
  console.log('    login-username, register-username, sheet-outbox-sync, sheet-checklist-proxy')
  console.log('    (+ legado: auth-login-ensure, auth-register-confirmed)')
  console.log('  - Secrets das functions: SHEET_WEBHOOK_URL, etc.')
  console.log('  - Render: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY do projeto novo')
  console.log('  - GitHub: remote/conta pessoal se ainda apontar para org antiga')

  console.log(`\n=== FIM: ${issues ? issues + ' diferença(s) no banco' : 'banco alinhado'} ===`)

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
