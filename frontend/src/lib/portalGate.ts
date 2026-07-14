/** Acesso direto (sem SSO) redireciona ao portal público no Plus. */

const PORTAL_ENTRY_KEY = 'doca_portal_entry_v1'
const DEFAULT_PORTAL_URL = 'https://wms.docalivre.com.br/'

export function getPublicPortalUrl(): string {
  const fromEnv =
    (import.meta.env.VITE_PORTAL_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_WMS_PLUS_URL as string | undefined)?.trim()
  return (fromEnv || DEFAULT_PORTAL_URL).replace(/\/?$/, '/')
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

export function redirectDirectAccessToProPortal(opts?: { hasSsoToken?: boolean }): boolean {
  // Nome legado: agora redireciona ao portal Plus (domínio custom).
  if (typeof window === 'undefined') return false
  if (opts?.hasSsoToken) return false
  if (hasPortalEntryMarker()) return false
  if (allowsDirectAccessWithoutPortal()) return false
  window.location.replace(getPublicPortalUrl())
  return true
}

export function goToProPortal(sair = false): void {
  const base = getPublicPortalUrl()
  window.location.assign(sair ? `${base}?sair=1` : base)
}
