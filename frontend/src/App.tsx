import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { MesProvider } from './context/MesContext'
import { ToastProvider } from './components/ui/Toast'
import ErrorBoundary from './components/ui/ErrorBoundary'
import { PageSkeleton } from './components/ui/Skeleton'
import Layout from './components/layout/Layout'
import Login from './pages/Login'

const AppConductor = lazy(() => import('./movil/AppConductor'))

const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Formularios = lazy(() => import('./pages/Formularios'))
const Vehiculos   = lazy(() => import('./pages/Vehiculos'))
const Conductores = lazy(() => import('./pages/Conductores'))
const Alertas     = lazy(() => import('./pages/Alertas'))
const NotFound    = lazy(() => import('./pages/NotFound'))

function AppAutenticada() {
  return (
    <BrowserRouter>
      <MesProvider>
        <Layout>
          <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/"            element={<Dashboard />}   />
                <Route path="/formularios" element={<Formularios />} />
                <Route path="/vehiculos"   element={<Vehiculos />}   />
                <Route path="/conductores" element={<Conductores />} />
                <Route path="/alertas"     element={<Alertas />}     />
                <Route path="*"            element={<NotFound />}    />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </MesProvider>
    </BrowserRouter>
  )
}

function Puerta() {
  const { usuario, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-surface" role="status">
        <p className="text-ink-mute text-sm">Cargando…</p>
      </div>
    )
  }

  if (!usuario) return <Login />
  if (usuario.rol === 'conductor') {
    return (
      <Suspense fallback={<div className="min-h-dvh flex items-center justify-center bg-surface" role="status"><p className="text-ink-mute text-sm">Cargando…</p></div>}>
        <AppConductor />
      </Suspense>
    )
  }
  return <AppAutenticada />
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Puerta />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
