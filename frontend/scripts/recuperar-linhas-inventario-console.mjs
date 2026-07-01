/**
 * Gera snippet para recuperar linhas de inventário do localStorage do navegador.
 * Cole no console (F12) na página do app, no aparelho onde as linhas foram lançadas.
 *
 * Uso: node scripts/recuperar-linhas-inventario-console.mjs
 */

const snippet = `
(function recuperarInventarioLocal() {
  const MAP_KEY = 'inventario-sessao-map-cache-v1'
  const LEGACY_KEY = 'inventario-sessoes-v2'
  const OVERLAY_KEY = 'inventario-linhas-overlay-v1'

  function mergePorId(...listas) {
    const map = new Map()
    for (const list of listas) {
      if (!Array.isArray(list)) continue
      for (const ln of list) {
        if (!ln?.id) continue
        const prev = map.get(ln.id)
        if (!prev || String(ln.createdAt) >= String(prev.createdAt)) map.set(ln.id, ln)
      }
    }
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  const titulo = prompt('Nome do inventário (ex: 1º contagem - CD Guarulhos):', '1º contagem')
  if (!titulo) return

  let map = {}
  try { map = JSON.parse(localStorage.getItem(MAP_KEY) || '{}') } catch {}
  let legacy = []
  try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]') } catch {}
  let overlay = {}
  try { overlay = JSON.parse(localStorage.getItem(OVERLAY_KEY) || '{}') } catch {}

  const candidatos = [
    ...Object.values(map),
    ...legacy,
  ].filter((s) => s && String(s.titulo || '').toLowerCase().includes(String(titulo).toLowerCase()))

  if (!candidatos.length) {
    alert('Nenhuma sessão local com esse nome. Tente no celular onde contou.')
    return
  }

  const sessao = candidatos.sort((a, b) => (b.linhas?.length || 0) - (a.linhas?.length || 0))[0]
  const id = sessao.id
  const linhas = mergePorId(sessao.linhas, overlay[id], map[id]?.linhas)

  const blob = new Blob([JSON.stringify({ ...sessao, linhas, exportedAt: new Date().toISOString() }, null, 2)], {
    type: 'application/json',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'inventario-recuperado-' + (sessao.numero || 'sessao') + '.json'
  a.click()

  map[id] = { ...sessao, linhas }
  localStorage.setItem(MAP_KEY, JSON.stringify(map))
  overlay[id] = linhas
  localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay))

  alert('Exportado ' + linhas.length + ' linha(s). JSON baixado e cache local atualizado. Abra Inventários e clique em Recuperar linhas.')
  console.log('Sessão', id, 'linhas', linhas.length, sessao)
})()
`.trim()

console.log('Cole no console do app (F12), no aparelho onde as linhas foram lançadas:\n')
console.log(snippet)
