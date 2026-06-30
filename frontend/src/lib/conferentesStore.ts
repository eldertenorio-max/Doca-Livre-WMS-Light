import { supabase } from './supabaseClient'
import { formatUnknownError } from './supabaseError'

export type Conferente = { id: string; nome: string }

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
