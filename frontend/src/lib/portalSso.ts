/** Lê e limpa token SSO vindo do portal WMS Pro (?sso= / ?token=). */

export function readPortalSsoTokenFromLocation(loc: Location = window.location): string | null {
  try {
    const params = new URLSearchParams(loc.search || '')
    const token = (params.get('sso') || params.get('token') || '').trim()
    return token || null
  } catch {
    return null
  }
}

export function clearPortalSsoTokenFromUrl(): void {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('sso') && !url.searchParams.has('token')) return
    url.searchParams.delete('sso')
    url.searchParams.delete('token')
    const next = `${url.pathname}${url.search}${url.hash}`
    window.history.replaceState({}, document.title, next || '/')
  } catch {
    /* ignore */
  }
}
