export type InventarioLinhaCaptura = {
  id: string
  endereco: string
  codigoBarras: string
  codigoInterno: string
  descricao: string
  quantidade: number
  unidade: string
  up: string
  lote: string
  fabricacao: string
  validade: string
  createdAt: string
}

export type InventarioSessao = {
  id: string
  numero: number
  titulo: string
  local: string
  /** Nome do conjunto de posições deste inventário (ex.: Câmara 11 — Rua A). */
  posicoesNome?: string
  /** Códigos de endereço selecionados para este inventário; vazio = qualquer endereço. */
  posicoesCodigos?: string[]
  /** Catálogo de produtos (sempre Ultrapao = Todos os Produtos). */
  catalogoProdutos?: 'ultrapao'
  dataInicio: string
  dataFim: string | null
  status: 'aberto' | 'fechado'
  linhas: InventarioLinhaCaptura[]
  createdAt: string
}

const STORAGE_KEY = 'inventario-sessoes-v2'

function readAll(): InventarioSessao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as InventarioSessao[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: InventarioSessao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export function listInventarios(): InventarioSessao[] {
  return readAll().sort((a, b) => b.numero - a.numero)
}

/** Comparação de nome (ignora maiúsculas/minúsculas e espaços nas pontas). */
export function normalizarTituloInventario(titulo: string): string {
  return String(titulo ?? '')
    .trim()
    .toLowerCase()
}

/** Inventário aberto com o mesmo nome (opcional: ignorar um id na edição). */
export function inventarioAbertoComMesmoTitulo(
  titulo: string,
  ignorarId?: string,
): InventarioSessao | undefined {
  const key = normalizarTituloInventario(titulo)
  if (!key) return undefined
  return readAll().find(
    (r) =>
      r.status === 'aberto' &&
      r.id !== ignorarId &&
      normalizarTituloInventario(r.titulo) === key,
  )
}

export function mensagemTituloInventarioEmUso(titulo: string, existente?: InventarioSessao): string {
  const dup = existente ?? inventarioAbertoComMesmoTitulo(titulo)
  if (!dup) return ''
  return `Já existe um inventário aberto com o nome "${dup.titulo}" (#${dup.numero}). Finalize-o antes de usar esse nome.`
}

export function getInventario(id: string): InventarioSessao | undefined {
  return readAll().find((r) => r.id === id)
}

export function nextInventarioNumero(): number {
  const all = readAll()
  if (!all.length) return 1
  return Math.max(...all.map((r) => r.numero)) + 1
}

export function criarInventario(opts?: {
  titulo?: string
  local?: string
  posicoesNome?: string
  posicoesCodigos?: string[]
}): InventarioSessao | null {
  const all = readAll()
  const numero = nextInventarioNumero()
  const tituloFinal = opts?.titulo?.trim() || `Inventário (Validade) #${numero}`
  if (inventarioAbertoComMesmoTitulo(tituloFinal)) return null

  const now = new Date().toISOString()
  const row: InventarioSessao = {
    id: crypto.randomUUID(),
    numero,
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
  }
  all.push(row)
  writeAll(all)
  return row
}

export function saveInventario(sessao: InventarioSessao) {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === sessao.id)
  if (idx >= 0) all[idx] = sessao
  else all.push(sessao)
  writeAll(all)
}

export function addLinhaInventario(inventarioId: string, linha: Omit<InventarioLinhaCaptura, 'id' | 'createdAt'>) {
  const sessao = getInventario(inventarioId)
  if (!sessao || sessao.status !== 'aberto') return null
  const row: InventarioLinhaCaptura = {
    ...linha,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  sessao.linhas = [...sessao.linhas, row]
  saveInventario(sessao)
  return row
}

export function fecharInventario(id: string) {
  const sessao = getInventario(id)
  if (!sessao) return
  sessao.status = 'fechado'
  sessao.dataFim = new Date().toISOString()
  saveInventario(sessao)
}

export function reabrirInventario(id: string): InventarioSessao | null {
  const sessao = getInventario(id)
  if (!sessao) return null
  if (inventarioAbertoComMesmoTitulo(sessao.titulo, id)) return null
  sessao.status = 'aberto'
  sessao.dataFim = null
  saveInventario(sessao)
  return sessao
}

export function deleteInventario(id: string): boolean {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === id)
  if (idx < 0) return false
  all.splice(idx, 1)
  writeAll(all)
  return true
}

export function atualizarInventarioMeta(
  id: string,
  patch: { titulo?: string; local?: string },
): InventarioSessao | null {
  const sessao = getInventario(id)
  if (!sessao) return null
  if (patch.titulo !== undefined) {
    const t = patch.titulo.trim()
    if (!t) return null
    if (inventarioAbertoComMesmoTitulo(t, id)) return null
    sessao.titulo = t
  }
  if (patch.local !== undefined) {
    const l = patch.local.trim()
    if (l) sessao.local = l
  }
  saveInventario(sessao)
  return sessao
}

export function atualizarInventarioPosicoes(
  id: string,
  patch: { posicoesNome?: string; posicoesCodigos?: string[] },
): InventarioSessao | null {
  const sessao = getInventario(id)
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
  saveInventario(sessao)
  return sessao
}

/** Códigos de posição permitidos na sessão (normalizados). Vazio = sem restrição. */
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
