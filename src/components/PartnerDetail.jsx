import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TIPOS_CHECK } from '../lib/tiposCheck'

export default function PartnerDetail({ partnerId, onClose, onEditar }) {
  const [partner, setPartner] = useState(null)
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchDetalle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId])

  async function fetchDetalle() {
    setLoading(true)
    setError('')

    const [{ data: partnerData, error: errPartner }, { data: checksData, error: errChecks }] =
      await Promise.all([
        supabase.from('partners').select('*').eq('id', partnerId).single(),
        supabase.from('checks').select('tipo_check, estado, fecha_ok').eq('id_partner', partnerId),
      ])

    if (errPartner) {
      setError('Error al cargar el partner: ' + errPartner.message)
    } else {
      setPartner(partnerData)
    }
    if (!errChecks) setChecks(checksData ?? [])
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-navy/5 bg-white p-6 shadow-[0_20px_60px_-12px_rgba(0,28,52,0.35)] sm:p-8">
        {loading ? (
          <p className="text-gris-azul">Cargando…</p>
        ) : error ? (
          <div className="rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
            {error}
          </div>
        ) : (
          partner && (
            <>
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-navy">{partner.nombre_empresa}</h2>
                  <p className="font-mono text-sm text-gris-azul">{partner.id}</p>
                </div>
                <span className={`shrink-0 ${partner.estado === 'activo' ? 'badge-ok' : 'badge-ko'}`}>
                  {partner.estado === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="mb-6 mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Campo etiqueta="Sector" valor={partner.sector} />
                <Campo etiqueta="Región" valor={partner.region} />
                <Campo etiqueta="Categoría" valor={partner.categoria} />
                <Campo etiqueta="Persona de contacto" valor={partner.contacto} />
                <Campo etiqueta="Email" valor={partner.email} />
                <Campo etiqueta="Teléfono" valor={partner.telefono} />
                <Campo etiqueta="Fecha de alta" valor={partner.fecha_alta} />
                <Campo etiqueta="Dirección" valor={partner.direccion} className="sm:col-span-2" />
                <Campo
                  etiqueta="URL web"
                  valor={
                    partner.url_web ? (
                      <a
                        href={partner.url_web}
                        target="_blank"
                        rel="noreferrer"
                        className="text-azul hover:underline"
                      >
                        {partner.url_web}
                      </a>
                    ) : null
                  }
                  className="sm:col-span-2"
                />
              </div>

              <h3 className="mb-2 text-sm font-bold text-navy">Checks de onboarding</h3>
              <div className="mb-6 flex flex-wrap gap-2">
                {TIPOS_CHECK.map((t) => {
                  const check = checks.find((c) => c.tipo_check === t.key)
                  const estado = check?.estado ?? 'KO'
                  return (
                    <span
                      key={t.key}
                      title={estado === 'OK' && check?.fecha_ok ? `OK desde ${check.fecha_ok}` : 'Pendiente'}
                      className={estado === 'OK' ? 'badge-ok' : 'badge-ko'}
                    >
                      {t.label}: {estado}
                    </span>
                  )
                })}
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={onClose} className="btn-secondary">
                  Cerrar
                </button>
                <button onClick={() => onEditar(partner)} className="btn-primary">
                  Editar
                </button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

function Campo({ etiqueta, valor, className = '' }) {
  return (
    <div className={className}>
      <span className="block text-xs font-medium uppercase tracking-wide text-gris-azul">
        {etiqueta}
      </span>
      <span className="text-navy">{valor || '—'}</span>
    </div>
  )
}
