import { SystemProductMark } from '../components/SystemProductMark'
import { LOGO_DOCA_LIVRE_SRC } from '../lib/brandAssets'
import { isHomologacao } from '../lib/appAmbiente'
import { getSystemOptions, type SystemId } from '../lib/systemPortal'
import './SystemSelectorScreen.css'

type Props = {
  onSelect: (id: SystemId) => void
}

export default function SystemSelectorScreen({ onSelect }: Props) {
  const systems = getSystemOptions()

  return (
    <div className="system-selector" role="main">
      <div className="system-selector__inner">
        <header className="system-selector__header">
          <img src={LOGO_DOCA_LIVRE_SRC} alt="" className="system-selector__header-logo" />
          <p className="system-selector__eyebrow">Doca Livre Sistemas</p>
          <h1 className="system-selector__title">
            Escolha o <span className="system-selector__title-accent">sistema</span>
          </h1>
          <p className="system-selector__subtitle">
            Selecione qual plataforma Doca Livre deseja acessar
          </p>
          {isHomologacao() ? (
            <span className="system-selector__badge">Homologação</span>
          ) : null}
        </header>

        <div className="system-selector__grid">
          {systems.map((system) => (
            <button
              key={system.id}
              type="button"
              className={`system-selector__card${system.logoOnly ? ' system-selector__card--original' : ''}`}
              onClick={() => onSelect(system.id)}
            >
              <SystemProductMark
                variant={system.variant}
                productName={system.productName}
                logoSrc={system.logoSrc}
                logoOnly={system.logoOnly}
                compact
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
