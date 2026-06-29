import { useMemo, useState } from 'react'
import InventarioPosicoesModal from '../components/inventario/InventarioPosicoesModal'
import {
  atualizarInventarioMeta,
  criarInventario,
  fecharInventario,
  listInventarios,
  type InventarioSessao,
} from '../lib/inventarioSessaoStore'

type Props = {
  onAbrirCaptura: (inventarioId: string) => void
}

type ListaTab = 'todos' | 'abertos' | 'finalizados'

function formatData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

function labelColeta(inv: InventarioSessao) {
  return inv.linhas.length === 0 ? 'Começar inventário' : 'Continuar'
}

function labelPosicoes(inv: InventarioSessao) {
  const n = inv.posicoesCodigos?.length ?? 0
  if (n === 0) return 'Todas (livre)'
  const nome = inv.posicoesNome?.trim()
  return nome ? `${nome} (${n})` : `${n} posição(ões)`
}

export default function InventarioGerenciar({ onAbrirCaptura }: Props) {
  const [rows, setRows] = useState<InventarioSessao[]>(() => listInventarios())
  const [listaTab, setListaTab] = useState<ListaTab>('todos')
  const [criarOpen, setCriarOpen] = useState(false)
  const [criarTitulo, setCriarTitulo] = useState('')
  const [criarLocal, setCriarLocal] = useState('ULTRAPAO GUARULHOS DISTRI')
  const [editarId, setEditarId] = useState<string | null>(null)
  const [editarTitulo, setEditarTitulo] = useState('')
  const [editarLocal, setEditarLocal] = useState('')
  const [posicoesInvId, setPosicoesInvId] = useState<string | null>(null)

  const inventarioPosicoes = useMemo(
    () => (posicoesInvId ? rows.find((r) => r.id === posicoesInvId) : undefined),
    [posicoesInvId, rows],
  )

  const abertos = useMemo(() => rows.filter((r) => r.status === 'aberto'), [rows])
  const finalizados = useMemo(() => rows.filter((r) => r.status === 'fechado'), [rows])

  const listaFiltrada = useMemo(() => {
    if (listaTab === 'abertos') return abertos
    if (listaTab === 'finalizados') return finalizados
    return rows
  }, [rows, listaTab, abertos, finalizados])

  function refresh() {
    setRows(listInventarios())
  }

  function abrirModalCriar() {
    setCriarTitulo('')
    setCriarLocal('ULTRAPAO GUARULHOS DISTRI')
    setCriarOpen(true)
  }

  function handleCriar() {
    const titulo = criarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome do inventário.')
      return
    }
    criarInventario({ titulo, local: criarLocal })
    setCriarOpen(false)
    setListaTab('abertos')
    refresh()
  }

  function abrirModalEditar(inv: InventarioSessao) {
    setEditarId(inv.id)
    setEditarTitulo(inv.titulo)
    setEditarLocal(inv.local)
  }

  function salvarEdicaoMeta() {
    if (!editarId) return
    const titulo = editarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome do inventário.')
      return
    }
    atualizarInventarioMeta(editarId, { titulo, local: editarLocal })
    setEditarId(null)
    refresh()
  }

  function continuarInventario(id: string) {
    onAbrirCaptura(id)
  }

  function renderAcoes(r: InventarioSessao, layout: 'table' | 'card') {
    const btnClass = layout === 'card' ? 'inv-card__btn' : undefined
    const ghostClass = layout === 'card' ? 'inv-card__btn inv-card__btn--ghost' : 'page-btn-ghost'

    if (r.status === 'aberto') {
      return (
        <>
          <button type="button" className={btnClass} onClick={() => continuarInventario(r.id)}>
            {labelColeta(r)}
          </button>
          <button type="button" className={ghostClass} onClick={() => abrirModalEditar(r)}>
            Editar
          </button>
          <button type="button" className={ghostClass} onClick={() => setPosicoesInvId(r.id)}>
            Posições
          </button>
          <button
            type="button"
            className={ghostClass}
            onClick={() => {
              if (confirm('Finalizar este inventário?')) {
                fecharInventario(r.id)
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
        <button type="button" className={ghostClass} onClick={() => abrirModalEditar(r)}>
          Editar
        </button>
        <button type="button" className={ghostClass} onClick={() => setPosicoesInvId(r.id)}>
          Posições
        </button>
        <button type="button" className={ghostClass} onClick={() => onAbrirCaptura(r.id)}>
          Ver
        </button>
      </>
    )
  }

  return (
    <div className="page-panel inv-gerenciar">
      <h1 className="page-panel__title">Inventários</h1>
      <p className="page-panel__subtitle">
        Crie um inventário com nome — configure as <strong>posições</strong> (endereços) e use a lista de produtos{' '}
        <strong>Ultrapao</strong> (aba Produtos → Todos os Produtos). Depois clique em <strong>Começar inventário</strong>{' '}
        para coletar.
      </p>

      <div className="page-form-grid inv-gerenciar__criar">
        <div className="page-form-grid__actions">
          <button type="button" onClick={abrirModalCriar}>
            Criar inventário
          </button>
        </div>
      </div>

      <div className="page-tabs inv-gerenciar__tabs" role="tablist" aria-label="Filtro de inventários">
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
        <p className="inv-gerenciar__hint">{abertos.length} inventário(s) aberto(s)</p>
      ) : null}

      <div className="inv-list-cards">
        {listaFiltrada.length === 0 ? (
          <p className="inv-list-empty">Nenhum inventário nesta lista.</p>
        ) : (
          listaFiltrada.map((r) => (
            <article key={r.id} className="inv-card">
              <div className="inv-card__head">
                <span className="inv-card__num">#{r.numero}</span>
                <span className={r.status === 'aberto' ? 'inv-status inv-status--open' : 'inv-status inv-status--closed'}>
                  {r.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                </span>
              </div>
              <h3 className="inv-card__title">{r.titulo}</h3>
              <p className="inv-card__meta">{r.local}</p>
              <p className="inv-card__meta inv-card__meta--pos">{labelPosicoes(r)}</p>
              <dl className="inv-card__stats">
                <div>
                  <dt>Linhas</dt>
                  <dd>{r.linhas.length}</dd>
                </div>
                <div>
                  <dt>Início</dt>
                  <dd>{formatData(r.dataInicio)}</dd>
                </div>
                {r.dataFim ? (
                  <div>
                    <dt>Fim</dt>
                    <dd>{formatData(r.dataFim)}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="inv-card__actions">{renderAcoes(r, 'card')}</div>
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
              <th>Posições</th>
              <th>Status</th>
              <th>Linhas</th>
              <th>Início</th>
              <th>Fim</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.length === 0 ? (
              <tr>
                <td colSpan={9}>Nenhum inventário nesta lista.</td>
              </tr>
            ) : (
              listaFiltrada.map((r) => (
                <tr key={r.id}>
                  <td>{r.numero}</td>
                  <td>{r.titulo}</td>
                  <td>{r.local}</td>
                  <td className="inv-posicoes-cell">{labelPosicoes(r)}</td>
                  <td>
                    <span className={r.status === 'aberto' ? 'inv-status inv-status--open' : 'inv-status inv-status--closed'}>
                      {r.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                    </span>
                  </td>
                  <td>{r.linhas.length}</td>
                  <td>{formatData(r.dataInicio)}</td>
                  <td>{formatData(r.dataFim)}</td>
                  <td className="inv-actions-cell">{renderAcoes(r, 'table')}</td>
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
          aria-labelledby="inv-criar-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCriarOpen(false)
          }}
        >
          <div className="page-modal">
            <div className="page-modal__head">
              <h2 id="inv-criar-title">Novo inventário</h2>
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
                Nome do inventário *
                <input
                  value={criarTitulo}
                  onChange={(e) => setCriarTitulo(e.target.value)}
                  placeholder="ex.: Inventário câmara 21 — validade"
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
          aria-labelledby="inv-editar-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditarId(null)
          }}
        >
          <div className="page-modal">
            <div className="page-modal__head">
              <h2 id="inv-editar-title">Editar inventário</h2>
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
                Nome do inventário *
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

      {inventarioPosicoes ? (
        <InventarioPosicoesModal
          inventario={inventarioPosicoes}
          onClose={() => setPosicoesInvId(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  )
}
