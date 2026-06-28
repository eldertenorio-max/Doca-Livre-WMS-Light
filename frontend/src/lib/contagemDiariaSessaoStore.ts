export type ContagemDiariaSessao = {
  id: string
  numero: number
  titulo: string
  local: string
  /** Dia civil da contagem (YYYY-MM-DD). */
  dataContagem: string
  /** Nome do conferente (usuário logado na criação). */
  conferenteNome?: string
  dataInicio: string
  dataFim: string | null
  status: 'aberto' | 'fechado'
  /** Usuário já abriu a tela de coleta pelo menos uma vez. */
  iniciada: boolean
  createdAt: string
}

const STORAGE_KEY = 'contagem-diaria-sessoes-v1'

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function readAll(): ContagemDiariaSessao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ContagemDiariaSessao[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: ContagemDiariaSessao[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export function listContagensDiarias(): ContagemDiariaSessao[] {
  return readAll().sort((a, b) => b.numero - a.numero)
}

export function getContagemDiaria(id: string): ContagemDiariaSessao | undefined {
  return readAll().find((r) => r.id === id)
}

function nextNumero(): number {
  const all = readAll()
  if (!all.length) return 1
  return Math.max(...all.map((r) => r.numero)) + 1
}

export function criarContagemDiaria(opts?: {
  titulo?: string
  local?: string
  dataContagem?: string
  conferenteNome?: string
}): ContagemDiariaSessao {
  const all = readAll()
  const numero = nextNumero()
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
  }
  all.push(row)
  writeAll(all)
  return row
}

export function saveContagemDiaria(sessao: ContagemDiariaSessao) {
  const all = readAll()
  const idx = all.findIndex((r) => r.id === sessao.id)
  if (idx >= 0) all[idx] = sessao
  else all.push(sessao)
  writeAll(all)
}

export function marcarContagemIniciada(id: string) {
  const sessao = getContagemDiaria(id)
  if (!sessao || sessao.iniciada) return
  sessao.iniciada = true
  saveContagemDiaria(sessao)
}

export function fecharContagemDiaria(id: string) {
  const sessao = getContagemDiaria(id)
  if (!sessao) return
  sessao.status = 'fechado'
  sessao.dataFim = new Date().toISOString()
  saveContagemDiaria(sessao)
}

export function reabrirContagemDiaria(id: string): ContagemDiariaSessao | null {
  const sessao = getContagemDiaria(id)
  if (!sessao) return null
  sessao.status = 'aberto'
  sessao.dataFim = null
  saveContagemDiaria(sessao)
  return sessao
}

export function atualizarContagemDiariaMeta(
  id: string,
  patch: { titulo?: string; local?: string; dataContagem?: string },
): ContagemDiariaSessao | null {
  const sessao = getContagemDiaria(id)
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
  saveContagemDiaria(sessao)
  return sessao
}

export function formatDataContagemBR(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(ymd)
  if (!m) return ymd
  return `${m[3]}/${m[2]}/${m[1]}`
}
