import * as XLSX from 'xlsx'

const COLUMNAS_REQUERIDAS = [
  'id_partner',
  'id_contrato',
  'fecha_cierre',
  'electricidad',
  'gas',
  'debito_directo',
  'factura_electronica',
  'sva',
]

export function normalizarCabecera(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\s+/g, '_')
}

function parseBooleano(valor) {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'number') return valor !== 0
  if (valor === null || valor === undefined) return false
  const v = String(valor).trim().toLowerCase()
  return ['si', 'sí', 'true', 'x', '1', 'yes'].includes(v)
}

export function parseFecha(valor) {
  if (!valor) return null
  if (valor instanceof Date) {
    return valor.toISOString().slice(0, 10)
  }
  if (typeof valor === 'number') {
    // Fecha serial de Excel
    const fecha = XLSX.SSF.parse_date_code(valor)
    if (!fecha) return null
    const mm = String(fecha.m).padStart(2, '0')
    const dd = String(fecha.d).padStart(2, '0')
    return `${fecha.y}-${mm}-${dd}`
  }
  const texto = String(valor).trim()
  // dd/mm/yyyy
  const match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // yyyy-mm-dd ya viene bien
  if (/^\d{4}-\d{2}-\d{2}/.test(texto)) return texto.slice(0, 10)
  return null
}

// Lee un fichero Excel y devuelve { filas, errores, columnasDetectadas }.
// filas: array de ventas normalizadas, listas para insertar en `ventas`.
// errores: array de { fila, motivo } para las filas descartadas.
export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hojaNombre = libro.SheetNames[0]
  const hoja = libro.Sheets[hojaNombre]
  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { defval: null, raw: true })

  if (filasCrudas.length === 0) {
    return { filas: [], errores: [], columnasDetectadas: [], columnasFaltantes: COLUMNAS_REQUERIDAS }
  }

  const cabecerasOriginales = Object.keys(filasCrudas[0])
  const mapaCabeceras = {} // cabecera normalizada -> cabecera original
  for (const original of cabecerasOriginales) {
    mapaCabeceras[normalizarCabecera(original)] = original
  }

  const columnasFaltantes = COLUMNAS_REQUERIDAS.filter((col) => !(col in mapaCabeceras))
  if (columnasFaltantes.length > 0) {
    return {
      filas: [],
      errores: [],
      columnasDetectadas: cabecerasOriginales,
      columnasFaltantes,
    }
  }

  const tieneImporte = 'importe_contrato' in mapaCabeceras
  const tieneCliente = 'cliente' in mapaCabeceras
  const tienePeriodo = 'periodo' in mapaCabeceras
  const tienePotencia = 'potencia_kva' in mapaCabeceras
  const tieneProducto = 'producto' in mapaCabeceras

  const filas = []
  const errores = []

  filasCrudas.forEach((filaCruda, index) => {
    const numeroFila = index + 2 // +1 por índice base 0, +1 por la cabecera
    const get = (col) => filaCruda[mapaCabeceras[col]]

    const idPartner = get('id_partner')
    const idContrato = get('id_contrato')

    if (!idPartner || String(idPartner).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta id_partner' })
      return
    }
    if (!idContrato || String(idContrato).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta id_contrato' })
      return
    }

    const electricidad = parseBooleano(get('electricidad'))
    const gas = parseBooleano(get('gas'))
    if (!electricidad && !gas) {
      errores.push({
        fila: numeroFila,
        motivo: 'El contrato debe ser de electricidad, de gas, o de ambos',
      })
      return
    }

    filas.push({
      id_partner: String(idPartner).trim(),
      id_contrato: String(idContrato).trim(),
      fecha_cierre: parseFecha(get('fecha_cierre')),
      producto: tieneProducto && get('producto') ? String(get('producto')).trim() : null,
      electricidad,
      gas,
      potencia_kva: tienePotencia && get('potencia_kva') !== null ? Number(get('potencia_kva')) : null,
      debito_directo: parseBooleano(get('debito_directo')),
      factura_electronica: parseBooleano(get('factura_electronica')),
      sva: parseBooleano(get('sva')),
      importe_contrato: tieneImporte && get('importe_contrato') !== null ? Number(get('importe_contrato')) : null,
      cliente: tieneCliente && get('cliente') ? String(get('cliente')).trim() : null,
      periodo: tienePeriodo && get('periodo') ? String(get('periodo')).trim() : null,
    })
  })

  return { filas, errores, columnasDetectadas: cabecerasOriginales, columnasFaltantes: [] }
}

// Deduce el periodo (YYYY-MM) más frecuente a partir de fecha_cierre, si no viene
// una columna "periodo" explícita en el Excel.
export function detectarPeriodo(filas) {
  const conPeriodoExplicito = filas.find((f) => f.periodo)
  if (conPeriodoExplicito) return conPeriodoExplicito.periodo

  const conteo = new Map()
  for (const fila of filas) {
    if (!fila.fecha_cierre) continue
    const periodo = fila.fecha_cierre.slice(0, 7)
    conteo.set(periodo, (conteo.get(periodo) ?? 0) + 1)
  }
  if (conteo.size === 0) return null
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
