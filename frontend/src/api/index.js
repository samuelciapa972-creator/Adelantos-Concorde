const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const json = await res.json().catch(() => ({}))

  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (res.status === 403 && json.codigo === 'CAMBIAR_PASSWORD') {
    window.dispatchEvent(new Event('auth:cambiar-password'))
  }

  if (!res.ok || !json.ok) {
    throw Object.assign(new Error(json.error ?? 'Error en la solicitud'), { codigo: json.codigo, status: res.status })
  }

  return json.data
}

// ─────────────────────────────────────────────
// AUTENTICACIÓN
// ─────────────────────────────────────────────

export const login = (body) =>
  request('/auth/login', { method: 'POST', body })

export const logout = () =>
  request('/auth/logout', { method: 'POST' })

export const getMe = () =>
  request('/auth/me')

export const getEstadoAuth = () =>
  request('/auth/estado')

export const configurarPrimerUsuario = (body) =>
  request('/auth/setup', { method: 'POST', body })

export const cambiarPassword = (body) =>
  request('/auth/password', { method: 'POST', body })

// ─────────────────────────────────────────────
// MESES
// ─────────────────────────────────────────────

export const getMeses = () =>
  request('/meses')

export const crearMes = (body) =>
  request('/meses', {
    method: 'POST',
    body,
  })

export const getResumenMes = (id, vehiculoId) => {
  const params = vehiculoId ? `?vehiculo_id=${encodeURIComponent(vehiculoId)}` : ''
  return request(`/meses/${id}/resumen${params}`)
}

export const cerrarMes = (id) =>
  request(`/meses/${id}/cerrar`, {
    method: 'PATCH',
  })

export const reabrirMes = (id) =>
  request(`/meses/${id}/reabrir`, {
    method: 'PATCH',
  })

// ─────────────────────────────────────────────
// CONDUCTORES
// ─────────────────────────────────────────────

export const getConductores = () =>
  request('/conductores')

export const crearConductor = (body) =>
  request('/conductores', {
    method: 'POST',
    body,
  })

export const actualizarConductor = (id, body) =>
  request(`/conductores/${id}`, {
    method: 'PUT',
    body,
  })

export const eliminarConductor = (id) =>
  request(`/conductores/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// VEHICULOS
// ─────────────────────────────────────────────

export const getVehiculos = () =>
  request('/vehiculos')

export const crearVehiculo = (body) =>
  request('/vehiculos', {
    method: 'POST',
    body,
  })

export const actualizarVehiculo = (id, body) =>
  request(`/vehiculos/${id}`, {
    method: 'PUT',
    body,
  })

export const asignarConductores = (id, body) =>
  request(`/vehiculos/${id}/conductores`, {
    method: 'PATCH',
    body,
  })

export const eliminarVehiculo = (id) =>
  request(`/vehiculos/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// FORMULARIOS
// ─────────────────────────────────────────────

export const getFormularios = (params = {}) => {
  const q = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params).filter(
        ([, v]) => v != null && v !== ''
      )
    )
  ).toString()

  return request(
    `/formularios${q ? '?' + q : ''}`
  )
}

export const crearFormulario = (body) =>
  request('/formularios', {
    method: 'POST',
    body,
  })

export const actualizarFormulario = (id, body) =>
  request(`/formularios/${id}`, {
    method: 'PUT',
    body,
  })

export const legalizarFormulario = (id) =>
  request(`/formularios/${id}/legalizar`, {
    method: 'PATCH',
  })

export const eliminarFormulario = (id) =>
  request(`/formularios/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// CUENTAS
// ─────────────────────────────────────────────

export const getCuentas = () =>
  request('/cuentas')

export const crearCuenta = (body) =>
  request('/cuentas', {
    method: 'POST',
    body,
  })
  // ─────────────────────────────────────────────
// GASTOS
// ─────────────────────────────────────────────

export const getGastos = (formulario_id) =>
  request(`/gastos?formulario_id=${encodeURIComponent(formulario_id)}`)

export const crearGasto = (body) =>
  request('/gastos', {
    method: 'POST',
    body,
  })

export const actualizarGasto = (id, body) =>
  request(`/gastos/${id}`, {
    method: 'PUT',
    body,
  })

export const eliminarGasto = (id) =>
  request(`/gastos/${id}`, {
    method: 'DELETE',
  })

// ─────────────────────────────────────────────
// SUBIDA DE RECIBOS
// ─────────────────────────────────────────────

export async function subirRecibo(file) {
  const formData = new FormData()

  formData.append('archivo', file)

  const res = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
  })

  const json = await res.json().catch(() => ({}))

  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'))
  }

  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? 'Error al subir recibo')
  }

  return json.data.ruta
}

// ─────────────────────────────────────────────
// REPORTES (descarga con sesión y errores legibles)
// ─────────────────────────────────────────────

export async function descargarReporte(tipo, mesId, vehiculoId) {
  const params = vehiculoId ? `?vehiculo_id=${encodeURIComponent(vehiculoId)}` : ''
  const res = await fetch(`${BASE}/reportes/${tipo}/${mesId}${params}`)

  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? 'No se pudo generar el reporte')
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

export const getUsuarios = () => request('/usuarios')
export const crearUsuarioConductor = (body) => request('/usuarios', { method: 'POST', body })
export const restablecerPassword = (id, password) => request(`/usuarios/${id}/password`, { method: 'POST', body: { password } })
export const cambiarAccesoUsuario = (id, activo) => request(`/usuarios/${id}/activo`, { method: 'PATCH', body: { activo } })

// ─────────────────────────────────────────────
// APP MÓVIL (conductores)
// ─────────────────────────────────────────────

export const getPerfilMovil = () => request('/movil/perfil')
export const getFormulariosMovil = () => request('/movil/formularios')
export const getGastosMovil = (formularioId) => request(`/movil/formularios/${encodeURIComponent(formularioId)}/gastos`)
export const crearGastoMovil = (body) => request('/movil/gastos', { method: 'POST', body })
export const eliminarGastoMovil = (id) => request(`/movil/gastos/${id}`, { method: 'DELETE' })

/** Sube la foto y devuelve { archivo, extraido, ocr, advertencia } */
export async function analizarSoporte(file) {
  const formData = new FormData()
  formData.append('foto', file, file.name || 'soporte.jpg')

  let res
  try {
    res = await fetch(`${BASE}/movil/analizar`, { method: 'POST', body: formData })
  } catch {
    throw new Error('Sin conexión. Revisa tu señal e inténtalo de nuevo.')
  }
  const json = await res.json().catch(() => ({}))
  if (res.status === 401) window.dispatchEvent(new Event('auth:expired'))
  if (!res.ok || !json.ok) throw new Error(json.error ?? 'No se pudo enviar la foto')
  return json.data
}
