import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const campos = [
  { key: 'base_escalon_1', label: 'Base escalón 1 (€/contrato)', hint: 'Hasta el umbral 1' },
  { key: 'base_escalon_2', label: 'Base escalón 2 (€/contrato)', hint: 'Entre umbral 1 y umbral 2' },
  { key: 'base_escalon_3', label: 'Base escalón 3 (€/contrato)', hint: 'Por encima del umbral 2' },
  { key: 'umbral_escalon_1', label: 'Umbral escalón 1 (nº contratos)' },
  { key: 'umbral_escalon_2', label: 'Umbral escalón 2 (nº contratos)' },
  { key: 'bonus_dd', label: 'Bonus débito directo (€/contrato)' },
  { key: 'bonus_fe', label: 'Bonus factura electrónica (€/contrato)' },
  { key: 'sva_tarifa_baja', label: 'Tarifa SVA baja (€/contrato)' },
  { key: 'sva_tarifa_alta', label: 'Tarifa SVA alta (€/contrato)' },
  { key: 'sva_umbral_pct', label: 'Umbral % SVA para tarifa alta' },
]

export default function Configuracion() {
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchConfig()
  }, [])

  async function fetchConfig() {
    setLoading(true)
    setError('')
    const { data, error: err } = await supabase
      .from('configuracion_comisiones')
      .select('*')
      .eq('vigente', true)
      .maybeSingle()

    if (err) {
      setError('Error al cargar la configuración: ' + err.message)
    } else {
      setConfig(data)
      setForm(data)
    }
    setLoading(false)
  }

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')

    const { error: err } = await supabase.rpc('versionar_configuracion_comisiones', {
      p_base_escalon_1: Number(form.base_escalon_1),
      p_base_escalon_2: Number(form.base_escalon_2),
      p_base_escalon_3: Number(form.base_escalon_3),
      p_umbral_escalon_1: Number(form.umbral_escalon_1),
      p_umbral_escalon_2: Number(form.umbral_escalon_2),
      p_bonus_dd: Number(form.bonus_dd),
      p_bonus_fe: Number(form.bonus_fe),
      p_sva_tarifa_baja: Number(form.sva_tarifa_baja),
      p_sva_tarifa_alta: Number(form.sva_tarifa_alta),
      p_sva_umbral_pct: Number(form.sva_umbral_pct),
    })

    setSaving(false)

    if (err) {
      setError('Error al guardar: ' + err.message)
      return
    }

    setSuccess('Configuración guardada. Solo afecta a los cálculos de comisiones futuros.')
    fetchConfig()
  }

  if (loading) {
    return <p className="text-gris-azul">Cargando configuración…</p>
  }

  if (!form) {
    return (
      <div className="rounded border border-rojo bg-rojo/10 px-3 py-2 text-sm text-rojo">
        No se ha encontrado ninguna configuración vigente. Revisa que el esquema SQL se haya ejecutado
        correctamente.
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h2 className="mb-2 text-2xl font-bold text-navy">Configuración de parámetros de comisión</h2>
      <p className="mb-6 text-sm text-gris-azul">
        Vigente desde <strong>{config.vigente_desde}</strong>. Al guardar se crea una nueva versión
        vigente; los cálculos de comisiones ya realizados conservan su propio snapshot y no se ven
        afectados.
      </p>

      {error && (
        <div className="mb-4 rounded border border-rojo bg-rojo/10 px-3 py-2 text-sm text-rojo">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded border border-cian bg-cian/10 px-3 py-2 text-sm text-navy">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-lg bg-white p-6 shadow-sm sm:grid-cols-2">
        {campos.map((campo) => (
          <label key={campo.key} className="block text-sm">
            <span className="mb-1 block font-medium text-navy">{campo.label}</span>
            <input
              type="number"
              step="0.01"
              value={form[campo.key]}
              onChange={(e) => handleChange(campo.key, e.target.value)}
              className="input"
            />
            {campo.hint && <span className="mt-1 block text-xs text-gris-azul">{campo.hint}</span>}
          </label>
        ))}

        <div className="col-span-full mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-naranja px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar nueva versión'}
          </button>
        </div>
      </form>
    </div>
  )
}
