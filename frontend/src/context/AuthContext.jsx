import { createContext, useContext, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMe, login as apiLogin, logout as apiLogout, configurarPrimerUsuario } from '../api'

const AuthContext = createContext(null)

// Vacía los datos en caché (de otro usuario) pero conserva la consulta ['me'],
// que sigue observada: qc.clear() la desconectaría y la pantalla no reaccionaría.
function reiniciarSesion(qc, usuario) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
  qc.setQueryData(['me'], usuario)
}

export function AuthProvider({ children }) {
  const qc = useQueryClient()

  const { data: usuario = null, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => getMe().catch(() => null),
    staleTime: Infinity,
    retry: false,
  })

  // Al recibir un 401 en cualquier petición, volver al login y limpiar datos en caché.
  useEffect(() => {
    const expirada = () => reiniciarSesion(qc, null)
    const cambiarPassword = () =>
      qc.setQueryData(['me'], (u) => (u ? { ...u, debe_cambiar_password: true } : u))
    window.addEventListener('auth:expired', expirada)
    window.addEventListener('auth:cambiar-password', cambiarPassword)
    return () => {
      window.removeEventListener('auth:expired', expirada)
      window.removeEventListener('auth:cambiar-password', cambiarPassword)
    }
  }, [qc])

  const entrar = useCallback(async (credenciales) => {
    const u = await apiLogin(credenciales)
    reiniciarSesion(qc, u)
  }, [qc])

  const configurar = useCallback(async (datos) => {
    const u = await configurarPrimerUsuario(datos)
    reiniciarSesion(qc, u)
  }, [qc])

  // Tras cambiar la contraseña temporal: se quita la obligación sin cerrar la sesión
  const passwordCambiada = useCallback(
    () => qc.setQueryData(['me'], (u) => (u ? { ...u, debe_cambiar_password: false } : u)),
    [qc],
  )

  const salir = useCallback(async () => {
    try { await apiLogout() } finally { reiniciarSesion(qc, null) }
  }, [qc])

  return (
    <AuthContext.Provider value={{ usuario, isLoading, entrar, configurar, salir, passwordCambiada }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
