import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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
    <div className="flex min-h-screen items-center justify-center bg-peach">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-1 text-xl font-bold text-navy">Portal de partners</h1>
        <p className="mb-6 text-sm text-gris-azul">
          Acceso solo para el equipo interno. Inicia sesión con tu cuenta.
        </p>

        {error && (
          <div className="mb-4 rounded border border-rojo bg-rojo/10 px-3 py-2 text-sm text-rojo">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleSsoLogin}
          disabled={ssoLoading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded border border-navy px-4 py-2 text-sm font-medium text-navy hover:bg-peach disabled:opacity-50"
        >
          {ssoLoading ? 'Redirigiendo…' : 'Iniciar sesión con Microsoft'}
        </button>

        <div className="mb-4 flex items-center gap-3 text-xs text-gris-azul">
          <span className="h-px flex-1 bg-gris-azul/30" />
          o
          <span className="h-px flex-1 bg-gris-azul/30" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-navy">Contraseña</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-naranja px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
