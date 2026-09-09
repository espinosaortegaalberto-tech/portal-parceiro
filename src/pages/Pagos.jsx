import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PAGE_SIZE = 20

function formatEuros(valor) {
  return Number(valor).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function Pagos() {
  const [pagos, setPagos] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [resumen, setResumen] = useState({ pendiente: 0, pagado: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [periodos, setPeriodos] = useState([])
  const [periodoFiltro, setPeriodoFiltro] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [page, setPage] = useState(0)

  useEffect(() => {
    fetchPeriodos()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim())
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchPagos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoFiltro, estadoFiltro, searchDebounced, page])

  async function fetchPeriodos() {
    const { data, error: err } = await supabase
      .from('cargas')
      .select('periodo')
      .order('periodo', { ascending: false })
    if (err) return
    setPeriodos([...new Set(data.map((d) => d.periodo))])
  }

  async function fetchPagos() {
    setLoading(true)
    setError('')

    let idsFiltrados = null
    if (searchDebounced) {
      const { data: partnersCoincidentes, error: errBusqueda } = await supabase
        .from('partners')
        .select('id')
        .or(`nombre_empresa.ilike.%${searchDebounced}%,id.ilike.%${searchDebounced}%`)

      if (errBusqueda) {
        setError('Error al buscar partners: ' + errBusqueda.message)
        setLoading(false)
        return
      }
      idsFiltrados = partnersCoincidentes.map((p) => p.id)
      if (idsFiltrados.length === 0) {
        setPagos([])
        setTotalCount(0)
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('comisiones')
      .select('id, id_partner, periodo, total_comision, estado_pago, fecha_pago, partners(nombre_empresa)', {
        count: 'exact',
      })

    if (periodoFiltro) query = query.eq('periodo', periodoFiltro)
    if (estadoFiltro) query = query.eq('estado_pago', estadoFiltro)
    if (idsFiltrados) query = query.in('id_partner', idsFiltrados)

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error: err, count } = await query
      .order('periodo', { ascending: false })
      .order('id_partner', { ascending: true })
      .range(from, to)

    if (err) {
      setError('Error al cargar los pagos: ' + err.message)
      setPagos([])
      setTotalCount(0)
    } else {
      setPagos(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)

    fetchResumen()
  }

  async function fetchResumen() {
    let base = supabase.from('comisiones').select('estado_pago, total_comision')
    if (periodoFiltro) base = base.eq('periodo', periodoFiltro)

    const { data, error: err } = await base
    if (err || !data) return

    const acc = { pendiente: 0, pagado: 0 }
    for (const c of data) {
      acc[c.estado_pago] = (acc[c.estado_pago] ?? 0) + Number(c.total_comision)
    }
    setResumen(acc)
  }

  async function marcarPago(pago, nuevoEstado) {
    const nuevaFechaPago = nuevoEstado === 'pagado' ? new Date().toISOString().slice(0, 10) : null

    const { error: err } = await supabase
      .from('comisiones')
      .update({ estado_pago: nuevoEstado, fecha_pago: nuevaFechaPago })
      .eq('id', pago.id)

    if (err) {
      setError('Error al actualizar el pago: ' + err.message)
      return
    }

    setPagos((prev) =>
      prev.map((p) =>
        p.id !== pago.id ? p : { ...p, estado_pago: nuevoEstado, fecha_pago: nuevaFechaPago }
      )
    )
    fetchResumen()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-navy">Pagos de comisiones a partners</h2>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border-l-4 border-rojo bg-white p-4 shadow-sm">
          <p className="text-sm text-gris-azul">Pendiente de pago</p>
          <p className="text-2xl font-bold text-navy">{formatEuros(resumen.pendiente)}</p>
        </div>
        <div className="rounded-lg border-l-4 border-cian bg-white p-4 shadow-sm">
          <p className="text-sm text-gris-azul">Pagado</p>
          <p className="text-2xl font-bold text-navy">{formatEuros(resumen.pagado)}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg bg-white p-4 shadow-sm">
        <input
          type="text"
          placeholder="Buscar por nombre o código de partner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={periodoFiltro}
          onChange={(e) => {
            setPeriodoFiltro(e.target.value)
            setPage(0)
          }}
          className="input max-w-[160px]"
        >
          <option value="">Todos los periodos</option>
          {periodos.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={estadoFiltro}
          onChange={(e) => {
            setEstadoFiltro(e.target.value)
            setPage(0)
          }}
          className="input max-w-[180px]"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente de pago</option>
          <option value="pagado">Pagado</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded border border-rojo bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-gris-azul/30 bg-navy text-white">
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Periodo</th>
              <th className="px-4 py-3 text-right">Importe comisión</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Fecha de pago</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gris-azul">
                  Cargando…
                </td>
              </tr>
            ) : pagos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gris-azul">
                  No se han encontrado comisiones para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              pagos.map((p) => (
                <tr key={p.id} className="border-b border-gris-azul/10 hover:bg-peach/50">
                  <td className="px-4 py-3 font-medium">
                    {p.partners?.nombre_empresa ?? p.id_partner}
                  </td>
                  <td className="px-4 py-3">{p.periodo}</td>
                  <td className="px-4 py-3 text-right">{formatEuros(p.total_comision)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold text-white ${
                        p.estado_pago === 'pagado' ? 'bg-cian' : 'bg-rojo'
                      }`}
                    >
                      {p.estado_pago === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.fecha_pago ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.estado_pago === 'pagado' ? (
                      <button
                        onClick={() => marcarPago(p, 'pendiente')}
                        className="text-gris-azul hover:underline"
                      >
                        Marcar pendiente
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarPago(p, 'pagado')}
                        className="text-azul hover:underline"
                      >
                        Marcar pagado
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-navy">
        <span>
          {totalCount} comisión{totalCount === 1 ? '' : 'es'} en total
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded border border-gris-azul px-3 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages}
            className="rounded border border-gris-azul px-3 py-1 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
