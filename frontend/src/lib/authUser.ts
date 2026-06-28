import type { Session } from '@supabase/supabase-js'

export function usernameFromSession(session: Session | null | undefined): string {
  if (!session?.user) return 'usuário'
  const meta = session.user.user_metadata as Record<string, unknown> | undefined
  const fromMeta = meta?.username ?? meta?.nome ?? meta?.name
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim()
  const email = session.user.email ?? ''
  const local = email.split('@')[0]?.trim()
  return local || 'usuário'
}
