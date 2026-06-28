import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isAppOnline } from '../lib/appConnectivity'
import { findEnderecoByCodigo } from '../lib/enderecamentoStore'
import { fetchProductOptionByCodigoFromDb } from '../lib/fetchProductOptionByCodigo'
import {
  addLinhaInventario,
  getInventario,
  type InventarioSessao,
} from '../lib/inventarioSessaoStore'
import { buildProductByBarcodeMap, lookupProductByBarcode } from '../lib/barcodeProductLookup'
import { mapRowToProductOption, TABELA_PRODUTOS, type ProductOption } from '../lib/productOptionMapper'
import { supabase } from '../lib/supabaseClient'

type Props = {
  inventarioId: string
  onVoltar: () => void
}

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
  const [endereco, setEndereco] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [quantidade, setQuantidade] = useState('')
  const [unidade, setUnidade] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [produtoLabel, setProdutoLabel] = useState('')
  const [codigoInterno, setCodigoInterno] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const enderecoRef = useRef<HTMLInputElement>(null)
  const barcodeRef = useRef<HTMLInputElement>(null)

  const online = isAppOnline()

  const productMaps = useMemo(() => {
    const byCode = new Map<string, ProductOption>()
    const byCodeNoDots = new Map<string, ProductOption>()
    for (const p of produtos) {
      byCode.set(p.codigo, p)
      byCode.set(p.codigo.replace(/\./g, ''), p)
      byCodeNoDots.set(p.codigo.replace(/\./g, ''), p)
    }
    return {
      byEan: buildProductByBarcodeMap(produtos, 'ean'),
      byDun: buildProductByBarcodeMap(produtos, 'dun'),
      byCode,
      byCodeNoDots,
    }
  }, [produtos])

  const loadProdutos = useCallback(async () => {
    const { data } = await supabase
      .from(TABELA_PRODUTOS)
      .select('*')
      .limit(3000)
    const list = (data ?? [])
      .map((r) => mapRowToProductOption(r as Record<string, unknown>))
      .filter(Boolean) as ProductOption[]
    setProdutos(list)
  }, [])

  useEffect(() => {
    void loadProdutos()
  }, [loadProdutos])

  useEffect(() => {
    setSessao(getInventario(inventarioId) ?? null)
  }, [inventarioId])

  async function resolverProduto(scanned: string) {
    const q = scanned.trim()
    if (!q) {
      setProdutoLabel('')
      setCodigoInterno('')
      setUnidade('')
      return
    }
    let hit =
      lookupProductByBarcode(q, produtos, productMaps.byDun, productMaps.byEan, productMaps.byCode, productMaps.byCodeNoDots)
        ?.product ?? null
    if (!hit) {
      hit = await fetchProductOptionByCodigoFromDb(q)
    }
    if (hit) {
      setCodigoInterno(hit.codigo)
      setProdutoLabel(hit.descricao)
      setUnidade(hit.unidade ?? '')
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

  async function handleBarcodeChange(v: string) {
    setCodigoBarras(v)
    await resolverProduto(v)
  }

  function limparFormulario() {
    setEndereco('')
    setCodigoBarras('')
    setQuantidade('')
    setUnidade('')
    setLote('')
    setValidade('')
    setProdutoLabel('')
    setCodigoInterno('')
    setErr('')
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
      setErr('Bipe ou digite um código de barras válido.')
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
        </div>

        {err ? <div className="inventario-captura__alert inventario-captura__alert--err">{err}</div> : null}
        {msg ? <div className="inventario-captura__alert inventario-captura__alert--ok">{msg}</div> : null}

        <div className="inventario-captura__field">
          <label>Endereço</label>
          <div className="inventario-captura__input-row">
            <input
              ref={enderecoRef}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              onBlur={handleEnderecoBlur}
              disabled={readonly}
              autoComplete="off"
            />
            <button type="button" className="inventario-captura__icon-btn" title="Foco leitura" disabled={readonly}>
              🔦
            </button>
            <button
              type="button"
              className="inventario-captura__icon-btn"
              title="Leitor código"
              disabled={readonly}
              onClick={() => enderecoRef.current?.focus()}
            >
              ▤
            </button>
          </div>
        </div>

        <div className="inventario-captura__field">
          <label>Código de barras</label>
          <div className="inventario-captura__input-row">
            <input
              ref={barcodeRef}
              value={codigoBarras}
              onChange={(e) => void handleBarcodeChange(e.target.value)}
              disabled={readonly}
              autoComplete="off"
            />
            <button type="button" className="inventario-captura__icon-btn" disabled={readonly}>
              🔦
            </button>
            <button type="button" className="inventario-captura__icon-btn" disabled={readonly} onClick={() => barcodeRef.current?.focus()}>
              ▤
            </button>
          </div>
        </div>

        <div className="inventario-captura__row-2">
          <div className="inventario-captura__field">
            <label>Quantidade</label>
            <input
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={readonly}
              inputMode="decimal"
            />
          </div>
          <div className="inventario-captura__field">
            <label>Unidade</label>
            <input value={unidade} readOnly className="inventario-captura__readonly" />
          </div>
        </div>

        <div className="inventario-captura__row-2">
          <div className="inventario-captura__field inventario-captura__field--short">
            <label>Lote</label>
            <input value={lote} onChange={(e) => setLote(e.target.value)} disabled={readonly} />
          </div>
          <div className="inventario-captura__field inventario-captura__field--long">
            <label>Validade</label>
            <div className="inventario-captura__input-row">
              <input
                type="date"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
                disabled={readonly}
              />
              <span className="inventario-captura__cal-icon" aria-hidden>
                📅
              </span>
            </div>
          </div>
        </div>

        <div className="inventario-captura__field">
          <label>Produto</label>
          <input value={produtoLabel} readOnly className="inventario-captura__readonly" />
        </div>

        <div className="inventario-captura__footer">
          <input readOnly value={codigoInterno ? `SKU ${codigoInterno}` : '—'} className="inventario-captura__readonly" />
          <button
            type="button"
            className="inventario-captura__save"
            onClick={handleSalvar}
            disabled={readonly}
            title="Salvar linha"
          >
            💾
          </button>
        </div>
      </div>
    </div>
  )
}
