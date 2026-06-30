import { useCallback, useEffect, useMemo, useState } from 'react'
import WmsDonutChart from '../components/dashboard/WmsDonutChart'
import WmsInteractiveBarChart from '../components/dashboard/WmsInteractiveBarChart'
import WmsKpiCard from '../components/dashboard/WmsKpiCard'
import { PagePanelHeading } from '../components/ui/PagePanelHeading'
import {
  daysAgoYmdSp,
  fetchPainelLinhasContagem,
  fetchPainelLinhasInventario,
  fetchPainelSessoesInventario,
  fetchPresencaContagemDia,
  filtrarLinhasContagem,
  filtrarLinhasInventario,
  formatYmdBr,
  kpisContagem,
  kpisInventario,
  seriePorCamara,
  seriePorConferente,
  seriePorDia,
  seriePorNumeroContagem,
  todayYmdSp,
  type PainelChartPoint,
  type PainelFiltroAtivo,
  type PainelLinhaContagem,
  type PainelLinhaInventario,
} from '../lib/painelAnalyticsData'
import type { InventarioSessao } from '../lib/inventarioSessaoTypes'
import { formatUnknownError } from '../lib/supabaseError'
import '../components/dashboard/wmsDashboard.css'
import './PainelPage.css'

type PainelTab = 'contagem' | 'inventario'

const FILTRO_VAZIO: PainelFiltroAtivo = { ymd: null, conferenteId: null, camara: null }

export default function PainelPage() {
  const [tab, setTab] = useState<PainelTab>('contagem')
  const [dataDe, setDataDe] = useState(() => daysAgoYmdSp(13))
  const [dataAte, setDataAte] = useState(() => todayYmdSp())
  const [draftDe, setDraftDe] = useState(dataDe)
  const [draftAte, setDraftAte] = useState(dataAte)
  const [filtro, setFiltro] = useState<PainelFiltroAtivo>(FILTRO_VAZIO)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [linhasContagem, setLinhasContagem] = useState<PainelLinhaContagem[]>([])
  const [linhasInventario, setLinhasInventario] = useState<PainelLinhaInventario[]>([])
  const [sessoesInv, setSessoesInv] = useState<InventarioSessao[]>([])
  const [presencaHoje, setPresencaHoje] = useState(0)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')
    try {
      const [cont, inv, sessoes, presenca] = await Promise.all([
        fetchPainelLinhasContagem(dataDe, dataAte),
        fetchPainelLinhasInventario(dataDe, dataAte),
        fetchPainelSessoesInventario(),
        fetchPresencaContagemDia(todayYmdSp()),
      ])
      setLinhasContagem(cont)
      setLinhasInventario(inv)
      setSessoesInv(sessoes)
      setPresencaHoje(presenca)
    } catch (e: unknown) {
      setErro(formatUnknownError(e) || 'Erro ao carregar painel.')
    } finally {
      setLoading(false)
    }
  }, [dataDe, dataAte])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    setFiltro(FILTRO_VAZIO)
  }, [tab, dataDe, dataAte])

  function aplicarPeriodo() {
    if (draftDe && draftAte && draftDe > draftAte) {
      setErro('Data inicial não pode ser maior que a final.')
      return
    }
    setDataDe(draftDe)
    setDataAte(draftAte)
    setErro('')
  }

  const linhasContagemFiltradas = useMemo(
    () => filtrarLinhasContagem(linhasContagem, filtro),
    [linhasContagem, filtro],
  )
  const linhasInventarioFiltradas = useMemo(
    () => filtrarLinhasInventario(linhasInventario, filtro),
    [linhasInventario, filtro],
  )

  const kpiCont = useMemo(() => kpisContagem(linhasContagemFiltradas), [linhasContagemFiltradas])
  const kpiInv = useMemo(() => kpisInventario(linhasInventarioFiltradas, sessoesInv), [linhasInventarioFiltradas, sessoesInv])

  const serieDiaCont = useMemo(
    () => seriePorDia(filtrarLinhasContagem(linhasContagem, filtro, 'ymd'), dataDe, dataAte),
    [linhasContagem, filtro, dataDe, dataAte],
  )
  const serieDiaInv = useMemo(
    () => seriePorDia(filtrarLinhasInventario(linhasInventario, filtro, 'ymd'), dataDe, dataAte),
    [linhasInventario, filtro, dataDe, dataAte],
  )
  const serieConfCont = useMemo(
    () => seriePorConferente(filtrarLinhasContagem(linhasContagem, filtro, 'conferenteId')),
    [linhasContagem, filtro],
  )
  const serieConfInv = useMemo(
    () => seriePorConferente(filtrarLinhasInventario(linhasInventario, filtro, 'conferenteId')),
    [linhasInventario, filtro],
  )
  const serieCamaraInv = useMemo(
    () => seriePorCamara(filtrarLinhasInventario(linhasInventario, filtro, 'camara')),
    [linhasInventario, filtro],
  )
  const serieNumContagemInv = useMemo(
    () => seriePorNumeroContagem(linhasInventarioFiltradas),
    [linhasInventarioFiltradas],
  )

  const filtrosAtivos = [
    filtro.ymd ? `Dia ${formatYmdBr(filtro.ymd)}` : null,
    filtro.conferenteId
      ? `Conferente ${(tab === 'contagem' ? linhasContagem : linhasInventario).find((l) => l.conferente_id === filtro.conferenteId)?.conferente_nome ?? ''}`
      : null,
    filtro.camara ? `Câmara ${filtro.camara}` : null,
  ].filter(Boolean) as string[]

  function toggleDia(p: PainelChartPoint | null) {
    setFiltro((f) => ({ ...f, ymd: p ? p.id : null }))
  }

  function toggleConferente(p: PainelChartPoint | null) {
    setFiltro((f) => ({ ...f, conferenteId: p ? p.id : null }))
  }

  function toggleCamara(p: PainelChartPoint | null) {
    setFiltro((f) => ({ ...f, camara: p ? p.id : null }))
  }

  return (
    <div className="page-panel page-panel--wide painel-page">
      <PagePanelHeading
        title="Painel"
        info={
          <>
            Visão consolidada de <strong>contagem diária</strong> e <strong>inventário</strong>. Use o período
            acima e clique nos gráficos para filtrar — todos os indicadores acompanham a seleção.
          </>
        }
      />

      <div className="painel-page__toolbar">
        <div className="page-tabs painel-page__tabs" role="tablist" aria-label="Módulo do painel">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'contagem'}
            className={`page-tabs__btn${tab === 'contagem' ? ' page-tabs__btn--active' : ''}`}
            onClick={() => setTab('contagem')}
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

        <form
          className="painel-page__periodo"
          onSubmit={(e) => {
            e.preventDefault()
            aplicarPeriodo()
          }}
        >
          <label>
            De
            <input type="date" value={draftDe} onChange={(e) => setDraftDe(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={draftAte} onChange={(e) => setDraftAte(e.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? 'Carregando…' : 'Aplicar'}
          </button>
          <button type="button" className="page-btn-ghost" disabled={loading} onClick={() => void carregar()}>
            Atualizar
          </button>
        </form>
      </div>

      {filtrosAtivos.length > 0 ? (
        <div className="painel-page__filtros-ativos">
          <span className="painel-page__filtros-label">Filtro ativo:</span>
          {filtrosAtivos.map((f) => (
            <span key={f} className="painel-page__filtro-chip">
              {f}
            </span>
          ))}
          <button type="button" className="painel-page__limpar-filtro" onClick={() => setFiltro(FILTRO_VAZIO)}>
            Limpar filtros
          </button>
        </div>
      ) : (
        <p className="painel-page__dica-filtro">Clique em um dia, conferente ou câmara nos gráficos para cruzar os dados.</p>
      )}

      {erro ? <p className="page-msg page-msg--error">{erro}</p> : null}

      {tab === 'contagem' ? (
        <section className="wms-dashboard" aria-busy={loading}>
          <header className="wms-dashboard__header">
            <h2 className="wms-dashboard__heading">Contagem diária</h2>
            <p className="wms-dashboard__hint">
              Período {formatYmdBr(dataDe)} a {formatYmdBr(dataAte)} · {linhasContagemFiltradas.length} linha(s)
              {filtrosAtivos.length ? ' (filtrado)' : ''}
            </p>
          </header>

          <div className="wms-dashboard__top">
            <WmsKpiCard tone="teal" title="Itens contados" value={String(kpiCont.itens)} subtitle="No período / filtro" icon={<span>📦</span>} />
            <WmsKpiCard tone="blue" title="Conferentes" value={String(kpiCont.conferentes)} subtitle="Com registro" icon={<span>👤</span>} />
            <WmsKpiCard tone="pink" title="SKUs distintos" value={String(kpiCont.skus)} subtitle="Produtos únicos" icon={<span>🏷️</span>} />
            <WmsKpiCard tone="green" title="Presença hoje" value={String(presencaHoje)} subtitle="Check-in do dia" icon={<span>✅</span>} />
          </div>

          <div className="painel-page__charts-grid">
            <WmsInteractiveBarChart
              title="Volume por dia"
              points={serieDiaCont}
              selectedId={filtro.ymd}
              onSelect={toggleDia}
              barColor="#0d9488"
            />
            <WmsDonutChart
              title="Por conferente"
              points={serieConfCont}
              selectedId={filtro.conferenteId}
              onSelect={toggleConferente}
            />
          </div>

          <div className="wms-dashboard__top painel-page__mini-kpis">
            <WmsKpiCard tone="navy" title="Média / conferente" value={String(kpiCont.mediaPorConferente)} subtitle="Itens por pessoa" />
            <WmsKpiCard
              tone="orange"
              title="Pico no período"
              value={String(serieDiaCont.reduce((m, p) => Math.max(m, p.value), 0))}
              subtitle="Máx. em um dia"
            />
          </div>
        </section>
      ) : (
        <section className="wms-dashboard wms-dashboard--inventario" aria-busy={loading}>
          <header className="wms-dashboard__header">
            <h2 className="wms-dashboard__heading">Inventário</h2>
            <p className="wms-dashboard__hint">
              Período {formatYmdBr(dataDe)} a {formatYmdBr(dataAte)} · {linhasInventarioFiltradas.length} linha(s)
              {filtrosAtivos.length ? ' (filtrado)' : ''}
            </p>
          </header>

          <div className="wms-dashboard__top">
            <WmsKpiCard tone="yellow" title="Linhas" value={String(kpiInv.linhas)} subtitle="Capturas no filtro" icon={<span>📋</span>} />
            <WmsKpiCard tone="teal" title="Inventários abertos" value={String(kpiInv.abertos)} subtitle="Sessões ativas" icon={<span>📦</span>} />
            <WmsKpiCard tone="brown" title="Fechados" value={String(kpiInv.fechados)} subtitle="Histórico total" icon={<span>🔒</span>} />
            <WmsKpiCard tone="blue" title="Conferentes" value={String(kpiInv.conferentes)} subtitle="No período" icon={<span>👤</span>} />
          </div>

          <div className="painel-page__charts-grid">
            <WmsInteractiveBarChart
              title="Capturas por dia"
              points={serieDiaInv}
              selectedId={filtro.ymd}
              onSelect={toggleDia}
              barColor="#c026d3"
            />
            <WmsDonutChart
              title="Por conferente"
              points={serieConfInv}
              selectedId={filtro.conferenteId}
              onSelect={toggleConferente}
            />
          </div>

          <div className="painel-page__charts-grid painel-page__charts-grid--half">
            {serieCamaraInv.length > 0 ? (
              <WmsInteractiveBarChart
                title="Por câmara"
                points={serieCamaraInv}
                selectedId={filtro.camara}
                onSelect={toggleCamara}
                barColor="#2563eb"
              />
            ) : null}
            {serieNumContagemInv.length > 0 ? (
              <WmsInteractiveBarChart
                title="Por número de contagem"
                points={serieNumContagemInv}
                selectedId={null}
                barColor="#ea580c"
              />
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}
