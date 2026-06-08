/**
 * Importa usuários Auth no Supabase novo a partir do backup (auth-users + usuarios).
 * Preserva UUID para bater com public.usuarios já migrado.
 *
 * Uso (na pasta frontend):
 *   $env:SUPABASE_URL="https://zvazpqdvnlecqadxacgv.supabase.co"
 *   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # service_role do projeto NOVO
 *   node scripts/import-auth-users.mjs
 *
 * Opcional:
 *   AUTH_BACKUP_JSON=backups/auth-users-....json
 *   USUARIOS_BACKUP_JSON=backups/usuarios-....json
 *   IMPORT_DEFAULT_PASSWORD=SenhaTemp2026!   # quando usuarios.senha estiver vazia
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

function loadDotEnv() {
  const tryPaths = [
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '..', '.env'),
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

function latestBackup(prefix) {
  const dir = path.join(process.cwd(), 'backups')
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
  if (!files.length) throw new Error(`Nenhum backup ${prefix}*.json em backups/`)
  return path.join(dir, files[files.length - 1])
}

function cleanMeta(meta) {
  if (!meta || typeof meta !== 'object') return {}
  const { email_verified, ...rest } = meta
  return rest
}

async function findUserIdByEmail(admin, email) {
  const target = (email || '').toLowerCase()
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const found = data.users.find((u) => (u.email || '').toLowerCase() === target)
    if (found) return found.id
    if (data.users.length < 200) break
  }
  return null
}

async function main() {
  loadDotEnv()
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const defaultPwd = (process.env.IMPORT_DEFAULT_PASSWORD || 'MigrarAuth2026!').trim()

  if (!url || !serviceKey) {
    console.error(
      'Defina SUPABASE_URL (ou VITE_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY do projeto NOVO.',
    )
    process.exit(1)
  }

  const authPath = process.env.AUTH_BACKUP_JSON || latestBackup('auth-users-')
  const usuariosPath = process.env.USUARIOS_BACKUP_JSON || latestBackup('usuarios-')

  const authUsers = JSON.parse(fs.readFileSync(authPath, 'utf8'))
  const usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'))
  const senhaById = new Map(
    usuarios.map((u) => [u.id, u.senha != null ? String(u.senha).trim() : '']),
  )

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`Importando ${authUsers.length} usuários → ${url}`)
  console.log(`Backup auth: ${path.basename(authPath)}`)
  console.log(`Backup usuarios: ${path.basename(usuariosPath)}`)

  let ok = 0
  let skipped = 0
  const semSenha = []

  for (const u of authUsers) {
    const email = (u.email || '').trim()
    const id = u.id
    const meta = cleanMeta(u.user_metadata)
    let password = senhaById.get(id) || ''
    if (!password) {
      password = defaultPwd
      semSenha.push(email || id)
    }

    const payload = {
      id,
      email,
      password,
      email_confirm: true,
      user_metadata: meta,
    }

    const { data, error } = await admin.auth.admin.createUser(payload)

    if (!error) {
      console.log(`  OK criado: ${email}`)
      ok++
      continue
    }

    const msg = (error.message || '').toLowerCase()
    const dup =
      msg.includes('already') || msg.includes('registered') || msg.includes('exists')

    if (!dup) {
      console.error(`  ERRO ${email}:`, error.message)
      continue
    }

    let existingId = await findUserIdByEmail(admin, email)
    if (!existingId && id) existingId = id

    if (!existingId) {
      console.error(`  ERRO ${email}: já existe mas ID não encontrado`)
      continue
    }

    const { error: upErr } = await admin.auth.admin.updateUserById(existingId, {
      password,
      email_confirm: true,
      user_metadata: meta,
    })
    if (upErr) {
      console.error(`  ERRO atualizar ${email}:`, upErr.message)
      continue
    }
    console.log(`  OK atualizado: ${email}`)
    ok++
  }

  const { count, error: countErr } = await admin
    .from('usuarios')
    .select('*', { count: 'exact', head: true })
  if (countErr) console.warn('usuarios count:', countErr.message)

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1 })
  if (listErr) {
    console.warn('listUsers:', listErr.message)
  } else {
    // total via paginação rápida
    let total = 0
    for (let page = 1; page < 100; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error) break
      total += data.users.length
      if (data.users.length < 200) break
    }
    console.log(`\nAuth no projeto novo: ${total} usuário(s)`)
  }

  console.log(`Importados/atualizados: ${ok} | ignorados: ${skipped}`)
  if (semSenha.length) {
    console.log(
      `\nSem senha em usuarios.senha (usaram senha padrão "${defaultPwd}"):`,
      semSenha.join(', '),
    )
    console.log('Peça para esses usuários trocar a senha no primeiro login.')
  }
  console.log('\nConcluído.')
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})
