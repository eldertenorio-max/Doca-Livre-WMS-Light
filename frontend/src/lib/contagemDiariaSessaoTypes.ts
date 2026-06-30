export type ContagemDiariaSessao = {
  id: string
  numero: number
  titulo: string
  local: string
  dataContagem: string
  conferenteNome?: string
  dataInicio: string
  dataFim: string | null
  status: 'aberto' | 'fechado'
  iniciada: boolean
  createdAt: string
  updatedAt?: string
}
