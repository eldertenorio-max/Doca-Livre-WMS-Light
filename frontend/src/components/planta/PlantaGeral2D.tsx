import { useEffect, useMemo, useState } from 'react'
import {
  PLANTA_CAMARAS_ORDEM,
  buildOcupacaoMapFromInventarioItems,
  colunasOrdenadas,
  fetchPlantaLayoutData,
  plantaCamaraMeta,
  plantaCellColors,
  plantaMaxNivel,
  plantaNivelLabel,
  plantaSlotKey,
  plantaSlotsCamara,
  posMapFromSlots,
  slotsPorRua,
  type PlantaAreasEspeciaisJson,
  type PlantaCamaraJson,
  type PlantaLayoutJson,
  type PlantaSlotOcupacao,
} from '../../lib/plantaLayoutModel'
import {
  getCamaraFromGrupo,
  getInventarioRuaArmazem,
  inventarioPlanilhaPosNivelFromIndex,
} from '../inventario/inventarioPlanilhaModel'
import type { OfflineChecklistItem } from '../../lib/offlineContagemSession'
import './PlantaGeral2D.css'

export type PlantaSlotClickPayload = {
  camara: number
  rua: string
  posicao: number
  nivel: number
}

type Props = {
  inventarioItems?: OfflineChecklistItem[]
  selectedCamara?: number | null
  onCamaraSelect?: (camara: number) => void
  onSlotClick?: (payload: PlantaSlotClickPayload) => void
  defaultOpen?: boolean
}

function RackSide(props: {
  camara: number
  rua: string
  enderecos: PlantaCamaraJson['enderecos']
  maxNivel: number
  side: 'esq' | 'dir'
  ocupacaoMap: Map<string, PlantaSlotOcupacao>
  onSlotClick?: (payload: PlantaSlotClickPayload) => void
}) {
  const { camara, rua, enderecos, maxNivel, side, ocupacaoMap, onSlotClick } = props
  const slots = slotsPorRua(enderecos, rua, maxNivel)
  const posMap = posMapFromSlots(slots)
  const colunas = colunasOrdenadas(posMap)
  if (!colunas.length) return <span className="planta-2d-vazio-side">—</span>

  return (
    <div className={`planta-rack-side planta-rack-side--${side}`}>
      {colunas.map((pos) => {
        const niveisMap = posMap.get(pos) ?? new Map()
        return (
          <div key={pos} className="planta-row-pos" title={`Rua ${rua} · pos ${pos}`}>
            <div className="planta-row-pos-lbl">{pos}</div>
            <div className="planta-row-pos-cells">
              {Array.from({ length: maxNivel }, (_, i) => maxNivel - i).map((nivel) => {
                const slot = niveisMap.get(nivel)
                const key = plantaSlotKey(camara, rua, pos, nivel)
                const ocupacao = ocupacaoMap.get(key) ?? 'livre'
                const { fill, stroke } = plantaCellColors(
                  nivel,
                  ocupacao,
                  slot?.destino_acao,
                  Boolean(slot),
                )
                const tit = slot
                  ? `Rua ${rua} · pos ${pos} · nív ${nivel}${slot.destino_label ? ` · ${slot.destino_label}` : ''}`
                  : `Rua ${rua} · pos ${pos} · nív ${nivel} (vazio)`
                if (!slot) {
                  return (
                    <div
                      key={nivel}
                      className="planta-cell planta-cell--vazio"
                      style={{ background: fill, borderColor: stroke }}
                      title={tit}
                    />
                  )
                }
                return (
                  <button
                    key={nivel}
                    type="button"
                    className={`planta-cell planta-cell--clickable${ocupacao !== 'livre' ? ' planta-cell--ocupada' : ''}`}
                    style={{ background: fill, borderColor: stroke }}
                    title={tit}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSlotClick?.({ camara, rua, posicao: pos, nivel })
                    }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CamaraBlock(props: {
  cam: PlantaCamaraJson
  ocupacaoMap: Map<string, PlantaSlotOcupacao>
  selected: boolean
  onCamaraSelect?: (camara: number) => void
  onSlotClick?: (payload: PlantaSlotClickPayload) => void
}) {
  const { cam, ocupacaoMap, selected, onCamaraSelect, onSlotClick } = props
  const cod = cam.codigo
  const maxNiv = plantaMaxNivel(cod)
  const ruas = cam.ruas ?? []
  const ruaEsq = ruas[0] ?? 'A'
  const ruaDir = ruas[1] ?? ruas[0] ?? 'B'
  const slots = plantaSlotsCamara(cam)
  const total = slots.length
  const ocup = slots.filter((s) => {
    const k = plantaSlotKey(cod, s.rua, s.posicao, s.nivel)
    return ocupacaoMap.get(k) === 'ocupado' || ocupacaoMap.get(k) === 'contado'
  }).length
  const pct = total > 0 ? Math.round((ocup / total) * 100) : 0
  const meta = plantaCamaraMeta(cod)

  return (
    <div
      className={`planta-cam planta-cam--clickable${selected ? ' planta-cam--ativo' : ''}`}
      data-camara={cod}
      role="button"
      tabIndex={0}
      title="Clique para destacar a câmara"
      onClick={() => onCamaraSelect?.(cod)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onCamaraSelect?.(cod)
        }
      }}
    >
      <div className="planta-cam-top">
        {total} Posições · níveis {plantaNivelLabel(cod)}
      </div>
      <div className={`planta-cam-body planta-cam-body--n${maxNiv}`}>
        <RackSide
          camara={cod}
          rua={ruaEsq}
          enderecos={cam.enderecos}
          maxNivel={maxNiv}
          side="esq"
          ocupacaoMap={ocupacaoMap}
          onSlotClick={onSlotClick}
        />
        <div className="planta-corredor">
          <div className="planta-corredor-meta">
            CÂMARA FRIA
            <br />
            ruas {ruas.join('/') || '—'}
          </div>
          <div className="planta-corredor-mid">
            <div className="planta-corredor-num">{cod}</div>
            <div className="planta-corredor-tipo">{meta.tipo}</div>
          </div>
          <div className="planta-porta" title="Entrada" />
        </div>
        {ruas.length > 1 ? (
          <RackSide
            camara={cod}
            rua={ruaDir}
            enderecos={cam.enderecos}
            maxNivel={maxNiv}
            side="dir"
            ocupacaoMap={ocupacaoMap}
            onSlotClick={onSlotClick}
          />
        ) : (
          <div className="planta-rack-side planta-rack-side--dir">
            <span className="planta-2d-vazio-side">—</span>
          </div>
        )}
      </div>
      <div className="planta-cam-stats">
        {ocup}/{total} ocup. · {pct}% · clique na célula para POS/Nível
      </div>
    </div>
  )
}

function AreasEspeciais98(props: { data: PlantaAreasEspeciaisJson }) {
  const { data } = props
  return (
    <div className="planta-row-98">
      <div className="planta-row-98-titulo">Quarentena e fluxos especiais — câmara 98</div>
      {data.areas.map((a) => (
        <div key={a.area} className="planta-area98">
          <div className="planta-area98-tit">{a.label}</div>
          <div className="planta-area98-slots">
            {Array.from({ length: a.slots }, (_, i) => (
              <div key={i} className="planta-area98-slot">
                <span className="planta-area98-slot-n">{i + 1}</span>
                <span className="planta-area98-slot-lbl">livre</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Legenda2D() {
  const items: Array<{ label: string; fill: string; stroke: string }> = [
    { label: 'Nível 1 livre', fill: '#90caf9', stroke: '#ff9800' },
    { label: 'Níveis 2–5 livre', fill: '#0d47a1', stroke: '#ff9800' },
    { label: 'Reentregas / avaria', fill: '#7e57c2', stroke: '#ff9800' },
    { label: 'Envio MG', fill: '#42a5f5', stroke: '#ff9800' },
    { label: 'Retrabalho', fill: '#ffca28', stroke: '#ff9800' },
    { label: 'Com código (inventário)', fill: '#ab47bc', stroke: '#6a1b9a' },
    { label: 'Quantidade contada', fill: '#66bb6a', stroke: '#2e7d32' },
  ]
  return (
    <div className="planta-2d-legenda">
      {items.map((it) => (
        <span key={it.label} className="planta-2d-legenda-item">
          <span className="planta-2d-legenda-swatch" style={{ background: it.fill, borderColor: it.stroke }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

export function PlantaGeral2D(props: Props) {
  const { inventarioItems, selectedCamara, onCamaraSelect, onSlotClick, defaultOpen = false } = props
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [layout, setLayout] = useState<PlantaLayoutJson | null>(null)
  const [areasEspeciais, setAreasEspeciais] = useState<PlantaAreasEspeciaisJson | null>(null)

  useEffect(() => {
    if (!open || layout) return
    let cancelled = false
    setLoading(true)
    setError('')
    void fetchPlantaLayoutData()
      .then(({ layout: l, areasEspeciais: a }) => {
        if (cancelled) return
        setLayout(l)
        setAreasEspeciais(a)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro ao carregar planta 2D.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, layout])

  const ocupacaoMap = useMemo(() => {
    if (!inventarioItems?.length) return new Map<string, PlantaSlotOcupacao>()
    return buildOcupacaoMapFromInventarioItems(
      inventarioItems,
      inventarioPlanilhaPosNivelFromIndex,
      (grupo) => getCamaraFromGrupo(grupo),
      (grupo) => getInventarioRuaArmazem(grupo),
    )
  }, [inventarioItems])

  const camaras = useMemo(() => {
    if (!layout?.camaras) return [] as PlantaCamaraJson[]
    const byCod = new Map(layout.camaras.map((c) => [c.codigo, c]))
    return PLANTA_CAMARAS_ORDEM.map((cod) => byCod.get(cod)).filter(Boolean) as PlantaCamaraJson[]
  }, [layout])

  return (
    <details
      className="planta-2d-details"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="planta-2d-summary">Planta geral — vista 2D</summary>
      <div className="planta-2d-wrap">
        {loading ? <p className="planta-2d-msg">Carregando layout das câmaras…</p> : null}
        {error ? <p className="planta-2d-erro">{error}</p> : null}
        {!loading && !error && camaras.length > 0 ? (
          <>
            <div className="planta-row-cams">
              {camaras.map((cam) => (
                <CamaraBlock
                  key={cam.codigo}
                  cam={cam}
                  ocupacaoMap={ocupacaoMap}
                  selected={selectedCamara === cam.codigo}
                  onCamaraSelect={onCamaraSelect}
                  onSlotClick={onSlotClick}
                />
              ))}
            </div>
            {areasEspeciais ? <AreasEspeciais98 data={areasEspeciais} /> : null}
            <Legenda2D />
          </>
        ) : null}
        {!loading && !error && camaras.length === 0 && open ? (
          <p className="planta-2d-msg">Nenhuma câmara no layout.</p>
        ) : null}
      </div>
    </details>
  )
}
