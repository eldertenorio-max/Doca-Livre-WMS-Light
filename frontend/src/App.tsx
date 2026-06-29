import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import './App.css'
import AppHeader from './components/layout/AppHeader'
import AppShell from './components/layout/AppShell'
import type { SidebarItem } from './components/layout/ExpandableSidebar'
import OpeningSplash from './components/OpeningSplash'
import LoginScreen from './pages/LoginScreen'
import BaseProdutos from './pages/BaseProdutos'
import ProdutosFamilia from './pages/ProdutosFamilia'
import ProdutosGrupos from './pages/ProdutosGrupos'
import ProdutosImportacaoPlanilha from './pages/ProdutosImportacaoPlanilha'
import ProdutosSubGrupos from './pages/ProdutosSubGrupos'
import CadastroEnderecamento from './pages/CadastroEnderecamento'
import ContagemDiariaAmbiental from './pages/ContagemDiariaAmbiental'
import ContagemEstoque from './pages/ContagemEstoque'
import ContagemGerenciar from './pages/ContagemGerenciar'
import EstoqueConsulta from './pages/EstoqueConsulta'
import EstoqueSeguranca from './pages/EstoqueSeguranca'
import InventarioCaptura from './pages/InventarioCaptura'
import InventarioGerenciar from './pages/InventarioGerenciar'
import RelatorioHub from './pages/RelatorioHub'
import { isSupabaseConfigured, supabase } from './lib/supabaseClient'

export type AppView =
  | 'produtos'
  | 'produtosFamilia'
  | 'produtosGrupos'
  | 'produtosImportacao'
  | 'produtosSubGrupos'
  | 'temperatura'
  | 'ocupacao'
  | 'seguranca'
  | 'enderecamento'
  | 'inventarios'
  | 'inventarioCaptura'
  | 'contagem'
  | 'contagemCaptura'
  | 'estoque'
  | 'relatorio'

type Theme = 'dark' | 'light'

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

function NavEmoji({ children }: { children: string }) {
  return <span aria-hidden>{children}</span>
}

export default function App() {
  const authEnabled = isSupabaseConfigured()
  const [splashDone, setSplashDone] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [view, setView] = useState<AppView>('inventarios')
  const [capturaInventarioId, setCapturaInventarioId] = useState<string | null>(null)
  const [capturaContagemId, setCapturaContagemId] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('ui-theme')
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ui-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!authEnabled || !session) return
    const saved = localStorage.getItem('ui-theme')
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [authEnabled, session])

  useEffect(() => {
    if (!authEnabled) return
    let alive = true
    void supabase.auth.signOut().finally(() => {
      if (alive) setSession(null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, s: Session | null) => {
      if (alive) setSession(s)
    })
    return () => {
      alive = false
      subscription.unsubscribe()
    }
  }, [authEnabled])

  const sidebarItems: SidebarItem[] = useMemo(
    () => [
      {
        id: 'produtos',
        label: 'Produtos',
        icon: <NavEmoji>📦</NavEmoji>,
        accent: '#fbbf24',
        children: [
          { id: 'produtosFamilia', label: 'Família' },
          { id: 'produtosGrupos', label: 'Grupos' },
          { id: 'produtosImportacao', label: 'Importação de Planilha de Produtos' },
          { id: 'produtos', label: 'Produtos' },
          { id: 'produtosSubGrupos', label: 'SubGrupos' },
        ],
      },
      { id: 'temperatura', label: 'Temperatura', icon: <NavEmoji>🌡️</NavEmoji>, accent: '#22c55e' },
      { id: 'ocupacao', label: 'Ocupação', icon: <NavEmoji>📊</NavEmoji>, accent: '#38bdf8' },
      { id: 'seguranca', label: 'Estoque de segurança', icon: <NavEmoji>🛡️</NavEmoji>, accent: '#2dd4bf' },
      { id: 'enderecamento', label: 'Endereçamento', icon: <NavEmoji>📍</NavEmoji>, accent: '#a78bfa' },
      { id: 'inventarios', label: 'Inventários', icon: <NavEmoji>📦</NavEmoji>, accent: '#26c6da' },
      { id: 'contagem', label: 'Contagem diária', icon: <NavEmoji>📋</NavEmoji>, accent: '#4f8eff' },
      { id: 'estoque', label: 'Estoque', icon: <NavEmoji>📊</NavEmoji>, accent: '#a855f7' },
      { id: 'relatorio', label: 'Relatório', icon: <NavEmoji>📄</NavEmoji>, accent: '#f97316' },
    ],
    [],
  )

  const activeSidebarId =
    view === 'inventarioCaptura' ? 'inventarios' : view === 'contagemCaptura' ? 'contagem' : view

  function navigate(id: string) {
    if (id === 'inventarios') setCapturaInventarioId(null)
    if (id === 'contagem') setCapturaContagemId(null)
    setView(id as AppView)
  }

  function abrirCaptura(inventarioId: string) {
    setCapturaInventarioId(inventarioId)
    setView('inventarioCaptura')
  }

  function abrirContagem(contagemId: string) {
    setCapturaContagemId(contagemId)
    setView('contagemCaptura')
  }

  if (!splashDone) {
    return <OpeningSplash onComplete={() => setSplashDone(true)} />
  }

  if (authEnabled && !session) {
    return <LoginScreen />
  }

  const sidebarFooter = (
    <button
      type="button"
      className="app-sidebar__footer-btn"
      onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
    >
      {theme === 'dark' ? '☀️ Tema claro' : '🌙 Tema escuro'}
    </button>
  )

  return (
    <AppShell
      items={sidebarItems}
      activeId={activeSidebarId}
      onNavigate={navigate}
      footer={sidebarFooter}
      headerExtra={
        <AppHeader
          session={session}
          authEnabled={authEnabled}
          theme={theme}
          onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          onSignOut={() => void supabase.auth.signOut()}
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
      {view === 'inventarios' ? (
        <InventarioGerenciar onAbrirCaptura={abrirCaptura} />
      ) : null}
      {view === 'inventarioCaptura' && capturaInventarioId ? (
        <InventarioCaptura
          inventarioId={capturaInventarioId}
          session={session}
          onVoltar={() => {
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
        <PanelErrorBoundary>
          <ContagemEstoque
            contagemSessaoId={capturaContagemId}
            onVoltarLista={() => {
              setCapturaContagemId(null)
              setView('contagem')
            }}
          />
        </PanelErrorBoundary>
      ) : null}
      {view === 'estoque' ? (
        <PanelErrorBoundary>
          <EstoqueConsulta />
        </PanelErrorBoundary>
      ) : null}
      {view === 'relatorio' ? (
        <PanelErrorBoundary>
          <RelatorioHub />
        </PanelErrorBoundary>
      ) : null}
    </AppShell>
  )
}
