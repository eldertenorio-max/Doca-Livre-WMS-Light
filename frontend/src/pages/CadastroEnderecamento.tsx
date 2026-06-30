import { useCallback, useEffect, useMemo, useState } from 'react'
import { getRuasPorCamara, INVENTARIO_CAMARAS } from '../components/inventario/inventarioPlanilhaModel'
import {
  createEnderecoLista,
  ensureEnderecoListaPadrao,
  listEnderecoListas,
  saveEnderecoLista,
  type EnderecoLista,
} from '../lib/enderecamentoListaSupabase'
import {
  buildCodigoEndereco,
  contarEnderecosPorFiltroEm,
  deleteEnderecoEm,
  deleteEnderecosPorFiltroEm,
  deleteTodosEnderecosEm,
  planejarEnderecosEmLote,
  saveEnderecoEm,
  saveEnderecosEmLoteEm,
  type EnderecoCadastro,
} from '../lib/enderecamentoStore'
import { formatUnknownError } from '../lib/supabaseError'

const PAGE_SIZE = 30

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

const emptyExclusao = () => ({
  camara: '11',
  rua: 'A',
  nivel: '',
})

export default function CadastroEnderecamento() {
  const [listas, setListas] = useState<EnderecoLista[]>([])
  const [listaAtual, setListaAtual] = useState<EnderecoLista | null>(null)
  const [rows, setRows] = useState<EnderecoCadastro[]>([])
  const [listaLoading, setListaLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [listaMsg, setListaMsg] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [lote, setLote] = useState(emptyLote)
  const [loteAberto, setLoteAberto] = useState(true)
  const [exclusaoAberta, setExclusaoAberta] = useState(false)
  const [exclusao, setExclusao] = useState(emptyExclusao)
  const [exclusaoMsg, setExclusaoMsg] = useState('')
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [loteMsg, setLoteMsg] = useState('')

  const sortRows = useCallback(
    (list: EnderecoCadastro[]) => [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR')),
    [],
  )

  const carregarListas = useCallback(
    async (selectId?: string) => {
      setListaLoading(true)
      setListaMsg('')
      try {
        await ensureEnderecoListaPadrao()
        const all = await listEnderecoListas()
        setListas(all)
        const id = selectId ?? listaAtual?.id ?? all[0]?.id ?? ''
        const lista = all.find((l) => l.id === id) ?? all[0] ?? null
        setListaAtual(lista)
        setRows(lista ? sortRows(lista.enderecos) : [])
      } catch (e: unknown) {
        setListaMsg(formatUnknownError(e) || 'Erro ao carregar listas de endereçamento.')
      } finally {
        setListaLoading(false)
      }
    },
    [listaAtual?.id, sortRows],
  )

  useEffect(() => {
    void carregarListas()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const persistRows = useCallback(
    async (newRows: EnderecoCadastro[]) => {
      if (!listaAtual) return
      setSalvando(true)
      setListaMsg('')
      try {
        const saved = await saveEnderecoLista({ ...listaAtual, enderecos: newRows })
        setListaAtual(saved)
        const sorted = sortRows(saved.enderecos)
        setRows(sorted)
        setListas((prev) => prev.map((l) => (l.id === saved.id ? saved : l)))
      } catch (e: unknown) {
        setListaMsg(formatUnknownError(e) || 'Erro ao salvar lista.')
        throw e
      } finally {
        setSalvando(false)
      }
    },
    [listaAtual, sortRows],
  )

  function selecionarLista(id: string) {
    const lista = listas.find((l) => l.id === id)
    if (!lista) return
    setListaAtual(lista)
    setRows(sortRows(lista.enderecos))
    setPage(1)
    setForm(emptyForm())
    setListaMsg('')
  }

  async function criarNovaLista() {
    const nome = window.prompt('Nome da nova lista de endereçamento:')
    if (!nome?.trim()) return
    try {
      const nova = await createEnderecoLista(nome.trim())
      await carregarListas(nova.id)
      setListaMsg(`Lista «${nova.nome}» criada.`)
    } catch (e: unknown) {
      setListaMsg(formatUnknownError(e) || 'Erro ao criar lista.')
    }
  }

  async function salvarListaAtual() {
    if (!listaAtual) return
    const nome = window.prompt('Nome da lista de endereçamento:', listaAtual.nome)
    if (!nome?.trim()) return
    setSalvando(true)
    try {
      const saved = await saveEnderecoLista({ ...listaAtual, nome: nome.trim(), enderecos: rows })
      setListaAtual(saved)
      setListas((prev) => {
        const rest = prev.filter((l) => l.id !== saved.id)
        return [...rest, saved].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      })
      setListaMsg(`Lista «${saved.nome}» salva (${rows.length} endereço(s)).`)
    } catch (e: unknown) {
      setListaMsg(formatUnknownError(e) || 'Erro ao salvar lista.')
    } finally {
      setSalvando(false)
    }
  }

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

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const pageSafe = Math.min(page, totalPages)
  const slice = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE
    return filtrados.slice(start, start + PAGE_SIZE)
  }, [filtrados, pageSafe])

  const rangeFrom = filtrados.length === 0 ? 0 : (pageSafe - 1) * PAGE_SIZE + 1
  const rangeTo = filtrados.length === 0 ? 0 : Math.min(pageSafe * PAGE_SIZE, filtrados.length)

  useEffect(() => {
    setPage(1)
  }, [busca])

  const ruasExclusao = useMemo(() => {
    const c = Number(exclusao.camara)
    if (!Number.isFinite(c)) return []
    return getRuasPorCamara(c)
  }, [exclusao.camara])

  const previewExclusaoNivel = useMemo(() => {
    const camara = Number(exclusao.camara)
    const nivel = Number(exclusao.nivel)
    if (!Number.isFinite(camara) || !exclusao.rua.trim() || !Number.isFinite(nivel)) return 0
    return contarEnderecosPorFiltroEm(rows, { camara, rua: exclusao.rua, nivel })
  }, [exclusao, rows])

  const previewExclusaoRua = useMemo(() => {
    const camara = Number(exclusao.camara)
    if (!Number.isFinite(camara) || !exclusao.rua.trim()) return 0
    return contarEnderecosPorFiltroEm(rows, { camara, rua: exclusao.rua })
  }, [exclusao.camara, exclusao.rua, rows])

  const previewExclusaoCamara = useMemo(() => {
    const camara = Number(exclusao.camara)
    if (!Number.isFinite(camara)) return 0
    return contarEnderecosPorFiltroEm(rows, { camara })
  }, [exclusao.camara, rows])

  async function executarExclusao(tipo: 'nivel' | 'rua' | 'camara' | 'todos') {
    setExclusaoMsg('')
    const camara = Number(exclusao.camara)

    if (tipo === 'todos') {
      const n = rows.length
      if (n === 0) {
        setExclusaoMsg('Não há endereços para excluir.')
        return
      }
      if (!confirm(`Excluir TODOS os ${n} endereços desta lista? Esta ação não pode ser desfeita.`)) return
      if (!confirm('Confirme novamente: apagar todos os endereços desta lista?')) return
      try {
        await persistRows(deleteTodosEnderecosEm())
        setPage(1)
        setExclusaoMsg(`${n} endereço(s) excluído(s).`)
      } catch {
        setExclusaoMsg('Erro ao excluir endereços.')
      }
      return
    }

    if (!Number.isFinite(camara)) {
      setExclusaoMsg('Selecione a câmara.')
      return
    }

    if (tipo === 'camara') {
      const n = previewExclusaoCamara
      if (n === 0) {
        setExclusaoMsg('Nenhum endereço nesta câmara.')
        return
      }
      if (!confirm(`Excluir ${n} endereço(s) da câmara ${camara}?`)) return
      try {
        const next = deleteEnderecosPorFiltroEm(rows, { camara })
        await persistRows(next)
        setPage(1)
        setExclusaoMsg(`${n} endereço(s) da câmara ${camara} excluído(s).`)
      } catch {
        setExclusaoMsg('Erro ao excluir endereços.')
      }
      return
    }

    if (!exclusao.rua.trim()) {
      setExclusaoMsg('Selecione a rua.')
      return
    }

    if (tipo === 'rua') {
      const n = previewExclusaoRua
      if (n === 0) {
        setExclusaoMsg('Nenhum endereço nesta rua.')
        return
      }
      if (!confirm(`Excluir ${n} endereço(s) da câmara ${camara}, rua ${exclusao.rua}?`)) return
      try {
        const next = deleteEnderecosPorFiltroEm(rows, { camara, rua: exclusao.rua })
        await persistRows(next)
        setPage(1)
        setExclusaoMsg(`${n} endereço(s) da rua ${exclusao.rua} (câm. ${camara}) excluído(s).`)
      } catch {
        setExclusaoMsg('Erro ao excluir endereços.')
      }
      return
    }

    const nivel = Number(exclusao.nivel)
    if (!Number.isFinite(nivel)) {
      setExclusaoMsg('Informe o nível a excluir.')
      return
    }
    const n = previewExclusaoNivel
    if (n === 0) {
      setExclusaoMsg('Nenhum endereço neste nível.')
      return
    }
    if (
      !confirm(
        `Excluir ${n} endereço(s) — câmara ${camara}, rua ${exclusao.rua}, nível ${nivel}?`,
      )
    ) {
      return
    }
    try {
      const next = deleteEnderecosPorFiltroEm(rows, { camara, rua: exclusao.rua, nivel })
      await persistRows(next)
      setPage(1)
      setExclusaoMsg(
        `${n} endereço(s) do nível ${nivel} (câm. ${camara}, rua ${exclusao.rua}) excluído(s).`,
      )
    } catch {
      setExclusaoMsg('Erro ao excluir endereços.')
    }
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
    if (!form.codigo.trim() || !listaAtual) return
    const { all } = saveEnderecoEm(rows, {
      id: form.id || undefined,
      codigo: form.codigo,
      camara: form.camara ? Number(form.camara) : null,
      rua: form.rua,
      posicao: form.posicao ? Number(form.posicao) : null,
      nivel: form.nivel ? Number(form.nivel) : null,
      observacao: form.observacao,
      ativo: true,
    })
    void persistRows(all).then(() => limpar())
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

    const { all, resultado: res } = saveEnderecosEmLoteEm(rows, {
      camara,
      rua: lote.rua,
      nivelDe,
      nivelAte,
      posicaoDe,
      posicaoAte,
      observacao: lote.observacao,
      substituirExistentes: lote.substituirExistentes,
    })
    void persistRows(all).then(() => {
      const partes = [`${res.criados} criado(s)`]
      if (res.atualizados) partes.push(`${res.atualizados} atualizado(s)`)
      if (res.ignorados) partes.push(`${res.ignorados} já existente(s) — ignorado(s)`)
      setLoteMsg(`Lote concluído: ${partes.join(', ')} (total ${res.total} endereços no intervalo).`)
    })
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

      <section className="page-form-grid endereco-lista-toolbar" style={{ marginBottom: '1rem' }}>
        <label className="page-form-grid__full">
          Lista de endereçamento
          <select
            value={listaAtual?.id ?? ''}
            disabled={listaLoading || salvando}
            onChange={(e) => selecionarLista(e.target.value)}
          >
            {listas.length === 0 ? <option value="">— Carregando —</option> : null}
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome} ({l.enderecos.filter((e) => e.ativo !== false).length} endereços)
              </option>
            ))}
          </select>
        </label>
        <div className="page-form-grid__full" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" disabled={listaLoading || salvando} onClick={() => void criarNovaLista()}>
            Nova lista
          </button>
          <button type="button" disabled={!listaAtual || salvando} onClick={() => void salvarListaAtual()}>
            {salvando ? 'Salvando…' : 'Salvar lista'}
          </button>
        </div>
        {listaMsg ? <p className="page-form-grid__full page-msg">{listaMsg}</p> : null}
      </section>

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

      <section className="endereco-lote-panel endereco-exclusao-panel">
        <button
          type="button"
          className="endereco-lote-panel__toggle endereco-exclusao-panel__toggle"
          onClick={() => setExclusaoAberta((v) => !v)}
        >
          {exclusaoAberta ? '▼' : '▶'} Excluir endereços em lote
        </button>

        {exclusaoAberta ? (
          <div className="endereco-exclusao-form">
            <p className="endereco-exclusao-form__hint">
              Escolha o alcance da exclusão. Endereço individual continua disponível na tabela abaixo.
            </p>
            <div className="page-form-grid">
              <label>
                Câmara
                <select
                  value={exclusao.camara}
                  onChange={(e) => {
                    const cam = e.target.value
                    const ruas = getRuasPorCamara(Number(cam))
                    setExclusao((f) => ({
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
                Rua
                <select
                  value={exclusao.rua}
                  onChange={(e) => setExclusao((f) => ({ ...f, rua: e.target.value }))}
                >
                  {ruasExclusao.length === 0 ? (
                    <option value="">—</option>
                  ) : (
                    ruasExclusao.map((r) => (
                      <option key={r} value={r}>
                        Rua {r}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label>
                Nível (só para excluir um nível)
                <input
                  value={exclusao.nivel}
                  onChange={(e) => setExclusao((f) => ({ ...f, nivel: e.target.value }))}
                  inputMode="numeric"
                  placeholder="Ex.: 3"
                />
              </label>
            </div>

            <div className="endereco-exclusao-form__actions">
              <button
                type="button"
                className="page-btn-ghost page-btn-danger"
                disabled={previewExclusaoNivel === 0}
                onClick={() => executarExclusao('nivel')}
              >
                Excluir nível ({previewExclusaoNivel})
              </button>
              <button
                type="button"
                className="page-btn-ghost page-btn-danger"
                disabled={previewExclusaoRua === 0}
                onClick={() => executarExclusao('rua')}
              >
                Excluir rua inteira ({previewExclusaoRua})
              </button>
              <button
                type="button"
                className="page-btn-ghost page-btn-danger"
                disabled={previewExclusaoCamara === 0}
                onClick={() => executarExclusao('camara')}
              >
                Excluir câmara inteira ({previewExclusaoCamara})
              </button>
              <button
                type="button"
                className="page-btn-ghost page-btn-danger endereco-exclusao-form__btn-todos"
                disabled={rows.length === 0}
                onClick={() => executarExclusao('todos')}
              >
                Excluir tudo ({rows.length})
              </button>
            </div>
            {exclusaoMsg ? <p className="endereco-exclusao-form__msg">{exclusaoMsg}</p> : null}
          </div>
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

        {filtrados.length > 0 ? (
          <p className="page-panel__meta">
            Mostrando {rangeFrom}–{rangeTo} de {filtrados.length} endereço(s)
            {busca.trim() ? ' (filtrado)' : ''} · Página {pageSafe} de {totalPages}
          </p>
        ) : (
          <p className="page-panel__meta">Nenhum endereço{busca.trim() ? ' com este filtro' : ''}.</p>
        )}

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
              {slice.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhum endereço nesta página.</td>
                </tr>
              ) : (
                slice.map((r) => (
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
                          if (confirm(`Excluir o endereço ${r.codigo}?`)) {
                            const next = deleteEnderecoEm(rows, r.id)
                            void persistRows(next).then(() => {
                              if (form.id === r.id) limpar()
                            })
                          }
                        }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtrados.length > PAGE_SIZE ? (
          <div className="page-pagination">
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </button>
            <span>
              Página {pageSafe} de {totalPages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima
            </button>
          </div>
        ) : null}
      </section>
    </div>
  )
}
