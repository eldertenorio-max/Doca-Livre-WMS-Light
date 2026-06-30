import { supabase } from './supabaseClient'
import { formatUnknownError } from './supabaseError'

export type Conferente = { id: string; nome: string }

/** Evita erro PostgreSQL 22P02 ao gravar string vazia em coluna uuid. */
export function conferenteIdParaBanco(id: string | null | undefined): string | null {
  const s = String(id ?? '').trim()
  return s || null
}

export function resolveConferenteIdPorNome(
  nome: string | undefined,
  conferentes: Conferente[],
): string | null {
  const alvo = String(nome ?? '').trim()
  if (!alvo) return null
  const lower = alvo.toLowerCase()
  const exato = conferentes.find((c) => c.nome.trim().toLowerCase() === lower)
  if (exato) return exato.id
  const parcial = conferentes.find(
    (c) =>
      c.nome.trim().toLowerCase().includes(lower) ||
      lower.includes(c.nome.trim().toLowerCase()),
  )
  return parcial?.id ?? null
}

const SEM_CONFERENTE_LABEL = 'Sem conferente'

/**
 * Garante UUID válido para colunas NOT NULL (`contagens_inventario`, etc.).
 * Cria conferente no banco quando o nome da captura não está cadastrado.
 */
export async function ensureConferenteIdParaGravacao(
  nome: string | undefined,
  conferentes: Conferente[],
): Promise<string> {
  const resolved = resolveConferenteIdPorNome(nome, conferentes)
  if (resolved) return resolved

  const label = String(nome ?? '').trim() || SEM_CONFERENTE_LABEL
  const exatoLabel = conferentes.find((c) => c.nome.trim().toLowerCase() === label.toLowerCase())
  if (exatoLabel) return exatoLabel.id

  const sem = conferentes.find((c) => c.nome.trim().toLowerCase() === SEM_CONFERENTE_LABEL.toLowerCase())
  if (sem) return sem.id

  try {
    const novo = await cadastrarConferente(label)
    conferentes.push(novo)
    return novo.id
  } catch {
    if (conferentes[0]?.id) return conferentes[0].id
    throw new Error(
      `Conferente "${label}" não encontrado e não foi possível cadastrar. Cadastre em Conferentes antes de exportar.`,
    )
  }
}

export async function listConferentes(): Promise<Conferente[]> {
  const { data, error } = await supabase.from('conferentes').select('id,nome').order('nome')
  if (error) throw error
  return data ?? []
}

export async function cadastrarConferente(nome: string): Promise<Conferente> {
  const trimmed = nome.trim()
  if (!trimmed) throw new Error('Informe o nome do conferente.')

  const { data, error } = await supabase
    .from('conferentes')
    .insert({ nome: trimmed })
    .select('id,nome')
    .maybeSingle()

  if (error) {
    if (error.code === '42501' || String(error.message).toLowerCase().includes('row-level security')) {
      throw new Error(
        'Sem permissão para cadastrar conferente no banco. Rode o SQL de policy (RLS) no Supabase para liberar insert em conferentes.',
      )
    }
    throw new Error(formatUnknownError(error) || 'Erro ao cadastrar conferente.')
  }
  if (!data?.id) throw new Error('Conferente não foi criado.')
  return data
}
