import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { normalizeCodigoInternoCompareKey } from '../lib/codigoInternoCompare'
import { formatUnknownError, isColumnMissingError } from '../lib/supabaseError'
import { supabase } from '../lib/supabaseClient'

const TABELA = 'Todos os Produtos'

type LinhaImport = {
  codigo_interno: string
  descricao: string
  unidade: string | null
  ean: string | null
  dun: string | null
}

function normCell(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function pickColumn(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const hit = Object.keys(row).find((h) => h.trim().toLowerCase() === k.toLowerCase())
    if (hit) return normCell(row[hit])
  }
  return ''
}

function parseSheet(rows: Record<string, unknown>[]): LinhaImport[] {
  const out: LinhaImport[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    const codigo = pickColumn(row, [
      'codigo_interno',
      'codigo',
      'código',
      'código interno',
      'codigo interno',
      'cod',
    ])
    const descricao = pickColumn(row, ['descricao', 'descrição', 'desc', 'produto', 'nome'])
    if (!codigo || !descricao) continue
    const key = normalizeCodigoInternoCompareKey(codigo)
    if (seen.has(key)) continue
    seen.add(key)
    const unidade = pickColumn(row, ['unidade', 'un', 'unidade_medida', 'um']) || null
    const ean = pickColumn(row, ['ean', 'codigo_barras', 'código de barras']) || null
    const dun = pickColumn(row, ['dun']) || null
    out.push({
      codigo_interno: codigo,
      descricao,
      unidade,
      ean,
      dun,
    })
  }
  return out
}

export default function ProdutosImportacaoPlanilha() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [linhas, setLinhas] = useState<LinhaImport[]>([])
  const [arquivo, setArquivo] = useState('')
  const [importando, setImportando] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [atualizarExistentes, setAtualizarExistentes] = useState(true)

  function handleFile(file: File) {
    setLog([])
    setArquivo(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        const parsed = parseSheet(json)
        setLinhas(parsed)
        setLog([`Arquivo lido: ${parsed.length} linha(s) válida(s).`])
      } catch (e: unknown) {
        setLinhas([])
        setLog([`Erro ao ler planilha: ${formatUnknownError(e)}`])
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function upsertLinha(ln: LinhaImport): Promise<'ok' | 'skip' | 'err'> {
    const cod = ln.codigo_interno.trim()
    const { data: existente } = await supabase
      .from(TABELA)
      .select('id,codigo_interno')
      .eq('codigo_interno', cod)
      .limit(1)
    if (existente?.length && !atualizarExistentes) return 'skip'

    const payload: Record<string, unknown> = {
      codigo_interno: cod,
      descricao: ln.descricao.trim(),
      ean: ln.ean,
      dun: ln.dun,
      unidade: ln.unidade,
    }

    if (existente?.length) {
      const tries = [
        payload,
        { ...payload, unidade_medida: ln.unidade },
        { codigo_interno: cod, descricao: ln.descricao.trim(), ean: ln.ean, dun: ln.dun },
      ]
      for (const p of tries) {
        const { error } = await supabase.from(TABELA).update(p).eq('id', existente[0].id)
        if (!error) return 'ok'
        if (!isColumnMissingError(error)) return 'err'
      }
      return 'err'
    }

    const tries = [
      payload,
      { ...payload, unidade_medida: ln.unidade },
      { codigo_interno: cod, descricao: ln.descricao.trim(), ean: ln.ean, dun: ln.dun },
    ]
    for (const p of tries) {
      const { error } = await supabase.from(TABELA).insert(p)
      if (!error) return 'ok'
      if (!isColumnMissingError(error)) return 'err'
    }
    return 'err'
  }

  async function handleImportar() {
    if (!linhas.length) return
    setImportando(true)
    const msgs: string[] = []
    let ok = 0
    let skip = 0
    let err = 0
    for (const ln of linhas) {
      try {
        const r = await upsertLinha(ln)
        if (r === 'ok') ok++
        else if (r === 'skip') skip++
        else {
          err++
          msgs.push(`Falha: ${ln.codigo_interno}`)
        }
      } catch (e: unknown) {
        err++
        msgs.push(`${ln.codigo_interno}: ${formatUnknownError(e)}`)
      }
    }
    msgs.unshift(`Concluído — ${ok} gravado(s), ${skip} ignorado(s), ${err} erro(s).`)
    setLog(msgs)
    setImportando(false)
  }

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Importação de Planilha de Produtos</h1>
      <p className="page-panel__subtitle">
        Envie um Excel (.xlsx) com colunas <strong>codigo_interno</strong> (ou código) e{' '}
        <strong>descricao</strong>. Opcional: unidade, ean, dun. Os dados são gravados em{' '}
        <strong>Todos os Produtos</strong> no Supabase.
      </p>

      <div className="page-form-grid" style={{ maxWidth: 520 }}>
        <label>
          Arquivo Excel
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>
        <label className="page-form-grid__check">
          <input
            type="checkbox"
            checked={atualizarExistentes}
            onChange={(e) => setAtualizarExistentes(e.target.checked)}
          />
          Atualizar produtos já existentes (mesmo código)
        </label>
        <div className="page-form-grid__actions">
          <button type="button" disabled={!linhas.length || importando} onClick={() => void handleImportar()}>
            {importando ? 'Importando…' : `Importar ${linhas.length} linha(s)`}
          </button>
        </div>
      </div>

      {arquivo ? (
        <p style={{ marginTop: 12, fontSize: 14, color: 'var(--muted, #94a3b8)' }}>
          Arquivo: {arquivo}
        </p>
      ) : null}

      {linhas.length > 0 ? (
        <div className="page-table-wrap" style={{ marginTop: 20 }}>
          <p className="page-panel__section-title">Prévia (até 15 linhas)</p>
          <table className="page-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Un.</th>
                <th>EAN</th>
                <th>DUN</th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 15).map((ln) => (
                <tr key={ln.codigo_interno}>
                  <td>{ln.codigo_interno}</td>
                  <td>{ln.descricao}</td>
                  <td>{ln.unidade ?? '—'}</td>
                  <td>{ln.ean ?? '—'}</td>
                  <td>{ln.dun ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {log.length > 0 ? (
        <pre
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: 'var(--chart-card-bg, rgba(0,0,0,.2))',
            fontSize: 13,
            whiteSpace: 'pre-wrap',
          }}
        >
          {log.join('\n')}
        </pre>
      ) : null}
    </div>
  )
}
