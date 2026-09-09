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

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-navy">Cálculo de comisiones mensuales</h2>

      <div className="mb-6">
        <CargaExcel onCargaCompleta={handleCargaCompleta} />
      </div>

      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-navy">Comisiones calculadas</h3>
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
          <div className="mb-4 rounded border border-rojo bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gris-azul/30 bg-navy text-white">
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2 text-right">Contratos</th>
                <th className="px-3 py-2 text-right">Escalón</th>
                <th className="px-3 py-2 text-right">Base</th>
                <th className="px-3 py-2 text-right">DD</th>
                <th className="px-3 py-2 text-right">FE</th>
                <th className="px-3 py-2 text-right">% SVA</th>
                <th className="px-3 py-2 text-right">Tarifa SVA</th>
                <th className="px-3 py-2 text-right">Total base</th>
                <th className="px-3 py-2 text-right">Total bonus</th>
                <th className="px-3 py-2 text-right">Total comisión</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-gris-azul">
                    Cargando…
                  </td>
                </tr>
              ) : comisiones.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-gris-azul">
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
                    <td className="px-3 py-2 text-right">{c.escalon_aplicado}</td>
                    <td className="px-3 py-2 text-right">{formatEuros(c.base_aplicada)}</td>
                    <td className="px-3 py-2 text-right">{c.n_dd}</td>
                    <td className="px-3 py-2 text-right">{c.n_fe}</td>
                    <td className="px-3 py-2 text-right">{Number(c.pct_sva).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{formatEuros(c.tarifa_sva_aplicada)}</td>
                    <td className="px-3 py-2 text-right">{formatEuros(c.total_base)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatEuros(
                        Number(c.total_bonus_dd) + Number(c.total_bonus_fe) + Number(c.total_bonus_sva)
                      )}
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
                  <td className="px-3 py-2" colSpan={8}></td>
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
