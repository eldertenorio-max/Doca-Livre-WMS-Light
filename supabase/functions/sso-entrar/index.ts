// SSO a partir do portal WMS Pro: valida token no Pro (fonte da verdade)
// e cria sessão Supabase Auth no Light sem pedir senha.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY
// Opcional: WMS_PRO_URL (padrão produção), SSO_SECRET (fallback HMAC local)
// Deploy: supabase functions deploy sso-entrar

import { createClient } from 'npm:@supabase/supabase-js'

const INTERNAL_EMAIL_DOMAIN = 'internal.local'
const EXPECTED_SYSTEM = 'light'
const DEFAULT_PRO_URL = 'https://doca-livre-wms-pro.onrender.com'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function b64urlDecode(text: string): Uint8Array {
  const pad = '='.repeat((4 - (text.length % 4)) % 4)
  const b64 = (text + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return bytesToB64url(sig)
}

async function verifySsoTokenLocal(token: string, secret: string): Promise<string> {
  const raw = (token || '').trim()
  const dot = raw.indexOf('.')
  if (dot <= 0) throw new Error('Token inválido.')
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  if (!body || !sig) throw new Error('Token inválido.')
  const expected = await hmacSha256(secret, body)
  if (expected !== sig) throw new Error('Assinatura inválida.')
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as Record<string, unknown>
  const usuario = String(payload.u || '').trim()
  const system = String(payload.s || '').trim().toLowerCase()
  const exp = Number(payload.exp || 0)
  if (!usuario || !system) throw new Error('Token incompleto.')
  if (system !== EXPECTED_SYSTEM) throw new Error('Token destinado a outro sistema.')
  if (!Number.isFinite(exp) || Date.now() / 1000 > exp) throw new Error('Token expirado.')
  return usuario
}

function proVerifyBases(): string[] {
  const preferred = (
    Deno.env.get('WMS_PRO_URL') ||
    Deno.env.get('VITE_WMS_PRO_URL') ||
    ''
  )
    .trim()
    .replace(/\/$/, '')
  const fallbacks = [
    DEFAULT_PRO_URL,
    'https://doca-livre-wms-pro-homologacao.onrender.com',
  ]
  const out: string[] = []
  for (const base of [preferred, ...fallbacks]) {
    const clean = (base || '').trim().replace(/\/$/, '')
    if (clean && !out.includes(clean)) out.push(clean)
  }
  return out
}

async function verifySsoTokenViaPro(token: string): Promise<string> {
  const bases = proVerifyBases()
  let lastError = 'SSO Pro rejeitou o token.'
  for (const proBase of bases) {
    try {
      const res = await fetch(`${proBase}/api/sso/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, system: EXPECTED_SYSTEM }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        usuario?: string
        erro?: string
      }
      if (res.ok && data.ok && data.usuario) {
        return String(data.usuario).trim()
      }
      lastError = data.erro || `SSO Pro rejeitou o token (HTTP ${res.status}).`
      // Token já consumido: não adianta tentar outro Pro.
      if (/j[aá]\s*utilizado|already\s*used|consum/i.test(lastError)) break
    } catch (err) {
      lastError = err instanceof Error ? err.message : `Falha de rede ao validar SSO em ${proBase}.`
    }
  }
  throw new Error(lastError)
}

type SupabaseAdmin = ReturnType<typeof createClient>

async function findAuthUserIdByEmailLocalPart(admin: SupabaseAdmin, localPart: string): Promise<string | null> {
  const want = localPart.toLowerCase()
  let page = 1
  const perPage = 1000
  for (let i = 0; i < 100; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users ?? []
    for (const u of users) {
      const em = (u.email || '').trim().toLowerCase()
      if (!em.includes('@')) continue
      const local = em.slice(0, em.indexOf('@'))
      if (local === want) return u.id
    }
    if (users.length < perPage) break
    page++
  }
  return null
}

async function resolveEmailForUsername(admin: SupabaseAdmin, usernameRaw: string): Promise<string | null> {
  const effective = usernameRaw.trim().toLowerCase().replace(/\s+/g, '.')
  const { data: rowByUser } = await admin.from('usuarios').select('id, username').eq('username', effective).maybeSingle()

  if (rowByUser?.id) {
    const { data: authData } = await admin.auth.admin.getUserById(String(rowByUser.id))
    const em = authData.user?.email?.trim()
    if (em) return em
  }

  const uid = await findAuthUserIdByEmailLocalPart(admin, effective)
  if (uid) {
    const { data: authData } = await admin.auth.admin.getUserById(uid)
    const em = authData.user?.email?.trim()
    if (em) return em
  }

  return `${effective}@${INTERNAL_EMAIL_DOMAIN}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Use POST' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !serviceKey || !anonKey) {
    return jsonResponse({ ok: false, error: 'Função sem variáveis SUPABASE_*' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400)
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) {
    return jsonResponse({ ok: false, error: 'Informe o token SSO.' }, 400)
  }

  // 1) Valida no Pro (mesmo segredo do portal). 2) Fallback HMAC local se SSO_SECRET existir.
  let usuario: string
  try {
    usuario = await verifySsoTokenViaPro(token)
  } catch (proErr) {
    const ssoSecret = Deno.env.get('SSO_SECRET')?.trim()
    if (!ssoSecret) {
      return jsonResponse({
        ok: false,
        error: proErr instanceof Error ? proErr.message : 'Falha ao validar SSO no Pro.',
      }, 401)
    }
    try {
      usuario = await verifySsoTokenLocal(token, ssoSecret)
    } catch (localErr) {
      return jsonResponse({
        ok: false,
        error:
          (proErr instanceof Error ? proErr.message : 'SSO Pro falhou') +
          ' | ' +
          (localErr instanceof Error ? localErr.message : 'HMAC local falhou'),
      }, 401)
    }
  }

  const username = usuario.trim().toLowerCase().replace(/\s+/g, '.')
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: rowLocal } = await admin.from('usuarios').select('id, username').eq('username', username).maybeSingle()
  let email = await resolveEmailForUsername(admin, username)
  if (!rowLocal?.id) {
    const uid = await findAuthUserIdByEmailLocalPart(admin, username)
    if (uid) {
      const { data: authData } = await admin.auth.admin.getUserById(uid)
      email = authData.user?.email?.trim() || email
    } else {
      email = `${username}@${INTERNAL_EMAIL_DOMAIN}`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { username, portal_sso: true },
      })
      if (createErr || !created?.user?.id) {
        const existingId = await findAuthUserIdByEmailLocalPart(admin, username)
        if (!existingId) {
          return jsonResponse({
            ok: false,
            error: createErr?.message || `Falha ao provisionar "${username}" no WMS Light.`,
          }, 400)
        }
      }
    }
  }

  if (!email) {
    return jsonResponse({ ok: false, error: 'Não foi possível resolver e-mail do usuário no Light.' }, 400)
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    return jsonResponse({
      ok: false,
      error: linkErr?.message || 'Falha ao gerar sessão SSO no Light.',
    }, 400)
  }

  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: 'email',
    token_hash: String(linkData.properties.hashed_token),
  })
  if (otpErr || !otpData.session) {
    return jsonResponse({
      ok: false,
      error: otpErr?.message || 'Falha ao confirmar sessão SSO.',
    }, 400)
  }

  return jsonResponse({
    ok: true,
    usuario: username,
    access_token: otpData.session.access_token,
    refresh_token: otpData.session.refresh_token,
  })
})
