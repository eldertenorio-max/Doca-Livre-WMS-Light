import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { usernameFromSession } from '../lib/authUser'
import {
  atualizarContagemDiariaMeta,
  criarContagemDiaria,
  deleteContagemDiaria,
  fecharContagemDiaria,
  formatDataContagemBR,
  listContagensDiarias,
  reabrirContagemDiaria,
  type ContagemDiariaSessao,
} from '../lib/contagemDiariaSessaoStore'
import { formatUnknownError } from '../lib/supabaseError'

type Props = {
  onAbrirContagem: (contagemId: string) => void
  session?: Session | null
}

type ListaTab = 'todos' | 'abertos' | 'finalizados'

const SUGESTOES_NOME_CONTAGEM = [
  'Contagem Turno da Manhã',
  'Contagem Turno da Tarde',
  'Contagem Turno da Noite',
] as const

function formatData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function labelColeta(c: ContagemDiariaSessao) {
  return c.iniciada ? 'Continuar contagem' : 'Começar contagem'
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export default function ContagemGerenciar({ onAbrirContagem, session }: Props) {
  const conferenteLogado = usernameFromSession(session)
  const [rows, setRows] = useState<ContagemDiariaSessao[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [listaTab, setListaTab] = useState<ListaTab>('todos')
  const [criarOpen, setCriarOpen] = useState(false)
  const [criarTitulo, setCriarTitulo] = useState('')
  const [criarLocal, setCriarLocal] = useState('ULTRAPAO GUARULHOS DISTRI')
  const [criarData, setCriarData] = useState(() => todayYmdLocal())
  const [editarId, setEditarId] = useState<string | null>(null)
  const [editarTitulo, setEditarTitulo] = useState('')
  const [editarLocal, setEditarLocal] = useState('')
  const [editarData, setEditarData] = useState('')

  const abertos = useMemo(() => rows.filter((r) => r.status === 'aberto'), [rows])
  const finalizados = useMemo(() => rows.filter((r) => r.status === 'fechado'), [rows])

  const listaFiltrada = useMemo(() => {
    if (listaTab === 'abertos') return abertos
    if (listaTab === 'finalizados') return finalizados
    return rows
  }, [rows, listaTab, abertos, finalizados])

  async function refresh() {
    setLoading(true)
    setLoadError('')
    try {
      setRows(await listContagensDiarias())
    } catch (e: unknown) {
      setLoadError(formatUnknownError(e) || 'Erro ao carregar contagens.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function abrirModalCriar() {
    setCriarTitulo('')
    setCriarLocal('ULTRAPAO GUARULHOS DISTRI')
    setCriarData(todayYmdLocal())
    setCriarOpen(true)
  }

  async function handleCriar() {
    const titulo = criarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome da contagem.')
      return
    }
    try {
      await criarContagemDiaria({
        titulo,
        local: criarLocal,
        dataContagem: criarData,
        conferenteNome: conferenteLogado,
      })
      setCriarOpen(false)
      setListaTab('abertos')
      await refresh()
    } catch (e: unknown) {
      alert(formatUnknownError(e) || 'Erro ao criar contagem.')
    }
  }

  function abrirModalEditar(c: ContagemDiariaSessao) {
    setEditarId(c.id)
    setEditarTitulo(c.titulo)
    setEditarLocal(c.local)
    setEditarData(c.dataContagem)
  }

  async function salvarEdicaoMeta() {
    if (!editarId) return
    const titulo = editarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome da contagem.')
      return
    }
    try {
      await atualizarContagemDiariaMeta(editarId, { titulo, local: editarLocal, dataContagem: editarData })
      setEditarId(null)
      await refresh()
    } catch (e: unknown) {
      alert(formatUnknownError(e) || 'Erro ao salvar contagem.')
    }
  }

  async function continuarContagem(id: string) {
    onAbrirContagem(id)
  }

  async function entrarEAlterarContagem(c: ContagemDiariaSessao) {
    if (
      !confirm(
        `A contagem «${c.titulo}» está finalizada.\n\nDeseja reabrir para entrar e alterar?`,
      )
    ) {
      return
    }
    try {
      await reabrirContagemDiaria(c.id)
      await refresh()
      onAbrirContagem(c.id)
    } catch (e: unknown) {
      alert(formatUnknownError(e) || 'Erro ao reabrir contagem.')
    }
  }

  async function handleExcluir(c: ContagemDiariaSessao) {
    const msg = c.iniciada
      ? `Excluir a contagem "${c.titulo}"? Ela já foi iniciada e deixará de aparecer na lista.`
      : `Excluir a contagem "${c.titulo}"?`
    if (!confirm(msg)) return
    try {
      await deleteContagemDiaria(c.id)
      if (editarId === c.id) setEditarId(null)
      await refresh()
    } catch (e: unknown) {
      alert(formatUnknownError(e) || 'Erro ao excluir contagem.')
    }
  }

  function renderAcoes(c: ContagemDiariaSessao, layout: 'table' | 'card') {
    const btnClass = layout === 'card' ? 'inv-card__btn' : undefined
    const ghostClass = layout === 'card' ? 'inv-card__btn inv-card__btn--ghost' : 'page-btn-ghost'
    const dangerClass =
      layout === 'card'
        ? 'inv-card__btn inv-card__btn--ghost inv-card__btn--danger'
        : 'page-btn-ghost page-btn-danger'

    if (c.status === 'aberto') {
      return (
        <>
          <button type="button" className={btnClass} onClick={() => void continuarContagem(c.id)}>
            {labelColeta(c)}
          </button>
          <button type="button" className={ghostClass} onClick={() => abrirModalEditar(c)}>
            Editar
          </button>
          <button
            type="button"
            className={ghostClass}
            onClick={() => {
              if (confirm('Finalizar esta contagem?')) {
                void fecharContagemDiaria(c.id).then(() => refresh())
              }
            }}
          >
            Finalizar
          </button>
          <button type="button" className={dangerClass} onClick={() => handleExcluir(c)}>
            Excluir
          </button>
        </>
      )
    }

    return (
      <>
        <span className="inv-status inv-status--closed inv-actions-finalizado" title="Contagem finalizada">
          Finalizado
        </span>
        <button type="button" className={ghostClass} onClick={() => abrirModalEditar(c)}>
          Editar
        </button>
        <button type="button" className={btnClass} onClick={() => void entrarEAlterarContagem(c)}>
          Entrar e alterar
        </button>
        <button type="button" className={ghostClass} onClick={() => onAbrirContagem(c.id)}>
          Ver
        </button>
        <button type="button" className={dangerClass} onClick={() => handleExcluir(c)}>
          Excluir
        </button>
      </>
    )
  }

  return (
    <div className="page-panel inv-gerenciar">
      <h1 className="page-panel__title">Contagem diária</h1>
      <p className="page-panel__subtitle">
        Crie uma contagem com nome — ela aparecerá na lista. Depois clique em <strong>Começar contagem</strong> na
        linha para abrir a checklist.
      </p>

      <div className="page-form-grid inv-gerenciar__criar">
        <div className="page-form-grid__actions">
          <button type="button" onClick={abrirModalCriar}>
            Criar contagem
          </button>
        </div>
      </div>

      <div className="page-tabs inv-gerenciar__tabs" role="tablist" aria-label="Filtro de contagens">
        <button
          type="button"
          role="tab"
          aria-selected={listaTab === 'todos'}
          className={`page-tabs__btn${listaTab === 'todos' ? ' page-tabs__btn--active' : ''}`}
          onClick={() => setListaTab('todos')}
        >
          Todos ({rows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={listaTab === 'abertos'}
          className={`page-tabs__btn${listaTab === 'abertos' ? ' page-tabs__btn--active' : ''}`}
          onClick={() => setListaTab('abertos')}
        >
          Abertos ({abertos.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={listaTab === 'finalizados'}
          className={`page-tabs__btn${listaTab === 'finalizados' ? ' page-tabs__btn--active' : ''}`}
          onClick={() => setListaTab('finalizados')}
        >
          Finalizados ({finalizados.length})
        </button>
      </div>

      {abertos.length > 0 ? (
        <p className="inv-gerenciar__hint">{abertos.length} contagem(ns) aberta(s)</p>
      ) : null}

      <div className="inv-list-cards">
        {listaFiltrada.length === 0 ? (
          <p className="inv-list-empty">Nenhuma contagem nesta lista.</p>
        ) : (
          listaFiltrada.map((c) => (
            <article key={c.id} className="inv-card">
              <div className="inv-card__head">
                <span className="inv-card__num">#{c.numero}</span>
                <span className={c.status === 'aberto' ? 'inv-status inv-status--open' : 'inv-status inv-status--closed'}>
                  {c.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                </span>
              </div>
              <h3 className="inv-card__title">{c.titulo}</h3>
              <p className="inv-card__meta">
                {c.local} · Dia {formatDataContagemBR(c.dataContagem)}
              </p>
              <dl className="inv-card__stats">
                <div>
                  <dt>Início</dt>
                  <dd>{formatData(c.dataInicio)}</dd>
                </div>
                {c.dataFim ? (
                  <div>
                    <dt>Fim</dt>
                    <dd>{formatData(c.dataFim)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="inv-card__actions">{renderAcoes(c, 'card')}</div>
            </article>
          ))
        )}
      </div>

      <div className="page-table-wrap inv-list-table">
        <table className="page-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Local</th>
              <th>Dia</th>
              <th>Status</th>
              <th>Início</th>
              <th>Fim</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan={8}>Nenhuma contagem nesta lista.</td>
              </tr>
            ) : (
              listaFiltrada.map((c) => (
                <tr key={c.id}>
                  <td>{c.numero}</td>
                  <td>{c.titulo}</td>
                  <td>{c.local}</td>
                  <td>{formatDataContagemBR(c.dataContagem)}</td>
                  <td>
                    <span className={c.status === 'aberto' ? 'inv-status inv-status--open' : 'inv-status inv-status--closed'}>
                      {c.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                    </span>
                  </td>
                  <td>{formatData(c.dataInicio)}</td>
                  <td>{formatData(c.dataFim)}</td>
                  <td className="inv-actions-cell">{renderAcoes(c, 'table')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {criarOpen ? (
        <div
          className="page-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contagem-criar-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCriarOpen(false)
          }}
        >
          <div className="page-modal">
            <div className="page-modal__head">
              <h2 id="contagem-criar-title">Nova contagem diária</h2>
              <button
                type="button"
                className="page-modal__close"
                aria-label="Fechar"
                onClick={() => setCriarOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="page-modal__body page-form-grid">
              <label className="page-form-grid__full">
                Nome da contagem *
                <input
                  list="contagem-nome-sugestoes"
                  value={criarTitulo}
                  onChange={(e) => setCriarTitulo(e.target.value)}
                  placeholder="Selecione na lista ou digite o nome"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCriar()
                  }}
                />
                <datalist id="contagem-nome-sugestoes">
                  {SUGESTOES_NOME_CONTAGEM.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </label>
              <label className="page-form-grid__full">
                Conferente
                <input value={conferenteLogado} readOnly aria-readonly="true" />
              </label>
              <label className="page-form-grid__full">
                Local / unidade
                <input value={criarLocal} onChange={(e) => setCriarLocal(e.target.value)} />
              </label>
              <label className="page-form-grid__full">
                Dia da contagem
                <input type="date" value={criarData} onChange={(e) => setCriarData(e.target.value)} />
              </label>
            </div>
            <div className="page-modal__foot">
              <button type="button" className="page-btn-ghost" onClick={() => setCriarOpen(false)}>
                Cancelar
              </button>
              <button type="button" onClick={handleCriar}>
                Criar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editarId ? (
        <div
          className="page-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contagem-editar-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditarId(null)
          }}
        >
          <div className="page-modal">
            <div className="page-modal__head">
              <h2 id="contagem-editar-title">Editar contagem</h2>
              <button
                type="button"
                className="page-modal__close"
                aria-label="Fechar"
                onClick={() => setEditarId(null)}
              >
                ×
              </button>
            </div>
            <div className="page-modal__body page-form-grid">
              <label className="page-form-grid__full">
                Nome da contagem *
                <input
                  value={editarTitulo}
                  onChange={(e) => setEditarTitulo(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') salvarEdicaoMeta()
                  }}
                />
              </label>
              <label className="page-form-grid__full">
                Local / unidade
                <input value={editarLocal} onChange={(e) => setEditarLocal(e.target.value)} />
              </label>
              <label className="page-form-grid__full">
                Dia da contagem
                <input type="date" value={editarData} onChange={(e) => setEditarData(e.target.value)} />
              </label>
            </div>
            <div className="page-modal__foot">
              <button type="button" className="page-btn-ghost" onClick={() => setEditarId(null)}>
                Cancelar
              </button>
              <button type="button" onClick={salvarEdicaoMeta}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
