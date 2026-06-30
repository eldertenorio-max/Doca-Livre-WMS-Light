import {
  getGrupoArmazemFromCamaraRua,
  planilhaOrdemFromPosNivel,
} from '../components/inventario/inventarioPlanilhaModel'
import { parseEnderecoCodigo } from './enderecamentoStore'
import { listConferentes, type Conferente } from './conferentesStore'
import { TABLE_CONTAGEM_INVENTARIO } from './contagensDb'
import {
  insertInventarioContagensRows,
  replaceInventarioExistentePorEndereco,
} from './inventarioUpsertOnFinalize'
import { fetchInventarioSessoesSupabase, inventarioSyncHabilitado } from './inventarioSessaoSupabase'
import type { InventarioLinhaCaptura, InventarioSessao } from './inventarioSessaoTypes'
import { supabase } from './supabaseClient'

export function ymdSpFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
}

type PlanilhaMeta = {
  grupo: number | null
  ordem: number | null
  repeticao: number
}

function buildPlanilhaMetaPorLinha(linhas: InventarioLinhaCaptura[]): Map<string, PlanilhaMeta> {
  const porEndereco = new Map<string, InventarioLinhaCaptura[]>()
  for (const ln of linhas) {
    const key = String(ln.endereco ?? '').trim().toUpperCase()
    if (!key) continue
    const arr = porEndereco.get(key) ?? []
    arr.push(ln)
    porEndereco.set(key, arr)
  }

  const out = new Map<string, PlanilhaMeta>()
  for (const items of porEndereco.values()) {
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    items.forEach((ln, idx) => {
      const parsed = parseEnderecoCodigo(ln.endereco)
      const camara = ln.camara ?? parsed.camara
      const rua = parsed.rua
      const pos = parsed.posicao ?? 1
      const nivel = parsed.nivel ?? 1
      const repeticao = (idx % 3) + 1
      const grupo =
        camara != null && rua ? getGrupoArmazemFromCamaraRua(camara, rua) : null
      const ordem =
        grupo != null ? planilhaOrdemFromPosNivel(pos, nivel, repeticao) : null
      out.set(ln.id, { grupo, ordem, repeticao })
    })
  }
  return out
}

function resolveConferenteId(nome: string | undefined, conferentes: Conferente[]): string {
  const alvo = String(nome ?? '').trim()
  if (!alvo) return ''
  const lower = alvo.toLowerCase()
  const exato = conferentes.find((c) => c.nome.trim().toLowerCase() === lower)
  if (exato) return exato.id
  const parcial = conferentes.find(
    (c) =>
      c.nome.trim().toLowerCase().includes(lower) ||
      lower.includes(c.nome.trim().toLowerCase()),
  )
  return parcial?.id ?? ''
}

function parseUpAdicional(raw: string | undefined): number | null {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function linhaToPayload(
  sessao: InventarioSessao,
  linha: InventarioLinhaCaptura,
  dataContagemYmd: string,
  meta: PlanilhaMeta,
  conferentes: Conferente[],
): Record<string, unknown> {
  const df = String(linha.fabricacao ?? '').trim()
  const dv = String(linha.validade ?? '').trim()
  const obsBase = `Inventário #${sessao.numero}${sessao.titulo ? ` — ${sessao.titulo}` : ''}`
  return {
    data_contagem: dataContagemYmd,
    data_hora_contagem: linha.createdAt || sessao.dataFim || new Date().toISOString(),
    conferente_id: resolveConferenteId(linha.conferenteNome, conferentes),
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
    inventario_repeticao: meta.repeticao,
    inventario_numero_contagem: 1,
    contagem_rascunho: false,
    finalizacao_sessao_id: sessao.id,
    planilha_grupo_armazem: meta.grupo,
    planilha_ordem_na_aba: meta.ordem,
  }
}

async function deleteContagensDaSessao(sessaoId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE_CONTAGEM_INVENTARIO)
    .delete()
    .eq('finalizacao_sessao_id', sessaoId)
  if (error) {
    const msg = String(error.message ?? '').toLowerCase()
    if (msg.includes('finalizacao_sessao_id') && msg.includes('does not exist')) return
    throw error
  }
}

async function sessaoJaSincronizada(sessaoId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from(TABLE_CONTAGEM_INVENTARIO)
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
  sessao: InventarioSessao,
  opts: { allTime?: boolean; startYmd?: string; endYmd?: string },
): boolean {
  if (opts.allTime) return true
  const ymd = ymdSpFromIso(sessao.dataFim ?? sessao.dataInicio)
  if (!ymd) return false
  const de = opts.startYmd ?? '0000-01-01'
  const ate = opts.endYmd ?? '9999-12-31'
  return ymd >= de && ymd <= ate
}

/** Grava linhas de um inventário fechado em `contagens_inventario`. */
export async function syncInventarioSessaoParaContagens(
  sessao: InventarioSessao,
  opts?: { force?: boolean },
): Promise<{ inserted: number }> {
  if (!inventarioSyncHabilitado()) return { inserted: 0 }
  if (sessao.status !== 'fechado' || sessao.linhas.length === 0) return { inserted: 0 }

  if (!opts?.force && (await sessaoJaSincronizada(sessao.id))) {
    return { inserted: 0 }
  }

  const dataContagemYmd = ymdSpFromIso(sessao.dataFim ?? sessao.dataInicio)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataContagemYmd)) {
    throw new Error('Data de fechamento do inventário inválida para exportação.')
  }

  const conferentes = await listConferentes()
  const metaMap = buildPlanilhaMetaPorLinha(sessao.linhas)
  const rows = sessao.linhas.map((ln) =>
    linhaToPayload(sessao, ln, dataContagemYmd, metaMap.get(ln.id) ?? { grupo: null, ordem: null, repeticao: 1 }, conferentes),
  )

  await deleteContagensDaSessao(sessao.id)
  await replaceInventarioExistentePorEndereco(dataContagemYmd, rows)
  const { ids } = await insertInventarioContagensRows(rows)
  return { inserted: ids.length }
}

export type EnsureInventariosSyncResult = {
  sessoes: number
  linhas: number
}

/** Sincroniza inventários fechados (captura) que ainda não estão em `contagens_inventario`. */
export async function ensureInventariosSessaoSincronizados(opts?: {
  allTime?: boolean
  startYmd?: string
  endYmd?: string
}): Promise<EnsureInventariosSyncResult> {
  if (!inventarioSyncHabilitado()) return { sessoes: 0, linhas: 0 }

  const sessoes = await fetchInventarioSessoesSupabase()
  const alvo = sessoes.filter(
    (s) => s.status === 'fechado' && s.linhas.length > 0 && sessaoNoIntervalo(s, opts ?? {}),
  )

  let sessoesSync = 0
  let linhas = 0
  for (const s of alvo) {
    const { inserted } = await syncInventarioSessaoParaContagens(s)
    if (inserted > 0) {
      sessoesSync++
      linhas += inserted
    }
  }
  return { sessoes: sessoesSync, linhas }
}
