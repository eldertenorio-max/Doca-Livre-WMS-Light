/** Invoca Edge Function sso-entrar do WMS Light. */

import { clearPortalSsoTokenFromUrl, readPortalSsoTokenFromLocation } from './portalSso'

export { clearPortalSsoTokenFromUrl, readPortalSsoTokenFromLocation }

type SsoOk = { ok: true; access_token: string; refresh_token: string; usuario?: string }
type SsoFail = { ok: false; error: string }

export async function consumeLightSsoToken(token: string): Promise<SsoOk | SsoFail> {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim().replace(/\/$/, '')
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()
  if (!base || !anon) {
    return { ok: false, error: 'Supabase não configurado no Light.' }
  }
  try {
    const res = await fetch(`${base}/functions/v1/sso-entrar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ token }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      access_token?: string
      refresh_token?: string
      usuario?: string
    }
    if (!res.ok || !data.ok || !data.access_token || !data.refresh_token) {
      return { ok: false, error: data.error || 'Falha no SSO do Light.' }
    }
    return {
      ok: true,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      usuario: data.usuario,
    }
  } catch {
    return { ok: false, error: 'Falha de rede ao consumir SSO.' }
  }
}
