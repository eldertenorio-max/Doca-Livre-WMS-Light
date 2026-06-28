import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnknownError } from '../lib/supabaseError'
import { supabase } from '../lib/supabaseClient'

const TABELA = 'Todos os Produtos'

type ProdutoRow = {
  id: string
  codigo_interno: string
  descricao: string
  unidade: string | null
  ean: string | null
  dun: string | null
}

function normEanDun(v: string): string | null {
  const t = v.trim()
  return t === '' ? null : t
}

export default function CadastroProdutos() {
  const [rows, setRows] = useState<ProdutoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busca, setBusca] = useState('')

  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [unidade, setUnidade] = useState('')
  const [ean, setEan] = useState('')
  const [dun, setDun] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: e } = await supabase
        .from(TABELA)
        .select('id,codigo_interno,descricao,unidade,ean,dun')
        .order('codigo_interno')
        .limit(2000)
      if (e) throw e
      setRows((data ?? []) as ProdutoRow[])
    } catch (e) {
      setError(formatUnknownError(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return rows.slice(0, 100)
    return rows
      .filter(
        (r) =>
          r.codigo_interno.toLowerCase().includes(q) ||
          r.descricao.toLowerCase().includes(q) ||
          String(r.ean ?? '').includes(q),
      )
      .slice(0, 100)
  }, [rows, busca])

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault()
    const cod = codigo.trim()
    const desc = descricao.trim()
    if (!cod || !desc) {
      setError('Código e descrição são obrigatórios.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const payload: Record<string, unknown> = {
        codigo_interno: cod,
        descricao: desc,
        unidade: unidade.trim() || null,
        ean: normEanDun(ean),
        dun: normEanDun(dun),
      }
      const { error: insErr } = await supabase.from(TABELA).insert(payload)
      if (insErr) throw insErr
      setSuccess(`Produto ${cod} cadastrado.`)
      setCodigo('')
      setDescricao('')
      setUnidade('')
      setEan('')
      setDun('')
      await load()
    } catch (err) {
      setError(formatUnknownError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Cadastro de produtos</h1>
      <p className="page-panel__subtitle">
        Cadastre produtos no sistema (substitui a planilha como base). A aba <strong>Base de dados</strong> continua
        disponível para consulta e manutenção avançada.
      </p>

      {error ? <div className="page-alert page-alert--error">{error}</div> : null}
      {success ? <div className="page-alert page-alert--ok">{success}</div> : null}

      <form className="page-form-grid" onSubmit={(ev) => void handleSalvar(ev)}>
        <label>
          Código interno
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        </label>
        <label>
          Descrição
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} required />
        </label>
        <label>
          Unidade
          <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="CX, UN, KG…" />
        </label>
        <label>
          EAN
          <input value={ean} onChange={(e) => setEan(e.target.value)} inputMode="numeric" />
        </label>
        <label>
          DUN
          <input value={dun} onChange={(e) => setDun(e.target.value)} inputMode="numeric" />
        </label>
        <div className="page-form-grid__actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Cadastrar produto'}
          </button>
        </div>
      </form>

      <section style={{ marginTop: 28 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Produtos cadastrados</h2>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar código, descrição ou EAN…"
            style={{ flex: '1 1 200px', maxWidth: 360 }}
          />
          <button type="button" onClick={() => void load()} disabled={loading}>
            Atualizar
          </button>
        </div>
        {loading ? (
          <p>Carregando…</p>
        ) : (
          <div className="page-table-wrap">
            <table className="page-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descrição</th>
                  <th>Unidade</th>
                  <th>EAN</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id}>
                    <td>{r.codigo_interno}</td>
                    <td>{r.descricao}</td>
                    <td>{r.unidade ?? '—'}</td>
                    <td>{r.ean ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
