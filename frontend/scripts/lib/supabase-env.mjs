import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(__dirname, '../../..')

export const REF_ANTIGO = process.env.SUPABASE_PROJECT_REF_OLD || 'zvazpqdvnlecqadxacgv'
export const REF_NOVO = process.env.SUPABASE_PROJECT_REF || 'qvtnzyqdfhupfsqdqrel'

export function loadDotEnv() {
  const tryPaths = [
    path.join(repoRoot, 'frontend', '.env'),
    path.join(repoRoot, 'frontend', '.env.local'),
    path.join(repoRoot, '.env'),
  ]
  for (const p of tryPaths) {
    try {
      const raw = fs.readFileSync(p, 'utf8')
      for (const line of raw.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq <= 0) continue
        const k = t.slice(0, eq).trim()
        let v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && process.env[k] === undefined) process.env[k] = v
      }
    } catch {
      /* ignore */
    }
  }
}

export function pwdForRef(ref) {
  loadDotEnv()
  if (ref === REF_ANTIGO && process.env.SUPABASE_DB_PASSWORD_OLD) {
    return process.env.SUPABASE_DB_PASSWORD_OLD
  }
  return process.env.SUPABASE_DB_PASSWORD
}

export async function connectPg(ref, pwd) {
  loadDotEnv()
  const password = pwd ?? pwdForRef(ref)
  if (!password) {
    throw new Error(
      'Defina SUPABASE_DB_PASSWORD (Supabase → Settings → Database → senha do Postgres).',
    )
  }

  const fullUrl = process.env.SUPABASE_DB_URL
  if (fullUrl) {
    const { default: pg } = await import('pg')
    const client = new pg.Client({
      connectionString: fullUrl,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    return client
  }

  const port = process.env.SUPABASE_DB_PORT || '5432'

  const useDirect =
    (ref === REF_ANTIGO && process.env.SUPABASE_DB_DIRECT_OLD === '1') ||
    (ref === REF_NOVO && process.env.SUPABASE_DB_DIRECT === '1')

  if (useDirect) {
    const host = `db.${ref}.supabase.co`
    const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@${host}:${port}/postgres`
    const { default: pg } = await import('pg')
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    return client
  }

  const poolerHost =
    (ref === REF_ANTIGO && process.env.SUPABASE_DB_POOLER_HOST_OLD) ||
    (ref === REF_NOVO && process.env.SUPABASE_DB_POOLER_HOST) ||
    (ref === REF_NOVO ? 'aws-0-ca-central-1.pooler.supabase.com' : 'aws-1-us-east-1.pooler.supabase.com')

  const user = `postgres.${ref}`
  const connectionString = `postgresql://${user}:${encodeURIComponent(password)}@${poolerHost}:${port}/postgres`

  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  return client
}

export function sqlPath(rel) {
  return path.join(repoRoot, rel.replace(/\//g, path.sep))
}

export async function runSqlFile(client, relPath) {
  const full = sqlPath(relPath)
  const sql = fs.readFileSync(full, 'utf8')
  await client.query(sql)
}
