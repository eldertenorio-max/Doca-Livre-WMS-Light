import { supabase } from './supabaseClient'
import { TABLE_CONTAGEM_INVENTARIO } from './contagensDb'
import { contagemLinhaAVenceB } from './contagemOrdemLinha'
import { contagemDiariaChaveProdutoDia } from './contagemListagemCompat'
import { normalizeCodigoInternoCompareKey } from './codigoInternoCompare'
import { fetchConferentesNomesPorIds } from './conferentesNomesBatch'
import type { OfflineChecklistItem } from './offlineContagemSession'

const FETCH_CHUNK = 1000

function toDateInputValue(v?: string | null) {
  if (!v) return ''
  const str = String(v)
  const m = str.match(/^\d{4}-\d{2}-\d{2}/)
  return m ? m[0] : ''
}

function formatQtyFromNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  const s = String(n)
  return s.includes('.') ? s.replace('.', ',') : s
}

type RowSnapshot = {
  contagensRowId: string
  conferente_id: string
  codigo_interno: string
  descricao: string
  quantidade_up: number
  up_adicional: number | null
  lote: string | null
  observacao: string | null
  data_fabricacao: string | null
  data_validade: string | null
  ean: string | null
  dun: string | null
  data_hora_contagem: string
  planilha_grupo_armazem: number | null
  planilha_ordem_na_aba: number | null
  inventario_numero_contagem: number | null
}

function inventarioPlanilhaMergeKey(
  ymd: string,
  grupo: number,
  ordem: number,
  rodada: number,
): string {
  return `${ymd}|rod${rodada}|g${grupo}|o${ordem}`
}

function inventarioItemMergeKey(
  ymd: string,
  it: OfflineChecklistItem,
  rodada: number,
): string | null {
  if (it.armazem_grupo != null && it.planilha_ordem_na_aba != null) {
    return inventarioPlanilhaMergeKey(ymd, it.armazem_grupo, it.planilha_ordem_na_aba, rodada)
  }
  const codRaw = String(it.codigo_interno ?? '').trim()
  if (!normalizeCodigoInternoCompareKey(codRaw)) return null
  return contagemDiariaChaveProdutoDia(ymd, codRaw, String(it.descricao ?? ''))
}

function rowToMergeKey(ymd: string, r: RowSnapshot): string | null {
  if (r.planilha_grupo_armazem != null && r.planilha_ordem_na_aba != null) {
    const rod = r.inventario_numero_contagem ?? 1
    return inventarioPlanilhaMergeKey(ymd, r.planilha_grupo_armazem, r.planilha_ordem_na_aba, rod)
  }
  const codRaw = String(r.codigo_interno ?? '').trim()
  if (!normalizeCodigoInternoCompareKey(codRaw)) return null
  return contagemDiariaChaveProdutoDia(ymd, codRaw, String(r.descricao ?? ''))
}

async function fetchUltimasInventarioPorChave(
  dataContagemYmd: string,
  numeroContagemRodada: number,
): Promise<Map<string, RowSnapshot>> {
  const map = new Map<string, RowSnapshot>()
  const ymd = String(dataContagemYmd ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return map
  const rodada = Math.min(4, Math.max(1, Math.round(numeroContagemRodada)))

  const sel =
    'id,conferente_id,codigo_interno,descricao,quantidade_up,up_adicional,lote,observacao,data_fabricacao,data_validade,ean,dun,data_hora_contagem,inventario_numero_contagem,planilha_grupo_armazem,planilha_ordem_na_aba'

  const acc: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(TABLE_CONTAGEM_INVENTARIO)
      .select(sel)
      .eq('data_contagem', ymd)
      .order('id', { ascending: true })
      .range(from, from + FETCH_CHUNK - 1)
    if (error) {
      if (import.meta.env.DEV) console.warn('[mergeInventarioDoBanco] select', error)
      return map
    }
    const batch = (data ?? []) as Record<string, unknown>[]
    acc.push(...batch)
    if (batch.length < FETCH_CHUNK) break
    from += FETCH_CHUNK
    if (from > 120000) break
  }

  for (const r of acc) {
    const ncRaw = r.inventario_numero_contagem
    const nc = ncRaw != null && String(ncRaw).trim() !== '' ? Number(ncRaw) : 1
    if (Number.isFinite(nc) && Math.round(nc) !== rodada) continue

    const cidRow = r.conferente_id != null ? String(r.conferente_id).trim() : ''
    if (!cidRow) continue
    const qRaw = r.quantidade_up
    const q = typeof qRaw === 'number' ? qRaw : Number(String(qRaw ?? '').replace(',', '.'))
    if (!Number.isFinite(q) || q < 0) continue

    let up_adicional: number | null = null
    const upRaw = r.up_adicional
    if (upRaw != null && String(upRaw).trim() !== '') {
      const u = typeof upRaw === 'number' ? upRaw : Number(String(upRaw).replace(',', '.'))
      if (Number.isFinite(u) && u >= 0) up_adicional = u
    }

    const rowId = r.id != null ? String(r.id) : ''
    if (!rowId) continue

    const snap: RowSnapshot = {
      contagensRowId: rowId,
      conferente_id: cidRow,
      codigo_interno: r.codigo_interno != null ? String(r.codigo_interno) : '',
      descricao: r.descricao != null ? String(r.descricao) : '',
      quantidade_up: q,
      up_adicional,
      lote: r.lote != null && String(r.lote).trim() !== '' ? String(r.lote) : null,
      observacao: r.observacao != null && String(r.observacao).trim() !== '' ? String(r.observacao) : null,
      data_fabricacao: r.data_fabricacao != null ? String(r.data_fabricacao) : null,
      data_validade: r.data_validade != null ? String(r.data_validade) : null,
      ean: r.ean != null && String(r.ean).trim() !== '' ? String(r.ean).trim() : null,
      dun: r.dun != null && String(r.dun).trim() !== '' ? String(r.dun).trim() : null,
      data_hora_contagem: r.data_hora_contagem != null ? String(r.data_hora_contagem) : new Date(0).toISOString(),
      planilha_grupo_armazem:
        r.planilha_grupo_armazem != null && Number.isFinite(Number(r.planilha_grupo_armazem))
          ? Number(r.planilha_grupo_armazem)
          : null,
      planilha_ordem_na_aba:
        r.planilha_ordem_na_aba != null && Number.isFinite(Number(r.planilha_ordem_na_aba))
          ? Number(r.planilha_ordem_na_aba)
          : null,
      inventario_numero_contagem: Number.isFinite(nc) ? Math.round(nc) : 1,
    }

    const key = rowToMergeKey(ymd, snap)
    if (!key) continue

    const prev = map.get(key)
    if (
      !prev ||
      contagemLinhaAVenceB(
        { data_hora_contagem: snap.data_hora_contagem, id: snap.contagensRowId },
        { data_hora_contagem: prev.data_hora_contagem, id: prev.contagensRowId },
      )
    ) {
      map.set(key, snap)
    }
  }

  return map
}

export type MergeInventarioOptions = {
  skipKeys?: Set<string>
  numeroContagemRodada?: number
}

/**
 * Preenche a checklist do inventário com a última gravação do dia (todos os conferentes), em tempo real.
 */
export async function mergeInventarioDoDiaParaItems(
  dataContagemYmd: string,
  items: OfflineChecklistItem[],
  options?: MergeInventarioOptions,
): Promise<{ items: OfflineChecklistItem[]; preenchidos: number }> {
  const skipKeys = options?.skipKeys
  const rodada = options?.numeroContagemRodada ?? 1
  const porChave = await fetchUltimasInventarioPorChave(dataContagemYmd, rodada)
  if (porChave.size === 0) {
    return { items: items.map((i) => ({ ...i })), preenchidos: 0 }
  }

  const ids = [...new Set([...porChave.values()].map((s) => s.conferente_id).filter(Boolean))]
  const nomesPorId = await fetchConferentesNomesPorIds(ids)

  const porCodigoNorm = new Map<string, RowSnapshot>()
  for (const [key, snap] of porChave) {
    if (key.includes('|rod')) continue
    const codeNorm = String(key.split('|')[1] ?? '').trim().toLowerCase()
    if (!codeNorm) continue
    const prev = porCodigoNorm.get(codeNorm)
    if (
      !prev ||
      contagemLinhaAVenceB(
        { data_hora_contagem: snap.data_hora_contagem, id: snap.contagensRowId },
        { data_hora_contagem: prev.data_hora_contagem, id: prev.contagensRowId },
      )
    ) {
      porCodigoNorm.set(codeNorm, snap)
    }
  }

  let preenchidos = 0
  const ymd = String(dataContagemYmd ?? '').trim()
  const next = items.map((it) => {
    const itemKey = inventarioItemMergeKey(ymd, it, rodada)
    if (skipKeys?.has(it.key)) {
      const snapSkip =
        (itemKey ? porChave.get(itemKey) : undefined) ??
        porCodigoNorm.get(normalizeCodigoInternoCompareKey(String(it.codigo_interno ?? '')).toLowerCase())
      if (!snapSkip) return { ...it }
      const nomeUltimo = nomesPorId.get(snapSkip.conferente_id)?.trim() || snapSkip.conferente_id
      return { ...it, contagem_banco_ultimo_conferente_nome: nomeUltimo }
    }

    const snap =
      (itemKey ? porChave.get(itemKey) : undefined) ??
      porCodigoNorm.get(normalizeCodigoInternoCompareKey(String(it.codigo_interno ?? '')).toLowerCase())
    if (!snap) {
      return { ...it, contagem_banco_ultimo_conferente_nome: undefined }
    }

    preenchidos += 1
    const nomeConf = nomesPorId.get(snap.conferente_id)?.trim() || snap.conferente_id
    return {
      ...it,
      codigo_interno: snap.codigo_interno || it.codigo_interno,
      descricao: snap.descricao || it.descricao,
      quantidade_contada: formatQtyFromNumber(snap.quantidade_up),
      up_quantidade: snap.up_adicional != null ? formatQtyFromNumber(snap.up_adicional) : '',
      lote: snap.lote ?? '',
      observacao: snap.observacao ?? '',
      data_fabricacao:
        snap.data_fabricacao != null ? toDateInputValue(snap.data_fabricacao) : it.data_fabricacao ?? '',
      data_validade: snap.data_validade != null ? toDateInputValue(snap.data_validade) : it.data_validade ?? '',
      ean: snap.ean != null ? snap.ean : it.ean ?? null,
      dun: snap.dun != null ? snap.dun : it.dun ?? null,
      contagem_banco_ultimo_conferente_nome: nomeConf,
    }
  })

  return { items: next, preenchidos }
}
