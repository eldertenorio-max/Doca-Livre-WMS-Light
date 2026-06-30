import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { normalizeCodigoInternoCompareKey } from '../lib/codigoInternoCompare'
import {
  createProdutoLista,
  listProdutoListas,
  produtoListasHabilitado,
  saveProdutoLista,
  type ProdutoListaItem,
} from '../lib/produtoListaSupabase'
import { emitProdutoListaAtualizada } from '../lib/sessaoProdutoListaContext'
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

function linhasParaListaItens(linhas: LinhaImport[]): ProdutoListaItem[] {
  return linhas.map((ln) => ({
    codigo_interno: ln.codigo_interno.trim(),
    descricao: ln.descricao.trim(),
    unidade: ln.unidade,
    ean: ln.ean,
    dun: ln.dun,
  }))
}

async function gravarListaImportada(nome: string, linhas: LinhaImport[]) {
  const nomeTrim = nome.trim()
  const produtos = linhasParaListaItens(linhas)
  const listas = await listProdutoListas()
  const existente = listas.find((l) => l.nome.trim().toLowerCase() === nomeTrim.toLowerCase())
  if (existente) {
    return saveProdutoLista({ ...existente, nome: nomeTrim, produtos })
  }
  return createProdutoLista(nomeTrim, produtos)
}

function nomeListaFromArquivo(fileName: string): string {
  return fileName.replace(/\.(xlsx|xls|csv)$/i, '').trim()
}

function baixarModeloImportacao() {
  const exemplo = [
    {
      codigo_interno: '01.01.0001',
      descricao: 'EXEMPLO — MASSA CONGELADA DE PAO FRANCES RAPIDA - 5KG',
      unidade: 'PT',
      ean: '7891234567890',
      dun: '17891234567897',
    },
    {
      codigo_interno: '01.02.0003',
      descricao: 'EXEMPLO — MASSA CONGELADA DE MINI PAO FRANCES INTEGRAL RAPIDA - 5KG',
      unidade: 'PT',
      ean: '',
      dun: '',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(exemplo)
  ws['!cols'] = [{ wch: 16 }, { wch: 52 }, { wch: 8 }, { wch: 16 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
  XLSX.writeFile(wb, 'modelo-importacao-produtos.xlsx')
}

export default function ProdutosImportacaoPlanilha() {
  const inputRef = useRef<HTMLInputElement>(null)
  const feedbackRef = useRef<HTMLPreElement>(null)
  const [nomeLista, setNomeLista] = useState('')
  const [linhas, setLinhas] = useState<LinhaImport[]>([])
  const [arquivo, setArquivo] = useState('')
  const [importando, setImportando] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const [erro, setErro] = useState('')
  const [atualizarExistentes, setAtualizarExistentes] = useState(true)

  function mostrarFeedback(msgs: string[]) {
    setLog(msgs)
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  function handleFile(file: File) {
    setLog([])
    setErro('')
    setArquivo(file.name)
    if (!nomeLista.trim()) {
      setNomeLista(nomeListaFromArquivo(file.name))
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        const parsed = parseSheet(json)
        setLinhas(parsed)
        mostrarFeedback([`Arquivo lido: ${parsed.length} linha(s) válida(s).`])
      } catch (e: unknown) {
        setLinhas([])
        setErro('')
        mostrarFeedback([`Erro ao ler planilha: ${formatUnknownError(e)}`])
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
    setErro('')
    if (!linhas.length) {
      setErro('Selecione um arquivo Excel com pelo menos uma linha válida.')
      return
    }
    const nome = nomeLista.trim()
    if (!nome) {
      setErro('Informe o nome da lista antes de importar.')
      return
    }
    if (!produtoListasHabilitado()) {
      setErro('Supabase não configurado — não é possível gravar a lista de produtos.')
      return
    }

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

    try {
      const lista = await gravarListaImportada(nome, linhas)
      emitProdutoListaAtualizada([lista.id])
      msgs.unshift(
        `Lista «${lista.nome}» salva com ${lista.produtos.length} produto(s) — aparece em Produtos → listas salvas e pode ser usada no inventário.`,
      )
    } catch (e: unknown) {
      msgs.unshift(`Catálogo atualizado, mas falhou ao gravar a lista: ${formatUnknownError(e)}`)
    }

    msgs.unshift(`Concluído — ${ok} gravado(s) em Todos os Produtos, ${skip} ignorado(s), ${err} erro(s).`)
    setErro('')
    mostrarFeedback(msgs)
    setImportando(false)
  }

  const podeImportar = linhas.length > 0 && !importando

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Importação de Planilha de Produtos</h1>
      <p className="page-panel__subtitle">
        Envie um Excel (.xlsx) com colunas <strong>codigo_interno</strong> (ou código) e{' '}
        <strong>descricao</strong>. Opcional: unidade, ean, dun. Informe o <strong>nome da lista</strong> — os
        produtos entram em <strong>Todos os Produtos</strong> e na lista salva, visível na aba{' '}
        <strong>Produtos</strong> e disponível para inventário.
      </p>

      <div className="page-form-grid" style={{ maxWidth: 520 }}>
        <label className="page-form-grid__full">
          Nome da lista *
          <input
            value={nomeLista}
            onChange={(e) => {
              setNomeLista(e.target.value)
              if (erro) setErro('')
            }}
            placeholder="Ex.: CD Ultrapao guarulhos — importação jun/2026"
            required
            aria-invalid={linhas.length > 0 && !nomeLista.trim()}
          />
        </label>
        {linhas.length > 0 && !nomeLista.trim() ? (
          <p className="page-form-hint page-form-hint--err page-form-grid__full">
            Informe o nome da lista para concluir a importação.
          </p>
        ) : null}
        <label className="page-form-grid__full">
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
        <div className="page-form-grid__actions page-form-grid__actions--wrap">
          <button
            type="button"
            disabled={!podeImportar}
            onClick={() => void handleImportar()}
          >
            {importando ? 'Importando…' : `Importar ${linhas.length} linha(s)`}
          </button>
          <button type="button" className="page-btn-ghost" onClick={baixarModeloImportacao}>
            Baixar modelo da planilha
          </button>
        </div>
      </div>

      {erro ? <div className="page-form-alert page-form-alert--err">{erro}</div> : null}

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
          ref={feedbackRef}
          className="page-form-log"
        >
          {log.join('\n')}
        </pre>
      ) : null}
    </div>
  )
}
