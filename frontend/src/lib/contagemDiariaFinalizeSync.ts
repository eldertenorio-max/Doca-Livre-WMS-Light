import { conferenteIdParaBanco, listConferentes, resolveConferenteIdPorNome, type Conferente } from './conferentesStore'
import { TABLE_CONTAGEM_DIARIA } from './contagensDb'
import type { ContagemDiariaLinhaCaptura } from './contagemDiariaLinhaTypes'
import {
  contagemDiariaSyncHabilitado,
  fetchContagemDiariaSessoesSupabase,
} from './contagemDiariaSessaoSupabase'
import type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'
import { supabase } from './supabaseClient'

function resolveConferenteId(nome: string | undefined, conferentes: Conferente[]): string | null {
  return resolveConferenteIdPorNome(nome, conferentes)
}

function parseUpAdicional(raw: string | undefined): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function linhaToPayload(
  sessao: ContagemDiariaSessao,
  linha: ContagemDiariaLinhaCaptura,
  conferentes: Conferente[],
): Record<string, unknown> {
  const df = String(linha.fabricacao ?? '').trim()
  const dv = String(linha.validade ?? '').trim()
  const end = String(linha.endereco ?? '').trim()
  const obsBase = `Contagem #${sessao.numero}${sessao.titulo ? ` — ${sessao.titulo}` : ''}${end ? ` · ${end}` : ''}`
  return {
    data_contagem: sessao.dataContagem,
    data_hora_contagem: linha.createdAt || sessao.dataFim || new Date().toISOString(),
    conferente_id: resolveConferenteId(linha.conferenteNome ?? sessao.conferenteNome, conferentes),
    produto_id: null,
    codigo_interno: String(linha.codigoInterno ?? '').trim(),
    descricao: String(linha.descricao ?? '').trim(),
    unidade_medida: String(linha.unidade ?? '').trim() || null,
    quantidade_up: linha.quantidade,
    up_adicional: parseUpAdicional(linha.up),
    lote: String(linha.lote ?? '').trim() || null,
    observacao: obsBase,
    data_fabricacao: df || null,
    data_validade: dv || null,
    ean: String(linha.codigoBarras ?? '').trim() || null,
    dun: null,
    foto_base64: null,
    contagem_rascunho: false,
    finalizacao_sessao_id: sessao.id,
    origem: 'contagem_diaria',
  }
}

async function deleteContagensDaSessao(sessaoId: string): Promise<void> {
  const { error } = await supabase.from(TABLE_CONTAGEM_DIARIA).delete().eq('finalizacao_sessao_id', sessaoId)
  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('finalizacao_sessao_id') && msg.includes('does not exist')) return
    throw error
  }
}

async function sessaoJaSincronizada(sessaoId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(TABLE_CONTAGEM_DIARIA)
    .select('id', { count: 'exact', head: true })
    .eq('finalizacao_sessao_id', sessaoId)
  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('finalizacao_sessao_id') && msg.includes('does not exist')) return false
    throw error
  }
  return (count ?? 0) > 0
}

function sessaoNoIntervalo(
  sessao: ContagemDiariaSessao,
  opts: { allTime?: boolean; startYmd?: string; endYmd?: string },
): boolean {
  if (opts.allTime) return true
  const ymd = sessao.dataContagem
  if (!ymd) return false
  const de = opts.startYmd ?? '0000-01-01'
  const ate = opts.endYmd ?? '9999-12-31'
  return ymd >= de && ymd <= ate
}

async function insertContagemRows(rows: Record<string, unknown>[]): Promise<number> {
  const CHUNK = 250
  let inserted = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      ...r,
      conferente_id: conferenteIdParaBanco(r.conferente_id as string | null | undefined),
    }))
    let payload = chunk
    let { data, error } = await supabase.from(TABLE_CONTAGEM_DIARIA).insert(payload).select('id')
    if (error) {
      const msg = String(error.message ?? '').toLowerCase()
      if (msg.includes('origem')) {
        payload = chunk.map((r) => {
          const copy = { ...r }
          delete copy.origem
          return copy
        })
        const res = await supabase.from(TABLE_CONTAGEM_DIARIA).insert(payload).select('id')
        data = res.data
        error = res.error
      }
      if (error && String(error.message ?? '').toLowerCase().includes('finalizacao_sessao_id')) {
        payload = payload.map((r) => {
          const copy = { ...r }
          delete copy.finalizacao_sessao_id
          return copy
        })
        const res = await supabase.from(TABLE_CONTAGEM_DIARIA).insert(payload).select('id')
        data = res.data
        error = res.error
      }
      if (error && String(error.message ?? '').toLowerCase().includes('contagem_rascunho')) {
        payload = payload.map((r) => {
          const copy = { ...r }
          delete copy.contagem_rascunho
          return copy
        })
        const res = await supabase.from(TABLE_CONTAGEM_DIARIA).insert(payload).select('id')
        data = res.data
        error = res.error
      }
    }
    if (error) throw error
    inserted += data?.length ?? 0
  }
  return inserted
}

export async function syncContagemDiariaSessaoParaContagens(
  sessao: ContagemDiariaSessao,
  opts?: { force?: boolean },
): Promise<{ inserted: number }> {
  if (!contagemDiariaSyncHabilitado()) return { inserted: 0 }
  if (sessao.status !== 'fechado' || sessao.linhas.length === 0) return { inserted: 0 }
  if (!opts?.force && (await sessaoJaSincronizada(sessao.id))) return { inserted: 0 }

  const conferentes = await listConferentes()
  const rows = sessao.linhas.map((ln) => linhaToPayload(sessao, ln, conferentes))
  await deleteContagensDaSessao(sessao.id)
  const inserted = await insertContagemRows(rows)
  return { inserted }
}

export async function ensureContagensDiariaSessaoSincronizadas(opts?: {
  allTime?: boolean
  startYmd?: string
  endYmd?: string
}): Promise<{ sessoes: number; linhas: number }> {
  if (!contagemDiariaSyncHabilitado()) return { sessoes: 0, linhas: 0 }
  const sessoes = await fetchContagemDiariaSessoesSupabase()
  const alvo = sessoes.filter(
    (s) => s.status === 'fechado' && s.linhas.length > 0 && sessaoNoIntervalo(s, opts ?? {}),
  )
  let sessoesSync = 0
  let linhas = 0
  for (const s of alvo) {
    try {
      const { inserted } = await syncContagemDiariaSessaoParaContagens(s)
      if (inserted > 0) {
        sessoesSync++
        linhas += inserted
      }
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[contagemDiariaSync]', s.id, e)
    }
  }
  return { sessoes: sessoesSync, linhas }
}
