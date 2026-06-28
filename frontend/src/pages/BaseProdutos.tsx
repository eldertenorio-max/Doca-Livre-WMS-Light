import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { normalizeCodigoInternoCompareKey } from '../lib/codigoInternoCompare'
import { formatUnknownError, isColumnMissingError } from '../lib/supabaseError'
import { supabase } from '../lib/supabaseClient'
import './BaseProdutos.css'

const TABELA_PRODUTOS = 'Todos os Produtos'

type ProdutoDbRow = {
  id: string
  codigo_interno: string
  descricao: string
  /** Coluna `unidade` em "Todos os Produtos" (fallback: `unidade_medida` legado). */
  unidade: string | null
  ean: string | null
  dun: string | null
  /** Data (YYYY-MM-DD) da última alteração do EAN no cadastro. */
  ean_alterado_em: string | null
  /** Horário ISO da última alteração do EAN (quando a coluna existir no banco). */
  ean_alterado_em_hora: string | null
  /** Conferente da última alteração do EAN. */
  ean_alterado_conferente: string | null
  /** Data (YYYY-MM-DD) da última alteração do DUN no cadastro. */
  dun_alterado_em: string | null
  dun_alterado_em_hora: string | null
  dun_alterado_conferente: string | null
  /** Só preenchido se o banco ainda expuser a coluna legada `ean_dun_alterado_em`. */
  ean_dun_alterado_em?: string | null
}

function rowKey(r: ProdutoDbRow) {
  if (r.id && String(r.id).trim() !== '') return String(r.id)
  return `cod:${normalizeCodigoInternoCompareKey(r.codigo_interno)}`
}

function normEanDun(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t === '' ? null : t
}

function todayYmdLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

function formatDateBRFromYmd(ymd: string | null | undefined): string {
  if (!ymd || String(ymd).trim() === '') return '—'
  const s = String(ymd).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(s)
  if (!m) return s
  return `${m[3]}/${m[2]}/${m[1]}`
}

function formatHoraRegistroAlteracao(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDataAlteracaoFromIso(iso: string | null | undefined): string {
  if (!iso?.trim()) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function CelulaAlteracaoCodigo(props: {
  dataYmd: string | null | undefined
  emHora: string | null | undefined
  conferente: string | null | undefined
}) {
  const data =
    props.emHora && formatDataAlteracaoFromIso(props.emHora)
      ? formatDataAlteracaoFromIso(props.emHora)
      : formatDateBRFromYmd(props.dataYmd)
  const hora = formatHoraRegistroAlteracao(props.emHora)
  const conf = String(props.conferente ?? '').trim()
  if (data === '—' && !hora && !conf) return <>—</>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.35 }}>
      <span>{data}</span>
      {hora ? (
        <span style={{ fontSize: 11, color: 'var(--chart-caption, #94a3b8)', fontVariantNumeric: 'tabular-nums' }}>
          {hora}
        </span>
      ) : null}
      {conf ? (
        <span
          style={{
            fontSize: 11,
            color: conf.startsWith('Selecione o conferente') ? '#fca5a5' : 'var(--text, #cbd5e1)',
            fontStyle: conf.startsWith('Selecione o conferente') ? 'italic' : 'normal',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 160,
          }}
          title={conf}
        >
          {conf}
        </span>
      ) : null}
    </div>
  )
}

function nowIsoLocal(): string {
  return new Date().toISOString()
}

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Compara valor cadastrado com o lido no bipador (com ou sem dígitos só). */
function matchesBarcode(stored: string | null | undefined, scanned: string): boolean {
  const q = scanned.trim()
  if (!q) return false
  const a = normEanDun(stored)
  if (a != null && a === q) return true
  if (a != null && onlyDigits(a) !== '' && onlyDigits(a) === onlyDigits(q)) return true
  return false
}

const MSG_CONFERENTE_OBRIGATORIO =
  'Selecione o conferente no campo «Conferente (ao alterar EAN/DUN)» antes de salvar alteração de EAN ou DUN.'

type UnidadeDbField = 'unidade' | 'unidade_medida'

/** O que o banco expõe para metadados de alteração EAN/DUN. */
type DbMetaCap = 'full' | 'dates' | 'legacy' | 'none'

function unidadeColFromSelect(cols: string): UnidadeDbField {
  return cols.includes('unidade_medida') && !cols.includes('descricao,unidade,') ? 'unidade_medida' : 'unidade'
}

function metaCapFromSelect(cols: string): DbMetaCap {
  if (cols.includes('ean_alterado_em_hora') && cols.includes('ean_alterado_conferente')) return 'full'
  if (cols.includes('ean_alterado_em')) return 'dates'
  if (cols.includes('ean_dun_alterado_em')) return 'legacy'
  return 'none'
}

function pickIsoHoraFromDb(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/T\d{2}:\d{2}/.test(s) || (s.includes('T') && s.length > 11)) return s
  return null
}

function payloadTemMetaHoraConferente(p: Record<string, unknown>): boolean {
  return 'ean_alterado_em_hora' in p || 'ean_alterado_conferente' in p
}

function patchUnidadeField(field: UnidadeDbField, unidade: string | null): Record<string, string | null> {
  return field === 'unidade_medida' ? { unidade_medida: unidade } : { unidade }
}

function propsAlteracaoCodigo(
  r: ProdutoDbRow,
  edit: boolean,
  snap: ProdutoDbRow | null,
  tipo: 'ean' | 'dun',
  conferenteNome: string,
): {
  dataYmd: string | null | undefined
  emHora: string | null | undefined
  conferente: string | null | undefined
} {
  const changed =
    edit &&
    snap != null &&
    (tipo === 'ean' ? normEanDun(r.ean) !== normEanDun(snap.ean) : normEanDun(r.dun) !== normEanDun(snap.dun))
  if (changed) {
    const conf = conferenteNome.trim()
    return {
      dataYmd: todayYmdLocal(),
      emHora: nowIsoLocal(),
      conferente: conf || 'Selecione o conferente acima',
    }
  }
  if (tipo === 'ean') {
    return {
      dataYmd: r.ean_alterado_em,
      emHora: r.ean_alterado_em_hora,
      conferente: r.ean_alterado_conferente,
    }
  }
  return {
    dataYmd: r.dun_alterado_em,
    emHora: r.dun_alterado_em_hora,
    conferente: r.dun_alterado_conferente,
  }
}

export default function BaseProdutos() {
  const [rows, setRows] = useState<ProdutoDbRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [matchKeys, setMatchKeys] = useState<string[]>([])
  const [matchIndex, setMatchIndex] = useState(0)
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editSnapshot, setEditSnapshot] = useState<ProdutoDbRow | null>(null)
  /** Coluna de unidade que funcionou no último SELECT (evita UPDATE em coluna inexistente). */
  const [dbUnidadeField, setDbUnidadeField] = useState<UnidadeDbField>('unidade')
  const [dbMetaCap, setDbMetaCap] = useState<DbMetaCap>('none')

  const [cadastroOpen, setCadastroOpen] = useState(false)
  const [cadastroCodigo, setCadastroCodigo] = useState('')
  const [cadastroDescricao, setCadastroDescricao] = useState('')
  const [cadastroUnidade, setCadastroUnidade] = useState('')
  const [cadastroEan, setCadastroEan] = useState('')
  const [cadastroDun, setCadastroDun] = useState('')
  const [cadastroSaving, setCadastroSaving] = useState(false)

  const [bipCodigoBarras, setBipCodigoBarras] = useState('')
  /** Quando definido, a tabela mostra só esta linha (produto encontrado pelo bip). */
  const [bipSoloKey, setBipSoloKey] = useState<string | null>(null)

  const [conferentes, setConferentes] = useState<Array<{ id: string; nome: string }>>([])
  const [conferentesLoading, setConferentesLoading] = useState(false)
  const [alteracaoConferenteId, setAlteracaoConferenteId] = useState('')
  const bipInputRef = useRef<HTMLInputElement | null>(null)
  const rowRefs = useRef<Map<string, HTMLElement | null>>(new Map())

  const conferenteSelectRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    void (async () => {
      setConferentesLoading(true)
      try {
        const { data, error: qErr } = await supabase.from('conferentes').select('id,nome').order('nome')
        if (qErr) throw qErr
        setConferentes(data ?? [])
      } catch {
        setConferentes([])
      } finally {
        setConferentesLoading(false)
      }
    })()
  }, [])

  const alteracaoConferenteNome = useMemo(() => {
    const n = conferentes.find((c) => c.id === alteracaoConferenteId)?.nome?.trim()
    return n || ''
  }, [conferentes, alteracaoConferenteId])

  const precisaConferenteNaEdicao = useMemo(() => {
    if (!editingKey || !editSnapshot) return false
    const r = rows.find((x) => rowKey(x) === editingKey)
    if (!r) return false
    return (
      normEanDun(r.ean) !== normEanDun(editSnapshot.ean) || normEanDun(r.dun) !== normEanDun(editSnapshot.dun)
    )
  }, [editingKey, editSnapshot, rows])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      let data: Record<string, unknown>[] | null = null
      let qErr: { message?: string; code?: string } | null = null
      const selFull = 'id,codigo_interno,descricao,unidade,ean,dun'
      const selLegado = 'id,codigo_interno,descricao,unidade_medida,ean,dun'
      const selBasico = 'id,codigo_interno,descricao,ean,dun'

      const trySelect = async (cols: string) =>
        supabase.from(TABELA_PRODUTOS).select(cols).order('codigo_interno', { ascending: true }).limit(20000)

      const selMeta =
        'ean_alterado_em,ean_alterado_em_hora,ean_alterado_conferente,dun_alterado_em,dun_alterado_em_hora,dun_alterado_conferente'
      /** Meta + legado/básico antes de selects só com datas, para não perder hora/conferente quando `unidade` falha. */
      const candidates = [
        `${selFull},${selMeta}`,
        `${selLegado},${selMeta}`,
        `${selBasico},${selMeta}`,
        `${selFull},ean_alterado_em,dun_alterado_em`,
        `${selLegado},ean_alterado_em,dun_alterado_em`,
        `${selBasico},ean_alterado_em,dun_alterado_em`,
        `${selFull},ean_dun_alterado_em`,
        `${selLegado},ean_dun_alterado_em`,
        `${selBasico},ean_dun_alterado_em`,
        selFull,
        selLegado,
        selBasico,
      ]

      let usedSelect = candidates[0]
      let res = await trySelect(usedSelect)
      data = res.data as Record<string, unknown>[] | null
      qErr = res.error
      for (let i = 1; i < candidates.length && qErr && isColumnMissingError(qErr); i++) {
        usedSelect = candidates[i]
        res = await trySelect(usedSelect)
        data = res.data as Record<string, unknown>[] | null
        qErr = res.error
      }
      if (qErr) throw new Error(formatUnknownError(qErr))
      setDbUnidadeField(unidadeColFromSelect(usedSelect))
      setDbMetaCap(metaCapFromSelect(usedSelect))
      const mapped: ProdutoDbRow[] = (data ?? []).map((r: Record<string, unknown>) => {
        const um = r.unidade ?? r.unidade_medida ?? r.UNIDADE
        const leg = r.ean_dun_alterado_em
        const legStr = leg != null && String(leg).trim() !== '' ? String(leg).slice(0, 10) : null
        const eanA = r.ean_alterado_em
        const dunA = r.dun_alterado_em
        const eanStr =
          eanA != null && String(eanA).trim() !== '' ? String(eanA).slice(0, 10) : legStr
        const dunStr =
          dunA != null && String(dunA).trim() !== '' ? String(dunA).slice(0, 10) : legStr
        return {
          id: String(r.id ?? ''),
          codigo_interno: String(r.codigo_interno ?? r.codigo ?? ''),
          descricao: String(r.descricao ?? ''),
          unidade:
            um != null && String(um).trim() !== '' ? String(um).trim() : null,
          ean: r.ean != null && String(r.ean).trim() !== '' ? String(r.ean) : null,
          dun: r.dun != null && String(r.dun).trim() !== '' ? String(r.dun) : null,
          ean_alterado_em: eanStr,
          ean_alterado_em_hora:
            pickIsoHoraFromDb(r.ean_alterado_em_hora) ??
            pickIsoHoraFromDb(r.ean_alterado_em) ??
            null,
          ean_alterado_conferente:
            r.ean_alterado_conferente != null && String(r.ean_alterado_conferente).trim() !== ''
              ? String(r.ean_alterado_conferente).trim()
              : null,
          dun_alterado_em: dunStr,
          dun_alterado_em_hora:
            pickIsoHoraFromDb(r.dun_alterado_em_hora) ??
            pickIsoHoraFromDb(r.dun_alterado_em) ??
            null,
          dun_alterado_conferente:
            r.dun_alterado_conferente != null && String(r.dun_alterado_conferente).trim() !== ''
              ? String(r.dun_alterado_conferente).trim()
              : null,
          ean_dun_alterado_em: legStr,
        }
      })
      const list = mapped.filter((r) => r.codigo_interno.trim() !== '')
      setRows(list)
      setEditingKey(null)
      setEditSnapshot(null)
      setBipSoloKey((prev) => (prev && list.some((r) => rowKey(r) === prev) ? prev : null))
      setBipCodigoBarras('')
      setSuccess(`${list.length} produto(s) na base.`)
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao carregar a base.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function patchRow(key: string, patch: Partial<ProdutoDbRow>) {
    setRows((prev) => prev.map((r) => (rowKey(r) === key ? { ...r, ...patch } : r)))
  }

  function startEdit(r: ProdutoDbRow) {
    const k = rowKey(r)
    if (editingKey && editingKey !== k) {
      if (!confirm('Há outra linha em edição. Descartar alterações nela e editar esta?')) return
      cancelEditInternal()
    }
    setEditSnapshot({ ...r })
    setEditingKey(k)
    setError('')
    setSuccess('')
  }

  function limparBipEFiltroSolo() {
    setBipSoloKey(null)
    setMatchKeys([])
    setMatchIndex(0)
    setBipCodigoBarras('')
    setEditingKey(null)
    setEditSnapshot(null)
    setError('')
  }

  function selecionarProduto(found: ProdutoDbRow, matches: ProdutoDbRow[]) {
    const keys = matches.map((r) => rowKey(r))
    const soloK = rowKey(found)
    setMatchKeys(keys)
    setMatchIndex(keys.indexOf(soloK))
    setBipSoloKey(soloK)
    setError('')
    startEdit(found)
    setSuccess(
      keys.length > 1
        ? `Produto ${found.codigo_interno} — ${keys.length} encontrado(s). Use ◀ ▶ para navegar.`
        : `Produto ${found.codigo_interno} aberto.`,
    )
    setBipCodigoBarras('')
    window.setTimeout(() => bipInputRef.current?.focus(), 0)
  }

  function buscarPorBipEanDun() {
    const q = bipCodigoBarras.trim()
    if (!q) {
      setError('Informe código, EAN, DUN ou parte da descrição.')
      setSuccess('')
      return
    }
    if (rows.length === 0) {
      setError('Aguarde o carregamento da base ou clique em recarregar.')
      setSuccess('')
      return
    }
    const ql = q.toLowerCase()
    const matches = rows.filter(
      (r) =>
        matchesBarcode(r.ean, q) ||
        matchesBarcode(r.dun, q) ||
        r.codigo_interno.toLowerCase().includes(ql) ||
        r.descricao.toLowerCase().includes(ql),
    )
    if (!matches.length) {
      setError(`Nenhum produto encontrado para: ${q}`)
      setSuccess('')
      return
    }
    selecionarProduto(matches[0], matches)
  }

  function navegarMatch(delta: number) {
    if (matchKeys.length <= 1) return
    const next = (matchIndex + delta + matchKeys.length) % matchKeys.length
    const key = matchKeys[next]
    const found = rows.find((r) => rowKey(r) === key)
    if (!found) return
    setMatchIndex(next)
    setBipSoloKey(key)
    startEdit(found)
  }

  const produtoVisivel = useMemo(() => {
    if (!bipSoloKey) return null
    return rows.find((r) => rowKey(r) === bipSoloKey) ?? null
  }, [rows, bipSoloKey])

  useEffect(() => {
    if (!editingKey) return
    const t = window.setTimeout(() => {
      const el = rowRefs.current.get(editingKey)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [editingKey, bipSoloKey])

  function cancelEditInternal() {
    if (editingKey && editSnapshot) {
      setRows((prev) => prev.map((x) => (rowKey(x) === editingKey ? { ...editSnapshot } : x)))
    }
    setEditingKey(null)
    setEditSnapshot(null)
  }

  function cancelEdit() {
    cancelEditInternal()
  }

  function buildFilterForRow(r: ProdutoDbRow) {
    if (r.id && r.id.trim() !== '') {
      return (q: ReturnType<typeof supabase.from>) => q.eq('id', r.id)
    }
    if (r.codigo_interno.trim()) {
      return (q: ReturnType<typeof supabase.from>) => q.eq('codigo_interno', r.codigo_interno.trim())
    }
    throw new Error('Sem id nem código para identificar a linha.')
  }

  async function saveRow(r: ProdutoDbRow) {
    const k = rowKey(r)
    setSavingKey(k)
    setError('')
    setSuccess('')
    try {
      const descricao = String(r.descricao ?? '').trim()
      if (!descricao) throw new Error('Descrição é obrigatória.')

      const ean = normEanDun(r.ean)
      const dun = normEanDun(r.dun)
      const unidadeRaw = String(r.unidade ?? '').trim()
      const unidade = unidadeRaw === '' ? null : unidadeRaw

      const snap = editSnapshot
      const eanChanged = normEanDun(r.ean) !== normEanDun(snap?.ean)
      const dunChanged = normEanDun(r.dun) !== normEanDun(snap?.dun)
      if ((eanChanged || dunChanged) && !alteracaoConferenteId.trim()) {
        setError(MSG_CONFERENTE_OBRIGATORIO)
        setSavingKey(null)
        window.setTimeout(() => conferenteSelectRef.current?.focus(), 0)
        return
      }
      const agoraIso = nowIsoLocal()
      const nomeAlt = alteracaoConferenteNome
      const ean_alterado_em = eanChanged ? todayYmdLocal() : (r.ean_alterado_em ?? null)
      const ean_alterado_em_hora = eanChanged ? agoraIso : (r.ean_alterado_em_hora ?? null)
      const ean_alterado_conferente = eanChanged ? nomeAlt : (r.ean_alterado_conferente ?? null)
      const dun_alterado_em = dunChanged ? todayYmdLocal() : (r.dun_alterado_em ?? null)
      const dun_alterado_em_hora = dunChanged ? agoraIso : (r.dun_alterado_em_hora ?? null)
      const dun_alterado_conferente = dunChanged ? nomeAlt : (r.dun_alterado_conferente ?? null)
      const legacy_combo =
        eanChanged || dunChanged
          ? todayYmdLocal()
          : (r.ean_dun_alterado_em ?? snap?.ean_dun_alterado_em ?? null)

      const selectRetorno =
        dbMetaCap === 'full'
          ? 'id,codigo_interno,ean_alterado_em,ean_alterado_em_hora,ean_alterado_conferente,dun_alterado_em,dun_alterado_em_hora,dun_alterado_conferente'
          : dbMetaCap === 'dates'
            ? 'id,codigo_interno,ean_alterado_em,dun_alterado_em'
            : 'id,codigo_interno'

      const runUpdate = (
        payload: Record<string, unknown>,
        filter: (q: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>,
      ) => {
        let q = supabase.from(TABELA_PRODUTOS).update(payload)
        q = filter(q) as typeof q
        return q.select(selectRetorno).limit(1)
      }

      const tryUpdate = async (payload: Record<string, unknown>) => {
        let res = await runUpdate(payload, buildFilterForRow(r))
        if ((!res.data || res.data.length === 0) && !res.error && r.id && r.id.trim() !== '' && r.codigo_interno.trim()) {
          res = await runUpdate(payload, (q) => q.eq('codigo_interno', r.codigo_interno.trim()))
        }
        return res
      }

      const ufs: UnidadeDbField[] =
        dbUnidadeField === 'unidade_medida' ? ['unidade_medida', 'unidade'] : ['unidade', 'unidade_medida']
      const updateTries: Record<string, unknown>[] = []
      for (const uf of ufs) {
        const u = patchUnidadeField(uf, unidade)
        updateTries.push(
          {
            descricao,
            ean,
            dun,
            ...u,
            ean_alterado_em,
            ean_alterado_em_hora,
            ean_alterado_conferente,
            dun_alterado_em,
            dun_alterado_em_hora,
            dun_alterado_conferente,
          },
          { descricao, ean, dun, ...u, ean_alterado_em, dun_alterado_em },
          { descricao, ean, dun, ean_alterado_em, dun_alterado_em },
          { descricao, ean, dun, ...u, ean_dun_alterado_em: legacy_combo },
          { descricao, ean, dun, ean_dun_alterado_em: legacy_combo },
          { descricao, ean, dun, ...u },
        )
      }
      updateTries.push({ descricao, ean, dun })

      type IdCodRow = Record<string, unknown>
      let data: IdCodRow[] | null = null
      let uErr: { message?: string; code?: string } | null = null
      const precisaMetaNoBanco = (eanChanged || dunChanged) && dbMetaCap === 'full'
      for (const payload of updateTries) {
        const res = await tryUpdate(payload)
        data = res.data as IdCodRow[] | null
        uErr = res.error
        if (uErr) {
          if (!isColumnMissingError(uErr)) break
          continue
        }
        if (!precisaMetaNoBanco || payloadTemMetaHoraConferente(payload)) break
      }

      if (uErr) throw new Error(formatUnknownError(uErr))
      if (!data || data.length === 0) {
        throw new Error(
          'Nenhuma linha foi atualizada no banco (0 linhas). No Supabase, execute o script ' +
            'supabase/sql/rls_todos_os_produtos_crud.sql (RLS + GRANT). Se já executou, confira se o id/código da linha bate com o banco.',
        )
      }

      const rowSalva: ProdutoDbRow = {
        ...r,
        descricao,
        ean,
        dun,
        unidade,
        ean_alterado_em,
        ean_alterado_em_hora,
        ean_alterado_conferente,
        dun_alterado_em,
        dun_alterado_em_hora,
        dun_alterado_conferente,
        ean_dun_alterado_em: legacy_combo ?? r.ean_dun_alterado_em ?? null,
      }
      const ret = data[0]
      if (ret.ean_alterado_em_hora != null) {
        rowSalva.ean_alterado_em_hora = pickIsoHoraFromDb(ret.ean_alterado_em_hora) ?? rowSalva.ean_alterado_em_hora
      }
      if (ret.ean_alterado_conferente != null) {
        rowSalva.ean_alterado_conferente = String(ret.ean_alterado_conferente).trim() || rowSalva.ean_alterado_conferente
      }
      if (ret.dun_alterado_em_hora != null) {
        rowSalva.dun_alterado_em_hora = pickIsoHoraFromDb(ret.dun_alterado_em_hora) ?? rowSalva.dun_alterado_em_hora
      }
      if (ret.dun_alterado_conferente != null) {
        rowSalva.dun_alterado_conferente = String(ret.dun_alterado_conferente).trim() || rowSalva.dun_alterado_conferente
      }
      if (ret.ean_alterado_em != null) {
        const d = String(ret.ean_alterado_em).slice(0, 10)
        if (d) rowSalva.ean_alterado_em = d
      }
      if (ret.dun_alterado_em != null) {
        const d = String(ret.dun_alterado_em).slice(0, 10)
        if (d) rowSalva.dun_alterado_em = d
      }

      setRows((prev) => prev.map((x) => (rowKey(x) === k ? rowSalva : x)))

      let msgOk = `Produto ${r.codigo_interno} atualizado no banco.`
      if ((eanChanged || dunChanged) && dbMetaCap !== 'full') {
        msgOk +=
          ' A data foi gravada; hora e conferente exigem as colunas no Supabase (rode supabase/sql/alter_todos_os_produtos_ean_dun_alterado_meta.sql).'
      }
      setSuccess(msgOk)
      setEditingKey(null)
      setEditSnapshot(null)
      await load()
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao salvar.')
    } finally {
      setSavingKey(null)
    }
  }

  async function deleteRow(r: ProdutoDbRow) {
    if (!confirm(`Excluir permanentemente o produto ${r.codigo_interno} — ${r.descricao}?`)) return
    const k = rowKey(r)
    setDeletingKey(k)
    setError('')
    setSuccess('')
    try {
      const trimmedCod = r.codigo_interno.trim()

      if (r.id && String(r.id).trim() !== '') {
        const { data: del, error: dErr } = await supabase
          .from(TABELA_PRODUTOS)
          .delete()
          .eq('id', r.id)
          .select('id')
        if (dErr) throw dErr
        if (!del?.length) throw new Error('Nenhuma linha excluída (id não encontrado no banco).')
      } else {
        const { data: delExact, error: e1 } = await supabase
          .from(TABELA_PRODUTOS)
          .delete()
          .eq('codigo_interno', trimmedCod)
          .select('id')
        if (e1) throw e1
        if (!delExact?.length) {
          const { data: all, error: lErr } = await supabase.from(TABELA_PRODUTOS).select('id,codigo_interno').limit(20000)
          if (lErr) throw lErr
          type CodRow = { codigo_interno?: unknown }
          const exactValues = [
            ...new Set(
              ((all ?? []) as CodRow[])
                .filter((row) => String(row.codigo_interno ?? '').trim() === trimmedCod)
                .map((row) => String(row.codigo_interno ?? '')),
            ),
          ]
          if (exactValues.length === 0) {
            throw new Error(
              'Nenhuma linha com esse código. Se no Supabase o código parece igual ao digitado, ele pode ter espaços — rode supabase/sql/normalize_todos_os_produtos_codigo_trim.sql ou use delete com trim() no SQL Editor.',
            )
          }
          let total = 0
          for (const exact of exactValues) {
            const { data: del, error: de } = await supabase
              .from(TABELA_PRODUTOS)
              .delete()
              .eq('codigo_interno', exact)
              .select('id')
            if (de) throw de
            total += del?.length ?? 0
          }
          if (total === 0) throw new Error('Exclusão não removeu linhas.')
        }
      }

      setSuccess(`Produto ${trimmedCod} excluído do banco.`)
      if (editingKey === k) {
        setEditingKey(null)
        setEditSnapshot(null)
      }
      await load()
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao excluir.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function cadastrarProduto() {
    const cod = cadastroCodigo.trim()
    const desc = cadastroDescricao.trim()
    if (!cod || !desc) {
      setError('Código e descrição são obrigatórios no cadastro.')
      return
    }
    setCadastroSaving(true)
    setError('')
    setSuccess('')
    try {
      const ean = normEanDun(cadastroEan)
      const dun = normEanDun(cadastroDun)
      const unidadeRaw = cadastroUnidade.trim()
      const unidade = unidadeRaw === '' ? null : unidadeRaw

      if ((ean != null || dun != null) && !alteracaoConferenteId.trim()) {
        setError(MSG_CONFERENTE_OBRIGATORIO)
        setCadastroSaving(false)
        window.setTimeout(() => conferenteSelectRef.current?.focus(), 0)
        return
      }

      const tryInsert = async (payload: Record<string, unknown>) => {
        return supabase.from(TABELA_PRODUTOS).insert(payload).select('id,codigo_interno').limit(1)
      }

      const agoraIso = nowIsoLocal()
      const nomeAlt = alteracaoConferenteNome
      const patchNew: Record<string, unknown> = {}
      if (ean != null) {
        patchNew.ean_alterado_em = todayYmdLocal()
        patchNew.ean_alterado_em_hora = agoraIso
        patchNew.ean_alterado_conferente = nomeAlt
      }
      if (dun != null) {
        patchNew.dun_alterado_em = todayYmdLocal()
        patchNew.dun_alterado_em_hora = agoraIso
        patchNew.dun_alterado_conferente = nomeAlt
      }
      const legacyIns =
        ean != null || dun != null ? { ean_dun_alterado_em: todayYmdLocal() as string } : {}

      const insertTries: Record<string, unknown>[] = [
        { codigo_interno: cod, descricao: desc, ean, dun, unidade, ...patchNew },
        { codigo_interno: cod, descricao: desc, ean, dun, unidade, ...legacyIns },
        { codigo_interno: cod, descricao: desc, ean, dun, ...patchNew },
        { codigo_interno: cod, descricao: desc, ean, dun, ...legacyIns },
        { codigo_interno: cod, descricao: desc, ean, dun, unidade_medida: unidade, ...patchNew },
        { codigo_interno: cod, descricao: desc, ean, dun, unidade_medida: unidade, ...legacyIns },
        { codigo_interno: cod, descricao: desc, ean, dun, unidade_medida: unidade },
        { codigo_interno: cod, descricao: desc, ean, dun },
      ]

      type IdCodRowIns = { id: unknown; codigo_interno: unknown }
      let data: IdCodRowIns[] | null = null
      let insErr: { message?: string; code?: string } | null = null
      for (const p of insertTries) {
        const res = await tryInsert(p)
        data = res.data as IdCodRowIns[] | null
        insErr = res.error
        if (!insErr) break
        if (!isColumnMissingError(insErr)) break
      }

      if (insErr) throw new Error(formatUnknownError(insErr))
      if (!data || data.length === 0) {
        throw new Error(
          'Insert não retornou linha. Verifique permissões RLS (INSERT) na tabela "Todos os Produtos".',
        )
      }

      setSuccess(`Produto ${cod} cadastrado no banco.`)
      setCadastroOpen(false)
      setCadastroCodigo('')
      setCadastroDescricao('')
      setCadastroUnidade('')
      setCadastroEan('')
      setCadastroDun('')
      await load()
    } catch (e: unknown) {
      setError(formatUnknownError(e) || 'Erro ao cadastrar.')
    } finally {
      setCadastroSaving(false)
    }
  }

  const canEditRow = (k: string) => editingKey === k
  const r = produtoVisivel
  const k = r ? rowKey(r) : ''
  const edit = r ? canEditRow(k) : false
  const saving = r ? savingKey === k : false
  const deleting = r ? deletingKey === k : false

  return (
    <div className="produtos-page">
      <header className="produtos-page__header">
        <div>
          <h1>Produtos</h1>
          <p>
            Base oficial no Supabase ({TABELA_PRODUTOS}). Busque ou bipe um produto para visualizar e editar.
          </p>
        </div>
        <button
          type="button"
          className="produtos-page__btn-cadastrar"
          onClick={() => {
            setCadastroOpen(true)
            setError('')
          }}
        >
          + Cadastrar
        </button>
      </header>

      <section className="produtos-page__search">
        <label className="produtos-page__search-label" htmlFor="produto-busca">
          Buscar produto
        </label>
        <div className="produtos-page__search-row">
          <input
            id="produto-busca"
            ref={bipInputRef}
            className="produtos-page__search-input"
            value={bipCodigoBarras}
            onChange={(e) => {
              const v = e.target.value
              setBipCodigoBarras(v)
              if (v.trim() === '') setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                buscarPorBipEanDun()
              }
            }}
            autoComplete="off"
            placeholder="Código, EAN, DUN ou descrição…"
            aria-label="Buscar produto"
          />
          <div className="produtos-page__search-actions">
            <button
              type="button"
              className="produtos-page__btn-buscar"
              onClick={() => buscarPorBipEanDun()}
              disabled={loading}
            >
              Buscar
            </button>
            {produtoVisivel ? (
              <button type="button" className="produtos-page__btn-limpar" onClick={limparBipEFiltroSolo}>
                Limpar
              </button>
            ) : null}
          </div>
        </div>
        <p className="produtos-page__hint">
          Use o leitor de código de barras ou digite e pressione Enter.{' '}
          {rows.length > 0 ? `${rows.length} produto(s) na base.` : ''}
        </p>

        {(edit || cadastroOpen) && (precisaConferenteNaEdicao || cadastroOpen) ? (
          <div className="produtos-page__conferente">
            <label className="produtos-page__search-label" htmlFor="produto-conferente">
              Conferente (obrigatório ao alterar EAN/DUN)
            </label>
            <select
              id="produto-conferente"
              ref={conferenteSelectRef}
              value={alteracaoConferenteId}
              onChange={(e) => {
                setAlteracaoConferenteId(e.target.value)
                if (e.target.value.trim()) setError('')
              }}
              disabled={conferentesLoading}
            >
              <option value="">{conferentesLoading ? 'Carregando…' : 'Selecione…'}</option>
              {conferentes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      {error ? <div className="produtos-page__msg produtos-page__msg--error">{error}</div> : null}
      {success ? <div className="produtos-page__msg produtos-page__msg--ok">{success}</div> : null}

      {loading && !produtoVisivel ? (
        <div className="produtos-page__empty">Carregando produtos…</div>
      ) : produtoVisivel && r ? (
        <>
          {matchKeys.length > 1 ? (
            <div className="produtos-page__meta">
              <span>
                {matchIndex + 1} de {matchKeys.length} encontrados
              </span>
              <div className="produtos-page__nav">
                <button type="button" onClick={() => navegarMatch(-1)}>
                  ◀ Anterior
                </button>
                <button type="button" onClick={() => navegarMatch(1)}>
                  Próximo ▶
                </button>
              </div>
            </div>
          ) : null}

          <article
            className="produtos-page__card"
            ref={(el) => {
              if (el && k) rowRefs.current.set(k, el)
              else if (k) rowRefs.current.delete(k)
            }}
          >
            <div className="produtos-page__card-head">
              <p className="produtos-page__codigo">{r.codigo_interno}</p>
              {edit ? (
                <textarea
                  value={r.descricao}
                  onChange={(e) => patchRow(k, { descricao: e.target.value })}
                  rows={2}
                  style={{ width: '100%', margin: 0, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border, #4b5563)', background: 'var(--input-bg, #0f172a)', color: 'var(--text-h, #f9fafb)', fontSize: 14 }}
                />
              ) : (
                <p className="produtos-page__descricao">{r.descricao}</p>
              )}
            </div>

            <div className="produtos-page__card-body">
              <div className="produtos-page__grid2">
                <div className={`produtos-page__field${edit ? '' : ' produtos-page__field--readonly'}`}>
                  <label>Unidade</label>
                  {edit ? (
                    <input
                      value={r.unidade ?? ''}
                      onChange={(e) =>
                        patchRow(k, { unidade: e.target.value.trim() === '' ? null : e.target.value })
                      }
                    />
                  ) : (
                    <div className="produtos-page__value">{r.unidade ?? '—'}</div>
                  )}
                </div>
              </div>

              <div className="produtos-page__grid2">
                <div className="produtos-page__field">
                  <label>EAN</label>
                  <input
                    value={r.ean ?? ''}
                    onChange={(e) => patchRow(k, { ean: e.target.value === '' ? null : e.target.value })}
                    disabled={!edit || saving || deleting}
                    readOnly={!edit}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="produtos-page__field">
                  <label>DUN</label>
                  <input
                    value={r.dun ?? ''}
                    onChange={(e) => patchRow(k, { dun: e.target.value === '' ? null : e.target.value })}
                    disabled={!edit || saving || deleting}
                    readOnly={!edit}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="produtos-page__meta-row">
                <div className="produtos-page__meta-box">
                  <strong>Alteração EAN</strong>
                  <CelulaAlteracaoCodigo
                    {...propsAlteracaoCodigo(r, edit, editSnapshot, 'ean', alteracaoConferenteNome)}
                  />
                </div>
                <div className="produtos-page__meta-box">
                  <strong>Alteração DUN</strong>
                  <CelulaAlteracaoCodigo
                    {...propsAlteracaoCodigo(r, edit, editSnapshot, 'dun', alteracaoConferenteNome)}
                  />
                </div>
              </div>
            </div>

            <div className="produtos-page__card-foot">
              {!edit ? (
                <>
                  <button type="button" className="produtos-page__btn-primary" onClick={() => startEdit(r)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="produtos-page__btn-danger"
                    disabled={deleting}
                    onClick={() => void deleteRow(r)}
                  >
                    {deleting ? 'Excluindo…' : 'Excluir'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="produtos-page__btn-primary"
                    disabled={saving || deleting}
                    onClick={() => void saveRow(r)}
                  >
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button
                    type="button"
                    className="produtos-page__btn-muted"
                    disabled={saving || deleting}
                    onClick={() => cancelEdit()}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="produtos-page__btn-danger"
                    disabled={saving || deleting}
                    onClick={() => void deleteRow(r)}
                  >
                    Excluir
                  </button>
                </>
              )}
            </div>
          </article>
        </>
      ) : (
        <div className="produtos-page__empty">
          <div className="produtos-page__empty-icon" aria-hidden>
            🏷️
          </div>
          <p style={{ margin: 0, fontSize: 15 }}>
            Nenhum produto selecionado.
            <br />
            Bipe ou busque acima para exibir um item.
          </p>
        </div>
      )}

      <div className="produtos-page__reload">
        <button type="button" disabled={loading} onClick={() => void load()}>
          {loading ? 'Atualizando…' : 'Recarregar base do Supabase'}
        </button>
      </div>

      {cadastroOpen ? (
        <div
          className="produtos-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="produtos-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !cadastroSaving) setCadastroOpen(false)
          }}
        >
          <div className="produtos-modal">
            <div className="produtos-modal__head">
              <h2 id="produtos-modal-title">Novo produto</h2>
              <button
                type="button"
                className="produtos-modal__close"
                aria-label="Fechar"
                disabled={cadastroSaving}
                onClick={() => setCadastroOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="produtos-modal__body">
              <div className="produtos-page__field">
                <label>Código do produto *</label>
                <input
                  value={cadastroCodigo}
                  onChange={(e) => setCadastroCodigo(e.target.value)}
                  placeholder="ex.: 01.01.0099"
                  autoComplete="off"
                />
              </div>
              <div className="produtos-page__field">
                <label>Descrição *</label>
                <textarea
                  value={cadastroDescricao}
                  onChange={(e) => setCadastroDescricao(e.target.value)}
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>
              <div className="produtos-page__field">
                <label>Unidade</label>
                <input
                  value={cadastroUnidade}
                  onChange={(e) => setCadastroUnidade(e.target.value)}
                  placeholder="PT, CX…"
                  autoComplete="off"
                />
              </div>
              <div className="produtos-page__grid2">
                <div className="produtos-page__field">
                  <label>EAN</label>
                  <input value={cadastroEan} onChange={(e) => setCadastroEan(e.target.value)} autoComplete="off" />
                </div>
                <div className="produtos-page__field">
                  <label>DUN</label>
                  <input value={cadastroDun} onChange={(e) => setCadastroDun(e.target.value)} autoComplete="off" />
                </div>
              </div>
            </div>
            <div className="produtos-modal__foot">
              <button
                type="button"
                className="produtos-page__btn-primary"
                disabled={cadastroSaving}
                onClick={() => void cadastrarProduto()}
              >
                {cadastroSaving ? 'Salvando…' : 'Salvar produto'}
              </button>
              <button
                type="button"
                className="produtos-page__btn-muted"
                disabled={cadastroSaving}
                onClick={() => setCadastroOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}