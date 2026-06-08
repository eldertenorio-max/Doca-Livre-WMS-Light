/**
 * Copia auth.users + auth.identities do projeto antigo → novo via Postgres.
 * Preserva UUID e hash de senha (login igual ao antigo).
 *
 * Uso: SUPABASE_DB_PASSWORD='...' node scripts/import-auth-users-postgres.mjs
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

async function main() {
  const oldC = conn(REF_ANTIGO)
  const newC = conn(REF_NOVO)
  await oldC.connect()
  await newC.connect()

  const instNew = await newC.query('SELECT id FROM auth.instances LIMIT 1')
  const instOld = await oldC.query('SELECT DISTINCT instance_id FROM auth.users LIMIT 1')
  const instanceId =
    instNew.rows[0]?.id ??
    instOld.rows[0]?.instance_id ??
    '00000000-0000-0000-0000-000000000000'

  const existing = await newC.query('SELECT count(*)::int AS n FROM auth.users')
  if (existing.rows[0].n > 0) {
    console.log(`Projeto novo já tem ${existing.rows[0].n} usuário(s) Auth.`)
  }

  const users = await oldC.query(`
    SELECT id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
           confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
           email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
           raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
           phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
           email_change_token_current, email_change_confirm_status, banned_until,
           reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
    FROM auth.users
    WHERE deleted_at IS NULL
    ORDER BY created_at
  `)

  const identities = await oldC.query(`
    SELECT id, user_id, identity_data, provider, provider_id, last_sign_in_at,
           created_at, updated_at
    FROM auth.identities
    ORDER BY created_at
  `)

  console.log(`Copiando ${users.rows.length} auth.users e ${identities.rows.length} auth.identities...`)

  await newC.query('BEGIN')
  try {
    for (const u of users.rows) {
      await newC.query(
        `INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
          confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at,
          email_change_token_new, email_change, email_change_sent_at, last_sign_in_at,
          raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
          phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at,
          email_change_token_current, email_change_confirm_status, banned_until,
          reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
          $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          encrypted_password = EXCLUDED.encrypted_password,
          email_confirmed_at = EXCLUDED.email_confirmed_at,
          raw_app_meta_data = EXCLUDED.raw_app_meta_data,
          raw_user_meta_data = EXCLUDED.raw_user_meta_data,
          updated_at = EXCLUDED.updated_at`,
        [
          instanceId,
          u.id,
          u.aud,
          u.role,
          u.email,
          u.encrypted_password,
          u.email_confirmed_at,
          u.invited_at,
          u.confirmation_token,
          u.confirmation_sent_at,
          u.recovery_token,
          u.recovery_sent_at,
          u.email_change_token_new,
          u.email_change,
          u.email_change_sent_at,
          u.last_sign_in_at,
          u.raw_app_meta_data,
          u.raw_user_meta_data,
          u.is_super_admin,
          u.created_at,
          u.updated_at,
          u.phone,
          u.phone_confirmed_at,
          u.phone_change,
          u.phone_change_token,
          u.phone_change_sent_at,
          u.email_change_token_current,
          u.email_change_confirm_status,
          u.banned_until,
          u.reauthentication_token,
          u.reauthentication_sent_at,
          u.is_sso_user,
          u.deleted_at,
          u.is_anonymous,
        ],
      )
      console.log(`  user OK: ${u.email}`)
    }

    for (const i of identities.rows) {
      await newC.query(
        `INSERT INTO auth.identities (
          id, user_id, identity_data, provider, provider_id, last_sign_in_at,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO UPDATE SET
          identity_data = EXCLUDED.identity_data,
          provider_id = EXCLUDED.provider_id,
          updated_at = EXCLUDED.updated_at`,
        [
          i.id,
          i.user_id,
          i.identity_data,
          i.provider,
          i.provider_id,
          i.last_sign_in_at,
          i.created_at,
          i.updated_at,
        ],
      )
    }

    await newC.query('COMMIT')
  } catch (e) {
    await newC.query('ROLLBACK')
    throw e
  }

  const countNew = await newC.query('SELECT count(*)::int AS n FROM auth.users WHERE deleted_at IS NULL')
  console.log(`\nAuth no projeto novo: ${countNew.rows[0].n} usuário(s)`)
  console.log('Concluído — senhas preservadas (hash copiado).')

  await oldC.end()
  await newC.end()
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
