import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import CargaExcel from '../components/CargaExcel'

function formatEuros(valor) {
  return Number(valor).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
}

export default function Comisiones() {
  const [periodos, setPeriodos] = useState([])
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState('')
  const [comisiones, setComisiones] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPeriodos()
  }, [])

  useEffect(() => {
    if (periodoSeleccionado) fetchComisiones(periodoSeleccionado)
  }, [periodoSeleccionado])

  async function fetchPeriodos() {
    const { data, error: err } = await supabase
      .from('cargas')
      .select('periodo')
      .order('periodo', { ascending: false })

    if (err) {
      setError('Error al cargar periodos: ' + err.message)
      return
    }
    const unicos = [...new Set(data.map((d) => d.periodo))]
    setPeriodos(unicos)
    if (unicos.length > 0) setPeriodoSeleccionado(unicos[0])
  }

  async function fetchComisiones(periodo) {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('comisiones')
      .select('*, partners(nombre_empresa)')
      .eq('periodo', periodo)
      .order('total_comision', { ascending: false })

    if (err) {
      setError('Error al cargar comisiones: ' + err.message)
      setComisiones([])
    } else {
      setComisiones(data)
    }
    setLoading(false)
  }

  function handleCargaCompleta(periodo) {
    fetchPeriodos()
    setPeriodoSeleccionado(periodo)
  }

  const totalPeriodo = comisiones.reduce((acc, c) => acc + Number(c.total_comision), 0)
  const totalContratos = comisiones.reduce((acc, c) => acc + Number(c.n_contratos), 0)
  const totalAltaPotencia = comisiones.reduce((acc, c) => acc + Number(c.n_alta_potencia ?? 0), 0)

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-navy">
        Cálculo de comisiones mensuales
      </h2>

      <div className="mb-6">
        <CargaExcel onCargaCompleta={handleCargaCompleta} />
      </div>

      {comisiones.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <StatTile etiqueta="Partners con comisión" valor={comisiones.length} />
          <StatTile etiqueta="Contratos del periodo" valor={totalContratos} />
          <StatTile etiqueta="Contratos alta potencia (>20,7 kVA)" valor={totalAltaPotencia} />
          <StatTile etiqueta="Total comisiones" valor={formatEuros(totalPeriodo)} acento />
        </div>
      )}

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight text-navy">Comisiones calculadas</h3>
          <select
            value={periodoSeleccionado}
            onChange={(e) => setPeriodoSeleccionado(e.target.value)}
            className="input max-w-[160px]"
          >
            {periodos.length === 0 && <option value="">Sin periodos cargados</option>}
            {periodos.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1700px] text-left text-sm">
            <thead>
              <tr>
                <th className="th-navy rounded-tl-xl" rowSpan={2}>
                  Partner
                </th>
                <th className="th-navy text-right" rowSpan={2}>
                  Contratos
                </th>
                <th
                  className="th-navy border-l-2 border-naranja !bg-naranja/25 text-center"
                  colSpan={8}
                >
                  Electricidad
                </th>
                <th className="th-navy border-l-2 border-azul !bg-azul/25 text-center" colSpan={5}>
                  Gas
                </th>
                <th className="th-navy rounded-tr-xl text-right" rowSpan={2}>
                  Total comisión
                </th>
              </tr>
              <tr>
                <th className="th-navy border-l-2 border-naranja text-right">N ≤20,7 kVA</th>
                <th className="th-navy text-right">N &gt;20,7 kVA</th>
                <th className="th-navy text-right">Base</th>
                <th className="th-navy text-right">DD</th>
                <th className="th-navy text-right">FE</th>
                <th className="th-navy text-right">N SVA</th>
                <th className="th-navy text-right">€ SVA</th>
                <th className="th-navy text-right">Total luz</th>
                <th className="th-navy border-l-2 border-azul text-right">N</th>
                <th className="th-navy text-right">Base</th>
                <th className="th-navy text-right">DD</th>
                <th className="th-navy text-right">FE</th>
                <th className="th-navy text-right">Total gas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={16} className="px-3 py-6 text-center text-gris-azul">
                    Cargando…
                  </td>
                </tr>
              ) : comisiones.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-3 py-6 text-center text-gris-azul">
                    No hay comisiones calculadas para este periodo.
                  </td>
                </tr>
              ) : (
                comisiones.map((c) => (
                  <tr key={c.id} className="border-b border-gris-azul/10 hover:bg-peach/50">
                    <td className="px-3 py-2 font-medium">
                      {c.partners?.nombre_empresa ?? c.id_partner}
                    </td>
                    <td className="px-3 py-2 text-right">{c.n_contratos}</td>

                    <td className="border-l-2 border-naranja/30 px-3 py-2 text-right">
                      {c.n_contratos_luz - (c.n_alta_potencia ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.n_alta_potencia > 0 ? (
                        <span className="font-semibold text-naranja">{c.n_alta_potencia}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{formatEuros(c.base_luz)}</td>
                    <td className="px-3 py-2 text-right">{c.n_dd_luz}</td>
                    <td className="px-3 py-2 text-right">{c.n_fe_luz}</td>
                    <td className="px-3 py-2 text-right">{c.n_sva_luz}</td>
                    <td className="px-3 py-2 text-right">{formatEuros(c.total_bonus_sva_luz)}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEuros(c.total_comision_luz)}
                    </td>

                    <td className="border-l-2 border-azul/30 px-3 py-2 text-right">
                      {c.n_contratos_gas}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {c.n_contratos_gas > 0 ? formatEuros(c.base_gas) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">{c.n_dd_gas}</td>
                    <td className="px-3 py-2 text-right">{c.n_fe_gas}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEuros(c.total_comision_gas)}
                    </td>

                    <td className="px-3 py-2 text-right font-semibold">
                      {formatEuros(c.total_comision)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {comisiones.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-navy font-semibold">
                  <td className="px-3 py-2">Total periodo</td>
                  <td className="px-3 py-2 text-right">{totalContratos}</td>
                  <td className="px-3 py-2" colSpan={13}></td>
                  <td className="px-3 py-2 text-right">{formatEuros(totalPeriodo)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}

function StatTile({ etiqueta, valor, acento = false }) {
  return (
    <div className="card-tight">
      <p className="text-xs font-medium uppercase tracking-wide text-gris-azul">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${acento ? 'text-naranja' : 'text-navy'}`}>
        {valor}
      </p>
    </div>
  )
}
