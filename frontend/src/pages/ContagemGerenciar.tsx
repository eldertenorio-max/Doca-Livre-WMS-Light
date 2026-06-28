import { useMemo, useState } from 'react'
import {
  atualizarContagemDiariaMeta,
  criarContagemDiaria,
  fecharContagemDiaria,
  formatDataContagemBR,
  listContagensDiarias,
  reabrirContagemDiaria,
  type ContagemDiariaSessao,
} from '../lib/contagemDiariaSessaoStore'

type Props = {
  onAbrirContagem: (contagemId: string) => void
}

type ListaTab = 'todos' | 'abertos' | 'finalizados'

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

export default function ContagemGerenciar({ onAbrirContagem }: Props) {
  const [rows, setRows] = useState<ContagemDiariaSessao[]>(() => listContagensDiarias())
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

  function refresh() {
    setRows(listContagensDiarias())
  }

  function abrirModalCriar() {
    setCriarTitulo('')
    setCriarLocal('ULTRAPAO GUARULHOS DISTRI')
    setCriarData(todayYmdLocal())
    setCriarOpen(true)
  }

  function handleCriar() {
    const titulo = criarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome da contagem.')
      return
    }
    criarContagemDiaria({ titulo, local: criarLocal, dataContagem: criarData })
    setCriarOpen(false)
    setListaTab('abertos')
    refresh()
  }

  function abrirModalEditar(c: ContagemDiariaSessao) {
    setEditarId(c.id)
    setEditarTitulo(c.titulo)
    setEditarLocal(c.local)
    setEditarData(c.dataContagem)
  }

  function salvarEdicaoMeta() {
    if (!editarId) return
    const titulo = editarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome da contagem.')
      return
    }
    atualizarContagemDiariaMeta(editarId, { titulo, local: editarLocal, dataContagem: editarData })
    setEditarId(null)
    refresh()
  }

  function continuarContagem(id: string, reabrir: boolean) {
    if (reabrir) {
      const c = rows.find((r) => r.id === id)
      if (c?.status === 'fechado') {
        if (!confirm('Reabrir esta contagem finalizada para continuar?')) return
        reabrirContagemDiaria(id)
        refresh()
      }
    }
    onAbrirContagem(id)
  }

  function renderAcoes(c: ContagemDiariaSessao, layout: 'table' | 'card') {
    const btnClass = layout === 'card' ? 'inv-card__btn' : undefined
    const ghostClass = layout === 'card' ? 'inv-card__btn inv-card__btn--ghost' : 'page-btn-ghost'

    if (c.status === 'aberto') {
      return (
        <>
          <button type="button" className={btnClass} onClick={() => continuarContagem(c.id, false)}>
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
                fecharContagemDiaria(c.id)
                refresh()
              }
            }}
          >
            Finalizar
          </button>
        </>
      )
    }

    return (
      <>
        <button type="button" className={btnClass} onClick={() => continuarContagem(c.id, true)}>
          Continuar contagem
        </button>
        <button type="button" className={ghostClass} onClick={() => abrirModalEditar(c)}>
          Editar
        </button>
        <button type="button" className={ghostClass} onClick={() => onAbrirContagem(c.id)}>
          Ver
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
                  value={criarTitulo}
                  onChange={(e) => setCriarTitulo(e.target.value)}
                  placeholder="ex.: Contagem câmara 21 — turno manhã"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCriar()
                  }}
                />
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
