import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import PartnerForm from '../components/PartnerForm'
import PartnerDetail from '../components/PartnerDetail'
import CargaPartners from '../components/CargaPartners'

const PAGE_SIZE = 20

export default function Partners() {
  const [partners, setPartners] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filterEstado, setFilterEstado] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterSector, setFilterSector] = useState('')
  const [page, setPage] = useState(0)

  const [categorias, setCategorias] = useState([])
  const [sectores, setSectores] = useState([])

  const [showForm, setShowForm] = useState(false)
  const [editingPartner, setEditingPartner] = useState(null)
  const [saving, setSaving] = useState(false)

  const [partnerDetalleId, setPartnerDetalleId] = useState(null)
  const [showCarga, setShowCarga] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim())
      setPage(0)
    }, 350)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    fetchPartners()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, filterEstado, filterCategoria, filterSector, page])

  useEffect(() => {
    fetchFilterOptions()
  }, [])

  async function fetchFilterOptions() {
    const { data, error: err } = await supabase
      .from('partners')
      .select('categoria, sector')
    if (err) return
    const cats = new Set()
    const secs = new Set()
    for (const row of data) {
      if (row.categoria) cats.add(row.categoria)
      if (row.sector) secs.add(row.sector)
    }
    setCategorias([...cats].sort())
    setSectores([...secs].sort())
  }

  async function fetchPartners() {
    setLoading(true)
    setError('')

    let query = supabase.from('partners').select('*', { count: 'exact' })

    if (searchDebounced) {
      query = query.or(
        `nombre_empresa.ilike.%${searchDebounced}%,id.ilike.%${searchDebounced}%`
      )
    }
    if (filterEstado) query = query.eq('estado', filterEstado)
    if (filterCategoria) query = query.eq('categoria', filterCategoria)
    if (filterSector) query = query.eq('sector', filterSector)

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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    [totalCount]
  )

  function openNewForm() {
    setEditingPartner(null)
    setShowForm(true)
  }

  function openEditForm(partner) {
    setEditingPartner(partner)
    setShowForm(true)
  }

  async function handleSave(form) {
    setSaving(true)
    setError('')

    const payload = {
      id: form.id.trim(),
      nombre_empresa: form.nombre_empresa.trim(),
      direccion: form.direccion || null,
      email: form.email || null,
      telefono: form.telefono || null,
      contacto: form.contacto || null,
      sector: form.sector || null,
      url_web: form.url_web || null,
      estado: form.estado,
      categoria: form.categoria || null,
      fecha_alta: form.fecha_alta || null,
    }

    let err
    if (editingPartner) {
      ;({ error: err } = await supabase
        .from('partners')
        .update(payload)
        .eq('id', editingPartner.id))
    } else {
      ;({ error: err } = await supabase.from('partners').insert(payload))
    }

    setSaving(false)

    if (err) {
      setError('Error al guardar: ' + err.message)
      return
    }

    setShowForm(false)
    setEditingPartner(null)
    fetchPartners()
    fetchFilterOptions()
  }

  async function toggleEstado(partner) {
    const nuevoEstado = partner.estado === 'activo' ? 'inactivo' : 'activo'
    const { error: err } = await supabase
      .from('partners')
      .update({ estado: nuevoEstado })
      .eq('id', partner.id)
    if (err) {
      setError('Error al cambiar estado: ' + err.message)
      return
    }
    fetchPartners()
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight text-navy">Gestión de partners</h2>
        <div className="flex gap-3">
          <button onClick={() => setShowCarga(true)} className="btn-outline-accent">
            Cargar partners
          </button>
          <button onClick={openNewForm} className="btn-primary">
            + Nuevo partner
          </button>
        </div>
      </div>

      <div className="card-tight mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input max-w-xs"
        />
        <select
          value={filterEstado}
          onChange={(e) => {
            setFilterEstado(e.target.value)
            setPage(0)
          }}
          className="input max-w-[160px]"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Activo</option>
          <option value="inactivo">Inactivo</option>
        </select>
        <select
          value={filterCategoria}
          onChange={(e) => {
            setFilterCategoria(e.target.value)
            setPage(0)
          }}
          className="input max-w-[200px]"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterSector}
          onChange={(e) => {
            setFilterSector(e.target.value)
            setPage(0)
          }}
          className="input max-w-[200px]"
        >
          <option value="">Todos los sectores</option>
          {sectores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
          {error}
        </div>
      )}

      <div className="table-card overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr>
              <th className="th-navy">Código</th>
              <th className="th-navy">Empresa</th>
              <th className="th-navy">Sector</th>
              <th className="th-navy">Categoría</th>
              <th className="th-navy">Contacto</th>
              <th className="th-navy">Estado</th>
              <th className="th-navy">Alta</th>
              <th className="th-navy">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gris-azul">
                  Cargando…
                </td>
              </tr>
            ) : partners.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gris-azul">
                  No se han encontrado partners.
                </td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id} className="border-b border-gris-azul/10 hover:bg-peach/50">
                  <td className="px-4 py-3 font-mono">
                    <button
                      onClick={() => setPartnerDetalleId(p.id)}
                      className="text-left text-azul hover:underline"
                    >
                      {p.id}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <button
                      onClick={() => setPartnerDetalleId(p.id)}
                      className="text-left text-azul hover:underline"
                    >
                      {p.nombre_empresa}
                    </button>
                  </td>
                  <td className="px-4 py-3">{p.sector || '—'}</td>
                  <td className="px-4 py-3">{p.categoria || '—'}</td>
                  <td className="px-4 py-3">{p.contacto || p.email || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={p.estado === 'activo' ? 'badge-ok' : 'badge-ko'}>
                      {p.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.fecha_alta}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button onClick={() => openEditForm(p)} className="btn-ghost">
                        Editar
                      </button>
                      <button onClick={() => toggleEstado(p)} className="btn-ghost !text-gris-azul">
                        {p.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
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

      {showCarga && (
        <CargaPartners
          onClose={() => setShowCarga(false)}
          onCargaCompleta={() => {
            fetchPartners()
            fetchFilterOptions()
          }}
        />
      )}

      {partnerDetalleId && (
        <PartnerDetail
          partnerId={partnerDetalleId}
          onClose={() => setPartnerDetalleId(null)}
          onEditar={(partner) => {
            setPartnerDetalleId(null)
            openEditForm(partner)
          }}
        />
      )}

      {showForm && (
        <PartnerForm
          partner={editingPartner}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false)
            setEditingPartner(null)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}
