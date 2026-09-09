import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Partners from './pages/Partners'
import Configuracion from './pages/Configuracion'
import Comisiones from './pages/Comisiones'
import Seguimiento from './pages/Seguimiento'
import Checks from './pages/Checks'
import Pagos from './pages/Pagos'

function AppRoutes() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-peach text-navy">Cargando…</div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/partners" replace />} />
        <Route path="/partners" element={<Partners />} />
        <Route path="/configuracion" element={<Configuracion />} />
        <Route path="/comisiones" element={<Comisiones />} />
        <Route path="/seguimiento" element={<Seguimiento />} />
        <Route path="/checks" element={<Checks />} />
        <Route path="/pagos" element={<Pagos />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
