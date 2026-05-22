import { normalizeCodigoInternoCompareKey } from './codigoInternoCompare'
import { ARMAZEM_LISTA_OFICIAL } from './armazemListaOficial'
import type { OfflineChecklistItem } from './offlineContagemSession'

/** Grupos 1–4 no inventário; alinhado a `INVENTARIO_ARMAZEM_NUM_GRUPOS` em inventarioPlanilhaModel. */
const INVENTARIO_ARMAZEM_NUM_GRUPOS = 4

function buildArmazemContagemCodes(): Record<number, string[]> {
  const out: Record<number, string[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] }
  for (const row of ARMAZEM_LISTA_OFICIAL) {
    out[row.grupo].push(row.codigo)
  }
  return out
}

/**
 * Ordem do armazém dividida em rotas/contagens (derivada de `ARMAZEM_LISTA_OFICIAL`).
 * Define SOMENTE a divisão (grupo) e a ordem relativa de exibição.
 */
const ARMAZEM_CONTAGEM_CODES = buildArmazemContagemCodes()

const ARMAZEM_POS_BY_CODIGO = (() => {
  const m = new Map<string, { contagem: number; pos: number }>()
  for (const contagemStr of Object.keys(ARMAZEM_CONTAGEM_CODES)) {
    const contagem = Number(contagemStr)
    const codes = ARMAZEM_CONTAGEM_CODES[contagem] ?? []
    codes.forEach((codigo, pos) => {
      const meta = { contagem, pos }
      m.set(codigo, meta)
      const norm = normalizeCodigoInternoCompareKey(codigo)
      if (norm && !m.has(norm)) m.set(norm, meta)
    })
  }
  return m
})()

/** Códigos do mapa armazém na ordem oficial (apenas grupos 1–4). */
export function listArmazemContagemCodigosOrdered(): ReadonlyArray<{ grupo: number; pos: number; codigo: string }> {
  const posInGrupo: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  return ARMAZEM_LISTA_OFICIAL.map((row) => {
    const pos = posInGrupo[row.grupo] ?? 0
    posInGrupo[row.grupo] = pos + 1
    return { grupo: row.grupo, pos, codigo: row.codigo }
  })
}

/** Chaves candidatas para bater o mapa (cadastro às vezes perde zero à esquerda no 1º bloco). */
function armazemCodigoLookupCandidates(codigo: string): string[] {
  const t = String(codigo ?? '').trim()
  const keys: string[] = []
  const push = (s: string) => {
    if (s && !keys.includes(s)) keys.push(s)
  }
  push(t)
  push(normalizeCodigoInternoCompareKey(t))
  const dig = t.replace(/\D/g, '')
  if (dig.length === 7) push(dig.padStart(8, '0'))
  if (dig.length === 8) push(dig)
  return keys
}

export function getArmazemContagem(codigo: string): number | null {
  for (const k of armazemCodigoLookupCandidates(codigo)) {
    const c = ARMAZEM_POS_BY_CODIGO.get(k)?.contagem
    if (c != null) return c
  }
  return null
}

/** Índice na rota do grupo (0-based). Não confundir com POS da planilha física — usado para ordenar como na lista. */
export function getArmazemPos(codigo: string): number {
  for (const k of armazemCodigoLookupCandidates(codigo)) {
    const p = ARMAZEM_POS_BY_CODIGO.get(k)?.pos
    if (p != null) return p
  }
  return Number.MAX_SAFE_INTEGER
}

export function getArmazemContagemForItem(it: OfflineChecklistItem): number | null {
  const g = it.armazem_grupo
  if (g != null && g >= 1 && g <= INVENTARIO_ARMAZEM_NUM_GRUPOS) return g
  return getArmazemContagem(it.codigo_interno)
}

/**
 * Ordem canônica: grupo armazém (1ª–4ª contagem), posição no mapa, código e (no inventário) 1ª–3ª repetição.
 * Usada em POS/Nível ao finalizar (`buildPlanilhaLayoutPorItens` → `inventario_planilha_linhas`) e na checklist.
 *
 * Sem `planilha_ordem_na_aba` (lista armazém), não é ordem alfabética pura: segue `ARMAZEM_LISTA_OFICIAL`.
 */
export function compareInventarioPlanilhaItens(a: OfflineChecklistItem, b: OfflineChecklistItem): number {
  const oa = a.planilha_ordem_na_aba
  const ob = b.planilha_ordem_na_aba
  if (oa != null && ob != null && oa !== ob) return oa - ob
  if (oa != null && ob == null) return -1
  if (oa == null && ob != null) return 1
  /** `getArmazemPos` é só a posição dentro do grupo; sem comparar o grupo, 1ª posições de abas diferentes ficam “misturadas”. */
  const ga = getArmazemContagemForItem(a)
  const gb = getArmazemContagemForItem(b)
  if (ga != null && gb != null && ga !== gb) return ga - gb
  if (ga != null && gb == null) return -1
  if (ga == null && gb != null) return 1
  const pa = getArmazemPos(a.codigo_interno)
  const pb = getArmazemPos(b.codigo_interno)
  if (pa !== pb) return pa - pb
  const na = normalizeCodigoInternoCompareKey(a.codigo_interno)
  const nb = normalizeCodigoInternoCompareKey(b.codigo_interno)
  const c = na !== nb ? na.localeCompare(nb, 'pt-BR') : a.codigo_interno.localeCompare(b.codigo_interno, 'pt-BR')
  if (c !== 0) return c
  const r = (a.inventario_repeticao ?? 0) - (b.inventario_repeticao ?? 0)
  if (r !== 0) return r
  return String(a.key).localeCompare(String(b.key), 'pt-BR')
}
