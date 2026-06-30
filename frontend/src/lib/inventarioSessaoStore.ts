import {
  deleteInventarioSessaoSupabase,
  fetchInventarioSessaoByIdSupabase,
  fetchInventarioSessoesSupabase,
  fetchProximoNumeroInventarioSupabase,
  inventarioSyncHabilitado,
  upsertInventarioSessaoSupabase,
} from './inventarioSessaoSupabase'

export type { InventarioLinhaCaptura, InventarioSessao } from './inventarioSessaoTypes'
import type { InventarioLinhaCaptura, InventarioSessao } from './inventarioSessaoTypes'

const LEGACY_STORAGE_KEY = 'inventario-sessoes-v2'

try {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  /* ignore */
}

function requireSupabase(): void {
  if (!inventarioSyncHabilitado()) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }
}

function wrapDbError(e: unknown, fallback: string): Error {
  const msg = e instanceof Error ? e.message : fallback
  if (/relation.*does not exist|42P01/i.test(msg)) {
    return new Error(
      'Tabela inventario_sessoes não existe no Supabase. Execute supabase/sql/create_inventario_sessoes.sql.',
    )
  }
  return e instanceof Error ? e : new Error(fallback)
}

function withUpdatedAt(sessao: InventarioSessao): InventarioSessao {
  return { ...sessao, updatedAt: new Date().toISOString() }
}

export function normalizarTituloInventario(titulo: string): string {
  return String(titulo ?? '')
    .trim()
    .toLowerCase()
}

export function inventarioAbertoComMesmoTitulo(
  lista: InventarioSessao[],
  titulo: string,
  ignorarId?: string,
): InventarioSessao | undefined {
  const key = normalizarTituloInventario(titulo)
  if (!key) return undefined
  return lista.find(
    (r) =>
      r.status === 'aberto' &&
      r.id !== ignorarId &&
      normalizarTituloInventario(r.titulo) === key,
  )
}

export function mensagemTituloInventarioEmUso(titulo: string, existente?: InventarioSessao): string {
  if (!existente) return 'Não foi possível usar este nome de inventário.'
  return `Já existe um inventário aberto com o nome "${existente.titulo}" (#${existente.numero}). Finalize-o antes de usar esse nome.`
}

export async function listInventarios(): Promise<InventarioSessao[]> {
  requireSupabase()
  try {
    return await fetchInventarioSessoesSupabase()
  } catch (e) {
    throw wrapDbError(e, 'Erro ao listar inventários.')
  }
}

export async function getInventario(id: string): Promise<InventarioSessao | null> {
  requireSupabase()
  try {
    return await fetchInventarioSessaoByIdSupabase(id)
  } catch (e) {
    throw wrapDbError(e, 'Erro ao carregar inventário.')
  }
}

export async function criarInventario(opts?: {
  titulo?: string
  local?: string
  posicoesNome?: string
  posicoesCodigos?: string[]
}): Promise<InventarioSessao | null> {
  requireSupabase()
  const lista = await listInventarios()
  const numero = await fetchProximoNumeroInventarioSupabase()
  const tituloFinal = opts?.titulo?.trim() || `Inventário (Validade) #${numero}`
  if (inventarioAbertoComMesmoTitulo(lista, tituloFinal)) return null

  const now = new Date().toISOString()
  const row: InventarioSessao = {
    id: crypto.randomUUID(),
    numero: numero ?? lista.length + 1,
    titulo: tituloFinal,
    local: opts?.local?.trim() || 'ULTRAPAO GUARULHOS DISTRI',
    posicoesNome: opts?.posicoesNome?.trim() || undefined,
    posicoesCodigos: opts?.posicoesCodigos?.length ? [...opts.posicoesCodigos] : undefined,
    catalogoProdutos: 'ultrapao',
    dataInicio: now,
    dataFim: null,
    status: 'aberto',
    linhas: [],
    createdAt: now,
    updatedAt: now,
  }
  await upsertInventarioSessaoSupabase(row)
  return row
}

export async function saveInventario(sessao: InventarioSessao): Promise<void> {
  requireSupabase()
  await upsertInventarioSessaoSupabase(withUpdatedAt(sessao))
}

export async function addLinhaInventario(
  inventarioId: string,
  linha: Omit<InventarioLinhaCaptura, 'id' | 'createdAt'>,
): Promise<InventarioLinhaCaptura | null> {
  const sessao = await getInventario(inventarioId)
  if (!sessao || sessao.status !== 'aberto') return null
  const row: InventarioLinhaCaptura = {
    ...linha,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  sessao.linhas = [...sessao.linhas, row]
  await saveInventario(sessao)
  return row
}

export async function updateLinhaInventario(
  inventarioId: string,
  linhaId: string,
  linha: Omit<InventarioLinhaCaptura, 'id' | 'createdAt'>,
): Promise<InventarioLinhaCaptura | null> {
  const sessao = await getInventario(inventarioId)
  if (!sessao || sessao.status !== 'aberto') return null
  const idx = sessao.linhas.findIndex((l) => l.id === linhaId)
  if (idx < 0) return null
  const prev = sessao.linhas[idx]!
  const row: InventarioLinhaCaptura = {
    ...linha,
    id: linhaId,
    createdAt: prev.createdAt,
  }
  const next = [...sessao.linhas]
  next[idx] = row
  sessao.linhas = next
  await saveInventario(sessao)
  return row
}

export async function deleteLinhaInventario(inventarioId: string, linhaId: string): Promise<boolean> {
  const sessao = await getInventario(inventarioId)
  if (!sessao || sessao.status !== 'aberto') return false
  const antes = sessao.linhas.length
  sessao.linhas = sessao.linhas.filter((l) => l.id !== linhaId)
  if (sessao.linhas.length === antes) return false
  await saveInventario(sessao)
  return true
}

export async function fecharInventario(id: string): Promise<void> {
  const sessao = await getInventario(id)
  if (!sessao) return
  sessao.status = 'fechado'
  sessao.dataFim = new Date().toISOString()
  await saveInventario(sessao)
}

export async function reabrirInventario(id: string): Promise<InventarioSessao | null> {
  const sessao = await getInventario(id)
  if (!sessao) return null
  const lista = await listInventarios()
  if (inventarioAbertoComMesmoTitulo(lista, sessao.titulo, id)) return null
  sessao.status = 'aberto'
  sessao.dataFim = null
  await saveInventario(sessao)
  return sessao
}

export async function deleteInventario(id: string): Promise<boolean> {
  requireSupabase()
  const sessao = await getInventario(id)
  if (!sessao) return false
  await deleteInventarioSessaoSupabase(id)
  return true
}

export async function atualizarInventarioMeta(
  id: string,
  patch: { titulo?: string; local?: string },
): Promise<InventarioSessao | null> {
  const sessao = await getInventario(id)
  if (!sessao) return null
  if (patch.titulo !== undefined) {
    const t = patch.titulo.trim()
    if (!t) return null
    const lista = await listInventarios()
    if (inventarioAbertoComMesmoTitulo(lista, t, id)) return null
    sessao.titulo = t
  }
  if (patch.local !== undefined) {
    const l = patch.local.trim()
    if (l) sessao.local = l
  }
  await saveInventario(sessao)
  return sessao
}

export async function atualizarInventarioPosicoes(
  id: string,
  patch: { posicoesNome?: string; posicoesCodigos?: string[] },
): Promise<InventarioSessao | null> {
  const sessao = await getInventario(id)
  if (!sessao) return null
  if (patch.posicoesNome !== undefined) {
    const n = patch.posicoesNome.trim()
    sessao.posicoesNome = n || undefined
  }
  if (patch.posicoesCodigos !== undefined) {
    const codigos = patch.posicoesCodigos.map((c) => c.trim().toUpperCase()).filter(Boolean)
    sessao.posicoesCodigos = codigos.length ? codigos : undefined
  }
  if (!sessao.catalogoProdutos) sessao.catalogoProdutos = 'ultrapao'
  await saveInventario(sessao)
  return sessao
}

export async function configurarInventarioListas(
  id: string,
  patch: {
    listaEnderecamentoId: string
    listaEnderecamentoNome: string
    listaProdutosId: string
    listaProdutosNome: string
  },
): Promise<InventarioSessao | null> {
  const sessao = await getInventario(id)
  if (!sessao) return null
  sessao.listaEnderecamentoId = patch.listaEnderecamentoId
  sessao.listaEnderecamentoNome = patch.listaEnderecamentoNome
  sessao.listaProdutosId = patch.listaProdutosId
  sessao.listaProdutosNome = patch.listaProdutosNome
  await saveInventario(sessao)
  return sessao
}

export function inventarioListasConfiguradas(sessao: InventarioSessao): boolean {
  return Boolean(sessao.listaEnderecamentoId && sessao.listaProdutosId)
}

export function posicoesPermitidas(sessao: InventarioSessao): Set<string> | null {
  const list = sessao.posicoesCodigos
  if (!list?.length) return null
  return new Set(list.map((c) => c.trim().toUpperCase()))
}

export function enderecoPermitidoNaSessao(sessao: InventarioSessao, codigo: string): boolean {
  const permitidos = posicoesPermitidas(sessao)
  if (!permitidos) return true
  return permitidos.has(codigo.trim().toUpperCase())
}

export { inventarioSyncHabilitado } from './inventarioSessaoSupabase'
