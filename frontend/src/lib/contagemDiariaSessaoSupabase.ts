import type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'
import { isSupabaseConfigured, supabase } from './supabaseClient'
import { formatUnknownError } from './supabaseError'

const TABELA = 'contagem_diaria_sessoes'

type DbRow = {
  id: string
  numero: number
  titulo: string
  local: string
  data_contagem: string
  conferente_nome: string | null
  data_inicio: string
  data_fim: string | null
  status: 'aberto' | 'fechado'
  iniciada: boolean
  created_at: string
  updated_at: string
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
    dataInicio: r.data_inicio,
    dataFim: r.data_fim,
    status: r.status,
    iniciada: Boolean(r.iniciada),
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
    data_inicio: s.dataInicio,
    data_fim: s.dataFim,
    status: s.status,
    iniciada: Boolean(s.iniciada),
    created_at: s.createdAt || now,
    updated_at: s.updatedAt || now,
  }
}

export async function fetchContagemDiariaSessoesSupabase(): Promise<ContagemDiariaSessao[]> {
  if (!contagemDiariaSyncHabilitado()) return []
  const { data, error } = await supabase
    .from(TABELA)
    .select(
      'id,numero,titulo,local,data_contagem,conferente_nome,data_inicio,data_fim,status,iniciada,created_at,updated_at',
    )
    .order('numero', { ascending: false })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao buscar contagens no banco.')
  return (data as DbRow[] | null)?.map(rowToSessao) ?? []
}

export async function fetchContagemDiariaSessaoByIdSupabase(id: string): Promise<ContagemDiariaSessao | null> {
  if (!contagemDiariaSyncHabilitado()) return null
  const { data, error } = await supabase
    .from(TABELA)
    .select(
      'id,numero,titulo,local,data_contagem,conferente_nome,data_inicio,data_fim,status,iniciada,created_at,updated_at',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao buscar contagem no banco.')
  return data ? rowToSessao(data as DbRow) : null
}

export async function upsertContagemDiariaSessaoSupabase(sessao: ContagemDiariaSessao): Promise<void> {
  if (!contagemDiariaSyncHabilitado()) return
  const { error } = await supabase.from(TABELA).upsert(sessaoToRow(sessao), { onConflict: 'id' })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar contagem no banco.')
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
