// Modelos que devuelve la API (ver backend/src/routes). Los booleanos de SQLite llegan como 0 | 1.

export type Bit = 0 | 1
export type Rol = 'admin' | 'conductor'
export type RolVehiculo = 'titular' | 'relevador'
export type EstadoFormulario = 'legalizado' | 'pendiente' | 'sin_legalizar'
export type TipoGasto =
  | 'combustible' | 'peaje' | 'hotel' | 'alimentacion' | 'parqueadero' | 'mantenimiento' | 'reparacion' | 'otro'

// ── Sesión ──────────────────────────────────────────────────────────────────

export interface Usuario {
  id: number
  usuario: string
  nombre: string
  rol: Rol
  conductor_id: number | null
  debe_cambiar_password: boolean
}

export interface EstadoAuth {
  configurado: boolean
  puedeConfigurar: boolean
}

export interface Credenciales {
  usuario: string
  password: string
}

export interface DatosPrimerUsuario extends Credenciales {
  nombre: string
}

export interface CambioPassword {
  actual: string
  nueva: string
}

// ── Panel de administración ─────────────────────────────────────────────────

export interface Mes {
  id: number
  nombre: string
  anio: number
  cerrado: Bit
}

export interface ResumenVehiculo {
  vehiculo_id: number
  vehiculo: string
  placa: string | null
  titular_id: number | null
  titular: string | null
  relevador_id: number | null
  relevador: string | null
  total_formularios: number
  total_anticipo: number
  total_facturas: number
  saldo_real: number
  sin_legalizar: number
  con_pendiente: number
  legalizados: number
}

export interface ResumenMes {
  mes: Mes
  resumen: ResumenVehiculo[]
}

export interface Conductor {
  id: number
  nombre: string
  iniciales: string | null
  licencia: string | null
  tipo: RolVehiculo
  activo: Bit
  creado_en: string
}

export interface Vehiculo {
  id: number
  numero_interno: string
  placa: string
  marca: string | null
  modelo: string | null
  color: string | null
  cuenta_id: number
  cuenta_codigo: string | null
  activo: Bit
  titular_id: number | null
  titular: string | null
  relevador_id: number | null
  relevador: string | null
}

export interface Saldos {
  total_facturas: number
  saldo_real: number
  saldo_empresa: number
  saldo_empresa_relevador: number
  saldo_conductor: number
  saldo_relevador: number
}

export interface Formulario extends Saldos {
  id: number
  numero: string
  fecha_dia: number
  conductor_id: number
  vehiculo_id: number
  mes_id: number
  fecha_salida: string | null
  fecha_regreso: string | null
  ruta: string | null
  anticipo: number
  tasa_uso: number
  hospedaje: number
  mantenimiento: number
  estado: EstadoFormulario
  notas: string | null
  conductor_nombre: string
  conductor_iniciales: string | null
  titular_nombre: string | null
  relevador_nombre: string | null
  numero_interno: string
  placa: string
  mes_nombre: string
  mes_anio: number
}

export interface Gasto {
  id: number
  formulario_id: number
  fecha: string
  tipo: TipoGasto
  concepto: string
  valor: number
  observacion: string | null
  soporte: string | null
  proveedor: string | null
  nit: string | null
  numero_documento: string | null
  origen: 'panel' | 'app_movil' | (string & {})
  creado_por_nombre: string | null
}

/** Cuenta de la app móvil de un conductor. */
export interface CuentaConductor {
  id: number
  usuario: string
  activo: Bit
  debe_cambiar_password: Bit
  creado_en: string
  conductor_id: number
  conductor_nombre: string
  ultima_sesion: string | null
}

// Cuerpos que se envían

export interface MesInput {
  nombre: string
  anio: number
}

export interface ConductorInput {
  nombre?: string
  iniciales?: string
  licencia?: string | null
  tipo?: RolVehiculo
  activo?: Bit
}

export interface VehiculoInput {
  numero_interno: string
  placa: string
  marca: string | null
  modelo: string | null
  color: string | null
}

export interface AsignacionConductores {
  titular_id: number | null
  relevador_id: number | null
}

export interface FormularioInput {
  numero: string
  fecha_dia: number
  conductor_id: number
  vehiculo_id: number
  mes_id: number
  fecha_salida: string | null
  fecha_regreso: string | null
  anticipo: number
  tasa_uso: number
  hospedaje: number
  mantenimiento: number
  ruta: string
  estado: EstadoFormulario
  notas: string
}

export interface FiltrosFormularios {
  mes_id?: number | null
  vehiculo_id?: number | string | null
  conductor_id?: number | string | null
  estado?: EstadoFormulario | '' | null
}

export interface GastoInput {
  formulario_id: number
  fecha: string
  tipo: TipoGasto
  concepto: string
  valor: number
  observacion: string
  proveedor: string | null
  nit: string | null
  numero_documento: string | null
  soporte: string | null
}

export interface CuentaConductorInput {
  conductor_id: number
  usuario: string
  password: string
}

// ── App móvil (conductores) ─────────────────────────────────────────────────

export interface PerfilMovil {
  nombre: string
  vehiculos: { numero_interno: string; placa: string; rol: RolVehiculo }[]
}

export interface FormularioMovil {
  id: number
  numero: string
  fecha_dia: number
  ruta: string | null
  estado: EstadoFormulario
  anticipo: number
  mes_nombre: string
  mes_anio: number
  mes_cerrado: Bit
  numero_interno: string
  placa: string
  n_gastos: number
  total_facturas: number
  saldo_real: number
  editable: boolean
}

export interface GastoMovil {
  id: number
  fecha: string
  tipo: TipoGasto
  concepto: string
  valor: number
  observacion: string | null
  soporte: string | null
  proveedor: string | null
  nit: string | null
  numero_documento: string | null
  origen: string
  propio: boolean
}

export type Confianza = 'alta' | 'media' | 'baja'

export interface DatosExtraidos {
  valor: number | null
  fecha: string | null
  tipo: TipoGasto
  proveedor: string | null
  nit: string | null
  numero_documento: string | null
  confianza: {
    valor: Confianza | null
    fecha: Confianza | null
    tipo: Confianza
    proveedor: Confianza | null
    nit: Confianza | null
    numero_documento: Confianza | null
  }
}

export interface AnalisisSoporte {
  archivo: string
  extraido: DatosExtraidos | null
  ocr: { ok: boolean; confianza: number | null }
  advertencia: string | null
}

export interface GastoMovilInput {
  formulario_id: number
  fecha: string
  tipo: TipoGasto
  concepto: string
  valor: number
  observacion: string
  proveedor: string | null
  nit: string | null
  numero_documento: string | null
  soporte: string
  ocr_confianza: number | null
  confirmar_duplicado?: boolean
}
