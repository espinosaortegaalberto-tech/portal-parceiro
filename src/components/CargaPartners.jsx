import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { descargarPlantillaPartners, normalizarNombre, parsePartnersExcelFile } from '../lib/parsePartnersExcel'

function chunk(array, size) {
  const result = []
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size))
  }
  return result
}

const ESTADOS = {
  IDLE: 'idle',
  PROCESANDO: 'procesando',
  PREVIEW: 'preview',
  CARGANDO: 'cargando',
  RESUMEN: 'resumen',
}

export default function CargaPartners({ onClose, onCargaCompleta }) {
  const inputRef = useRef(null)
  const [estado, setEstado] = useState(ESTADOS.IDLE)
  const [pendiente, setPendiente] = useState(null)
  const [resumen, setResumen] = useState(null)
  const [error, setError] = useState('')

  function reset() {
    setEstado(ESTADOS.IDLE)
    setPendiente(null)
    setResumen(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setEstado(ESTADOS.PROCESANDO)

    try {
      const { filas, errores, columnasFaltantes } = await parsePartnersExcelFile(file)

      if (columnasFaltantes.length > 0) {
        setError('Faltan columnas obligatorias en el Excel: ' + columnasFaltantes.join(', '))
        setEstado(ESTADOS.IDLE)
        return
      }

      const { data: existentes, error: errExistentes } = await supabase
        .from('partners')
        .select('id, nombre_empresa')

      if (errExistentes) {
        setError('Error al comprobar partners existentes: ' + errExistentes.message)
        setEstado(ESTADOS.IDLE)
        return
      }

      const idsExistentes = new Set(existentes.map((p) => p.id))
      const nombresExistentes = new Set(existentes.map((p) => normalizarNombre(p.nombre_empresa)))
      const nombresVistosEnArchivo = new Set()

      const filasValidas = []
      const duplicados = []

      for (const fila of filas) {
        if (idsExistentes.has(fila.id)) {
          duplicados.push({ fila: fila.fila, motivo: `El código "${fila.id}" ya existe` })
          continue
        }

        const nombreNormalizado = normalizarNombre(fila.nombre_empresa)
        if (nombresExistentes.has(nombreNormalizado)) {
          duplicados.push({
            fila: fila.fila,
            motivo: `Ya existe un partner con el nombre "${fila.nombre_empresa}"`,
          })
          continue
        }
        if (nombresVistosEnArchivo.has(nombreNormalizado)) {
          duplicados.push({
            fila: fila.fila,
            motivo: `El nombre "${fila.nombre_empresa}" está repetido dentro del propio archivo`,
          })
          continue
        }

        nombresVistosEnArchivo.add(nombreNormalizado)
        filasValidas.push(fila)
      }

      setPendiente({ file, filasValidas, erroresValidacion: errores, duplicados })
      setEstado(ESTADOS.PREVIEW)
    } catch (err) {
      setError('Error al leer el Excel: ' + err.message)
      setEstado(ESTADOS.IDLE)
    }
  }

  async function confirmarCarga() {
    setEstado(ESTADOS.CARGANDO)
    setError('')

    try {
      const payload = pendiente.filasValidas.map((f) => ({
        id: f.id,
        nombre_empresa: f.nombre_empresa,
        direccion: f.direccion,
        email: f.email,
        telefono: f.telefono,
        contacto: f.contacto,
        sector: f.sector,
        region: f.region,
        url_web: f.url_web,
        estado: f.estado,
        categoria: f.categoria,
        fecha_alta: f.fecha_alta,
      }))

      for (const lote of chunk(payload, 500)) {
        const { error: errInsert } = await supabase.from('partners').insert(lote)
        if (errInsert) throw new Error('Error al crear los partners: ' + errInsert.message)
      }

      setResumen({
        nCreados: payload.length,
        nDuplicados: pendiente.duplicados.length,
        nErrores: pendiente.erroresValidacion.length,
        duplicados: pendiente.duplicados,
        erroresValidacion: pendiente.erroresValidacion,
      })
      setEstado(ESTADOS.RESUMEN)
      onCargaCompleta?.()
    } catch (err) {
      setError(err.message)
      setEstado(ESTADOS.PREVIEW)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-navy/5 bg-white p-6 shadow-[0_20px_60px_-12px_rgba(0,28,52,0.35)] sm:p-8">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-xl font-bold tracking-tight text-navy">Cargar partners desde Excel</h2>
          <button onClick={onClose} className="text-gris-azul hover:text-navy">
            ✕
          </button>
        </div>

        <button type="button" onClick={descargarPlantillaPartners} className="btn-secondary mb-4">
          Descargar plantilla
        </button>

        {error && (
          <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
            {error}
          </div>
        )}

        {estado === ESTADOS.RESUMEN && resumen ? (
          <div className="rounded-xl border border-cian/25 bg-cian/10 p-4 text-sm text-navy">
            <p className="font-semibold">Carga completada.</p>
            <ul className="mt-2 list-disc pl-5">
              <li>{resumen.nCreados} partners creados</li>
              <li>{resumen.nDuplicados} duplicados omitidos (por código o nombre)</li>
              <li>{resumen.nErrores} filas con errores (descartadas)</li>
            </ul>
            {resumen.duplicados.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-azul">Ver duplicados omitidos</summary>
                <ul className="mt-1 max-h-40 overflow-y-auto pl-5 text-xs">
                  {resumen.duplicados.map((d, i) => (
                    <li key={i}>
                      Fila {d.fila}: {d.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {resumen.erroresValidacion.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-azul">Ver errores</summary>
                <ul className="mt-1 max-h-40 overflow-y-auto pl-5 text-xs">
                  {resumen.erroresValidacion.map((e, i) => (
                    <li key={i}>
                      Fila {e.fila}: {e.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={reset} className="btn-secondary">
                Cargar otro fichero
              </button>
              <button onClick={onClose} className="btn-primary">
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              disabled={estado === ESTADOS.PROCESANDO || estado === ESTADOS.CARGANDO}
              className="block text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-naranja file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:opacity-90"
            />

            {estado === ESTADOS.PROCESANDO && (
              <p className="mt-3 text-sm text-gris-azul">Procesando…</p>
            )}

            {pendiente && (estado === ESTADOS.PREVIEW || estado === ESTADOS.CARGANDO) && (
              <div className="mt-4 space-y-3 rounded-xl border border-navy/10 bg-peach/30 p-4 text-sm text-navy">
                <p>
                  <strong>{pendiente.file.name}</strong>: {pendiente.filasValidas.length} partners
                  listos para crear, {pendiente.duplicados.length} duplicados,{' '}
                  {pendiente.erroresValidacion.length} con errores.
                </p>

                {pendiente.duplicados.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-azul">
                      Ver duplicados detectados ({pendiente.duplicados.length})
                    </summary>
                    <ul className="mt-1 max-h-40 overflow-y-auto pl-5 text-xs">
                      {pendiente.duplicados.map((d, i) => (
                        <li key={i}>
                          Fila {d.fila}: {d.motivo}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {pendiente.erroresValidacion.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-azul">
                      Ver errores ({pendiente.erroresValidacion.length})
                    </summary>
                    <ul className="mt-1 max-h-40 overflow-y-auto pl-5 text-xs">
                      {pendiente.erroresValidacion.map((e, i) => (
                        <li key={i}>
                          Fila {e.fila}: {e.motivo}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={confirmarCarga}
                    disabled={estado === ESTADOS.CARGANDO || pendiente.filasValidas.length === 0}
                    className="btn-primary"
                  >
                    {estado === ESTADOS.CARGANDO
                      ? 'Cargando…'
                      : `Confirmar carga de ${pendiente.filasValidas.length} partners`}
                  </button>
                  <button onClick={reset} disabled={estado === ESTADOS.CARGANDO} className="btn-secondary">
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
