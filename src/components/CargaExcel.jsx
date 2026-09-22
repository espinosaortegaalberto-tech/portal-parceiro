import { useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { parseExcelFile, detectarPeriodo } from '../lib/parseExcel'
import { normalizarNombre } from '../lib/parsePartnersExcel'
import { calcularComisionesPeriodo } from '../lib/calculoComisiones'

// Calcula el siguiente código P-XXXX libre a partir de los partners existentes.
function siguienteNumeroPartner(partnersExistentes) {
  const maximo = partnersExistentes.reduce((max, p) => {
    const match = /^P-(\d+)$/.exec(p.id)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return maximo + 1
}

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
  CONFIRMAR_REEMPLAZO: 'confirmar_reemplazo',
  RESUMEN: 'resumen',
}

export default function CargaExcel({ onCargaCompleta }) {
  const inputRef = useRef(null)
  const [estado, setEstado] = useState(ESTADOS.IDLE)
  const [periodo, setPeriodo] = useState('')
  const [pendiente, setPendiente] = useState(null) // { file, filasValidas, erroresValidacion, excluidosPorEstado, partnersNuevos }
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
    setResumen(null)
    setEstado(ESTADOS.PROCESANDO)

    try {
      const { filas, errores, excluidosPorEstado, columnasFaltantes } = await parseExcelFile(file)

      if (columnasFaltantes.length > 0) {
        setError(
          'Faltan columnas obligatorias en el Excel: ' + columnasFaltantes.join(', ')
        )
        setEstado(ESTADOS.IDLE)
        return
      }

      const { data: partnersExistentes, error: errPartners } = await supabase
        .from('partners')
        .select('id, nombre_empresa')

      if (errPartners) {
        setError('Error al consultar los partners: ' + errPartners.message)
        setEstado(ESTADOS.IDLE)
        return
      }

      const mapaPorNombre = new Map(
        partnersExistentes.map((p) => [normalizarNombre(p.nombre_empresa), p.id])
      )
      let siguienteNumero = siguienteNumeroPartner(partnersExistentes)

      const partnersNuevos = []
      const filasValidas = filas.map((fila) => {
        const clave = normalizarNombre(fila.nombre_partner)
        let idPartner = mapaPorNombre.get(clave)

        if (!idPartner) {
          idPartner = `P-${String(siguienteNumero).padStart(4, '0')}`
          siguienteNumero += 1
          mapaPorNombre.set(clave, idPartner)
          partnersNuevos.push({ id: idPartner, nombre_empresa: fila.nombre_partner })
        }

        return { ...fila, id_partner: idPartner }
      })

      const periodoDetectado = detectarPeriodo(filasValidas) ?? ''
      setPeriodo(periodoDetectado)
      setPendiente({
        file,
        filasValidas,
        erroresValidacion: errores,
        excluidosPorEstado,
        partnersNuevos,
      })
      setEstado(ESTADOS.IDLE)
    } catch (err) {
      setError('Error al leer el Excel: ' + err.message)
      setEstado(ESTADOS.IDLE)
    }
  }

  async function iniciarCarga() {
    if (!periodo.match(/^\d{4}-\d{2}$/)) {
      setError('Indica el periodo en formato YYYY-MM antes de continuar.')
      return
    }
    setError('')

    const { data: cargaExistente, error: errCarga } = await supabase
      .from('cargas')
      .select('id, n_filas, fecha_carga')
      .eq('periodo', periodo)
      .maybeSingle()

    if (errCarga) {
      setError('Error al comprobar cargas existentes: ' + errCarga.message)
      return
    }

    if (cargaExistente) {
      setEstado(ESTADOS.CONFIRMAR_REEMPLAZO)
      setPendiente((prev) => ({ ...prev, cargaExistente }))
      return
    }

    await ejecutarCarga({ reemplazar: false })
  }

  async function ejecutarCarga({ reemplazar }) {
    setEstado(ESTADOS.PROCESANDO)
    setError('')

    try {
      if (reemplazar && pendiente.cargaExistente) {
        const { error: errDelete } = await supabase
          .from('cargas')
          .delete()
          .eq('id', pendiente.cargaExistente.id)
        if (errDelete) throw new Error('Error al reemplazar la carga anterior: ' + errDelete.message)
      }

      if (pendiente.partnersNuevos.length > 0) {
        const { error: errPartnersNuevos } = await supabase
          .from('partners')
          .insert(pendiente.partnersNuevos)
        if (errPartnersNuevos) {
          throw new Error('Error al dar de alta los partners nuevos: ' + errPartnersNuevos.message)
        }
      }

      const { data: userData } = await supabase.auth.getUser()

      const { data: nuevaCarga, error: errInsertCarga } = await supabase
        .from('cargas')
        .insert({
          periodo,
          nombre_fichero: pendiente.file.name,
          n_filas: pendiente.filasValidas.length,
          usuario: userData?.user?.email ?? null,
        })
        .select()
        .single()

      if (errInsertCarga) throw new Error('Error al registrar la carga: ' + errInsertCarga.message)

      const ventasParaInsertar = pendiente.filasValidas.map((f) => ({
        id_partner: f.id_partner,
        carga_id: nuevaCarga.id,
        periodo,
        id_contrato: f.id_contrato,
        fecha_cierre: f.fecha_cierre,
        electricidad: f.electricidad,
        gas: f.gas,
        potencia_kva: f.potencia_kva,
        debito_directo: f.debito_directo,
        factura_electronica: f.factura_electronica,
        sva: f.sva,
      }))

      for (const lote of chunk(ventasParaInsertar, 500)) {
        const { error: errVentas } = await supabase.from('ventas').insert(lote)
        if (errVentas) throw new Error('Error al insertar ventas: ' + errVentas.message)
      }

      const { data: config, error: errConfig } = await supabase
        .from('configuracion_comisiones')
        .select('*')
        .eq('vigente', true)
        .maybeSingle()

      if (errConfig || !config) {
        throw new Error(
          'No se ha podido cargar la configuración de comisiones vigente: ' +
            (errConfig?.message ?? 'no encontrada')
        )
      }

      const comisionesCalculadas = calcularComisionesPeriodo(ventasParaInsertar, config)
      const comisionesParaInsertar = comisionesCalculadas.map((c) => ({
        ...c,
        periodo,
        config_snapshot: config,
      }))

      const { error: errUpsert } = await supabase
        .from('comisiones')
        .upsert(comisionesParaInsertar, { onConflict: 'id_partner,periodo' })

      if (errUpsert) throw new Error('Error al guardar las comisiones calculadas: ' + errUpsert.message)

      setResumen({
        periodo,
        nFilasOk: pendiente.filasValidas.length,
        nErrores: pendiente.erroresValidacion.length,
        erroresValidacion: pendiente.erroresValidacion,
        excluidosPorEstado: pendiente.excluidosPorEstado,
        partnersNuevos: pendiente.partnersNuevos,
        nPartnersAfectados: comisionesCalculadas.length,
      })
      setEstado(ESTADOS.RESUMEN)
      onCargaCompleta?.(periodo)
    } catch (err) {
      setError(err.message)
      setEstado(ESTADOS.IDLE)
    }
  }

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-bold tracking-tight text-navy">Cargar Excel de ventas</h3>

      {error && (
        <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
          {error}
        </div>
      )}

      {estado === ESTADOS.RESUMEN && resumen && (
        <div className="mb-4 rounded-xl border border-cian/25 bg-cian/10 p-4 text-sm text-navy">
          <p className="font-semibold">Carga completada para el periodo {resumen.periodo}.</p>
          <ul className="mt-2 list-disc pl-5">
            <li>{resumen.nFilasOk} filas cargadas correctamente</li>
            <li>{resumen.excluidosPorEstado} filas excluidas por no tener estado OK</li>
            <li>{resumen.nErrores} filas con errores (descartadas)</li>
            <li>{resumen.nPartnersAfectados} partners con comisión calculada</li>
            {resumen.partnersNuevos.length > 0 && (
              <li>{resumen.partnersNuevos.length} partners nuevos dados de alta automáticamente</li>
            )}
          </ul>
          {resumen.partnersNuevos.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-azul">Ver partners nuevos</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto pl-5 text-xs">
                {resumen.partnersNuevos.map((p) => (
                  <li key={p.id}>
                    {p.id}: {p.nombre_empresa}
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
          <button onClick={reset} className="btn-ghost mt-3">
            Cargar otro fichero
          </button>
        </div>
      )}

      {estado !== ESTADOS.RESUMEN && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={estado === ESTADOS.PROCESANDO}
            className="block text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-naranja file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm hover:file:opacity-90"
          />

          {estado === ESTADOS.PROCESANDO && <p className="mt-3 text-sm text-gris-azul">Procesando…</p>}

          {pendiente && estado === ESTADOS.IDLE && (
            <div className="mt-4 space-y-3 rounded-xl border border-navy/10 bg-peach/30 p-4">
              <p className="text-sm text-navy">
                <strong>{pendiente.file.name}</strong>: {pendiente.filasValidas.length} filas válidas,{' '}
                {pendiente.excluidosPorEstado} excluidas por estado no OK,{' '}
                {pendiente.erroresValidacion.length} con errores.
              </p>

              {pendiente.partnersNuevos.length > 0 && (
                <div className="rounded-lg border border-ambar/30 bg-ambar/10 p-3 text-xs text-navy">
                  <p className="font-semibold">
                    Se darán de alta {pendiente.partnersNuevos.length} partners nuevos:
                  </p>
                  <ul className="mt-1 max-h-32 overflow-y-auto pl-4">
                    {pendiente.partnersNuevos.map((p) => (
                      <li key={p.id}>
                        {p.id}: {p.nombre_empresa}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="block text-sm">
                <span className="field-label">Periodo (YYYY-MM)</span>
                <input
                  type="text"
                  value={periodo}
                  onChange={(e) => setPeriodo(e.target.value)}
                  placeholder="2026-01"
                  className="input max-w-[160px]"
                />
              </label>

              <button onClick={iniciarCarga} className="btn-primary">
                Cargar y calcular comisiones
              </button>
            </div>
          )}

          {estado === ESTADOS.CONFIRMAR_REEMPLAZO && pendiente?.cargaExistente && (
            <div className="mt-4 rounded-xl border border-ambar/30 bg-ambar/10 p-4 text-sm text-navy">
              <p>
                Ya existe una carga para el periodo <strong>{periodo}</strong> con{' '}
                {pendiente.cargaExistente.n_filas} filas (cargada el{' '}
                {new Date(pendiente.cargaExistente.fecha_carga).toLocaleString('es-ES')}).
              </p>
              <p className="mt-1">¿Quieres reemplazarla por este nuevo fichero?</p>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={() => ejecutarCarga({ reemplazar: true })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-rojo px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Reemplazar
                </button>
                <button onClick={reset} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
