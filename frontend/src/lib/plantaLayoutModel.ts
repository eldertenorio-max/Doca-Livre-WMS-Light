import { getGrupoArmazemFromCamaraRua } from '../components/inventario/inventarioPlanilhaModel'

export type PlantaEndereco = {
  rua: string
  posicao: number
  nivel: number
  destino_acao?: string | null
  destino_label?: string | null
}

export type PlantaCamaraJson = {
  codigo: number
  descricao?: string
  ruas: string[]
  niveis: number
  total_posicoes: number
  enderecos: PlantaEndereco[]
}

export type PlantaLayoutJson = {
  camaras: PlantaCamaraJson[]
}

export type PlantaAreaEspecial = {
  area: string
  rua: string
  slots: number
  label: string
}

export type PlantaAreasEspeciaisJson = {
  camara: number
  descricao?: string
  areas: PlantaAreaEspecial[]
}

export type PlantaSlotOcupacao = 'livre' | 'ocupado' | 'contado'

export type PlantaSlotView = PlantaEndereco & {
  ocupacao: PlantaSlotOcupacao
}

export const PLANTA_CAMARAS_ORDEM = [11, 12, 13, 21] as const

export function plantaMaxNivel(camara: number): number {
  return camara === 21 ? 2 : 5
}

export function plantaNivelLabel(camara: number): string {
  return plantaMaxNivel(camara) === 2 ? '1–2' : '1–5'
}

export function plantaCamaraMeta(camara: number): { tipo: string } {
  if (camara === 21) return { tipo: 'Refrigerado' }
  if (camara === 98) return { tipo: 'Quarentena' }
  return { tipo: 'Congelado' }
}

export function plantaCellColors(
  nivel: number,
  ocupacao: PlantaSlotOcupacao,
  destinoAcao?: string | null,
  slotExists = true,
): { fill: string; stroke: string } {
  const stroke = '#ff9800'
  if (!slotExists) return { fill: '#eceff1', stroke }
  if (ocupacao === 'contado') return { fill: '#66bb6a', stroke: '#2e7d32' }
  if (ocupacao === 'ocupado') return { fill: '#ab47bc', stroke: '#6a1b9a' }
  const dest = String(destinoAcao ?? '').trim().toLowerCase()
  if (dest === 'envio_mg') return { fill: '#42a5f5', stroke }
  if (dest === 'retrabalho') return { fill: '#ffca28', stroke }
  if (dest === 'descarte_perdas') return { fill: '#8d6e63', stroke }
  if (dest === 'palete_bloqueado') return { fill: '#78909c', stroke }
  if (dest === 'avaria') return { fill: '#ab47bc', stroke }
  if (dest === 'reentregas') return { fill: '#7e57c2', stroke }
  if (nivel === 1) return { fill: '#90caf9', stroke }
  return { fill: '#0d47a1', stroke }
}

export function plantaSlotsCamara(cam: PlantaCamaraJson): PlantaEndereco[] {
  const maxNiv = plantaMaxNivel(cam.codigo)
  const ruas = cam.ruas ?? []
  const ruaEsq = ruas[0] ?? 'A'
  const ruaDir = ruas[1] ?? ruas[0] ?? 'B'
  const enderecos = cam.enderecos ?? []
  const esq = slotsPorRua(enderecos, ruaEsq, maxNiv)
  const dir = ruas.length > 1 ? slotsPorRua(enderecos, ruaDir, maxNiv) : []
  return esq.concat(dir)
}

export function slotsPorRua(enderecos: PlantaEndereco[], rua: string, maxNivel: number): PlantaEndereco[] {
  const r = String(rua ?? '').trim().toUpperCase()
  return enderecos.filter(
    (e) => String(e.rua ?? '').trim().toUpperCase() === r && e.nivel >= 1 && e.nivel <= maxNivel,
  )
}

export function posMapFromSlots(slots: PlantaEndereco[]): Map<number, Map<number, PlantaEndereco>> {
  const map = new Map<number, Map<number, PlantaEndereco>>()
  for (const s of slots) {
    if (!map.has(s.posicao)) map.set(s.posicao, new Map())
    map.get(s.posicao)!.set(s.nivel, s)
  }
  return map
}

export function colunasOrdenadas(posMap: Map<number, Map<number, PlantaEndereco>>): number[] {
  return [...posMap.keys()].sort((a, b) => a - b)
}

export function plantaSlotKey(camara: number, rua: string, posicao: number, nivel: number): string {
  return `${camara}|${String(rua).trim().toUpperCase()}|${posicao}|${nivel}`
}

export function plantaGrupoFromCamaraRua(camara: number, rua: string): number | null {
  return getGrupoArmazemFromCamaraRua(camara, String(rua ?? '').trim().toUpperCase())
}

export function buildOcupacaoMapFromInventarioItems(
  items: Array<{
    armazem_grupo?: number | null
    planilha_ordem_na_aba?: number | null
    codigo_interno?: string | null
    quantidade_contada?: string | null
  }>,
  posNivelFromIndex: (idx: number) => { pos: number; nivel: number },
  camaraFromGrupo: (grupo: number) => number | null,
  ruaFromGrupo: (grupo: number) => string,
): Map<string, PlantaSlotOcupacao> {
  const out = new Map<string, PlantaSlotOcupacao>()
  for (const it of items) {
    if (it.armazem_grupo == null || it.planilha_ordem_na_aba == null) continue
    const cam = camaraFromGrupo(it.armazem_grupo)
    const rua = ruaFromGrupo(it.armazem_grupo)
    if (cam == null || !rua || rua === '—') continue
    const { pos, nivel } = posNivelFromIndex(it.planilha_ordem_na_aba)
    const cod = String(it.codigo_interno ?? '').trim()
    const qtd = String(it.quantidade_contada ?? '').trim()
    if (!cod && !qtd) continue
    const key = plantaSlotKey(cam, rua, pos, nivel)
    const prev = out.get(key)
    if (prev === 'contado') continue
    if (qtd) out.set(key, 'contado')
    else if (cod) out.set(key, 'ocupado')
  }
  return out
}

export async function fetchPlantaLayoutData(): Promise<{
  layout: PlantaLayoutJson
  areasEspeciais: PlantaAreasEspeciaisJson
}> {
  const [layoutRes, areasRes] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/wms_layout_camaras.json?v=2`),
    fetch(`${import.meta.env.BASE_URL}data/wms_areas_especiais.json?v=2`),
  ])
  if (!layoutRes.ok) throw new Error('Não foi possível carregar o layout das câmaras.')
  if (!areasRes.ok) throw new Error('Não foi possível carregar áreas especiais.')
  const layout = (await layoutRes.json()) as PlantaLayoutJson
  const areasEspeciais = (await areasRes.json()) as PlantaAreasEspeciaisJson
  return { layout, areasEspeciais }
}
