import {
  isPresencaAtiva,
  PRESENCA_PING_INTERVAL_MS,
  PRESENCA_POLL_INTERVAL_MS,
} from './contagemDiariaPresenca'
import { supabase } from './supabaseClient'

export { PRESENCA_PING_INTERVAL_MS, PRESENCA_POLL_INTERVAL_MS, isPresencaAtiva }

const TABELA = 'inventario_captura_presenca'

export type InventarioCapturaPresencaRow = {
  inventario_id: string
  usuario_nome: string
  atualizado_em: string
}

export async function upsertInventarioCapturaPresenca(
  inventarioId: string,
  usuarioNome: string,
): Promise<void> {
  const id = String(inventarioId ?? '').trim()
  const nome = String(usuarioNome ?? '').trim()
  if (!id || !nome) return
  try {
    const { error } = await supabase.from(TABELA).upsert(
      {
        inventario_id: id,
        usuario_nome: nome,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'inventario_id,usuario_nome' },
    )
    if (error && import.meta.env.DEV) console.warn(`[${TABELA}] upsert`, error)
  } catch (e) {
    if (import.meta.env.DEV) console.warn(`[${TABELA}] upsert`, e)
  }
}

export async function fetchInventarioCapturaPresenca(inventarioId: string): Promise<InventarioCapturaPresencaRow[]> {
  const id = String(inventarioId ?? '').trim()
  if (!id) return []
  try {
    const { data, error } = await supabase
      .from(TABELA)
      .select('inventario_id,usuario_nome,atualizado_em')
      .eq('inventario_id', id)
    if (error) {
      if (import.meta.env.DEV) console.warn(`[${TABELA}] select`, error)
      return []
    }
    const out: InventarioCapturaPresencaRow[] = []
    for (const r of data ?? []) {
      const rec = r as InventarioCapturaPresencaRow
      const nome = String(rec.usuario_nome ?? '').trim()
      const em = String(rec.atualizado_em ?? '').trim()
      if (nome && em) {
        out.push({ inventario_id: id, usuario_nome: nome, atualizado_em: em })
      }
    }
    return out
  } catch (e) {
    if (import.meta.env.DEV) console.warn(`[${TABELA}] select`, e)
    return []
  }
}

/** Nomes únicos de quem está ativo neste inventário (últimos 3 min). */
export function nomesContadoresAtivos(
  rows: InventarioCapturaPresencaRow[],
  fallbackNome?: string,
): string {
  const ativos = rows
    .filter((r) => isPresencaAtiva(r.atualizado_em))
    .map((r) => r.usuario_nome.trim())
    .filter(Boolean)
  const unique = [...new Set(ativos)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  if (unique.length > 0) return unique.join(', ')
  const fb = String(fallbackNome ?? '').trim()
  return fb || '—'
}
