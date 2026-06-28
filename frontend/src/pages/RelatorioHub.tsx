import { useState } from 'react'
import RelatorioContagem from './RelatorioContagem'

type Tab = 'contagem_diaria' | 'inventario'

export default function RelatorioHub() {
  const [tab, setTab] = useState<Tab>('contagem_diaria')

  return (
    <div className="page-panel page-panel--wide">
      <h1 className="page-panel__title">Relatórios</h1>
      <p className="page-panel__subtitle">
        Exporte planilhas Excel e consulte o histórico de contagem diária ou de inventário físico.
      </p>

      <div className="page-tabs" role="tablist" aria-label="Tipo de relatório">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'contagem_diaria'}
          className={`page-tabs__btn${tab === 'contagem_diaria' ? ' page-tabs__btn--active' : ''}`}
          onClick={() => setTab('contagem_diaria')}
        >
          Contagem diária
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'inventario'}
          className={`page-tabs__btn${tab === 'inventario' ? ' page-tabs__btn--active' : ''}`}
          onClick={() => setTab('inventario')}
        >
          Inventário
        </button>
      </div>

      <div className="page-tabs__panel" role="tabpanel">
        {tab === 'contagem_diaria' ? (
          <RelatorioContagem key="rel-cd" lockListColumnMode listColumnPrefsInventario={false} />
        ) : (
          <RelatorioContagem key="rel-inv" lockListColumnMode listColumnPrefsInventario />
        )}
      </div>
    </div>
  )
}
