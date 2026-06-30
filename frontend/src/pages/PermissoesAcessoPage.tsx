import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ALL_MENU_VIEW_IDS, APP_MENU_PERMISSIONS } from '../lib/appPermissions'
import { isAppAdmin } from '../lib/authUser'
import { formatUnknownError } from '../lib/supabaseError'
import {
  fetchUsuariosComPermissoes,
  salvarPermissoesUsuario,
  type UsuarioComPermissoes,
} from '../lib/usuarioPermissoesStore'
import { PageInfoBlock, PagePanelHeading } from '../components/ui/PagePanelHeading'
import './PermissoesAcessoPage.css'

type Props = {
  session: Session | null
}

type DraftMap = Record<string, Set<string> | null>

function cloneDraftFromUsuarios(usuarios: UsuarioComPermissoes[]): DraftMap {
  const out: DraftMap = {}
  for (const u of usuarios) {
    out[u.id] = u.permissoesViews == null ? null : new Set(u.permissoesViews)
  }
  return out
}

function draftLabel(draft: Set<string> | null | undefined): string {
  if (draft == null) return 'Acesso total'
  if (draft.size === 0) return 'Nenhuma tela'
  return `${draft.size} tela(s)`
}

export default function PermissoesAcessoPage({ session }: Props) {
  const admin = isAppAdmin(session)
  const [usuarios, setUsuarios] = useState<UsuarioComPermissoes[]>([])
  const [draft, setDraft] = useState<DraftMap>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const lista = await fetchUsuariosComPermissoes()
      setUsuarios(lista)
      setDraft(cloneDraftFromUsuarios(lista))
      setSelectedId((prev) => {
        if (prev && lista.some((u) => u.id === prev)) return prev
        return lista[0]?.id ?? null
      })
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao carregar usuários.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (admin) void carregar()
    else setLoading(false)
  }, [admin, carregar])

  const selected = useMemo(
    () => usuarios.find((u) => u.id === selectedId) ?? null,
    [usuarios, selectedId],
  )

  const selectedDraft = selected ? draft[selected.id] : undefined

  function setSelectedDraft(next: Set<string> | null) {
    if (!selected) return
    setDraft((d) => ({ ...d, [selected.id]: next }))
  }

  function toggleView(viewId: string, checked: boolean) {
    if (!selected) return
    const current = draft[selected.id]
    if (current == null) {
      const base = new Set(ALL_MENU_VIEW_IDS)
      if (!checked) base.delete(viewId)
      setSelectedDraft(base)
      return
    }
    const next = new Set(current)
    if (checked) next.add(viewId)
    else next.delete(viewId)
    setSelectedDraft(next)
  }

  function marcarTodas() {
    setSelectedDraft(null)
  }

  function desmarcarTodas() {
    setSelectedDraft(new Set())
  }

  async function salvar() {
    if (!selected) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const views = draft[selected.id] ?? null
      const payload = views == null ? null : [...views]
      await salvarPermissoesUsuario(selected.id, payload)
      setUsuarios((list) =>
        list.map((u) => (u.id === selected.id ? { ...u, permissoesViews: payload } : u)),
      )
      setSuccess(`Permissões de ${selected.nome || selected.username} salvas.`)
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!admin) {
    return (
      <div className="page-panel">
        <p className="page-msg page-msg--error">Acesso restrito ao administrador.</p>
      </div>
    )
  }

  const grupos = [...new Set(APP_MENU_PERMISSIONS.map((p) => p.group).filter(Boolean))] as string[]

  return (
    <div className="page-panel page-panel--wide permissoes-page">
      <PagePanelHeading
        title="Permissões de acesso"
        info={
          <>
            <PageInfoBlock>
              Defina quais telas do menu cada usuário cadastrado pode ver. <strong>Acesso total</strong>{' '}
              (padrão) libera todas as telas; marque apenas as desejadas para restringir.
            </PageInfoBlock>
            <PageInfoBlock title="Importante">
              Rode o SQL <code>alter_usuarios_permissoes_views.sql</code> no Supabase se a lista de usuários
              não carregar.
            </PageInfoBlock>
          </>
        }
      />

      {error ? <p className="page-msg page-msg--error">{error}</p> : null}
      {success ? <p className="page-msg page-msg--ok">{success}</p> : null}

      <div className="permissoes-page__layout">
        <section className="permissoes-page__lista" aria-label="Usuários cadastrados">
          <div className="permissoes-page__lista-head">
            <h2 className="permissoes-page__subtitle">Usuários</h2>
            <button type="button" className="page-btn-ghost" disabled={loading} onClick={() => void carregar()}>
              Atualizar
            </button>
          </div>
          {loading ? (
            <p className="permissoes-page__hint">Carregando…</p>
          ) : usuarios.length === 0 ? (
            <p className="permissoes-page__hint">Nenhum usuário encontrado.</p>
          ) : (
            <ul className="permissoes-page__users">
              {usuarios.map((u) => {
                const isSelf = session?.user?.id === u.id
                const active = u.id === selectedId
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`permissoes-page__user-btn${active ? ' permissoes-page__user-btn--active' : ''}`}
                      onClick={() => setSelectedId(u.id)}
                    >
                      <span className="permissoes-page__user-nome">
                        {u.nome || u.username || '—'}
                        {isSelf ? ' (você)' : ''}
                      </span>
                      <span className="permissoes-page__user-meta">
                        @{u.username || '—'} · {draftLabel(draft[u.id])}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="permissoes-page__editor" aria-label="Telas permitidas">
          {!selected ? (
            <p className="permissoes-page__hint">Selecione um usuário à esquerda.</p>
          ) : (
            <>
              <div className="permissoes-page__editor-head">
                <div>
                  <h2 className="permissoes-page__subtitle">{selected.nome || selected.username}</h2>
                  <p className="permissoes-page__hint">
                    Login: <strong>{selected.username || '—'}</strong> · {draftLabel(selectedDraft)}
                  </p>
                </div>
                <div className="permissoes-page__editor-actions">
                  <button type="button" className="page-btn-ghost" onClick={marcarTodas}>
                    Acesso total
                  </button>
                  <button type="button" className="page-btn-ghost" onClick={desmarcarTodas}>
                    Nenhuma
                  </button>
                  <button type="button" disabled={saving} onClick={() => void salvar()}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>

              <div className="permissoes-page__checks">
                {grupos.length > 0
                  ? grupos.map((grupo) => (
                      <fieldset key={grupo} className="permissoes-page__fieldset">
                        <legend>{grupo}</legend>
                        <div className="permissoes-page__check-grid">
                          {APP_MENU_PERMISSIONS.filter((p) => p.group === grupo).map((p) => {
                            const checked =
                              selectedDraft == null ? true : selectedDraft.has(p.id)
                            return (
                              <label key={p.id} className="permissoes-page__check">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => toggleView(p.id, e.target.checked)}
                                />
                                <span>{p.label}</span>
                              </label>
                            )
                          })}
                        </div>
                      </fieldset>
                    ))
                  : null}

                <fieldset className="permissoes-page__fieldset">
                  <legend>Operação</legend>
                  <div className="permissoes-page__check-grid">
                    {APP_MENU_PERMISSIONS.filter((p) => !p.group).map((p) => {
                      const checked = selectedDraft == null ? true : selectedDraft.has(p.id)
                      return (
                        <label key={p.id} className="permissoes-page__check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleView(p.id, e.target.checked)}
                          />
                          <span>{p.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
