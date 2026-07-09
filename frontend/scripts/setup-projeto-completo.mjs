/**
 * Orquestra: schema SQL + cópia de dados do projeto antigo + auth + triggers/views.
 *
 * PowerShell (na pasta frontend):
 *   $env:SUPABASE_DB_PASSWORD = "senha-do-banco-NOVO"
 *   $env:SUPABASE_DB_PASSWORD_OLD = "senha-do-banco-ANTIGO"   # se for diferente
 *   npm run setup:novo-projeto
 *
 * Opcional no frontend/.env (não commitar senhas):
 *   SUPABASE_DB_PASSWORD=...
 *   SUPABASE_DB_PASSWORD_OLD=...
 *   SUPABASE_PROJECT_REF=ogpiinpoclfjnvrbthrq
 */
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  REF_ANTIGO,
  REF_NOVO,
  connectPg,
  loadDotEnv,
  runSqlFile,
  sqlPath,
} from './lib/supabase-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SCHEMA_FILES = [
  'supabase/sql/create_todos_os_produtos_novo_projeto.sql',
  'supabase/sql/create_sheet_outbox.sql',
  'supabase_schema_contagem.sql',
  'supabase/sql/create_usuarios.sql',
  'supabase/sql/create_inventario_planilha_linhas.sql',
  'supabase/sql/create_contagens_inventario.sql',
  'supabase/sql/create_contagem_diaria_temperatura_ocupacao.sql',
  'supabase/sql/create_contagem_ocupacao_avaria_camaras.sql',
  'supabase/sql/create_contagem_diaria_presenca.sql',
  'supabase/sql/create_contagem_diaria_captura_presenca.sql',
  'supabase/sql/create_inventario_captura_presenca.sql',
  'supabase/sql/create_enderecamento_listas.sql',
  'supabase/sql/create_produto_listas.sql',
  'supabase/sql/setup_inventario_listas_completo.sql',
  'supabase/sql/alter_contagens_estoque_finalizacao_sessao.sql',
  'supabase/sql/alter_contagens_estoque_contagem_rascunho.sql',
  'supabase/sql/alter_contagens_estoque_origem_inventario.sql',
  'supabase/sql/alter_contagens_estoque_add_up_adicional.sql',
  'supabase/sql/alter_contagens_estoque_add_foto_base64.sql',
  'supabase/sql/alter_contagens_estoque_inventario_numero_contagem.sql',
  'supabase/sql/alter_contagens_inventario_rascunho_sessao.sql',
  'supabase/sql/alter_inventario_sessoes_listas_vinculo.sql',
  'supabase/sql/alter_inventario_planilha_linhas_fk_cascade.sql',
  'supabase/sql/alter_inventario_planilha_linhas_grupo_1_8.sql',
  'supabase/sql/alter_contagem_diaria_sessoes_linhas.sql',
  'supabase/sql/alter_contagem_diaria_presenca_progresso.sql',
  'supabase/sql/alter_contagem_diaria_presenca_inventario_contexto.sql',
  'supabase/sql/alter_contagem_ocupacao_camaras_add_avaria_acrescimo.sql',
  'supabase/sql/alter_contagem_ocupacao_camaras_rename_vazias_678_para_111213.sql',
  'supabase/sql/alter_todos_os_produtos_ean_dun_alterado_em.sql',
  'supabase/sql/alter_todos_os_produtos_ean_dun_alterado_meta.sql',
  'supabase/sql/alter_todos_os_produtos_add_foto_base64.sql',
  'supabase/sql/alter_todos_os_produtos_primary_key.sql',
  'supabase/sql/alter_usuarios_username.sql',
  'supabase/sql/alter_usuarios_remove_email_add_senha.sql',
  'supabase/sql/alter_usuarios_acesso_pendente.sql',
  'supabase/sql/alter_usuarios_permissoes_views.sql',
  'supabase/sql/alter_usuarios_admin_delete.sql',
  'supabase/sql/alter_sheet_outbox_only_contagem_diaria.sql',
  'supabase/sql/alter_v_contagem_diaria_painel_security_invoker.sql',
  'supabase/sql/view_v_contagem_diaria_painel.sql',
  'supabase/sql/view_v_contagem_diaria_itens_painel.sql',
  'supabase/sql/enable_rls_core_tabelas.sql',
  'supabase/sql/rls_todos_os_produtos_crud.sql',
  'supabase/sql/setup_protecao_dados_supabase.sql',
  'supabase/sql/enable_realtime_contagens_estoque.sql',
  'supabase/sql/enable_realtime_contagens_inventario.sql',
  'supabase/sql/trigger_usuarios_delete_remove_auth_user.sql',
]

function qIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function listPublicTables(client) {
  const r = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
  )
  return r.rows.map((x) => x.tablename)
}

async function copyPublicData(oldC, newC) {
  const oldTables = await listPublicTables(oldC)
  const newTables = new Set(await listPublicTables(newC))
  const tables = oldTables.filter((t) => newTables.has(t))
  console.log(`\n=== Copiando dados (${REF_ANTIGO} → ${REF_NOVO}): ${tables.length} tabelas ===`)

  await newC.query('SET session_replication_role = replica').catch(() => {})

  for (const table of tables) {
    const quoted = qIdent(table)
    try {
      const countR = await oldC.query(`SELECT count(*)::int AS n FROM ${quoted}`)
      const n = countR.rows[0]?.n ?? 0
      if (n === 0) {
        console.log(`  ${table}: 0 (vazio)`)
        continue
      }
      const colsR = await oldC.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
        [table],
      )
      const cols = colsR.rows.map((r) => r.column_name)
      const colList = cols.map(qIdent).join(', ')
      const sel = await oldC.query(`SELECT ${colList} FROM ${quoted}`)
      await newC.query(`DELETE FROM ${quoted}`)
      const batch = 100
      let inserted = 0
      for (let i = 0; i < sel.rows.length; i += batch) {
        const chunk = sel.rows.slice(i, i + batch)
        const placeholders = chunk
          .map(
            (_, ri) =>
              `(${cols.map((__, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`,
          )
          .join(', ')
        const values = chunk.flatMap((row) => cols.map((c) => row[c]))
        await newC.query(`INSERT INTO ${quoted} (${colList}) VALUES ${placeholders}`, values)
        inserted += chunk.length
      }
      console.log(`  ${table}: ${inserted} linha(s)`)
    } catch (e) {
      console.error(`  ERRO ${table}:`, e.message?.split('\n')[0] || e)
    }
  }

  await newC.query('SET session_replication_role = DEFAULT').catch(() => {})
}

function runNodeScript(name) {
  return new Promise((resolve, reject) => {
    const script = path.join(__dirname, name)
    const child = spawn(process.execPath, [script], {
      stdio: 'inherit',
      env: process.env,
      cwd: path.join(__dirname, '..'),
    })
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${name} exit ${code}`))))
  })
}

async function audit(newC) {
  const tables = await listPublicTables(newC)
  console.log('\n=== Auditoria rápida ===')
  for (const t of tables.slice(0, 25)) {
    const n = (await newC.query(`SELECT count(*)::int AS n FROM ${qIdent(t)}`)).rows[0].n
    console.log(`  ${t}: ${n}`)
  }
  if (tables.length > 25) console.log(`  ... +${tables.length - 25} tabelas`)
}

async function main() {
  loadDotEnv()
  const skipData = process.env.SKIP_DATA_COPY === '1'
  const client = await connectPg(REF_NOVO)

  console.log(`Projeto novo: ${REF_NOVO}`)
  console.log('1) Aplicando schema SQL...')
  for (const rel of SCHEMA_FILES) {
    const label = rel.split('/').pop()
    try {
      await runSqlFile(client, rel)
      console.log('  OK', label)
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {})
      const msg = String(e.message || e)
      if (/already exists|duplicate/i.test(msg)) {
        console.log('  SKIP (já existe)', label)
      } else if (/setval: value 0 is out of bounds/i.test(msg)) {
        console.log('  SKIP (sequência vazia — OK em banco novo)', label)
      } else if (/depend on it|already exists/i.test(msg)) {
        console.log('  SKIP (objeto já aplicado)', label)
      } else {
        console.error('  ERRO', label, '—', msg.split('\n')[0])
        throw e
      }
    }
  }

  await client.end()

  if (!skipData) {
    console.log('\n2) Copiando dados do projeto antigo...')
    const oldPwd = process.env.SUPABASE_DB_PASSWORD_OLD || process.env.SUPABASE_DB_PASSWORD
    if (!oldPwd) {
      console.warn('Pule dados: defina SUPABASE_DB_PASSWORD_OLD ou use a mesma SUPABASE_DB_PASSWORD.')
    } else {
      try {
        const oldC = await connectPg(REF_ANTIGO, oldPwd)
        const newC = await connectPg(REF_NOVO)
        await copyPublicData(oldC, newC)
        await oldC.end()
        await newC.end()

        console.log('\n3) Auth users...')
        await runNodeScript('import-auth-users-postgres.mjs').catch((e) => {
          console.warn('Auth:', e.message)
        })

        console.log('\n4) Triggers sheet_outbox...')
        await runNodeScript('sincronizar-triggers-sheet-outbox.mjs').catch((e) => {
          console.warn('Triggers:', e.message)
        })

        console.log('\n5) Views...')
        await runNodeScript('sincronizar-views-supabase.mjs').catch((e) => {
          console.warn('Views:', e.message)
        })
      } catch (e) {
        console.warn('\nCópia do projeto antigo não realizada:', e.message?.split('\n')[0] || e)
        console.warn('O schema do projeto novo foi aplicado. Importe produtos pela planilha ou informe SUPABASE_DB_PASSWORD_OLD.')
      }
    }
  }

  const auditC = await connectPg(REF_NOVO)
  await audit(auditC)
  await auditC.end()

  console.log('\nConcluído. Próximo: deploy Edge Functions (supabase functions deploy) e Render com VITE_*.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
