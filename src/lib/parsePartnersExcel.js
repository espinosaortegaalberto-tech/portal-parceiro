import * as XLSX from 'xlsx'
import { normalizarCabecera, parseFecha } from './parseExcel'

const COLUMNAS_REQUERIDAS = ['id', 'nombre_empresa']

const COLUMNAS_PLANTILLA = [
  'id',
  'nombre_empresa',
  'sector',
  'region',
  'categoria',
  'contacto',
  'email',
  'telefono',
  'direccion',
  'url_web',
  'estado',
  'fecha_alta',
]

// Genera y descarga la plantilla Excel para el alta masiva de partners.
export function descargarPlantillaPartners() {
  const filaEjemplo = {
    id: 'P-0007',
    nombre_empresa: 'Nombre Ejemplo SL',
    sector: 'Luz y Gas',
    region: 'Centro',
    categoria: 'Plata',
    contacto: 'Nombre Apellidos',
    email: 'contacto@ejemplo.com',
    telefono: '600000000',
    direccion: 'Calle Ejemplo 1, Ciudad',
    url_web: 'https://ejemplo.com',
    estado: 'activo',
    fecha_alta: '2026-01-01',
  }

  const hoja = XLSX.utils.json_to_sheet([filaEjemplo], { header: COLUMNAS_PLANTILLA })
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Partners')
  XLSX.writeFile(libro, 'plantilla_partners.xlsx')
}

// Normaliza un nombre de empresa para comparar duplicados (sin mayúsculas, acentos ni espacios extra).
export function normalizarNombre(nombre) {
  return String(nombre)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
}

// Lee el Excel de alta masiva y devuelve { filas, errores, columnasFaltantes }.
// filas: partners normalizados listos para validar duplicados e insertar.
// errores: filas descartadas por falta de id o nombre_empresa.
export async function parsePartnersExcelFile(file) {
  const buffer = await file.arrayBuffer()
  const libro = XLSX.read(buffer, { type: 'array' })
  const hoja = libro.Sheets[libro.SheetNames[0]]
  const filasCrudas = XLSX.utils.sheet_to_json(hoja, { defval: null, raw: true })

  if (filasCrudas.length === 0) {
    return { filas: [], errores: [], columnasFaltantes: COLUMNAS_REQUERIDAS }
  }

  const cabecerasOriginales = Object.keys(filasCrudas[0])
  const mapaCabeceras = {}
  for (const original of cabecerasOriginales) {
    mapaCabeceras[normalizarCabecera(original)] = original
  }

  const columnasFaltantes = COLUMNAS_REQUERIDAS.filter((col) => !(col in mapaCabeceras))
  if (columnasFaltantes.length > 0) {
    return { filas: [], errores: [], columnasFaltantes }
  }

  const filas = []
  const errores = []

  filasCrudas.forEach((filaCruda, index) => {
    const numeroFila = index + 2
    const get = (col) => (col in mapaCabeceras ? filaCruda[mapaCabeceras[col]] : null)

    const id = get('id')
    const nombreEmpresa = get('nombre_empresa')

    if (!id || String(id).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta el código (id)' })
      return
    }
    if (!nombreEmpresa || String(nombreEmpresa).trim() === '') {
      errores.push({ fila: numeroFila, motivo: 'Falta el nombre de la empresa' })
      return
    }

    const estadoRaw = get('estado') ? String(get('estado')).trim().toLowerCase() : 'activo'

    filas.push({
      fila: numeroFila,
      id: String(id).trim(),
      nombre_empresa: String(nombreEmpresa).trim(),
      sector: get('sector') ? String(get('sector')).trim() : null,
      region: get('region') ? String(get('region')).trim() : null,
      categoria: get('categoria') ? String(get('categoria')).trim() : null,
      contacto: get('contacto') ? String(get('contacto')).trim() : null,
      email: get('email') ? String(get('email')).trim() : null,
      telefono: get('telefono') ? String(get('telefono')).trim() : null,
      direccion: get('direccion') ? String(get('direccion')).trim() : null,
      url_web: get('url_web') ? String(get('url_web')).trim() : null,
      estado: estadoRaw === 'inactivo' ? 'inactivo' : 'activo',
      fecha_alta: parseFecha(get('fecha_alta')) ?? new Date().toISOString().slice(0, 10),
    })
  })

  return { filas, errores, columnasFaltantes: [] }
}
