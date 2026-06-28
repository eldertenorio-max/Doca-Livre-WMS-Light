import { useMemo, useState } from 'react'
import {
  atualizarInventarioMeta,
  criarInventario,
  fecharInventario,
  listInventarios,
  reabrirInventario,
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

export default function InventarioGerenciar({ onAbrirCaptura }: Props) {
  const [rows, setRows] = useState<InventarioSessao[]>(() => listInventarios())
  const [listaTab, setListaTab] = useState<ListaTab>('todos')
  const [criarOpen, setCriarOpen] = useState(false)
  const [criarTitulo, setCriarTitulo] = useState('')
  const [criarLocal, setCriarLocal] = useState('ULTRAPAO GUARULHOS DISTRI')
  const [editarId, setEditarId] = useState<string | null>(null)
  const [editarTitulo, setEditarTitulo] = useState('')
  const [editarLocal, setEditarLocal] = useState('')

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

  function handleCriar(iniciarColeta: boolean) {
    const titulo = criarTitulo.trim()
    if (!titulo) {
      alert('Informe o nome do inventário.')
      return
    }
    const inv = criarInventario({ titulo, local: criarLocal })
    setCriarOpen(false)
    refresh()
    if (iniciarColeta) onAbrirCaptura(inv.id)
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

  function getInventarioSeguro(id: string) {
    return rows.find((r) => r.id === id)
  }

  function continuarInventario(id: string, reabrir: boolean) {
    if (reabrir) {
      const inv = getInventarioSeguro(id)
      if (inv?.status === 'fechado') {
        if (!confirm('Reabrir este inventário finalizado para continuar a coleta?')) return
        reabrirInventario(id)
        refresh()
      }
    }
    onAbrirCaptura(id)
  }

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Inventários</h1>
      <p className="page-panel__subtitle">
        Crie um inventário com nome, inicie a coleta (endereço, código de barras, quantidade, lote e validade) e
        reabra ou edite inventários já finalizados.
      </p>

      <div className="page-form-grid" style={{ maxWidth: 520 }}>
        <div className="page-form-grid__actions">
          <button type="button" onClick={abrirModalCriar}>
            Criar inventário
          </button>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Filtro de inventários" style={{ marginTop: 20 }}>
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
        <p style={{ marginTop: 12, color: '#86efac' }}>{abertos.length} inventário(s) aberto(s)</p>
      ) : null}

      <div className="page-table-wrap" style={{ marginTop: 16 }}>
        <table className="page-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nome</th>
              <th>Local</th>
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
                <td colSpan={8}>Nenhum inventário nesta lista.</td>
              </tr>
            ) : (
              listaFiltrada.map((r) => (
                <tr key={r.id}>
                  <td>{r.numero}</td>
                  <td>{r.titulo}</td>
                  <td>{r.local}</td>
                  <td>
                    <span className={r.status === 'aberto' ? 'inv-status inv-status--open' : 'inv-status inv-status--closed'}>
                      {r.status === 'aberto' ? 'Aberto' : 'Finalizado'}
                    </span>
                  </td>
                  <td>{r.linhas.length}</td>
                  <td>{formatData(r.dataInicio)}</td>
                  <td>{formatData(r.dataFim)}</td>
                  <td className="inv-actions-cell">
                    {r.status === 'aberto' ? (
                      <>
                        <button type="button" onClick={() => continuarInventario(r.id, false)}>
                          Continuar
                        </button>
                        <button type="button" className="page-btn-ghost" onClick={() => abrirModalEditar(r)}>
                          Editar
                        </button>
                        <button
                          type="button"
                          className="page-btn-ghost"
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
                    ) : (
                      <>
                        <button type="button" onClick={() => continuarInventario(r.id, true)}>
                          Continuar
                        </button>
                        <button type="button" className="page-btn-ghost" onClick={() => abrirModalEditar(r)}>
                          Editar
                        </button>
                        <button type="button" className="page-btn-ghost" onClick={() => onAbrirCaptura(r.id)}>
                          Ver
                        </button>
                      </>
                    )}
                  </td>
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
                    if (e.key === 'Enter') handleCriar(true)
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
              <button type="button" className="page-btn-ghost" onClick={() => handleCriar(false)}>
                Só criar
              </button>
              <button type="button" onClick={() => handleCriar(true)}>
                Criar e iniciar
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
    </div>
  )
}
