import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isAppOnline } from '../lib/appConnectivity'
import { usernameFromSession } from '../lib/authUser'
import {
  buildProductLookupMaps,
  buscarProdutoUnicoLocal,
  filtrarSugestoesProduto,
} from '../lib/buscaProdutoInventario'
import {
  fetchInventarioCapturaPresenca,
  nomesContadoresAtivos,
  PRESENCA_PING_INTERVAL_MS,
  PRESENCA_POLL_INTERVAL_MS,
  upsertInventarioCapturaPresenca,
  type InventarioCapturaPresencaRow,
} from '../lib/inventarioCapturaPresenca'
import { camaraFromEnderecoCodigo, findEnderecoByCodigo, formatEnderecoCodigoInput, normalizeEnderecoCodigo } from '../lib/enderecamentoStore'
import {
  findEnderecoNaLista,
  getEnderecoLista,
  type EnderecoLista,
} from '../lib/enderecamentoListaSupabase'
import {
  fetchProductOptionByCodigoFromDb,
  fetchProductOptionByDescricaoFromDb,
} from '../lib/fetchProductOptionByCodigo'
import {
  addLinhaInventario,
  deleteLinhaInventario,
  enderecoPermitidoNaSessao,
  getInventario,
  updateLinhaInventario,
  type InventarioLinhaCaptura,
  type InventarioSessao,
} from '../lib/inventarioSessaoStore'
import {
  getProdutoLista,
  produtoListaParaProductOptions,
} from '../lib/produtoListaSupabase'
import { mapRowToProductOption, TABELA_PRODUTOS, type ProductOption } from '../lib/productOptionMapper'
import { supabase } from '../lib/supabaseClient'

type Props = {
  inventarioId: string
  onVoltar: () => void
  session?: Session | null
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

function formatYmdBR(isoYmd: string) {
  if (!isoYmd?.trim()) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(isoYmd.slice(0, 10))
  if (!m) return isoYmd
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDataLinha(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function linhaCamaraLabel(linha: InventarioLinhaCaptura): string {
  if (linha.camara != null && Number.isFinite(linha.camara)) return String(linha.camara)
  const parsed = camaraFromEnderecoCodigo(linha.endereco)
  return parsed != null ? String(parsed) : '—'
}

function IconFlash() {
  return (
    <svg className="inventario-captura__btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 2v11h3v9l7-12h-4l4-8z" />
    </svg>
  )
}

function IconBarcode() {
  return (
    <svg className="inventario-captura__btn-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M2 6h2v12H2V6zm3 0h1v12H5V6zm2 0h3v12H7V6zm4 0h1v12h-1V6zm2 0h2v12h-2V6zm3 0h1v12h-1V6zm2 0h3v12h-3V6z" />
    </svg>
  )
}

function IconSave() {
  return (
    <svg className="inventario-captura__btn-icon" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
    </svg>
  )
}

export default function InventarioCaptura({ inventarioId, onVoltar, session }: Props) {
  const [sessao, setSessao] = useState<InventarioSessao | null>(null)
  const [sessaoLoading, setSessaoLoading] = useState(true)
  const [listaEndereco, setListaEndereco] = useState<EnderecoLista | null>(null)
  const [produtos, setProdutos] = useState<ProductOption[]>([])
  const [produtosCarregando, setProdutosCarregando] = useState(false)
  const [endereco, setEndereco] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('')
  const [up, setUp] = useState('')
  const [lote, setLote] = useState('')
  const [fabricacao, setFabricacao] = useState('')
  const [validade, setValidade] = useState('')
  const [produtoLabel, setProdutoLabel] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [sugestoesOpen, setSugestoesOpen] = useState(false)
  const [sugestaoIdx, setSugestaoIdx] = useState(0)
  const [presencaRows, setPresencaRows] = useState<InventarioCapturaPresencaRow[]>([])
  const [editandoLinhaId, setEditandoLinhaId] = useState<string | null>(null)

  const enderecoRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)
  const resolverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const online = isAppOnline()
  const usuarioLogado = usernameFromSession(session)

  const contadoresOnline = useMemo(
    () => nomesContadoresAtivos(presencaRows, usuarioLogado),
    [presencaRows, usuarioLogado],
  )

  const productMaps = useMemo(() => buildProductLookupMaps(produtos), [produtos])

  const sugestoes = useMemo(
    () => filtrarSugestoesProduto(codigoBarras, produtos, productMaps, SUGESTOES_MAX),
    [codigoBarras, produtos, productMaps],
  )

  const linhasSalvas = useMemo(
    () => [...(sessao?.linhas ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessao?.linhas],
  )

  const posicoesInventario = useMemo(() => {
    const list = sessao?.posicoesCodigos ?? []
    return [...list].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [sessao?.posicoesCodigos])

  const loadProdutos = useCallback(async (listaProdutosId?: string | null) => {
    setProdutosCarregando(true)
    try {
      if (listaProdutosId) {
        const lista = await getProdutoLista(listaProdutosId)
        if (lista) {
          setProdutos(produtoListaParaProductOptions(lista))
          return
        }
      }
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
    if (sessao?.listaProdutosId) {
      void loadProdutos(sessao.listaProdutosId)
    } else if (!sessaoLoading) {
      void loadProdutos(null)
    }
  }, [sessao?.listaProdutosId, sessaoLoading, loadProdutos])

  useEffect(() => {
    let alive = true
    setSessaoLoading(true)
    void (async () => {
      try {
        const inv = await getInventario(inventarioId)
        if (alive) setSessao(inv)
      } catch {
        if (alive) setSessao(null)
      } finally {
        if (alive) setSessaoLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [inventarioId])

  useEffect(() => {
    let alive = true
    const listaId = sessao?.listaEnderecamentoId
    if (!listaId) {
      setListaEndereco(null)
      return
    }
    void (async () => {
      try {
        const lista = await getEnderecoLista(listaId)
        if (alive) setListaEndereco(lista)
      } catch {
        if (alive) setListaEndereco(null)
      }
    })()
    return () => {
      alive = false
    }
  }, [sessao?.listaEnderecamentoId])

  useEffect(() => {
    if (!inventarioId || sessao?.status === 'fechado' || !online) return
    const nome = usuarioLogado.trim()
    if (!nome || nome === 'usuário') return

    const ping = () => void upsertInventarioCapturaPresenca(inventarioId, nome)
    void ping()
    const id = window.setInterval(ping, PRESENCA_PING_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [inventarioId, sessao?.status, online, usuarioLogado])

  useEffect(() => {
    if (!inventarioId || !online) return
    let cancelled = false
    const load = async () => {
      const rows = await fetchInventarioCapturaPresenca(inventarioId)
      if (!cancelled) setPresencaRows(rows)
    }
    void load()
    const id = window.setInterval(() => void load(), PRESENCA_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [inventarioId, online])

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
    const cod = normalizeEnderecoCodigo(endereco.trim())
    if (cod !== endereco) setEndereco(cod)
    if (!cod) return
    if (sessao && !enderecoPermitidoNaSessao(sessao, cod)) {
      setErr('Endereço fora das posições deste inventário.')
      setMsg('')
      return
    }
    const found = listaEndereco ? findEnderecoNaLista(listaEndereco, cod) : findEnderecoByCodigo(cod)
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
    setUp('')
    setLote('')
    setFabricacao('')
    setValidade('')
    setProdutoLabel('')
    setCodigoInterno('')
    setErr('')
    setSugestoesOpen(false)
    setEditandoLinhaId(null)
    enderecoRef.current?.focus()
  }

  function resolverCamaraEndereco(end: string): number | null {
    const found = listaEndereco ? findEnderecoNaLista(listaEndereco, end) : findEnderecoByCodigo(end)
    if (found?.camara != null) return found.camara
    return camaraFromEnderecoCodigo(end)
  }

  function iniciarEdicaoLinha(linha: InventarioLinhaCaptura) {
    if (!sessao || sessao.status !== 'aberto') return
    setEditandoLinhaId(linha.id)
    setEndereco(linha.endereco)
    setCodigoBarras(linha.codigoBarras)
    setQuantidade(String(linha.quantidade))
    setUnidade(linha.unidade)
    setUp(linha.up)
    setLote(linha.lote)
    setFabricacao(linha.fabricacao)
    setValidade(linha.validade)
    setProdutoLabel(linha.descricao)
    setCodigoInterno(linha.codigoInterno)
    setErr('')
    setMsg('Editando linha — altere os campos e salve.')
    enderecoRef.current?.focus()
  }

  async function excluirLinha(linha: InventarioLinhaCaptura) {
    if (!sessao || sessao.status !== 'aberto') return
    if (!confirm(`Excluir a linha do endereço ${linha.endereco} (${linha.descricao})?`)) return
    try {
      const ok = await deleteLinhaInventario(sessao.id, linha.id)
      if (!ok) {
        setErr('Não foi possível excluir a linha.')
        return
      }
      if (editandoLinhaId === linha.id) limparFormulario()
      const atualizado = await getInventario(inventarioId)
      setSessao(atualizado)
      setMsg('Linha excluída.')
      setErr('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao excluir linha.')
    }
  }

  async function handleSalvar() {
    if (!sessao) return
    if (sessao.status !== 'aberto') {
      setErr('Inventário fechado — somente leitura.')
      return
    }
    const end = normalizeEnderecoCodigo(endereco.trim())
    const bar = codigoBarras.trim()
    const q = Number(String(quantidade).replace(',', '.'))
    const upStr = up.trim()
    if (!end) {
      setErr('Informe o endereço.')
      return
    }
    if (!enderecoPermitidoNaSessao(sessao, end)) {
      setErr('Endereço fora das posições selecionadas para este inventário.')
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
    if (upStr !== '') {
      const upNum = Number(upStr.replace(',', '.'))
      if (!Number.isFinite(upNum) || upNum < 0) {
        setErr('UP inválido.')
        return
      }
    }
    try {
      const payload = {
        endereco: end,
        codigoBarras: bar,
        codigoInterno,
        descricao: produtoLabel,
        quantidade: q,
        unidade: unidade.trim(),
        up: upStr,
        lote: lote.trim(),
        fabricacao: fabricacao.trim(),
        validade: validade.trim(),
        camara: resolverCamaraEndereco(end),
        conferenteNome: usuarioLogado.trim() || undefined,
      }
      if (editandoLinhaId) {
        await updateLinhaInventario(sessao.id, editandoLinhaId, payload)
      } else {
        await addLinhaInventario(sessao.id, payload)
      }
      const atualizado = await getInventario(inventarioId)
      setSessao(atualizado)
      setMsg(
        editandoLinhaId
          ? 'Linha atualizada.'
          : `Linha salva (${atualizado?.linhas.length ?? 0} no total)`,
      )
      setErr('')
      limparFormulario()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar linha.')
    }
  }

  if (sessaoLoading) {
    return (
      <div className="page-panel">
        <p>Carregando inventário…</p>
      </div>
    )
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

  const posicoesLabel = sessao.posicoesNome?.trim()
    ? sessao.posicoesNome
    : posicoesInventario.length > 0
      ? `${posicoesInventario.length} posição(ões)`
      : 'Qualquer endereço'

  const enderecoLabel = sessao.listaEnderecamentoNome ?? listaEndereco?.nome
  const produtosLabel = produtosCarregando
    ? 'Carregando…'
    : sessao.listaProdutosNome
      ? `${sessao.listaProdutosNome} (${produtos.length})`
      : `${produtos.length} produto(s)`

  return (
    <div className="inventario-captura-wrap">
      <div className="inventario-captura inventario-captura--v2">
        <header className="inv-cap__top">
          <button type="button" className="inv-cap__back" onClick={onVoltar} aria-label="Voltar">
            ←
          </button>
          <div className="inv-cap__top-main">
            <h1 className="inv-cap__title">{sessao.titulo}</h1>
            <div className="inv-cap__badges">
              <span className={`inv-cap__badge ${online ? 'inv-cap__badge--online' : 'inv-cap__badge--offline'}`}>
                {online ? 'Online' : 'Offline'}
              </span>
              {readonly ? <span className="inv-cap__badge inv-cap__badge--readonly">Finalizado</span> : null}
              <span className="inv-cap__badge">{sessao.linhas.length} linha(s)</span>
            </div>
          </div>
        </header>

        <div className="inv-cap__chips" aria-label="Informações do inventário">
          <span className="inv-cap__chip" title="Local">
            <span className="inv-cap__chip-label">Local</span>
            {sessao.local}
          </span>
          <span className="inv-cap__chip" title="Data">
            <span className="inv-cap__chip-label">Data</span>
            {hoje}
          </span>
          <span className="inv-cap__chip inv-cap__chip--wide" title={contadoresOnline}>
            <span className="inv-cap__chip-label">Conferentes</span>
            {contadoresOnline}
          </span>
          <span className="inv-cap__chip" title="Posições">
            <span className="inv-cap__chip-label">Posições</span>
            {posicoesLabel}
          </span>
          {enderecoLabel ? (
            <span className="inv-cap__chip" title="Endereçamento">
              <span className="inv-cap__chip-label">Endereços</span>
              {enderecoLabel}
            </span>
          ) : null}
          <span className="inv-cap__chip" title="Lista de produtos">
            <span className="inv-cap__chip-label">Produtos</span>
            {produtosLabel}
          </span>
        </div>

        {readonly ? (
          <div className="inventario-captura__alert inventario-captura__alert--readonly">
            Inventário finalizado — somente visualização. Reabra na lista para alterar.
          </div>
        ) : null}
        {err ? <div className="inventario-captura__alert inventario-captura__alert--err">{err}</div> : null}
        {msg ? <div className="inventario-captura__alert inventario-captura__alert--ok">{msg}</div> : null}

        <div className="inv-cap__body">
          <div className="inv-cap__form-panel">
            <section className="inv-cap__section">
              <h2 className="inv-cap__section-title">
                <span className="inv-cap__step">1</span> Endereço
              </h2>
              <div className="inventario-captura__field inventario-captura__field--full inv-cap__field">
                <label htmlFor="inv-endereco">Endereço</label>
                <div className="inventario-captura__input-row">
                  <input
                    id="inv-endereco"
                    ref={enderecoRef}
                    list={posicoesInventario.length > 0 ? 'inv-posicoes-list' : undefined}
                    value={endereco}
                    onChange={(e) => setEndereco(formatEnderecoCodigoInput(e.target.value))}
                    onBlur={handleEnderecoBlur}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        barcodeRef.current?.focus()
                      }
                    }}
                    disabled={readonly}
                    autoComplete="off"
                    placeholder="Bipe ou digite o endereço"
                  />
                  <button
                    type="button"
                    className="inventario-captura__action-btn inventario-captura__action-btn--icon-only"
                    disabled={readonly}
                    aria-label="Focar endereço"
                    onClick={() => enderecoRef.current?.focus()}
                  >
                    <IconFlash />
                    <span className="inventario-captura__btn-text">Focar</span>
                  </button>
                  <button
                    type="button"
                    className="inventario-captura__action-btn inventario-captura__action-btn--icon-only"
                    disabled={readonly}
                    aria-label="Bipar endereço"
                    onClick={() => enderecoRef.current?.focus()}
                  >
                    <IconBarcode />
                  </button>
                </div>
                {posicoesInventario.length > 0 ? (
                  <datalist id="inv-posicoes-list">
                    {posicoesInventario.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                ) : null}
              </div>
            </section>

            <section className="inv-cap__section">
              <h2 className="inv-cap__section-title">
                <span className="inv-cap__step">2</span> Produto
              </h2>
              <div className="inventario-captura__field inventario-captura__field--full inv-cap__field" ref={comboRef}>
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
                    placeholder="Código de barras, EAN ou descrição"
                    aria-autocomplete="list"
                    aria-expanded={sugestoesOpen}
                    aria-controls="inv-produto-sugestoes"
                  />
                  <button
                    type="button"
                    className="inventario-captura__action-btn inventario-captura__action-btn--icon-only"
                    disabled={readonly}
                    aria-label="Focar código"
                    onClick={() => barcodeRef.current?.focus()}
                  >
                    <IconFlash />
                  </button>
                  <button
                    type="button"
                    className="inventario-captura__action-btn inventario-captura__action-btn--icon-only"
                    disabled={readonly}
                    title="Ver lista de produtos"
                    aria-label="Lista de produtos"
                    onClick={() => {
                      setSugestoesOpen((v) => !v)
                      barcodeRef.current?.focus()
                    }}
                  >
                    <IconBarcode />
                    <span className="inventario-captura__btn-text">Lista</span>
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
              <div className="inventario-captura__field inventario-captura__field--full inv-cap__field inv-cap__produto-box">
                <label htmlFor="inv-produto">Produto identificado</label>
                <textarea
                  id="inv-produto"
                  value={produtoLabel}
                  readOnly
                  rows={2}
                  className="inventario-captura__readonly inventario-captura__produto"
                  placeholder="Aguardando leitura do produto…"
                />
                {codigoInterno ? (
                  <p className="inv-cap__codigo-interno">
                    Código interno: <strong>{codigoInterno}</strong>
                  </p>
                ) : null}
              </div>
            </section>

            <section className="inv-cap__section">
              <h2 className="inv-cap__section-title">
                <span className="inv-cap__step">3</span> Quantidade e validade
              </h2>
              <div className="inv-cap__grid">
                <div className="inventario-captura__field inv-cap__field">
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
                    placeholder="0"
                  />
                </div>
                <div className="inventario-captura__field inv-cap__field">
                  <label htmlFor="inv-unidade">Unidade</label>
                  <input
                    id="inv-unidade"
                    value={unidade}
                    readOnly
                    className="inventario-captura__readonly"
                    placeholder="—"
                  />
                </div>
                <div className="inventario-captura__field inv-cap__field">
                  <label htmlFor="inv-up">UP</label>
                  <input
                    id="inv-up"
                    value={up}
                    onChange={(e) => setUp(e.target.value)}
                    disabled={readonly}
                    inputMode="decimal"
                    placeholder="UP"
                    autoComplete="off"
                  />
                </div>
                <div className="inventario-captura__field inv-cap__field">
                  <label htmlFor="inv-lote">Lote</label>
                  <input
                    id="inv-lote"
                    value={lote}
                    onChange={(e) => setLote(e.target.value)}
                    disabled={readonly}
                    placeholder="Lote"
                    autoComplete="off"
                  />
                </div>
                <div className="inventario-captura__field inv-cap__field">
                  <label htmlFor="inv-validade">Validade</label>
                  <div className="inventario-captura__input-row">
                    <input
                      id="inv-validade"
                      type="date"
                      value={validade}
                      onChange={(e) => setValidade(e.target.value)}
                      disabled={readonly}
                      title="Validade"
                    />
                    <button
                      type="button"
                      className="inventario-captura__action-btn inventario-captura__action-btn--icon inventario-captura__action-btn--icon-only"
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
                <div className="inventario-captura__field inv-cap__field">
                  <label htmlFor="inv-fabricacao">Fabricação</label>
                  <div className="inventario-captura__input-row">
                    <input
                      id="inv-fabricacao"
                      type="date"
                      value={fabricacao}
                      onChange={(e) => setFabricacao(e.target.value)}
                      disabled={readonly}
                      title="Fabricação"
                    />
                    <button
                      type="button"
                      className="inventario-captura__action-btn inventario-captura__action-btn--icon inventario-captura__action-btn--icon-only"
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
              </div>
            </section>

            <div className="inv-cap__save-bar">
              {editandoLinhaId ? (
                <button type="button" className="inv-cap__cancel-edit page-btn-ghost" onClick={limparFormulario}>
                  Cancelar edição
                </button>
              ) : null}
              <div className="inventario-captura__footer-mobile">
                <input
                  readOnly
                  value={codigoInterno || produtoLabel ? codigoInterno || '—' : '—'}
                  className="inventario-captura__readonly inventario-captura__footer-status"
                  aria-label="Código do produto"
                />
                <button
                  type="button"
                  className="inventario-captura__save-icon"
                  onClick={handleSalvar}
                  disabled={readonly}
                  aria-label="Salvar linha"
                >
                  <IconSave />
                </button>
              </div>
              <button
                type="button"
                className="inventario-captura__save inventario-captura__save--desktop"
                onClick={handleSalvar}
                disabled={readonly}
              >
                {editandoLinhaId ? 'Atualizar linha' : 'Salvar linha'}
              </button>
            </div>
          </div>

          <aside className="inv-cap__linhas-panel" aria-label="Linhas salvas">
            <div className="inv-cap__linhas-head">
              <h2>Linhas salvas</h2>
              <span className="inv-cap__linhas-count">{linhasSalvas.length}</span>
            </div>
            {linhasSalvas.length === 0 ? (
              <p className="inv-cap__linhas-empty">Nenhuma linha registrada ainda.</p>
            ) : (
              <div className="inventario-captura__linhas-wrap">
                <table className="inventario-captura__linhas-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Data</th>
                      <th>Hora</th>
                      <th>Câm.</th>
                      <th>Conferente</th>
                      <th>Endereço</th>
                      <th>Código</th>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>UP</th>
                      <th>Lote</th>
                      <th>Fab.</th>
                      <th>Val.</th>
                      {!readonly ? <th>Ações</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {linhasSalvas.map((linha, idx) => (
                      <tr
                        key={linha.id}
                        className={editandoLinhaId === linha.id ? 'inv-cap__linha--editando' : undefined}
                      >
                        <td>{linhasSalvas.length - idx}</td>
                        <td>{formatDataLinha(linha.createdAt)}</td>
                        <td>{formatHora(linha.createdAt)}</td>
                        <td>{linhaCamaraLabel(linha)}</td>
                        <td className="inventario-captura__linhas-conf">{linha.conferenteNome?.trim() || '—'}</td>
                        <td>{linha.endereco}</td>
                        <td className="inventario-captura__linhas-cod">{linha.codigoInterno}</td>
                        <td className="inventario-captura__linhas-desc">{linha.descricao}</td>
                        <td>
                          {linha.quantidade}
                          {linha.unidade ? ` ${linha.unidade}` : ''}
                        </td>
                        <td>{linha.up?.trim() ? linha.up : '—'}</td>
                        <td>{linha.lote?.trim() ? linha.lote : '—'}</td>
                        <td>{formatYmdBR(linha.fabricacao ?? '')}</td>
                        <td>{formatYmdBR(linha.validade ?? '')}</td>
                        {!readonly ? (
                          <td className="inv-cap__linhas-acoes">
                            <button
                              type="button"
                              className="inv-cap__linha-btn"
                              onClick={() => iniciarEdicaoLinha(linha)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="inv-cap__linha-btn inv-cap__linha-btn--danger"
                              onClick={() => void excluirLinha(linha)}
                            >
                              Excluir
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
