export type CapturaLinhaMobileItem = {
  id: string
  numero: number
  codigo: string
  descricao: string
  quantidade: string
  meta?: string
  editando?: boolean
}

type Props = {
  linhas: CapturaLinhaMobileItem[]
  readonly?: boolean
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export default function CapturaLinhasMobile({ linhas, readonly, onEdit, onDelete }: Props) {
  return (
    <ul className="inv-cap__linhas-mobile" aria-label="Linhas salvas">
      {linhas.map((linha) => (
        <li
          key={linha.id}
          className={`inv-cap__linha-card${linha.editando ? ' inv-cap__linha-card--editando' : ''}`}
        >
          <div className="inv-cap__linha-card-top">
            <span className="inv-cap__linha-card-num">#{linha.numero}</span>
            <span className="inv-cap__linha-card-cod">{linha.codigo}</span>
            <span className="inv-cap__linha-card-qtd">{linha.quantidade}</span>
          </div>
          <p className="inv-cap__linha-card-desc">{linha.descricao || '—'}</p>
          {linha.meta ? <p className="inv-cap__linha-card-meta">{linha.meta}</p> : null}
          {!readonly ? (
            <div className="inv-cap__linha-card-acoes">
              <button type="button" className="inv-cap__linha-btn" onClick={() => onEdit?.(linha.id)}>
                Editar
              </button>
              <button
                type="button"
                className="inv-cap__linha-btn inv-cap__linha-btn--danger"
                onClick={() => onDelete?.(linha.id)}
              >
                Excluir
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
