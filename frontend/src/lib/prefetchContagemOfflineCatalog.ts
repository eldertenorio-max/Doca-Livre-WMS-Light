import { listConferentes } from './conferentesStore'
import {
  loadProductOptionsCache,
  saveConferentesCache,
  saveProductListCache,
  saveProductOptionsCache,
  type CachedProductOption,
} from './offlineCatalogCache'
import { mapRowToProductOption, TABELA_PRODUTOS } from './productOptionMapper'
import { getProdutoLista, produtoListaParaProductOptions } from './produtoListaSupabase'
import { supabase } from './supabaseClient'

export type PrefetchOfflineCatalogResult = {
  produtos: number
  conferentes: number
}

/** Baixa produtos e conferentes para uso offline (câmara fria sem internet). */
export async function prefetchContagemOfflineCatalog(): Promise<PrefetchOfflineCatalogResult> {
  const { data, error } = await supabase.from(TABELA_PRODUTOS).select('*').limit(15000)
  if (error) throw error

  const byCode = new Map<string, CachedProductOption>()
  for (const row of data ?? []) {
    const p = mapRowToProductOption(row as Record<string, unknown>)
    if (!p) continue
    const k = p.codigo.trim()
    if (!byCode.has(k)) {
      byCode.set(k, {
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        unidade_medida: p.unidade_medida,
        data_fabricacao: p.data_fabricacao,
        data_validade: p.data_validade,
        ean: p.ean,
        dun: p.dun,
      })
    }
  }
  const produtos = Array.from(byCode.values())
  if (produtos.length) saveProductOptionsCache(produtos)

  const conferentes = await listConferentes()
  if (conferentes.length) saveConferentesCache(conferentes)

  return {
    produtos: produtos.length || loadProductOptionsCache().length,
    conferentes: conferentes.length,
  }
}

export async function prefetchProdutoListaOffline(listaId: string): Promise<number> {
  const lista = await getProdutoLista(listaId)
  if (!lista) return 0
  const options = produtoListaParaProductOptions(lista)
  const cached: CachedProductOption[] = options.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    unidade_medida: p.unidade_medida,
    data_fabricacao: p.data_fabricacao,
    data_validade: p.data_validade,
    ean: p.ean,
    dun: p.dun,
  }))
  saveProductListCache(listaId, cached)
  return cached.length
}
