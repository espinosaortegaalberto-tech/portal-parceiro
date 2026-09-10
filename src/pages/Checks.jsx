import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { TIPOS_CHECK } from '../lib/tiposCheck'

const PAGE_SIZE = 20

export default function Checks() {
  const [partners, setPartners] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [page, setPage] = useState(0)

  const [filaEditando, setFilaEditando] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim())
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setFilaEditando(null)
    fetchPartnersConChecks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, filterTipo, filterEstado, page])

  async function fetchPartnersConChecks() {
    setLoading(true)
    setError('')

    let idsFiltrados = null
    if (filterTipo && filterEstado) {
      const { data: checksFiltrados, error: errChecks } = await supabase
        .from('checks')
        .select('id_partner')
        .eq('tipo_check', filterTipo)
        .eq('estado', filterEstado)

      if (errChecks) {
        setError('Error al filtrar por check: ' + errChecks.message)
        setLoading(false)
        return
      }
      idsFiltrados = checksFiltrados.map((c) => c.id_partner)
      if (idsFiltrados.length === 0) {
        setPartners([])
        setTotalCount(0)
        setLoading(false)
        return
      }
    }

    let query = supabase
      .from('partners')
      .select('id, nombre_empresa, checks(tipo_check, estado, fecha_ok)', { count: 'exact' })

    if (searchDebounced) {
      query = query.or(`nombre_empresa.ilike.%${searchDebounced}%,id.ilike.%${searchDebounced}%`)
    }
    if (idsFiltrados) {
      query = query.in('id', idsFiltrados)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, error: err, count } = await query
      .order('nombre_empresa', { ascending: true })
      .range(from, to)

    if (err) {
      setError('Error al cargar partners: ' + err.message)
      setPartners([])
      setTotalCount(0)
    } else {
      setPartners(data)
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }

  async function toggleCheck(partner, tipoCheck) {
    const checkActual = partner.checks.find((c) => c.tipo_check === tipoCheck)
    const nuevoEstado = checkActual?.estado === 'OK' ? 'KO' : 'OK'
    const nuevaFechaOk = nuevoEstado === 'OK' ? new Date().toISOString().slice(0, 10) : null

    const { error: err } = await supabase
      .from('checks')
      .update({ estado: nuevoEstado, fecha_ok: nuevaFechaOk })
      .eq('id_partner', partner.id)
      .eq('tipo_check', tipoCheck)

    if (err) {
      setError('Error al actualizar el check: ' + err.message)
      return
    }

    setPartners((prev) =>
      prev.map((p) =>
        p.id !== partner.id
          ? p
          : {
              ...p,
              checks: p.checks.map((c) =>
                c.tipo_check !== tipoCheck ? c : { ...c, estado: nuevoEstado, fecha_ok: nuevaFechaOk }
              ),
            }
      )
    )
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold tracking-tight text-navy">Control de checks de onboarding</h2>

      <div className="card-tight mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={filterTipo}
          onChange={(e) => {
            setFilterTipo(e.target.value)
            setPage(0)
          }}
          className="input max-w-[220px]"
        >
          <option value="">Todos los checks</option>
          {TIPOS_CHECK.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => {
            setFilterEstado(e.target.value)
            setPage(0)
          }}
          className="input max-w-[160px]"
          disabled={!filterTipo}
        >
          <option value="">Cualquier estado</option>
          <option value="KO">Pendiente (KO)</option>
          <option value="OK">Completado (OK)</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
          {error}
        </div>
      )}

      <div className="table-card overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr>
              <th className="th-navy">Partner</th>
              {TIPOS_CHECK.map((t) => (
                <th key={t.key} className="th-navy text-center">
                  {t.label}
                </th>
              ))}
              <th className="th-navy">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gris-azul">
                  Cargando…
                </td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gris-azul">
                  No se han encontrado partners.
                </td>
              </tr>
            ) : (
              partners.map((p) => {
                const editable = filaEditando === p.id
                return (
                  <tr key={p.id} className="border-b border-gris-azul/10 hover:bg-peach/50">
                    <td className="px-4 py-3 font-medium">{p.nombre_empresa}</td>
                    {TIPOS_CHECK.map((t) => {
                      const check = p.checks.find((c) => c.tipo_check === t.key)
                      const estado = check?.estado ?? 'KO'
                      const titulo =
                        estado === 'OK' && check?.fecha_ok ? `OK desde ${check.fecha_ok}` : 'Pendiente'
                      const badgeClass = estado === 'OK' ? 'badge-ok' : 'badge-ko'
                      return (
                        <td key={t.key} className="px-3 py-3 text-center">
                          {editable ? (
                            <button
                              onClick={() => toggleCheck(p, t.key)}
                              title={titulo}
                              className={`${badgeClass} transition-opacity hover:opacity-80`}
                            >
                              {estado}
                            </button>
                          ) : (
                            <span title={titulo} className={`${badgeClass} opacity-70`}>
                              {estado}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setFilaEditando(editable ? null : p.id)}
                        className={editable ? 'btn-ghost !text-cian' : 'btn-ghost'}
                      >
                        {editable ? 'Listo' : 'Editar'}
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-navy">
        <span>
          {totalCount} partner{totalCount === 1 ? '' : 's'} en total
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="btn-pagination"
          >
            Anterior
          </button>
          <span>
            Página {page + 1} de {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page + 1 >= totalPages}
            className="btn-pagination"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
