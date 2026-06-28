import { useMemo, useState } from 'react'
import InventarioPainel from '../components/inventario/InventarioPainel'
import {
  criarInventario,
  fecharInventario,
  listInventarios,
  type InventarioSessao,
} from '../lib/inventarioSessaoStore'

type Props = {
  onAbrirCaptura: (inventarioId: string) => void
}

function formatData(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

export default function InventarioGerenciar({ onAbrirCaptura }: Props) {
  const [rows, setRows] = useState<InventarioSessao[]>(() => listInventarios())
  const [painelKey, setPainelKey] = useState(0)
  const [local, setLocal] = useState('ULTRAPAO GUARULHOS DISTRI')

  const abertos = useMemo(() => rows.filter((r) => r.status === 'aberto'), [rows])

  function refresh() {
    setRows(listInventarios())
    setPainelKey((k) => k + 1)
  }

  function handleCriar() {
    const inv = criarInventario({ local })
    refresh()
    onAbrirCaptura(inv.id)
  }

  return (
    <div className="page-panel">
      <InventarioPainel refreshKey={painelKey} />

      <h1 className="page-panel__title">Inventários</h1>
      <p className="page-panel__subtitle">
        Crie um inventário e abra a tela de captura (estilo coletor) para bipar endereço, código de barras, quantidade,
        lote e validade — sem campo pallet.
      </p>

      <div className="page-form-grid" style={{ maxWidth: 520 }}>
        <label>
          Local / unidade
          <input value={local} onChange={(e) => setLocal(e.target.value)} />
        </label>
        <div className="page-form-grid__actions">
          <button type="button" onClick={handleCriar}>
            Criar inventário
          </button>
        </div>
      </div>

      {abertos.length > 0 ? (
        <p style={{ marginTop: 16, color: '#86efac' }}>
          {abertos.length} inventário(s) aberto(s)
        </p>
      ) : null}

      <div className="page-table-wrap" style={{ marginTop: 20 }}>
        <table className="page-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Título</th>
              <th>Status</th>
              <th>Linhas</th>
              <th>Início</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.numero}</td>
                <td>{r.titulo}</td>
                <td>{r.status === 'aberto' ? 'Aberto' : 'Fechado'}</td>
                <td>{r.linhas.length}</td>
                <td>{formatData(r.dataInicio)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {r.status === 'aberto' ? (
                    <>
                      <button type="button" onClick={() => onAbrirCaptura(r.id)}>
                        Capturar
                      </button>
                      <button
                        type="button"
                        className="page-btn-ghost"
                        onClick={() => {
                          if (confirm('Fechar este inventário?')) {
                            fecharInventario(r.id)
                            refresh()
                          }
                        }}
                      >
                        Fechar
                      </button>
                    </>
                  ) : (
                    <button type="button" className="page-btn-ghost" onClick={() => onAbrirCaptura(r.id)}>
                      Ver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
