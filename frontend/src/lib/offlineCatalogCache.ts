export type CachedProductOption = {
  id: string
  codigo: string
  descricao: string
  unidade_medida: string | null
  data_fabricacao?: string | null
  data_validade?: string | null
  ean?: string | null
  dun?: string | null
}

const PRODUCTS_CACHE_KEY = 'contagem-offline-products-cache-v1'
const CONFERENTES_CACHE_KEY = 'contagem-offline-conferentes-cache-v1'
const PRODUCT_LIST_CACHE_PREFIX = 'contagem-offline-product-list-v1:'

export type CachedConferente = { id: string; nome: string }

export function saveProductOptionsCache(products: CachedProductOption[]): void {
  try {
    if (!products.length) return
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products))
  } catch {
    /* quota */
  }
}

export function loadProductOptionsCache(): CachedProductOption[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CachedProductOption[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveConferentesCache(conferentes: CachedConferente[]): void {
  try {
    if (!conferentes.length) return
    localStorage.setItem(CONFERENTES_CACHE_KEY, JSON.stringify(conferentes))
  } catch {
    /* quota */
  }
}

export function loadConferentesCache(): CachedConferente[] {
  try {
    const raw = localStorage.getItem(CONFERENTES_CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CachedConferente[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveProductListCache(listaId: string, products: CachedProductOption[]): void {
  try {
    if (!listaId || !products.length) return
    localStorage.setItem(`${PRODUCT_LIST_CACHE_PREFIX}${listaId}`, JSON.stringify(products))
  } catch {
    /* quota */
  }
}

export function loadProductListCache(listaId: string): CachedProductOption[] {
  try {
    if (!listaId) return []
    const raw = localStorage.getItem(`${PRODUCT_LIST_CACHE_PREFIX}${listaId}`)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CachedProductOption[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function offlineCatalogStats(): { produtos: number; conferentes: number } {
  return {
    produtos: loadProductOptionsCache().length,
    conferentes: loadConferentesCache().length,
  }
}
