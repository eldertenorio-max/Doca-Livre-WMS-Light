/**
 * Copia views public.* do Supabase antigo → novo.
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/sincronizar-views-supabase.mjs
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'

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

async function listViews(client) {
  const r = await client.query(
    `SELECT viewname FROM pg_views WHERE schemaname='public' ORDER BY viewname`,
  )
  return r.rows.map((x) => x.viewname)
}

async function getViewDef(client, view) {
  const r = await client.query('SELECT pg_get_viewdef($1::regclass, true) AS def', [
    `public.${view}`,
  ])
  return r.rows[0]?.def ?? null
}

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const views = await listViews(oldC)
  if (!views.length) {
    console.log('Nenhuma view no projeto antigo.')
    await oldC.end()
    await newC.end()
    return
  }

  const outDir = path.join(process.cwd(), '..', 'supabase', 'sql')
  fs.mkdirSync(outDir, { recursive: true })

  console.log('Views a copiar:', views.join(', '))
  for (const view of views) {
    const def = await getViewDef(oldC, view)
    if (!def) {
      console.error(`  ${view}: definição não encontrada`)
      continue
    }
    const sql = `-- Gerado de ${REF_ANTIGO} em ${new Date().toISOString()}\n` +
      `drop view if exists public.${view} cascade;\n` +
      `create view public.${view} as\n${def};\n`
    const file = path.join(outDir, `view_${view}.sql`)
    fs.writeFileSync(file, sql, 'utf8')
    await newC.query(`drop view if exists public.${view} cascade`)
    await newC.query(`create view public.${view} as ${def}`)
    console.log(`  ${view}: OK`)
  }

  // security_invoker (como no projeto antigo)
  for (const view of views) {
    await newC
      .query(`alter view public.${view} set (security_invoker = true)`)
      .catch(() => {})
  }

  const newViews = await listViews(newC)
  console.log('Views no projeto novo:', newViews.join(', ') || '(nenhuma)')

  await oldC.end()
  await newC.end()
  console.log('Concluído.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
