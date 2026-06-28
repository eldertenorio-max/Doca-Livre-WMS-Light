export type EnderecoCadastro = {
  id: string
  codigo: string
  camara: number | null
  rua: string
  posicao: number | null
  nivel: number | null
  observacao: string
  ativo: boolean
  createdAt: string
}

const STORAGE_KEY = 'enderecamento-cadastro-v1'

function readAll(): EnderecoCadastro[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as EnderecoCadastro[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: EnderecoCadastro[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

export function listEnderecos(): EnderecoCadastro[] {
  return readAll().filter((r) => r.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
}

export function listEnderecosTodos(): EnderecoCadastro[] {
  return readAll().sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
}

export function findEnderecoByCodigo(codigo: string): EnderecoCadastro | undefined {
  const q = String(codigo ?? '').trim().toUpperCase()
  if (!q) return undefined
  return readAll().find((r) => r.ativo && r.codigo.trim().toUpperCase() === q)
}

export function saveEndereco(
  input: Omit<EnderecoCadastro, 'id' | 'createdAt'> & { id?: string },
): EnderecoCadastro {
  const all = readAll()
  const now = new Date().toISOString()
  if (input.id) {
    const idx = all.findIndex((r) => r.id === input.id)
    const row: EnderecoCadastro = {
      id: input.id,
      codigo: input.codigo.trim(),
      camara: input.camara,
      rua: input.rua.trim(),
      posicao: input.posicao,
      nivel: input.nivel,
      observacao: input.observacao.trim(),
      ativo: input.ativo,
      createdAt: idx >= 0 ? all[idx].createdAt : now,
    }
    if (idx >= 0) all[idx] = row
    else all.push(row)
    writeAll(all)
    return row
  }
  const row: EnderecoCadastro = {
    id: crypto.randomUUID(),
    codigo: input.codigo.trim(),
    camara: input.camara,
    rua: input.rua.trim(),
    posicao: input.posicao,
    nivel: input.nivel,
    observacao: input.observacao.trim(),
    ativo: input.ativo,
    createdAt: now,
  }
  all.push(row)
  writeAll(all)
  return row
}

export function deleteEndereco(id: string) {
  writeAll(readAll().filter((r) => r.id !== id))
}
