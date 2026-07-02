import * as XLSX from 'xlsx-js-style'
import type { WorkSheet } from 'xlsx-js-style'
import {
  enderecosDuplicadosRelatorio,
  linhaRelatorioEnderecoRepetido,
  type LinhaEnderecoRelatorio,
} from './capturaEnderecoDuplicado'

const FILL_ENDERECO_REPETIDO = {
  patternType: 'solid' as const,
  fgColor: { rgb: 'FFFDE68A' },
}

export function aplicarDestaqueEnderecoRepetidoExcel(
  ws: WorkSheet,
  rows: LinhaEnderecoRelatorio[],
  dataRowAoaIndexes: number[],
): void {
  if (rows.length === 0 || dataRowAoaIndexes.length === 0) return
  const duplicados = enderecosDuplicadosRelatorio(rows)
  if (duplicados.size === 0) return

  const ref = ws['!ref']
  if (!ref) return
  const range = XLSX.utils.decode_range(ref)
  const colCount = range.e.c + 1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!linhaRelatorioEnderecoRepetido(row, duplicados)) continue
    const aoaRow = dataRowAoaIndexes[i]
    if (aoaRow == null) continue
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: aoaRow, c })
      const cell = ws[addr]
      if (!cell) continue
      cell.s = { ...(typeof cell.s === 'object' && cell.s ? cell.s : {}), fill: FILL_ENDERECO_REPETIDO }
    }
  }
}

export function relatorioExcelSheetComDestaqueEndereco(
  aoa: (string | number)[][],
  rows: LinhaEnderecoRelatorio[],
  dataRowAoaIndexes: number[],
): WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  aplicarDestaqueEnderecoRepetidoExcel(ws, rows, dataRowAoaIndexes)
  return ws
}
