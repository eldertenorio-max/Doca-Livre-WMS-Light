/**
 * Restaura no Supabase apenas a contagem da CÂMARA 21 (grupos 7 e 8 / ruas G e H) de um dia.
 *
 * Fontes de dados (uma delas):
 *   1) EXPORT_JSON=caminho.json — export do navegador (ver exportar-cam21-localstorage.mjs)
 *   2) SOURCE_DB_URL — Postgres de backup/PITR (projeto restaurado no Supabase)
 *
 * PowerShell (pasta frontend):
 *   $env:EXPORT_JSON="backups/cam21-2026-06-27.json"
 *   node scripts/restaurar-cam21-hoje.mjs
 *
 * Ou com backup PITR clonado:
 *   $env:SOURCE_DB_URL="postgresql://postgres:SENHA@db.REF.supabase.co:5432/postgres"
 *   $env:DATA_INVENTARIO="2026-06-27"
 *   node scripts/restaurar-cam21-hoje.mjs
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import pg from 'pg'

const CAM21_GRUPOS = [7, 8]
const CAM21_RUAS = ['G', 'H']

function loadDotEnv() {
  for (const p of ['.env', '.env.local']) {
    try {
      const raw = fs.readFileSync(path.join(process.cwd(), p), 'utf8')
      for (const line of raw.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq <= 0) continue
        const k = t.slice(0, eq).trim()
        const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
        if (k && process.env[k] === undefined) process.env[k] = v
      }
    } catch {
      /* ignore */
    }
  }
}

function todaySpYmd() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function isCam21Grupo(g) {
  const n = Number(g)
  return Number.isFinite(n) && CAM21_GRUPOS.includes(n)
}

function isCam21Rua(rua) {
  return CAM21_RUAS.includes(String(rua ?? '').trim().toUpperCase())
}

function filterCam21Items(items) {
  return (items || []).filter((it) => {
    const g = it.armazem_grupo ?? it.grupo_armazem ?? it.planilha_grupo_armazem
    if (isCam21Grupo(g)) return true
    const rua = String(it.rua ?? '').trim().toUpperCase()
    return isCam21Rua(rua)
  })
}

async function fetchFromSourceDb(ymd) {
  const url = process.env.SOURCE_DB_URL
  if (!url) return null
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const inv = await client.query(
      `select * from public.contagens_inventario
       where data_contagem = $1::date
         and planilha_grupo_armazem in (7, 8)
       order by created_at`,
      [ymd],
    )
    const pl = await client.query(
      `select * from public.inventario_planilha_linhas
       where data_inventario = $1::date
         and grupo_armazem in (7, 8)
       order by created_at`,
      [ymd],
    )
    return { contagens: inv.rows, planilha: pl.rows }
  } finally {
    await client.end()
  }
}

function loadExportJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  if (data.contagens_inventario || data.planilha) return data
  if (Array.isArray(data.items)) {
    const cam21 = filterCam21Items(data.items)
    return { fromSession: true, items: cam21, session: data }
  }
  throw new Error('JSON não reconhecido — use export do localStorage ou dump PITR.')
}

function buildRowsFromSessionItems(session, items, ymd) {
  const conferenteId = session.conferente_id
  if (!conferenteId) throw new Error('Sessão sem conferente_id')
  const rodada = Math.min(4, Math.max(1, Math.round(Number(session.inventario_numero_contagem ?? 1))))
  const contagens = []
  const planilha = []
  const ROWS_POR_POS = 15

  for (const it of items) {
    const qStr = String(it.quantidade_contada ?? '').trim()
    if (!qStr || !String(it.codigo_interno ?? '').trim()) continue
    const q = Number(qStr.replace(',', '.'))
    if (!Number.isFinite(q) || q < 0) continue

    const grupo = Number(it.armazem_grupo)
    const ordem = it.planilha_ordem_na_aba
    const pos =
      ordem != null ? Math.floor(Number(ordem) / ROWS_POR_POS) + 1 : Number(it.posicao ?? 1)
    const within = ordem != null ? Number(ordem) % ROWS_POR_POS : 0
    const nivel = ordem != null ? Math.floor(within / 3) + 1 : Number(it.nivel ?? 1)
    const rua =
      CAM21_RUAS[CAM21_GRUPOS.indexOf(grupo)] ??
      (grupo === 7 ? 'G' : grupo === 8 ? 'H' : 'G')

    const invId = crypto.randomUUID()
    const now = new Date().toISOString()

    contagens.push({
      id: invId,
      data_contagem: ymd,
      data_hora_contagem: now,
      conferente_id: conferenteId,
      codigo_interno: String(it.codigo_interno).trim(),
      descricao: String(it.descricao ?? '').trim(),
      quantidade_up: q,
      up_adicional: it.up_quantidade
        ? Number(String(it.up_quantidade).replace(',', '.'))
        : null,
      lote: String(it.lote ?? '').trim() || null,
      observacao: String(it.observacao ?? '').trim() || null,
      data_fabricacao: it.data_fabricacao || null,
      data_validade: it.data_validade || null,
      ean: it.ean || null,
      dun: it.dun || null,
      inventario_repeticao: it.inventario_repeticao ?? null,
      inventario_numero_contagem: rodada,
      planilha_grupo_armazem: grupo,
      planilha_ordem_na_aba: ordem,
      contagem_rascunho: false,
    })

    planilha.push({
      conferente_id: conferenteId,
      data_inventario: ymd,
      grupo_armazem: grupo,
      rua,
      posicao: pos,
      nivel,
      numero_contagem: rodada,
      codigo_interno: String(it.codigo_interno).trim(),
      descricao: String(it.descricao ?? '').trim(),
      inventario_repeticao: it.inventario_repeticao ?? null,
      quantidade: q,
      data_fabricacao: it.data_fabricacao || null,
      data_validade: it.data_validade || null,
      lote: String(it.lote ?? '').trim() || null,
      up_quantidade: it.up_quantidade
        ? Number(String(it.up_quantidade).replace(',', '.'))
        : null,
      observacao: String(it.observacao ?? '').trim() || null,
      contagens_inventario_id: invId,
    })
  }

  return { contagens, planilha }
}

async function insertToSupabase(sb, contagens, planilha) {
  const CHUNK = 200
  let insInv = 0
  for (let i = 0; i < contagens.length; i += CHUNK) {
    const toInsert = contagens.slice(i, i + CHUNK).map((r) => {
      const row = { ...r }
      delete row.id
      return row
    })
    const { data, error } = await sb.from('contagens_inventario').insert(toInsert).select('id')
    if (error) throw error
    insInv += data?.length ?? 0
    for (let j = 0; j < (data?.length ?? 0); j++) {
      const plIdx = i + j
      if (planilha[plIdx]) planilha[plIdx].contagens_inventario_id = data[j].id
    }
  }

  let insPl = 0
  for (let i = 0; i < planilha.length; i += CHUNK) {
    const chunk = planilha.slice(i, i + CHUNK)
    const { data, error } = await sb.from('inventario_planilha_linhas').insert(chunk).select('id')
    if (error) throw error
    insPl += data?.length ?? 0
  }

  return { insInv, insPl }
}

async function insertFromPitrDump(sb, dump) {
  const contagens = dump.contagens || []
  const planilha = dump.planilha || []
  if (!contagens.length && !planilha.length) {
    throw new Error('Nenhuma linha da câmara 21 no backup informado.')
  }

  const idMap = new Map()
  const invRows = contagens.map((r) => {
    const oldId = r.id
    const row = { ...r }
    delete row.id
    delete row.created_at
    idMap.set(oldId, { oldId, row })
    return { oldId, row }
  })

  const CHUNK = 200
  let insInv = 0
  const newIds = new Map()
  for (let i = 0; i < invRows.length; i += CHUNK) {
    const chunk = invRows.slice(i, i + CHUNK).map((x) => x.row)
    const { data, error } = await sb.from('contagens_inventario').insert(chunk).select('id')
    if (error) throw error
    insInv += data?.length ?? 0
    for (let j = 0; j < (data?.length ?? 0); j++) {
      newIds.set(invRows[i + j].oldId, data[j].id)
    }
  }

  const plRows = planilha.map((r) => {
    const row = { ...r }
    delete row.id
    delete row.created_at
    const fk = row.contagens_inventario_id
    if (fk && newIds.has(fk)) row.contagens_inventario_id = newIds.get(fk)
    else delete row.contagens_inventario_id
    delete row.contagens_estoque_id
    return row
  })

  let insPl = 0
  for (let i = 0; i < plRows.length; i += CHUNK) {
    const chunk = plRows.slice(i, i + CHUNK)
    const { data, error } = await sb.from('inventario_planilha_linhas').insert(chunk).select('id')
    if (error) throw error
    insPl += data?.length ?? 0
  }

  return { insInv, insPl }
}

async function main() {
  loadDotEnv()
  const ymd = process.env.DATA_INVENTARIO || todaySpYmd()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
    process.exit(1)
  }
  const sb = createClient(url, key)

  const { count: exist } = await sb
    .from('inventario_planilha_linhas')
    .select('id', { count: 'exact', head: true })
    .eq('data_inventario', ymd)
    .in('grupo_armazem', CAM21_GRUPOS)
  if ((exist ?? 0) > 0) {
    console.error(`Já existem ${exist} linhas da câmara 21 em ${ymd}. Abortando para não duplicar.`)
    process.exit(1)
  }

  let result
  const exportPath = process.env.EXPORT_JSON
  if (exportPath) {
    const dump = loadExportJson(path.resolve(exportPath))
    if (dump.fromSession) {
      const built = buildRowsFromSessionItems(dump.session, dump.items, ymd)
      result = await insertToSupabase(sb, built.contagens, built.planilha)
    } else {
      result = await insertFromPitrDump(sb, dump)
    }
  } else {
    const fromDb = await fetchFromSourceDb(ymd)
    if (!fromDb) {
      console.error(
        'Sem dados para restaurar. Informe EXPORT_JSON (sessão local) ou SOURCE_DB_URL (backup PITR).',
      )
      process.exit(1)
    }
    result = await insertFromPitrDump(sb, {
      contagens: fromDb.contagens,
      planilha: fromDb.planilha,
    })
  }

  console.log(`Restaurado câmara 21 (${ymd}):`)
  console.log(`  contagens_inventario: ${result.insInv}`)
  console.log(`  inventario_planilha_linhas: ${result.insPl}`)
}

main().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})
