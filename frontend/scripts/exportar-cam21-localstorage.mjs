/**
 * Gera um snippet para colar no DevTools (Console) do navegador onde ainda exista
 * sessão do inventário com dados da câmara 21.
 *
 * Uso: node scripts/exportar-cam21-localstorage.mjs
 * Copie o código impresso, cole no console do app (F12) e salve o JSON baixado.
 * Depois: EXPORT_JSON=backups/cam21-export.json node scripts/restaurar-cam21-hoje.mjs
 */

const snippet = `
(function exportCam21() {
  const KEY = 'inventario-offline-session-v1'
  const raw = localStorage.getItem(KEY)
  if (!raw) {
    alert('Nenhuma sessão inventario-offline-session-v1 neste navegador.')
    return
  }
  const session = JSON.parse(raw)
  const cam21 = (session.items || []).filter((it) => it.armazem_grupo === 7 || it.armazem_grupo === 8)
  const preenchidos = cam21.filter(
    (it) => String(it.codigo_interno || '').trim() && String(it.quantidade_contada || '').trim(),
  )
  if (!preenchidos.length) {
    alert('Sessão encontrada, mas sem linhas preenchidas na câmara 21 (grupos 7 e 8).')
    return
  }
  const out = { ...session, items: preenchidos, exportedAt: new Date().toISOString() }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'cam21-export-' + (session.data_contagem_ymd || 'hoje') + '.json'
  a.click()
  console.log('Exportadas', preenchidos.length, 'linhas da câmara 21')
})()
`.trim()

console.log('Cole no console do app (Inventário físico):\n')
console.log(snippet)
