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
import { isTableMissingError } from './supabaseError'
import { isSupabaseTableAvailable, resetSupabaseTableProbe } from './supabaseTableProbe'

const LEGACY_STORAGE_KEY = 'contagem-diaria-sessoes-v1'
const TABELA_CD = 'contagem_diaria_sessoes'

let legacyMigrationPromise: Promise<void> | null = null

function readLegacyLocal(): ContagemDiariaSessao[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizeLegacyContagem(item as Record<string, unknown>))
  } catch {
    return []
  }
}

function writeLegacyLocal(list: ContagemDiariaSessao[]): void {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

function sortContagens(list: ContagemDiariaSessao[]): ContagemDiariaSessao[] {
  return [...list].sort((a, b) => b.numero - a.numero)
}

function proximoNumeroLocal(): number {
  const legacy = readLegacyLocal()
  if (!legacy.length) return 1
  return Math.max(...legacy.map((l) => l.numero)) + 1
}

async function usarSupabaseSessoes(): Promise<boolean> {
  if (!contagemDiariaSyncHabilitado()) return false
  return isSupabaseTableAvailable(TABELA_CD)
}

export function resetContagemDiariaSupabaseProbe(): void {
  resetSupabaseTableProbe(TABELA_CD)
}

export async function contagemDiariaUsaArmazenamentoLocal(): Promise<boolean> {
  return !(await usarSupabaseSessoes())
}

function normalizeLegacyContagem(raw: Record<string, unknown>): ContagemDiariaSessao {
  const createdAt = String(raw.createdAt ?? raw.dataInicio ?? new Date().toISOString())
  const dataContagemRaw = String(raw.dataContagem ?? '').slice(0, 10)
  const dataContagem = /^\d{4}-\d{2}-\d{2}$/.test(dataContagemRaw) ? dataContagemRaw : todayYmdLocal()
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    numero: typeof raw.numero === 'number' && Number.isFinite(raw.numero) ? raw.numero : 1,
    titulo: String(raw.titulo ?? 'Contagem diária'),
    local: String(raw.local ?? 'ULTRAPAO GUARULHOS DISTRI'),
    dataContagem,
    conferenteNome: raw.conferenteNome ? String(raw.conferenteNome) : undefined,
    dataInicio: String(raw.dataInicio ?? createdAt),
    dataFim: raw.dataFim ? String(raw.dataFim) : null,
    status: raw.status === 'fechado' ? 'fechado' : 'aberto',
    iniciada: Boolean(raw.iniciada),
    createdAt,
    updatedAt: String(raw.updatedAt ?? createdAt),
  }
}

async function migrateLegacyContagensToSupabase(): Promise<void> {
  if (!(await usarSupabaseSessoes())) return
  const legacy = readLegacyLocal()
  if (!legacy.length) return
  for (const sessao of legacy) {
    await upsertContagemDiariaSessaoSupabase(sessao)
  }
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

async function ensureLegacyContagensMigrated(): Promise<void> {
  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyContagensToSupabase().catch((e) => {
      legacyMigrationPromise = null
      throw e
    })
  }
  await legacyMigrationPromise
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
  if (isTableMissingError(e, 'contagem_diaria_sessoes')) {
    return new Error(
      'Tabela contagem_diaria_sessoes não existe no Supabase. No SQL Editor, execute supabase/sql/setup_inventario_listas_completo.sql (ou create_contagem_diaria_sessoes.sql).',
    )
  }
  return e instanceof Error ? e : new Error(fallback)
}

function withUpdatedAt(sessao: ContagemDiariaSessao): ContagemDiariaSessao {
  return { ...sessao, updatedAt: new Date().toISOString() }
}

export async function listContagensDiarias(): Promise<ContagemDiariaSessao[]> {
  requireSupabase()
  if (!(await usarSupabaseSessoes())) {
    return sortContagens(readLegacyLocal())
  }
  try {
    await ensureLegacyContagensMigrated()
    return await fetchContagemDiariaSessoesSupabase()
  } catch (e) {
    const legacy = readLegacyLocal()
    if (legacy.length) {
      return sortContagens(legacy)
    }
    throw wrapDbError(e, 'Erro ao listar contagens.')
  }
}

export async function getContagemDiaria(id: string): Promise<ContagemDiariaSessao | null> {
  requireSupabase()
  if (!(await usarSupabaseSessoes())) {
    return readLegacyLocal().find((l) => l.id === id) ?? null
  }
  try {
    await ensureLegacyContagensMigrated()
    return await fetchContagemDiariaSessaoByIdSupabase(id)
  } catch (e) {
    const local = readLegacyLocal().find((l) => l.id === id)
    if (local) return local
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
  const numero = (await usarSupabaseSessoes())
    ? await fetchProximoNumeroContagemDiariaSupabase()
    : proximoNumeroLocal()
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
  if (await usarSupabaseSessoes()) {
    await upsertContagemDiariaSessaoSupabase(row)
  } else {
    const list = readLegacyLocal()
    list.push(row)
    writeLegacyLocal(list)
  }
  return row
}

export async function saveContagemDiaria(sessao: ContagemDiariaSessao): Promise<void> {
  requireSupabase()
  const row = withUpdatedAt(sessao)
  if (await usarSupabaseSessoes()) {
    await upsertContagemDiariaSessaoSupabase(row)
    return
  }
  const list = readLegacyLocal()
  const idx = list.findIndex((l) => l.id === row.id)
  if (idx >= 0) list[idx] = row
  else list.push(row)
  writeLegacyLocal(list)
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
  if (await usarSupabaseSessoes()) {
    await deleteContagemDiariaSessaoSupabase(id)
  } else {
    writeLegacyLocal(readLegacyLocal().filter((l) => l.id !== id))
  }
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
