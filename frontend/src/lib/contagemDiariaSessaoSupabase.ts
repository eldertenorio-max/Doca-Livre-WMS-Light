import type { ContagemDiariaLinhaCaptura } from './contagemDiariaLinhaTypes'
import type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import { formatUnknownError, isColumnMissingError } from './supabaseError'

const TABELA = 'contagem_diaria_sessoes'

type DbRow = {
  id: string
  numero: number
  titulo: string
  local: string
  data_contagem: string
  conferente_nome: string | null
  lista_produtos_id: string | null
  lista_produtos_nome: string | null
  data_inicio: string
  data_fim: string | null
  status: 'aberto' | 'fechado'
  iniciada: boolean
  linhas: ContagemDiariaLinhaCaptura[] | null
  created_at: string
  updated_at: string
}

export type UpsertContagemDiariaResult = {
  /** `false` quando a coluna `linhas` não existe ou não aceitou o JSON — use overlay local. */
  linhasNoBanco: boolean
}

export function contagemDiariaSyncHabilitado(): boolean {
  return isSupabaseConfigured()
}

function rowToSessao(r: DbRow): ContagemDiariaSessao {
  return {
    id: r.id,
    numero: r.numero,
    titulo: r.titulo,
    local: r.local,
    dataContagem: String(r.data_contagem).slice(0, 10),
    conferenteNome: r.conferente_nome?.trim() || undefined,
    listaProdutosId: r.lista_produtos_id ?? undefined,
    listaProdutosNome: r.lista_produtos_nome?.trim() || undefined,
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    status: r.status,
    iniciada: Boolean(r.iniciada),
    linhas: Array.isArray(r.linhas) ? r.linhas : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function sessaoToRow(s: ContagemDiariaSessao): DbRow {
  const now = new Date().toISOString()
  return {
    id: s.id,
    numero: s.numero,
    titulo: s.titulo,
    local: s.local,
    data_contagem: s.dataContagem,
    conferente_nome: s.conferenteNome?.trim() || null,
    lista_produtos_id: s.listaProdutosId ?? null,
    lista_produtos_nome: s.listaProdutosNome?.trim() || null,
    data_inicio: s.dataInicio,
    data_fim: s.dataFim,
    status: s.status,
    iniciada: Boolean(s.iniciada),
    linhas: s.linhas ?? [],
    created_at: s.createdAt || now,
    updated_at: s.updatedAt || now,
  }
}

const SELECT_CORE =
  'id,numero,titulo,local,data_contagem,conferente_nome,data_inicio,data_fim,status,iniciada,created_at,updated_at'
const SELECT_LISTA = 'lista_produtos_id,lista_produtos_nome'
const SELECT_COLS_CANDIDATES = [
  `${SELECT_CORE},${SELECT_LISTA},linhas`,
  `${SELECT_CORE},linhas`,
  `${SELECT_CORE},${SELECT_LISTA}`,
  SELECT_CORE,
]

/** Evita repetir SELECTs que falham com 400 quando colunas opcionais não existem. */
let selectColsCache: string | null = null
let linhasColumnDisponivel: boolean | null = null

function selectIncluiLinhas(cols: string): boolean {
  return cols.split(',').includes('linhas')
}

async function queryContagemSessoes(id?: string): Promise<DbRow[] | DbRow | null> {
  const candidates = selectColsCache
    ? [selectColsCache, ...SELECT_COLS_CANDIDATES.filter((c) => c !== selectColsCache)]
    : SELECT_COLS_CANDIDATES

  let lastError: unknown = null
  for (const cols of candidates) {
    const res = id
      ? await supabase.from(TABELA).select(cols).eq('id', id).maybeSingle()
      : await supabase.from(TABELA).select(cols).order('numero', { ascending: false })
    if (!res.error) {
      selectColsCache = cols
      linhasColumnDisponivel = selectIncluiLinhas(cols)
      return (res.data as DbRow[] | DbRow | null) ?? (id ? null : [])
    }
    lastError = res.error
    if (!isColumnMissingError(res.error)) break
  }
  throw new Error(formatUnknownError(lastError) || 'Erro ao buscar contagens no banco.')
}

export async function fetchContagemDiariaSessoesSupabase(): Promise<ContagemDiariaSessao[]> {
  if (!contagemDiariaSyncHabilitado()) return []
  const data = await queryContagemSessoes()
  return Array.isArray(data) ? data.map(rowToSessao) : []
}

export async function fetchContagemDiariaSessaoByIdSupabase(id: string): Promise<ContagemDiariaSessao | null> {
  if (!contagemDiariaSyncHabilitado()) return null
  const data = await queryContagemSessoes(id)
  return data && !Array.isArray(data) ? rowToSessao(data as DbRow) : null
}

async function upsertRow(payload: Record<string, unknown>): Promise<{ error: unknown | null }> {
  const { error } = await supabase.from(TABELA).upsert(payload, { onConflict: 'id' })
  return { error }
}

export async function upsertContagemDiariaSessaoSupabase(
  sessao: ContagemDiariaSessao,
): Promise<UpsertContagemDiariaResult> {
  if (!contagemDiariaSyncHabilitado()) return { linhasNoBanco: true }
  const row = sessaoToRow(sessao)
  const temLinhas = (sessao.linhas?.length ?? 0) > 0

  if (linhasColumnDisponivel === false) {
    const { lista_produtos_id: _a, lista_produtos_nome: _b, linhas: _c, ...semOpcionais } = row
    let { error } = await upsertRow(semOpcionais)
    if (error && isColumnMissingError(error)) {
      const { lista_produtos_id: _d, lista_produtos_nome: _e, ...legacy } = row
      const res = await upsertRow({ ...legacy, linhas: undefined })
      error = res.error
    }
    if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar contagem no banco.')
    return { linhasNoBanco: false }
  }

  let { error } = await upsertRow(row as unknown as Record<string, unknown>)
  if (error && isColumnMissingError(error)) {
    const { lista_produtos_id: _a, lista_produtos_nome: _b, ...semLista } = row
    const res = await upsertRow(semLista as unknown as Record<string, unknown>)
    error = res.error
  }
  if (error && isColumnMissingError(error)) {
    const { linhas: _c, lista_produtos_id: _a, lista_produtos_nome: _b, ...legacyRow } = row
    linhasColumnDisponivel = false
    if (selectColsCache && selectIncluiLinhas(selectColsCache)) {
      selectColsCache = SELECT_COLS_CANDIDATES.find((c) => !selectIncluiLinhas(c)) ?? SELECT_CORE
    }
    const res = await upsertRow(legacyRow as unknown as Record<string, unknown>)
    error = res.error
    if (!error) return { linhasNoBanco: temLinhas ? false : true }
  }
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar contagem no banco.')
  linhasColumnDisponivel = true
  return { linhasNoBanco: true }
}

export async function deleteContagemDiariaSessaoSupabase(id: string): Promise<void> {
  if (!contagemDiariaSyncHabilitado()) return
  const { error } = await supabase.from(TABELA).delete().eq('id', id)
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao excluir contagem no banco.')
}

export async function fetchProximoNumeroContagemDiariaSupabase(): Promise<number> {
  if (!contagemDiariaSyncHabilitado()) return 1
  const { data, error } = await supabase.from(TABELA).select('numero').order('numero', { ascending: false }).limit(1)
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao obter número da contagem.')
  const max = data?.[0]?.numero
  if (typeof max === 'number' && Number.isFinite(max)) return max + 1
  return 1
}
