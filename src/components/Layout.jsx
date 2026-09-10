import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const navItems = [
  { to: '/partners', label: 'Partners', disabled: false },
  { to: '/configuracion', label: 'Configuración de comisiones', disabled: false },
  { to: '/comisiones', label: 'Cálculo de comisiones', disabled: false },
  { to: '/seguimiento', label: 'Seguimiento de ventas', disabled: false },
  { to: '/checks', label: 'Control de checks', disabled: false },
  { to: '/pagos', label: 'Pagos a partners', disabled: false },
  { to: '/reporting', label: 'Reporting', disabled: true },
]

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-peach">
      <header className="sticky top-0 z-40 bg-navy text-white shadow-[0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.25)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-naranja shadow-[0_0_0_4px_rgba(255,89,13,0.2)]" />
            <h1 className="text-lg font-bold tracking-tight">Portal de gestión de partners</h1>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="mx-auto max-w-7xl px-4 pb-3">
          <ul className="flex flex-wrap gap-1 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                {item.disabled ? (
                  <span className="block cursor-not-allowed rounded-lg px-3.5 py-2 text-white/30">
                    {item.label}
                  </span>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `block rounded-lg px-3.5 py-2 font-medium transition-colors ${
                        isActive
                          ? 'bg-white text-navy shadow-sm'
                          : 'text-white/75 hover:bg-white/10 hover:text-white'
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  )
}
