import { TABLE_CONTAGEM_DIARIA, TABLE_CONTAGEM_INVENTARIO } from './contagensDb'
import {
  contagemDiariaDatasReferenciaYmd,
  contagemDiariaSessaoFinalizada,
  inventarioDatasReferenciaYmd,
  inventarioSessaoFinalizado,
  sessaoDatasNoPeriodo,
} from './capturaSessaoExportUtils'
import { listContagensDiarias, resetContagemDiariaSupabaseProbe } from './contagemDiariaSessaoStore'
import type { ContagemDiariaSessao } from './contagemDiariaSessaoTypes'
import { listInventarios, resetInventarioSupabaseProbe } from './inventarioSessaoStore'
import type { InventarioSessao } from './inventarioSessaoTypes'
import { supabase } from './supabaseClient'

export type ExportSessoesPeriodoOpts = {
  allTime: boolean
  startDate: string
  endDate: string
  useSingleDay: boolean
  singleDay: string
}

export type ContagemDiariaSessaoExport = ContagemDiariaSessao & { linhasExportCount: number }
export type InventarioSessaoExport = InventarioSessao & { linhasExportCount: number }

async function contarLinhasPorSessaoId(
  tabela: typeof TABLE_CONTAGEM_DIARIA | typeof TABLE_CONTAGEM_INVENTARIO,
  ids: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (!ids.length) return counts

  const unique = [...new Set(ids.filter(Boolean))]
  const CHUNK = 80
  for (let i = 0; i < unique.length; i += CHUNK) {
    const slice = unique.slice(i, i + CHUNK)
    const { data, error } = await supabase
      .from(tabela)
      .select('finalizacao_sessao_id')
      .in('finalizacao_sessao_id', slice)
    if (error) {
      const msg = String(error.message ?? '').toLowerCase()
      if (msg.includes('finalizacao_sessao_id')) return counts
      if (import.meta.env.DEV) console.warn('[exportSessoesList] count', tabela, error)
      continue
    }
    for (const row of data ?? []) {
      const id = String((row as { finalizacao_sessao_id?: string }).finalizacao_sessao_id ?? '').trim()
      if (!id) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
  }
  return counts
}

function sortContagensExport(a: ContagemDiariaSessao, b: ContagemDiariaSessao): number {
  return (b.dataFim ?? b.dataInicio ?? b.dataContagem ?? '').localeCompare(
    a.dataFim ?? a.dataInicio ?? a.dataContagem ?? '',
  )
}

function sortInventariosExport(a: InventarioSessao, b: InventarioSessao): number {
  return (b.dataFim ?? b.dataInicio ?? '').localeCompare(a.dataFim ?? a.dataInicio ?? '')
}

/** Lista contagens diárias finalizadas para exportação (mesma fonte do Gerenciar + contagem no banco). */
export async function listContagensDiariasParaExport(
  opts: ExportSessoesPeriodoOpts,
): Promise<ContagemDiariaSessaoExport[]> {
  resetContagemDiariaSupabaseProbe()
  const todas = await listContagensDiarias()
  const filtradas = todas
    .filter(
      (s) =>
        contagemDiariaSessaoFinalizada(s) &&
        sessaoDatasNoPeriodo(contagemDiariaDatasReferenciaYmd(s), opts),
    )
    .sort(sortContagensExport)

  const counts = await contarLinhasPorSessaoId(
    TABLE_CONTAGEM_DIARIA,
    filtradas.map((s) => s.id),
  )

  return filtradas.map((s) => ({
    ...s,
    linhasExportCount: Math.max(s.linhas.length, counts.get(s.id) ?? 0),
  }))
}

/** Lista inventários finalizados para exportação. */
export async function listInventariosParaExport(
  opts: ExportSessoesPeriodoOpts,
): Promise<InventarioSessaoExport[]> {
  resetInventarioSupabaseProbe()
  const todas = await listInventarios()
  const filtradas = todas
    .filter(
      (s) =>
        inventarioSessaoFinalizado(s) &&
        sessaoDatasNoPeriodo(inventarioDatasReferenciaYmd(s), opts),
    )
    .sort(sortInventariosExport)

  const counts = await contarLinhasPorSessaoId(
    TABLE_CONTAGEM_INVENTARIO,
    filtradas.map((s) => s.id),
  )

  return filtradas.map((s) => ({
    ...s,
    linhasExportCount: Math.max(s.linhas.length, counts.get(s.id) ?? 0),
  }))
}
