import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabaseClient'

const COLORES_SERIE = ['#FF590D', '#0080FF', '#00BED3', '#F04170', '#FFAA00', '#7997AF']
const MAX_PARTNERS_GRAFICO = 6

function formatEuros(valor) {
  return Number(valor).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function Seguimiento() {
  const [comisionesRango, setComisionesRango] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [mesDesde, setMesDesde] = useState('')
  const [mesHasta, setMesHasta] = useState('')

  const [busquedaPartner, setBusquedaPartner] = useState('')
  const [busquedaDebounced, setBusquedaDebounced] = useState('')
  const [opcionesPartner, setOpcionesPartner] = useState([])
  const [partnerSeleccionado, setPartnerSeleccionado] = useState(null)

  const [sortField, setSortField] = useState('n_ventas')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetchRangoDisponible()
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busquedaPartner.trim()), 300)
    return () => clearTimeout(t)
  }, [busquedaPartner])

  useEffect(() => {
    if (busquedaDebounced.length < 2) {
      setOpcionesPartner([])
      return
    }
    buscarPartners(busquedaDebounced)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaDebounced])

  useEffect(() => {
    if (mesDesde && mesHasta) fetchComisionesRango()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesDesde, mesHasta, partnerSeleccionado])

  async function fetchRangoDisponible() {
    const { data, error: err } = await supabase.from('cargas').select('periodo').order('periodo')
    if (err) {
      setError('Error al cargar los periodos disponibles: ' + err.message)
      setLoading(false)
      return
    }
    const unicos = [...new Set(data.map((d) => d.periodo))].sort()
    if (unicos.length > 0) {
      setMesDesde(unicos[0])
      setMesHasta(unicos[unicos.length - 1])
    } else {
      setLoading(false)
    }
  }

  async function buscarPartners(texto) {
    const { data } = await supabase
      .from('partners')
      .select('id, nombre_empresa')
      .or(`nombre_empresa.ilike.%${texto}%,id.ilike.%${texto}%`)
      .limit(10)
    setOpcionesPartner(data ?? [])
  }

  async function fetchComisionesRango() {
    setLoading(true)
    setError('')

    let query = supabase
      .from('comisiones')
      .select('id_partner, periodo, n_contratos, total_comision, partners(nombre_empresa)')
      .gte('periodo', mesDesde)
      .lte('periodo', mesHasta)

    if (partnerSeleccionado) query = query.eq('id_partner', partnerSeleccionado.id)

    const { data, error: err } = await query
    if (err) {
      setError('Error al cargar el seguimiento: ' + err.message)
      setComisionesRango([])
    } else {
      setComisionesRango(data)
    }
    setLoading(false)
  }

  const datosPorPeriodo = useMemo(() => {
    const mapa = new Map()
    for (const c of comisionesRango) {
      const actual = mapa.get(c.periodo) ?? { periodo: c.periodo, nVentas: 0, importe: 0 }
      actual.nVentas += c.n_contratos
      actual.importe += Number(c.total_comision)
      mapa.set(c.periodo, actual)
    }
    return [...mapa.values()].sort((a, b) => a.periodo.localeCompare(b.periodo))
  }, [comisionesRango])

  const { datosPorPartner, nombresPartnersGrafico } = useMemo(() => {
    const totalesPorPartner = new Map()
    for (const c of comisionesRango) {
      const nombre = c.partners?.nombre_empresa ?? c.id_partner
      const actual = totalesPorPartner.get(c.id_partner) ?? { nombre, total: 0 }
      actual.total += c.n_contratos
      totalesPorPartner.set(c.id_partner, actual)
    }
    const topPartners = [...totalesPorPartner.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, MAX_PARTNERS_GRAFICO)
    const idsTop = new Set(topPartners.map(([id]) => id))
    const nombrePorId = new Map(topPartners.map(([id, v]) => [id, v.nombre]))

    const periodos = datosPorPeriodo.map((d) => d.periodo)
    const porPeriodo = new Map(periodos.map((p) => [p, { periodo: p }]))
    for (const c of comisionesRango) {
      if (!idsTop.has(c.id_partner)) continue
      const fila = porPeriodo.get(c.periodo)
      if (fila) fila[nombrePorId.get(c.id_partner)] = c.n_contratos
    }

    return {
      datosPorPartner: periodos.map((p) => porPeriodo.get(p)),
      nombresPartnersGrafico: [...nombrePorId.values()],
    }
  }, [comisionesRango, datosPorPeriodo])

  const filasOrdenadas = useMemo(() => {
    const arr = [...comisionesRango]
    arr.sort((a, b) => {
      const cmp =
        sortField === 'n_ventas'
          ? a.n_contratos - b.n_contratos
          : a.periodo.localeCompare(b.periodo)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [comisionesRango, sortField, sortDir])

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  function flechaOrden(field) {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  const rangoInvalido = mesDesde && mesHasta && mesDesde > mesHasta

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-navy">Seguimiento de ventas</h2>

      <div className="card-tight mb-6 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="field-label">Desde</span>
          <input
            type="month"
            value={mesDesde}
            onChange={(e) => setMesDesde(e.target.value)}
            className="input max-w-[170px]"
          />
        </label>
        <label className="block text-sm">
          <span className="field-label">Hasta</span>
          <input
            type="month"
            value={mesHasta}
            onChange={(e) => setMesHasta(e.target.value)}
            className="input max-w-[170px]"
          />
        </label>

        <div className="relative">
          <label className="block text-sm">
            <span className="field-label">Partner</span>
            <input
              type="text"
              value={busquedaPartner}
              onChange={(e) => {
                setBusquedaPartner(e.target.value)
                setPartnerSeleccionado(null)
              }}
              placeholder="Todos los partners…"
              className="input max-w-[220px]"
            />
          </label>
          {opcionesPartner.length > 0 && !partnerSeleccionado && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full min-w-[220px] overflow-y-auto rounded-xl border border-navy/10 bg-white shadow-lg">
              {opcionesPartner.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPartnerSeleccionado(p)
                      setBusquedaPartner(p.nombre_empresa)
                      setOpcionesPartner([])
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-peach"
                  >
                    {p.nombre_empresa} <span className="text-gris-azul">({p.id})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(partnerSeleccionado || busquedaPartner) && (
          <button
            onClick={() => {
              setPartnerSeleccionado(null)
              setBusquedaPartner('')
            }}
            className="btn-ghost"
          >
            Quitar filtro de partner
          </button>
        )}
      </div>

      {rangoInvalido && (
        <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
          El mes "Desde" no puede ser posterior al mes "Hasta".
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-4 text-lg font-bold tracking-tight text-navy">Nº de ventas por periodo</h3>
          {loading ? (
            <p className="text-gris-azul">Cargando…</p>
          ) : datosPorPeriodo.length === 0 ? (
            <p className="text-gris-azul">No hay datos para el rango seleccionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosPorPeriodo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#7997AF33" vertical={false} />
                <XAxis dataKey="periodo" stroke="#001C34" fontSize={12} />
                <YAxis stroke="#001C34" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="nVentas" name="Nº ventas" fill="#FF590D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h3 className="mb-4 text-lg font-bold tracking-tight text-navy">Importe de comisiones por periodo</h3>
          {loading ? (
            <p className="text-gris-azul">Cargando…</p>
          ) : datosPorPeriodo.length === 0 ? (
            <p className="text-gris-azul">No hay datos para el rango seleccionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={datosPorPeriodo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#7997AF33" vertical={false} />
                <XAxis dataKey="periodo" stroke="#001C34" fontSize={12} />
                <YAxis stroke="#001C34" fontSize={12} tickFormatter={(v) => formatEuros(v)} width={90} />
                <Tooltip formatter={(value) => formatEuros(value)} />
                <Bar dataKey="importe" name="Importe comisiones" fill="#0080FF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <h3 className="mb-1 text-lg font-bold tracking-tight text-navy">Nº de ventas por periodo y partner</h3>
        {!partnerSeleccionado && nombresPartnersGrafico.length > 0 && (
          <p className="mb-3 text-xs text-gris-azul">
            Se muestran los {nombresPartnersGrafico.length} partners con más ventas en el rango
            seleccionado.
          </p>
        )}
        {loading ? (
          <p className="text-gris-azul">Cargando…</p>
        ) : datosPorPartner.length === 0 || nombresPartnersGrafico.length === 0 ? (
          <p className="text-gris-azul">No hay datos para el rango seleccionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={datosPorPartner}>
              <CartesianGrid strokeDasharray="3 3" stroke="#7997AF33" vertical={false} />
              <XAxis dataKey="periodo" stroke="#001C34" fontSize={12} />
              <YAxis stroke="#001C34" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {nombresPartnersGrafico.map((nombre, i) => (
                <Bar
                  key={nombre}
                  dataKey={nombre}
                  fill={COLORES_SERIE[i % COLORES_SERIE.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="card">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-navy">Detalle por partner y periodo</h3>

          <div className="flex items-end gap-2">
            <label className="block text-sm">
              <span className="field-label">Ordenar por</span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value)}
                className="input max-w-[160px]"
              >
                <option value="n_ventas">Nº ventas</option>
                <option value="periodo">Periodo</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
              className="btn-secondary px-3 py-2"
            >
              {sortDir === 'asc' ? '▲ Asc' : '▼ Desc'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead>
              <tr>
                <th className="th-navy rounded-tl-xl">Partner</th>
                <th className="th-navy cursor-pointer select-none hover:bg-navy/90" onClick={() => toggleSort('periodo')}>
                  Periodo{flechaOrden('periodo')}
                </th>
                <th
                  className="th-navy cursor-pointer select-none text-right hover:bg-navy/90"
                  onClick={() => toggleSort('n_ventas')}
                >
                  Nº ventas{flechaOrden('n_ventas')}
                </th>
                <th className="th-navy rounded-tr-xl text-right">Importe comisiones</th>
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gris-azul">
                    No hay datos para el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                filasOrdenadas.map((d) => (
                  <tr
                    key={`${d.id_partner}-${d.periodo}`}
                    className="border-b border-gris-azul/10 hover:bg-peach/50"
                  >
                    <td className="px-3 py-2 font-medium">
                      {d.partners?.nombre_empresa ?? d.id_partner}
                    </td>
                    <td className="px-3 py-2">{d.periodo}</td>
                    <td className="px-3 py-2 text-right">{d.n_contratos}</td>
                    <td className="px-3 py-2 text-right">{formatEuros(d.total_comision)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
