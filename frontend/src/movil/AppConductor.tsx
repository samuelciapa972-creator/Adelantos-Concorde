import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ErrorBoundary from '../components/ui/ErrorBoundary'
import CambiarPassword from './CambiarPassword'
import Inicio from './Inicio'
import FormularioMovil from './FormularioMovil'
import NuevoSoporte from './NuevoSoporte'

/** App móvil de los conductores (PWA). Se muestra cuando la sesión es de un conductor. */
export default function AppConductor() {
  const { usuario } = useAuth()
  const [cambiando, setCambiando] = useState(false)

  if (usuario?.debe_cambiar_password) return <CambiarPassword obligatorio />

  const abrirCambio = () => setCambiando(true)

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Inicio onCambiarPassword={abrirCambio} />} />
          <Route path="/f/:id" element={<FormularioMovil onCambiarPassword={abrirCambio} />} />
          <Route path="/f/:id/nuevo" element={<NuevoSoporte onCambiarPassword={abrirCambio} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {cambiando && <CambiarPassword onListo={() => setCambiando(false)} onCancelar={() => setCambiando(false)} />}
    </BrowserRouter>
  )
}
