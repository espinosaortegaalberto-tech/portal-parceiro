import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Activar cuando el proveedor Azure (Entra ID) esté configurado en Supabase
// (Authentication → Providers → Azure). Hasta entonces el botón daría error.
const SSO_HABILITADO = false

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError('No se ha podido iniciar sesión: ' + err.message)
  }

  async function handleSsoLogin() {
    setError('')
    setSsoLoading(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { scopes: 'email' },
    })
    if (err) {
      setError('No se ha podido iniciar sesión con Microsoft: ' + err.message)
      setSsoLoading(false)
    }
    // Si no hay error, Supabase redirige a Microsoft y esta página se descarga.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff5f0_0%,_#fdefea_45%,_#fbe3da_100%)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-navy/5 bg-white p-8 shadow-[0_1px_2px_rgba(0,28,52,0.04),0_20px_40px_-12px_rgba(0,28,52,0.18)]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-naranja shadow-[0_0_0_4px_rgba(255,89,13,0.15)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-gris-azul">
            Acceso interno
          </span>
        </div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-navy">Portal de partners</h1>
        <p className="mb-6 text-sm text-gris-azul">
          Solo para el equipo interno. Inicia sesión con tu cuenta.
        </p>

        {error && (
          <div className="mb-4 rounded-xl border border-rojo/20 bg-rojo/10 px-3 py-2.5 text-sm text-rojo">
            {error}
          </div>
        )}

        {SSO_HABILITADO && (
          <>
            <button type="button" onClick={handleSsoLogin} disabled={ssoLoading} className="btn-secondary mb-4 w-full">
              {ssoLoading ? 'Redirigiendo…' : 'Iniciar sesión con Microsoft'}
            </button>

            <div className="mb-4 flex items-center gap-3 text-xs text-gris-azul">
              <span className="h-px flex-1 bg-navy/10" />
              o
              <span className="h-px flex-1 bg-navy/10" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="field-label">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </label>
          <label className="block text-sm">
            <span className="field-label">Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </label>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
