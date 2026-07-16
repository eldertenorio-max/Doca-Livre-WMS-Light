import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import './App.css'
import AppHeader from './components/layout/AppHeader'
import AppShell from './components/layout/AppShell'
import type { SidebarItem } from './components/layout/ExpandableSidebar'
import { SidebarNavIcon } from './components/layout/SidebarNavIcon'
import SystemEntryScreen from './pages/SystemEntryScreen'
import BaseProdutos from './pages/BaseProdutos'
import ProdutosFamilia from './pages/ProdutosFamilia'
import ProdutosGrupos from './pages/ProdutosGrupos'
import ProdutosImportacaoPlanilha from './pages/ProdutosImportacaoPlanilha'
import ProdutosSubGrupos from './pages/ProdutosSubGrupos'
import CadastroEnderecamento from './pages/CadastroEnderecamento'
import ContagemDiariaAmbiental from './pages/ContagemDiariaAmbiental'
import ContagemCaptura from './pages/ContagemCaptura'
import ContagemEstoque from './pages/ContagemEstoque'
import ContagemGerenciar from './pages/ContagemGerenciar'
import EstoqueConsulta from './pages/EstoqueConsulta'
import EstoqueSeguranca from './pages/EstoqueSeguranca'
import InventarioCaptura from './pages/InventarioCaptura'
import InventarioGerenciar from './pages/InventarioGerenciar'
import PainelPage from './pages/PainelPage'
import PermissoesAcessoPage from './pages/PermissoesAcessoPage'
import AcessoPendenteScreen from './pages/AcessoPendenteScreen'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'
import { tituloApp } from './lib/appAmbiente'
import { clearSessaoProdutoListaContext } from './lib/sessaoProdutoListaContext'
import type { AppView } from './lib/appViews'
import {
  canAccessView,
  filterSidebarByPermissions,
  firstAllowedView,
  permissoesViewsToSet,
} from './lib/appPermissions'
import { isAppAdmin } from './lib/authUser'
import { getStoredSidebarOpen, storeSidebarOpen } from './lib/sidebarOpen'
import { useTheme } from './hooks/useTheme'
import { fetchMeuAcesso } from './lib/usuarioPermissoesStore'
import { getSystemById, type SystemId } from './lib/systemPortal'
import {
  clearPortalSsoClaim,
  clearPortalSsoTokenFromUrl,
  consumeLightSsoToken,
  readPortalSsoTokenFromLocation,
} from './lib/consumePortalSso'
import {
  clearPortalEntryMarker,
  goToProPortal,
  hasPortalEntryMarker,
  markPortalEntry,
  redirectDirectAccessToProPortal,
} from './lib/portalGate'
import { PortalBackButton } from './components/PortalBackButton'

export type { AppView } from './lib/appViews'

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Painel]', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, maxWidth: 560, margin: '0 auto', color: 'var(--text, #e5e7eb)' }}>
          <h2 style={{ color: '#f87171', marginTop: 0 }}>Erro ao exibir esta aba</h2>
          <p style={{ fontSize: 14 }}>{this.state.error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function navIcon(id: string) {
  return <SidebarNavIcon id={id} />
}

export default function App() {
  const authEnabled = isSupabaseConfigured()
  const initialSsoToken = typeof window !== 'undefined' ? readPortalSsoTokenFromLocation() : null
  const skippedDirectRedirect =
    typeof window !== 'undefined'
      ? !redirectDirectAccessToProPortal({ hasSsoToken: Boolean(initialSsoToken) })
      : true
  const enteredViaPortal = Boolean(initialSsoToken) || hasPortalEntryMarker()
  const [selectedSystemId, setSelectedSystemId] = useState<SystemId | null>(() =>
    enteredViaPortal ? 'light' : null,
  )
  const [session, setSession] = useState<Session | null>(null)
  const [ssoBootstrapping, setSsoBootstrapping] = useState(() => Boolean(initialSsoToken))
  const [ssoError, setSsoError] = useState<string | null>(null)
  const [view, setView] = useState<AppView>('painel')
  const [capturaInventarioId, setCapturaInventarioId] = useState<string | null>(null)
  const [capturaContagemId, setCapturaContagemId] = useState<string | null>(null)
  const [permissoesViews, setPermissoesViews] = useState<string[] | null>(null)
  const [acessoAutorizado, setAcessoAutorizado] = useState(true)
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(() => !isSupabaseConfigured())
  const [recarregandoAcesso, setRecarregandoAcesso] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(() => getStoredSidebarOpen())
  const sessionActive = Boolean(session)
  const { theme, toggleTheme } = useTheme({ authEnabled, sessionActive })

  useEffect(() => {
    storeSidebarOpen(sidebarOpen)
  }, [sidebarOpen])

  // Marca entrada pelo portal assim que o token SSO aparece (antes do async).
  useEffect(() => {
    if (!initialSsoToken) return
    markPortalEntry()
    clearPortalSsoTokenFromUrl()
  }, [initialSsoToken])

  const adminUser = isAppAdmin(session)
  const allowedViews = useMemo(() => permissoesViewsToSet(permissoesViews), [permissoesViews])

  const carregarMeuAcesso = useCallback(async (userId: string) => {
    setPermissoesCarregadas(false)
    const acesso = await fetchMeuAcesso(userId)
    setPermissoesViews(acesso.permissoesViews)
    setAcessoAutorizado(acesso.acessoAutorizado)
    setPermissoesCarregadas(true)
  }, [])

  useEffect(() => {
    if (!authEnabled || !session) {
      setPermissoesViews(null)
      setAcessoAutorizado(true)
      setPermissoesCarregadas(true)
      return
    }
    if (isAppAdmin(session)) {
      setPermissoesViews(null)
      setAcessoAutorizado(true)
      setPermissoesCarregadas(true)
      return
    }
    let alive = true
    void fetchMeuAcesso(session.user.id).then((acesso) => {
      if (!alive) return
      setPermissoesViews(acesso.permissoesViews)
      setAcessoAutorizado(acesso.acessoAutorizado)
      setPermissoesCarregadas(true)
    })
    return () => {
      alive = false
    }
  }, [authEnabled, session])

  useEffect(() => {
    document.title = tituloApp()
  }, [])

  useEffect(() => {
    if (!authEnabled) return
    if (!skippedDirectRedirect) return
    let alive = true
    const ssoToken = readPortalSsoTokenFromLocation()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      if (alive) setSession(s)
    })

    if (ssoToken) {
      setSsoBootstrapping(true)
      setSsoError(null)
      markPortalEntry()
      clearPortalSsoTokenFromUrl()
      void consumeLightSsoToken(ssoToken)
        .then(async (result) => {
          if (!alive) return
          if (!result.ok) {
            setSsoBootstrapping(false)
            clearPortalSsoClaim()
            // Mostra o erro no Light — não devolve ao hub em loop silencioso.
            setSsoError(result.error || 'Falha no SSO do Light.')
            return
          }
          const { data: sessData, error } = await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          })
          if (!alive) return
          if (error || !sessData.session) {
            setSsoBootstrapping(false)
            clearPortalSsoClaim()
            setSsoError(error?.message || 'Falha ao aplicar sessão SSO.')
            return
          }
          // Sem session no state, o render redirecionava ao hub (loop).
          setSession(sessData.session)
          markPortalEntry()
          clearPortalSsoClaim()
          setSelectedSystemId('light')
          setSsoBootstrapping(false)
        })
        .catch(() => {
          if (!alive) return
          setSsoBootstrapping(false)
          clearPortalSsoClaim()
          setSsoError('Falha ao processar SSO do Light.')
        })
    } else if (hasPortalEntryMarker()) {
      void supabase.auth.getSession().then(({ data }) => {
        if (!alive) return
        if (data.session) {
          setSession(data.session)
          setSelectedSystemId('light')
        } else {
          clearPortalEntryMarker()
          goToProPortal()
        }
      })
    } else {
      void supabase.auth.signOut().finally(() => {
        if (alive) setSession(null)
      })
    }

    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [authEnabled, skippedDirectRedirect])

  // Redirects só em useEffect (nunca no render) — evita loop hub ↔ Light no SSO.
  useEffect(() => {
    if (!skippedDirectRedirect || ssoBootstrapping || ssoError) return
    if (!selectedSystemId) {
      goToProPortal()
      return
    }
    if (authEnabled && !session && !hasPortalEntryMarker()) {
      goToProPortal()
    }
  }, [skippedDirectRedirect, ssoBootstrapping, ssoError, selectedSystemId, authEnabled, session])

  const sidebarItemsBase: SidebarItem[] = useMemo(
    () => [
      { id: 'painel', label: 'Painel', icon: navIcon('painel') },
      {
        id: 'produtos',
        label: 'Produtos',
        icon: navIcon('produtos'),
        children: [
          { id: 'produtosFamilia', label: 'Família' },
          { id: 'produtosGrupos', label: 'Grupos' },
          { id: 'produtosImportacao', label: 'Importação de Planilha de Produtos' },
          { id: 'produtos', label: 'Produtos' },
          { id: 'produtosSubGrupos', label: 'SubGrupos' },
        ],
      },
      { id: 'temperatura', label: 'Temperatura', icon: navIcon('temperatura') },
      { id: 'ocupacao', label: 'Ocupação', icon: navIcon('ocupacao') },
      { id: 'seguranca', label: 'Estoque de segurança', icon: navIcon('seguranca') },
      { id: 'enderecamento', label: 'Endereçamento', icon: navIcon('enderecamento') },
      { id: 'inventarios', label: 'Inventários', icon: navIcon('inventarios') },
      { id: 'contagem', label: 'Contagem diária', icon: navIcon('contagem') },
      { id: 'estoque', label: 'Estoque', icon: navIcon('estoque') },
    ],
    [],
  )

  const sidebarItems: SidebarItem[] = useMemo(() => {
    const filtrados = filterSidebarByPermissions(sidebarItemsBase, adminUser ? null : allowedViews)
    if (adminUser) {
      return [
        ...filtrados,
        {
          id: 'permissoes',
          label: 'Permissões de acesso',
          icon: navIcon('permissoes'),
        },
      ]
    }
    return filtrados
  }, [sidebarItemsBase, allowedViews, adminUser])

  useEffect(() => {
    if (!permissoesCarregadas) return
    if (!authEnabled || adminUser) return
    if (canAccessView(view, allowedViews, false)) return
    setView(firstAllowedView(allowedViews))
  }, [permissoesCarregadas, authEnabled, adminUser, view, allowedViews])

  const activeSidebarId =
    view === 'inventarioCaptura' ? 'inventarios' : view === 'contagemCaptura' ? 'contagem' : view

  function navigate(id: string) {
    const next = id as AppView
    if (authEnabled && permissoesCarregadas && !canAccessView(next, allowedViews, adminUser)) {
      return
    }
    if (id === 'inventarios') setCapturaInventarioId(null)
    if (id === 'contagem') setCapturaContagemId(null)
    setView(next)
  }

  function abrirCaptura(inventarioId: string) {
    setCapturaInventarioId(inventarioId)
    setView('inventarioCaptura')
  }

  function abrirContagem(contagemId: string) {
    setCapturaContagemId(contagemId)
    setView('contagemCaptura')
  }

  function handleBackToSystemSelector() {
    clearPortalEntryMarker()
    void supabase.auth.signOut().finally(() => {
      goToProPortal()
    })
  }

  function handleBackToSystemsHub() {
    // Volta ao hub Light/Plus/Pro sem encerrar a sessão do portal.
    goToProPortal(false)
  }

  function handleSignOut() {
    clearPortalEntryMarker()
    void supabase.auth.signOut().finally(() => {
      goToProPortal(true)
    })
  }

  if (!skippedDirectRedirect) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text, #0f172a)' }}>
        Redirecionando ao portal Doca Livre…
      </div>
    )
  }

  if (ssoBootstrapping) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text, #0f172a)' }}>
        Entrando pelo portal Doca Livre…
      </div>
    )
  }

  if (ssoError) {
    return (
      <div style={{ padding: 32, maxWidth: 520, margin: '48px auto', color: 'var(--text, #0f172a)' }}>
        <h2 style={{ marginTop: 0 }}>Não foi possível entrar no WMS Light</h2>
        <p>{ssoError}</p>
        <p style={{ fontSize: 14, opacity: 0.85 }}>
          Volte ao hub e tente de novo. Se o erro falar em <strong>sso-entrar</strong>, a função SSO
          precisa ser publicada no Supabase do Light.
        </p>
        <button type="button" onClick={() => goToProPortal(false)}>
          Voltar aos sistemas
        </button>
      </div>
    )
  }

  if (!selectedSystemId) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text, #0f172a)' }}>
        Redirecionando ao portal Doca Livre…
      </div>
    )
  }

  const selectedSystem = getSystemById(selectedSystemId)
  if (selectedSystem?.url) {
    return (
      <SystemEntryScreen
        system={selectedSystem}
        onBack={handleBackToSystemSelector}
        onEnter={() => window.location.assign(selectedSystem.url!)}
      />
    )
  }

  if (authEnabled && !session) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text, #0f172a)' }}>
        Entrando no WMS Light…
      </div>
    )
  }

  if (authEnabled && session && permissoesCarregadas && !adminUser && !acessoAutorizado) {
    return (
      <AcessoPendenteScreen
        session={session}
        recarregando={recarregandoAcesso}
        onSignOut={handleSignOut}
        onRecarregar={() => {
          if (!session.user?.id) return
          setRecarregandoAcesso(true)
          void carregarMeuAcesso(session.user.id).finally(() => setRecarregandoAcesso(false))
        }}
      />
    )
  }

  const sidebarFooter = (
    <button
      type="button"
      className="app-sidebar__footer-btn"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      <span className="app-sidebar__footer-icon" aria-hidden>
        {theme === 'dark' ? (
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5z"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="app-sidebar__footer-label">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
    </button>
  )

  return (
    <>
      <PortalBackButton onClick={handleBackToSystemsHub} label="Sistemas" />
    <AppShell
      items={sidebarItems}
      activeId={activeSidebarId}
      onNavigate={navigate}
      footer={sidebarFooter}
      sidebarOpen={sidebarOpen}
      header={
        <AppHeader
          session={session}
          authEnabled={authEnabled}
          theme={theme}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen((open) => !open)}
          onThemeToggle={toggleTheme}
          onSignOut={handleSignOut}
        />
      }
    >
      {view === 'produtos' ? <BaseProdutos /> : null}
      {view === 'produtosFamilia' ? <ProdutosFamilia /> : null}
      {view === 'produtosGrupos' ? <ProdutosGrupos /> : null}
      {view === 'produtosImportacao' ? <ProdutosImportacaoPlanilha /> : null}
      {view === 'produtosSubGrupos' ? <ProdutosSubGrupos /> : null}
      {view === 'temperatura' ? (
        <PanelErrorBoundary>
          <ContagemDiariaAmbiental initialTab="temperatura" lockTab />
        </PanelErrorBoundary>
      ) : null}
      {view === 'ocupacao' ? (
        <PanelErrorBoundary>
          <ContagemDiariaAmbiental initialTab="ocupacao" lockTab />
        </PanelErrorBoundary>
      ) : null}
      {view === 'seguranca' ? (
        <PanelErrorBoundary>
          <EstoqueSeguranca />
        </PanelErrorBoundary>
      ) : null}
      {view === 'enderecamento' ? <CadastroEnderecamento /> : null}
      {view === 'painel' ? (
        <PanelErrorBoundary>
          <PainelPage />
        </PanelErrorBoundary>
      ) : null}
      {view === 'inventarios' ? (
        <InventarioGerenciar onAbrirCaptura={abrirCaptura} session={session} />
      ) : null}
      {view === 'inventarioCaptura' && capturaInventarioId ? (
        <InventarioCaptura
          inventarioId={capturaInventarioId}
          session={session}
          onVoltar={() => {
            clearSessaoProdutoListaContext()
            setCapturaInventarioId(null)
            setView('inventarios')
          }}
        />
      ) : null}
      {view === 'contagem' ? (
        <PanelErrorBoundary>
          <ContagemGerenciar onAbrirContagem={abrirContagem} session={session} />
        </PanelErrorBoundary>
      ) : null}
      {view === 'contagemCaptura' && capturaContagemId ? (
        <ContagemCaptura
          contagemId={capturaContagemId}
          session={session}
          onVoltar={() => {
            clearSessaoProdutoListaContext()
            setCapturaContagemId(null)
            setView('contagem')
          }}
        />
      ) : null}
      {view === 'estoque' ? (
        <PanelErrorBoundary>
          <EstoqueConsulta />
        </PanelErrorBoundary>
      ) : null}
      {view === 'permissoes' ? (
        <PanelErrorBoundary>
          <PermissoesAcessoPage session={session} />
        </PanelErrorBoundary>
      ) : null}
    </AppShell>
    </>
  )
}
