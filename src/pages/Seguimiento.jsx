import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabaseClient'

const COLORES_SERIE = ['#FF590D', '#0080FF', '#00BED3', '#F04170', '#FFAA00', '#7997AF', '#001C34', '#FDEFEA']
const MAX_GRUPOS_GRAFICO = 8

const CAMPOS_AGRUPACION = {
  partner: {
    etiqueta: 'Partner',
    etiquetaPlural: 'partners',
    obtenerClave: (c) => c.partners?.nombre_empresa ?? c.id_partner,
  },
  region: {
    etiqueta: 'Región',
    etiquetaPlural: 'regiones',
    obtenerClave: (c) => c.partners?.region || 'Sin región',
  },
  sector: {
    etiqueta: 'Sector',
    etiquetaPlural: 'sectores',
    obtenerClave: (c) => c.partners?.sector || 'Sin sector',
  },
}

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

  const [regiones, setRegiones] = useState([])
  const [sectores, setSectores] = useState([])
  const [filterRegion, setFilterRegion] = useState('')
  const [filterSector, setFilterSector] = useState('')

  const [agrupacion, setAgrupacion] = useState('partner')

  const [sortField, setSortField] = useState('n_ventas')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetchRangoDisponible()
    fetchFilterOptions()
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
  }, [mesDesde, mesHasta, partnerSeleccionado, filterRegion, filterSector])

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

  async function fetchFilterOptions() {
    const { data, error: err } = await supabase.from('partners').select('region, sector')
    if (err) return
    const regs = new Set()
    const secs = new Set()
    for (const row of data) {
      if (row.region) regs.add(row.region)
      if (row.sector) secs.add(row.sector)
    }
    setRegiones([...regs].sort())
    setSectores([...secs].sort())
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

    let idsPorRegionSector = null
    if (filterRegion || filterSector) {
      let partnersQuery = supabase.from('partners').select('id')
      if (filterRegion) partnersQuery = partnersQuery.eq('region', filterRegion)
      if (filterSector) partnersQuery = partnersQuery.eq('sector', filterSector)

      const { data: partnersFiltrados, error: errFiltro } = await partnersQuery
      if (errFiltro) {
        setError('Error al filtrar por región/sector: ' + errFiltro.message)
        setLoading(false)
        return
      }
      idsPorRegionSector = partnersFiltrados.map((p) => p.id)
      if (idsPorRegionSector.length === 0) {
        setComisionesRango([])
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('comisiones')
      .select('id_partner, periodo, n_contratos, total_comision, partners(nombre_empresa, region, sector)')
      .gte('periodo', mesDesde)
      .lte('periodo', mesHasta)

    if (partnerSeleccionado) query = query.eq('id_partner', partnerSeleccionado.id)
    if (idsPorRegionSector) query = query.in('id_partner', idsPorRegionSector)

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

  const { datosPorGrupo, nombresGrupo } = useMemo(() => {
    const obtenerClave = CAMPOS_AGRUPACION[agrupacion].obtenerClave
    const totalesPorGrupo = new Map()
    for (const c of comisionesRango) {
      const clave = obtenerClave(c)
      totalesPorGrupo.set(clave, (totalesPorGrupo.get(clave) ?? 0) + c.n_contratos)
    }
    const topGrupos = [...totalesPorGrupo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GRUPOS_GRAFICO)
    const clavesTop = new Set(topGrupos.map(([clave]) => clave))

    const periodos = datosPorPeriodo.map((d) => d.periodo)
    const porPeriodo = new Map(periodos.map((p) => [p, { periodo: p }]))
    for (const c of comisionesRango) {
      const clave = obtenerClave(c)
      if (!clavesTop.has(clave)) continue
      const fila = porPeriodo.get(c.periodo)
      if (fila) fila[clave] = (fila[clave] ?? 0) + c.n_contratos
    }

    return {
      datosPorGrupo: periodos.map((p) => porPeriodo.get(p)),
      nombresGrupo: topGrupos.map(([clave]) => clave),
    }
  }, [comisionesRango, datosPorPeriodo, agrupacion])

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
  const infoAgrupacion = CAMPOS_AGRUPACION[agrupacion]

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

        <label className="block text-sm">
          <span className="field-label">Región</span>
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="input max-w-[170px]"
          >
            <option value="">Todas las regiones</option>
            {regiones.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="field-label">Sector</span>
          <select
            value={filterSector}
            onChange={(e) => setFilterSector(e.target.value)}
            className="input max-w-[170px]"
          >
            <option value="">Todos los sectores</option>
            {sectores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {(partnerSeleccionado || busquedaPartner || filterRegion || filterSector) && (
          <button
            onClick={() => {
              setPartnerSeleccionado(null)
              setBusquedaPartner('')
              setFilterRegion('')
              setFilterSector('')
            }}
            className="btn-ghost"
          >
            Quitar filtros
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold tracking-tight text-navy">
            Nº de ventas por periodo y {infoAgrupacion.etiqueta.toLowerCase()}
          </h3>
          <label className="block text-sm">
            <span className="field-label">Comparar por</span>
            <select
              value={agrupacion}
              onChange={(e) => setAgrupacion(e.target.value)}
              className="input max-w-[160px]"
            >
              <option value="partner">Partner</option>
              <option value="region">Región</option>
              <option value="sector">Sector</option>
            </select>
          </label>
        </div>
        {nombresGrupo.length > 0 && (
          <p className="mb-3 text-xs text-gris-azul">
            Se muestran los {nombresGrupo.length} {infoAgrupacion.etiquetaPlural} con más ventas en el
            rango seleccionado.
          </p>
        )}
        {loading ? (
          <p className="text-gris-azul">Cargando…</p>
        ) : datosPorGrupo.length === 0 || nombresGrupo.length === 0 ? (
          <p className="text-gris-azul">No hay datos para el rango seleccionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={datosPorGrupo}>
              <CartesianGrid strokeDasharray="3 3" stroke="#7997AF33" vertical={false} />
              <XAxis dataKey="periodo" stroke="#001C34" fontSize={12} />
              <YAxis stroke="#001C34" fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Legend />
              {nombresGrupo.map((nombre, i) => (
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
