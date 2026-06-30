import {
  contagemDiariaSyncHabilitado,
  deleteContagemDiariaSessaoSupabase,
  fetchContagemDiariaSessaoByIdSupabase,
  fetchContagemDiariaSessoesSupabase,
  fetchProximoNumeroContagemDiariaSupabase,
  upsertContagemDiariaSessaoSupabase,
} from './contagemDiariaSessaoSupabase'

export type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'
import type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'

const LEGACY_STORAGE_KEY = 'contagem-diaria-sessoes-v1'

try {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  /* ignore */
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function requireSupabase(): void {
  if (!contagemDiariaSyncHabilitado()) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

function wrapDbError(e: unknown, fallback: string): Error {
  const msg = e instanceof Error ? e.message : fallback
  if (/relation.*does not exist|42P01/i.test(msg)) {
    return new Error(
      'Tabela contagem_diaria_sessoes não existe no Supabase. Execute supabase/sql/create_contagem_diaria_sessoes.sql.',
    )
  }
  return e instanceof Error ? e : new Error(fallback)
}

function withUpdatedAt(sessao: ContagemDiariaSessao): ContagemDiariaSessao {
  return { ...sessao, updatedAt: new Date().toISOString() }
}

export async function listContagensDiarias(): Promise<ContagemDiariaSessao[]> {
  requireSupabase()
  try {
    return await fetchContagemDiariaSessoesSupabase()
  } catch (e) {
    throw wrapDbError(e, 'Erro ao listar contagens.')
  }
}

export async function getContagemDiaria(id: string): Promise<ContagemDiariaSessao | null> {
  requireSupabase()
  try {
    return await fetchContagemDiariaSessaoByIdSupabase(id)
  } catch (e) {
    throw wrapDbError(e, 'Erro ao carregar contagem.')
  }
}

export async function criarContagemDiaria(opts?: {
  titulo?: string
  local?: string
  dataContagem?: string
  conferenteNome?: string
}): Promise<ContagemDiariaSessao> {
  requireSupabase()
  const numero = await fetchProximoNumeroContagemDiariaSupabase()
  const now = new Date().toISOString()
  const dataContagem = opts?.dataContagem?.trim() || todayYmdLocal()
  const row: ContagemDiariaSessao = {
    id: crypto.randomUUID(),
    numero,
    titulo: opts?.titulo?.trim() || `Contagem diária #${numero}`,
    local: opts?.local?.trim() || 'ULTRAPAO GUARULHOS DISTRI',
    dataContagem,
    conferenteNome: opts?.conferenteNome?.trim() || undefined,
    dataInicio: now,
    dataFim: null,
    status: 'aberto',
    iniciada: false,
    createdAt: now,
    updatedAt: now,
  }
  await upsertContagemDiariaSessaoSupabase(row)
  return row
}

export async function saveContagemDiaria(sessao: ContagemDiariaSessao): Promise<void> {
  requireSupabase()
  await upsertContagemDiariaSessaoSupabase(withUpdatedAt(sessao))
}

export async function marcarContagemIniciada(id: string): Promise<void> {
  const sessao = await getContagemDiaria(id)
  if (!sessao || sessao.iniciada) return
  sessao.iniciada = true
  await saveContagemDiaria(sessao)
}

export async function fecharContagemDiaria(id: string): Promise<void> {
  const sessao = await getContagemDiaria(id)
  if (!sessao) return
  sessao.status = 'fechado'
  sessao.dataFim = new Date().toISOString()
  await saveContagemDiaria(sessao)
}

export async function reabrirContagemDiaria(id: string): Promise<ContagemDiariaSessao | null> {
  const sessao = await getContagemDiaria(id)
  if (!sessao) return null
  sessao.status = 'aberto'
  sessao.dataFim = null
  await saveContagemDiaria(sessao)
  return sessao
}

export async function deleteContagemDiaria(id: string): Promise<boolean> {
  requireSupabase()
  const sessao = await getContagemDiaria(id)
  if (!sessao) return false
  await deleteContagemDiariaSessaoSupabase(id)
  return true
}

export async function atualizarContagemDiariaMeta(
  id: string,
  patch: { titulo?: string; local?: string; dataContagem?: string },
): Promise<ContagemDiariaSessao | null> {
  const sessao = await getContagemDiaria(id)
  if (!sessao) return null
  if (patch.titulo !== undefined) {
    const t = patch.titulo.trim()
    if (t) sessao.titulo = t
  }
  if (patch.local !== undefined) {
    const l = patch.local.trim()
    if (l) sessao.local = l
  }
  if (patch.dataContagem !== undefined) {
    const d = patch.dataContagem.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) sessao.dataContagem = d
  }
  await saveContagemDiaria(sessao)
  return sessao
}

export function formatDataContagemBR(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(ymd)
  if (!m) return ymd
  return `${m[3]}/${m[2]}/${m[1]}`
}

export { contagemDiariaSyncHabilitado } from './contagemDiariaSessaoSupabase'
