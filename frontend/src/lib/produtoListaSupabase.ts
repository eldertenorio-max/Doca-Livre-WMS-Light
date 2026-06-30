import { mapRowToProductOption, TABELA_PRODUTOS, type ProductOption } from './productOptionMapper'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import { formatUnknownError } from './supabaseError'

const TABELA = 'produto_listas'
export const LISTA_PRODUTO_PADRAO_NOME = 'CD Ultrapao guarulhos'

export type ProdutoListaItem = {
  codigo_interno: string
  descricao: string
  unidade?: string | null
  ean?: string | null
  dun?: string | null
}

export type ProdutoLista = {
  id: string
  nome: string
  produtos: ProdutoListaItem[]
  createdAt: string
  updatedAt: string
}

type DbRow = {
  id: string
  nome: string
  produtos: ProdutoListaItem[] | null
  created_at: string
  updated_at: string
}

function rowToLista(r: DbRow): ProdutoLista {
  return {
    id: r.id,
    nome: r.nome,
    produtos: Array.isArray(r.produtos) ? r.produtos : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function produtoListasHabilitado(): boolean {
  return isSupabaseConfigured()
}

export async function listProdutoListas(): Promise<ProdutoLista[]> {
  if (!produtoListasHabilitado()) return []
  const { data, error } = await supabase
    .from(TABELA)
    .select('id,nome,produtos,created_at,updated_at')
    .order('nome', { ascending: true })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao listar catálogos de produtos.')
  return (data as DbRow[] | null)?.map(rowToLista) ?? []
}

export async function getProdutoLista(id: string): Promise<ProdutoLista | null> {
  if (!produtoListasHabilitado()) return null
  const { data, error } = await supabase
    .from(TABELA)
    .select('id,nome,produtos,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao carregar lista de produtos.')
  return data ? rowToLista(data as DbRow) : null
}

export async function saveProdutoLista(lista: ProdutoLista): Promise<ProdutoLista> {
  if (!produtoListasHabilitado()) throw new Error('Supabase não configurado.')
  const now = new Date().toISOString()
  const row = {
    id: lista.id,
    nome: lista.nome.trim(),
    produtos: lista.produtos ?? [],
    created_at: lista.createdAt || now,
    updated_at: now,
  }
  const { data, error } = await supabase.from(TABELA).upsert(row, { onConflict: 'id' }).select().single()
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar lista de produtos.')
  return rowToLista(data as DbRow)
}

export async function createProdutoLista(nome: string, produtos: ProdutoListaItem[] = []): Promise<ProdutoLista> {
  const now = new Date().toISOString()
  return saveProdutoLista({
    id: crypto.randomUUID(),
    nome: nome.trim(),
    produtos,
    createdAt: now,
    updatedAt: now,
  })
}

export async function deleteProdutoLista(id: string): Promise<void> {
  if (!produtoListasHabilitado()) return
  const { error } = await supabase.from(TABELA).delete().eq('id', id)
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao excluir lista de produtos.')
}

/** Inclui ou atualiza um produto na lista salva (por código interno). */
export async function upsertProdutoNaListaSalva(
  listaId: string,
  produto: ProdutoListaItem,
): Promise<ProdutoLista | null> {
  const codigo = produto.codigo_interno.trim()
  if (!codigo) return null
  const lista = await getProdutoLista(listaId)
  if (!lista) return null

  const item: ProdutoListaItem = {
    codigo_interno: codigo,
    descricao: produto.descricao.trim(),
    unidade: produto.unidade ?? null,
    ean: produto.ean ?? null,
    dun: produto.dun ?? null,
  }

  const produtos = [...lista.produtos]
  const idx = produtos.findIndex((p) => p.codigo_interno.trim() === codigo)
  if (idx >= 0) {
    produtos[idx] = { ...produtos[idx], ...item }
  } else {
    produtos.push(item)
  }
  produtos.sort((a, b) => a.codigo_interno.localeCompare(b.codigo_interno, 'pt-BR'))

  return saveProdutoLista({ ...lista, produtos })
}

export async function sincronizarProdutoNasListas(
  produto: ProdutoListaItem,
  listaIds: Iterable<string>,
): Promise<string[]> {
  const atualizadas: string[] = []
  const vistos = new Set<string>()
  for (const id of listaIds) {
    const trimmed = id.trim()
    if (!trimmed || vistos.has(trimmed)) continue
    vistos.add(trimmed)
    const saved = await upsertProdutoNaListaSalva(trimmed, produto)
    if (saved) atualizadas.push(saved.id)
  }
  return atualizadas
}

export async function fetchTodosProdutosParaLista(): Promise<ProdutoListaItem[]> {
  const { data, error } = await supabase.from(TABELA_PRODUTOS).select('*').order('codigo_interno').limit(20000)
  if (error) throw new Error(formatUnknownError(error) || `Erro ao ler ${TABELA_PRODUTOS}.`)
  const out: ProdutoListaItem[] = []
  for (const row of data ?? []) {
    const opt = mapRowToProductOption(row as Record<string, unknown>)
    if (!opt) continue
    out.push({
      codigo_interno: opt.codigo,
      descricao: opt.descricao,
      unidade: opt.unidade_medida,
      ean: opt.ean ?? null,
      dun: opt.dun ?? null,
    })
  }
  return out
}

/** Cria lista padrão com todos os produtos de «Todos os Produtos» se ainda não existir. */
export async function ensureProdutoListaPadrao(): Promise<ProdutoLista> {
  const listas = await listProdutoListas()
  const existente = listas.find((l) => l.nome.toLowerCase() === LISTA_PRODUTO_PADRAO_NOME.toLowerCase())
  if (existente) return existente
  const produtos = await fetchTodosProdutosParaLista()
  return createProdutoLista(LISTA_PRODUTO_PADRAO_NOME, produtos)
}

export function produtoListaParaProductOptions(lista: ProdutoLista): ProductOption[] {
  return lista.produtos.map((p, i) => ({
    id: `${lista.id}:${p.codigo_interno}:${i}`,
    codigo: p.codigo_interno,
    descricao: p.descricao,
    unidade_medida: p.unidade ?? null,
    ean: p.ean ?? null,
    dun: p.dun ?? null,
  }))
}
