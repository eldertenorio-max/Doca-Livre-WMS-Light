import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAppOnline } from '../lib/appConnectivity'
import {
  buildProductLookupMaps,
  buscarProdutoUnicoLocal,
  filtrarSugestoesProduto,
} from '../lib/buscaProdutoInventario'
import { findEnderecoByCodigo } from '../lib/enderecamentoStore'
import {
  fetchProductOptionByCodigoFromDb,
  fetchProductOptionByDescricaoFromDb,
} from '../lib/fetchProductOptionByCodigo'
import {
  addLinhaInventario,
  getInventario,
  type InventarioSessao,
} from '../lib/inventarioSessaoStore'
import { mapRowToProductOption, TABELA_PRODUTOS, type ProductOption } from '../lib/productOptionMapper'
import { subscribeTodosOsProdutosRealtime } from '../lib/subscribeTodosOsProdutosRealtime'
import { supabase } from '../lib/supabaseClient'

type Props = {
  inventarioId: string
  onVoltar: () => void
}

const SUGESTOES_MAX = 15

function formatDateBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatDateTimeBR(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('pt-BR')
}

export default function InventarioCaptura({ inventarioId, onVoltar }: Props) {
  const [sessao, setSessao] = useState<InventarioSessao | null>(() => getInventario(inventarioId) ?? null)
  const [produtos, setProdutos] = useState<ProductOption[]>([])
  const [produtosCarregando, setProdutosCarregando] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('')
  const [lote, setLote] = useState('')
  const [fabricacao, setFabricacao] = useState('')
  const [validade, setValidade] = useState('')
  const [produtoLabel, setProdutoLabel] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [sugestoesOpen, setSugestoesOpen] = useState(false)
  const [sugestaoIdx, setSugestaoIdx] = useState(0)

  const enderecoRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)
  const resolverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const online = isAppOnline()

  const productMaps = useMemo(() => buildProductLookupMaps(produtos), [produtos])

  const sugestoes = useMemo(
    () => filtrarSugestoesProduto(codigoBarras, produtos, productMaps, SUGESTOES_MAX),
    [codigoBarras, produtos, productMaps],
  )

  const loadProdutos = useCallback(async () => {
    setProdutosCarregando(true)
    try {
      const { data } = await supabase.from(TABELA_PRODUTOS).select('*').order('codigo_interno').limit(5000)
      const list = (data ?? [])
        .map((r) => mapRowToProductOption(r as Record<string, unknown>))
        .filter(Boolean) as ProductOption[]
      setProdutos(list)
    } finally {
      setProdutosCarregando(false)
    }
  }, [])

  useEffect(() => {
    void loadProdutos()
  }, [loadProdutos])

  useEffect(() => {
    const unsub = subscribeTodosOsProdutosRealtime(() => {
      void loadProdutos()
    })
    return unsub
  }, [loadProdutos])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadProdutos()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [loadProdutos])

  useEffect(() => {
    setSessao(getInventario(inventarioId) ?? null)
  }, [inventarioId])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!comboRef.current?.contains(e.target as Node)) setSugestoesOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  function aplicarProduto(p: ProductOption, textoBusca?: string) {
    setCodigoInterno(p.codigo)
    setProdutoLabel(p.descricao)
    setUnidade(p.unidade_medida ?? '')
    if (textoBusca !== undefined) setCodigoBarras(textoBusca)
    setErr('')
    setSugestoesOpen(false)
  }

  async function resolverProduto(scanned: string) {
    const q = scanned.trim()
    if (!q) {
      setProdutoLabel('')
      setCodigoInterno('')
      setUnidade('')
      return
    }

    let hit = buscarProdutoUnicoLocal(q, produtos, productMaps)
    if (!hit) {
      hit = await fetchProductOptionByCodigoFromDb(q)
    }
    if (!hit && q.length >= 2) {
      hit = await fetchProductOptionByDescricaoFromDb(q)
    }

    if (hit) {
      aplicarProduto(hit, q)
      if (!produtos.some((p) => p.codigo === hit!.codigo)) {
        setProdutos((prev) => [...prev, hit!].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR')))
      }
    } else {
      setCodigoInterno('')
      setProdutoLabel('Produto não encontrado — cadastre em Produtos')
      setUnidade('')
    }
  }

  function handleEnderecoBlur() {
    const cod = endereco.trim()
    if (!cod) return
    const found = findEnderecoByCodigo(cod)
    if (found) {
      setMsg(`Endereço: Câm. ${found.camara ?? '—'} · Rua ${found.rua || '—'} · Pos. ${found.posicao ?? '—'}`)
    } else {
      setMsg('Endereço não cadastrado (será gravado como digitado)')
    }
    barcodeRef.current?.focus()
  }

  function handleBuscaChange(v: string) {
    setCodigoBarras(v)
    setSugestoesOpen(true)
    setSugestaoIdx(0)
    if (resolverTimerRef.current) clearTimeout(resolverTimerRef.current)
    resolverTimerRef.current = setTimeout(() => {
      void resolverProduto(v)
    }, 280)
  }

  function selecionarSugestao(p: ProductOption) {
    aplicarProduto(p, p.ean?.trim() || p.codigo)
    ;(document.getElementById('inv-quantidade') as HTMLInputElement | null)?.focus()
  }

  function limparFormulario() {
    setEndereco('')
    setCodigoBarras('')
    setQuantidade('')
    setUnidade('')
    setLote('')
    setFabricacao('')
    setValidade('')
    setProdutoLabel('')
    setCodigoInterno('')
    setErr('')
    setSugestoesOpen(false)
    enderecoRef.current?.focus()
  }

  function handleSalvar() {
    if (!sessao) return
    if (sessao.status !== 'aberto') {
      setErr('Inventário fechado — somente leitura.')
      return
    }
    const end = endereco.trim()
    const bar = codigoBarras.trim()
    const q = Number(String(quantidade).replace(',', '.'))
    if (!end) {
      setErr('Informe o endereço.')
      return
    }
    if (!bar || !codigoInterno) {
      setErr('Informe EAN, código do produto ou descrição válida.')
      return
    }
    if (!Number.isFinite(q) || q < 0) {
      setErr('Quantidade inválida.')
      return
    }
    addLinhaInventario(sessao.id, {
      endereco: end,
      codigoBarras: bar,
      codigoInterno,
      descricao: produtoLabel,
      quantidade: q,
      unidade: unidade.trim(),
      lote: lote.trim(),
      fabricacao: fabricacao.trim(),
      validade: validade.trim(),
    })
    setSessao(getInventario(inventarioId) ?? null)
    setMsg(`Linha salva (${sessao.linhas.length + 1} no total)`)
    setErr('')
    limparFormulario()
  }

  if (!sessao) {
    return (
      <div className="page-panel">
        <p>Inventário não encontrado.</p>
        <button type="button" onClick={onVoltar}>
          Voltar
        </button>
      </div>
    )
  }

  const readonly = sessao.status !== 'aberto'
  const hoje = formatDateBR(new Date())

  return (
    <div className="inventario-captura-wrap">
      <div className="inventario-captura">
        <header className="inventario-captura__header">
          <button type="button" className="inventario-captura__back" onClick={onVoltar} aria-label="Voltar">
            ←
          </button>
          <h1 className="inventario-captura__title">{sessao.titulo}</h1>
        </header>

        {readonly ? (
          <div className="inventario-captura__alert inventario-captura__alert--readonly">
            Inventário finalizado — somente visualização. Use «Continuar» na lista para reabrir e coletar novamente.
          </div>
        ) : null}

        <div className="inventario-captura__info">
          <div className="inventario-captura__info-row">
            <span>{sessao.local}</span>
            <span>{hoje}</span>
          </div>
          <div className="inventario-captura__info-row">
            <span>Coletor 1</span>
            <span className={online ? 'inventario-captura__online' : 'inventario-captura__offline'}>
              {online ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="inventario-captura__info-row inventario-captura__info-row--muted">
            <span>{formatDateTimeBR(sessao.dataInicio)}</span>
            <span>{sessao.linhas.length} linha(s)</span>
          </div>
          <div className="inventario-captura__info-row inventario-captura__info-row--muted">
            <span>{produtosCarregando ? 'Atualizando produtos…' : `${produtos.length} produto(s) no cadastro`}</span>
          </div>
        </div>

        {err ? <div className="inventario-captura__alert inventario-captura__alert--err">{err}</div> : null}
        {msg ? <div className="inventario-captura__alert inventario-captura__alert--ok">{msg}</div> : null}

        <div className="inventario-captura__field">
          <label htmlFor="inv-endereco">Endereço</label>
          <div className="inventario-captura__input-row">
            <input
              id="inv-endereco"
              ref={enderecoRef}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              onBlur={handleEnderecoBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  barcodeRef.current?.focus()
                }
              }}
              disabled={readonly}
              autoComplete="off"
              placeholder="ex.: 21-A-03-02"
            />
            <button
              type="button"
              className="inventario-captura__action-btn"
              disabled={readonly}
              onClick={() => enderecoRef.current?.focus()}
            >
              Focar
            </button>
          </div>
        </div>

        <div className="inventario-captura__field" ref={comboRef}>
          <label htmlFor="inv-barcode">Código / barras / descrição</label>
          <div className="inventario-captura__input-row">
            <input
              id="inv-barcode"
              ref={barcodeRef}
              value={codigoBarras}
              onChange={(e) => handleBuscaChange(e.target.value)}
              onFocus={() => setSugestoesOpen(true)}
              onKeyDown={(e) => {
                if (sugestoesOpen && sugestoes.length > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setSugestaoIdx((i) => Math.min(i + 1, sugestoes.length - 1))
                    return
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setSugestaoIdx((i) => Math.max(i - 1, 0))
                    return
                  }
                  if (e.key === 'Enter' && sugestaoIdx >= 0 && sugestoes[sugestaoIdx]) {
                    e.preventDefault()
                    selecionarSugestao(sugestoes[sugestaoIdx])
                    return
                  }
                  if (e.key === 'Escape') {
                    setSugestoesOpen(false)
                    return
                  }
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void resolverProduto(codigoBarras).then(() => {
                    ;(document.getElementById('inv-quantidade') as HTMLInputElement | null)?.focus()
                  })
                }
              }}
              disabled={readonly}
              autoComplete="off"
              placeholder="EAN, 01.01.0001, 01010001 ou descrição"
              aria-autocomplete="list"
              aria-expanded={sugestoesOpen}
              aria-controls="inv-produto-sugestoes"
            />
            <button
              type="button"
              className="inventario-captura__action-btn"
              disabled={readonly}
              title="Ver lista de produtos"
              onClick={() => {
                setSugestoesOpen((v) => !v)
                barcodeRef.current?.focus()
              }}
            >
              Lista
            </button>
          </div>
          {sugestoesOpen && !readonly ? (
            <ul id="inv-produto-sugestoes" className="inventario-captura__sugestoes" role="listbox">
              {sugestoes.length === 0 ? (
                <li className="inventario-captura__sugestao inventario-captura__sugestao--empty">
                  {produtosCarregando ? 'Carregando…' : 'Nenhum produto encontrado'}
                </li>
              ) : (
                sugestoes.map((p, i) => (
                  <li key={p.codigo}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === sugestaoIdx}
                      className={`inventario-captura__sugestao${i === sugestaoIdx ? ' inventario-captura__sugestao--active' : ''}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selecionarSugestao(p)}
                    >
                      <span className="inventario-captura__sugestao-cod">{p.codigo}</span>
                      <span className="inventario-captura__sugestao-desc">{p.descricao}</span>
                      {p.ean ? (
                        <span className="inventario-captura__sugestao-ean">EAN {p.ean}</span>
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>

        <div className="inventario-captura__row-2">
          <div className="inventario-captura__field">
            <label htmlFor="inv-quantidade">Quantidade</label>
            <input
              id="inv-quantidade"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSalvar()
                }
              }}
              disabled={readonly}
              inputMode="decimal"
              placeholder="ex.: 12"
            />
          </div>
          <div className="inventario-captura__field">
            <label htmlFor="inv-unidade">Unidade</label>
            <input
              id="inv-unidade"
              value={unidade}
              readOnly
              className="inventario-captura__readonly"
              placeholder="PT, CX…"
            />
          </div>
        </div>

        <div className="inventario-captura__field">
          <label htmlFor="inv-lote">Lote</label>
          <input
            id="inv-lote"
            value={lote}
            onChange={(e) => setLote(e.target.value)}
            disabled={readonly}
            placeholder="ex.: L240628"
            autoComplete="off"
          />
        </div>

        <div className="inventario-captura__row-2">
          <div className="inventario-captura__field">
            <label htmlFor="inv-fabricacao">Fabricação</label>
            <div className="inventario-captura__input-row">
              <input
                id="inv-fabricacao"
                type="date"
                value={fabricacao}
                onChange={(e) => setFabricacao(e.target.value)}
                disabled={readonly}
                title="dd/mm/aaaa"
              />
              <button
                type="button"
                className="inventario-captura__action-btn inventario-captura__action-btn--icon"
                disabled={readonly}
                title="Abrir calendário"
                aria-label="Abrir calendário de fabricação"
                onClick={() => {
                  const el = document.getElementById('inv-fabricacao') as HTMLInputElement | null
                  el?.focus()
                  try {
                    el?.showPicker?.()
                  } catch {
                    /* showPicker indisponível */
                  }
                }}
              >
                📅
              </button>
            </div>
          </div>
          <div className="inventario-captura__field">
            <label htmlFor="inv-validade">Validade</label>
            <div className="inventario-captura__input-row">
              <input
                id="inv-validade"
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                disabled={readonly}
                title="dd/mm/aaaa"
              />
              <button
                type="button"
                className="inventario-captura__action-btn inventario-captura__action-btn--icon"
                disabled={readonly}
                title="Abrir calendário"
                aria-label="Abrir calendário de validade"
                onClick={() => {
                  const el = document.getElementById('inv-validade') as HTMLInputElement | null
                  el?.focus()
                  try {
                    el?.showPicker?.()
                  } catch {
                    /* showPicker indisponível */
                  }
                }}
              >
                📅
              </button>
            </div>
          </div>
        </div>

        <div className="inventario-captura__field">
          <label htmlFor="inv-produto">Produto</label>
          <input
            id="inv-produto"
            value={produtoLabel}
            readOnly
            className="inventario-captura__readonly"
            placeholder="Selecione na lista ou bipe/digite acima"
          />
        </div>

        <div className="inventario-captura__footer">
          <input
            readOnly
            value={codigoInterno ? `SKU ${codigoInterno}` : ''}
            placeholder="ex.: SKU 01.01.0001"
            className="inventario-captura__readonly inventario-captura__sku"
            aria-label="Código interno do produto"
          />
          <button
            type="button"
            className="inventario-captura__save"
            onClick={handleSalvar}
            disabled={readonly}
          >
            Salvar linha
          </button>
        </div>
      </div>
    </div>
  )
}
