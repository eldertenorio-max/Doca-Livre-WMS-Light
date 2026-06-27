import { TABLE_CONTAGEM_INVENTARIO } from './contagensDb'
import { fetchContagensPaged } from './contagensSelectCompat'
import { contagemLinhaAVenceB } from './contagemOrdemLinha'
import { contagemDiariaChaveProdutoDia } from './contagemListagemCompat'
import { normalizeCodigoInternoCompareKey } from './codigoInternoCompare'
import { fetchConferentesNomesPorIds } from './conferentesNomesBatch'
import { itemTemTrabalhoLocal, type OfflineChecklistItem } from './offlineContagemSession'

const MERGE_INVENTARIO_COLUMNS = [
  'id',
  'conferente_id',
  'codigo_interno',
  'descricao',
  'quantidade_up',
  'up_adicional',
  'lote',
  'observacao',
  'data_fabricacao',
  'data_validade',
  'ean',
  'dun',
  'data_hora_contagem',
  'inventario_numero_contagem',
  'inventario_repeticao',
  'planilha_grupo_armazem',
  'planilha_ordem_na_aba',
  'contagem_rascunho',
] as const

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
  inventario_repeticao: number | null
}

function inventarioPlanilhaMergeKey(
  ymd: string,
  grupo: number,
  ordem: number,
  rodada: number,
): string {
  return `${ymd}|rod${rodada}|g${grupo}|o${ordem}`
}

function inventarioRepeticaoMergeKey(
  ymd: string,
  codigo: string,
  repeticao: number,
  rodada: number,
): string {
  const codeNorm = normalizeCodigoInternoCompareKey(codigo).toLowerCase()
  return `${ymd}|rod${rodada}|rep${repeticao}|${codeNorm}`
}

function inventarioItemMergeKey(
  ymd: string,
  it: OfflineChecklistItem,
  rodada: number,
): string | null {
  if (it.armazem_grupo != null && it.planilha_ordem_na_aba != null) {
    return inventarioPlanilhaMergeKey(ymd, it.armazem_grupo, it.planilha_ordem_na_aba, rodada)
  }
  if (it.armazem_grupo != null) {
    return null
  }
  if (it.inventario_repeticao != null) {
    const codRaw = String(it.codigo_interno ?? '').trim()
    if (!normalizeCodigoInternoCompareKey(codRaw)) return null
    return inventarioRepeticaoMergeKey(ymd, codRaw, it.inventario_repeticao, rodada)
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
  if (r.inventario_repeticao != null && normalizeCodigoInternoCompareKey(codRaw)) {
    const rod = r.inventario_numero_contagem ?? 1
    return inventarioRepeticaoMergeKey(ymd, codRaw, r.inventario_repeticao, rod)
  }
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

  const { data: acc, error } = await fetchContagensPaged({
    table: TABLE_CONTAGEM_INVENTARIO,
    columns: MERGE_INVENTARIO_COLUMNS,
    eq: { data_contagem: ymd },
    order: { column: 'id', ascending: true },
  })
  if (error) {
    if (import.meta.env.DEV) console.warn('[mergeInventarioDoBanco] select', error)
    return map
  }

  const hasRascunhoCol = acc.length > 0 && 'contagem_rascunho' in (acc[0] as object)

  for (const r of acc) {
    if (hasRascunhoCol && r.contagem_rascunho === true) continue

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
      inventario_repeticao:
        r.inventario_repeticao != null && Number.isFinite(Number(r.inventario_repeticao))
          ? Number(r.inventario_repeticao)
          : null,
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
 * Preenche itens da checklist de inventário com a última gravação **finalizada** no banco
 * (mesmo dia / rodada, todos os conferentes). Rascunhos de digitação não entram no merge —
 * cada aparelho mantém o próprio rascunho local até finalizar.
 */
export async function mergeInventarioDoDiaParaItems(
  dataContagemYmd: string,
  items: OfflineChecklistItem[],
  options?: MergeInventarioOptions,
): Promise<{ items: OfflineChecklistItem[]; preenchidos: number }> {
  const skipKeys = options?.skipKeys
  const rodada = Math.min(4, Math.max(1, Math.round(options?.numeroContagemRodada ?? 1)))
  const porChave = await fetchUltimasInventarioPorChave(dataContagemYmd, rodada)
  if (porChave.size === 0) {
    return { items: items.map((i) => ({ ...i })), preenchidos: 0 }
  }

  let preenchidos = 0
  const ymd = String(dataContagemYmd ?? '').trim()
  const next = items.map((it) => {
    if (skipKeys?.has(it.key)) return { ...it }
    if (it.quantidade_local_dirty) return { ...it }
    if (itemTemTrabalhoLocal(it, { planilha: true })) return { ...it }
    const key = inventarioItemMergeKey(ymd, it, rodada)
    if (!key) return { ...it }
    const snap = porChave.get(key)
    if (!snap) return { ...it }

    if (it.armazem_grupo != null && it.planilha_ordem_na_aba != null) {
      if (
        snap.planilha_ordem_na_aba == null ||
        snap.planilha_grupo_armazem == null ||
        snap.planilha_ordem_na_aba !== it.planilha_ordem_na_aba ||
        snap.planilha_grupo_armazem !== it.armazem_grupo
      ) {
        return { ...it }
      }
    }

    preenchidos += 1
    const localQty = String(it.quantidade_contada ?? '').trim()
    const mergedQty = formatQtyFromNumber(snap.quantidade_up)
    const keepLocalMeta =
      localQty !== '' &&
      (it.quantidade_local_dirty ||
        String(it.lote ?? '').trim() !== '' ||
        String(it.up_quantidade ?? '').trim() !== '')
    return {
      ...it,
      quantidade_contada: keepLocalMeta ? localQty : mergedQty,
      up_quantidade: keepLocalMeta
        ? (it.up_quantidade ?? '')
        : snap.up_adicional != null
          ? formatQtyFromNumber(snap.up_adicional)
          : '',
      lote: keepLocalMeta ? (it.lote ?? '') : (snap.lote ?? ''),
      observacao: keepLocalMeta ? (it.observacao ?? '') : (snap.observacao ?? ''),
      data_fabricacao: snap.data_fabricacao != null ? toDateInputValue(snap.data_fabricacao) : it.data_fabricacao ?? '',
      data_validade: snap.data_validade != null ? toDateInputValue(snap.data_validade) : it.data_validade ?? '',
      ean: snap.ean != null ? snap.ean : it.ean ?? null,
      dun: snap.dun != null ? snap.dun : it.dun ?? null,
    }
  })

  return { items: next, preenchidos }
}
