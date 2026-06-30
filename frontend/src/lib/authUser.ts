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

export type ConferenteRef = { id: string; nome: string }

/** Nome (e id, se cadastrado) do conferente vinculado ao usuário logado. */
export function resolveConferenteDoUsuarioLogado(
  session: Session | null | undefined,
  conferentes: ConferenteRef[],
): ConferenteRef | null {
  const logado = usernameFromSession(session).trim()
  if (!logado || logado === 'usuário') return null
  const alvo = logado.toLowerCase()
  const exato = conferentes.find((c) => c.nome.trim().toLowerCase() === alvo)
  if (exato) return exato
  const parcial = conferentes.find(
    (c) =>
      c.nome.trim().toLowerCase().includes(alvo) ||
      alvo.includes(c.nome.trim().toLowerCase()),
  )
  if (parcial) return parcial
  return { id: '', nome: logado }
}
