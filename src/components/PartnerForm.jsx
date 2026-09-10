import { useState } from 'react'

const emptyPartner = {
  id: '',
  nombre_empresa: '',
  direccion: '',
  email: '',
  telefono: '',
  contacto: '',
  sector: '',
  region: '',
  url_web: '',
  estado: 'activo',
  categoria: '',
  fecha_alta: new Date().toISOString().slice(0, 10),
}

export default function PartnerForm({ partner, onSave, onCancel, saving }) {
  const isEdit = Boolean(partner)
  const [form, setForm] = useState(partner ? { ...emptyPartner, ...partner } : emptyPartner)
  const [error, setError] = useState('')

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.id.trim()) {
      setError('El código de partner (id) es obligatorio.')
      return
    }
    if (!form.nombre_empresa.trim()) {
      setError('El nombre de la empresa es obligatorio.')
      return
    }
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-navy/5 bg-white p-6 shadow-[0_20px_60px_-12px_rgba(0,28,52,0.35)] sm:p-8">
        <h2 className="mb-5 text-xl font-bold tracking-tight text-navy">
          {isEdit ? 'Editar partner' : 'Nuevo partner'}
        </h2>

        {error && (
          <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código de partner (id)" required>
            <input
              type="text"
              value={form.id}
              disabled={isEdit}
              onChange={(e) => handleChange('id', e.target.value)}
              className="input"
              placeholder="p.ej. P-0001"
            />
          </Field>

          <Field label="Nombre de la empresa" required>
            <input
              type="text"
              value={form.nombre_empresa}
              onChange={(e) => handleChange('nombre_empresa', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Dirección">
            <input
              type="text"
              value={form.direccion || ''}
              onChange={(e) => handleChange('direccion', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Teléfono">
            <input
              type="text"
              value={form.telefono || ''}
              onChange={(e) => handleChange('telefono', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Persona de contacto">
            <input
              type="text"
              value={form.contacto || ''}
              onChange={(e) => handleChange('contacto', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Sector">
            <input
              type="text"
              value={form.sector || ''}
              onChange={(e) => handleChange('sector', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Región">
            <input
              type="text"
              value={form.region || ''}
              onChange={(e) => handleChange('region', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Categoría">
            <input
              type="text"
              value={form.categoria || ''}
              onChange={(e) => handleChange('categoria', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="URL web">
            <input
              type="text"
              value={form.url_web || ''}
              onChange={(e) => handleChange('url_web', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Fecha de alta">
            <input
              type="date"
              value={form.fecha_alta || ''}
              onChange={(e) => handleChange('fecha_alta', e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Estado">
            <select
              value={form.estado}
              onChange={(e) => handleChange('estado', e.target.value)}
              className="input"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </Field>

          <div className="col-span-full mt-2 flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block text-sm">
      <span className="field-label">
        {label}
        {required && <span className="text-rojo"> *</span>}
      </span>
      {children}
    </label>
  )
}
