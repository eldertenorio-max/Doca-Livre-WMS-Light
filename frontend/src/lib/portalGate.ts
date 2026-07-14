/** Acesso direto (sem SSO do Pro) redireciona ao portal único. */

const PORTAL_ENTRY_KEY = 'doca_portal_entry_v1'
const DEFAULT_PRO_URL = 'https://doca-livre-wms-pro.onrender.com/'

export function getProPortalUrl(): string {
  const fromEnv = (import.meta.env.VITE_WMS_PRO_URL as string | undefined)?.trim()
  const base = (fromEnv || DEFAULT_PRO_URL).replace(/\/?$/, '/')
  return base
}

export function hasPortalEntryMarker(): boolean {
  try {
    return sessionStorage.getItem(PORTAL_ENTRY_KEY) === '1'
  } catch {
    return false
  }
}

export function markPortalEntry(): void {
  try {
    sessionStorage.setItem(PORTAL_ENTRY_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function clearPortalEntryMarker(): void {
  try {
    sessionStorage.removeItem(PORTAL_ENTRY_KEY)
  } catch {
    /* ignore */
  }
}

function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local')
}

export function allowsDirectAccessWithoutPortal(loc: Location = window.location): boolean {
  try {
    const params = new URLSearchParams(loc.search || '')
    if (params.get('stay') === '1' || params.get('portal') === '0') return true
  } catch {
    /* ignore */
  }
  if (String(import.meta.env.VITE_ALLOW_DIRECT_ACCESS || '').trim() === '1') return true
  if (typeof window !== 'undefined' && isLocalHost(loc.hostname)) return true
  return false
}

function allowStayWithoutSso(loc: Location = window.location): boolean {
  return allowsDirectAccessWithoutPortal(loc)
}

/**
 * Se o usuário abriu Light/Plus direto (sem SSO e sem sessão vinda do portal),
 * redireciona para o Pro. Retorna true se redirecionou.
 */
export function redirectDirectAccessToProPortal(opts?: {
  hasSsoToken?: boolean
}): boolean {
  if (typeof window === 'undefined') return false
  if (opts?.hasSsoToken) return false
  if (hasPortalEntryMarker()) return false
  if (allowStayWithoutSso()) return false
  const target = getProPortalUrl()
  try {
    const here = window.location.href
    if (here.startsWith(target.replace(/\/?$/, ''))) return false
  } catch {
    /* ignore */
  }
  window.location.replace(getProPortalUrl())
  return true
}

export function goToProPortal(sair = false): void {
  const base = getProPortalUrl().replace(/\/?$/, '/')
  window.location.assign(sair ? `${base}?sair=1` : base)
}
