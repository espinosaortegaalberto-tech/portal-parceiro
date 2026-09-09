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
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold">Portal de gestión de partners</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-white/70 hover:text-white hover:underline"
          >
            Cerrar sesión
          </button>
        </div>
        <nav className="mx-auto max-w-7xl px-6">
          <ul className="flex flex-wrap gap-1 border-t border-white/10 text-sm">
            {navItems.map((item) => (
              <li key={item.to}>
                {item.disabled ? (
                  <span className="block cursor-not-allowed px-4 py-3 text-white/40">
                    {item.label}
                  </span>
                ) : (
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `block px-4 py-3 transition-colors ${
                        isActive
                          ? 'bg-naranja text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
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
