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
