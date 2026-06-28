import { useMemo, useState } from 'react'
import { getRuasPorCamara, INVENTARIO_CAMARAS } from '../components/inventario/inventarioPlanilhaModel'
import {
  buildCodigoEndereco,
  deleteEndereco,
  listEnderecosTodos,
  planejarEnderecosEmLote,
  saveEndereco,
  saveEnderecosEmLote,
  type EnderecoCadastro,
} from '../lib/enderecamentoStore'

const emptyForm = () => ({
  id: '',
  codigo: '',
  camara: '',
  rua: '',
  posicao: '',
  nivel: '',
  observacao: '',
})

const emptyLote = () => ({
  camara: '11',
  rua: 'A',
  nivelDe: '1',
  nivelAte: '5',
  posicaoDe: '1',
  posicaoAte: '15',
  observacao: '',
  substituirExistentes: false,
})

export default function CadastroEnderecamento() {
  const [rows, setRows] = useState<EnderecoCadastro[]>(() => listEnderecosTodos())
  const [form, setForm] = useState(emptyForm)
  const [lote, setLote] = useState(emptyLote)
  const [loteAberto, setLoteAberto] = useState(true)
  const [busca, setBusca] = useState('')
  const [loteMsg, setLoteMsg] = useState('')

  const ruasLote = useMemo(() => {
    const c = Number(lote.camara)
    if (!Number.isFinite(c)) return []
    return getRuasPorCamara(c)
  }, [lote.camara])

  const previewLote = useMemo(() => {
    const camara = Number(lote.camara)
    const nivelDe = Number(lote.nivelDe)
    const nivelAte = Number(lote.nivelAte)
    const posicaoDe = Number(lote.posicaoDe)
    const posicaoAte = Number(lote.posicaoAte)
    if (!Number.isFinite(camara) || !lote.rua.trim()) return []
    if (![nivelDe, nivelAte, posicaoDe, posicaoAte].every(Number.isFinite)) return []
    return planejarEnderecosEmLote({
      camara,
      rua: lote.rua,
      nivelDe,
      nivelAte,
      posicaoDe,
      posicaoAte,
      observacao: lote.observacao,
    })
  }, [lote])

  const filtrados = useMemo(() => {
    const q = busca.trim().toUpperCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.codigo.toUpperCase().includes(q) ||
        r.rua.toUpperCase().includes(q) ||
        String(r.camara ?? '').includes(q),
    )
  }, [rows, busca])

  function refresh() {
    setRows(listEnderecosTodos())
  }

  function editar(r: EnderecoCadastro) {
    setForm({
      id: r.id,
      codigo: r.codigo,
      camara: r.camara != null ? String(r.camara) : '',
      rua: r.rua,
      posicao: r.posicao != null ? String(r.posicao) : '',
      nivel: r.nivel != null ? String(r.nivel) : '',
      observacao: r.observacao,
    })
  }

  function limpar() {
    setForm(emptyForm())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.codigo.trim()) return
    saveEndereco({
      id: form.id || undefined,
      codigo: form.codigo,
      camara: form.camara ? Number(form.camara) : null,
      rua: form.rua,
      posicao: form.posicao ? Number(form.posicao) : null,
      nivel: form.nivel ? Number(form.nivel) : null,
      observacao: form.observacao,
      ativo: true,
    })
    limpar()
    refresh()
  }

  function handleLoteSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoteMsg('')
    const camara = Number(lote.camara)
    const nivelDe = Number(lote.nivelDe)
    const nivelAte = Number(lote.nivelAte)
    const posicaoDe = Number(lote.posicaoDe)
    const posicaoAte = Number(lote.posicaoAte)
    if (!Number.isFinite(camara) || camara <= 0) {
      setLoteMsg('Informe a câmara.')
      return
    }
    if (!lote.rua.trim()) {
      setLoteMsg('Selecione a rua.')
      return
    }
    if (![nivelDe, nivelAte, posicaoDe, posicaoAte].every(Number.isFinite)) {
      setLoteMsg('Níveis e posições devem ser números válidos.')
      return
    }
    if (nivelDe < 1 || nivelAte < nivelDe) {
      setLoteMsg('Faixa de níveis inválida.')
      return
    }
    if (posicaoDe < 1 || posicaoAte < posicaoDe) {
      setLoteMsg('Faixa de posições (colunas) inválida.')
      return
    }

    const res = saveEnderecosEmLote({
      camara,
      rua: lote.rua,
      nivelDe,
      nivelAte,
      posicaoDe,
      posicaoAte,
      observacao: lote.observacao,
      substituirExistentes: lote.substituirExistentes,
    })
    refresh()
    const partes = [`${res.criados} criado(s)`]
    if (res.atualizados) partes.push(`${res.atualizados} atualizado(s)`)
    if (res.ignorados) partes.push(`${res.ignorados} já existente(s) — ignorado(s)`)
    setLoteMsg(`Lote concluído: ${partes.join(', ')} (total ${res.total} endereços no intervalo).`)
  }

  const exemploCodigo =
    previewLote.length > 0
      ? previewLote[0].codigo
      : buildCodigoEndereco(11, 'A', 1, 1)

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Cadastro de endereçamento</h1>
      <p className="page-panel__subtitle">
        Endereços usados na contagem do inventário (câmara, rua, posição, nível). O código é o que o conferente bipa na
        tela de captura — formato padrão: <strong>{exemploCodigo}</strong> (câmara-rua-posição-nível).
      </p>

      <section className="endereco-lote-panel">
        <button
          type="button"
          className="endereco-lote-panel__toggle"
          onClick={() => setLoteAberto((v) => !v)}
        >
          {loteAberto ? '▼' : '▶'} Cadastrar vários de uma vez
        </button>

        {loteAberto ? (
          <form className="page-form-grid endereco-lote-form" onSubmit={handleLoteSubmit}>
            <label>
              Câmara *
              <select
                value={lote.camara}
                onChange={(e) => {
                  const cam = e.target.value
                  const ruas = getRuasPorCamara(Number(cam))
                  setLote((f) => ({
                    ...f,
                    camara: cam,
                    rua: ruas.includes(f.rua) ? f.rua : (ruas[0] ?? ''),
                  }))
                }}
              >
                {INVENTARIO_CAMARAS.map((c) => (
                  <option key={c} value={String(c)}>
                    Câmara {c}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rua *
              <select value={lote.rua} onChange={(e) => setLote((f) => ({ ...f, rua: e.target.value }))}>
                {ruasLote.length === 0 ? (
                  <option value="">—</option>
                ) : (
                  ruasLote.map((r) => (
                    <option key={r} value={r}>
                      Rua {r}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              Nível de
              <input
                value={lote.nivelDe}
                onChange={(e) => setLote((f) => ({ ...f, nivelDe: e.target.value }))}
                inputMode="numeric"
                min={1}
              />
            </label>
            <label>
              Nível até
              <input
                value={lote.nivelAte}
                onChange={(e) => setLote((f) => ({ ...f, nivelAte: e.target.value }))}
                inputMode="numeric"
                min={1}
              />
            </label>
            <label>
              Coluna (pos.) de
              <input
                value={lote.posicaoDe}
                onChange={(e) => setLote((f) => ({ ...f, posicaoDe: e.target.value }))}
                inputMode="numeric"
                min={1}
              />
            </label>
            <label>
              Coluna (pos.) até
              <input
                value={lote.posicaoAte}
                onChange={(e) => setLote((f) => ({ ...f, posicaoAte: e.target.value }))}
                inputMode="numeric"
                min={1}
              />
            </label>
            <label className="page-form-grid__full">
              Observação (opcional, igual em todos)
              <input
                value={lote.observacao}
                onChange={(e) => setLote((f) => ({ ...f, observacao: e.target.value }))}
              />
            </label>
            <label className="page-form-grid__full endereco-lote-check">
              <input
                type="checkbox"
                checked={lote.substituirExistentes}
                onChange={(e) => setLote((f) => ({ ...f, substituirExistentes: e.target.checked }))}
              />
              Atualizar endereços que já existirem com o mesmo código
            </label>
            <div className="page-form-grid__full endereco-lote-preview">
              <strong>{previewLote.length}</strong> endereço(s) serão gerados
              {previewLote.length > 0 ? (
                <span className="endereco-lote-preview__ex">
                  {' '}
                  — ex.: {previewLote[0].codigo}
                  {previewLote.length > 1 ? ` … ${previewLote[previewLote.length - 1].codigo}` : ''}
                </span>
              ) : null}
            </div>
            <div className="page-form-grid__actions">
              <button type="submit">Gerar {previewLote.length || ''} endereços</button>
            </div>
            {loteMsg ? <p className="page-form-grid__full endereco-lote-msg">{loteMsg}</p> : null}
          </form>
        ) : null}
      </section>

      <h2 className="page-panel__section-title">Cadastro individual</h2>

      <form className="page-form-grid" onSubmit={handleSubmit}>
        <label>
          Código do endereço *
          <input
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            placeholder="Ex.: 11-A-05-02"
            required
          />
        </label>
        <label>
          Câmara
          <input
            value={form.camara}
            onChange={(e) => setForm((f) => ({ ...f, camara: e.target.value }))}
            inputMode="numeric"
          />
        </label>
        <label>
          Rua
          <input value={form.rua} onChange={(e) => setForm((f) => ({ ...f, rua: e.target.value.toUpperCase() }))} />
        </label>
        <label>
          Posição
          <input
            value={form.posicao}
            onChange={(e) => setForm((f) => ({ ...f, posicao: e.target.value }))}
            inputMode="numeric"
          />
        </label>
        <label>
          Nível
          <input
            value={form.nivel}
            onChange={(e) => setForm((f) => ({ ...f, nivel: e.target.value }))}
            inputMode="numeric"
          />
        </label>
        <label className="page-form-grid__full">
          Observação
          <input
            value={form.observacao}
            onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
          />
        </label>
        <div className="page-form-grid__actions">
          <button type="submit">{form.id ? 'Atualizar endereço' : 'Cadastrar endereço'}</button>
          {form.id ? (
            <button type="button" className="page-btn-ghost" onClick={limpar}>
              Cancelar edição
            </button>
          ) : null}
        </div>
      </form>

      <section style={{ marginTop: 24 }}>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Filtrar endereços…"
          style={{ marginBottom: 12, maxWidth: 320 }}
        />
        <div className="page-table-wrap">
          <table className="page-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Câmara</th>
                <th>Rua</th>
                <th>Pos.</th>
                <th>Nív.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => (
                <tr key={r.id}>
                  <td>{r.codigo}</td>
                  <td>{r.camara ?? '—'}</td>
                  <td>{r.rua || '—'}</td>
                  <td>{r.posicao ?? '—'}</td>
                  <td>{r.nivel ?? '—'}</td>
                  <td>
                    <button type="button" className="page-btn-ghost" onClick={() => editar(r)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="page-btn-ghost page-btn-danger"
                      onClick={() => {
                        if (confirm('Excluir este endereço?')) {
                          deleteEndereco(r.id)
                          refresh()
                        }
                      }}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
