import type { InventarioLinhaCaptura, InventarioSessao } from './inventarioSessaoTypes'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import { formatUnknownError } from './supabaseError'

const TABELA = 'inventario_sessoes'

type DbRow = {
  id: string
  numero: number
  titulo: string
  local: string
  posicoes_nome: string | null
  posicoes_codigos: string[] | null
  catalogo_produtos: string | null
  lista_enderecamento_id: string | null
  lista_enderecamento_nome: string | null
  lista_produtos_id: string | null
  lista_produtos_nome: string | null
  data_inicio: string
  data_fim: string | null
  status: 'aberto' | 'fechado'
  linhas: InventarioLinhaCaptura[] | null
  created_at: string
  updated_at: string
}

export function inventarioSyncHabilitado(): boolean {
  return isSupabaseConfigured()
}

function rowToSessao(r: DbRow): InventarioSessao {
  return {
    id: r.id,
    numero: r.numero,
    titulo: r.titulo,
    local: r.local,
    posicoesNome: r.posicoes_nome?.trim() || undefined,
    posicoesCodigos: Array.isArray(r.posicoes_codigos) && r.posicoes_codigos.length ? [...r.posicoes_codigos] : undefined,
    catalogoProdutos: r.catalogo_produtos === 'ultrapao' ? 'ultrapao' : undefined,
    listaEnderecamentoId: r.lista_enderecamento_id ?? undefined,
    listaEnderecamentoNome: r.lista_enderecamento_nome?.trim() || undefined,
    listaProdutosId: r.lista_produtos_id ?? undefined,
    listaProdutosNome: r.lista_produtos_nome?.trim() || undefined,
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    status: r.status,
    linhas: Array.isArray(r.linhas) ? r.linhas : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function sessaoToRow(s: InventarioSessao): DbRow {
  const now = new Date().toISOString()
  return {
    id: s.id,
    numero: s.numero,
    titulo: s.titulo,
    local: s.local,
    posicoes_nome: s.posicoesNome?.trim() || null,
    posicoes_codigos: s.posicoesCodigos?.length ? s.posicoesCodigos : null,
    catalogo_produtos: s.catalogoProdutos ?? 'ultrapao',
    lista_enderecamento_id: s.listaEnderecamentoId ?? null,
    lista_enderecamento_nome: s.listaEnderecamentoNome?.trim() || null,
    lista_produtos_id: s.listaProdutosId ?? null,
    lista_produtos_nome: s.listaProdutosNome?.trim() || null,
    data_inicio: s.dataInicio,
    data_fim: s.dataFim,
    status: s.status,
    linhas: s.linhas ?? [],
    created_at: s.createdAt || now,
    updated_at: s.updatedAt || now,
  }
}

export async function fetchInventarioSessoesSupabase(): Promise<InventarioSessao[]> {
  if (!inventarioSyncHabilitado()) return []
  const { data, error } = await supabase
    .from(TABELA)
    .select(
      'id,numero,titulo,local,posicoes_nome,posicoes_codigos,catalogo_produtos,lista_enderecamento_id,lista_enderecamento_nome,lista_produtos_id,lista_produtos_nome,data_inicio,data_fim,status,linhas,created_at,updated_at',
    )
    .order('numero', { ascending: false })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao buscar inventários no banco.')
  return (data as DbRow[] | null)?.map(rowToSessao) ?? []
}

export async function fetchInventarioSessaoByIdSupabase(id: string): Promise<InventarioSessao | null> {
  if (!inventarioSyncHabilitado()) return null
  const { data, error } = await supabase
    .from(TABELA)
    .select(
      'id,numero,titulo,local,posicoes_nome,posicoes_codigos,catalogo_produtos,lista_enderecamento_id,lista_enderecamento_nome,lista_produtos_id,lista_produtos_nome,data_inicio,data_fim,status,linhas,created_at,updated_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao buscar inventário no banco.')
  return data ? rowToSessao(data as DbRow) : null
}

export async function upsertInventarioSessaoSupabase(sessao: InventarioSessao): Promise<void> {
  if (!inventarioSyncHabilitado()) return
  const row = sessaoToRow(sessao)
  const { error } = await supabase.from(TABELA).upsert(row, { onConflict: 'id' })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar inventário no banco.')
}

export async function deleteInventarioSessaoSupabase(id: string): Promise<void> {
  if (!inventarioSyncHabilitado()) return
  const { error } = await supabase.from(TABELA).delete().eq('id', id)
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao excluir inventário no banco.')
}

export async function fetchProximoNumeroInventarioSupabase(): Promise<number | null> {
  if (!inventarioSyncHabilitado()) return null
  const { data, error } = await supabase.from(TABELA).select('numero').order('numero', { ascending: false }).limit(1)
  if (error) {
    if (import.meta.env.DEV) console.warn('[inventario_sessoes] max numero', error)
    return null
  }
  const max = data?.[0]?.numero
  if (typeof max === 'number' && Number.isFinite(max)) return max + 1
  return 1
}
