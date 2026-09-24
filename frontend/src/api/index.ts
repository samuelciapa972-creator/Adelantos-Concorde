import type {
  AnalisisSoporte, AsignacionConductores, CambioPassword, Conductor, ConductorInput, Credenciales,
  CuentaConductor, CuentaConductorInput, DatosPrimerUsuario, EstadoAuth, FiltrosFormularios, Formulario,
  FormularioInput, FormularioMovil, Gasto, GastoInput, GastoMovil, GastoMovilInput, Mes, MesInput,
  PerfilMovil, ResumenMes, Usuario, Vehiculo, VehiculoInput,
} from '../types'

const BASE = '/api'

type Id = number | string

/** Error de la API con el código y el estado HTTP que devolvió el servidor. */
export class ApiError extends Error {
  codigo?: string
  status: number

  constructor(mensaje: string, status: number, codigo?: string) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
  }
}

/** Forma de todas las respuestas: { ok: true, data } o { ok: false, error, codigo? } */
interface Respuesta<T> {
  ok?: boolean
  data?: T
  error?: string
  codigo?: string
}

const leerJson = <T,>(res: Response): Promise<Respuesta<T>> =>
  res.json().catch(() => ({})) as Promise<Respuesta<T>>

interface Opciones {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

async function request<T = void>(path: string, options: Opciones = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    method: options.method,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const json = await leerJson<T>(res)

  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (res.status === 403 && json.codigo === 'CAMBIAR_PASSWORD') {
    window.dispatchEvent(new Event('auth:cambiar-password'))
  }

  if (!res.ok || !json.ok) {
    throw new ApiError(json.error ?? 'Error en la solicitud', res.status, json.codigo)
  }

  return json.data as T
}

/** Resultado de un POST que crea un registro. */
interface Creado {
  id: number
}

// ─────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────

export const login = (body: Credenciales) =>
  request<Usuario>('/auth/login', { method: 'POST', body })

export const logout = () =>
  request('/auth/logout', { method: 'POST' })

export const getMe = () =>
  request<Usuario>('/auth/me')

export const getEstadoAuth = () =>
  request<EstadoAuth>('/auth/estado')

export const configurarPrimerUsuario = (body: DatosPrimerUsuario) =>
  request<Usuario>('/auth/setup', { method: 'POST', body })

export const cambiarPassword = (body: CambioPassword) =>
  request('/auth/password', { method: 'POST', body })

// ─────────────────────────────────────────────
// MESES
// ─────────────────────────────────────────────

export const getMeses = () =>
  request<Mes[]>('/meses')

export const crearMes = (body: MesInput) =>
  request<Mes>('/meses', {
    method: 'POST',
    body,
  })

export const getResumenMes = (id: Id, vehiculoId?: Id | null) => {
  const params = vehiculoId ? `?vehiculo_id=${encodeURIComponent(vehiculoId)}` : ''
  return request<ResumenMes>(`/meses/${id}/resumen${params}`)
}

export const cerrarMes = (id: Id) =>
  request(`/meses/${id}/cerrar`, {
    method: 'PATCH',
  })

export const reabrirMes = (id: Id) =>
  request(`/meses/${id}/reabrir`, {
    method: 'PATCH',
  })

// ─────────────────────────────────────────────
// CONDUCTORES
// ─────────────────────────────────────────────

export const getConductores = () =>
  request<Conductor[]>('/conductores')

export const crearConductor = (body: ConductorInput) =>
  request<Creado>('/conductores', {
    method: 'POST',
    body,
  })

export const actualizarConductor = (id: Id, body: ConductorInput) =>
  request(`/conductores/${id}`, {
    method: 'PUT',
    body,
  })

export const eliminarConductor = (id: Id) =>
  request(`/conductores/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// VEHICULOS
// ─────────────────────────────────────────────

export const getVehiculos = () =>
  request<Vehiculo[]>('/vehiculos')

export const crearVehiculo = (body: VehiculoInput) =>
  request<Vehiculo>('/vehiculos', {
    method: 'POST',
    body,
  })

export const actualizarVehiculo = (id: Id, body: VehiculoInput) =>
  request(`/vehiculos/${id}`, {
    method: 'PUT',
    body,
  })

export const asignarConductores = (id: Id, body: AsignacionConductores) =>
  request(`/vehiculos/${id}/conductores`, {
    method: 'PATCH',
    body,
  })

export const eliminarVehiculo = (id: Id) =>
  request(`/vehiculos/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// FORMULARIOS
// ─────────────────────────────────────────────

export const getFormularios = (params: FiltrosFormularios = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v != null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString()

  return request<Formulario[]>(
    `/formularios${q ? '?' + q : ''}`
  )
}

export const crearFormulario = (body: FormularioInput) =>
  request<Formulario>('/formularios', {
    method: 'POST',
    body,
  })

export const actualizarFormulario = (id: Id, body: FormularioInput) =>
  request<Formulario>(`/formularios/${id}`, {
    method: 'PUT',
    body,
  })

export const legalizarFormulario = (id: Id) =>
  request(`/formularios/${id}/legalizar`, {
    method: 'PATCH',
  })

export const eliminarFormulario = (id: Id) =>
  request(`/formularios/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// GASTOS
// ─────────────────────────────────────────────

export const getGastos = (formulario_id: Id) =>
  request<Gasto[]>(`/gastos?formulario_id=${encodeURIComponent(formulario_id)}`)

export const crearGasto = (body: GastoInput) =>
  request<Creado>('/gastos', {
    method: 'POST',
    body,
  })

export const actualizarGasto = (id: Id, body: GastoInput) =>
  request(`/gastos/${id}`, {
    method: 'PUT',
    body,
  })

export const eliminarGasto = (id: Id) =>
  request(`/gastos/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// SUBIDA DE RECIBOS
// ─────────────────────────────────────────────

/** Sube el soporte y devuelve su ruta pública ('/uploads/recibos/…'). */
export async function subirRecibo(file: File): Promise<string> {
  const formData = new FormData()

  formData.append('archivo', file)

  const res = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
  })

  const json = await leerJson<{ nombre: string; ruta: string }>(res)

  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'))
  }

  if (!res.ok || !json.ok || !json.data) {
    throw new ApiError(json.error ?? 'Error al subir recibo', res.status)
  }

  return json.data.ruta
}

// ─────────────────────────────────────────────
// REPORTES (descarga con sesión y errores legibles)
// ─────────────────────────────────────────────

export type TipoReporte = 'excel' | 'pdf'

export async function descargarReporte(tipo: TipoReporte, mesId: Id, vehiculoId?: Id | null): Promise<void> {
  const params = vehiculoId ? `?vehiculo_id=${encodeURIComponent(vehiculoId)}` : ''
  const res = await fetch(`${BASE}/reportes/${tipo}/${mesId}${params}`)

  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok) {
    const json = await leerJson<never>(res)
    throw new ApiError(json.error ?? 'No se pudo generar el reporte', res.status)
  }

  const blob = await res.blob()
  const nombre = /filename=([^;]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? `reporte.${tipo === 'excel' ? 'xlsx' : 'pdf'}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

// ─────────────────────────────────────────────
// USUARIOS (cuentas de conductores — administrador)
// ─────────────────────────────────────────────

export const getUsuarios = () => request<CuentaConductor[]>('/usuarios')
export const crearUsuarioConductor = (body: CuentaConductorInput) => request<Creado>('/usuarios', { method: 'POST', body })
export const restablecerPassword = (id: Id, password: string) => request(`/usuarios/${id}/password`, { method: 'POST', body: { password } })
export const cambiarAccesoUsuario = (id: Id, activo: 0 | 1) => request(`/usuarios/${id}/activo`, { method: 'PATCH', body: { activo } })

// ─────────────────────────────────────────────
// APP MÓVIL (conductores)
// ─────────────────────────────────────────────

export const getPerfilMovil = () => request<PerfilMovil>('/movil/perfil')
export const getFormulariosMovil = () => request<FormularioMovil[]>('/movil/formularios')
export const getGastosMovil = (formularioId: Id) => request<GastoMovil[]>(`/movil/formularios/${encodeURIComponent(formularioId)}/gastos`)
export const crearGastoMovil = (body: GastoMovilInput) => request<Creado>('/movil/gastos', { method: 'POST', body })
export const eliminarGastoMovil = (id: Id) => request(`/movil/gastos/${id}`, { method: 'DELETE' })

/** Sube la foto y devuelve lo que se leyó en ella. */
export async function analizarSoporte(file: File): Promise<AnalisisSoporte> {
  const formData = new FormData()
  formData.append('foto', file, file.name || 'soporte.jpg')

  let res: Response
  try {
    res = await fetch(`${BASE}/movil/analizar`, { method: 'POST', body: formData })
  } catch {
    throw new ApiError('Sin conexión. Revisa tu señal e inténtalo de nuevo.', 0)
  }
  const json = await leerJson<AnalisisSoporte>(res)
  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok || !json.ok || !json.data) throw new ApiError(json.error ?? 'No se pudo enviar la foto', res.status)
  return json.data
}
