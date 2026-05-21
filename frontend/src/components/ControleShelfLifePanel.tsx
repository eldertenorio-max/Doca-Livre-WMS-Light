import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import * as XLSX from 'xlsx'
import { fetchGoogleSheetCsv, parseGoogleSheetsCsv } from '../lib/googleSheetsCsv'

const SHELF_SHEET_ID = '1EoT2x4MHtAu7bVkuwqxl2swdwqUI7n1Hg2EL9WBNeTk'
const SHELF_SHEET_NAME = 'CONTROLE SHELF LIFE'
const PAGE_SIZE = 15

export type ShelfLifeStatus = 'Verde' | 'Amarelo' | 'Laranja' | 'Vermelho' | 'Sem dado'

export type ShelfLifeRow = {
  codigo: string
  descricao: string
  unidade: string
  quantidade: string
  dataFabricacao: string
  dataVencimento: string
  shelfLiveDias: string
  dataHoje: string
  diasParaVencer: string
  diasDeVida: string
  shelfLifePct: string
  shelfLifePctNum: number | null
  status: ShelfLifeStatus
}

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

function parsePercentBR(raw: string): number | null {
  const t = String(raw || '').trim().replace('%', '').replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function statusFromShelfPct(pct: number | null): ShelfLifeStatus {
  if (pct == null) return 'Sem dado'
  if (pct <= 33.33) return 'Verde'
  if (pct <= 60.01) return 'Amarelo'
  if (pct <= 80.01) return 'Laranja'
  return 'Vermelho'
}

function looksLikeCodigo(s: string): boolean {
  return /^\d{2}\.\d{2}\.\d{3,4}$/.test(String(s || '').trim())
}

function rowScore(r: ShelfLifeRow): number {
  let s = 0
  if (r.shelfLifePct) s += 8
  if (r.quantidade) s += 4
  if (r.dataFabricacao) s += 2
  if (r.dataVencimento) s += 2
  if (r.shelfLifePctNum != null) s += 1
  return s
}

export function parseControleShelfLifeCsv(csvText: string): { regras: string; rows: ShelfLifeRow[] } {
  const grid = parseGoogleSheetsCsv(csvText)
  if (grid.length < 2) return { regras: '', rows: [] }

  const regras = String(grid[0]?.[0] ?? '').trim()
  const byCodigo = new Map<string, ShelfLifeRow>()

  for (let i = 1; i < grid.length; i += 1) {
    const line = grid[i]
    const codigo = String(line[0] ?? '').trim()
    if (!looksLikeCodigo(codigo)) continue

    const pctRaw = String(line[10] ?? '').trim()
    const pctNum = parsePercentBR(pctRaw)
    const row: ShelfLifeRow = {
      codigo,
      descricao: String(line[1] ?? '').trim(),
      unidade: String(line[2] ?? '').trim(),
      quantidade: String(line[3] ?? '').trim(),
      dataFabricacao: String(line[4] ?? '').trim(),
      dataVencimento: String(line[5] ?? '').trim(),
      shelfLiveDias: String(line[6] ?? '').trim(),
      dataHoje: String(line[7] ?? '').trim(),
      diasParaVencer: String(line[8] ?? '').trim(),
      diasDeVida: String(line[9] ?? '').trim(),
      shelfLifePct: pctRaw,
      shelfLifePctNum: pctNum,
      status: statusFromShelfPct(pctNum),
    }
    const prev = byCodigo.get(codigo)
    if (!prev || rowScore(row) > rowScore(prev)) byCodigo.set(codigo, row)
  }

  const rows = Array.from(byCodigo.values()).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
  return { regras, rows }
}

const STATUS_FILTERS: Array<'Todos' | ShelfLifeStatus> = ['Todos', 'Verde', 'Amarelo', 'Laranja', 'Vermelho', 'Sem dado']

function statusColors(st: ShelfLifeStatus): { bg: string; fg: string; rowBg: string } {
  switch (st) {
    case 'Verde':
      return { bg: '#14532d', fg: '#bbf7d0', rowBg: 'rgba(34, 197, 94, 0.12)' }
    case 'Amarelo':
      return { bg: '#713f12', fg: '#fde047', rowBg: 'rgba(234, 179, 8, 0.12)' }
    case 'Laranja':
      return { bg: '#7c2d12', fg: '#fdba74', rowBg: 'rgba(249, 115, 22, 0.14)' }
    case 'Vermelho':
      return { bg: '#7f1d1d', fg: '#fecaca', rowBg: 'rgba(239, 68, 68, 0.14)' }
    default:
      return { bg: '#334155', fg: '#cbd5e1', rowBg: 'transparent' }
  }
}

const th: CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--border, #2e303a)',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const td: CSSProperties = {
  padding: '8px 10px',
  borderBottom: '1px solid var(--border, #2e303a)',
  fontSize: 13,
  verticalAlign: 'top',
}

export default function ControleShelfLifePanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [regras, setRegras] = useState('')
  const [rows, setRows] = useState<ShelfLifeRow[]>([])
  const [sourceUrl, setSourceUrl] = useState('')
  const [filtro, setFiltro] = useState<'Todos' | ShelfLifeStatus>('Todos')
  const [filtroCodigo, setFiltroCodigo] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { text, url } = await fetchGoogleSheetCsv(SHELF_SHEET_ID, { sheetName: SHELF_SHEET_NAME })
      const parsed = parseControleShelfLifeCsv(text)
      if (!parsed.rows.length) throw new Error('Nenhum produto encontrado na aba CONTROLE SHELF LIFE.')
      setRegras(parsed.regras)
      setRows(parsed.rows)
      setSourceUrl(url)
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar planilha.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rowsFiltradas = useMemo(() => {
    const cod = normalize(filtroCodigo)
    return rows.filter((r) => {
      if (filtro !== 'Todos' && r.status !== filtro) return false
      if (!cod) return true
      return normalize(r.codigo).includes(cod) || normalize(r.descricao).includes(cod)
    })
  }, [rows, filtro, filtroCodigo])

  const alertasCriticos = useMemo(
    () => rows.filter((r) => r.status === 'Vermelho' || r.status === 'Laranja'),
    [rows],
  )

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rowsFiltradas.length / PAGE_SIZE)), [rowsFiltradas.length])
  const rowsPagina = useMemo(() => {
    const p = Math.min(page, totalPages)
    const start = (p - 1) * PAGE_SIZE
    return rowsFiltradas.slice(start, start + PAGE_SIZE)
  }, [rowsFiltradas, page, totalPages])

  useEffect(() => {
    setPage(1)
  }, [filtro, filtroCodigo, rows.length])

  const planilhaUrl = `https://docs.google.com/spreadsheets/d/${SHELF_SHEET_ID}/edit`

  function exportarExcel() {
    const data = rowsFiltradas.map((r) => ({
      Código: r.codigo,
      Descrição: r.descricao,
      Unidade: r.unidade,
      Quantidade: r.quantidade,
      'Data fabricação': r.dataFabricacao,
      'Data vencimento': r.dataVencimento,
      'Shelf life (dias)': r.shelfLiveDias,
      'Data hoje': r.dataHoje,
      'Dias p/ vencer': r.diasParaVencer,
      'Dias de vida': r.diasDeVida,
      'Shelf life %': r.shelfLifePct,
      Status: r.status,
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Shelf Life')
    XLSX.writeFile(wb, `controle-shelf-life_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 14,
          border: '1px solid rgba(249, 115, 22, .35)',
          background: 'linear-gradient(135deg, rgba(249,115,22,.14), rgba(15,23,42,.2))',
        }}
      >
        <div>
          <div style={{ fontWeight: 900, color: '#f8fafc', fontSize: 19 }}>Controle Shelf Life</div>
          <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>
            Dados da aba <strong>CONTROLE SHELF LIFE</strong> (planilha de estoque SP). Atualização semanal na terça-feira.
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          {alertasCriticos.length > 0 ? (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#fca5a5',
                border: '1px solid rgba(239,68,68,.4)',
              }}
            >
              {alertasCriticos.length} em Laranja/Vermelho
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #fb923c',
              background: 'transparent',
              color: '#fdba74',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
          <a
            href={planilhaUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid var(--border, #555)',
              color: '#e2e8f0',
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            Abrir planilha
          </a>
        </div>
      </div>

      {regras ? (
        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.45 }}>
          {regras.length > 280 ? `${regras.slice(0, 280)}…` : regras}
        </p>
      ) : null}

      {loading ? <p style={{ color: '#94a3b8' }}>Carregando planilha…</p> : null}
      {error ? (
        <div
          style={{
            border: '1px solid #b91c1c',
            background: 'rgba(127,29,29,.35)',
            color: '#fecaca',
            borderRadius: 8,
            padding: '10px 12px',
          }}
        >
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          {sourceUrl ? (
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Fonte: Google Sheets (export CSV)</p>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              alignItems: 'end',
            }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 13 }}>
              Filtrar código ou descrição
              <input
                value={filtroCodigo}
                onChange={(e) => setFiltroCodigo(e.target.value)}
                placeholder="código ou texto"
                style={{
                  padding: '10px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #555)',
                  background: 'var(--input-bg, #1a1a1a)',
                  color: 'var(--text, #eee)',
                }}
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {STATUS_FILTERS.map((st) => {
              const active = filtro === st
              const c = st === 'Todos' ? null : statusColors(st as ShelfLifeStatus)
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltro(st)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${active ? (c?.fg ?? '#fdba74') : 'var(--border, #555)'}`,
                    background: active ? (c?.bg ?? 'rgba(249,115,22,.25)') : 'transparent',
                    color: active ? (c?.fg ?? '#fdba74') : 'var(--text, #ccc)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {st}
                  {st !== 'Todos'
                    ? ` (${rows.filter((r) => r.status === st).length})`
                    : ` (${rows.length})`}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Lista ({rowsFiltradas.length} itens)</h3>
            <button
              type="button"
              disabled={rowsFiltradas.length === 0}
              onClick={exportarExcel}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid #16a34a',
                background: 'rgba(22,163,74,.2)',
                color: '#4ade80',
                fontWeight: 700,
                cursor: rowsFiltradas.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              Baixar Excel
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border, #2e303a)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={th}>Código</th>
                  <th style={{ ...th, minWidth: 220 }}>Descrição</th>
                  <th style={th}>Un.</th>
                  <th style={th}>Qtd.</th>
                  <th style={th}>Fab.</th>
                  <th style={th}>Venc.</th>
                  <th style={th}>Shelf (d)</th>
                  <th style={th}>Hoje</th>
                  <th style={th}>D. vencer</th>
                  <th style={th}>D. vida</th>
                  <th style={th}>Shelf %</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rowsPagina.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ ...td, color: '#94a3b8' }}>
                      Nenhum item neste filtro.
                    </td>
                  </tr>
                ) : (
                  rowsPagina.map((r) => {
                    const c = statusColors(r.status)
                    return (
                      <tr key={r.codigo} style={{ background: c.rowBg }}>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{r.codigo}</td>
                        <td style={{ ...td, whiteSpace: 'normal', maxWidth: 280 }}>{r.descricao || '—'}</td>
                        <td style={td}>{r.unidade || '—'}</td>
                        <td style={{ ...td, fontVariantNumeric: 'tabular-nums' }}>{r.quantidade || '—'}</td>
                        <td style={td}>{r.dataFabricacao || '—'}</td>
                        <td style={td}>{r.dataVencimento || '—'}</td>
                        <td style={td}>{r.shelfLiveDias || '—'}</td>
                        <td style={td}>{r.dataHoje || '—'}</td>
                        <td style={td}>{r.diasParaVencer || '—'}</td>
                        <td style={td}>{r.diasDeVida || '—'}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{r.shelfLifePct || '—'}</td>
                        <td style={{ ...td, fontWeight: 800, background: c.bg, color: c.fg }}>{r.status}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #555)',
                background: 'transparent',
                color: '#e2e8f0',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Anterior
            </button>
            <span>
              Página {Math.min(page, totalPages)} de {totalPages} ({rowsFiltradas.length} itens)
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border, #555)',
                background: 'transparent',
                color: '#e2e8f0',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Próxima
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
