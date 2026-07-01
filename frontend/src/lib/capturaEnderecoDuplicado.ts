import { normalizeEnderecoCodigo } from './enderecamentoStore'

type LinhaComEndereco = { id: string; endereco?: string | null }

/** Chave normalizada para comparar câmara + rua + posição + nível. */
export function chaveEnderecoCaptura(endereco: string | null | undefined): string {
  return normalizeEnderecoCodigo(String(endereco ?? '')).toUpperCase()
}

/** Endereços que aparecem em mais de uma linha da sessão. */
export function enderecosDuplicadosNasLinhas(linhas: LinhaComEndereco[]): Set<string> {
  const contagem = new Map<string, number>()
  for (const ln of linhas) {
    const key = chaveEnderecoCaptura(ln.endereco)
    if (!key) continue
    contagem.set(key, (contagem.get(key) ?? 0) + 1)
  }
  const out = new Set<string>()
  for (const [key, n] of contagem) {
    if (n > 1) out.add(key)
  }
  return out
}

export function linhasComMesmoEndereco(
  linhas: LinhaComEndereco[],
  endereco: string,
  excludeId?: string | null,
): LinhaComEndereco[] {
  const key = chaveEnderecoCaptura(endereco)
  if (!key) return []
  return linhas.filter((ln) => {
    if (excludeId && ln.id === excludeId) return false
    return chaveEnderecoCaptura(ln.endereco) === key
  })
}

export function confirmarSalvarEnderecoRepetido(endereco: string, qtdExistente: number): boolean {
  const end = endereco.trim() || '—'
  return window.confirm(
    `O endereço ${end} já foi usado ${qtdExistente} vez(es) nesta sessão.\n\nDeseja acrescentar outra linha neste mesmo endereço?\n\nOK = sim, acrescentar assim mesmo\nCancelar = voltar e informar outro endereço`,
  )
}

export function classeLinhaCapturaEndereco(opts: {
  editando: boolean
  endereco: string | null | undefined
  enderecosRepetidos: Set<string>
}): string | undefined {
  const parts: string[] = []
  if (opts.editando) parts.push('inv-cap__linha--editando')
  const key = chaveEnderecoCaptura(opts.endereco)
  if (key && opts.enderecosRepetidos.has(key)) parts.push('inv-cap__linha--endereco-repetido')
  return parts.length ? parts.join(' ') : undefined
}
