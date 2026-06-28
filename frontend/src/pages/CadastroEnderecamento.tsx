import { useMemo, useState } from 'react'
import {
  deleteEndereco,
  listEnderecosTodos,
  saveEndereco,
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

export default function CadastroEnderecamento() {
  const [rows, setRows] = useState<EnderecoCadastro[]>(() => listEnderecosTodos())
  const [form, setForm] = useState(emptyForm)
  const [busca, setBusca] = useState('')

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

  return (
    <div className="page-panel">
      <h1 className="page-panel__title">Cadastro de endereçamento</h1>
      <p className="page-panel__subtitle">
        Endereços usados na contagem do inventário (câmara, rua, posição, nível). O código do endereço é o que o
        conferente bipa ou digita na tela de captura.
      </p>

      <form className="page-form-grid" onSubmit={handleSubmit}>
        <label>
          Código do endereço *
          <input
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
            placeholder="Ex.: 21-G-05-02"
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
