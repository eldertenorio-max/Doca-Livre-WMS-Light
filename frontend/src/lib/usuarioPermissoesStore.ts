import { parsePermissoesViewsFromDb } from './appPermissions'
import { formatUnknownError } from './supabaseError'
import { supabase } from './supabaseClient'

export type UsuarioComPermissoes = {
  id: string
  nome: string
  username: string
  ativo: boolean
  permissoesViews: string[] | null
}

function mapUsuarioRow(row: Record<string, unknown>): UsuarioComPermissoes {
  return {
    id: String(row.id ?? ''),
    nome: String(row.nome ?? '').trim(),
    username: String(row.username ?? '').trim(),
    ativo: row.ativo !== false,
    permissoesViews: parsePermissoesViewsFromDb(row.permissoes_views),
  }
}

export async function fetchMinhasPermissoes(userId: string): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('permissoes_views')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    if (import.meta.env.DEV) console.warn('[permissoes] fetchMinhasPermissoes', error)
    return null
  }
  return parsePermissoesViewsFromDb(data?.permissoes_views)
}

export async function fetchUsuariosComPermissoes(): Promise<UsuarioComPermissoes[]> {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id,nome,username,ativo,permissoes_views')
    .order('nome', { ascending: true })
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao listar usuários.')
  return (data ?? []).map((r) => mapUsuarioRow(r as Record<string, unknown>))
}

export async function salvarPermissoesUsuario(
  usuarioId: string,
  views: string[] | null,
): Promise<void> {
  const payload =
    views == null
      ? { permissoes_views: null }
      : { permissoes_views: [...new Set(views.map((v) => v.trim()).filter(Boolean))] }
  const { error } = await supabase.from('usuarios').update(payload).eq('id', usuarioId)
  if (error) throw new Error(formatUnknownError(error) || 'Erro ao salvar permissões.')
}
