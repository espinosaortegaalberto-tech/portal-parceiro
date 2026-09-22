import * as XLSX from 'xlsx'

// Cabeceras (normalizadas) del Excel de extracción del sistema de ventas.
const COLUMNAS_REQUERIDAS = [
  'nome_agente',
  'oferta',
  'cpe',
  'potencia',
  'sva',
  'estado_ucloud_e',
  'data_de_ativacao_e',
  'tipo_de_conta',
  'faturacao_eletronica',
]

// Únicos estados de "Estado Ucloud E" que se consideran contrato OK a efectos de comisión.
const ESTADOS_OK = ['Contrato Activado não Factur.', 'Contrato em Vigor']

export function normalizarCabecera(texto) {
  return String(texto)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/\s+/g, '_')
}

// Normaliza un valor de celda para compararlo sin depender de mayúsculas/acentos.
function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

const ESTADOS_OK_NORMALIZADOS = new Set(ESTADOS_OK.map(normalizarTexto))

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

// Lee el Excel de extracción del sistema (una fila por contrato) y devuelve
// { filas, errores, excluidosPorEstado, columnasDetectadas, columnasFaltantes }.
// filas: ventas normalizadas con `nombre_partner` (aún sin resolver a id_partner:
//   eso se hace después contra la tabla `partners`, ver CargaExcel.jsx).
// errores: filas descartadas por datos incompletos o inconsistentes.
// excluidosPorEstado: nº de filas descartadas solo por no tener un estado "OK"
//   (no son un error de datos, se muestran aparte en el resumen de la carga).
export async function parseExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hojaNombre = libro.SheetNames[0]
  const hoja = libro.Sheets[hojaNombre]
  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { defval: null, raw: true })

  if (filasCrudas.length === 0) {
    return {
      filas: [],
      errores: [],
      excluidosPorEstado: 0,
      columnasDetectadas: [],
      columnasFaltantes: COLUMNAS_REQUERIDAS,
    }
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
      excluidosPorEstado: 0,
      columnasDetectadas: cabecerasOriginales,
      columnasFaltantes,
    }
  }

  const filas = []
  const errores = []
  let excluidosPorEstado = 0

  filasCrudas.forEach((filaCruda, index) => {
    const numeroFila = index + 2 // +1 por índice base 0, +1 por la cabecera
    const get = (col) => filaCruda[mapaCabeceras[col]]

    const estado = get('estado_ucloud_e')
    if (!ESTADOS_OK_NORMALIZADOS.has(normalizarTexto(estado))) {
      excluidosPorEstado += 1
      return
    }

    const nombrePartner = get('nome_agente')
    const idContrato = get('cpe')

    if (!nombrePartner || String(nombrePartner).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta el nombre del partner (Nome Agente)' })
      return
    }
    if (!idContrato || String(idContrato).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta el identificador de contrato (CPE)' })
      return
    }

    const oferta = normalizarTexto(get('oferta'))
    let electricidad
    let gas
    if (oferta.startsWith('leve')) {
      electricidad = true
      gas = false
    } else if (oferta.startsWith('viva')) {
      electricidad = true
      gas = true
    } else {
      errores.push({
        fila: numeroFila,
        motivo: `Tipo de oferta no reconocido (ni LEVE ni VIVA): "${get('oferta')}"`,
      })
      return
    }

    const potencia = get('potencia')

    filas.push({
      nombre_partner: String(nombrePartner).trim(),
      id_contrato: String(idContrato).trim(),
      fecha_cierre: parseFecha(get('data_de_ativacao_e')),
      electricidad,
      gas,
      potencia_kva: potencia !== null && potencia !== '' ? Number(potencia) : null,
      debito_directo: normalizarTexto(get('tipo_de_conta')) === 'debito direto',
      factura_electronica: normalizarTexto(get('faturacao_eletronica')) === 's',
      sva: normalizarTexto(get('sva')) !== '' && normalizarTexto(get('sva')) !== 'sem sva',
    })
  })

  return { filas, errores, excluidosPorEstado, columnasDetectadas: cabecerasOriginales, columnasFaltantes: [] }
}

// Deduce el periodo (YYYY-MM) más frecuente a partir de fecha_cierre.
export function detectarPeriodo(filas) {
  const conteo = new Map()
  for (const fila of filas) {
    if (!fila.fecha_cierre) continue
    const periodo = fila.fecha_cierre.slice(0, 7)
    conteo.set(periodo, (conteo.get(periodo) ?? 0) + 1)
  }
  if (conteo.size === 0) return null
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0]
}
